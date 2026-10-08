'use strict';
// Lectura y escritura de ZIP sin dependencias (funciona igual en Node y navegador).
// - Lectura: método 0 (almacenado) y 8 (deflate, con un "inflate" propio).
// - Escritura: solo almacenado (suficiente y a prueba de fallos).

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ------------------------------------------------------------------ inflate
const LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const CL_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

function buildHuff(lengths) {
  const count = new Uint16Array(16);
  for (let i = 0; i < lengths.length; i++) count[lengths[i]]++;
  const offs = new Uint16Array(16);
  for (let len = 1; len < 15; len++) offs[len + 1] = offs[len] + count[len];
  const symbol = new Uint16Array(lengths.length);
  for (let s = 0; s < lengths.length; s++) if (lengths[s] !== 0) symbol[offs[lengths[s]]++] = s;
  return { count, symbol };
}

let FIXED = null;
function fixedTables() {
  if (FIXED) return FIXED;
  const l = new Uint8Array(288);
  for (let i = 0; i < 144; i++) l[i] = 8;
  for (let i = 144; i < 256; i++) l[i] = 9;
  for (let i = 256; i < 280; i++) l[i] = 7;
  for (let i = 280; i < 288; i++) l[i] = 8;
  const d = new Uint8Array(30).fill(5);
  FIXED = { lit: buildHuff(l), dist: buildHuff(d) };
  return FIXED;
}

function inflatePure(src, sizeHint) {
  let pos = 0; let bitbuf = 0; let bitcnt = 0;
  let out = new Uint8Array(Math.max(sizeHint || 0, src.length * 3, 1024));
  let op = 0;

  function ensure(extra) {
    if (op + extra <= out.length) return;
    let n = out.length * 2;
    while (n < op + extra) n *= 2;
    const o2 = new Uint8Array(n); o2.set(out.subarray(0, op)); out = o2;
  }
  function bits(need) {
    let val = bitbuf;
    while (bitcnt < need) {
      if (pos >= src.length) throw new Error('ZIP: datos comprimidos truncados');
      val |= src[pos++] << bitcnt;
      bitcnt += 8;
    }
    bitbuf = val >>> need;
    bitcnt -= need;
    return val & ((1 << need) - 1);
  }
  function decode(h) {
    let code = 0; let first = 0; let index = 0;
    for (let len = 1; len <= 15; len++) {
      code |= bits(1);
      const c = h.count[len];
      if (code - c < first) return h.symbol[index + (code - first)];
      index += c; first += c; first <<= 1; code <<= 1;
    }
    throw new Error('ZIP: código de Huffman no válido');
  }
  function codes(lit, dist) {
    for (;;) {
      let sym = decode(lit);
      if (sym < 256) { ensure(1); out[op++] = sym; continue; }
      if (sym === 256) return;
      sym -= 257;
      if (sym >= 29) throw new Error('ZIP: símbolo de longitud no válido');
      const len = LBASE[sym] + bits(LEXT[sym]);
      const ds = decode(dist);
      if (ds >= 30) throw new Error('ZIP: símbolo de distancia no válido');
      const d = DBASE[ds] + bits(DEXT[ds]);
      if (d > op) throw new Error('ZIP: distancia fuera de rango');
      ensure(len);
      for (let k = 0; k < len; k++) { out[op] = out[op - d]; op++; }
    }
  }

  let last;
  do {
    last = bits(1);
    const type = bits(2);
    if (type === 0) {
      bitbuf = 0; bitcnt = 0;
      if (pos + 4 > src.length) throw new Error('ZIP: bloque almacenado truncado');
      const len = src[pos] | (src[pos + 1] << 8);
      pos += 4;
      if (pos + len > src.length) throw new Error('ZIP: bloque almacenado truncado');
      ensure(len);
      out.set(src.subarray(pos, pos + len), op);
      op += len; pos += len;
    } else if (type === 1) {
      const t = fixedTables();
      codes(t.lit, t.dist);
    } else if (type === 2) {
      const nlen = bits(5) + 257; const ndist = bits(5) + 1; const ncode = bits(4) + 4;
      const lengths = new Uint8Array(320);
      for (let i = 0; i < ncode; i++) lengths[CL_ORDER[i]] = bits(3);
      const clh = buildHuff(lengths.subarray(0, 19));
      const ll = new Uint8Array(nlen + ndist);
      let idx = 0;
      while (idx < nlen + ndist) {
        let sym = decode(clh);
        if (sym < 16) { ll[idx++] = sym; continue; }
        let rep; let val = 0;
        if (sym === 16) {
          if (idx === 0) throw new Error('ZIP: repetición sin longitud previa');
          val = ll[idx - 1]; rep = 3 + bits(2);
        } else if (sym === 17) rep = 3 + bits(3); else rep = 11 + bits(7);
        if (idx + rep > nlen + ndist) throw new Error('ZIP: demasiadas longitudes');
        while (rep--) ll[idx++] = val;
      }
      codes(buildHuff(ll.subarray(0, nlen)), buildHuff(ll.subarray(nlen)));
    } else {
      throw new Error('ZIP: tipo de bloque no válido');
    }
  } while (!last);
  return out.slice(0, op);
}

let nodeZlib; // undefined = sin probar, null = no disponible
function inflateRaw(src, sizeHint, opts) {
  const useNative = !(opts && opts.native === false);
  if (useNative) {
    if (nodeZlib === undefined) {
      nodeZlib = null;
      try {
        if (typeof process !== 'undefined' && process.versions && process.versions.node && typeof require === 'function') {
          nodeZlib = require('zlib');
        }
      } catch (_) { nodeZlib = null; }
    }
    if (nodeZlib) {
      const b = nodeZlib.inflateRawSync(Buffer.from(src.buffer, src.byteOffset, src.byteLength));
      return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
    }
  }
  return inflatePure(src, sizeHint);
}

// ------------------------------------------------------------------ lectura
function decodeName(bytes, flags) {
  try { return new TextDecoder(flags & 0x800 ? 'utf-8' : 'utf-8', { fatal: true }).decode(bytes); } catch (_) {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return s;
  }
}

// Devuelve { names: [..], get(name) -> Uint8Array|null, has(name) }
function readZip(u8, opts) {
  if (!(u8 instanceof Uint8Array)) u8 = new Uint8Array(u8);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 22 - 65535); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('El archivo no es un ZIP válido (¿es realmente un .idml?).');
  const total = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const entries = new Map();
  for (let n = 0; n < total; n++) {
    if (p + 46 > u8.length || dv.getUint32(p, true) !== 0x02014b50) throw new Error('ZIP: directorio central dañado');
    const flags = dv.getUint16(p + 8, true);
    const method = dv.getUint16(p + 10, true);
    const crc = dv.getUint32(p + 16, true);
    const csize = dv.getUint32(p + 20, true);
    const usize = dv.getUint32(p + 24, true);
    const nlen = dv.getUint16(p + 28, true);
    const elen = dv.getUint16(p + 30, true);
    const clen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const name = decodeName(u8.subarray(p + 46, p + 46 + nlen), flags);
    entries.set(name, { name, method, crc, csize, usize, lho });
    p += 46 + nlen + elen + clen;
  }
  const cache = new Map();
  function get(name) {
    if (cache.has(name)) return cache.get(name);
    const e = entries.get(name);
    if (!e) return null;
    if (dv.getUint32(e.lho, true) !== 0x04034b50) throw new Error('ZIP: cabecera local dañada en ' + name);
    const start = e.lho + 30 + dv.getUint16(e.lho + 26, true) + dv.getUint16(e.lho + 28, true);
    const raw = u8.subarray(start, start + e.csize);
    let data;
    if (e.method === 0) data = raw;
    else if (e.method === 8) data = inflateRaw(raw, e.usize, opts);
    else throw new Error('ZIP: método de compresión no soportado (' + e.method + ') en ' + name);
    cache.set(name, data);
    return data;
  }
  return { names: Array.from(entries.keys()), get, has: (n) => entries.has(n), size: (n) => (entries.has(n) ? entries.get(n).usize : 0) };
}

// ----------------------------------------------------------------- escritura
function toBytes(d) {
  if (typeof d === 'string') return new TextEncoder().encode(d);
  if (d instanceof Uint8Array) return d;
  return new Uint8Array(d);
}

// files: [{ name, data: string|Uint8Array }]
function writeZip(files) {
  const enc = new TextEncoder();
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const parts = []; const central = [];
  let offset = 0;
  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const data = toBytes(f.data);
    const crc = crc32(data);
    const lh = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x800, true);
    lv.setUint16(8, 0, true); lv.setUint16(10, dosTime, true); lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true); lv.setUint32(18, data.length, true); lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true); lv.setUint16(28, 0, true);
    lh.set(nameBytes, 30);
    parts.push(lh, data);
    const ch = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x800, true);
    cv.setUint16(10, 0, true); cv.setUint16(12, dosTime, true); cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true); cv.setUint32(42, offset, true);
    ch.set(nameBytes, 46);
    central.push(ch);
    offset += lh.length + data.length;
  }
  let csize = 0; for (const c of central) csize += c.length;
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true);
  ev.setUint32(12, csize, true); ev.setUint32(16, offset, true);
  const all = parts.concat(central, [end]);
  let total = 0; for (const a of all) total += a.length;
  const out = new Uint8Array(total);
  let p = 0; for (const a of all) { out.set(a, p); p += a.length; }
  return out;
}

module.exports = { readZip, writeZip, crc32, inflateRaw, inflatePure };
