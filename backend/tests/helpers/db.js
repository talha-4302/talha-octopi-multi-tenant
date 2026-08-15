import { adminPool } from '../../src/db/pool.js';
import { ORG_STATUS } from '../../src/lib/constants.js';
import { randomUUID } from 'node:crypto';

const TABLES = [
  'notifications_log', 'transactions', 'subscriptions', 'one_time_tokens',
  'refresh_tokens', 'users', 'organizations', 'stripe_events',
];

export async function truncateAll() {
  // plans and schema_migrations survive: they are reference data, not test state
  await adminPool.query(`TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`);
}

export async function getPlan(name = 'Starter') {
  const { rows } = await adminPool.query('SELECT * FROM plans WHERE name = $1', [name]);
  if (!rows[0]) throw new Error(`seed plan ${name} missing, run migrations`);
  // Seeded plans have NULL Stripe ids by design (filled in by sync:plans against
  // real Stripe). Tests fake one here, once, so checkout has something to reference.
  if (!rows[0].stripe_price_id) {
    const { rows: synced } = await adminPool.query(
      `UPDATE plans SET stripe_price_id = 'price_test_' || id,
              stripe_product_id = COALESCE(stripe_product_id, 'prod_test_' || id)
        WHERE id = $1 RETURNING *`, [rows[0].id]);
    return synced[0];
  }
  return rows[0];
}

// Seeding writes through the privileged pool because it is setup, not behaviour under test.
export async function seedOrg({ name = 'Acme', status = ORG_STATUS.ACTIVE } = {}) {
  const orgId = randomUUID();
  await adminPool.query(
    `INSERT INTO organizations (id, name, billing_email, status)
     VALUES ($1, $2, $3, $4)`,
    [orgId, name, `billing+${orgId}@example.com`, status]
  );
  return { orgId };
}
