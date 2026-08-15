// backend/src/app.js
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './lib/errors.js';

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(cookieParser());

// 2. Webhook route mounts HERE, before express.json(). Added in Task 26.

app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Feature routers mount here as later tasks add them.

app.use((req, res, next) => next(notFound()));
app.use(errorHandler);
