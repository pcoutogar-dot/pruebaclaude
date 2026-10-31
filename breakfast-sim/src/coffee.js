// Café de especialidad, a mano y por pasos:
//   moler (manivela) → colar (V60 + hervidor cuello de cisne) → espumar → latte art
// La taza tiene volumen real: si viertes de más, se desborda y mancha.
// En el latte art la leche primero se mezcla (aclara el café) y el dibujo solo
// aparece cuando la taza va llena, como en la vida real. Mover el dedo rápido
// mientras viertes "corta" la espuma (el gesto del corazón/tulipán).
import * as THREE from 'three';
import { canvas, tex } from './textures.js';
import { Ripples } from './fx.js';

const M = (color, roughness = 0.5, o = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...o });
const lathe = (pts, segs = 40) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), segs);
const shadow = (o) => {
  o.traverse((c) => {
    if (c.isMesh) c.castShadow = c.receiveShadow = true;
  });
  return o;
};

const MUG_TOP = 0.7 * 1.05; // borde de la taza (escala 1.05)
const LEVEL_Y = (v) => 0.12 + (0.6 - 0.12) * Math.min(v, 1);
const LEVEL_R = (v) => (0.295 + 0.03 * Math.min(v, 1)) / 0.318;

export function setMugLevel(mug, v) {
  const c = mug.userData.coffee;
  c.visible = v > 0.01;
  c.position.y = LEVEL_Y(v);
  c.scale.setScalar(LEVEL_R(v));
}

function makeGrinder() {
  const g = new THREE.Group();
  const wood = M('#b98a5c', 0.6), dark = M('#6d4a30', 0.5), metal = M('#cfc8bd', 0.3, { metalness: 0.7 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), wood);
  body.position.y = 0.18;
  g.add(body);
  const drawer = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, 0.02), dark);
  drawer.position.set(0, 0.1, 0.185);
  g.add(drawer);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), metal);
  knob.position.set(0, 0.1, 0.2);
  g.add(knob);
  const hopper = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.14, 32), metal);
  hopper.position.y = 0.43;
  g.add(hopper);
  const beans = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 24), M('#4a2c1a', 0.6));
  beans.position.y = 0.49;
  g.add(beans);
  const crank = new THREE.Group();
  crank.position.y = 0.53;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.025, 0.04), metal);
  arm.position.x = 0.15;
  crank.add(arm);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.12, 16), dark);
  handle.position.set(0.3, 0.06, 0);
  crank.add(handle);
  g.add(crank);
  g.userData.crank = crank;
  g.userData.beans = beans;
  return shadow(g);
}

function makeDripper() {
  const g = new THREE.Group();
  const cer = M('#f6f1ea', 0.3, { side: THREE.DoubleSide });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.025, 40), cer);
  g.add(base);
  const cone = new THREE.Mesh(lathe([[0.07, 0.01], [0.33, 0.36], [0.35, 0.37], [0.35, 0.39], [0.31, 0.39], [0.06, 0.04]]), cer);
  g.add(cone);
  const paper = new THREE.Mesh(lathe([[0.06, 0.05], [0.31, 0.4], [0.31, 0.43]]), M('#f1e8d6', 1, { side: THREE.DoubleSide }));
  g.add(paper);
  const bed = new THREE.Mesh(new THREE.CircleGeometry(0.17, 32), M('#5b3a22', 0.95));
  bed.rotation.x = -Math.PI / 2;
  bed.position.y = 0.17;
  g.add(bed);
  g.userData.bed = bed;
  return shadow(g);
}

// hervidor con el origen en la punta del pico: así sigue al dedo con precisión
function makeKettle() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  const enamel = M('#efe6d8', 0.35), wood = M('#8a5a36', 0.5);
  const pot = new THREE.Mesh(lathe([[0, 0], [0.2, 0], [0.24, 0.06], [0.24, 0.24], [0.16, 0.34], [0.06, 0.36], [0, 0.36]]), enamel);
  body.add(pot);
  const lid = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), wood);
  lid.position.y = 0.38;
  body.add(lid);
  const spout = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.18, 0.06, 0), new THREE.Vector3(0.36, 0.12, 0), new THREE.Vector3(0.44, 0.34, 0), new THREE.Vector3(0.56, 0.4, 0),
  ]), 24, 0.022, 8), enamel);
  body.add(spout);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 8, 20, Math.PI), wood);
  handle.rotation.z = Math.PI / 2;
  handle.position.set(-0.24, 0.2, 0);
  body.add(handle);
  body.position.set(-0.56, -0.4, 0);
  g.add(body);
  g.rotation.y = -Math.PI / 2;
  return shadow(g);
}

function makePitcher() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  const steel = M('#d9dcdf', 0.22, { metalness: 0.9, side: THREE.DoubleSide });
  body.add(new THREE.Mesh(lathe([[0, 0], [0.17, 0], [0.18, 0.04], [0.16, 0.36], [0.17, 0.4]]), steel));
  const spout = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 12, 1, true), steel);
  spout.rotation.z = -Math.PI / 2.4;
  spout.position.set(0.19, 0.38, 0);
  body.add(spout);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 8, 16, Math.PI), steel);
  handle.rotation.z = -Math.PI / 2;
  handle.position.set(-0.17, 0.22, 0);
  body.add(handle);
  const milk = new THREE.Mesh(new THREE.CircleGeometry(0.16, 32), M('#fbf6ee', 0.6));
  milk.rotation.x = -Math.PI / 2;
  milk.position.y = 0.2;
  body.add(milk);
  body.position.set(-0.24, -0.4, 0);
  g.add(body);
  g.rotation.y = -Math.PI / 2;
  g.userData.milk = milk;
  return shadow(g);
}

function stream(color, opacity) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.016, 1, 10, 1, true),
    new THREE.MeshStandardMaterial({ color, roughness: 0.2, transparent: true, opacity }),
  );
  m.visible = false;
  return m;
}

function stainTexture(color) {
  const c = canvas(256), x = c.getContext('2d');
  for (let i = 0; i < 14; i++) {
    const px = 128 + (Math.random() - 0.5) * 90, py = 128 + (Math.random() - 0.5) * 90, r = 30 + Math.random() * 60;
    const g = x.createRadialGradient(px, py, r * 0.6, px, py, r);
    g.addColorStop(0, color.replace('A', '0.35'));
    g.addColorStop(0.9, color.replace('A', '0.5'));
    g.addColorStop(1, color.replace('A', '0'));
    x.fillStyle = g;
    x.beginPath();
    x.arc(px, py, r, 0, 7);
    x.fill();
  }
  return tex(c);
}

// base del café en la taza: de café solo a café con leche según la mezcla
export function coffeeBase(mix) {
  const lerp = (a, b) => Math.round(a + (b - a) * mix);
  const c1 = [lerp(52, 196), lerp(30, 150), lerp(16, 104)];
  const c2 = [lerp(34, 160), lerp(19, 112), lerp(9, 70)];
  return (x, S) => {
    const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, `rgb(${c1})`);
    g.addColorStop(0.85, `rgb(${c2})`);
    g.addColorStop(1, `rgb(${c2.map((v) => v * 0.75)})`);
    x.fillStyle = g;
    x.fillRect(0, 0, S, S);
    for (let i = 0; i < 700; i++) {
      x.fillStyle = `rgba(${210 + Math.random() * 40},${160 + Math.random() * 40},110,${0.05 + mix * 0.08})`;
      x.beginPath();
      x.arc(Math.random() * S, Math.random() * S, 0.5 + Math.random() * 1.5, 0, 7);
      x.fill();
    }
  };
}

export class CoffeeProc {
  constructor({ mug, latte, parent, droplets }) {
    this.mug = mug;
    this.droplets = droplets;
    this.latte = latte;
    this.coffee = mug.userData.coffee;
    this.ripples = new Ripples(this.coffee, 0.318);
    this.rippleT = 0;
    this.grinder = makeGrinder();
    this.dripper = makeDripper();
    this.kettle = makeKettle();
    this.pitcher = makePitcher();
    this.water = stream('#dce9ee', 0.55);
    this.milkStream = stream('#fbf6ee', 0.95);
    this.spill = new THREE.Mesh(new THREE.CircleGeometry(0.75, 40), new THREE.MeshBasicMaterial({
      map: stainTexture('rgba(150,100,60,A)'), transparent: true, depthWrite: false,
    }));
    this.spill.rotation.x = -Math.PI / 2;
    this.puddles = new THREE.Group();
    this.drips = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const d = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.07, 4, 8), M('#d2ae86', 0.2, { transparent: true, opacity: 0.85 }));
      const a = -0.6 + i * 0.35;
      d.position.set(Math.cos(a) * 0.362, 0.6, Math.sin(a) * 0.362);
      d.visible = false;
      this.drips.add(d);
    }
    mug.add(this.drips);
    parent.add(this.grinder, this.dripper, this.kettle, this.pitcher, this.water, this.milkStream, this.spill, this.puddles);
    this.reset();
  }

  reset() {
    this.turns = 0;
    this.brew = 0;
    this.brewed = false;
    this.foam = 0;
    this.milk = 0;
    this.spilled = 0;
    this.dripLift = 0;
    this.holding = false;
    this.mix = -1;
    this.warned = false;
    this.puddles.clear();
    this.drips.children.forEach((d) => (d.visible = false));
    this.spill.visible = false;
    this.latte.reset();
    this.setMix(0);
    this.grinder.userData.beans.scale.set(1, 1, 1);
    this.dripper.userData.bed.material.color.set('#5b3a22');
    this.pitcher.userData.milk.position.y = 0.2;
    this.applyLevel();
  }

  get level() {
    return this.brew + this.milk;
  }
  get ground() {
    return this.turns >= 3;
  }
  get foamed() {
    return this.foam >= 0.3 && !this.holding;
  }

  setMix(m) {
    m = Math.round(Math.min(1, m) * 20) / 20;
    if (m === this.mix) return;
    this.mix = m;
    this.latte.setBase(coffeeBase(m));
  }

  applyLevel() {
    const v = this.level;
    this.coffee.visible = v > 0.01;
    this.coffee.position.y = LEVEL_Y(v);
    this.coffee.scale.setScalar(LEVEL_R(v));
  }

  snapshot() {
    const st = { brew: this.brew, milk: this.milk, spilled: this.spilled, mix: this.mix };
    const surf = this.latte.snapshot();
    return () => {
      Object.assign(this, st, { mix: -1 });
      this.setMix(st.mix);
      surf();
      this.applyLevel();
      this.updateSpill();
    };
  }

  // coloca los utensilios alrededor de la taza (en la zona de preparación)
  layout(step) {
    const p = this.mug.position;
    this.grinder.position.set(p.x - 0.85, 0, p.z + 0.15);
    this.grinder.visible = step === 'grind';
    const showDrip = this.brewed ? this.dripLift < 1 : step === 'brew';
    this.dripper.visible = showDrip;
    this.dripper.position.set(p.x, MUG_TOP + this.dripLift * 1.2, p.z);
    this.dripper.position.x += this.dripLift * 0.9;
    this.kettle.visible = step === 'brew' && !this.brewed;
    this.pitcher.visible = step === 'foam' || step === 'art';
    this.spill.position.set(p.x, 0.012, p.z);
    if (!this.holding) {
      if (this.kettle.visible) this.rest(this.kettle, p, 0.75, 1.25, -0.1);
      if (this.pitcher.visible) this.rest(this.pitcher, p, 0.65, 0.95, 0);
    }
  }

  rest(o, p, dx, y, tilt) {
    o.position.lerp(new THREE.Vector3(p.x + dx * 0.5, y, p.z + dx), 0.15);
    o.rotation.z += (tilt - o.rotation.z) * 0.15;
  }

  down(step, e, ctx) {
    this.last = [e.clientX, e.clientY];
    if (step === 'grind') {
      const c = ctx.screenOf(this.grinder.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.4, 0)));
      this.center = c;
      this.angle = Math.atan2(e.clientY - c.y, e.clientX - c.x);
      return true;
    }
    if (step === 'brew' && !this.brewed) {
      this.holding = true;
      this.tool = this.kettle;
      this.move(step, e, ctx);
      return true;
    }
    if (step === 'foam') {
      this.holding = true;
      return true;
    }
    if (step === 'art') {
      this.holding = true;
      this.tool = this.pitcher;
      this.prevUV = null;
      this.move(step, e, ctx);
      return true;
    }
    return false;
  }

  move(step, e, ctx) {
    if (step === 'grind' && this.center) {
      const a = Math.atan2(e.clientY - this.center.y, e.clientX - this.center.x);
      let d = a - this.angle;
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      this.angle = a;
      this.turns += Math.abs(d) / (Math.PI * 2);
      this.grinder.userData.crank.rotation.y -= d;
      this.grinder.userData.beans.scale.y = Math.max(0.2, 1 - this.turns / 8);
      ctx.sfx.scrape(Math.abs(d) * 0.03);
      return;
    }
    if ((step === 'brew' || step === 'art') && this.holding) {
      const y = step === 'brew' ? MUG_TOP + 0.75 : MUG_TOP + 0.3;
      const p = ctx.planePoint(e, y);
      if (p) this.tool.position.copy(p);
    }
  }

  up() {
    this.holding = false;
    this.center = null;
  }

  update(dt, step, ctx) {
    const p = this.mug.position;
    this.ripples.update(dt);
    if (this.brewed && this.dripLift < 1) this.dripLift = Math.min(1, this.dripLift + dt * 0.8);
    this.layout(step);
    this.water.visible = this.milkStream.visible = false;

    if (step === 'brew' && this.holding && !this.brewed) {
      const tip = this.kettle.position;
      this.kettle.rotation.z += (-0.55 - this.kettle.rotation.z) * 0.2;
      const onDripper = Math.hypot(tip.x - p.x, tip.z - p.z) < 0.3;
      const floor = onDripper ? MUG_TOP + 0.2 : 0.01;
      this.showStream(this.water, tip, floor);
      if (onDripper) {
        this.brew += dt * 0.05;
        this.rippleT -= dt;
        if (this.rippleT <= 0) {
          this.rippleT = 0.28;
          // el café gotea del filtro a la taza: ondas en el centro
          this.ripples.drop((Math.random() - 0.5) * 0.04, (Math.random() - 0.5) * 0.04, 0.008);
          this.droplets.splash(new THREE.Vector3(tip.x, MUG_TOP + 0.2, tip.z), '#cfe0e6', 2, 1.1);
        }
        const bed = this.dripper.userData.bed;
        bed.material.color.lerp(new THREE.Color('#2f1a0c'), dt * 0.6);
        bed.position.y = 0.17 + Math.sin(ctx.time * 3) * 0.006 + Math.min(0.06, this.brew * 0.2);
        if (this.brew >= 0.42) {
          this.brewed = true;
          this.holding = false;
          ctx.chime();
          ctx.say('Café colado ☕', 'Ahora, a espumar la leche');
        }
      } else {
        // agua fuera del filtro: charquito en la encimera
        if (Math.random() < dt * 14) this.droplets.splash(new THREE.Vector3(tip.x, 0.02, tip.z), '#cfe0e6', 3, 1.4, 0.01);
        if (Math.random() < dt * 8) {
          const q = new THREE.Mesh(new THREE.CircleGeometry(0.05 + Math.random() * 0.06, 16), new THREE.MeshStandardMaterial({ color: '#c9d6db', roughness: 0.05, transparent: true, opacity: 0.45 }));
          q.rotation.x = -Math.PI / 2;
          q.position.set(tip.x + (Math.random() - 0.5) * 0.08, 0.011, tip.z + (Math.random() - 0.5) * 0.08);
          this.puddles.add(q);
        }
      }
      ctx.sfx.scrape(0.004);
      this.applyLevel();
    }

    if (step === 'foam') {
      const m = this.pitcher.userData.milk;
      if (this.holding) {
        this.foam = Math.min(1, this.foam + dt * 0.3);
        m.position.y = 0.2 + this.foam * 0.12 + Math.sin(ctx.time * 30) * 0.004;
        this.pitcher.position.x += Math.sin(ctx.time * 40) * 0.002;
        ctx.sfx.sizzle(true);
      } else ctx.sfx.sizzle(false);
    }

    if (step === 'art' && this.holding) {
      const tip = this.pitcher.position;
      this.pitcher.rotation.z += (-0.7 - this.pitcher.rotation.z) * 0.2;
      const local = this.coffee.worldToLocal(tip.clone().setY(this.coffee.getWorldPosition(new THREE.Vector3()).y));
      const inCup = Math.hypot(local.x, local.y) < 0.318;
      const surfaceY = inCup ? this.coffee.getWorldPosition(new THREE.Vector3()).y : 0.01;
      this.showStream(this.milkStream, tip, surfaceY);
      this.milk += dt * 0.07;
      const uv = new THREE.Vector2((local.x / 0.318 + 1) / 2, (local.y / 0.318 + 1) / 2);
      if (this.level < 0.62) {
        // la leche se hunde bajo la superficie y aclara el café
        this.setMix(this.milk / 0.2);
      } else if (inCup && this.level <= 1) {
        this.latte.pour(uv, dt * (0.7 + this.foam * 0.6));
        // movimiento rápido mientras viertes = corte del dibujo
        if (this.prevUV && this.prevUV.distanceTo(uv) > 0.02) this.latte.smear(this.prevUV, uv);
      }
      this.prevUV = uv;
      this.rippleT -= dt;
      if (this.rippleT <= 0) {
        this.rippleT = 0.1;
        if (inCup) {
          this.ripples.drop(local.x, local.y, this.level < 0.62 ? 0.014 : 0.006);
          this.droplets.splash(new THREE.Vector3(tip.x, surfaceY + 0.01, tip.z), this.level < 0.62 ? '#e8d6c0' : '#fbf6ee', 2, 1.0);
        } else this.droplets.splash(new THREE.Vector3(tip.x, 0.02, tip.z), '#fbf6ee', 3, 1.3, 0.01);
      }
      if (this.level > 1) {
        this.spilled += dt;
        if (!this.warned) {
          this.warned = true;
          ctx.say('¡Uy! Se ha desbordado 💦', 'Puedes deshacer… o dejarlo así, que también tiene su encanto');
        }
        this.updateSpill();
      }
      ctx.sfx.scrape(0.005);
      this.applyLevel();
    }
  }

  updateSpill() {
    const s = this.spilled;
    this.spill.visible = s > 0;
    this.spill.scale.setScalar(0.55 + Math.min(0.6, s * 0.25));
    this.drips.children.forEach((d, i) => {
      d.visible = s > i * 0.25;
      d.scale.y = 0.6 + Math.min(1.2, (s - i * 0.25) * 0.8);
    });
  }

  showStream(m, tip, floorY) {
    const h = tip.y - floorY;
    if (h <= 0.01) return;
    m.visible = true;
    m.scale.set(1, h, 1);
    m.position.set(tip.x, floorY + h / 2, tip.z);
  }
}
