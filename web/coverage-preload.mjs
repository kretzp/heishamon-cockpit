// Optional instrumentation collector for the existing standalone browser scripts.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

if (process.env.COCKPIT_COVERAGE === '1') {
  const directory = resolve(import.meta.dirname, '../.cache/coverage/frontend/raw');
  mkdirSync(directory, { recursive: true });
  const attached = new WeakSet();
  async function collect(page) {
    if (page.isClosed()) return;
    const data = await page.evaluate(() => window.__coverage__);
    if (data) writeFileSync(resolve(directory, randomUUID() + '.json'), JSON.stringify(data));
  }
  async function attach(context) {
    if (attached.has(context)) return;
    attached.add(context);
    await context.exposeBinding('__saveStandaloneCoverage', (_source, data) => {
      if (data) writeFileSync(resolve(directory, randomUUID() + '.json'), JSON.stringify(data));
    });
    await context.addInitScript(() => window.addEventListener('beforeunload', () => {
      void window.__saveStandaloneCoverage(window.__coverage__);
    }));
    const close = context.close.bind(context);
    context.close = async (...args) => { for (const p of context.pages()) await collect(p); return close(...args); };
  }
  const launch = chromium.launch.bind(chromium);
  chromium.launch = async (...args) => {
    const browser = await launch(...args);
    const newContext = browser.newContext.bind(browser);
    browser.newContext = async (...args) => { const context = await newContext(...args); await attach(context); return context; };
    const newPage = browser.newPage.bind(browser);
    browser.newPage = async (...args) => { const page = await newPage(...args); await attach(page.context()); return page; };
    const close = browser.close.bind(browser);
    browser.close = async (...args) => { for (const context of browser.contexts()) for (const page of context.pages()) await collect(page); return close(...args); };
    return browser;
  };
}
