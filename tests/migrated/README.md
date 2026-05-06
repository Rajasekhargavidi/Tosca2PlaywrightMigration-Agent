# Migrated Playwright layout (readable after migration)

This tree holds **human-reviewable** scripts grouped like Tosca, while **`TOSCA_MIGRATION_DIR`** JSON/JSONL stays the canonical **data** export.

| Folder | Purpose |
|--------|---------|
| **`module/`** | One subfolder per **module** (or module group). Locator helpers, shared steps tied to **`XModuleAttribute`** / Insert Component context. |
| **`testcase/`** | One **`.spec.ts` per Tosca TestCase** (from **`npm run generate:tosca-tests`**). |
| **`library/`** | One stub per **RTB** (reusable block) from exports — expand with steps that call into **`module/`** helpers. |
| **`_shared/`** | Registries linking the tree: **`testcase-registry`**, **`module-registry`**, **`rtb-registry`**. `.generated.json` artifacts. |

**Connections**

- **`_shared/testcase-registry.generated.json`** — every **`testcase/tc_*.spec.ts`** mapped to **`(R)NodePath`** / **`(R)UniqueId`** (**`npm run generate:tosca-tests`**).
- **`_shared/module-registry.generated.json`** — module name ↔ folder under **`module/`** (**`scaffold:migrated-stubs`**).
- **`_shared/rtb-registry.generated.json`** — RTB name ↔ **`library/rtb-*.generated.ts`** (**`globalReferences`** and **`{RTB[…]}`** scans of **`testcases.jsonl`** / **`suite_teststep_values.jsonl`** / **`Detailed_TestSteps.jsonl`** when **`rtbRef`** is sparse).
- Pipeline data remains under **`TOSCA_MIGRATION_DIR`**. This tree **imports `fixtures/`** and env — it does not replace exports.

**Commands**

Prefer **`scaffold:migrated-stubs`** first, then **`generate:tosca-tests`**, so testcase specs can **`import`** scaffolded stubs.

- `npm run scaffold:migrated-stubs` — (re)writes **`module/**`** and **`library/**`** stubs + registry JSON.
- `npm run generate:tosca-tests` — (re)writes **`testcase/tc_*.spec.ts`** + **`testcase-registry.generated.json`** (links **`module/`** and **`library/`** imports when matching **`.generated.ts`** files exist).

**Execution (single connected Playwright run)**

1. Set **`TOSCA_SUT_URL`** and **`TOSCA_MIGRATION_DIR`**.
2. Run **`npm run build:tosca-full`** so **`playwright_tosca_full_migration.json`** exists. Each generated spec then calls **`runMigratedStructuredTestcaseFull`** from **`fixtures/migratedCodegenRunner.ts`**, which walks every **XTestStepValue** via **`validateStepWithSupportingModules`** (module catalog + RTB links + buffers).
3. **`module/<name>/module.generated.ts`** adds **`runStepsForThisModuleInTestcase`** (module-only slice). **`library/rtb-*.generated.ts`** adds **`runStepsForThisRtbInTestcase`** (**`{RTB[…]}`** slice). The testcase spec **`import`**s those namespaces and documents them; the **full** testcase is the aggregated runner above.

**Git**

**`.gitignore`** excludes **`tests/migrated/**/*.generated.ts`**, segmented **`tc_*.spec.ts`**, and **`_shared/*.generated.json`**. Run the commands above locally or via **`migrate:pipeline`** (**`MIGRATED_PLAYWRIGHT_LAYOUT=1`** runs scaffold then generate).
