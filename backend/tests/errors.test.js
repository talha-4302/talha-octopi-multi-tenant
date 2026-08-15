import { describe, it, expect, vi } from 'vitest';
import { AppError, notFound, conflict } from '../src/lib/errors.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { ERROR_CODE } from '../src/lib/constants.js';

function fakeRes() {
  return { statusCode: null, body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; } };
}

describe('error pipeline', () => {
  it('shapes an AppError into the one error envelope', () => {
    const res = fakeRes();
    errorHandler(notFound(), {}, res, () => {});
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: { code: ERROR_CODE.NOT_FOUND, message: expect.any(String) } });
  });

  it('includes fields only when they were supplied', () => {
    const res = fakeRes();
    const err = new AppError(ERROR_CODE.VALIDATION_FAILED, 400, 'Invalid input', { email: 'Required' });
    errorHandler(err, {}, res, () => {});
    expect(res.body.error.fields).toEqual({ email: 'Required' });
  });

  it('never leaks an unknown error, answering a generic 500 instead', () => {
    const res = fakeRes();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    errorHandler(new Error('connection string postgres://user:hunter2@host'), {}, res, () => {});
    expect(res.statusCode).toBe(500);
    expect(res.body.error.code).toBe(ERROR_CODE.INTERNAL);
    expect(JSON.stringify(res.body)).not.toContain('hunter2');
    expect(res.body.error).not.toHaveProperty('stack');
    spy.mockRestore();
  });

  it('gives conflict a 409 and carries the supplied code through', () => {
    const res = fakeRes();
    errorHandler(conflict(ERROR_CODE.LAST_ADMIN, 'Cannot remove the last admin'), {}, res, () => {});
    expect(res.statusCode).toBe(409);
    expect(res.body.error.code).toBe(ERROR_CODE.LAST_ADMIN);
  });
});
