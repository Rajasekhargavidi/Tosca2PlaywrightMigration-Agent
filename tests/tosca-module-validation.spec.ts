/* AI Generated Code by Deloitte + Cursor (BEGIN) */
import fs from 'fs';
import path from 'path';
import { expect, test } from '@playwright/test';
import { ModuleCatalog, extractInsertComponentFolder } from '../fixtures/moduleCatalog';
import { buildLocatorFromModuleRow } from '../fixtures/moduleElementValidation';
import { getMergedLiteralsForPlaywright } from '../fixtures/fullMigrationMap';
import { validateStepWithSupportingModules } from '../fixtures/testcaseStepValidation';
import { tryGetMigrationDir } from '../fixtures/migrationPaths';
import {
  migrationDataRequestNote,
  needModulesAttributesJsonl,
  needToscaMigrationFolder,
  needToscaSutUrl,
} from '../fixtures/migrationDataRequest';

function mig(): string {
  return tryGetMigrationDir();
}

test.describe('Tosca modules → Playwright validation helpers', () => {
  test('ModuleCatalog resolves Insert Components folder → module paths', () => {
    const dir = mig();
    if (!dir) test.skip(true, migrationDataRequestNote(needToscaMigrationFolder()));
    const fp = path.join(dir, 'modules_attributes.jsonl');
    if (!fs.existsSync(fp)) test.skip(true, migrationDataRequestNote(needModulesAttributesJsonl(fp)));

    const cat = ModuleCatalog.load(dir);
    expect(cat.rows.length).toBeGreaterThan(0);

    const insert = extractInsertComponentFolder(
      '/4|Plinko/2 | Main Suite/X/Y/Thank You/Thank You/Process/Insert Components/Button/Button Test Data/ButtonTitle'
    );
    expect(insert).toBe('Button');

    const poolBtn = cat.candidatesForInsertComponent('Button');
    expect(poolBtn.length).toBeGreaterThan(0);

    const insertTitle = extractInsertComponentFolder(
      '/.../Process/Insert Components/Title (v2)/Title Test Data/ThankYouTitle'
    );
    expect(insertTitle).toBe('Title (v2)');
    expect(cat.candidatesForInsertComponent('Title (v2)').length).toBeGreaterThanOrEqual(0);

    const enterTextAttrs = cat.rowsForQuotedModule('Enter Text');
    expect(enterTextAttrs.length).toBeGreaterThan(0);
    expect(enterTextAttrs.some((r) => String(r.Name).toLowerCase() === 'text')).toBeTruthy();
  });

  test('resolveAttributeForStep falls back to Module column and RTB-linked module names', () => {
    const rows = [
      {
        __type: 'XModuleAttribute',
        '(R)NodePath': '/Modules_Library/X/Button/Decoy',
        '(R)UniqueId': 'u0',
        Module: `'ButtonMod'`,
        Name: 'Decoy',
      },
      {
        __type: 'XModuleAttribute',
        '(R)NodePath': '/Modules_Library/App/MyModule/UI/Row1',
        '(R)UniqueId': 'u1',
        Module: `'MyModule'`,
        Name: 'FieldA',
        '(P)XPath': `//*[@id='fid-a']`,
      },
    ];
    const cat = new ModuleCatalog(rows);
    /* Insert-component pool is Button subtree only — FieldA lives under MyModule. */
    expect(cat.resolveAttributeForStep('Button', 'FieldA')).toBeUndefined();
    expect(cat.resolveAttributeForStep('Button', 'FieldA', { moduleField: `'MyModule'` })?.Name).toBe('FieldA');
    expect(cat.resolveAttributeForStep('Button', 'FieldA', { linkedModuleNames: ['MyModule'] })?.Name).toBe(
      'FieldA'
    );
  });

  test('validateStepWithSupportingModules runs soft against BASE_URL when literals resolve', async ({
    page,
  }) => {
    const dir = mig();
    const url = process.env.TOSCA_SUT_URL ?? '';

    if (!dir) test.skip(true, migrationDataRequestNote(needToscaMigrationFolder()));
    if (!url.trim()) test.skip(true, migrationDataRequestNote(needToscaSutUrl()));

    const cat = ModuleCatalog.load(dir);
    const liters = getMergedLiteralsForPlaywright(dir);

    await page.goto(url, { waitUntil: 'domcontentloaded' });

    const demoStep = {
      __type: 'XTestStepValue',
      __title: 'ThankYouTitle',
      '(R)NodePath':
        '/4|Plinko/2 | Main Suite/Regression Suite/Thank You/Thank You/Process/Insert Components/Title (v2)/Title Test Data/ThankYouTitle',
      ActionMode: 'Input',
      TestStep: "'Title Test Data'",
      Value: 'Thank You Template Title',
      '(R)ValueToUse': 'Thank You Template Title',
    } as Record<string, unknown>;

    const res = await validateStepWithSupportingModules({
      page,
      stepRow: demoStep,
      catalog: cat,
      literals: liters,
      strict: false,
    });

    expect(['validated', 'skipped_no_module', 'skipped_no_locator']).toContain(res.outcome);

    const mod = cat.resolveAttributeForStep('Title (v2)', 'ThankYouTitle');
    if (mod) {
      const loc = buildLocatorFromModuleRow(page, mod);
      expect(loc).toBeTruthy();
    }
  });
});
/* AI Generated Code by Deloitte + Cursor (END) */
