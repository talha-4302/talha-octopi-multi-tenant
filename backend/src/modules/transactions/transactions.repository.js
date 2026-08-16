const PUBLIC = `t.id, t.amount_cents, t.currency, t.status, t.invoice_url,
                t.failure_reason, t.created_at, p.name AS plan_name`;

export async function listForOrg(client, { status, pageSize, offset }) {
  const { rows } = await client.query(
    `SELECT ${PUBLIC}, count(*) OVER() AS total
       FROM transactions t
       LEFT JOIN plans p ON p.id = t.plan_id
      WHERE ($1::text IS NULL OR t.status = $1)
      ORDER BY t.created_at DESC
      LIMIT $2 OFFSET $3`,
    [status ?? null, pageSize, offset]);
  return { rows, total: rows.length ? Number(rows[0].total) : 0 };
}
