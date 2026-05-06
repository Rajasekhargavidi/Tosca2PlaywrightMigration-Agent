/* AI Generated Code by Deloitte + Cursor (BEGIN) */
import { mulberry32, resolveRndPlaceholder, rndSpecToRegexFragment } from './toscaRnd';

/**
 * Tosca bracket references: `{B[x]}`, `{PL[x]}`, `{CP[x]}`, `{P[x]}`, `{TB[…]}`, `{SK[…]}`, etc.
 * Resolution merges **combinedLiterals** (buffers, step literals, flattened params) plus **parameterValueRanges** fallback.
 */

/** Pattern (no `/g`) — instantiate with `g` where needed to avoid shared `lastIndex` bugs. */
export const TOSCA_BRACKET_PLACEHOLDER_SOURCE = String.raw`\{([A-Za-z]{1,8})\[([^\]]*)\]\}`;




export type ToscaPlaceholderContext = {
  literals: Record<string, string>;
  /** Library `ValueRange` (often `a;b;c`) — first segment used when no literal. */
  parameterValueRanges?: Record<string, string>;
  /**
   * Seed for `{RND[…]}` so random values repeat per run (stable assertions).
   * If omitted, `{RND[…]}` is left unchanged (still a placeholder) until **`rndSeed`** is set on the context.
   */
  rndSeed?: number;
};

export type BracketRefMatch = { prefix: string; name: string; raw: string };

export function extractBracketPlaceholders(text: unknown): BracketRefMatch[] {
  if (typeof text !== 'string' || !text) return [];
  const out: BracketRefMatch[] = [];
  const re = new RegExp(TOSCA_BRACKET_PLACEHOLDER_SOURCE, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const prefix = m[1].toUpperCase();
    const name = m[2].trim();
    if (!name && prefix !== 'RND' && prefix !== 'REGEX') continue;
    out.push({ prefix, name, raw: m[0] });
  }
  return out;
}

/** Walk JSON-like trees and collect every bracket reference. */
export function extractBracketPlaceholdersDeep(root: unknown): BracketRefMatch[] {
  const acc: BracketRefMatch[] = [];
  const walk = (val: unknown): void => {
    if (typeof val === 'string') acc.push(...extractBracketPlaceholders(val));
    else if (Array.isArray(val)) val.forEach(walk);
    else if (val !== null && typeof val === 'object')
      for (const v of Object.values(val as Record<string, unknown>)) walk(v);
  };
  walk(root);
  const key = (x: BracketRefMatch) => `${x.prefix}:${x.name}`;
  const seen = new Set<string>();
  return acc.filter((x) => (seen.has(key(x)) ? false : (seen.add(key(x)), true)));
}

function valueFromParameterRange(name: string, ranges: Record<string, string> | undefined): string | undefined {
  if (!ranges) return undefined;
  const vr = ranges[name];
  if (typeof vr !== 'string' || !vr.trim()) return undefined;
  if (!vr.includes(';')) return vr.trim();
  const first = vr.split(';')[0]?.trim();
  return first || undefined;
}

/**
 * Resolver: same **name** key is used for `B`, `PL`, `P`, `CP`, `CFG`, `TB`, `SK`, etc.
 * (Tosca typically keys by parameter/buffer name inside the brackets.)
 */
export function buildPlaceholderResolver(ctx: ToscaPlaceholderContext): (prefix: string, name: string) => string | undefined {
  const ranges = ctx.parameterValueRanges ?? {};
  return (_prefix: string, name: string) => {
    const n = name.trim();
    if (!n) return undefined;
    const lit = ctx.literals[n];
    if (lit !== undefined && lit !== '') return lit;
    return valueFromParameterRange(n, ranges);
  };
}

/** Multi-pass replacement; `{RND[spec]}` resolves when **`ctx.rndSeed`** is set (per-token salt). */
export function interpolateAllBracketRefs(text: string, ctx: ToscaPlaceholderContext): string {
  const resolve = buildPlaceholderResolver(ctx);
  let rndCounter = 0;
  let prev = text;
  for (let pass = 0; pass < 8; pass++) {
    rndCounter = 0;
    const re = new RegExp(TOSCA_BRACKET_PLACEHOLDER_SOURCE, 'g');
    const next = prev.replace(re, (full, pref: string, nm: string) => {
      const p = pref.toUpperCase();
      if (p === 'REGEX') return full;
      if (p === 'RND') {
        if (ctx.rndSeed === undefined) return full;
        const seed = (ctx.rndSeed + rndCounter++) >>> 0;
        return resolveRndPlaceholder(nm.trim(), mulberry32(seed));
      }
      const v = resolve(p, nm.trim());
      return v === undefined ? full : v;
    });
    if (next === prev) break;
    prev = next;
  }
  return prev;
}

function stripWrappingQuotes(s: string): string {
  let t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))
    return t.slice(1, -1).trim();
  return t;
}

function escapeRegexLit(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** `{REGEX[classA | classB]}` → inner `classA | classB` (after trim / optional quotes). */
export function tryUnwrapRegexBracket(s: string): string | null {
  const t = stripWrappingQuotes(String(s ?? '')).trim();
  const m = t.match(/^\{REGEX\s*\[(.*?)\]\s*\}$/i);
  if (!m) return null;
  return m[1].trim();
}

/** True when string has at least one `{RND[…]}` token. */
export function hasRndPlaceholder(text: string): boolean {
  const re = new RegExp(TOSCA_BRACKET_PLACEHOLDER_SOURCE, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[1].toUpperCase() === 'RND') return true;
  }
  return false;
}

/**
 * Regex for assertions when the template uses **`{REGEX[a|b]}`** and/or **`{RND[…]}`**
 * (literal segments outside brackets are escaped). Other placeholders → **null**.
 */
export function templateToCompositeAssertionRegex(template: string): RegExp | null {
  const re = new RegExp(TOSCA_BRACKET_PLACEHOLDER_SOURCE, 'g');
  const pieces: string[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let any = false;
  while ((m = re.exec(template)) !== null) {
    const pref = m[1].toUpperCase();
    const body = (m[2] ?? '').trim();
    pieces.push(escapeRegexLit(template.slice(last, m.index)));
    if (pref === 'RND') {
      any = true;
      pieces.push(rndSpecToRegexFragment(body));
    } else if (pref === 'REGEX') {
      any = true;
      const alts = body.split(/\s*\|\s*/).map((x) => stripWrappingQuotes(x).trim()).filter(Boolean);
      const escAlts = alts
        .map((a) => a.replace(/\*/g, '').trim())
        .filter(Boolean)
        .map((a) => escapeRegexLit(a));
      pieces.push(escAlts.length ? `(?:${escAlts.join('|')})` : '.*');
    } else {
      return null;
    }
    last = m.index + m[0].length;
  }
  if (!any) return null;
  pieces.push(escapeRegexLit(template.slice(last)));
  return new RegExp(pieces.join(''), 'mis');
}

/**
 * Builds a regex for **toContainText** when the template uses **only** `{RND[…]}` brackets
 * (literal text + RND fragments). Returns **null** if other placeholders appear.
 */
export function templateRndOnlyToAssertionRegex(template: string): RegExp | null {
  const re = new RegExp(TOSCA_BRACKET_PLACEHOLDER_SOURCE, 'g');
  const pieces: string[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let sawRnd = false;
  while ((m = re.exec(template)) !== null) {
    const pref = m[1].toUpperCase();
    const body = (m[2] ?? '').trim();
    if (pref !== 'RND') return null;
    sawRnd = true;
    pieces.push(escapeRegexLit(template.slice(last, m.index)));
    pieces.push(rndSpecToRegexFragment(body));
    last = m.index + m[0].length;
  }
  if (!sawRnd) return null;
  pieces.push(escapeRegexLit(template.slice(last)));
  return new RegExp(pieces.join(''), 'mis');
}

export function hasUnresolvedBracketPlaceholders(text: string): boolean {
  return new RegExp(TOSCA_BRACKET_PLACEHOLDER_SOURCE).test(text);
}

/** True when any `{ PREFIX[…] }` remains besides **`REGEX`** (REGEX stays literal for matchers). */
export function hasUnresolvedNonRegexPlaceholders(text: string): boolean {
  const re = new RegExp(TOSCA_BRACKET_PLACEHOLDER_SOURCE, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[1].toUpperCase() !== 'REGEX') return true;
  }
  return false;
}

export function expandRecordBracketPlaceholders<T extends Record<string, unknown>>(
  record: T,
  ctx: ToscaPlaceholderContext
): T {
  const walk = (val: unknown): unknown => {
    if (typeof val === 'string') return interpolateAllBracketRefs(val, ctx);
    if (Array.isArray(val)) return val.map(walk);
    if (val !== null && typeof val === 'object')
      return Object.fromEntries(Object.entries(val as Record<string, unknown>).map(([k, v]) => [k, walk(v)]));
    return val;
  };
  return walk(record) as T;
}

/** Unique `PREFIX:name` tokens still present after interpolation. */
export function listUnresolvedBracketTokens(text: string): string[] {
  const found = extractBracketPlaceholders(text);
  const out = new Set<string>();
  for (const { prefix, name } of found) out.add(`${prefix}:${name}`);
  return [...out].sort();
}
/* AI Generated Code by Deloitte + Cursor (END) */
