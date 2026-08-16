import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { updateMeSchema, changePasswordSchema } from '../modules/me/me.schema.js';
import * as controller from '../modules/me/me.controller.js';

export const meRouter = Router();

// No requireOrgStatus here: these are the ANY tier, reachable at every status.
meRouter.use(authenticate);
meRouter.get('/', controller.getMe);
meRouter.patch('/', validate(updateMeSchema), controller.updateMe);
meRouter.post('/password', validate(changePasswordSchema), controller.changePassword);
