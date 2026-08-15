// backend/tests/members-manage.test.js
import { describe, it, expect } from 'vitest';
import { api } from './helpers/http.js';
import { seedOrg, getPlan } from './helpers/db.js';
import { makeUser, makeSubscription } from './helpers/factories.js';
import { signAccessToken } from '../src/lib/jwt.js';
import { adminPool } from '../src/db/pool.js';
import { ROLES, USER_STATUS } from '../src/lib/constants.js';

async function org() {
  const { orgId } = await seedOrg();
  await makeSubscription({ orgId, plan: await getPlan('Pro') });
  const admin = await makeUser({ orgId, role: ROLES.ORG_ADMIN });
  return { orgId, admin, token: signAccessToken({ userId: admin.id, orgId, role: ROLES.ORG_ADMIN }) };
}

describe('PATCH /api/members/:id', () => {
  it('promotes a member to admin', async () => {
    const { orgId, token } = await org();
    const m = await makeUser({ orgId, role: ROLES.ORG_MEMBER });
    const res = await api().patch(`/api/members/${m.id}`)
      .set('Authorization', `Bearer ${token}`).send({ role: ROLES.ORG_ADMIN });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe(ROLES.ORG_ADMIN);
  });

  it('refuses to demote the last admin', async () => {
    const { admin, token } = await org();
    const res = await api().patch(`/api/members/${admin.id}`)
      .set('Authorization', `Bearer ${token}`).send({ role: ROLES.ORG_MEMBER });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('LAST_ADMIN');
  });

  it('allows demoting an admin when a second one exists', async () => {
    const { orgId, admin, token } = await org();
    await makeUser({ orgId, role: ROLES.ORG_ADMIN });
    const res = await api().patch(`/api/members/${admin.id}`)
      .set('Authorization', `Bearer ${token}`).send({ role: ROLES.ORG_MEMBER });
    expect(res.status).toBe(200);
  });

  it('answers 404 for a member of another organization', async () => {
    const { token } = await org();
    const other = await seedOrg({ name: 'Other' });
    const theirs = await makeUser({ orgId: other.orgId });

    const res = await api().patch(`/api/members/${theirs.id}`)
      .set('Authorization', `Bearer ${token}`).send({ role: ROLES.ORG_ADMIN });

    // 404 not 403: a 403 would confirm the row exists somewhere.
    expect(res.status).toBe(404);
    const { rows } = await adminPool.query('SELECT role FROM users WHERE id = $1', [theirs.id]);
    expect(rows[0].role).toBe(ROLES.ORG_MEMBER);
  });

  it('rejects a bad uuid in the path with 400, not 500', async () => {
    const { token } = await org();
    const res = await api().patch('/api/members/not-a-uuid')
      .set('Authorization', `Bearer ${token}`).send({ role: ROLES.ORG_ADMIN });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/members/:id', () => {
  it('marks the member REMOVED and keeps the row for audit', async () => {
    const { orgId, token } = await org();
    const m = await makeUser({ orgId });
    const res = await api().delete(`/api/members/${m.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);

    const { rows } = await adminPool.query('SELECT status FROM users WHERE id = $1', [m.id]);
    expect(rows[0].status).toBe(USER_STATUS.REMOVED);
  });

  it('revokes the removed member refresh tokens immediately', async () => {
    const { orgId, token } = await org();
    const m = await makeUser({ orgId });
    const login = await api().post('/api/auth/login').send({ email: m.email, password: m.password });

    await api().delete(`/api/members/${m.id}`).set('Authorization', `Bearer ${token}`);

    const after = await api().post('/api/auth/refresh').set('Cookie', login.headers['set-cookie']);
    expect(after.status).toBe(401);
  });

  it('refuses to remove the last admin', async () => {
    const { admin, token } = await org();
    const res = await api().delete(`/api/members/${admin.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('LAST_ADMIN');
  });

  it('answers 404 for a member of another organization', async () => {
    const { token } = await org();
    const other = await seedOrg({ name: 'Other' });
    const theirs = await makeUser({ orgId: other.orgId });
    const res = await api().delete(`/api/members/${theirs.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
