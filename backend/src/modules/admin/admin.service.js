import { offsetOf, envelope } from '../../lib/pagination.js';
import { notFound } from '../../lib/errors.js';
import { revokeAllForUsers } from '../auth/refreshService.js';
import * as repo from './repository.js';

const shapeOrgRow = (o) => ({
  id: o.id, name: o.name, status: o.status, planName: o.plan_name,
  memberCount: o.member_count, billingEmail: o.billing_email, createdAt: o.created_at,
});

const shapeMember = (m) => ({
  id: m.id, email: m.email, name: m.name,
  role: m.role, status: m.status, createdAt: m.created_at,
});

const shapeSub = (s) => ({
  id: s.id, status: s.status, planName: s.plan_name,
  priceCents: s.price_cents, currency: s.currency,
  currentPeriodStart: s.current_period_start, currentPeriodEnd: s.current_period_end,
  cancelAtPeriodEnd: s.cancel_at_period_end, createdAt: s.created_at,
});

const shapeTxn = (t) => ({
  id: t.id, orgId: t.org_id, orgName: t.org_name, planName: t.plan_name,
  amountCents: t.amount_cents, currency: t.currency, status: t.status,
  invoiceUrl: t.invoice_url, failureReason: t.failure_reason, createdAt: t.created_at,
});

export async function listOrgs(query) {
  const { rows, total } = await repo.listOrgs({ ...query, offset: offsetOf(query) });
  return envelope(rows.map(shapeOrgRow), total, query);
}

export async function getOrgDetail(orgId) {
  const organization = await repo.findOrg(orgId);
  if (!organization) throw notFound('Organization not found.');

  const [members, subscriptions] = await Promise.all([
    repo.listOrgMembers(orgId), repo.listOrgSubscriptions(orgId),
  ]);

  return {
    organization: {
      id: organization.id, name: organization.name, status: organization.status,
      contactEmail: organization.contact_email, billingEmail: organization.billing_email,
      suspendedReason: organization.suspended_reason, createdAt: organization.created_at,
    },
    members: members.map(shapeMember),
    subscriptions: subscriptions.map(shapeSub),
  };
}

export async function listTransactions(query) {
  const { rows, total } = await repo.listTransactions({ ...query, offset: offsetOf(query) });
  return envelope(rows.map(shapeTxn), total, query);
}

export async function suspendOrg(orgId, { reason }) {
  const row = await repo.suspend(orgId, reason);
  if (!row) throw notFound('Organization not found.');
  // Access ends within the access token's 15 minutes, not at the next login.
  await revokeAllForUsers(await repo.listMemberIds(orgId));
  return { id: row.id, name: row.name, status: row.status, suspendedReason: row.suspended_reason };
}

export async function reactivateOrg(orgId) {
  if (!await repo.reactivate(orgId)) throw notFound('Organization not found.');
}

export async function getStats() {
  const [counts, revenue, signups] = await Promise.all([
    repo.stats(), repo.revenueByCurrency(), repo.recentSignups(5),
  ]);

  return {
    totalOrganizations: counts.total_organizations,
    totalUsers: counts.total_users,
    activeSubscriptions: counts.active_subscriptions,
    failedPayments: counts.failed_payments,
    revenue: revenue.map((r) => ({
      currency: r.currency, totalCents: Number(r.total_cents), payments: r.payments,
    })),
    recentSignups: signups.map((o) => ({
      id: o.id, name: o.name, status: o.status, createdAt: o.created_at,
    })),
  };
}
