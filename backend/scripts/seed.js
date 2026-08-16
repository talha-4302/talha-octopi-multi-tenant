// Reproducible test credentials: one Platform Admin and two organizations,
// each with an admin and a member. Two organizations exist so tenant isolation
// is demonstrable by signing in, not just by reading the tests.
//
// Idempotent: re-running skips anything already present.
import { randomUUID } from 'node:crypto';
import { appPool, adminPool } from '../src/db/pool.js';
import { withTenant } from '../src/db/withTenant.js';
import { hashPassword } from '../src/lib/password.js';
import * as plansRepo from '../src/modules/plans/plans.repository.js';
import { syncPlanToStripe } from '../src/lib/stripeSync.js';
import {
  ROLES, ORG_STATUS, USER_STATUS, SUBSCRIPTION_STATUS, TRANSACTION_STATUS,
} from '../src/lib/constants.js';

const PASSWORD = 'Password123!';

async function ensurePlanIds() {
  for (const plan of await plansRepo.findAll(appPool)) {
    if (plan.stripe_price_id) continue;
    const ids = await syncPlanToStripe(plan);
    await plansRepo.setStripeIds(appPool, plan.id, ids);
    console.log(`synced ${plan.name} to Stripe`);
  }
}

async function seedPlatformAdmin() {
  const email = 'platform@octopi.test';
  await adminPool.query(
    `INSERT INTO users (org_id, email, password_hash, name, role, status)
     VALUES (NULL, $1, $2, 'Platform Admin', $3, $4)
     ON CONFLICT (email) DO NOTHING`,
    [email, await hashPassword(PASSWORD), ROLES.PLATFORM_ADMIN, USER_STATUS.ACTIVE]);
  return email;
}

// Seeding writes through withTenant, so the seeded rows satisfy exactly the
// same RLS policies the application writes under.
async function seedOrganization({ name, billingEmail, adminEmail, memberEmail, planName }) {
  const existing = await adminPool.query(
    'SELECT id FROM organizations WHERE billing_email = $1', [billingEmail]);
  if (existing.rows.length) {
    console.log(`${name} already seeded, skipping`);
    return;
  }

  const plan = (await plansRepo.findAll(appPool)).find((p) => p.name === planName);
  if (!plan) throw new Error(`plan ${planName} not found, run npm run migrate first`);

  const orgId = randomUUID();
  const hash = await hashPassword(PASSWORD);

  await withTenant(orgId, async (c) => {
    await c.query(
      `INSERT INTO organizations (id, name, billing_email, contact_email, status, stripe_customer_id)
       VALUES ($1,$2,$3,$3,$4,$5)`,
      [orgId, name, billingEmail, ORG_STATUS.ACTIVE, `cus_seed_${orgId.slice(0, 8)}`]);

    await c.query(
      `INSERT INTO users (org_id, email, password_hash, name, role, status)
       VALUES ($1,$2,$3,'Org Admin',$4,$5), ($1,$6,$3,'Org Member',$7,$5)`,
      [orgId, adminEmail, hash, ROLES.ORG_ADMIN, USER_STATUS.ACTIVE,
        memberEmail, ROLES.ORG_MEMBER]);

    const sub = await c.query(
      `INSERT INTO subscriptions
         (org_id, plan_id, price_cents, stripe_price_id, status,
          current_period_start, current_period_end, stripe_subscription_id)
       VALUES ($1,$2,$3,$4,$5, now(), now() + interval '30 days', $6)
       RETURNING id`,
      [orgId, plan.id, plan.price_cents, plan.stripe_price_id,
        SUBSCRIPTION_STATUS.ACTIVE, `sub_seed_${orgId.slice(0, 8)}`]);

    // One SUCCESS and one FAILED, so the transactions screen has both states to show.
    for (const status of [TRANSACTION_STATUS.SUCCESS, TRANSACTION_STATUS.FAILED]) {
      await c.query(
        `INSERT INTO transactions
           (org_id, subscription_id, plan_id, amount_cents, currency, status,
            invoice_url, failure_reason)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [orgId, sub.rows[0].id, plan.id, plan.price_cents, plan.currency, status,
          status === TRANSACTION_STATUS.SUCCESS ? 'https://invoice.stripe.test/seed' : null,
          status === TRANSACTION_STATUS.FAILED ? 'Your card was declined.' : null]);
    }
  });

  console.log(`seeded ${name}`);
}

await ensurePlanIds();
const platform = await seedPlatformAdmin();

await seedOrganization({
  name: 'Acme Industries', billingEmail: 'billing@acme.test',
  adminEmail: 'admin@acme.test', memberEmail: 'member@acme.test', planName: 'Pro',
});

await seedOrganization({
  name: 'Globex Corporation', billingEmail: 'billing@globex.test',
  adminEmail: 'admin@globex.test', memberEmail: 'member@globex.test', planName: 'Starter',
});

console.log(`
Test credentials, password ${PASSWORD} for all of them

  Platform Admin       ${platform}
  Org Admin   (Acme)   admin@acme.test
  Org Member  (Acme)   member@acme.test
  Org Admin   (Globex) admin@globex.test
  Org Member  (Globex) member@globex.test

Sign in as both org admins to see that neither can reach the other's data.
`);

await appPool.end();
await adminPool.end();
