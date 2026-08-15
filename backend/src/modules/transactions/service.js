import { withTenant } from '../../db/withTenant.js';
import { offsetOf, envelope } from '../../lib/pagination.js';
import * as repo from './repository.js';

export const shapeTransaction = (t) => ({
  id: t.id,
  amountCents: t.amount_cents,
  currency: t.currency,
  status: t.status,
  planName: t.plan_name,
  invoiceUrl: t.invoice_url,
  failureReason: t.failure_reason,
  createdAt: t.created_at,
});

export async function listTransactions({ orgId }, query) {
  const { rows, total } = await withTenant(orgId, (c) =>
    repo.listForOrg(c, { ...query, offset: offsetOf(query) }));
  return envelope(rows.map(shapeTransaction), total, query);
}
