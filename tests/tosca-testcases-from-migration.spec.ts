/* AI Generated Code by Deloitte + Cursor (BEGIN) */
import fs from 'fs';
import path from 'path';
import { test, expect } from '@playwright/test';
import {
  testcaseJsonlPath,
  loadTestcasesJsonlSync,
  playbookTitles,
  type ToscaTestcaseRow,
} from '../fixtures/toscaTestcases';
import { tryGetMigrationDir } from '../fixtures/migrationPaths';
import { useCodegenInsteadOfJsonlHarness } from '../fixtures/migratedPlaywrightLayout';
import {
  migrationDataRequestNote,
  needTestcasesJsonl,
  needTestcasesJsonlNonEmpty,
  needToscaMigrationFolder,
  needToscaSutUrl,
} from '../fixtures/migrationDataRequest';

const dir = tryGetMigrationDir();
const tcPath = dir ? testcaseJsonlPath(dir) : '';
const rows = tcPath && fs.existsSync(tcPath) ? loadTestcasesJsonlSync(tcPath) : [];
const titles = playbookTitles(rows);
/** Segmented codegen under **`tests/migrated/testcase/`** OR legacy **`tests/generated/tosca-testcases.spec.ts`** — run **`npm run generate:tosca-tests`** */
const useGeneratedSpec = useCodegenInsteadOfJsonlHarness(__dirname);

test.describe.configure({ timeout: 120_000 });

if (!useGeneratedSpec) {
  if (!dir) {
    test.describe('Tosca testcases (from migration)', () => {
      test('needs TOSCA_MIGRATION_DIR and testcases.jsonl', () => {
        test.skip(true, migrationDataRequestNote(needToscaMigrationFolder()));
      });
    });
  } else if (!fs.existsSync(tcPath)) {
    test.describe('Tosca testcases (from migration)', () => {
      test('missing testcases.jsonl under migration dir', () => {
        test.skip(true, migrationDataRequestNote(needTestcasesJsonl(tcPath)));
      });
    });
  } else if (rows.length === 0) {
    test.describe('Tosca testcases (from migration)', () => {
      test('testcases.jsonl has no TestCase rows — adjust Export_TestCases.tcs tree', () => {
        test.skip(true, migrationDataRequestNote(needTestcasesJsonlNonEmpty(tcPath)));
      });
    });
  } else {
    test.describe('Tosca testcases (from migration)', () => {
      rows.forEach((row: ToscaTestcaseRow, i: number) => {
        test(titles[i], async ({ page }, testInfo) => {
          const nodePath = typeof row['(R)NodePath'] === 'string' ? row['(R)NodePath'] : '';
          testInfo.annotations.push({ type: 'tosca-node-path', description: nodePath || '(missing path)' });

          expect(
            typeof row.__title === 'string' ||
              typeof row.Name === 'string' ||
              nodePath.length > 0
          ).toBeTruthy();

          const sut = (process.env.TOSCA_SUT_URL ?? '').trim();
          if (!sut) {
            test.skip(true, migrationDataRequestNote(needToscaSutUrl()));
            return;
          }

          await page.goto(sut, { waitUntil: 'domcontentloaded' });
          await expect(page.locator('body')).toBeAttached();
        });
      });
    });
  }
}
/* AI Generated Code by Deloitte + Cursor (END) */
