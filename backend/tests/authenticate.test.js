import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { signAccessToken } from '../src/lib/jwt.js';
import { authenticate } from '../src/middleware/authenticate.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { env } from '../src/config/env.js';
import { ROLES } from '../src/lib/constants.js';

const app = express();
app.get('/t', authenticate, (req, res) => res.json(req.user));
app.use(errorHandler);

const claims = { userId: 'u1', orgId: 'o1', role: ROLES.ORG_ADMIN };

describe('authenticate', () => {
  it('attaches the three claims the tenant helper needs', async () => {
    const res = await request(app).get('/t')
      .set('Authorization', `Bearer ${signAccessToken(claims)}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(claims);
  });

  it('answers 401 with no header, never 403', async () => {
    const res = await request(app).get('/t');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
  });

  it('distinguishes an expired token from an invalid one', async () => {
    const expired = jwt.sign(claims, env.JWT_SECRET, { expiresIn: '-1s' });
    const res = await request(app).get('/t').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('rejects a token signed with the wrong secret', async () => {
    const forged = jwt.sign(claims, 'not-the-secret');
    const res = await request(app).get('/t').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
  });
});
