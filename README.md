# Tosca to Playwright migration bridge

## Generated assets

1. **`C:\Users\rgavidi\Downloads\Run-ToscaMigration.ps1`** — exports from Tosca then writes **`.jsonl` + `.csv`** under **`C:\Exports\migration`** (override with `-OutDir`).
2. This folder — Playwright tests that consume **JSON Lines**.

## Format choice (Playwright)

| Format | Use when |
|--------|----------|
| **JSON Lines (`.jsonl`)** | **Default** — stream records, low memory, native `JSON.parse` per line. |
| **CSV** | Excel / quick filters; columns get very wide for Tosca `print` dumps. |

See **`manifest.json`** in the migration output folder for the same recommendation.

Optional next step: maintain a small hand-curated **`playwright-fixtures.json`** (URL + locator + intent) derived from `.jsonl` for real suites.

## Run migration

```powershell
$env:TOSCA_PASSWORD = '<workspace_password>'
& "C:\Users\rgavidi\Downloads\Run-ToscaMigration.ps1"
```

Outputs:

- `modules_attributes` — `XModuleAttribute`
- `modules_definitions` — `XModule`
- `libraries_parameters` — `Parameter` under Library
- `testcases` — `TestCase` under `2 | Main Suite` (edit `Export_TestCases.tcs` if your tree differs)

## Playwright

```powershell
cd C:\Users\rgavidi\tosca-playwright-migration
npm install
npx playwright install chromium
$env:TOSCA_MIGRATION_DIR = 'C:\Exports\migration'
npm test
```

Without `TOSCA_MIGRATION_DIR`, Tosca-driven checks skip; the **example.com** smoke still runs.

## Tosca testcases as Playwright tests

| Artifact | Role |
|----------|------|
| **`testcases.jsonl`** in `$env:TOSCA_MIGRATION_DIR` | **`tests/tosca-testcases-from-migration.spec.ts`** registers one Playwright test per exported **`TestCase`** (metadata + optional browser smoke). Requires the full migration export (not only modules). |
| **`npm run generate:tosca-tests`** | Writes **`tests/generated/tosca-testcases.spec.ts`** (gitignored). When that file exists, the JSONL harness file above **does not** register tests (avoid duplicates). |
| **`TOSCA_SUT_URL`** | If set, each migrated testcase opens this URL and asserts the document has a `body`. Omit to **skip** browser steps until you have a deployed app. |
| **`THANK_YOU_PAGE_URL`** | Full URL of the Thank You page; **`tosca-thank-you.spec.ts`** uses **`getMergedLiteralsForPlaywright`** (`playwright_migration_bundle.json` after `npm run build:migration-bundle`, else **`playwright_buffer_map.json`**). |

Example after migration:

```powershell
$env:TOSCA_MIGRATION_DIR = 'C:\Exports\migration'
# Optional: Published app entry (smoke); optional: Thank You page URL
$env:TOSCA_SUT_URL = 'https://your-site.example/'
$env:THANK_YOU_PAGE_URL = 'https://your-site.example/us/en/path-to-thank-you.html'
npm test
```

Refresh generated specs whenever `testcases.jsonl` changes:

```powershell
$env:TOSCA_MIGRATION_DIR = 'C:\Exports\migration'
npm run generate:tosca-tests
npm test
```

## Migrate buffers, parameters, and test data as completely as Tosca exposes

Exports give you **schemas, allowed values, and step test data**. They do **not** automatically recreate Tosca execution (ordering, synchronization, steering engine, branching, variants, APIs). Treat **parity** as: data + assertions you wire in Playwright, plus **Codegen** (`npx playwright codegen`) where you translate modules into selectors and flows.

### 1. Expand the Tosca-side export (`Run-ToscaMigration.ps1` / Tosca ScratchBook)

Ensure the script emits **everything you need**:

| Needed for Playwright | Typical export artifact |
|----------------------|--------------------------|
| Buffers / step values `{B[x]}`, `XTestStepValue` | **`Detailed_TestSteps.jsonl`** (often next to `migration`, e.g. `C:\Exports\`) |
| Buffer extract for Playwright | **`playwright_buffer_map.json`** (buffer / literal merge step) |
| Library **Parameter** definitions & **ValueRange** | **`libraries_parameters.jsonl`** |
| Module locators (XPath, tags, etc.) | **`modules_attributes.jsonl`** |
| Test structure / coverage | **`testcases.jsonl`** |
| Optional: expanded steps after buffer resolution | **`suite_teststep_values_expanded.jsonl`** (if your pipeline produces it) |

Extend `Export_TestCases.tcs` (or your export template) so **all relevant suites** are included, not only a single scenario.

### 2. Build one merged JSON for Playwright (`npm run build:migration-bundle`)

From the repo:

```powershell
$env:TOSCA_MIGRATION_DIR = 'C:\Exports\migration'
# optional if Detailed_TestSteps lives elsewhere:
# $env:DETAILED_TEST_STEPS_JSONL = 'C:\Exports\Detailed_TestSteps.jsonl'
npm run build:migration-bundle
```

This writes **`playwright_migration_bundle.json`** into the migration folder with:

- **`combinedLiterals`** — merged **buffer map + `XTestStepValue` + library hints** (see `hints` in the file for merge order).
- **`parameterValueRanges`** — full **`a;b;c`** enums from library parameters (use when a single default is not enough).
- **`unresolvedBufferReferences`** — `{B[Name]}` tokens still missing after merge (fix in Tosca data or add manual overrides).

**Prefer the full builder (next section)** so prerequisites, process, post-requisites, and catalogs are captured in one JSON.

### 2b. Full structured migration — prerequisites, process, post-requisites, RTB/refs, business parameters

```powershell
$env:TOSCA_MIGRATION_DIR = 'C:\Exports\migration'
# optional:
# $env:DETAILED_TEST_STEPS_JSONL = 'C:\Exports\Detailed_TestSteps.jsonl'
npm run build:tosca-full
```

Writes:

| File | Contents |
|------|-----------|
| **`playwright_tosca_full_migration.json`** | Per-testcase trees: **prerequisites**, **process**, **postRequisites**, **cleansing**, **recovery**, **unphased**; nested folders (e.g. **Insert Components** → module → test data); **every row** from **`Detailed_TestSteps.jsonl`**; **`catalogs.libraryParametersAll`** + **`catalogs.businessParameters`**; **`testcaseMetaExported`** from **`testcases.jsonl`** (if present); **`globalReferences`** (`bufferRef`, `rtbRef`, `paramRef`, `listRef`); **`locatorHintIndex`** from **`modules_attributes.jsonl`** (streaming; first hit per path tail, capped); **`typeSamplesFirstRow`**. |
| **`playwright_migration_bundle.json`** | Same flat **`combinedLiterals`** / **`parameterValueRanges`** as **`npm run build:migration-bundle`** (regenerated in the same run). |

Use **`loadToscaFullMigration`** and **`flattenTestcaseForPlaywright`** from **`fixtures/structuredMigration.ts`** to drive **`test.step`** scaffolding in Playwright.

### 2c. Modules + RTBs — validate DOM using migrated **`XModuleAttribute`** during testcase runs

- **`fixtures/moduleCatalog.ts`** — Loads **`modules_attributes.jsonl`**; matches testcase step **`(R)NodePath`** segment **`Insert Components/<Folder>/…`** to module-library paths; aligns step **`__title`** to **`Name`/`__title`** on **`XModuleAttribute`**.
- **`fixtures/moduleElementValidation.ts`** — Builds **`Locator`** from **`(P)XPath`** (includes `id('…')`), **`(P)Tag`/`ClassName`**, **`BusinessType`** (button roles), **`(P)Title`**.
- **`fixtures/rtbRefs.ts`** — Lists **`{RTB[…]}`** refs in strings (expand linkage to modules when Tosca exports RTB blocks separately).
- **`fixtures/testcaseStepValidation.ts`** — **`validateStepWithSupportingModules`** / **`validateAllResolvedStepsAgainstModules`** — resolve **`Value`** with **`getMergedLiteralsForPlaywright`**, then **`toBeVisible` / text checks** from module hints (`(P)VisibleInnerText`, etc.).
- **`npm run build:tosca-full`** adds **`insertComponentModuleLinks`** in **`playwright_tosca_full_migration.json`** (Insert-component folder ↔ sample **`(R)NodePath`** hits in **`Modules_Library`**).

### 3. Accurate Playwright tests (beyond JSON)

Use the bundle (`getMergedLiteralsForPlaywright` in `fixtures/fullMigrationMap.ts`) inside specs. For behaviour that matches Tosca visually:

1. Map each **module** → Playwright **`locator(...)`** using **`modules_attributes.jsonl`** and **`locatorHints`** where they apply.
2. Reproduce **step order** from the testcase / `Detailed_TestSteps` node paths (`(R)NodePath`).
3. Add **timeouts, network idle, dialogs, APIs** Tosca abstracts — Playwright must model them explicitly.
4. Drive **URLs, users, secrets** via **CI/host env vars**, not committed JSONLine (scraped exports often lack secure runtime configs).

Tools that help: **`npx playwright codegen`**, **Trace Viewer** after `trace: 'on-first-retry'`, and iterative runs against the same **`TOSCA_SUT_URL`** environment Tosca targets.
