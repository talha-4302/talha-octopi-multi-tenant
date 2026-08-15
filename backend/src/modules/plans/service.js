import { appPool } from '../../db/pool.js';
import * as repo from './repository.js';

export const shapePlan = (p) => ({
  id: p.id, name: p.name, priceCents: p.price_cents, currency: p.currency,
  interval: p.interval, features: p.features, maxMembers: p.max_members,
  isActive: p.is_active,
});

// plans has RLS off, so no withTenant. It is read by unauthenticated visitors.
export const listActivePlans = async () => (await repo.findActive(appPool)).map(shapePlan);
