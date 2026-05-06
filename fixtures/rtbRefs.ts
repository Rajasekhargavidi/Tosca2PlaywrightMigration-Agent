/* AI Generated Code by Deloitte + Cursor (BEGIN) */

/** Names inside `{RTB[Name]}` in Tosca strings. */
export function extractRtbRefs(value: unknown): string[] {
  const s = typeof value === 'string' ? value : '';
  const names: string[] = [];
  const re = /\{RTB\[([^\]]+)\]\}/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    names.push(m[1].trim());
  }
  return [...new Set(names)];
}

/** Names inside `{RTB[Name]}` for every string field on a step row (Value, nested strings, …). */
export function extractRtbRefsFromRecord(row: Record<string, unknown>): string[] {
  const names: string[] = [];
  const walk = (val: unknown): void => {
    if (typeof val === 'string') names.push(...extractRtbRefs(val));
    else if (Array.isArray(val)) val.forEach(walk);
    else if (val !== null && typeof val === 'object')
      for (const v of Object.values(val as Record<string, unknown>)) walk(v);
  };
  walk(row);
  return [...new Set(names)];
}
/* AI Generated Code by Deloitte + Cursor (END) */
