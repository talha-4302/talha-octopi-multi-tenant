import * as service from './registration.service.js';
import { setRefreshCookie } from '../../lib/cookies.js';

export async function register(req, res, next) {
  try {
    const { accessToken, refreshToken, user, checkoutUrl } = await service.register(req.body);
    setRefreshCookie(res, refreshToken);
    res.status(201).json({ accessToken, user, checkoutUrl });
  } catch (err) { next(err); }
}
