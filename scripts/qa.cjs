// Quick interactive smoke test: node scripts/qa.cjs <url> <outdir>
const { chromium, devices } = require('playwright');
(async () => {
  const [url, out] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'de-DE' });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await pg.goto(url);
  await pg.waitForTimeout(1500);
  await pg.keyboard.press('Escape');
  await pg.waitForTimeout(300);
  await pg.screenshot({ path: `${out}/qa-1.png` });
  // Solve via hints and accuse.
  for (let i = 0; i < 8; i++) { const b = pg.locator('[data-action=hint]'); if (await b.isEnabled()) await b.click(); await pg.waitForTimeout(80); }
  await pg.waitForTimeout(700);
  await pg.screenshot({ path: `${out}/qa-2.png` });
  const chips = pg.locator('dialog .accuse-list .chip');
  const n = await chips.count();
  for (let i = 0; i < n; i++) {
    if (!(await pg.locator('dialog.accuse').count())) break;
    const c = chips.nth(i);
    if (await c.isEnabled()) { await c.click(); await pg.waitForTimeout(250); }
  }
  await pg.waitForTimeout(2500);
  await pg.screenshot({ path: `${out}/qa-3.png` });
  console.log('errors', errs, 'scrollH', await pg.evaluate(() => document.documentElement.scrollHeight), 'innerH', await pg.evaluate(() => innerHeight));
  await b.close();
})();
