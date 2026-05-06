/* AI Generated Code by Deloitte + Cursor (BEGIN) */
import path from 'path';
import { defineConfig } from '@playwright/test';

const migrationDir = process.env.TOSCA_MIGRATION_DIR ?? '';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    trace: 'on-first-retry',
    baseURL: process.env.BASE_URL ?? 'https://example.com',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  metadata: {
    toscaMigrationDir: migrationDir || '(set TOSCA_MIGRATION_DIR to C:\\Exports\\migration)',
  },
});
/* AI Generated Code by Deloitte + Cursor (END) */
