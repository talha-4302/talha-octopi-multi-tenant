// backend/src/middleware/validate.js
import { badRequest } from '../lib/errors.js';

const PARTS = ['body', 'query', 'params'];

export function validate(schemas) {
  return (req, res, next) => {
    for (const part of PARTS) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part]);
      if (!result.success) {
        const fields = {};
        for (const issue of result.error.issues) {
          fields[issue.path.join('.') || part] = issue.message;
        }
        return next(badRequest('Please check the highlighted fields.', fields));
      }
      // Zod objects strip unknown keys by default, so this also removes smuggled fields.
      req[part] = result.data;
    }
    return next();
  };
}
