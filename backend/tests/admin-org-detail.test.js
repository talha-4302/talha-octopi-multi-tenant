import { describe, it, expect } from 'vitest';
import { api } from './helpers/http.js';
import { seedOrg, getPlan } from './helpers/db.js';
import { makeUser, makeSubscription, makeTransaction } from './helpers/factories.js';
import { signAccessToken } from '../src/lib/jwt.js';
import { ROLES, SUBSCRIPTION_STATUS, TRANSACTION_STATUS } from '../src/lib/constants.js';

async function platformToken() {
  const u = await makeUser({ orgId: null, role: ROLES.PLATFORM_ADMIN });
  return signAccessToken({ userId: u.id, orgId: null, role: ROLES.PLATFORM_ADMIN });
}

describe('GET /api/admin/orgs/:orgId', () => {
  it('returns profile, members, and subscription history inline', async () => {
    const plan = await getPlan('Pro');
    const { orgId } = await seedOrg({ name: 'Alpha' });
    await makeSubscription({ orgId, plan, status: SUBSCRIPTION_STATUS.EXPIRED });
    await makeSubscription({ orgId, plan, status: SUBSCRIPTION_STATUS.ACTIVE });
    await makeUser({ orgId, role: ROLES.ORG_ADMIN });
    await makeUser({ orgId, role: ROLES.ORG_MEMBER });

    const res = await api().get(`/api/admin/orgs/${orgId}`)
      .set('Authorization', `Bearer ${await platformToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.organization).toMatchObject({ name: 'Alpha' });
    expect(res.body.members).toHaveLength(2);
    expect(res.body.subscriptions).toHaveLength(2);   // history, not just the live row
  });

  it('never returns a password hash for any member', async () => {
    const { orgId } = await seedOrg();
    await makeUser({ orgId, role: ROLES.ORG_ADMIN });
    const res = await api().get(`/api/admin/orgs/${orgId}`)
      .set('Authorization', `Bearer ${await platformToken()}`);
    expect(res.text).not.toMatch(/\$2[aby]\$/);
  });

  it('answers 404 for an unknown organization', async () => {
    const res = await api().get('/api/admin/orgs/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${await platformToken()}`);
    expect(res.status).toBe(404);
  });

  it('answers 400 for a malformed uuid, not 500', async () => {
    const res = await api().get('/api/admin/orgs/not-a-uuid')
      .set('Authorization', `Bearer ${await platformToken()}`);
    expect(res.status).toBe(400);
  });

  it('refuses an ORG_ADMIN even for their own organization', async () => {
    const { orgId } = await seedOrg();
    const admin = await makeUser({ orgId, role: ROLES.ORG_ADMIN });
    const t = signAccessToken({ userId: admin.id, orgId, role: ROLES.ORG_ADMIN });
    expect((await api().get(`/api/admin/orgs/${orgId}`)
      .set('Authorization', `Bearer ${t}`)).status).toBe(403);
  });
});

describe('GET /api/admin/orgs/:orgId/transactions', () => {
  it('paginates that organization transactions only', async () => {
    const plan = await getPlan('Pro');
    const a = await seedOrg({ name: 'Alpha' });
    const b = await seedOrg({ name: 'Beta' });
    for (let i = 0; i < 3; i += 1) await makeTransaction({ orgId: a.orgId, plan });
    await makeTransaction({ orgId: b.orgId, plan });

    const res = await api().get(`/api/admin/orgs/${a.orgId}/transactions`)
      .set('Authorization', `Bearer ${await platformToken()}`);

    expect(res.body.meta.total).toBe(3);
    expect(res.body.data).toHaveLength(3);
  });

  it('filters by status', async () => {
    const plan = await getPlan('Pro');
    const { orgId } = await seedOrg();
    await makeTransaction({ orgId, plan, status: TRANSACTION_STATUS.SUCCESS });
    await makeTransaction({ orgId, plan, status: TRANSACTION_STATUS.FAILED });

    const res = await api().get(`/api/admin/orgs/${orgId}/transactions?status=FAILED`)
      .set('Authorization', `Bearer ${await platformToken()}`);
    expect(res.body.data).toHaveLength(1);
  });
});
