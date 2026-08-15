import * as service from './service.js';
import * as plansService from '../plans/service.js';

export const listOrgs = async (req, res, next) => {
  try { res.json(await service.listOrgs(req.query)); } catch (e) { next(e); }
};

export const getOrgDetail = async (req, res, next) => {
  try { res.json(await service.getOrgDetail(req.params.orgId)); } catch (e) { next(e); }
};

export const listOrgTransactions = async (req, res, next) => {
  try {
    res.json(await service.listTransactions({ ...req.query, orgId: req.params.orgId }));
  } catch (e) { next(e); }
};

export const suspendOrg = async (req, res, next) => {
  try { res.json(await service.suspendOrg(req.params.orgId, req.body)); } catch (e) { next(e); }
};

export const reactivateOrg = async (req, res, next) => {
  try { await service.reactivateOrg(req.params.orgId); res.sendStatus(204); } catch (e) { next(e); }
};

export const getStats = async (req, res, next) => {
  try { res.json(await service.getStats()); } catch (e) { next(e); }
};

export const listTransactions = async (req, res, next) => {
  try { res.json(await service.listTransactions(req.query)); } catch (e) { next(e); }
};

export const listAllPlans = async (req, res, next) => {
  try { res.json(await plansService.listAllPlans()); } catch (e) { next(e); }
};

export const createPlan = async (req, res, next) => {
  try { res.status(201).json(await plansService.createPlan(req.body)); } catch (e) { next(e); }
};

export const updatePlan = async (req, res, next) => {
  try { res.json(await plansService.updatePlan(req.params.id, req.body)); } catch (e) { next(e); }
};
