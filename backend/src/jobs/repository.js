import { adminPool } from '../db/pool.js';

// jobs/ is on the adminPool allowlist: the sweep is cross tenant by nature.
export async function findExpiringSoon(days) {
  const { rows } = await adminPool.query(
    `SELECT s.id, s.org_id, s.current_period_end
       FROM subscriptions s
      WHERE s.status = 'ACTIVE'
        AND s.current_period_end > now()
        AND s.current_period_end < now() + ($1 || ' days')::interval`,
    [String(days)]);
  return rows;
}
