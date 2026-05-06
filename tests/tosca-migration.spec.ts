/* AI Generated Code by Deloitte + Cursor (BEGIN) */
import fs from 'fs';
import path from 'path';
import { test, expect } from '@playwright/test';
import { readManifest, tryGetMigrationDir } from '../fixtures/migrationPaths';
import { loadJsonl } from '../fixtures/readJsonl';
import { buildLocatorSuggestion } from '../fixtures/locatorHints';
import { loadMigrationBundle } from '../fixtures/fullMigrationMap';
import {
  migrationDataRequestNote,
  needMigrationBundleReport,
  needMigrationManifest,
  needModulesAttributesJsonl,
  needTestcasesJsonl,
  needToscaMigrationFolder,
} from '../fixtures/migrationDataRequest';

const dir = (): string => tryGetMigrationDir();

test.describe.configure({ timeout: 120_000 });

test('migration manifest advises JSONL primary', () => {
  const migrationDir = dir();
  if (!migrationDir) test.skip(true, migrationDataRequestNote(needToscaMigrationFolder()));
  const manifestPath = path.join(migrationDir, 'manifest.json');
  if (!fs.existsSync(manifestPath))
    test.skip(true, migrationDataRequestNote(needMigrationManifest(manifestPath)));
  const m = readManifest(migrationDir);
  expect(m?.primaryForPlaywright ?? '').toMatch(/\.jsonl$/);
});

test('modules_attributes.jsonl — rows contain Tosca locator fields', async () => {
  const migrationDir = dir();
  if (!migrationDir) test.skip(true, migrationDataRequestNote(needToscaMigrationFolder()));
  const fp = path.join(migrationDir, 'modules_attributes.jsonl');
  if (!fs.existsSync(fp)) test.skip(true, migrationDataRequestNote(needModulesAttributesJsonl(fp)));

  const rows = await loadJsonl(fp, 200);
  expect(rows.length).toBeGreaterThan(0);
  const typed = rows.find(
    (r: Record<string, unknown>) =>
      r.__type === 'XModuleAttribute' || String(r.__type ?? '').includes('Module')
  ) as Record<string, unknown> | undefined;
  const row = (typed ?? (rows[0] as Record<string, unknown>));
  expect(row.__type || row.__title).toBeTruthy();
  const hint = buildLocatorSuggestion(row);
  console.log('[sample locator hint]', hint ?? '(no heuristic match)');
});

test('testcases.jsonl — includes TestCase records', async () => {
  const migrationDir = dir();
  if (!migrationDir) test.skip(true, migrationDataRequestNote(needToscaMigrationFolder()));
  const fp = path.join(migrationDir, 'testcases.jsonl');
  if (!fs.existsSync(fp)) test.skip(true, migrationDataRequestNote(needTestcasesJsonl(fp)));

  const rows = await loadJsonl(fp, 50);
  expect(rows.length).toBeGreaterThan(0);
  const anyPath = rows.some((r: Record<string, unknown>) =>
    typeof r['(R)NodePath'] === 'string' ? (r['(R)NodePath'] as string).length > 0 : false
  );
  expect(anyPath).toBeTruthy();
});

test('playwright_migration_bundle.json — merged literals report (when built)', () => {
  const migrationDir = dir();
  if (!migrationDir) test.skip(true, migrationDataRequestNote(needToscaMigrationFolder()));
  const bundlePath = path.join(migrationDir, 'playwright_migration_bundle.json');
  const b = loadMigrationBundle(migrationDir);
  if (!b) {
    test.skip(true, migrationDataRequestNote(needMigrationBundleReport(bundlePath)));
    return;
  }
  expect(b.schemaVersion).toBeTruthy();
  expect(b.counts?.mergedLiteralKeys ?? 0).toBeGreaterThan(0);
});

test('smoke navigation using BASE_URL (independent of Tosca payloads)', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Example Domain/i);
});
/* AI Generated Code by Deloitte + Cursor (END) */
