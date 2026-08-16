import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requireOrgStatus } from '../middleware/requireOrgStatus.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { ROLES, ORG_GATE } from '../lib/constants.js';
import { updateOrgSchema } from '../modules/orgs/orgs.schema.js';
import * as controller from '../modules/orgs/orgs.controller.js';

export const orgRouter = Router();
orgRouter.use(authenticate);

orgRouter.get('/', requireOrgStatus(...ORG_GATE.ANY),
  authorize(ROLES.ORG_ADMIN, ROLES.ORG_MEMBER), controller.getOrg);

orgRouter.patch('/', requireOrgStatus(...ORG_GATE.OPERATING),
  authorize(ROLES.ORG_ADMIN), validate(updateOrgSchema), controller.updateOrg);
