import { describe, it, expect } from 'vitest';
import { api } from './helpers/http.js';
import { adminPool } from '../src/db/pool.js';
import { seedOrg, getPlan } from './helpers/db.js';
import { makeUser, makeSubscription, makeTransaction } from './helpers/factories.js';
import { signAccessToken } from '../src/lib/jwt.js';
import { ROLES, ORG_STATUS, SUBSCRIPTION_STATUS, TRANSACTION_STATUS } from '../src/lib/constants.js';

async function platformToken() {
  const u = await makeUser({ orgId: null, role: ROLES.PLATFORM_ADMIN });
  return signAccessToken({ userId: u.id, orgId: null, role: ROLES.PLATFORM_ADMIN });
}

describe('GET /api/admin/transactions', () => {
  it('spans every organization and names each one', async () => {
    const plan = await getPlan('Pro');
    const a = await seedOrg({ name: 'Alpha' });
    const b = await seedOrg({ name: 'Beta' });
    await makeTransaction({ orgId: a.orgId, plan });
    await makeTransaction({ orgId: b.orgId, plan });

    const res = await api().get('/api/admin/transactions')
      .set('Authorization', `Bearer ${await platformToken()}`);

    expect(res.body.meta.total).toBe(2);
    expect(res.body.data.map((t) => t.orgName).sort()).toEqual(['Alpha', 'Beta']);
  });

  it('filters by organization, status, and date range', async () => {
    const plan = await getPlan('Pro');
    const a = await seedOrg({ name: 'Alpha' });
    await makeTransaction({ orgId: a.orgId, plan, status: TRANSACTION_STATUS.SUCCESS });
    await makeTransaction({ orgId: a.orgId, plan, status: TRANSACTION_STATUS.FAILED });
    const token = await platformToken();

    const byOrg = await api().get(`/api/admin/transactions?orgId=${a.orgId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(byOrg.body.meta.total).toBe(2);

    const byStatus = await api().get('/api/admin/transactions?status=FAILED')
      .set('Authorization', `Bearer ${token}`);
    expect(byStatus.body.meta.total).toBe(1);

    const future = new Date(Date.now() + 86400_000).toISOString();
    const byDate = await api().get(`/api/admin/transactions?from=${future}`)
      .set('Authorization', `Bearer ${token}`);
    expect(byDate.body.meta.total).toBe(0);
  });
});

describe('GET /api/admin/stats', () => {
  it('counts organizations, users, active subscriptions, and failed payments', async () => {
    const plan = await getPlan('Pro');
    const a = await seedOrg({ name: 'Alpha', status: ORG_STATUS.ACTIVE });
    const b = await seedOrg({ name: 'Beta', status: ORG_STATUS.SUSPENDED });
    await makeSubscription({ orgId: a.orgId, plan, status: SUBSCRIPTION_STATUS.ACTIVE });
    await makeSubscription({ orgId: b.orgId, plan, status: SUBSCRIPTION_STATUS.EXPIRED });
    await makeUser({ orgId: a.orgId });
    await makeTransaction({ orgId: a.orgId, plan, status: TRANSACTION_STATUS.SUCCESS });
    await makeTransaction({ orgId: a.orgId, plan, status: TRANSACTION_STATUS.FAILED });

    const res = await api().get('/api/admin/stats')
      .set('Authorization', `Bearer ${await platformToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.totalOrganizations).toBe(2);
    expect(res.body.activeSubscriptions).toBe(1);
    expect(res.body.failedPayments).toBe(1);
    expect(res.body.totalUsers).toBeGreaterThanOrEqual(2);
  });

  it('groups revenue by currency rather than summing across it', async () => {
    const plan = await getPlan('Pro');
    const { orgId } = await seedOrg();
    await makeTransaction({ orgId, plan, status: TRANSACTION_STATUS.SUCCESS });
    await adminPool.query(
      `INSERT INTO transactions (org_id, plan_id, amount_cents, currency, status)
       VALUES ($1, $2, 5000, 'eur', 'SUCCESS')`, [orgId, plan.id]);

    const res = await api().get('/api/admin/stats')
      .set('Authorization', `Bearer ${await platformToken()}`);

    // Never a single scalar total. Adding cents across currencies is nonsense.
    expect(Array.isArray(res.body.revenue)).toBe(true);
    const byCurrency = Object.fromEntries(res.body.revenue.map((r) => [r.currency, r.totalCents]));
    expect(byCurrency.usd).toBe(plan.price_cents);
    expect(byCurrency.eur).toBe(5000);
  });

  it('counts only SUCCESS transactions as revenue', async () => {
    const plan = await getPlan('Pro');
    const { orgId } = await seedOrg();
    await makeTransaction({ orgId, plan, status: TRANSACTION_STATUS.FAILED });
    await makeTransaction({ orgId, plan, status: TRANSACTION_STATUS.REFUNDED });

    const res = await api().get('/api/admin/stats')
      .set('Authorization', `Bearer ${await platformToken()}`);
    expect(res.body.revenue).toEqual([]);
  });

  it('lists recent signups newest first', async () => {
    await seedOrg({ name: 'First' });
    await seedOrg({ name: 'Second' });

    const res = await api().get('/api/admin/stats')
      .set('Authorization', `Bearer ${await platformToken()}`);
    expect(res.body.recentSignups[0].name).toBe('Second');
  });

  it('refuses an ORG_ADMIN', async () => {
    const { orgId } = await seedOrg();
    const admin = await makeUser({ orgId, role: ROLES.ORG_ADMIN });
    const t = signAccessToken({ userId: admin.id, orgId, role: ROLES.ORG_ADMIN });
    expect((await api().get('/api/admin/stats').set('Authorization', `Bearer ${t}`)).status).toBe(403);
  });
});
