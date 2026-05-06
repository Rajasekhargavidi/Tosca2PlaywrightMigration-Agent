/* AI Generated Code by Deloitte + Cursor (BEGIN) */
import fs from 'fs';
import path from 'path';

export type ToscaTestcaseRow = {
  __title?: string;
  __type?: string;
  Name?: string;
  '(R)NodePath'?: string;
  [key: string]: unknown;
};

/**
 * True when a JSONL row from testcases.jsonl represents a Tosca TestCase object.
 */
export function isToscaTestcaseRow(row: Record<string, unknown>): boolean {
  const t = String(row.__type ?? '');
  return t === 'TestCase' || t.endsWith('TestCase');
}

function displayTitle(row: ToscaTestcaseRow, index: number): string {
  const fromTitle = row.__title?.trim();
  if (fromTitle) return fromTitle;
  const name = typeof row.Name === 'string' ? row.Name.trim() : '';
  if (name) return name;
  const p = typeof row['(R)NodePath'] === 'string' ? row['(R)NodePath'].trim() : '';
  if (p) return p.split('/').filter(Boolean).pop() ?? `TestCase ${index}`;
  return `TestCase ${index}`;
}

/** De-duplicate Playwright titles when Tosca repeats names. */
export function playbookTitles(rows: ToscaTestcaseRow[]): string[] {
  const counts = new Map<string, number>();
  return rows.map((row, index) => {
    const base = displayTitle(row, index);
    const n = (counts.get(base) ?? 0) + 1;
    counts.set(base, n);
    return n > 1 ? `${base} (${n})` : base;
  });
}

/** Synchronously load testcase records from migration testcases.jsonl (small files; ok for Playwright collect). */
export function loadTestcasesJsonlSync(filePath: string): ToscaTestcaseRow[] {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const out: ToscaTestcaseRow[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    try {
      const row = JSON.parse(t) as Record<string, unknown>;
      if (isToscaTestcaseRow(row)) out.push(row as ToscaTestcaseRow);
    } catch {
      /* skip malformed line */
    }
  }
  return out;
}

export function testcaseJsonlPath(migrationDir: string): string {
  return path.join(migrationDir, 'testcases.jsonl');
}

/* AI Generated Code by Deloitte + Cursor (END) */
