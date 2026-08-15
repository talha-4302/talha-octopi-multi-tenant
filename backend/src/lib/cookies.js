import { env } from '../config/env.js';

const NAME = 'rt';

const options = () => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  // Lax is enough while frontend and backend share a site. A deployment that
  // splits them across domains needs None plus Secure, hence the env flag.
  sameSite: env.COOKIE_SECURE ? 'none' : 'lax',
  path: '/api/auth',
  maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
});

export const setRefreshCookie = (res, raw) => res.cookie(NAME, raw, options());
export const clearRefreshCookie = (res) => res.clearCookie(NAME, { path: '/api/auth' });
export const readRefreshCookie = (req) => req.cookies?.[NAME];
