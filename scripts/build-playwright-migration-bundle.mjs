/**
 * Streams Tosca JSONL exports and writes playwright_migration_bundle.json with merged literals,
 * parameter ValueRange catalog, and unresolved {B[name]} references.
 *
 * Usage:
 *   set TOSCA_MIGRATION_DIR=C:\Exports\migration
 *   set DETAILED_TEST_STEPS_JSONL=C:\Exports\Detailed_TestSteps.jsonl   (optional override)
 *   node scripts/build-playwright-migration-bundle.mjs
 */
// AI Generated Code by Deloitte + Cursor (BEGIN)
import fs from 'fs';
import path from 'path';
import readline from 'readline';

async function* iterateJsonl(filePath) {
  if (!fs.existsSync(filePath)) return;
  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    const t = line.trim();
    if (t) yield t;
  }
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

  const bufferMapPath = path.join(migrationDir, 'playwright_buffer_map.json');
  const libsPath = path.join(migrationDir, 'libraries_parameters.jsonl');
  const outPath = path.join(migrationDir, 'playwright_migration_bundle.json');

  let bufferCombined = {};
  if (fs.existsSync(bufferMapPath)) {
    const raw = fs.readFileSync(bufferMapPath, 'utf8').replace(/^\uFEFF/, '');
    const bm = JSON.parse(raw);
    bufferCombined = { ...(bm.combinedForPlaywright ?? bm.buffers ?? {}) };
  }

  const parameterValueRanges = {};
  let libraryRows = 0;

  if (fs.existsSync(libsPath)) {
    for await (const line of iterateJsonl(libsPath)) {
      let row;
      try {
        row = JSON.parse(line);
      } catch {
        continue;
      }
      if (String(row.__type ?? '') !== 'Parameter') continue;
      libraryRows++;
      const name = typeof row.Name === 'string' ? row.Name.trim() : '';
      const vr = typeof row.ValueRange === 'string' ? row.ValueRange.trim() : '';
      if (!name || !vr) continue;
      if (!parameterValueRanges[name]) parameterValueRanges[name] = vr;
    }
  }

  const stepByTitle = {};
  const titleHits = {};
  let stepRows = 0;

  const referencedTokens = new Set();

  if (fs.existsSync(detailedPath)) {
    for await (const line of iterateJsonl(detailedPath)) {
      let row;
      try {
        row = JSON.parse(line);
      } catch {
        continue;
      }
      collectPlaceholderTokens(JSON.stringify(row), referencedTokens);
      if (String(row.__type ?? '') !== 'XTestStepValue') continue;
      stepRows++;
      const title =
        typeof row.__title === 'string' ? row.__title.trim() : String(row.__title ?? '').trim();
      if (!title) continue;
      titleHits[title] = (titleHits[title] ?? 0) + 1;
      const val = pickStepValue(row);
      if (val) stepByTitle[title] = val;
    }
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

  for (const v of Object.values(combinedLiterals)) {
    collectPlaceholderTokens(String(v), referencedTokens);
  }

  const referencedToscaPlaceholders = [...referencedTokens].sort();

  const unresolvedToscaPlaceholders = referencedToscaPlaceholders.filter((token) => {
    const idx = token.indexOf(':');
    const name = idx >= 0 ? token.slice(idx + 1) : token;
    return !isBracketNameResolvable(name, combinedLiterals, parameterValueRanges);
  });

  const unresolvedBufferReferences = unresolvedToscaPlaceholders
    .filter((t) => t.startsWith('B:'))
    .map((t) => t.slice(2));
  const bundle = {
    schemaVersion: 3,
    generatedAt: new Date().toISOString(),
    sources: {
      playwright_buffer_map: fs.existsSync(bufferMapPath) ? bufferMapPath : '(missing)',
      libraries_parameters: fs.existsSync(libsPath) ? libsPath : '(missing)',
      Detailed_TestSteps: fs.existsSync(detailedPath) ? detailedPath : '(missing)',
    },
    counts: {
      bufferMapCombinedKeys: Object.keys(bufferCombined).length,
      libraryParameterRows: libraryRows,
      parameterValueRangeKeys: Object.keys(parameterValueRanges).length,
      xTestStepValueRows: stepRows,
      mergedLiteralKeys: Object.keys(combinedLiterals).length,
      duplicateStepTitles: Object.entries(titleHits).filter(([, n]) => n > 1).length,
      unresolvedBufferReferenceCount: unresolvedBufferReferences.length,
      unresolvedToscaPlaceholderCount: unresolvedToscaPlaceholders.length,
      referencedToscaPlaceholderCount: referencedToscaPlaceholders.length,
    },
    combinedLiterals,
    parameterValueRanges,
    unresolvedBufferReferences,
    unresolvedToscaPlaceholders,
    referencedToscaPlaceholders,
    hints: [
      'combinedLiterals merges: (1) single ValueRange OR first segment of enum ValueRange from libraries_parameters, (2) XTestStepValue __title → Value, (3) playwright_buffer_map combinedForPlaywright last (wins on key clash).',
      'Duplicated XTestStepValue __title keys: last row in Detailed_TestSteps wins.',
      'Bracket tokens `{PREFIX[name]}` (e.g. `B`, `PL`, `CP`, `P`, `RTB`, `TB`, `SK`, …) are catalogued in referencedToscaPlaceholders; unresolvedToscaPlaceholders lists those without a merged literal or library ValueRange.',
      'Full parity still needs module locators, step order, waits, and env-specific URLs/creds — never commit secrets in exports.',
    ],
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(bundle, null, 2), 'utf8');

  console.log(JSON.stringify({ wrote: outPath, counts: bundle.counts }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
// AI Generated Code by Deloitte + Cursor (END)
