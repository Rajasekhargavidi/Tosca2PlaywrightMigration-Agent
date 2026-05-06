/* AI Generated Code by Deloitte + Cursor (BEGIN) */
import fs from 'fs';
import path from 'path';
import { getCombinedBuffers, loadPlaywrightBufferMap } from './bufferMap';
import type { ToscaPlaceholderContext } from './toscaPlaceholderRefs';

/** Written by `npm run build:migration-bundle`. */
export type PlaywrightMigrationBundle = {
  schemaVersion?: number;
  generatedAt?: string;
  sources?: Record<string, string>;
  counts?: Record<string, number>;
  combinedLiterals?: Record<string, string>;
  /** Library `Parameter` rows: allowed values (often `a;b;c`). Not a single runtime value. */
  parameterValueRanges?: Record<string, string>;
  unresolvedBufferReferences?: string[];
  /** `PREFIX:name` bracket tokens still unresolved after merge (includes non-`B` refs). */
  unresolvedToscaPlaceholders?: string[];
  /** All `PREFIX:name` seen in merged literals / step templates. */
  referencedToscaPlaceholders?: string[];
  hints?: string[];
};

export function migrationBundlePath(migrationDir: string): string {
  return path.join(migrationDir, 'playwright_migration_bundle.json');
}

export function loadMigrationBundle(migrationDir: string): PlaywrightMigrationBundle | null {
  const fp = migrationBundlePath(migrationDir);
  if (!fs.existsSync(fp)) return null;
  let raw = fs.readFileSync(fp, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw) as PlaywrightMigrationBundle;
}

/**
 * Prefer merged bundle literals (buffers + test-step values + library hints); fall back to buffer map only.
 */
export function getMergedLiteralsForPlaywright(migrationDir: string): Record<string, string> {
  const bundle = loadMigrationBundle(migrationDir);
  const fromBundle = bundle?.combinedLiterals;
  if (fromBundle && Object.keys(fromBundle).length > 0) return { ...fromBundle };
  return getCombinedBuffers(loadPlaywrightBufferMap(migrationDir));
}

/** Literals + `libraries_parameters.jsonl` ranges for `{PL[x]}`, `{CP[x]}`, `{B[x]}`, … interpolation. */
export function getPlaceholderResolutionContext(migrationDir: string): ToscaPlaceholderContext {
  const liters = getMergedLiteralsForPlaywright(migrationDir);
  const bundle = loadMigrationBundle(migrationDir);
  const ranges =
    bundle?.parameterValueRanges && Object.keys(bundle.parameterValueRanges).length > 0
      ? { ...(bundle.parameterValueRanges as Record<string, string>) }
      : {};
  return { literals: { ...liters }, parameterValueRanges: ranges };
}

export function resolveDetailedTestStepsDefault(migrationDir: string): string | null {
  const parent = path.dirname(path.resolve(migrationDir));
  const cand = path.join(parent, 'Detailed_TestSteps.jsonl');
  return fs.existsSync(cand) ? cand : null;
}
/* AI Generated Code by Deloitte + Cursor (END) */
