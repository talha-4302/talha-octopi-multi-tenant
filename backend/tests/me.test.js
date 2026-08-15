import { describe, it, expect } from 'vitest';
import { api } from './helpers/http.js';
import { seedOrg } from './helpers/db.js';
import { makeUser } from './helpers/factories.js';
import { signAccessToken } from '../src/lib/jwt.js';
import { ROLES, ORG_STATUS } from '../src/lib/constants.js';

async function member(status = ORG_STATUS.ACTIVE) {
  const { orgId } = await seedOrg({ status });
  const user = await makeUser({ orgId, role: ROLES.ORG_MEMBER, name: 'Ada' });
  const token = signAccessToken({ userId: user.id, orgId, role: ROLES.ORG_MEMBER });
  return { user, token };
}

describe('GET /api/me', () => {
  it('returns the caller profile without a password hash', async () => {
    const { user, token } = await member();
    const res = await api().get('/api/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: user.id, name: 'Ada', role: ROLES.ORG_MEMBER });
    expect(JSON.stringify(res.body)).not.toMatch(/\$2[aby]\$/);
  });

  it('works for a SUSPENDED organization, because the tier is ANY', async () => {
    const { token } = await member(ORG_STATUS.SUSPENDED);
    expect((await api().get('/api/me').set('Authorization', `Bearer ${token}`)).status).toBe(200);
  });
});

describe('PATCH /api/me', () => {
  it('changes the name', async () => {
    const { token } = await member();
    const res = await api().patch('/api/me')
      .set('Authorization', `Bearer ${token}`).send({ name: 'Ada Lovelace' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Ada Lovelace');
  });

  it('ignores an attempt to change email or role', async () => {
    const { user, token } = await member();
    const res = await api().patch('/api/me').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Ada', email: 'hijack@example.com', role: ROLES.PLATFORM_ADMIN });
    expect(res.body.email).toBe(user.email);
    expect(res.body.role).toBe(ROLES.ORG_MEMBER);
  });
});

describe('POST /api/me/password', () => {
  it('changes the password when the current one is correct', async () => {
    const { user, token } = await member();
    const res = await api().post('/api/me/password').set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: user.password, newPassword: 'EvenBetter1!' });
    expect(res.status).toBe(204);

    const login = await api().post('/api/auth/login')
      .send({ email: user.email, password: 'EvenBetter1!' });
    expect(login.status).toBe(200);
  });

  it('refuses a wrong current password', async () => {
    const { token } = await member();
    const res = await api().post('/api/me/password').set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'wrong', newPassword: 'EvenBetter1!' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });
});
