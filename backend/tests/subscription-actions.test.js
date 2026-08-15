import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from './helpers/http.js';
import { adminPool } from '../src/db/pool.js';
import { stripe } from '../src/lib/stripe.js';
import { seedOrg, getPlan } from './helpers/db.js';
import { makeUser, makeSubscription, makeTransaction } from './helpers/factories.js';
import { signAccessToken } from '../src/lib/jwt.js';
import {
  ROLES, ORG_STATUS, SUBSCRIPTION_STATUS, TRANSACTION_STATUS, NOTIFICATION_KIND,
} from '../src/lib/constants.js';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(stripe.checkout.sessions, 'create').mockResolvedValue({
    id: 'cs_retry', url: 'https://checkout.stripe.test/cs_retry' });
  vi.spyOn(stripe.subscriptions, 'update').mockResolvedValue({ id: 'sub_1' });
  vi.spyOn(stripe.subscriptions, 'retrieve').mockResolvedValue({
    id: 'sub_1', items: { data: [{ id: 'si_1' }] } });
  vi.spyOn(stripe.billingPortal.sessions, 'create').mockResolvedValue({
    url: 'https://portal.stripe.test/x' });
});

async function org({ orgStatus = ORG_STATUS.ACTIVE, subStatus = SUBSCRIPTION_STATUS.ACTIVE,
                     planName = 'Starter' } = {}) {
  const plan = await getPlan(planName);
  const { orgId } = await seedOrg({ status: orgStatus });
  const sub = await makeSubscription({ orgId, plan: await getPlan(planName), status: subStatus });
  const admin = await makeUser({ orgId, role: ROLES.ORG_ADMIN });
  return {
    orgId, plan, subscriptionId: sub.id,
    token: signAccessToken({ userId: admin.id, orgId, role: ROLES.ORG_ADMIN }),
  };
}

describe('POST /api/subscription/checkout', () => {
  it('returns a fresh checkout url for a PENDING organization', async () => {
    const ctx = await org({ orgStatus: ORG_STATUS.PENDING, subStatus: SUBSCRIPTION_STATUS.PENDING });
    await makeTransaction({
      orgId: ctx.orgId, plan: ctx.plan, subscriptionId: ctx.subscriptionId,
      status: TRANSACTION_STATUS.PENDING, checkoutSessionId: 'cs_old' });

    const res = await api().post('/api/subscription/checkout')
      .set('Authorization', `Bearer ${ctx.token}`).send({});
    expect(res.status).toBe(200);
    expect(res.body.checkoutUrl).toBe('https://checkout.stripe.test/cs_retry');
  });

  it('updates the live rows rather than inserting new ones', async () => {
    const ctx = await org({ orgStatus: ORG_STATUS.PENDING, subStatus: SUBSCRIPTION_STATUS.PENDING });
    await makeTransaction({
      orgId: ctx.orgId, plan: ctx.plan, subscriptionId: ctx.subscriptionId,
      status: TRANSACTION_STATUS.PENDING, checkoutSessionId: 'cs_old' });

    await api().post('/api/subscription/checkout')
      .set('Authorization', `Bearer ${ctx.token}`).send({});

    const subs = await adminPool.query('SELECT * FROM subscriptions WHERE org_id = $1', [ctx.orgId]);
    expect(subs.rows).toHaveLength(1);              // the partial index would reject a second

    const txns = await adminPool.query('SELECT * FROM transactions WHERE org_id = $1', [ctx.orgId]);
    expect(txns.rows).toHaveLength(1);              // an abandoned attempt was never a payment
    expect(txns.rows[0].stripe_checkout_session_id).toBe('cs_retry');
  });

  it('refuses a SUSPENDED organization', async () => {
    const ctx = await org({ orgStatus: ORG_STATUS.SUSPENDED });
    const res = await api().post('/api/subscription/checkout')
      .set('Authorization', `Bearer ${ctx.token}`).send({});
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ORG_NOT_ACTIVE');
  });
});

describe('POST /api/subscription/change', () => {
  it('derives an upgrade from the price and notifies accordingly', async () => {
    const ctx = await org({ planName: 'Starter' });
    const pro = await getPlan('Pro');

    const res = await api().post('/api/subscription/change')
      .set('Authorization', `Bearer ${ctx.token}`).send({ planId: pro.id });
    expect(res.status).toBe(200);
    expect(res.body.planName).toBe('Pro');

    const notes = await adminPool.query(
      'SELECT kind FROM notifications_log WHERE org_id = $1', [ctx.orgId]);
    expect(notes.rows[0].kind).toBe(NOTIFICATION_KIND.SUBSCRIPTION_UPGRADED);
  });

  it('derives a downgrade from the price', async () => {
    const ctx = await org({ planName: 'Pro' });
    const starter = await getPlan('Starter');

    await api().post('/api/subscription/change')
      .set('Authorization', `Bearer ${ctx.token}`).send({ planId: starter.id });

    const notes = await adminPool.query(
      'SELECT kind FROM notifications_log WHERE org_id = $1', [ctx.orgId]);
    expect(notes.rows[0].kind).toBe(NOTIFICATION_KIND.SUBSCRIPTION_DOWNGRADED);
  });

  it('refuses a downgrade that would exceed the smaller plan seat limit', async () => {
    const ctx = await org({ planName: 'Pro' });          // Pro allows 25
    for (let i = 0; i < 6; i += 1) await makeUser({ orgId: ctx.orgId });
    const starter = await getPlan('Starter');            // Starter allows 5

    const res = await api().post('/api/subscription/change')
      .set('Authorization', `Bearer ${ctx.token}`).send({ planId: starter.id });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SEAT_LIMIT_REACHED');
  });

  it('updates the live subscription row in place, keeping the snapshot current', async () => {
    const ctx = await org({ planName: 'Starter' });
    const pro = await getPlan('Pro');
    await api().post('/api/subscription/change')
      .set('Authorization', `Bearer ${ctx.token}`).send({ planId: pro.id });

    const subs = await adminPool.query('SELECT * FROM subscriptions WHERE org_id = $1', [ctx.orgId]);
    expect(subs.rows).toHaveLength(1);
    expect(subs.rows[0].plan_id).toBe(pro.id);
    expect(subs.rows[0].price_cents).toBe(pro.price_cents);
  });

  it('answers 409 when there is no live subscription', async () => {
    const ctx = await org({ subStatus: SUBSCRIPTION_STATUS.EXPIRED });
    const pro = await getPlan('Pro');
    const res = await api().post('/api/subscription/change')
      .set('Authorization', `Bearer ${ctx.token}`).send({ planId: pro.id });
    expect(res.status).toBe(409);
  });
});

describe('POST /api/subscription/cancel', () => {
  it('sets cancel_at_period_end and keeps access', async () => {
    const ctx = await org();
    const res = await api().post('/api/subscription/cancel')
      .set('Authorization', `Bearer ${ctx.token}`).send({});
    expect(res.status).toBe(204);

    const subs = await adminPool.query('SELECT * FROM subscriptions WHERE org_id = $1', [ctx.orgId]);
    expect(subs.rows[0].cancel_at_period_end).toBe(true);

    const orgRow = await adminPool.query('SELECT status FROM organizations WHERE id = $1', [ctx.orgId]);
    expect(orgRow.rows[0].status).toBe(ORG_STATUS.CANCELLED);

    const notes = await adminPool.query('SELECT kind FROM notifications_log WHERE org_id = $1', [ctx.orgId]);
    expect(notes.rows[0].kind).toBe(NOTIFICATION_KIND.SUBSCRIPTION_CANCELLED);
  });

  it('refuses a member', async () => {
    const ctx = await org();
    const m = await makeUser({ orgId: ctx.orgId, role: ROLES.ORG_MEMBER });
    const t = signAccessToken({ userId: m.id, orgId: ctx.orgId, role: ROLES.ORG_MEMBER });
    expect((await api().post('/api/subscription/cancel')
      .set('Authorization', `Bearer ${t}`).send({})).status).toBe(403);
  });
});

describe('POST /api/billing/portal', () => {
  it('returns a portal url', async () => {
    const ctx = await org();
    await adminPool.query(
      `UPDATE organizations SET stripe_customer_id = 'cus_1' WHERE id = $1`, [ctx.orgId]);
    const res = await api().post('/api/billing/portal')
      .set('Authorization', `Bearer ${ctx.token}`).send({});
    expect(res.status).toBe(200);
    expect(res.body.portalUrl).toBe('https://portal.stripe.test/x');
  });
});
