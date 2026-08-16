import { appPool } from '../src/db/pool.js';
import * as plansRepo from '../src/modules/plans/plans.repository.js';
import { syncPlanToStripe } from '../src/lib/stripeSync.js';

const plans = await plansRepo.findAll(appPool);
for (const plan of plans) {
  if (plan.stripe_price_id) { console.log(`skip ${plan.name}, already synced`); continue; }
  const ids = await syncPlanToStripe(plan);
  await plansRepo.setStripeIds(appPool, plan.id, ids);
  console.log(`synced ${plan.name} -> ${ids.priceId}`);
}
await appPool.end();
