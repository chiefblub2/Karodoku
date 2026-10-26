// Screenshot matrix: node scripts/screens.cjs <baseUrl> <outDir> [tag]
// 390×844 and 1280×800, 5×5 and 8×8, light and dark UI.
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [base, out, tag = ''] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const viewports = [['phone', { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }], ['desktop', { width: 1280, height: 800, deviceScaleFactor: 1 }]];
  for (const [vname, vp] of viewports) {
    for (const scheme of ['light', 'dark']) {
      for (const n of [5, 8]) {
        const ctx = await b.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, colorScheme: scheme, locale: 'de-DE', reducedMotion: 'reduce' });
        await ctx.addInitScript(() => localStorage.setItem('karodoku2:settings', JSON.stringify({ schemaVersion: 2, size: 6, difficulty: 'medium', renderer: '3d', lang: 'de', sound: false, haptics: true, seenRules: true })));
        const pg = await ctx.newPage();
        const errs = [];
        pg.on('pageerror', (e) => errs.push(e.message));
        pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
        await pg.goto(`${base}?n=${n}&d=medium&s=shot${n}`);
        await pg.waitForSelector('canvas.board3d, .board2d svg', { timeout: 30000 });
        await pg.waitForTimeout(2500);
        // Place a few people via hints so pawns, the chalk outline and marks show up.
        for (let i = 0; i < Math.min(4, n - 1); i++) { await pg.click('[data-action=hint]'); await pg.waitForTimeout(150); }
        // A mark on the first free cell via the keyboard grid.
        await pg.waitForTimeout(1500);
        const name = `${vname}-${n}x${n}-${scheme}${tag ? '-' + tag : ''}.png`;
        await pg.screenshot({ path: `${out}/${name}` });
        console.log(name, errs.length ? errs : 'ok');
        await ctx.close();
      }
    }
  }
  await b.close();
})();
