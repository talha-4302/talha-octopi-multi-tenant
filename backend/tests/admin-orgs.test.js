import { describe, it, expect } from 'vitest';
import { api } from './helpers/http.js';
import { seedOrg, getPlan } from './helpers/db.js';
import { makeUser, makeSubscription } from './helpers/factories.js';
import { signAccessToken } from '../src/lib/jwt.js';
import { ROLES, ORG_STATUS } from '../src/lib/constants.js';

async function platformAdmin() {
  const user = await makeUser({ orgId: null, role: ROLES.PLATFORM_ADMIN });
  return signAccessToken({ userId: user.id, orgId: null, role: ROLES.PLATFORM_ADMIN });
}

async function orgWithMembers(name, status, planName = 'Pro', members = 2) {
  const { orgId } = await seedOrg({ name, status });
  await makeSubscription({ orgId, plan: await getPlan(planName) });
  for (let i = 0; i < members; i += 1) await makeUser({ orgId });
  return orgId;
}

describe('GET /api/admin/orgs', () => {
  it('lists every organization with plan, status, member count, and signup date', async () => {
    await orgWithMembers('Alpha', ORG_STATUS.ACTIVE, 'Pro', 3);
    await orgWithMembers('Beta', ORG_STATUS.SUSPENDED, 'Starter', 1);
    const token = await platformAdmin();

    const res = await api().get('/api/admin/orgs').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(2);

    const alpha = res.body.data.find((o) => o.name === 'Alpha');
    expect(alpha).toMatchObject({ planName: 'Pro', status: ORG_STATUS.ACTIVE, memberCount: 3 });
    expect(alpha.createdAt).toBeTruthy();
  });

  it('filters by status', async () => {
    await orgWithMembers('Alpha', ORG_STATUS.ACTIVE);
    await orgWithMembers('Beta', ORG_STATUS.SUSPENDED);
    const token = await platformAdmin();

    const res = await api().get('/api/admin/orgs?status=SUSPENDED')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Beta');
  });

  it('searches by name, case insensitively', async () => {
    await orgWithMembers('Alpha Industries', ORG_STATUS.ACTIVE);
    await orgWithMembers('Beta', ORG_STATUS.ACTIVE);
    const token = await platformAdmin();

    const res = await api().get('/api/admin/orgs?search=alpha')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.data).toHaveLength(1);
  });

  it('paginates', async () => {
    for (let i = 0; i < 5; i += 1) await orgWithMembers(`Org ${i}`, ORG_STATUS.ACTIVE, 'Pro', 0);
    const token = await platformAdmin();

    const res = await api().get('/api/admin/orgs?page=2&pageSize=2')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.total).toBe(5);
  });

  it('refuses an ORG_ADMIN', async () => {
    const orgId = await orgWithMembers('Alpha', ORG_STATUS.ACTIVE);
    const admin = await makeUser({ orgId, role: ROLES.ORG_ADMIN });
    const t = signAccessToken({ userId: admin.id, orgId, role: ROLES.ORG_ADMIN });

    const res = await api().get('/api/admin/orgs').set('Authorization', `Bearer ${t}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
  });

  it('refuses an unauthenticated caller with 401', async () => {
    expect((await api().get('/api/admin/orgs')).status).toBe(401);
  });
});
