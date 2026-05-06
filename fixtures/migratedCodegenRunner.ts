/* AI Generated Code by Deloitte + Cursor (BEGIN) */
import type { Page } from '@playwright/test';
import { getMergedLiteralsForPlaywright, getPlaceholderResolutionContext } from './fullMigrationMap';
import { ModuleCatalog, extractInsertComponentFolder } from './moduleCatalog';
import { extractRtbRefsFromRecord } from './rtbRefs';
import {
  flattenTestcaseForAgentAudit,
  getRtbModuleLinks,
  loadToscaFullMigration,
  type ToscaFullMigrationFile,
  type ToscaStructuredTestcase,
} from './structuredMigration';
import { validateStepWithSupportingModules, type StepValidationResult } from './testcaseStepValidation';
import { seedFromStrings } from './toscaRnd';

function normalizeNodePathForMatch(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

function stripModuleStamp(raw: unknown): string {
  let t = String(raw ?? '').trim();
  if (
    t.length >= 2 &&
    ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"')))
  ) {
    t = t.slice(1, -1).trim();
  }
  return t.trim();
}

/**
 * Locate **`playwright_tosca_full_migration.json`** testcase tree for an exported **`testcases.jsonl`** **TestCase** node path.
 */
export function resolveStructuredTestcaseForExportNodePath(
  full: ToscaFullMigrationFile | null,
  exportNodePath: string
): ToscaStructuredTestcase | undefined {
  if (!full?.testcases?.length) return undefined;
  const target = normalizeNodePathForMatch(exportNodePath);
  if (!target) return undefined;

  const exact = full.testcases.find((tc) => normalizeNodePathForMatch(tc.testcaseNodePath) === target);
  if (exact) return exact;

  const leaf = (target.split('|').pop() ?? target).trim();
  let best: ToscaStructuredTestcase | undefined;
  let bestLen = 0;
  for (const tc of full.testcases) {
    const p = normalizeNodePathForMatch(tc.testcaseNodePath);
    if (!p) continue;
    if (target.includes(p) || p.includes(target) || p.endsWith(leaf)) {
      if (p.length > bestLen) {
        bestLen = p.length;
        best = tc;
      }
    }
  }
  return best;
}

export function migrationHasStructuredJson(migrationDir: string): boolean {
  return loadToscaFullMigration(migrationDir) !== null;
}

async function runMigratedStructuredTestcaseFiltered(options: {
  page: Page;
  migrationDir: string;
  testcaseNodePath: string;
  strict?: boolean;
  stepFilter?: (row: Record<string, unknown>) => boolean;
}): Promise<StepValidationResult[]> {
  const full = loadToscaFullMigration(options.migrationDir);
  const tc = resolveStructuredTestcaseForExportNodePath(full, options.testcaseNodePath);
  if (!tc) return [];

  const liters = getMergedLiteralsForPlaywright(options.migrationDir);
  const catalog = ModuleCatalog.load(options.migrationDir);
  const rtbModuleLinks = getRtbModuleLinks(options.migrationDir);
  const phCtx = getPlaceholderResolutionContext(options.migrationDir);
  const buckets = flattenTestcaseForAgentAudit(tc);
  const results: StepValidationResult[] = [];

  for (const { rows } of buckets) {
    for (const row of rows) {
      if (String(row.__type ?? '') !== 'XTestStepValue') continue;
      if (options.stepFilter && !options.stepFilter(row)) continue;
      const rndS = seedFromStrings([
        options.migrationDir,
        String(row['(R)NodePath'] ?? ''),
        String(row.__title ?? ''),
      ]);
      results.push(
        await validateStepWithSupportingModules({
          page: options.page,
          stepRow: row,
          catalog,
          literals: liters,
          strict: options.strict ?? false,
          rtbModuleLinks,
          migrationDir: options.migrationDir,
          placeholderContext: phCtx,
          rndSeed: rndS,
        })
      );
    }
  }
  return results;
}

/** Every **XTestStepValue** under the structured testcase (all phases, Tosca order). */
export async function runMigratedStructuredTestcaseFull(options: {
  page: Page;
  migrationDir: string;
  testcaseNodePath: string;
  strict?: boolean;
}): Promise<StepValidationResult[]> {
  return runMigratedStructuredTestcaseFiltered({ ...options });
}

/** Steps whose stamped **Module** or resolved **XModuleAttribute.Module** is in **`moduleStamps`**, or RTB-linked modules match. */
export async function runMigratedStructuredTestcaseForModules(options: {
  page: Page;
  migrationDir: string;
  testcaseNodePath: string;
  moduleStamps: string[];
  strict?: boolean;
}): Promise<StepValidationResult[]> {
  const catalog = ModuleCatalog.load(options.migrationDir);
  const rtbModuleLinks = getRtbModuleLinks(options.migrationDir);
  const stamps = new Set(options.moduleStamps.map((s) => s.trim()).filter(Boolean));

  return runMigratedStructuredTestcaseFiltered({
    page: options.page,
    migrationDir: options.migrationDir,
    testcaseNodePath: options.testcaseNodePath,
    strict: options.strict,
    stepFilter: (row) => {
      if (stamps.has(stripModuleStamp(row.Module))) return true;
      const stepTitle =
        typeof row.__title === 'string' ? row.__title.trim() : String(row.__title ?? '').trim();
      const insertFolder = extractInsertComponentFolder(row['(R)NodePath']);
      const rtbRefs = extractRtbRefsFromRecord(row);
      const linkedModules = [...new Set(rtbRefs.flatMap((r) => rtbModuleLinks[r] ?? []))];
      const modRow = catalog.resolveAttributeForStep(insertFolder, stepTitle, {
        moduleField: row.Module,
        linkedModuleNames: linkedModules,
      });
      if (modRow && stamps.has(stripModuleStamp(modRow.Module))) return true;
      return false;
    },
  });
}

/** Steps whose **Value** / subtree references **`{RTB[name]}`** where **name** matches **`rtbName`**. */
export async function runMigratedStructuredTestcaseForRtb(options: {
  page: Page;
  migrationDir: string;
  testcaseNodePath: string;
  rtbName: string;
  strict?: boolean;
}): Promise<StepValidationResult[]> {
  const nm = options.rtbName.trim();
  if (!nm) return [];
  return runMigratedStructuredTestcaseFiltered({
    page: options.page,
    migrationDir: options.migrationDir,
    testcaseNodePath: options.testcaseNodePath,
    strict: options.strict,
    stepFilter: (row) => extractRtbRefsFromRecord(row).includes(nm),
  });
}

export function summarizeStepOutcomes(rows: StepValidationResult[]): {
  total: number;
  validated: number;
  skipped: number;
} {
  let validated = 0;
  let skipped = 0;
  for (const r of rows) {
    if (r.outcome === 'validated') validated++;
    else skipped++;
  }
  return { total: rows.length, validated, skipped };
}
/* AI Generated Code by Deloitte + Cursor (END) */
