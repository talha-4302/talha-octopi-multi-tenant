// backend/tests/authorization.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { api } from './helpers/http.js';
import { seedOrg, getPlan } from './helpers/db.js';
import { makeUser, makeSubscription } from './helpers/factories.js';
import { signAccessToken } from '../src/lib/jwt.js';
import { ROLES } from '../src/lib/constants.js';

// One row per (method, path). Each names the ONLY roles the matrix permits.
const ORG_SCOPED = [
  { method: 'get',    path: '/api/org',            allow: [ROLES.ORG_ADMIN, ROLES.ORG_MEMBER] },
  { method: 'patch',  path: '/api/org',            allow: [ROLES.ORG_ADMIN] },
  { method: 'get',    path: '/api/members',        allow: [ROLES.ORG_ADMIN] },
  { method: 'post',   path: '/api/members',        allow: [ROLES.ORG_ADMIN] },
  { method: 'get',    path: '/api/subscription',   allow: [ROLES.ORG_ADMIN] },
  { method: 'get',    path: '/api/transactions',   allow: [ROLES.ORG_ADMIN] },
];

let ctx;
beforeEach(async () => {
  const { orgId } = await seedOrg();
  await makeSubscription({ orgId, plan: await getPlan('Pro') });
  const admin = await makeUser({ orgId, role: ROLES.ORG_ADMIN });
  const member = await makeUser({ orgId, role: ROLES.ORG_MEMBER });
  const platform = await makeUser({ orgId: null, role: ROLES.PLATFORM_ADMIN });
  ctx = {
    [ROLES.ORG_ADMIN]: signAccessToken({ userId: admin.id, orgId, role: ROLES.ORG_ADMIN }),
    [ROLES.ORG_MEMBER]: signAccessToken({ userId: member.id, orgId, role: ROLES.ORG_MEMBER }),
    [ROLES.PLATFORM_ADMIN]: signAccessToken({
      userId: platform.id, orgId: null, role: ROLES.PLATFORM_ADMIN }),
  };
});

describe('the permission matrix, enforced server side', () => {
  for (const route of ORG_SCOPED) {
    for (const role of Object.values(ROLES)) {
      const permitted = route.allow.includes(role);
      it(`${role} ${permitted ? 'may' : 'may NOT'} ${route.method.toUpperCase()} ${route.path}`,
        async () => {
          const res = await api()[route.method](route.path)
            .set('Authorization', `Bearer ${ctx[role]}`).send({});
          if (permitted) expect(res.status).not.toBe(403);
          else expect(res.status).toBe(403);
        });
    }
  }

  it('answers 401, never 403, when no token is presented', async () => {
    for (const route of ORG_SCOPED) {
      const res = await api()[route.method](route.path).send({});
      expect(res.status, `${route.method} ${route.path}`).toBe(401);
    }
  });

  it('refuses a PLATFORM_ADMIN on every org scoped route with a clean 403', async () => {
    for (const route of ORG_SCOPED) {
      const res = await api()[route.method](route.path)
        .set('Authorization', `Bearer ${ctx[ROLES.PLATFORM_ADMIN]}`).send({});
      // Not a 500 from a NULL org_id reaching withTenant.
      expect(res.status, `${route.method} ${route.path}`).toBe(403);
    }
  });
});
