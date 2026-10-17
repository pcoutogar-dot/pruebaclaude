'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { buildIdml } = require('./fixture');
const I = require('../src/idml');
const J = require('../src/jsxgen');
const M = require('./mock-indesign');

const DATE = new Date('2026-10-08T00:00:00Z');
const model = I.buildModel(I.readPackage(buildIdml()), { name: 'prueba' });
const evalJs = (src) => JSON.parse(JSON.stringify(vm.runInNewContext('(' + src + ')')));

test('toJs: lo que escribe se lee igual que JSON (anidados, unicode, controles, vacíos, undefined)', () => {
  const casos = [
    { a: 1, b: [1, 2, 3], c: { d: 'x', e: [{ f: 1 }, { g: [] }], h: {} }, i: null, j: true, k: false },
    { s: 'tab\t cr\r lf\n nul\u0000 bell\u0007 esc\u001b del\u007f nbsp      ñandú € 😀' },
    [[1, [2, [3, [4]]]], 'x', null],
    { reservada: { default: 1, class: 2, 'con espacio': 3, 'con"comilla': 4, '': 5 } },
    { grande: 1e21, chico: 1e-7, neg: -3.5, cero: -0 },
  ];
  for (const c of casos) assert.deepEqual(evalJs(J.toJs(c)), JSON.parse(JSON.stringify(c)));
  assert.deepEqual(evalJs(J.toJs({ a: undefined, b: 1, c: () => 1 })), { b: 1 });
  assert.equal(J.toJs(NaN), '0');
  assert.equal(J.toJs(undefined), 'null');
});

test('toJs: los textos largos se trocean sin romper pares subrogados ni secuencias de escape', () => {
  for (const n of [0, 1, 159, 160, 161, 239, 240, 241, 500, 4999]) {
    for (const unit of ['a', '😀', 'ñ\n', '"\\', ' ']) {
      const s = unit.repeat(Math.ceil(n / unit.length)).slice(0, n);
      const lit = J.toJs(s);
      assert.equal(vm.runInNewContext('(' + lit + ')'), s, 'n=' + n + ' unidad=' + JSON.stringify(unit));
      assert.ok(Math.max(...lit.split('\n').map((l) => l.length)) <= 160 * 6 + 40, 'líneas cortas');
    }
  }
  // 😀 repetido: ninguna pieza termina en media pareja
  const lit = J.toJs('😀'.repeat(400));
  for (const piece of JSON.parse('[' + lit.slice(1, lit.indexOf(']')) + ']')) assert.ok(!/[\ud800-\udbff]$/.test(piece));
});

test('el script generado no tiene líneas largas aunque haya un texto enorme', () => {
  const m = I.buildModel(I.readPackage(buildIdml()), { name: 'prueba' });
  const first = m.stories.values().next().value;
  first.text = 'Lorem ipsum dolor sit amet, consectetur ñandú. '.repeat(1200);   // ~56 000 caracteres
  first.pr = [{ s: 0, e: first.text.length, style: null, props: null }];
  first.cr = [];
  const script = J.buildScript(m, { date: DATE });
  const lines = script.split('\n');
  const dataStart = lines.findIndex((l) => l.startsWith('var DATA = '));
  const dataEnd = lines.findIndex((l, i) => i > dataStart && l === '};');
  assert.ok(dataStart > 0 && dataEnd > dataStart);
  assert.ok(dataEnd - dataStart > 100, 'los datos van repartidos en muchas líneas');
  const longest = Math.max(...lines.slice(dataStart, dataEnd + 1).map((l) => l.length));
  assert.ok(longest < 1500, 'la línea más larga de los datos mide ' + longest);
  // y el texto llega entero a InDesign
  const r = M.runJsx(script, { enumStyle: 'camel', vfs: { '/virtual/scripts/reconstruir.jsx': true } });
  assert.equal(r.error, null);
  const main = r.doc.__store.pagesArr.concat(...r.doc.__store.masters.map((x) => x.__pages)).reduce((a, p) => a.concat(p.__items), []).filter((i) => i.__store.story && i.__store.story.text.startsWith('Lorem'));
  assert.equal(main[0].__store.story.text, first.text);
});

test('el DATA del script es exactamente el modelo', () => {
  const script = J.buildScript(model, { date: DATE });
  const start = script.indexOf('var DATA = ') + 'var DATA = '.length;
  const end = script.indexOf('\n};\n', start) + 2;
  const got = evalJs(script.slice(start, end));
  assert.deepEqual(got, JSON.parse(JSON.stringify(J.buildData(model))));
});

test('la cabecera lleva la versión del conversor y el modo paso a paso apagado', () => {
  const script = J.buildScript(model, { date: DATE });
  assert.match(script, /\nvar CONVERTER = "1\.1\.0";\n/);
  assert.match(script, /\nvar DIAG = false;\n/);
  assert.equal(require('../package.json').version, require('../src/version'), 'package.json y src/version.js dicen lo mismo');
});

// ----------------------------------------------------------------------------------------------------------------
// Sintaxis ES3 de verdad: se analiza con el analizador de Node (acorn) en modo ECMAScript 3, sin palabras reservadas
// como nombres, sin comas finales, sin let/const/flechas ni plantillas: lo que entiende ExtendScript de CS3.
const CHECKER = [
  "let acorn; try { acorn = require('internal/deps/acorn/acorn/dist/acorn'); } catch (e) { process.exit(77); }",
  "const src = require('fs').readFileSync(process.argv[1], 'utf8').replace(/^#.*$/gm, (m) => '//' + m.slice(2));",
  "try { acorn.parse(src, { ecmaVersion: 3, allowReserved: 'never', locations: true }); } catch (e) {",
  "  const l = src.split('\\n')[e.loc.line - 1] || '';",
  "  console.log('ES3: ' + e.message + '  [' + l.slice(Math.max(0, e.loc.column - 50), e.loc.column + 50) + ']'); process.exit(1); }",
].join('\n');

function es3(code) {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'es3-')), 'x.jsx');
  fs.writeFileSync(f, code);
  const r = spawnSync(process.execPath, ['--expose-internals', '-e', CHECKER, f], { encoding: 'utf8' });
  return { status: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

const SKIP = es3('var a = 1;').status === 77 ? 'este Node no trae el analizador acorn accesible' : false;

test('ES3 estricto: el script de reconstrucción y la comprobación se analizan como ECMAScript 3', { skip: SKIP }, () => {
  for (const [n, code] of [['reconstrucción', J.buildScript(model, { date: DATE })], ['comprobación', J.buildProbe({ date: DATE })]]) {
    const r = es3(code);
    assert.equal(r.status, 0, n + ': ' + r.out);
  }
});

test('ES3 estricto: el analizador detecta de verdad lo que ExtendScript no entiende', { skip: SKIP }, () => {
  for (const bad of ['var o = { a: 1, };', 'var o = {}; o.default = 1;', 'let x = 1;', 'var f = () => 1;', 'var s = `a`;', 'class A {}']) {
    assert.equal(es3(bad).status, 1, bad);
  }
  assert.equal(es3('var o = { "default": 1 }; o["class"] = 2; var a = [1, 2];').status, 0);
});

test('ES3 estricto: el script sigue siendo ES3 con un modelo grande y raro', { skip: SKIP }, () => {
  const bytes = buildIdml();
  const m = I.buildModel(I.readPackage(bytes), { name: 'a"b\'c\\d\n  ñ 😀' });
  assert.equal(es3(J.buildScript(m, { date: DATE })).status, 0);
});
