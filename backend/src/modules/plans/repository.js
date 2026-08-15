// plans has RLS off: platform-owned reference data read by unauthenticated visitors.
const PUBLIC = `id, name, price_cents, currency, "interval", features,
                max_members, stripe_price_id, is_active`;

export async function findActive(client) {
  const { rows } = await client.query(
    `SELECT ${PUBLIC} FROM plans WHERE is_active = true ORDER BY price_cents ASC`);
  return rows;
}

export async function findAll(client) {
  const { rows } = await client.query(
    `SELECT ${PUBLIC}, stripe_product_id, created_at FROM plans ORDER BY price_cents ASC`);
  return rows;
}

export async function findById(client, id) {
  const { rows } = await client.query(
    `SELECT ${PUBLIC}, stripe_product_id FROM plans WHERE id = $1`, [id]);
  return rows[0];
}

export async function setStripeIds(client, id, { productId, priceId }) {
  const { rows } = await client.query(
    `UPDATE plans SET stripe_product_id = $2, stripe_price_id = $3, updated_at = now()
      WHERE id = $1 RETURNING ${PUBLIC}`, [id, productId, priceId]);
  return rows[0];
}
