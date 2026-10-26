// node scripts/lineup.cjs <baseUrl> <outDir>
const { chromium } = require('playwright');
(async () => {
  const [base, out] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const view of ['side', 'top']) {
    const pg = await b.newPage({ viewport: { width: 1400, height: 700 } });
    const errs = [];
    pg.on('pageerror', (e) => errs.push(e.message));
    await pg.goto(`${base}lineup.html?view=${view}`);
    await pg.waitForFunction(() => window.ready === true, null, { timeout: 30000 });
    await pg.waitForTimeout(300);
    await pg.screenshot({ path: `${out}/lineup-${view}.jpg`, type: 'jpeg', quality: 90 });
    console.log(view, errs);
  }
  await b.close();
})();
