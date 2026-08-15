import { describe, it, expect } from 'vitest';
import { env } from '../src/config/env.js';

describe('env config', () => {
  it('exposes every required variable', () => {
    for (const key of ['DATABASE_URL', 'ADMIN_DATABASE_URL', 'JWT_SECRET', 'APP_URL']) {
      expect(env[key], `${key} missing`).toBeTruthy();
    }
  });

  it('is frozen, so nothing can mutate config at runtime', () => {
    expect(Object.isFrozen(env)).toBe(true);
  });

  it('coerces PORT to a number', () => {
    expect(typeof env.PORT).toBe('number');
  });
});
