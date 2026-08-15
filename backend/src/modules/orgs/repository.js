/** @returns {Promise<{status: string}|undefined>} */
export async function findStatus(client, orgId) {
  const { rows } = await client.query('SELECT status FROM organizations WHERE id = $1', [orgId]);
  return rows[0];
}
