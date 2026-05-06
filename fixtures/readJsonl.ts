/* AI Generated Code by Deloitte + Cursor (BEGIN) */
import fs from 'fs';
import readline from 'readline';

/**
 * Streams a JSON Lines file without loading entire file into memory.
 */
export async function* iterateJsonl<T = Record<string, unknown>>(
  filePath: string
): AsyncGenerator<T, void, void> {
  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    const t = line.trim();
    if (!t) continue;
    yield JSON.parse(t) as T;
  }
}

/**
 * Load up to limit records (omit limit for whole file — use iterateJsonl on large dumps).
 */
export async function loadJsonl<T = Record<string, unknown>>(
  filePath: string,
  limit?: number
): Promise<T[]> {
  const out: T[] = [];
  for await (const row of iterateJsonl<T>(filePath)) {
    out.push(row);
    if (limit != null && out.length >= limit) break;
  }
  return out;
}
/* AI Generated Code by Deloitte + Cursor (END) */
