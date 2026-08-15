import { forbidden } from '../lib/errors.js';

// 403 before any work happens. Roles are compared against frozen constants,
// never bare string literals, so a typo is a TypeError at import time.
export function authorize(...roles) {
  return (req, res, next) =>
    roles.includes(req.user?.role) ? next() : next(forbidden());
}
