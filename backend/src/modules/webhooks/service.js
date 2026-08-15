import { SUBSCRIPTION_STATUS, TRANSACTION_STATUS, NOTIFICATION_KIND } from '../../lib/constants.js';
import * as repo from './repository.js';

const toDate = (u) => (u ? new Date(u * 1000) : null);

// Every Stripe read happens in the controller BEFORE the transaction opens.
// This only writes rows with values it is handed.
export async function applyCheckoutCompleted(client, { session, stripeSub, invoice }) {
  const { orgId, subscriptionId, transactionId } = session.metadata;

  await repo.markSuccess(client, {
    id: transactionId,
    paymentIntentId: session.payment_intent,
    invoiceId: invoice?.id,
    invoiceUrl: invoice?.hosted_invoice_url,
  });
  await repo.activateSubscription(client, {
    id: subscriptionId,
    stripeSubscriptionId: stripeSub.id,
    periodStart: toDate(stripeSub.current_period_start),
    periodEnd: toDate(stripeSub.current_period_end),
  });
  await repo.activateOrganization(client, orgId);

  return { kind: NOTIFICATION_KIND.PAYMENT_SUCCEEDED, transactionId };
}

export async function applyInvoicePaid(client, invoice) {
  const sub = await repo.findSubscriptionByStripeId(client, invoice.subscription);
  if (!sub) return null;

  const txn = await repo.insertSettledTransaction(client, {
    orgId: sub.org_id, subscriptionId: sub.id, planId: sub.plan_id,
    amountCents: invoice.amount_paid, currency: invoice.currency,
    status: TRANSACTION_STATUS.SUCCESS,
    invoiceId: invoice.id, invoiceUrl: invoice.hosted_invoice_url,
    paymentIntentId: invoice.payment_intent,
  });

  await repo.syncSubscription(client, {
    id: sub.id, status: SUBSCRIPTION_STATUS.ACTIVE,
    periodStart: toDate(invoice.period_start), periodEnd: toDate(invoice.period_end),
  });
  await repo.activateOrganization(client, sub.org_id);

  return { kind: NOTIFICATION_KIND.PAYMENT_SUCCEEDED, transactionId: txn.id };
}

export async function applyInvoiceFailed(client, invoice) {
  const sub = await repo.findSubscriptionByStripeId(client, invoice.subscription);
  if (!sub) return null;

  const txn = await repo.insertSettledTransaction(client, {
    orgId: sub.org_id, subscriptionId: sub.id, planId: sub.plan_id,
    amountCents: invoice.amount_due, currency: invoice.currency,
    status: TRANSACTION_STATUS.FAILED,
    invoiceId: invoice.id, paymentIntentId: invoice.payment_intent,
    failureReason: invoice.last_finalization_error?.message ?? 'Payment was declined.',
  });
  // The subscription is untouched. Stripe is still retrying on its own schedule.
  return { kind: NOTIFICATION_KIND.PAYMENT_FAILED, transactionId: txn.id };
}

export async function applySubscriptionUpdated(client, stripeSub) {
  const sub = await repo.findSubscriptionByStripeId(client, stripeSub.id);
  if (!sub) return null;

  await repo.syncSubscription(client, {
    id: sub.id,
    status: stripeSub.status === 'unpaid' ? SUBSCRIPTION_STATUS.FAILED : null,
    periodStart: toDate(stripeSub.current_period_start),
    periodEnd: toDate(stripeSub.current_period_end),
    cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
  });
  return null;
}

export async function applySubscriptionDeleted(client, stripeSub) {
  const sub = await repo.findSubscriptionByStripeId(client, stripeSub.id);
  if (!sub) return null;
  await repo.syncSubscription(client, { id: sub.id, status: SUBSCRIPTION_STATUS.EXPIRED });
  return null;
}

export async function applyChargeRefunded(client, charge) {
  await repo.markRefunded(client, charge.payment_intent);
  return null;
}
