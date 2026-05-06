/* AI Generated Code by Deloitte + Cursor (BEGIN) */
import { getMergedLiteralsForPlaywright } from './fullMigrationMap';
import { extractBracketPlaceholdersDeep } from './toscaPlaceholderRefs';
import {
  gatherAllRowsInPhase,
  loadToscaFullMigration,
  pickStructuredTestcaseMatching,
  type ToscaStructuredTestcase,
} from './structuredMigration';
import { loadTestcasesJsonlSync, testcaseJsonlPath } from './toscaTestcases';

const MAX_DEPTH = 6;

/**
 * Tosca **`TestCase`** exports often nest configuration blocks (pairs like **Name** + **Value**).
 * This walk collects **`string` → `string`** entries for URLs, credentials placeholders, buffer-like keys,
 * etc. **Do not store production passwords in exported JSON committed to git** — prefer vault / CI vars for CI.
 */

function stripQuotes(s: string): string {
  let t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))
    t = t.slice(1, -1).trim();
  return t;
}

/** True if value looks worth keeping as a testcase configuration literal. */
function isConfigValueCandidate(v: string): boolean {
  const t = stripQuotes(v);
  if (!t) return false;
  if (/^https?:\/\//i.test(t)) return true;
  if (/^[\w.+-]+@[\w.-]+\.[a-z]{2,}$/i.test(t)) return true;
  if (t.length >= 120) return false;
  /** Non-empty alphanumeric-ish tokens (URLs, IDs, passwords — consumers must treat secrets carefully). */
  return /^[\x20-\x7E]+$/.test(t);
}

/** Recursively collect **`Name`**-keyed (**`Name`/`__title`**) string **`Value`**s from subtree shapes. */
export function collectConfigurableStringsFromRecord(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};

  /** Top-level string fields Tosca may export on **TestCase** (URL bases, workspace profile, …) */
  for (const [k, raw] of Object.entries(row)) {
    if (typeof raw !== 'string') continue;
    if (k.startsWith('__')) continue;
    if (k === '(R)NodePath' || k === '(R)UniqueId' || k === '__type') continue;
    const t = stripQuotes(raw);
    const keySignalsConfig = /url|base|sut|environment|tenant|workspace|browser|credential|login|user|password|secret/i.test(k);
    const valueLooksUrl = /^https?:\/\//i.test(t);
    if (!(keySignalsConfig || valueLooksUrl)) continue;
    if (!isConfigValueCandidate(raw)) continue;
    out[k] = t;
  }

  function walk(val: unknown, depth: number): void {
    if (depth > MAX_DEPTH || val === null || val === undefined) return;
    if (Array.isArray(val)) {
      for (const el of val) walk(el, depth + 1);
      return;
    }
    if (typeof val !== 'object') return;
    const rec = val as Record<string, unknown>;

    const nameRaw = rec.Name ?? rec.__title ?? rec.DisplayName;
    const valRaw =
      rec.Value ??
      rec['(R)ValueToUse'] ??
      rec.DefaultValue ??
      (typeof rec.Val === 'string' ? rec.Val : undefined);

    if (
      typeof nameRaw === 'string' &&
      nameRaw.trim() &&
      typeof valRaw === 'string' &&
      isConfigValueCandidate(valRaw)
    ) {
      const key = stripQuotes(nameRaw.trim());
      if (key && !key.startsWith('__')) out[key] = stripQuotes(valRaw);
    }

    for (const v of Object.values(rec)) walk(v, depth + 1);
  }

  walk(row, 0);
  return out;
}

export type MergeTestcaseConfigOptions = {
  /** Prefer TestCase rows whose path or title contains this substring (e.g. `Thank`). Others still merge after. */
  preferNodePathSubstring?: string;
};

function rowHintMatch(row: Record<string, unknown>, hint: string): boolean {
  const h = hint.toLowerCase();
  const p = String(row['(R)NodePath'] ?? '').toLowerCase();
  const tt = String(row.__title ?? row.Name ?? '').toLowerCase();
  return p.includes(h) || tt.includes(h);
}

function normalizeNodePath(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Match **TestCase** meta row from **`testcaseMetaExported`** to a structured testcase path.
 */
export function pickTestcaseMetaForStructuredTestcase(
  metaExported: Record<string, unknown>[],
  structured: ToscaStructuredTestcase
): Record<string, unknown> | undefined {
  const target = normalizeNodePath(structured.testcaseNodePath);
  const leaf = (target.split('|').pop() ?? target).trim();

  const exact = metaExported.find(
    (r) => normalizeNodePath(String(r['(R)NodePath'] ?? '')) === target
  );
  if (exact) return exact as Record<string, unknown>;

  let best: Record<string, unknown> | undefined;
  let bestLen = 0;
  for (const r of metaExported) {
    const p = normalizeNodePath(String(r['(R)NodePath'] ?? ''));
    if (!p) continue;
    if (!(target.includes(p) || p.includes(target))) {
      if (!(p.includes(leaf) || leaf.includes(p))) continue;
    }
    if (p.length > bestLen) {
      bestLen = p.length;
      best = r as Record<string, unknown>;
    }
  }
  return best;
}

/**
 * Inner names from **`{B[x]}`, `{PL[x]}`, `{CP[x]}`, …`** used anywhere in prerequisite step rows —
 * same names **must** match **Test configuration** entries before we overlay those literals.
 */

export function referencedBracketNamesFromStepRows(rows: Record<string, unknown>[]): Set<string> {
  const s = new Set<string>();
  for (const row of rows) {
    for (const m of extractBracketPlaceholdersDeep(row)) {
      const pref = m.prefix.toUpperCase();
      if (pref === 'RND' || pref === 'REGEX') continue;
      const nm = m.name.trim();
      if (nm) s.add(nm);
    }
  }
  return s;
}

/** TestCase configuration pairs **only** for keys referenced in **`prerequisiteRows`** via **`{PREFIX[name]}`**. */
export function computePrerequisiteBackedOverlay(
  metaRow: Record<string, unknown> | undefined,
  prerequisiteRows: Record<string, unknown>[]
): Record<string, string> {
  const refs = referencedBracketNamesFromStepRows(prerequisiteRows);
  const overlay: Record<string, string> = {};
  if (!metaRow) return overlay;
  const raw = collectConfigurableStringsFromRecord(metaRow);
  for (const [k, v] of Object.entries(raw)) {
    if (!refs.has(k)) continue;
    overlay[k] = v;
  }
  return overlay;
}

export type PrerequisiteGatedMergeResult = {
  merged: Record<string, string>;
  prerequisiteReferencedBracketNames: Set<string>;
  /** Structured migration consumed — overlay only prerequisite-backed config keys */
  prerequisiteGateActive: boolean;
  /** Keys whose values were taken from **TestCase** meta (`computePrerequisiteBackedOverlay`). Bundle/base keys are absent here. */
  testcaseConfigOverlayKeys: Set<string>;
};

/**
 * Merges **bundle literals** + **only** testcase configuration pairs whose keys appear as **`{PREFIX[name]}`**
 * references under **that testcase's prerequisites**.
 *
 * Fallback (no **`playwright_tosca_full_migration.json`** testcase tree): behaves like **`getMergedLiteralsIncludingTestcaseConfig`**.
 */
export function getMergedLiteralsWithPrerequisiteGatedOverlay(
  migrationDir: string,
  options: { testcasePathSubstring: string }
): PrerequisiteGatedMergeResult {
  const base = getMergedLiteralsForPlaywright(migrationDir);
  const full = loadToscaFullMigration(migrationDir);
  const structured = pickStructuredTestcaseMatching(full, options.testcasePathSubstring);

  if (!structured || !full?.testcaseMetaExported?.length) {
    const merged = getMergedLiteralsIncludingTestcaseConfig(migrationDir, {
      preferNodePathSubstring: options.testcasePathSubstring,
    });
    return {
      merged,
      prerequisiteReferencedBracketNames: new Set(),
      prerequisiteGateActive: false,
      testcaseConfigOverlayKeys: new Set(),
    };
  }

  const prereqRows = gatherAllRowsInPhase(structured, 'prerequisites');
  const refs = referencedBracketNamesFromStepRows(prereqRows);
  const metaRow = pickTestcaseMetaForStructuredTestcase(full.testcaseMetaExported, structured);
  const overlay = computePrerequisiteBackedOverlay(metaRow, prereqRows);

  return {
    merged: { ...base, ...overlay },
    prerequisiteReferencedBracketNames: refs,
    prerequisiteGateActive: true,
    testcaseConfigOverlayKeys: new Set(Object.keys(overlay)),
  };
}

/**
 * Loads **`testcaseMetaExported`** from **`playwright_tosca_full_migration.json`**, else **`testcases.jsonl`**,
 * and merges flattened configuration strings (**later** rows overwrite same keys unless `prefer*` ordering reorder).
 */
export function mergeTestcaseConfigurationLiterals(
  migrationDir: string,
  opts?: MergeTestcaseConfigOptions
): Record<string, string> {
  const full = loadToscaFullMigration(migrationDir);
  const fromFull = full?.testcaseMetaExported;
  let rows =
    fromFull !== undefined && fromFull.length > 0
      ? fromFull
      : loadTestcasesJsonlSync(testcaseJsonlPath(migrationDir)).map((r) => r as Record<string, unknown>);
  rows = [...rows];

  const hint = opts?.preferNodePathSubstring?.trim();
  /** Least-specific first, matching testcase last → keys overwrite with Thank You-specific config. */
  let orderedRows: Record<string, unknown>[];
  if (hint && rows.some((r) => rowHintMatch(r, hint))) {
    const preferred = rows.filter((r) => rowHintMatch(r, hint));
    const other = rows.filter((r) => !rowHintMatch(r, hint));
    orderedRows = [...other, ...preferred];
  } else orderedRows = rows;

  const merged: Record<string, string> = {};
  for (const r of orderedRows) {
    Object.assign(merged, collectConfigurableStringsFromRecord(r));
  }
  return merged;
}

/**
 * **`combinedLiterals`** + **TestCase** configuration overlays (Tosca wins on duplicate keys —
 * testcase-specific URL / credential fields override buffers from the bundle).
 */

export function getMergedLiteralsIncludingTestcaseConfig(
  migrationDir: string,
  opts?: MergeTestcaseConfigOptions
): Record<string, string> {
  const base = getMergedLiteralsForPlaywright(migrationDir);
  const fromTc = mergeTestcaseConfigurationLiterals(migrationDir, opts);
  return { ...base, ...fromTc };
}

/** Convenience for login/smoke harnesses sourcing Tosca testcase config (**do not commit real secrets**). */
export type ToscaPlaybackHints = {
  applicationUrl?: string;
  userName?: string;
  password?: string;
};

const APPLICATION_URL_KEYS = ['ApplicationURL', 'ApplicationUrl', 'BaseURL', 'BaseUrl', 'SUT_URL', 'TOSCA_SUT_URL'];
const USERNAME_KEYS = ['UserName', 'Username', 'Login', 'TestUser', 'User'];
const PASSWORD_KEYS = ['Password', 'Pwd', 'Secret'];

function firstKey(merged: Record<string, string>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = merged[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

export function playbackHintsFromMergedLiterals(merged: Record<string, string>): ToscaPlaybackHints {
  const applicationUrl =
    firstKey(merged, APPLICATION_URL_KEYS);
  return {
    applicationUrl,
    userName: firstKey(merged, USERNAME_KEYS),
    password: firstKey(merged, PASSWORD_KEYS),
  };
}

/* AI Generated Code by Deloitte + Cursor (END) */
