import * as service from './transactions.service.js';

export const listTransactions = async (req, res, next) => {
  try { res.json(await service.listTransactions(req.user, req.query)); } catch (e) { next(e); }
};
