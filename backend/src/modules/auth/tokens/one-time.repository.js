// one_time_tokens has RLS off, so appPool is correct here.
import { appPool } from '../../../db/pool.js';
import { randomToken } from '../../../lib/tokens.js';

export async function invalidateUnused(userId, purpose) {
  await appPool.query(
    `UPDATE one_time_tokens SET used_at = now()
      WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL`, [userId, purpose]);
}

/** Returns the RAW token. Only its hash is stored. */
export async function createOneTimeToken({ userId, purpose, ttlMs }) {
  await invalidateUnused(userId, purpose);
  const { raw, hash } = randomToken();
  await appPool.query(
    `INSERT INTO one_time_tokens (user_id, purpose, token_hash, expires_at)
     VALUES ($1,$2,$3,$4)`,
    [userId, purpose, hash, new Date(Date.now() + ttlMs)]);
  return raw;
}

export async function consume(tokenId) {
  const { rowCount } = await appPool.query(
    `UPDATE one_time_tokens SET used_at = now() WHERE id = $1 AND used_at IS NULL`, [tokenId]);
  return rowCount === 1;   // false means someone else spent it first
}
