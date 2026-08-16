import { z } from 'zod';
import { ORG_STATUS, TRANSACTION_STATUS } from '../../lib/constants.js';
import { pageQuery } from '../../lib/pagination.js';

export const listOrgsSchema = { query: z.object({
  ...pageQuery,
  search: z.string().trim().min(1).max(100).optional(),
  status: z.enum(Object.values(ORG_STATUS)).optional(),
}) };

export const orgIdSchema = { params: z.object({ orgId: z.string().uuid() }) };

export const suspendSchema = {
  params: z.object({ orgId: z.string().uuid() }),
  body: z.object({ reason: z.string().trim().min(1).max(500) }),
};

export const platformTransactionsSchema = { query: z.object({
  ...pageQuery,
  orgId: z.string().uuid().optional(),
  status: z.enum(Object.values(TRANSACTION_STATUS)).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}) };

export const createPlanSchema = { body: z.object({
  name: z.string().trim().min(1).max(60),
  priceCents: z.number().int().min(0),
  currency: z.string().trim().toLowerCase().length(3).default('usd'),
  interval: z.enum(['month', 'year']),
  features: z.array(z.string().max(200)).max(20).default([]),
  maxMembers: z.number().int().min(1),
}) };

export const updatePlanSchema = {
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    name: z.string().trim().min(1).max(60).optional(),
    priceCents: z.number().int().min(0).optional(),
    features: z.array(z.string().max(200)).max(20).optional(),
    maxMembers: z.number().int().min(1).optional(),
    isActive: z.boolean().optional(),
  }).refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update.' }),
};
