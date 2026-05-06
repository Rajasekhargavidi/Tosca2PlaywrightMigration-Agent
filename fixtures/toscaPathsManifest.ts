/* AI Generated Code by Deloitte + Cursor (BEGIN) */
import fs from 'fs';
import path from 'path';

/** Declares Tosca Commander workspace roots, logical node paths, and optional TCShell automation hooks. */
export type ToscaPathsManifest = {
  schemaVersion: 1;
  /** Commander / project workspace root directories (disk paths). */
  toscaWorkspaceRoots: string[];
  /** Target folder for JSONL/CSV exports (often matches `TOSCA_MIGRATION_DIR`). */
  exportOutputDir?: string;
  /**
   * Logical node paths inside the workspace (as shown in Commander or export trees).
   * Used to re-locate modules, libraries, and test cases during gap-fill.
   */
  nodePaths: {
    modules?: string;
    libraries?: {
      author?: string;
      publish?: string;
      common?: string;
      [area: string]: string | undefined;
    };
    testcases?: string;
    [key: string]: unknown;
  };
  /** Optional Tricentis TCShell automation for re-export / gap recovery. */
  tcshell?: {
    executablePath?: string;
    workingDirectory?: string;
    /** Named scripts, bat files, or documented one-liners to refresh exports. */
    gapFillCommands?: string[];
  };
  notes?: string;
};

export function isToscaPathsManifest(x: unknown): x is ToscaPathsManifest {
  if (x === null || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return o.schemaVersion === 1 && Array.isArray(o.toscaWorkspaceRoots) && typeof o.nodePaths === 'object' && o.nodePaths !== null;
}

export function loadToscaPathsManifest(filePath: string): ToscaPathsManifest | null {
  const fp = path.resolve(filePath);
  if (!fs.existsSync(fp)) return null;
  let raw = fs.readFileSync(fp, 'utf8').replace(/^\uFEFF/, '');
  const parsed: unknown = JSON.parse(raw);
  if (!isToscaPathsManifest(parsed)) return null;
  return parsed;
}

/** Resolve path from env `TOSCA_PATHS_MANIFEST` when set and file exists. */
export function loadToscaPathsManifestFromEnv(): ToscaPathsManifest | null {
  const raw = process.env.TOSCA_PATHS_MANIFEST?.trim();
  if (!raw) return null;
  return loadToscaPathsManifest(raw);
}

/** Join a workspace root with a logical node path segment (forward slashes ok). */
export function resolveUnderWorkspaceRoot(workspaceRoot: string, nodePathSegment: string): string {
  const seg = nodePathSegment.replace(/^[/\\]+|[/\\]+$/g, '').split(/[/\\]+/).join(path.sep);
  return path.resolve(workspaceRoot, seg);
}

/* AI Generated Code by Deloitte + Cursor (END) */
