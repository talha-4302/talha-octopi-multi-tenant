// backend/tests/validate.test.js
import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { validate } from '../src/middleware/validate.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

function appWith(schema) {
  const a = express();
  a.use(express.json());
  a.post('/t', validate(schema), (req, res) => res.json(req.body));
  a.use(errorHandler);
  return a;
}

describe('validate', () => {
  const schema = { body: z.object({
    email: z.string().email().toLowerCase(),
    age: z.coerce.number().int().min(18),
  }) };

  it('passes parsed and coerced values through', async () => {
    const res = await request(appWith(schema)).post('/t').send({ email: 'A@B.COM', age: '21' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ email: 'a@b.com', age: 21 });
  });

  it('answers 400 with a field map the form can use', async () => {
    const res = await request(appWith(schema)).post('/t').send({ email: 'nope', age: 12 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(Object.keys(res.body.error.fields).sort()).toEqual(['age', 'email']);
  });

  it('strips unknown keys, so a client cannot smuggle extra fields into a handler', async () => {
    const res = await request(appWith(schema)).post('/t')
      .send({ email: 'a@b.com', age: 21, role: 'PLATFORM_ADMIN' });
    expect(res.body).not.toHaveProperty('role');
  });
});
