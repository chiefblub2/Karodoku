// Layout and touch-target check: node scripts/layout.cjs <baseUrl> [renderer]
// For each phone size: board cell size on 8×8, overflow/overlap, and every visible control under 44×44 CSS px.
const { chromium } = require('playwright');
(async () => {
  const [base, renderer = '3d'] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  let bad = 0;
  for (const [w, h] of [[360, 640], [390, 844], [430, 932]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'de-DE', reducedMotion: 'reduce' });
    await ctx.addInitScript((r) => localStorage.setItem('karodoku2:settings', JSON.stringify({ schemaVersion: 2, size: 8, difficulty: 'medium', renderer: r, lang: 'de', sound: false, haptics: true, seenRules: true })), renderer);
    const pg = await ctx.newPage();
    await pg.goto(`${base}?n=8&d=medium&s=show9`);
    await pg.waitForSelector(renderer === '3d' ? 'canvas.board3d' : '.board2d svg', { timeout: 30000 });
    await pg.waitForTimeout(2500);
    const r = await pg.evaluate(() => {
      const app = window.__app;
      let a = app.view.anchor?.(0), c = app.view.anchor?.(1);
      if (!a) {
        // Older builds: measure cell A1's width by picking along a row through it.
        const q = document.querySelector('#board-host').getBoundingClientRect();
        let first = -1, last = -1;
        for (let y = q.top; y < q.bottom && first < 0; y += 2) for (let x = q.left; x < q.right; x += 0.5) if (app.view.pick(x, y + 6) === 0) { if (first < 0) first = x; last = x; }
        a = { x: first }; c = { x: last };
      }
      const box = (sel) => { const e = document.querySelector(sel); if (!e) return null; const q = e.getBoundingClientRect(); return { top: Math.round(q.top), bottom: Math.round(q.bottom), h: Math.round(q.height) }; };
      const parts = { header: box('.topbar'), strip: box('#case-strip'), board: box('.board-area'), dock: box('.dock'), sheet: box('#clue-sheet'), palette: box('#palette'), actions: box('#actions') };
      // Hit area of a control: its own box, grown by an ::after hit pseudo-element if it has one.
      const small = [];
      for (const el of document.querySelectorAll('button, [role=button], a[href], input, select')) {
        if (el.closest('#a11y-grid, dialog:not([open])')) continue;
        const q = el.getBoundingClientRect();
        if (!q.width || !q.height || getComputedStyle(el).visibility === 'hidden') continue;
        const after = getComputedStyle(el, '::after');
        const grow = after.content !== 'none' && after.position === 'absolute' ? Math.max(0, -parseFloat(after.top) || 0) : 0;
        const wv = q.width + 2 * grow, hv = q.height + 2 * grow;
        if (wv < 43.5 || hv < 43.5) small.push(`${el.id ? '#' + el.id : (el.className || el.tagName).replace(/\s+/g, ' ').trim()} ${Math.round(wv)}×${Math.round(hv)}`);
      }
      const counts = {};
      for (const k of small) counts[k] = (counts[k] ?? 0) + 1;
      const sizes = {};
      for (const [k, sel] of Object.entries({ chip: '#palette .chip', clueCheck: '.clue-check', action: '.action', pill: '#btn-case', rules: '#btn-rules', strip: '#case-strip' })) {
        const e = [...document.querySelectorAll(sel)].find((x) => x.getBoundingClientRect().width > 0); if (!e) continue;
        const q = e.getBoundingClientRect();
        const after = getComputedStyle(e, '::after');
        const grow = after.content !== 'none' && after.position === 'absolute' ? Math.max(0, -parseFloat(after.top) || 0) : 0;
        sizes[k] = `${Math.round(q.width + 2 * grow)}×${Math.round(q.height + 2 * grow)}`;
      }
      const overlap = parts.board.bottom > parts.dock.top + 1 || parts.strip.bottom > parts.board.top + 1;
      return { cell: Math.round((c.x - a.x) * 10) / 10, parts, small: Object.entries(counts).map(([k, n]) => (n > 1 ? `${k} (×${n})` : k)), sizes, overflow: document.documentElement.scrollHeight > innerHeight || document.documentElement.scrollWidth > innerWidth, overlap };
    });
    bad += r.small.length + (r.overflow ? 1 : 0) + (r.overlap ? 1 : 0);
    console.log(`${w}×${h}: 8×8 cell ${r.cell}px, overflow ${r.overflow}, overlap ${r.overlap}`);
    console.log('  sizes', JSON.stringify(r.sizes));
    console.log('  parts', JSON.stringify(r.parts));
    console.log('  under 44px:', r.small.length ? r.small : 'none');
    await ctx.close();
  }
  await b.close();
  process.exitCode = bad ? 1 : 0;
})();
