'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const zlib = require('node:zlib');
const { readZip, writeZip, crc32, inflateRaw } = require('../src/zip');
const X = require('../src/xml');

function sampleBytes(n) {
  // texto repetitivo + algo de ruido para que deflate use bloques dinámicos
  const words = ['InDesign', 'párrafo', 'estilo', 'ñandú', 'CS3', 'IDML', 'marco', '12', 'Content'];
  let s = '';
  let seed = 12345;
  while (s.length < n) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; s += words[seed % words.length] + ' '; }
  return Buffer.from(s, 'utf8');
}

test('inflate propio coincide con zlib (niveles 0, 1, 6, 9 y bloque fijo)', () => {
  const data = sampleBytes(200000);
  const cases = [
    zlib.deflateRawSync(data, { level: 0 }),
    zlib.deflateRawSync(data, { level: 1 }),
    zlib.deflateRawSync(data, { level: 6 }),
    zlib.deflateRawSync(data, { level: 9 }),
    zlib.deflateRawSync(Buffer.from('hola'), { strategy: zlib.constants.Z_FIXED }),
    zlib.deflateRawSync(Buffer.alloc(0)),
  ];
  const expected = [data, data, data, data, Buffer.from('hola'), Buffer.alloc(0)];
  cases.forEach((c, i) => {
    const out = inflateRaw(new Uint8Array(c), 0, { native: false });
    assert.equal(Buffer.compare(Buffer.from(out), expected[i]), 0, 'caso ' + i);
  });
});

test('crc32 conocido', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xCBF43926);
});

test('writeZip genera un ZIP válido para unzip y readZip lo relee', () => {
  const files = [
    { name: 'a.txt', data: 'hola ñandú' },
    { name: 'carpeta/b.bin', data: new Uint8Array([0, 1, 2, 255]) },
    { name: 'vacío.txt', data: '' },
  ];
  const z = writeZip(files);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zt-'));
  const f = path.join(dir, 't.zip');
  fs.writeFileSync(f, z);
  execFileSync('unzip', ['-tq', f]);
  const r = readZip(z, { native: false });
  assert.deepEqual(r.names, ['a.txt', 'carpeta/b.bin', 'vacío.txt']);
  assert.equal(Buffer.from(r.get('a.txt')).toString('utf8'), 'hola ñandú');
  assert.deepEqual(Array.from(r.get('carpeta/b.bin')), [0, 1, 2, 255]);
});

test('readZip lee ZIP comprimidos por la herramienta zip (deflate) con inflate propio', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zt-'));
  const src = path.join(dir, 'src'); fs.mkdirSync(src);
  fs.writeFileSync(path.join(src, 'mimetype'), 'application/vnd.adobe.indesign-idml-package');
  fs.writeFileSync(path.join(src, 'grande.xml'), sampleBytes(300000));
  const out = path.join(dir, 'x.zip');
  execFileSync('zip', ['-q', '-X', '-0', out, 'mimetype'], { cwd: src });
  execFileSync('zip', ['-q', '-X', '-9', out, 'grande.xml'], { cwd: src });
  const r = readZip(new Uint8Array(fs.readFileSync(out)), { native: false });
  assert.equal(Buffer.from(r.get('mimetype')).toString(), 'application/vnd.adobe.indesign-idml-package');
  assert.equal(Buffer.compare(Buffer.from(r.get('grande.xml')), fs.readFileSync(path.join(src, 'grande.xml'))), 0);
});

test('readZip rechaza lo que no es un ZIP', () => {
  assert.throws(() => readZip(new Uint8Array([1, 2, 3, 4, 5])), /ZIP/);
});

test('XML: atributos, entidades, CDATA, PI y espacios', () => {
  const root = X.parseXml('<?xml version="1.0"?>\n<?aid style="50"?>\n<a x="1&amp;2" y=\'q"q\'>\n  <b/>\n  <Content>  hola &lt;x&gt; &#x2028; &#241;<?ACE 18?>fin<![CDATA[<raw>]]></Content>\n  <!-- c -->\n</a>');
  assert.equal(root.name, 'a');
  assert.equal(root.attrs.x, '1&2');
  assert.equal(root.attrs.y, 'q"q');
  assert.equal(X.kidsEl(root).length, 2);
  const c = X.firstEl(root, 'Content');
  assert.equal(c.kids[0].text, '  hola <x>   ñ');
  assert.equal(c.kids[1].pi, 'ACE');
  assert.equal(c.kids[1].data, '18');
  assert.equal(c.kids[2].text, 'fin<raw>');
});

test('XML: error en etiquetas mal cerradas', () => {
  assert.throws(() => X.parseXml('<a><b></a>'), /XML/);
  assert.throws(() => X.parseXml('<a>'), /XML/);
});

test('XML: serializar y volver a leer conserva la estructura', () => {
  const src = '<D v="1"><S a="&quot;q&quot;&#xA;"><Content>a &amp; b<?ACE 18?></Content><Br/></S></D>';
  const root = X.parseXml(src);
  const again = X.parseXml(X.serialize(root));
  assert.equal(again.kids[0].attrs.a, '"q"\n');
  assert.equal(X.textOf(X.firstEl(again.kids[0], 'Content')), 'a & b');
  assert.equal(X.firstEl(again.kids[0], 'Content').kids[1].pi, 'ACE');
});
