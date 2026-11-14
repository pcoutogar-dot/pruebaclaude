// Líquido derramado que corre por la encimera: sale en la dirección en la que
// se vuelca el vaso, avanza, se frena por rozamiento y se queda hecho charco.
// Si llega al borde de la encimera, cae.
import * as THREE from 'three';

export class Flow {
  constructor(parent, color, max = 240) {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.06, depthWrite: false });
    mat.defines = { NO_MATTE: '' };
    this.mesh = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = 1;
    this.max = max;
    this.p = [];
    this.emit = [];
    this.m = new THREE.Matrix4();
    this.onDrip = null;
    parent.add(this.mesh);
  }

  // derrama `n` porciones desde `pos` hacia `dir` (vector horizontal) durante `secs`
  pour(pos, dir, n = 70, speed = 2.6, secs = 0.7, spread = 0.55) {
    this.emit.push({ x: pos.x, z: pos.z, dx: dir.x, dz: dir.z, left: n, rate: n / secs, acc: 0, speed, spread });
  }

  clear() {
    this.p.length = 0;
    this.emit.length = 0;
    this.mesh.count = 0;
  }

  update(dt) {
    for (const e of this.emit) {
      e.acc += e.rate * dt;
      while (e.acc >= 1 && e.left > 0 && this.p.length < this.max) {
        e.acc--;
        e.left--;
        const a = (Math.random() - 0.5) * e.spread * 2, c = Math.cos(a), s = Math.sin(a);
        const v = e.speed * (0.35 + Math.random() * 0.9);
        this.p.push({ x: e.x, z: e.z, vx: (e.dx * c - e.dz * s) * v, vz: (e.dx * s + e.dz * c) * v, r: 0.04 + Math.random() * 0.03, max: 0.1 + Math.random() * 0.1 });
      }
    }
    this.emit = this.emit.filter((e) => e.left > 0);
    let moving = false;
    for (const q of this.p) {
      const sp = Math.hypot(q.vx, q.vz);
      if (sp < 0.01 && q.r >= q.max) continue;
      moving = true;
      const f = Math.exp(-dt * 1.7); // rozamiento con la encimera
      q.vx *= f;
      q.vz *= f;
      q.x += q.vx * dt;
      q.z += q.vz * dt;
      // al frenarse, se ensancha en charco
      q.r = Math.min(q.max, q.r + dt * (0.02 + 0.1 / (1 + sp * 3)));
      // paredes: se para; borde delantero: cae
      if (q.z < -1.5) { q.z = -1.5; q.vz = 0; }
      if (q.x < -3.9) { q.x = -3.9; q.vx = 0; }
      if (q.z > 1.68 && !q.gone) {
        q.gone = true;
        this.onDrip?.(q);
      }
    }
    if (!moving && !this.emit.length && this.mesh.count === this.p.length) return;
    this.p = this.p.filter((q) => !q.gone);
    let i = 0;
    for (const q of this.p) {
      this.m.makeScale(q.r, 1, q.r).setPosition(q.x, 0.013, q.z);
      this.mesh.setMatrixAt(i++, this.m);
    }
    this.mesh.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
