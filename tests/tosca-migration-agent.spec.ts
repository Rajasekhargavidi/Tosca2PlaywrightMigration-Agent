/* AI Generated Code by Deloitte + Cursor (BEGIN) */
import path from 'path';
import { expect, test } from '@playwright/test';
import { flattenTestcaseForAgentAudit, type ToscaStructuredTestcase } from '../fixtures/structuredMigration';
import { classifyNodePathMarkers, runToscaMigrationAgent } from '../fixtures/toscaMigrationAgent';
import { isToscaPathsManifest, loadToscaPathsManifest } from '../fixtures/toscaPathsManifest';
import { migrationDataRequestNote, needToscaMigrationFolder } from '../fixtures/migrationDataRequest';
import { tryGetMigrationDir } from '../fixtures/migrationPaths';

test('classifyNodePathMarkers detects publish / insert / pre-publish segments', () => {
  const m = classifyNodePathMarkers('/TC/Process/Insert Components/Card/Publish/Step');
  expect(m.mentionsInsertComponents).toBe(true);
  expect(m.mentionsPublish).toBe(true);
  expect(m.mentionsPrePublish).toBe(false);
  expect(classifyNodePathMarkers('/x/Pre-publish/y').mentionsPrePublish).toBe(true);
});

test('loadToscaPathsManifest parses example path manifest JSON', () => {
  const fp = path.join(__dirname, '..', 'config', 'tosca-paths.manifest.example.json');
  const m = loadToscaPathsManifest(fp);
  expect(m).toBeTruthy();
  expect(isToscaPathsManifest(m)).toBe(true);
  expect(m!.toscaWorkspaceRoots.length).toBeGreaterThan(0);
  expect(typeof m!.nodePaths).toBe('object');
});

test('flattenTestcaseForAgentAudit walks phases in Tosca order before unclassified', () => {
  const tc: ToscaStructuredTestcase = {
    testcaseNodePath: '/Demo/Case1',
    summary: { rowCount: 3 },
    phases: {
      process: {
        rows: [{ __type: 'XBuffer', Name: 'b' }],
        children: {},
      },
      prerequisites: {
        rows: [{ __type: 'XBuffer', Name: 'a' }],
        children: {},
      },
      postRequisites: { rows: [], children: {} },
      cleansing: { rows: [], children: {} },
      recovery: { rows: [], children: {} },
    },
    unclassified: {
      rows: [{ __type: 'XBuffer', Name: 'u' }],
      children: {},
    },
  };
  const flat = flattenTestcaseForAgentAudit(tc);
  expect(flat.map((b) => b.phase)).toEqual(['prerequisites', 'process', 'unclassified']);
});

test.describe('toscaMigrationAgent audit on export folder', () => {
  const dir = tryGetMigrationDir();

  test('runToscaMigrationAgent returns a report matching migration tree', () => {
    if (!dir) test.skip(true, migrationDataRequestNote(needToscaMigrationFolder()));
    const report = runToscaMigrationAgent(dir);
    expect(report.schemaVersion).toBe(1);
    expect(report.migrationDir).toBeTruthy();
    if (report.fullMigrationJsonPresent) {
      expect(Array.isArray(report.testcases)).toBe(true);
      expect(Array.isArray(report.steps)).toBe(true);
      for (const s of report.steps) {
        expect(s.stepOrdinal).toBeGreaterThan(0);
        expect(s.phase.length).toBeGreaterThan(0);
      }
    } else {
      expect(report.steps.length).toBe(0);
      expect(report.warnings.some((w) => /build:tosca-full/i.test(w))).toBeTruthy();
    }
  });
});
/* AI Generated Code by Deloitte + Cursor (END) */
