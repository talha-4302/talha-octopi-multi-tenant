import { AppError } from '../lib/errors.js';
import { ERROR_CODE } from '../lib/constants.js';

// eslint-disable-next-line no-unused-vars -- Express identifies handlers by arity
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    const error = { code: err.code, message: err.message };
    if (err.fields) error.fields = err.fields;
    return res.status(err.status).json({ error });
  }

  // Anything else is a bug. Log it in full, tell the client nothing.
  console.error('[unhandled]', err);
  return res.status(500).json({
    error: { code: ERROR_CODE.INTERNAL, message: 'Something went wrong.' },
  });
}
