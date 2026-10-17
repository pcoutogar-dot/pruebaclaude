'use strict';
// Genera el script de reconstrucción para InDesign CS3 (.jsx) a partir del modelo.
const runtimeSource = require('./runtime_src');
const probeSource = require('./probe_src');
const VERSION = require('./version');
const { ENUMS } = require('./enums');
const P = require('./props');
const { crc32 } = require('./zip');

const nonEmpty = (o) => (o && Object.keys(o).length ? o : 0);

function cleanItem(it) {
  if (it.t === 'group') return { id: it.id, t: 'group', p: it.p, kids: it.kids.map(cleanItem) };
  const o = { id: it.id, t: it.t, p: it.p, g: it.g };
  if (it.layer) o.layer = it.layer;
  o.props = it.props || {};
  if (it.tfp) o.tfp = it.tfp;
  if (it.wrap) o.wrap = it.wrap;
  if (it.img) {
    const i = it.img;
    o.img = {};
    if (i.name) o.img.name = i.name;
    if (i.uri) o.img.uri = i.uri;
    if (i.saved) o.img.saved = i.saved;
    if (i.b) o.img.b = i.b;
    if (i.page) o.img.page = i.page;
  }
  return o;
}

function styleList(arr) {
  return arr.map((s) => {
    const o = { id: s.id, n: s.name };
    if (s.builtin) o.k = s.builtin;
    if (s.basedOn) o.b = s.basedOn;
    if (s.next) o.nx = s.next;
    o.p = s.props;
    return o;
  });
}

// Une rangos contiguos con el mismo estilo y las mismas anulaciones (menos llamadas dentro de InDesign).
function mergeRanges(list) {
  const out = [];
  for (const r of list) {
    const last = out[out.length - 1];
    if (last && last[1] === r[0] && last[2] === r[2] && JSON.stringify(last[3]) === JSON.stringify(r[3])) last[1] = r[1];
    else out.push(r.slice());
  }
  return out;
}

function prRanges(model, pr) {
  return mergeRanges(pr.map((r) => [r.s, r.e, r.style || null, nonEmpty(r.props)]));
}
function crRanges(model, cr, cstyleById) {
  const out = [];
  for (const r of cr) {
    const st = r.style ? cstyleById.get(r.style) : null;
    const isNone = !st || st.builtin === 'none';
    const props = nonEmpty(r.props);
    if (isNone && !props) continue;
    out.push([r.s, r.e, isNone ? null : r.style, props]);
  }
  return mergeRanges(out);
}

function buildData(model) {
  const first = model.pages[0];
  const cstyleById = new Map(model.cstyles.map((s) => [s.id, s]));
  const data = {
    v: 1,
    meta: { name: model.name, domVersion: model.domVersion },
    doc: {
      w: first ? first.w : model.doc.width, h: first ? first.h : model.doc.height,
      facing: model.doc.facing, binding: model.doc.binding, startPage: model.doc.startPage,
      bleed: model.doc.bleed, slug: model.doc.slug, margins: model.doc.margins, units: model.doc.units, grid: model.doc.grid,
    },
    layers: model.layers.map((l) => ({ id: l.id, n: l.name, vis: l.visible, lock: l.locked, print: l.printable })),
    colors: model.colors.map((c) => ({ n: c.name, m: c.model, s: c.space, v: c.value })),
    tints: model.tints.map((t) => ({ n: t.name, b: t.base, v: t.value })),
    grads: model.gradients.map((g) => ({ n: g.name, t: g.type, st: g.stops.filter((s) => s.color).map((s) => ({ c: s.color, l: s.location })) })),
    ps: styleList(model.pstyles),
    cs: styleList(model.cstyles),
    masters: model.masters.map((m) => ({
      id: m.id, n: m.name, pre: m.prefix, base: m.baseName, am: m.appliedMaster || undefined,
      pages: m.pages.map((p) => ({ m: p.margins })),
      items: m.items.map(cleanItem),
    })),
    pages: model.pages.map((p) => ({ id: p.id, label: p.label, master: p.master, m: p.margins, ovr: p.overrides })),
    spreads: model.spreads.map((s) => ({ id: s.id, pages: s.pages.map((p) => p.index), items: s.items.map(cleanItem) })),
    stories: [],
  };
  for (const s of model.stories.values()) {
    data.stories.push({
      id: s.id, t: s.text, pr: prRanges(model, s.pr), cr: crRanges(model, s.cr, cstyleById), fr: s.frames,
      tb: s.tables.map((t) => ({
        pos: t.pos, rows: t.rows, cols: t.cols, header: t.header, footer: t.footer, rowH: t.rowH, colW: t.colW,
        cells: t.cells.map((c) => ({ r: c.r, c: c.c, rs: c.rs, cs: c.cs, fill: c.fill && c.fill !== 'None' ? c.fill : null, t: c.text, pr: prRanges(model, c.pr), cr: crRanges(model, c.cr, cstyleById) })),
      })),
    });
  }
  return data;
}

// ---------------------------------------------------------------- datos como literal de JavaScript
// Como JSON.stringify, pero repartido en líneas y con los textos largos troceados: ExtendScript lee mejor
// un archivo de líneas cortas que un único renglón de varios megabytes, y los números de línea de un error sirven de algo.
const CHUNK = 160;

function strLit(s) {
  if (s.length <= CHUNK + CHUNK / 2) return JSON.stringify(s);
  const parts = [];
  for (let i = 0; i < s.length;) {
    let j = Math.min(i + CHUNK, s.length);
    if (j < s.length) { const c = s.charCodeAt(j - 1); if (c >= 0xd800 && c <= 0xdbff) j++; }   // no partir un par subrogado
    parts.push(JSON.stringify(s.slice(i, j)));
    i = j;
  }
  return '[' + parts.join(',\n') + '].join("")';
}

const isScalar = (v) => v === null || v === undefined || typeof v !== 'object';

function toJs(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '0';
  if (typeof v === 'string') return strLit(v);
  if (Array.isArray(v)) {
    if (!v.length) return '[]';
    if (v.every(isScalar)) return '[' + v.map(toJs).join(',') + ']';
    return '[\n' + v.map(toJs).join(',\n') + '\n]';
  }
  const keys = Object.keys(v).filter((k) => v[k] !== undefined && typeof v[k] !== 'function');
  if (!keys.length) return '{}';
  const pairs = keys.map((k) => JSON.stringify(k) + ':' + toJs(v[k]));
  if (keys.every((k) => isScalar(v[k])) && pairs.every((x) => x.indexOf('\n') < 0)) return '{' + pairs.join(',') + '}';
  return '{\n' + pairs.join(',\n') + '\n}';
}

// ---------------------------------------------------------------- PNG de prueba para la comprobación (sin compresión: no hace falta zlib)
const be32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
function adler32(bytes) {
  let a = 1; let b = 0;
  for (const x of bytes) { a = (a + x) % 65521; b = (b + a) % 65521; }
  return ((b << 16) | a) >>> 0;
}
function pngChunk(type, data) {
  const td = Array.from(type, (c) => c.charCodeAt(0)).concat(data);
  return be32(data.length).concat(td, be32(crc32(Uint8Array.from(td))));
}
function tinyPngBytes() {
  const raw = [0, 255, 0, 0, 0, 255, 0, 0, 0, 0, 255, 255, 255, 0];            // 2 filas: filtro 0 + 2 píxeles RGB
  const len = raw.length;
  const z = [0x78, 0x01, 0x01, len & 255, len >> 8, (~len) & 255, ((~len) >> 8) & 255].concat(raw, be32(adler32(raw)));
  const ihdr = be32(2).concat(be32(2), [8, 2, 0, 0, 0]);
  return [137, 80, 78, 71, 13, 10, 26, 10].concat(pngChunk('IHDR', ihdr), pngChunk('IDAT', z), pngChunk('IEND', []));
}

// ---------------------------------------------------------------- lo que la comprobación espera encontrar en CS3
function expectProps() {
  const names = (t) => Object.keys(t).map((k) => t[k][0]);
  const corners = names(P.OBJECT_ATTRS).filter((k) => /Corner/.test(k));
  const lineEnds = ['leftLineEnd', 'rightLineEnd'];
  const page = names(P.OBJECT_ATTRS).filter((k) => corners.indexOf(k) < 0 && lineEnds.indexOf(k) < 0)
    .concat(['geometricBounds', 'itemLayer', 'label', 'visible', 'locked', 'rotationAngle']);
  const paraExtra = ['tabStops', 'bulletChar', 'bulletsAndNumberingListType', 'bulletsTextAfter', 'nextStyle'];
  return {
    ParagraphStyle: names(P.TEXT_ATTRS).concat(['appliedFont', 'leading', 'basedOn'], paraExtra),
    CharacterStyle: names(P.CHAR_ATTRS).concat(['appliedFont', 'leading', 'basedOn']),
    PageItem: page,
    Corners: corners.concat(['cornerOption', 'cornerRadius']),
    LineEnds: lineEnds,
    TextFramePreference: names(P.FRAME_ATTRS).concat(['insetSpacing']),
  };
}

// Todo el script va en ASCII puro (con \uXXXX): InDesign lee mal los .jsx con tildes si no llevan BOM.
function asciiOnly(s) {
  return s.replace(/[\u007f-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

// un nombre de archivo nunca debe poder salirse de la línea de comentario
const oneLine = (v) => String(v).replace(/[\r\n\u2028\u2029]+/g, ' ');

function buildScript(model, opts) {
  opts = opts || {};
  if (!runtimeSource) throw new Error('Falta el texto del script de reconstrucción (runtime.jsx).');
  const data = buildData(model);
  const stamp = (opts.date || new Date()).toISOString().slice(0, 10);
  const head = [
    '#target indesign',
    '// ============================================================================',
    '//  RECONSTRUIR EN INDESIGN CS3',
    '//  Documento original: ' + oneLine(model.name) + '   (IDML DOMVersion ' + oneLine(model.domVersion || '?') + ')',
    '//  Generado el ' + stamp + ' por "IDML a CS3".',
    '//',
    '//  COMO USARLO (en el ordenador con InDesign CS3):',
    '//   1. Instala las fuentes del documento y deja las imagenes enlazadas en una carpeta',
    '//      (junto con la carpeta imagenes_incrustadas, si la hay).',
    '//   2. En InDesign CS3: Ventana > Automatizacion > Scripts.',
    '//   3. Clic derecho sobre "Usuario" > "Mostrar en el Explorador/Finder", pega ahi este',
    '//      archivo y haz doble clic sobre su nombre en el panel.',
    '//   4. Si no encuentra las imagenes, te pedira la carpeta donde estan.',
    '//   Se creara un DOCUMENTO NUEVO; no toca ningun otro documento.',
    '//',
    '//  SI ALGO FALLA: el archivo resultado_reconstruccion.txt del Escritorio dice que paso y',
    '//  donde se detuvo. Antes de nada puedes ejecutar 0_comprobar_CS3.jsx (una prueba de unos segundos).',
    '// ============================================================================',
    '',
    'var CONVERTER = "' + VERSION + '";',
    '// Modo paso a paso: cambia false por true y vuelve a ejecutar; el registro anotara cada objeto y cada estilo.',
    '// (Se activa solo si la ejecucion anterior se quedo a medias.)',
    'var DIAG = false;',
    '',
    '// Si en este ordenador falta alguna fuente, puedes sustituirla aqui, por ejemplo:',
    '//   var FONT_SUBSTITUTIONS = { "Myriad Pro": "Arial" };',
    'var FONT_SUBSTITUTIONS = {};',
    '',
    'var DATA = ' + toJs(data) + ';',
    '',
  ].join('\n');
  return asciiOnly(head + runtimeSource.replace(/\r\n/g, '\n'));
}

// Script de comprobación: no usa ningún documento del usuario
function buildProbe(opts) {
  opts = opts || {};
  if (!probeSource) throw new Error('Falta el texto de la comprobación (probe.jsx).');
  const stamp = (opts.date || new Date()).toISOString().slice(0, 10);
  const head = [
    '#target indesign',
    '// ============================================================================',
    '//  COMPROBAR INDESIGN CS3   (IDML a CS3, version ' + VERSION + ', ' + stamp + ')',
    '//',
    '//  Es una prueba rapida (unos segundos) que NO usa ningun documento tuyo: crea uno de prueba,',
    '//  intenta las mismas operaciones que el script de reconstruccion, lo cierra sin guardar y',
    '//  escribe en el Escritorio el archivo diagnostico_CS3.txt con lo que funciona y lo que no.',
    '//',
    '//  COMO USARLO (en el ordenador con InDesign CS3):',
    '//   1. Ventana > Automatizacion > Scripts.',
    '//   2. Clic derecho sobre "Usuario" > "Mostrar en el Explorador/Finder", pega ahi este archivo',
    '//      y haz doble clic sobre su nombre en el panel.',
    '//   3. Envia el contenido de diagnostico_CS3.txt (o una foto del aviso que sale).',
    '// ============================================================================',
    '',
    'var CONVERTER = "' + VERSION + '";',
    'var EXPECT_ENUMS = ' + toJs(ENUMS) + ';',
    'var EXPECT_PROPS = ' + toJs(expectProps()) + ';',
    'var PNG_BYTES = [' + tinyPngBytes().join(',') + '];',
    '',
  ].join('\n');
  return asciiOnly(head + probeSource.replace(/\r\n/g, '\n'));
}

module.exports = { buildData, buildScript, buildProbe, asciiOnly, toJs, tinyPngBytes, expectProps };
