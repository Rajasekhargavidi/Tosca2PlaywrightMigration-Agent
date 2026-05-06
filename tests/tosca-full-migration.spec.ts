/* AI Generated Code by Deloitte + Cursor (BEGIN) */
import path from 'path';
import { expect, test } from '@playwright/test';
import {
  loadToscaFullMigration,
  flattenTestcaseForPlaywright,
} from '../fixtures/structuredMigration';
import { tryGetMigrationDir } from '../fixtures/migrationPaths';
import {
  migrationDataRequestNote,
  needPlaywrightToscaFullMigration,
  needToscaMigrationFolder,
} from '../fixtures/migrationDataRequest';

test.describe('Tosca full migration JSON (playwright_tosca_full_migration.json)', () => {
  test('exists after npm run build:tosca-full and has phased testcases', () => {
    const dir = tryGetMigrationDir();
    if (!dir) test.skip(true, migrationDataRequestNote(needToscaMigrationFolder()));
    const fullPath = path.join(dir, 'playwright_tosca_full_migration.json');
    const doc = loadToscaFullMigration(dir);
    if (!doc) test.skip(true, migrationDataRequestNote(needPlaywrightToscaFullMigration(fullPath)));
    expect(doc.schemaVersion).toBeGreaterThanOrEqual(3);
    expect(doc.testcases?.length ?? 0).toBeGreaterThan(0);

    const flatAll = doc.testcases!.flatMap((t) => flattenTestcaseForPlaywright(t));
    const totalRows = flatAll.reduce((n, f) => n + f.rows.length, 0);
    expect(totalRows).toBeGreaterThan(0);
  });
});
/* AI Generated Code by Deloitte + Cursor (END) */
