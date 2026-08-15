import { randomUUID } from 'node:crypto';
import { adminPool } from '../../src/db/pool.js';
import { hashPassword } from '../../src/lib/password.js';
import { ROLES, USER_STATUS } from '../../src/lib/constants.js';

export async function makeUser({
  orgId, role = ROLES.ORG_MEMBER, status = USER_STATUS.ACTIVE,
  password = 'Passw0rd!', name = 'Test User', email,
} = {}) {
  const id = randomUUID();
  const address = email || `u+${id}@example.com`;
  const hash = status === USER_STATUS.INVITED ? null : await hashPassword(password);
  await adminPool.query(
    `INSERT INTO users (id, org_id, email, password_hash, name, role, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id, orgId, address, hash, name, role, status]);
  return { id, email: address, password, orgId, role };
}
