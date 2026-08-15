import { z } from 'zod';
import { ROLES, USER_STATUS } from '../../lib/constants.js';
import { pageQuery } from '../../lib/pagination.js';

// PLATFORM_ADMIN is absent on purpose: it is not an invitable role.
const invitableRole = z.enum([ROLES.ORG_ADMIN, ROLES.ORG_MEMBER]);

export const listMembersSchema = { query: z.object({
  ...pageQuery,
  status: z.enum(Object.values(USER_STATUS)).optional(),
}) };

export const inviteSchema = { body: z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  name: z.string().trim().min(1).max(120),
  role: invitableRole,
}) };

export const memberIdSchema = { params: z.object({ id: z.string().uuid() }) };
export const changeRoleSchema = {
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ role: invitableRole }),
};
