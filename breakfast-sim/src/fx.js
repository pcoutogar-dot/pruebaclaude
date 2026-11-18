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

// "Puf" de polvillo al aterrizar algo: un anillo de bolitas suaves que se
// abren a ras de la superficie y se desvanecen encogiéndose.
export class Puff {
  constructor(parent, max = 90) {
    this.mesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.03, 8, 6),
      new THREE.MeshBasicMaterial({ color: '#fff4e2', transparent: true, opacity: 0.7, depthWrite: false }),
      max,
    );
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.p = [];
    this.max = max;
    this.m = new THREE.Matrix4();
    parent.add(this.mesh);
  }

  at(pos, strength = 1, n = 9) {
    for (let i = 0; i < n && this.p.length < this.max; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5, s = (0.7 + Math.random() * 0.6) * strength;
      this.p.push({ x: pos.x, y: pos.y + 0.02, z: pos.z, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: 0.15 + Math.random() * 0.2, t: 0, life: 0.45 + Math.random() * 0.25, k: 0.6 + Math.random() * 0.8 });
    }
  }

  update(dt) {
    if (!this.p.length && !this.mesh.count) return;
    let i = 0;
    for (const q of this.p) {
      q.t += dt;
      const f = Math.exp(-dt * 5);
      q.vx *= f;
      q.vz *= f;
      q.x += q.vx * dt;
      q.z += q.vz * dt;
      q.y += q.vy * dt;
    }
    this.p = this.p.filter((q) => q.t < q.life);
    for (const q of this.p) {
      const a = q.t / q.life, sc = q.k * (0.6 + a) * (1 - a * a);
      this.m.makeScale(sc, sc * 0.75, sc).setPosition(q.x, q.y, q.z);
      this.mesh.setMatrixAt(i++, this.m);
    }
    this.mesh.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// Migas: caen, rebotan un par de veces sobre la tabla o la encimera, ruedan
// un poquito y se quedan ahí (hasta el día siguiente).
export class Crumbs {
  constructor(parent, max = 260) {
    const g = new THREE.DodecahedronGeometry(0.016, 0);
    this.mesh = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ roughness: 0.9 }), max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.mesh.count = 0;
    this.p = [];
    this.max = max;
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
    this.c = new THREE.Color();
    this.v3 = new THREE.Vector3();
    this.floorAt = () => 0;
    this.onTick = null;
    parent.add(this.mesh);
  }

  // colores: una mezcla de miga clara y corteza tostada
  spill(pos, n = 4, colors = ['#e9c58c', '#c98d4e', '#f3dcae'], speed = 1) {
    for (let i = 0; i < n; i++) {
      if (this.p.length >= this.max) this.p.shift();
      const a = Math.random() * Math.PI * 2, s = (0.3 + Math.random() * 0.9) * speed;
      this.p.push({
        x: pos.x + (Math.random() - 0.5) * 0.05, y: pos.y, z: pos.z + (Math.random() - 0.5) * 0.05,
        vx: Math.cos(a) * s, vy: 0.6 + Math.random() * 1.2, vz: Math.sin(a) * s,
        rx: Math.random() * 6, ry: Math.random() * 6, spin: (Math.random() - 0.5) * 18,
        k: 0.55 + Math.random() * 0.9, color: colors[(Math.random() * colors.length) | 0], rest: false, bounces: 0,
      });
    }
  }

  clear() {
    this.p.length = 0;
    this.mesh.count = 0;
  }

  update(dt) {
    let moving = false;
    for (const q of this.p) {
      if (q.rest) continue;
      moving = true;
      q.vy -= 26 * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.z += q.vz * dt;
      q.rx += q.spin * dt;
      const fl = this.floorAt(q.x, q.z) + 0.008 * q.k;
      if (q.y < fl) {
        q.y = fl;
        if (Math.abs(q.vy) > 0.6 && q.bounces < 3) {
          q.vy = -q.vy * 0.38;
          q.vx *= 0.6;
          q.vz *= 0.6;
          q.spin *= 0.5;
          q.bounces++;
          if (q.bounces === 1) this.onTick?.(q);
        } else {
          // rueda un poquito y se para
          q.vy = 0;
          const f = Math.exp(-dt * 9);
          q.vx *= f;
          q.vz *= f;
          q.spin *= f;
          if (Math.hypot(q.vx, q.vz) < 0.02) q.rest = true;
        }
      }
    }
    if (!moving && this.mesh.count === this.p.length) return;
    let i = 0;
    for (const q of this.p) {
      this.q.setFromEuler(this.e.set(q.rx, q.ry, 0));
      this.m.compose(this.v3.set(q.x, q.y, q.z), this.q, new THREE.Vector3(q.k, q.k * 0.7, q.k));
      this.mesh.setMatrixAt(i, this.m);
      this.mesh.setColorAt(i, this.c.set(q.color));
      i++;
    }
    this.mesh.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

// Sombrita suave bajo lo que llevas en la mano: se encoge y se aclara cuanto
// más alto lo levantas (ayuda a saber dónde caerá).
export function makeBlobShadow() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(60,35,20,0.55)');
  g.addColorStop(0.6, 'rgba(60,35,20,0.22)');
  g.addColorStop(1, 'rgba(60,35,20,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 2;
  m.visible = false;
  return m;
}
