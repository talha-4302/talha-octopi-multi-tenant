import { randomUUID } from 'node:crypto';
import { withTenant } from '../../db/withTenant.js';
import { conflict, notFound } from '../../lib/errors.js';
import {
  ROLES, ERROR_CODE, USER_STATUS, TOKEN_PURPOSE, NOTIFICATION_KIND, PG_UNIQUE_VIOLATION,
} from '../../lib/constants.js';
import { offsetOf, envelope } from '../../lib/pagination.js';
import { createOneTimeToken } from '../auth/tokenRepository.js';
import { INVITE_TTL_MS } from '../auth/service.js';
import { revokeAllForUser } from '../auth/refreshService.js';
import { notify } from '../../lib/email/index.js';
import * as repo from './repository.js';

const shape = (u) => ({
  id: u.id, email: u.email, name: u.name,
  role: u.role, status: u.status, createdAt: u.created_at,
});

export async function listMembers({ orgId }, query) {
  const { rows, total } = await withTenant(orgId, (c) =>
    repo.list(c, { ...query, offset: offsetOf(query) }));
  return envelope(rows.map(shape), total, query);
}

export async function inviteMember({ orgId }, { email, name, role }) {
  const user = await withTenant(orgId, async (c) => {
    // Seat limit: needs a count, which no cheap constraint expresses.
    const [seats, limit] = await Promise.all([repo.countActiveSeats(c), repo.planLimit(c)]);
    if (seats >= limit) {
      throw conflict(ERROR_CODE.SEAT_LIMIT_REACHED,
        `Your plan allows ${limit} members. Upgrade to invite more.`);
    }

    // The tenant-scoped read only sees rows in THIS org. A row in another org is
    // invisible here and surfaces below as a unique violation instead, which is
    // exactly the distinction the two error codes encode.
    const existing = await repo.findByEmailInTenant(c, email);
    if (existing && existing.status !== USER_STATUS.REMOVED) {
      throw conflict(ERROR_CODE.ALREADY_A_MEMBER, 'That person is already a member.');
    }

    if (existing) return repo.reactivate(c, { id: existing.id, name, role });
    try {
      return await repo.insert(c, { id: randomUUID(), email, name, role, orgId });
    } catch (err) {
      if (err.code === PG_UNIQUE_VIOLATION) {
        // Deliberately not "already a member", which would leak the other tenant.
        throw conflict(ERROR_CODE.EMAIL_IN_USE, 'That email address is already in use.');
      }
      throw err;
    }
  });

  // After commit, never inside: createOneTimeToken writes through appPool, a
  // separate connection, so it cannot see a user row this transaction has not
  // committed yet.
  const token = await createOneTimeToken({
    userId: user.id, purpose: TOKEN_PURPOSE.INVITE, ttlMs: INVITE_TTL_MS });

  // Also after commit. An email cannot be rolled back.
  await notify({
    orgId, kind: NOTIFICATION_KIND.MEMBER_INVITED, to: user.email,
    dedupKey: `MEMBER_INVITED:${user.id}:${token.slice(0, 12)}`,
    data: { name: user.name, token },
  });

  return shape(user);
}

// The last-admin rule needs a count and a branch, so it lives here rather
// than in a constraint. It guards demotion and removal alike.
async function assertNotLastAdmin(client, target) {
  if (target.role !== ROLES.ORG_ADMIN) return;
  if (await repo.countAdmins(client) <= 1) {
    throw conflict(ERROR_CODE.LAST_ADMIN,
      'Your organization needs at least one admin. Promote someone else first.');
  }
}

export async function changeRole({ orgId }, id, { role }) {
  return withTenant(orgId, async (c) => {
    // Under RLS this returns nothing for another tenant's id, so the 404 below
    // is produced by the database rather than by a check somebody wrote.
    const target = await repo.findById(c, id);
    if (!target) throw notFound('Member not found.');
    if (target.role !== role) await assertNotLastAdmin(c, target);
    return shape(await repo.updateRole(c, id, role));
  });
}

export async function removeMember({ orgId }, id) {
  await withTenant(orgId, async (c) => {
    const target = await repo.findById(c, id);
    if (!target) throw notFound('Member not found.');
    await assertNotLastAdmin(c, target);
    if (!await repo.markRemoved(c, id)) throw notFound('Member not found.');
  });
  // After commit. Access ends now rather than when the access token expires.
  await revokeAllForUser(id);
}
