/* AI Generated Code by Deloitte + Cursor (BEGIN) */
import fs from 'fs';
import path from 'path';
import {
  ModuleCatalog,
  extractInsertComponentFolder,
  moduleAttributesPath,
  loadModuleAttributesSync,
} from './moduleCatalog';
import {
  getMergedLiteralsForPlaywright,
} from './fullMigrationMap';
import { extractRtbRefsFromRecord } from './rtbRefs';
import {
  flattenTestcaseForAgentAudit,
  getRtbModuleLinks,
  loadToscaFullMigration,
  type ToscaStructuredTestcase,
} from './structuredMigration';
import { hasUnresolvedNonRegexPlaceholders, listUnresolvedBracketTokens } from './toscaPlaceholderRefs';
import { resolveExpectedValueFromStep, mergePlaceholderContext } from './testcaseStepValidation';
import { seedFromStrings } from './toscaRnd';
import { loadToscaPathsManifestFromEnv } from './toscaPathsManifest';

function isXTestStepValue(row: Record<string, unknown>): boolean {
  return String(row.__type ?? '') === 'XTestStepValue';
}

/** Heuristic markers on authoring path segments (publish, insert chain, …). */
export function classifyNodePathMarkers(nodePath: string): {
  mentionsInsertComponents: boolean;
  mentionsPublish: boolean;
  mentionsPrePublish: boolean;
  mentionsComponentsFolder: boolean;
} {
  const p = typeof nodePath === 'string' ? nodePath : '';
  return {
    mentionsInsertComponents: /Insert\s+Components/i.test(p),
    mentionsPublish: /(^|\/)[Pp]ublish(\/|$)/.test(p),
    mentionsPrePublish: /[Pp]re-?[Pp]ublish/.test(p),
    mentionsComponentsFolder: /(^|\/)[Cc]omponents(\/|$)/.test(p),
  };
}

export type MigrationAgentStepRecord = {
  testcaseKey: string;
  /** 1-based order within the testcase when walking phases in Tosca order */
  stepOrdinal: number;
  phase: string;
  pathUnderPhase: string;
  stepTitle: string;
  nodePath: string;
  insertComponentFolder: string | null;
  rtbRefs: string[];
  moduleResolved: boolean;
  matchedModuleNodePath?: string;
  valueHasUnresolvedNonRegexPlaceholders: boolean;
  unresolvedBracketTokens: string[];
  markers: ReturnType<typeof classifyNodePathMarkers>;
};

export type MigrationAgentTestcaseSummary = {
  testcaseNodePath: string;
  phaseRowCounts: Record<string, number>;
  xTestStepValueCount: number;
  hasPrerequisites: boolean;
  hasProcess: boolean;
  hasPostRequisites: boolean;
  stepsMissingModule: number;
  stepsWithUnresolvedValuePlaceholders: number;
};

export type MigrationAgentPathsManifestSummary = {
  loaded: boolean;
  sourceFile?: string;
  exportOutputDirMatchesMigrationDir: boolean;
  workspaceRootCount: number;
  hasTcshellHints: boolean;
};

export type MigrationAgentReport = {
  schemaVersion: 1;
  migrationDir: string;
  generatedAt: string;
  fullMigrationJsonPresent: boolean;
  moduleAttributeRowCount: number;
  /** Guideline: full tree should exist before agent audit */
  warnings: string[];
  testcases: MigrationAgentTestcaseSummary[];
  steps: MigrationAgentStepRecord[];
  pathsManifest?: MigrationAgentPathsManifestSummary;
};

function summarizeTestcase(
  tc: ToscaStructuredTestcase,
  steps: MigrationAgentStepRecord[]
): MigrationAgentTestcaseSummary {
  const phaseRowCounts: Record<string, number> = {};
  const buckets = flattenTestcaseForAgentAudit(tc);
  for (const b of buckets) {
    phaseRowCounts[b.phase] = (phaseRowCounts[b.phase] ?? 0) + b.rows.length;
  }
  const mine = steps.filter((s) => s.testcaseKey === tc.testcaseNodePath);
  return {
    testcaseNodePath: tc.testcaseNodePath,
    phaseRowCounts,
    xTestStepValueCount: mine.length,
    hasPrerequisites: (phaseRowCounts.prerequisites ?? 0) > 0,
    hasProcess: (phaseRowCounts.process ?? 0) > 0,
    hasPostRequisites: (phaseRowCounts.postRequisites ?? 0) > 0,
    stepsMissingModule: mine.filter((s) => !s.moduleResolved).length,
    stepsWithUnresolvedValuePlaceholders: mine.filter((s) => s.valueHasUnresolvedNonRegexPlaceholders).length,
  };
}

/**
 * **Tosca migration agent** — audits exports for module traceability, RTB refs, placeholder resolution,
 * and phase coverage (prerequisites / process / post-requisites), per project rules.
 */
export function runToscaMigrationAgent(migrationDir: string): MigrationAgentReport {
  const dir = path.resolve(migrationDir);
  const warnings: string[] = [];

  const manifest = loadToscaPathsManifestFromEnv();
  let pathsManifest: MigrationAgentPathsManifestSummary | undefined;
  if (manifest) {
    const src = process.env.TOSCA_PATHS_MANIFEST?.trim();
    const exp = manifest.exportOutputDir ? path.resolve(manifest.exportOutputDir) : '';
    pathsManifest = {
      loaded: true,
      sourceFile: src,
      exportOutputDirMatchesMigrationDir: !exp || exp === dir,
      workspaceRootCount: manifest.toscaWorkspaceRoots.length,
      hasTcshellHints: Boolean(
        manifest.tcshell?.executablePath?.trim() || (manifest.tcshell?.gapFillCommands?.length ?? 0) > 0
      ),
    };
    if (exp && exp !== dir) {
      warnings.push(
        `TOSCA_PATHS_MANIFEST exportOutputDir (${exp}) differs from audited migration dir (${dir}) — align before gap-fill / re-export.`
      );
    }
  }

  const full = loadToscaFullMigration(dir);
  const fullMigrationJsonPresent = full !== null;
  if (!fullMigrationJsonPresent) {
    warnings.push('Missing playwright_tosca_full_migration.json — run `npm run build:tosca-full` for structured phases and RTB links.');
  }

  const modPath = moduleAttributesPath(dir);
  const modRows = loadModuleAttributesSync(modPath);
  if (modRows.length === 0) {
    warnings.push(`No XModuleAttribute rows in ${modPath} — module-backed locators cannot be resolved.`);
  }

  const catalog = new ModuleCatalog(modRows);
  const rtbModuleLinks = getRtbModuleLinks(dir);
  const liters = getMergedLiteralsForPlaywright(dir);
  const steps: MigrationAgentStepRecord[] = [];
  const testcases = full?.testcases ?? [];

  for (const tc of testcases) {
    const buckets = flattenTestcaseForAgentAudit(tc as ToscaStructuredTestcase);
    let ordinal = 0;
    for (const { phase, pathUnderPhase, rows } of buckets) {
      for (const row of rows) {
        if (!isXTestStepValue(row)) continue;
        ordinal += 1;
        const stepTitle =
          typeof row.__title === 'string'
            ? row.__title.trim()
            : String(row.__title ?? row.Name ?? '').trim();
        const nodePath = typeof row['(R)NodePath'] === 'string' ? row['(R)NodePath'] : '';
        const insertFolder = extractInsertComponentFolder(row['(R)NodePath']);
        const rtbRefs = extractRtbRefsFromRecord(row);
        const linkedModules = [...new Set(rtbRefs.flatMap((r) => rtbModuleLinks[r] ?? []))];

        const rndSeed = seedFromStrings([
          String(row['(R)NodePath'] ?? ''),
          typeof row.__title === 'string' ? row.__title : String(row.__title ?? ''),
          String(row.Name ?? ''),
        ]);
        const phCtx = mergePlaceholderContext(dir, liters, undefined, null, rndSeed);
        const resolvedValue = resolveExpectedValueFromStep(row, phCtx, liters);
        const valueHasUnresolvedNonRegexPlaceholders = hasUnresolvedNonRegexPlaceholders(resolvedValue);
        const unresolvedBracketTokens = listUnresolvedBracketTokens(resolvedValue);

        const modRow = catalog.resolveAttributeForStep(insertFolder, stepTitle, {
          moduleField: row.Module,
          linkedModuleNames: linkedModules,
        });

        steps.push({
          testcaseKey: tc.testcaseNodePath,
          stepOrdinal: ordinal,
          phase,
          pathUnderPhase,
          stepTitle,
          nodePath,
          insertComponentFolder: insertFolder,
          rtbRefs,
          moduleResolved: modRow !== undefined,
          matchedModuleNodePath: modRow ? String(modRow['(R)NodePath'] ?? '') : undefined,
          valueHasUnresolvedNonRegexPlaceholders,
          unresolvedBracketTokens,
          markers: classifyNodePathMarkers(nodePath),
        });
      }
    }
  }

  const tcSummaries = testcases.map((tc) => summarizeTestcase(tc as ToscaStructuredTestcase, steps));

  for (const s of tcSummaries) {
    if (!s.hasProcess) {
      warnings.push(
        `Testcase "${s.testcaseNodePath}" has no rows under **process** phase in structured migration — verify Detailed_TestSteps export and build.`
      );
    }
    if (!s.hasPrerequisites && !s.hasPostRequisites) {
      warnings.push(
        `Testcase "${s.testcaseNodePath}" has neither prerequisites nor post-requisites rows in migration tree — confirm Tosca folder layout if those phases should exist.`
      );
    }
  }

  return {
    schemaVersion: 1,
    migrationDir: dir,
    generatedAt: new Date().toISOString(),
    fullMigrationJsonPresent,
    moduleAttributeRowCount: modRows.length,
    warnings,
    testcases: tcSummaries,
    steps,
    pathsManifest,
  };
}

export function writeAgentReportToDisk(report: MigrationAgentReport, migrationDir?: string): string {
  const dir = path.resolve(migrationDir ?? report.migrationDir);
  const fp = path.join(dir, 'playwright_migration_agent_report.json');
  fs.writeFileSync(fp, JSON.stringify(report, null, 2), 'utf8');
  return fp;
}

/** Console summary for CLI / humans */
export function printMigrationAgentSummary(report: MigrationAgentReport): void {
  const { testcases: tcs, steps, warnings } = report;
  console.log(`[tosca-migration-agent] dir=${report.migrationDir}`);
  console.log(
    `  full migration: ${report.fullMigrationJsonPresent ? 'yes' : 'no'} | module rows: ${report.moduleAttributeRowCount} | XTestStepValue steps: ${steps.length}`
  );
  if (report.pathsManifest?.loaded) {
    console.log(
      `  paths manifest: ${report.pathsManifest.sourceFile ?? '(env)'} | ws roots=${report.pathsManifest.workspaceRootCount} exportDirMatch=${report.pathsManifest.exportOutputDirMatchesMigrationDir} tcshellHints=${report.pathsManifest.hasTcshellHints}`
    );
  }
  if (warnings.length) {
    console.log('  warnings:');
    for (const w of warnings) console.log(`    - ${w}`);
  }
  for (const tc of tcs) {
    console.log(
      `  testcase: ${tc.testcaseNodePath}\n` +
        `    phases: pre=${tc.hasPrerequisites} process=${tc.hasProcess} post=${tc.hasPostRequisites} | steps=${tc.xTestStepValueCount} | missingModule=${tc.stepsMissingModule} | unresolvedValue=${tc.stepsWithUnresolvedValuePlaceholders}`
    );
  }
}

/* AI Generated Code by Deloitte + Cursor (END) */
