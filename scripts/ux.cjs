// Phase-5 UX walkthrough on a phone viewport: node scripts/ux.cjs <url> <outDir>
const { chromium } = require('playwright');
(async () => {
  const [url, out] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'de-DE', reducedMotion: 'reduce' });
  await ctx.addInitScript(() => localStorage.setItem('karodoku2:settings', JSON.stringify({ schemaVersion: 2, size: 8, difficulty: 'hard', renderer: '3d', lang: 'de', sound: false, haptics: true, seenRules: true })));
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await pg.goto(url);
  await pg.waitForSelector('canvas.board3d');
  await pg.waitForTimeout(1500);
  const shot = (n) => pg.screenshot({ path: `${out}/ux-${n}.jpg`, type: 'jpeg', quality: 85 });
  // Place a couple and strike a clue, focus another.
  await pg.evaluate(() => { const a = window.__app, g = a.game; g.place(0, g.pz.solution[0]); g.place(1, g.pz.solution[1]); g.toggleStrike(0); });
  await pg.click('#sheet-clues [data-focus="2"]');
  await pg.waitForTimeout(500);
  await shot('1-play');
  console.log('fits:', await pg.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth));
  // Swipe left on the clue bar.
  const bar = await pg.locator('#clue-bar').boundingBox();
  await pg.evaluate(([x, y]) => {
    const el = document.querySelector('#clue-bar');
    el.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 9, clientX: x + 200, clientY: y, bubbles: true }));
    el.dispatchEvent(new PointerEvent('pointerup', { pointerId: 9, clientX: x + 60, clientY: y, bubbles: true }));
  }, [bar.x, bar.y + 20]);
  await pg.waitForTimeout(400);
  await shot('2-swiped');
  // Open the sheet, show legend tab.
  await pg.evaluate(([x, y]) => {
    const el = document.querySelector('#clue-bar');
    el.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 8, clientX: x, clientY: y, bubbles: true }));
    el.dispatchEvent(new PointerEvent('pointerup', { pointerId: 8, clientX: x, clientY: y - 80, bubbles: true }));
  }, [bar.x + 100, bar.y + 20]);
  await pg.waitForTimeout(400);
  await shot('3-sheet');
  await pg.click('.sheet-tabs [data-tab=legend]');
  await pg.waitForTimeout(300);
  await shot('4-legend');
  await pg.click('#sheet-backdrop', { position: { x: 20, y: 60 } });
  // Settings sheet.
  await pg.click('#btn-case');
  await pg.waitForTimeout(400);
  await shot('5-settings');
  await pg.keyboard.press('Escape');
  await pg.waitForTimeout(300);
  // Long-press bio on a chip.
  // Solve + result.
  await pg.evaluate(() => { const a = window.__app, g = a.game; for (let p = 0; p < g.size; p++) g.place(p, g.pz.solution[p]); });
  await pg.waitForTimeout(300);
  await pg.evaluate(() => document.querySelector('dialog')?.remove());
  await pg.evaluate(() => window.__app.game.accuse(window.__app.game.pz.murderer));
  await pg.waitForTimeout(1500);
  await shot('6-result');
  console.log('errors', errs);
  await b.close();
})();
