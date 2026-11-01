// Texturas procedurales realistas: ruido natural (Perlin fbm, Worley), con
// mapa de color + relieve (normal map) + rugosidad. Todo tileable (se repite
// sin costuras) y generado una sola vez al cargar.
import * as THREE from 'three';

// ---------- Ruido ----------
function makePerm(seed) {
  const p = new Uint8Array(512);
  const a = [...Array(256).keys()];
  let s = seed * 9301 + 49297;
  for (let i = 255; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  for (let i = 0; i < 512; i++) p[i] = a[i & 255];
  return p;
}
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const GR = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];

// Perlin periódico (px, py = periodo en celdas) → tileable
export function perlin(seed = 1) {
  const p = makePerm(seed);
  return (x, y, px = 256, py = 256) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const g = (ix, iy, dx, dy) => {
      const h = p[(p[((ix % px) + px) % px & 255] + (((iy % py) + py) % py)) & 255] & 7;
      return GR[h][0] * dx + GR[h][1] * dy;
    };
    const u = fade(xf), v = fade(yf);
    const a = g(xi, yi, xf, yf), b = g(xi + 1, yi, xf - 1, yf);
    const c = g(xi, yi + 1, xf, yf - 1), d = g(xi + 1, yi + 1, xf - 1, yf - 1);
    return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v; // ~[-1,1]
  };
}

export function fbm(noise, x, y, px, py, oct = 5) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) {
    s += a * noise(x * f, y * f, px * f, py * f);
    a *= 0.5;
    f *= 2;
  }
  return s;
}

// Worley (celular) periódico: distancia al punto más cercano (F1) y al segundo (F2)
export function worley(seed, cells) {
  const pts = [];
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < cells * cells; i++) pts.push([rnd(), rnd()]);
  return (u, v) => {
    const x = u * cells, y = v * cells, xi = Math.floor(x), yi = Math.floor(y);
    let f1 = 9, f2 = 9;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const cx = xi + dx, cy = yi + dy;
        const q = pts[(((cy % cells) + cells) % cells) * cells + (((cx % cells) + cells) % cells)];
        const d = Math.hypot(cx + q[0] - x, cy + q[1] - y);
        if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
      }
    return [f1, f2];
  };
}

// ---------- Utilidades de imagen ----------
function canvasFrom(W, H, fill) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d');
  const img = x.createImageData(W, H);
  fill(img.data);
  x.putImageData(img, 0, 0);
  return c;
}

// altura (Float32, 0..1) → normal map tileable
function normalFromHeight(h, W, H, strength) {
  return canvasFrom(W, H, (d) => {
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const l = h[y * W + ((x - 1 + W) % W)], r = h[y * W + ((x + 1) % W)];
        const u = h[((y - 1 + H) % H) * W + x], dn = h[((y + 1) % H) * W + x];
        let nx = (l - r) * strength, ny = (dn - u) * strength, nz = 1;
        const len = Math.hypot(nx, ny, nz);
        const i = (y * W + x) * 4;
        d[i] = ((nx / len) * 0.5 + 0.5) * 255;
        d[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
        d[i + 2] = ((nz / len) * 0.5 + 0.5) * 255;
        d[i + 3] = 255;
      }
  });
}

function textures({ color, height, rough, W, H, strength = 2, repeat = [1, 1] }) {
  const t = (c, srgb) => {
    const tx = new THREE.CanvasTexture(c);
    if (srgb) tx.colorSpace = THREE.SRGBColorSpace;
    tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
    tx.repeat.set(...repeat);
    tx.anisotropy = 8;
    return tx;
  };
  return {
    map: t(color, true),
    normalMap: height ? t(normalFromHeight(height, W, H, strength), false) : null,
    roughnessMap: rough ? t(rough, false) : null,
  };
}

const mix = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerpC = (c1, c2, t) => [mix(c1[0], c2[0], t), mix(c1[1], c2[1], t), mix(c1[2], c2[2], t)];
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function build(W, H, fn) {
  const h = new Float32Array(W * H), r = new Uint8ClampedArray(W * H);
  const color = canvasFrom(W, H, (d) => {
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const o = fn(x / W, y / H, x, y);
        const i = (y * W + x) * 4;
        d[i] = o.c[0];
        d[i + 1] = o.c[1];
        d[i + 2] = o.c[2];
        d[i + 3] = 255;
        h[y * W + x] = o.h ?? 0;
        r[y * W + x] = (o.r ?? 0.7) * 255;
      }
  });
  const rough = canvasFrom(W, H, (d) => {
    for (let i = 0; i < W * H; i++) {
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = r[i];
      d[i * 4 + 3] = 255;
    }
  });
  return { color, height: h, rough };
}

// ---------- Materiales ----------

// Madera de roble en listones: vetas onduladas, poros y juntas
export function oakWood({ W = 1024, H = 512, planks = 6, repeat = [3, 1], light = 0 } = {}) {
  const n = perlin(7), n2 = perlin(11);
  const base = [[214, 176, 132], [200, 158, 112], [222, 186, 142], [196, 152, 104], [208, 168, 122], [218, 180, 136]];
  const out = build(W, H, (u, v) => {
    const k = Math.floor(v * planks), pv = v * planks - k;
    const b = base[k % base.length];
    // vetas: líneas a lo largo del listón deformadas por ruido
    const warp = fbm(n, u * 3, pv * 2 + k * 7, 3, 64, 4) * 1.6;
    const grain = Math.sin((pv * 9 + warp + k * 3.1) * Math.PI * 2);
    const fine = fbm(n2, u * 40, pv * 6 + k * 13, 40, 256, 3);
    const g = clamp01(0.5 + grain * 0.28 + fine * 0.35);
    let c = lerpC(lerpC(b, [150, 105, 62], 0.15), [170, 122, 74], (1 - g) * 0.55);
    c = c.map((x) => x + light);
    const seam = Math.min(pv, 1 - pv) < 0.012 ? 1 : 0;
    if (seam) c = lerpC(c, [110, 74, 42], 0.6);
    // poros
    const pore = fbm(n2, u * 160, v * 80 + k, 160, 256, 2) > 0.38 ? 0.12 : 0;
    c = lerpC(c, [120, 82, 46], pore);
    return { c, h: g * 0.35 - seam * 0.8 - pore * 2, r: 0.55 + (1 - g) * 0.2 + seam * 0.2 };
  });
  return textures({ ...out, W, H, strength: 3.5, repeat });
}

// Laminado gris barato (cutre): textura de grano fino y desgaste
export function laminate({ W = 512, H = 512, repeat = [4, 1.5] } = {}) {
  const n = perlin(3);
  const out = build(W, H, (u, v) => {
    const f = fbm(n, u * 64, v * 64, 64, 64, 3);
    const w = fbm(n, u * 4, v * 4, 4, 4, 3);
    const c = lerpC([170, 168, 162], [140, 136, 128], clamp01(0.5 + f * 0.8 + w * 0.4));
    return { c, h: f * 0.3, r: 0.35 + w * 0.15 };
  });
  return textures({ ...out, W, H, strength: 1.2, repeat });
}

// Yeso / pared pintada: ondulación suave y poro fino
export function plaster(hexColor, { W = 512, H = 512, repeat = [3, 3], seed = 2 } = {}) {
  const n = perlin(seed), b = hex(hexColor);
  const out = build(W, H, (u, v) => {
    const big = fbm(n, u * 4, v * 4, 4, 4, 4), fine = fbm(n, u * 80, v * 80, 80, 80, 2);
    const c = b.map((x) => x * (1 + big * 0.05 + fine * 0.03));
    return { c, h: big * 0.6 + fine * 0.25, r: 0.85 };
  });
  return textures({ ...out, W, H, strength: 2.2, repeat });
}

// Azulejo artesanal (zellige) o de baño: esmalte irregular, bisel y junta
export function tiles(style, { W = 1024, H = 1024, N = 4 } = {}) {
  const n = perlin(style === 'zellige' ? 21 : 5), cells = [];
  for (let i = 0; i < N * N; i++) cells.push(Math.random());
  const zel = style === 'zellige';
  const out = build(W, H, (u, v) => {
    const tx = u * N, ty = v * N, ix = Math.floor(tx), iy = Math.floor(ty), fx = tx - ix, fy = ty - iy;
    const id = cells[iy * N + ix];
    const gap = zel ? 0.035 : 0.025;
    const e = Math.min(fx, 1 - fx, fy, 1 - fy);
    if (e < gap) {
      const gc = zel ? [228, 220, 204] : [160, 158, 152];
      return { c: gc.map((x) => x * (0.96 + fbm(n, u * 90, v * 90, 90, 90, 2) * 0.1)), h: -0.6, r: 0.9 };
    }
    const bevel = clamp01((e - gap) / 0.06);
    const glaze = fbm(n, u * 12 + id * 9, v * 12, 12 * N, 12 * N, 4);
    let c;
    if (zel) {
      const base = lerpC([170, 196, 160], [140, 172, 136], id);
      c = lerpC(base, [204, 222, 196], clamp01(0.5 + glaze * 0.9));
    } else c = lerpC([236, 236, 230], [222, 222, 214], clamp01(0.5 + glaze));
    const wob = zel ? glaze * 0.5 : glaze * 0.08;
    return { c, h: bevel * 0.5 + wob, r: zel ? 0.25 + Math.abs(glaze) * 0.3 : 0.2 };
  });
  return textures({ ...out, W, H, strength: 4 });
}

// Piel de aguacate Hass: granulado de bultitos (Worley) y tono verde-morado
export function avocadoSkin({ W = 512, H = 512 } = {}) {
  const w = worley(5, 26), n = perlin(9);
  const out = build(W, H, (u, v) => {
    const [f1, f2] = w(u, v);
    const bump = clamp01(1 - f1 * 1.6);
    const ridge = clamp01((f2 - f1) * 4);
    const tone = fbm(n, u * 6, v * 6, 6, 6, 3);
    let c = lerpC([46, 66, 30], [34, 44, 26], clamp01(0.5 + tone));
    c = lerpC(c, [58, 40, 46], clamp01(tone * 0.8)); // toques morados (maduro)
    c = lerpC(c, [70, 96, 44], bump * 0.25);
    return { c, h: bump * 0.8 + ridge * 0.2, r: 0.75 - bump * 0.15 };
  });
  return textures({ ...out, W, H, strength: 5 });
}

// Cáscara de cítrico: poros hundidos (Worley inverso)
export function citrusPeel(hexColor, { W = 512, H = 256, seed = 3 } = {}) {
  const w = worley(seed, 48), n = perlin(seed), b = hex(hexColor);
  const out = build(W, H, (u, v) => {
    const [f1] = w(u, v * 0.5);
    const pore = clamp01(1 - f1 * 3.2);
    const tone = fbm(n, u * 8, v * 4, 8, 4, 3);
    const c = b.map((x) => x * (1 + tone * 0.08 - pore * 0.12));
    return { c, h: -pore * 0.7 + tone * 0.1, r: 0.45 + pore * 0.3 };
  });
  return textures({ ...out, W, H, strength: 4 });
}

// Cerámica artesanal moteada (stoneware): esmalte ondulado y motas
export function stoneware(hexColor, { W = 512, H = 512, speck = '#6f5a48', density = 0.012, seed = 5, band = null } = {}) {
  const n = perlin(seed), b = hex(hexColor), sp = hex(speck);
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const out = build(W, H, (u, v) => {
    const g = fbm(n, u * 6, v * 6, 6, 6, 4);
    let c = b.map((x) => x * (1 + g * 0.05));
    let r = 0.6 + g * 0.1;
    if (band && v > 1 - band.v) {
      c = lerpC(hex(band.color), [150, 110, 80], clamp01(0.5 + g));
      r = 0.9;
    }
    if (rnd() < density) c = lerpC(c, sp, 0.7);
    return { c, h: g * 0.4, r };
  });
  return textures({ ...out, W, H, strength: 1.5 });
}

// Lino de servilleta: trama de tejido
export function linen(hexColor, { W = 512, H = 512 } = {}) {
  const n = perlin(15), b = hex(hexColor);
  const out = build(W, H, (u, v) => {
    const wx = Math.sin(u * W * 0.5 * Math.PI), wy = Math.sin(v * H * 0.5 * Math.PI);
    const slub = fbm(n, u * 30, v * 2, 30, 2, 3) * 0.6 + fbm(n, u * 2, v * 30, 2, 30, 3) * 0.6;
    const weave = (wx * 0.5 + 0.5) * (wy * 0.5 + 0.5);
    const c = b.map((x) => x * (0.9 + weave * 0.12 + slub * 0.08));
    return { c, h: weave * 0.4 + slub * 0.3, r: 0.95 };
  });
  return textures({ ...out, W, H, strength: 2 });
}
