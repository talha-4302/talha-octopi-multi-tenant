import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from './helpers/http.js';
import { adminPool } from '../src/db/pool.js';
import { stripe } from '../src/lib/stripe.js';
import { makeUser } from './helpers/factories.js';
import { getPlan } from './helpers/db.js';
import { signAccessToken } from '../src/lib/jwt.js';
import { ROLES } from '../src/lib/constants.js';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(stripe.products, 'create').mockResolvedValue({ id: 'prod_new' });
  vi.spyOn(stripe.prices, 'create').mockResolvedValue({ id: 'price_new' });
});

async function platformToken() {
  const u = await makeUser({ orgId: null, role: ROLES.PLATFORM_ADMIN });
  return signAccessToken({ userId: u.id, orgId: null, role: ROLES.PLATFORM_ADMIN });
}

describe('GET /api/admin/plans', () => {
  it('includes inactive plans, unlike the public route', async () => {
    await adminPool.query(`UPDATE plans SET is_active = false WHERE name = 'Business'`);
    const token = await platformToken();

    const adminList = await api().get('/api/admin/plans').set('Authorization', `Bearer ${token}`);
    const publicList = await api().get('/api/plans');

    expect(adminList.body).toHaveLength(3);
    expect(publicList.body).toHaveLength(2);
    await adminPool.query(`UPDATE plans SET is_active = true WHERE name = 'Business'`);
  });
});

describe('POST /api/admin/plans', () => {
  it('creates the plan and its Stripe product and price in one call', async () => {
    const res = await api().post('/api/admin/plans')
      .set('Authorization', `Bearer ${await platformToken()}`)
      .send({ name: 'Enterprise', priceCents: 49900, currency: 'usd', interval: 'month',
              features: ['Everything'], maxMembers: 500 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Enterprise', priceCents: 49900 });
    expect(stripe.products.create).toHaveBeenCalledTimes(1);
    expect(stripe.prices.create).toHaveBeenCalledWith(
      expect.objectContaining({ unit_amount: 49900, recurring: { interval: 'month' } }));

    const { rows } = await adminPool.query(`SELECT * FROM plans WHERE name = 'Enterprise'`);
    expect(rows[0].stripe_price_id).toBe('price_new');
    // plans is reference data, not truncated between test files. Clean up the row this test made.
    await adminPool.query(`DELETE FROM plans WHERE name = 'Enterprise'`);
  });

  it('rejects a duplicate plan name with 409', async () => {
    const res = await api().post('/api/admin/plans')
      .set('Authorization', `Bearer ${await platformToken()}`)
      .send({ name: 'Pro', priceCents: 100, currency: 'usd', interval: 'month',
              features: [], maxMembers: 1 });
    expect(res.status).toBe(409);
  });

  it('rejects a negative price and a zero seat limit', async () => {
    const token = await platformToken();
    const bad = { name: 'Bad', currency: 'usd', interval: 'month', features: [] };

    expect((await api().post('/api/admin/plans').set('Authorization', `Bearer ${token}`)
      .send({ ...bad, priceCents: -1, maxMembers: 5 })).status).toBe(400);
    expect((await api().post('/api/admin/plans').set('Authorization', `Bearer ${token}`)
      .send({ ...bad, priceCents: 100, maxMembers: 0 })).status).toBe(400);
  });
});

describe('PATCH /api/admin/plans/:id', () => {
  it('writes a NEW stripe price id on a price change, leaving the old one alone', async () => {
    const plan = await getPlan('Starter');
    await adminPool.query(
      `UPDATE plans SET stripe_product_id = 'prod_old', stripe_price_id = 'price_old' WHERE id = $1`,
      [plan.id]);

    const res = await api().patch(`/api/admin/plans/${plan.id}`)
      .set('Authorization', `Bearer ${await platformToken()}`).send({ priceCents: 3900 });

    expect(res.status).toBe(200);
    const { rows } = await adminPool.query('SELECT * FROM plans WHERE id = $1', [plan.id]);
    // Stripe Prices are immutable. Existing subscribers keep their snapshot.
    expect(rows[0].stripe_price_id).toBe('price_new');
    expect(rows[0].stripe_product_id).toBe('prod_old');
    expect(stripe.products.create).not.toHaveBeenCalled();
    // plans is reference data, not truncated between test files. Restore it.
    await adminPool.query(
      `UPDATE plans SET price_cents = $2, stripe_product_id = NULL, stripe_price_id = NULL
        WHERE id = $1`, [plan.id, plan.price_cents]);
  });

  it('does not touch Stripe when only the name or features change', async () => {
    const plan = await getPlan('Pro');
    await api().patch(`/api/admin/plans/${plan.id}`)
      .set('Authorization', `Bearer ${await platformToken()}`)
      .send({ features: ['A', 'B'] });
    expect(stripe.prices.create).not.toHaveBeenCalled();
  });

  it('disables a plan through isActive, hiding it from the public route', async () => {
    const plan = await getPlan('Business');
    await api().patch(`/api/admin/plans/${plan.id}`)
      .set('Authorization', `Bearer ${await platformToken()}`).send({ isActive: false });

    const publicList = await api().get('/api/plans');
    expect(publicList.body.map((p) => p.name)).not.toContain('Business');
    await adminPool.query(`UPDATE plans SET is_active = true WHERE id = $1`, [plan.id]);
  });

  it('has no delete endpoint', async () => {
    const plan = await getPlan('Pro');
    const res = await api().delete(`/api/admin/plans/${plan.id}`)
      .set('Authorization', `Bearer ${await platformToken()}`);
    expect(res.status).toBe(404);
  });

  it('refuses an ORG_ADMIN', async () => {
    const plan = await getPlan('Pro');
    const u = await makeUser({ orgId: null, role: ROLES.PLATFORM_ADMIN });
    const orgAdminToken = signAccessToken({
      userId: u.id, orgId: '00000000-0000-0000-0000-000000000001', role: ROLES.ORG_ADMIN });
    expect((await api().patch(`/api/admin/plans/${plan.id}`)
      .set('Authorization', `Bearer ${orgAdminToken}`).send({ isActive: false })).status).toBe(403);
  });
});
