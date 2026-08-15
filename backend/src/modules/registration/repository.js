export async function insertOrganization(client, { id, name, billingEmail, stripeCustomerId }) {
  const { rows } = await client.query(
    `INSERT INTO organizations (id, name, billing_email, status, stripe_customer_id)
     VALUES ($1,$2,$3,'PENDING',$4)
     RETURNING id, name, status, billing_email`,
    [id, name, billingEmail, stripeCustomerId]);
  return rows[0];
}

export async function insertUser(client, { id, orgId, email, name, passwordHash }) {
  const { rows } = await client.query(
    `INSERT INTO users (id, org_id, email, password_hash, name, role, status)
     VALUES ($1,$2,$3,$4,$5,'ORG_ADMIN','ACTIVE')
     RETURNING id, org_id, email, name, role, status`,
    [id, orgId, email, passwordHash, name]);
  return rows[0];
}

export async function insertSubscription(client, { id, orgId, plan }) {
  const { rows } = await client.query(
    `INSERT INTO subscriptions (id, org_id, plan_id, price_cents, stripe_price_id, status)
     VALUES ($1,$2,$3,$4,$5,'PENDING') RETURNING id`,
    [id, orgId, plan.id, plan.price_cents, plan.stripe_price_id]);
  return rows[0];
}

export async function insertTransaction(client, { id, orgId, subscriptionId, plan, sessionId }) {
  const { rows } = await client.query(
    `INSERT INTO transactions
       (id, org_id, subscription_id, plan_id, amount_cents, currency, status,
        stripe_checkout_session_id)
     VALUES ($1,$2,$3,$4,$5,$6,'PENDING',$7) RETURNING id`,
    [id, orgId, subscriptionId, plan.id, plan.price_cents, plan.currency, sessionId]);
  return rows[0];
}
