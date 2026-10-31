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
  constructor({ drawBase, milk, halo, push = 1, size = [6, 10], capacity = 2600 }) {
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
    this.decor.getContext('2d').clearRect(0, 0, S, S);
    this.dirty = true;
    this.render();
  }

  get full() {
    return this.p.length >= this.capacity;
  }

  get fill() {
    return this.p.length / this.capacity;
  }

  snapshot() {
    const d = this.decor.getContext('2d').getImageData(0, 0, S, S);
    const p = this.p.map((q) => ({ ...q }));
    return () => {
      this.p = p;
      this.decor.getContext('2d').putImageData(d, 0, 0);
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
    for (let i = 0; i < n && !this.full; i++) {
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

  drizzle(uv0, uv1, color = 'rgba(226,150,38,0.9)') {
    const [x0, y0] = this.px(uv0), [x1, y1] = this.px(uv1);
    const c = this.decor.getContext('2d');
    c.lineCap = 'round';
    c.strokeStyle = color;
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.stroke();
    c.strokeStyle = 'rgba(255,240,200,0.6)';
    c.lineWidth = 1.5;
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
    c.fillStyle = this.halo;
    for (const q of this.p) {
      c.beginPath();
      c.arc(q.x, q.y, q.r + 2.5, 0, 7);
      c.fill();
    }
    c.fillStyle = this.milk;
    for (const q of this.p) {
      c.beginPath();
      c.arc(q.x, q.y, q.r, 0, 7);
      c.fill();
    }
    c.drawImage(this.decor, 0, 0);
    this.texture.needsUpdate = true;
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
