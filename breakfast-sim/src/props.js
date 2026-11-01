import { real } from './real.js';
import * as TG from './texgen.js';
// Objetos del desayuno. Modelado procedural "cute-realista": formas redondeadas,
// materiales mate tipo cerámica artesanal y colores pastel.
import * as THREE from 'three';
import {
  speckleTexture, latteTexture, blackCoffeeTexture, avocadoFleshTexture, noiseBump,
  daisyTexture, linenTexture, paperTowelTexture, labelTexture, stripeTexture, steamTexture,
  oakTexture, rng,
} from './textures.js';

const std = (color, roughness = 0.6, o = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, ...o });

const lathe = (pts, segs = 64, phiStart = 0, phiLength = Math.PI * 2) =>
  new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), segs, phiStart, phiLength);

const mesh = (g, m) => {
  const o = new THREE.Mesh(g, m);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
};

// ---------- Taza ----------
const MUG = [[0, 0], [0.27, 0], [0.31, 0.02], [0.33, 0.08], [0.35, 0.4], [0.36, 0.66],
  [0.35, 0.7], [0.33, 0.7], [0.32, 0.66], [0.31, 0.4], [0.29, 0.1], [0, 0.1]];

export function makeMug({ fancy }) {
  const g = new THREE.Group();
  const mat = fancy
    ? std('#fff', 1, (({ map, normalMap, roughnessMap }) => ({ map, normalMap, roughnessMap, normalScale: new THREE.Vector2(0.4, 0.4) }))(TG.stoneware('#e9dccb', { band: { color: '#c99c74', v: 0.14 } })))
    : std('#f4f4f2', 0.18);
  g.add(mesh(lathe(MUG), mat));
  const handle = mesh(new THREE.TorusGeometry(0.15, 0.036, 16, 40, Math.PI), mat);
  handle.rotation.z = -Math.PI / 2;
  handle.position.set(0.35, 0.37, 0);
  g.add(handle);
  const coffee = new THREE.Mesh(
    new THREE.CircleGeometry(0.318, 48),
    std('#fff', fancy ? 0.55 : 0.15, { map: fancy ? latteTexture() : blackCoffeeTexture() }),
  );
  coffee.rotation.x = -Math.PI / 2;
  coffee.rotation.z = fancy ? 0.4 : 0;
  coffee.position.y = 0.6;
  coffee.receiveShadow = true;
  g.add(coffee);
  g.userData.coffee = coffee;
  g.scale.setScalar(1.05);
  return g;
}

// Vapor: planos que siempre miran a cámara, suben y se desvanecen
export function makeSteam(count = 3) {
  const g = new THREE.Group();
  const t = steamTexture();
  g.userData.puffs = [];
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.35, 0.7),
      new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0 }),
    );
    m.userData.phase = i / count;
    g.add(m);
    g.userData.puffs.push(m);
  }
  g.userData.update = (time, camera) => {
    for (const m of g.userData.puffs) {
      const p = (time * 0.12 + m.userData.phase) % 1;
      m.position.set(Math.sin(time * 0.7 + m.userData.phase * 6) * 0.05, 0.2 + p * 0.8, 0);
      m.material.opacity = Math.sin(p * Math.PI) * 0.55;
      m.scale.setScalar(0.8 + p * 0.7);
      m.quaternion.copy(camera.quaternion);
    }
  };
  return g;
}

// ---------- Tabla de cortar ----------
export function makeBoard() {
  const s = new THREE.Shape();
  const w = 1.0, h = 0.66, r = 0.14;
  s.moveTo(-w + r, -h);
  s.lineTo(w - r, -h);
  s.quadraticCurveTo(w, -h, w, -h + r);
  s.lineTo(w, h - r);
  s.quadraticCurveTo(w, h, w - r, h);
  s.lineTo(-w + r, h);
  s.quadraticCurveTo(-w, h, -w, h - r);
  s.lineTo(-w, 0.14);
  // mango
  s.lineTo(-w - 0.32, 0.12);
  s.quadraticCurveTo(-w - 0.46, 0, -w - 0.32, -0.12);
  s.lineTo(-w, -0.14);
  s.lineTo(-w, -h + r);
  s.quadraticCurveTo(-w, -h, -w + r, -h);
  const hole = new THREE.Path();
  hole.absarc(-w - 0.3, 0, 0.045, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.05, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.02, bevelSegments: 3, curveSegments: 24,
  });
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + 1.5) / 3, (uv.getY(i) + 1) / 2);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0.015, 0);
  const t = real('olive_veneer', [0.7, 0.7]);
  const m = std('#ffffff', 1, { map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap });
  const o = mesh(geo, m);
  o.userData.top = 0.08;
  return o;
}

// ---------- Aguacate (medio, con hueso) ----------
export const AVO = [[0, 0], [0.22, 0.02], [0.38, 0.12], [0.44, 0.3], [0.42, 0.48], [0.34, 0.66],
  [0.24, 0.84], [0.13, 0.97], [0, 1.02]];

export function makeAvocadoHalf() {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  const skin = mesh(
    lathe(AVO, 48, 0, Math.PI),
    std('#ffffff', 1, (() => { const t = TG.avocadoSkin(); t.map.repeat.set(2, 2); t.normalMap.repeat.set(2, 2); t.roughnessMap.repeat.set(2, 2); return { map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, side: THREE.DoubleSide }; })()),
  );
  inner.add(skin);
  // cara del corte
  const pts = AVO.map(([x, y]) => new THREE.Vector2(x * 0.985, y));
  const back = AVO.slice().reverse().map(([x, y]) => new THREE.Vector2(-x * 0.985, y));
  const shape = new THREE.Shape([...pts, ...back.slice(1)]);
  const fg = new THREE.ShapeGeometry(shape, 24);
  const uv = fg.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + 0.45) / 0.9, uv.getY(i) / 1.02);
  fg.rotateY(-Math.PI / 2);
  const flesh = mesh(fg, std('#fff', 0.45, { map: avocadoFleshTexture() }));
  inner.add(flesh);
  const pit = mesh(new THREE.SphereGeometry(0.17, 32, 24), std('#7b4a2b', 0.35));
  pit.scale.set(0.75, 1.05, 1);
  pit.position.set(0, 0.33, 0);
  inner.add(pit);
  inner.rotation.z = -Math.PI / 2;
  inner.position.y = 0.42;
  g.add(inner);
  g.scale.setScalar(0.85);
  return g;
}

// ---------- Cuchillo de untar ----------
export function makeKnife({ fancy }) {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(0, -0.05);
  s.lineTo(0.62, -0.06);
  s.quadraticCurveTo(0.78, -0.04, 0.76, 0.03);
  s.quadraticCurveTo(0.72, 0.07, 0.62, 0.065);
  s.lineTo(0, 0.05);
  const blade = mesh(
    new THREE.ExtrudeGeometry(s, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2 }),
    std(fancy ? '#d9b779' : '#c9cdd2', 0.28, { metalness: 1 }),
  );
  blade.rotation.x = -Math.PI / 2;
  blade.position.y = 0.02;
  g.add(blade);
  const handle = mesh(
    new THREE.CapsuleGeometry(0.045, 0.5, 6, 16),
    fancy ? std('#8a5a36', 0.5) : std('#2b2b2b', 0.4),
  );
  handle.rotation.z = Math.PI / 2;
  handle.position.set(-0.28, 0.045, 0);
  g.add(handle);
  return g;
}

// ---------- Bol (vacío: el jugador vierte el yogur y decora) ----------
export function makeBowl() {
  const g = new THREE.Group();
  const prof = [[0, 0], [0.24, 0], [0.29, 0.02], [0.46, 0.2], [0.55, 0.38], [0.53, 0.4],
    [0.45, 0.23], [0.27, 0.06], [0, 0.06]];
  g.add(mesh(lathe(prof), std('#fff', 1, (({ map, normalMap, roughnessMap }) => ({ map, normalMap, roughnessMap, normalScale: new THREE.Vector2(0.4, 0.4) }))(TG.stoneware('#c9dbe3', { speck: '#4f6470', seed: 11 })))));
  g.userData.surfaceY = 0.3;
  g.userData.surfaceR = 0.47;
  return g;
}

// ---------- Vaso de zumo ----------
export function makeJuice() {
  const g = new THREE.Group();
  const glass = new THREE.Mesh(
    lathe([[0, 0], [0.2, 0], [0.21, 0.02], [0.245, 0.8], [0.23, 0.8], [0.195, 0.035], [0, 0.035]]),
    new THREE.MeshPhysicalMaterial({
      color: '#ffffff', roughness: 0.05, transmission: 1, thickness: 0.05, ior: 1.45, transparent: true,
    }),
  );
  g.add(glass);
  const juice = mesh(
    lathe([[0, 0.036], [0.193, 0.036], [0.226, 0.62], [0, 0.62]]),
    std('#f6a43a', 0.25, { emissive: '#f08a20', emissiveIntensity: 0.18 }),
  );
  juice.castShadow = false;
  g.add(juice);
  const straw = mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.05, 16), std('#fff', 0.6, { map: stripeTexture('#fbf3ea', '#f0a6a0') }));
  straw.position.set(0.06, 0.62, 0);
  straw.rotation.z = -0.22;
  g.add(straw);
  g.scale.setScalar(1.05);
  return g;
}

// ---------- Jarrón con margaritas ----------
export function makeDaisies() {
  const g = new THREE.Group();
  g.add(mesh(
    lathe([[0, 0], [0.13, 0], [0.17, 0.08], [0.18, 0.22], [0.11, 0.36], [0.065, 0.44],
      [0.075, 0.5], [0.055, 0.5], [0.05, 0.44], [0, 0.44]]),
    std('#f0c9c0', 0.3),
  ));
  const stemMat = std('#6f8f4a', 0.6);
  const petal = new THREE.MeshStandardMaterial({
    map: daisyTexture(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.7,
  });
  const center = std('#f1b832', 0.7, { bumpMap: noiseBump(5, 2000, [1, 2]), bumpScale: 2 });
  const heads = [[-0.22, 1.05, 0.05], [0.18, 1.2, -0.05], [0.02, 0.92, 0.18]];
  heads.forEach(([x, y, z], i) => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.3, 0),
      new THREE.Vector3(x * 0.3, 0.6, z * 0.3),
      new THREE.Vector3(x, y, z),
    ]);
    g.add(mesh(new THREE.TubeGeometry(curve, 20, 0.012, 6), stemMat));
    const head = new THREE.Group();
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), petal);
    p.castShadow = true;
    p.rotation.x = -Math.PI / 2;
    head.add(p);
    const c = mesh(new THREE.SphereGeometry(0.045, 16, 10), center);
    c.scale.y = 0.55;
    head.add(c);
    head.position.set(x, y, z);
    head.rotation.set(0.5 + i * 0.1, i * 1.3, x * 1.2);
    g.add(head);
  });
  return g;
}

// ---------- Planta (pothos) ----------
export function makePlant(scale = 1, trailing = false) {
  const g = new THREE.Group();
  g.add(mesh(
    lathe([[0, 0], [0.2, 0], [0.26, 0.38], [0.28, 0.4], [0.28, 0.44], [0.25, 0.44], [0.23, 0.4], [0, 0.4]]),
    std('#c9764f', 0.85, { map: speckleTexture('#d08560', '#8a4a2e', 600, 19) }),
  ));
  const soil = mesh(new THREE.CircleGeometry(0.24, 24), std('#4a3426', 1));
  soil.rotation.x = -Math.PI / 2;
  soil.position.y = 0.4;
  g.add(soil);
  const r = rng(trailing ? 5 : 3);
  const leafMats = [std('#5f8f47', 0.55), std('#7aa85a', 0.55), std('#4d7a3a', 0.55)];
  const n = trailing ? 16 : 22;
  for (let i = 0; i < n; i++) {
    const leaf = mesh(new THREE.SphereGeometry(0.12, 16, 10), leafMats[i % 3]);
    leaf.scale.set(1, 0.2, 1.35);
    const a = r() * 6.28;
    if (trailing && i > 5) {
      const d = 0.25 + r() * 0.15;
      leaf.position.set(Math.cos(a) * d, 0.35 - r() * 0.9, Math.sin(a) * d * 0.6 + 0.15);
    } else {
      const d = r() * 0.32;
      leaf.position.set(Math.cos(a) * d, 0.5 + r() * (trailing ? 0.2 : 0.75), Math.sin(a) * d);
    }
    leaf.rotation.set((r() - 0.5) * 1.2, a, (r() - 0.5) * 1.2);
    g.add(leaf);
  }
  g.scale.setScalar(scale);
  return g;
}

// ---------- Servilleta de lino ----------
export function makeNapkin(color = '#efc7b4') {
  const geo = new THREE.PlaneGeometry(1.2, 1.2, 40, 40);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    p.setZ(i, 0.012 * Math.sin(x * 9 + y * 3) + 0.008 * Math.sin(y * 17 - x * 4) + 0.01);
  }
  geo.computeVertexNormals();
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, std(color, 1, real('rough_linen', [1.2, 1.2])));
  m.receiveShadow = true;
  return m;
}

// ---------- Tarros en la balda ----------
export function makeJar(fill, h = 0.5) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.17, h, 32, 1, true),
    std('#ffffff', 0.08, { transparent: true, opacity: 0.25, side: THREE.DoubleSide }),
  ));
  g.children[0].position.y = h / 2;
  const content = mesh(new THREE.CylinderGeometry(0.155, 0.155, h * 0.7, 24), fill);
  content.position.y = h * 0.35;
  g.add(content);
  const lid = mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.07, 32), std('#c9a27a', 0.8));
  lid.position.y = h + 0.035;
  g.add(lid);
  return g;
}

// ---------- Huevo mollet partido ----------
export function makeEggHalf() {
  const g = new THREE.Group();
  const white = mesh(
    new THREE.SphereGeometry(0.15, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    std('#fbf8f2', 0.35),
  );
  white.scale.set(1, 0.8, 1.35);
  g.add(white);
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#fbf8f2';
  x.fillRect(0, 0, 256, 256);
  const yg = x.createRadialGradient(128, 140, 0, 128, 140, 80);
  yg.addColorStop(0, '#f39317');
  yg.addColorStop(0.7, '#f6a52a');
  yg.addColorStop(0.92, '#f7c35a');
  yg.addColorStop(1, 'rgba(250,240,220,0)');
  x.fillStyle = yg;
  x.beginPath();
  x.arc(128, 140, 80, 0, 7);
  x.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const cap = mesh(new THREE.CircleGeometry(0.15, 40), std('#fff', 0.3, { map: t }));
  cap.rotation.x = -Math.PI / 2;
  cap.scale.set(1, 1.35, 1);
  g.add(cap);
  const yolk = mesh(new THREE.SphereGeometry(0.075, 24, 12), std('#f49a1c', 0.2));
  yolk.scale.set(1, 0.25, 1.2);
  yolk.position.set(0, 0.002, -0.01);
  g.add(yolk);
  return g;
}

// ---------- Versión cutre ----------
export function makePaperTowel() {
  const geo = new THREE.PlaneGeometry(1.7, 1.7, 30, 30);
  const p = geo.attributes.position;
  const r = rng(4);
  for (let i = 0; i < p.count; i++) p.setZ(i, 0.006 + r() * 0.012 + 0.01 * Math.sin(p.getX(i) * 5));
  geo.computeVertexNormals();
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, std('#fff', 1, { map: paperTowelTexture() }));
  m.receiveShadow = true;
  m.userData.top = 0.02;
  return m;
}

export function makeButterTub() {
  const g = new THREE.Group();
  const body = mesh(new THREE.BoxGeometry(0.55, 0.22, 0.4), std('#f2efe6', 0.4));
  body.position.y = 0.11;
  g.add(body);
  const lid = mesh(new THREE.BoxGeometry(0.58, 0.04, 0.43), std('#f2c53d', 0.35));
  lid.position.y = 0.24;
  g.add(lid);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.18), std('#fff', 0.5, { map: labelTexture('#f2c53d', '#b0301c', 'MARGA', 'sabor mantequilla*') }));
  label.position.set(0, 0.11, 0.201);
  g.add(label);
  return g;
}

export function makeInstantJar() {
  const g = new THREE.Group();
  const body = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.6, 32), std('#3b2416', 0.3));
  body.position.y = 0.3;
  g.add(body);
  const lab = new THREE.Mesh(
    new THREE.CylinderGeometry(0.222, 0.222, 0.3, 32, 1, true, -1.2, 2.4),
    std('#fff', 0.5, { map: labelTexture('#c62f2a', '#ffffff', 'INSTANT', 'café soluble') }),
  );
  lab.position.y = 0.3;
  g.add(lab);
  const lid = mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.1, 32), std('#c62f2a', 0.4));
  lid.position.y = 0.65;
  g.add(lid);
  return g;
}
