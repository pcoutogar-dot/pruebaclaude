'use strict';
// Genera el script de reconstrucción para InDesign CS3 (.jsx) a partir del modelo.
const runtimeSource = require('./runtime_src');

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

function prRanges(model, pr) {
  return pr.map((r) => [r.s, r.e, r.style || null, nonEmpty(r.props)]);
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
  return out;
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
      bleed: model.doc.bleed, slug: model.doc.slug, margins: model.doc.margins, units: model.doc.units,
    },
    layers: model.layers.map((l) => ({ id: l.id, n: l.name, vis: l.visible, lock: l.locked, print: l.printable })),
    colors: model.colors.map((c) => ({ n: c.name, m: c.model, s: c.space, v: c.value })),
    tints: model.tints.map((t) => ({ n: t.name, b: t.base, v: t.value })),
    grads: model.gradients.map((g) => ({ n: g.name, t: g.type, st: g.stops.filter((s) => s.color).map((s) => ({ c: s.color, l: s.location })) })),
    ps: styleList(model.pstyles),
    cs: styleList(model.cstyles),
    masters: model.masters.map((m) => ({
      id: m.id, n: m.name, pre: m.prefix, base: m.baseName,
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

// Todo el script va en ASCII puro (con \uXXXX): InDesign lee mal los .jsx con tildes si no llevan BOM.
function asciiOnly(s) {
  return s.replace(/[\u007f-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

function buildScript(model, opts) {
  opts = opts || {};
  if (!runtimeSource) throw new Error('Falta el texto del script de reconstrucción (runtime.jsx).');
  const data = buildData(model);
  const stamp = (opts.date || new Date()).toISOString().slice(0, 10);
  const head = [
    '#target indesign',
    '// ============================================================================',
    '//  RECONSTRUIR EN INDESIGN CS3',
    '//  Documento original: ' + model.name + '   (IDML DOMVersion ' + (model.domVersion || '?') + ')',
    '//  Generado el ' + stamp + ' por "IDML a CS3".',
    '//',
    '//  COMO USARLO (en el ordenador con InDesign CS3):',
    '//   1. Copia este archivo .jsx a una carpeta junto con las imagenes (o su carpeta Links).',
    '//   2. En InDesign CS3: Ventana > Automatizacion > Scripts.',
    '//   3. En el panel, haz clic derecho sobre "Usuario" > "Mostrar en el Explorador/Finder",',
    '//      pega ahi este archivo y haz doble clic sobre su nombre en el panel.',
    '//   Se creara un DOCUMENTO NUEVO; no toca ningun otro documento.',
    '// ============================================================================',
    '',
    '// Si en este ordenador falta alguna fuente, puedes sustituirla aqui, por ejemplo:',
    '//   var FONT_SUBSTITUTIONS = { "Myriad Pro": "Arial" };',
    'var FONT_SUBSTITUTIONS = {};',
    '',
    'var DATA = ' + JSON.stringify(data) + ';',
    '',
  ].join('\n');
  return asciiOnly(head + runtimeSource.replace(/\r\n/g, '\n'));
}

module.exports = { buildData, buildScript, asciiOnly };
