// Interactive smoke test plus axe-core scan: node scripts/qa.cjs <url> <outdir>
// The scan covers phone and desktop, light and dark, with the board, the open clue sheet and a dialog.
const { chromium, devices } = require('playwright');
const fs = require('fs');
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const SETTINGS = { schemaVersion: 2, size: 6, difficulty: 'medium', renderer: '3d', lang: 'de', sound: false, haptics: true, seenRules: true };

async function axe(pg) {
  if (!(await pg.evaluate(() => !!window.axe))) await pg.addScriptTag({ content: AXE });
  return pg.evaluate(async () => {
    const r = await window.axe.run(document, { resultTypes: ['violations'] });
    return r.violations.map((v) => `${v.impact} ${v.id}: ` + v.nodes.slice(0, 4).map((n) => `${n.target} ${n.any[0]?.message ?? ''}`).join(' | '));
  });
}

(async () => {
  const [url, out] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [];
  const watch = (pg) => {
    pg.on('pageerror', (e) => errs.push(e.message));
    pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  };

  // ---------- axe matrix ----------
  const viewports = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, desktop: { viewport: { width: 1280, height: 800 } } };
  const report = {};
  for (const [vname, vp] of Object.entries(viewports)) {
    for (const scheme of ['light', 'dark']) {
      const ctx = await b.newContext({ ...vp, colorScheme: scheme, locale: 'de-DE', reducedMotion: 'reduce' });
      await ctx.addInitScript((s) => localStorage.setItem('karodoku2:settings', JSON.stringify(s)), SETTINGS);
      const pg = await ctx.newPage();
      watch(pg);
      await pg.goto(url);
      await pg.waitForSelector('canvas.board3d, .board2d svg', { timeout: 30000 });
      await pg.waitForTimeout(1200);
      const key = `${vname}-${scheme}`;
      report[`${key} board`] = await axe(pg);
      if (vname === 'phone') {
        await pg.click('#clue-bar');
        await pg.waitForTimeout(300);
        report[`${key} sheet`] = await axe(pg);
        await pg.keyboard.press('Escape');
      }
      await pg.click('#btn-rules');
      await pg.waitForSelector('dialog[open]');
      await pg.waitForTimeout(300);
      report[`${key} dialog`] = await axe(pg);
      await pg.keyboard.press('Escape');
      await ctx.close();
    }
  }
  let violations = 0;
  for (const [k, v] of Object.entries(report)) { violations += v.length; console.log('axe', k, v.length ? v : 'ok'); }

  // ---------- smoke: solve via hints and accuse ----------
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'de-DE' });
  await ctx.addInitScript((s) => localStorage.setItem('karodoku2:settings', JSON.stringify(s)), SETTINGS);
  const pg = await ctx.newPage();
  watch(pg);
  await pg.goto(url);
  await pg.waitForTimeout(1500);
  await pg.keyboard.press('Escape');
  await pg.waitForTimeout(300);
  await pg.screenshot({ path: `${out}/qa-1.png` });
  for (let i = 0; i < 8; i++) {
    if (await pg.locator('dialog[open]').count()) break;
    const h = pg.locator('[data-action=hint]');
    if (await h.isEnabled()) await h.click({ timeout: 2000 }).catch(() => {});
    await pg.waitForTimeout(80);
  }
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
  console.log(violations ? `axe: ${violations} violation group(s)` : 'axe: no violations');
  await b.close();
  process.exitCode = violations || errs.length ? 1 : 0;
})();
