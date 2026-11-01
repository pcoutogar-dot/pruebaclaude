// Piel continua que se pela por donde pasa el dedo.
//  - La piel es una malla de celdas (no tiras predefinidas).
//  - Al tocar empieza un desgarro; al arrastrar, la tira crece siguiendo tu
//    camino. Despacio = tira ancha; rápido = estrecha (y si das un tirón, se rompe).
//  - La parte ya despegada se levanta como una lámina blanda que sigue al dedo
//    con un poco de retraso (sensación maleable).
//  - Al soltar, la tira se separa; en los bordes pueden quedar restos pegados.
import * as THREE from 'three';

const NU = 64; // celdas alrededor (media vuelta)
const NV = 34; // celdas a lo largo

export class Skin {
  constructor(profile, material) {
    this.profile = profile;
    this.ymax = profile[profile.length - 1][1];
    const V = (NU + 1) * (NV + 1);
    const pos = new Float32Array(V * 3), uv = new Float32Array(V * 2);
    for (let i = 0; i <= NU; i++) {
      const phi = (i / NU) * Math.PI;
      for (let j = 0; j <= NV; j++) {
        const y = (j / NV) * this.ymax, r = this.radiusAt(y), k = i * (NV + 1) + j;
        pos.set([r * Math.sin(phi), y, r * Math.cos(phi)], k * 3);
        uv.set([i / NU, j / NV], k * 2);
      }
    }
    this.base = pos;
    const full = [];
    for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) full.push(...this.quad(i, j));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos.slice(), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(full);
    g.computeVertexNormals();
    this.normals = g.attributes.normal.array.slice();
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.castShadow = this.mesh.receiveShadow = true;
    this.mesh.userData.skin = this;

    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos.slice(), 3));
    sg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    sg.setIndex([]);
    this.strip = new THREE.Mesh(sg, material);
    this.strip.castShadow = true;
    this.strip.frustumCulled = false;
    this.state = new Uint8Array(NU * NV); // 0 pegada · 1 en la tira · 2 fuera
    this.reset();
  }

  radiusAt(t) {
    const P = this.profile;
    for (let i = 1; i < P.length; i++) {
      const [r0, y0] = P[i - 1], [r1, y1] = P[i];
      if (t <= y1 + 1e-6) return r0 + ((r1 - r0) * (t - y0)) / (y1 - y0);
    }
    return 0;
  }

  quad(i, j) {
    const a = i * (NV + 1) + j, b = (i + 1) * (NV + 1) + j;
    return [a, b, a + 1, b, b + 1, a + 1];
  }

  reset() {
    this.state.fill(0);
    this.cur = null;
    this.rebuild();
  }

  rebuild() {
    const idx = [], sidx = [];
    for (let i = 0; i < NU; i++)
      for (let j = 0; j < NV; j++) {
        const s = this.state[i * NV + j];
        if (s === 0) idx.push(...this.quad(i, j));
        else if (s === 1) sidx.push(...this.quad(i, j));
      }
    this.mesh.geometry.setIndex(idx);
    this.strip.geometry.setIndex(sidx);
  }

  // punto local (espacio del torno) → coordenadas de la piel
  paramOf(p) {
    let phi = Math.atan2(p.x, p.z);
    phi = THREE.MathUtils.clamp(phi, 0, Math.PI);
    const y = THREE.MathUtils.clamp(p.y, 0, this.ymax);
    return { phi, y };
  }

  center(i, j) {
    const y = ((j + 0.5) / NV) * this.ymax;
    return { phi: ((i + 0.5) / NU) * Math.PI, y, r: this.radiusAt(y) };
  }

  dist(c, q) {
    return Math.hypot((c.phi - q.phi) * Math.max(0.12, c.r), c.y - q.y);
  }

  // empieza un desgarro si el punto cae sobre piel pegada
  begin(q) {
    const i = Math.min(NU - 1, Math.floor((q.phi / Math.PI) * NU));
    const j = Math.min(NV - 1, Math.floor((q.y / this.ymax) * NV));
    if (this.state[i * NV + j] !== 0) return false;
    this.cur = { len: 0, shown: 0, last: q, sCell: new Map(), finger: null };
    this.grow(q, 0.16);
    return true;
  }

  // la tira crece siguiendo el camino del dedo
  extend(q, speed) {
    const c = this.cur;
    if (!c) return;
    const d = this.dist({ ...c.last, r: this.radiusAt(c.last.y) }, q);
    // despacio = tira ancha y pareja; rápido = estrecha
    const w = THREE.MathUtils.clamp(0.23 - speed * 0.7, 0.11, 0.23);
    const n = Math.max(1, Math.ceil(d / 0.03));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      c.len += d / n;
      this.grow({ phi: c.last.phi + (q.phi - c.last.phi) * t, y: c.last.y + (q.y - c.last.y) * t }, w);
    }
    c.last = q;
  }

  grow(q, w) {
    const c = this.cur;
    const i0 = Math.floor((q.phi / Math.PI) * NU), j0 = Math.floor((q.y / this.ymax) * NV);
    let added = false;
    for (let i = Math.max(0, i0 - 18); i <= Math.min(NU - 1, i0 + 18); i++)
      for (let j = Math.max(0, j0 - 10); j <= Math.min(NV - 1, j0 + 10); j++) {
        const k = i * NV + j;
        if (this.state[k] !== 0) continue;
        // borde irregular: el desgarro nunca es una línea perfecta
        const jitter = 1 + 0.22 * Math.sin(i * 12.9898 + j * 78.233) + 0.1 * Math.sin(i * 0.7 + j * 1.3);
        if (this.dist(this.center(i, j), q) < w * jitter) {
          this.state[k] = 1;
          c.sCell.set(k, c.len);
          added = true;
        }
      }
    if (added) this.rebuild();
  }

  setFinger(p) {
    if (this.cur) this.cur.finger = p.clone();
  }

  // levanta la lámina: lo primero que despegaste se levanta más (va hacia el dedo)
  deform(dt) {
    const c = this.cur;
    if (!c) return;
    c.shown += (c.len - c.shown) * Math.min(1, dt * 9); // retraso blandito
    const pos = this.strip.geometry.attributes.position, a = pos.array, b = this.base, n = this.normals;
    const vs = new Map();
    for (const [k, s] of c.sCell) {
      const i = Math.floor(k / NV), j = k % NV;
      for (const v of [i * (NV + 1) + j, i * (NV + 1) + j + 1, (i + 1) * (NV + 1) + j, (i + 1) * (NV + 1) + j + 1])
        vs.set(v, Math.min(vs.get(v) ?? 1e9, s));
    }
    const f = c.finger;
    for (const [v, s] of vs) {
      const lift = THREE.MathUtils.smoothstep(c.shown - s, 0, 0.32);
      const l2 = lift * lift;
      let x = b[v * 3] + n[v * 3] * 0.14 * l2, y = b[v * 3 + 1] + n[v * 3 + 1] * 0.14 * l2, z = b[v * 3 + 2] + n[v * 3 + 2] * 0.14 * l2;
      if (f) {
        x += (f.x - x) * 0.32 * l2;
        y += (f.y - y) * 0.32 * l2;
        z += (f.z - z) * 0.32 * l2;
      }
      a[v * 3] = x;
      a[v * 3 + 1] = y;
      a[v * 3 + 2] = z;
    }
    pos.needsUpdate = true;
    this.strip.geometry.computeVertexNormals();
  }

  // suelta la tira: devuelve su geometría (para que caiga con física)
  finish() {
    const c = this.cur;
    if (!c) return null;
    this.deform(1);
    const geo = this.strip.geometry.clone();
    const idx = [];
    for (const k of c.sCell.keys()) {
      const i = Math.floor(k / NV), j = k % NV;
      // restos: algunos trocitos del borde se quedan pegados
      const border = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([di, dj]) => {
        const ii = i + di, jj = j + dj;
        return ii >= 0 && ii < NU && jj >= 0 && jj < NV && this.state[ii * NV + jj] === 0;
      });
      if (border && c.sCell.size > 6 && Math.random() < 0.12) this.state[k] = 0;
      else {
        this.state[k] = 2;
        idx.push(...this.quad(i, j));
      }
    }
    geo.setIndex(idx);
    this.strip.geometry.attributes.position.array.set(this.base);
    this.strip.geometry.attributes.position.needsUpdate = true;
    this.cur = null;
    this.rebuild();
    return idx.length ? geo : null;
  }

  // fracción de piel que queda pegada en la parte visible (la de arriba)
  remaining(matrixWorld) {
    let vis = 0, left = 0;
    const nm = new THREE.Matrix3().getNormalMatrix(matrixWorld), v = new THREE.Vector3();
    for (let i = 0; i < NU; i++)
      for (let j = 0; j < NV; j++) {
        const c = this.center(i, j);
        v.set(Math.sin(c.phi), 0.25, Math.cos(c.phi)).applyMatrix3(nm).normalize();
        if (v.y < 0.15) continue;
        vis++;
        if (this.state[i * NV + j] === 0) left++;
      }
    return vis ? left / vis : 0;
  }

  // lo que queda (pegado a la tabla) se suelta solo al final
  clearAll() {
    this.state.fill(2);
    this.rebuild();
  }
}
