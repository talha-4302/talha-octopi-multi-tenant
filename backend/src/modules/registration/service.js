import { randomUUID } from 'node:crypto';
import { appPool } from '../../db/pool.js';
import { withTenant } from '../../db/withTenant.js';
import { stripe } from '../../lib/stripe.js';
import { env } from '../../config/env.js';
import { hashPassword } from '../../lib/password.js';
import { badRequest, conflict } from '../../lib/errors.js';
import { ERROR_CODE, PG_UNIQUE_VIOLATION } from '../../lib/constants.js';
import * as plansRepo from '../plans/repository.js';
import * as authRepo from '../auth/repository.js';
import { tokenFor, publicUser } from '../auth/service.js';
import { issueRefreshToken } from '../auth/refreshService.js';
import * as repo from './repository.js';

export async function register({ organizationName, name, email, password, planId }) {
  // Availability read, so the ordinary duplicate case never reaches Stripe.
  // The UNIQUE constraints remain the real guard.
  if (await authRepo.findByEmail(email)) {
    throw conflict(ERROR_CODE.EMAIL_IN_USE, 'That email address is already in use.');
  }

  const plan = await plansRepo.findById(appPool, planId);
  if (!plan || !plan.is_active) throw badRequest('That plan is not available.');
  if (!plan.stripe_price_id) throw badRequest('That plan is not ready for checkout.');

  // Ids generated here, not by the database: the organization insert is
  // checked against id = current_setting(...) under RLS, so the id must
  // exist before the transaction opens.
  const orgId = randomUUID();
  const userId = randomUUID();
  const subscriptionId = randomUUID();
  const transactionId = randomUUID();

  // Every Stripe object BEFORE the transaction. No network call inside it.
  const customer = await stripe.customers.create({
    email, name: organizationName, metadata: { orgId },
  });

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customer.id,
    line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
    // The webhook arrives with no session and no JWT, so the tenant travels with the event.
    metadata: { orgId, subscriptionId, transactionId },
    subscription_data: { metadata: { orgId, subscriptionId } },
    success_url: `${env.APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.APP_URL}/checkout/cancelled`,
  });

  const passwordHash = await hashPassword(password);

  // One transaction. All four rows commit together or not at all.
  const user = await withTenant(orgId, async (c) => {
    try {
      await repo.insertOrganization(c, {
        id: orgId, name: organizationName, billingEmail: email, stripeCustomerId: customer.id });
      const u = await repo.insertUser(c, { id: userId, orgId, email, name, passwordHash });
      await repo.insertSubscription(c, { id: subscriptionId, orgId, plan });
      await repo.insertTransaction(c, {
        id: transactionId, orgId, subscriptionId, plan, sessionId: session.id });
      return u;
    } catch (err) {
      if (err.code === PG_UNIQUE_VIOLATION) {
        throw conflict(ERROR_CODE.EMAIL_IN_USE, 'That email address is already in use.');
      }
      throw err;
    }
  });

  return {
    accessToken: tokenFor(user),
    refreshToken: await issueRefreshToken(user.id),
    user: publicUser(user),
    checkoutUrl: session.url,
  };
}
