import { describe, it, expect } from 'vitest';
import { api } from './helpers/http.js';
import { seedOrg } from './helpers/db.js';
import { makeUser } from './helpers/factories.js';
import { ROLES, USER_STATUS } from '../src/lib/constants.js';

async function anAdmin() {
  const { orgId } = await seedOrg();
  return makeUser({ orgId, role: ROLES.ORG_ADMIN });
}

describe('POST /api/auth/login', () => {
  it('returns an access token, a user, and an httpOnly refresh cookie', async () => {
    const user = await anAdmin();
    const res = await api().post('/api/auth/login')
      .send({ email: user.email, password: user.password });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user).toMatchObject({ id: user.id, role: ROLES.ORG_ADMIN });
    const cookie = res.headers['set-cookie'].join(';');
    expect(cookie).toMatch(/rt=/);
    expect(cookie).toMatch(/HttpOnly/i);
  });

  it('never returns the password hash', async () => {
    const user = await anAdmin();
    const res = await api().post('/api/auth/login')
      .send({ email: user.email, password: user.password });
    expect(JSON.stringify(res.body)).not.toMatch(/password_hash|passwordHash|\$2[aby]\$/);
  });

  it('accepts a differently cased email', async () => {
    const user = await anAdmin();
    const res = await api().post('/api/auth/login')
      .send({ email: user.email.toUpperCase(), password: user.password });
    expect(res.status).toBe(200);
  });

  it('answers 401 for a wrong password', async () => {
    const user = await anAdmin();
    const res = await api().post('/api/auth/login')
      .send({ email: user.email, password: 'nope' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('answers identically for an unknown email, so accounts cannot be enumerated', async () => {
    const user = await anAdmin();
    const wrongPass = await api().post('/api/auth/login')
      .send({ email: user.email, password: 'nope' });
    const noUser = await api().post('/api/auth/login')
      .send({ email: 'ghost@example.com', password: 'nope' });
    expect(noUser.status).toBe(wrongPass.status);
    expect(noUser.body).toEqual(wrongPass.body);
  });

  it('refuses an INVITED user, who has no password yet', async () => {
    const { orgId } = await seedOrg();
    const invited = await makeUser({ orgId, status: USER_STATUS.INVITED });
    const res = await api().post('/api/auth/login')
      .send({ email: invited.email, password: 'anything' });
    expect(res.status).toBe(401);
  });

  it('refuses a REMOVED user', async () => {
    const { orgId } = await seedOrg();
    const removed = await makeUser({ orgId, status: USER_STATUS.REMOVED });
    const res = await api().post('/api/auth/login')
      .send({ email: removed.email, password: removed.password });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/refresh', () => {
  it('exchanges the cookie for a new access token and a new cookie', async () => {
    const user = await anAdmin();
    const login = await api().post('/api/auth/login')
      .send({ email: user.email, password: user.password });

    const res = await api().post('/api/auth/refresh')
      .set('Cookie', login.headers['set-cookie']);

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.headers['set-cookie'].join(';')).not.toBe(login.headers['set-cookie'].join(';'));
  });

  it('answers 401 with no cookie', async () => {
    const res = await api().post('/api/auth/refresh');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the cookie and kills the refresh token', async () => {
    const user = await anAdmin();
    const login = await api().post('/api/auth/login')
      .send({ email: user.email, password: user.password });

    const out = await api().post('/api/auth/logout').set('Cookie', login.headers['set-cookie']);
    expect(out.status).toBe(204);

    const after = await api().post('/api/auth/refresh').set('Cookie', login.headers['set-cookie']);
    expect(after.status).toBe(401);
  });
});
