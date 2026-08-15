import { z } from 'zod';

// pageSize is capped at 100 by the schema, not by silent clamping,
// so an over-large request is a 400 rather than a surprise.
export const pageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};

export const offsetOf = ({ page, pageSize }) => (page - 1) * pageSize;

export const envelope = (data, total, { page, pageSize }) =>
  ({ data, meta: { page, pageSize, total } });
