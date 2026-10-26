// Renders the PWA icons from public/favicon.svg: node scripts/icons.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const svg = fs.readFileSync(path.join(__dirname, '../public/favicon.svg'), 'utf8');
  const b = await chromium.launch();
  const page = await b.newPage();
  for (const [name, size, pad] of [['pwa-192.png', 192, 0], ['pwa-512.png', 512, 0], ['apple-touch-icon.png', 180, 0]]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0;background:#2a1d16">${svg.replace('<svg', `<svg width="${size - pad * 2}" height="${size - pad * 2}" style="display:block;margin:${pad}px"`)}</body></html>`);
    await page.screenshot({ path: path.join(__dirname, '../public', name) });
  }
  await b.close();
})();
