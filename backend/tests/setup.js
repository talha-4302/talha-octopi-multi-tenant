import { beforeAll, afterEach, afterAll } from 'vitest';
import { runMigrations } from '../src/db/migrate.js';
import { truncateAll } from './helpers/db.js';
import { appPool, adminPool } from '../src/db/pool.js';

beforeAll(async () => { await runMigrations(); });
afterEach(async () => { await truncateAll(); });
afterAll(async () => { await appPool.end(); await adminPool.end(); });
