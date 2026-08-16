// The privileged, cross-tenant repository. modules/admin/ is on the adminPool
// allowlist because cross-organization access is this module's entire purpose.
import { adminPool } from '../../db/pool.js';

export async function listOrgs({ search, status, pageSize, offset }) {
  const { rows } = await adminPool.query(
    `SELECT o.id, o.name, o.status, o.billing_email, o.created_at,
            p.name AS plan_name,
            (SELECT count(*)::int FROM users u
              WHERE u.org_id = o.id AND u.status <> 'REMOVED') AS member_count,
            count(*) OVER() AS total
       FROM organizations o
       LEFT JOIN subscriptions s
         ON s.org_id = o.id AND s.status IN ('PENDING','ACTIVE')
       LEFT JOIN plans p ON p.id = s.plan_id
      WHERE ($1::text IS NULL OR o.name ILIKE '%' || $1 || '%')
        AND ($2::text IS NULL OR o.status = $2)
      ORDER BY o.created_at DESC
      LIMIT $3 OFFSET $4`,
    [search ?? null, status ?? null, pageSize, offset]);
  return { rows, total: rows.length ? Number(rows[0].total) : 0 };
}

export async function findOrg(orgId) {
  const { rows } = await adminPool.query(
    `SELECT id, name, status, contact_email, billing_email, suspended_reason,
            stripe_customer_id, created_at
       FROM organizations WHERE id = $1`, [orgId]);
  return rows[0];
}

export async function listMemberIds(orgId) {
  const { rows } = await adminPool.query('SELECT id FROM users WHERE org_id = $1', [orgId]);
  return rows.map((r) => r.id);
}

export async function listOrgMembers(orgId) {
  // Explicit column list. A SELECT * here would ship password_hash.
  const { rows } = await adminPool.query(
    `SELECT id, email, name, role, status, created_at
       FROM users WHERE org_id = $1 ORDER BY created_at ASC`, [orgId]);
  return rows;
}

export async function listOrgSubscriptions(orgId) {
  const { rows } = await adminPool.query(
    `SELECT s.id, s.status, s.price_cents, s.current_period_start, s.current_period_end,
            s.cancel_at_period_end, s.created_at, p.name AS plan_name, p.currency
       FROM subscriptions s JOIN plans p ON p.id = s.plan_id
      WHERE s.org_id = $1 ORDER BY s.created_at DESC`, [orgId]);
  return rows;
}

export async function listTransactions({ orgId, status, from, to, pageSize, offset }) {
  const { rows } = await adminPool.query(
    `SELECT t.id, t.org_id, t.amount_cents, t.currency, t.status, t.invoice_url,
            t.failure_reason, t.created_at,
            o.name AS org_name, p.name AS plan_name,
            count(*) OVER() AS total
       FROM transactions t
       JOIN organizations o ON o.id = t.org_id
       LEFT JOIN plans p ON p.id = t.plan_id
      WHERE ($1::uuid IS NULL OR t.org_id = $1)
        AND ($2::text IS NULL OR t.status = $2)
        AND ($3::timestamptz IS NULL OR t.created_at >= $3)
        AND ($4::timestamptz IS NULL OR t.created_at <= $4)
      ORDER BY t.created_at DESC
      LIMIT $5 OFFSET $6`,
    [orgId ?? null, status ?? null, from ?? null, to ?? null, pageSize, offset]);
  return { rows, total: rows.length ? Number(rows[0].total) : 0 };
}

export async function suspend(orgId, reason) {
  const { rows } = await adminPool.query(
    `UPDATE organizations SET status = 'SUSPENDED', suspended_reason = $2, updated_at = now()
      WHERE id = $1 RETURNING id, name, status, suspended_reason`, [orgId, reason]);
  return rows[0];
}

export async function reactivate(orgId) {
  const { rows } = await adminPool.query(
    `UPDATE organizations SET status = 'ACTIVE', suspended_reason = NULL, updated_at = now()
      WHERE id = $1 RETURNING id`, [orgId]);
  return rows[0];
}

export async function stats() {
  const { rows } = await adminPool.query(`
    SELECT
      (SELECT count(*)::int FROM organizations) AS total_organizations,
      (SELECT count(*)::int FROM users WHERE status <> 'REMOVED') AS total_users,
      (SELECT count(*)::int FROM subscriptions WHERE status = 'ACTIVE') AS active_subscriptions,
      (SELECT count(*)::int FROM transactions WHERE status = 'FAILED') AS failed_payments`);
  return rows[0];
}

export async function revenueByCurrency() {
  // Grouped, never summed across currencies. transactions.currency is per row.
  const { rows } = await adminPool.query(
    `SELECT currency, sum(amount_cents)::bigint AS total_cents, count(*)::int AS payments
       FROM transactions WHERE status = 'SUCCESS'
      GROUP BY currency ORDER BY currency`);
  return rows;
}

export async function recentSignups(limit = 5) {
  const { rows } = await adminPool.query(
    `SELECT id, name, status, created_at FROM organizations
      ORDER BY created_at DESC LIMIT $1`, [limit]);
  return rows;
}
