import { describe, it, expect, beforeEach, vi } from 'vitest';
import { adminPool } from '../src/db/pool.js';
import { seedOrg, getPlan } from './helpers/db.js';
import { makeSubscription, makeTransaction, makeUser } from './helpers/factories.js';
import { postWebhook } from './helpers/stripeEvents.js';
import {
  ORG_STATUS, SUBSCRIPTION_STATUS, TRANSACTION_STATUS, ROLES,
} from '../src/lib/constants.js';

const unix = (offsetDays = 0) => Math.floor(Date.now() / 1000) + offsetDays * 86400;

async function activeOrg() {
  const plan = await getPlan('Starter');
  const { orgId } = await seedOrg({ status: ORG_STATUS.ACTIVE });
  await makeUser({ orgId, role: ROLES.ORG_ADMIN });
  const sub = await makeSubscription({ orgId, plan, status: SUBSCRIPTION_STATUS.ACTIVE });
  return { orgId, plan, subscriptionId: sub.id, stripeSubId: `sub_${sub.id}` };
}

const invoiceEvent = (type, { orgId, stripeSubId, reason, amount = 2900 }) => ({
  id: `evt_${type}_${Math.random().toString(36).slice(2)}`,
  type,
  data: { object: {
    id: 'in_2', object: 'invoice', subscription: stripeSubId,
    billing_reason: reason, amount_paid: amount, amount_due: amount,
    currency: 'usd', payment_intent: 'pi_2',
    hosted_invoice_url: 'https://invoice.stripe.test/in_2',
    period_start: unix(0), period_end: unix(30),
    last_finalization_error: null,
    metadata: { orgId },
  } },
});

beforeEach(() => vi.restoreAllMocks());

describe('invoice.paid', () => {
  it('ignores the first invoice, which checkout.session.completed already owns', async () => {
    const ctx = await activeOrg();
    const res = await postWebhook(invoiceEvent('invoice.paid', {
      ...ctx, reason: 'subscription_create' }));

    expect(res.status).toBe(200);
    const txns = await adminPool.query('SELECT * FROM transactions WHERE org_id = $1', [ctx.orgId]);
    expect(txns.rows).toHaveLength(0);      // no second row for one charge
  });

  it('records a renewal and rolls the period forward', async () => {
    const ctx = await activeOrg();
    const res = await postWebhook(invoiceEvent('invoice.paid', {
      ...ctx, reason: 'subscription_cycle' }));

    expect(res.status).toBe(200);
    const txns = await adminPool.query('SELECT * FROM transactions WHERE org_id = $1', [ctx.orgId]);
    expect(txns.rows).toHaveLength(1);
    expect(txns.rows[0].status).toBe(TRANSACTION_STATUS.SUCCESS);
    expect(txns.rows[0].invoice_url).toBe('https://invoice.stripe.test/in_2');

    const sub = await adminPool.query('SELECT * FROM subscriptions WHERE id = $1', [ctx.subscriptionId]);
    expect(new Date(sub.rows[0].current_period_end).getTime()).toBeGreaterThan(Date.now());
  });

  it('records a renewal for a suspended org without unsuspending it', async () => {
    const ctx = await activeOrg();
    await adminPool.query(`UPDATE organizations SET status = 'SUSPENDED' WHERE id = $1`, [ctx.orgId]);

    await postWebhook(invoiceEvent('invoice.paid', { ...ctx, reason: 'subscription_cycle' }));

    const org = await adminPool.query('SELECT status FROM organizations WHERE id = $1', [ctx.orgId]);
    expect(org.rows[0].status).toBe(ORG_STATUS.SUSPENDED);
    const txns = await adminPool.query('SELECT status FROM transactions WHERE org_id = $1', [ctx.orgId]);
    expect(txns.rows[0].status).toBe(TRANSACTION_STATUS.SUCCESS);
  });
});

describe('invoice.payment_failed', () => {
  it('records a FAILED transaction and leaves the subscription ACTIVE while Stripe retries', async () => {
    const ctx = await activeOrg();
    await postWebhook(invoiceEvent('invoice.payment_failed', { ...ctx, reason: 'subscription_cycle' }));

    const txns = await adminPool.query('SELECT * FROM transactions WHERE org_id = $1', [ctx.orgId]);
    expect(txns.rows[0].status).toBe(TRANSACTION_STATUS.FAILED);

    const sub = await adminPool.query('SELECT status FROM subscriptions WHERE id = $1', [ctx.subscriptionId]);
    expect(sub.rows[0].status).toBe(SUBSCRIPTION_STATUS.ACTIVE);
  });
});

describe('customer.subscription.updated', () => {
  it('syncs the period and the cancel flag', async () => {
    const ctx = await activeOrg();
    await postWebhook({
      id: 'evt_upd', type: 'customer.subscription.updated',
      data: { object: {
        id: ctx.stripeSubId, status: 'active', cancel_at_period_end: true,
        current_period_start: unix(0), current_period_end: unix(14),
        metadata: { orgId: ctx.orgId },
      } },
    });

    const sub = await adminPool.query('SELECT * FROM subscriptions WHERE id = $1', [ctx.subscriptionId]);
    expect(sub.rows[0].cancel_at_period_end).toBe(true);
  });

  it('marks the subscription FAILED once Stripe reports unpaid', async () => {
    const ctx = await activeOrg();
    await postWebhook({
      id: 'evt_unpaid', type: 'customer.subscription.updated',
      data: { object: {
        id: ctx.stripeSubId, status: 'unpaid', cancel_at_period_end: false,
        current_period_start: unix(-30), current_period_end: unix(0),
        metadata: { orgId: ctx.orgId },
      } },
    });

    const sub = await adminPool.query('SELECT status FROM subscriptions WHERE id = $1', [ctx.subscriptionId]);
    expect(sub.rows[0].status).toBe(SUBSCRIPTION_STATUS.FAILED);
  });
});

describe('customer.subscription.deleted', () => {
  it('expires the subscription', async () => {
    const ctx = await activeOrg();
    await postWebhook({
      id: 'evt_del', type: 'customer.subscription.deleted',
      data: { object: { id: ctx.stripeSubId, metadata: { orgId: ctx.orgId } } },
    });

    const sub = await adminPool.query('SELECT status FROM subscriptions WHERE id = $1', [ctx.subscriptionId]);
    expect(sub.rows[0].status).toBe(SUBSCRIPTION_STATUS.EXPIRED);
  });
});

describe('charge.refunded', () => {
  it('marks the matching transaction REFUNDED', async () => {
    const ctx = await activeOrg();
    const txn = await makeTransaction({
      orgId: ctx.orgId, plan: ctx.plan,
      status: TRANSACTION_STATUS.SUCCESS, paymentIntentId: 'pi_ref' });

    await postWebhook({
      id: 'evt_ref', type: 'charge.refunded',
      data: { object: { id: 'ch_1', payment_intent: 'pi_ref', metadata: { orgId: ctx.orgId } } },
    });

    const row = await adminPool.query('SELECT status FROM transactions WHERE id = $1', [txn.id]);
    expect(row.rows[0].status).toBe(TRANSACTION_STATUS.REFUNDED);
  });
});
