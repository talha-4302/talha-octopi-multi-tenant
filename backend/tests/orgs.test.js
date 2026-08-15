// backend/tests/orgs.test.js
import { describe, it, expect } from 'vitest';
import { api } from './helpers/http.js';
import { seedOrg, getPlan } from './helpers/db.js';
import { makeUser, makeSubscription } from './helpers/factories.js';
import { signAccessToken } from '../src/lib/jwt.js';
import { ROLES, ORG_STATUS } from '../src/lib/constants.js';

async function org(status = ORG_STATUS.ACTIVE) {
  const { orgId } = await seedOrg({ name: 'Acme', status });
  const plan = await getPlan('Pro');
  await makeSubscription({ orgId, plan });
  const admin = await makeUser({ orgId, role: ROLES.ORG_ADMIN });
  const member = await makeUser({ orgId, role: ROLES.ORG_MEMBER });
  return {
    orgId,
    adminToken: signAccessToken({ userId: admin.id, orgId, role: ROLES.ORG_ADMIN }),
    memberToken: signAccessToken({ userId: member.id, orgId, role: ROLES.ORG_MEMBER }),
  };
}

describe('GET /api/org', () => {
  it('gives an admin the full profile', async () => {
    const { adminToken } = await org();
    const res = await api().get('/api/org').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Acme', planName: 'Pro', status: ORG_STATUS.ACTIVE });
    expect(res.body.billingEmail).toBeTruthy();
  });

  it('gives a member name, plan, and status only', async () => {
    const { memberToken } = await org();
    const res = await api().get('/api/org').set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['name', 'planName', 'status']);
  });

  it('leaks no billing detail to a member, checked against the raw body', async () => {
    const { memberToken } = await org();
    const res = await api().get('/api/org').set('Authorization', `Bearer ${memberToken}`);
    expect(res.text).not.toMatch(/billing|contact/i);
  });

  it('works for a SUSPENDED org, because the tier is ANY', async () => {
    const { adminToken } = await org(ORG_STATUS.SUSPENDED);
    expect((await api().get('/api/org').set('Authorization', `Bearer ${adminToken}`)).status).toBe(200);
  });
});

describe('PATCH /api/org', () => {
  it('updates name, contact email, and billing email', async () => {
    const { adminToken } = await org();
    const res = await api().patch('/api/org').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Acme Inc', contactEmail: 'hi@acme.test', billingEmail: 'ap@acme.test' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Acme Inc', billingEmail: 'ap@acme.test' });
  });

  it('refuses a member', async () => {
    const { memberToken } = await org();
    const res = await api().patch('/api/org').set('Authorization', `Bearer ${memberToken}`)
      .send({ name: 'Hijack' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
  });

  it('refuses a SUSPENDED org with ORG_NOT_ACTIVE', async () => {
    const { adminToken } = await org(ORG_STATUS.SUSPENDED);
    const res = await api().patch('/api/org').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Nope' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ORG_NOT_ACTIVE');
  });

  it('rejects a malformed billing email with a field error', async () => {
    const { adminToken } = await org();
    const res = await api().patch('/api/org').set('Authorization', `Bearer ${adminToken}`)
      .send({ billingEmail: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.error.fields.billingEmail).toBeTruthy();
  });
});
