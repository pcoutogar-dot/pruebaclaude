'use strict';
// Recuperación de contenido e informes: textos (.txt y .rtf), informe HTML con mapa de páginas y LEEME.
const G = require('./geometry');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------------------------------------------------------------- colores
function lab2rgb(L, a, b) {
  const fy = (L + 16) / 116; const fx = fy + a / 500; const fz = fy - b / 200;
  const f = (t) => (t * t * t > 0.008856 ? t * t * t : (t - 16 / 116) / 7.787);
  const X = 0.95047 * f(fx); const Y = f(fy); const Z = 1.08883 * f(fz);
  const lin = [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.2040 * Y + 1.0570 * Z];
  return lin.map((c) => Math.round(255 * Math.max(0, Math.min(1, c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055))));
}

function swatchRgb(model, name, depth) {
  depth = depth || 0;
  if (!name || name === 'None' || depth > 4) return null;
  if (name === 'Black' || name === 'Registration') return [0, 0, 0];
  if (name === 'Paper') return [255, 255, 255];
  const c = model.colors.find((x) => x.name === name);
  if (c) {
    const v = c.value;
    if (c.space === 'RGB' && v.length >= 3) return v.slice(0, 3).map((x) => Math.round(x));
    if (c.space === 'CMYK' && v.length >= 4) {
      const k = 1 - v[3] / 100;
      return [0, 1, 2].map((i) => Math.round(255 * (1 - v[i] / 100) * k));
    }
    if (c.space === 'LAB' && v.length >= 3) return lab2rgb(v[0], v[1], v[2]);
    return [128, 128, 128];
  }
  const t = model.tints.find((x) => x.name === name);
  if (t) {
    const base = swatchRgb(model, t.base, depth + 1);
    if (!base) return null;
    const k = (t.value === undefined ? 100 : t.value) / 100;
    return base.map((x) => Math.round(255 - (255 - x) * k));
  }
  const g = model.gradients.find((x) => x.name === name);
  if (g && g.stops.length) return swatchRgb(model, g.stops[0].color, depth + 1);
  return null;
}
const hex = (rgb) => '#' + rgb.map((x) => x.toString(16).padStart(2, '0')).join('');

// ---------------------------------------------------------------- formato efectivo del texto
function styleMap(model) { return new Map(model.pstyles.concat(model.cstyles).map((s) => [s.id, s])); }
function chainProps(map, id) {
  const chain = []; const seen = new Set();
  while (id && !seen.has(id)) {
    seen.add(id);
    const st = map.get(id);
    if (!st) break;
    chain.unshift(st);
    id = st.basedOn;
  }
  return Object.assign({}, ...chain.map((s) => s.props));
}

// Parte el texto en segmentos con todas sus propiedades ya combinadas (estilo de párrafo < local < estilo de carácter < local).
function segmentsOf(model, text, pr, cr) {
  const map = styleMap(model);
  const cuts = new Set([0, text.length]);
  for (const r of pr) { cuts.add(r.s); cuts.add(r.e); }
  for (const r of cr) { cuts.add(r.s); cuts.add(r.e); }
  const pts = Array.from(cuts).filter((x) => x >= 0 && x <= text.length).sort((a, b) => a - b);
  const segs = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]; const b = pts[i + 1];
    const p = pr.find((r) => r.s <= a && a < r.e);
    const c = cr.find((r) => r.s <= a && a < r.e);
    const props = Object.assign({},
      p ? chainProps(map, p.style) : {}, p ? p.props : {},
      c && c.style ? chainProps(map, c.style) : {}, c ? c.props : {});
    segs.push({ s: a, e: b, text: text.slice(a, b), props, pstyle: p ? p.style : null });
  }
  return segs;
}

const swName = (v) => (Array.isArray(v) && v[0] === 'sw' ? v[1] : null);
const enName = (v) => (Array.isArray(v) && v[0] === 'e' ? v[2] : null);

// ---------------------------------------------------------------- texto plano
function plainText(s) {
  return s.replace(/\r/g, '\n').replace(/\u2028/g, '\n').replace(/[\u0007\u0008\u0017\u0018\u0019]/g, (c) => (c === '\u0007' || c === '\u0008' ? '\t' : '#'));
}

function storyPlain(model, st) {
  let out = plainText(st.text);
  for (const t of st.tables) {
    const rows = [];
    for (let r = 0; r < t.rows; r++) {
      const cells = [];
      for (let c = 0; c < t.cols; c++) {
        const cell = t.cells.find((x) => x.r === r && x.c === c);
        cells.push(cell ? plainText(cell.text).replace(/\n/g, ' / ') : '');
      }
      rows.push(cells.join('\t'));
    }
    out += '\n\n[Tabla de ' + t.rows + ' filas × ' + t.cols + ' columnas]\n' + rows.join('\n');
  }
  if (st.notes.length) out += '\n\n--- Notas al pie ---\n' + st.notes.map((n) => n.n + '. ' + n.text).join('\n');
  return out;
}

function slug(s) {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'texto';
}

// ---------------------------------------------------------------- dónde está cada texto
function locateStories(model) {
  const where = new Map();           // storyId -> { pages: [labels], master: bool }
  const note = (storyId, label, master) => {
    const w = where.get(storyId) || { pages: [], master };
    if (!w.pages.includes(label)) w.pages.push(label);
    where.set(storyId, w);
  };
  const walk = (items, label, master, page) => {
    for (const it of items) {
      if (it.t === 'group') { walk(it.kids, label, master, page); continue; }
      if (it.t === 'text' && it.story) note(it.story, typeof label === 'function' ? label(it) : label, master);
    }
  };
  for (const sp of model.spreads) walk(sp.items, (it) => { const pg = sp.pages[Math.min(it.p || 0, sp.pages.length - 1)]; return pg ? pg.label : '?'; }, false);
  for (const m of model.masters) walk(m.items, 'maestra ' + m.name, true);
  return where;
}

function textFiles(model, opts) {
  opts = opts || {};
  const files = [];
  const where = locateStories(model);
  let n = 0;
  const bom = '\ufeff';
  for (const st of model.stories.values()) {
    const visible = plainText(st.text).replace(/[#\s]/g, '');
    if (!visible && !st.tables.length) continue;
    n++;
    const w = where.get(st.id);
    const pg = w ? (w.master ? 'maestra' : 'p' + w.pages[0]) : 'sinmarco';
    const words = plainText(st.text).replace(/[#]/g, '').trim().split(/\s+/).slice(0, 4).join(' ');
    const base = String(n).padStart(2, '0') + '_' + pg + '_' + (words ? slug(words) : st.tables.length ? 'tabla' : 'texto');
    files.push({ name: 'textos/' + base + '.txt', data: bom + storyPlain(model, st).replace(/\n/g, '\r\n') });
    if (opts.rtf !== false) files.push({ name: 'textos_con_formato/' + base + '.rtf', data: storyRtf(model, st) });
  }
  return files;
}

// ---------------------------------------------------------------- RTF
function rtfEscape(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i); const ch = s[i];
    if (ch === '\\' || ch === '{' || ch === '}') out += '\\' + ch;
    else if (ch === '\t') out += '\\tab ';
    else if (c === 0x2028) out += '\\line ';
    else if (c === 0x07 || c === 0x08) out += '\\tab ';
    else if (c === 0x17 || c === 0x18 || c === 0x19) out += '#';
    else if (c < 32) out += '';
    else if (c > 126) out += '\\u' + (c > 32767 ? c - 65536 : c) + '?';
    else out += ch;
  }
  return out;
}

function storyRtf(model, st) {
  const fonts = []; const colors = [];
  const fontIdx = (name) => { let i = fonts.indexOf(name); if (i < 0) { fonts.push(name); i = fonts.length - 1; } return i; };
  const colorIdx = (rgb) => { const k = rgb.join(','); let i = colors.findIndex((c) => c.join(',') === k); if (i < 0) { colors.push(rgb); i = colors.length - 1; } return i + 1; };
  fontIdx('Times New Roman');
  const segs = segmentsOf(model, st.text, st.pr, st.cr);
  const twips = (v) => Math.round((v || 0) * 20);
  let body = '';
  let paraOpen = false;
  const openPara = (seg) => {
    const p = seg.props;
    const j = enName(p.justification);
    const al = j === 'CenterAlign' || j === 'CenterJustified' ? '\\qc' : j === 'RightAlign' || j === 'RightJustified' ? '\\qr' : j === 'FullyJustified' || j === 'LeftJustified' ? '\\qj' : '\\ql';
    body += '\\pard\\plain' + al + '\\li' + twips(p.leftIndent) + '\\ri' + twips(p.rightIndent) + '\\fi' + twips(p.firstLineIndent) +
      '\\sb' + twips(p.spaceBefore) + '\\sa' + twips(p.spaceAfter) + ' ';
    paraOpen = true;
  };
  for (const seg of segs) {
    const parts = seg.text.split('\r');
    for (let k = 0; k < parts.length; k++) {
      if (!paraOpen) openPara(seg);
      if (parts[k]) {
        const p = seg.props;
        const fam = p.appliedFont || 'Times New Roman';
        const sty = String(p.fontStyle || '');
        let fmt = '\\f' + fontIdx(fam);
        if (p.pointSize) fmt += '\\fs' + Math.round(p.pointSize * 2);
        if (/bold/i.test(sty)) fmt += '\\b';
        if (/italic|oblique/i.test(sty)) fmt += '\\i';
        if (p.underline === true) fmt += '\\ul';
        if (p.strikeThru === true) fmt += '\\strike';
        const pos = enName(p.position);
        if (pos === 'Superscript' || pos === 'OTSuperscript') fmt += '\\super';
        else if (pos === 'Subscript' || pos === 'OTSubscript') fmt += '\\sub';
        const cap = enName(p.capitalization);
        if (cap === 'AllCaps') fmt += '\\caps'; else if (cap === 'SmallCaps') fmt += '\\scaps';
        const rgb = swatchRgb(model, swName(p.fillColor));
        if (rgb) fmt += '\\cf' + colorIdx(rgb);
        body += '{' + fmt + ' ' + rtfEscape(parts[k]) + '}';
      }
      if (k < parts.length - 1) { body += '\\par\n'; paraOpen = false; }
    }
  }
  const fontTbl = '{\\fonttbl' + fonts.map((f, i) => '{\\f' + i + '\\fnil ' + rtfEscape(f) + ';}').join('') + '}';
  const colorTbl = '{\\colortbl;' + colors.map((c) => '\\red' + c[0] + '\\green' + c[1] + '\\blue' + c[2] + ';').join('') + '}';
  return '{\\rtf1\\ansi\\ansicpg1252\\deff0\n' + fontTbl + '\n' + colorTbl + '\n' + body + '}';
}

// ---------------------------------------------------------------- mapa de páginas (SVG)
function itemBox(it) { return it.g ? it.g.b : null; }

function svgItems(model, items, out, excerpts) {
  for (const it of items) {
    if (it.t === 'group') { svgItems(model, it.kids, out, excerpts); continue; }
    const g = it.g; if (!g) continue;
    const b = g.b; const x = b[1]; const y = b[0]; const w = b[3] - b[1]; const h = b[2] - b[0];
    const fillName = swName(it.props.fillColor);
    const rgb = swatchRgb(model, fillName);
    const strokeRgb = swatchRgb(model, swName(it.props.strokeColor));
    let fill = rgb ? hex(rgb) : 'none';
    let stroke = strokeRgb ? hex(strokeRgb) : '#9aa0a6';
    let extra = ' stroke-width="0.8"';
    let label = '';
    if (it.t === 'text') {
      fill = 'rgba(66,133,244,0.10)'; stroke = '#4285f4';
      const ex = excerpts.get(it.story);
      if (ex) label = '<text x="' + (x + 3) + '" y="' + (y + 11) + '" font-size="9" fill="#174ea6" clip-path="url(#c' + esc(it.id) + ')">' + esc(ex) + '</text>';
    } else if (it.img) {
      fill = 'rgba(52,168,83,0.15)'; stroke = '#188038';
      const nm = it.img.name || it.img.saved || 'imagen';
      label = '<text x="' + (x + 3) + '" y="' + (y + 11) + '" font-size="9" fill="#137333" clip-path="url(#c' + esc(it.id) + ')">' + esc(nm) + '</text>';
    }
    const clip = label.includes('clip-path') ? '<clipPath id="c' + esc(it.id) + '"><rect x="' + x + '" y="' + y + '" width="' + Math.max(0, w) + '" height="' + Math.max(0, h) + '"/></clipPath>' : '';
    let shape;
    if (g.m === 'b') {
      const rot = g.r ? ' transform="rotate(' + (-g.r) + ' ' + (x + w / 2) + ' ' + (y + h / 2) + ')"' : '';
      shape = it.t === 'oval'
        ? '<ellipse cx="' + (x + w / 2) + '" cy="' + (y + h / 2) + '" rx="' + w / 2 + '" ry="' + h / 2 + '" fill="' + fill + '" stroke="' + stroke + '"' + extra + rot + '/>'
        : '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + fill + '" stroke="' + stroke + '"' + extra + rot + '/>';
      if (label && g.r) label = '<g' + rot + '>' + label + '</g>';
    } else {
      const pts = g.pts.map((p) => p[0] + ',' + p[1]).join(' ');
      shape = g.open
        ? '<polyline points="' + pts + '" fill="none" stroke="' + (strokeRgb ? stroke : '#5f6368') + '" stroke-width="' + Math.max(0.8, it.props.strokeWeight || 1) + '"/>'
        : '<polygon points="' + pts + '" fill="' + fill + '" stroke="' + stroke + '"' + extra + '/>';
    }
    out.push(clip + shape + label);
  }
}

function spreadSvg(model, sp, excerpts, title) {
  let x1 = 0; let y1 = 0; let x2 = 0; let y2 = 0;
  for (const p of sp.pages) { x2 = Math.max(x2, p.x + p.w); y2 = Math.max(y2, p.y + p.h); }
  const shapes = [];
  svgItems(model, sp.items, shapes, excerpts);
  const pad = 14;
  const W = x2 - x1 + pad * 2; const H = y2 - y1 + pad * 2;
  const scale = Math.min(1, 720 / W);
  const pages = sp.pages.map((p) => '<rect x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h + '" fill="#fff" stroke="#bbb"/>' +
    '<text x="' + (p.x + p.w / 2) + '" y="' + (p.y + p.h + 10) + '" font-size="9" text-anchor="middle" fill="#777">' + esc(p.label || '') + '</text>').join('');
  return '<svg role="img" aria-label="' + esc(title) + '" xmlns="http://www.w3.org/2000/svg" viewBox="' + (x1 - pad) + ' ' + (y1 - pad) + ' ' + W + ' ' + (H + 6) + '" width="' + Math.round(W * scale) + '" height="' + Math.round((H + 6) * scale) + '" style="background:#f1f3f4;border-radius:6px">' +
    pages + shapes.join('') + '</svg>';
}

// ---------------------------------------------------------------- informe HTML
function reportHtml(model, ctx) {
  ctx = ctx || {};
  const where = locateStories(model);
  const excerpts = new Map();
  for (const st of model.stories.values()) {
    const t = plainText(st.text).replace(/\s+/g, ' ').trim();
    if (t) excerpts.set(st.id, t.slice(0, 80));
  }
  const s = model.stats;
  const warn = model.warnings.filter((w) => w.level === 'warn');
  const info = model.warnings.filter((w) => w.level === 'info');
  const p0 = model.pages[0];
  const mm = (v) => Math.round(v / 72 * 25.4 * 10) / 10;
  const rows = (arr, fn) => arr.map(fn).join('');
  const fontsTable = rows(model.fonts, (f) => '<tr><td>' + esc(f.family) + '</td><td>' + esc(f.styles.join(', ') || '—') + '</td><td>' + (f.status === 'Installed' || f.status === 'Unknown' ? '' : '<span class="tag bad">no estaba disponible en el original</span>') + '</td></tr>');
  const colorsTable = rows(model.colors.concat(model.tints.map((t) => ({ name: t.name, space: 'Tono', model: '', value: [t.value], tint: true })), model.gradients.map((g) => ({ name: g.name, space: 'Degradado', model: '', value: [], grad: true }))), (c) => {
    const rgb = swatchRgb(model, c.name);
    const chip = rgb ? '<span class="chip" style="background:' + hex(rgb) + '"></span>' : '';
    const val = c.tint ? c.value[0] + '%' : c.grad ? '' : c.space + ' ' + c.value.join(' ') + (c.model === 'Spot' ? ' (directa)' : '');
    return '<tr><td>' + chip + esc(c.name) + '</td><td>' + esc(val) + '</td></tr>';
  });
  const imgs = rows(model.links, (l) => {
    const pgs = model.spreads.find((sp) => sp.id === l.spreadId);
    return '<tr><td>' + esc(l.name) + '</td><td>' + (l.embedded ? '<span class="tag ok">incrustada' + (l.saved ? ' → imagenes_incrustadas/' + esc(l.saved) : '') + '</span>' : esc(l.uri || '—')) + '</td></tr>';
  });
  const storiesRows = rows(Array.from(model.stories.values()).filter((st) => excerpts.has(st.id)), (st) => {
    const w = where.get(st.id);
    return '<tr><td>' + (w ? esc((w.master ? '' : 'pág. ') + w.pages.join(', ')) : '—') + '</td><td>' + esc(excerpts.get(st.id)) + (st.text.length > 80 ? '…' : '') + '</td></tr>';
  });
  const spreads = model.spreads.map((sp, i) => {
    const labels = sp.pages.map((p) => p.label).join('–');
    return '<h3>Pliego ' + (i + 1) + ' · página' + (sp.pages.length > 1 ? 's ' : ' ') + esc(labels) + '</h3>' + spreadSvg(model, sp, excerpts, 'Mapa del pliego ' + (i + 1));
  }).join('');
  const masters = model.masters.map((m) => '<h3>Maestra ' + esc(m.name) + '</h3>' + spreadSvg(model, m, excerpts, 'Mapa de la maestra ' + m.name)).join('');
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Informe · ' + esc(model.name) + '</title>' +
    '<style>:root{--fg:#202124;--bg:#fff;--muted:#5f6368;--line:#dadce0;--card:#f8f9fa}@media(prefers-color-scheme:dark){:root{--fg:#e8eaed;--bg:#202124;--muted:#9aa0a6;--line:#3c4043;--card:#28292c}}' +
    'body{font:15px/1.5 system-ui,Segoe UI,Roboto,sans-serif;color:var(--fg);background:var(--bg);margin:0;padding:24px 16px}main{max-width:820px;margin:0 auto}h1{font-size:24px;margin:0 0 4px}h2{font-size:18px;margin:32px 0 8px;border-top:1px solid var(--line);padding-top:16px}h3{font-size:15px;margin:20px 0 6px}' +
    'table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top;font-size:14px}th{color:var(--muted);font-weight:600}' +
    '.sub{color:var(--muted)}.chip{display:inline-block;width:14px;height:14px;border-radius:3px;border:1px solid var(--line);vertical-align:-2px;margin-right:6px}.tag{font-size:12px;padding:1px 6px;border-radius:10px;border:1px solid var(--line)}.bad{color:#d93025;border-color:#d93025}.ok{color:#188038;border-color:#188038}' +
    '.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px}.stat{background:var(--card);border-radius:8px;padding:10px 12px}.stat b{display:block;font-size:20px}svg{max-width:100%;height:auto}ul{padding-left:20px}</style></head><body><main>' +
    '<h1>Informe de conversión</h1><p class="sub">' + esc(model.name) + (ctx.date ? ' · ' + esc(ctx.date) : '') + ' · IDML DOMVersion ' + esc(model.domVersion || '?') + '</p>' +
    '<div class="grid"><div class="stat"><b>' + s.pages + '</b>páginas</div><div class="stat"><b>' + (p0 ? mm(p0.w) + ' × ' + mm(p0.h) : '—') + '</b>mm por página</div><div class="stat"><b>' + s.items + '</b>objetos</div><div class="stat"><b>' + s.stories + '</b>textos</div><div class="stat"><b>' + s.images + '</b>imágenes</div><div class="stat"><b>' + s.fonts + '</b>fuentes</div></div>' +
    '<h2>Avisos</h2>' + (warn.length ? '<ul>' + warn.map((w) => '<li>' + esc(w.text) + '</li>').join('') + '</ul>' : '<p>Sin avisos.</p>') + (info.length ? '<p class="sub">' + info.map((w) => esc(w.text)).join(' ') + '</p>' : '') +
    '<h2>Fuentes que hay que instalar en el ordenador con CS3</h2><table><tr><th>Familia</th><th>Estilos usados</th><th></th></tr>' + (fontsTable || '<tr><td colspan="3">—</td></tr>') + '</table>' +
    '<h2>Imágenes enlazadas</h2><p class="sub">Copia estos archivos a la carpeta donde pongas el script (o elige su carpeta cuando el script lo pida).</p><table><tr><th>Archivo</th><th>Ruta original</th></tr>' + (imgs || '<tr><td colspan="2">—</td></tr>') + '</table>' +
    '<h2>Colores</h2><table><tr><th>Nombre</th><th>Valor</th></tr>' + (colorsTable || '<tr><td colspan="2">—</td></tr>') + '</table>' +
    '<h2>Textos</h2><table><tr><th>Dónde</th><th>Comienzo</th></tr>' + (storiesRows || '<tr><td colspan="2">—</td></tr>') + '</table>' +
    '<h2>Mapa de páginas</h2><p class="sub">Azul: marcos de texto · Verde: imágenes · Gris: formas.</p>' + spreads + (masters ? '<h2>Páginas maestras</h2>' + masters : '') +
    '</main></body></html>';
}

// ---------------------------------------------------------------- LEEME
function leeme(model, names, ctx) {
  ctx = ctx || {};
  const L = [];
  L.push('DE INDESIGN CS6 A INDESIGN CS3');
  L.push('==============================');
  L.push('Documento: ' + model.name + (ctx.date ? '   (convertido el ' + ctx.date + ')' : ''));
  L.push('');
  L.push('QUE HAY EN ESTA CARPETA');
  L.push('  ' + names.jsx + '   Script que RECONSTRUYE el documento en CS3 (el metodo recomendado).');
  if (names.inx) L.push('  ' + names.inx + '   Intento EXPERIMENTAL de convertir a INX. Puede que CS3 no lo abra.');
  L.push('  informe.html   Fuentes, colores, imagenes y un mapa de cada pagina.');
  L.push('  textos/        Todos los textos en .txt (por si hay que rehacer algo a mano).');
  L.push('  textos_con_formato/   Los mismos textos en .rtf, con fuente, tamano y color.');
  if (model.embedded.length) L.push('  imagenes_incrustadas/   Imagenes que estaban incrustadas en el documento.');
  L.push('');
  L.push('PASOS EN EL ORDENADOR CON CS3');
  L.push('  1. Copia esta carpeta entera al ordenador viejo (memoria USB, red...).');
  L.push('     Copia TAMBIEN las imagenes enlazadas del documento (la carpeta "Links"');
  L.push('     o las que aparecen en informe.html) dentro de esta misma carpeta.');
  L.push('  2. Instala en ese ordenador las fuentes que indica informe.html.');
  L.push('     Si falta alguna, el script usa otra y te lo avisa al terminar.');
  L.push('  3. Abre InDesign CS3 y ve a  Ventana > Automatizacion > Scripts.');
  L.push('  4. En el panel Scripts, clic derecho sobre "Usuario" > "Mostrar en el Explorador"');
  L.push('     (Mac: "Mostrar en el Finder"). Copia ahi el archivo ' + names.jsx + '.');
  L.push('  5. Vuelve a InDesign: el script aparece dentro de "Usuario". Haz doble clic.');
  L.push('     Si pide la carpeta de imagenes, eligela. Se crea un DOCUMENTO NUEVO.');
  L.push('  6. Revisa el resultado con el informe al lado y guarda como .indd.');
  L.push('');
  L.push('IMPORTANTE');
  L.push('  - El script no modifica ningun documento existente: siempre crea uno nuevo.');
  L.push('  - Se conserva: paginas, maestras, capas, colores, estilos, textos con su formato,');
  L.push('    marcos enlazados, imagenes, formas y tablas basicas.');
  L.push('  - No se conserva lo que CS3 no tiene (efectos de CS5/CS6, notas al pie,');
  L.push('    hipervinculos, objetos interactivos...). Los avisos estan en informe.html.');
  L.push('  - Si el resultado no es el esperado, usa los textos de la carpeta textos/.');
  if (names.inx) {
    L.push('');
    L.push('SOBRE EL ARCHIVO .INX EXPERIMENTAL');
    L.push('  Es el mismo contenido en el formato de intercambio XML de InDesign con la version');
    L.push('  rebajada a CS3. No se ha podido probar con un CS3 real. Pruebalo con Archivo > Abrir;');
    L.push('  si da error o sale incompleto, usa el script (.jsx).');
  }
  return L.join('\r\n') + '\r\n';
}

module.exports = { textFiles, reportHtml, leeme, storyRtf, storyPlain, segmentsOf, swatchRgb, spreadSvg, locateStories, plainText, slug };
