import { z } from 'zod';

export const registerSchema = { body: z.object({
  organizationName: z.string().trim().min(2).max(100),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(8).max(200),
  planId: z.string().uuid(),
}) };
