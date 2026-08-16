import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { authLimiter, strictLimiter } from '../../middleware/rateLimit.js';
import { loginSchema, forgotSchema, resetSchema, acceptInviteSchema, tokenParamSchema } from './schema.js';
import { registerSchema } from '../registration/schema.js';
import * as registrationController from '../registration/controller.js';
import * as controller from './controller.js';

export const authRouter = Router();

authRouter.post('/register', authLimiter, validate(registerSchema), registrationController.register);
authRouter.post('/login', authLimiter, validate(loginSchema), controller.login);
authRouter.post('/refresh', controller.refresh);
authRouter.post('/logout', controller.logout);
authRouter.post('/forgot-password', strictLimiter, validate(forgotSchema), controller.forgotPassword);
authRouter.post('/reset-password', strictLimiter, validate(resetSchema), controller.resetPassword);
authRouter.get('/invite/:token', strictLimiter, validate(tokenParamSchema), controller.describeInvite);
authRouter.post('/accept-invite', strictLimiter, validate(acceptInviteSchema), controller.acceptInvite);
