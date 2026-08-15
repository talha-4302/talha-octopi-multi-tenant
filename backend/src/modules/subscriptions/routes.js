import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requireOrgStatus } from '../../middleware/requireOrgStatus.js';
import { authorize } from '../../middleware/authorize.js';
import { ROLES, ORG_GATE } from '../../lib/constants.js';
import * as controller from './controller.js';

export const subscriptionRouter = Router();
subscriptionRouter.use(authenticate);

// ANY tier: the checkout success page polls this while the org is still PENDING.
subscriptionRouter.get('/', requireOrgStatus(...ORG_GATE.ANY),
  authorize(ROLES.ORG_ADMIN), controller.getSubscription);
