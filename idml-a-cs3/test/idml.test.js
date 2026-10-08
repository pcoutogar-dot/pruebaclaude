'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildIdml, buildIdmlWith, rectPath, part, story, psr, csr, content } = require('./fixture');
const I = require('../src/idml');
const { writeZip } = require('../src/zip');

const load = (bytes, name) => I.buildModel(I.readPackage(bytes), { name: name || 'prueba' });
const model = load(buildIdml());
const allItems = (arr) => arr.reduce((o, it) => o.concat(it, it.kids ? allItems(it.kids) : []), []);
const item = (id) => allItems(model.spreads.concat(model.masters).reduce((a, s) => a.concat(s.items), [])).find((i) => i.id === id);

test('documento: tamaño, caras enfrentadas, sangrado, unidades y numeración', () => {
  assert.equal(model.doc.width, 612);
  assert.equal(model.doc.height, 792);
  assert.equal(model.doc.facing, true);
  assert.equal(model.doc.bleed.top, 8.5);
  assert.equal(model.doc.slug.bottom, 28.35);
  assert.deepEqual(model.doc.units, { h: 'Millimeters', v: 'Millimeters' });
  assert.equal(model.doc.startPage, 1);
  assert.equal(model.domVersion, '8.0');
  assert.deepEqual(model.stats, { pages: 3, spreads: 2, masters: 1, items: 16, stories: 6, images: 2, embedded: 1, fonts: 2, pstyles: 5, cstyles: 3, colors: 6 });
});

test('páginas y pliegos: posiciones y márgenes', () => {
  assert.deepEqual(model.spreads.map((s) => s.pages.map((p) => p.label)), [['1'], ['2', '3']]);
  const p = model.pages;
  assert.deepEqual(p.map((x) => x.index), [0, 1, 2]);
  assert.deepEqual([p[1].x, p[2].x], [0, 612]);
  assert.equal(p[0].master, 'ud6');
  assert.deepEqual(p[2].overrides, ['umf2']);
  assert.deepEqual(p[2].margins, { top: 40, bottom: 30, left: 50, right: 44, columns: 2, gutter: 14 });
  assert.equal(model.masters[0].name, 'A-Master');
  assert.equal(model.masters[0].prefix, 'A');
  assert.equal(model.masters[0].pages.length, 2);
});

test('capas, colores, tonos y degradados', () => {
  assert.deepEqual(model.layers.map((l) => [l.id, l.name, l.visible, l.locked]), [['ub7', 'Capa 1', true, false], ['ub8', 'Fondo', true, true]]);
  const byName = Object.fromEntries(model.colors.map((c) => [c.name, c]));
  assert.deepEqual(Object.keys(byName), ['Rojo', 'AzulRGB', 'PANTONE 185 C', 'C=15 M=100 Y=100 K=0']);
  assert.deepEqual(byName.Rojo.value, [0, 100, 100, 0]);
  assert.equal(byName.AzulRGB.space, 'RGB');
  assert.equal(byName['PANTONE 185 C'].model, 'Spot');
  assert.deepEqual(model.tints, [{ name: 'Rojo 50%', base: 'Rojo', value: 50 }]);
  assert.equal(model.gradients[0].name, 'Degradado');
  assert.deepEqual(model.gradients[0].stops.map((s) => [s.color, s.location]), [['Rojo', 0], ['AzulRGB', 100]]);
});

test('estilos de párrafo y de carácter', () => {
  const ps = Object.fromEntries(model.pstyles.map((s) => [s.name, s]));
  assert.equal(ps['[No paragraph style]'].builtin, 'none');
  assert.equal(ps.NormalParagraphStyle.builtin, 'basic');
  assert.equal(ps.Titulo.basedOn, 'ParagraphStyle/$ID/NormalParagraphStyle');
  assert.equal(ps.Titulo.next, 'ParagraphStyle/Cuerpo');
  assert.deepEqual(ps.Titulo.props.justification, ['e', 'Justification', 'CenterAlign']);
  assert.deepEqual(ps.Titulo.props.fillColor, ['sw', 'Rojo']);
  assert.equal(ps.Titulo.props.leading, 28);
  assert.equal(ps.Titulo.props.appliedFont, 'Myriad Pro');
  assert.deepEqual(ps.NormalParagraphStyle.props.leading, ['e', 'Leading', 'Auto']);
  assert.deepEqual(ps.Precio.path, ['Notas']);
  assert.equal(ps.Precio.basedOn, 'ParagraphStyle/Cuerpo');
  assert.deepEqual(ps.Precio.props.tabStops, [{ position: 200, alignment: 'RightAlign', leader: '.', alignmentCharacter: '.' }]);
  const cs = Object.fromEntries(model.cstyles.map((s) => [s.name, s]));
  assert.equal(cs.Negrita.props.fontStyle, 'Bold');
  assert.equal(cs.Resaltado.props.underline, true);
  assert.deepEqual(cs.Resaltado.props.capitalization, ['e', 'Capitalization', 'AllCaps']);
});

test('fuentes usadas (y estado en el original)', () => {
  assert.deepEqual(model.fonts.map((f) => f.family), ['Minion Pro', 'Myriad Pro']);
  assert.ok(model.fonts[1].styles.includes('Bold'));
});

test('geometría: marco de texto normal con columnas, márgenes internos y ajuste de texto', () => {
  const t = item('ut1');
  assert.deepEqual(t.g, { m: 'b', b: [36, 36, 400, 576] });
  assert.equal(t.p, 0);
  assert.equal(t.tfp.textColumnCount, 2);
  assert.deepEqual(t.tfp.insetSpacing, [6, 5, 4, 3]);
  assert.deepEqual(t.tfp.verticalJustification, ['e', 'VerticalJustification', 'TopAlign']);
  assert.deepEqual(t.wrap.textWrapOffset, [3, 4, 5, 6]);
  assert.deepEqual(t.wrap.textWrapMode, ['e', 'TextWrapModes', 'BoundingBoxTextWrap']);
  assert.deepEqual(t.props.strokeColor, ['sw', 'Black']);
  assert.equal(t.props.strokeWeight, 0.5);
  assert.equal(t.layer, 'ub7');
});

test('geometría: página derecha del pliego, texto girado 90° y objetos de la maestra', () => {
  assert.deepEqual(item('ut3').g, { m: 'b', b: [276, 742, 316, 1042], r: -90 });
  assert.equal(item('ut3').p, 1);
  assert.deepEqual(item('umf2').g.b, [740, 1124, 760, 1188]);
  assert.equal(item('umf2').p, 1);
  assert.deepEqual(item('umf1').g.b, [740, 36, 760, 100]);
  assert.deepEqual(item('umr1').props.fillTint, 20);
});

test('geometría: óvalo, polígono, línea y grupo con transformación', () => {
  assert.deepEqual(item('uo1').g.b, [470, 340, 530, 460]);
  assert.equal(item('uo1').g.m, 'b');
  assert.deepEqual(item('up_tri').g.pts, [[100, 600], [200, 600], [150, 520]]);
  assert.equal(item('up_tri').g.open, false);
  assert.equal(item('ul1').g.open, true);
  assert.deepEqual(item('ul1').g.pts, [[40, 650], [300, 660]]);
  assert.equal(item('ul1').props.strokeWeight, 3);
  assert.deepEqual(item('ur3').g.b, [610, 410, 660, 460]);
  assert.deepEqual(item('ur4').g.b, [610, 470, 660, 520]);
  assert.equal(item('ug1').kids.length, 2);
});

test('colores de objeto: tono, degradado y sin contorno por omisión', () => {
  assert.deepEqual(item('uo1').props.fillColor, ['sw', 'Rojo 50%']);
  assert.deepEqual(item('up_tri').props.fillColor, ['sw', 'Degradado']);
  assert.deepEqual(item('ur1').props.topLeftCornerOption, ['e', 'CornerOptions', 'RoundedCorner']);
  assert.equal(item('ur1').props.topLeftCornerRadius, 8);
});

test('imágenes: ruta decodificada, posición del gráfico y extracción de la incrustada', () => {
  const a = item('ur1').img;
  assert.equal(a.uri, 'C:/Users/Ana/Documents/Mi carpeta/foto uno.png');
  assert.equal(a.name, 'foto uno.png');
  assert.deepEqual(a.b, [420, 36, 520, 236]);
  const b = item('ur2').img;
  assert.equal(b.embedded, true);
  assert.equal(b.saved, 'embebida.png');
  assert.deepEqual(b.b, [425, 912, 625, 1112]);          // el gráfico sobresale del marco: se recorta
  assert.equal(model.embedded.length, 1);
  assert.deepEqual(Array.from(model.embedded[0].bytes.slice(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
});

test('textos: contenido, párrafos y marcadores especiales', () => {
  const s = model.stories.get('u1f3');
  assert.equal(s.text.split('\r').length, 6);
  assert.ok(s.text.startsWith('Título de prueba ñandú\rTexto normal con negrita y un salto\u2028forzado, tab\tcon tabulación'));
  assert.ok(s.text.endsWith('Último párrafo, sin salto final.'));
  assert.deepEqual(s.frames, ['ut1', 'ut2']);
  assert.equal(model.stories.get('u3b2').text, '\u0018');
  assert.equal(model.stories.get('u5d1').text, 'Pág. \u0018');
});

test('textos: rangos de párrafo y de carácter con sus anulaciones locales', () => {
  const s = model.stories.get('u1f3');
  assert.deepEqual(s.pr.map((r) => [r.s, r.e, r.style]), [
    [0, 23, 'ParagraphStyle/Titulo'], [23, 131, 'ParagraphStyle/Cuerpo'], [131, 181, 'ParagraphStyle/Cuerpo'],
    [181, 191, 'ParagraphStyle/Notas%3aPrecio'], [191, 192, 'ParagraphStyle/Cuerpo'], [192, 224, 'ParagraphStyle/Cuerpo']]);
  assert.deepEqual(s.pr[2].props, { justification: ['e', 'Justification', 'CenterAlign'], spaceBefore: 6 });
  const neg = s.cr.find((r) => r.style === 'CharacterStyle/Negrita');
  assert.equal(s.text.slice(neg.s, neg.e), 'negrita');
  const local = s.cr.find((r) => r.props.pointSize === 14);
  assert.equal(s.text.slice(local.s, local.e), 'Segundo párrafo con tamaño local y ');
  assert.equal(local.props.appliedFont, 'Myriad Pro');
  assert.equal(local.props.fontStyle, 'Regular', 'hereda el estilo de fuente del párrafo');
  assert.deepEqual(local.props.fillColor, ['sw', 'AzulRGB']);
  const sup = s.cr.find((r) => r.props.position);
  assert.equal(s.text.slice(sup.s, sup.e), 'cursiva falsa');
  assert.equal(sup.props.fontStyle, 'Italic');
});

test('tablas: filas, columnas, medidas y celdas', () => {
  const s = model.stories.get('u4c1');
  assert.equal(s.tables.length, 1);
  const t = s.tables[0];
  assert.deepEqual([t.rows, t.cols, t.rowH, t.colW], [2, 2, [20, 30], [100, 200]]);
  assert.deepEqual(t.cells.map((c) => [c.r, c.c, c.text, c.fill]), [[0, 0, 'A1', 'None'], [0, 1, 'B1', 'Rojo'], [1, 0, 'A2', 'None'], [1, 1, 'B2', 'None']]);
});

test('avisos: solo lo relevante', () => {
  const warns = model.warnings.filter((w) => w.level === 'warn').map((w) => w.text);
  assert.equal(warns.length, 1);
  assert.match(warns[0], /1 tabla/);
});

// ------------------------------------------------------------------ errores de entrada
test('un .indd se reconoce y se explica', () => {
  const indd = new Uint8Array(64);
  indd.set([0x06, 0x06, 0xED, 0xF5, 0xD8, 0x1D, 0x46, 0xE5, 0xBD, 0x31, 0xEF, 0xE7, 0xFE, 0x74, 0xB7, 0x1D]);
  assert.throws(() => I.readPackage(indd), (e) => e instanceof I.UserError && e.code === 'indd' && /IDML/.test(e.message));
});

test('un archivo cualquiera o un zip sin designmap se rechazan con mensaje claro', () => {
  assert.throws(() => I.readPackage(new Uint8Array([1, 2, 3, 4])), (e) => e.code === 'nozip');
  const z = writeZip([{ name: 'hola.txt', data: 'hola' }]);
  assert.throws(() => I.readPackage(z), (e) => e.code === 'nodesignmap');
});

// ------------------------------------------------------------------ variantes
const NSPK = 'xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging"';

test('tolerancia: parte ausente, XML roto en una historia y color inexistente no tumban la conversión', () => {
  const bytes = buildIdmlWith((p) => {
    p['Stories/Story_u2a1.xml'] = null;                         // historia ausente
    p['Stories/Story_u3b2.xml'] = '<idPkg:Story ' + NSPK + '><Story Self="u3b2"><oops></Story>';   // roto
    p['Spreads/Spread_ud8.xml'] = p['Spreads/Spread_ud8.xml'].replace('FillColor="Color/PANTONE 185 C"', 'FillColor="Color/Fantasma"');
  });
  const m = load(bytes);
  const warns = m.warnings.map((w) => w.text).join('\n');
  assert.match(warns, /Falta en el paquete: Stories\/Story_u2a1\.xml/);
  assert.match(warns, /No se pudo leer Stories\/Story_u3b2\.xml/);
  assert.match(warns, /Color\/Fantasma/);
  assert.equal(m.stats.pages, 3);
  // el marco cuyo texto falta avisa pero no rompe
  assert.match(warns, /apunta a un texto que no existe/);
});

test('texto con envoltorios (XML, hipervínculos), notas al pie, variables y objetos anclados', () => {
  const st = story('u1f3',
    '<ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/Cuerpo">' +
    '<XMLElement Self="x1" MarkupTag="XMLTag/Root"><CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[No character style]">' + content('Con etiqueta ') + '</CharacterStyleRange></XMLElement>' +
    '<CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[No character style]"><HyperlinkTextSource Self="h1" Name="enlace" Hidden="false">' + content('enlace') + '</HyperlinkTextSource>' +
    content(' y nota') + '<Footnote Self="fn1"><ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/Cuerpo"><CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[No character style]">' + content('Texto de la nota') + '</CharacterStyleRange></ParagraphStyleRange></Footnote>' +
    '<TextVariableInstance Self="tv1" ResultText="Variable"/><Rectangle Self="anc1" ItemTransform="1 0 0 1 0 0">' + rectPath(0, 0, 10, 10) + '</Rectangle>' + '<Br/></CharacterStyleRange></ParagraphStyleRange>').replace('</Story>', '</Story>');
  const m = load(buildIdmlWith((p) => { p['Stories/Story_u1f3.xml'] = st; }));
  const s = m.stories.get('u1f3');
  assert.equal(s.text, 'Con etiqueta enlace y nota1Variable\r');
  assert.deepEqual(s.notes, [{ n: 1, text: 'Texto de la nota' }]);
  const sup = s.cr.find((r) => r.props.position);
  assert.equal(s.text.slice(sup.s, sup.e), '1');
  const w = m.warnings.map((x) => x.text).join('\n');
  assert.match(w, /1 nota al pie/);
  assert.match(w, /1 objeto anclado/);
  assert.match(w, /1 variable de texto/);
});

test('documento sin caras enfrentadas, una página por pliego, origen en el centro de la página', () => {
  const m = load(buildIdmlWith((p) => {
    p['Resources/Preferences.xml'] = p['Resources/Preferences.xml'].replace('FacingPages="true"', 'FacingPages="false"');
    p['Spreads/Spread_ud8.xml'] = p['Spreads/Spread_ud8.xml']
      .replace('ItemTransform="1 0 0 1 0 -396" Name="1"', 'ItemTransform="1 0 0 1 -306 -396" Name="1"')
      .replace(/ItemTransform="1 0 0 1 0 -396" FillColor="Swatch\/None" StrokeColor="Color\/Black"/, 'ItemTransform="1 0 0 1 -306 -396" FillColor="Swatch/None" StrokeColor="Color/Black"');
  }));
  assert.equal(m.doc.facing, false);
  const t = allItems(m.spreads[0].items).find((i) => i.id === 'ut1');
  assert.deepEqual(t.g.b, [36, 36, 400, 576]);
});

test('objetos reflejados, inclinados y con curvas', () => {
  const sp = (extra) => part('Spread', '<Spread Self="ud8" PageCount="1" ItemTransform="1 0 0 1 0 0"><Page Self="up1" GeometricBounds="0 0 792 612" ItemTransform="1 0 0 1 0 -396" Name="1" AppliedMaster="n" OverrideList="">' +
    '<MarginPreference ColumnCount="1" ColumnGutter="12" Top="36" Bottom="36" Left="36" Right="36"/></Page>' + extra + '</Spread>');
  const m = load(buildIdmlWith((p) => {
    p['Spreads/Spread_ud8.xml'] = sp(
      // reflejo horizontal de un rectángulo (matriz -1 0 0 1)
      '<Rectangle Self="rf" ItemLayer="ub7" ItemTransform="-1 0 0 1 300 -396" FillColor="Color/Rojo">' + rectPath(100, 100, 200, 150) + '</Rectangle>' +
      // inclinado (cizalla): debe pasar a trazado
      '<Rectangle Self="sh" ItemLayer="ub7" ItemTransform="1 0 0.5 1 0 -396" FillColor="Color/Rojo">' + rectPath(100, 300, 200, 350) + '</Rectangle>' +
      // rectángulo con 4 puntos pero con curvas: trazado
      '<Rectangle Self="cv" ItemLayer="ub7" ItemTransform="1 0 0 1 0 -396" FillColor="Color/Rojo"><Properties><PathGeometry><GeometryPathType PathOpen="false"><PathPointArray>' +
      '<PathPointType Anchor="0 0" LeftDirection="-10 0" RightDirection="10 0"/><PathPointType Anchor="0 50" LeftDirection="0 40" RightDirection="0 60"/><PathPointType Anchor="50 50" LeftDirection="40 50" RightDirection="60 50"/><PathPointType Anchor="50 0" LeftDirection="50 10" RightDirection="50 -10"/>' +
      '</PathPointArray></GeometryPathType></PathGeometry></Properties></Rectangle>' +
      // girado 30° visual antihorario
      '<Rectangle Self="r30" ItemLayer="ub7" ItemTransform="0.866025 -0.5 0.5 0.866025 300 -100" FillColor="Color/Rojo">' + rectPath(-50, -25, 50, 25) + '</Rectangle>');
    p['designmap.xml'] = p['designmap.xml'].replace(/<idPkg:Spread src="Spreads\/Spread_ud9.xml"\/>\n/, '');
    p['Spreads/Spread_ud9.xml'] = null;
  }));
  const it = (id) => allItems(m.spreads[0].items).find((i) => i.id === id);
  assert.equal(it('rf').g.m, 'b');
  assert.equal(it('rf').g.r, undefined, 'un reflejo simple no es un giro');
  assert.match(m.warnings.map((x) => x.text).join(' '), /1 objeto está reflejado/);
  assert.equal(it('sh').g.m, 'p');
  assert.deepEqual(it('sh').g.pts[0], [100 + 0.5 * 300, 300]);          // x' = x + 0.5*y
  assert.equal(it('cv').g.m, 'p');
  assert.deepEqual(it('cv').g.pts[0], [0, 0, -10, 0, 10, 0]);
  assert.equal(it('r30').g.m, 'b');
  assert.ok(Math.abs(it('r30').g.r - 30) < 1e-3);
  assert.ok(Math.abs((it('r30').g.b[3] - it('r30').g.b[1]) - 100) < 0.01, 'ancho sin girar = 100');
  assert.ok(Math.abs((it('r30').g.b[2] - it('r30').g.b[0]) - 50) < 0.01, 'alto sin girar = 50');
});

test('estilos de objeto: se heredan y se pisan con los valores propios', () => {
  const st = (p) => p['Resources/Styles.xml'].replace('<RootObjectStyleGroup Self="u8a"><ObjectStyle Self="ObjectStyle/$ID/[None]" Name="$ID/[None]"/></RootObjectStyleGroup>',
    '<RootObjectStyleGroup Self="u8a"><ObjectStyle Self="ObjectStyle/$ID/[None]" Name="$ID/[None]"/>' +
    '<ObjectStyle Self="ObjectStyle/Base" Name="Base" FillColor="Color/Rojo" StrokeWeight="4" StrokeColor="Color/Black"/>' +
    '<ObjectStyle Self="ObjectStyle/Hijo" Name="Hijo" StrokeWeight="2"><Properties><BasedOn type="object">ObjectStyle/Base</BasedOn></Properties></ObjectStyle></RootObjectStyleGroup>');
  const m = load(buildIdmlWith((p) => {
    p['Resources/Styles.xml'] = st(p);
    p['Spreads/Spread_ud9.xml'] = p['Spreads/Spread_ud9.xml'].replace('<Oval Self="uo1" ContentType="Unassigned"', '<Oval Self="uo1" AppliedObjectStyle="ObjectStyle/Hijo" ContentType="Unassigned"')
      .replace('FillColor="Tint/Rojo 50%25" StrokeColor="Color/AzulRGB" StrokeWeight="2"', 'StrokeWeight="6"');
  }));
  const o = allItems(m.spreads[1].items).find((i) => i.id === 'uo1');
  assert.deepEqual(o.props.fillColor, ['sw', 'Rojo']);          // de Base
  assert.equal(o.props.strokeWeight, 6);                        // propio gana
  assert.deepEqual(o.props.strokeColor, ['sw', 'Black']);       // de Base
});

test('rejilla de líneas base, texto borrado con control de cambios y texto sobre trazado', () => {
  assert.deepEqual(model.doc.grid, { start: 36, division: 12.5, threshold: 75 });
  const st = story('u1f3', psr('Cuerpo', csr(content('Visible ') + '<Change Self="c1" ChangeType="DeletedText">' + content('borrado') + '</Change>' + '<Change Self="c2" ChangeType="InsertedText">' + content('añadido') + '</Change>')));
  const m = load(buildIdmlWith((p) => {
    p['Stories/Story_u1f3.xml'] = st;
    p['Spreads/Spread_ud8.xml'] = p['Spreads/Spread_ud8.xml'].replace('</Spread>', '<TextFrame Self="tp1" ParentStory="u2a1"><TextPath Self="tpp"/></TextFrame></Spread>');
  }));
  assert.equal(m.stories.get('u1f3').text, 'Visible añadido');
  assert.match(m.warnings.map((w) => w.text).join('\n'), /texto sobre un trazado/);
});
