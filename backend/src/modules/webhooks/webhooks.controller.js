import { stripe } from '../../lib/stripe.js';
import { env } from '../../config/env.js';
import { withTenant } from '../../db/withTenant.js';
import { PG_UNIQUE_VIOLATION } from '../../lib/constants.js';
import { notify } from '../../lib/email/index.js';
import * as repo from './repository.js';
import * as service from './service.js';

// Renewal events carry no orgId in their own metadata, so the tenant is
// recovered from the Stripe subscription's metadata instead.
async function orgIdForSubscription(stripeSubscriptionId) {
  if (!stripeSubscriptionId) return null;
  const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  return sub.metadata?.orgId ?? null;
}

// Each handler: resolve the tenant, do Stripe reads BEFORE the transaction,
// return { orgId, transactionId?, apply(client) }.
const HANDLERS = {
  'checkout.session.completed': async (session) => {
    const { orgId, transactionId } = session.metadata ?? {};
    if (!orgId) return null;
    const stripeSub = await stripe.subscriptions.retrieve(session.subscription);
    const invoice = session.invoice ? await stripe.invoices.retrieve(session.invoice) : null;
    return {
      orgId, transactionId,
      apply: (c) => service.applyCheckoutCompleted(c, { session, stripeSub, invoice }),
    };
  },

  'invoice.paid': async (invoice) => {
    // The first invoice fires alongside checkout.session.completed. Handling both
    // would write two SUCCESS transactions for one charge.
    if (invoice.billing_reason === 'subscription_create') return null;
    const orgId = invoice.metadata?.orgId ?? await orgIdForSubscription(invoice.subscription);
    if (!orgId) return null;
    return { orgId, apply: (c) => service.applyInvoicePaid(c, invoice) };
  },

  'invoice.payment_failed': async (invoice) => {
    const orgId = invoice.metadata?.orgId ?? await orgIdForSubscription(invoice.subscription);
    if (!orgId) return null;
    return { orgId, apply: (c) => service.applyInvoiceFailed(c, invoice) };
  },

  'customer.subscription.updated': async (sub) => {
    const orgId = sub.metadata?.orgId ?? await orgIdForSubscription(sub.id);
    if (!orgId) return null;
    return { orgId, apply: (c) => service.applySubscriptionUpdated(c, sub) };
  },

  'customer.subscription.deleted': async (sub) => {
    const orgId = sub.metadata?.orgId ?? await orgIdForSubscription(sub.id);
    if (!orgId) return null;
    return { orgId, apply: (c) => service.applySubscriptionDeleted(c, sub) };
  },

  'charge.refunded': async (charge) => {
    const orgId = charge.metadata?.orgId;
    if (!orgId) return null;
    return { orgId, apply: (c) => service.applyChargeRefunded(c, charge) };
  },
};

export async function handleStripeWebhook(req, res, next) {
  let event;
  try {
    // req.body is a Buffer here, because this route mounts before express.json().
    event = stripe.webhooks.constructEvent(
      req.body, req.headers['stripe-signature'], env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return res.status(400).json({ error: { code: 'INVALID_SIGNATURE', message: 'Bad signature.' } });
  }

  const handler = HANDLERS[event.type];
  if (!handler) return res.sendStatus(200);   // answered, never recorded

  let plan;
  try { plan = await handler(event.data.object); }
  catch (err) { return next(err); }
  if (!plan) return res.sendStatus(200);

  let outcome = null;
  try {
    outcome = await withTenant(plan.orgId, async (c) => {
      await repo.record(c, { id: event.id, type: event.type });   // FIRST. The replay guard.
      return plan.apply(c);
    });
  } catch (err) {
    // A replay is a correct no-op. Its row already reads SUCCESS from the first delivery.
    if (err.code === PG_UNIQUE_VIOLATION) return res.sendStatus(200);
    if (plan.transactionId) {
      await withTenant(plan.orgId, (c) => repo.markRolledBack(c, { id: plan.transactionId }));
    }
    return next(err);      // 500, so Stripe retries
  }

  // After commit, never inside. An email cannot be rolled back.
  if (outcome) {
    await notify({
      orgId: plan.orgId, kind: outcome.kind,
      dedupKey: `${outcome.kind}:${outcome.transactionId}`,
      data: { transactionId: outcome.transactionId },
    }).catch((err) => console.error('[notify]', err));
  }

  return res.sendStatus(200);
}
