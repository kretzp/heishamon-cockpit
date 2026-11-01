import { test as base, expect, chromium } from '../../web/node_modules/@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

export { expect, chromium };
export type { Page } from '../../web/node_modules/@playwright/test';
export const test = base.extend<{ collectCoverage: void }>({
  collectCoverage: [async ({ context }, use) => {
    if (process.env.COCKPIT_COVERAGE !== '1') { await use(); return; }
    const directory = resolve(process.cwd(), '../.cache/coverage/frontend/raw');
    mkdirSync(directory, { recursive: true });
    await context.exposeBinding('__saveCockpitCoverage', (_source, data) => {
      if (data) writeFileSync(resolve(directory, randomUUID() + '.json'), JSON.stringify(data));
    });
    await context.addInitScript(() => {
      window.addEventListener('beforeunload', () => {
        const w = window as unknown as { __coverage__?: unknown; __saveCockpitCoverage: (value: unknown) => Promise<void> };
        void w.__saveCockpitCoverage(w.__coverage__);
      });
    });
    await use();
    for (const page of context.pages()) {
      if (!page.isClosed()) await page.evaluate(async () => {
        const w = window as unknown as { __coverage__?: unknown; __saveCockpitCoverage: (value: unknown) => Promise<void> };
        await w.__saveCockpitCoverage(w.__coverage__);
      });
    }
  }, { auto: true }]
});
