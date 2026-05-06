/**
 * Post-migration: reads testcases.jsonl and writes **segmented** Playwright specs under
 * `tests/migrated/testcase/` (one `.spec.ts` per Tosca TestCase) plus `_shared/testcase-registry.generated.json`.
 *
 * Readable layout aligns with **`AGENT_BRAIN.md`** (module / testcase / library). Legacy single-file mode:
 *
 * ```
 * node scripts/generate-tosca-playwright-tests.mjs --legacy
 * ```
 *
 * Usage:
 *   set TOSCA_MIGRATION_DIR=C:\Exports\migration
 *   node scripts/generate-tosca-playwright-tests.mjs
 */
/* AI Generated Code by Deloitte + Cursor (BEGIN) */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { sanitizePathSegment } from './migrated-layout-sanitize.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const playwrightTestsDir = path.join(root, 'tests');

const argv = process.argv.slice(2);
const legacyMode = argv.includes('--legacy');

const migDirArg = argv.find((a) => !a.startsWith('--'));

const mig = migDirArg || process.env.TOSCA_MIGRATION_DIR || 'C:\\Exports\\migration';
const resolved = path.resolve(mig);
const jsonlPath = path.join(resolved, 'testcases.jsonl');
const modulesAttrPath = path.join(resolved, 'modules_attributes.jsonl');

const segmentedTestcaseDir = path.join(playwrightTestsDir, 'migrated', 'testcase');
const segmentedSharedDir = path.join(playwrightTestsDir, 'migrated', '_shared');
const migratedModuleRoot = path.join(playwrightTestsDir, 'migrated', 'module');
const migratedLibraryRoot = path.join(playwrightTestsDir, 'migrated', 'library');

const legacyOutDir = path.join(root, 'tests', 'generated');
const legacyOutPath = path.join(legacyOutDir, 'tosca-testcases.spec.ts');

function leafFromNodePath(np) {
  if (typeof np !== 'string' || !np.trim()) return '';
  const parts = np.split(/[/|]/).map((p) => p.trim()).filter(Boolean);
  return parts[parts.length - 1] || '';
}

function isTestCase(row) {
  const t = String(row.__type ?? '');
  return t === 'TestCase' || t.endsWith('TestCase');
}

function displayTitle(row, index) {
  const fromTitle = typeof row.__title === 'string' ? row.__title.trim() : '';
  if (fromTitle) return fromTitle;
  const name = typeof row.Name === 'string' ? row.Name.trim() : '';
  if (name) return name;
  const p = typeof row['(R)NodePath'] === 'string' ? row['(R)NodePath'].trim() : '';
  if (p) {
    const parts = p.split(/[/|]/).filter(Boolean);
    return parts[parts.length - 1] || `TestCase ${index}`;
  }
  return `TestCase ${index}`;
}

function playbookTitles(rows) {
  const counts = new Map();
  return rows.map((row, index) => {
    const base = displayTitle(row, index);
    const n = (counts.get(base) ?? 0) + 1;
    counts.set(base, n);
    return n > 1 ? `${base} (${n})` : base;
  });
}

function jsonStringifyForTs(s) {
  return JSON.stringify(s ?? '');
}

function specBasename(row, index) {
  const uid = typeof row['(R)UniqueId'] === 'string' ? sanitizePathSegment(row['(R)UniqueId'], 48) : '';
  const leaf = sanitizePathSegment(leafFromNodePath(row['(R)NodePath']), 80);
  const chunks = [`tc_${index}`, uid || null, leaf || null].filter(Boolean);
  return `${sanitizePathSegment(chunks.join('_'), 140)}.spec.ts`;
}

/** Same rule as **`scaffold-migrated-layout-stubs.mjs`** / **`uniqModulesFromAttributesJsonl`**. */

function uniqModulesFromAttributesJsonl(fp, maxLines = 50_000) {
  const set = new Set();
  if (!fs.existsSync(fp)) return [...set];
  const raw = fs.readFileSync(fp, 'utf8').replace(/^\uFEFF/, '');
  let n = 0;
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    n++;
    if (n > maxLines) break;
    try {
      const row = JSON.parse(t);
      const m = row.Module;
      if (typeof m === 'string') {
        const stripped = m.replace(/^['"]|['`]$/g, '').trim();
        if (stripped) set.add(stripped);
      }
    } catch {
      /* skip */
    }
  }
  return [...set].sort();
}

function stripToscaQuotedString(s) {
  let t = String(s).trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith('`'))) t = t.slice(1, -1).trim();
  return t;
}

/** **Module** field values nested under **TestCase** JSON that appear in **`modules_attributes.jsonl`**. */

function collectModulesReferencedInRow(row, knownSet) {
  const found = new Set();
  const walk = (val) => {
    if (val === null || val === undefined) return;
    if (Array.isArray(val)) {
      for (const el of val) walk(el);
      return;
    }
    if (typeof val !== 'object') return;
    const mod = val.Module;
    if (typeof mod === 'string') {
      const st = stripToscaQuotedString(mod);
      if (st && knownSet.has(st)) found.add(st);
    }
    for (const v of Object.values(val)) walk(v);
  };
  walk(row);
  return [...found].sort();
}

/** **`{RTB[…]}`** tokens anywhere under exported **TestCase** JSON. */

function extractRtbNamesFromRecord(row) {
  const found = new Set();
  const walk = (val) => {
    if (typeof val === 'string') {
      for (const m of val.matchAll(/\{RTB\[([^\]]+)\]\}/gi)) {
        const nm = m[1].trim();
        if (nm) found.add(nm);
      }
    } else if (Array.isArray(val)) {
      for (const el of val) walk(el);
    } else if (val !== null && typeof val === 'object') {
      for (const v of Object.values(val)) walk(v);
    }
  };
  walk(row);
  return [...found].sort();
}

function moduleStubFile(modName) {
  return path.join(migratedModuleRoot, sanitizePathSegment(modName, 96), 'module.generated.ts');
}

function rtbStubFile(rtbName) {
  return path.join(migratedLibraryRoot, `rtb-${sanitizePathSegment(rtbName, 96)}.generated.ts`);
}

function relativeTsImportFromTestcase(absFile) {
  let rel = path.relative(segmentedTestcaseDir, absFile).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel.replace(/\.ts$/i, '');
}

if (!fs.existsSync(jsonlPath)) {
  console.error(`generate-tosca-playwright-tests: missing ${jsonlPath}`);
  console.error('Export TestCase rows from Tosca (testcases.jsonl must exist), or pass migration dir as first arg.');
  process.exit(1);
}

const raw = fs.readFileSync(jsonlPath, 'utf8').replace(/^\uFEFF/, '');
const rows = [];
for (const line of raw.split(/\r?\n/)) {
  const t = line.trim();
  if (!t) continue;
  try {
    const row = JSON.parse(t);
    if (isTestCase(row)) rows.push(row);
  } catch {
    /* skip bad line */
  }
}

if (!legacyMode) {
  fs.mkdirSync(segmentedTestcaseDir, { recursive: true });
  fs.mkdirSync(segmentedSharedDir, { recursive: true });
  fs.mkdirSync(migratedModuleRoot, { recursive: true });
  fs.mkdirSync(migratedLibraryRoot, { recursive: true });

  const knownModules = new Set(uniqModulesFromAttributesJsonl(modulesAttrPath));

  /** Remove stale segmented specs (preserve README + non-spec). */
  for (const ent of fs.readdirSync(segmentedTestcaseDir, { withFileTypes: true })) {
    if (ent.isFile() && ent.name.endsWith('.spec.ts') && ent.name.startsWith('tc_')) {
      fs.unlinkSync(path.join(segmentedTestcaseDir, ent.name));
    }
  }

  const registry = [];
  const titles = playbookTitles(rows);

  if (rows.length === 0) {
    const stubPath = path.join(segmentedTestcaseDir, 'tc_0_none_exported.spec.ts');
    fs.writeFileSync(
      stubPath,
      `/* AI Generated Code by Deloitte + Cursor (BEGIN) */\n` +
        `import { test } from '@playwright/test';\n\n` +
        `test.describe('Tosca testcases (migrated layout)', () => {\n` +
        `  test('no TestCase rows in testcases.jsonl', () => {\n` +
        `    test.skip(true, 'Populate testcases.jsonl with Tosca TestCase exports.');\n` +
        `  });\n` +
        `});\n` +
        `/* AI Generated Code by Deloitte + Cursor (END) */\n`,
      'utf8'
    );
    fs.writeFileSync(
      path.join(segmentedSharedDir, 'testcase-registry.generated.json'),
      JSON.stringify([{ file: 'testcase/tc_0_none_exported.spec.ts', issue: 'empty export' }], null, 2),
      'utf8'
    );
    console.warn(`Wrote segmented stub (0 testcases): ${stubPath}`);
    process.exit(0);
  }

  rows.forEach((row, i) => {
    const basename = specBasename(row, i);
    const outPath = path.join(segmentedTestcaseDir, basename);
    const titleLit = jsonStringifyForTs(titles[i]);
    const pathLit = jsonStringifyForTs(typeof row['(R)NodePath'] === 'string' ? row['(R)NodePath'] : '');
    const uidLit = typeof row['(R)UniqueId'] === 'string' ? row['(R)UniqueId'] : '';
    const npComment =
      typeof row['(R)NodePath'] === 'string'
        ? row['(R)NodePath'].replace(/\*\//g, '* /').replace(/\r?\n/g, ' ')
        : '(none)';

    const linkedModNames = collectModulesReferencedInRow(row, knownModules);
    const linkedRtbNames = extractRtbNamesFromRecord(row);
    const modImports = linkedModNames.filter((m) => fs.existsSync(moduleStubFile(m)));
    const rtbImports = linkedRtbNames.filter((r) => fs.existsSync(rtbStubFile(r)));

    let fileBody = `/* AI Generated Code by Deloitte + Cursor (BEGIN) */\n`;
    fileBody += `/**\n`;
    fileBody += ` * TestCase smoke — data from testcases.jsonl row ${i}.\n`;
    fileBody += ` * Tosca node path: ${npComment}\n`;
    fileBody += ` */\n`;
    fileBody += `import { expect, test } from '@playwright/test';\n`;
    fileBody += `import { tryGetMigrationDir } from '../../../fixtures/migrationPaths';\n`;
    fileBody += `import {\n`;
    fileBody += `  migrationHasStructuredJson,\n`;
    fileBody += `  runMigratedStructuredTestcaseFull,\n`;
    fileBody += `  summarizeStepOutcomes,\n`;
    fileBody += `} from '../../../fixtures/migratedCodegenRunner';\n`;
    modImports.forEach((m, j) => {
      fileBody += `import * as tcMod${j} from '${relativeTsImportFromTestcase(moduleStubFile(m))}';\n`;
    });
    rtbImports.forEach((r, j) => {
      fileBody += `import * as tcRtb${j} from '${relativeTsImportFromTestcase(rtbStubFile(r))}';\n`;
    });
    if (modImports.length || rtbImports.length) {
      fileBody += `\n/**\n`;
      fileBody += ` * **Layered Playwright entrypoints** (same \`testcaseNodePath\` + \`migrationDir\` as below):\n`;
      if (modImports.length) {
        fileBody += ` * - **Modules:** \`tcMod*\`.runStepsForThisModuleInTestcase(page, migrationDir, testcaseNodePath) — module-only slice.\n`;
      }
      if (rtbImports.length) {
        fileBody += ` * - **RTBs:** \`tcRtb*\`.runStepsForThisRtbInTestcase(page, migrationDir, testcaseNodePath) — RTB-bracket slice.\n`;
      }
      fileBody += ` * - **Full testcase:** \`runMigratedStructuredTestcaseFull\` runs every **XTestStepValue** phase after SUT loads.\n`;
      fileBody += ` */\n`;
    }
    fileBody += `\n`;

    fileBody += `test.describe(${titleLit}, () => {\n`;
    fileBody += `  test.describe.configure({ timeout: 120_000 });\n\n`;
    fileBody += `  test('smoke navigation (expand with module helpers under tests/migrated/module)', async ({ page }, testInfo) => {\n`;
    fileBody += `    testInfo.annotations.push({ type: 'tosca-node-path', description: ${pathLit} });\n`;
    fileBody += `    testInfo.annotations.push({ type: 'tosca-unique-id', description: ${jsonStringifyForTs(uidLit)} });\n`;
    if (linkedModNames.length) {
      fileBody += `    testInfo.annotations.push({ type: 'tosca-modules-in-export', description: ${jsonStringifyForTs(linkedModNames.join(', '))} });\n`;
    }
    if (linkedRtbNames.length) {
      fileBody += `    testInfo.annotations.push({ type: 'tosca-rtbs-in-export', description: ${jsonStringifyForTs(linkedRtbNames.join(', '))} });\n`;
    }
    if (modImports.length) {
      fileBody += `    const wiredModuleNames = [${modImports.map((_, j) => `tcMod${j}.TOSCA_MODULE_NAME`).join(', ')}] as const;\n`;
      fileBody += `    expect(wiredModuleNames.every((n) => n.length > 0)).toBe(true);\n`;
    } else if (linkedModNames.length) {
      fileBody += `    testInfo.annotations.push({ type: 'tosca-scaffold-hint-modules', description: ${jsonStringifyForTs(`Run npm run scaffold:migrated-stubs for modules: ${linkedModNames.join(', ')}`)} });\n`;
    }
    if (rtbImports.length) {
      fileBody += `    const wiredRtbNames = [${rtbImports.map((_, j) => `tcRtb${j}.TOSCA_RTB_NAME`).join(', ')}] as const;\n`;
      fileBody += `    expect(wiredRtbNames.every((n) => n.length > 0)).toBe(true);\n`;
    } else if (linkedRtbNames.length) {
      fileBody += `    testInfo.annotations.push({ type: 'tosca-scaffold-hint-rtbs', description: ${jsonStringifyForTs(`Run npm run scaffold:migrated-stubs for RTBs: ${linkedRtbNames.join(', ')}`)} });\n`;
    }
    fileBody += `    expect(${titleLit}.length).toBeGreaterThan(0);\n`;
    fileBody += `    const sut = (process.env.TOSCA_SUT_URL ?? '').trim();\n`;
    fileBody += `    test.skip(!sut, 'Set TOSCA_SUT_URL to run browser smoke per migrated testcase');\n`;
    fileBody += `    await page.goto(sut, { waitUntil: 'domcontentloaded' });\n`;
    fileBody += `    await expect(page.locator('body')).toBeAttached();\n`;
    fileBody += `    const migrationDir = tryGetMigrationDir();\n`;
    fileBody += `    if (!migrationDir) {\n`;
    fileBody += `      testInfo.annotations.push({ type: 'tosca-migration-runner', description: 'Set TOSCA_MIGRATION_DIR to run migrated XTestStepValue flow' });\n`;
    fileBody += `    } else if (!migrationHasStructuredJson(migrationDir)) {\n`;
    fileBody += `      testInfo.annotations.push({\n`;
    fileBody += `        type: 'tosca-migration-runner',\n`;
    fileBody += `        description: 'Run npm run build:tosca-full to emit playwright_tosca_full_migration.json for full step execution',\n`;
    fileBody += `      });\n`;
    fileBody += `    } else {\n`;
    fileBody += `      const structuredResults = await runMigratedStructuredTestcaseFull({\n`;
    fileBody += `        page,\n`;
    fileBody += `        migrationDir,\n`;
    fileBody += `        testcaseNodePath: ${pathLit},\n`;
    fileBody += `        strict: false,\n`;
    fileBody += `      });\n`;
    fileBody += `      testInfo.annotations.push({\n`;
    fileBody += `        type: 'migrated-step-outcomes',\n`;
    fileBody += `        description: JSON.stringify(summarizeStepOutcomes(structuredResults)),\n`;
    fileBody += `      });\n`;
    fileBody += `      if (structuredResults.length === 0) {\n`;
    fileBody += `        testInfo.annotations.push({\n`;
    fileBody += `          type: 'tosca-migration-runner',\n`;
    fileBody += `          description:\n`;
    fileBody += `            'No XTestStepValue rows matched this export path in playwright_tosca_full_migration.json — align (R)NodePath or run build:tosca-full',\n`;
    fileBody += `        });\n`;
    fileBody += `      }\n`;
    fileBody += `    }\n`;
    fileBody += `  });\n`;
    fileBody += `});\n`;
    fileBody += `/* AI Generated Code by Deloitte + Cursor (END) */\n`;

    fs.writeFileSync(outPath, fileBody, 'utf8');
    registry.push({
      file: path.posix.join('testcase', basename.replace(/\\/g, '/')),
      index: i,
      title: titles[i],
      nodePath: typeof row['(R)NodePath'] === 'string' ? row['(R)NodePath'] : '',
      uniqueId: uidLit || undefined,
      linkedModulesInExport: linkedModNames.length ? linkedModNames : undefined,
      linkedRtbsInExport: linkedRtbNames.length ? linkedRtbNames : undefined,
      wiredModuleImports: modImports.length ? modImports : undefined,
      wiredRtbImports: rtbImports.length ? rtbImports : undefined,
    });
  });

  fs.writeFileSync(
    path.join(segmentedSharedDir, 'testcase-registry.generated.json'),
    JSON.stringify(registry, null, 2),
    'utf8'
  );
  console.log(`Wrote ${rows.length} testcase spec(s) under ${segmentedTestcaseDir}`);
  console.log(`Registry: ${path.join(segmentedSharedDir, 'testcase-registry.generated.json')}`);
  process.exit(0);
}

/* ─── Legacy single-file output ───────────────────────────────────────────── */

fs.mkdirSync(legacyOutDir, { recursive: true });

if (rows.length === 0) {
  fs.writeFileSync(
    legacyOutPath,
    `/* AI Generated Code by Deloitte + Cursor (BEGIN) */\n` +
      `/* No TestCase rows in testcases.jsonl — check Export_TestCases.tcs */\n` +
      `import { test } from '@playwright/test';\n\n` +
      `test.describe('Tosca testcases (generated)', () => {\n` +
      `  test('no TestCase rows exported', () => {\n` +
      `    test.skip(true, 'Populate testcases.jsonl with Tosca TestCase exports.');\n` +
      `  });\n` +
      `});\n` +
      `/* AI Generated Code by Deloitte + Cursor (END) */\n`,
    'utf8'
  );
  console.warn(`Wrote legacy stub (0 testcases): ${legacyOutPath}`);
  process.exit(0);
}

const titles = playbookTitles(rows);
let body = `/* AI Generated Code by Deloitte + Cursor (BEGIN) */\n`;
body += `import { expect, test } from '@playwright/test';\n\n`;
body += `test.describe('Tosca testcases (generated from testcases.jsonl)', () => {\n`;
body += `  test.describe.configure({ timeout: 120_000 });\n\n`;

rows.forEach((row, i) => {
  const titleLit = jsonStringifyForTs(titles[i]);
  const pathLit = jsonStringifyForTs(typeof row['(R)NodePath'] === 'string' ? row['(R)NodePath'] : '');
  body += `  test(${titleLit}, async ({ page }, testInfo) => {\n`;
  body += `    testInfo.annotations.push({ type: 'tosca-node-path', description: ${pathLit} });\n`;
  body += `    expect(${titleLit}.length).toBeGreaterThan(0);\n`;
  body += `    const sut = (process.env.TOSCA_SUT_URL ?? '').trim();\n`;
  body += `    test.skip(!sut, 'Set TOSCA_SUT_URL to run browser smoke per migrated testcase');\n`;
  body += `    await page.goto(sut, { waitUntil: 'domcontentloaded' });\n`;
  body += `    await expect(page.locator('body')).toBeAttached();\n`;
  body += `  });\n\n`;
});

body += `});\n`;
body += `/* AI Generated Code by Deloitte + Cursor (END) */\n`;

fs.writeFileSync(legacyOutPath, body, 'utf8');
console.log(`Wrote legacy ${rows.length} testcase(s) to ${legacyOutPath}`);
/* AI Generated Code by Deloitte + Cursor (END) */
