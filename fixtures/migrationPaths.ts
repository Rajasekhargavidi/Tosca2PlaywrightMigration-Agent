/* AI Generated Code by Deloitte + Cursor (BEGIN) */
import fs from 'fs';
import path from 'path';

/**
 * Absolute directory produced by Run-ToscaMigration.ps1 (defaults under C:\\Exports\\migration).
 */
export function getMigrationDir(): string {
  const raw = process.env.TOSCA_MIGRATION_DIR;
  if (!raw || !fs.existsSync(raw)) {
    throw new Error(
      `Set env TOSCA_MIGRATION_DIR to your migration folder (e.g. C:\\\\Exports\\\\migration). Current: '${raw ?? ''}'.`
    );
  }
  return path.resolve(raw);
}

/** Same resolution as **`getMigrationDir`** but returns **`''`** instead of throwing — for optional Playwright skips. */
export function tryGetMigrationDir(): string {
  const raw = process.env.TOSCA_MIGRATION_DIR;
  if (!raw || !fs.existsSync(raw)) return '';
  return path.resolve(raw);
}

export type Manifest = {
  schemaVersion?: string;
  primaryForPlaywright?: string;
  primaryReason?: string;
  primaryBufferDataForPw?: string;
  bufferDataReason?: string;
  files?: Record<
    string,
    { raw_txt?: string; jsonl?: string; csv?: string; json?: string; category?: string }
  >;
};

export function readManifest(dir: string): Manifest | null {
  const manifestPath = path.join(dir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return null;
  let raw = fs.readFileSync(manifestPath, 'utf8');
  raw = raw.replace(/^\uFEFF/, '');
  return JSON.parse(raw) as Manifest;
}
/* AI Generated Code by Deloitte + Cursor (END) */
