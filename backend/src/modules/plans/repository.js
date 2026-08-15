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

export async function insert(client, { name, priceCents, currency, interval, features, maxMembers }) {
  const { rows } = await client.query(
    `INSERT INTO plans (name, price_cents, currency, "interval", features, max_members)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING ${PUBLIC}, stripe_product_id`,
    [name, priceCents, currency, interval, JSON.stringify(features), maxMembers]);
  return rows[0];
}

export async function update(client, id, { name, priceCents, features, maxMembers, isActive }) {
  const { rows } = await client.query(
    `UPDATE plans SET
       name        = COALESCE($2, name),
       price_cents = COALESCE($3, price_cents),
       features    = COALESCE($4, features),
       max_members = COALESCE($5, max_members),
       is_active   = COALESCE($6, is_active),
       updated_at  = now()
     WHERE id = $1
     RETURNING ${PUBLIC}, stripe_product_id`,
    [id, name ?? null, priceCents ?? null,
     features ? JSON.stringify(features) : null, maxMembers ?? null,
     isActive ?? null]);
  return rows[0];
}
