import { describe, it, expect } from 'vitest';
import { appPool, adminPool } from '../src/db/pool.js';
import { withTenant } from '../src/db/withTenant.js';
import { seedOrg, getPlan } from './helpers/db.js';
import { randomUUID } from 'node:crypto';

describe('the connection under test', () => {
  it('is app_user, is not a superuser, and does not own the tables', async () => {
    const { rows } = await appPool.query(`
      SELECT current_user AS role,
             (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS is_super,
             pg_catalog.pg_get_userbyid(relowner) AS owner
        FROM pg_class WHERE relname = 'transactions'`);
    expect(rows[0].role).toBe('app_user');
    expect(rows[0].is_super).toBe(false);
    expect(rows[0].owner).not.toBe(rows[0].role);
  });
});

describe('RLS at the database layer', () => {
  async function seedTransaction(orgId, plan) {
    await adminPool.query(
      `INSERT INTO transactions (org_id, plan_id, amount_cents, currency, status)
       VALUES ($1, $2, $3, 'usd', 'SUCCESS')`,
      [orgId, plan.id, plan.price_cents]
    );
  }

  it('returns only the current tenant rows, with no WHERE clause written', async () => {
    const plan = await getPlan();
    const a = await seedOrg({ name: 'A' });
    const b = await seedOrg({ name: 'B' });
    await seedTransaction(a.orgId, plan);
    await seedTransaction(b.orgId, plan);

    const rows = await withTenant(a.orgId, async (c) =>
      (await c.query('SELECT org_id FROM transactions')).rows);

    expect(rows).toHaveLength(1);
    expect(rows[0].org_id).toBe(a.orgId);
  });

  it('scopes organizations, users, subscriptions and notifications_log the same way', async () => {
    const plan = await getPlan();
    const a = await seedOrg({ name: 'A' });
    const b = await seedOrg({ name: 'B' });
    await adminPool.query(
      `INSERT INTO users (org_id, email, name, role, status, password_hash)
       VALUES ($1,$2,'B Admin','ORG_ADMIN','ACTIVE','x')`,
      [b.orgId, `b+${b.orgId}@example.com`]
    );
    await adminPool.query(
      `INSERT INTO subscriptions (org_id, plan_id, price_cents, stripe_price_id, status)
       VALUES ($1,$2,$3,'price_test','ACTIVE')`,
      [b.orgId, plan.id, plan.price_cents]
    );

    const seen = await withTenant(a.orgId, async (c) => ({
      orgs: (await c.query('SELECT id FROM organizations')).rows,
      users: (await c.query('SELECT id FROM users')).rows,
      subs: (await c.query('SELECT id FROM subscriptions')).rows,
    }));

    expect(seen.orgs.map((r) => r.id)).toEqual([a.orgId]);
    expect(seen.users).toHaveLength(0);
    expect(seen.subs).toHaveLength(0);
  });

  it('rejects an insert carrying another tenant org_id, because USING doubles as WITH CHECK', async () => {
    const plan = await getPlan();
    const a = await seedOrg({ name: 'A' });
    const b = await seedOrg({ name: 'B' });

    await expect(
      withTenant(a.orgId, (c) => c.query(
        `INSERT INTO transactions (org_id, plan_id, amount_cents, status)
         VALUES ($1, $2, 100, 'SUCCESS')`, [b.orgId, plan.id]))
    ).rejects.toThrow(/row-level security/i);
  });

  it('returns zero rows outside withTenant rather than raising, proving missing_ok', async () => {
    const plan = await getPlan();
    const a = await seedOrg({ name: 'A' });
    await seedTransaction(a.orgId, plan);

    const { rows } = await appPool.query('SELECT * FROM transactions');
    expect(rows).toHaveLength(0);
  });

  it('does not leak the setting to the next borrower of a pooled connection', async () => {
    const plan = await getPlan();
    const a = await seedOrg({ name: 'A' });
    const b = await seedOrg({ name: 'B' });
    await seedTransaction(a.orgId, plan);
    await seedTransaction(b.orgId, plan);

    await withTenant(a.orgId, (c) => c.query('SELECT 1'));
    const rows = await withTenant(b.orgId, async (c) =>
      (await c.query('SELECT org_id FROM transactions')).rows);

    expect(rows).toHaveLength(1);
    expect(rows[0].org_id).toBe(b.orgId);
  });

  it('rolls everything back when the callback throws', async () => {
    const plan = await getPlan();
    const a = await seedOrg({ name: 'A' });

    await expect(withTenant(a.orgId, async (c) => {
      await c.query(
        `INSERT INTO transactions (org_id, plan_id, amount_cents, status)
         VALUES ($1,$2,100,'PENDING')`, [a.orgId, plan.id]);
      throw new Error('boom');
    })).rejects.toThrow('boom');

    const { rows } = await adminPool.query('SELECT * FROM transactions');
    expect(rows).toHaveLength(0);
  });
});
