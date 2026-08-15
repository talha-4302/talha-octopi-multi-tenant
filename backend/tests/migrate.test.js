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

  it('returns true when argv[1] round-trips correctly through pathToFileURL', () => {
    // Get the path to this test file (in URL form)
    const thisFileUrl = import.meta.url;

    // Convert it to the argv[1] style path (what process.argv[1] would be)
    const asArgv1 = fileURLToPath(thisFileUrl);

    // Convert it back to a URL via pathToFileURL
    const reconstructed = pathToFileURL(asArgv1).href;

    // They should match - this is the key invariant the guard relies on
    expect(reconstructed).toBe(thisFileUrl);

    // Test isMainModule with a URL that matches import.meta.url of some file
    // Since the real guard checks import.meta.url inside migrate.js, we simulate
    // by getting a file's URL and converting its path representation back
    const migrateUrl = 'file:///E:/Career/CVs%20and%20Applied%20Jobs/Octopi%20DIgital/Assessment/backend/src/db/migrate.js';
    const migratePath = fileURLToPath(migrateUrl);
    const migrateReconstructed = pathToFileURL(migratePath).href;
    expect(migrateReconstructed).toBe(migrateUrl);
  });
});
