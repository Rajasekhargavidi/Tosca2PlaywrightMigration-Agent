/* AI Generated Code by Deloitte + Cursor (BEGIN) */
/** Escape attribute / text fragment for locator template (not exhaustive). */
function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Returns a textual hint Playwright coders can adapt (never auto-run blindly).
 */
export function buildLocatorSuggestion(row: Record<string, unknown>): string | null {
  const tag = String(row['(P)Tag'] ?? '').trim();
  const cls = String(row['(P)ClassName'] ?? '').trim().split(/\s+/).filter(Boolean)[0] ?? '';
  const name = String(row.Name ?? row.__title ?? '').trim();

  if (tag.toLowerCase() === 'button' || String(row.BusinessType ?? '') === 'Button') {
    if (name) return `page.getByRole('button', { name: '${esc(name)}' })`;
  }
  if (tag && cls) return `page.locator('${esc(tag.toLowerCase())}.${esc(cls)}').first()`;
  if (name) return `page.getByText('${esc(name)}').first()`;
  return tag ? `page.locator('${esc(tag.toLowerCase())}').first()` : null;
}
/* AI Generated Code by Deloitte + Cursor (END) */
