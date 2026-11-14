// Miel: se comporta como miel.
//  - viscosa: el hilo va con retraso respecto a la mano (no cae justo debajo)
//  - si te quedas quieto, el hilo se enrosca al llegar (hace espirales)
//  - si mueves rápido, el hilo se estira y se afina
//  - al levantar, sigue cayendo un poco mientras se corta el hilo
//  - lo caído se extiende despacio en charquitos; y si apuntas fuera, mancha
import * as THREE from 'three';

export const honeyMat = new THREE.MeshStandardMaterial({
  color: '#e9a22b', roughness: 0.08, transparent: true, opacity: 0.92, emissive: '#b86a00', emissiveIntensity: 0.25,
});
honeyMat.defines = { NO_MATTE: '' };

// cuchara de miel de madera; el origen es la punta por donde gotea
function makeDipper() {
  const g = new THREE.Group(), body = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: '#c9a27a', roughness: 0.6 });
  [0.06, 0.08, 0.09, 0.08, 0.06].forEach((r, i) => {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.02, 20), wood);
    d.position.y = 0.03 + i * 0.032;
    body.add(d);
  });
  const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.6, 4, 10), wood);
  handle.position.y = 0.5;
  body.add(handle);
  const coat = new THREE.Mesh(new THREE.SphereGeometry(0.095, 20, 14), honeyMat);
  coat.scale.set(1, 1.15, 1);
  coat.position.y = 0.09;
  body.add(coat);
  body.rotation.z = -0.55;
  g.add(body);
  g.traverse((c) => c.isMesh && (c.castShadow = true));
  return g;
}

// botella de aceite de oliva; el origen es la boca por donde cae
function makeOilBottle() {
  const g = new THREE.Group(), body = new THREE.Group();
  const glass = new THREE.MeshStandardMaterial({ color: '#5c7032', roughness: 0.1, transparent: true, opacity: 0.93 });
  glass.defines = { NO_MATTE: '' };
  const pts = [[0, 0], [0.11, 0], [0.125, 0.03], [0.125, 0.4], [0.06, 0.58], [0.042, 0.72], [0.05, 0.74], [0, 0.74]].map(([x, y]) => new THREE.Vector2(x, y));
  body.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 28), glass));
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.128, 0.128, 0.2, 28, 1, true), new THREE.MeshStandardMaterial({ color: '#f6efdc', roughness: 0.8 }));
  label.position.y = 0.2;
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), new THREE.MeshStandardMaterial({ color: '#7d9440', roughness: 0.6 }));
  leaf.scale.set(1.3, 0.6, 0.15);
  leaf.position.set(0, 0.2, 0.128);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.03, 0.09, 12), new THREE.MeshStandardMaterial({ color: '#cfcac2', roughness: 0.3, metalness: 0.8 }));
  spout.position.y = 0.78;
  body.add(label, leaf, spout);
  body.position.y = -0.82;
  g.add(body);
  g.traverse((c) => c.isMesh && (c.castShadow = true));
  return g;
}

// Ajustes de cada líquido: la miel es espesa y se enrosca; el aceite es fluido,
// cae casi recto, se corta enseguida y se extiende más.
export const LIQUIDS = {
  honey: { kind: 'honey', mat: honeyMat, tool: makeDipper, lag: 4, coil: 0.032, tail: 1.1, first: 1.3, steady: 0.75, radius: 0.011, height: 0.75, pourTilt: 0, restY: 0.5 },
  oil: {
    kind: 'oil',
    mat: (() => {
      const m = new THREE.MeshStandardMaterial({ color: '#c9b632', roughness: 0.05, transparent: true, opacity: 0.8 });
      m.defines = { NO_MATTE: '' };
      return m;
    })(),
    tool: makeOilBottle, lag: 11, coil: 0, tail: 3, first: 0.9, steady: 0.7, radius: 0.007, height: 0.6, pourTilt: -2.05, restY: 0.82,
  },
};

export class Honey {
  constructor(scene, cfg = LIQUIDS.honey) {
    this.cfg = cfg;
    this.kind = cfg.kind;
    this.dipper = cfg.tool();
    this.dipper.visible = false;
    this.thread = new THREE.Mesh(new THREE.BufferGeometry(), cfg.mat);
    this.thread.frustumCulled = false;
    this.thread.visible = false;
    this.spills = new THREE.Group();
    scene.add(this.dipper, this.thread, this.spills);
    this.running = false;
    this.pressing = false;
    this.flow = 0;
    this.phase = 0;
    this.goal = new THREE.Vector3();
    this.L = new THREE.Vector3();
    this.land = new THREE.Vector3();
    this.landY = 0;
  }

  start(point, surfY, onDeposit) {
    this.surfY = surfY;
    this.onDeposit = onDeposit;
    this.goal.copy(point);
    this.pressing = true;
    this.flow = this.cfg.first; // primero cae un goterón, luego el hilo se afina
    if (!this.running) {
      this.L.set(this.dipper.position.x, surfY, this.dipper.position.z);
      this.landY = surfY;
      this.prev = null;
    }
    this.running = true;
  }

  setTarget(point) {
    this.goal.copy(point);
  }

  release() {
    this.pressing = false;
  }

  // mancha en la encimera (cuando la miel cae fuera)
  spill(p, y) {
    const last = this.spills.children[this.spills.children.length - 1];
    if (last && last.position.distanceTo(new THREE.Vector3(p.x, y, p.z)) < 0.035) {
      last.scale.multiplyScalar(1.012);
      return;
    }
    if (this.spills.children.length > 70) this.spills.remove(this.spills.children[0]);
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.03 + Math.random() * 0.02, 14), this.cfg.mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(p.x, y, p.z);
    this.spills.add(m);
  }

  update(dt) {
    // la botella se inclina al verter y se endereza al terminar
    const c = this.cfg;
    this.dipper.rotation.z += ((this.running && this.pressing ? c.pourTilt : 0) - this.dipper.rotation.z) * Math.min(1, dt * 9);
    if (!this.running) return;
    // la cuchara sigue a la mano, por encima de donde apuntas
    const tipGoal = this.goal.clone().setY(this.surfY + c.height);
    const before = this.dipper.position.clone();
    this.dipper.position.lerp(tipGoal, 1 - Math.exp(-dt * 12));
    const speed = before.distanceTo(this.dipper.position) / Math.max(dt, 1e-3);
    // caudal: se afina con el tiempo; al soltar, el hilo tarda un poco en cortarse
    if (this.pressing) this.flow += (c.steady - this.flow) * (1 - Math.exp(-dt * 0.9));
    else this.flow -= dt * c.tail;
    if (this.flow <= 0.05) {
      this.running = false;
      this.thread.visible = false;
      return;
    }
    // viscosidad: el punto de caída persigue a la mano con retraso
    const tip = this.dipper.position;
    this.L.lerp(new THREE.Vector3(tip.x, this.surfY, tip.z), 1 - Math.exp(-dt * c.lag));
    // quieto → el hilo se enrosca; rápido → se estira y afina
    const coil = THREE.MathUtils.clamp(1 - speed / 0.8, 0, 1) * c.coil * Math.min(1, this.flow);
    this.phase += dt * 13;
    this.land.set(this.L.x + Math.cos(this.phase) * coil, this.landY, this.L.z + Math.sin(this.phase) * coil);
    const w = this.flow * THREE.MathUtils.clamp(1 - speed / 4, 0.35, 1);
    // hilo: cae recto desde la cuchara y se curva hacia donde aterriza
    const pts = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6, h = t ** 2.6;
      pts.push(new THREE.Vector3(tip.x + (this.land.x - tip.x) * h, tip.y + (this.land.y - tip.y) * t, tip.z + (this.land.z - tip.z) * h));
    }
    this.thread.geometry.dispose();
    this.thread.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.004 + c.radius * w, 6);
    this.thread.visible = true;
    // deja miel donde aterriza (el juego decide si es tostada, yogur o encimera)
    const y = this.onDeposit?.(this.prev || this.land, this.land, w);
    if (typeof y === 'number') this.landY += (y - this.landY) * Math.min(1, dt * 12);
    this.prev = this.land.clone();
  }
}
