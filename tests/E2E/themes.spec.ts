import { test, expect } from './coverage-fixture';

test('three themes persist, keep telemetry readable and support keyboard selection', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('article', { name: 'Vorlauf', exact: true })).toContainText('34,50');
  for (const [label, theme, background] of [
    ['Hell', 'light', 'rgb(255, 255, 255)'], ['Dunkel', 'dark', 'rgb(24, 34, 49)'], ['Nordisch', 'nordic', 'rgb(248, 250, 251)'],
  ]) {
    const button = page.getByRole('button', { name: label, exact: true });
    await button.focus(); await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.locator('.temperature-grid > .metric').first()).toHaveCSS('background-color', background);
    await expect.poll(() => page.locator('.temperature-grid > .metric').first().evaluate(el => {
      const luminance = (color: string) => {
        const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(v => v / 255)
          .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
        return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
      };
      const background = luminance(getComputedStyle(el).backgroundColor);
      return Math.min(...['.metric-heading', '.value', '.age', '.quality'].map(selector => {
        const child = el.querySelector(selector)!;
        const style = getComputedStyle(child);
        const foreground = luminance(style.color);
        const surface = selector === '.quality' ? luminance(style.backgroundColor) : background;
        return (Math.max(foreground, surface) + .05) / (Math.min(foreground, surface) + .05);
      }));
    })).toBeGreaterThanOrEqual(4.5);
    expect(await button.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: info.outputPath(`theme-${theme}.png`), fullPage: true });
    await page.screenshot({ path: info.outputPath(`theme-${theme}-preview.png`) });
    await page.reload();
    await expect(page.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('article', { name: 'Vorlauf', exact: true })).toContainText('34,50');
  }
  await page.getByRole('button', { name: 'Dunkel', exact: true }).click();
  for (const name of ['Verlauf', 'Steuerung', 'Heizkurve', 'Ereignisse', 'Einstellungen']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('heading', { name, exact: true }).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: info.outputPath(`dark-${name}.png`), fullPage: true });
  }
  await page.getByRole('button', { name: 'Übersicht', exact: true }).click();
  await page.getByRole('button', { name: 'Vorlauf – Diagramm öffnen', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCSS('background-color', 'rgb(24, 34, 49)');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('invalid preference and unavailable storage have safe fallbacks', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('heishamon-cockpit.theme.v1', 'invalid'));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Hell', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Blocked', 'SecurityError'); }; });
  await page.getByRole('button', { name: 'Dunkel', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByText('Design gilt nur für diese Sitzung: Browserspeicher nicht verfügbar.')).toBeVisible();
});

test('theme selection is available at login without accessing plant data', async ({ page }) => {
  await page.route('**/api/v1/auth/session', route => route.fulfill({ json: { loginRequired: true, authenticated: false } }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible();
  await page.getByRole('button', { name: 'Dunkel', exact: true }).click();
  await expect(page.locator('.access-card')).toHaveCSS('background-color', 'rgb(24, 34, 49)');
  await expect(page.getByLabel('Passwort')).toHaveAttribute('type', 'password');
});


test('navigation hover and empty fields retain accessible contrast in every theme', async ({ page }) => {
  const contrast = async (selector: string, field = false) => page.locator(selector).first().evaluate((el, field) => {
    const luminance = (color: string) => {
      const c = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(v => v / 255)
        .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
      return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
    };
    const s = getComputedStyle(el);
    const a = luminance(field ? s.borderTopColor : s.color), b = luminance(s.backgroundColor);
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  }, field);
  await page.goto('/');
  for (const label of ['Hell', 'Dunkel', 'Nordisch']) {
    await page.getByRole('button', { name: label, exact: true }).click();
    const nav = page.getByRole('navigation').getByRole('button', { name: 'Verlauf', exact: true });
    await nav.hover();
    await expect.poll(() => contrast('nav button:hover')).toBeGreaterThanOrEqual(4.5);
    await page.keyboard.press('Tab');
    await nav.focus();
    expect(await nav.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
  }
  await page.route('**/api/v1/auth/session', route => route.fulfill({ json: { loginRequired: true, authenticated: false } }));
  await page.reload();
  for (const label of ['Hell', 'Dunkel', 'Nordisch']) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect.poll(() => contrast('.access-card input', true)).toBeGreaterThanOrEqual(3);
  }
});

test('text spacing reflows headings and period buttons at 320 pixels in all languages', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/');
  for (const language of ['de', 'en', 'fr', 'es', 'it', 'pt']) {
    await page.getByTestId('language-picker').selectOption(language);
    for (let i = 0; i < 6; i++) {
      await page.getByRole('navigation').getByRole('button').nth(i).click();
      await page.evaluate(() => {
        for (const el of document.querySelectorAll<HTMLElement>('*')) {
          el.style.setProperty('line-height', '1.5', 'important');
          el.style.setProperty('letter-spacing', '.12em', 'important');
          el.style.setProperty('word-spacing', '.16em', 'important');
          if (el.tagName === 'P') el.style.setProperty('margin-bottom', '2em', 'important');
        }
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${language} page ${i}`).toBeLessThanOrEqual(320);
      const clipped = await page.locator('.page-heading-row button, .segments button').evaluateAll(elements =>
        elements.filter(el => el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1).map(el => el.textContent));
      expect(clipped, `${language} page ${i} clipped buttons`).toEqual([]);
      const skipped = await page.locator('main h1, main h2, main h3, main h4').evaluateAll(elements => {
        const visible = elements.filter(el => el.getClientRects().length);
        return visible.filter((el, i) => i > 0 && Number(el.tagName[1]) > Number(visible[i - 1].tagName[1]) + 1).map(el => el.textContent);
      });
      expect(skipped, `${language} page ${i} heading order`).toEqual([]);
    }
  }
});
