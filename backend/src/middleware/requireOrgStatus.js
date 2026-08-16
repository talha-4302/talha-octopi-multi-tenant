import { withTenant } from '../db/withTenant.js';
import { forbidden } from '../lib/errors.js';
import { ERROR_CODE } from '../lib/constants.js';
import * as orgRepo from '../modules/orgs/orgs.repository.js';

// Reads the organization status and rejects before any handler runs.
// Every org-scoped route carries one of the three ORG_GATE tiers.
export function requireOrgStatus(...allowed) {
  return async (req, res, next) => {
    try {
      const { orgId } = req.user;
      // A PLATFORM_ADMIN has org_id NULL, so no org-scoped route applies to them.
      // Answering 403 here turns what would be a NULL-uuid crash into a clean refusal.
      if (!orgId) {
        return next(forbidden(ERROR_CODE.FORBIDDEN_ROLE,
          'This area belongs to an organization account.'));
      }

      const org = await withTenant(orgId, (c) => orgRepo.findStatus(c, orgId));
      if (!org) return next(forbidden(ERROR_CODE.ORG_NOT_ACTIVE, 'Organization unavailable.'));

      if (!allowed.includes(org.status)) {
        return next(forbidden(ERROR_CODE.ORG_NOT_ACTIVE,
          `Your organization is ${org.status.toLowerCase()}.`));
      }

      req.orgStatus = org.status;
      return next();
    } catch (err) { return next(err); }
  };
}
