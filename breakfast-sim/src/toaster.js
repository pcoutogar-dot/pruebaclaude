// Tostadora retro: meter el pan, bajar la palanca, esperar a tu gusto y subirla.
// Si te despistas, salta sola (ya quemado). El dorado lleva las marcas de las
// resistencias, como una tostadora de verdad.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const M = (color, roughness = 0.6, o = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...o });

function makeToaster() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.0, 0.62, 0.62, 6, 0.16), M('#f2d3c4', 0.55));
  body.position.y = 0.31;
  const band = new THREE.Mesh(new RoundedBoxGeometry(1.02, 0.08, 0.64, 4, 0.04), M('#d9d6d0', 0.3, { metalness: 0.8 }));
  band.position.y = 0.1;
  const slotMat = M('#2a211c', 0.9);
  const glowMat = M('#3a1a0c', 0.9, { emissive: '#ff5a1a', emissiveIntensity: 0 });
  const slots = [-0.17, 0.17].map((z) => {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.02, 0.09), slotMat);
    s.position.set(0, 0.625, z);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.015, 0.06), glowMat);
    glow.position.set(0, 0.628, z);
    g.add(s, glow);
    return s;
  });
  const track = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.4, 0.06), slotMat);
  track.position.set(0.51, 0.36, 0);
  const lever = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.06, 0.12, 3, 0.025), M('#cfcac2', 0.3, { metalness: 0.7 }));
  lever.position.set(0.55, 0.5, 0);
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 24), M('#cfcac2', 0.3, { metalness: 0.7 }));
  dial.rotation.z = Math.PI / 2;
  dial.position.set(0.52, 0.2, 0.15);
  const feet = [[-0.38, -0.2], [0.38, -0.2], [-0.38, 0.2], [0.38, 0.2]].map(([x, z]) => {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 12), M('#2a2622', 0.8));
    f.position.set(x, 0.0, z);
    return f;
  });
  g.add(body, band, track, lever, dial, ...feet);
  g.traverse((c) => c.isMesh && (c.castShadow = c.receiveShadow = true));
  g.userData = { lever, glowMat, slots };
  return g;
}

export class ToasterProc {
  constructor({ parent, getToast, getHome }) {
    this.getToast = getToast; // () => Toast actual
    this.getHome = getHome; // () => { pos: Vector3, ry } dónde vive la tostada en la mesa
    this.obj = makeToaster();
    parent.add(this.obj);
    this.reset();
  }

  reset() {
    this.state = 'idle';
    this.level = 0; // cuánto calor ha recibido en la tostadora
    this.anim = null;
    this.obj.userData.lever.position.y = 0.5;
    this.obj.userData.glowMat.emissiveIntensity = 0;
  }

  get done() {
    return this.state === 'popped' || this.state === 'skipped';
  }

  // centro de la tostada según lo metida que esté (0 = asomando, 1 = dentro)
  slotPos(depth) {
    const top = this.obj.localToWorld(new THREE.Vector3(0, 0.62, -0.17));
    return top.add(new THREE.Vector3(0, 0.42 - depth * 0.6, 0));
  }

  down(step, e, ctx) {
    this.last = [e.clientX, e.clientY];
    this.acc = 0;
    if (this.anim) return true;
    if (this.state === 'idle') {
      // meter el pan: vuela de la tabla a la ranura
      this.flyTo('in', 0.75);
      ctx.sfx.plop(0.8, 1.2);
    } else if (this.state === 'toasting') {
      this.pop(ctx);
    }
    return true;
  }

  move(step, e, ctx) {
    const dy = e.clientY - this.last[1];
    this.last = [e.clientX, e.clientY];
    if (this.state === 'in' && !this.anim) {
      // bajar la palanca arrastrando hacia abajo
      this.acc += Math.max(0, dy);
      const t = Math.min(1, this.acc / 90);
      this.obj.userData.lever.position.y = 0.5 - t * 0.28;
      this.placeToast(0.15 + t * 0.6);
      if (t >= 1) {
        this.state = 'toasting';
        ctx.sfx.plop(0.6, 0.6);
        ctx.say('Tostando… 🔥', 'Sube la palanca cuando te guste (toca la tostadora)');
      }
    }
  }

  up() {
    if (this.state === 'in' && !this.anim) {
      this.obj.userData.lever.position.y = 0.5;
      this.placeToast(0.15);
    }
  }

  pop(ctx) {
    this.state = 'popping';
    this.obj.userData.lever.position.y = 0.5;
    this.obj.userData.glowMat.emissiveIntensity = 0;
    ctx.sfx.plop(1.2, 1.6);
    this.flyTo('popped', 1.1, true);
  }

  // coloca la tostada de pie dentro de la ranura (depth 0 = fuera, 1 = dentro)
  placeToast(depth) {
    const t = this.getToast().group;
    t.position.copy(this.slotPos(depth));
    t.rotation.set(Math.PI / 2, 0, 0);
  }

  flyTo(next, dur, jump = false) {
    const t = this.getToast().group;
    const home = this.getHome();
    const from = { p: t.position.clone(), q: t.quaternion.clone() };
    const toSlot = next === 'in';
    const toP = toSlot ? this.slotPos(0.15) : home.pos.clone();
    const toQ = new THREE.Quaternion().setFromEuler(toSlot ? new THREE.Euler(Math.PI / 2, 0, 0) : new THREE.Euler(0, home.ry, 0));
    this.anim = { t: 0, dur, from, toP, toQ, next, jump };
  }

  update(dt, ctx) {
    const a = this.anim;
    if (a) {
      a.t = Math.min(1, a.t + dt / a.dur);
      const e = a.t < 0.5 ? 2 * a.t * a.t : 1 - (-2 * a.t + 2) ** 2 / 2;
      const t = this.getToast().group;
      t.position.lerpVectors(a.from.p, a.toP, e);
      t.position.y += Math.sin(a.t * Math.PI) * (a.jump ? 1.2 : 0.6); // salto al saltar la tostadora
      t.quaternion.slerpQuaternions(a.from.q, a.toQ, e);
      if (a.jump) t.rotateX(Math.sin(a.t * Math.PI) * 0.6);
      if (a.t >= 1) {
        this.anim = null;
        this.state = a.next;
        if (a.next === 'popped') ctx?.chime();
      }
    }
    if (this.state === 'toasting') {
      const glow = this.obj.userData.glowMat;
      glow.emissiveIntensity = 1.6 + Math.sin(ctx.time * 3) * 0.2;
      this.level += dt;
      this.getToast().toasterHeat(dt);
      ctx.sfx.sizzle(true);
      // si te olvidas, salta sola (ya muy tostada)
      if (this.level > 14) this.pop(ctx);
    }
  }
}
