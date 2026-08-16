import { z } from 'zod';

export const updateMeSchema = { body: z.object({ name: z.string().trim().min(1).max(120) }) };
export const changePasswordSchema = { body: z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8).max(200),
}) };
