// Agua y líquidos: gotitas que salpican y ondas en la superficie.
import * as THREE from 'three';

// gotitas con gravedad (un único InstancedMesh: barato en móvil)
export class Droplets {
  constructor(parent, max = 160) {
    this.mesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.018, 8, 6),
      new THREE.MeshStandardMaterial({ roughness: 0.1, transparent: true, opacity: 0.85 }),
      max,
    );
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.p = [];
    this.max = max;
    this.m = new THREE.Matrix4();
    this.c = new THREE.Color();
    for (let i = 0; i < max; i++) this.mesh.setColorAt(i, this.c.set('#ffffff'));
    parent.add(this.mesh);
  }

  splash(pos, color, n = 4, speed = 1.6, floor = pos.y) {
    for (let i = 0; i < n && this.p.length < this.max; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.6);
      this.p.push({
        x: pos.x, y: pos.y, z: pos.z,
        vx: Math.cos(a) * s * 0.6, vy: s * (1 + Math.random()), vz: Math.sin(a) * s * 0.6,
        floor, color, size: 0.6 + Math.random() * 0.7,
      });
    }
  }

  update(dt) {
    let i = 0;
    for (const q of this.p) {
      q.vy -= 22 * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.z += q.vz * dt;
    }
    this.p = this.p.filter((q) => q.y > q.floor - 0.01 || q.vy > 0);
    for (const q of this.p) {
      this.m.makeScale(q.size, q.size * (1 + Math.min(1.5, Math.abs(q.vy) * 0.25)), q.size).setPosition(q.x, q.y, q.z);
      this.mesh.setMatrixAt(i, this.m);
      this.mesh.setColorAt(i, this.c.set(q.color));
      i++;
    }
    this.mesh.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

// superficie con ondas: sustituye un disco plano por una malla polar que se ondula
export class Ripples {
  constructor(mesh, radius) {
    this.mesh = mesh;
    this.R = radius;
    mesh.geometry.dispose();
    mesh.geometry = new THREE.RingGeometry(0.0001, radius, 64, 16);
    this.base = mesh.geometry.attributes.position.array.slice();
    this.waves = [];
  }

  // x, y en coordenadas locales del disco
  drop(x, y, amp = 0.012) {
    if (this.waves.length > 10) this.waves.shift();
    this.waves.push({ x, y, t: 0, amp });
  }

  update(dt) {
    if (!this.waves.length && !this.dirty) return;
    const pos = this.mesh.geometry.attributes.position;
    const a = pos.array, b = this.base;
    for (const w of this.waves) w.t += dt;
    this.waves = this.waves.filter((w) => w.t < 1.6);
    for (let i = 0; i < pos.count; i++) {
      const x = b[i * 3], y = b[i * 3 + 1];
      let z = 0;
      for (const w of this.waves) {
        const d = Math.hypot(x - w.x, y - w.y), front = w.t * 0.45;
        if (d > front) continue;
        const fade = Math.exp(-w.t * 1.8) * Math.exp(-d * 3);
        z += w.amp * fade * Math.sin(d * 28 - w.t * 9); // ondas amplias y lentas (sin "vibrar")
      }
      // el borde no se mueve (la taza lo sujeta)
      a[i * 3 + 2] = z * Math.min(1, (this.R - Math.hypot(x, y)) * 20);
    }
    pos.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
    this.dirty = this.waves.length > 0;
  }
}
