'use strict';
// Lector de IDML (InDesign CS4 y posteriores). Convierte el paquete en un modelo normalizado:
// páginas, objetos con geometría ya resuelta (coordenadas "de pliego" como las usa el scripting
// de InDesign), textos con sus rangos de estilo, estilos, colores, vínculos...
const { readZip } = require('./zip');
const X = require('./xml');
const G = require('./geometry');
const P = require('./props');

class UserError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

const INDD_MAGIC = [0x06, 0x06, 0xED, 0xF5, 0xD8, 0x1D, 0x46, 0xE5, 0xBD, 0x31, 0xEF, 0xE7, 0xFE, 0x74, 0xB7, 0x1D];
function isIndd(u8) {
  if (u8.length < 16) return false;
  for (let i = 0; i < 16; i++) if (u8[i] !== INDD_MAGIC[i]) return false;
  return true;
}

const dec = new TextDecoder('utf-8');
const noId = (s) => String(s === undefined ? '' : s).replace(/^\$ID\//, '');

// -------------------------------------------------------------------------- paquete
function readPackage(bytes, zipOpts) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (isIndd(u8)) throw new UserError('indd', 'Ese archivo es un .indd. Hay que exportarlo a IDML desde InDesign CS6 (Archivo > Exportar…).');
  let zip;
  try { zip = readZip(u8, zipOpts); } catch (e) { throw new UserError('nozip', 'El archivo no parece un IDML (no se puede abrir como paquete): ' + e.message); }
  if (!zip.has('designmap.xml')) throw new UserError('nodesignmap', 'El archivo no contiene designmap.xml: no es un IDML de InDesign.');

  const warnings = [];
  const pkg = { zip, warnings, parts: [], byType: {}, texts: [] };
  const parse = (name) => {
    const data = zip.get(name);
    if (!data) return null;
    const text = dec.decode(data);
    pkg.texts.push(text);
    return { text, root: X.parseXml(text) };
  };
  let dm;
  try { dm = parse('designmap.xml'); } catch (e) {
    throw new UserError('nodesignmap', 'El IDML está dañado: no se puede leer designmap.xml (' + e.message + '). Prueba a exportarlo de nuevo desde CS6.');
  }
  pkg.designmap = dm.root;
  pkg.designmapText = dm.text;
  const seen = new Set();
  const add = (type, src) => {
    if (seen.has(src)) return;
    seen.add(src);
    try {
      const r = parse(src);
      if (!r) { warnings.push('Falta en el paquete: ' + src); return; }
      const part = { type, src, root: r.root };
      pkg.parts.push(part);
      (pkg.byType[type] = pkg.byType[type] || []).push(part);
    } catch (e) {
      warnings.push('No se pudo leer ' + src + ': ' + e.message);
    }
  };
  for (const k of X.kidsEl(pkg.designmap)) {
    if (k.name.startsWith('idPkg:') && k.attrs.src) add(k.name.slice(6), k.attrs.src);
  }
  // por si el designmap no enumera algo que sí está en el zip
  for (const n of zip.names) {
    let m;
    if ((m = /^Stories\/.+\.xml$/.exec(n))) add('Story', n);
    else if ((m = /^Spreads\/.+\.xml$/.exec(n))) add('Spread', n);
    else if ((m = /^MasterSpreads\/.+\.xml$/.exec(n))) add('MasterSpread', n);
  }
  return pkg;
}

// -------------------------------------------------------------------------- utilidades
function base64ToBytes(b64) {
  const clean = b64.replace(/[^A-Za-z0-9+/=]/g, '');
  const map = new Int16Array(128).fill(-1);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (let i = 0; i < 64; i++) map[chars.charCodeAt(i)] = i;
  const pad = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const out = new Uint8Array(Math.floor(clean.length * 3 / 4) - pad);
  let o = 0; let buf = 0; let bits = 0;
  for (let i = 0; i < clean.length; i++) {
    const c = clean.charCodeAt(i);
    if (c === 61) break;
    buf = (buf << 6) | map[c]; bits += 6;
    if (bits >= 8) { bits -= 8; if (o < out.length) out[o++] = (buf >> bits) & 0xFF; }
  }
  return out;
}

function uriToPath(uri) {
  if (!uri) return '';
  let s = String(uri);
  try { s = decodeURIComponent(s); } catch (_) { /* se deja tal cual */ }
  if (/^file:/i.test(s)) {
    s = s.replace(/^file:(\/\/)?(localhost)?/i, '');
    if (/^\/[A-Za-z]:/.test(s)) s = s.slice(1);                 // /C:/x -> C:/x
    else if (/^\/\/[^/]/.test(s)) s = '//' + s.slice(2).replace(/^\/+/, '');
  }
  return s;
}
const baseName = (p) => String(p).split(/[\\/]/).pop();

function nums(s) { return String(s || '').trim().split(/\s+/).filter(Boolean).map(Number); }

const ITEM_KIND = { TextFrame: 'text', Rectangle: 'rect', Oval: 'oval', Polygon: 'poly', GraphicLine: 'line', Group: 'group' };
const GRAPHIC_TAGS = new Set(['Image', 'EPS', 'PDF', 'WMF', 'PICT', 'ImportedPage']);
const INTERACTIVE_TAGS = new Set(['Button', 'MultiStateObject', 'FormField', 'CheckBox', 'ComboBox', 'ListBox', 'RadioButton', 'SignatureField', 'TextBox', 'SWFItem', 'MediaItem']);

// -------------------------------------------------------------------------- modelo
function buildModel(pkg, opts) {
  opts = opts || {};
  const model = {
    name: opts.name || 'documento',
    domVersion: pkg.designmap.attrs.DOMVersion || '',
    doc: {}, layers: [], colors: [], tints: [], gradients: [], fonts: [],
    pstyles: [], cstyles: [], ostyles: [], masters: [], spreads: [], pages: [],
    stories: new Map(), links: [], embedded: [], notes: [], warnings: [], features: {},
    stats: {},
  };
  const warnOnce = new Set();
  const counters = {};
  const ctx = {
    warn(msg) { if (!warnOnce.has(msg)) { warnOnce.add(msg); model.warnings.push({ level: 'warn', text: msg }); } },
    info(msg) { if (!warnOnce.has(msg)) { warnOnce.add(msg); model.warnings.push({ level: 'info', text: msg }); } },
    count(key, n) { counters[key] = (counters[key] || 0) + (n === undefined ? 1 : n); },
    unsupported(name) { counters['u:' + name] = (counters['u:' + name] || 0) + 1; },
    color: null,
  };
  for (const w of pkg.warnings) ctx.warn(w);

  // las muestras de fábrica existen siempre, aunque el IDML no las enumere
  const swatchById = new Map([['Swatch/None', { name: 'None', builtin: true }], ['Color/Black', { name: 'Black', builtin: true }],
    ['Color/Paper', { name: 'Paper', builtin: true }], ['Color/Registration', { name: 'Registration', builtin: true }]]);
  const styleById = new Map();
  ctx.color = (ref) => {
    if (!ref || ref === 'n') return null;
    const sw = swatchById.get(ref);
    if (sw) return sw.name;
    ctx.warn('Hay un objeto que usa un color que no existe en el documento (' + ref + '); se ha dejado sin color.');
    return null;
  };

  readGraphics(pkg, model, swatchById, ctx);
  readFontsFile(pkg, model);
  readStyles(pkg, model, styleById, ctx);
  readPreferences(pkg, model, ctx);
  readLayers(pkg, model);
  readSections(pkg, model);

  const stories = new Map();
  for (const part of pkg.byType.Story || []) {
    for (const s of X.kidsEl(part.root, 'Story')) {
      try { stories.set(s.attrs.Self, readStory(s, ctx)); } catch (e) { ctx.warn('Un texto no se pudo leer: ' + e.message); }
    }
  }
  model.stories = stories;

  const frameIndex = new Map();
  for (const part of pkg.byType.MasterSpread || []) {
    for (const m of X.kidsEl(part.root, 'MasterSpread')) model.masters.push(readSpread(m, true, model, ctx, styleById, frameIndex));
  }
  for (const part of pkg.byType.Spread || []) {
    for (const s of X.kidsEl(part.root, 'Spread')) model.spreads.push(readSpread(s, false, model, ctx, styleById, frameIndex));
  }
  let gi = 0;
  for (const sp of model.spreads) for (const pg of sp.pages) { pg.index = gi++; model.pages.push(pg); }
  if (!model.pages.length) throw new UserError('nopages', 'El IDML no contiene ninguna página que se pueda leer (no hay spreads en el paquete).');
  linkStories(model, frameIndex, ctx);
  resolveFontStyles(model);
  collectFonts(model);
  finish(pkg, model, counters, ctx);
  return model;
}

// ---- colores ---------------------------------------------------------------
function readGraphics(pkg, model, swatchById, ctx) {
  const builtin = { 'Color/Black': 'Black', 'Color/Paper': 'Paper', 'Color/Registration': 'Registration', 'Swatch/None': 'None' };
  for (const part of pkg.byType.Graphic || []) {
    for (const el of X.kidsEl(part.root)) {
      const id = el.attrs.Self;
      if (el.name === 'Color') {
        if (builtin[id]) { swatchById.set(id, { name: builtin[id], builtin: true }); continue; }
        const name = noId(el.attrs.Name);
        const rec = { name, space: el.attrs.Space || 'CMYK', model: el.attrs.Model || 'Process', value: nums(el.attrs.ColorValue) };
        swatchById.set(id, rec);
        if (rec.model === 'Registration') continue;
        model.colors.push(rec);
      } else if (el.name === 'Swatch') {
        swatchById.set(id, { name: builtin[id] || noId(el.attrs.Name), builtin: !!builtin[id] });
      } else if (el.name === 'Tint') {
        const rec = { name: noId(el.attrs.Name), base: el.attrs.BaseColor, value: P.num(el.attrs.TintValue) };
        swatchById.set(id, rec); model.tints.push(rec);
      } else if (el.name === 'Gradient') {
        const stops = X.kidsEl(el, 'GradientStop').map((s) => ({ color: s.attrs.StopColor, location: P.num(s.attrs.Location) || 0, midpoint: P.num(s.attrs.Midpoint) }));
        const rec = { name: noId(el.attrs.Name), type: el.attrs.Type || 'Linear', stops };
        swatchById.set(id, rec); model.gradients.push(rec);
      } else if (el.name === 'MixedInkGroup' || el.name === 'MixedInk') {
        ctx.count('mixedInk');
      }
    }
  }
  // los tonos y degradados guardan referencias por id: se pasan a nombre
  for (const t of model.tints) { const b = swatchById.get(t.base); t.base = b ? b.name : null; }
  for (const g of model.gradients) for (const s of g.stops) { const b = swatchById.get(s.color); s.color = b ? b.name : null; }
  model.tints = model.tints.filter((t) => t.base);
}

// ---- fuentes ---------------------------------------------------------------
function readFontsFile(pkg, model) {
  const fams = new Map();
  for (const part of pkg.byType.Fonts || []) {
    for (const fam of X.kidsEl(part.root, 'FontFamily')) {
      const name = fam.attrs.Name;
      const rec = fams.get(name) || { family: name, styles: [], status: 'Installed' };
      for (const f of X.kidsEl(fam, 'Font')) {
        rec.styles.push(f.attrs.FontStyleName || 'Regular');
        if (f.attrs.Status && f.attrs.Status !== 'Installed') rec.status = f.attrs.Status;
      }
      fams.set(name, rec);
    }
  }
  model.fontFile = fams;
}

// ---- estilos ---------------------------------------------------------------
function styleRef(v, prefix) {
  if (!v) return null;
  v = String(v);
  if (v === 'n') return null;
  return v.startsWith(prefix + '/') ? v : prefix + '/' + v;
}

function readStyles(pkg, model, styleById, ctx) {
  const usedBy = { p: new Set(), c: new Set() };
  const unique = (name, kind) => {
    const used = usedBy[kind];
    let n = name; let i = 2;
    while (used.has(n)) n = name + ' ' + i++;
    used.add(n);
    return n;
  };
  const make = (el, path, prefix, kindName) => {
    const { props, properties } = P.textProps(el, ctx);
    const rawName = el.attrs.Name || '';
    let builtin = null;
    if (rawName === '$ID/[No paragraph style]' || rawName === '$ID/[No character style]') builtin = 'none';
    else if (rawName === '$ID/NormalParagraphStyle') builtin = 'basic';
    const rec = {
      id: el.attrs.Self, kind: kindName, name: noId(rawName), path, builtin,
      basedOn: styleRef(typeof properties.BasedOn === 'string' ? properties.BasedOn : null, prefix),
      next: kindName === 'p' ? styleRef(el.attrs.NextStyle || (typeof properties.NextStyle === 'string' ? properties.NextStyle : null), prefix) : null,
      props,
    };
    if (!builtin) rec.name = unique(rec.name, kindName); else usedBy[kindName].add(rec.name);
    styleById.set(rec.id, rec);
    return rec;
  };
  const walk = (el, path, tag, groupTag, prefix, kindName, out) => {
    for (const k of X.kidsEl(el)) {
      if (k.name === tag) out.push(make(k, path, prefix, kindName));
      else if (k.name === groupTag) walk(k, path.concat([noId(k.attrs.Name)]), tag, groupTag, prefix, kindName, out);
    }
  };
  const objStyle = (el, path) => {
    const props = P.objectProps(el, ctx);
    const { tfp, wrap } = P.framePrefs(el, ctx);
    const properties = P.readProperties(el);
    const rec = {
      id: el.attrs.Self, name: noId(el.attrs.Name), path,
      basedOn: styleRef(typeof properties.BasedOn === 'string' ? properties.BasedOn : null, 'ObjectStyle'),
      props, tfp, wrap,
    };
    const ts = X.firstEl(el, 'TransparencySetting');
    if (ts) {
      const bs = X.firstEl(ts, 'BlendingSetting');
      const op = bs && P.num(bs.attrs.Opacity);
      if (op !== undefined && op < 100) rec.props.opacity = op;
    }
    styleById.set(rec.id, rec);
    return rec;
  };
  for (const part of pkg.byType.Styles || []) {
    for (const top of X.kidsEl(part.root)) {
      if (top.name === 'RootParagraphStyleGroup') walk(top, [], 'ParagraphStyle', 'ParagraphStyleGroup', 'ParagraphStyle', 'p', model.pstyles);
      else if (top.name === 'RootCharacterStyleGroup') walk(top, [], 'CharacterStyle', 'CharacterStyleGroup', 'CharacterStyle', 'c', model.cstyles);
      else if (top.name === 'RootObjectStyleGroup') {
        const rec = (el, path) => {
          for (const k of X.kidsEl(el)) {
            if (k.name === 'ObjectStyle') model.ostyles.push(objStyle(k, path));
            else if (k.name === 'ObjectStyleGroup') rec(k, path.concat([noId(k.attrs.Name)]));
          }
        };
        rec(top, []);
      }
    }
  }
}

// ---- preferencias del documento -------------------------------------------
function readPreferences(pkg, model, ctx) {
  const doc = model.doc;
  doc.width = 612; doc.height = 792; doc.facing = false; doc.binding = 'LeftToRight';
  doc.bleed = { top: 0, bottom: 0, inside: 0, outside: 0 }; doc.slug = { top: 0, bottom: 0, inside: 0, outside: 0 };
  doc.margins = { top: 36, bottom: 36, left: 36, right: 36, columns: 1, gutter: 12 };
  doc.units = { h: 'Points', v: 'Points' };
  doc.startPage = 1;
  for (const part of pkg.byType.Preferences || []) {
    for (const el of X.kidsEl(part.root)) {
      const a = el.attrs;
      if (el.name === 'DocumentPreference') {
        doc.width = P.num(a.PageWidth) || doc.width; doc.height = P.num(a.PageHeight) || doc.height;
        doc.facing = a.FacingPages !== 'false';
        doc.binding = a.PageBinding || 'LeftToRight';
        doc.bleed = { top: P.num(a.DocumentBleedTopOffset) || 0, bottom: P.num(a.DocumentBleedBottomOffset) || 0, inside: P.num(a.DocumentBleedInsideOrLeftOffset) || 0, outside: P.num(a.DocumentBleedOutsideOrRightOffset) || 0 };
        doc.slug = { top: P.num(a.SlugTopOffset) || 0, bottom: P.num(a.SlugBottomOffset) || 0, inside: P.num(a.SlugInsideOrLeftOffset) || 0, outside: P.num(a.SlugRightOrOutsideOffset) || 0 };
        if (P.num(a.StartPageNumber)) doc.startPage = P.num(a.StartPageNumber);
        doc.intent = a.Intent;
      } else if (el.name === 'GridPreference') {
        if (P.num(a.BaselineDivision) !== undefined) {
          doc.grid = { start: P.num(a.BaselineStart) || 0, division: P.num(a.BaselineDivision), threshold: P.num(a.BaselineViewThreshold) };
        }
      } else if (el.name === 'MarginPreference') {
        doc.margins = marginsOf(el, doc.margins);
      } else if (el.name === 'ViewPreference') {
        doc.units = { h: a.HorizontalMeasurementUnits || 'Points', v: a.VerticalMeasurementUnits || 'Points' };
      }
    }
  }
}

function marginsOf(el, fallback) {
  const a = el.attrs;
  const f = fallback || {};
  return {
    top: P.num(a.Top) !== undefined ? P.num(a.Top) : f.top,
    bottom: P.num(a.Bottom) !== undefined ? P.num(a.Bottom) : f.bottom,
    left: P.num(a.Left) !== undefined ? P.num(a.Left) : f.left,
    right: P.num(a.Right) !== undefined ? P.num(a.Right) : f.right,
    columns: P.num(a.ColumnCount) !== undefined ? P.num(a.ColumnCount) : f.columns,
    gutter: P.num(a.ColumnGutter) !== undefined ? P.num(a.ColumnGutter) : f.gutter,
  };
}

function readLayers(pkg, model) {
  for (const l of X.kidsEl(pkg.designmap, 'Layer')) {
    model.layers.push({ id: l.attrs.Self, name: l.attrs.Name || 'Capa', visible: l.attrs.Visible !== 'false', locked: l.attrs.Locked === 'true', printable: l.attrs.Printable !== 'false' });
  }
}

function readSections(pkg, model) {
  model.sections = X.kidsEl(pkg.designmap, 'Section').map((s) => ({
    id: s.attrs.Self, pageStart: s.attrs.PageStart, number: P.num(s.attrs.PageNumberStart) || 1,
    style: s.attrs.PageNumberStyle || 'Arabic', prefix: s.attrs.SectionPrefix || '', continue: s.attrs.ContinueNumbering === 'true',
  }));
  if (model.sections.length) model.doc.startPage = model.sections[0].number;
}

// ---- pliegos y objetos ------------------------------------------------------
function readPath(el) {
  const pg = X.firstEl(X.firstEl(el, 'Properties') || { kids: [] }, 'PathGeometry');
  if (!pg) return null;
  const paths = X.kidsEl(pg, 'GeometryPathType');
  if (!paths.length) return null;
  const first = paths[0];
  const arr = X.firstEl(first, 'PathPointArray');
  if (!arr) return null;
  const pts = [];
  for (const pp of X.kidsEl(arr)) {                      // PathPointType (también se admite PathPoint)
    if (pp.attrs.Anchor === undefined) continue;
    const a = nums(pp.attrs.Anchor); const l = nums(pp.attrs.LeftDirection); const r = nums(pp.attrs.RightDirection);
    if (a.length !== 2 || a.some((v) => !Number.isFinite(v))) continue;
    pts.push({ a, l: l.length === 2 ? l : a, r: r.length === 2 ? r : a });
  }
  if (!pts.length) return null;
  return { open: first.attrs.PathOpen === 'true', pts, extra: paths.length - 1 };
}

const eq2 = (p, q) => Math.abs(p[0] - q[0]) < 1e-6 && Math.abs(p[1] - q[1]) < 1e-6;

function isBoxLike(kind, path, d) {
  if (Math.abs(d.shear) > 1e-3) return false;
  if (kind === 'line' || kind === 'poly') return false;
  const pts = path.pts;
  if (kind === 'oval') return pts.length === 4;
  if (path.open) return false;
  if (pts.length !== 4) return false;
  for (const p of pts) if (!eq2(p.a, p.l) || !eq2(p.a, p.r)) return false;
  const xs = new Set(pts.map((p) => G.round(p.a[0], 3)));
  const ys = new Set(pts.map((p) => G.round(p.a[1], 3)));
  return xs.size === 2 && ys.size === 2;
}

function resolveObjectStyle(model, styleById, id, seen) {
  const out = { props: {}, tfp: {}, wrap: {} };
  const st = styleById.get(id);
  if (!st || (seen && seen.has(id))) return out;
  seen = seen || new Set(); seen.add(id);
  const base = st.basedOn ? resolveObjectStyle(model, styleById, st.basedOn, seen) : out;
  return {
    props: Object.assign({}, base.props, st.props),
    tfp: Object.assign({}, base.tfp, st.tfp),
    wrap: Object.assign({}, base.wrap, st.wrap),
  };
}

function readSpread(el, isMaster, model, ctx, styleById, frameIndex) {
  const sp = {
    id: el.attrs.Self, master: isMaster, name: noId(el.attrs.Name || ''), prefix: el.attrs.NamePrefix, baseName: el.attrs.BaseName,
    appliedMaster: isMaster && el.attrs.AppliedMaster && el.attrs.AppliedMaster !== 'n' ? el.attrs.AppliedMaster : null,
    pages: [], items: [], guides: 0,
  };
  const margins0 = model.doc.margins;
  for (const p of X.kidsEl(el, 'Page')) {
    const b = nums(p.attrs.GeometricBounds);
    const m = G.parseMatrix(p.attrs.ItemTransform);
    const mp = X.firstEl(p, 'MarginPreference');
    const gx = m[4] + (b[1] || 0); const gy = m[5] + (b[0] || 0);
    sp.pages.push({
      id: p.attrs.Self, label: p.attrs.Name || '', w: (b[3] - b[1]) || model.doc.width, h: (b[2] - b[0]) || model.doc.height,
      gx, gy, x: 0, y: 0,
      master: p.attrs.AppliedMaster && p.attrs.AppliedMaster !== 'n' ? p.attrs.AppliedMaster : null,
      overrides: String(p.attrs.OverrideList || '').split(/\s+/).filter(Boolean),
      margins: mp ? marginsOf(mp, margins0) : Object.assign({}, margins0),
    });
  }
  if (!sp.pages.length) ctx.warn('Un pliego no tiene páginas.');
  const left = sp.pages.length ? Math.min.apply(null, sp.pages.map((p) => p.gx)) : 0;
  const top = sp.pages.length ? Math.min.apply(null, sp.pages.map((p) => p.gy)) : 0;
  for (const p of sp.pages) { p.x = G.round(p.gx - left, 3); p.y = G.round(p.gy - top, 3); }
  sp.origin = { x: left, y: top };

  let z = 0;
  const pageFor = (cx, cy) => {
    let best = 0; let bestD = Infinity;
    sp.pages.forEach((p, i) => {
      const dx = cx < p.x ? p.x - cx : cx > p.x + p.w ? cx - (p.x + p.w) : 0;
      const dy = cy < p.y ? p.y - cy : cy > p.y + p.h ? cy - (p.y + p.h) : 0;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  };
  const env = { sp, ctx, model, styleById, frameIndex, pageFor, next: () => ++z };
  for (const k of X.kidsEl(el)) {
    if (k.name === 'Page' || k.name === 'FlattenerPreference' || k.name === 'Properties') continue;
    if (k.name === 'Guide') { sp.guides++; continue; }
    if (INTERACTIVE_TAGS.has(k.name)) { ctx.count('interactive'); continue; }
    if (!ITEM_KIND[k.name]) continue;
    const it = parseItem(k, G.IDENTITY, env);
    if (it) sp.items.push(it);
  }
  return sp;
}

function parseItem(el, M, env) {
  const { sp, ctx, model, styleById } = env;
  const kind = ITEM_KIND[el.name];
  if (!kind) return null;
  const T = G.mul(M, G.parseMatrix(el.attrs.ItemTransform));
  const item = { id: el.attrs.Self, t: kind, layer: el.attrs.ItemLayer, z: env.next() };
  if (el.attrs.Name && el.attrs.Name !== '$ID/') item.name = el.attrs.Name;

  if (kind === 'group') {
    item.kids = [];
    for (const k of X.kidsEl(el)) {
      if (INTERACTIVE_TAGS.has(k.name)) { ctx.count('interactive'); continue; }
      if (!ITEM_KIND[k.name]) continue;
      const c = parseItem(k, T, env);
      if (c) item.kids.push(c);
    }
    if (!item.kids.length) return null;
    item.p = item.kids[0].p;
    return item;
  }

  const path = readPath(el);
  if (!path) { ctx.warn('Un objeto (' + el.name + ') no tiene trazado y se ha omitido.'); return null; }
  if (path.extra > 0) ctx.count('compound');

  // propiedades: estilo de objeto (si lo hay) + valores propios
  const own = P.objectProps(el, ctx);
  const fp = P.framePrefs(el, ctx);
  const os = resolveObjectStyle(model, styleById, styleRef(el.attrs.AppliedObjectStyle, 'ObjectStyle'));
  item.props = Object.assign({}, os.props, own);
  if (kind === 'text') {
    const tfp = Object.assign({}, os.tfp, fp.tfp);
    if (Object.keys(tfp).length) item.tfp = tfp;
  }
  const wrap = Object.assign({}, os.wrap, fp.wrap);
  if (Object.keys(wrap).length) item.wrap = wrap;
  const ts = X.firstEl(el, 'TransparencySetting');
  if (ts) {
    const bs = X.firstEl(ts, 'BlendingSetting');
    const op = bs && P.num(bs.attrs.Opacity);
    if (op !== undefined && op < 100) item.props.opacity = op;
    const ds = X.firstEl(ts, 'DropShadowSetting');
    if (ds && ds.attrs.Mode && ds.attrs.Mode !== 'None') ctx.unsupported('DropShadow');
    const fs = X.firstEl(ts, 'FeatherSetting');
    if (fs && fs.attrs.Mode && fs.attrs.Mode !== 'None') ctx.unsupported('Feather');
  }
  if (el.attrs.StrokeType && !/\/Solid$/.test(el.attrs.StrokeType) && el.attrs.StrokeColor && el.attrs.StrokeColor !== 'Swatch/None') ctx.count('strokeStyle');
  if (!item.props.fillColor) item.props.fillColor = ['sw', 'None'];
  if (!item.props.strokeColor) {
    if (kind === 'line') item.props.strokeColor = ['sw', 'Black'];
    else { item.props.strokeColor = ['sw', 'None']; if (item.props.strokeWeight === undefined) item.props.strokeWeight = 0; }
  }

  // geometría -> coordenadas "de pliego" (origen arriba-izquierda del pliego)
  const d = G.decompose(T);
  const O = sp.origin;
  const ui = (pt) => [pt[0] - O.x, pt[1] - O.y];
  let C = null;
  if (isBoxLike(kind, path, d)) {
    const ib = G.bbox(path.pts.map((p) => p.a));
    const cin = [(ib.x1 + ib.x2) / 2, (ib.y1 + ib.y2) / 2];
    C = G.apply(T, cin[0], cin[1]);
    const hw = (ib.x2 - ib.x1) * d.sx / 2; const hh = (ib.y2 - ib.y1) * Math.abs(d.sy) / 2;
    const c = ui(C);
    item.g = { m: 'b', b: [G.round(c[1] - hh, 3), G.round(c[0] - hw, 3), G.round(c[1] + hh, 3), G.round(c[0] + hw, 3)] };
    const rot = G.uiAngle(d.theta);
    if (rot !== 0) item.g.r = G.round(rot, 4);
    if (d.flipped) ctx.count('flipped');
  } else {
    const pts = path.pts.map((p) => {
      const a = ui(G.apply(T, p.a[0], p.a[1]));
      const out = [G.round(a[0], 3), G.round(a[1], 3)];
      if (!eq2(p.a, p.l) || !eq2(p.a, p.r)) {
        const l = ui(G.apply(T, p.l[0], p.l[1])); const r = ui(G.apply(T, p.r[0], p.r[1]));
        out.push(G.round(l[0], 3), G.round(l[1], 3), G.round(r[0], 3), G.round(r[1], 3));
      }
      return out;
    });
    const bb = G.bbox(pts.map((p) => [p[0], p[1]]));
    item.g = { m: 'p', pts, open: path.open, b: [G.round(bb.y1, 3), G.round(bb.x1, 3), G.round(bb.y2, 3), G.round(bb.x2, 3)] };
  }
  const bb = item.g.b;
  item.p = env.pageFor((bb[1] + bb[3]) / 2, (bb[0] + bb[2]) / 2);

  if (kind === 'text') {
    item.story = el.attrs.ParentStory;
    item.prev = el.attrs.PreviousTextFrame && el.attrs.PreviousTextFrame !== 'n' ? el.attrs.PreviousTextFrame : null;
    item.next = el.attrs.NextTextFrame && el.attrs.NextTextFrame !== 'n' ? el.attrs.NextTextFrame : null;
    env.frameIndex.set(item.id, item);
  } else {
    // ¿hay un gráfico dentro del marco?
    for (const k of X.kidsEl(el)) {
      if (GRAPHIC_TAGS.has(k.name)) { item.img = readGraphic(k, T, C, d, item, env); break; }
    }
  }
  if (kind === 'oval' && item.g.m === 'p') ctx.count('ovalPath');
  return item;
}

function readGraphic(gel, T, C, d, item, env) {
  const { ctx, model } = env;
  const link = X.firstEl(gel, 'Link');
  const P_ = X.firstEl(gel, 'Properties');
  const img = { tag: gel.name };
  if (link) {
    img.uri = uriToPath(link.attrs.LinkResourceURI);
    img.name = baseName(img.uri) || '';
    img.fmt = noId(link.attrs.LinkResourceFormat || '');
    img.embedded = link.attrs.StoredState === 'Embedded';
  }
  // imagen incrustada: sus bytes van como base64 en Properties/Contents
  const cont = (P_ && X.firstEl(P_, 'Contents')) || X.firstEl(gel, 'Contents');
  if (cont) {
    const txt = X.textOf(cont);
    if (txt.trim()) {
      try {
        const bytes = base64ToBytes(txt);
        let name = img.name || ('imagen_incrustada_' + (model.embedded.length + 1));
        if (!/\.[A-Za-z0-9]{2,4}$/.test(name)) {
          const ext = bytes[0] === 0x89 ? '.png' : bytes[0] === 0xFF ? '.jpg' : bytes[0] === 0x47 ? '.gif' : bytes[0] === 0x25 ? '.pdf' : bytes[0] === 0x49 || bytes[0] === 0x4D ? '.tif' : '';
          name += ext;
        }
        // evita nombres repetidos
        let n = name; let i = 2;
        while (model.embedded.some((e) => e.name === n)) n = name.replace(/(\.[^.]*)?$/, '_' + i++ + '$1');
        model.embedded.push({ name: n, bytes });
        img.saved = n; img.embedded = true;
        if (!img.name) img.name = n;
      } catch (e) { ctx.warn('No se pudo extraer una imagen incrustada: ' + e.message); }
    }
  }
  const gb = (P_ && X.firstEl(P_, 'GraphicBounds')) || X.firstEl(gel, 'GraphicBounds');
  const gm = G.parseMatrix(gel.attrs.ItemTransform);
  if (gb && C) {
    const l = P.num(gb.attrs.Left) || 0; const t = P.num(gb.attrs.Top) || 0; const r = P.num(gb.attrs.Right); const b = P.num(gb.attrs.Bottom);
    if (r !== undefined && b !== undefined) {
      const corners = [[l, t], [r, t], [r, b], [l, b]].map((c) => G.apply(gm, c[0], c[1]));
      const sc = corners.map((c) => G.apply(T, c[0], c[1]));
      const un = sc.map((c) => G.rotatePoint(c, C, -d.theta));
      const bb = G.bbox(un);
      const O = env.sp.origin;
      img.b = [G.round(bb.y1 - O.y, 3), G.round(bb.x1 - O.x, 3), G.round(bb.y2 - O.y, 3), G.round(bb.x2 - O.x, 3)];
      const cm = G.decompose(gm);
      if (Math.abs(G.uiAngle(cm.theta)) > 0.01 || Math.abs(cm.shear) > 1e-3) ctx.count('imgRotated');
    }
  }
  const pdfAttr = P_ && X.firstEl(P_, 'PDFAttribute');
  if (gel.name === 'PDF' || gel.name === 'ImportedPage') {
    const pa = X.firstEl(gel, 'PDFAttribute') || pdfAttr;
    if (pa && P.num(pa.attrs.PageNumber) > 1) img.page = P.num(pa.attrs.PageNumber);
  }
  if (!img.name && !img.saved) ctx.count('noLink');
  else if (!img.b) ctx.count('imgNoBounds');
  model.links.push({ name: img.name || '(sin nombre)', uri: img.uri || '', embedded: !!img.embedded, saved: img.saved || null, itemId: item.id, spreadId: env.sp.id, tag: gel.name });
  return img;
}

// ---- textos ------------------------------------------------------------------
const ACE_OK = new Set([0x07, 0x08, 0x17, 0x18, 0x19]);

function cleanText(s) {
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/\u2029/g, '\r');
}

function parseText(container, ctx) {
  let text = '';
  const pr = []; const cr = []; const tables = []; const notes = [];
  const SKIP = new Set(['Properties', 'Note', 'StoryPreference', 'InCopyExportOption', 'XMLAttribute']);
  const ANCHORED = new Set(['TextFrame', 'Rectangle', 'Oval', 'Polygon', 'GraphicLine', 'Group', 'Button']);

  function content(el) {
    let s = '';
    for (const k of el.kids) {
      if (k.text !== undefined) s += cleanText(k.text);
      else if (k.pi === 'ACE') {
        const code = parseInt(k.data, 16);
        if (ACE_OK.has(code)) s += String.fromCharCode(code); else ctx.unsupported('ACE ' + k.data);
      }
    }
    return s;
  }
  function inline(el) {
    switch (el.name) {
      case 'ParagraphStyleRange': return para(el);
      case 'CharacterStyleRange': return chars(el);
      case 'Content': text += content(el); return undefined;
      case 'Br': text += '\r'; return undefined;
      case 'Table': return table(el);
      case 'Footnote': return footnote(el);
      case 'TextVariableInstance': text += el.attrs.ResultText || ''; ctx.count('textVars'); return undefined;
      default:
        if (SKIP.has(el.name)) return undefined;
        if (el.name === 'Change' && /^Deleted/.test(el.attrs.ChangeType || '')) return undefined;      // texto borrado con control de cambios
        if (ANCHORED.has(el.name)) { ctx.count('anchored'); return undefined; }
        for (const k of X.kidsEl(el)) inline(k);
        return undefined;
    }
  }
  function para(el) {
    const start = text.length;
    const { props } = P.textProps(el, ctx);
    for (const k of X.kidsEl(el)) inline(k);
    if (text.length > start) pr.push({ s: start, e: text.length, style: el.attrs.AppliedParagraphStyle, props });
  }
  let supers = null;               // marcas de nota al pie dentro del rango de carácter actual
  function chars(el) {
    const start = text.length;
    const { props } = P.textProps(el, ctx);
    const saved = supers; supers = [];
    for (const k of X.kidsEl(el)) inline(k);
    const mine = supers; supers = saved;
    const style = el.attrs.AppliedCharacterStyle;
    if (text.length <= start) return;
    // los rangos no se solapan: el número de la nota al pie se separa del rango que lo contiene
    let pos = start;
    for (const m of mine) {
      if (m.s > pos) cr.push({ s: pos, e: m.s, style, props });
      cr.push({ s: m.s, e: m.e, style, props: Object.assign({}, props, { position: ['e', 'Position', 'Superscript'] }) });
      pos = m.e;
    }
    if (pos < text.length) cr.push({ s: pos, e: text.length, style, props });
  }
  function table(el) {
    const rows = X.kidsEl(el, 'Row'); const cols = X.kidsEl(el, 'Column');
    const t = {
      pos: text.length, rows: rows.length, cols: cols.length,
      header: P.num(el.attrs.HeaderRowCount) || 0, footer: P.num(el.attrs.FooterRowCount) || 0,
      rowH: rows.map((r) => P.num(r.attrs.SingleRowHeight) || 0), colW: cols.map((c) => P.num(c.attrs.SingleColumnWidth) || 0),
      cells: [],
    };
    for (const c of X.kidsEl(el, 'Cell')) {
      const nm = String(c.attrs.Name || '0:0').split(':');
      const inner = parseText(c, ctx);
      t.cells.push({
        c: Number(nm[0]) || 0, r: Number(nm[1]) || 0, rs: P.num(c.attrs.RowSpan) || 1, cs: P.num(c.attrs.ColumnSpan) || 1,
        fill: c.attrs.FillColor ? ctx.color(c.attrs.FillColor) : null,
        text: inner.text, pr: inner.pr, cr: inner.cr,
      });
    }
    if (t.rows && t.cols) tables.push(t);
    ctx.count('tables');
  }
  function footnote(el) {
    const n = notes.length + 1;
    const inner = parseText(el, ctx);
    notes.push({ n, text: inner.text.replace(/\r$/, '') });
    const start = text.length;
    text += String(n);
    if (supers) supers.push({ s: start, e: text.length });
    else cr.push({ s: start, e: text.length, style: null, props: { position: ['e', 'Position', 'Superscript'] } });
    ctx.count('footnotes');
  }
  for (const k of X.kidsEl(container)) inline(k);
  return { text, pr, cr, tables, notes };
}

function readStory(el, ctx) {
  const t = parseText(el, ctx);
  return { id: el.attrs.Self, text: t.text, pr: t.pr, cr: t.cr, tables: t.tables, notes: t.notes, frames: [] };
}

// ---- enlaces entre marcos ------------------------------------------------------
function linkStories(model, frameIndex, ctx) {
  const used = new Set();
  const heads = [];
  for (const f of frameIndex.values()) {
    if (!f.prev || !frameIndex.has(f.prev)) heads.push(f);
  }
  for (const h of heads) {
    const chain = [];
    let f = h; const guard = new Set();
    while (f && !guard.has(f.id)) {
      guard.add(f.id); chain.push(f.id); used.add(f.id);
      f = f.next ? frameIndex.get(f.next) : null;
    }
    const st = model.stories.get(h.story);
    if (st) { if (!st.frames.length) st.frames = chain; else st.frames = st.frames.concat(chain); }
    else ctx.warn('Un marco de texto apunta a un texto que no existe en el archivo (' + h.story + ').');
  }
  // ciclos raros: marcos no alcanzados
  for (const f of frameIndex.values()) {
    if (!used.has(f.id)) { f.prev = null; f.next = null; const st = model.stories.get(f.story); if (st && !st.frames.includes(f.id)) st.frames.push(f.id); }
  }
}

// ---- estilo de fuente heredado ---------------------------------------------------
// En IDML, un rango puede cambiar solo la familia (AppliedFont) y heredar el estilo (Bold...) de su
// párrafo. En CS3 el "tipo de letra" lleva ya el estilo, así que hay que decirlo explícitamente.
function resolveFontStyles(model) {
  const byId = new Map(model.pstyles.concat(model.cstyles).map((st) => [st.id, st]));
  const chain = (id, prop) => {
    const seen = new Set();
    while (id && !seen.has(id)) {
      seen.add(id);
      const st = byId.get(id);
      if (!st) return undefined;
      if (st.props[prop] !== undefined) return st.props[prop];
      id = st.basedOn;
    }
    return undefined;
  };
  for (const st of model.pstyles.concat(model.cstyles)) {
    if (st.props.appliedFont && st.props.fontStyle === undefined && st.basedOn) {
      const inh = chain(st.basedOn, 'fontStyle');
      if (inh !== undefined) st.props.fontStyle = inh;
    }
  }
  const cover = (arr, pos) => {                       // rango (ordenado por inicio) que contiene pos
    let lo = 0; let hi = arr.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid].e <= pos) lo = mid + 1; else if (arr[mid].s > pos) hi = mid - 1; else return arr[mid];
    }
    return null;
  };
  const fix = (pr, cr) => {
    for (const r of pr) {
      if (r.props.appliedFont && r.props.fontStyle === undefined) {
        const inh = chain(r.style, 'fontStyle');
        if (inh !== undefined) r.props.fontStyle = inh;
      }
    }
    for (const r of cr) {
      if (!r.props.appliedFont || r.props.fontStyle !== undefined) continue;
      let inh = r.style ? chain(r.style, 'fontStyle') : undefined;
      if (inh === undefined) {
        const p = cover(pr, r.s);
        if (p) inh = p.props.fontStyle !== undefined ? p.props.fontStyle : chain(p.style, 'fontStyle');
      }
      if (inh !== undefined) r.props.fontStyle = inh;
    }
  };
  for (const stt of model.stories.values()) {
    fix(stt.pr, stt.cr);
    for (const t of stt.tables) for (const c of t.cells) fix(c.pr, c.cr);
  }
}

// ---- fuentes usadas --------------------------------------------------------------
function collectFonts(model) {
  const used = new Map();
  const add = (fam, sty) => {
    if (!fam) return;
    const r = used.get(fam) || new Set();
    if (sty) r.add(sty);
    used.set(fam, r);
  };
  const basic = model.pstyles.find((st) => st.builtin === 'basic');
  if (basic && basic.props.appliedFont) add(basic.props.appliedFont, basic.props.fontStyle);
  for (const s of model.pstyles.concat(model.cstyles)) add(s.props.appliedFont, s.props.fontStyle);
  const scan = (arr) => { for (const r of arr) add(r.props.appliedFont, r.props.fontStyle); };
  for (const st of model.stories.values()) {
    scan(st.pr); scan(st.cr);
    for (const t of st.tables) for (const c of t.cells) { scan(c.pr); scan(c.cr); }
  }
  model.fonts = Array.from(used.entries()).map(([family, styles]) => {
    const f = model.fontFile && model.fontFile.get(family);
    return { family, styles: Array.from(styles), status: f ? f.status : 'Unknown' };
  }).sort((a, b) => a.family.localeCompare(b.family));
}

// ---- resumen, avisos de funciones no soportadas -------------------------------------
function finish(pkg, model, counters, ctx) {
  const all = pkg.texts.join('\n');
  const has = (re) => re.test(all);
  const f = model.features;
  f.hyperlinks = has(/<Hyperlink /);
  f.textVariables = has(/<TextVariableInstance /);
  f.conditions = has(/<Condition /);
  f.articles = has(/<Article /);
  f.textOnPath = has(/<TextPath /);
  f.nestedStyles = has(/<NestedStyle |<NestedGrepStyle |<GrepStyle |<NestedLineStyle /);

  const page = model.pages;
  const sizes = new Set(page.map((p) => Math.round(p.w) + 'x' + Math.round(p.h)));
  if (sizes.size > 1) ctx.warn('Hay páginas de distinto tamaño. CS3 no permite tamaños distintos en un mismo documento: se usará el tamaño de la primera página.');
  if (model.sections.length > 1 || (model.sections[0] && model.sections[0].style !== 'Arabic')) ctx.warn('El documento tiene varias secciones o numeración especial de páginas: solo se conserva el número de inicio de la primera sección.');
  if (model.spreads.some((sp) => sp.pages.length > 2)) ctx.warn('Hay pliegos con más de dos páginas; CS3 los coloca de otra forma y los objetos podrían descolocarse.');

  const msg = (key, one, many) => {
    const n = counters[key];
    if (n) ctx.warn((n === 1 ? one : many || one).replace('{n}', n));
  };
  msg('interactive', 'Hay 1 objeto interactivo (botón, formulario, multimedia…) que CS3 no admite: se ha omitido.', 'Hay {n} objetos interactivos (botones, formularios, multimedia…) que CS3 no admite: se han omitido.');
  msg('compound', 'Hay 1 objeto con trazado compuesto: se ha conservado solo el primer trazado.', 'Hay {n} objetos con trazado compuesto: se ha conservado solo el primer trazado de cada uno.');
  msg('flipped', '1 objeto está reflejado (espejo); CS3 lo recibirá sin el reflejo.', '{n} objetos están reflejados (espejo); CS3 los recibirá sin el reflejo.');
  msg('imgRotated', '1 imagen está girada o inclinada dentro de su marco: se coloca sin girar.', '{n} imágenes están giradas o inclinadas dentro de su marco: se colocan sin girar.');
  msg('anchored', 'Hay 1 objeto anclado dentro del texto (en línea); no se recrea.', 'Hay {n} objetos anclados dentro del texto (en línea); no se recrean.');
  msg('mixedInk', 'Hay tintas mixtas: no se recrean.');
  msg('strokeStyle', 'Hay 1 objeto con contorno discontinuo, punteado o de otro estilo: se recrea con contorno continuo.', 'Hay {n} objetos con contorno discontinuo, punteado o de otro estilo: se recrean con contorno continuo.');
  msg('textVars', 'Hay 1 variable de texto: se ha sustituido por su texto actual.', 'Hay {n} variables de texto: se han sustituido por su texto actual.');
  msg('footnotes', 'Hay 1 nota al pie. CS3 no tiene notas al pie automáticas: queda como un número en superíndice y su texto está en los archivos de textos y en el informe.', 'Hay {n} notas al pie. CS3 no tiene notas al pie automáticas: quedan como un número en superíndice y su texto está en los archivos de textos y en el informe.');
  msg('tables', 'Hay 1 tabla: se recrea de forma básica (contenido, anchos, altos y celdas combinadas); revisa los bordes y fondos.', 'Hay {n} tablas: se recrean de forma básica (contenido, anchos, altos y celdas combinadas); revisa los bordes y fondos.');
  msg('imgNoBounds', '1 imagen no trae su tamaño y posición dentro del marco: se ajusta al marco.', '{n} imágenes no traen su tamaño y posición dentro del marco: se ajustan al marco.');
  msg('noLink', '1 imagen no tiene vínculo a un archivo: se deja como marco vacío.', '{n} imágenes no tienen vínculo a un archivo: se dejan como marcos vacíos.');
  msg('u:DropShadow', 'Hay 1 objeto con sombra paralela: CS3 no la recibe (efecto omitido).', 'Hay {n} objetos con sombra paralela: CS3 no las recibe (efecto omitido).');
  msg('u:Feather', 'Hay 1 objeto con degradado de pluma o transparencia direccional: efecto omitido.', 'Hay {n} objetos con degradado de pluma o transparencia direccional: efecto omitido.');
  msg('u:AutoSizingType', 'Hay 1 marco con ajuste automático de tamaño (función de CS6): se deja con tamaño fijo.', 'Hay {n} marcos con ajuste automático de tamaño (función de CS6): se dejan con tamaño fijo.');
  msg('u:BulletsAndNumberingListType', 'Hay estilos o párrafos con numeración automática: no se recrea (el texto sí se conserva).');
  msg('u:ParagraphShadingOn', 'Hay párrafos con sombreado (función de CS5.5): no se recrea.');
  msg('u:ParagraphBorderOn', 'Hay párrafos con bordes (función de CS5.5): no se recrea.');
  msg('u:SpanColumnType', 'Hay párrafos que abarcan varias columnas (función de CS5): se dejan en una sola columna.');
  for (const k of Object.keys(counters)) if (k.startsWith('u:ACE')) ctx.warn('Se omitió un carácter especial de texto (código ' + k.slice(6) + ').');
  if (f.hyperlinks) ctx.warn('El documento tiene hipervínculos: no se recrean.');
  if (f.conditions) ctx.warn('El documento usa texto condicional (CS4): se muestra todo el texto.');
  if (f.articles) ctx.warn('El documento tiene artículos (CS6): se ignoran.');
  if (f.textOnPath) ctx.warn('Hay texto sobre un trazado: no se recrea (el texto está en los archivos de textos).');
  if (f.nestedStyles) ctx.warn('Hay estilos anidados o estilos GREP: no se recrean (el texto y su formato directo sí).');
  const guides = model.spreads.reduce((n, s) => n + s.guides, 0) + model.masters.reduce((n, s) => n + s.guides, 0);
  if (guides) ctx.info('Hay ' + guides + ' guías: no se recrean.');

  const items = (arr) => arr.reduce((n, it) => n + 1 + (it.kids ? items(it.kids) : 0), 0);
  model.stats = {
    pages: model.pages.length,
    spreads: model.spreads.length,
    masters: model.masters.length,
    items: model.spreads.reduce((n, s) => n + items(s.items), 0) + model.masters.reduce((n, s) => n + items(s.items), 0),
    stories: model.stories.size,
    images: model.links.length,
    embedded: model.embedded.length,
    fonts: model.fonts.length,
    pstyles: model.pstyles.length,
    cstyles: model.cstyles.length,
    colors: model.colors.length + model.tints.length + model.gradients.length,
  };
}

module.exports = { readPackage, buildModel, UserError, isIndd, base64ToBytes, uriToPath, baseName, ITEM_KIND };
