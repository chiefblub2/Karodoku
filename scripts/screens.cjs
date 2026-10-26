// Screenshot matrix: node scripts/screens.cjs <baseUrl> <outDir> [tag]
// 390×844 and 1280×800, 5×5 and 8×8, light and dark UI; plus phone interaction states.
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
        await pg.goto(`${base}?n=${n}&d=medium&s=${n === 5 ? 'show2' : 'show9'}`);
        await pg.waitForSelector('canvas.board3d, .board2d svg', { timeout: 30000 });
        await pg.waitForTimeout(2500);
        // Place a few people via hints so pawns, the chalk outline and marks show up.
        for (let i = 0; i < Math.min(4, n - 2); i++) { await pg.click('[data-action=hint]'); await pg.waitForTimeout(150); }
        // Victim in place (dev hook), plus one ✕ mark on a free cell.
        await pg.evaluate(() => {
          const app = window.__app; if (!app) return;
          const g = app.game, N = g.size;
          g.place(N - 1, g.pz.solution[N - 1]);
          const free = [...Array(N * N).keys()].find((c) => !g.pz.obj[c] && g.personAt(c) < 0 && !g.pz.solution.includes(c));
          if (free !== undefined) g.toggleMark(free);
          app.tool = 1;
        });
        // Let the hint toasts run out so the header shows.
        await pg.waitForTimeout(2600);
        const name = `${vname}-${n}x${n}-${scheme}${tag ? '-' + tag : ''}.jpg`;
        await pg.screenshot({ path: `${out}/${name}`, type: 'jpeg', quality: 88 });
        console.log(name, errs.length ? errs : 'ok');
        await ctx.close();
      }
    }
  }
  await flows(b, base, out, tag);
  await b.close();
})();

/** Phone interaction states: a finger resting on a cell, a name tag, and a clue picked from the full sheet. */
async function flows(b, base, out, tag) {
  for (const scheme of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme, locale: 'de-DE', reducedMotion: 'reduce' });
    await ctx.addInitScript(() => localStorage.setItem('karodoku2:settings', JSON.stringify({ schemaVersion: 2, size: 6, difficulty: 'medium', renderer: '3d', lang: 'de', sound: false, haptics: true, seenRules: true })));
    const pg = await ctx.newPage();
    const name = (n) => `${out}/phone-${n}-${scheme}${tag ? '-' + tag : ''}.jpg`;
    await pg.goto(`${base}?n=8&d=medium&s=show9`);
    await pg.waitForSelector('canvas.board3d', { timeout: 30000 });
    await pg.waitForTimeout(2500);
    const pt = await pg.evaluate(() => {
      const app = window.__app, g = app.game;
      g.place(0, g.pz.solution[0]); g.place(1, g.pz.solution[1]); g.place(g.size - 1, g.pz.solution[g.size - 1]);
      app.tool = 2; app.renderPalette();
      const vm = app.viewModel();
      const want = [...Array(g.size ** 2).keys()].find((c) => !g.pz.obj[c] && !vm.shaded.has(c) && g.personAt(c) < 0);
      const r = document.querySelector('#board-host').getBoundingClientRect();
      let sx = 0, sy = 0, n = 0;
      for (let y = r.top; y < r.bottom; y += 3) for (let x = r.left; x < r.right; x += 3) if (app.view.pick(x, y) === want) { sx += x; sy += y; n++; }
      return { x: sx / n, y: sy / n };
    });
    const touch = (type) => pg.evaluate(([t, p]) => document.querySelector('canvas.board3d').dispatchEvent(new PointerEvent(t, { pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true, clientX: p.x, clientY: p.y })), [type, pt]);
    await touch('pointerdown');
    await pg.waitForTimeout(120);
    const shot = pg.screenshot({ path: name('press'), type: 'jpeg', quality: 88 });
    await pg.waitForTimeout(60);
    await touch('pointercancel');
    await shot;
    // Placing someone shows their name tag for a moment.
    await pg.evaluate(() => { const g = window.__app.game; g.place(2, g.pz.solution[2]); });
    await pg.waitForTimeout(200);
    await pg.screenshot({ path: name('name-tag'), type: 'jpeg', quality: 88 });
    await pg.click('#clue-bar');
    await pg.waitForTimeout(300);
    await pg.click('#sheet-clues [data-focus="5"]');
    await pg.waitForTimeout(500);
    await pg.screenshot({ path: name('clue-focus'), type: 'jpeg', quality: 88 });
    console.log(`phone flows ${scheme} ok`);
    await ctx.close();
  }
}
