import { beforeAll, afterEach, afterAll, vi } from 'vitest';
import { runMigrations } from '../src/db/migrate.js';
import { truncateAll } from './helpers/db.js';
import { appPool, adminPool } from '../src/db/pool.js';

// The Resend client is stubbed globally, so no suite makes a real network call
// just by triggering notify(). A suite that asserts on send() itself still
// spies on this same mock with vi.spyOn(transport, 'send').
vi.mock('../src/lib/email/transport.js', () => ({ send: vi.fn().mockResolvedValue({ id: 'stub' }) }));

beforeAll(async () => { await runMigrations(); });
afterEach(async () => { await truncateAll(); });
afterAll(async () => { await appPool.end(); await adminPool.end(); });
