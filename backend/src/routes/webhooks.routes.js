import { Router } from 'express';
import express from 'express';
import { handleStripeWebhook } from '../modules/webhooks/webhooks.controller.js';

export const webhookRouter = Router();

// raw, not json. Signature verification needs the exact bytes Stripe signed.
webhookRouter.post('/stripe', express.raw({ type: 'application/json' }), handleStripeWebhook);
