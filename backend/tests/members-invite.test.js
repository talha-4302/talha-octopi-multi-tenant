// backend/tests/members-invite.test.js
import { describe, it, expect } from 'vitest';
import { api } from './helpers/http.js';
import { seedOrg, getPlan } from './helpers/db.js';
import { makeUser, makeSubscription } from './helpers/factories.js';
import { signAccessToken } from '../src/lib/jwt.js';
import { adminPool } from '../src/db/pool.js';
import { ROLES, USER_STATUS } from '../src/lib/constants.js';

async function org(planName = 'Starter') {   // Starter allows 5 members
  const { orgId } = await seedOrg();
  const plan = await getPlan(planName);
  await makeSubscription({ orgId, plan });
  const admin = await makeUser({ orgId, role: ROLES.ORG_ADMIN });
  return {
    orgId, plan, admin,
    token: signAccessToken({ userId: admin.id, orgId, role: ROLES.ORG_ADMIN }),
  };
}

describe('GET /api/members', () => {
  it('returns the enveloped, paginated list for this org only', async () => {
    const { orgId, token } = await org();
    await makeUser({ orgId });
    const other = await seedOrg({ name: 'Other' });
    await makeUser({ orgId: other.orgId });

    const res = await api().get('/api/members').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toMatchObject({ page: 1, pageSize: 20, total: 2 });
  });

  it('filters by status', async () => {
    const { orgId, token } = await org();
    await makeUser({ orgId, status: USER_STATUS.INVITED });
    const res = await api().get('/api/members?status=INVITED')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].status).toBe(USER_STATUS.INVITED);
  });

  it('rejects an unknown status value rather than ignoring it', async () => {
    const { token } = await org();
    const res = await api().get('/api/members?status=BOGUS').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('caps pageSize at 100', async () => {
    const { token } = await org();
    const res = await api().get('/api/members?pageSize=5000').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('never returns a password hash', async () => {
    const { token } = await org();
    const res = await api().get('/api/members').set('Authorization', `Bearer ${token}`);
    expect(res.text).not.toMatch(/\$2[aby]\$/);
  });
});

describe('POST /api/members', () => {
  it('creates an INVITED user with no password and logs the notification', async () => {
    const { orgId, token } = await org();
    const res = await api().post('/api/members').set('Authorization', `Bearer ${token}`)
      .send({ email: 'invited@example.com', name: 'Invited Person', role: ROLES.ORG_MEMBER });

    expect(res.status).toBe(201);
    const { rows } = await adminPool.query(
      `SELECT * FROM notifications_log WHERE org_id = $1 AND kind = 'MEMBER_INVITED'`, [orgId]);
    expect(rows).toHaveLength(1);
    expect(rows[0].recipient_email).toBe('invited@example.com');
  });

  it('creates an INVITED user with no password', async () => {
    const { token } = await org();
    const res = await api().post('/api/members').set('Authorization', `Bearer ${token}`)
      .send({ email: 'New.Person@Example.com', name: 'New Person', role: ROLES.ORG_MEMBER });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ email: 'new.person@example.com', status: USER_STATUS.INVITED });

    const { rows } = await adminPool.query(
      `SELECT password_hash FROM users WHERE email = 'new.person@example.com'`);
    expect(rows[0].password_hash).toBeNull();
  });

  it('answers 409 ALREADY_A_MEMBER for an active member of this org', async () => {
    const { orgId, token } = await org();
    const existing = await makeUser({ orgId });
    const res = await api().post('/api/members').set('Authorization', `Bearer ${token}`)
      .send({ email: existing.email, name: 'Dup', role: ROLES.ORG_MEMBER });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_A_MEMBER');
  });

  it('reactivates a REMOVED member rather than colliding on the unique email', async () => {
    const { orgId, token } = await org();
    const gone = await makeUser({ orgId, status: USER_STATUS.REMOVED });
    const res = await api().post('/api/members').set('Authorization', `Bearer ${token}`)
      .send({ email: gone.email, name: 'Back Again', role: ROLES.ORG_MEMBER });

    expect(res.status).toBe(201);
    const { rows } = await adminPool.query(
      `SELECT id, status, password_hash FROM users WHERE email = $1`, [gone.email]);
    expect(rows).toHaveLength(1);              // one row per person, audit trail intact
    expect(rows[0].id).toBe(gone.id);
    expect(rows[0].status).toBe(USER_STATUS.INVITED);
    expect(rows[0].password_hash).toBeNull();
  });

  it('answers 409 EMAIL_IN_USE for an address held by another org, not ALREADY_A_MEMBER', async () => {
    const { token } = await org();
    const other = await seedOrg({ name: 'Other' });
    const theirs = await makeUser({ orgId: other.orgId });

    const res = await api().post('/api/members').set('Authorization', `Bearer ${token}`)
      .send({ email: theirs.email, name: 'Poach', role: ROLES.ORG_MEMBER });

    expect(res.status).toBe(409);
    // ALREADY_A_MEMBER here would confirm the address belongs to some other tenant.
    expect(res.body.error.code).toBe('EMAIL_IN_USE');
  });

  it('answers 409 SEAT_LIMIT_REACHED at the plan limit', async () => {
    const { orgId, token } = await org('Starter');   // max_members 5, one admin exists
    for (let i = 0; i < 4; i += 1) await makeUser({ orgId });

    const res = await api().post('/api/members').set('Authorization', `Bearer ${token}`)
      .send({ email: 'sixth@example.com', name: 'Sixth', role: ROLES.ORG_MEMBER });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SEAT_LIMIT_REACHED');
  });

  it('refuses a member trying to invite', async () => {
    const { orgId } = await org();
    const member = await makeUser({ orgId, role: ROLES.ORG_MEMBER });
    const t = signAccessToken({ userId: member.id, orgId, role: ROLES.ORG_MEMBER });
    const res = await api().post('/api/members').set('Authorization', `Bearer ${t}`)
      .send({ email: 'x@example.com', name: 'X', role: ROLES.ORG_MEMBER });
    expect(res.status).toBe(403);
  });

  it('refuses PLATFORM_ADMIN as an invitable role', async () => {
    const { token } = await org();
    const res = await api().post('/api/members').set('Authorization', `Bearer ${token}`)
      .send({ email: 'x@example.com', name: 'X', role: ROLES.PLATFORM_ADMIN });
    expect(res.status).toBe(400);
  });
});
