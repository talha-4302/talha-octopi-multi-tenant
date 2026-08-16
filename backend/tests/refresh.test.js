import { describe, it, expect } from 'vitest';
import { issueRefreshToken, rotateRefreshToken, revokeAllForUser }
  from '../src/modules/auth/tokens/refresh.service.js';
import { seedOrg } from './helpers/db.js';
import { makeUser } from './helpers/factories.js';
import { ROLES } from '../src/lib/constants.js';

async function aUser() {
  const { orgId } = await seedOrg();
  return makeUser({ orgId, role: ROLES.ORG_ADMIN });
}

describe('refresh token rotation', () => {
  it('issues a token that rotates into a different one', async () => {
    const user = await aUser();
    const first = await issueRefreshToken(user.id);
    const { refreshToken: second } = await rotateRefreshToken(first);
    expect(second).not.toBe(first);
  });

  it('rejects the old token after rotation', async () => {
    const user = await aUser();
    const first = await issueRefreshToken(user.id);
    await rotateRefreshToken(first);
    await expect(rotateRefreshToken(first)).rejects.toMatchObject({ code: 'REFRESH_REUSED' });
  });

  it('revokes the whole family when a spent token is replayed', async () => {
    const user = await aUser();
    const first = await issueRefreshToken(user.id);
    const { refreshToken: second } = await rotateRefreshToken(first);
    await rotateRefreshToken(first).catch(() => {});           // the replay
    await expect(rotateRefreshToken(second)).rejects.toThrow(); // the live token dies too
  });

  it('rejects an unknown token', async () => {
    await expect(rotateRefreshToken('made-up')).rejects.toMatchObject({ status: 401 });
  });

  it('revokes every token for a user in one call', async () => {
    const user = await aUser();
    const a = await issueRefreshToken(user.id);
    const b = await issueRefreshToken(user.id);
    await revokeAllForUser(user.id);
    await expect(rotateRefreshToken(a)).rejects.toThrow();
    await expect(rotateRefreshToken(b)).rejects.toThrow();
  });
});
