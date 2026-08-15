const PUBLIC = 'id, email, name, role, status, created_at';

export async function list(client, { status, page, pageSize, offset }) {
  // ORDER BY is fixed, never client supplied, so user input never reaches it.
  const { rows } = await client.query(
    `SELECT ${PUBLIC}, count(*) OVER() AS total
       FROM users
      WHERE ($1::text IS NULL OR status = $1)
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3`,
    [status ?? null, pageSize, offset]);
  return { rows, total: rows.length ? Number(rows[0].total) : 0 };
}

export async function countActiveSeats(client) {
  const { rows } = await client.query(
    `SELECT count(*)::int AS seats FROM users WHERE status <> 'REMOVED'`);
  return rows[0].seats;
}

export async function planLimit(client) {
  const { rows } = await client.query(
    `SELECT p.max_members
       FROM subscriptions s JOIN plans p ON p.id = s.plan_id
      WHERE s.status IN ('PENDING','ACTIVE')`);
  return rows[0]?.max_members ?? 0;
}

/** Tenant-scoped, so it only ever sees a row belonging to the caller's org. */
export async function findByEmailInTenant(client, email) {
  const { rows } = await client.query(
    `SELECT id, status FROM users WHERE email = $1`, [email]);
  return rows[0];
}

export async function insert(client, { id, email, name, role, orgId }) {
  const { rows } = await client.query(
    `INSERT INTO users (id, org_id, email, name, role, status)
     VALUES ($1,$2,$3,$4,$5,'INVITED') RETURNING ${PUBLIC}`,
    [id, orgId, email, name, role]);
  return rows[0];
}

export async function reactivate(client, { id, name, role }) {
  const { rows } = await client.query(
    `UPDATE users SET status = 'INVITED', password_hash = NULL,
                      name = $2, role = $3, updated_at = now()
      WHERE id = $1 RETURNING ${PUBLIC}`, [id, name, role]);
  return rows[0];
}

export async function findById(client, id) {
  const { rows } = await client.query(
    `SELECT id, email, name, role, status FROM users WHERE id = $1`, [id]);
  return rows[0];
}

export async function countAdmins(client) {
  const { rows } = await client.query(
    `SELECT count(*)::int AS admins FROM users
      WHERE role = 'ORG_ADMIN' AND status <> 'REMOVED'`);
  return rows[0].admins;
}

export async function updateRole(client, id, role) {
  const { rows } = await client.query(
    `UPDATE users SET role = $2, updated_at = now() WHERE id = $1
     RETURNING ${PUBLIC}`, [id, role]);
  return rows[0];
}

export async function markRemoved(client, id) {
  const { rowCount } = await client.query(
    `UPDATE users SET status = 'REMOVED', updated_at = now()
      WHERE id = $1 AND status <> 'REMOVED'`, [id]);
  return rowCount === 1;
}
