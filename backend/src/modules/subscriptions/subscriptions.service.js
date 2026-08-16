import { randomUUID } from 'node:crypto';
import { appPool } from '../../db/pool.js';
import { withTenant } from '../../db/withTenant.js';
import { stripe } from '../../lib/stripe.js';
import { env } from '../../config/env.js';
import { notFound, badRequest, conflict } from '../../lib/errors.js';
import {
  ERROR_CODE, ORG_STATUS, NOTIFICATION_KIND, SUBSCRIPTION_STATUS,
} from '../../lib/constants.js';
import * as plansRepo from '../plans/repository.js';
import { notify } from '../../lib/email/index.js';
import * as repo from './repository.js';

export const shapeSubscription = (s) => ({
  id: s.id,
  status: s.status,
  planName: s.plan_name,
  planId: s.plan_id,
  priceCents: s.price_cents,
  currency: s.currency,
  currentPeriodStart: s.current_period_start,
  currentPeriodEnd: s.current_period_end,
  cancelAtPeriodEnd: s.cancel_at_period_end,
  seatsUsed: s.seats_used,
  seatLimit: s.max_members,
});

export async function getSubscription({ orgId }) {
  const row = await withTenant(orgId, (c) => repo.findLive(c));
  if (!row) throw notFound('No active subscription.');
  return shapeSubscription(row);
}

async function requireLive(orgId) {
  const live = await withTenant(orgId, (c) => repo.findLive(c));
  if (!live) throw conflict(ERROR_CODE.SUBSCRIPTION_CONFLICT, 'No active subscription.');
  return live;
}

async function requirePlan(planId) {
  const plan = await plansRepo.findById(appPool, planId);
  if (!plan || !plan.is_active) throw badRequest('That plan is not available.');
  if (!plan.stripe_price_id) throw badRequest('That plan is not ready for checkout.');
  return plan;
}

export async function createCheckout({ orgId }, { planId }) {
  const live = await requireLive(orgId);
  const plan = await requirePlan(planId ?? live.plan_id);
  const customerId = await withTenant(orgId, (c) => repo.findCustomerId(c, orgId));

  // Stripe first, then one transaction. Same ordering rule as registration.
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
    metadata: { orgId, subscriptionId: live.id },
    subscription_data: { metadata: { orgId, subscriptionId: live.id } },
    success_url: `${env.APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.APP_URL}/checkout/cancelled`,
  });

  await withTenant(orgId, async (c) => {
    const pending = await repo.findLivePendingTransaction(c);
    const transactionId = pending?.id ?? randomUUID();
    if (!pending) {
      await repo.insertPendingTransaction(c, { id: transactionId, orgId, subscriptionId: live.id, plan });
    }
    await repo.attachCheckoutSession(c, {
      subscriptionId: live.id, transactionId, planId: plan.id,
      priceCents: plan.price_cents, stripePriceId: plan.stripe_price_id, sessionId: session.id,
    });
  });

  return { checkoutUrl: session.url };
}

export async function changePlan({ orgId }, { planId }) {
  const live = await requireLive(orgId);
  if (live.status !== SUBSCRIPTION_STATUS.ACTIVE) {
    throw conflict(ERROR_CODE.SUBSCRIPTION_CONFLICT, 'Finish activating your subscription first.');
  }
  const plan = await requirePlan(planId);

  // The server derives the direction. A client cannot mislabel a downgrade,
  // and the same comparison chooses the notification kind.
  const isDowngrade = plan.price_cents < live.price_cents;
  if (isDowngrade && live.seats_used > plan.max_members) {
    throw conflict(ERROR_CODE.SEAT_LIMIT_REACHED,
      `The ${plan.name} plan allows ${plan.max_members} members. Remove members first.`);
  }

  if (live.stripe_subscription_id) {
    const stripeSub = await stripe.subscriptions.retrieve(live.stripe_subscription_id);
    await stripe.subscriptions.update(live.stripe_subscription_id, {
      items: [{ id: stripeSub.items.data[0].id, price: plan.stripe_price_id }],
      proration_behavior: 'create_prorations',
    });
  }

  const updated = await withTenant(orgId, async (c) => {
    await repo.changePlan(c, {
      id: live.id, planId: plan.id,
      priceCents: plan.price_cents, stripePriceId: plan.stripe_price_id });
    return repo.findLive(c);
  });

  await notify({
    orgId,
    kind: isDowngrade ? NOTIFICATION_KIND.SUBSCRIPTION_DOWNGRADED
                      : NOTIFICATION_KIND.SUBSCRIPTION_UPGRADED,
    dedupKey: `${isDowngrade ? 'SUBSCRIPTION_DOWNGRADED' : 'SUBSCRIPTION_UPGRADED'}`
            + `:${live.id}:${new Date(updated.updated_at ?? Date.now()).toISOString()}`,
    data: { planName: plan.name },
  });

  return shapeSubscription(updated);
}

export async function cancelSubscription({ orgId }) {
  const live = await requireLive(orgId);

  if (live.stripe_subscription_id) {
    await stripe.subscriptions.update(live.stripe_subscription_id, { cancel_at_period_end: true });
  }

  await withTenant(orgId, async (c) => {
    await repo.markCancelled(c, live.id);
    await repo.setOrgStatus(c, orgId, ORG_STATUS.CANCELLED);
  });

  await notify({
    orgId, kind: NOTIFICATION_KIND.SUBSCRIPTION_CANCELLED,
    dedupKey: `SUBSCRIPTION_CANCELLED:${live.id}`,
    data: { periodEnd: live.current_period_end },
  });
}

export async function createPortalSession({ orgId }) {
  const customerId = await withTenant(orgId, (c) => repo.findCustomerId(c, orgId));
  if (!customerId) throw conflict(ERROR_CODE.SUBSCRIPTION_CONFLICT, 'No billing account yet.');

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId, return_url: `${env.APP_URL}/billing` });
  return { portalUrl: session.url };
}
