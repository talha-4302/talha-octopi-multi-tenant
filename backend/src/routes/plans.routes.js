import { Router } from 'express';
import * as controller from './controller.js';

export const plansRouter = Router();
plansRouter.get('/', controller.listPlans);   // public, no authenticate
