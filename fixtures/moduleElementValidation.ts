/* AI Generated Code by Deloitte + Cursor (BEGIN) */
import type { Locator, Page } from '@playwright/test';
import type { ToscaModuleAttributeRow } from './moduleCatalog';
import {
  hasUnresolvedNonRegexPlaceholders,
  tryUnwrapRegexBracket,
} from './toscaPlaceholderRefs';

function escRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * XPath from Tosca (e.g. id('EditableToolbar')) → usable Playwright expression.
 */
function xpathToSelector(xpath: string): string {
  const trimmed = xpath.trim();
  const idM = trimmed.match(/^id\s*\(\s*['"]([^'"]+)['"]\s*\)$/i);
  if (idM) return `#${CSS.escape(idM[1])}`;
  return `xpath=${trimmed}`;
}

/** Safe CSS / attribute selector for `#` or `[id="…"]`. */
function locatorById(page: Page, id: string): Locator | null {
  const raw = id.trim();
  if (!raw) return null;
  try {
    return page.locator(`#${CSS.escape(raw)}`);
  } catch {
    return page.locator(`[id=${JSON.stringify(raw)}]`);
  }
}

function readStringField(row: ToscaModuleAttributeRow, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k as keyof ToscaModuleAttributeRow];
    const s = typeof v === 'string' ? v.trim() : v !== undefined && v !== null ? String(v).trim() : '';
    if (s) return s;
  }
  return '';
}

/** Strip Tosca / JSON outer quotes from exported string fields (e.g. class regex specs). */
export function stripOuterQuotes(s: string): string {
  let t = String(s ?? '').trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))
    t = t.slice(1, -1).trim();
  return t;
}

/**
 * CSS selector union for class specs with **|** alternation or **\*** wildcard fragments
 * (Tosca “regex” style class lists). Uses `[class*="…"]` for performance (single locator).
 */
export function buildCssForToscaClassUnion(tag: string, classSpecRaw: string): string | null {
  let spec = stripOuterQuotes(classSpecRaw).trim();
  if (!spec) return null;
  const regexWrapped = tryUnwrapRegexBracket(spec);
  const fromRegexBrace = regexWrapped !== null;
  if (regexWrapped !== null) spec = regexWrapped.trim();
  if (!fromRegexBrace && !spec.includes('|') && !spec.includes('*')) return null;
  const t = (tag || '*').trim().toLowerCase();

  /** Single substring (e.g. `{REGEX[noticed]}`) → one `[class*="…"]` branch */
  if (!spec.includes('|') && !spec.includes('*')) {
    const chunk = spec.replace(/\*/g, '').trim();
    if (!chunk || !fromRegexBrace) return null;
    const esc = chunk.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `${t}[class*="${esc}"]`;
  }

  const alts = spec.split(/\s*\|\s*/).map((x) => stripOuterQuotes(x).trim()).filter(Boolean);
  const parts: string[] = [];
  for (const a of alts) {
    const stripped = a.replace(/\*/g, '').trim();
    if (!stripped) continue;
    const esc = stripped.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    parts.push(`${t}[class*="${esc}"]`);
  }
  return parts.length ? parts.join(',') : null;
}

/** Tosca uses **1-based** display index (`1` = first duplicate match); maps to Playwright **nth(0)**. */
export function parseToscaElementIndex(row: ToscaModuleAttributeRow): number | null {
  const raw =
    row.ConstraintIndex ??
    row['(P)ConstraintIndex'] ??
    row['(R)ConstraintIndex'] ??
    row.Index ??
    row['(P)Index'] ??
    row.ItemIndex ??
    row['(P)ItemIndex'] ??
    row.ElementIndex ??
    row['(P)ElementIndex'] ??
    row.constraintIndex ??
    row['(P)ConstraintsIndex'];
  if (raw === undefined || raw === null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(n) || n < 0) return null;
  /** Tosca sibling index: treat 1 as first element. */
  return n <= 0 ? 0 : Math.max(0, n - 1);
}

function inferAriaRole(businessType: string, tagRaw: string): 'textbox' | 'button' | 'link' | 'checkbox' | null {
  const b = businessType.toLowerCase();
  const t = tagRaw.toLowerCase();
  if (b === 'button' || t === 'button') return 'button';
  if (b.includes('link') || t === 'a') return 'link';
  if (b.includes('check') || t === 'input') return 'checkbox';
  if (b.includes('text') || b === 'inputfield' || b === 'combobox' || t === 'textarea' || t === 'input')
    return 'textbox';
  return null;
}

/** Prefer **nth** when Tosca index / constraint targets one of duplicate matches (**1-based** Tosca → Playwright nth). */
export function applyConstraintIndex(loc: Locator, row: ToscaModuleAttributeRow): Locator {
  const idx = parseToscaElementIndex(row);
  if (idx === null) return loc.first();
  return loc.nth(idx);
}

export type ExtendedModuleHints = {
  innerTextHint?: string;
  visibleInnerTextHint?: string;
  titleHint?: string;
  visibleHint?: boolean;
  idHint?: string;
  classNameHint?: string;
  tagHint?: string;
  /** Label / automation default (Tosca **DefaultName**). */
  defaultNameHint?: string;
  /** Tosca **Value** / `(P)Value` when present (often input text or default). */
  valueHint?: string;
  constraintIndex?: number | null;
};

/**
 * Extended property set for validation: class, tag, inner / visible text, constraint, default name, value.
 */
export function readExtendedModuleHints(row: ToscaModuleAttributeRow): ExtendedModuleHints {
  const inner = readStringField(row, '(P)InnerText', 'InnerText');
  const visTxt = readStringField(row, '(P)VisibleInnerText', 'VisibleInnerText');
  const ttl = readStringField(row, '(P)Title', '(P)attributes_title', 'Title');
  const vis = row['(P)Visible'] ?? row.Visible;
  const pid = readStringField(row, '(P)Id', 'HtmlId', '(P)HtmlId');
  const cls = readStringField(row, '(P)ClassName', 'ClassName', 'className');
  const tag = readStringField(row, '(P)Tag', 'Tag', 'HtmlTag');
  const defaultName = readStringField(row, 'DefaultName', '(P)DefaultName', '(R)DefaultName', 'defaultName');
  const val = readStringField(row, '(P)Value', 'Value', '(R)Value');

  return {
    innerTextHint: inner || undefined,
    visibleInnerTextHint: visTxt || undefined,
    titleHint: ttl || undefined,
    visibleHint:
      typeof vis === 'string'
        ? /^(true|yes|1)$/i.test(vis.trim())
        : typeof vis === 'boolean'
          ? vis
          : undefined,
    idHint: pid || undefined,
    classNameHint: cls || undefined,
    tagHint: tag || undefined,
    defaultNameHint: defaultName || undefined,
    valueHint: val || undefined,
    constraintIndex: parseToscaElementIndex(row),
  };
}

/** @deprecated use readExtendedModuleHints */
export function readModuleValidationHints(row: ToscaModuleAttributeRow): {
  innerTextHint?: string;
  visibleInnerTextHint?: string;
  titleHint?: string;
  visibleHint?: boolean;
  idHint?: string;
} {
  const x = readExtendedModuleHints(row);
  return {
    innerTextHint: x.innerTextHint,
    visibleInnerTextHint: x.visibleInnerTextHint,
    titleHint: x.titleHint,
    visibleHint: x.visibleHint,
    idHint: x.idHint,
  };
}

/** Primary locator only (single best strategy). */
export function buildLocatorFromModuleRow(page: Page, row: ToscaModuleAttributeRow): Locator | null {
  const chain = buildLocatorCandidatesFromModuleRow(page, row);
  return chain[0] ?? null;
}

/**
 * Ordered locator strategies from migrated **XModuleAttribute** (XPath, id, role+name, tag+class, text, tag).
 * Use with **tryFirstVisibleLocator** for self-heal when the DOM drifts.
 */
export function buildLocatorCandidatesFromModuleRow(page: Page, row: ToscaModuleAttributeRow): Locator[] {
  const hints = readExtendedModuleHints(row);
  const list: Locator[] = [];
  const pushUniq = (loc: Locator | null) => {
    if (!loc) return;
    list.push(loc);
  };

  const xp = readStringField(row, '(P)XPath', 'XPath');
  if (xp) {
    const sel = xpathToSelector(xp);
    pushUniq(sel.startsWith('#') ? page.locator(sel) : page.locator(sel));
  }

  if (hints.idHint) pushUniq(locatorById(page, hints.idHint));

  const tagRaw = (hints.tagHint ?? readStringField(row, '(P)Tag', 'Tag')).toLowerCase();
  const clsRaw = hints.classNameHint ?? readStringField(row, '(P)ClassName', 'ClassName', 'className');
  const cssUnionSpec = tagRaw ? buildCssForToscaClassUnion(tagRaw, clsRaw) : buildCssForToscaClassUnion('*', clsRaw);
  if (cssUnionSpec) pushUniq(page.locator(cssUnionSpec));

  const clsForSimple = tryUnwrapRegexBracket(clsRaw) ?? clsRaw;
  const simpleClassPool =
    clsForSimple.length > 0 && !clsForSimple.includes('|') && !clsForSimple.includes('*');
  const firstClass =
    simpleClassPool
      ? clsForSimple
          .split(/\s+/)
          .filter(Boolean)
          .find((c) => /^[a-zA-Z_-][\w-]*$/.test(c)) ?? ''
      : '';

  const title =
    hints.titleHint ??
    readStringField(row, '(P)Title', '(P)attributes_title', '(P)attributes_defaultName');
  const defaultName = hints.defaultNameHint;
  const businessType = String(row.BusinessType ?? '').trim();
  const role = inferAriaRole(businessType, tagRaw);

  const nameForRole = defaultName || title || String(row.Name ?? row.__title ?? '').trim();

  if (role && nameForRole) {
    pushUniq(page.getByRole(role, { name: new RegExp(escRegex(nameForRole), 'i') }));
  }

  if (businessType === 'Button' || tagRaw === 'button') {
    const name = nameForRole;
    if (name) pushUniq(page.getByRole('button', { name: new RegExp(escRegex(name), 'i') }));
  }

  if (!nameForRole && defaultName) {
    pushUniq(page.getByLabel(new RegExp(escRegex(defaultName), 'i')));
  }

  if (tagRaw && firstClass) {
    try {
      pushUniq(page.locator(`${tagRaw}.${CSS.escape(firstClass)}`));
    } catch {
      pushUniq(page.locator(`${tagRaw}.${firstClass.replace(/\./g, '\\.')}`));
    }
  }

  const vt = hints.visibleInnerTextHint?.split(/\n|,/).map((x) => x.trim()).find(Boolean);
  const inn = hints.innerTextHint?.split(/\n|,/).map((x) => x.trim()).find(Boolean);
  for (const txt of [vt, inn]) {
    if (txt && txt.length > 0 && txt.length < 512 && !hasUnresolvedNonRegexPlaceholders(txt)) {
      pushUniq(page.getByText(txt, { exact: false }));
    }
  }

  const valHintRaw = hints.valueHint;
  const valUnwrapped = valHintRaw ? tryUnwrapRegexBracket(valHintRaw) ?? valHintRaw : '';
  const valHint = valUnwrapped;
  if (valHint && valHint.length > 0 && valHint.length < 200 && !hasUnresolvedNonRegexPlaceholders(valHintRaw ?? '')) {
    const valPattern = valHint.includes('|')
      ? new RegExp(
          valHint
            .split(/\s*\|\s*/)
            .map((s) => escRegex(s.trim()))
            .filter(Boolean)
            .join('|'),
          'i'
        )
      : new RegExp(escRegex(valHint), 'i');
    try {
      pushUniq(page.getByDisplayValue(valPattern));
    } catch {
      /* optional API */
    }
    try {
      pushUniq(page.getByPlaceholder(valPattern));
    } catch {
      /* optional */
    }
  }

  const nameGuess = String(row.Name ?? row.__title ?? '').trim();
  if (nameGuess && businessType !== 'Container') pushUniq(page.getByText(nameGuess, { exact: false }));

  if (tagRaw) pushUniq(page.locator(tagRaw));

  /** Dedupe: drop consecutive identical XPath strategies is hard; thin list by max length */
  const cap = 12;
  return list.slice(0, cap);
}

/**
 * Try candidates in order; first **visible** wins (limited self-heal when primary selector breaks).
 */
export async function tryFirstVisibleLocatorCandidate(
  page: Page,
  row: ToscaModuleAttributeRow,
  opts?: { perCandidateMs?: number }
): Promise<{ locator: Locator; candidateIndex: number } | null> {
  const wait = opts?.perCandidateMs ?? 2500;
  const candidates = buildLocatorCandidatesFromModuleRow(page, row);
  for (let i = 0; i < candidates.length; i++) {
    const scoped = applyConstraintIndex(candidates[i]!, row);
    try {
      await scoped.waitFor({ state: 'visible', timeout: wait });
      return { locator: scoped, candidateIndex: i };
    } catch {
      /* try neighbour strategy */
    }
  }
  return null;
}
/* AI Generated Code by Deloitte + Cursor (END) */
