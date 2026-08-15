// backend/tests/transactions.test.js
import { describe, it, expect } from 'vitest';
import { api } from './helpers/http.js';
import { seedOrg, getPlan } from './helpers/db.js';
import { makeUser, makeSubscription, makeTransaction } from './helpers/factories.js';
import { signAccessToken } from '../src/lib/jwt.js';
import { ROLES, TRANSACTION_STATUS } from '../src/lib/constants.js';

async function org() {
  const { orgId } = await seedOrg();
  const plan = await getPlan('Pro');
  await makeSubscription({ orgId, plan });
  const admin = await makeUser({ orgId, role: ROLES.ORG_ADMIN });
  return { orgId, plan, token: signAccessToken({ userId: admin.id, orgId, role: ROLES.ORG_ADMIN }) };
}

describe('GET /api/transactions', () => {
  it('returns this org rows only, newest first, enveloped', async () => {
    const { orgId, plan, token } = await org();
    await makeTransaction({ orgId, plan, status: TRANSACTION_STATUS.SUCCESS });
    await makeTransaction({ orgId, plan, status: TRANSACTION_STATUS.FAILED });

    const other = await seedOrg({ name: 'Other' });
    await makeTransaction({ orgId: other.orgId, plan, status: TRANSACTION_STATUS.SUCCESS });

    const res = await api().get('/api/transactions').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.total).toBe(2);
  });

  it('filters by status', async () => {
    const { orgId, plan, token } = await org();
    await makeTransaction({ orgId, plan, status: TRANSACTION_STATUS.SUCCESS });
    await makeTransaction({ orgId, plan, status: TRANSACTION_STATUS.FAILED });

    const res = await api().get('/api/transactions?status=FAILED')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].status).toBe(TRANSACTION_STATUS.FAILED);
  });

  it('exposes invoiceUrl on each row, which is how invoice download works', async () => {
    const { orgId, plan, token } = await org();
    await makeTransaction({
      orgId, plan, status: TRANSACTION_STATUS.SUCCESS,
      invoiceUrl: 'https://invoice.stripe.test/abc' });
    const res = await api().get('/api/transactions').set('Authorization', `Bearer ${token}`);
    expect(res.body.data[0].invoiceUrl).toBe('https://invoice.stripe.test/abc');
  });

  it('paginates', async () => {
    const { orgId, plan, token } = await org();
    for (let i = 0; i < 5; i += 1) await makeTransaction({ orgId, plan });
    const res = await api().get('/api/transactions?page=2&pageSize=2')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toMatchObject({ page: 2, pageSize: 2, total: 5 });
  });

  it('refuses a member', async () => {
    const { orgId } = await org();
    const m = await makeUser({ orgId, role: ROLES.ORG_MEMBER });
    const t = signAccessToken({ userId: m.id, orgId, role: ROLES.ORG_MEMBER });
    expect((await api().get('/api/transactions').set('Authorization', `Bearer ${t}`)).status).toBe(403);
  });
});
