import { withTenant } from '../../db/withTenant.js';
import { notFound, conflict } from '../../lib/errors.js';
import { ROLES, ERROR_CODE, PG_UNIQUE_VIOLATION } from '../../lib/constants.js';
import * as repo from './orgs.repository.js';

export async function getOrg({ orgId, role }) {
  // The branch is here, once, rather than as a filter applied after loading everything.
  if (role === ROLES.ORG_MEMBER) {
    const row = await withTenant(orgId, (c) => repo.findForMember(c, orgId));
    if (!row) throw notFound('Organization not found.');
    return { name: row.name, planName: row.plan_name, status: row.status };
  }

  const row = await withTenant(orgId, (c) => repo.findForAdmin(c, orgId));
  if (!row) throw notFound('Organization not found.');
  return {
    name: row.name, planName: row.plan_name, status: row.status,
    contactEmail: row.contact_email, billingEmail: row.billing_email,
    suspendedReason: row.suspended_reason, createdAt: row.created_at,
  };
}

export async function updateOrg({ orgId }, patch) {
  try {
    const row = await withTenant(orgId, (c) => repo.update(c, orgId, patch));
    if (!row) throw notFound('Organization not found.');
    return {
      name: row.name, status: row.status,
      contactEmail: row.contact_email, billingEmail: row.billing_email,
    };
  } catch (err) {
    // billing_email is UNIQUE, and it maps one to one onto a Stripe Customer.
    if (err.code === PG_UNIQUE_VIOLATION) {
      throw conflict(ERROR_CODE.EMAIL_IN_USE, 'That billing email is already in use.');
    }
    throw err;
  }
}
