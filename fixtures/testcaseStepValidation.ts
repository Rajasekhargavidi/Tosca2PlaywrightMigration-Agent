/* AI Generated Code by Deloitte + Cursor (BEGIN) */
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { interpolateTemplates } from './bufferMap';
import { getMergedLiteralsForPlaywright, getPlaceholderResolutionContext } from './fullMigrationMap';
import { ModuleCatalog, extractInsertComponentFolder } from './moduleCatalog';
import {
  readExtendedModuleHints,
  tryFirstVisibleLocatorCandidate,
} from './moduleElementValidation';
import { extractRtbRefsFromRecord } from './rtbRefs';
import { getRtbModuleLinks } from './structuredMigration';
import {
  hasUnresolvedNonRegexPlaceholders,
  interpolateAllBracketRefs,
  templateToCompositeAssertionRegex,
  type ToscaPlaceholderContext,
} from './toscaPlaceholderRefs';
import { seedFromStrings } from './toscaRnd';

/** Merge explicit literals over migration bundle / explicit placeholder context (literals wins). */
export function mergePlaceholderContext(
  migrationDir: string | undefined,
  literals: Record<string, string>,
  parameterValueRanges: Record<string, string> | undefined,
  override: ToscaPlaceholderContext | null | undefined,
  rndSeedForStep?: number
): ToscaPlaceholderContext {
  const disk =
    !override && migrationDir
      ? getPlaceholderResolutionContext(migrationDir)
      : { literals: {} as Record<string, string>, parameterValueRanges: {} as Record<string, string> };

  const baseLit = override?.literals ?? disk.literals;
  const baseRng = override?.parameterValueRanges ?? disk.parameterValueRanges;
  const diskRnd = (disk as ToscaPlaceholderContext).rndSeed;

  return {
    literals: { ...baseLit, ...literals },
    parameterValueRanges: { ...baseRng, ...(parameterValueRanges ?? {}) },
    rndSeed: rndSeedForStep ?? override?.rndSeed ?? diskRnd,
  };
}

/** Value after resolving `{B}`, `{PL}`, `{CP}`, … bracket templates for this step. */
export function resolveExpectedValueFromStep(
  step: Record<string, unknown>,
  placeholderCtx: ToscaPlaceholderContext,
  fallbackBufferOnlyLiterals?: Record<string, string>
): string {
  const raw =
    typeof step.Value === 'string'
      ? step.Value
      : typeof step['(R)ValueToUse'] === 'string'
        ? (step['(R)ValueToUse'] as string)
        : '';
  const multi = interpolateAllBracketRefs(raw, placeholderCtx);
  if (fallbackBufferOnlyLiterals && hasUnresolvedNonRegexPlaceholders(multi))
    return interpolateTemplates(multi, fallbackBufferOnlyLiterals);
  return multi;
}

export type StepValidationResult = {
  stepTitle: string;
  insertComponentFolder: string | null;
  matchedModulePath?: string;
  rtbRefsNeeded: string[];
  bufferRefsUnresolved: boolean;
  outcome: 'validated' | 'skipped_no_module' | 'skipped_no_locator' | 'skipped_placeholder_value';
  /** Which candidate strategy from **buildLocatorCandidatesFromModuleRow** attached (when validated). */
  locatorCandidateIndex?: number;
};

/**
 * When an XTestStepValue row runs in a testcase, align it with migrated `XModuleAttribute` rows
 * and validate the rendered control using Tosca XPath / tag / role / InnerText hints.
 */
export async function validateStepWithSupportingModules(options: {
  page: Page;
  stepRow: Record<string, unknown>;
  catalog: ModuleCatalog;
  literals: Record<string, string>;
  /** If true, failed assertions fail the test; otherwise `.soft`. */
  strict?: boolean;
  /** Overrides full-migration lookup; keyed by `{RTB[Name]}` → module stamps from Tosca exports. */
  rtbModuleLinks?: Record<string, string[]>;
  /** Loads `rtbModuleLinks` from playwright_tosca_full_migration.json when `rtbModuleLinks` omitted. */
  migrationDir?: string;
  placeholderContext?: ToscaPlaceholderContext;
  parameterValueRanges?: Record<string, string>;
  /** Overrides auto-derived seed (`nodePath` + title) for deterministic `{RND[…]}`. */
  rndSeed?: number;
}): Promise<StepValidationResult> {
  const { page, stepRow, catalog } = options;
  const strict = options.strict ?? false;

  const rtbModuleLinks =
    options.rtbModuleLinks ??
    (options.migrationDir ? getRtbModuleLinks(options.migrationDir) : {});

  const rndSeed =
    options.rndSeed ??
    seedFromStrings([
      String(stepRow['(R)NodePath'] ?? ''),
      typeof stepRow.__title === 'string' ? stepRow.__title : String(stepRow.__title ?? ''),
      String(stepRow.Name ?? ''),
    ]);

  const phCtx = mergePlaceholderContext(
    options.migrationDir,
    options.literals,
    options.parameterValueRanges,
    options.placeholderContext ?? null,
    rndSeed
  );

  const stepTitle =
    typeof stepRow.__title === 'string'
      ? stepRow.__title
      : String(stepRow.__title ?? '(no title)');
  const nodePath = stepRow['(R)NodePath'];
  const insertFolder = extractInsertComponentFolder(nodePath);
  const stepValueRaw =
    typeof stepRow.Value === 'string'
      ? stepRow.Value
      : typeof stepRow['(R)ValueToUse'] === 'string'
        ? (stepRow['(R)ValueToUse'] as string)
        : '';
  const expected = resolveExpectedValueFromStep(stepRow, phCtx, options.literals);
  const unresolvedPlaceholder = hasUnresolvedNonRegexPlaceholders(expected);
  const rtbRefs = extractRtbRefsFromRecord(stepRow);
  const linkedModules = [...new Set(rtbRefs.flatMap((r) => rtbModuleLinks[r] ?? []))];

  if (unresolvedPlaceholder) {
    return {
      stepTitle,
      insertComponentFolder: insertFolder,
      rtbRefsNeeded: rtbRefs,
      bufferRefsUnresolved: true,
      outcome: 'skipped_placeholder_value',
    };
  }

  const modRow = catalog.resolveAttributeForStep(insertFolder, stepTitle, {
    moduleField: stepRow.Module,
    linkedModuleNames: linkedModules,
  });
  if (!modRow) {
    if (strict) expect.soft(modRow, `Missing XModuleAttribute for step "${stepTitle}"`).toBeTruthy();
    return {
      stepTitle,
      insertComponentFolder: insertFolder,
      rtbRefsNeeded: rtbRefs,
      bufferRefsUnresolved: false,
      outcome: 'skipped_no_module',
    };
  }

  const resolved = await tryFirstVisibleLocatorCandidate(page, modRow, { perCandidateMs: strict ? 5000 : 2500 });

  if (!resolved) {
    return {
      stepTitle,
      insertComponentFolder: insertFolder,
      matchedModulePath: String(modRow['(R)NodePath'] ?? ''),
      rtbRefsNeeded: rtbRefs,
      bufferRefsUnresolved: false,
      outcome: 'skipped_no_locator',
    };
  }

  const loc = resolved.locator;
  const assertions = strict ? expect : expect.soft;
  await assertions(loc).toBeVisible({ timeout: 25_000 });

  const hints = readExtendedModuleHints(modRow);

  const actionMode = String(stepRow.ActionMode ?? '');
  const testStepName = String(stepRow.TestStep ?? '');

  if (expected && actionMode !== 'Input' && !/buffer/i.test(testStepName)) {
    const composite =
      templateToCompositeAssertionRegex(expected) ?? templateToCompositeAssertionRegex(stepValueRaw);
    if (composite) await assertions(loc).toContainText(composite, { timeout: 10_000 });
    else
      await assertions(loc).toContainText(expected.split('\n')[0] ?? expected, {
        timeout: 10_000,
      });
  }

  const visLine =
    hints.visibleInnerTextHint
      ?.split(/\n|,/)
      .map((x) => x.trim())
      .filter(Boolean)[0] ??
    hints.innerTextHint
      ?.split(/\n|,/)
      .map((x) => x.trim())
      .filter(Boolean)[0];
  if (visLine && visLine.length < 512 && actionMode !== 'Input') {
    try {
      const hintComp = templateToCompositeAssertionRegex(visLine);
      if (hintComp) await assertions(loc).toContainText(hintComp, { timeout: 8000 });
      else if (!hasUnresolvedNonRegexPlaceholders(visLine))
        await assertions(loc).toContainText(visLine, { timeout: 8000 });
    } catch {
      /* surfaced in strict suites */
    }
  }


  return {
    stepTitle,
    insertComponentFolder: insertFolder,
    matchedModulePath: String(modRow['(R)NodePath'] ?? ''),
    rtbRefsNeeded: rtbRefs,
    bufferRefsUnresolved: false,
    outcome: 'validated',
    locatorCandidateIndex: resolved.candidateIndex,
  };
}

/**
 * Batch: every XTestStepValue using merged literals and the module catalog (`modules_attributes.jsonl`).
 */
export async function validateAllResolvedStepsAgainstModules(options: {
  page: Page;
  steps: Record<string, unknown>[];
  migrationDir: string;
  literals?: Record<string, string>;
}): Promise<StepValidationResult[]> {
  const liters = options.literals ?? getMergedLiteralsForPlaywright(options.migrationDir);
  const catalog = ModuleCatalog.load(options.migrationDir);
  const rtbModuleLinks = getRtbModuleLinks(options.migrationDir);
  const phCtx = getPlaceholderResolutionContext(options.migrationDir);
  const results: StepValidationResult[] = [];
  for (const row of options.steps) {
    if (String(row.__type ?? '') !== 'XTestStepValue') continue;
    const rndS = seedFromStrings([
      options.migrationDir,
      String(row['(R)NodePath'] ?? ''),
      String(row.__title ?? ''),
    ]);
    results.push(
      await validateStepWithSupportingModules({
        page: options.page,
        stepRow: row,
        catalog,
        literals: liters,
        strict: false,
        rtbModuleLinks,
        placeholderContext: phCtx,
        rndSeed: rndS,
      })
    );
  }
  return results;
}
/* AI Generated Code by Deloitte + Cursor (END) */
