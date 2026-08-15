import jwt from 'jsonwebtoken';
import { verifyAccessToken } from '../lib/jwt.js';
import { unauthorized } from '../lib/errors.js';
import { ERROR_CODE } from '../lib/constants.js';

export function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(unauthorized(ERROR_CODE.TOKEN_INVALID, 'Sign in to continue.'));

  try {
    const { userId, orgId, role } = verifyAccessToken(token);
    req.user = { userId, orgId, role };
    return next();
  } catch (err) {
    // The client only refreshes on TOKEN_EXPIRED, so the two must stay distinct.
    const code = err instanceof jwt.TokenExpiredError
      ? ERROR_CODE.TOKEN_EXPIRED : ERROR_CODE.TOKEN_INVALID;
    return next(unauthorized(code, 'Your session has ended. Sign in again.'));
  }
}
