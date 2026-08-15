import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from './helpers/http.js';
import { adminPool } from '../src/db/pool.js';
import { stripe } from '../src/lib/stripe.js';
import { getPlan, seedOrg } from './helpers/db.js';
import { makeUser } from './helpers/factories.js';
import { ORG_STATUS, SUBSCRIPTION_STATUS, TRANSACTION_STATUS, ROLES } from '../src/lib/constants.js';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(stripe.customers, 'create').mockResolvedValue({ id: 'cus_1' });
  vi.spyOn(stripe.checkout.sessions, 'create').mockResolvedValue({
    id: 'cs_1', url: 'https://checkout.stripe.test/cs_1' });
});

async function signup(overrides = {}) {
  const plan = await getPlan('Starter');
  return api().post('/api/auth/register').send({
    organizationName: 'Acme', name: 'Ada', email: 'ada@acme.test',
    password: 'Passw0rd!', planId: plan.id, ...overrides,
  });
}

describe('GET /api/plans', () => {
  it('is public and returns active plans only', async () => {
    await adminPool.query(`UPDATE plans SET is_active = false WHERE name = 'Business'`);
    const res = await api().get('/api/plans');
    expect(res.status).toBe(200);
    expect(res.body.map((p) => p.name)).toEqual(['Starter', 'Pro']);
    await adminPool.query(`UPDATE plans SET is_active = true WHERE name = 'Business'`);
  });
});

describe('POST /api/auth/register', () => {
  it('returns a checkout url, an access token, and a refresh cookie', async () => {
    const res = await signup();
    expect(res.status).toBe(201);
    expect(res.body.checkoutUrl).toBe('https://checkout.stripe.test/cs_1');
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user.role).toBe(ROLES.ORG_ADMIN);
    expect(res.headers['set-cookie'].join(';')).toMatch(/rt=/);
  });

  it('writes all four rows, with the organization PENDING', async () => {
    await signup();
    const org = await adminPool.query(`SELECT * FROM organizations WHERE name = 'Acme'`);
    expect(org.rows[0].status).toBe(ORG_STATUS.PENDING);
    expect(org.rows[0].stripe_customer_id).toBe('cus_1');

    const user = await adminPool.query(`SELECT * FROM users WHERE email = 'ada@acme.test'`);
    expect(user.rows[0].role).toBe(ROLES.ORG_ADMIN);
    expect(user.rows[0].org_id).toBe(org.rows[0].id);

    const sub = await adminPool.query(`SELECT * FROM subscriptions WHERE org_id = $1`, [org.rows[0].id]);
    expect(sub.rows[0].status).toBe(SUBSCRIPTION_STATUS.PENDING);
    expect(sub.rows[0].price_cents).toBe(2900);          // snapshot, not a join

    const txn = await adminPool.query(`SELECT * FROM transactions WHERE org_id = $1`, [org.rows[0].id]);
    expect(txn.rows[0].status).toBe(TRANSACTION_STATUS.PENDING);
    expect(txn.rows[0].stripe_checkout_session_id).toBe('cs_1');
  });

  it('carries orgId, subscriptionId and transactionId in the session metadata', async () => {
    await signup();
    const org = await adminPool.query(`SELECT id FROM organizations WHERE name = 'Acme'`);
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'subscription',
      customer: 'cus_1',
      metadata: expect.objectContaining({ orgId: org.rows[0].id }),
    }));
  });

  it('answers 409 for an email already in use, and never calls Stripe', async () => {
    const { orgId } = await seedOrg();
    await makeUser({ orgId, email: 'ada@acme.test' });

    const res = await signup();
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_IN_USE');
    // The availability read runs before the Stripe calls, so an ordinary
    // duplicate signup never leaves orphan objects behind.
    expect(stripe.customers.create).not.toHaveBeenCalled();
  });

  it('answers 400 for an unknown or inactive plan', async () => {
    const res = await signup({ planId: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(400);
  });

  it('writes nothing when Stripe fails', async () => {
    stripe.customers.create.mockRejectedValueOnce(new Error('stripe down'));
    const res = await signup();
    expect(res.status).toBe(500);
    const { rows } = await adminPool.query(`SELECT * FROM organizations WHERE name = 'Acme'`);
    expect(rows).toHaveLength(0);
  });

  it('rolls back the organization when the user insert fails', async () => {
    // Force the second insert to violate the unique email constraint mid transaction.
    const { orgId } = await seedOrg({ name: 'Other' });
    await makeUser({ orgId, email: 'race@acme.test' });
    vi.spyOn(await import('../src/modules/registration/repository.js'), 'insertUser')
      .mockRejectedValueOnce(Object.assign(new Error('dup'), { code: '23505' }));

    const res = await signup({ email: 'race2@acme.test' });
    expect(res.status).toBe(409);
    const { rows } = await adminPool.query(`SELECT * FROM organizations WHERE name = 'Acme'`);
    expect(rows).toHaveLength(0);
  });
});
