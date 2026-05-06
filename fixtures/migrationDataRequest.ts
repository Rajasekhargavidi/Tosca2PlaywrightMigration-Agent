/* AI Generated Code by Deloitte + Cursor (BEGIN) */
/**
 * Structured prompts when migration **real data** is missing: agents/tests should prefer exports from disk,
 * never dummy payloads. Use **`migrationDataRequestNote`** in **`test.skip`** messages (and copy the same text
 * when asking the user in chat).
 */

export type MigrationDataNeed = {
  /** What is missing (file, env var, row shape, …) */
  what: string;
  /** Why this test or automation step depends on it */
  why: string;
  /** When it must exist (ordering vs pipeline / local run) */
  when: string;
  /** Where to put it or which path/env points to it */
  where: string;
  /** How to produce it (Tosca export, npm script, …) — optional */
  how?: string;
};

export function migrationDataRequestNote(n: MigrationDataNeed): string {
  const lines = [
    '[Needs real migration data — ask user]',
    `What: ${n.what}`,
    `Why: ${n.why}`,
    `When: ${n.when}`,
    `Where: ${n.where}`,
  ];
  if (n.how) lines.push(`How: ${n.how}`);
  return lines.join('\n');
}

/** Standard **`TOSCA_MIGRATION_DIR`** prompt for all **`tosca-*.spec.ts`** that read exports. */
export function needToscaMigrationFolder(): MigrationDataNeed {
  return {
    what: 'Absolute path to the Tosca migration output folder',
    why: 'These specs assert against real exported JSON/JSONL; they do not use fabricated records.',
    when: 'Before running `playwright test tests/tosca-*.spec.ts` or the migration npm scripts that consume exports.',
    where: 'PowerShell: `$env:TOSCA_MIGRATION_DIR = <absolute folder>` ; bash: `export TOSCA_MIGRATION_DIR=<absolute folder>`. The folder must exist and contain exported artifacts (e.g. playwright_buffer_map.json, testcases.jsonl).',
    how: 'Run your Tosca migration export (e.g. `Run-ToscaMigration.ps1`) targeting the workspace export directory, then set `TOSCA_MIGRATION_DIR` to that same folder.',
  };
}

export function needPlaywrightBufferMap(absolutePath: string): MigrationDataNeed {
  return {
    what: `File ${absolutePath}`,
    why: 'Buffer map is the merged source for `{B[name]}` literals used in Playwright fixtures.',
    when: 'After the Tosca buffer extract step in your migration pipeline.',
    where: `Under the folder set in TOSCA_MIGRATION_DIR — expected file: ${absolutePath}`,
    how: 'Re-run the migration script that writes `playwright_buffer_map.json` (buffer extract / full migration).',
  };
}

export function needSuiteTestStepValues(absolutePath: string): MigrationDataNeed {
  return {
    what: `File ${absolutePath}`,
    why: 'This test compares raw step values and expansion using your real suite export.',
    when: 'After exporting suite test-step values from Tosca into the migration folder.',
    where: `TOSCA_MIGRATION_DIR\\suite_teststep_values.jsonl (full path: ${absolutePath})`,
    how: 'Run the pipeline step that emits `suite_teststep_values.jsonl` (see `npm run migrate:pipeline` / full migration build).',
  };
}

export function needSuiteTestStepValuesExpanded(absolutePath: string): MigrationDataNeed {
  return {
    what: `File ${absolutePath}`,
    why: 'Expanded JSONL proves `{B[…]}` were resolved with your real buffer map.',
    when: 'After running buffer expansion over `suite_teststep_values.jsonl`.',
    where: `TOSCA_MIGRATION_DIR\\suite_teststep_values_expanded.jsonl`,
    how: 'Run extract/expand Tosca buffers (full migration or buffer extract script that writes the `_expanded` file).',
  };
}

export function needPlaywrightToscaFullMigration(absolutePath: string): MigrationDataNeed {
  return {
    what: `File ${absolutePath}`,
    why: 'Structured testcases + `testcaseMetaExported` are required for prerequisite-gated TestCase configuration.',
    when: 'After `npm run build:tosca-full` (or equivalent) that writes the combined migration JSON.',
    where: `TOSCA_MIGRATION_DIR\\playwright_tosca_full_migration.json`,
    how: 'From repo root with `TOSCA_MIGRATION_DIR` set: `npm run build:tosca-full`.',
  };
}

export function needTestcasesJsonl(absolutePath: string): MigrationDataNeed {
  return {
    what: `File ${absolutePath}`,
    why: 'Flattens real **TestCase** configuration (`Name`/`Value` pairs) from your export.',
    when: 'After Tosca testcase export into the migration folder.',
    where: `TOSCA_MIGRATION_DIR\\testcases.jsonl`,
    how: 'Ensure `testcases.jsonl` is emitted by Run-ToscaMigration / CSV→JSON pipeline into the migration directory.',
  };
}

export function needThankYouNavigationData(): MigrationDataNeed {
  return {
    what: '`THANK_YOU_PAGE_URL` env var OR Thank You URL in bundle/testcase literals with prerequisites rules satisfied',
    why: 'The smoke test loads the real published Thank You page in a browser.',
    when: 'Before running `tests/tosca-thank-you.spec.ts` against your environment.',
    where: '`THANK_YOU_PAGE_URL` in shell/CI vars, or TestCase keys such as ThankYouPageUrl referenced in prerequisites + Test configuration.',
    how: 'Set `THANK_YOU_PAGE_URL` for a quick local run, or align Tosca testcase config with prerequisite `{B|PL|CP}[ThankYouPageUrl]` usage.',
  };
}

export function needBundleOrBufferMap(absBufferMap: string, absBundle: string): MigrationDataNeed {
  return {
    what: `At least one of: ${absBufferMap} OR ${absBundle}`,
    why: '`getMergedLiteralsWithPrerequisiteGatedOverlay` needs combined literals from the bundle or buffer map.',
    when: 'After migration bundle build and/or buffer map extraction.',
    where: 'Under `TOSCA_MIGRATION_DIR` — `playwright_migration_bundle.json` from `npm run build:migration-bundle`, or buffer map JSON.',
    how: '`npm run build:migration-bundle` or full pipeline; buffer map comes from Tosca extract step.',
  };
}

export function needCombinedBufferStringLiterals(): MigrationDataNeed {
  return {
    what: 'At least one non-empty string entry in the combined buffer / literal map',
    why: '`{B[name]}` interpolation is validated only against real keys from `playwright_buffer_map.json` / bundle.',
    when: 'After buffer extraction so `getCombinedBuffers` returns usable literals.',
    where: '`playwright_buffer_map.json` under `TOSCA_MIGRATION_DIR`',
    how: 'Re-run Tosca migration buffer export; confirm `combinedForPlaywright` or equivalent populated in the JSON.',
  };
}

export function needExpandableBufferStepRow(scanLimit: number): MigrationDataNeed {
  return {
    what: `A row within the first ${scanLimit} lines of suite_teststep_values.jsonl containing {B[…]} where every referenced buffer name exists in the combined buffer map`,
    why: '`expandRecordBufferTemplates` must be exercised on real data that fully resolves (no fabricated row).',
    when: 'After `suite_teststep_values.jsonl` and `playwright_buffer_map.json` are both emitted and aligned.',
    where: '`TOSCA_MIGRATION_DIR` — compare `suite_teststep_values.jsonl` placeholders vs buffer map keys.',
    how: 'Export missing buffers from Tosca, or increase scan range in automation if compatible rows appear later.',
  };
}

export function needPrerequisiteGateActive(testcasePathSubstring: string): MigrationDataNeed {
  return {
    what: `\`playwright_tosca_full_migration.json\` with non-empty testcases + testcaseMetaExported, and a structured testcase matching path substring "${testcasePathSubstring}"`,
    why: 'Prerequisite-gated testcase config overlay applies only when the full structured migration and meta rows exist.',
    when: 'After `npm run build:tosca-full` (or pipeline equivalent).',
    where: '`TOSCA_MIGRATION_DIR\\playwright_tosca_full_migration.json`',
    how: 'Run full migration build; ensure the Thank You (or targeted) testcase appears in structured `testcases` and exported meta.',
  };
}

export function needFullMigrationTestcaseBodies(): MigrationDataNeed {
  return {
    what: '`playwright_tosca_full_migration.json` containing populated `testcases` and `testcaseMetaExported` arrays',
    why: 'This assertion inspects prerequisite-back references vs overlay keys.',
    when: 'After full migration JSON generation.',
    where: '`TOSCA_MIGRATION_DIR\\playwright_tosca_full_migration.json`',
    how: 'Run `npm run build:tosca-full` with exports present.',
  };
}

export function needRtbReferenceInExportJsonl(filesTriedHint: string): MigrationDataNeed {
  return {
    what: `{RTB[…]} reference inside an exported JSONL row (${filesTriedHint})`,
    why: '`extractRtbRefsFromRecord` is validated only against real `{RTB[name]}` usage from Tosca.',
    when: 'After suite or detailed-test-step JSONL export.',
    where: '`TOSCA_MIGRATION_DIR` — typically `suite_teststep_values.jsonl` or `Detailed_TestSteps.jsonl`.',
    how: 'Export a testcase that references RTBs, or widen the scan in the test if RTB usages appear farther in the files.',
  };
}

export function needTitleBufferLiteral(): MigrationDataNeed {
  return {
    what: 'A string literal keyed `Title` in the combined buffer map',
    why: 'This checks `{B[Title]}` interpolation using your export’s naming (no hard-coded title text).',
    when: 'After buffer extract if your Tosca naming includes a buffer named Title.',
    where: '`playwright_buffer_map.json` / merged literals',
    how: 'If your buffers use another name (e.g. PageTitle), point users to interpolate that key elsewhere or rename in Tosca for this optional check.',
  };
}

export function needMigrationBundleReport(absolutePath: string): MigrationDataNeed {
  return {
    what: `File ${absolutePath}`,
    why: 'This test verifies merged literal counts from the Tosca migration bundle.',
    when: 'After testcase + buffer extracts exist and `npm run build:migration-bundle` (or pipeline) ran.',
    where: '`TOSCA_MIGRATION_DIR\\playwright_migration_bundle.json`',
    how: 'From repo: `npm run build:migration-bundle` with `TOSCA_MIGRATION_DIR` set.',
  };
}

/** When **`manifest.json`** is absent but the tester expects playbook discovery metadata. */

export function needMigrationManifest(absolutePath: string): MigrationDataNeed {
  return {
    what: `File ${absolutePath}`,
    why: '`readManifest` reports which JSONL is primary for Playwright — should match your export layout.',
    when: 'After Tosca migration writes manifest into the migration folder.',
    where: '`TOSCA_MIGRATION_DIR\\manifest.json`',
    how: 'Include manifest generation in Run-ToscaMigration or copy from a template that reflects your CSV→JSON routing.',
  };
}

export function needModulesAttributesJsonl(absolutePath: string): MigrationDataNeed {
  return {
    what: `File ${absolutePath}`,
    why: 'Exported module attributes anchor locator field samples for Playwright matchers.',
    when: 'After module/library export from Tosca into the migration directory.',
    where: absolutePath,
    how: 'Run Run-ToscaMigration.ps1 (or your pipeline) so `modules_attributes.jsonl` is emitted.',
  };
}

export function needTestcasesJsonlNonEmpty(absolutePath: string): MigrationDataNeed {
  return {
    what: `At least one non-empty line in ${absolutePath}`,
    why: 'Consumers need at least one exported **TestCase** record (harness iteration or configuration flattening).',
    when: 'After testcase CSV/JSON export into the migration folder.',
    where: absolutePath,
    how: 'Re-export testcases so `testcases.jsonl` contains serialized TestCase rows.',
  };
}

export function needToscaSutUrl(): MigrationDataNeed {
  return {
    what: 'Environment variable `TOSCA_SUT_URL` pointing at the running application (https or http base URL)',
    why: 'JSONL testcase smoke opens a real browser session against your SUT.',
    when: 'Before running migrated testcase browser checks (not required for static fixtures-only tests).',
    where: '`$env:TOSCA_SUT_URL` (PowerShell) or `export TOSCA_SUT_URL=...`',
    how: 'Use a reachable non-production environment; never commit credentials in the URL.',
  };
}

/* AI Generated Code by Deloitte + Cursor (END) */
