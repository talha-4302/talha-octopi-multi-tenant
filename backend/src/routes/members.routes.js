import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requireOrgStatus } from '../../middleware/requireOrgStatus.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { ROLES, ORG_GATE } from '../../lib/constants.js';
import { listMembersSchema, inviteSchema, changeRoleSchema, memberIdSchema } from './schema.js';
import * as controller from './controller.js';

export const membersRouter = Router();

membersRouter.use(authenticate, requireOrgStatus(...ORG_GATE.OPERATING), authorize(ROLES.ORG_ADMIN));
membersRouter.get('/', validate(listMembersSchema), controller.listMembers);
membersRouter.post('/', validate(inviteSchema), controller.inviteMember);
membersRouter.patch('/:id', validate(changeRoleSchema), controller.changeRole);
membersRouter.delete('/:id', validate(memberIdSchema), controller.removeMember);
