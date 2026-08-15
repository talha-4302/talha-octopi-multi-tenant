import { NOTIFICATION_KIND } from '../../lib/constants.js';
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
