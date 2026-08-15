import { stripe } from './stripe.js';

// Stripe Prices are immutable, so a price edit creates a NEW Price and
// leaves the old one in place. Existing subscribers keep billing against
// the subscriptions.stripe_price_id snapshot taken at activation.
export async function syncPlanToStripe(plan) {
  const productId = plan.stripe_product_id
    ?? (await stripe.products.create({ name: plan.name, metadata: { planId: plan.id } })).id;

  const price = await stripe.prices.create({
    product: productId,
    unit_amount: plan.price_cents,
    currency: plan.currency,
    recurring: { interval: plan.interval },
    metadata: { planId: plan.id },
  });

  return { productId, priceId: price.id };
}
