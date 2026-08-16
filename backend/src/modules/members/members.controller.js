import * as service from './service.js';

export const listMembers = async (req, res, next) => {
  try { res.json(await service.listMembers(req.user, req.query)); } catch (e) { next(e); }
};
export const inviteMember = async (req, res, next) => {
  try { res.status(201).json(await service.inviteMember(req.user, req.body)); } catch (e) { next(e); }
};
export const changeRole = async (req, res, next) => {
  try { res.json(await service.changeRole(req.user, req.params.id, req.body)); } catch (e) { next(e); }
};
export const removeMember = async (req, res, next) => {
  try { await service.removeMember(req.user, req.params.id); res.sendStatus(204); } catch (e) { next(e); }
};
