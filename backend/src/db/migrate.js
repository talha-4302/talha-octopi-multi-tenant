import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';
import { env } from '../config/env.js';

const SCHEMA_FILE = join(dirname(fileURLToPath(import.meta.url)), 'schema.sql');

export async function runMigrations() {
  const client = new pg.Client({ connectionString: env.ADMIN_DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query("SELECT to_regclass('public.organizations') AS t");
    if (rows[0].t) return;

    const sql = await readFile(SCHEMA_FILE, 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql.replaceAll(':APP_PASSWORD', process.env.APP_PASSWORD));
      await client.query('COMMIT');
      console.log('schema applied');
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`schema apply failed: ${err.message}`);
    }
  } finally {
    await client.end();
  }
}

export function isMainModule(argv1) {
  return Boolean(argv1) && import.meta.url === pathToFileURL(argv1).href;
}

if (isMainModule(process.argv[1])) {
  runMigrations().catch((err) => { console.error(err); process.exit(1); });
}
