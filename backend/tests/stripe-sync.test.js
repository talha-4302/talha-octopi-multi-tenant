import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncPlanToStripe } from '../src/lib/stripeSync.js';
import { stripe } from '../src/lib/stripe.js';

beforeEach(() => {
  vi.spyOn(stripe.products, 'create').mockResolvedValue({ id: 'prod_1' });
  vi.spyOn(stripe.prices, 'create').mockResolvedValue({ id: 'price_1' });
});

describe('syncPlanToStripe', () => {
  const plan = {
    id: 'p1', name: 'Pro', price_cents: 7900,
    currency: 'usd', interval: 'month', stripe_product_id: null,
  };

  it('creates a product and a recurring price in minor units', async () => {
    const ids = await syncPlanToStripe(plan);
    expect(ids).toEqual({ productId: 'prod_1', priceId: 'price_1' });
    expect(stripe.prices.create).toHaveBeenCalledWith(expect.objectContaining({
      product: 'prod_1',
      unit_amount: 7900,
      currency: 'usd',
      recurring: { interval: 'month' },
    }));
  });

  it('reuses an existing product and creates only a new price on a repricing', async () => {
    await syncPlanToStripe({ ...plan, stripe_product_id: 'prod_existing' });
    expect(stripe.products.create).not.toHaveBeenCalled();
    expect(stripe.prices.create).toHaveBeenCalledWith(
      expect.objectContaining({ product: 'prod_existing' }));
  });
});
