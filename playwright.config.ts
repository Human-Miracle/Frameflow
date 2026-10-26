import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PORT ?? 3100);

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  expect: { toMatchSnapshot: { maxDiffPixelRatio: 0.002 } },
  snapshotPathTemplate: '{testDir}/__snapshots__/{arg}{ext}',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `npm run build && npm run start -- -p ${port} -H 127.0.0.1`,
    url: `http://127.0.0.1:${port}`,
    // Always build and serve the current code; a stale server would hide regressions.
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
