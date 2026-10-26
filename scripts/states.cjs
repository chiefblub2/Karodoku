// Exercise state visuals: node scripts/states.cjs <url> <outDir>
const { chromium } = require('playwright');
(async () => {
  const [url, out] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'de-DE', reducedMotion: 'reduce' });
  await ctx.addInitScript(() => localStorage.setItem('karodoku2:settings', JSON.stringify({ schemaVersion: 2, size: 6, difficulty: 'medium', renderer: '3d', lang: 'de', sound: false, haptics: true, seenRules: true })));
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await pg.goto(url);
  await pg.waitForSelector('canvas.board3d');
  await pg.waitForTimeout(2000);
  const box = await pg.locator('canvas.board3d').boundingBox();
  const N = await pg.evaluate(() => new URLSearchParams(location.search).get('n') | 0);
  // Cell centre in screen space, approximated from the a11y grid order + a pick search.
  const cellXY = async (c) => pg.evaluate(([c, N]) => {
    const canvas = document.querySelector('canvas.board3d');
    const r = canvas.getBoundingClientRect();
    // Scan for the point whose pick hits the cell (cheap: grid search).
    return null;
  }, [c, N]);
  void cellXY;
  // Use keyboard grid for deterministic placement.
  const place = async (person, cell) => {
    await pg.keyboard.press(String(person + 1));
    await pg.evaluate((c) => document.querySelector(`#a11y-grid [data-cell="${c}"]`).click(), cell);
    await pg.waitForTimeout(120);
  };
  const free = await pg.evaluate(() => {
    const cells = [...document.querySelectorAll('#a11y-grid [data-cell]')];
    return cells.filter((b) => !/Tisch|Pflanze|Regal/.test(b.getAttribute('aria-label'))).map((b) => +b.dataset.cell);
  });
  // Two people in the same row → conflict rings.
  const row0 = free.filter((c) => Math.floor(c / N) === Math.floor(free[0] / N));
  await place(0, row0[0]);
  if (row0[1] !== undefined) await place(1, row0[1]);
  // A mark via long-press equivalent (Space on the grid).
  await pg.evaluate((c) => { const el = document.querySelector(`#a11y-grid [data-cell="${c}"]`); el.focus(); }, free[free.length - 1]);
  await pg.keyboard.press(' ');
  // Victim somewhere.
  await place(N - 1, free[Math.floor(free.length / 2)]);
  // Highlight first clue.
  await pg.evaluate(() => document.querySelector('#sheet-clues [data-focus]')?.click());
  await pg.waitForTimeout(400);
  await pg.screenshot({ path: `${out}/st-1-conflict-mark-glow.png` });
  // Check → wrong.
  await pg.click('[data-action=check]');
  await pg.waitForTimeout(500);
  await pg.screenshot({ path: `${out}/st-2-check.png` });
  // Ghost: hover a cell (touch move emulation via mouse not available on touch ctx) – use focus on grid.
  await pg.evaluate((c) => document.querySelector(`#a11y-grid [data-cell="${c}"]`).focus(), free[3]);
  await pg.keyboard.press('3');
  await pg.waitForTimeout(300);
  await pg.screenshot({ path: `${out}/st-3-ghost.png` });
  // Solve with hints, then accuse.
  for (let i = 0; i < N + 2; i++) { if (await pg.locator('dialog[open]').count()) break; const h = pg.locator('[data-action=hint]'); if (await h.isEnabled()) await h.click(); await pg.waitForTimeout(150); }
  await pg.waitForTimeout(800);
  const chips = pg.locator('dialog .accuse-list .chip');
  for (let i = 0; i < await chips.count(); i++) {
    if (!(await pg.locator('dialog.accuse').count())) break;
    if (await chips.nth(i).isEnabled()) { await chips.nth(i).click(); await pg.waitForTimeout(200); }
  }
  await pg.waitForTimeout(600);
  await pg.keyboard.press('Escape');
  await pg.waitForTimeout(300);
  await pg.screenshot({ path: `${out}/st-4-solved.png` });
  console.log('errors', errs);
  await b.close();
})();
