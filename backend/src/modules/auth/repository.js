// The ONLY file outside modules/admin/ and jobs/ permitted to import adminPool.
// Every function resolves a single identity the caller has already proven
// possession of. None accepts an org_id. None returns a list. See the data model,
// "the one privileged read outside admin and jobs".
import { adminPool } from '../../db/pool.js';

const AUTH_COLUMNS = 'id, org_id, email, password_hash, name, role, status';

/** @returns {Promise<{id,org_id,email,password_hash,name,role,status}|undefined>} */
export async function findByEmail(email) {
  const { rows } = await adminPool.query(
    `SELECT ${AUTH_COLUMNS} FROM users WHERE email = $1`, [email]);
  return rows[0];
}

/** @returns {Promise<{id,org_id,email,password_hash,name,role,status}|undefined>} */
export async function findByIdForRefresh(userId) {
  const { rows } = await adminPool.query(
    `SELECT ${AUTH_COLUMNS} FROM users WHERE id = $1`, [userId]);
  return rows[0];
}

/** Resolves the user behind an unused, unexpired one time token. */
export async function findByTokenHash(tokenHash, purpose) {
  const { rows } = await adminPool.query(
    `SELECT u.id, u.org_id, u.email, u.name, u.role, u.status, t.id AS token_id
       FROM one_time_tokens t
       JOIN users u ON u.id = t.user_id
      WHERE t.token_hash = $1 AND t.purpose = $2
        AND t.used_at IS NULL AND t.expires_at > now()`,
    [tokenHash, purpose]);
  return rows[0];
}

export async function updatePasswordHash(userId, passwordHash) {
  await adminPool.query(
    `UPDATE users SET password_hash = $2, status = 'ACTIVE', updated_at = now()
      WHERE id = $1`, [userId, passwordHash]);
}

/** Single identity behind a presented invite token. Still no org_id argument, still no list. */
export async function describeInvite(tokenHash) {
  const { rows } = await adminPool.query(
    `SELECT o.name AS org_name, u.email, u.name
       FROM one_time_tokens t
       JOIN users u ON u.id = t.user_id
       JOIN organizations o ON o.id = u.org_id
      WHERE t.token_hash = $1 AND t.purpose = 'INVITE'
        AND t.used_at IS NULL AND t.expires_at > now()`, [tokenHash]);
  return rows[0];
}
