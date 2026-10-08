'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { buildIdml, buildIdmlWith } = require('./fixture');
const { convert } = require('../src/convert');
const { readZip, writeZip } = require('../src/zip');
const X = require('../src/xml');
const I = require('../src/idml');
const { buildInx } = require('../src/inx');
const R = require('../src/report');

const DATE = new Date('2026-10-08T12:00:00Z');
const bytes = buildIdml();
const res = convert(bytes, { name: 'Mi Libro ñ.idml', date: DATE });
const file = (suffix) => res.files.find((f) => f.name.endsWith(suffix));
const text = (f) => (typeof f.data === 'string' ? f.data : Buffer.from(f.data).toString('utf8'));

test('convert(): carpeta y archivos esperados', () => {
  assert.equal(res.folder, 'Mi_Libro_n_para_CS3');
  const names = res.files.map((f) => f.name.slice(res.folder.length + 1));
  assert.deepEqual(names.filter((n) => !n.includes('/')), ['1_reconstruir_en_CS3.jsx', '2_EXPERIMENTAL_documento.inx', 'LEEME.txt', 'informe.html']);
  assert.equal(names.filter((n) => n.startsWith('textos/')).length, 4);
  assert.equal(names.filter((n) => n.startsWith('textos_con_formato/')).length, 4);
  assert.deepEqual(names.filter((n) => n.startsWith('imagenes_incrustadas/')), ['imagenes_incrustadas/embebida.png']);
  assert.deepEqual(res.summary.warnings.length, 1);
});

test('convert(): el zip resultante es válido', () => {
  const z = writeZip(res.files);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'out-'));
  const f = path.join(dir, 'r.zip');
  fs.writeFileSync(f, z);
  execFileSync('unzip', ['-tq', f]);
  const r = readZip(z);
  assert.equal(r.names.length, res.files.length);
  const png = r.get(res.folder + '/imagenes_incrustadas/embebida.png');
  assert.deepEqual(Array.from(png.slice(0, 4)), [137, 80, 78, 71]);
});

test('convert(): sin INX ni RTF si se pide', () => {
  const r = convert(bytes, { name: 'x.idml', inx: false, rtf: false, date: DATE });
  const names = r.files.map((f) => f.name);
  assert.ok(!names.some((n) => /\.inx$/.test(n)));
  assert.ok(!names.some((n) => /textos_con_formato/.test(n)));
  assert.doesNotMatch(text(r.files.find((f) => f.name.endsWith('LEEME.txt'))), /EXPERIMENTAL/);
});

test('convert(): es determinista con la misma fecha', () => {
  const a = convert(bytes, { name: 'x.idml', date: DATE });
  const b = convert(bytes, { name: 'x.idml', date: DATE });
  assert.deepEqual(a.files.map((f) => text(f)), b.files.map((f) => text(f)));
});

// ------------------------------------------------------------------ INX
test('INX: un solo <Document> con la versión de CS3 y sin rastro del paquete IDML', () => {
  const inx = text(file('.inx'));
  assert.match(inx, /^<\?xml version="1\.0" encoding="UTF-8" standalone="yes"\?>\n<\?aid style="50" type="document" readerVersion="5\.0" featureSet="257" product="5\.0\(640\)" \?>\n<Document /);
  assert.ok(!/idPkg/.test(inx), 'no debe quedar ningún idPkg');
  const root = X.parseXml(inx);
  assert.equal(root.name, 'Document');
  assert.equal(root.attrs.DOMVersion, '5.0');
  assert.equal(root.attrs.Self, 'd');
  const count = (n) => X.kidsEl(root, n).length;
  assert.equal(count('Spread'), 2);
  assert.equal(count('MasterSpread'), 1);
  assert.equal(count('Story'), 6);
  assert.ok(count('Color') >= 4);
  assert.equal(count('Layer'), 2);
  assert.equal(count('Section'), 1);
  assert.ok(X.kidsEl(root, 'RootParagraphStyleGroup').length === 1);
  assert.ok(X.firstEl(root, 'DocumentPreference'));
  // el contenido de texto se conserva intacto (tabulaciones, saltos forzados, marcadores)
  const stories = X.kidsEl(root, 'Story');
  const main = stories.find((s) => s.attrs.Self === 'u1f3');
  assert.ok(X.textOf(main).includes('salto forzado, tab\tcon'));
  assert.ok(inx.includes('<?ACE 18?>'));
});

test('INX: quita lo que CS3 no tiene (notas al pie, variables, artículos, diseño líquido)', () => {
  const b = buildIdmlWith((p) => {
    p['designmap.xml'] = p['designmap.xml'].replace('<Section ', '<Article Self="art1" Name="a"/><TextVariable Self="tv" Name="v"/><Section ');
    p['Spreads/Spread_ud8.xml'] = p['Spreads/Spread_ud8.xml'].replace('<Page Self="up1"', '<Page LayoutRule="Off" OptionalPage="false" Self="up1"');
    p['Stories/Story_u1f3.xml'] = p['Stories/Story_u1f3.xml'].replace('<Content>Texto normal con </Content>', '<Content>Texto normal con </Content><Footnote Self="fn"><Content>nota</Content></Footnote>');
  });
  const pkg = I.readPackage(b);
  const r = buildInx(pkg);
  assert.ok(!/<Article|<TextVariable |<Footnote|LayoutRule|OptionalPage/.test(r.text));
  assert.equal(r.stats.elements, 3);
  assert.equal(r.stats.attrs, 2);
  X.parseXml(r.text);
});

// ------------------------------------------------------------------ textos
test('TXT: UTF-8 con BOM, saltos CRLF, párrafos, salto forzado y tabla', () => {
  const t = text(file('textos/01_p1_Titulo-de-prueba-nandu.txt'));
  assert.ok(t.startsWith('﻿Título de prueba ñandú\r\nTexto normal con negrita y un salto\r\nforzado, tab\tcon tabulación'));
  assert.ok(t.endsWith('Último párrafo, sin salto final.'));
  const tab = text(file('textos/03_p2_tabla.txt'));
  assert.match(tab, /\[Tabla de 2 filas × 2 columnas\]\r\nA1\tB1\r\nA2\tB2/);
  assert.match(text(file('textos/04_p3_Pag.txt')), /Pág\. #/);
});

test('RTF: llaves equilibradas, Unicode, negrita, alineación y color', () => {
  const rtf = text(file('textos_con_formato/01_p1_Titulo-de-prueba-nandu.rtf'));
  assert.ok(rtf.startsWith('{\\rtf1\\ansi'));
  let depth = 0;
  for (let i = 0; i < rtf.length; i++) {
    const c = rtf[i];
    if (c === '\\') { i++; continue; }
    if (c === '{') depth++; else if (c === '}') depth--;
    assert.ok(depth >= 0);
  }
  assert.equal(depth, 0);
  assert.ok(/\\u241\?/.test(rtf), 'ñ como \\u241?');
  assert.ok(/\\qc/.test(rtf), 'título centrado');
  assert.ok(/\{\\f\d+\\fs48\\b /.test(rtf) || /\\fs48\\b/.test(rtf), 'título en negrita 24 pt');
  assert.match(rtf, /\\colortbl;[^}]*\\red255\\green0\\blue0;/, 'color Rojo (CMYK 0 100 100 0 → rojo)');
  assert.match(rtf, /\\super/);
  assert.match(rtf, /\\line /);
  assert.match(rtf, /\\fonttbl.*Myriad Pro/s);
  const paras = rtf.split('\\par\n');
  assert.match(paras[0], /\\qc.*Título|\\qc.*T\\u237\?tulo/);
  assert.match(paras[1], /\\qj\\li0\\ri0\\fi240\\sb0\\sa60 .*Texto normal/, 'el segundo párrafo usa su propio formato (justificado, sangría de 12 pt)');
  assert.match(paras[2], /\\qc\\li0\\ri0\\fi240\\sb120/, 'anulación local: centrado y 6 pt antes');
});

// ------------------------------------------------------------------ informe y léeme
test('informe HTML: avisos, fuentes, imágenes, colores y un mapa por pliego y maestra', () => {
  const h = text(file('informe.html'));
  assert.match(h, /<title>Informe · Mi Libro ñ<\/title>/);
  assert.match(h, /Hay 1 tabla/);
  assert.match(h, /Myriad Pro/);
  assert.match(h, /foto uno\.png/);
  assert.match(h, /imagenes_incrustadas\/embebida\.png/);
  assert.match(h, /PANTONE 185 C/);
  assert.equal((h.match(/<svg /g) || []).length, 3, 'dos pliegos y una maestra');
  assert.ok(!/<script/i.test(h));
  assert.match(h, /transform="rotate\(90 /, 'el texto del lomo aparece girado en el mapa');
  X.parseXml(h.replace(/<!doctype html>/i, '').replace(/<meta[^>]*>/g, ''));
});

test('LEEME: nombres de archivo y pasos', () => {
  const l = text(file('LEEME.txt'));
  assert.match(l, /1_reconstruir_en_CS3\.jsx/);
  assert.match(l, /2_EXPERIMENTAL_documento\.inx/);
  assert.match(l, /Ventana > Automatizacion > Scripts/);
  assert.match(l, /\r\n/);
});

test('colores: conversión aproximada a RGB para el informe', () => {
  const model = I.buildModel(I.readPackage(bytes), { name: 'x' });
  assert.deepEqual(R.swatchRgb(model, 'Black'), [0, 0, 0]);
  assert.deepEqual(R.swatchRgb(model, 'Paper'), [255, 255, 255]);
  assert.deepEqual(R.swatchRgb(model, 'Rojo'), [255, 0, 0]);
  assert.deepEqual(R.swatchRgb(model, 'AzulRGB'), [0, 51, 204]);
  assert.deepEqual(R.swatchRgb(model, 'Rojo 50%'), [255, 128, 128]);
  assert.equal(R.swatchRgb(model, 'None'), null);
});

// ------------------------------------------------------------------ línea de comandos
test('CLI: crea el zip y resume; un .indd da un mensaje claro y código de salida distinto de 0', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-'));
  const input = path.join(dir, 'doc.idml');
  fs.writeFileSync(input, bytes);
  const out = path.join(dir, 'salida.zip');
  const cli = path.join(__dirname, '..', 'src', 'cli.js');
  const ok = spawnSync('node', [cli, input, '-o', out], { encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /3 páginas, 16 objetos, 6 textos, 2 imágenes/);
  execFileSync('unzip', ['-tq', out]);

  const indd = path.join(dir, 'viejo.indd');
  fs.writeFileSync(indd, Buffer.concat([Buffer.from([0x06, 0x06, 0xED, 0xF5, 0xD8, 0x1D, 0x46, 0xE5, 0xBD, 0x31, 0xEF, 0xE7, 0xFE, 0x74, 0xB7, 0x1D]), Buffer.alloc(32)]));
  const bad = spawnSync('node', [cli, indd], { encoding: 'utf8' });
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /exportarlo a IDML/);
});
