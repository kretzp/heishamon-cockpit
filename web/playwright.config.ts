import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.COCKPIT_TEST_PORT ?? '5080');
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid local test port');
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: '../tests/E2E', fullyParallel: false, workers: 1, timeout: 45000,
  testMatch: process.env.COCKPIT_TEST_SCENARIO ? 'scenarios.spec.ts' : /(?:dashboard|analysis|efficiency|metric-dialog|themes|languages)\.spec\.ts/,
  outputDir: `test-results/${process.env.COCKPIT_TEST_SCENARIO ?? 'dashboard'}-${port}-${process.pid}`,
  // Full bundled Chromium avoids native crashes of the standalone headless shell.
  use: { baseURL, channel: 'chromium', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } }
  ],
  webServer: {
    command: `dotnet run --no-build -c ${process.env.COCKPIT_TEST_CONFIGURATION ?? (process.env.COCKPIT_TEST_RELEASE === '1' ? 'Release' : 'Debug')} --project ../src/Cockpit.Web`,
    url: `${baseURL}/health/ready`, reuseExistingServer: false,
    env: { LocalPort: String(port), Source: 'simulator', Access__RequireLogin: 'false', LiveControl__Enabled: 'false', Control__Enabled: 'false', LiveTest__Enabled: 'false', HeatingCurve__Enabled: 'false', History__Path: `data/e2e-${port}-${process.pid}.db`, History__SampleSeconds: '5', Simulator__Scenario: process.env.COCKPIT_TEST_SCENARIO ?? 'normal',
      ...(process.env.COCKPIT_TEST_SCENARIO === 'stale' ? { Telemetry__FreshSeconds: '2', Telemetry__MaxPairSeconds: '1' } : {}) }, timeout: 30000
  }
});
