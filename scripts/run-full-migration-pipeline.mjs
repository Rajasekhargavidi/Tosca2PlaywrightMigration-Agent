// AI Generated Code by Deloitte + Cursor (BEGIN)
/**
 * One-shot pipeline: optional pre-export hook → build:tosca-full → agent:migration → optional Playwright tests.
 *
 * Prerequisites: set **`TOSCA_MIGRATION_DIR`**. Optionally **`TOSCA_PATHS_MANIFEST`**, **`AGENT_STRICT=1`**,
 * **`RUN_PLAYWRIGHT_AFTER_PIPELINE=1`** (or **`PIPELINE_TESTS=1`**).
 * **`MIGRATED_PLAYWRIGHT_LAYOUT=1`** runs **`scaffold:migrated-stubs`** then **`generate:tosca-tests`** into **`tests/migrated/{module,testcase,library}/`** (**`AGENT_BRAIN.md`** § Migrated scripts layout).
 *
 * Optional hook (your TCShell / export batch — **never** paste secrets inline; use refs to controlled scripts):
 *   **`TOSCA_PRE_PIPELINE_CMD`** — executed via **`cmd /d /s /c`** on Win32 else **`sh -lc`** once before build.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function fail(msg, code = 1) {
  console.error(`[migrate:pipeline] ${msg}`);
  process.exit(code);
}

function runNpm(scriptName, label) {
  console.log(`[migrate:pipeline] → ${label} (npm run ${scriptName})`);
  const isWin = process.platform === 'win32';
  const r = spawnSync('npm', ['run', scriptName], {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: isWin,
    env: process.env,
  });
  if (r.status !== 0) fail(`${label} failed (exit ${r.status ?? '?'}).`);
}

function maybePrePipeline() {
  const cmd = process.env.TOSCA_PRE_PIPELINE_CMD?.trim();
  if (!cmd) return;
  console.log('[migrate:pipeline] → TOSCA_PRE_PIPELINE_CMD (external export)');
  const isWin = process.platform === 'win32';
  const r = isWin ? spawnSync('cmd', ['/d', '/s', '/c', cmd], { stdio: 'inherit', cwd: repoRoot, env: process.env }) : spawnSync('sh', ['-lc', cmd], { stdio: 'inherit', cwd: repoRoot, env: process.env });
  if (r.status !== 0) fail(`TOSCA_PRE_PIPELINE_CMD failed (exit ${r.status ?? '?'}).`, r.status ?? 1);
}

function maybeGenerateMigratedLayout() {
  const run =
    process.env.MIGRATED_PLAYWRIGHT_LAYOUT === '1' || process.env.MIGRATED_PLAYWRIGHT_LAYOUT === 'true';
  if (!run) return;
  console.log('[migrate:pipeline] → MIGRATED_PLAYWRIGHT_LAYOUT (scaffold module or RTB stubs, then generate testcase specs)');
  const gen = path.join(repoRoot, 'scripts', 'generate-tosca-playwright-tests.mjs');
  const sc = path.join(repoRoot, 'scripts', 'scaffold-migrated-layout-stubs.mjs');
  let r = spawnSync(process.execPath, [sc], { cwd: repoRoot, stdio: 'inherit', env: process.env });
  if (r.status !== 0) fail(`scaffold-migrated-layout-stubs failed (exit ${r.status ?? '?'}).`, r.status ?? 1);
  r = spawnSync(process.execPath, [gen], { cwd: repoRoot, stdio: 'inherit', env: process.env });
  if (r.status !== 0) fail(`generate-tosca-playwright-tests failed (exit ${r.status ?? '?'}).`, r.status ?? 1);
}

function maybePlaywright() {
  const run =
    process.env.RUN_PLAYWRIGHT_AFTER_PIPELINE === '1' ||
    process.env.PIPELINE_TESTS === '1' ||
    process.env.PIPELINE_TESTS === 'true';
  if (!run) return;
  console.log('[migrate:pipeline] → Playwright (`npx playwright test`)');
  const isWin = process.platform === 'win32';
  const r = spawnSync('npx', ['playwright', 'test'], {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: isWin,
    env: process.env,
  });
  if (r.status !== 0) fail(`Playwright suite failed (exit ${r.status ?? '?'}).`, r.status ?? 1);
}

const mig = process.env.TOSCA_MIGRATION_DIR?.trim();
if (!mig) fail('Set env TOSCA_MIGRATION_DIR to your Tosca migration export folder.');
if (!fs.existsSync(path.resolve(mig))) fail(`TOSCA_MIGRATION_DIR does not exist: ${path.resolve(mig)}`);

console.log('[migrate:pipeline] start');
console.log(`[migrate:pipeline]   TOSCA_MIGRATION_DIR=${path.resolve(mig)}`);
if (process.env.TOSCA_PATHS_MANIFEST?.trim()) console.log(`[migrate:pipeline]   TOSCA_PATHS_MANIFEST=${process.env.TOSCA_PATHS_MANIFEST.trim()}`);

maybePrePipeline();
runNpm('build:tosca-full', 'Structured JSON + migration bundle');
runNpm('agent:migration', 'Migration agent audit');

maybeGenerateMigratedLayout();

console.log('[migrate:pipeline] core steps complete ✓');

maybePlaywright();
console.log('[migrate:pipeline] done');

// AI Generated Code by Deloitte + Cursor (END)
