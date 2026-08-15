import { withTenant } from '../../db/withTenant.js';
import { verifyPassword, hashPassword } from '../../lib/password.js';
import { unauthorized, notFound } from '../../lib/errors.js';
import { ERROR_CODE } from '../../lib/constants.js';
import * as repo from './repository.js';
import * as authRepo from '../auth/repository.js';
import * as refreshRepo from '../auth/refreshRepository.js';

const shape = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, orgId: u.org_id });

// A PLATFORM_ADMIN has no org, so their own row is unreachable under any policy.
// Their profile read is the one place the auth repository serves a non-auth purpose,
// and it is still a single-identity lookup by id.
const read = async ({ userId, orgId }) =>
  orgId ? withTenant(orgId, (c) => repo.findById(c, userId))
        : authRepo.findByIdForRefresh(userId);

export async function getMe(user) {
  const row = await read(user);
  if (!row) throw notFound('Account not found.');
  return shape(row);
}

export async function updateMe(user, { name }) {
  if (!user.orgId) throw notFound('Account not found.');
  const row = await withTenant(user.orgId, (c) => repo.updateName(c, user.userId, name));
  return shape(row);
}

export async function changePassword(user, { currentPassword, newPassword }) {
  const row = await authRepo.findByIdForRefresh(user.userId);
  if (!row?.password_hash || !(await verifyPassword(currentPassword, row.password_hash))) {
    throw unauthorized(ERROR_CODE.INVALID_CREDENTIALS, 'Current password is incorrect.');
  }
  await authRepo.updatePasswordHash(user.userId, await hashPassword(newPassword));
  // Every OTHER session dies. The caller keeps the one they are using.
  await refreshRepo.revokeAllForUser(user.userId);
}
