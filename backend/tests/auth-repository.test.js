import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../src/lib/password.js';
import { randomToken, hashToken } from '../src/lib/tokens.js';
import * as authRepo from '../src/modules/auth/repository.js';
import { seedOrg } from './helpers/db.js';
import { makeUser } from './helpers/factories.js';
import { ROLES } from '../src/lib/constants.js';

describe('password hashing', () => {
  it('never stores the plaintext and verifies correctly', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash).not.toContain('correct');
    expect(await verifyPassword('correct horse battery', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });
});

describe('one time tokens', () => {
  it('returns a raw token and its hash, and hashing is stable', () => {
    const { raw, hash } = randomToken();
    expect(raw).not.toBe(hash);
    expect(hashToken(raw)).toBe(hash);
  });
});

describe('auth repository', () => {
  it('finds a user by email across tenants, which no tenant-scoped query could', async () => {
    const { orgId } = await seedOrg();
    const user = await makeUser({ orgId, role: ROLES.ORG_ADMIN });
    const found = await authRepo.findByEmail(user.email);
    expect(found.id).toBe(user.id);
    expect(found.org_id).toBe(orgId);
  });

  it('finds a PLATFORM_ADMIN, whose org_id is NULL and is unreachable under any policy', async () => {
    const admin = await makeUser({ orgId: null, role: ROLES.PLATFORM_ADMIN });
    const found = await authRepo.findByEmail(admin.email);
    expect(found.role).toBe(ROLES.PLATFORM_ADMIN);
    expect(found.org_id).toBeNull();
  });

  it('returns undefined for an unknown email rather than throwing', async () => {
    expect(await authRepo.findByEmail('nobody@example.com')).toBeUndefined();
  });

  it('exposes exactly five functions, none of which takes an org id or returns a list', () => {
    expect(Object.keys(authRepo).sort()).toEqual(
      ['describeInvite', 'findByEmail', 'findByIdForRefresh', 'findByTokenHash', 'updatePasswordHash']
    );
  });
});
