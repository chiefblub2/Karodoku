// PWA offline check: node scripts/offline.cjs <url>
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await ctx.newPage();
  await pg.goto(process.argv[2]);
  await pg.waitForFunction(() => navigator.serviceWorker?.controller || navigator.serviceWorker?.ready.then(() => true), null, { timeout: 30000 });
  await pg.evaluate(() => navigator.serviceWorker.ready);
  await pg.reload();
  await pg.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30000 });
  const manifest = await pg.evaluate(async () => (await fetch(document.querySelector('link[rel=manifest]').href)).json());
  await ctx.setOffline(true);
  await pg.reload();
  await pg.waitForFunction(() => performance.getEntriesByName('karodoku-ready').length > 0, null, { timeout: 30000 });
  await pg.waitForFunction(() => performance.getEntriesByName('karodoku-3d').length > 0, null, { timeout: 60000 }).catch(() => {});
  const ok = await pg.evaluate(() => ({ board: !!document.querySelector('canvas.board3d, .board2d svg'), clues: document.querySelectorAll('#sheet-clues li').length }));
  console.log('offline reload:', ok, 'manifest:', manifest.name, manifest.icons.map((i) => i.sizes).join(','));
  await b.close();
})();
