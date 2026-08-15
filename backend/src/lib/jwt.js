import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

// Carries orgId so the tenant helper needs no extra lookup per request.
export const signAccessToken = ({ userId, orgId, role }) =>
  jwt.sign({ userId, orgId, role }, env.JWT_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL });

export const verifyAccessToken = (token) => jwt.verify(token, env.JWT_SECRET);
