import { describe, it, expect } from 'vitest';
import { api } from './helpers/http.js';
import { seedOrg } from './helpers/db.js';
import { makeUser } from './helpers/factories.js';
import { adminPool } from '../src/db/pool.js';
import { createOneTimeToken } from '../src/modules/auth/tokenRepository.js';
import { TOKEN_PURPOSE, ROLES } from '../src/lib/constants.js';

async function anAdmin() {
  const { orgId } = await seedOrg();
  return makeUser({ orgId, role: ROLES.ORG_ADMIN });
}

describe('POST /api/auth/forgot-password', () => {
  it('answers 202 for a known address', async () => {
    const user = await anAdmin();
    const res = await api().post('/api/auth/forgot-password').send({ email: user.email });
    expect(res.status).toBe(202);
  });

  it('answers identically for an unknown address', async () => {
    const user = await anAdmin();
    const known = await api().post('/api/auth/forgot-password').send({ email: user.email });
    const unknown = await api().post('/api/auth/forgot-password').send({ email: 'ghost@example.com' });
    expect(unknown.status).toBe(known.status);
    expect(unknown.body).toEqual(known.body);
  });

  it('invalidates any prior unused reset token for that user', async () => {
    const user = await anAdmin();
    await api().post('/api/auth/forgot-password').send({ email: user.email });
    await api().post('/api/auth/forgot-password').send({ email: user.email });
    const { rows } = await adminPool.query(
      `SELECT count(*)::int AS live FROM one_time_tokens
        WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL`,
      [user.id, TOKEN_PURPOSE.PASSWORD_RESET]);
    expect(rows[0].live).toBe(1);
  });
});

describe('POST /api/auth/reset-password', () => {
  it('sets the new password and lets the user log in with it', async () => {
    const user = await anAdmin();
    const raw = await createOneTimeToken({
      userId: user.id, purpose: TOKEN_PURPOSE.PASSWORD_RESET, ttlMs: 3600_000 });

    const res = await api().post('/api/auth/reset-password')
      .send({ token: raw, password: 'BrandNewPass1!' });
    expect(res.status).toBe(204);

    const login = await api().post('/api/auth/login')
      .send({ email: user.email, password: 'BrandNewPass1!' });
    expect(login.status).toBe(200);
  });

  it('is single use', async () => {
    const user = await anAdmin();
    const raw = await createOneTimeToken({
      userId: user.id, purpose: TOKEN_PURPOSE.PASSWORD_RESET, ttlMs: 3600_000 });
    await api().post('/api/auth/reset-password').send({ token: raw, password: 'BrandNewPass1!' });
    const second = await api().post('/api/auth/reset-password')
      .send({ token: raw, password: 'AnotherPass1!' });
    expect(second.status).toBe(400);
  });

  it('rejects an expired token', async () => {
    const user = await anAdmin();
    const raw = await createOneTimeToken({
      userId: user.id, purpose: TOKEN_PURPOSE.PASSWORD_RESET, ttlMs: -1000 });
    const res = await api().post('/api/auth/reset-password')
      .send({ token: raw, password: 'BrandNewPass1!' });
    expect(res.status).toBe(400);
  });

  it('revokes every refresh family, so a stolen session dies with the reset', async () => {
    const user = await anAdmin();
    const login = await api().post('/api/auth/login')
      .send({ email: user.email, password: user.password });
    const raw = await createOneTimeToken({
      userId: user.id, purpose: TOKEN_PURPOSE.PASSWORD_RESET, ttlMs: 3600_000 });

    await api().post('/api/auth/reset-password').send({ token: raw, password: 'BrandNewPass1!' });

    const after = await api().post('/api/auth/refresh').set('Cookie', login.headers['set-cookie']);
    expect(after.status).toBe(401);
  });
});
