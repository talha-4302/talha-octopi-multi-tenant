import * as service from './subscriptions.service.js';

export const getSubscription = async (req, res, next) => {
  try { res.json(await service.getSubscription(req.user)); } catch (e) { next(e); }
};

export const createCheckout = async (req, res, next) => {
  try { res.json(await service.createCheckout(req.user, req.body)); } catch (e) { next(e); }
};
export const changePlan = async (req, res, next) => {
  try { res.json(await service.changePlan(req.user, req.body)); } catch (e) { next(e); }
};
export const cancelSubscription = async (req, res, next) => {
  try { await service.cancelSubscription(req.user); res.sendStatus(204); } catch (e) { next(e); }
};
export const createPortalSession = async (req, res, next) => {
  try { res.json(await service.createPortalSession(req.user)); } catch (e) { next(e); }
};
