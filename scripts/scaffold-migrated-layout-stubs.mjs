/**
 * After migration, scaffold **readable** stubs under **`tests/migrated/`**:
 * - **`module/<ModuleName>/`** — `module.generated.ts` (locator placeholders; not a `.spec.ts` so Playwright ignores it unless imported).
 * - **`library/rtb-<name>.generated.ts`** — placeholders per **RTB** (`globalReferences` and/or **`{RTB[…]}`** JSONL scan).
 *
 * Run with **`TOSCA_MIGRATION_DIR`** set. Overwrites **`*.generated.ts`** and generated JSON registries; keep hand-authored files named differently (`handwritten.ts`, `*.manual.ts`).
 *
 * ```
 * npm run scaffold:migrated-stubs
 * ```
 */
/* AI Generated Code by Deloitte + Cursor (BEGIN) */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sanitizePathSegment } from './migrated-layout-sanitize.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const playwrightTestsDir = path.join(root, 'tests');

const mig = process.argv[2] || process.env.TOSCA_MIGRATION_DIR || '';
if (!mig) {
  console.error('Set TOSCA_MIGRATION_DIR or pass migration dir as argv[1]');
  process.exit(1);
}
const resolved = path.resolve(mig);

const migratedModule = path.join(playwrightTestsDir, 'migrated', 'module');
const migratedLibrary = path.join(playwrightTestsDir, 'migrated', 'library');
const migratedShared = path.join(playwrightTestsDir, 'migrated', '_shared');

fs.mkdirSync(migratedModule, { recursive: true });
fs.mkdirSync(migratedLibrary, { recursive: true });
fs.mkdirSync(migratedShared, { recursive: true });

/** Unique module names from `modules_attributes.jsonl` (stripped Tosca quotes). */

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

/** `{RTB[Name]}` names from **`globalReferences.rtbRef`** and **`placeholderRefsByPrefix.RTB`**. */

function rtbNamesFromFullMigration(doc) {
  const names = new Set();
  const gr = doc?.globalReferences;
  if (gr && typeof gr === 'object') {
    if (Array.isArray(gr.rtbRef)) {
      for (const x of gr.rtbRef) {
        const t = String(x).trim();
        if (t) names.add(t);
      }
    }
    const byP = gr.placeholderRefsByPrefix;
    if (byP && typeof byP === 'object' && Array.isArray(byP.RTB)) {
      for (const x of byP.RTB) {
        const t = String(x).trim();
        if (t) names.add(t);
      }
    }
  }
  return [...names].sort();
}

/** Scan JSONL line bodies for `{RTB[…]}` when **`rtbRef`** is empty in full migration. */

function collectRtbsFromJsonlFile(fp, maxLines = 80_000) {
  const found = new Set();
  if (!fs.existsSync(fp)) return found;
  const raw = fs.readFileSync(fp, 'utf8').replace(/^\uFEFF/, '');
  let n = 0;
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    n++;
    if (n > maxLines) break;
    for (const m of t.matchAll(/\{RTB\[([^\]]+)\]\}/gi)) {
      const nm = m[1].trim();
      if (nm) found.add(nm);
    }
  }
  return found;
}

function collectRtbsFromMigrationExports(migrationDir) {
  const acc = new Set();
  for (const rel of ['testcases.jsonl', 'suite_teststep_values.jsonl', 'Detailed_TestSteps.jsonl']) {
    for (const name of collectRtbsFromJsonlFile(path.join(migrationDir, rel))) acc.add(name);
  }
  return acc;
}

/** TypeScript scaffold for **`library/rtb-*.generated.ts`** (wired to **`migratedCodegenRunner`**). */

function rtbGeneratedFileBody(name) {
  const safe = String(name).replace(/\*\//g, '* /');
  return (
    `/* AI Generated Code by Deloitte + Cursor (BEGIN) */\n` +
    `/**\n` +
    ` * RTB **${safe}** — from \`globalReferences\` and/or JSONL \`{RTB[…]}\` discovery.\n` +
    ` * **Playwright entrypoint:** \`runStepsForThisRtbInTestcase\` runs steps referencing \`{RTB[${safe}]}\` for one testcase path.\n` +
    ` * Generated testcase specs call \`runMigratedStructuredTestcaseFull\` to execute **all** steps together.\n` +
    ` */\n` +
    `import type { Page } from '@playwright/test';\n` +
    `import type { StepValidationResult } from '../../../fixtures/testcaseStepValidation';\n` +
    `import { runMigratedStructuredTestcaseForRtb } from '../../../fixtures/migratedCodegenRunner';\n\n` +
    `export const TOSCA_RTB_NAME = ${JSON.stringify(name)} as const;\n\n` +
    `export async function runStepsForThisRtbInTestcase(\n` +
    `  page: Page,\n` +
    `  migrationDir: string,\n` +
    `  testcaseNodePath: string\n` +
    `): Promise<StepValidationResult[]> {\n` +
    `  return runMigratedStructuredTestcaseForRtb({\n` +
    `    page,\n` +
    `    migrationDir,\n` +
    `    testcaseNodePath,\n` +
    `    rtbName: TOSCA_RTB_NAME,\n` +
    `    strict: false,\n` +
    `  });\n` +
    `}\n\n` +
    `/** Optional hand-authored composition on top of migration output. */\n` +
    `export async function rtbFlowPlaceholder(): Promise<void> {\n` +
    `  /* compose tests/migrated/module helpers or shared flows */\n` +
    `}\n` +
    `/* AI Generated Code by Deloitte + Cursor (END) */\n`
  );
}

const modulesFp = path.join(resolved, 'modules_attributes.jsonl');
const mods = uniqModulesFromAttributesJsonl(modulesFp);
const rtbRegistry = [];

fs.writeFileSync(
  path.join(migratedShared, 'module-registry.generated.json'),
  JSON.stringify(
    mods.map((name) => ({
      name,
      folder: path.posix.join('module', sanitizePathSegment(name, 96)),
    })),
    null,
    2
  ),
  'utf8'
);

for (const mod of mods) {
  const seg = sanitizePathSegment(mod, 96);
  const dir = path.join(migratedModule, seg);
  fs.mkdirSync(dir, { recursive: true });
  const fp = path.join(dir, 'module.generated.ts');
  const body =
    `/* AI Generated Code by Deloitte + Cursor (BEGIN) */\n` +
    `/**\n` +
    ` * Module **${mod.replace(/\*\//g, '* /')}** — scaffold from \`modules_attributes.jsonl\`.\n` +
    ` * **Playwright entrypoint:** \`runStepsForThisModuleInTestcase\` runs only steps attributed to this module\n` +
    ` * (see \`fixtures/migratedCodegenRunner.ts\`) for one Tosca testcase path.\n` +
    ` * The generated testcase spec calls \`runMigratedStructuredTestcaseFull\` for **all** steps; use this file for module-only slices.\n` +
    ` */\n` +
    `import type { Page } from '@playwright/test';\n` +
    `import type { StepValidationResult } from '../../../../fixtures/testcaseStepValidation';\n` +
    `import { runMigratedStructuredTestcaseForModules } from '../../../../fixtures/migratedCodegenRunner';\n\n` +
    `export const TOSCA_MODULE_NAME = ${JSON.stringify(mod)} as const;\n\n` +
    `/** Example: reuse \`fixtures/moduleCatalog\`, \`buildLocatorFromModuleRow\`. */\n` +
    `export function moduleMeta(): { name: typeof TOSCA_MODULE_NAME } {\n` +
    `  return { name: TOSCA_MODULE_NAME };\n` +
    `}\n\n` +
    `/** Run migrated **XTestStepValue** rows for **${mod.replace(/\*\//g, '* /')}** only (same \`testcaseNodePath\` as the parent spec). */\n` +
    `export async function runStepsForThisModuleInTestcase(\n` +
    `  page: Page,\n` +
    `  migrationDir: string,\n` +
    `  testcaseNodePath: string\n` +
    `): Promise<StepValidationResult[]> {\n` +
    `  return runMigratedStructuredTestcaseForModules({\n` +
    `    page,\n` +
    `    migrationDir,\n` +
    `    testcaseNodePath,\n` +
    `    moduleStamps: [TOSCA_MODULE_NAME],\n` +
    `    strict: false,\n` +
    `  });\n` +
    `}\n` +
    `/* AI Generated Code by Deloitte + Cursor (END) */\n`;
  fs.writeFileSync(fp, body, 'utf8');
}

const fullFp = path.join(resolved, 'playwright_tosca_full_migration.json');
if (fs.existsSync(fullFp)) {
  try {
    const doc = JSON.parse(fs.readFileSync(fullFp, 'utf8'));
    const rtbSet = new Set(rtbNamesFromFullMigration(doc));
    for (const name of collectRtbsFromMigrationExports(resolved)) rtbSet.add(name);
    const rtbs = [...rtbSet].sort();
    for (const name of rtbs) {
      const seg = sanitizePathSegment(name, 96);
      const fn = path.join(migratedLibrary, `rtb-${seg}.generated.ts`);
      rtbRegistry.push({ name, file: `library/rtb-${seg}.generated.ts` });
      fs.writeFileSync(fn, rtbGeneratedFileBody(name), 'utf8');
    }
    fs.writeFileSync(
      path.join(migratedShared, 'rtb-registry.generated.json'),
      JSON.stringify(rtbRegistry, null, 2),
      'utf8'
    );
  } catch (e) {
    console.warn('Skipping RTB scaffold (full migration JSON parse failed):', e.message);
    fs.writeFileSync(path.join(migratedShared, 'rtb-registry.generated.json'), '[]', 'utf8');
  }
} else {
  console.warn(`No ${fullFp} — RTB stubs from JSONL scan only (run build:tosca-full for globalReferences).`);
  const rtbs = [...collectRtbsFromMigrationExports(resolved)].sort();
  for (const name of rtbs) {
    const seg = sanitizePathSegment(name, 96);
    const fn = path.join(migratedLibrary, `rtb-${seg}.generated.ts`);
    rtbRegistry.push({ name, file: `library/rtb-${seg}.generated.ts` });
    fs.writeFileSync(fn, rtbGeneratedFileBody(name), 'utf8');
  }
  fs.writeFileSync(
    path.join(migratedShared, 'rtb-registry.generated.json'),
    JSON.stringify(rtbRegistry, null, 2),
    'utf8'
  );
}

if (mods.length === 0 && rtbRegistry.length === 0) {
  fs.writeFileSync(
    path.join(migratedShared, '.scaffold-hint.txt'),
    'No modules_attributes.jsonl module names and no playwright_tosca_full_migration.json RTB refs — run pipeline export first.',
    'utf8'
  );
}

console.log(
  `Scaffolded modules=${mods.length} under ${path.relative(root, migratedModule)}, RTB stubs=${rtbRegistry.length}`
);
/* AI Generated Code by Deloitte + Cursor (END) */
