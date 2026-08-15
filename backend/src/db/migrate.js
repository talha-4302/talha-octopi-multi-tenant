import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';
import { env } from '../config/env.js';

const DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

export async function runMigrations() {
  const client = new pg.Client({ connectionString: env.ADMIN_DATABASE_URL });
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`);

    const applied = new Set(
      (await client.query('SELECT filename FROM schema_migrations')).rows.map((r) => r.filename)
    );
    const files = (await readdir(DIR)).filter((f) => f.endsWith('.sql')).sort();

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await readFile(join(DIR, file), 'utf8');
      // each migration is one transaction, so a failure leaves nothing half-applied
      await client.query('BEGIN');
      try {
        await client.query(sql.replaceAll(':APP_PASSWORD', process.env.APP_PASSWORD));
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`applied ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`migration ${file} failed: ${err.message}`);
      }
    }
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runMigrations().catch((err) => { console.error(err); process.exit(1); });
}
