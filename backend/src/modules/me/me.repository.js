const PUBLIC = 'id, org_id, email, name, role, status';

export async function findById(client, userId) {
  const { rows } = await client.query(`SELECT ${PUBLIC} FROM users WHERE id = $1`, [userId]);
  return rows[0];
}

export async function updateName(client, userId, name) {
  const { rows } = await client.query(
    `UPDATE users SET name = $2, updated_at = now() WHERE id = $1 RETURNING ${PUBLIC}`,
    [userId, name]);
  return rows[0];
}
