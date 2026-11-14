// Superficie líquida "manual": latte art, yogur en el bol...
// Simulación 2D sencilla de partículas sobre un canvas circular:
//  - verter: nacen partículas en el punto de vertido y empujan radialmente a las
//    anteriores. Al mover el dedo mientras viertes salen capas, ondas, corazones...
//  - dibujar: arrastra las partículas cercanas en la dirección del dedo
//    (el "corte" final de un corazón o tulipán, o etching libre).
//  - espolvorear / chorrito: se pintan sobre una capa de decoración.
// Nunca hay dos resultados iguales: depende del pulso, la velocidad y el orden.
import * as THREE from 'three';
import { canvas, tex } from './textures.js';

const S = 512;

export class PourSurface {
  constructor({ drawBase, milk, halo, push = 1, size = [6, 10], capacity = 2600, height = false }) {
    this.drawBase = drawBase;
    this.milk = milk;
    this.halo = halo;
    this.pushK = push;
    this.size = size;
    this.capacity = capacity;
    this.c = canvas(S);
    this.base = canvas(S);
    this.decor = canvas(S);
    drawBase(this.base.getContext('2d'), S);
    this.texture = tex(this.c);
    if (height) {
      // relieve: lo espeso (yogur) tiene volumen de verdad
      this.h = canvas(256);
      this.heightTexture = tex(this.h, { srgb: false });
    }
    this.p = [];
    this.R = S * 0.47;
    this.reset();
  }

  setBase(fn) {
    this.drawBase = fn;
    fn(this.base.getContext('2d'), S);
    this.dirty = true;
  }

  reset() {
    this.p = [];
    this.over = 0;
    this.decor.getContext('2d').clearRect(0, 0, S, S);
    if (this.g) this.g.getContext('2d').clearRect(0, 0, 256, 256);
    this.dirty = true;
    this.render();
  }

  get full() {
    return this.p.length >= this.capacity;
  }

  // nunca se bloquea: pasado el tope, lo más antiguo queda "enterrado" (se
  // recicla) y se cuenta como lo que rebosa
  room() {
    if (this.p.length >= this.capacity) {
      this.p.shift();
      this.over = (this.over || 0) + 1;
    }
    return true;
  }

  get fill() {
    return this.p.length / this.capacity;
  }

  snapshot() {
    const d = this.decor.getContext('2d').getImageData(0, 0, S, S);
    const p = this.p.map((q) => ({ ...q }));
    const g = this.g ? this.g.getContext('2d').getImageData(0, 0, 256, 256) : null;
    return () => {
      this.p = p;
      this.decor.getContext('2d').putImageData(d, 0, 0);
      if (g) this.g.getContext('2d').putImageData(g, 0, 0);
      this.dirty = true;
    };
  }

  // uv -> px
  px(uv) {
    return [uv.x * S, (1 - uv.y) * S];
  }

  pour(uv, dt) {
    const [x, y] = this.px(uv);
    const n = Math.round(dt * 300);
    for (let i = 0; i < n && this.room(); i++) {
      const a = Math.random() * 6.283, d = Math.random() * 4;
      this.p.push({
        x: x + Math.cos(a) * d,
        y: y + Math.sin(a) * d,
        r: this.size[0] + Math.random() * (this.size[1] - this.size[0]),
      });
    }
    // empuje radial: lo recién vertido desplaza a lo anterior
    const k = this.pushK * dt * 60;
    for (const q of this.p) {
      const dx = q.x - x, dy = q.y - y, d = Math.hypot(dx, dy) + 0.001;
      const f = (k * 26) / (d + 14);
      q.x += (dx / d) * f;
      q.y += (dy / d) * f;
      if (d < 60) q.r = Math.min(q.r * (1 + 0.004 * k), this.size[1] * 1.6);
    }
    this.contain();
    this.dirty = true;
  }

  // una cucharada: un pegote espeso que luego se asienta despacio
  dollop(uv) {
    const [x, y] = this.px(uv);
    const n = 55;
    for (let i = 0; i < n && this.room(); i++) {
      const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * 26;
      this.p.push({
        x: x + Math.cos(a) * d, y: y + Math.sin(a) * d,
        r: 11 + Math.random() * 6, age: 0, cx: x, cy: y,
      });
    }
    this.contain();
    this.dirty = true;
  }

  // chorro espeso desde el tarro: cae continuo y se pliega, luego se asienta
  ribbon(uv, dt, col = null) {
    const [x, y] = this.px(uv);
    const n = Math.round(dt * 380);
    for (let i = 0; i < n && this.room(); i++) {
      const a = Math.random() * 6.283, d = Math.random() * 10;
      const q = { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, r: 14 + Math.random() * 6, age: 0, cx: x, cy: y };
      // color propio (açaí): dos tonos para que se vea batido
      if (col) {
        q.c = col.c[(Math.random() * col.c.length) | 0];
        q.h = col.h;
      }
      this.p.push(q);
    }
    // lo nuevo empuja a lo anterior: el yogur se va extendiendo por el bol
    const k = dt * 60 * 0.9;
    for (const q of this.p) {
      const dx = q.x - x, dy = q.y - y, d = Math.hypot(dx, dy) + 0.001;
      const f = (k * 48) / (d + 30);
      q.x += (dx / d) * f;
      q.y += (dy / d) * f;
    }
    this.contain();
    this.dirty = true;
  }

  // el pegote se asienta: se expande un poco y se aplana
  relax(dt) {
    let moved = false;
    for (const q of this.p) {
      if (q.age === undefined || q.age > 1.6) continue;
      q.age += dt;
      const dx = q.x - q.cx, dy = q.y - q.cy, d = Math.hypot(dx, dy) + 0.5;
      const v = 22 * Math.exp(-q.age * 2.5) * dt;
      q.x += (dx / d) * v;
      q.y += (dy / d) * v;
      moved = true;
    }
    if (moved) {
      this.contain();
      this.dirty = true;
    }
  }

  smear(uv0, uv1) {
    const [x0, y0] = this.px(uv0), [x1, y1] = this.px(uv1);
    const dx = x1 - x0, dy = y1 - y0, rad = 20;
    for (const q of this.p) {
      const d = Math.hypot(q.x - x1, q.y - y1);
      if (d < rad * 2) {
        const f = Math.max(0, 1 - d / (rad * 2));
        q.x += dx * f * 0.9;
        q.y += dy * f * 0.9;
      }
    }
    this.contain();
    this.dirty = true;
  }

  sprinkle(uv, color, n = 6, spread = 22) {
    const [x, y] = this.px(uv);
    const c = this.decor.getContext('2d');
    for (let i = 0; i < n; i++) {
      c.fillStyle = color;
      c.globalAlpha = 0.5 + Math.random() * 0.5;
      c.beginPath();
      c.arc(x + (Math.random() - 0.5) * spread * 2, y + (Math.random() - 0.5) * spread * 2, 0.8 + Math.random() * 1.8, 0, 7);
      c.fill();
    }
    c.globalAlpha = 1;
    this.dirty = true;
  }

  // surco de la cuchara: remueve lo espeso y deja la marca del remolino
  groove(uv0, uv1) {
    const [x0, y0] = this.px(uv0), [x1, y1] = this.px(uv1);
    // solo donde hay algo que remover
    let near = false;
    for (const q of this.p) {
      if (Math.abs(q.x - x1) < 26 && Math.abs(q.y - y1) < 26) {
        near = true;
        break;
      }
    }
    if (!near) return false;
    this.smear(uv0, uv1);
    if (!this.g) this.g = canvas(256);
    const c = this.g.getContext('2d'), k = 256 / S;
    c.lineCap = 'round';
    c.shadowColor = 'rgba(0,0,0,0.5)';
    c.shadowBlur = 3;
    c.strokeStyle = 'rgba(0,0,0,0.45)';
    c.lineWidth = 9;
    c.beginPath();
    c.moveTo(x0 * k, y0 * k);
    c.lineTo(x1 * k, y1 * k);
    c.stroke();
    this.dirty = true;
    return true;
  }

  honeyPool(uv, r, a, rgb = '226,150,38') {
    const [x, y] = this.px(uv);
    const c = this.decor.getContext('2d');
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${a})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
    this.dirty = true;
  }

  drizzle(uv0, uv1, color = 'rgba(226,150,38,0.9)', width = 5) {
    const [x0, y0] = this.px(uv0), [x1, y1] = this.px(uv1);
    const c = this.decor.getContext('2d');
    c.lineCap = 'round';
    c.strokeStyle = color;
    c.lineWidth = width;
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.stroke();
    c.strokeStyle = 'rgba(255,240,200,0.6)';
    c.lineWidth = Math.max(1, width * 0.3);
    c.beginPath();
    c.moveTo(x0 - 1, y0 - 1);
    c.lineTo(x1 - 1, y1 - 1);
    c.stroke();
    this.dirty = true;
  }

  contain() {
    const cx = S / 2, cy = S / 2;
    for (const q of this.p) {
      const dx = q.x - cx, dy = q.y - cy, d = Math.hypot(dx, dy), m = this.R - q.r * 0.6;
      if (d > m) {
        q.x = cx + (dx / d) * m;
        q.y = cy + (dy / d) * m;
      }
    }
  }

  render() {
    if (!this.dirty) return;
    this.dirty = false;
    const c = this.c.getContext('2d');
    c.drawImage(this.base, 0, 0);
    for (const q of this.p) {
      c.fillStyle = q.h || this.halo;
      c.beginPath();
      c.arc(q.x, q.y, q.r + 2.5, 0, 7);
      c.fill();
    }
    for (const q of this.p) {
      c.fillStyle = q.c || this.milk;
      c.beginPath();
      c.arc(q.x, q.y, q.r, 0, 7);
      c.fill();
    }
    // surcos de la cuchara: una sombrita suave bajo la decoración
    if (this.g) {
      c.globalAlpha = 0.3;
      c.drawImage(this.g, 0, 0, S, S);
      c.globalAlpha = 1;
    }
    c.drawImage(this.decor, 0, 0);
    this.texture.needsUpdate = true;
    if (this.h) {
      const x = this.h.getContext('2d'), k = 256 / S;
      x.fillStyle = '#000';
      x.fillRect(0, 0, 256, 256);
      if (!this.blob) {
        this.blob = canvas(64);
        const b = this.blob.getContext('2d'), g = b.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, 'rgba(255,255,255,0.32)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        b.fillStyle = g;
        b.fillRect(0, 0, 64, 64);
      }
      for (const q of this.p) {
        const r = q.r * 1.7 * k;
        x.drawImage(this.blob, q.x * k - r, q.y * k - r, r * 2, r * 2);
      }
      if (this.g) x.drawImage(this.g, 0, 0); // los surcos hunden el relieve
      this.heightTexture.needsUpdate = true;
    }
  }
}

export function cremaBase(x, S) {
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, '#a8774a');
  g.addColorStop(0.7, '#8e5d34');
  g.addColorStop(0.9, '#6f4626');
  g.addColorStop(1, '#4e2f18');
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  // motitas de crema
  for (let i = 0; i < 900; i++) {
    x.fillStyle = `rgba(${200 + Math.random() * 40},${150 + Math.random() * 30},90,0.12)`;
    x.beginPath();
    x.arc(Math.random() * S, Math.random() * S, 0.5 + Math.random() * 1.5, 0, 7);
    x.fill();
  }
}

export function bowlBase(x, S) {
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, '#a9bfcb');
  g.addColorStop(0.75, '#93acba');
  g.addColorStop(1, '#6f8896');
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  for (let i = 0; i < 700; i++) {
    x.fillStyle = 'rgba(70,90,100,0.35)';
    x.beginPath();
    x.arc(Math.random() * S, Math.random() * S, 0.5 + Math.random() * 1.2, 0, 7);
    x.fill();
  }
}

export function makeSurfaceMesh(surface, radius, roughness = 0.45) {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 64),
    new THREE.MeshStandardMaterial({ map: surface.texture, roughness }),
  );
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  return m;
}
