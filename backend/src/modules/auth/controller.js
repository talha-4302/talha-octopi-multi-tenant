// HTTP only. No business logic below this line lives here.
import * as service from './service.js';
import { revokeToken } from './refreshService.js';
import { setRefreshCookie, clearRefreshCookie, readRefreshCookie } from '../../lib/cookies.js';

export async function login(req, res, next) {
  try {
    const { accessToken, refreshToken, user } = await service.login(req.body);
    setRefreshCookie(res, refreshToken);
    res.json({ accessToken, user });
  } catch (err) { next(err); }
}

export async function refresh(req, res, next) {
  try {
    const { accessToken, refreshToken, user } = await service.refresh(readRefreshCookie(req));
    setRefreshCookie(res, refreshToken);
    res.json({ accessToken, user });
  } catch (err) { next(err); }
}

export async function logout(req, res, next) {
  try {
    const raw = readRefreshCookie(req);
    if (raw) await revokeToken(raw);
    clearRefreshCookie(res);
    res.sendStatus(204);
  } catch (err) { next(err); }
}

export async function forgotPassword(req, res, next) {
  try {
    await service.forgotPassword(req.body);
    // 202 regardless. See the service comment.
    res.status(202).json({ message: 'If that address has an account, a reset link is on its way.' });
  } catch (err) { next(err); }
}

export async function resetPassword(req, res, next) {
  try {
    await service.resetPassword(req.body);
    res.sendStatus(204);
  } catch (err) { next(err); }
}

export async function describeInvite(req, res, next) {
  try { res.json(await service.describeInvite(req.params.token)); }
  catch (err) { next(err); }
}

export async function acceptInvite(req, res, next) {
  try { await service.acceptInvite(req.body); res.sendStatus(204); }
  catch (err) { next(err); }
}
