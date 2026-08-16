import { z } from 'zod';

export const checkoutSchema = { body: z.object({ planId: z.string().uuid().optional() }) };
export const changePlanSchema = { body: z.object({ planId: z.string().uuid() }) };
