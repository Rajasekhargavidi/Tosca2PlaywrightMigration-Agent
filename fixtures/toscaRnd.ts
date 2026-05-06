/* AI Generated Code by Deloitte + Cursor (BEGIN) */
/**
 * Tosca **RND** — random digits / letters / numbers for `{RND[spec]}` placeholders.
 * Use a **seed** (e.g. per testcase step) so Playwright runs stay deterministic and assertions stay accurate.
 */

const DIGITS = '0123456789';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = LOWER.toUpperCase();
const LETTERS = LOWER + UPPER;
const ALNUM = DIGITS + LETTERS;

/** Mulberry32 — fast, seedable; suitable for test data (not crypto). */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickChar(alphabet: string, rng: () => number): string {
  return alphabet[Math.floor(rng() * alphabet.length)] ?? alphabet[0] ?? '0';
}

export function randomString(length: number, alphabet: string, rng: () => number): string {
  let s = '';
  for (let i = 0; i < length; i++) s += pickChar(alphabet, rng);
  return s;
}

/**
 * Map **RND** bracket content to a regex fragment (for assertions when you still have the template).
 * Examples: `d:4` → `\d{4}`, `l:3` → `[a-zA-Z]{3}`, empty → default alnum run.
 */
export function rndSpecToRegexFragment(spec: string): string {
  const raw = spec.trim();
  const low = raw.toLowerCase();

  if (!raw) return '[0-9a-zA-Z]{4,12}';

  const md = low.match(/^d(?:igits?)?[:_\s-]?(\d+)$/);
  if (md) return `\\d{${Number(md[1])}}`;

  const ml = low.match(/^l(?:etters?)?[:_\s-]?(\d+)$/);
  if (ml) return `[a-zA-Z]{${Number(ml[1])}}`;

  const ma = low.match(/^a(?:lpha)?(?:num)?[:_\s-]?(\d+)$/);
  if (ma) return `[0-9a-zA-Z]{${Number(ma[1])}}`;

  if (low === 'n' || low === 'num' || low === 'number' || low === 'int') return '\\d{1,9}';

  const mlen = low.match(/^len[:_\s-]?(\d+)$/);
  if (mlen) return `[0-9a-zA-Z]{${Number(mlen[1])}}`;

  return '[0-9a-zA-Z]{4,12}';
}

function floor(n: number): number {
  return Math.floor(Math.max(0, n));
}

/**
 * Resolve `{RND[spec]}` to a concrete string using **rng** (call **mulberry32(seed)** per step, then reuse).
 */
export function resolveRndPlaceholder(spec: string, rng: () => number): string {
  const raw = spec.trim();
  const low = raw.toLowerCase();

  if (!raw) return randomString(8, ALNUM, rng);

  const md = low.match(/^d(?:igits?)?[:_\s-]?(\d+)$/);
  if (md) return randomString(Number(md[1]), DIGITS, rng);

  const ml = low.match(/^l(?:etters?)?[:_\s-]?(\d+)$/);
  if (ml) return randomString(Number(ml[1]), LETTERS, rng);

  const ma = low.match(/^a(?:lpha)?(?:num)?[:_\s-]?(\d+)$/);
  if (ma) return randomString(Number(ma[1]), ALNUM, rng);

  if (low === 'n' || low === 'num' || low === 'number' || low === 'int')
    return String(floor(rng() * 1_000_000));

  const mlen = low.match(/^len[:_\s-]?(\d+)$/);
  if (mlen) return randomString(Number(mlen[1]), ALNUM, rng);

  return randomString(8, ALNUM, rng);
}

/** Stable seed from a testcase path / title (deterministic `{RND}` per step). */
export function seedFromStrings(parts: string[]): number {
  let h = 0x811c9dc5;
  for (const p of parts) {
    for (let i = 0; i < p.length; i++) {
      h ^= p.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
      h >>>= 0;
    }
  }
  return h >>> 0;
}
/* AI Generated Code by Deloitte + Cursor (END) */
