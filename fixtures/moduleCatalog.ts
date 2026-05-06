/* AI Generated Code by Deloitte + Cursor (BEGIN) */
import fs from 'fs';
import path from 'path';

export type ToscaModuleAttributeRow = Record<string, unknown> & {
  __type?: string;
  '(R)NodePath'?: string;
  '(R)UniqueId'?: string;
  Name?: string;
  __title?: string;
  /** Library module stamp (often quoted): ties RTBs / reused steps to a module subtree. */
  Module?: unknown;
};

function stripQuotes(s: unknown): string {
  let t = String(s ?? '').trim();
  if (t.startsWith("'") && t.endsWith("'") && t.length >= 2) t = t.slice(1, -1);
  if (t.startsWith('"') && t.endsWith('"') && t.length >= 2) t = t.slice(1, -1);
  return t.trim();
}

/** Load every XModuleAttribute row from migration `modules_attributes.jsonl`. */
export function loadModuleAttributesSync(modulesJsonlPath: string): ToscaModuleAttributeRow[] {
  if (!fs.existsSync(modulesJsonlPath)) return [];
  const raw = fs.readFileSync(modulesJsonlPath, 'utf8').replace(/^\uFEFF/, '');
  const rows: ToscaModuleAttributeRow[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    try {
      const row = JSON.parse(t) as ToscaModuleAttributeRow;
      if (String(row.__type ?? '').includes('XModuleAttribute')) rows.push(row);
    } catch {
      /* skip */
    }
  }
  return rows;
}

export function moduleAttributesPath(migrationDir: string): string {
  return path.join(migrationDir, 'modules_attributes.jsonl');
}

/**
 * Parses `…/Insert Components/<Folder>/…` segment from testcase step node path (authoring-side).
 */
export function extractInsertComponentFolder(testStepPath: unknown): string | null {
  const p = typeof testStepPath === 'string' ? testStepPath : '';
  const parts = p.split('/').filter(Boolean);
  const i = parts.findIndex((s) => /^Insert Components$/i.test(s));
  if (i >= 0 && i + 1 < parts.length) return parts[i + 1];
  return null;
}

/**
 * Resolves migrated module-library attributes relevant to this step (same component folder name under Modules tree).
 */
export class ModuleCatalog {
  readonly byPath = new Map<string, ToscaModuleAttributeRow>();

  constructor(readonly rows: ToscaModuleAttributeRow[]) {
    for (const r of rows) {
      const np = String(r['(R)NodePath'] ?? '');
      if (np) this.byPath.set(np, r);
    }
  }

  static load(migrationDir: string): ModuleCatalog {
    return new ModuleCatalog(loadModuleAttributesSync(moduleAttributesPath(migrationDir)));
  }

  /** Rows under Modules whose path mentions the Insert-components folder name (Title (v2), Button, …). */
  candidatesForInsertComponent(folder: string): ToscaModuleAttributeRow[] {
    if (!folder) return [];
    const variants = new Set<string>();
    variants.add(folder.trim());
    variants.add(folder.replace(/\s*\([^)]*v\d+[^)]*\)\s*$/i, '').trim());
    const out: ToscaModuleAttributeRow[] = [];
    const seen = new Set<string>();
    for (const f of variants) {
      if (!f) continue;
      const esc = f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`/(?:Modules|Modules_Library)/.*/(?:${esc})(?:/|$)`, 'i');
      for (const r of this.rows) {
        const np = String(r['(R)NodePath'] ?? '');
        if (!re.test(np)) continue;
        const id = String(r['(R)UniqueId'] ?? np);
        if (seen.has(id)) continue;
        seen.add(id);
        out.push(r);
      }
    }
    return out;
  }

  /** Match an XModuleAttribute row whose Name / __title aligns with the testcase step value title. */
  matchAttributeRowInPool(
    pool: ToscaModuleAttributeRow[],
    stepValueTitle: string
  ): ToscaModuleAttributeRow | undefined {
    if (!stepValueTitle || !pool.length) return undefined;
    const lc = stepValueTitle.toLowerCase();
    let pick = pool.find((r) => String(r.Name ?? '').toLowerCase() === lc);
    if (!pick) pick = pool.find((r) => String(r.__title ?? '').toLowerCase() === lc);
    if (!pick) pick = pool.find((r) => String(r.Name ?? '').toLowerCase().includes(lc));
    if (!pick) pick = pool.find((r) => String(r.__title ?? '').toLowerCase().includes(lc));
    return pick;
  }

  private dedupeRows(rows: ToscaModuleAttributeRow[]): ToscaModuleAttributeRow[] {
    const seen = new Set<string>();
    const out: ToscaModuleAttributeRow[] = [];
    for (const r of rows) {
      const id = String(r['(R)UniqueId'] ?? r['(R)NodePath'] ?? '');
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(r);
    }
    return out;
  }

  /**
   * Best attribute row describing the GUI control aligned with Tosca step value name (__title / buffer name).
   * Falls back to the step's **Module** field and to module names linked from `{RTB[…]}` (see `rtbModuleLinks` in full migration).
   */
  resolveAttributeForStep(
    insertFolder: string | null,
    stepValueTitle: string,
    options?: { moduleField?: unknown; linkedModuleNames?: string[] }
  ): ToscaModuleAttributeRow | undefined {
    if (!stepValueTitle) return undefined;
    let pool = insertFolder ? this.candidatesForInsertComponent(insertFolder) : this.rows;
    if ((!pool || pool.length === 0) && insertFolder)
      pool = this.candidatesForInsertComponent(insertFolder.replace(/\s*\([^)]*\)\s*$/, '').trim());
    if (!pool.length) pool = this.rows;

    let pick = this.matchAttributeRowInPool(pool, stepValueTitle);
    if (pick) return pick;

    const modField = options?.moduleField;
    if (modField !== undefined && modField !== null && String(modField).trim() !== '') {
      const modPool = this.rowsForQuotedModule(modField);
      pick = this.matchAttributeRowInPool(modPool, stepValueTitle);
      if (pick) return pick;
    }

    const linked = options?.linkedModuleNames?.filter(Boolean) ?? [];
    if (linked.length) {
      const merged: ToscaModuleAttributeRow[] = [];
      for (const name of linked) merged.push(...this.rowsForQuotedModule(name));
      pick = this.matchAttributeRowInPool(this.dedupeRows(merged), stepValueTitle);
      if (pick) return pick;
    }

    return undefined;
  }

  /** All Module field literals → attribute rows — use when RTB/steps stamp a Module name instead of XPath path linkage. */
  rowsForQuotedModule(moduleField: unknown): ToscaModuleAttributeRow[] {
    const m = stripQuotes(moduleField);
    if (!m) return [];
    return this.rows.filter((r) => stripQuotes(r.Module) === m);
  }
}
/* AI Generated Code by Deloitte + Cursor (END) */
