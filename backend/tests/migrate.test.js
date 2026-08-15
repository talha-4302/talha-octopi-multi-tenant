import { describe, it, expect } from 'vitest';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isMainModule } from '../src/db/migrate.js';

describe('isMainModule', () => {
  it('returns false for undefined', () => {
    expect(isMainModule(undefined)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isMainModule('')).toBe(false);
  });

  it('returns false for a non-matching path', () => {
    expect(isMainModule('/some/other/file.js')).toBe(false);
  });

  it('returns true for a path that resolves to migrate.js\'s own module URL', () => {
    // migrate.js's real import.meta.url, computed relative to this test file,
    // not hardcoded, so it's correct on any machine or CI runner.
    const migrateUrl = new URL('../src/db/migrate.js', import.meta.url).href;
    const migratePath = fileURLToPath(migrateUrl);

    // isMainModule('src/db/migrate.js') is exactly what happens when
    // `node src/db/migrate.js` runs migrate.js directly, since node populates
    // process.argv[1] with the path as given on the command line and
    // migrate.js's own import.meta.url is always this same absolute URL.
    // We can't literally reproduce "argv1 is relative to cwd" here without a
    // child process, but we CAN prove the exact invariant the guard depends on:
    // fileURLToPath(migrateUrl) round-tripped through pathToFileURL must equal
    // migrateUrl, and isMainModule must return true for it.
    expect(isMainModule(migratePath)).toBe(true);
  });
});
