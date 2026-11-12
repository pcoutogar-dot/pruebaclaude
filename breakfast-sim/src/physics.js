// Físicas "medianamente realistas": peso, rebote suave, fricción y golpes.
// Motor ligero (cannon-es) para ir fluido en iPhone. Escala: 1 unidad ≈ 10 cm.
import * as CANNON from 'cannon-es';
import * as THREE from 'three';

const G = -58; // gravedad suave: las cosas caen con calma, sin brusquedad

export class Physics {
  constructor() {
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, G, 0) });
    this.world.allowSleep = true;
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.mat = new CANNON.Material('def');
    this.world.addContactMaterial(new CANNON.ContactMaterial(this.mat, this.mat, { friction: 0.5, restitution: 0.36 }));
    this.items = []; // { mesh, body, home, onImpact, squash }
    this.kinematic = []; // cuerpos que siguen a un objeto de la escena (tablas, tazas...)
    this.onImpact = null;

    const box = (hx, hy, hz, x, y, z) => this.static(new CANNON.Box(new CANNON.Vec3(hx, hy, hz)), x, y, z);
    box(7, 0.07, 1.65, 2, -0.07, 0.05); // encimera
    box(7, 1.5, 1.55, 2, -1.64, -0.05); // muebles bajos
    box(7, 0.1, 6, 2, -3.3, 2); // suelo
    box(7, 5, 0.1, 2, 2, -1.7); // pared del fondo
    box(0.1, 5, 6, -4.1, 2, 2); // pared de la ventana
    box(0.1, 5, 6, 9.1, 2, 2); // límite derecho (invisible)
  }

  static(shape, x, y, z, q) {
    const b = new CANNON.Body({ mass: 0, material: this.mat });
    b.addShape(shape);
    b.position.set(x, y, z);
    if (q) b.quaternion.copy(q);
    this.world.addBody(b);
    return b;
  }

  // un obstáculo que sigue a un objeto (la tabla, la taza, el bol...)
  follow(obj, shape, offset = new THREE.Vector3()) {
    const b = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC, material: this.mat });
    b.addShape(shape);
    this.world.addBody(b);
    this.kinematic.push({ obj, b, offset });
    return b;
  }

  // objeto suelto que se puede coger y lanzar
  add(mesh, shapes, { mass = 1, home = null, linearDamping = 0.08, angularDamping = 0.25, grabbable = true } = {}) {
    const body = new CANNON.Body({ mass, material: this.mat, linearDamping, angularDamping });
    for (const [s, off] of shapes) body.addShape(s, off ? new CANNON.Vec3(off.x, off.y, off.z) : undefined);
    body.position.copy(mesh.position);
    body.quaternion.copy(mesh.quaternion);
    body.sleepSpeedLimit = 0.3;
    this.world.addBody(body);
    const it = { mesh, body, home, grabbable, sq: 0, sqV: 0, baseScale: mesh.scale.clone(), lastHit: 0 };
    body.addEventListener('collide', (e) => {
      const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
      if (v > 2.5 && performance.now() - it.lastHit > 90) {
        it.lastHit = performance.now();
        it.sqV += Math.min(v, 22) * 0.4; // se aplasta y rebota como gelatina
        this.onImpact?.(v, it);
      }
    });
    mesh.userData.phys = it;
    this.items.push(it);
    return it;
  }

  remove(it) {
    this.world.removeBody(it.body);
    this.items = this.items.filter((x) => x !== it);
    delete it.mesh.userData.phys;
  }

  // ---- coger y lanzar ----
  grab(it) {
    it.held = true;
    it.hist = [];
    it.sqV -= 5; // se estira un poquito al cogerlo
    it.body.wakeUp();
  }

  holdTo(it, target, time) {
    it.target = target.clone();
    it.hist.push({ p: target.clone(), t: time });
    while (it.hist.length > 1 && time - it.hist[0].t > 0.1) it.hist.shift();
  }

  release(it) {
    it.held = false;
    const h = it.hist;
    if (h.length > 1) {
      const a = h[0], b = h[h.length - 1], dt = Math.max(0.016, b.t - a.t);
      const v = b.p.clone().sub(a.p).divideScalar(dt);
      if (v.length() > 45) v.setLength(45);
      it.body.velocity.set(v.x, Math.max(v.y, 0) + v.length() * 0.12, v.z);
      it.body.angularVelocity.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
    }
    it.target = null;
  }

  step(dt) {
    for (const k of this.kinematic) {
      const p = k.obj.getWorldPosition(new THREE.Vector3()).add(k.offset);
      k.b.position.set(p.x, p.y, p.z);
      k.b.quaternion.setFromEuler(0, k.obj.rotation.y, 0);
    }
    for (const it of this.items) {
      if (it.held && it.target) {
        const b = it.body, t = it.target;
        // muelle blandito: sigue al dedo con un pelín de retraso y balanceo
        const k = 190, c = 17, v = b.velocity;
        v.x += ((t.x - b.position.x) * k - v.x * c) * dt;
        v.y += ((t.y - b.position.y) * k - v.y * c - G) * dt;
        v.z += ((t.z - b.position.z) * k - v.z * c) * dt;
        b.angularVelocity.scale(0.9, b.angularVelocity);
        b.wakeUp();
      }
    }
    this.world.step(1 / 60, dt, 4);
    for (const it of this.items) {
      it.mesh.position.copy(it.body.position);
      it.mesh.quaternion.copy(it.body.quaternion);
      // pequeño "aplastamiento" al golpear: blandito pero sin exagerar
      if (Math.abs(it.sq) > 0.002 || Math.abs(it.sqV) > 0.03) {
        const n = Math.max(1, Math.ceil(dt / 0.02)), h = dt / n;
        for (let i = 0; i < n; i++) {
          it.sqV += (-300 * it.sq - 13 * it.sqV) * h;
          it.sq += it.sqV * h;
        }
        it.sq = Math.max(-0.22, Math.min(0.26, it.sq));
        const s = it.sq;
        it.mesh.scale.set(it.baseScale.x * (1 + 0.55 * s), it.baseScale.y * (1 - s), it.baseScale.z * (1 + 0.55 * s));
      } else {
        it.sq = it.sqV = 0;
        it.mesh.scale.copy(it.baseScale);
      }
      // si se cae al suelo o sale volando, vuelve a su sitio con un "plop"
      if (it.home && !it.held && (it.body.position.y < -2.4 || it.body.position.z > 3)) {
        it.lost = (it.lost || 0) + dt;
        if (it.lost > 1.2) this.respawn(it);
      } else it.lost = 0;
    }
  }

  respawn(it) {
    const h = it.home;
    it.body.position.set(h.x, h.y + 0.8, h.z);
    it.body.velocity.set(0, 0, 0);
    it.body.angularVelocity.set(0, 0, 0);
    it.body.quaternion.set(0, 0, 0, 1);
    it.lost = 0;
    it.sqV -= 6; // reaparece con un "pop"
    it.body.wakeUp();
    this.onRespawn?.(it);
  }

  meshes() {
    return this.items.filter((i) => i.grabbable).map((i) => i.mesh);
  }
}

export { CANNON };
