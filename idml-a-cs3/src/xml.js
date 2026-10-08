'use strict';
// Analizador XML mínimo (sin dependencias) pensado para IDML: bien formado,
// generado por máquina, con espacios de nombres tratados como parte del nombre.
//
// Nodos:
//   elemento -> { name, attrs: {k: v}, kids: [nodo...] }
//   texto    -> { text }
//   instrucción de proceso (<?ACE 18?>) -> { pi, data }

const ENTITIES = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

function decodeEntities(s) {
  if (s.indexOf('&') < 0) return s;
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (m, e) => {
    if (e[0] === '#') {
      const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try { return String.fromCodePoint(cp); } catch (_) { return ''; }
    }
    return Object.prototype.hasOwnProperty.call(ENTITIES, e) ? ENTITIES[e] : m;
  });
}

function isWhitespace(s) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c !== 32 && c !== 9 && c !== 10 && c !== 13) return false;
  }
  return true;
}

function isEl(n) { return n.name !== undefined; }

function parseXml(src) {
  if (src.charCodeAt(0) === 0xFEFF) src = src.slice(1);
  const n = src.length;
  let i = 0;
  let root = null;
  const stack = [];
  let cur = null;

  function closeEl(el) {
    // En elementos con hijos-elemento se descartan los espacios de formato.
    let hasEl = false;
    for (const k of el.kids) if (isEl(k)) { hasEl = true; break; }
    if (hasEl) el.kids = el.kids.filter((k) => k.text === undefined || !isWhitespace(k.text));
  }

  function addText(t) {
    if (t === '' || !cur) return;
    const last = cur.kids[cur.kids.length - 1];
    if (last && last.text !== undefined) last.text += t; else cur.kids.push({ text: t });
  }

  while (i < n) {
    const lt = src.indexOf('<', i);
    if (lt < 0) { addText(decodeEntities(src.slice(i))); break; }
    if (lt > i) addText(decodeEntities(src.slice(i, lt)));
    i = lt;
    if (src.startsWith('<!--', i)) {
      const e = src.indexOf('-->', i + 4);
      if (e < 0) throw new Error('XML: comentario sin cerrar');
      i = e + 3;
    } else if (src.startsWith('<![CDATA[', i)) {
      const e = src.indexOf(']]>', i + 9);
      if (e < 0) throw new Error('XML: CDATA sin cerrar');
      addText(src.slice(i + 9, e));
      i = e + 3;
    } else if (src.startsWith('<?', i)) {
      const e = src.indexOf('?>', i + 2);
      if (e < 0) throw new Error('XML: instrucción sin cerrar');
      const body = src.slice(i + 2, e);
      const sp = body.search(/\s/);
      const name = sp < 0 ? body : body.slice(0, sp);
      const data = sp < 0 ? '' : body.slice(sp + 1).trim();
      if (name !== 'xml' && cur) cur.kids.push({ pi: name, data });
      i = e + 2;
    } else if (src.startsWith('<!', i)) {
      // DOCTYPE u otras declaraciones; se admite un subconjunto interno [...]
      let depth = 0; let j = i + 2;
      for (; j < n; j++) {
        const c = src[j];
        if (c === '[') depth++; else if (c === ']') depth--; else if (c === '>' && depth <= 0) break;
      }
      i = j + 1;
    } else if (src[i + 1] === '/') {
      const e = src.indexOf('>', i + 2);
      if (e < 0) throw new Error('XML: etiqueta de cierre sin terminar');
      const name = src.slice(i + 2, e).trim();
      if (!cur || cur.name !== name) throw new Error('XML: se esperaba </' + (cur && cur.name) + '> y se encontró </' + name + '>');
      closeEl(cur);
      cur = stack.pop() || null;
      i = e + 1;
    } else {
      // etiqueta de apertura
      let j = i + 1;
      while (j < n && !/[\s/>]/.test(src[j])) j++;
      const el = { name: src.slice(i + 1, j), attrs: {}, kids: [] };
      let selfClose = false;
      for (;;) {
        while (j < n && /\s/.test(src[j])) j++;
        if (j >= n) throw new Error('XML: etiqueta sin terminar');
        const c = src[j];
        if (c === '>') { j++; break; }
        if (c === '/') { selfClose = true; j = src.indexOf('>', j) + 1; break; }
        let k = j;
        while (k < n && !/[\s=/>]/.test(src[k])) k++;
        const an = src.slice(j, k);
        j = k;
        while (j < n && /\s/.test(src[j])) j++;
        if (src[j] !== '=') { el.attrs[an] = ''; continue; }
        j++;
        while (j < n && /\s/.test(src[j])) j++;
        const q = src[j];
        if (q !== '"' && q !== "'") throw new Error('XML: atributo sin comillas: ' + an);
        const e = src.indexOf(q, j + 1);
        if (e < 0) throw new Error('XML: atributo sin cerrar: ' + an);
        el.attrs[an] = decodeEntities(src.slice(j + 1, e));
        j = e + 1;
      }
      if (cur) cur.kids.push(el); else if (!root) root = el; else throw new Error('XML: más de un elemento raíz');
      if (!selfClose) { stack.push(cur); cur = el; }
      i = j;
    }
  }
  if (cur) throw new Error('XML: falta cerrar <' + cur.name + '>');
  if (!root) throw new Error('XML: documento vacío');
  return root;
}

// ---- utilidades de consulta ----
function kidsEl(el, name) {
  const out = [];
  for (const k of el.kids) if (isEl(k) && (name === undefined || k.name === name)) out.push(k);
  return out;
}
function firstEl(el, name) {
  for (const k of el.kids) if (isEl(k) && k.name === name) return k;
  return null;
}
function textOf(el) {
  let s = '';
  for (const k of el.kids) {
    if (k.text !== undefined) s += k.text; else if (isEl(k)) s += textOf(k);
  }
  return s;
}
function walk(el, fn) {
  fn(el);
  for (const k of el.kids) if (isEl(k)) walk(k, fn);
}

// ---- serialización ----
function escText(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r/g, '&#xD;');
}
function escAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
    .replace(/\t/g, '&#x9;').replace(/\n/g, '&#xA;').replace(/\r/g, '&#xD;');
}

function serialize(el, indent) {
  indent = indent || '';
  let s = indent + '<' + el.name;
  for (const k of Object.keys(el.attrs)) s += ' ' + k + '="' + escAttr(String(el.attrs[k])) + '"';
  if (el.kids.length === 0) return s + '/>';
  const structural = el.kids.some(isEl);
  if (!structural) {
    s += '>';
    for (const k of el.kids) {
      if (k.text !== undefined) s += escText(k.text); else if (k.pi !== undefined) s += '<?' + k.pi + (k.data ? ' ' + k.data : '') + '?>';
    }
    return s + '</' + el.name + '>';
  }
  s += '>';
  for (const k of el.kids) {
    if (isEl(k)) s += '\n' + serialize(k, indent + ' ');
    else if (k.pi !== undefined) s += '\n' + indent + ' <?' + k.pi + (k.data ? ' ' + k.data : '') + '?>';
    else if (k.text !== undefined && !isWhitespace(k.text)) s += escText(k.text);
  }
  return s + '\n' + indent + '</' + el.name + '>';
}

module.exports = { parseXml, isEl, kidsEl, firstEl, textOf, walk, serialize, decodeEntities, escText, escAttr };
