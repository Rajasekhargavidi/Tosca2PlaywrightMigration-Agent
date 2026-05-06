/* AI Generated Code by Deloitte + Cursor (BEGIN) */
import fs from 'fs';
import path from 'path';
import { test, expect } from '@playwright/test';
import { getMergedLiteralsWithPrerequisiteGatedOverlay } from '../fixtures/toscaTestcaseConfigurations';
import { tryGetMigrationDir } from '../fixtures/migrationPaths';
import {
  migrationDataRequestNote,
  needBundleOrBufferMap,
  needThankYouNavigationData,
  needToscaMigrationFolder,
} from '../fixtures/migrationDataRequest';

function migrationDirResolved(): string {
  return tryGetMigrationDir();
}

/** Prefer env; else try buffer / bundle literal keys Tosca often uses for the published Thank You URL */
const THANK_YOU_URL_LITERAL_KEYS = [
  'ThankYouPageUrl',
  'ThankYouPageURL',
  'ThankYouURL',
  'THANK_YOU_PAGE_URL',
  'ThankYouUrl',
  'Thank You Page URL',
] as const;

function pickThankYouUrlFromMerged(
  merged: Record<string, string>,
  prerequisiteGateActive: boolean,
  prerequisiteReferencedBracketNames: Set<string>,
  testcaseConfigOverlayKeys: Set<string>
): string {
  for (const k of THANK_YOU_URL_LITERAL_KEYS) {
    const v = merged[k];
    if (typeof v !== 'string') continue;
    /** TestCase configuration overlays require a matching **`{PREFIX[k]}`** in prerequisites when gating applies. */
    const valueFromTcConfigOnly = testcaseConfigOverlayKeys.has(k);
    if (prerequisiteGateActive && valueFromTcConfigOnly && !prerequisiteReferencedBracketNames.has(k)) continue;
    const t = v.trim().replace(/^["']|["']$/g, '');
    if (/^https?:\/\//i.test(t)) return t;
  }
  return '';
}

test.describe('Thank You (from Tosca buffer export)', () => {
  test.describe.configure({ timeout: 90_000 });

  test('template title, subtitle, and text appear on THANK_YOU_PAGE_URL', async ({ page }) => {
    const dir = migrationDirResolved();

    if (!dir) test.skip(true, migrationDataRequestNote(needToscaMigrationFolder()));
    const mapPath = path.join(dir, 'playwright_buffer_map.json');
    const bundlePath = path.join(dir, 'playwright_migration_bundle.json');
    if (!fs.existsSync(mapPath) && !fs.existsSync(bundlePath))
      test.skip(true, migrationDataRequestNote(needBundleOrBufferMap(mapPath, bundlePath)));

    const {
      merged,
      prerequisiteGateActive,
      prerequisiteReferencedBracketNames,
      testcaseConfigOverlayKeys,
    } = getMergedLiteralsWithPrerequisiteGatedOverlay(dir, { testcasePathSubstring: 'Thank' });
    const url =
      (process.env.THANK_YOU_PAGE_URL ?? '').trim() ||
      pickThankYouUrlFromMerged(
        merged,
        prerequisiteGateActive,
        prerequisiteReferencedBracketNames,
        testcaseConfigOverlayKeys
      );

    if (!url) test.skip(true, migrationDataRequestNote(needThankYouNavigationData()));
    const title = merged['ThankYouTitle'];
    const subtitle = merged['ThankYouSubtitle'];
    const body = merged['ThankYouText'];

    expect(title, 'Combined buffer map must include ThankYouTitle from Detailed_TestSteps / buffer extract').toBeTruthy();

    await page.goto(url, { waitUntil: 'domcontentloaded' });

    await expect(page.getByText(title!, { exact: false }).first()).toBeVisible({ timeout: 30_000 });
    if (subtitle) {
      await expect(page.getByText(subtitle, { exact: false }).first()).toBeVisible({ timeout: 15_000 });
    }
    if (body) {
      await expect(page.getByText(body, { exact: false }).first()).toBeVisible({ timeout: 15_000 });
    }
  });
});
/* AI Generated Code by Deloitte + Cursor (END) */
