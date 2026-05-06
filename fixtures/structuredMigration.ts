/* AI Generated Code by Deloitte + Cursor (BEGIN) */
import fs from 'fs';
import path from 'path';

export type ToscaPhaseTree = {
  rows: Record<string, unknown>[];
  children: Record<string, ToscaPhaseTree>;
};

export type ToscaStructuredTestcase = {
  testcaseNodePath: string;
  summary: { rowCount: number; suiteTrail?: string[] };
  phases: Record<string, ToscaPhaseTree>;
  unclassified: ToscaPhaseTree;
};

/** Extracted `{PREFIX[name]}` usage across migration exports (`B`, `PL`, `CP`, `RTB`, …). */
export type ToscaGlobalReferences = {
  bufferRef?: string[];
  rtbRef?: string[];
  paramRef?: string[];
  listRef?: string[];
  placeholderRefsByPrefix?: Record<string, string[]>;
};

export type ToscaFullMigrationFile = {
  schemaVersion?: number;
  generatedAt?: string;
  sources?: Record<string, string>;
  stats?: Record<string, unknown>;
  globalReferences?: ToscaGlobalReferences;
  /** Rows whose __title/Name matches `{RTB[x]}` reference name and carry a **Module** field → module library names. */
  rtbModuleLinks?: Record<string, string[]>;
  testcases?: ToscaStructuredTestcase[];
  testcaseMetaExported?: Record<string, unknown>[];
  catalogs?: {
    libraryParametersAll?: Record<string, unknown>[];
    businessParameters?: Record<string, unknown>[];
  };
  locatorHintIndex?: {
    modulesByTailTitle?: Record<string, Record<string, unknown>>;
    modulesSamplesByType?: Record<string, unknown>;
  };
  typeSamplesFirstRow?: Record<string, unknown>;
  hints?: string[];
};

export function fullMigrationPath(migrationDir: string): string {
  return path.join(migrationDir, 'playwright_tosca_full_migration.json');
}

export function loadToscaFullMigration(migrationDir: string): ToscaFullMigrationFile | null {
  const fp = fullMigrationPath(migrationDir);
  if (!fs.existsSync(fp)) return null;
  let raw = fs.readFileSync(fp, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw) as ToscaFullMigrationFile;
}

/** Module names stamped on RTB definition rows (`Module` field) keyed by `{RTB[Name]}`. */
export function getRtbModuleLinks(migrationDir: string): Record<string, string[]> {
  const doc = loadToscaFullMigration(migrationDir);
  const raw = doc?.rtbModuleLinks;
  return raw && typeof raw === 'object' ? { ...raw } : {};
}

export function flattenTestcaseForPlaywright(tc: ToscaStructuredTestcase): {
  phase: string;
  pathUnderPhase: string;
  rows: Record<string, unknown>[];
}[] {
  const flat: { phase: string; pathUnderPhase: string; rows: Record<string, unknown>[] }[] = [];
  for (const phaseKey of Object.keys(tc.phases ?? {}).sort()) {
    const root = tc.phases[phaseKey];
    if (!root) continue;
    const walk = (rel: string, n: ToscaPhaseTree) => {
      if (n.rows?.length) flat.push({ phase: phaseKey, pathUnderPhase: rel, rows: n.rows });
      for (const ch of Object.keys(n.children ?? {}).sort()) {
        walk(rel ? `${rel}/${ch}` : ch, n.children[ch]);
      }
    };
    walk('', root);
  }
  return flat;
}

/** Tosca-style phase order for step-by-step audits (prerequisites → process → post, …). */
export const TOSCA_PHASE_ORDER = [
  'prerequisites',
  'process',
  'postRequisites',
  'cleansing',
  'recovery',
] as const;

/**
 * Flatten structured testcase rows in **execution order**: fixed phase order, then any extra phase keys, then **unclassified**.
 */
export function flattenTestcaseForAgentAudit(tc: ToscaStructuredTestcase): {
  phase: string;
  pathUnderPhase: string;
  rows: Record<string, unknown>[];
}[] {
  const flat: { phase: string; pathUnderPhase: string; rows: Record<string, unknown>[] }[] = [];
  const walk = (phaseKey: string, rel: string, n: ToscaPhaseTree) => {
    if (n.rows?.length) flat.push({ phase: phaseKey, pathUnderPhase: rel, rows: n.rows });
    for (const ch of Object.keys(n.children ?? {}).sort()) {
      walk(phaseKey, rel ? `${rel}/${ch}` : ch, n.children[ch]);
    }
  };
  const seen = new Set<string>();
  for (const pk of TOSCA_PHASE_ORDER) {
    seen.add(pk);
    const root = tc.phases?.[pk];
    if (root) walk(pk, '', root);
  }
  for (const pk of Object.keys(tc.phases ?? {}).sort()) {
    if (seen.has(pk)) continue;
    const root = tc.phases[pk];
    if (root) walk(pk, '', root);
  }
  const un = tc.unclassified;
  if (un && (un.rows?.length || Object.keys(un.children ?? {}).length)) {
    walk('unclassified', '', un);
  }
  return flat;
}

/** Every row nested under **`phases[phase]`** (e.g. **prerequisites**), depth-first into children (no phase ordering merge). */
export function gatherAllRowsInPhase(tc: ToscaStructuredTestcase, phase: string): Record<string, unknown>[] {
  const root = tc.phases?.[phase];
  if (!root) return [];
  const bucket: Record<string, unknown>[] = [];
  function walk(tree: ToscaPhaseTree): void {
    bucket.push(...(tree.rows ?? []));
    for (const ch of Object.values(tree.children ?? {})) walk(ch);
  }
  walk(root);
  return bucket;
}

/** Prefer the most-specific structured testcase whose path matches **substring**. */
export function pickStructuredTestcaseMatching(
  full: ToscaFullMigrationFile | null,
  testcasePathSubstring: string
): ToscaStructuredTestcase | undefined {
  if (!full?.testcases?.length) return undefined;
  const h = testcasePathSubstring.trim().toLowerCase();
  if (!h) return undefined;
  const hits = full.testcases.filter((tc) => tc.testcaseNodePath.toLowerCase().includes(h));
  if (hits.length === 0) return undefined;
  if (hits.length === 1) return hits[0];
  return [...hits].sort((a, b) => b.testcaseNodePath.length - a.testcaseNodePath.length)[0];
}

/* AI Generated Code by Deloitte + Cursor (END) */
