// backend/src/app.js
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './lib/errors.js';
import { authRouter } from './modules/auth/routes.js';
import { meRouter } from './modules/me/routes.js';
import { orgRouter } from './modules/orgs/routes.js';
import { membersRouter } from './modules/members/routes.js';
import { transactionsRouter } from './modules/transactions/routes.js';
import { subscriptionRouter } from './modules/subscriptions/routes.js';
import { plansRouter } from './modules/plans/routes.js';
import { webhookRouter } from './modules/webhooks/routes.js';

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(cookieParser());

app.use('/api/webhooks', webhookRouter);   // BEFORE express.json(). Order is load-bearing.
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRouter);
app.use('/api/me', meRouter);
app.use('/api/org', orgRouter);
app.use('/api/members', membersRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/subscription', subscriptionRouter);
app.use('/api/plans', plansRouter);

// Feature routers mount here as later tasks add them.

app.use((req, res, next) => next(notFound()));
app.use(errorHandler);
