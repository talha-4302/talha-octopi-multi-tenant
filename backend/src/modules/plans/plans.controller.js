import * as service from './service.js';

export const listPlans = async (req, res, next) => {
  try { res.json(await service.listActivePlans()); } catch (e) { next(e); }
};
