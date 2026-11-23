// Untar de verdad (2D, ligero): la mantequilla o la mermelada es materia, no
// pintura. Cada celda de una rejilla guarda cuánta crema hay y de qué color.
//  - Un pegote cae donde apoyas el cuchillo cargado.
//  - Al arrastrar, la hoja recoge lo que sobra por encima de una capa fina y
//    lo va soltando detrás: el pegote se estira en una capa, con bordes en
//    relieve a los lados del trazo y un montoncito al final.
//  - La masa se conserva: lo que no queda en el pan sigue en el cuchillo.
//  - Se dibuja con luz calculada a partir del relieve: la mermelada brilla,
//    la mantequilla es cremosa y en pan caliente se derrite y se vuelve
//    translúcida.
// Todo es una rejilla de 160×160: barato incluso en móviles modestos.

export const SPREADS = {
  butter: { rgb: [250, 220, 120], gloss: 0.35, alpha: 0.92, melt: true, thin: 0.06 },
  margarine: { rgb: [248, 226, 140], gloss: 0.55, alpha: 0.8, melt: true, thin: 0.05 },
  jam: { rgb: [188, 18, 48], gloss: 1, alpha: 0.86, seeds: true, thin: 0.07 },
  ricotta: { rgb: [252, 249, 240], gloss: 0.12, alpha: 1, thin: 0.09 },
  peanut: { rgb: [196, 136, 78], gloss: 0.4, alpha: 1, thin: 0.12 },
};

const N = 160;
export const CAP = 900; // lo que cabe en un cuchillo bien cargado (unidades de la rejilla)

export class SpreadSim {
  constructor(maskFn) {
    this.h = new Float32Array(N * N); // cantidad de crema
    this.r = new Float32Array(N * N); // color (media ponderada)
    this.g = new Float32Array(N * N);
    this.b = new Float32Array(N * N);
    this.gl = new Float32Array(N * N); // brillo
    this.melt = new Float32Array(N * N); // 0 = sólida, 1 = derretida
    this.inside = new Uint8Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) this.inside[j * N + i] = maskFn((i + 0.5) / N, 1 - (j + 0.5) / N) ? 1 : 0;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = N;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.img = this.ctx.createImageData(N, N);
    this.hc = document.createElement('canvas');
    this.hc.width = this.hc.height = N;
    this.hctx = this.hc.getContext('2d');
    this.himg = this.hctx.createImageData(N, N);
    this.seeds = new Float32Array(N * N);
    for (let i = 0; i < N * N; i++) this.seeds[i] = Math.random() < 0.012 ? 1 : 0;
    this.carry = 0;
    this.kind = null;
    this.dirty = true;
  }

  reset() {
    this.h.fill(0);
    this.melt.fill(0);
    this.carry = 0;
    this.dirty = true;
  }

  snapshot() {
    const c = [this.h, this.r, this.g, this.b, this.gl, this.melt].map((a) => a.slice());
    return () => {
      [this.h, this.r, this.g, this.b, this.gl, this.melt].forEach((a, i) => a.set(c[i]));
      this.dirty = true;
    };
  }

  // añade crema a una celda mezclando el color
  add(k, m, sp) {
    if (m <= 0 || !this.inside[k]) return;
    const h0 = this.h[k], t = h0 + m, w = m / t;
    const [R, G, B] = sp.rgb;
    this.r[k] += (R - this.r[k]) * w;
    this.g[k] += (G - this.g[k]) * w;
    this.b[k] += (B - this.b[k]) * w;
    this.gl[k] += (sp.gloss - this.gl[k]) * w;
    this.melt[k] *= 1 - w;
    this.h[k] = t;
  }

  // pegote al apoyar el cuchillo: sale de lo que lleva cargado
  dollop(u, v, mass, kind) {
    const sp = SPREADS[kind];
    this.kind = kind;
    const cx = u * N, cy = (1 - v) * N, R = 6 + Math.sqrt(mass) * 0.9;
    let tot = 0;
    const ws = [];
    for (let j = Math.floor(cy - R); j <= cy + R; j++)
      for (let i = Math.floor(cx - R); i <= cx + R; i++) {
        if (i < 0 || j < 0 || i >= N || j >= N) continue;
        const d = Math.hypot(i - cx, j - cy) / R;
        if (d >= 1) continue;
        const w = (1 - d * d) ** 1.5 * (0.85 + Math.random() * 0.3);
        ws.push([j * N + i, w]);
        tot += w;
      }
    for (const [k, w] of ws) this.add(k, (mass * w) / tot, sp);
    this.dirty = true;
  }

  // un paso del cuchillo de (u0,v0) a (u1,v1). load = lo que lleva (0..1).
  // Devuelve cuánto le queda.
  stroke(u0, v0, u1, v1, load, kind, press = 1) {
    const sp = SPREADS[kind];
    this.kind = kind;
    const x0 = u0 * N, y0 = (1 - v0) * N, x1 = u1 * N, y1 = (1 - v1) * N;
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 0.01) return load;
    const dx = (x1 - x0) / len, dy = (y1 - y0) / len;
    const R = 9; // media anchura de la hoja (en celdas)
    // lo que lleva el cuchillo, en las mismas unidades que la rejilla
    let C = this.carry + load * CAP;
    const steps = Math.ceil(len / 1.2);
    // capa que deja: más fina si aprietas (vas deprisa)
    const T = sp.thin * (1.25 - 0.45 * press);
    for (let s = 1; s <= steps; s++) {
      const cx = x0 + (x1 - x0) * (s / steps), cy = y0 + (y1 - y0) * (s / steps);
      let picked = 0;
      // 1) la hoja recoge lo que sobra por encima de la capa
      for (let j = Math.floor(cy - R); j <= cy + R; j++)
        for (let i = Math.floor(cx - R); i <= cx + R; i++) {
          if (i < 0 || j < 0 || i >= N || j >= N) continue;
          const k = j * N + i;
          if (!this.inside[k]) continue;
          const px = i - cx, py = j - cy, along = px * dx + py * dy, side = -px * dy + py * dx;
          if (Math.abs(side) > R || Math.abs(along) > 2.2) continue;
          const ex = this.h[k] - T;
          if (ex > 0) {
            const take = ex * 0.65;
            this.h[k] -= take;
            picked += take;
          }
        }
      C += picked;
      // 2) suelta capa fina detrás de la hoja, donde falta
      for (let j = Math.floor(cy - R - 3); j <= cy + R + 3; j++)
        for (let i = Math.floor(cx - R - 3); i <= cx + R + 3; i++) {
          if (i < 0 || j < 0 || i >= N || j >= N || C <= 0) continue;
          const k = j * N + i;
          if (!this.inside[k]) continue;
          const px = i - cx, py = j - cy, along = px * dx + py * dy, side = -px * dy + py * dx;
          if (along > -0.5 || along < -3.5) continue;
          const as = Math.abs(side);
          if (as <= R) {
            // irregularidad suave: vetas a lo largo del trazo
            const streak = 1 + 0.12 * Math.sin(side * 1.3) + (Math.random() - 0.5) * 0.08;
            const need = Math.max(0, T * streak - this.h[k]);
            const give = Math.min(C * 0.2, need * 0.7);
            if (give > 0) {
              this.add(k, give, sp);
              C -= give;
            }
          } else if (as <= R + 2.5) {
            // bordes: lo que rebosa por los lados de la hoja queda en relieve
            const give = Math.min(C * 0.01, 0.06) * (1 - (as - R) / 2.5);
            this.add(k, give, sp);
            C -= give;
          }
        }
    }
    // el cuchillo guarda lo que le sobra (hasta su capacidad)
    const cap = CAP;
    const newLoad = Math.min(1, C / cap);
    this.carry = Math.max(0, C - newLoad * cap);
    if (this.carry > 0) {
      // lo que no cabe se queda como montoncito al final del trazo
      this.dollopRaw(x1 + dx * 3, y1 + dy * 3, this.carry, sp);
      this.carry = 0;
    }
    this.dirty = true;
    return newLoad;
  }

  dollopRaw(cx, cy, mass, sp) {
    const R = 4;
    let tot = 0;
    const ws = [];
    for (let j = Math.floor(cy - R); j <= cy + R; j++)
      for (let i = Math.floor(cx - R); i <= cx + R; i++) {
        if (i < 0 || j < 0 || i >= N || j >= N) continue;
        const d = Math.hypot(i - cx, j - cy) / R;
        if (d >= 1) continue;
        ws.push([j * N + i, 1 - d]);
        tot += 1 - d;
      }
    for (const [k, w] of ws) this.add(k, (mass * w) / tot, sp);
  }

  // en pan caliente la mantequilla se derrite: se alisa y se vuelve translúcida
  update(dt, warmth) {
    if (warmth <= 0.05) return;
    let any = false;
    const rate = dt * warmth * 0.35;
    for (let k = 0; k < N * N; k++) {
      if (this.h[k] < 0.005 || this.gl[k] > 0.7 || this.melt[k] >= 1) continue;
      this.melt[k] = Math.min(1, this.melt[k] + rate);
      any = true;
    }
    if (any) {
      // se alisa un poco (difusión suave) donde está derretida
      const h = this.h, t = h.slice();
      for (let j = 1; j < N - 1; j++)
        for (let i = 1; i < N - 1; i++) {
          const k = j * N + i;
          if (!this.inside[k] || this.melt[k] < 0.2) continue;
          const avg = (t[k - 1] + t[k + 1] + t[k - N] + t[k + N]) / 4;
          h[k] += (avg - t[k]) * 0.08 * this.melt[k];
        }
      this.dirty = true;
    }
  }

  // dibuja la crema con luz (y su relieve, para el 3D)
  render() {
    if (!this.dirty) return false;
    this.dirty = false;
    const d = this.img.data, hd = this.himg.data, h = this.h;
    const L = [-0.45, -0.6, 0.66]; // luz desde arriba a la izquierda (como la ventana)
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const k = j * N + i, o = k * 4, v = h[k];
        if (v < 0.004 || !this.inside[k]) {
          d[o + 3] = 0;
          hd[o] = hd[o + 1] = hd[o + 2] = 0;
          hd[o + 3] = 0;
          continue;
        }
        const hl = h[k - (i > 0 ? 1 : 0)], hr = h[k + (i < N - 1 ? 1 : 0)], hu = h[k - (j > 0 ? N : 0)], hdn = h[k + (j < N - 1 ? N : 0)];
        let nx = (hl - hr) * 14, ny = (hu - hdn) * 14;
        const nl = Math.hypot(nx, ny, 1);
        nx /= nl;
        ny /= nl;
        const nz = 1 / nl;
        const diff = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
        // brillo especular (la mermelada brilla mucho)
        const hx = L[0], hy = L[1], hz = L[2] + 1, hn = Math.hypot(hx, hy, hz);
        const spec = Math.pow(Math.max(0, (nx * hx + ny * hy + nz * hz) / hn), 28) * (0.25 + this.gl[k] * 0.9 + this.melt[k] * 0.5);
        const shade = 0.82 + diff * 0.28;
        let R = this.r[k] * shade + spec * 255, G = this.g[k] * shade + spec * 245, B = this.b[k] * shade + spec * 225;
        // pepitas de fresa en la mermelada
        if (this.seeds[k] && this.r[k] > 150 && this.g[k] < 90 && v > 0.05) {
          R *= 0.78;
          G *= 0.7;
          B *= 0.6;
        }
        d[o] = R > 255 ? 255 : R;
        d[o + 1] = G > 255 ? 255 : G;
        d[o + 2] = B > 255 ? 255 : B;
        // capa fina = translúcida; derretida = más translúcida
        const sp = this.gl[k] > 0.8 ? 0.94 : 0.97;
        const a = Math.min(1, v / 0.035) * sp * (1 - this.melt[k] * 0.4);
        d[o + 3] = a * 255;
        const hv = Math.min(255, v * 1300);
        hd[o] = hd[o + 1] = hd[o + 2] = hv;
        hd[o + 3] = Math.min(255, a * 255);
      }
    this.ctx.putImageData(this.img, 0, 0);
    this.hctx.putImageData(this.himg, 0, 0);
    return true;
  }
}
