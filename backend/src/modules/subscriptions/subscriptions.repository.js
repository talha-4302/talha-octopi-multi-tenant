const LIVE = `s.id, s.plan_id, s.price_cents, s.stripe_price_id, s.status,
              s.current_period_start, s.current_period_end, s.cancel_at_period_end,
              s.stripe_subscription_id`;

/** The single PENDING or ACTIVE row. The partial unique index guarantees at most one. */
export async function findLive(client) {
  const { rows } = await client.query(
    `SELECT ${LIVE}, p.name AS plan_name, p.max_members, p.currency,
            (SELECT count(*)::int FROM users WHERE status <> 'REMOVED') AS seats_used
       FROM subscriptions s JOIN plans p ON p.id = s.plan_id
      WHERE s.status IN ('PENDING','ACTIVE')`);
  return rows[0];
}

export async function attachCheckoutSession(client, { subscriptionId, transactionId, planId,
                                                       priceCents, stripePriceId, sessionId }) {
  await client.query(
    `UPDATE subscriptions
        SET plan_id = $2, price_cents = $3, stripe_price_id = $4, updated_at = now()
      WHERE id = $1`, [subscriptionId, planId, priceCents, stripePriceId]);

  // The live PENDING transaction takes the new session. No insert: an abandoned
  // attempt was never a payment, and only settled attempts become history.
  await client.query(
    `UPDATE transactions
        SET stripe_checkout_session_id = $2, plan_id = $3, amount_cents = $4, updated_at = now()
      WHERE id = $1`, [transactionId, sessionId, planId, priceCents]);
}

export async function findLivePendingTransaction(client) {
  const { rows } = await client.query(
    `SELECT id FROM transactions WHERE status = 'PENDING' ORDER BY created_at DESC LIMIT 1`);
  return rows[0];
}

export async function insertPendingTransaction(client, { id, orgId, subscriptionId, plan }) {
  await client.query(
    `INSERT INTO transactions (id, org_id, subscription_id, plan_id, amount_cents, currency, status)
     VALUES ($1,$2,$3,$4,$5,$6,'PENDING')`,
    [id, orgId, subscriptionId, plan.id, plan.price_cents, plan.currency]);
}

export async function changePlan(client, { id, planId, priceCents, stripePriceId }) {
  const { rows } = await client.query(
    `UPDATE subscriptions
        SET plan_id = $2, price_cents = $3, stripe_price_id = $4, updated_at = now()
      WHERE id = $1 RETURNING id`, [id, planId, priceCents, stripePriceId]);
  return rows[0];
}

export async function markCancelled(client, id) {
  await client.query(
    `UPDATE subscriptions
        SET status = 'CANCELLED', cancel_at_period_end = true, updated_at = now()
      WHERE id = $1`, [id]);
}

export async function setOrgStatus(client, orgId, status) {
  await client.query(
    `UPDATE organizations SET status = $2, updated_at = now()
      WHERE id = $1 AND status <> 'SUSPENDED'`, [orgId, status]);
}

export async function findCustomerId(client, orgId) {
  const { rows } = await client.query(
    'SELECT stripe_customer_id FROM organizations WHERE id = $1', [orgId]);
  return rows[0]?.stripe_customer_id;
}
