import { randomBytes, createHash } from 'node:crypto';

export const hashToken = (raw) => createHash('sha256').update(raw).digest('hex');

// The raw token is returned to the caller once and never stored.
// A database leak yields only hashes, which are not usable as tokens.
export function randomToken() {
  const raw = randomBytes(32).toString('base64url');
  return { raw, hash: hashToken(raw) };
}
