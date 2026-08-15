import { randomUUID } from 'node:crypto';
import { adminPool } from '../../src/db/pool.js';
import { hashPassword } from '../../src/lib/password.js';
import { ROLES, USER_STATUS, SUBSCRIPTION_STATUS, TRANSACTION_STATUS } from '../../src/lib/constants.js';

export async function makeUser({
  orgId, role = ROLES.ORG_MEMBER, status = USER_STATUS.ACTIVE,
  password = 'Passw0rd!', name = 'Test User', email,
} = {}) {
  const id = randomUUID();
  const address = email || `u+${id}@example.com`;
  const hash = status === USER_STATUS.INVITED ? null : await hashPassword(password);
  await adminPool.query(
    `INSERT INTO users (id, org_id, email, password_hash, name, role, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id, orgId, address, hash, name, role, status]);
  return { id, email: address, password, orgId, role };
}

export async function makeSubscription({
  orgId, plan, status = SUBSCRIPTION_STATUS.ACTIVE, periodEnd,
} = {}) {
  const id = randomUUID();
  const end = periodEnd ?? new Date(Date.now() + 30 * 24 * 3600_000);
  await adminPool.query(
    `INSERT INTO subscriptions
       (id, org_id, plan_id, price_cents, stripe_price_id, status,
        current_period_start, current_period_end, stripe_subscription_id)
     VALUES ($1,$2,$3,$4,$5,$6, now(), $7, $8)`,
    [id, orgId, plan.id, plan.price_cents, plan.stripe_price_id || 'price_test',
     status, end, `sub_${id}`]);
  return { id, planId: plan.id, status, periodEnd: end };
}

export async function makeTransaction({
  orgId, plan, subscriptionId = null, status = TRANSACTION_STATUS.SUCCESS,
  invoiceUrl = null, checkoutSessionId = null, paymentIntentId = null,
} = {}) {
  const id = randomUUID();
  await adminPool.query(
    `INSERT INTO transactions
       (id, org_id, subscription_id, plan_id, amount_cents, currency, status,
        invoice_url, stripe_checkout_session_id, stripe_payment_intent_id)
     VALUES ($1,$2,$3,$4,$5,'usd',$6,$7,$8,$9)`,
    [id, orgId, subscriptionId, plan.id, plan.price_cents, status,
     invoiceUrl, checkoutSessionId, paymentIntentId]);
  return { id };
}
