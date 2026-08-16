import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../lib/constants.js';
import {
  listOrgsSchema, orgIdSchema, suspendSchema, platformTransactionsSchema,
  createPlanSchema, updatePlanSchema,
} from '../modules/admin/admin.schema.js';
import * as controller from '../modules/admin/admin.controller.js';

export const adminRouter = Router();

// No requireOrgStatus: a Platform Admin has no organization to gate.
adminRouter.use(authenticate, authorize(ROLES.PLATFORM_ADMIN));

adminRouter.get('/orgs', validate(listOrgsSchema), controller.listOrgs);
adminRouter.get('/orgs/:orgId', validate(orgIdSchema), controller.getOrgDetail);
adminRouter.get('/orgs/:orgId/transactions',
  validate({ ...orgIdSchema, query: platformTransactionsSchema.query }),
  controller.listOrgTransactions);
adminRouter.post('/orgs/:orgId/suspend', validate(suspendSchema), controller.suspendOrg);
adminRouter.post('/orgs/:orgId/reactivate', validate(orgIdSchema), controller.reactivateOrg);

adminRouter.get('/stats', controller.getStats);
adminRouter.get('/transactions', validate(platformTransactionsSchema), controller.listTransactions);

adminRouter.get('/plans', controller.listAllPlans);
adminRouter.post('/plans', validate(createPlanSchema), controller.createPlan);
adminRouter.patch('/plans/:id', validate(updatePlanSchema), controller.updatePlan);
// No DELETE. A plan in use is protected by ON DELETE RESTRICT, and disabling
// through isActive is the supported path.
