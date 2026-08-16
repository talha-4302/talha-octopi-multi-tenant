import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requireOrgStatus } from '../middleware/requireOrgStatus.js';
import { authorize } from '../middleware/authorize.js';
import { ROLES, ORG_GATE } from '../lib/constants.js';
import * as controller from '../modules/subscriptions/subscriptions.controller.js';

// Separate router so the path is /api/billing/portal
export const billingRouter = Router();
billingRouter.use(authenticate, requireOrgStatus(...ORG_GATE.BILLABLE), authorize(ROLES.ORG_ADMIN));
billingRouter.post('/portal', controller.createPortalSession);
