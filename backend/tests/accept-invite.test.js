import { describe, it, expect } from 'vitest';
import { api } from './helpers/http.js';
import { seedOrg } from './helpers/db.js';
import { makeUser } from './helpers/factories.js';
import { createOneTimeToken } from '../src/modules/auth/tokens/one-time.repository.js';
import { TOKEN_PURPOSE, USER_STATUS } from '../src/lib/constants.js';

async function anInvite() {
  const { orgId } = await seedOrg({ name: 'Acme' });
  const user = await makeUser({ orgId, status: USER_STATUS.INVITED, name: 'Ada' });
  const token = await createOneTimeToken({
    userId: user.id, purpose: TOKEN_PURPOSE.INVITE, ttlMs: 7 * 24 * 3600_000 });
  return { user, token, orgId };
}

describe('GET /api/auth/invite/:token', () => {
  it('describes the invitation so the page can render it', async () => {
    const { user, token } = await anInvite();
    const res = await api().get(`/api/auth/invite/${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ orgName: 'Acme', email: user.email, name: 'Ada' });
  });

  it('answers 400 for an unknown token', async () => {
    const res = await api().get('/api/auth/invite/nonsense');
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/accept-invite', () => {
  it('sets the password, activates the user, and lets them log in', async () => {
    const { user, token } = await anInvite();
    const res = await api().post('/api/auth/accept-invite')
      .send({ token, password: 'MyFirstPass1!' });
    expect(res.status).toBe(204);

    const login = await api().post('/api/auth/login')
      .send({ email: user.email, password: 'MyFirstPass1!' });
    expect(login.status).toBe(200);
    expect(login.body.user.orgId).toBe(user.orgId);
  });

  it('is single use', async () => {
    const { token } = await anInvite();
    await api().post('/api/auth/accept-invite').send({ token, password: 'MyFirstPass1!' });
    const again = await api().post('/api/auth/accept-invite')
      .send({ token, password: 'Different1!' });
    expect(again.status).toBe(400);
  });

  it('rejects a password shorter than eight characters', async () => {
    const { token } = await anInvite();
    const res = await api().post('/api/auth/accept-invite').send({ token, password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.fields.password).toBeTruthy();
  });
});
