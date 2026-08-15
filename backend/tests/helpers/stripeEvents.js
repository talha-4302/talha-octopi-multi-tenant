import { stripe } from '../../src/lib/stripe.js';
import { env } from '../../src/config/env.js';
import { api } from './http.js';

export function signedEvent(event) {
  const payload = JSON.stringify(event);
  const header = stripe.webhooks.generateTestHeaderString({
    payload, secret: env.STRIPE_WEBHOOK_SECRET,
  });
  return { payload, header };
}

export function postWebhook(event, { header } = {}) {
  const signed = signedEvent(event);
  return api().post('/api/webhooks/stripe')
    .set('stripe-signature', header ?? signed.header)
    .set('content-type', 'application/json')
    .send(signed.payload);
}

export const checkoutCompleted = ({ eventId, orgId, subscriptionId, transactionId, sessionId }) => ({
  id: eventId,
  type: 'checkout.session.completed',
  data: { object: {
    id: sessionId,
    object: 'checkout.session',
    customer: 'cus_1',
    subscription: 'sub_stripe_1',
    payment_intent: 'pi_1',
    invoice: 'in_1',
    metadata: { orgId, subscriptionId, transactionId },
  } },
});
