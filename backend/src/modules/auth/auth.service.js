import { verifyPassword, hashPassword } from '../../lib/password.js';
import { signAccessToken } from '../../lib/jwt.js';
import { hashToken } from '../../lib/tokens.js';
import { unauthorized, badRequest } from '../../lib/errors.js';
import { USER_STATUS, ERROR_CODE, TOKEN_PURPOSE } from '../../lib/constants.js';
import * as authRepo from './auth.repository.js';
import { issueRefreshToken, rotateRefreshToken, revokeAllForUser } from './tokens/refresh.service.js';
import { createOneTimeToken, consume } from './tokens/one-time.repository.js';
import { sendPasswordReset } from '../../lib/email/index.js';

// Shape a user for the wire. The password hash never crosses this boundary.
export const publicUser = (u) => ({
  id: u.id, name: u.name, email: u.email, role: u.role, orgId: u.org_id,
});

export const tokenFor = (u) =>
  signAccessToken({ userId: u.id, orgId: u.org_id, role: u.role });

export async function login({ email, password }) {
  const user = await authRepo.findByEmail(email);
  // One error for every failure path, so the response cannot be used to
  // discover which addresses exist.
  const fail = () => unauthorized(ERROR_CODE.INVALID_CREDENTIALS, 'Invalid email or password.');

  if (!user || user.status !== USER_STATUS.ACTIVE || !user.password_hash) throw fail();
  if (!(await verifyPassword(password, user.password_hash))) throw fail();

  return {
    accessToken: tokenFor(user),
    refreshToken: await issueRefreshToken(user.id),
    user: publicUser(user),
  };
}

export async function refresh(raw) {
  if (!raw) throw unauthorized(ERROR_CODE.TOKEN_INVALID, 'Your session has ended.');
  const { user, refreshToken } = await rotateRefreshToken(raw);
  return { accessToken: tokenFor(user), refreshToken, user: publicUser(user) };
}

const RESET_TTL_MS = 60 * 60 * 1000;
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function forgotPassword({ email }) {
  const user = await authRepo.findByEmail(email);
  // The response is deliberately identical whether or not the address exists,
  // so this function returns nothing either way.
  if (!user || user.status !== USER_STATUS.ACTIVE) return;

  const raw = await createOneTimeToken({
    userId: user.id, purpose: TOKEN_PURPOSE.PASSWORD_RESET, ttlMs: RESET_TTL_MS });
  await sendPasswordReset({ to: user.email, name: user.name, token: raw });
}

export async function resetPassword({ token, password }) {
  const found = await authRepo.findByTokenHash(hashToken(token), TOKEN_PURPOSE.PASSWORD_RESET);
  if (!found) throw badRequest('That link is invalid or has expired.');

  if (!(await consume(found.token_id))) throw badRequest('That link has already been used.');
  await authRepo.updatePasswordHash(found.id, await hashPassword(password));
  // A reset is also the remedy for a compromised session, so every family dies.
  await revokeAllForUser(found.id);
}

export async function describeInvite(token) {
  const row = await authRepo.describeInvite(hashToken(token));
  if (!row) throw badRequest('That invitation is invalid or has expired.');
  return { orgName: row.org_name, email: row.email, name: row.name };
}

export async function acceptInvite({ token, password }) {
  const found = await authRepo.findByTokenHash(hashToken(token), TOKEN_PURPOSE.INVITE);
  if (!found) throw badRequest('That invitation is invalid or has expired.');
  if (!(await consume(found.token_id))) throw badRequest('That invitation has already been used.');
  // updatePasswordHash also sets status to ACTIVE, which the
  // active_user_has_password CHECK requires to happen together.
  await authRepo.updatePasswordHash(found.id, await hashPassword(password));
}
