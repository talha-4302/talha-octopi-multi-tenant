// refresh_tokens has RLS off, keyed by user and reached only by presenting a token.
// Uses appPool because this table is not governed by a tenant policy.
import { appPool } from '../../db/pool.js';

export async function insert({ userId, tokenHash, familyId, expiresAt }) {
  await appPool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at)
     VALUES ($1,$2,$3,$4)`, [userId, tokenHash, familyId, expiresAt]);
}

/** @returns {Promise<{id,user_id,family_id,expires_at,revoked_at}|undefined>} */
export async function findByHash(tokenHash) {
  const { rows } = await appPool.query(
    `SELECT id, user_id, family_id, expires_at, revoked_at
       FROM refresh_tokens WHERE token_hash = $1`, [tokenHash]);
  return rows[0];
}

export async function revokeById(id) {
  await appPool.query(
    `UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL`, [id]);
}

export async function revokeFamily(familyId) {
  await appPool.query(
    `UPDATE refresh_tokens SET revoked_at = now()
      WHERE family_id = $1 AND revoked_at IS NULL`, [familyId]);
}

export async function revokeAllForUser(userId) {
  await appPool.query(
    `UPDATE refresh_tokens SET revoked_at = now()
      WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);
}

export async function revokeAllForOrg(orgId) {
  await appPool.query(
    `UPDATE refresh_tokens SET revoked_at = now()
      WHERE revoked_at IS NULL
        AND user_id IN (SELECT id FROM users WHERE org_id = $1)`, [orgId]);
}
