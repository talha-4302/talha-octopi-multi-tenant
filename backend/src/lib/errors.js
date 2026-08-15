import { ERROR_CODE } from './constants.js';

export class AppError extends Error {
  constructor(code, status, message, fields) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    if (fields) this.fields = fields;
  }
}

export const badRequest = (message, fields) =>
  new AppError(ERROR_CODE.VALIDATION_FAILED, 400, message, fields);

export const unauthorized = (code = ERROR_CODE.INVALID_CREDENTIALS, message = 'Invalid email or password.') =>
  new AppError(code, 401, message);

export const forbidden = (code = ERROR_CODE.FORBIDDEN_ROLE, message = 'You do not have access to this.') =>
  new AppError(code, 403, message);

export const notFound = (message = 'Not found.') =>
  new AppError(ERROR_CODE.NOT_FOUND, 404, message);

export const conflict = (code, message) =>
  new AppError(code, 409, message);
