/* AI Generated Code by Deloitte + Cursor (BEGIN) */
import fs from 'fs';
import path from 'path';
import { expect, test } from '@playwright/test';
import {
  loadPlaywrightBufferMap,
  interpolateTemplates,
  getCombinedBuffers,
  expandRecordBufferTemplates,
} from '../fixtures/bufferMap';
import { extractRtbRefsFromRecord } from '../fixtures/rtbRefs';
import { tryGetMigrationDir } from '../fixtures/migrationPaths';
import {
  migrationDataRequestNote,
  needExpandableBufferStepRow,
  needFullMigrationTestcaseBodies,
  needPlaywrightBufferMap,
  needPlaywrightToscaFullMigration,
  needPrerequisiteGateActive,
  needRtbReferenceInExportJsonl,
  needSuiteTestStepValues,
  needSuiteTestStepValuesExpanded,
  needTestcasesJsonl,
  needTestcasesJsonlNonEmpty,
  needToscaMigrationFolder,
  needCombinedBufferStringLiterals,
  needTitleBufferLiteral,
} from '../fixtures/migrationDataRequest';
import {
  collectConfigurableStringsFromRecord,
  getMergedLiteralsWithPrerequisiteGatedOverlay,
} from '../fixtures/toscaTestcaseConfigurations';
test.describe.configure({ timeout: 60_000 });

test('playwright_buffer_map.json exists and parses', () => {
  const dir = tryGetMigrationDir();
  if (!dir) test.skip(true, migrationDataRequestNote(needToscaMigrationFolder()));
  const fp = path.join(dir, 'playwright_buffer_map.json');
  if (!fs.existsSync(fp)) test.skip(true, migrationDataRequestNote(needPlaywrightBufferMap(fp)));

  const bm = loadPlaywrightBufferMap(dir);
  expect(bm.schemaVersion ?? 2).toBeGreaterThanOrEqual(2);
  expect(getCombinedBuffers(bm)).toBeTruthy();
});

test('{B[]} interpolation uses merged buffer literals from export', () => {
  const dir = tryGetMigrationDir();
  if (!dir) test.skip(true, migrationDataRequestNote(needToscaMigrationFolder()));

  const bm = loadPlaywrightBufferMap(dir);
  const merged = getCombinedBuffers(bm);
  const keys = Object.keys(merged).filter((k) => typeof merged[k] === 'string' && merged[k]!.trim().length > 0);
  if (keys.length === 0) test.skip(true, migrationDataRequestNote(needCombinedBufferStringLiterals()));
  const key = keys[0];
  const combo = interpolateTemplates(`{B[${key}]}`, merged);
  expect(combo).toBe(merged[key]);
});

test('documentation: use combined map before page.fill()', () => {
  const dir = tryGetMigrationDir();
  if (!dir) test.skip(true, migrationDataRequestNote(needToscaMigrationFolder()));
  const bmp = path.join(dir, 'playwright_buffer_map.json');
  if (!fs.existsSync(bmp)) test.skip(true, migrationDataRequestNote(needPlaywrightBufferMap(bmp)));
  const bm = loadPlaywrightBufferMap(dir);
  const keys = Object.keys(getCombinedBuffers(bm)).slice(0, 12);
  console.log('[combined buffer/step keys sample]', keys);
  console.log('[hint]', bm.hint ?? '(none)');
});

test('expandRecordBufferTemplates clears {B[]} when export row only references keys present in buffer map', async () => {
  const dir = tryGetMigrationDir();
  if (!dir) test.skip(true, migrationDataRequestNote(needToscaMigrationFolder()));
  const rawPath = path.join(dir, 'suite_teststep_values.jsonl');
  if (!fs.existsSync(rawPath)) test.skip(true, migrationDataRequestNote(needSuiteTestStepValues(rawPath)));
  const merged = getCombinedBuffers(loadPlaywrightBufferMap(dir));
  const lines = (await fs.promises.readFile(rawPath, 'utf8')).split(/\r?\n/).filter(Boolean).slice(0, 300);
  let row: Record<string, unknown> | undefined;
  for (const line of lines) {
    const r = JSON.parse(line) as Record<string, unknown>;
    const s = JSON.stringify(r);
    if (!/\{B\[[^\]]+\]\}/.test(s)) continue;
    const names = [...s.matchAll(/\{B\[([^\]]+)\]\}/g)].map((m) => m[1].trim()).filter(Boolean);
    if (names.length > 0 && names.every((n) => Object.prototype.hasOwnProperty.call(merged, n))) {
      row = r;
      break;
    }
  }
  if (!row) {
    test.skip(true, migrationDataRequestNote(needExpandableBufferStepRow(300)));
    return;
  }

  const done = expandRecordBufferTemplates(row, merged);
  expect(JSON.stringify(done)).not.toMatch(/\{B\[/);
});

test('suite_teststep_values_expanded.jsonl lines use literals where buffer map has keys', async () => {
  const dir = tryGetMigrationDir();
  if (!dir) test.skip(true, migrationDataRequestNote(needToscaMigrationFolder()));
  const rawPath = path.join(dir, 'suite_teststep_values.jsonl');
  const expPath = path.join(dir, 'suite_teststep_values_expanded.jsonl');
  if (!fs.existsSync(expPath)) {
    test.skip(true, migrationDataRequestNote(needSuiteTestStepValuesExpanded(expPath)));
    return;
  }
  const bm = loadPlaywrightBufferMap(dir);
  const merged = getCombinedBuffers(bm);

  const expanded = await fs.promises.readFile(expPath, 'utf8');
  expect(expanded.trim().length).toBeGreaterThan(0);

  const raw = await fs.promises.readFile(rawPath, 'utf8').catch(() => '');
  const rawLines = raw.split(/\r?\n/).filter(Boolean);
  const expLines = expanded.split(/\r?\n/).filter(Boolean);

  if (rawLines.length > 0) expect(expLines.length).toBe(rawLines.length);

  function assertNoStalePlaceholders(v: unknown): void {
    if (typeof v === 'string') {
      for (const m of v.matchAll(/\{B\[([^\]]+)\]\}/g)) {
        const name = m[1].trim();
        const literal = merged[name];
        expect(
          literal !== undefined && v.includes(m[0]),
          `{B[${name}]} should be expanded (combined map has a value)`
        ).toBe(false);
      }
    } else if (Array.isArray(v)) {
      v.forEach(assertNoStalePlaceholders);
    } else if (v && typeof v === 'object') {
      Object.values(v).forEach(assertNoStalePlaceholders);
    }
  }

  for (let i = 0; i < Math.min(expLines.length, 50); i++) {
    assertNoStalePlaceholders(JSON.parse(expLines[i]) as Record<string, unknown>);
  }
});

test('prerequisite-gated testcase overlay keys come from prerequisite bracket refs (full migration)', () => {
  const dir = tryGetMigrationDir();
  if (!dir) test.skip(true, migrationDataRequestNote(needToscaMigrationFolder()));
  const fullPath = path.join(dir, 'playwright_tosca_full_migration.json');
  if (!fs.existsSync(fullPath)) test.skip(true, migrationDataRequestNote(needPlaywrightToscaFullMigration(fullPath)));
  const raw = fs.readFileSync(fullPath, 'utf8');
  const full = JSON.parse(raw) as { testcases?: unknown[]; testcaseMetaExported?: unknown[] };
  if (!full.testcases?.length || !full.testcaseMetaExported?.length)
    test.skip(true, migrationDataRequestNote(needFullMigrationTestcaseBodies()));

  const r = getMergedLiteralsWithPrerequisiteGatedOverlay(dir, { testcasePathSubstring: 'Thank' });
  if (!r.prerequisiteGateActive)
    test.skip(true, migrationDataRequestNote(needPrerequisiteGateActive('Thank')));

  for (const k of r.testcaseConfigOverlayKeys) {
    expect(
      r.prerequisiteReferencedBracketNames.has(k),
      `TestCase config key "${k}" must appear as a {PREFIX[name]} reference in prerequisites`
    ).toBe(true);
  }
});

test('collectConfigurableStringsFromRecord maps exported TestCase rows from testcases.jsonl', async () => {
  const dir = tryGetMigrationDir();
  if (!dir) test.skip(true, migrationDataRequestNote(needToscaMigrationFolder()));
  const fp = path.join(dir, 'testcases.jsonl');
  if (!fs.existsSync(fp)) test.skip(true, migrationDataRequestNote(needTestcasesJsonl(fp)));
  const line = (await fs.promises.readFile(fp, 'utf8')).split(/\r?\n/).find(Boolean);
  if (!line) test.skip(true, migrationDataRequestNote(needTestcasesJsonlNonEmpty(fp)));
  const row = JSON.parse(line) as Record<string, unknown>;
  const flat = collectConfigurableStringsFromRecord(row);
  expect(typeof flat).toBe('object');
});

test('extractRtbRefsFromRecord finds {RTB[…]} in exported JSONL rows', async () => {
  const dir = tryGetMigrationDir();
  if (!dir) test.skip(true, migrationDataRequestNote(needToscaMigrationFolder()));
  const candidates = [
    path.join(dir, 'suite_teststep_values.jsonl'),
    path.join(dir, 'Detailed_TestSteps.jsonl'),
  ];
  let row: Record<string, unknown> | undefined;
  for (const fp of candidates) {
    if (!fs.existsSync(fp)) continue;
    const lines = (await fs.promises.readFile(fp, 'utf8')).split(/\r?\n/).filter(Boolean).slice(0, 500);
    for (const line of lines) {
      const o = JSON.parse(line) as Record<string, unknown>;
      if (/\{RTB\[/i.test(JSON.stringify(o))) {
        row = o;
        break;
      }
    }
    if (row) break;
  }
  if (!row) {
    test.skip(
      true,
      migrationDataRequestNote(needRtbReferenceInExportJsonl('first 500 lines per file'))
    );
    return;
  }
  expect(extractRtbRefsFromRecord(row).length).toBeGreaterThan(0);
});

test('interpolateTemplates resolves {B[Title]} when export buffer map defines Title', () => {
  const dir = tryGetMigrationDir();
  if (!dir) test.skip(true, migrationDataRequestNote(needToscaMigrationFolder()));
  const merged = getCombinedBuffers(loadPlaywrightBufferMap(dir));
  if (typeof merged['Title'] !== 'string' || !merged['Title'].trim()) {
    test.skip(true, migrationDataRequestNote(needTitleBufferLiteral()));
    return;
  }
  expect(interpolateTemplates('{B[Title]}', merged)).toBe(merged['Title']);
});
/* AI Generated Code by Deloitte + Cursor (END) */
