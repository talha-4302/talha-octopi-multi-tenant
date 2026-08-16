import pg from 'pg';
import { env } from '../config/env.js';

// RLS applies. Everything goes through this unless explicitly privileged.
export const appPool = new pg.Pool({ connectionString: env.DATABASE_URL });

// RLS bypassed. Importable ONLY by modules/admin/, jobs/, and
// modules/auth/auth.repository.js. A grep test enforces this.
export const adminPool = new pg.Pool({ connectionString: env.ADMIN_DATABASE_URL });
