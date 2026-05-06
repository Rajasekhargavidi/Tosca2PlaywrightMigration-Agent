// AI Generated Code by Deloitte + Cursor (BEGIN)
/**
 * Tosca migration agent CLI — audits migration folder per `.cursor/rules/tosca-workspace-and-migration-process.mdc`.
 *
 * Usage:
 *   set TOSCA_MIGRATION_DIR=C:\Exports\migration
 *   set TOSCA_PATHS_MANIFEST=C:\path\to\tosca-paths.manifest.json   (optional; see config/tosca-paths.manifest.example.json)
 *   npm run agent:migration
 *
 * Writes `playwright_migration_agent_report.json` under the migration dir.
 * Exit 1 when `AGENT_STRICT=1` and structured migration JSON is missing or any **`XTestStepValue`** lacks resolved **`XModuleAttribute`**.
 */

import fs from 'fs';
import path from 'path';
import {
  printMigrationAgentSummary,
  runToscaMigrationAgent,
  writeAgentReportToDisk,
} from '../fixtures/toscaMigrationAgent';

function main(): void {
  const raw = process.env.TOSCA_MIGRATION_DIR?.trim() ?? '';
  const dir = raw ? path.resolve(raw) : '';
  if (!dir || !fs.existsSync(dir)) {
    console.error('Set env TOSCA_MIGRATION_DIR to your Tosca migration export folder.');
    process.exit(1);
  }

  const report = runToscaMigrationAgent(dir);
  printMigrationAgentSummary(report);
  const outPath = writeAgentReportToDisk(report);
  console.log(`Wrote ${outPath}`);

  const strict = process.env.AGENT_STRICT === '1' || process.env.AGENT_STRICT === 'true';
  const anyMissingModule = report.steps.some((s) => !s.moduleResolved);
  const noFullTree = !report.fullMigrationJsonPresent;
  if (strict && (noFullTree || anyMissingModule)) {
    console.error(
      `[tosca-migration-agent] Strict mode failed (${noFullTree ? 'missing full migration JSON; run build:tosca-full' : ''}${noFullTree && anyMissingModule ? '; ' : ''}${anyMissingModule ? 'steps without resolved module' : ''}).`
    );
    process.exit(1);
  }
}

main();

// AI Generated Code by Deloitte + Cursor (END)
