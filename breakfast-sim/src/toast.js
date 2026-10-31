// La tostada: geometría con forma de rebanada + superficie "pintable" con el dedo.
// La superficie usa tres canvas (color, relieve y brillo) para que lo untado
// tenga volumen y reflejo, no solo color.
import * as THREE from 'three';
import { canvas, tex, rng } from './textures.js';

const CW = 768; // color
const HW = 384; // relieve / rugosidad
const MW = 64; // máscara para calcular % cubierto

function sourdoughShape() {
  const pts = [];
  const N = 72;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const c = Math.cos(t), s = Math.sin(t);
    const y = s > 0 ? 0.5 * s : -0.4 * Math.pow(Math.abs(s), 0.65);
    const w = 1 + 0.025 * Math.sin(t * 5 + 1) + 0.015 * Math.sin(t * 9 + 2);
    pts.push(new THREE.Vector2(0.64 * c * w, y * w));
  }
  return new THREE.Shape(pts);
}

function sandwichShape() {
  const s = new THREE.Shape();
  s.moveTo(-0.42, -0.45);
  s.lineTo(0.42, -0.45);
  s.quadraticCurveTo(0.46, -0.45, 0.46, -0.41);
  s.lineTo(0.46, 0.22);
  s.bezierCurveTo(0.62, 0.34, 0.52, 0.6, 0.22, 0.57);
  s.bezierCurveTo(0.08, 0.56, -0.08, 0.56, -0.22, 0.57);
  s.bezierCurveTo(-0.52, 0.6, -0.62, 0.34, -0.46, 0.22);
  s.lineTo(-0.46, -0.41);
  s.quadraticCurveTo(-0.46, -0.45, -0.42, -0.45);
  return s;
}

export class Toast {
  constructor(kind) {
    this.kind = kind; // 'sourdough' | 'sandwich'
    const shape = kind === 'sourdough' ? sourdoughShape() : sandwichShape();
    this.outline = shape.getPoints(32);
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (const p of this.outline) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    this.bounds = { minX, minY, w: maxX - minX, h: maxY - minY };

    const depth = kind === 'sourdough' ? 0.1 : 0.08;
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 4,
      curveSegments: 32,
    });
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, (uv.getX(i) - minX) / this.bounds.w, (uv.getY(i) - minY) / this.bounds.h);
    }
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0.03, 0);
    this.topY = depth + 0.06;

    this.cColor = canvas(CW);
    this.cHeight = canvas(HW);
    this.cRough = canvas(HW);
    this.cMask = canvas(MW);
    this.cPaint = canvas(MW);
    this.tColor = tex(this.cColor);
    this.tHeight = tex(this.cHeight, { srgb: false });
    this.tRough = tex(this.cRough, { srgb: false });

    const top = new THREE.MeshStandardMaterial({
      map: this.tColor,
      bumpMap: this.tHeight,
      bumpScale: 4,
      roughnessMap: this.tRough,
      roughness: 1,
    });
    const crust = (this.crustMat = new THREE.MeshStandardMaterial({
      color: kind === 'sourdough' ? '#b07a45' : '#d4a26a',
      roughness: 0.85,
    }));
    this.crustRaw = new THREE.Color(crust.color);
    this.crustBurnt = new THREE.Color('#3a2210');
    this.mesh = new THREE.Mesh(geo, [top, crust]);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.group = new THREE.Group();
    this.group.add(this.mesh);

    // máscara de la forma (para el % cubierto)
    const m = this.cMask.getContext('2d');
    this.pathOn(m, MW);
    m.fillStyle = '#000';
    m.fill();
    const md = m.getImageData(0, 0, MW, MW).data;
    this.maskIdx = [];
    for (let i = 0; i < MW * MW; i++) if (md[i * 4 + 3] > 128) this.maskIdx.push(i);

    this.reset();
  }

  // traza el contorno de la rebanada en un canvas de tamaño S
  pathOn(x, S) {
    const { minX, minY, w, h } = this.bounds;
    x.beginPath();
    this.outline.forEach((p, i) => {
      const px = ((p.x - minX) / w) * S, py = (1 - (p.y - minY) / h) * S;
      i ? x.lineTo(px, py) : x.moveTo(px, py);
    });
    x.closePath();
  }

  reset() {
    const r = rng(this.kind === 'sourdough' ? 77 : 78);
    const c = this.cColor.getContext('2d');
    const hh = this.cHeight.getContext('2d');
    const ro = this.cRough.getContext('2d');
    const k = HW / CW;
    const sour = this.kind === 'sourdough';

    c.fillStyle = sour ? '#9a5a26' : '#c98a4b';
    c.fillRect(0, 0, CW, CW);
    hh.fillStyle = '#808080';
    hh.fillRect(0, 0, HW, HW);
    ro.fillStyle = '#d6d6d6';
    ro.fillRect(0, 0, HW, HW);

    c.save();
    this.pathOn(c, CW);
    c.clip();
    // miga tostada: centro claro, bordes dorados
    const g = c.createRadialGradient(CW / 2, CW / 2, 40, CW / 2, CW / 2, CW * 0.6);
    if (sour) {
      // miga cruda: el jugador la tuesta a su gusto
      g.addColorStop(0, '#f1e0bf');
      g.addColorStop(0.6, '#ead3a6');
      g.addColorStop(1, '#dcbd88');
    } else {
      g.addColorStop(0, '#fbf3e3');
      g.addColorStop(0.7, '#f6ead2');
      g.addColorStop(1, '#efdcbc');
    }
    c.fillStyle = g;
    c.fillRect(0, 0, CW, CW);
    // tostado hacia el borde
    for (const [lw, a] of [[60, 0.04], [26, 0.08]]) {
      this.pathOn(c, CW);
      c.lineWidth = lw;
      c.strokeStyle = sour ? `rgba(150,85,30,${a})` : `rgba(170,120,60,${a})`;
      c.stroke();
    }
    // alveolos de la miga (masa madre = alveolos grandes e irregulares)
    hh.save();
    this.pathOn(hh, HW);
    hh.clip();
    const n = sour ? 340 : 900;
    for (let i = 0; i < n; i++) {
      const big = sour && r() < 0.18;
      const rad = big ? 9 + r() * 20 : sour ? 2 + r() * 6 : 1 + r() * 2.2;
      const px = r() * CW, py = r() * CW, rot = r() * 3, ex = 0.5 + r() * 0.6;
      c.fillStyle = sour ? 'rgba(170,120,60,0.5)' : 'rgba(200,175,130,0.4)';
      c.beginPath();
      c.ellipse(px, py, rad, rad * ex, rot, 0, 7);
      c.fill();
      c.fillStyle = sour ? 'rgba(255,235,190,0.35)' : 'rgba(255,250,235,0.5)';
      c.beginPath();
      c.ellipse(px - rad * 0.25, py - rad * 0.25, rad * 0.5, rad * ex * 0.4, rot, 0, 7);
      c.fill();
      hh.fillStyle = 'rgba(20,20,20,0.7)';
      hh.beginPath();
      hh.ellipse(px * k, py * k, rad * k, rad * ex * k, rot, 0, 7);
      hh.fill();
    }
    hh.restore();
    c.restore();

    this.cPaint.getContext('2d').clearRect(0, 0, MW, MW);
    this.covered = 0;
    this.heatTotal = 0;
    this.crustMat.color.copy(this.crustRaw);
    this.dirty = true;
    this.flush();
  }

  // Tostar: el calor se acumula donde mantienes el dedo. Puedes dorarlo parejo,
  // dejar el centro claro... o quemarlo. Nada impide el resultado "imperfecto".
  heat(u, v, dt) {
    const x = u * CW, y = (1 - v) * CW, r = Math.random;
    const c = this.cColor.getContext('2d');
    c.save();
    this.pathOn(c, CW);
    c.clip();
    c.globalCompositeOperation = 'multiply';
    const R = 90 + r() * 20;
    const g = c.createRadialGradient(x, y, 0, x, y, R);
    const a = Math.min(0.5, dt * 1.6);
    g.addColorStop(0, `rgba(196,128,62,${a})`);
    g.addColorStop(0.6, `rgba(205,145,80,${a * 0.6})`);
    g.addColorStop(1, 'rgba(220,170,110,0)');
    c.fillStyle = g;
    c.fillRect(x - R, y - R, R * 2, R * 2);
    // tostado irregular: motitas más oscuras
    for (let i = 0; i < 6; i++) {
      c.fillStyle = `rgba(150,90,40,${a * 0.8})`;
      c.beginPath();
      c.arc(x + (r() - 0.5) * R * 1.4, y + (r() - 0.5) * R * 1.4, 3 + r() * 10, 0, 7);
      c.fill();
    }
    c.restore();
    this.heatTotal += dt;
    this.crustMat.color.copy(this.crustRaw).lerp(this.crustBurnt, Math.min(0.85, this.heatTotal / 14));
    this.dirty = true;
  }

  // Guarda el estado antes de un trazo (para "Deshacer")
  snapshot() {
    const cs = [this.cColor, this.cHeight, this.cRough, this.cPaint].map((c) => {
      const x = c.getContext('2d');
      return [x, x.getImageData(0, 0, c.width, c.height)];
    });
    const heat = this.heatTotal, crust = this.crustMat.color.clone();
    return () => {
      for (const [x, d] of cs) x.putImageData(d, 0, 0);
      this.heatTotal = heat;
      this.crustMat.color.copy(crust);
      this.dirty = true;
    };
  }

  // Pinta un trazo entre dos coordenadas uv. La dirección y la velocidad del
  // dedo cambian el resultado: vetas del cuchillo, capa fina si vas rápido,
  // grumos si vas despacio. No hay "untado perfecto".
  paint(u0, v0, u1, v1, spread) {
    const x0 = u0 * CW, y0 = (1 - v0) * CW, x1 = u1 * CW, y1 = (1 - v1) * CW;
    const d = Math.hypot(x1 - x0, y1 - y0);
    if (spread === 'honey') {
      this.drizzle(x0, y0, x1, y1);
      this.dirty = true;
      return;
    }
    const ang = Math.atan2(y1 - y0, x1 - x0);
    const thick = Math.max(0.62, Math.min(1.15, 1.25 - d / 80));
    const step = 9;
    const n = Math.max(1, Math.ceil(d / step));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      this.stamp(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, spread, ang, thick);
    }
    this.dirty = true;
  }

  clipAll(fn) {
    const c = this.cColor.getContext('2d'), hh = this.cHeight.getContext('2d'), ro = this.cRough.getContext('2d');
    for (const [x, S] of [[c, CW], [hh, HW], [ro, HW]]) {
      x.save();
      this.pathOn(x, S);
      x.clip();
    }
    fn(c, hh, ro);
    c.restore();
    hh.restore();
    ro.restore();
  }

  drizzle(x0, y0, x1, y1) {
    const k = HW / CW;
    this.clipAll((c, hh, ro) => {
      c.lineCap = hh.lineCap = ro.lineCap = 'round';
      const w = 7 + Math.random() * 3;
      c.strokeStyle = 'rgba(214,138,30,0.75)';
      c.lineWidth = w;
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
      c.strokeStyle = 'rgba(255,226,150,0.6)';
      c.lineWidth = w * 0.3;
      c.beginPath(); c.moveTo(x0 - 1.5, y0 - 1.5); c.lineTo(x1 - 1.5, y1 - 1.5); c.stroke();
      hh.strokeStyle = 'rgba(200,200,200,0.6)';
      hh.lineWidth = w * k;
      hh.beginPath(); hh.moveTo(x0 * k, y0 * k); hh.lineTo(x1 * k, y1 * k); hh.stroke();
      ro.strokeStyle = 'rgba(30,30,30,0.9)';
      ro.lineWidth = w * k;
      ro.beginPath(); ro.moveTo(x0 * k, y0 * k); ro.lineTo(x1 * k, y1 * k); ro.stroke();
    });
  }

  stamp(x, y, spread, ang = 0, thick = 1) {
    const k = HW / CW, r = Math.random;
    const R = 54;
    this.clipAll((c, hh, ro) => {
      const ellipse = (ctx, cx, cy, rx, ry) => {
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, ang, 0, 7);
        ctx.fill();
      };
      if (spread === 'avocado' || spread === 'ricotta') {
        const avo = spread === 'avocado';
        c.save();
        c.translate(x, y);
        c.rotate(ang);
        const g = c.createRadialGradient(0, 0, 0, 0, 0, R);
        const base = avo ? '150,188,78' : '252,248,238';
        g.addColorStop(0, `rgba(${base},${0.9 * thick})`);
        g.addColorStop(0.7, `rgba(${base},${0.75 * thick})`);
        g.addColorStop(1, `rgba(${base},0)`);
        c.fillStyle = g;
        c.beginPath();
        c.ellipse(0, 0, R * 1.15, R * 0.8, 0, 0, 7);
        c.fill();
        // vetas del cuchillo en la dirección del trazo
        for (let i = 0; i < 3; i++) {
          const off = (r() - 0.5) * R * 1.2;
          c.strokeStyle = avo
            ? `rgba(${r() > 0.5 ? '205,222,130' : '108,145,52'},${0.35 * thick})`
            : `rgba(${r() > 0.5 ? '255,255,255' : '214,206,190'},${0.5 * thick})`;
          c.lineWidth = 1.5 + r() * 3;
          c.beginPath();
          c.moveTo(-R * 0.9, off);
          c.lineTo(R * 0.9, off + (r() - 0.5) * 4);
          c.stroke();
        }
        c.restore();
        if (avo) {
          // tropezones: más cuanto más despacio untas
          const cols = ['#d4e08a', '#b6cf68', '#7ea544', '#e3e8a6', '#5f8a33', '#c2d873'];
          const chunks = Math.round(3 + thick * 7);
          for (let i = 0; i < chunks; i++) {
            const a = r() * 6.28, dd = r() * R * 0.75, s = 3 + r() * 9 * thick;
            c.globalAlpha = 0.5 + r() * 0.5;
            c.fillStyle = cols[(r() * cols.length) | 0];
            c.beginPath();
            c.ellipse(x + Math.cos(a) * dd, y + Math.sin(a) * dd, s, s * (0.5 + r() * 0.5), r() * 3, 0, 7);
            c.fill();
          }
          c.globalAlpha = 1;
        }
        const hg = hh.createRadialGradient(x * k, y * k, 0, x * k, y * k, R * k);
        hg.addColorStop(0, `rgba(235,235,235,${0.45 * thick})`);
        hg.addColorStop(1, 'rgba(235,235,235,0)');
        hh.fillStyle = hg;
        ellipse(hh, x * k, y * k, R * k * 1.15, R * k * 0.8);
        for (let i = 0; i < (avo ? 4 : 2); i++) {
          hh.fillStyle = `rgba(255,255,255,${(0.3 + r() * 0.4) * thick})`;
          hh.beginPath();
          hh.arc((x + (r() - 0.5) * R) * k, (y + (r() - 0.5) * R) * k, (3 + r() * 6) * k, 0, 7);
          hh.fill();
        }
        ro.fillStyle = avo ? 'rgba(100,100,100,0.35)' : 'rgba(150,150,150,0.3)';
      } else {
        // margarina barata: fina, brillante y un poco triste
        const g = c.createRadialGradient(x, y, 0, x, y, R);
        g.addColorStop(0, 'rgba(255,232,150,0.22)');
        g.addColorStop(1, 'rgba(255,232,150,0)');
        c.fillStyle = g;
        c.beginPath();
        c.arc(x, y, R, 0, 7);
        c.fill();
        ro.fillStyle = 'rgba(70,70,70,0.25)';
      }
      ellipse(ro, x * k, y * k, R * k, R * k * 0.75);
    });
    const p = this.cPaint.getContext('2d'), mk = MW / CW;
    p.fillStyle = '#000';
    p.beginPath();
    p.arc(x * mk, y * mk, R * mk * 0.85, 0, 7);
    p.fill();
  }

  flush() {
    if (!this.dirty) return;
    this.dirty = false;
    this.tColor.needsUpdate = true;
    this.tHeight.needsUpdate = true;
    this.tRough.needsUpdate = true;
    const d = this.cPaint.getContext('2d').getImageData(0, 0, MW, MW).data;
    let hit = 0;
    for (const i of this.maskIdx) if (d[i * 4 + 3] > 0) hit++;
    this.covered = hit / this.maskIdx.length;
  }

  // de coordenadas de la forma (x, y) a la posición local sobre la tostada
  local(x, y) {
    return new THREE.Vector3(x, this.topY, -y);
  }

  randomPointInside(r = Math.random) {
    for (let i = 0; i < 50; i++) {
      const x = this.bounds.minX + r() * this.bounds.w;
      const y = this.bounds.minY + r() * this.bounds.h;
      if (inside(this.outline, x * 0.85, y * 0.85)) return [x * 0.85, y * 0.85];
    }
    return [0, 0];
  }
}

function inside(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}
