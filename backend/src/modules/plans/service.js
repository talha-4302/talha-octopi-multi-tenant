import { appPool } from '../../db/pool.js';
import { conflict, notFound } from '../../lib/errors.js';
import { ERROR_CODE, PG_UNIQUE_VIOLATION } from '../../lib/constants.js';
import { syncPlanToStripe } from '../../lib/stripeSync.js';
import * as repo from './repository.js';

export const shapePlan = (p) => ({
  id: p.id, name: p.name, priceCents: p.price_cents, currency: p.currency,
  interval: p.interval, features: p.features, maxMembers: p.max_members,
  isActive: p.is_active,
});

// plans has RLS off, so no withTenant. It is read by unauthenticated visitors.
export const listActivePlans = async () => (await repo.findActive(appPool)).map(shapePlan);

export const listAllPlans = async () => (await repo.findAll(appPool)).map(shapePlan);

export async function createPlan(input) {
  let created;
  try {
    created = await repo.insert(appPool, input);
  } catch (err) {
    if (err.code === PG_UNIQUE_VIOLATION) {
      throw conflict(ERROR_CODE.NAME_IN_USE, 'A plan with that name already exists.');
    }
    throw err;
  }

  const ids = await syncPlanToStripe({
    id: created.id, name: created.name, price_cents: created.price_cents,
    currency: created.currency, interval: created.interval, stripe_product_id: null,
  });
  return shapePlan(await repo.setStripeIds(appPool, created.id, ids));
}

export async function updatePlan(id, patch) {
  const existing = await repo.findById(appPool, id);
  if (!existing) throw notFound('Plan not found.');

  const updated = await repo.update(appPool, id, patch);

  // A price change needs a NEW Stripe Price, because Prices are immutable.
  // Anything else, a rename or a feature edit, needs no Stripe call at all.
  const priceChanged = patch.priceCents !== undefined
    && patch.priceCents !== existing.price_cents;

  if (!priceChanged) return shapePlan(updated);

  const ids = await syncPlanToStripe({
    id: updated.id, name: updated.name, price_cents: updated.price_cents,
    currency: updated.currency, interval: updated.interval,
    stripe_product_id: updated.stripe_product_id,
  });
  return shapePlan(await repo.setStripeIds(appPool, id, ids));
}
