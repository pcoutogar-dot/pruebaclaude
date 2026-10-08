'use strict';
// Prueba de extremo a extremo de la página (necesita Playwright y Chromium; no forma parte de "npm test").
//   node test/ui.e2e.js [carpeta-para-capturas]
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const assert = require('assert/strict');

function loadPlaywright() {
  try { return require('playwright'); } catch (_) { /* seguimos */ }
  const root = execFileSync('npm', ['root', '-g']).toString().trim();
  return require(require.resolve('playwright', { paths: [root] }));
}
const { chromium } = loadPlaywright();
const { buildIdml } = require('./fixture');

(async () => {
  const shots = process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'shots-'));
  fs.mkdirSync(shots, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-'));
  // se pasan como bytes (no como rutas) para no depender de la codificación de nombres del sistema de archivos
  const idml = { name: 'mi documento ñ.idml', mimeType: 'application/octet-stream', buffer: Buffer.from(buildIdml()) };
  const indd = { name: 'viejo.indd', mimeType: 'application/octet-stream', buffer: Buffer.concat([Buffer.from([0x06, 0x06, 0xED, 0xF5, 0xD8, 0x1D, 0x46, 0xE5, 0xBD, 0x31, 0xEF, 0xE7, 0xFE, 0x74, 0xB7, 0x1D]), Buffer.alloc(100)]) };
  const url = 'file://' + path.resolve(__dirname, '../dist/idml-a-cs3.html');

  const browser = await chromium.launch();
  const problems = [];
  for (const [label, viewport, scheme] of [['escritorio-claro', { width: 1100, height: 900 }, 'light'], ['movil-oscuro', { width: 390, height: 844 }, 'dark']]) {
    const ctx = await browser.newContext({ viewport, colorScheme: scheme, acceptDownloads: true });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') problems.push(label + ' consola: ' + m.text()); });
    page.on('pageerror', (e) => problems.push(label + ' error: ' + e.message));
    await page.goto(url);
    await page.screenshot({ path: path.join(shots, label + '-1-inicio.png'), fullPage: true });

    // 1) un .indd se explica
    await page.setInputFiles('#file', indd);
    await page.waitForSelector('#error:not([hidden])');
    assert.match(await page.textContent('#error-title'), /\.indd/);
    await page.screenshot({ path: path.join(shots, label + '-2-error.png'), fullPage: true });

    // 2) un IDML se convierte
    await page.setInputFiles('#file', idml);
    await page.waitForSelector('#result:not([hidden])');
    const stats = await page.$$eval('#r-stats div', (ds) => ds.map((d) => d.textContent));
    assert.deepEqual(stats, ['Páginas3', 'Objetos16', 'Textos6', 'Imágenes2', 'Fuentes2']);
    assert.match(await page.textContent('#r-file'), /mi documento ñ\.idml/);
    assert.match(await page.textContent('#r-warns'), /tabla/);
    await page.screenshot({ path: path.join(shots, label + '-3-resultado.png'), fullPage: true });

    // 3) descarga
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#download')]);
    const zipPath = path.join(tmp, label + '-' + dl.suggestedFilename());
    await dl.saveAs(zipPath);
    assert.equal(dl.suggestedFilename(), 'mi_documento_n_para_CS3.zip');
    execFileSync('unzip', ['-tq', zipPath]);
    const names = execFileSync('unzip', ['-Z1', zipPath]).toString().split('\n').filter(Boolean);
    for (const must of ['1_reconstruir_en_CS3.jsx', '2_EXPERIMENTAL_documento.inx', 'LEEME.txt', 'informe.html', 'imagenes_incrustadas/embebida.png']) {
      assert.ok(names.some((n) => n.endsWith('/' + must)), 'falta ' + must + ' en ' + names.join(', '));
    }
    // el script del zip es idéntico al que genera la línea de comandos
    const jsx = execFileSync('unzip', ['-p', zipPath, 'mi_documento_n_para_CS3/1_reconstruir_en_CS3.jsx']).toString();
    assert.match(jsx, /^#target indesign/);
    assert.ok(!/[^\x00-\x7f]/.test(jsx));

    // 4) sin desbordes horizontales
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(over <= 0, label + ' desborda ' + over + 'px');

    // 5) documento de ejemplo
    await page.click('#sample');
    await page.waitForSelector('#result:not([hidden])');
    assert.match(await page.textContent('#r-file'), /documento-de-ejemplo\.idml/);

    // 5b) soltar el archivo en cualquier parte de la página (arrastrar y soltar real)
    await page.evaluate(() => { document.getElementById('result').hidden = true; });
    const dt = await page.evaluateHandle((b64) => {
      const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      const d = new DataTransfer(); d.items.add(new File([u8], 'arrastrado.idml')); return d;
    }, Buffer.from(buildIdml()).toString('base64'));
    await page.dispatchEvent('h1', 'drop', { dataTransfer: dt });
    await page.waitForSelector('#result:not([hidden])');
    assert.match(await page.textContent('#r-file'), /arrastrado\.idml/);

    // 6) sin INX
    await page.uncheck('#opt-inx');
    await page.setInputFiles('#file', idml);
    // el resultado anterior sigue visible hasta que termina la nueva conversión: se espera al nombre del archivo nuevo
    await page.waitForFunction(() => document.getElementById('r-file').textContent.includes('mi documento'));
    const files = await page.textContent('#r-files');
    assert.ok(!/EXPERIMENTAL/.test(files), 'no debería incluir el INX');
    await ctx.close();
  }
  // ---- dentro de Claude (artefacto): la descarga pasa por la capacidad "downloads"
  for (const mode of ['acepta', 'rechaza', 'sin-capacidad']) {
    const ctx = await browser.newContext({ viewport: { width: 900, height: 800 }, acceptDownloads: true });
    await ctx.addInitScript((m) => {
      window.__saved = [];
      window.claude = {
        use: async (name) => {
          if (name !== 'downloads' || m === 'sin-capacidad') return null;
          return { save: async (req) => { window.__saved.push({ filename: req.filename, isBlob: req.data instanceof Blob, size: req.data.size }); if (m === 'rechaza') { const e = new Error('no'); e.code = 'declined'; throw e; } return { status: 'saved' }; } };
        },
      };
    }, mode);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => problems.push(mode + ' error: ' + e.message));
    await page.goto(url);
    await page.setInputFiles('#file', idml);
    await page.waitForSelector('#result:not([hidden])');
    if (mode === 'sin-capacidad') {
      const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#download')]);
      assert.equal(dl.suggestedFilename(), 'mi_documento_n_para_CS3.zip');
    } else {
      await page.click('#download');
      await page.waitForFunction(() => window.__saved.length === 1);
      const saved = await page.evaluate(() => window.__saved[0]);
      assert.equal(saved.filename, 'mi_documento_n_para_CS3.zip');
      assert.equal(saved.isBlob, true);
      assert.ok(saved.size > 10000, 'zip con contenido');
      const toastHidden = await page.$eval('#toast', (t) => t.hidden || !t.textContent.trim() || /Guardado/.test(t.textContent));
      assert.ok(toastHidden, 'si el usuario rechaza no debe salir ningún error');
    }
    await ctx.close();
  }
  await browser.close();
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  console.log('UI OK. Capturas en ' + shots);
})().catch((e) => { console.error(e); process.exit(1); });
