import { z } from 'zod';

const email = z.string().trim().toLowerCase().email().max(255);
const password = z.string().min(8).max(200);

export const loginSchema = { body: z.object({ email, password: z.string().min(1).max(200) }) };
export const forgotSchema = { body: z.object({ email }) };
export const resetSchema = { body: z.object({ token: z.string().min(1), password }) };
export const acceptInviteSchema = { body: z.object({ token: z.string().min(1), password }) };
export const tokenParamSchema = { params: z.object({ token: z.string().min(1) }) };
