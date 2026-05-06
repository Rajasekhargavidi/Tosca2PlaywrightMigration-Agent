/* AI Generated Code by Deloitte + Cursor (BEGIN) */
import fs from 'fs';
import path from 'path';
import { expandRecordBracketPlaceholders } from './toscaPlaceholderRefs';
import type { ToscaPlaceholderContext } from './toscaPlaceholderRefs';

export type BufferMapFile = {
  schemaVersion?: number;
  buffers?: Record<string, string>;
  stepTitleLiterals?: Record<string, string>;
  buffersInferred?: Record<string, string>;
  combinedForPlaywright?: Record<string, string>;
  bufferCount?: number;
  assignments?: unknown[];
  referenceUsages?: unknown[];
  expandedStepsJsonl?: string | null;
  hint?: string;
};

export function loadPlaywrightBufferMap(migrationDir: string): BufferMapFile {
  const fp = path.join(migrationDir, 'playwright_buffer_map.json');
  if (!fs.existsSync(fp)) {
    return { buffers: {}, combinedForPlaywright: {} };
  }
  let raw = fs.readFileSync(fp, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw) as BufferMapFile;
}

/** Prefer extractor's merged map (buffers + step literals + inferred {B[]} matches). */
export function getCombinedBuffers(m: BufferMapFile): Record<string, string> {
  const c = m.combinedForPlaywright;
  if (c && Object.keys(c).length > 0) return { ...c };
  const b = m.buffers;
  if (b && Object.keys(b).length > 0) return { ...b };
  return {};
}

/**
 * Expand Tosca `{B[Key]}` placeholders using migrated buffer/step data.
 */
export function interpolateTemplates(text: string, buffers: Record<string, string>): string {
  let prev = text;
  for (let i = 0; i < 4; i++) {
    const next = prev.replace(/\{B\[(.*?)\]\}/g, (full, name: string) => {
      const v = buffers[name.trim()];
      return v === undefined ? full : v;
    });
    if (next === prev) break;
    prev = next;
  }
  return prev;
}

/**
 * Walk a step/RTB JSONL object and replace every `{B[name]}` string (including nested arrays/objects).
 */
export function expandRecordBufferTemplates<T extends Record<string, unknown>>(
  record: T,
  buffers: Record<string, string>
): T {
  const walk = (val: unknown): unknown => {
    if (typeof val === 'string') return interpolateTemplates(val, buffers);
    if (Array.isArray(val)) return val.map(walk);
    if (val !== null && typeof val === 'object')
      return Object.fromEntries(Object.entries(val as Record<string, unknown>).map(([k, v]) => [k, walk(v)]));
    return val;
  };
  return walk(record) as T;
}

/** Expand every `{PREFIX[name]}` in a record (`B`, `PL`, `CP`, …). */
export function expandRecordAllToscaBracketPlaceholders<T extends Record<string, unknown>>(
  record: T,
  ctx: ToscaPlaceholderContext
): T {
  return expandRecordBracketPlaceholders(record, ctx);
}
/* AI Generated Code by Deloitte + Cursor (END) */
