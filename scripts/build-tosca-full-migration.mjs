/**
 * Full Tosca → Playwright migration artifact: every export row grouped by testcase folder,
 * phase (Pre-Requisite, Process, Post-Requisite, …), nested path under each phase, plus
 * library Business Parameters catalog and reference extraction ({B[x]}, {RTB[…]}, {P[…]}).
 *
 * Usage:
 *   set TOSCA_MIGRATION_DIR=C:\Exports\migration
 *   set DETAILED_TEST_STEPS_JSONL=C:\Exports\Detailed_TestSteps.jsonl   (optional)
 *   node scripts/build-tosca-full-migration.mjs
 *
 * Writes:
 *   - playwright_tosca_full_migration.json  (structured tree + catalogs)
 *   - playwright_migration_bundle.json       (flat literals, backward compatible)
 */
// AI Generated Code by Deloitte + Cursor (BEGIN)
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const PHASE_RULES = [
  { phase: 'prerequisites', re: /^Pre-?Requisite$/i },
  { phase: 'process', re: /^Process$/i },
  { phase: 'postRequisites', re: /^Post-?Requisite$/i },
  { phase: 'cleansing', re: /^Cleansing$/i },
  { phase: 'recovery', re: /^Recovery$/i },
];

function detectPhaseIndex(segments) {
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    for (const { phase, re } of PHASE_RULES) {
      if (re.test(s)) return { index: i, phase };
    }
  }
  return { index: -1, phase: null };
}

function emptyRefAcc() {
  return {
    bufferRef: new Map(),
    rtbRef: new Map(),
    paramRef: new Map(),
    listRef: new Map(),
    /** @type {Map<string, Map<string, unknown>>} */
    placeholderRefsByPrefix: new Map(),
  };
}

/** @param {ReturnType<emptyRefAcc>} acc */
function ensurePrefixMap(acc, pref) {
  if (!acc.placeholderRefsByPrefix.has(pref)) acc.placeholderRefsByPrefix.set(pref, new Map());
  return acc.placeholderRefsByPrefix.get(pref);
}

function extractRefsFromString(str, acc) {
  if (typeof str !== 'string') return;
  const re = /\{([A-Za-z]{1,8})\[([^\]]*)\]\}/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    const pref = m[1].toUpperCase();
    const nm = m[2].trim();
    if (!nm) continue;
    ensurePrefixMap(acc, pref).set(nm, []);
    if (pref === 'B') acc.bufferRef.set(nm, []);
    else if (pref === 'RTB') acc.rtbRef.set(nm, []);
    else if (pref === 'P') acc.paramRef.set(nm, []);
    else if (pref === 'L') acc.listRef.set(nm, []);
  }
}

/** @param {ReturnType<emptyRefAcc>} acc */
function refAccToJson(acc) {
  const byP = {};
  for (const [p, mmap] of acc.placeholderRefsByPrefix) {
    byP[p] = [...mmap.keys()].sort();
  }
  return {
    bufferRef: [...acc.bufferRef.keys()].sort(),
    rtbRef: [...acc.rtbRef.keys()].sort(),
    paramRef: [...acc.paramRef.keys()].sort(),
    listRef: [...acc.listRef.keys()].sort(),
    placeholderRefsByPrefix: byP,
  };
}

function extractRefsFromObject(obj, acc) {
  if (obj == null) return;
  if (typeof obj === 'string') {
    extractRefsFromString(obj, acc);
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((x) => extractRefsFromObject(x, acc));
    return;
  }
  if (typeof obj === 'object') {
    for (const v of Object.values(obj)) extractRefsFromObject(v, acc);
  }
}

/**
 * Second pass over Detailed_TestSteps: for rows whose __title or Name matches a referenced `{RTB[…]}` name,
 * collect **Module** stamps so Playwright can resolve library attributes for those steps.
 * @param {Set<string>|Map<string, unknown>} rtbNameKeys
 */
async function collectRtbModuleLinks(filePath, rtbNameKeys) {
  /** @type {Map<string, Set<string>>} */
  const rtbModuleLinks = new Map();
  const keySet =
    rtbNameKeys instanceof Set
      ? rtbNameKeys
      : rtbNameKeys instanceof Map
        ? new Set(rtbNameKeys.keys())
        : new Set();
  if (!fs.existsSync(filePath) || keySet.size === 0) {
    return rtbModuleLinks;
  }

  /** @param {unknown} s */
  const stripQs = (s) => {
    let t = String(s ?? '').trim();
    if (t.startsWith("'") && t.endsWith("'") && t.length >= 2) t = t.slice(1, -1);
    if (t.startsWith('"') && t.endsWith('"') && t.length >= 2) t = t.slice(1, -1);
    return t.trim();
  };

  for await (const line of iterateJsonl(filePath)) {
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    const title = typeof row.__title === 'string' ? row.__title.trim() : '';
    const nm = typeof row.Name === 'string' ? row.Name.trim() : '';
    for (const key of new Set([title, nm].filter(Boolean))) {
      if (!keySet.has(key)) continue;
      const modRaw = row.Module;
      if (modRaw === undefined || modRaw === null) continue;
      const mod = stripQs(modRaw);
      if (!mod) continue;
      if (!rtbModuleLinks.has(key)) rtbModuleLinks.set(key, new Set());
      rtbModuleLinks.get(key).add(mod);
    }
  }

  return rtbModuleLinks;
}

async function* iterateJsonl(filePath) {
  if (!fs.existsSync(filePath)) return;
  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    const t = line.trim();
    if (t) yield t;
  }
}

function splitNodePath(nodePath) {
  if (typeof nodePath !== 'string' || !nodePath.trim()) return [];
  return nodePath.split('/').filter(Boolean);
}

function shallowRowSample(row) {
  try {
    return JSON.parse(JSON.stringify(row));
  } catch {
    return { __title: row.__title, __type: row.__type };
  }
}

/** Map Insert-components folder names (from testcases) → sample module attribute paths in Modules_Library. */
function linkInsertComponentsToModulePaths(insertSet, moduleRows) {
  const links = {};
  for (const comp of insertSet) {
    try {
      const variants = new Set([String(comp).trim()]);
      variants.add(String(comp).replace(/\s*\([^)]*v\d+[^)]*\)\s*$/i, '').trim());
      const matched = [];
      const seen = new Set();
      for (const f of variants) {
        if (!f) continue;
        const esc = f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`/Modules(?:_Library)?/.+/(?:${esc})(?:/|$)`, 'i');
        for (const r of moduleRows) {
          const np = String(r['(R)NodePath'] ?? '');
          if (!re.test(np)) continue;
          const id = String(r['(R)UniqueId'] ?? np);
          if (seen.has(id)) continue;
          seen.add(id);
          matched.push(r);
        }
      }
      links[comp] = {
        migratedAttributeRowCount: matched.length,
        moduleAttributePathsSample: matched.slice(0, 48).map((r) => r['(R)NodePath']),
      };
    } catch {
      links[comp] = { migratedAttributeRowCount: 0, moduleAttributePathsSample: [], raw: String(comp) };
    }
  }
  return links;
}

function testcaseKeyFromParts(parts, phaseIdx) {
  if (phaseIdx >= 0) return parts.slice(0, phaseIdx).join('/');
  if (parts.length <= 4) return parts.join('/');
  const drop = Math.min(4, Math.max(1, Math.floor(parts.length / 4)));
  return parts.slice(0, Math.max(2, parts.length - drop)).join('/');
}

function addRowToTree(phaseNode, relativeSegments, row) {
  if (relativeSegments.length === 0) {
    phaseNode._rows.push(row);
    return;
  }
  let cur = phaseNode;
  for (let i = 0; i < relativeSegments.length; i++) {
    const seg = relativeSegments[i];
    const isLeaf = i === relativeSegments.length - 1;
    if (!cur._children[seg]) cur._children[seg] = { _rows: [], _children: {} };
    cur = cur._children[seg];
    if (isLeaf) cur._rows.push(row);
  }
}

function treeToPlain(node) {
  const out = { rows: node._rows ?? [], children: {} };
  const ch = node._children ?? {};
  for (const k of Object.keys(ch).sort()) {
    out.children[k] = treeToPlain(ch[k]);
  }
  return out;
}

function pickStepValue(row) {
  const v = row.Value;
  const u = row['(R)ValueToUse'];
  if (typeof v === 'string' && v.trim()) return v;
  if (typeof u === 'string' && u.trim()) return u;
  return '';
}

function collectPlaceholderTokens(text, accSet) {
  if (typeof text !== 'string') return;
  const re = /\{([A-Za-z]{1,8})\[([^\]]*)\]\}/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const p = m[1].toUpperCase();
    const n = m[2].trim();
    if (!n) continue;
    accSet.add(`${p}:${n}`);
  }
}

function isBracketNameResolvable(name, combinedLiterals, parameterValueRanges) {
  const n = String(name).trim();
  if (!n) return false;
  if (Object.prototype.hasOwnProperty.call(combinedLiterals, n)) {
    const v = combinedLiterals[n];
    if (v !== undefined && String(v) !== '') return true;
  }
  const vr = parameterValueRanges[n];
  return typeof vr === 'string' && vr.trim() !== '';
}



async function main() {
  const migrationDir = process.env.TOSCA_MIGRATION_DIR?.trim()
    ? path.resolve(process.env.TOSCA_MIGRATION_DIR.trim())
    : path.resolve('C:\\Exports\\migration');
  const parent = path.dirname(migrationDir);
  const defaultDetailed = path.join(parent, 'Detailed_TestSteps.jsonl');
  const detailedPath = process.env.DETAILED_TEST_STEPS_JSONL?.trim()
    ? path.resolve(process.env.DETAILED_TEST_STEPS_JSONL.trim())
    : defaultDetailed;
  const libsPath = path.join(migrationDir, 'libraries_parameters.jsonl');
  const bufferMapPath = path.join(migrationDir, 'playwright_buffer_map.json');
  const modulesPath = path.join(migrationDir, 'modules_attributes.jsonl');
  const testcasesPath = path.join(migrationDir, 'testcases.jsonl');
  const outStructured = path.join(migrationDir, 'playwright_tosca_full_migration.json');
  const outBundle = path.join(migrationDir, 'playwright_migration_bundle.json');

  const stats = {
    detailedLines: 0,
    byType: {},
    testcasesDiscovered: 0,
    rowsWithPhase: 0,
    rowsUnclassified: 0,
    libraryParameterRows: 0,
    businessParameterRows: 0,
    modulesAttributeLines: 0,
  };

  const testcases = new Map();
  const globalRefs = emptyRefAcc();
  const typeFirstSample = {};
  const stepByTitle = {};
  /** @type {Set<string>} */
  const insertComponentsFromSteps = new Set();

  function getOrCreateTc(key) {
    if (!testcases.has(key)) {
      const slots = {};
      for (const { phase } of PHASE_RULES) {
        slots[phase] = { _rows: [], _children: {} };
      }
      slots.unphased = { _rows: [], _children: {} };
      testcases.set(key, {
        testcaseNodePath: key,
        phases: slots,
        unclassified: { _rows: [], _children: {} },
        summary: { rowCount: 0 },
      });
    }
    return testcases.get(key);
  }

  if (fs.existsSync(detailedPath)) {
    for await (const line of iterateJsonl(detailedPath)) {
      stats.detailedLines++;
      let row;
      try {
        row = JSON.parse(line);
      } catch {
        continue;
      }

      const t = String(row.__type ?? 'unknown');
      stats.byType[t] = (stats.byType[t] ?? 0) + 1;
      if (typeFirstSample[t] === undefined) typeFirstSample[t] = shallowRowSample(row);

      extractRefsFromObject(row, globalRefs);

      if (t === 'XTestStepValue') {
        const title =
          typeof row.__title === 'string' ? row.__title.trim() : String(row.__title ?? '').trim();
        if (title) {
          const val = pickStepValue(row);
          if (val) stepByTitle[title] = val;
        }
      }

      const parts = splitNodePath(row['(R)NodePath']);
      if (parts.length === 0) {
        stats.rowsUnclassified++;
        continue;
      }

      const { index: phaseIdx, phase } = detectPhaseIndex(parts);
      const ic = parts.findIndex((s) => /^Insert Components$/i.test(s));
      if (ic >= 0 && ic + 1 < parts.length) insertComponentsFromSteps.add(parts[ic + 1]);

      const testcaseKey = testcaseKeyFromParts(parts, phaseIdx);
      const tc = getOrCreateTc(testcaseKey);
      tc.summary.rowCount++;

      const plainRow = { ...row };

      if (phaseIdx < 0 || !phase) {
        stats.rowsUnclassified++;
        const rel = parts.slice(1);
        addRowToTree(tc.unclassified, rel, plainRow);
        continue;
      }

      stats.rowsWithPhase++;
      const relWithinPhase = parts.slice(phaseIdx + 1);
      addRowToTree(tc.phases[phase], relWithinPhase, plainRow);
    }
  }

  const rtbModuleLinksMap = await collectRtbModuleLinks(detailedPath, globalRefs.rtbRef);
  const rtbModuleLinks = Object.fromEntries(
    [...rtbModuleLinksMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, set]) => [k, [...set].sort()])
  );

  stats.testcasesDiscovered = testcases.size;

  const libraryParameters = [];
  const businessParameters = [];

  if (fs.existsSync(libsPath)) {
    for await (const line of iterateJsonl(libsPath)) {
      let row;
      try {
        row = JSON.parse(line);
      } catch {
        continue;
      }
      if (String(row.__type ?? '') !== 'Parameter') continue;
      stats.libraryParameterRows++;
      libraryParameters.push(row);
      extractRefsFromObject(row, globalRefs);

      const layer = String(row.ParameterLayer ?? '');
      const pathStr = String(row['(R)NodePath'] ?? '');
      if (layer.includes('Business') || /Business Parameters/i.test(pathStr)) {
        stats.businessParameterRows++;
        businessParameters.push(row);
      }
    }
  }

  const modulesAttributesSamples = {};
  const modulesByNodePathTail = {};

  /** @type {unknown[]} */
  const allXModuleRows = [];

  if (fs.existsSync(modulesPath)) {
    for await (const line of iterateJsonl(modulesPath)) {
      stats.modulesAttributeLines++;
      let row;
      try {
        row = JSON.parse(line);
      } catch {
        continue;
      }
      const nt = String(row.__type ?? 'unknown');
      if (modulesAttributesSamples[nt] === undefined && Object.keys(modulesAttributesSamples).length < 25)
        modulesAttributesSamples[nt] = shallowRowSample(row);

      extractRefsFromObject(row, globalRefs);

      if (String(row.__type ?? '').includes('XModuleAttribute')) allXModuleRows.push(row);

    }
  }

  let bufferCombined = {};
  if (fs.existsSync(bufferMapPath)) {
    const raw = fs.readFileSync(bufferMapPath, 'utf8').replace(/^\uFEFF/, '');
    const bm = JSON.parse(raw);
    bufferCombined = { ...(bm.combinedForPlaywright ?? bm.buffers ?? {}) };
  }

  const parameterValueRanges = {};
  for (const row of libraryParameters) {
    const name = typeof row.Name === 'string' ? row.Name.trim() : '';
    const vr = typeof row.ValueRange === 'string' ? row.ValueRange.trim() : '';
    if (name && vr && !parameterValueRanges[name]) parameterValueRanges[name] = vr;
  }

  const combinedLiterals = {};
  for (const [k, vr] of Object.entries(parameterValueRanges)) {
    if (!vr.includes(';')) combinedLiterals[k] = vr;
    else {
      const first = vr.split(';')[0].trim();
      if (first) combinedLiterals[k] = first;
    }
  }
  Object.assign(combinedLiterals, stepByTitle);
  Object.assign(combinedLiterals, bufferCombined);

  const referencedTokens = new Set();
  for (const v of Object.values(combinedLiterals)) {
    collectPlaceholderTokens(String(v), referencedTokens);
  }
  for (const [pfx, mmap] of globalRefs.placeholderRefsByPrefix) {
    for (const nm of mmap.keys()) referencedTokens.add(`${pfx}:${nm}`);
  }

  const referencedToscaPlaceholders = [...referencedTokens].sort();
  const unresolvedToscaPlaceholders = referencedToscaPlaceholders.filter((token) => {
    const idx = token.indexOf(':');
    const name = idx >= 0 ? token.slice(idx + 1) : token;
    return !isBracketNameResolvable(name, combinedLiterals, parameterValueRanges);
  });
  const unresolvedBufferReferences = unresolvedToscaPlaceholders
    .filter((t) => t.startsWith('B:'))
    .map((t) => t.slice(2))
    .sort();
  const testcaseList = [...testcases.entries()].map(([, tc]) => {
    const phasesOut = {};
    for (const p of [...PHASE_RULES.map((x) => x.phase), 'unphased']) {
      if (tc.phases[p]) phasesOut[p] = treeToPlain(tc.phases[p]);
    }
    return {
      testcaseNodePath: tc.testcaseNodePath,
      summary: { ...tc.summary, suiteTrail: splitNodePath(tc.testcaseNodePath).slice(1) },
      phases: phasesOut,
      unclassified: treeToPlain(tc.unclassified),
    };
  });

  testcaseList.sort((a, b) => a.testcaseNodePath.localeCompare(b.testcaseNodePath));

  const insertComponentModuleLinks = linkInsertComponentsToModulePaths(
    insertComponentsFromSteps,
    allXModuleRows
  );

  const testcaseMeta = [];
  if (fs.existsSync(testcasesPath)) {
    for await (const line of iterateJsonl(testcasesPath)) {
      try {
        const r = JSON.parse(line);
        if (String(r.__type ?? '') === 'TestCase' || String(r.__type ?? '').endsWith('TestCase')) {
          testcaseMeta.push(r);
        }
      } catch {
        /* skip */
      }
    }
  }

  const structured = {
    schemaVersion: 3,
    generatedAt: new Date().toISOString(),
    sources: {
      Detailed_TestSteps: fs.existsSync(detailedPath) ? detailedPath : '(missing)',
      libraries_parameters: fs.existsSync(libsPath) ? libsPath : '(missing)',
      modules_attributes: fs.existsSync(modulesPath) ? modulesPath : '(missing)',
      playwright_buffer_map: fs.existsSync(bufferMapPath) ? bufferMapPath : '(missing)',
      testcases_jsonl: fs.existsSync(testcasesPath) ? testcasesPath : '(missing)',
    },
    stats: {
      ...stats,
      rowsByType: stats.byType,
      insertComponentFoldersFromTestSteps: insertComponentsFromSteps.size,
      migratedXModuleRows: allXModuleRows.length,
    },
    globalReferences: refAccToJson(globalRefs),
    rtbModuleLinks,
    insertComponentModuleLinks,
    testcases: testcaseList,
    testcaseMetaExported: testcaseMeta,
    catalogs: {
      libraryParametersAll: libraryParameters,
      businessParameters,
    },
    locatorHintIndex: {
      modulesByTailTitle: modulesByNodePathTail,
      modulesSamplesByType: modulesAttributesSamples,
    },
    typeSamplesFirstRow: typeFirstSample,
    hints: [
      'Phases: Pre-Requisite, Process, Post-Requisite, Cleansing, Recovery (matched on path segments).',
      'Each phase retains nested folders (e.g. Insert Components → module → …) with rows[].',
      'Library Business Parameters live in catalogs.businessParameters; full library in catalogs.libraryParametersAll.',
      'globalReferences.placeholderRefsByPrefix inventories `{PREFIX[name]}` tokens (PL, CP, B, RTB, P, …) across Detailed_TestSteps, libraries_parameters, modules_attributes.',
      'insertComponentModuleLinks links Insert Components/<Name> from test steps to module attribute paths under Modules_Library (for Playwright fixtures/moduleCatalog.ts matching).',
      'rtbModuleLinks maps {RTB[Name]} reference names to Module field values on matching definition rows in Detailed_TestSteps (for testcaseStepValidation + rowsForQuotedModule).',
    ],
  };

  fs.mkdirSync(path.dirname(outStructured), { recursive: true });
  fs.writeFileSync(outStructured, JSON.stringify(structured, null, 2), 'utf8');

  const bundle = {
    schemaVersion: 3,
    generatedAt: structured.generatedAt,
    sources: structured.sources,
    counts: {
      bufferMapCombinedKeys: Object.keys(bufferCombined).length,
      libraryParameterRows: stats.libraryParameterRows,
      businessParameterRows: stats.businessParameterRows,
      parameterValueRangeKeys: Object.keys(parameterValueRanges).length,
      xTestStepValueRows: stats.byType['XTestStepValue'] ?? 0,
      mergedLiteralKeys: Object.keys(combinedLiterals).length,
      testcasesStructured: testcaseList.length,
      unresolvedBufferReferenceCount: unresolvedBufferReferences.length,
      unresolvedToscaPlaceholderCount: unresolvedToscaPlaceholders.length,
      referencedToscaPlaceholderCount: referencedToscaPlaceholders.length,
      modulesAttributeLinesRead: stats.modulesAttributeLines,
    },
    combinedLiterals,
    parameterValueRanges,
    unresolvedBufferReferences,
    unresolvedToscaPlaceholders,
    referencedToscaPlaceholders,
    hints: structured.hints,
  };
  fs.writeFileSync(outBundle, JSON.stringify(bundle, null, 2), 'utf8');

  console.log(
    JSON.stringify(
      {
        wroteStructured: outStructured,
        wroteBundle: outBundle,
        stats,
        testcaseCount: testcaseList.length,
        globalReferences: structured.globalReferences,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
// AI Generated Code by Deloitte + Cursor (END)
