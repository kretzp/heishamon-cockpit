import { spawnSync } from 'node:child_process';

for (const scenario of ['unknown', 'invalid', 'retained', 'stale', 'offline', 'disconnected', 'reconnect', 'no-error', 'no-error-retained']) {
  console.log(`Simulator scenario: ${scenario}`);
  const result = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--project=desktop'], {
    stdio: 'inherit', env: { ...process.env, COCKPIT_TEST_SCENARIO: scenario }
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
