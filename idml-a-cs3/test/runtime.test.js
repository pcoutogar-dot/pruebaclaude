'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { buildIdml, buildIdmlWith } = require('./fixture');
const I = require('../src/idml');
const J = require('../src/jsxgen');
const M = require('./mock-indesign');

const build = (bytes) => I.buildModel(I.readPackage(bytes), { name: 'prueba' });
const model = build(buildIdml());
const script = J.buildScript(model, { date: new Date('2026-10-08T00:00:00Z') });
const VFS = {
  '/virtual/scripts/reconstruir.jsx': true,
  '/virtual/scripts/foto uno.png': true,
  '/virtual/scripts/imagenes_incrustadas/embebida.png': true,
};
const run = (opts, code) => M.runJsx(code || script, Object.assign({ vfs: VFS }, opts));
const framesOf = (r) => r.doc.__store.pagesArr.concat(...r.doc.__store.masters.map((m) => m.__pages)).reduce((a, p) => a.concat(p.__items), []);
const textFrames = (r) => framesOf(r).filter((i) => i.__store.kind === 'text' && i.__store.story);

test('el script es ASCII puro y sintácticamente válido (ES3)', () => {
  assert.equal(/[^\x00-\x7f]/.test(script), false);
  assert.doesNotThrow(() => new vm.Script(script.replace(/^#.*$/gm, '//')));
  assert.ok(!/\b(let|const)\s|=>|`/.test(script.slice(script.indexOf('// =====', 400))), 'sin let/const/flechas/plantillas en el código que corre en CS3');
});

test('el script no usa funciones que ExtendScript (ES3) no tiene', () => {
  const body = script.slice(script.indexOf('var LOG = []'));
  for (const bad of ['.forEach(', '.map(', '.filter(', 'Object.keys', 'JSON.', '.trim(', 'Array.isArray', '.reduce(', '.some(', '.every(', 'String.prototype']) {
    assert.ok(!body.includes(bad), 'aparece ' + bad);
  }
});

test('CS3 (constantes en camelCase): crea el documento completo', () => {
  const r = run({ enumStyle: 'camel' });
  assert.equal(r.error, null);
  assert.equal(r.state.alerts.length, 1);
  assert.match(r.state.alerts[0], /^Documento reconstruido: 3 páginas, 15 objetos, 6 textos, 2 imágenes, 1 tablas\./);
  assert.doesNotMatch(r.state.alerts[0], /NO ESTÁN|NO ENCONTRADAS|no aceptó/);
  const s = M.snapshot(r.doc);

  assert.deepEqual(s.prefs, { w: 612, h: 792, facing: true, units: 'MeasurementUnits.Millimeters', origin: 'RulerOrigin.SpreadOrigin' });
  assert.deepEqual(s.layers, [{ name: 'Capa 1', visible: true, locked: false }, { name: 'Fondo', visible: true, locked: true }]);
  assert.deepEqual(s.grid, { start: 36, division: 12.5 });
  assert.deepEqual(s.colors.map((c) => c.name), ['Rojo', 'AzulRGB', 'PANTONE 185 C', 'C=15 M=100 Y=100 K=0']);
  assert.equal(s.colors[1].space, 'ColorSpace.RGB');
  assert.equal(s.colors[2].model, 'ColorModel.Spot');
  assert.deepEqual(s.tints, [{ name: 'Rojo 50%', base: 'Rojo', v: 50 }]);
  assert.deepEqual(s.gradients[0].stops, [['Rojo', 0], ['AzulRGB', 100]]);

  const ps = Object.fromEntries(s.pstyles.map((x) => [x.name, x]));
  assert.deepEqual(Object.keys(ps), ['[No paragraph style]', '[Basic Paragraph]', 'Titulo', 'Cuerpo', 'Precio']);
  assert.equal(ps.Titulo.basedOn, '[Basic Paragraph]');
  assert.equal(ps.Titulo.next, 'Cuerpo');
  assert.equal(ps.Titulo.props.pointSize, 24);
  assert.equal(ps.Titulo.props.appliedFont, 'font:Myriad Pro\tBold');
  assert.equal(ps.Titulo.props.fontStyle, 'Bold');
  assert.equal(ps.Titulo.props.leading, 28);
  assert.equal(ps.Titulo.props.fillColor, 'obj:Rojo');
  assert.equal(ps['[Basic Paragraph]'].props.pointSize, 12, 'el estilo básico recibe las propiedades del NormalParagraphStyle');
  assert.equal(ps.Precio.basedOn, 'Cuerpo');
  assert.equal(ps.Precio.tabs.length, 1);
  assert.equal(ps.Precio.tabs[0].position, 200);
  assert.deepEqual(s.cstyles.map((x) => x.name), ['[No character style]', 'Negrita', 'Resaltado']);
  assert.equal(s.cstyles[2].props.capitalization, 'Capitalization.AllCaps');

  // maestra y páginas
  assert.equal(s.masters.length, 1);
  assert.equal(s.masters[0].name, 'A-Master');
  assert.deepEqual(s.masters[0].pages.map((p) => p.items.map((i) => i.bounds)), [[[740, 36, 760, 100]], [[740, 1124, 760, 1188], [0, 612, 12, 1224]]]);
  assert.deepEqual(s.pages.map((p) => p.spreadPages), [1, 2, 2]);
  assert.deepEqual(s.pages.map((p) => p.master), ['A-Master', 'A-Master', 'A-Master']);
  assert.deepEqual(s.pages[2].margins, [40, 30, 50, 44, 2, 14]);

  // objetos
  assert.deepEqual(s.pages[0].items.map((i) => [i.kind, i.bounds]), [['text', [36, 36, 400, 576]], ['rect', [420, 36, 520, 236]]]);
  assert.equal(s.pages[0].items[0].layer, 'Capa 1');
  const p2 = s.pages[1].items.map((i) => i.kind);
  assert.deepEqual(p2, ['text', 'text', 'oval', 'poly', 'line', 'group']);
  assert.deepEqual(s.pages[1].items[3].path, [[100, 600], [200, 600], [150, 520]]);
  assert.equal(s.pages[1].items[4].open, true);
  assert.deepEqual(s.pages[1].items[5].kids.map((k) => k.bounds), [[610, 410, 660, 460], [610, 470, 660, 520]]);
  const p3 = s.pages[2].items;
  assert.equal(p3[0].removed, true, 'el objeto de la maestra sustituido en esa página se retira');
  const spine = p3.find((i) => i.rot);
  assert.deepEqual([spine.bounds, spine.rot], [[276, 742, 316, 1042], -90]);
  assert.equal(spine.fill, 'Rojo');
  assert.equal(spine.fillTint, 50);
  const rr = s.pages[0].items[1];
  assert.equal(rr.topLeftCornerOption, 'CornerOptions.RoundedCorner');
  assert.equal(rr.topLeftCornerRadius, 8);
});

test('CS3: el texto principal queda en los dos marcos enlazados con su formato', () => {
  const r = run({ enumStyle: 'camel' });
  const frames = textFrames(r);
  const main = frames.find((f) => f.__store.story.text.startsWith('Título'));
  const st = M.storyOf(main);
  assert.equal(st.text.length, 224);
  assert.equal(main.__store.next.__self, main.__store.story.frames[1].__self);
  assert.equal(main.__store.story.frames.length, 2);
  assert.equal(st.paras[0], 'Titulo');
  assert.equal(st.paras[30], 'Cuerpo');
  assert.equal(st.paras[185], 'Precio');
  assert.equal(st.cstyles[42], 'Negrita');
  assert.equal(st.cstyles[92], 'Resaltado');
  assert.equal(st.props[140].pointSize, 14);
  assert.equal(st.props[140].appliedFont, 'font:Myriad Pro\tRegular');
  assert.equal(st.props[140].justification, 'Justification.CenterAlign', 'anulación de párrafo aplicada al rango');
  assert.equal(st.props[170].position, 'Position.Superscript');
  assert.equal(st.props[170].fontStyle, 'Italic');
});

test('CS3: página, número de página (marcador especial) y tabla', () => {
  const r = run({ enumStyle: 'camel' });
  const frames = textFrames(r);
  const texts = frames.map((f) => f.__store.story.text);
  assert.ok(texts.includes('\u0018'), 'número de página en la maestra');
  assert.ok(texts.includes('Pág. \u0018'));
  const tf = frames.find((f) => f.__store.story.tables.length);
  const t = tf.__store.story.tables[0];
  assert.equal(t.pos, 0);
  assert.deepEqual([t.table.rowsN, t.table.colsN], [2, 2]);
  assert.deepEqual(Array.from({ length: 4 }, (_, i) => t.table.cells.item(i).contents), ['A1', 'B1', 'A2', 'B2']);
  assert.equal(t.table.columns.item(1).width, 200);
  assert.equal(t.table.rows.item(1).height, 30);
  assert.equal(t.table.cells.item(1).fillColor.name, 'Rojo');
});

test('CS3: coloca las imágenes (por ruta original o buscándolas en la carpeta del script)', () => {
  const r = run({ enumStyle: 'camel' });
  assert.deepEqual(r.state.placed.map((p) => p.file), ['/virtual/scripts/foto uno.png', '/virtual/scripts/imagenes_incrustadas/embebida.png']);
  const s = M.snapshot(r.doc);
  assert.deepEqual(s.pages[0].items[1].graphic.bounds, [420, 36, 520, 236]);
  assert.deepEqual(s.pages[2].items.find((i) => i.graphic).graphic.bounds, [425, 912, 625, 1112]);
  assert.equal(r.state.confirms.length, 0);
});

test('CS6 (constantes en MAYÚSCULAS) da exactamente el mismo documento', () => {
  const a = M.snapshot(run({ enumStyle: 'camel' }).doc);
  const rb = run({ enumStyle: 'upper' });
  assert.equal(rb.error, null);
  assert.deepEqual(M.snapshot(rb.doc), a);
});

test('imágenes que no están: pregunta por la carpeta, deja el marco vacío y lo cuenta', () => {
  const r = run({ enumStyle: 'camel', vfs: { '/virtual/scripts/reconstruir.jsx': true }, confirmYes: false });
  assert.equal(r.error, null);
  assert.equal(r.state.confirms.length, 1);
  assert.match(r.state.confirms[0], /No se encuentran 2 de 2 imágenes/);
  assert.equal(r.state.placed.length, 0);
  assert.match(r.state.alerts[0], /IMÁGENES NO ENCONTRADAS \(marcos vacíos\): foto uno\.png, embebida\.png/);
  const rect = framesOf(r).find((i) => i.__store.label === 'FALTA: foto uno.png');
  assert.ok(rect);
});

test('imágenes que no están pero el usuario elige la carpeta correcta', () => {
  const vfs = { '/virtual/scripts/reconstruir.jsx': true, '/virtual/fotos/sub/Foto Uno.PNG': true, '/virtual/fotos/embebida.png': true };
  const r = run({ enumStyle: 'camel', vfs, confirmYes: true, pickFolder: '/virtual/fotos' });
  assert.equal(r.state.dialogs.length, 1);
  assert.deepEqual(r.state.placed.map((p) => p.file), ['/virtual/fotos/sub/Foto Uno.PNG', '/virtual/fotos/embebida.png']);
  assert.doesNotMatch(r.state.alerts[0], /NO ENCONTRADAS/);
});

test('fuentes que no están instaladas: se avisa y se pueden sustituir', () => {
  const fonts = [['Minion Pro', 'Regular'], ['Arial', 'Regular'], ['Arial', 'Bold']];
  const r = run({ enumStyle: 'camel', fonts });
  assert.match(r.state.alerts[0], /FUENTES QUE NO ESTÁN INSTALADAS en este ordenador \(se usó otra\): Myriad Pro/);
  const sub = script.replace('var FONT_SUBSTITUTIONS = {};', 'var FONT_SUBSTITUTIONS = {"Myriad Pro": "Arial"};');
  const r2 = run({ enumStyle: 'camel', fonts }, sub);
  assert.doesNotMatch(r2.state.alerts[0], /NO ESTÁN INSTALADAS/);
  const s = M.snapshot(r2.doc);
  assert.equal(s.pstyles.find((x) => x.name === 'Titulo').props.appliedFont, 'font:Arial\tBold');
});

test('propiedades que CS3 no tiene: el script sigue y las lista al final', () => {
  const r = run({ enumStyle: 'camel', rejectProps: ['hyphenation', 'topLeftCornerRadius'] });
  assert.equal(r.error, null);
  assert.match(r.state.alerts[0], /CS3 no aceptó algunas propiedades: .*estilo\.hyphenation x1/);
  assert.match(r.state.alerts[0], /objeto\.topLeftCornerRadius x1/);
  assert.match(r.state.alerts[0], /^Documento reconstruido: 3 páginas, 15 objetos/);
});

test('rotación: si CS3 no deja fijar rotationAngle usa la matriz de transformación', () => {
  const r = run({ enumStyle: 'camel', rejectProps: ['rotationAngle'] });
  assert.equal(r.error, null);
  const spine = framesOf(r).find((i) => i.__store.kind === 'text' && i.__store.story && i.__store.story.text === 'LOMO');
  assert.equal(spine.__store.transformed, true);
  assert.doesNotMatch(r.state.alerts[0], /rotación/);
});

test('trazados: si CS3 no deja fijar entirePath se anota y se sigue', () => {
  const r = run({ enumStyle: 'camel', rejectProps: ['entirePath'] });
  assert.equal(r.error, null);
  assert.match(r.state.alerts[0], /objeto\.trazado x2/);
});

test('se registra el resultado en un archivo junto al script', () => {
  const r = run({ enumStyle: 'camel' });
  assert.match(r.state.logFile, /^\ufeffDocumento reconstruido/);
});

test('CS3 estricto: esquinas, ajuste de texto, tonos y numeración con las diferencias propias de CS3', () => {
  const bytes = buildIdmlWith((p) => { p['designmap.xml'] = p['designmap.xml'].replace('PageNumberStart="1"', 'PageNumberStart="5"'); });
  const sc = J.buildScript(build(bytes), { date: new Date('2026-10-08T00:00:00Z') });
  const r = M.runJsx(sc, { enumStyle: 'upper', cs3: true, vfs: VFS });
  assert.equal(r.error, null);
  assert.doesNotMatch(r.state.alerts[0], /no aceptó|ERROR/);
  const s = M.snapshot(r.doc);
  assert.deepEqual(s.tints, [{ name: 'Rojo 50%', base: 'Rojo', v: 50 }]);
  const rr = s.pages[0].items[1];
  assert.equal(rr.cornerOption, 'CornerOptions.RoundedCorner');
  assert.equal(rr.cornerRadius, 8);
  assert.equal(rr.topLeftCornerOption, undefined);
  assert.deepEqual(s.pages[0].items[0].wrap, { textWrapType: 'TextWrapTypes.BoundingBoxTextWrap', textWrapSide: 'TextWrapSideOptions.BothSides', textWrapOffset: [3, 4, 5, 6] });
  assert.deepEqual(s.section, { start: 5, cont: false });
  assert.equal(s.pages[0].items[0].tfp.insetSpacing.join(), '6,5,4,3');
});

test('CS3 estricto: si hay encuadernación de derecha a izquierda se avisa (CS3 no deja fijarla)', () => {
  const bytes = buildIdmlWith((p) => { p['Resources/Preferences.xml'] = p['Resources/Preferences.xml'].replace('PageBinding="LeftToRight"', 'PageBinding="RightToLeft"'); });
  const r = M.runJsx(J.buildScript(build(bytes)), { enumStyle: 'upper', cs3: true, vfs: VFS });
  assert.match(r.state.alerts[0], /encuadernación de derecha a izquierda/);
});

test('filetes y viñetas de los estilos de párrafo llegan a CS3', () => {
  const bytes = buildIdmlWith((p) => {
    p['Resources/Styles.xml'] = p['Resources/Styles.xml'].replace('KeepWithNext="1" Hyphenation="true">',
      'KeepWithNext="1" Hyphenation="true" RuleBelow="true" RuleBelowLineWeight="0.5" RuleBelowOffset="3" RuleBelowColor="Color/Rojo" RuleBelowWidth="ColumnWidth" BulletsAndNumberingListType="BulletList" BulletsTextAfter="^t">')
      .replace('<Leading type="unit">12.5</Leading>', '<Leading type="unit">12.5</Leading><BulletChar BulletCharacterType="UnicodeOnly" BulletCharacterValue="8226"/>');
  });
  const m = build(bytes);
  const warns = m.warnings.map((w) => w.text).join('\n');
  assert.doesNotMatch(warns, /filete|viñetas/);
  const r = run({ enumStyle: 'camel' }, J.buildScript(m, { date: new Date('2026-10-08T00:00:00Z') }));
  assert.equal(r.error, null);
  const cuerpo = M.snapshot(r.doc).pstyles.find((x) => x.name === 'Cuerpo');
  assert.equal(cuerpo.props.ruleBelow, true);
  assert.equal(cuerpo.props.ruleBelowLineWeight, 0.5);
  assert.equal(cuerpo.props.ruleBelowColor, 'obj:Rojo');
  assert.equal(cuerpo.props.ruleBelowWidth, 'RuleWidth.ColumnWidth');
  assert.equal(cuerpo.props.bulletsAndNumberingListType, 'ListType.BulletList');
  assert.equal(cuerpo.props.bulletsTextAfter, '^t');
  assert.deepEqual(cuerpo.props.bulletChar, { type: 'BulletCharacterType.UnicodeOnly', value: 8226 });
  assert.doesNotMatch(r.state.alerts[0], /no aceptó/);
});

test('numeración automática: se avisa de que no se recrea', () => {
  const m = build(buildIdmlWith((p) => {
    p['Resources/Styles.xml'] = p['Resources/Styles.xml'].replace('KeepWithNext="1" Hyphenation="true">', 'KeepWithNext="1" Hyphenation="true" BulletsAndNumberingListType="NumberedList">');
  }));
  assert.match(m.warnings.map((w) => w.text).join('\n'), /numeración automática/);
});

test('alternativas si CS3 no acepta la forma habitual: add() sin argumentos, contents del marco y métodos de estilo', () => {
  const normal = M.snapshot(run({ enumStyle: 'camel' }).doc);
  const r = run({ enumStyle: 'camel', noShorthandAdd: true, rejectStoryContents: true, rejectProps: ['appliedParagraphStyle', 'appliedCharacterStyle'] });
  assert.equal(r.error, null);
  assert.doesNotMatch(r.state.alerts[0], /no aceptó|No se pudo rellenar/);
  assert.deepEqual(M.snapshot(r.doc), normal);
  const main = textFrames(r).find((f) => f.__store.story.text.startsWith('Título'));
  const st = M.storyOf(main);
  assert.equal(st.paras[0], 'Titulo');
  assert.equal(st.cstyles[42], 'Negrita');
});
