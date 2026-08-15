import { randomUUID } from 'node:crypto';
import { randomToken, hashToken } from '../../lib/tokens.js';
import { unauthorized } from '../../lib/errors.js';
import { ERROR_CODE } from '../../lib/constants.js';
import { env } from '../../config/env.js';
import * as repo from './refreshRepository.js';
import * as authRepo from './repository.js';

const expiry = () =>
  new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

export async function issueRefreshToken(userId, familyId = randomUUID()) {
  const { raw, hash } = randomToken();
  await repo.insert({ userId, tokenHash: hash, familyId, expiresAt: expiry() });
  return raw;
}

export async function rotateRefreshToken(raw) {
  const row = await repo.findByHash(hashToken(raw));
  if (!row) throw unauthorized(ERROR_CODE.TOKEN_INVALID, 'Your session has ended.');

  // A revoked token being presented means it was rotated already, or stolen.
  // Either way the safe response is to kill the whole family.
  if (row.revoked_at) {
    await repo.revokeFamily(row.family_id);
    throw unauthorized(ERROR_CODE.REFRESH_REUSED, 'Your session has ended. Sign in again.');
  }
  if (new Date(row.expires_at) < new Date()) {
    throw unauthorized(ERROR_CODE.TOKEN_EXPIRED, 'Your session has expired.');
  }

  await repo.revokeById(row.id);
  const user = await authRepo.findByIdForRefresh(row.user_id);
  if (!user) throw unauthorized(ERROR_CODE.TOKEN_INVALID, 'Your session has ended.');

  const refreshToken = await issueRefreshToken(user.id, row.family_id);
  return { user, refreshToken };
}

export const revokeToken = async (raw) => {
  const row = await repo.findByHash(hashToken(raw));
  if (row) await repo.revokeById(row.id);
};
export const revokeAllForUser = repo.revokeAllForUser;
export const revokeAllForOrg = repo.revokeAllForOrg;
