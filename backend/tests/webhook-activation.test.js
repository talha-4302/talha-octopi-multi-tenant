import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminPool } from '../src/db/pool.js';
import { stripe } from '../src/lib/stripe.js';
import { seedOrg, getPlan } from './helpers/db.js';
import { makeSubscription, makeTransaction, makeUser } from './helpers/factories.js';
import { postWebhook, checkoutCompleted } from './helpers/stripeEvents.js';
import {
  ORG_STATUS, SUBSCRIPTION_STATUS, TRANSACTION_STATUS, ROLES,
} from '../src/lib/constants.js';

async function pendingSignup(orgStatus = ORG_STATUS.PENDING) {
  const plan = await getPlan('Starter');
  const { orgId } = await seedOrg({ status: orgStatus });
  await makeUser({ orgId, role: ROLES.ORG_ADMIN });
  const sub = await makeSubscription({ orgId, plan, status: SUBSCRIPTION_STATUS.PENDING });
  const txn = await makeTransaction({
    orgId, plan, subscriptionId: sub.id,
    status: TRANSACTION_STATUS.PENDING, checkoutSessionId: 'cs_1' });
  return { orgId, subscriptionId: sub.id, transactionId: txn.id };
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(stripe.subscriptions, 'retrieve').mockResolvedValue({
    id: 'sub_stripe_1',
    current_period_start: Math.floor(Date.now() / 1000),
    current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
  });
  vi.spyOn(stripe.invoices, 'retrieve').mockResolvedValue({
    id: 'in_1', hosted_invoice_url: 'https://invoice.stripe.test/in_1' });
});

describe('POST /api/webhooks/stripe, signature', () => {
  it('rejects an unsigned body with 400 and writes nothing', async () => {
    const ctx = await pendingSignup();
    const res = await postWebhook(
      checkoutCompleted({ eventId: 'evt_1', sessionId: 'cs_1', ...ctx }),
      { header: 't=1,v1=deadbeef' });

    expect(res.status).toBe(400);
    const events = await adminPool.query('SELECT * FROM stripe_events');
    expect(events.rows).toHaveLength(0);
    const org = await adminPool.query('SELECT status FROM organizations WHERE id = $1', [ctx.orgId]);
    expect(org.rows[0].status).toBe(ORG_STATUS.PENDING);
  });
});

describe('checkout.session.completed', () => {
  it('activates the organization, subscription, and transaction in one commit', async () => {
    const ctx = await pendingSignup();
    const res = await postWebhook(checkoutCompleted({ eventId: 'evt_1', sessionId: 'cs_1', ...ctx }));
    expect(res.status).toBe(200);

    const org = await adminPool.query('SELECT status FROM organizations WHERE id = $1', [ctx.orgId]);
    expect(org.rows[0].status).toBe(ORG_STATUS.ACTIVE);

    const sub = await adminPool.query('SELECT * FROM subscriptions WHERE id = $1', [ctx.subscriptionId]);
    expect(sub.rows[0].status).toBe(SUBSCRIPTION_STATUS.ACTIVE);
    expect(sub.rows[0].stripe_subscription_id).toBe('sub_stripe_1');
    expect(sub.rows[0].current_period_end).toBeTruthy();

    const txn = await adminPool.query('SELECT * FROM transactions WHERE id = $1', [ctx.transactionId]);
    expect(txn.rows[0].status).toBe(TRANSACTION_STATUS.SUCCESS);
    expect(txn.rows[0].stripe_payment_intent_id).toBe('pi_1');
    expect(txn.rows[0].invoice_url).toBe('https://invoice.stripe.test/in_1');
  });

  it('records the event id, which is the idempotency guarantee', async () => {
    const ctx = await pendingSignup();
    await postWebhook(checkoutCompleted({ eventId: 'evt_1', sessionId: 'cs_1', ...ctx }));
    const { rows } = await adminPool.query('SELECT * FROM stripe_events');
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('evt_1');
    expect(rows[0].type).toBe('checkout.session.completed');
  });

  it('does not unsuspend a SUSPENDED organization', async () => {
    const ctx = await pendingSignup(ORG_STATUS.SUSPENDED);
    await postWebhook(checkoutCompleted({ eventId: 'evt_1', sessionId: 'cs_1', ...ctx }));

    const org = await adminPool.query('SELECT status FROM organizations WHERE id = $1', [ctx.orgId]);
    // Suspension is a Platform Admin decision. Only a Platform Admin reverses it.
    expect(org.rows[0].status).toBe(ORG_STATUS.SUSPENDED);

    const txn = await adminPool.query('SELECT status FROM transactions WHERE id = $1', [ctx.transactionId]);
    expect(txn.rows[0].status).toBe(TRANSACTION_STATUS.SUCCESS);
  });

  it('answers 200 and writes no event row for an unhandled type', async () => {
    const res = await postWebhook({ id: 'evt_x', type: 'customer.created', data: { object: {} } });
    expect(res.status).toBe(200);
    // stripe_events means "processed", not "seen". Recording an unhandled type
    // would make a future handler skip every historical event.
    const { rows } = await adminPool.query('SELECT * FROM stripe_events');
    expect(rows).toHaveLength(0);
  });
});
