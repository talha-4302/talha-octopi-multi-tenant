import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requireOrgStatus } from '../../middleware/requireOrgStatus.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { ROLES, ORG_GATE } from '../../lib/constants.js';
import { listTransactionsSchema } from './schema.js';
import * as controller from './controller.js';

export const transactionsRouter = Router();

// ANY tier: a suspended admin can still read their billing history.
transactionsRouter.use(authenticate, requireOrgStatus(...ORG_GATE.ANY), authorize(ROLES.ORG_ADMIN));
transactionsRouter.get('/', validate(listTransactionsSchema), controller.listTransactions);
