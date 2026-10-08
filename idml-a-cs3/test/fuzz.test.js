'use strict';
// Robustez: se estropea el IDML de prueba de muchas formas (atributos que faltan o con basura, elementos
// que desaparecen, partes truncadas) y la conversión nunca debe fallar con una excepción inesperada.
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildParts, pack } = require('./fixture');
const X = require('../src/xml');
const { convert } = require('../src/convert');
const I = require('../src/idml');

function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

function allEls(root) { const out = []; X.walk(root, (e) => out.push(e)); return out; }
const GARBAGE = ['', 'NaN', '-1', '1e999', 'abc', '0 0', '1 2 3', 'n', 'Color/Nada', 'ParagraphStyle/Nada', '  ', '<&>', '9999999999'];

function mutate(parts, r) {
  const names = Object.keys(parts).filter((n) => n.endsWith('.xml') && n !== 'META-INF/container.xml');
  const name = names[Math.floor(r() * names.length)];
  const kind = Math.floor(r() * 6);
  if (kind === 5) { parts[name] = parts[name].slice(0, Math.floor(r() * parts[name].length)); return name + ' truncado'; }
  const root = X.parseXml(parts[name]);
  const els = allEls(root);
  const el = els[Math.floor(r() * els.length)];
  let what = name + ' <' + el.name + '> ';
  if (kind === 0) { const keys = Object.keys(el.attrs); if (keys.length) { const k = keys[Math.floor(r() * keys.length)]; delete el.attrs[k]; what += 'sin ' + k; } }
  else if (kind === 1) { const keys = Object.keys(el.attrs); if (keys.length) { const k = keys[Math.floor(r() * keys.length)]; el.attrs[k] = GARBAGE[Math.floor(r() * GARBAGE.length)]; what += k + '=basura'; } }
  else if (kind === 2) { if (el !== root) { const parent = els.find((p) => p.kids.includes(el)); if (parent) { parent.kids.splice(parent.kids.indexOf(el), 1); what += 'eliminado'; } } }
  else if (kind === 3) { el.kids = []; what += 'vaciado'; }
  else if (kind === 4) { const keys = Object.keys(el.attrs); keys.forEach((k) => { delete el.attrs[k]; }); what += 'sin atributos'; }
  parts[name] = X.serialize(root);
  return what;
}

test('el conversor aguanta IDML estropeados sin excepciones inesperadas', () => {
  const r = rng(20261008);
  const failures = [];
  let converted = 0; let userErrors = 0;
  for (let i = 0; i < 400; i++) {
    const parts = buildParts();
    const n = 1 + Math.floor(r() * 3);
    const log = [];
    try { for (let k = 0; k < n; k++) log.push(mutate(parts, r)); } catch (_) { continue; }
    try {
      const res = convert(pack(parts), { name: 'fuzz.idml', date: new Date('2026-01-01') });
      converted++;
      // el script generado debe seguir siendo JavaScript válido
      const jsx = res.files.find((f) => f.name.endsWith('.jsx')).data;
      new Function(jsx.replace(/^#.*$/gm, '//'));
    } catch (e) {
      if (e instanceof I.UserError) { userErrors++; continue; }
      failures.push(log.join(' + ') + ' => ' + (e.stack || e).toString().split('\n').slice(0, 3).join(' | '));
    }
  }
  assert.deepEqual(failures.slice(0, 8), [], failures.length + ' fallos de ' + 400);
  assert.ok(converted > 300, 'se esperaba convertir la mayoría (' + converted + ', errores de usuario ' + userErrors + ')');
});

test('el script generado a partir de IDML estropeados nunca termina con una excepción sin controlar', () => {
  const M = require('./mock-indesign');
  const r = rng(77);
  const bad = [];
  let ran = 0;
  for (let i = 0; i < 150; i++) {
    const parts = buildParts();
    const log = [];
    try { for (let k = 0; k < 1 + Math.floor(r() * 3); k++) log.push(mutate(parts, r)); } catch (_) { continue; }
    let res;
    try { res = convert(pack(parts), { name: 'fuzz.idml', date: new Date('2026-01-01') }); } catch (e) { continue; }
    const jsx = res.files.find((f) => f.name.endsWith('.jsx')).data;
    const run = M.runJsx(jsx, { enumStyle: i % 2 ? 'upper' : 'camel', cs3: i % 3 === 0, vfs: { '/virtual/scripts/x.jsx': true } });
    ran++;
    if (run.error || run.state.alerts.length !== 1) bad.push(log.join(' + ') + ' => ' + (run.error ? run.error.message : 'alertas: ' + run.state.alerts.length));
  }
  assert.deepEqual(bad.slice(0, 5), []);
  assert.ok(ran > 100);
});
