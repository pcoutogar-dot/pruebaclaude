// Texturas procedurales (canvas). Todo se genera en código: cero assets externos
// para el prototipo, y así podemos iterar la paleta muy rápido.
import * as THREE from 'three';

export function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function tex(c, { srgb = true, repeat = null } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

// PRNG determinista para que la escena sea siempre igual
export function rng(seed = 1) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function dots(x, r, n, size, colors, alpha = [0.05, 0.2]) {
  const W = x.canvas.width, H = x.canvas.height;
  for (let i = 0; i < n; i++) {
    x.globalAlpha = alpha[0] + r() * (alpha[1] - alpha[0]);
    x.fillStyle = colors[(r() * colors.length) | 0];
    x.beginPath();
    x.arc(r() * W, r() * H, size[0] + r() * (size[1] - size[0]), 0, 7);
    x.fill();
  }
  x.globalAlpha = 1;
}

// ---------- Pared de yeso ----------
export function plasterTexture(base, seed = 2) {
  const c = canvas(512), x = c.getContext('2d'), r = rng(seed);
  x.fillStyle = base;
  x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 40; i++) {
    const px = r() * 512, py = r() * 512, rad = 40 + r() * 120;
    const g = x.createRadialGradient(px, py, 0, px, py, rad);
    const light = r() > 0.5;
    g.addColorStop(0, light ? 'rgba(255,255,255,0.06)' : 'rgba(120,90,60,0.05)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 512, 512);
  }
  dots(x, r, 5000, [0.4, 1.2], ['#ffffff', '#7a6a5a'], [0.03, 0.12]);
  return tex(c, { repeat: [3, 3] });
}

// ---------- Encimera de roble (golden) ----------
export function oakTexture(seed = 4) {
  const W = 1024, H = 512, c = canvas(W, H), x = c.getContext('2d'), r = rng(seed);
  let y = 0;
  while (y < H) {
    const h = 44 + r() * 46;
    x.fillStyle = `hsl(${29 + r() * 6}, ${42 + r() * 12}%, ${63 + r() * 9}%)`;
    x.fillRect(0, y, W, h);
    for (let k = 0; k < 16; k++) {
      x.strokeStyle = `rgba(125,80,40,${0.04 + r() * 0.09})`;
      x.lineWidth = 0.6 + r() * 1.6;
      x.beginPath();
      const yy = y + r() * h, amp = 1 + r() * 3, f = 0.004 + r() * 0.01, ph = r() * 9;
      for (let px = 0; px <= W; px += 16) {
        const v = yy + Math.sin(px * f + ph) * amp;
        px === 0 ? x.moveTo(px, v) : x.lineTo(px, v);
      }
      x.stroke();
    }
    x.fillStyle = 'rgba(90,55,25,0.22)';
    x.fillRect(0, y + h - 1, W, 1.2);
    y += h;
  }
  dots(x, r, 1500, [0.5, 1.5], ['#7a4c25'], [0.05, 0.15]);
  return tex(c, { repeat: [3, 1] });
}

// ---------- Encimera laminada gris (cutre) ----------
export function laminateTexture(seed = 5) {
  const c = canvas(512), x = c.getContext('2d'), r = rng(seed);
  x.fillStyle = '#a6a49e';
  x.fillRect(0, 0, 512, 512);
  dots(x, r, 9000, [0.4, 1.3], ['#6a6864', '#c9c7c0', '#8a8378'], [0.15, 0.5]);
  // manchas de uso
  for (let i = 0; i < 8; i++) {
    const px = r() * 512, py = r() * 512, rad = 20 + r() * 60;
    const g = x.createRadialGradient(px, py, rad * 0.6, px, py, rad);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.9, 'rgba(110,95,70,0.12)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 512, 512);
  }
  return tex(c, { repeat: [4, 1.5] });
}

// ---------- Azulejos ----------
// golden: zellige verde salvia irregular. cutre: azulejo blanco de baño con junta gris.
export function tileTextures(style, seed = 9) {
  const N = style === 'zellige' ? 4 : 6;
  const S = 512, t = S / N, r = rng(seed);
  const c = canvas(S), x = c.getContext('2d');
  const b = canvas(S), y = b.getContext('2d');
  const grout = style === 'zellige' ? '#e9e0d0' : '#9c9a94';
  x.fillStyle = grout;
  x.fillRect(0, 0, S, S);
  y.fillStyle = '#000';
  y.fillRect(0, 0, S, S);
  const gap = style === 'zellige' ? 5 : 4;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const px = i * t + gap / 2, py = j * t + gap / 2, s = t - gap;
      if (style === 'zellige') {
        const l = 70 + r() * 12, sat = 18 + r() * 14, hue = 95 + r() * 30;
        x.fillStyle = `hsl(${hue}, ${sat}%, ${l}%)`;
        x.fillRect(px, py, s, s);
        // brillo irregular de esmalte artesanal
        const g = x.createRadialGradient(px + s * r(), py + s * r(), 2, px + s / 2, py + s / 2, s * 0.8);
        g.addColorStop(0, 'rgba(255,255,255,0.35)');
        g.addColorStop(1, 'rgba(60,80,50,0.12)');
        x.fillStyle = g;
        x.fillRect(px, py, s, s);
        const hg = y.createRadialGradient(px + s / 2, py + s / 2, 4, px + s / 2, py + s / 2, s * 0.75);
        hg.addColorStop(0, `rgb(${200 + r() * 55 | 0},${200 + r() * 55 | 0},${200 + r() * 55 | 0})`);
        hg.addColorStop(1, '#8a8a8a');
        y.fillStyle = hg;
        y.fillRect(px, py, s, s);
      } else {
        x.fillStyle = `hsl(45, 8%, ${90 + r() * 4}%)`;
        x.fillRect(px, py, s, s);
        if (r() < 0.12) {
          x.fillStyle = 'rgba(170,150,90,0.12)';
          x.beginPath();
          x.arc(px + r() * s, py + r() * s, 6 + r() * 14, 0, 7);
          x.fill();
        }
        y.fillStyle = '#c8c8c8';
        y.fillRect(px, py, s, s);
      }
    }
  }
  return { map: tex(c), bump: tex(b, { srgb: false }) };
}

// ---------- Cielo por la ventana ----------
export function skyTexture(mood) {
  const W = 512, H = 512, c = canvas(W, H), x = c.getContext('2d'), r = rng(12);
  const g = x.createLinearGradient(0, 0, 0, H);
  if (mood === 'golden') {
    g.addColorStop(0, '#9fd0ea');
    g.addColorStop(0.55, '#e9f1e8');
    g.addColorStop(1, '#fff0cf');
  } else {
    g.addColorStop(0, '#b9bec4');
    g.addColorStop(1, '#d9dcdf');
  }
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  if (mood === 'golden') {
    // sol suave
    const s = x.createRadialGradient(W * 0.3, H * 0.35, 0, W * 0.3, H * 0.35, 260);
    s.addColorStop(0, 'rgba(255,248,225,1)');
    s.addColorStop(1, 'rgba(255,240,210,0)');
    x.fillStyle = s;
    x.fillRect(0, 0, W, H);
    // árboles desenfocados (bokeh)
    for (let i = 0; i < 26; i++) {
      const px = r() * W, py = H * 0.62 + r() * H * 0.5, rad = 40 + r() * 90;
      const t = x.createRadialGradient(px, py, 0, px, py, rad);
      const c1 = `hsla(${90 + r() * 40}, 35%, ${55 + r() * 15}%, 0.55)`;
      t.addColorStop(0, c1);
      t.addColorStop(1, 'rgba(140,170,110,0)');
      x.fillStyle = t;
      x.fillRect(0, 0, W, H);
    }
  } else {
    // edificio de enfrente
    x.fillStyle = '#9a9792';
    x.fillRect(W * 0.1, H * 0.35, W * 0.9, H);
    x.fillStyle = '#7f7c78';
    for (let i = 0; i < 5; i++)
      for (let j = 0; j < 4; j++) x.fillRect(W * 0.18 + i * 85, H * 0.42 + j * 85, 45, 55);
  }
  return tex(c);
}

// ---------- Cerámica moteada (stoneware) ----------
export function speckleTexture(base, speck = '#6b5a4a', density = 1400, seed = 3, band = null) {
  const c = canvas(512), x = c.getContext('2d'), r = rng(seed);
  x.fillStyle = base;
  x.fillRect(0, 0, 512, 512);
  if (band) {
    x.fillStyle = band.color;
    x.fillRect(0, 512 * (1 - band.v), 512, 512 * band.v);
  }
  dots(x, r, density, [0.5, 1.8], [speck], [0.15, 0.6]);
  return tex(c);
}

// ---------- Latte art (tulipán) ----------
export function latteTexture() {
  const S = 512, c = canvas(S), x = c.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, '#c8996a');
  g.addColorStop(0.75, '#9b6a40');
  g.addColorStop(0.92, '#7a4f2d');
  g.addColorStop(1, '#5d3a1f');
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  const heart = (cx, cy, s) => {
    x.beginPath();
    x.moveTo(cx, cy + s * 0.62);
    x.bezierCurveTo(cx - s * 1.15, cy - s * 0.05, cx - s * 0.6, cy - s * 0.95, cx, cy - s * 0.42);
    x.bezierCurveTo(cx + s * 0.6, cy - s * 0.95, cx + s * 1.15, cy - s * 0.05, cx, cy + s * 0.62);
    x.closePath();
  };
  const milk = '#f8eedf';
  const layers = [[300, 115], [228, 92], [170, 68]];
  for (const [cy, s] of layers) {
    heart(S / 2, cy, s);
    x.fillStyle = milk;
    x.fill();
    x.lineWidth = 7;
    x.strokeStyle = 'rgba(155,105,62,0.9)';
    x.stroke();
  }
  heart(S / 2, 300, 115);
  x.lineWidth = 0;
  // línea de corte del tulipán
  x.strokeStyle = 'rgba(160,110,65,0.8)';
  x.lineWidth = 4;
  x.beginPath();
  x.moveTo(S / 2, 120);
  x.lineTo(S / 2, 380);
  x.stroke();
  return tex(c);
}

export function blackCoffeeTexture() {
  const S = 256, c = canvas(S), x = c.getContext('2d'), r = rng(31);
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, '#3a2414');
  g.addColorStop(1, '#22140a');
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  // burbujitas tristes de café soluble
  for (let i = 0; i < 18; i++) {
    const a = r() * 6.28, d = S * 0.38 + r() * 8;
    x.strokeStyle = 'rgba(160,120,80,0.35)';
    x.beginPath();
    x.arc(S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d, 2 + r() * 4, 0, 7);
    x.stroke();
  }
  return tex(c);
}

// ---------- Corte del aguacate ----------
export function avocadoFleshTexture() {
  const S = 512, c = canvas(S), x = c.getContext('2d');
  const cx = S / 2, cy = S * 0.62;
  const g = x.createRadialGradient(cx, cy, 10, cx, cy, S * 0.62);
  g.addColorStop(0, '#f1ecaa');
  g.addColorStop(0.35, '#dfe28c');
  g.addColorStop(0.7, '#b9d26a');
  g.addColorStop(0.86, '#8db54d');
  g.addColorStop(0.95, '#5d8a33');
  g.addColorStop(1, '#3f5f25');
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  return tex(c);
}

export function noiseBump(seed = 6, n = 4000, size = [1, 3]) {
  const c = canvas(256), x = c.getContext('2d'), r = rng(seed);
  x.fillStyle = '#808080';
  x.fillRect(0, 0, 256, 256);
  dots(x, r, n, size, ['#ffffff', '#000000'], [0.1, 0.35]);
  return tex(c, { srgb: false, repeat: [2, 2] });
}

// ---------- Margarita ----------
export function daisyTexture() {
  const S = 256, c = canvas(S), x = c.getContext('2d');
  x.translate(S / 2, S / 2);
  for (let i = 0; i < 18; i++) {
    x.save();
    x.rotate((i / 18) * Math.PI * 2 + (i % 2) * 0.06);
    const g = x.createLinearGradient(0, 0, 0, -S * 0.48);
    g.addColorStop(0, '#f3ead8');
    g.addColorStop(0.3, '#ffffff');
    g.addColorStop(1, '#fbf6ee');
    x.fillStyle = g;
    x.beginPath();
    x.ellipse(0, -S * 0.27, S * 0.045, S * 0.2, 0, 0, 7);
    x.fill();
    x.restore();
  }
  return tex(c);
}

// ---------- Lino ----------
export function linenTexture(color, seed = 15) {
  const S = 512, c = canvas(S), x = c.getContext('2d'), r = rng(seed);
  x.fillStyle = color;
  x.fillRect(0, 0, S, S);
  for (let i = 0; i < S; i += 2) {
    x.fillStyle = `rgba(255,255,255,${0.03 + r() * 0.06})`;
    x.fillRect(0, i, S, 1);
    x.fillStyle = `rgba(90,60,50,${0.02 + r() * 0.05})`;
    x.fillRect(i, 0, 1, S);
  }
  // pespunte
  x.setLineDash([10, 8]);
  x.strokeStyle = 'rgba(255,250,240,0.8)';
  x.lineWidth = 3;
  x.strokeRect(34, 34, S - 68, S - 68);
  return tex(c);
}

// ---------- Papel de cocina ----------
export function paperTowelTexture() {
  const S = 512, c = canvas(S), x = c.getContext('2d');
  x.fillStyle = '#f4f4f1';
  x.fillRect(0, 0, S, S);
  x.fillStyle = 'rgba(150,150,140,0.18)';
  for (let i = 0; i < 16; i++)
    for (let j = 0; j < 16; j++) {
      x.beginPath();
      x.arc(i * 32 + 16 + (j % 2) * 16, j * 32 + 16, 3, 0, 7);
      x.fill();
    }
  return tex(c);
}

export function labelTexture(bg, fg, text, sub = '') {
  const c = canvas(512, 256), x = c.getContext('2d');
  x.fillStyle = bg;
  x.fillRect(0, 0, 512, 256);
  x.fillStyle = fg;
  x.textAlign = 'center';
  x.font = 'bold 84px Arial, sans-serif';
  x.fillText(text, 256, 140);
  if (sub) {
    x.font = 'bold 34px Arial, sans-serif';
    x.fillText(sub, 256, 200);
  }
  return tex(c);
}

export function stripeTexture(a, b) {
  const c = canvas(64, 256), x = c.getContext('2d');
  x.fillStyle = a;
  x.fillRect(0, 0, 64, 256);
  x.fillStyle = b;
  x.save();
  x.transform(1, 0.8, 0, 1, 0, 0);
  for (let y = -256; y < 256; y += 32) x.fillRect(0, y, 64, 14);
  x.restore();
  return tex(c);
}

// ---------- Efectos ----------
export function softDot() {
  const c = canvas(64), x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return tex(c);
}

export function shaftTexture() {
  const c = canvas(64, 256), x = c.getContext('2d');
  const v = x.createLinearGradient(0, 0, 0, 256);
  v.addColorStop(0, 'rgba(255,255,255,0)');
  v.addColorStop(0.2, 'rgba(255,255,255,1)');
  v.addColorStop(0.75, 'rgba(255,255,255,0.6)');
  v.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = v;
  x.fillRect(0, 0, 64, 256);
  x.globalCompositeOperation = 'destination-in';
  const h = x.createLinearGradient(0, 0, 64, 0);
  h.addColorStop(0, 'rgba(0,0,0,0)');
  h.addColorStop(0.5, 'rgba(0,0,0,1)');
  h.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = h;
  x.fillRect(0, 0, 64, 256);
  return tex(c);
}

export function steamTexture(seed = 21) {
  const W = 128, H = 256, c = canvas(W, H), x = c.getContext('2d'), r = rng(seed);
  for (let i = 0; i < 14; i++) {
    const py = H * (0.15 + 0.7 * (i / 14));
    const px = W / 2 + Math.sin(i * 0.9 + r()) * 18;
    const rad = 18 + r() * 16;
    const g = x.createRadialGradient(px, py, 0, px, py, rad);
    g.addColorStop(0, 'rgba(255,255,255,0.22)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
  }
  return tex(c);
}
