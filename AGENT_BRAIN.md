# AGENT_BRAIN.md — canonical agent playbook (main file)

**This Markdown file is the single source of truth** for how the AI assistant and humans run **Tosca → Playwright** work in **this repo**.  

- **You edit here** → the agent **reconciles** code, tests, `fixtures/`, scripts, and (when needed) **`.cursor/rules/*.mdc`** so they match what you wrote.  
- **Cursor rules** (`.mdc`) are **thin hooks** into the IDE; if they disagree with **`AGENT_BRAIN.md`**, **this file wins** unless you document an exception under [§ 16 Conflicts / exceptions](#16-conflicts--exceptions).

---

## Table of contents

1. [How the agent uses this document](#1-how-the-agent-uses-this-document)  
2. [Mission & pillars](#2-mission--pillars)  
3. [Tosca workspace model](#3-tosca-workspace-model)  
4. [Agent obligations (every migration)](#4-agent-obligations-every-migration)  
5. [Single-command automation (`migrate:pipeline`)](#5-single-command-automation-migratepipeline)  
6. [Critical environment variables](#6-critical-environment-variables)  
7. [Path manifest (`TOSCA_PATHS_MANIFEST`)](#7-path-manifest-tosca_paths_manifest)  
8. [End-to-end data path (Tosca → Playwright)](#8-end-to-end-data-path-tosca--playwright)  
9. [Execution-time gap-fill (self-healing)](#9-execution-time-gap-fill-self-healing)  
10. [Failure handling — stay until success](#10-failure-handling--stay-until-success)  
11. [Approach assessment](#11-approach-assessment)  
12. [Playwright harness, artifacts & key APIs](#12-playwright-harness-artifacts--key-apis)  
13. [Prerequisite-gated testcase configuration](#13-prerequisite-gated-testcase-configuration)  
14. [Tests: real data & asking the user](#14-tests-real-data--asking-the-user)  
15. [Security](#15-security)  
16. [Conflicts / exceptions](#16-conflicts--exceptions)  
17. [Your goals](#17-your-goals-north-star)  
18. [Hard rules](#18-hard-rules-you-set)  
19. [Plans & backlog](#19-plans--backlog)  
20. [Waiting on data / decisions](#20-waiting-on-data--decisions)  
21. [Decision log](#21-decision-log)  
22. [Migrated Playwright layout (`tests/migrated/`)](#22-migrated-playwright-layout-testsmigrated)  

---

## 1. How the agent uses this document

| Rule | Behavior |
|------|------------|
| **Read** | On any substantive task (migration, fixtures, tests, pipeline, agent report), read **`AGENT_BRAIN.md` in full** or at least the sections relevant to the task plus **§ 17–21** (your directives). |
| **Re-read** | If the user says they **updated this file**, load it again and **diff mental model** against current code. |
| **Reconcile** | Implement **§ 17–21** in the repo immediately. If **§ 2–15** (process / harness) prose changes, sync **code**, **`fixtures/`**, **`tests/`**, **`scripts/`**, and **`.mdc` stubs** so runtime behavior matches. |
| **Sync rules** | If process text in **`.cursor/rules/*.mdc`** no longer matches this file after **your** edits, **update the `.mdc` stubs** to stay aligned (stubs should point here, not fork the spec). |
| **No silent ignore** | If a backlog item is blocked, say **what** is missing and use **§ 14** (structured ask), not dummy data. |

---

## 2. Mission & pillars

**Mission:** migrate **Tosca** scripts and test structure to **Playwright** with **maximum practical accuracy**, in a **consistent, reviewable format**, and **without omitting** steps, properties, or values that the exports contain.

| Pillar | Meaning in this repo |
|--------|---------------------|
| **Accuracy** | Resolve each step to **`XModuleAttribute`** (and RTB→module links); locators and assertions follow Tosca fields (index, class unions, value, text, `{REGEX[…]}`, `{RND[…]}`, buffers/params). |
| **Proper format** | Single spine: export → **JSON/JSONL** → **`build:tosca-full`** → **`agent:migration`** / **`migrate:pipeline`**; reuse **`fixtures`** and patterns—avoid one-off Playwright that cannot be traced to a row. |
| **Nothing missing** | Full testcase **phase order** (prerequisites → process → post-requisites, …); every **`XTestStepValue`** audited; **`AGENT_STRICT`** (when on) blocks silent module gaps. |

This agenda **overrides ad-hoc shortcuts**. If something cannot be mapped, **fix the export or catalog** (TCShell/manifest loop) rather than dropping the step.

---

## 3. Tosca workspace model

### Modules folder (separate)

- Holds **module definitions** — authoritative **element/control properties** (XPath, tag, class, InnerText, VisibleInnerText, Value, DefaultName, ConstraintIndex, visibility, …).
- The agent must **resolve each step** to the right module and **carry module + attribute data** into helpers or Playwright.

### Library (separate tree)

- Multiple areas (e.g. **Author**, **Publish**, **Common** — labels vary by project).
- **RTBs** (reusable test blocks): each contains **many steps** using standard or **custom modules**.
- RTBs live in the library and are **referenced** from test cases (not duplicated as module definition sources).

### Test cases (“blue folder” paradigm)

Nested structure typical pattern:

1. **Test case folder** → Tosca testcase artifact  
2. **Prerequisites**, **Process**, **Post requisites** (and similar)  
3. **Under Process**: **Insert components**, **Components**, **RTB references** (buffers, business/parameter values), **Publish** / **Pre-publish** (often more RTBs)  
4. **Post requisites**: folders + RTBs for **validation** after publish  

**Invariant:** **Modules** in **modules** area; **RTBs** in **library**; **steps** use **modules** for properties (directly or via module-backed steps).

---

## 4. Agent obligations (every migration)

1. **Module fidelity** — Identify backing module per control; map **`modules_attributes`/`XModuleAttribute`** into Playwright (indices, class unions, `{REGEX[…]}`, `{RND[…]}`, buffers/params).

2. **Complete step coverage** — Every step: prerequisites, process (insert, components, publish/pre-publish RTBs), post-requisites; execution order preserved.

3. **Traceability** — RTBs → library content; modules → modules export; align Insert component folder, module name, RTB links, titles with **`ModuleCatalog`** / **`validateStepWithSupportingModules`**.

4. **Consistency with fixtures** — Prefer **`migrate:pipeline`** or **`build:tosca-full`** + **`agent:migration`**; use placeholder resolution & agent report (**`playwright_migration_agent_report.json`**).

5. **User session instructions** persist as constraints until the user changes them; **durable** changes belong in **`AGENT_BRAIN.md`** (especially **§ 17–21**).

6. **Canonical path & gap-fill** — **TCShell / exports → CSV → JSON/JSONL → `migrate:pipeline`**. On gaps: re-query Tosca via **`TOSCA_PATHS_MANIFEST`** and **`gapFillCommands`**, regenerate, rebuild—avoid untracked one-off Playwright.

7. **Resilience** — Classify failures, minimal fixes, re-run downstream; alternatives in **§ 10**; do not abandon after first failure.

---

## 5. Single-command automation (`migrate:pipeline`)

**Default entry:** **`npm run migrate:pipeline`** — implemented in **`scripts/run-full-migration-pipeline.mjs`**.

Ordered stages:

1. **Optional:** **`TOSCA_PRE_PIPELINE_CMD`** — one line/batch wrapping **CSV/JSON export / TCShell**. Prefer scripts **under version control**, not inlined secrets.

2. **`npm run build:tosca-full`** → **`playwright_tosca_full_migration.json`** + **`playwright_migration_bundle.json`**

3. **`npm run agent:migration`** → **`playwright_migration_agent_report.json`**

4. **Optional:** **`RUN_PLAYWRIGHT_AFTER_PIPELINE=1`** (or **`PIPELINE_TESTS=1`**) runs **`npx playwright test`** as final gate.

**Always set** `TOSCA_MIGRATION_DIR`. Use `TOSCA_PATHS_MANIFEST` when using the manifest. Use `AGENT_STRICT=1` to fail on missing structured JSON or unresolved module linkage.

**Example (PowerShell):**  
```powershell
$env:TOSCA_MIGRATION_DIR='C:\Exports\migration'; $env:TOSCA_PATHS_MANIFEST='C:\Secrets\tosca-paths.manifest.json'; $env:TOSCA_PRE_PIPELINE_CMD='C:\Automations\my-tosca-export.cmd'; $env:AGENT_STRICT='1'; npm run migrate:pipeline
```
Append `;$env:RUN_PLAYWRIGHT_AFTER_PIPELINE='1'` before `npm run migrate:pipeline` to run Playwright at the end.

In CI/CD, mirror env vars per job; on failures follow **§ 10**.

---

## 6. Critical environment variables

| Variable | Role |
|---------|------|
| **`TOSCA_MIGRATION_DIR`** | Absolute folder with exported **JSON/JSONL** (buffer map, testcases, modules, …). Required for builds and Tosca-aligned Playwright tests. |
| **`TOSCA_PATHS_MANIFEST`** | Path to JSON manifest (**`config/tosca-paths.manifest.example.json`** shape) — workspace roots + node paths + optional `gapFillCommands`. |
| **`TOSCA_PRE_PIPELINE_CMD`** | Optional pre-step before `build:tosca-full` (export refresh). |
| **`AGENT_STRICT`** | `1` = strict agent / linkage failures surface as errors. |
| **`RUN_PLAYWRIGHT_AFTER_PIPELINE`** / **`PIPELINE_TESTS`** | Run Playwright after pipeline completes. |
| **`TOSCA_SUT_URL`** | Base URL for browser smokes (**`tosca-testcases-from-migration`**, module validation DOM checks). |
| **`THANK_YOU_PAGE_URL`** | Overrides merged literals for **`tests/tosca-thank-you.spec.ts`** when set. |

**Code helpers:** `fixtures/migrationPaths.ts` — `getMigrationDir()` (throws) vs `tryGetMigrationDir()` (returns `''`). Tests use `tryGetMigrationDir` where skips are acceptable.

---

## 7. Path manifest (`TOSCA_PATHS_MANIFEST`)

Single JSON (**see `config/tosca-paths.manifest.example.json`**), loaded via **`fixtures/toscaPathsManifest.ts`**:

| Field area | Purpose |
|------------|---------|
| **`toscaWorkspaceRoots`** | Commander workspace roots on disk |
| **`nodePaths`** | Logical paths: modules, library branches (Author/Publish/Common, …), test cases |
| **`exportOutputDir`** | Normally equals **`TOSCA_MIGRATION_DIR`** |
| **`tcshell`** | Optional `executablePath`, `workingDirectory`, **`gapFillCommands`** for repeatable exports |

Agent report (**`playwright_migration_agent_report.json`**) summarizes manifest alignment.

**Secrets:** never store credentials in the manifest or TCShell wrappers — Vault / CI variables.

---

## 8. End-to-end data path (Tosca → Playwright)

1. **Extract** — JSONL and/or **TCShell** scoped by **`nodePaths`** (modules, libraries, testcase trees).

2. **Normalize** — **CSV** with stable columns (`__type`, `(R)NodePath`, `Module`, `Value`, …).

3. **Promote to JSON** — CSV → JSON/JSONL for **`build:tosca-full`**, **`ModuleCatalog`**, placeholders, codegen.

4. **Audit** — **`npm run agent:migration`** (or full pipeline)—every **`XTestStepValue`**, phase order, module linkage, unresolved placeholders vs bundle literals.

5. **Playwright** — **`fixtures/testcaseStepValidation`**, **`moduleElementValidation`**, **`npm run generate:tosca-tests`**, or hand specs—all must **trace to JSON rows**.

---

## 9. Execution-time gap-fill (self-healing)

When failures or agent report shows **missing module**, **unresolved placeholders**, **count mismatches**:

1. Use **`TOSCA_PATHS_MANIFEST`** + failing **`(R)NodePath`** to locate Commander objects.

2. Run **narrow** **`gapFillCommands`** ( subtree / single RTB / buffer catalog)—avoid whole-workspace exports unless necessary.

3. Refresh **CSV → JSON** → **`migrate:pipeline`** until **`AGENT_STRICT`** passes.

Automate when tooling allows; **human checkpoints** for license/UI auth should be documented in manifest notes—not secrets inlined.

---

## 10. Failure handling — stay until success

**Definition of success:** exports complete, **`migrate:pipeline`** succeeds (or **`build:tosca-full` + `agent:migration`**), **`AGENT_STRICT`** passes where required, agreed Playwright checks pass—with **no dropped steps** and no avoidable unresolved **`{B}`/`{PL}`/`{CP}` debt**.

**Behavior:**

1. **Target focus** — Fix the pipeline until traceable Tosca→JSON→Playwright path works; avoid unrelated refactors.

2. **Classify** — TCShell vs export shape vs build scripts vs data mismatch vs Playwright/SUT; **preserve logs** and row indices where possible.

3. **Research** — Smallest failing artifact (`playwright_migration_agent_report.json`, one JSONL line, one command).

4. **Fix → verify** — Minimal change; re-run **failing stage** then **full downstream** after raw export changes (**always** regenerate **`build:tosca-full`** outputs).

5. **Rotate tactics** — Narrow/widen exports; subtree-only refresh; BOM/encoding fixes; literal/parameter range additions; RTB-module linkage fixes; **`moduleElementValidation`** ordering (without changing Tosca-authored intent); composite regex; timeouts only after correctness.

6. **Persist** — Repeat hypothesis/fix/re-run until unblocked. Escalate to humans only for ambiguous product decisions, licensing, or documented Tosca limits. Use **§ 21** Decision log when recording durable outcomes.

---

## 11. Approach assessment

| Strengths | Risks / mitigations |
|-----------|---------------------|
| Single truth in Tosca when JSON stale | Pin TCShell/Commander version + manifest-driven commands |
| CSV pivot stabilizes transforms | Strict column contracts + validation in scripts |
| Manifest speeds gap-fill | Commander may require login—document checkpoints |
| Iteration closes regressions without scope drift | Reconcile counts vs **`agent:migration`** step list |

**Verdict:** Sound for structured enterprise migrations with **manifest + pipeline + audit + CI strictness**. Unattended 100% depends on licensing/hosting — plan optional human checkpoints.

---

## 12. Playwright harness, artifacts & key APIs

When exports change:

1. **Preferred:** **`npm run migrate:pipeline`** (see **§ 5**).

2. **JSONL vs codegen harness:** **`tests/tosca-testcases-from-migration.spec.ts`** expands **`testcases.jsonl`** at runtime **unless** segmented specs exist under **`tests/migrated/testcase/tc_*.spec.ts`** or legacy **`tests/generated/tosca-testcases.spec.ts`** — see **`fixtures/migratedPlaywrightLayout.ts`** / **`useCodegenInsteadOfJsonlHarness`**. Default **`npm run generate:tosca-tests`** emits **segmented** specs (**§ 22**); pass **`--legacy`** to regenerate only **`tests/generated/tosca-testcases.spec.ts`**. Remove generated **`tc_*.spec.ts`** files (or entire **`tests/migrated/testcase/`** contents) and the legacy generated file to return to JSONL-only runs.

3. **Merged literals API:** **`getMergedLiteralsForPlaywright`** (`fixtures/fullMigrationMap.ts`), backed by **`playwright_migration_bundle.json`** field **`combinedLiterals`** when the bundle exists.

4. **Placeholders:** **`getPlaceholderResolutionContext`**, **`interpolateTemplates`** / **`interpolateAllBracketRefs`** for **`{PL}`, `{CP}`, `{B}`, …** — **`fixtures/toscaPlaceholderRefs.ts`**, **`fixtures/toscaRnd.ts`** (`mulberry32`, `{RND[spec]}`).

5. **Full structured doc:** **`loadToscaFullMigration`**, **`fixtures/structuredMigration.ts`** — **`globalReferences`**, **`placeholderRefsByPrefix`**, **`referenced` / `unresolved` placeholders**, **`testcases`** tree.

6. **Agent:** **`fixtures/toscaMigrationAgent.ts`** → **`playwright_migration_agent_report.json`**. **`AGENT_STRICT=1`** for hard failures on gaps.

7. **Bundle-only optional:** **`npm run build:migration-bundle`** is redundant when **`build:tosca-full`** already ran (**§ 5**).

8. **Browser smoke helpers:** **`validateStepWithSupportingModules`** (`fixtures/testcaseStepValidation.ts`): Tosca **Index / ConstraintIndex** conventions (helpers map Tosca semantics to **`locator.nth`**); **`(P)ClassName`** with **`|`** alternation or **`*`** wildcard → CSS **`[class*="…"]`** unions; **`{REGEX[classA | classB]}`** for class-like alternates; **`(P)Value`** **`|`** joins → **`RegExp`** / **`getByDisplayValue`**.

9. **Thank You smoke:** **`tests/tosca-thank-you.spec.ts`** — merged literals + prerequisite gating (**§ 13**); env **`THANK_YOU_PAGE_URL`** overrides literals when set.

10. **Readable migrated script tree:** **`tests/migrated/`** (**§ 22**) groups **module**, **library (RTB)**, and **testcase** scripts with shared registries in **`_shared/`**.

---

## 13. Prerequisite-gated testcase configuration

URLs and testcase **Test configuration** parameters must align with Tosca semantics:

| Mechanism | Detail |
|-----------|--------|
| **Refs in prerequisites** | Collect **`{B[name]}`, `{PL[name]}`, `{CP[name]}`, …** from prerequisite rows. **`{RND[…]}`** / **`{REGEX[…]}`** internals are not configuration *names*. |
| **Overlay** | **`getMergedLiteralsWithPrerequisiteGatedOverlay`** (`fixtures/toscaTestcaseConfigurations.ts`): bundle literals + testcase meta only for prerequisite-referenced keys. **`testcaseConfigOverlayKeys`** tags overlay keys. |
| **Fallback / Thank You URL** | Missing structured testcase tree/meta → **`getMergedLiteralsIncludingTestcaseConfig`**. **`pickThankYouUrlFromMerged`** applies prerequisite alignment only to testcase-config overlay keys (**`testcaseConfigOverlayKeys`**); bundle literals still apply. **`THANK_YOU_PAGE_URL`** overrides. See **`tests/tosca-thank-you.spec.ts`**. |
| **Pairing helpers** | **`pickStructuredTestcaseMatching`**, **`pickTestcaseMetaForStructuredTestcase`**, **`gatherAllRowsInPhase(tc, 'prerequisites')`**. |

---

## 14. Tests: real data & asking the user

- Playwright **`tosca-*.spec.ts`** uses **real** exports under **`TOSCA_MIGRATION_DIR`**; do **not** embed dummy testcase payloads unless **§ 16** explicitly allows it.

- Use **`migrationDataRequestNote(...)`** from **`fixtures/migrationDataRequest.ts`** in skips: **What / Why / When / Where / How**, header **`[Needs real migration data — ask user]`**. Agents must reuse that wording when prompting humans and **never** substitute fabricated URLs, passwords, or testcase JSON.

---

## 15. Security

- **Never commit** secrets, **`*.pem`**, production passwords, `.env` files that contain secrets, or manifests with embedded credentials. Add org-specific prohibitions under **§ 18** when needed.

---

## 16. Conflicts / exceptions

*(Document deliberate exceptions to **§§ 2–15**, e.g. demo-only stubs.)*

**Default:** none — repo defaults apply.

---

## 17. Your goals (north star)

- Migrate Tosca assets to Playwright accurately with exports as spine.  

- Prefer real migration folder data; use structured user prompts per **§ 14** instead of fabricated test data.

*(Extend freely.)*

---

## 18. Hard rules (you set)

- Do **not** invent or commit secrets or production credentials.

*(Extend freely.)*

---

## 19. Plans & backlog

*(Checkbox list — the agent reconciles code/tests against open items.)*

- `[ ]` *(add items)*

---

## 20. Waiting on data / decisions

*(Blockers — agent should ask using **§ 14**, never substitute filler data.)*

---

## 21. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| *(add rows)* | | |

---

## 22. Migrated Playwright layout (`tests/migrated/`)

After migration (and codegen), scripts live under **`tests/migrated/`** so reviewers see **Modules vs Library RTBs vs TestCases** mirrored as folders. **`TOSCA_MIGRATION_DIR`** JSON/JSONL remains the canonical **exported data**; this tree is readable Playwright/TS glue that **imports `fixtures/`** and should **stay traceable** to export rows (**`testcase-registry.generated.json`**).

1. **`module/<SanitizedModuleName>/`** — **`module.generated.ts`** per **`Module`** (**`npm run scaffold:migrated-stubs`**) exposes **`runStepsForThisModuleInTestcase`** (delegates to **`fixtures/migratedCodegenRunner.ts`**) alongside **`moduleMeta()`** / **`TOSCA_MODULE_NAME`**. Hand-augment locator helpers here (**`fixtures/moduleCatalog`**, **`buildLocatorFromModuleRow`**).
2. **`testcase/`** — **`npm run generate:tosca-tests`** emits **one `tc_<…>.spec.ts` per Tosca TestCase**, plus **`_shared/testcase-registry.generated.json`**. Each spec **imports** **`module/`** / **`library/`** stubs when present; when **`build:tosca-full`** produced **`playwright_tosca_full_migration.json`**, specs call **`fixtures/migratedCodegenRunner.ts`** (**`runMigratedStructuredTestcaseFull`**) for the **combined** migrated step flow (still **imports** stubs for layering / annotations). Legacy monolithic codegen: **`node scripts/generate-tosca-playwright-tests.mjs --legacy`** (**`tests/generated/tosca-testcases.spec.ts`**).
3. **`library/`** — **`rtb-<name>.generated.ts`** with **`runStepsForThisRtbInTestcase`** (**`fixtures/migratedCodegenRunner.ts`**) plus **`rtbFlowPlaceholder`** for hand-authored splits. Sources: **`globalReferences`**, **`{RTB[…]}`** JSONL scans (**`npm run scaffold:migrated-stubs`**).
4. **`_shared/`** — **`testcase-registry.generated.json`**, **`module-registry.generated.json`**, **`rtb-registry.generated.json`** describing cross-links (not a substitute for exports).
5. **Git / CI** — **`.gitignore`** excludes regenerated **`tests/migrated/**`** artifacts (`*.generated.ts`, segmented **`tc_*.spec.ts`**, registries); run **`scaffold:migrated-stubs`** then **`generate:tosca-tests`** after pulling exports. Hand-authored helpers committed under **`module/`**, **`library/`**, **`testcase/`** (`*.manual.ts`, etc.).

**Commands**

| Command | Output |
|---------|--------|
| **`npm run generate:tosca-tests`** *(default)* | **`tests/migrated/testcase/tc_<n>_….spec.ts`** (+ registry). Pass **`--legacy`** for single-file **`tests/generated/tosca-testcases.spec.ts`**. |
| **`npm run scaffold:migrated-stubs`** | **`module/**/module.generated.ts`**, **`library/rtb-*.generated.ts`** + registries. |
| **`npm run migrated:layout`** | Runs **scaffold** then **generate** (same order as **`migrate:pipeline`** layout step). |
| **`MIGRATED_PLAYWRIGHT_LAYOUT=1`** with **`npm run migrate:pipeline`** | Runs **`scaffold:migrated-stubs`** then **`generate:tosca-tests`** after **`agent:migration`**. |

**Git**

- Regenerated **`*.generated.ts`**, segmented **`tc_*.spec.ts`**, and **`_shared/*.generated.json`** are **`gitignore`**d — regenerate from exports after clone or CI checkout.

**Agent rules**

- Place **module-related** migrated scripts under **`module/`**, **library/RTB** flows under **`library/`**, testcase-level Playwright journeys under **`testcase/`** — preserve **explicit imports / registries** so nothing becomes orphaned helper code.

**Manual order:** **`npm run scaffold:migrated-stubs`** before **`npm run generate:tosca-tests`** so testcase specs can **`import`** scaffolded stubs.

---

_End of playbook — edit §§ 17–21 first for day-to-day steering; §§ 2–15 for durable process._
