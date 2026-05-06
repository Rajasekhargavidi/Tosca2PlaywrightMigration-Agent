/* AI Generated Code by Deloitte + Cursor (BEGIN) */
/**
 * Filename segments for **`tests/migrated/`** paths (modules, RTBs, testcase basenames share rules).
 * Keep in sync wherever **`tests/migrated/**`** paths are computed.
 */

export function sanitizePathSegment(raw, maxLen = 96) {
  const t = String(raw)
    .replace(/[`$]/g, '')
    .replace(/[\x00-\x1f<>:"|?*\\/]+/g, '_')
    .replace(/\s+/g, '_')
    .trim();
  const clipped = (t.slice(0, maxLen).replace(/[._]+$/, '') || 'unnamed').replace(/^\.+/, 'm');
  return clipped || 'unnamed';
}
/* AI Generated Code by Deloitte + Cursor (END) */
