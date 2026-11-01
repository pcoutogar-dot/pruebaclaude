import * as TG from './texgen.js';
// Preparar el aguacate, paso a paso y a mano:
//   cortar → abrir girando → sacar el hueso → pelar a tiras → laminar (opcional)
// Cada gesto es pequeño y "satisfactorio"; ninguno se puede hacer mal.
import * as THREE from 'three';
import { AVO } from './props.js';
import { avocadoFleshTexture, noiseBump } from './textures.js';
import { CANNON } from './physics.js';
import { Skin } from './skin.js';

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

const skinTex = TG.avocadoSkin();
for (const t of [skinTex.map, skinTex.normalMap, skinTex.roughnessMap]) t.repeat.set(2, 3);
const skinMat = new THREE.MeshStandardMaterial({
  map: skinTex.map, normalMap: skinTex.normalMap, roughnessMap: skinTex.roughnessMap, roughness: 1, side: THREE.DoubleSide,
});
// por dentro, la piel del aguacate es verde clarito
skinMat.onBeforeCompile = (sh) => {
  sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>',
    '#include <color_fragment>\n if (!gl_FrontFacing) diffuseColor.rgb = vec3(0.55, 0.68, 0.28);');
};
const underMat = new THREE.MeshStandardMaterial({ color: '#93bd4e', roughness: 0.45 });
const fleshTex = avocadoFleshTexture();
const hollowTex = avocadoFleshTexture(true);
const sliceMat = new THREE.MeshStandardMaterial({ color: '#6f9a3a', roughness: 0.5 });

function half(withPit) {
  const wrap = new THREE.Group();
  const inner = new THREE.Group();
  const skin = new Skin(AVO, skinMat);
  inner.add(skin.mesh, skin.strip);
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
  return { wrap, inner, skin, under, face, faceMat, pit, slices };
}

export class AvocadoPrep {
  constructor({ physics, debris, home }) {
    this.physics = physics;
    this.debris = debris; // contenedor en coordenadas de mundo para lo que cae
    this.home = home.clone();
    this.group = new THREE.Group();
    this.group.scale.setScalar(0.85);
    // "holder": su origen es el centro del aguacate (centro de masa equilibrado)
    this.holder = new THREE.Group();
    this.CENTER = new THREE.Vector3(0.38, 0.33, 0);
    this.holder.add(this.group);
    this.group.position.copy(this.CENTER).negate();
    this.A = half(true);
    this.B = half(false);
    this.group.add(this.A.wrap, this.B.wrap);
    this.loose = []; // trozos sueltos con física (piel, hueso)
    this.reset();
  }

  reset() {
    this.state = 'whole';
    this.cutLen = 0;
    this.openT = 0;
    this.flipT = 0;
    this.slices = 0;
    this.pitDrag = null;
    this.peelDrag = null;
    for (const it of this.loose) {
      this.physics.remove(it);
      it.mesh.removeFromParent();
    }
    this.loose.length = 0;
    for (const h of [this.A, this.B]) {
      h.skin.reset();
      h.faceMat.map = fleshTex;
      h.faceMat.needsUpdate = true;
      h.slices.clear();
    }
    const pit = this.A.pit;
    this.A.inner.add(pit);
    pit.visible = true;
    pit.position.set(0, 0.36, 0);
    pit.quaternion.identity();
    pit.scale.set(0.75, 1.05, 1);
    // el aguacate entero es un objeto físico: se puede coger y lanzar
    if (this.item) this.physics.remove(this.item);
    this.holder.position.copy(this.homeC());
    this.holder.quaternion.identity();
    this.holder.scale.setScalar(1);
    this.item = this.physics.add(this.holder, [
      [new CANNON.Sphere(0.3), new THREE.Vector3(-0.07, 0, 0)],
      [new CANNON.Sphere(0.22), new THREE.Vector3(0.24, -0.04, 0)],
    ], { mass: 1.2, home: this.homeC(), angularDamping: 0.6 });
    this.pose();
  }

  get cut() { return this.state !== 'whole'; }
  get open() { return ['open', 'pitless', 'peeled'].includes(this.state); }
  get pitless() { return ['pitless', 'peeled'].includes(this.state); }
  get peeled() { return this.state === 'peeled'; }

  homeC() {
    return this.home.clone().add(this.CENTER);
  }

  // basta con que esté sobre la tabla (aunque haya rodado un poco)
  atHome() {
    if (!this.item) return true;
    const p = this.holder.position, h = this.homeC();
    return Math.hypot(p.x - h.x, p.z - h.z) < 0.25 && Math.abs(p.y - h.y) < 0.15;
  }

  // vuelve suavemente a la tabla (para poder cortarlo)
  bringHome(dt) {
    const b = this.item.body;
    b.type = CANNON.Body.KINEMATIC;
    b.velocity.set(0, 0, 0);
    b.angularVelocity.set(0, 0, 0);
    const k = Math.min(1, dt * 7);
    const p = new THREE.Vector3().copy(b.position).lerp(this.homeC(), k);
    p.y += Math.sin(Math.min(1, p.distanceTo(this.homeC())) * Math.PI) * 0.05;
    const q = new THREE.Quaternion().copy(b.quaternion).slerp(new THREE.Quaternion(), k);
    b.position.set(p.x, p.y, p.z);
    b.quaternion.set(q.x, q.y, q.z, q.w);
    if (p.distanceTo(this.homeC()) < 0.01) {
      b.position.set(...this.homeC().toArray());
      b.quaternion.set(0, 0, 0, 1);
      b.type = CANNON.Body.DYNAMIC;
      this.homing = false;
    }
  }

  // coloca las mitades según el progreso (abrir y dar la vuelta para pelar)
  pose() {
    const t = this.openT, f = this.flipT;
    const y0 = 0.42;
    this.A.wrap.position.set(0, y0 * (1 - f), 0);
    this.A.wrap.rotation.x = Math.PI * f;
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
    if (step === 'cut') {
      if (this.state === 'whole' && this.item && (!this.atHome() || Math.abs(this.holder.quaternion.w) < 0.9)) this.homing = true;
      return true; // el corte puede empezar fuera del aguacate, como un cuchillo de verdad
    }
    if (!h) return false;
    if (step === 'pit') {
      if (!h.object.userData.pit || this.state !== 'open') return true;
      this.pitDrag = { hist: [] };
      ctx.sfx.plop();
    }
    if (step === 'peel' && this.state === 'pitless' && this.flipT >= 1) {
      const sk = h.object.userData.skin;
      if (sk) {
        const half = sk === this.A.skin ? this.A : this.B;
        const q = sk.paramOf(half.inner.worldToLocal(h.point.clone()));
        if (sk.begin(q)) {
          this.peelDrag = { half, sk, q };
          ctx.sfx.plop(0.6, 1.4);
        }
      }
    }
    if (step === 'slice' && this.peeled) this.sliceStart = { e: [e.clientX, e.clientY], h };
    return true;
  }

  move(step, e, ctx) {
    const dx = e.clientX - this.last[0], dy = e.clientY - this.last[1];
    this.last = [e.clientX, e.clientY];
    const d = Math.hypot(dx, dy);
    if (step === 'cut' && this.state === 'whole') {
      if (this.homing || !this.atHome() || !ctx.cast(e, this.targets())) return;
      this.cutLen += d;
      ctx.sfx.scrape(d * 0.0015);
      if (this.cutLen > 110) {
        // al cortarlo deja de ser un objeto suelto
        this.physics.remove(this.item);
        this.item = null;
        this.holder.position.copy(this.homeC());
        this.holder.quaternion.identity();
        this.holder.scale.setScalar(1);
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
      const p = ctx.planePoint(e, this.home.y + 0.7);
      if (p) {
        this.A.pit.position.lerp(this.A.inner.worldToLocal(p.clone()), 0.5);
        this.pitDrag.hist.push({ p: p.clone(), t: performance.now() / 1000 });
        if (this.pitDrag.hist.length > 6) this.pitDrag.hist.shift();
      }
    } else if (step === 'peel' && this.peelDrag) {
      // la tira crece por donde pasa el dedo (sobre la piel o sobre la carne ya pelada)
      const pd = this.peelDrag;
      const h = ctx.cast(e, [pd.sk.mesh, pd.half.under]);
      if (h) {
        const q = pd.sk.paramOf(pd.half.inner.worldToLocal(h.point.clone()));
        const sp = Math.hypot((q.phi - pd.q.phi) * 0.4, q.y - pd.q.y);
        pd.sk.extend(q, sp);
        pd.q = q;
        ctx.sfx.scrape(Math.min(0.012, sp * 0.08));
        // un tirón muy brusco rompe la tira
        if (sp > 0.28) this.finishStrip(ctx, dx, dy);
      }
      const f = ctx.planePoint(e, this.home.y + 0.55);
      if (f && this.peelDrag) pd.sk.setFinger(pd.half.inner.worldToLocal(f));
    } else if (step === 'slice' && this.sliceStart) {
      this.acc += d;
    }
  }

  up(step, e, ctx) {
    ctx.sfx.stop();
    if (step === 'pit' && this.pitDrag) {
      const moved = this.A.pit.position.distanceTo(new THREE.Vector3(0, 0.36, 0));
      if (moved > 0.18) this.releasePit(ctx);
      else this.A.pit.position.set(0, 0.36, 0);
      this.pitDrag = null;
    }
    if (step === 'peel' && this.peelDrag) this.finishStrip(ctx, 0, 0);
    if (step === 'slice' && this.sliceStart && this.acc > 40) {
      const h = this.sliceStart.h;
      let o = h.object, half = this.A;
      while (o) {
        if (o === this.B.wrap) half = this.B;
        o = o.parent;
      }
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

  // el hueso sale disparado con la fuerza del gesto (y luego es un objeto suelto)
  releasePit(ctx) {
    const pit = this.A.pit;
    const wp = pit.getWorldPosition(new THREE.Vector3());
    const ws = pit.getWorldScale(new THREE.Vector3());
    this.debris.attach(pit);
    pit.position.copy(wp);
    pit.scale.copy(ws);
    const it = this.physics.add(pit, [[new CANNON.Sphere(0.13)]], { mass: 0.35, home: this.home.clone().add(new THREE.Vector3(0.5, 0.2, -0.6)) });
    const h = this.pitDrag.hist;
    if (h.length > 1) {
      const a = h[0], b = h[h.length - 1], dt = Math.max(0.03, b.t - a.t);
      const v = b.p.clone().sub(a.p).divideScalar(dt).clampLength(0, 30);
      it.body.velocity.set(v.x, 6 + v.length() * 0.2, v.z);
    } else it.body.velocity.set(1, 8, 0.5);
    it.body.angularVelocity.set(4, 2, 3);
    this.loose.push(it);
    this.state = 'pitless';
    this.A.faceMat.map = hollowTex;
    this.A.faceMat.needsUpdate = true;
    ctx.chime();
  }

  // la tira se separa y cae con física real (con la forma que tenía al soltarla)
  finishStrip(ctx, dx = 0, dy = 0) {
    const pd = this.peelDrag;
    this.peelDrag = null;
    if (!pd) return;
    const geo0 = pd.sk.finish();
    if (geo0) {
      pd.half.inner.updateWorldMatrix(true, false);
      const geo = geo0.applyMatrix4(pd.half.inner.matrixWorld);
      geo.computeBoundingBox();
      const c = geo.boundingBox.getCenter(new THREE.Vector3());
      const size = geo.boundingBox.getSize(new THREE.Vector3());
      geo.translate(-c.x, -c.y, -c.z);
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, skinMat);
      m.castShadow = m.receiveShadow = true;
      m.position.copy(c);
      this.debris.add(m);
      const he = new CANNON.Vec3(Math.max(0.02, size.x / 2), Math.max(0.015, size.y / 4), Math.max(0.02, size.z / 2));
      const it = this.physics.add(m, [[new CANNON.Box(he)]], { mass: 0.05, linearDamping: 0.4, angularDamping: 0.6, home: null });
      it.body.velocity.set(dx * 0.015, 2 + Math.random() * 1.5, dy * 0.015);
      it.body.angularVelocity.set((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 4);
      this.loose.push(it);
      ctx.sfx.plop(0.7, 1.2);
    }
    // ¿queda poca piel a la vista? lo que está pegado a la tabla se suelta solo
    const left = this.A.skin.remaining(this.A.inner.matrixWorld) + this.B.skin.remaining(this.B.inner.matrixWorld);
    if (left < 0.12) {
      this.A.skin.clearAll();
      this.B.skin.clearAll();
      this.state = 'peeled';
      ctx.chime();
    }
  }

  // fracción de piel pegada (para la interfaz)
  get skinLeft() {
    return (this.A.skin.remaining(this.A.inner.matrixWorld) + this.B.skin.remaining(this.B.inner.matrixWorld)) / 2;
  }

  update(dt, step, ctx) {
    if (this.item && this.homing) this.bringHome(dt);
    // si se cae al suelo, vuelve solo a la tabla
    if (step === 'peel' && this.state === 'pitless' && this.flipT < 1) {
      this.flipT = Math.min(1, this.flipT + dt * 1.6);
      this.pose();
    }
    // la tira que estás pelando se levanta con un poco de retraso (blandita)
    if (this.peelDrag) this.peelDrag.sk.deform(dt);
  }
}
