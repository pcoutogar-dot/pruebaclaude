// Físicas "medianamente realistas": peso, rebote suave, fricción y golpes.
// Motor ligero (cannon-es) para ir fluido en iPhone. Escala: 1 unidad ≈ 10 cm.
import * as CANNON from 'cannon-es';
import * as THREE from 'three';

const G = -70; // gravedad algo suave: realista sin sentirse brusca

export class Physics {
  constructor() {
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, G, 0) });
    this.world.allowSleep = true;
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.mat = new CANNON.Material('def');
    this.world.addContactMaterial(new CANNON.ContactMaterial(this.mat, this.mat, { friction: 0.45, restitution: 0.28 }));
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
    const it = { mesh, body, home, grabbable, squash: 0, baseScale: mesh.scale.clone(), lastHit: 0 };
    body.addEventListener('collide', (e) => {
      const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
      if (v > 2.5 && performance.now() - it.lastHit > 90) {
        it.lastHit = performance.now();
        it.squash = Math.min(1, v / 25);
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
        const k = 16;
        b.velocity.set((t.x - b.position.x) * k, (t.y - b.position.y) * k, (t.z - b.position.z) * k);
        b.angularVelocity.scale(0.86, b.angularVelocity);
        b.wakeUp();
      }
    }
    this.world.step(1 / 60, dt, 4);
    for (const it of this.items) {
      it.mesh.position.copy(it.body.position);
      it.mesh.quaternion.copy(it.body.quaternion);
      // pequeño "aplastamiento" al golpear: blandito pero sin exagerar
      if (it.squash > 0.001) {
        const s = it.squash;
        it.mesh.scale.set(it.baseScale.x * (1 + 0.1 * s), it.baseScale.y * (1 - 0.14 * s), it.baseScale.z * (1 + 0.1 * s));
        it.squash *= Math.exp(-dt * 14);
      } else it.mesh.scale.copy(it.baseScale);
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
    it.body.wakeUp();
  }

  meshes() {
    return this.items.filter((i) => i.grabbable).map((i) => i.mesh);
  }
}

export { CANNON };
