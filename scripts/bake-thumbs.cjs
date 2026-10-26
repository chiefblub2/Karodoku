// Bake legend icons from the 3D furniture into public/thumbs/*.webp
// Usage (with `npm run dev` running): node scripts/bake-thumbs.cjs http://localhost:5173/
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const base = process.argv[2] || 'http://localhost:5173/';
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const pg = await b.newPage();
  await pg.goto(`${base}lineup.html?thumbs=1`);
  await pg.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
  const thumbs = await pg.evaluate(() => window.thumbs);
  const dir = path.join(__dirname, '../public/thumbs');
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, url] of Object.entries(thumbs)) {
    // Re-encode the PNG data URL as WebP in the browser.
    const webp = await pg.evaluate(async (url) => {
      const img = new Image(); img.src = url; await img.decode();
      const c = document.createElement('canvas'); c.width = 128; c.height = 128;
      c.getContext('2d').drawImage(img, 0, 0, 128, 128);
      return c.toDataURL('image/webp', 0.9);
    }, url);
    fs.writeFileSync(path.join(dir, `${name}.webp`), Buffer.from(webp.split(',')[1], 'base64'));
  }
  console.log('baked', Object.keys(thumbs).join(', '));
  await b.close();
})();
