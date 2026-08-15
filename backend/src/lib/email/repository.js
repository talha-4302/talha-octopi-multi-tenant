export async function findRecipient(client, orgId) {
  const { rows } = await client.query(
    'SELECT name, billing_email FROM organizations WHERE id = $1', [orgId]);
  return rows[0];
}

export async function logNotification(client, { orgId, recipient, kind, dedupKey, status, error }) {
  const { rowCount } = await client.query(
    `INSERT INTO notifications_log (org_id, recipient_email, kind, dedup_key, status, error)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (dedup_key) DO NOTHING`,
    [orgId, recipient, kind, dedupKey, status, error ?? null]);
  return rowCount === 1;   // false means already logged, so already sent
}

export async function markFailed(client, dedupKey, error) {
  await client.query(
    `UPDATE notifications_log SET status = 'FAILED', error = $2 WHERE dedup_key = $1`,
    [dedupKey, error]);
}
