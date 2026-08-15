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
