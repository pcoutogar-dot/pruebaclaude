'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const J = require('../src/jsxgen');
const M = require('./mock-indesign');

const DATE = new Date('2026-10-08T00:00:00Z');
const probe = J.buildProbe({ date: DATE });
const REPORT = '/virtual/desktop/diagnostico_CS3.txt';
const run = (opts, code) => M.runJsx(code || probe, opts);
const report = (r) => r.state.files[REPORT].replace(/\r\n/g, '\n');

test('la comprobación es ASCII puro, ES3 y no usa nada que ExtendScript no tenga', () => {
  assert.equal(/[^\x00-\x7f]/.test(probe), false);
  assert.doesNotThrow(() => new vm.Script(probe.replace(/^#.*$/gm, '//')));
  const body = probe.slice(probe.indexOf('var REPORT = []'));
  for (const bad of ['.forEach(', '.map(', '.filter(', 'Object.keys', 'JSON.', '.trim(', 'Array.isArray', '.reduce(', '.indexOf(', 'let ', 'const ', '=>', '`']) {
    // indexOf solo se permite en cadenas (String.prototype.indexOf existe en ES3); aquí no se usa
    assert.ok(!body.includes(bad), 'aparece ' + bad);
  }
  assert.match(probe, /^#target indesign\n/);
});

test('con un InDesign que lo tiene todo: sin fallos, informe en el Escritorio y documento de prueba cerrado', () => {
  const r = run({ enumStyle: 'camel' });
  assert.equal(r.error, null);
  const rep = report(r);
  assert.match(rep, /^\ufeffCOMPROBACION DE INDESIGN CS3 {3}\(IDML a CS3, version 1\.1\.0\)/);
  assert.match(rep, /RESUMEN: \d+ pruebas, 0 fallos, 0 diferencias previstas/);
  assert.doesNotMatch(rep, /\[FALLA\]/);
  assert.equal(r.state.docs.length, 0, 'el documento de prueba se cierra');
  assert.deepEqual(r.state.closed, ['SaveOptions.No'], 'sin guardar');
  assert.equal(r.state.alerts.length, 1);
  assert.match(r.state.alerts[0], /^Comprobación de CS3 terminada: \d+ pruebas, 0 fallos\./);
  assert.match(r.state.alerts[0], /Informe completo, para enviarlo tal cual: \/virtual\/desktop\/diagnostico_CS3\.txt$/);
  // entorno y datos de fábrica quedan anotados
  assert.match(rep, /\[info\] {3}InDesign: Adobe InDesign 5\.0/);
  assert.match(rep, /\[info\] {3}idioma de InDesign: es_ES/);
  assert.match(rep, /estilos de párrafo de fábrica {3}-> {3}0=\[No paragraph style\], 1=\[Basic Paragraph\]/);
  assert.match(rep, /muestras de fábrica del documento nuevo {3}-> {3}None <Swatch>, Paper <Color>, Black <Color>, Registration <Color>/);
});

test('no toca los documentos del usuario: solo crea y cierra el suyo', () => {
  const r = run({ enumStyle: 'camel' }, 'var USUARIO = app.documents.add();\n' + probe);
  assert.equal(r.error, null);
  assert.equal(r.state.docs.length, 1, 'el documento previo sigue abierto');
  assert.equal(r.state.docs[0], r.doc);
  assert.match(report(r), /documentos abiertos al empezar: 1/);
});

test('con las diferencias de CS3: las que el script ya sortea salen como "distinto", el resto como fallo', () => {
  const r = run({ enumStyle: 'upper', cs3: true });
  assert.equal(r.error, null);
  const rep = report(r);
  assert.match(rep, /\[distinto\] encuadernación \(pageBinding\)/);
  assert.match(rep, /\[distinto\] número de la primera página \(startPageNumber\)/);
  assert.match(rep, /\[distinto\] capa: imprimible \(printable\)/);
  assert.match(rep, /\[distinto\] preferencias del script: unidad de medida \(measurementUnit\) {3}-> .*\(es de CS5\.5 o posterior; en CS3 el script usa las unidades de las reglas del documento\)/);
  assert.match(rep, /carácter de la viñeta {3}-> {3}funciona: bulletChar\.characterType \/ characterValue {6}NO funciona: bulletChar\.bulletCharacterType/);
  assert.doesNotMatch(rep, /\[FALLA\]/, 'nada de lo demás falla en el CS3 simulado');
  assert.match(rep, /crear un tono {3}-> {3}funciona: tints\.add\(color, \{name, tintValue\}\) {6}NO funciona: tints\.add\(\{name, baseColor, tintValue\}\)/);
  assert.match(rep, /esquinas redondeadas {3}-> {3}funciona: cornerOption \+ cornerRadius/);
  assert.match(rep, /ajuste de texto alrededor del objeto {3}-> {3}funciona: textWrapPreferences\.textWrapType \(TextWrapTypes\)/);
  assert.match(rep, /\[no hay\] DocumentPreference: pageBinding, startPageNumber/);
  assert.match(rep, /\[no hay\] Layer: printable/);
  assert.match(rep, /\[no hay\] TextWrapPreference: textWrapMode/);
  assert.match(r.state.alerts[0], /4 diferencias que el script ya sabe sortear/);
  assert.match(r.state.alerts[0], /Propiedades que este InDesign no tiene:/);
});

test('un fallo de verdad (propiedad que no existe en nada) sale como [FALLA] y en el aviso, con el mensaje de InDesign', () => {
  const r = run({ enumStyle: 'camel', rejectProps: ['rotationAngle', 'hyphenation'] });
  const rep = report(r);
  assert.match(rep, /\[FALLA\] {2}estilo de párrafo: guionado {3}-> {3}Object does not support the property or method 'hyphenation'/);
  assert.match(rep, /\[ok\] {5}girar un objeto {3}-> {3}funciona: transform con una matriz {2}; {2}rotate\(\) {6}NO funciona: rotationAngle/);
  assert.match(r.state.alerts[0], /, 1 fallos\./);
  assert.match(r.state.alerts[0], /\[FALLA\] {2}estilo de párrafo: guionado/);
});

test('las constantes que faltan se listan junto a las que sí tiene ese InDesign', () => {
  const code = probe.replace('"ColorSpace":["CMYK","RGB","LAB"]', '"ColorSpace":["CMYK","RGB","LAB","DeviceN"]');
  assert.notEqual(code, probe);
  const r = run({ enumStyle: 'camel' }, code);
  assert.match(report(r), /\[FALLA\] {2}constantes de ColorSpace {3}-> {3}faltan DeviceN {6}las que tiene este InDesign: CMYK, RGB, LAB/);
});

test('constantes con otra grafía (ColorSpace.cmyk) o MAYÚSCULAS: se reconocen igual', () => {
  assert.doesNotMatch(report(run({ enumStyle: 'camel', lowerAcronyms: true })), /\[FALLA\]/);
  assert.doesNotMatch(report(run({ enumStyle: 'upper' })), /\[FALLA\]/);
});

test('si el informe no se puede escribir, el aviso lo dice; sin Escritorio va junto al script', () => {
  const r = run({ enumStyle: 'camel', rejectFileWrite: true });
  assert.equal(r.error, null);
  assert.match(r.state.alerts[0], /No se pudo guardar el informe en el Escritorio\.$/);
  const r2 = run({ enumStyle: 'camel', noDesktop: true });
  assert.match(r2.state.files['/virtual/scripts/diagnostico_CS3.txt'], /RESUMEN: /);
});

test('si cerrar el documento de prueba falla, lo avisa para que se cierre a mano', () => {
  const r = run({ enumStyle: 'camel', rejectProps: ['close'] });
  assert.match(report(r), /\[FALLA\] {2}cerrar el documento de prueba sin guardarlo/);
  assert.match(report(r), /ATENCION: no se pudo cerrar el documento de prueba/);
});

test('un error inesperado dentro de las pruebas no impide escribir el informe', () => {
  const roto = probe.replace('function docChecks() {', 'function docChecks() { throw new Error("explotó"); ');
  const r = run({ enumStyle: 'camel' }, roto);
  assert.equal(r.error, null);
  assert.match(report(r), /\[FALLA\] {2}error inesperado durante las pruebas {3}-> {3}explotó/);
  assert.equal(r.state.docs.length, 0, 'aun así se cierra el documento de prueba');
});

test('el PNG de prueba es un PNG válido', () => {
  const zlib = require('node:zlib');
  const { crc32 } = require('../src/zip');
  const b = Buffer.from(J.tinyPngBytes());
  assert.deepEqual(Array.from(b.slice(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
  let off = 8; const types = []; let raw = null;
  while (off < b.length) {
    const len = b.readUInt32BE(off); const type = b.toString('ascii', off + 4, off + 8); const data = b.slice(off + 8, off + 8 + len);
    assert.equal(b.readUInt32BE(off + 8 + len), crc32(Uint8Array.from(Buffer.concat([Buffer.from(type), data]))), 'CRC de ' + type);
    if (type === 'IDAT') raw = zlib.inflateSync(data);
    types.push(type); off += 12 + len;
  }
  assert.deepEqual(types, ['IHDR', 'IDAT', 'IEND']);
  assert.deepEqual(Array.from(raw), [0, 255, 0, 0, 0, 255, 0, 0, 0, 0, 255, 255, 255, 0]);
});
