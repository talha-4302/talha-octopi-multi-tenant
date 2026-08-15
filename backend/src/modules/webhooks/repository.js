// stripe_events has RLS off: infrastructure, no tenant column.
export async function record(client, { id, type }) {
  await client.query('INSERT INTO stripe_events (id, type) VALUES ($1, $2)', [id, type]);
}

export async function activateOrganization(client, orgId) {
  // A renewal or activation must never quietly unsuspend an organization.
  await client.query(
    `UPDATE organizations SET status = 'ACTIVE', updated_at = now()
      WHERE id = $1 AND status <> 'SUSPENDED'`, [orgId]);
}

export async function activateSubscription(client, { id, stripeSubscriptionId, periodStart, periodEnd }) {
  await client.query(
    `UPDATE subscriptions
        SET status = 'ACTIVE', stripe_subscription_id = $2,
            current_period_start = $3, current_period_end = $4, updated_at = now()
      WHERE id = $1`, [id, stripeSubscriptionId, periodStart, periodEnd]);
}

export async function markSuccess(client, { id, paymentIntentId, invoiceId, invoiceUrl }) {
  // ROLLED_BACK is admitted so a retry after a failed delivery can still settle.
  // Without it a transaction that failed once could never reach SUCCESS.
  await client.query(
    `UPDATE transactions
        SET status = 'SUCCESS', stripe_payment_intent_id = COALESCE($2, stripe_payment_intent_id),
            stripe_invoice_id = COALESCE($3, stripe_invoice_id),
            invoice_url = COALESCE($4, invoice_url), updated_at = now()
      WHERE id = $1 AND status IN ('PENDING','ROLLED_BACK')`,
    [id, paymentIntentId ?? null, invoiceId ?? null, invoiceUrl ?? null]);
}

export async function markRolledBack(client, { id }) {
  // Guarded on PENDING so a later retry that already settled is never overwritten.
  await client.query(
    `UPDATE transactions SET status = 'ROLLED_BACK', updated_at = now()
      WHERE id = $1 AND status = 'PENDING'`, [id]);
}
