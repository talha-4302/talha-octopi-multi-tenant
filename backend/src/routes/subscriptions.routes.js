import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requireOrgStatus } from '../middleware/requireOrgStatus.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { ROLES, ORG_GATE } from '../lib/constants.js';
import { checkoutSchema, changePlanSchema } from '../modules/subscriptions/subscriptions.schema.js';
import * as controller from '../modules/subscriptions/subscriptions.controller.js';

export const subscriptionRouter = Router();
subscriptionRouter.use(authenticate);

// ANY tier: the checkout success page polls this while the org is still PENDING.
subscriptionRouter.get('/', requireOrgStatus(...ORG_GATE.ANY),
  authorize(ROLES.ORG_ADMIN), controller.getSubscription);

subscriptionRouter.post('/checkout', requireOrgStatus(...ORG_GATE.BILLABLE),
  authorize(ROLES.ORG_ADMIN), validate(checkoutSchema), controller.createCheckout);

subscriptionRouter.post('/change', requireOrgStatus(...ORG_GATE.OPERATING),
  authorize(ROLES.ORG_ADMIN), validate(changePlanSchema), controller.changePlan);

subscriptionRouter.post('/cancel', requireOrgStatus(...ORG_GATE.OPERATING),
  authorize(ROLES.ORG_ADMIN), controller.cancelSubscription);
