// backend/src/app.js
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './lib/errors.js';
import { authRouter } from './routes/auth.routes.js';
import { meRouter } from './routes/me.routes.js';
import { orgRouter } from './routes/orgs.routes.js';
import { membersRouter } from './routes/members.routes.js';
import { transactionsRouter } from './routes/transactions.routes.js';
import { subscriptionRouter } from './routes/subscriptions.routes.js';
import { billingRouter } from './routes/billing.routes.js';
import { plansRouter } from './routes/plans.routes.js';
import { webhookRouter } from './routes/webhooks.routes.js';
import { adminRouter } from './routes/admin.routes.js';

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
app.use('/api/billing', billingRouter);
app.use('/api/plans', plansRouter);
app.use('/api/admin', adminRouter);

app.use((req, res, next) => next(notFound()));
app.use(errorHandler);
