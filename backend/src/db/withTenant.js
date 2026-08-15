import { appPool } from './pool.js';

// The only transaction primitive in this codebase. There is no second helper.
export async function withTenant(orgId, fn) {
  const client = await appPool.connect();
  try {
    await client.query('BEGIN');
    // SET LOCAL does not accept bind parameters; set_config does.
    // The third argument true makes the setting transaction-local, so it
    // cannot leak to whichever request borrows this pooled connection next.
    await client.query('SELECT set_config($1, $2, true)', ['app.current_org_id', orgId]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
