import { withTenant } from '../../db/withTenant.js';
import { notFound } from '../../lib/errors.js';
import * as repo from './repository.js';

export const shapeSubscription = (s) => ({
  id: s.id,
  status: s.status,
  planName: s.plan_name,
  planId: s.plan_id,
  priceCents: s.price_cents,
  currency: s.currency,
  currentPeriodStart: s.current_period_start,
  currentPeriodEnd: s.current_period_end,
  cancelAtPeriodEnd: s.cancel_at_period_end,
  seatsUsed: s.seats_used,
  seatLimit: s.max_members,
});

export async function getSubscription({ orgId }) {
  const row = await withTenant(orgId, (c) => repo.findLive(c));
  if (!row) throw notFound('No active subscription.');
  return shapeSubscription(row);
}
