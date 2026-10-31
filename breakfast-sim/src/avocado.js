// Preparar el aguacate, paso a paso y a mano:
//   cortar → abrir girando → sacar el hueso → pelar a tiras → laminar (opcional)
// Cada gesto es pequeño y "satisfactorio"; ninguno se puede hacer mal.
import * as THREE from 'three';
import { AVO } from './props.js';
import { avocadoFleshTexture, noiseBump } from './textures.js';

const K = 6;
// radio del aguacate a lo largo de su eje (interpolando el perfil)
function radiusAt(t) {
  for (let i = 1; i < AVO.length; i++) {
    const [r0, y0] = AVO[i - 1], [r1, y1] = AVO[i];
    if (t <= y1) return r0 + ((r1 - r0) * (t - y0)) / (y1 - y0);
  }
  return 0;
} // tiras de piel por mitad
const lathe = (pts, segs, a, b, sx = 1) =>
  new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x * sx, y)), segs, a, b);

const skinMat = new THREE.MeshStandardMaterial({
  color: '#344a20', roughness: 0.85, bumpMap: noiseBump(8, 6000, [1, 2.5]), bumpScale: 3, side: THREE.DoubleSide,
});
const underMat = new THREE.MeshStandardMaterial({ color: '#93bd4e', roughness: 0.45 });
const fleshTex = avocadoFleshTexture();
const hollowTex = avocadoFleshTexture(true);
const sliceMat = new THREE.MeshStandardMaterial({ color: '#6f9a3a', roughness: 0.5 });

function half(withPit) {
  const wrap = new THREE.Group();
  const inner = new THREE.Group();
  const skins = [];
  for (let i = 0; i < K; i++) {
    const m = new THREE.Mesh(lathe(AVO, 6, (i * Math.PI) / K, Math.PI / K), skinMat.clone());
    m.castShadow = m.receiveShadow = true;
    m.userData.skin = true;
    skins.push(m);
    inner.add(m);
  }
  const under = new THREE.Mesh(lathe(AVO, 36, 0, Math.PI, 0.96), underMat);
  under.castShadow = true;
  inner.add(under);
  const pts = AVO.map(([x, y]) => new THREE.Vector2(x * 0.985, y));
  const back = AVO.slice().reverse().map(([x, y]) => new THREE.Vector2(-x * 0.985, y));
  const fg = new THREE.ShapeGeometry(new THREE.Shape([...pts, ...back.slice(1)]), 24);
  const uv = fg.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + 0.45) / 0.9, uv.getY(i) / 1.02);
  fg.rotateY(-Math.PI / 2);
  const faceMat = new THREE.MeshStandardMaterial({ map: fleshTex, roughness: 0.45, side: THREE.DoubleSide });
  const face = new THREE.Mesh(fg, faceMat);
  face.receiveShadow = true;
  inner.add(face);
  let pit = null;
  if (withPit) {
    pit = new THREE.Mesh(new THREE.SphereGeometry(0.17, 32, 24), new THREE.MeshStandardMaterial({ color: '#7b4a2b', roughness: 0.3 }));
    pit.scale.set(0.75, 1.05, 1);
    pit.position.set(0, 0.36, 0);
    pit.castShadow = true;
    pit.userData.pit = true;
    inner.add(pit);
  }
  // el eje largo pasa a X y la cara del corte mira hacia arriba
  inner.rotation.z = -Math.PI / 2;
  wrap.add(inner);
  const slices = new THREE.Group();
  wrap.add(slices);
  return { wrap, inner, skins, face, faceMat, pit, slices, peeled: 0 };
}

export class AvocadoPrep {
  constructor() {
    this.group = new THREE.Group();
    this.group.scale.setScalar(0.85);
    this.A = half(true);
    this.B = half(false);
    this.group.add(this.A.wrap, this.B.wrap);
    this.falling = [];
    this.reset();
  }

  reset() {
    this.state = 'whole';
    this.cutLen = 0;
    this.openT = 0;
    this.flipT = 0;
    this.slices = 0;
    this.pitDrag = null;
    for (const h of [this.A, this.B]) {
      h.peeled = 0;
      h.skins.forEach((s) => {
        s.visible = true;
        s.position.set(0, 0, 0);
        s.rotation.set(0, 0, 0);
        s.material.opacity = 1;
        s.material.transparent = false;
        s.userData.gone = false;
      });
      h.faceMat.map = fleshTex;
      h.faceMat.needsUpdate = true;
      h.slices.clear();
    }
    this.A.pit.visible = true;
    this.A.pit.position.set(0, 0.36, 0);
    this.A.pit.scale.set(0.75, 1.05, 1);
    this.falling.length = 0;
    this.pose();
  }

  get cut() { return this.state !== 'whole'; }
  get open() { return ['open', 'pitless', 'peeled'].includes(this.state); }
  get pitless() { return ['pitless', 'peeled'].includes(this.state); }
  get peeled() { return this.state === 'peeled'; }

  // coloca las mitades según el progreso (abrir y dar la vuelta para pelar)
  pose() {
    const t = this.openT, f = this.flipT;
    const y0 = 0.42;
    // A: boca arriba; al pelar se da la vuelta (cúpula arriba)
    this.A.wrap.position.set(0, y0 * (1 - f), 0);
    this.A.wrap.rotation.x = Math.PI * f;
    // B: empieza encima (boca abajo), se abre hacia delante
    const sep = this.state === 'whole' ? 0 : 0.012;
    this.B.wrap.position.set(0, y0 + sep + Math.sin(t * Math.PI) * 0.5 - y0 * f, t * 1.05);
    this.B.wrap.rotation.x = Math.PI * (1 - t) + Math.PI * f;
  }

  targets() {
    return [this.group];
  }

  // ---- gestos ----
  down(step, e, ctx) {
    const h = ctx.cast(e, this.targets());
    this.last = [e.clientX, e.clientY];
    this.acc = 0;
    // el corte puede empezar fuera del aguacate (como un cuchillo de verdad)
    if (step === 'cut') return true;
    if (!h) return false;
    if (step === 'pit') {
      if (!h.object.userData.pit || this.state !== 'open') return true;
      this.pitDrag = { start: h.point.clone() };
      ctx.sfx.plop();
    }
    if (step === 'slice' && this.peeled) this.sliceStart = { e: [e.clientX, e.clientY], h };
    return true;
  }

  move(step, e, ctx) {
    const dx = e.clientX - this.last[0], dy = e.clientY - this.last[1];
    this.last = [e.clientX, e.clientY];
    const d = Math.hypot(dx, dy);
    if (step === 'cut' && this.state === 'whole') {
      if (!ctx.cast(e, this.targets())) return;
      this.cutLen += d;
      ctx.sfx.scrape(d * 0.0015);
      if (this.cutLen > 110) {
        this.state = 'cut';
        ctx.sfx.stop();
        ctx.sfx.plop();
        this.pose();
      }
    } else if (step === 'open' && this.state === 'cut') {
      this.openT = Math.min(1, this.openT + d / 260);
      this.pose();
      if (this.openT >= 1) {
        this.state = 'open';
        ctx.sfx.plop();
      }
    } else if (step === 'pit' && this.pitDrag) {
      const p = ctx.planePoint(e, this.group.getWorldPosition(new THREE.Vector3()).y + 0.7);
      if (p) {
        const local = this.A.inner.worldToLocal(p.clone());
        this.A.pit.position.lerp(local, 0.5);
      }
    } else if (step === 'peel' && this.state === 'pitless' && this.flipT >= 1) {
      // cada tira que tocas se despega
      const h = ctx.cast(e, this.targets());
      if (h && h.object.userData.skin && !h.object.userData.gone) {
        const s = h.object;
        s.userData.gone = true;
        s.material.transparent = true;
        const half = this.A.skins.includes(s) ? this.A : this.B;
        half.peeled++;
        this.falling.push({ s, t: 0, dir: Math.random() > 0.5 ? 1 : -1 });
        ctx.sfx.scrape(0.02);
        setTimeout(() => ctx.sfx.stop(), 90);
        if (this.A.peeled + this.B.peeled >= K * 2) {
          this.state = 'peeled';
          ctx.chime();
        }
      }
    } else if (step === 'slice' && this.sliceStart) {
      this.acc += d;
    }
  }

  up(step, e, ctx) {
    ctx.sfx.stop();
    if (step === 'pit' && this.pitDrag) {
      const moved = this.A.pit.position.distanceTo(new THREE.Vector3(0, 0.36, 0));
      if (moved > 0.18) {
        this.pitFly = 0;
        this.state = 'pitless';
        this.A.faceMat.map = hollowTex;
        this.A.faceMat.needsUpdate = true;
        ctx.chime();
      } else this.A.pit.position.set(0, 0.36, 0);
      this.pitDrag = null;
    }
    if (step === 'slice' && this.sliceStart && this.acc > 40) {
      const h = this.sliceStart.h;
      const half = h.object.parent?.parent === this.B.wrap || h.object.parent === this.B.wrap ? this.B : this.A;
      const local = half.wrap.worldToLocal(h.point.clone());
      if (half.slices.children.length < 9) {
        // corte: un aro fino que sigue la curva del aguacate en ese punto
        const x = THREE.MathUtils.clamp(local.x, 0.1, 0.92);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(radiusAt(x) * 0.965, 0.011, 6, 28, Math.PI), sliceMat);
        ring.rotation.y = Math.PI / 2;
        const cut = new THREE.Group();
        cut.add(ring);
        cut.rotation.x = Math.PI;
        cut.position.x = x;
        half.slices.add(cut);
        this.slices += 1;
        ctx.sfx.scrape(0.03);
        setTimeout(() => ctx.sfx.stop(), 110);
      }
    }
    this.sliceStart = null;
  }

  update(dt, step) {
    // al llegar a "pelar", las mitades se dan la vuelta solas
    if (step === 'peel' && this.state === 'pitless' && this.flipT < 1) {
      this.flipT = Math.min(1, this.flipT + dt * 1.6);
      this.pose();
    }
    if (this.pitFly !== undefined && this.pitFly < 1) {
      this.pitFly += dt * 1.8;
      const p = this.A.pit;
      p.position.y += dt * 2.2;
      p.position.z += dt * 1.5;
      p.scale.multiplyScalar(1 - dt * 2.5);
      if (this.pitFly >= 1) p.visible = false;
    }
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const f = this.falling[i];
      f.t += dt;
      f.s.rotation.z += dt * 2.2 * f.dir;
      f.s.position.y -= dt * 0.9;
      f.s.position.x += dt * 0.6 * f.dir;
      f.s.material.opacity = Math.max(0, 1 - f.t * 1.6);
      if (f.t > 0.7) {
        f.s.visible = false;
        this.falling.splice(i, 1);
      }
    }
  }
}
