// backend/tests/subscription-read.test.js
import { describe, it, expect } from 'vitest';
import { api } from './helpers/http.js';
import { seedOrg, getPlan } from './helpers/db.js';
import { makeUser, makeSubscription } from './helpers/factories.js';
import { signAccessToken } from '../src/lib/jwt.js';
import { ROLES, ORG_STATUS, SUBSCRIPTION_STATUS } from '../src/lib/constants.js';

async function org({ orgStatus = ORG_STATUS.ACTIVE, subStatus = SUBSCRIPTION_STATUS.ACTIVE } = {}) {
  const { orgId } = await seedOrg({ status: orgStatus });
  const plan = await getPlan('Starter');
  await makeSubscription({ orgId, plan, status: subStatus });
  const admin = await makeUser({ orgId, role: ROLES.ORG_ADMIN });
  return { orgId, token: signAccessToken({ userId: admin.id, orgId, role: ROLES.ORG_ADMIN }) };
}

describe('GET /api/subscription', () => {
  it('returns plan, period end, cancel flag, and seat usage', async () => {
    const { orgId, token } = await org();
    await makeUser({ orgId });     // a second seat

    const res = await api().get('/api/subscription').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: SUBSCRIPTION_STATUS.ACTIVE,
      planName: 'Starter',
      cancelAtPeriodEnd: false,
      seatsUsed: 2,
      seatLimit: 5,
    });
    expect(res.body.currentPeriodEnd).toBeTruthy();
  });

  it('is readable by a SUSPENDED org admin, so they can see why', async () => {
    const { token } = await org({ orgStatus: ORG_STATUS.SUSPENDED });
    expect((await api().get('/api/subscription').set('Authorization', `Bearer ${token}`)).status).toBe(200);
  });

  it('is readable by a PENDING org admin, which the checkout success page polls', async () => {
    const { token } = await org({
      orgStatus: ORG_STATUS.PENDING, subStatus: SUBSCRIPTION_STATUS.PENDING });
    const res = await api().get('/api/subscription').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe(SUBSCRIPTION_STATUS.PENDING);
  });

  it('answers 404 when no live subscription exists', async () => {
    const { orgId } = await seedOrg();
    const admin = await makeUser({ orgId, role: ROLES.ORG_ADMIN });
    const t = signAccessToken({ userId: admin.id, orgId, role: ROLES.ORG_ADMIN });
    expect((await api().get('/api/subscription').set('Authorization', `Bearer ${t}`)).status).toBe(404);
  });

  it('refuses a member', async () => {
    const { orgId } = await org();
    const m = await makeUser({ orgId, role: ROLES.ORG_MEMBER });
    const t = signAccessToken({ userId: m.id, orgId, role: ROLES.ORG_MEMBER });
    expect((await api().get('/api/subscription').set('Authorization', `Bearer ${t}`)).status).toBe(403);
  });
});
