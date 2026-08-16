import * as service from './me.service.js';

export const getMe = async (req, res, next) => {
  try { res.json(await service.getMe(req.user)); } catch (e) { next(e); }
};
export const updateMe = async (req, res, next) => {
  try { res.json(await service.updateMe(req.user, req.body)); } catch (e) { next(e); }
};
export const changePassword = async (req, res, next) => {
  try { await service.changePassword(req.user, req.body); res.sendStatus(204); } catch (e) { next(e); }
};
