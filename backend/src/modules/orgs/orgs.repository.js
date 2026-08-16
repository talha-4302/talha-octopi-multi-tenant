/** @returns {Promise<{status: string}|undefined>} */
export async function findStatus(client, orgId) {
  const { rows } = await client.query('SELECT status FROM organizations WHERE id = $1', [orgId]);
  return rows[0];
}

/** Member projection. Deliberately excludes every billing and contact column. */
export async function findForMember(client, orgId) {
  const { rows } = await client.query(
    `SELECT o.name, o.status, p.name AS plan_name
       FROM organizations o
       LEFT JOIN subscriptions s
         ON s.org_id = o.id AND s.status IN ('PENDING','ACTIVE')
       LEFT JOIN plans p ON p.id = s.plan_id
      WHERE o.id = $1`, [orgId]);
  return rows[0];
}

/** Admin projection. Adds contact_email, billing_email, suspended_reason. */
export async function findForAdmin(client, orgId) {
  const { rows } = await client.query(
    `SELECT o.name, o.status, o.contact_email, o.billing_email, o.suspended_reason,
            o.created_at, p.name AS plan_name
       FROM organizations o
       LEFT JOIN subscriptions s
         ON s.org_id = o.id AND s.status IN ('PENDING','ACTIVE')
       LEFT JOIN plans p ON p.id = s.plan_id
      WHERE o.id = $1`, [orgId]);
  return rows[0];
}

export async function update(client, orgId, { name, contactEmail, billingEmail }) {
  const { rows } = await client.query(
    `UPDATE organizations SET
       name          = COALESCE($2, name),
       contact_email = COALESCE($3, contact_email),
       billing_email = COALESCE($4, billing_email),
       updated_at    = now()
     WHERE id = $1
     RETURNING name, status, contact_email, billing_email, suspended_reason`,
    [orgId, name ?? null, contactEmail ?? null, billingEmail ?? null]);
  return rows[0];
}
