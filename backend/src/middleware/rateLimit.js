// backend/src/middleware/rateLimit.js
import rateLimit from 'express-rate-limit';
import { ERROR_CODE } from '../lib/constants.js';
import { env } from '../config/env.js';

const shared = {
  standardHeaders: true,
  legacyHeaders: false,
  // disabled under test so the suite is not rate limited by its own fixtures
  skip: () => env.NODE_ENV === 'test',
  handler: (req, res) => res.status(429).json({
    error: { code: ERROR_CODE.RATE_LIMITED, message: 'Too many attempts. Try again shortly.' },
  }),
};

// login, register
export const authLimiter = rateLimit({ ...shared, windowMs: 15 * 60 * 1000, limit: 10 });

// forgot password, reset password, accept invite
export const strictLimiter = rateLimit({ ...shared, windowMs: 60 * 60 * 1000, limit: 5 });
