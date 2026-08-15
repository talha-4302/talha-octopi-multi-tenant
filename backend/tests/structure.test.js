// backend/tests/structure.test.js
import { describe, it, expect } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// ponytail: fileURLToPath instead of .pathname for Windows path compatibility
const SRC = fileURLToPath(new URL('../src/', import.meta.url));

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const ALLOWED_ADMIN_POOL = [
  join('db', 'pool.js'),
  join('modules', 'admin'),
  join('jobs'),
  join('modules', 'auth', 'repository.js'),
];

describe('structural rule 4: the privileged pool stays where it was specified', () => {
  it('is imported only by modules/admin, jobs, and modules/auth/repository.js', async () => {
    const offenders = [];
    for (const file of await walk(SRC)) {
      const rel = relative(SRC, file);
      if (ALLOWED_ADMIN_POOL.some((p) => rel.startsWith(p))) continue;
      const src = await readFile(file, 'utf8');
      if (/\badminPool\b/.test(src)) offenders.push(rel.split(sep).join('/'));
    }
    expect(offenders).toEqual([]);
  });
});

describe('structural rule 1: no SQL outside a repository', () => {
  const SQL = /\b(SELECT|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b/i;

  it('finds no SQL statement in a non-repository file', async () => {
    const offenders = [];
    for (const file of await walk(SRC)) {
      const rel = relative(SRC, file);
      // db/ owns the primitives and the migration runner; migrations are .sql
      if (/repository\.js$/i.test(rel) || rel.startsWith('db' + sep)) continue;
      const src = await readFile(file, 'utf8');
      if (SQL.test(src)) offenders.push(rel.split(sep).join('/'));
    }
    expect(offenders).toEqual([]);
  });
});
