// Throttled load + generation timing + a11y scan: node scripts/perf.cjs <url>
// Throttling ≈ Lighthouse mobile: 1.6 Mbit/s, 150 ms RTT, 4× CPU slowdown.
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const url = process.argv[2];
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'de-DE' });
  await ctx.addInitScript(() => localStorage.setItem('karodoku2:settings', JSON.stringify({ schemaVersion: 2, size: 8, difficulty: 'hard', renderer: '3d', lang: 'de', sound: false, haptics: true, seenRules: true })));
  const pg = await ctx.newPage();
  const cdp = await ctx.newCDPSession(pg);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  let bytes = 0;
  cdp.on('Network.loadingFinished', (e) => { bytes += e.encodedDataLength; });
  const t0 = Date.now();
  await pg.goto(url);
  await pg.waitForFunction(() => performance.getEntriesByName('karodoku-ready').length > 0, null, { timeout: 60000 });
  const ready = Date.now() - t0;
  await pg.waitForFunction(() => performance.getEntriesByName('karodoku-3d').length > 0, null, { timeout: 120000 });
  const ready3d = Date.now() - t0;
  const gen = await pg.evaluate(() => performance.getEntriesByName('karodoku-generate').map((e) => Math.round(e.duration)));
  // Generate a few more hard 8×8 cases through the UI's worker path.
  const more = [];
  for (const seed of ['p1', 'p2', 'p3', 'p4', 'p5']) {
    await pg.evaluate((seed) => { const u = new URL(location.href); u.searchParams.set('s', seed); history.pushState(null, '', u); dispatchEvent(new PopStateEvent('popstate')); }, seed);
    await pg.waitForFunction((n) => performance.getEntriesByName('karodoku-generate').length > n, more.length + gen.length, { timeout: 60000 });
    more.push(await pg.evaluate(() => Math.round(performance.getEntriesByName('karodoku-generate').at(-1).duration)));
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  // Accessibility scan.
  await pg.addScriptTag({ content: fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8') });
  const axe = await pg.evaluate(async () => {
    const r = await window.axe.run(document, { resultTypes: ['violations'] });
    return r.violations.map((v) => `${v.impact} ${v.id}: ${v.nodes.length} ` + v.nodes.slice(0, 6).map((n) => `${n.target} ${n.any[0]?.message ?? ''}`).join(' | '));
  });
  console.log(JSON.stringify({ transferKB: Math.round(bytes / 1024), firstInteractionMs: ready, threeDReadyMs: ready3d, generateMs_first: gen, generateMs_hard8_cpu4x: more, axe }, null, 2));
  await b.close();
})();
