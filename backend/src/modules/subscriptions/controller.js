import * as service from './service.js';

export const getSubscription = async (req, res, next) => {
  try { res.json(await service.getSubscription(req.user)); } catch (e) { next(e); }
};
