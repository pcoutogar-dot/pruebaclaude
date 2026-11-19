// Zumo de naranja hecho a mano:
//   1) toca una fruta del frutero → salta a la tablita
//   2) desliza para partirla por la mitad
//   3) toca una mitad → se pone en el exprimidor (encima del vaso) y gira el
//      dedo en círculos: se hunde, se aplasta y el zumo gotea al vaso.
// El vaso se llena de verdad (y si te pasas, rebosa). Naranja y limón se
// pueden mezclar: el color del zumo es la mezcla.
import * as THREE from 'three';
import { CANNON } from './physics.js';

const M = (color, roughness = 0.5, o = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...o });
const lathe = (pts, segs = 40) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), segs);
const shadow = (o) => {
  o.traverse((c) => {
    if (c.isMesh) c.castShadow = c.receiveShadow = true;
  });
  return o;
};

// cara cortada de un cítrico: gajos, piel blanca y centro
function fleshTexture(col, light) {
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d'), m = S / 2;
  x.fillStyle = '#fff3df';
  x.beginPath();
  x.arc(m, m, m, 0, 7);
  x.fill();
  x.fillStyle = col;
  x.beginPath();
  x.arc(m, m, m * 0.84, 0, 7);
  x.fill();
  // separaciones entre gajos
  x.strokeStyle = '#fff1d6';
  x.lineWidth = 4;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    x.beginPath();
    x.moveTo(m, m);
    x.lineTo(m + Math.cos(a) * m * 0.84, m + Math.sin(a) * m * 0.84);
    x.stroke();
  }
  // brillo jugoso en cada gajo
  x.fillStyle = light;
  for (let i = 0; i < 10; i++) {
    const a = ((i + 0.5) / 10) * Math.PI * 2;
    x.beginPath();
    x.ellipse(m + Math.cos(a) * m * 0.5, m + Math.sin(a) * m * 0.5, m * 0.16, m * 0.05, a, 0, 7);
    x.fill();
  }
  x.fillStyle = '#fff3df';
  x.beginPath();
  x.arc(m, m, m * 0.1, 0, 7);
  x.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeHalf(fruit) {
  const g = new THREE.Group();
  const r = fruit.r;
  // cúpula de piel (hacia abajo) + cara cortada (hacia arriba)
  const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), fruit.peelMat);
  dome.scale.y = fruit.sy;
  const face = new THREE.Mesh(new THREE.CircleGeometry(r * 0.99, 40), M('#ffffff', 0.35, { map: fruit.lemon ? fleshTexture('#f6e27a', '#fff7c4') : fleshTexture('#f7a23a', '#ffd08a') }));
  face.rotation.x = -Math.PI / 2;
  face.position.y = 0.002;
  g.add(dome, face);
  const wrap = new THREE.Group();
  g.position.y = r * fruit.sy; // la base de la cúpula toca la superficie
  wrap.add(g);
  wrap.userData.inner = g;
  return shadow(wrap);
}

function makeFruitBowl() {
  const g = new THREE.Group();
  const cer = M('#e9e1d2', 0.6);
  const prof = [[0, 0], [0.5, 0], [0.68, 0.07], [0.86, 0.24], [0.88, 0.27], [0.84, 0.27], [0.65, 0.1], [0.47, 0.04], [0, 0.04]];
  g.add(new THREE.Mesh(lathe(prof, 48), cer));
  // franja de color, como cerámica pintada a mano
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.875, 0.8, 0.05, 48, 1, true), M('#e9a77a', 0.6));
  band.position.y = 0.2;
  g.add(band);
  return shadow(g);
}

function makeReamer() {
  const g = new THREE.Group();
  const cer = M('#f7f2ea', 0.45);
  // platito con borde (recoge el zumo) y cúpula acanalada
  g.add(new THREE.Mesh(lathe([[0, 0], [0.3, 0], [0.34, 0.03], [0.36, 0.08], [0.34, 0.085], [0.31, 0.03], [0, 0.03]], 40), cer));
  const ridges = new THREE.LatheGeometry([[0.001, 0.32], [0.05, 0.3], [0.1, 0.22], [0.15, 0.1], [0.17, 0.03]].map(([x, y]) => new THREE.Vector2(x, y)), 48);
  const p = ridges.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 + 0.12 * Math.cos(a * 12);
    p.setX(i, x * k);
    p.setZ(i, z * k);
  }
  ridges.computeVertexNormals();
  g.add(new THREE.Mesh(ridges, cer));
  return shadow(g);
}

function makeBoard() {
  const g = new THREE.Group();
  const wood = M('#d9b48a', 0.6);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.05, 40), wood);
  disc.position.y = 0.025;
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.1), wood);
  handle.position.set(0.55, 0.025, 0);
  g.add(disc, handle);
  g.userData.top = 0.05;
  return shadow(g);
}

export class JuiceProc {
  constructor({ parent, physics, droplets, flow, glass, bowlPos, glassZone, boardPos, makeFruit }) {
    this.physics = physics;
    this.droplets = droplets;
    this.flow = flow;
    this.glass = glass; // el vaso volcable de la mesa (con .holder, .it, .inner, .level)
    this.parent = parent;
    this.makeFruit = makeFruit;
    this.glassZone = glassZone;
    this.bowl = makeFruitBowl();
    this.bowl.position.copy(bowlPos);
    this.board = makeBoard();
    this.board.position.copy(boardPos);
    this.board.rotation.y = -0.4;
    this.reamer = makeReamer();
    this.focus = new THREE.Object3D();
    this.focus.position.set((bowlPos.x + glassZone.x + boardPos.x) / 3, 0, (bowlPos.z + glassZone.z + boardPos.z) / 3 + 0.1);
    parent.add(this.bowl, this.board, this.reamer, this.focus);
    // frutero con física: fondo + borde de cajitas inclinadas
    physics.static(new CANNON.Cylinder(0.6, 0.55, 0.06, 16), bowlPos.x, 0.03, bowlPos.z);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const q = new CANNON.Quaternion().setFromEuler(0, -a, 0.6);
      physics.static(new CANNON.Box(new CANNON.Vec3(0.03, 0.15, 0.2)), bowlPos.x + Math.cos(a) * 0.76, 0.15, bowlPos.z + Math.sin(a) * 0.76, q);
    }
    physics.static(new CANNON.Cylinder(0.46, 0.46, 0.05, 16), boardPos.x, 0.025, boardPos.z);
    this.fruits = [];
    this.anims = [];
    this.husks = [];
    this.reset();
  }

  // frutas del día en el frutero: tres naranjas y un limón
  fillBowl() {
    for (const f of this.fruits) {
      if (f.it) this.physics.remove(f.it);
      f.obj.removeFromParent();
    }
    this.fruits = [];
    const spots = [[-0.3, -0.12], [0.3, -0.15], [0, 0.28], [0.05, -0.05]];
    ['orange', 'orange', 'orange', 'lemon'].forEach((kind, i) => {
      const f = this.makeFruit(kind);
      const [dx, dz] = spots[i];
      f.obj.position.set(this.bowl.position.x + dx, 0.45 + i * 0.25, this.bowl.position.z + dz);
      this.parent.add(f.obj);
      f.it = this.physics.add(f.obj, [[new CANNON.Sphere(f.r * (f.lemon ? 1.08 : 1))]], { mass: 1, home: f.obj.position.clone(), sfx: 'fruit' });
      this.fruits.push(f);
    });
  }

  reset() {
    this.fillBowl();
    for (const a of [this.whole, ...(this.halves || []), ...this.husks]) a?.obj?.removeFromParent();
    this.whole = null;
    this.halves = [];
    this.husks = [];
    this.onReamer = null;
    this.progress = 0;
    this.cutLen = 0;
    this.picked = 0;
    this.cuts = 0;
    this.squeezed = 0;
    this.anims.length = 0;
    this.glass.level = 0;
    this.glass.color = new THREE.Color('#f6a43a');
    this.applyLevel();
  }

  get hasFruit() {
    return !!this.whole || this.halves.length > 0;
  }

  applyLevel() {
    const j = this.glass.inner.children[1];
    const l = Math.min(1, this.glass.level);
    j.visible = l > 0.01 && !this.glass.empty;
    j.scale.y = Math.max(0.001, l);
    j.material.color.copy(this.glass.color);
    if (j.material.emissive) j.material.emissive.copy(this.glass.color).multiplyScalar(0.55);
  }

  boardTop() {
    return this.board.position.y + this.board.userData.top;
  }

  fly(obj, toP, toQ, dur = 0.5, hop = 0.6, then) {
    this.anims.push({ obj, from: obj.position.clone(), fq: obj.quaternion.clone(), toP, toQ, t: 0, dur, hop, then });
  }

  // ---- gestos ----
  down(step, e, ctx) {
    this.last = [e.clientX, e.clientY];
    // 1) tocar una fruta del frutero (si la tabla está libre)
    const fh = ctx.cast(e, this.fruits.map((f) => f.obj));
    if (fh && !this.hasFruit) {
      let o = fh.object;
      const f = this.fruits.find((q) => {
        let p = o;
        while (p) {
          if (p === q.obj) return true;
          p = p.parent;
        }
        return false;
      });
      if (f) {
        ctx.cancelGrab?.();
        this.physics.remove(f.it);
        f.it = null;
        this.fruits = this.fruits.filter((q) => q !== f);
        this.whole = f;
        this.picked++;
        const p = this.board.position.clone();
        p.y = this.boardTop() + f.r * f.sy;
        this.fly(f.obj, p, new THREE.Quaternion(), 0.55, 0.7, () => ctx.wobble?.(f.obj, 0.7));
        ctx.sfx.boing(1.1);
        return true;
      }
    }
    if (fh && this.hasFruit) {
      ctx.say('Primero termina esta 🍊', 'Exprime lo que hay en la tabla y luego coge otra');
      ctx.cancelGrab?.();
      return true;
    }
    // 2) cortar: deslizar cerca de la fruta entera
    if (this.whole) {
      this.cutLen = 0;
      this.cutting = true;
      return true;
    }
    // 3) tocar una mitad: va al exprimidor
    if (!this.onReamer && this.halves.length) {
      const hh = ctx.cast(e, this.halves.map((h) => h.obj));
      const half = hh ? this.halves.find((h) => {
        let p = hh.object;
        while (p) {
          if (p === h.obj) return true;
          p = p.parent;
        }
        return false;
      }) : this.halves[0];
      this.toReamer(half, ctx);
    }
    // 4) exprimir: girar en círculos alrededor del exprimidor (vale tocar en cualquier sitio)
    if (this.onReamer) {
      const c = ctx.screenOf(this.reamer.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.25, 0)));
      this.center = c;
      this.angle = Math.atan2(e.clientY - c.y, e.clientX - c.x);
      return true;
    }
    return !!this.halves.length;
  }

  toReamer(half, ctx) {
    this.halves = this.halves.filter((h) => h !== half);
    this.onReamer = half;
    this.progress = 0;
    half.spin = 0;
    const top = this.reamer.position.clone();
    top.y += 0.32;
    // boca abajo sobre la cúpula
    this.fly(half.obj, top, new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0)), 0.45, 0.5, () => ctx.wobble?.(this.reamer, 0.4));
    ctx.sfx.plop(0.7, 1.1);
  }

  move(step, e, ctx) {
    const dx = e.clientX - this.last[0], dy = e.clientY - this.last[1];
    this.last = [e.clientX, e.clientY];
    const d = Math.hypot(dx, dy);
    if (this.whole && this.cutting && !this.anims.length) {
      const c = ctx.screenOf(this.whole.obj.getWorldPosition(new THREE.Vector3()));
      if (Math.hypot(e.clientX - c.x, e.clientY - c.y) > Math.min(innerWidth, innerHeight) * 0.3) return;
      this.cutLen += d;
      ctx.sfx.scrape(d * 0.0015);
      if (this.cutLen > 60) this.cut(ctx);
      return;
    }
    if (this.onReamer && this.center && this.progress < 1) {
      const a = Math.atan2(e.clientY - this.center.y, e.clientX - this.center.x);
      let da = a - this.angle;
      if (da > Math.PI) da -= Math.PI * 2;
      if (da < -Math.PI) da += Math.PI * 2;
      this.angle = a;
      this.squeeze(Math.abs(da), da, ctx);
    }
  }

  up(step, e, ctx) {
    this.cutting = false;
    this.center = null;
    ctx.sfx.stop();
  }

  cut(ctx) {
    const f = this.whole;
    this.whole = null;
    this.cutting = false;
    this.cuts++;
    const p = f.obj.position.clone();
    f.obj.removeFromParent();
    // las dos mitades se abren hacia los lados, con la cara cortada hacia arriba
    for (const s of [-1, 1]) {
      const h = makeHalf(f);
      h.position.set(p.x, this.boardTop(), p.z);
      this.parent.add(h);
      const half = { obj: h, fruit: f };
      this.halves.push(half);
      const to = new THREE.Vector3(p.x + s * f.r * 1.15, this.boardTop(), p.z + s * 0.05);
      this.fly(h, to, new THREE.Quaternion(), 0.32, 0.18, () => ctx.wobble?.(h, 0.6));
    }
    this.droplets.splash(p.clone().setY(this.boardTop() + 0.1), f.lemon ? '#f6e27a' : '#f8a23a', 8, 1.6, this.boardTop());
    ctx.sfx.stop();
    ctx.sfx.plop(1, 0.9);
    ctx.chime();
  }

  squeeze(amount, da, ctx) {
    const h = this.onReamer;
    const dp = amount / (Math.PI * 2 * 2.2); // unas dos vueltas por mitad
    this.progress = Math.min(1, this.progress + dp);
    h.spin += da;
    const g = h.obj.userData.inner;
    // se hunde y se aplasta mientras giras
    g.scale.set(1 + this.progress * 0.08, 1 - this.progress * 0.42, 1 + this.progress * 0.08);
    h.obj.rotation.y = h.spin;
    h.obj.position.y = this.reamer.position.y + 0.32 - this.progress * 0.12;
    // el zumo cae al vaso (o a la encimera, si el vaso no está)
    const f = h.fruit;
    const col = new THREE.Color(f.lemon ? '#f4df6a' : '#f6a43a');
    const add = dp * 0.5;
    const gl = this.glass;
    if (gl.level + add > 0) gl.color.lerp(col, add / (gl.level + add));
    gl.level += add;
    gl.empty = false;
    if (Math.random() < amount * 3) {
      const a = Math.random() * Math.PI * 2, r = 0.2 + Math.random() * 0.1;
      const rp = this.reamer.position;
      this.droplets.splash(new THREE.Vector3(rp.x + Math.cos(a) * r, rp.y + 0.05, rp.z + Math.sin(a) * r), f.lemon ? '#f6e27a' : '#f8a23a', 1, 0.5, rp.y - 0.5);
    }
    if (gl.level > 1.02 && !gl.broken && Math.random() < amount * 4) {
      // rebosa: sale por el borde del vaso y corre por la encimera
      const p = gl.holder.position;
      const dir = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
      this.flow.pour({ x: p.x + dir.x * 0.28, z: p.z + dir.z * 0.28 }, dir, 3, 1.2, 0.2, 0.6);
      if (!this.warned) {
        this.warned = true;
        ctx.say('¡Rebosa! 🍊', 'Tú mandas…');
      }
    }
    if (gl.broken && Math.random() < amount * 4) {
      const p = this.glassZone;
      this.flow.pour({ x: p.x, z: p.z }, new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(), 2, 1, 0.2, 1);
    }
    this.applyLevel();
    ctx.sfx.scrape(amount * 0.05, true);
    if (this.progress >= 1) {
      // exprimida: la cáscara se aparta a un lado
      this.onReamer = null;
      this.squeezed++;
      const husk = h;
      this.husks.push(husk);
      const n = this.husks.length;
      const to = this.board.position.clone().add(new THREE.Vector3(-0.15 + (n % 3) * 0.2, this.board.userData.top, -0.62 - Math.floor(n / 3) * 0.2));
      this.fly(husk.obj, to, new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, Math.random() * 6, 0)), 0.5, 0.5);
      ctx.sfx.stop();
      ctx.chime();
      if (this.halves.length) ctx.say('¡Una! 🍊', 'Toca la otra mitad para exprimirla');
      else ctx.say('Zumo listo ✨', 'Puedes coger otra fruta del frutero si quieres más');
    }
  }

  update(dt, step, ctx) {
    // el vaso viene a la zona del zumo mientras estás aquí, y vuelve a la mesa después
    const gl = this.glass, b = gl.it.body, here = !!step;
    if (!gl.broken) {
      const goal = here ? this.glassZone.clone().setY(0.44) : gl.it.home.clone();
      const far = b.position.distanceTo(goal);
      if (here || gl.away) {
        if (b.type !== CANNON.Body.KINEMATIC) {
          b.type = CANNON.Body.KINEMATIC;
          // mientras viaja (o está en el exprimidor) no empuja nada de la encimera
          b.collisionResponse = false;
          b.velocity.set(0, 0, 0);
          b.angularVelocity.set(0, 0, 0);
        }
        gl.away = here || far > 0.02;
        const k = 1 - Math.exp(-dt * 5);
        // viaja en un arco por encima de las cosas
        const nx = b.position.x + (goal.x - b.position.x) * k, nz = b.position.z + (goal.z - b.position.z) * k;
        b.position.set(nx, goal.y + Math.min(1.2, Math.hypot(goal.x - nx, goal.z - nz) * 0.35), nz);
        b.quaternion.set(0, 0, 0, 1);
        if (!gl.away) {
          b.position.set(goal.x, goal.y, goal.z);
          b.type = CANNON.Body.DYNAMIC;
          b.collisionResponse = true;
          b.wakeUp();
        }
      }
    }
    // el exprimidor descansa sobre el vaso (o en la encimera si el vaso se rompió)
    const rp = gl.broken ? this.glassZone.clone().setY(0.01) : gl.holder.position.clone().add(new THREE.Vector3(0, 0.4, 0));
    this.reamer.visible = here || this.reamer.position.distanceTo(rp) > 0.05 ? here : false;
    this.reamer.position.copy(rp);
    if (this.onReamer && !this.anims.some((a) => a.obj === this.onReamer.obj)) {
      this.onReamer.obj.position.x = rp.x;
      this.onReamer.obj.position.z = rp.z;
      this.onReamer.obj.position.y = rp.y + 0.32 - this.progress * 0.12;
    }
    for (let i = this.anims.length - 1; i >= 0; i--) {
      const a = this.anims[i];
      a.t = Math.min(1, a.t + dt / a.dur);
      const e = a.t < 0.5 ? 2 * a.t * a.t : 1 - (-2 * a.t + 2) ** 2 / 2;
      a.obj.position.lerpVectors(a.from, a.toP, e);
      a.obj.position.y += Math.sin(a.t * Math.PI) * a.hop;
      a.obj.quaternion.slerpQuaternions(a.fq, a.toQ, e);
      if (a.t >= 1) {
        this.anims.splice(i, 1);
        a.then?.();
        ctx?.sfx.tap('fruit', 0.5);
      }
    }
  }
}
