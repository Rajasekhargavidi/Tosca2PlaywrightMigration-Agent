/* AI Generated Code by Deloitte + Cursor (BEGIN) */
import fs from 'fs';
import path from 'path';

/**
 * Readable post-migration layout under **`tests/migrated/`** — mirrors Tosca spheres:
 * **module** (controls), **testcase** (blue folder flows), **library** (RTB-oriented scripts).
 * See **`AGENT_BRAIN.md`** (migrated scripts layout).
 */

/** Relative to Playwright **`testDir`** (usually **`tests/`). */
export const MIGRATED_SUBDIR = 'migrated';

export function migratedRoot(playwrightTestsDir: string): string {
  return path.join(playwrightTestsDir, MIGRATED_SUBDIR);
}

export function migratedModuleDir(playwrightTestsDir: string): string {
  return path.join(playwrightTestsDir, MIGRATED_SUBDIR, 'module');
}

export function migratedTestcaseDir(playwrightTestsDir: string): string {
  return path.join(playwrightTestsDir, MIGRATED_SUBDIR, 'testcase');
}

export function migratedLibraryDir(playwrightTestsDir: string): string {
  return path.join(playwrightTestsDir, MIGRATED_SUBDIR, 'library');
}

export function migratedSharedDir(playwrightTestsDir: string): string {
  return path.join(playwrightTestsDir, MIGRATED_SUBDIR, '_shared');
}

/** Windows + URL-safe-ish segment for filenames and single path components. */

export function sanitizePathSegment(raw: string, maxLen = 120): string {
  const t = raw
    .replace(/[`$]/g, '')
    .replace(/[\x00-\x1f<>:"|?*\\/]+/g, '_')
    .replace(/\s+/g, '_')
    .trim();
  const clipped = (t.slice(0, maxLen).replace(/[._]+$/, '') || 'unnamed').replace(/^\.+/, 'tc');
  return clipped || 'unnamed';
}

function walkSpecs(dir: string, acc: string[]): void {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, ent.name);
    if (ent.isDirectory()) walkSpecs(fp, acc);
    else if (ent.isFile() && ent.name.endsWith('.spec.ts') && !ent.name.startsWith('_')) acc.push(fp);
  }
}

/** True when segmented codegen emitted any `tests/migrated/testcase/tc_*.spec.ts`. */

export function hasSegmentedGeneratedTestcases(playwrightTestsDir: string): boolean {
  const found: string[] = [];
  walkSpecs(migratedTestcaseDir(playwrightTestsDir), found);
  return found.length > 0;
}

export function legacyGeneratedTestcaseSpec(playwrightTestsDir: string): string {
  return path.join(playwrightTestsDir, 'generated', 'tosca-testcases.spec.ts');
}

/** JSONL harness should stand down when monolithic codegen **or** segmented **`migrated/testcase`** exists. */

export function useCodegenInsteadOfJsonlHarness(playwrightTestsDir: string): boolean {
  return (
    fs.existsSync(legacyGeneratedTestcaseSpec(playwrightTestsDir)) ||
    hasSegmentedGeneratedTestcases(playwrightTestsDir)
  );
}

/* AI Generated Code by Deloitte + Cursor (END) */
