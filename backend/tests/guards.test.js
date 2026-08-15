import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { authenticate } from '../src/middleware/authenticate.js';
import { authorize } from '../src/middleware/authorize.js';
import { requireOrgStatus } from '../src/middleware/requireOrgStatus.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { signAccessToken } from '../src/lib/jwt.js';
import { seedOrg } from './helpers/db.js';
import { makeUser } from './helpers/factories.js';
import { ROLES, ORG_STATUS, ORG_GATE } from '../src/lib/constants.js';

const app = express();
app.get('/admin-only', authenticate, authorize(ROLES.ORG_ADMIN), (req, res) => res.sendStatus(200));
app.get('/operating', authenticate, requireOrgStatus(...ORG_GATE.OPERATING),
  authorize(ROLES.ORG_ADMIN), (req, res) => res.sendStatus(200));
app.get('/billable', authenticate, requireOrgStatus(...ORG_GATE.BILLABLE),
  authorize(ROLES.ORG_ADMIN), (req, res) => res.sendStatus(200));
app.use(errorHandler);

async function tokenFor(status, role = ROLES.ORG_ADMIN) {
  const { orgId } = await seedOrg({ status });
  const user = await makeUser({ orgId, role });
  return signAccessToken({ userId: user.id, orgId, role });
}

describe('authorize', () => {
  it('lets a permitted role through', async () => {
    const t = await tokenFor(ORG_STATUS.ACTIVE, ROLES.ORG_ADMIN);
    expect((await request(app).get('/admin-only').set('Authorization', `Bearer ${t}`)).status).toBe(200);
  });

  it('answers 403 FORBIDDEN_ROLE for a wrong role', async () => {
    const t = await tokenFor(ORG_STATUS.ACTIVE, ROLES.ORG_MEMBER);
    const res = await request(app).get('/admin-only').set('Authorization', `Bearer ${t}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
  });

  it('answers 401 with no token, never 403', async () => {
    expect((await request(app).get('/admin-only')).status).toBe(401);
  });
});

describe('requireOrgStatus', () => {
  it('lets an ACTIVE org through the OPERATING tier', async () => {
    const t = await tokenFor(ORG_STATUS.ACTIVE);
    expect((await request(app).get('/operating').set('Authorization', `Bearer ${t}`)).status).toBe(200);
  });

  it('lets a CANCELLED org through, because access runs to period end', async () => {
    const t = await tokenFor(ORG_STATUS.CANCELLED);
    expect((await request(app).get('/operating').set('Authorization', `Bearer ${t}`)).status).toBe(200);
  });

  it('blocks a PENDING org from OPERATING but allows BILLABLE', async () => {
    const t = await tokenFor(ORG_STATUS.PENDING);
    const blocked = await request(app).get('/operating').set('Authorization', `Bearer ${t}`);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('ORG_NOT_ACTIVE');
    expect((await request(app).get('/billable').set('Authorization', `Bearer ${t}`)).status).toBe(200);
  });

  it('blocks a SUSPENDED org from BILLABLE too', async () => {
    const t = await tokenFor(ORG_STATUS.SUSPENDED);
    expect((await request(app).get('/billable').set('Authorization', `Bearer ${t}`)).status).toBe(403);
  });

  it('rejects a PLATFORM_ADMIN, who has no organization to gate', async () => {
    const admin = await makeUser({ orgId: null, role: ROLES.PLATFORM_ADMIN });
    const t = signAccessToken({ userId: admin.id, orgId: null, role: ROLES.PLATFORM_ADMIN });
    const res = await request(app).get('/operating').set('Authorization', `Bearer ${t}`);
    expect(res.status).toBe(403);
  });
});
