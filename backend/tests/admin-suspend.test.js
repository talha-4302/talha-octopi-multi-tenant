import { describe, it, expect } from 'vitest';
import { api } from './helpers/http.js';
import { adminPool } from '../src/db/pool.js';
import { seedOrg, getPlan } from './helpers/db.js';
import { makeUser, makeSubscription } from './helpers/factories.js';
import { signAccessToken } from '../src/lib/jwt.js';
import { ROLES, ORG_STATUS } from '../src/lib/constants.js';

async function platformToken() {
  const u = await makeUser({ orgId: null, role: ROLES.PLATFORM_ADMIN });
  return signAccessToken({ userId: u.id, orgId: null, role: ROLES.PLATFORM_ADMIN });
}

describe('POST /api/admin/orgs/:orgId/suspend', () => {
  it('sets SUSPENDED and records the reason', async () => {
    const { orgId } = await seedOrg({ status: ORG_STATUS.ACTIVE });
    const res = await api().post(`/api/admin/orgs/${orgId}/suspend`)
      .set('Authorization', `Bearer ${await platformToken()}`)
      .send({ reason: 'Chargeback investigation' });

    expect(res.status).toBe(200);
    const { rows } = await adminPool.query('SELECT * FROM organizations WHERE id = $1', [orgId]);
    expect(rows[0].status).toBe(ORG_STATUS.SUSPENDED);
    expect(rows[0].suspended_reason).toBe('Chargeback investigation');
  });

  it('kills every live session in that organization at once', async () => {
    const { orgId } = await seedOrg({ status: ORG_STATUS.ACTIVE });
    await makeSubscription({ orgId, plan: await getPlan('Pro') });
    const member = await makeUser({ orgId, role: ROLES.ORG_MEMBER });
    const login = await api().post('/api/auth/login')
      .send({ email: member.email, password: member.password });

    await api().post(`/api/admin/orgs/${orgId}/suspend`)
      .set('Authorization', `Bearer ${await platformToken()}`).send({ reason: 'Abuse' });

    const after = await api().post('/api/auth/refresh').set('Cookie', login.headers['set-cookie']);
    expect(after.status).toBe(401);
  });

  it('requires a reason', async () => {
    const { orgId } = await seedOrg();
    const res = await api().post(`/api/admin/orgs/${orgId}/suspend`)
      .set('Authorization', `Bearer ${await platformToken()}`).send({});
    expect(res.status).toBe(400);
  });

  it('refuses an ORG_ADMIN, who cannot suspend anything including their own org', async () => {
    const { orgId } = await seedOrg();
    const admin = await makeUser({ orgId, role: ROLES.ORG_ADMIN });
    const t = signAccessToken({ userId: admin.id, orgId, role: ROLES.ORG_ADMIN });
    expect((await api().post(`/api/admin/orgs/${orgId}/suspend`)
      .set('Authorization', `Bearer ${t}`).send({ reason: 'x' })).status).toBe(403);
  });
});

describe('POST /api/admin/orgs/:orgId/reactivate', () => {
  it('restores ACTIVE and clears the reason', async () => {
    const { orgId } = await seedOrg({ status: ORG_STATUS.SUSPENDED });
    await adminPool.query(
      `UPDATE organizations SET suspended_reason = 'Abuse' WHERE id = $1`, [orgId]);

    const res = await api().post(`/api/admin/orgs/${orgId}/reactivate`)
      .set('Authorization', `Bearer ${await platformToken()}`).send({});

    expect(res.status).toBe(204);
    const { rows } = await adminPool.query('SELECT * FROM organizations WHERE id = $1', [orgId]);
    expect(rows[0].status).toBe(ORG_STATUS.ACTIVE);
    expect(rows[0].suspended_reason).toBeNull();
  });

  it('answers 404 for an unknown organization', async () => {
    const res = await api().post('/api/admin/orgs/00000000-0000-0000-0000-000000000000/reactivate')
      .set('Authorization', `Bearer ${await platformToken()}`).send({});
    expect(res.status).toBe(404);
  });
});
