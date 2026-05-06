/* AI Generated Code by Deloitte + Cursor (BEGIN) */
import { extractBracketPlaceholdersDeep } from './toscaPlaceholderRefs';
import type { ToscaPhaseTree, ToscaStructuredTestcase } from './structuredMigration';

/** High-level control-flow hint for codegen / validation scaffolding (NOT full Tosca semantics). */
export type ToscaControlFlowHintRow = {
  __path?: string;
  __phase?: string;
  __kind: 'sequential' | 'conditional' | 'loop' | 'evaluation';
  __typeSeen?: string;
  /** Expressions / templates found on the row (for placeholder expansion audits). */
  bracketRefs?: Array<{ prefix: string; name: string }>;
  /** Tosca-ish fields echoed for debugging migrations. */
  conditionSnippet?: string;
};

const CONDITION_TYPES = /IfElse|ElseIf|^If\b|Condition|Verify|Checkpoint|checkpointlist/i;
const LOOP_TYPES = /While|Until|Repeat|DoWhile|ForEach|^[A-Z]{0,4}Loop/i;
const EVAL_TYPES = /\b(tbox|math|算术|evaluation|calculate|calculateexpression)\b/i;

/** Best-effort row classifier for RTBs that use Conditions / Loops / TBox evaluations. */
export function controlFlowHintFromRow(
  row: Record<string, unknown>,
  opts?: { path?: string; phase?: string }
): ToscaControlFlowHintRow {
  const t = String(row.__type ?? '');
  let kind: ToscaControlFlowHintRow['__kind'] = 'sequential';
  if (LOOP_TYPES.test(t)) kind = 'loop';
  else if (CONDITION_TYPES.test(t)) kind = 'conditional';
  else if (EVAL_TYPES.test(t)) kind = 'evaluation';

  const cond =
    typeof row.Condition === 'string'
      ? row.Condition
      : typeof row.Expression === 'string'
        ? row.Expression
        : typeof row.ConditionExpression === 'string'
          ? row.ConditionExpression
          : undefined;

  const refs = extractBracketPlaceholdersDeep(row).map(({ prefix, name }) => ({ prefix, name }));

  return {
    __path: opts?.path,
    __phase: opts?.phase,
    __kind: kind,
    __typeSeen: t || undefined,
    bracketRefs: refs.length ? refs : undefined,
    conditionSnippet: cond?.slice(0, 500),
  };
}

/** Flatten testcase phase trees into annotated rows — input for Playwright scaffolding around conditions / loops / evaluations. */
export function controlFlowHintsFromStructuredTestcase(tc: ToscaStructuredTestcase): ToscaControlFlowHintRow[] {
  const out: ToscaControlFlowHintRow[] = [];

  function walkTree(node: ToscaPhaseTree, phase: string, pathPrefix: string) {
    const rows = node.rows ?? [];
    rows.forEach((raw, i) => {
      const path = `${pathPrefix}/${phase}[${i}]`;
      if (raw && typeof raw === 'object') {
        out.push(controlFlowHintFromRow(raw as Record<string, unknown>, { path, phase }));
      }
    });
    const ch = node.children ?? {};
    for (const [seg, sub] of Object.entries(ch)) {
      walkTree(sub, phase, `${pathPrefix}/${seg}`);
    }
  }

  for (const phase of Object.keys(tc.phases ?? {})) {
    walkTree(tc.phases![phase]!, phase, '');
  }

  walkTree(tc.unclassified, 'unclassified', '');

  return out;
}
/* AI Generated Code by Deloitte + Cursor (END) */
