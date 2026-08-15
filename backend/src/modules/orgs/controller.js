import * as service from './service.js';

export const getOrg = async (req, res, next) => {
  try { res.json(await service.getOrg(req.user)); } catch (e) { next(e); }
};
export const updateOrg = async (req, res, next) => {
  try { res.json(await service.updateOrg(req.user, req.body)); } catch (e) { next(e); }
};
