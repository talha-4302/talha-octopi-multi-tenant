import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminPool } from '../src/db/pool.js';
import { stripe } from '../src/lib/stripe.js';
import { seedOrg, getPlan } from './helpers/db.js';
import { makeSubscription, makeTransaction, makeUser } from './helpers/factories.js';
import { postWebhook, checkoutCompleted } from './helpers/stripeEvents.js';
import * as webhookRepo from '../src/modules/webhooks/webhooks.repository.js';
import {
  ORG_STATUS, SUBSCRIPTION_STATUS, TRANSACTION_STATUS, ROLES,
} from '../src/lib/constants.js';

async function pendingSignup() {
  const plan = await getPlan('Starter');
  const { orgId } = await seedOrg({ status: ORG_STATUS.PENDING });
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

describe('duplicate webhook delivery', () => {
  it('applies the effects exactly once', async () => {
    const ctx = await pendingSignup();
    const event = checkoutCompleted({ eventId: 'evt_dup', sessionId: 'cs_1', ...ctx });

    const first = await postWebhook(event);
    const second = await postWebhook(event);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);    // tells Stripe to stop retrying

    const events = await adminPool.query('SELECT * FROM stripe_events');
    expect(events.rows).toHaveLength(1);

    const txns = await adminPool.query(
      `SELECT status FROM transactions WHERE org_id = $1`, [ctx.orgId]);
    expect(txns.rows).toHaveLength(1);
    expect(txns.rows[0].status).toBe(TRANSACTION_STATUS.SUCCESS);
  });

  it('sends no second email on the replay', async () => {
    const ctx = await pendingSignup();
    const event = checkoutCompleted({ eventId: 'evt_dup2', sessionId: 'cs_1', ...ctx });
    await postWebhook(event);
    await postWebhook(event);

    const notes = await adminPool.query(
      `SELECT * FROM notifications_log WHERE org_id = $1 AND kind = 'PAYMENT_SUCCEEDED'`,
      [ctx.orgId]);
    expect(notes.rows).toHaveLength(1);
  });
});

describe('transaction rollback', () => {
  it('commits nothing when a later write in the transaction fails', async () => {
    const ctx = await pendingSignup();
    vi.spyOn(webhookRepo, 'activateSubscription')
      .mockRejectedValueOnce(new Error('injected failure'));

    const res = await postWebhook(
      checkoutCompleted({ eventId: 'evt_fail', sessionId: 'cs_1', ...ctx }));

    expect(res.status).toBe(500);       // so Stripe retries

    const org = await adminPool.query('SELECT status FROM organizations WHERE id = $1', [ctx.orgId]);
    expect(org.rows[0].status).toBe(ORG_STATUS.PENDING);

    const sub = await adminPool.query('SELECT status FROM subscriptions WHERE id = $1', [ctx.subscriptionId]);
    expect(sub.rows[0].status).toBe(SUBSCRIPTION_STATUS.PENDING);
  });

  it('writes ROLLED_BACK from a compensating transaction', async () => {
    const ctx = await pendingSignup();
    vi.spyOn(webhookRepo, 'activateSubscription').mockRejectedValueOnce(new Error('injected'));
    await postWebhook(checkoutCompleted({ eventId: 'evt_fail2', sessionId: 'cs_1', ...ctx }));

    const txn = await adminPool.query('SELECT status FROM transactions WHERE id = $1', [ctx.transactionId]);
    // A ROLLBACK would have discarded this write, so it must come from a second transaction.
    expect(txn.rows[0].status).toBe(TRANSACTION_STATUS.ROLLED_BACK);
  });

  it('rolls the stripe_events row back too, leaving the id free for the retry', async () => {
    const ctx = await pendingSignup();
    vi.spyOn(webhookRepo, 'activateSubscription').mockRejectedValueOnce(new Error('injected'));
    await postWebhook(checkoutCompleted({ eventId: 'evt_fail3', sessionId: 'cs_1', ...ctx }));

    const events = await adminPool.query('SELECT * FROM stripe_events');
    expect(events.rows).toHaveLength(0);
  });

  it('sends no email when there was no commit', async () => {
    const ctx = await pendingSignup();
    vi.spyOn(webhookRepo, 'activateSubscription').mockRejectedValueOnce(new Error('injected'));
    await postWebhook(checkoutCompleted({ eventId: 'evt_fail4', sessionId: 'cs_1', ...ctx }));

    const notes = await adminPool.query('SELECT * FROM notifications_log WHERE org_id = $1', [ctx.orgId]);
    expect(notes.rows).toHaveLength(0);
  });

  it('succeeds fully on redelivery, moving ROLLED_BACK to SUCCESS', async () => {
    const ctx = await pendingSignup();
    const event = checkoutCompleted({ eventId: 'evt_retry', sessionId: 'cs_1', ...ctx });

    vi.spyOn(webhookRepo, 'activateSubscription').mockRejectedValueOnce(new Error('injected'));
    await postWebhook(event);                 // fails, writes ROLLED_BACK
    const res = await postWebhook(event);     // Stripe redelivers

    expect(res.status).toBe(200);
    const txn = await adminPool.query('SELECT status FROM transactions WHERE id = $1', [ctx.transactionId]);
    // This is the case that catches a markSuccess guard narrowed to PENDING only.
    expect(txn.rows[0].status).toBe(TRANSACTION_STATUS.SUCCESS);

    const org = await adminPool.query('SELECT status FROM organizations WHERE id = $1', [ctx.orgId]);
    expect(org.rows[0].status).toBe(ORG_STATUS.ACTIVE);
  });

  it('does not overwrite a transaction a retry already settled', async () => {
    const ctx = await pendingSignup();
    await postWebhook(checkoutCompleted({ eventId: 'evt_ok', sessionId: 'cs_1', ...ctx }));

    // A late compensating write arriving after the row settled must be a no-op.
    const { withTenant } = await import('../src/db/withTenant.js');
    await withTenant(ctx.orgId, (c) => webhookRepo.markRolledBack(c, { id: ctx.transactionId }));

    const txn = await adminPool.query('SELECT status FROM transactions WHERE id = $1', [ctx.transactionId]);
    expect(txn.rows[0].status).toBe(TRANSACTION_STATUS.SUCCESS);
  });
});
