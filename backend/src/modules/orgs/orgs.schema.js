import { z } from 'zod';

export const updateOrgSchema = { body: z.object({
  name: z.string().trim().min(2).max(100).optional(),
  contactEmail: z.string().trim().toLowerCase().email().max(255).nullable().optional(),
  billingEmail: z.string().trim().toLowerCase().email().max(255).optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update.' }) };
