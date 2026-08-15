import { z } from 'zod';
import { TRANSACTION_STATUS } from '../../lib/constants.js';
import { pageQuery } from '../../lib/pagination.js';

export const listTransactionsSchema = { query: z.object({
  ...pageQuery,
  status: z.enum(Object.values(TRANSACTION_STATUS)).optional(),
}) };
