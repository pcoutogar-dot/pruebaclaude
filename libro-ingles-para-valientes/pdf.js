// Comprueba que ninguna página se desborde y genera libro.pdf (6 x 9 pulgadas, listo para imprenta).
// Uso: node pdf.js            -> solo comprobación
//      node pdf.js --pdf      -> comprobación + PDF
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const dir = __dirname;
  const body = fs.readFileSync(path.join(dir, 'libro.html'), 'utf8');
  const html = '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body style="margin:0">' + body + '</body></html>';
  const browser = await chromium.launch();
  let bad = 0;
  for (const width of [1400, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.setContent(html, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    const over = await page.evaluate(() => [...document.querySelectorAll('.page .in')]
      .map((el, i) => ({ n: i + 1, px: el.scrollHeight - el.clientHeight }))
      .filter(o => o.px > 0));
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    console.log(`${width}px: ${over.length ? 'DESBORDAN ' + over.map(o => `p${o.n}(+${o.px}px)`).join(' ') : 'todo cabe'}${wide ? ' | SCROLL HORIZONTAL' : ''}`);
    bad += over.length + (wide ? 1 : 0);
    await page.close();
  }
  if (process.argv.includes('--pdf')) {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    await page.emulateMedia({ media: 'print' });
    await page.pdf({ path: path.join(dir, 'libro.pdf'), width: '6in', height: '9in', printBackground: true, preferCSSPageSize: true });
    console.log('libro.pdf generado');
  }
  if (process.argv.includes('--shots')) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    await page.setContent(html, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    const out = process.argv[process.argv.indexOf('--shots') + 1];
    const slots = await page.$$('.slot .page');
    const want = (process.argv[process.argv.indexOf('--shots') + 2] || '').split(',').filter(Boolean).map(Number);
    for (let i = 0; i < slots.length; i++) {
      if (want.length && !want.includes(i + 1)) continue;
      await slots[i].screenshot({ path: path.join(out, `p${String(i + 1).padStart(2, '0')}.png`) });
    }
    console.log('capturas en', out);
  }
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
