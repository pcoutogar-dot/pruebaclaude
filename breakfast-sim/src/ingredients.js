// Ingredientes que el jugador coloca a mano, uno a uno.
// Cada fábrica devuelve un objeto con el origen en su base (y = 0) para que se
// pueda apoyar en cualquier superficie, incluso encima de otro ingrediente.
// Pequeñas variaciones aleatorias de forma y tamaño: no hay dos iguales.
import * as THREE from 'three';
import { makeEggHalf } from './props.js';

const M = (color, roughness = 0.5, o = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...o });
const mat = {
  blue: M('#3d3f73', 0.42),
  rasp: M('#d4435c', 0.6),
  straw: M('#e2464f', 0.35),
  strawIn: M('#f7b7b4', 0.5),
  banana: M('#f6ecc4', 0.55),
  bananaIn: M('#efe0a8', 0.6),
  gran: M('#b98348', 0.9),
  mint: M('#5f9a4a', 0.5),
  green: M('#79a94f', 0.5),
  chili: M('#c8361f', 0.6),
  sesame: M('#efe2c4', 0.5),
  radish: M('#fbf3f1', 0.45),
  radishSkin: M('#d6366a', 0.4),
  tomato: M('#e2412e', 0.25),
  tomatoIn: M('#f1735a', 0.5),
  avo: M('#b9d36a', 0.45),
  avoSkin: M('#2f4420', 0.7),
};

const v = (a = 0.15) => 1 + (Math.random() - 0.5) * 2 * a;
const shadow = (o) => {
  o.traverse((c) => {
    if (c.isMesh) c.castShadow = c.receiveShadow = true;
  });
  return o;
};

function sphereish(r, m, sy = 1) {
  const o = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), m);
  o.scale.set(v(), sy * v(), v());
  o.position.y = r * sy * 0.85;
  return o;
}

function disc(r, h, top, side) {
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 28), [side, top, top]);
  c.position.y = h / 2;
  g.add(c);
  return g;
}

// rodaja de rábano: aro rosa y centro blanco
function radishSlice() {
  const g = disc(0.075 * v(0.1), 0.012, mat.radish, mat.radishSkin);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.007, 6, 28), mat.radishSkin);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.012;
  g.add(ring);
  return g;
}

// media luna (lámina de aguacate, gajo de fresa, plátano...)
function crescent(len, w, h, inMat, skinMat) {
  const s = new THREE.Shape();
  s.moveTo(-len / 2, 0);
  s.quadraticCurveTo(0, w * 1.6, len / 2, 0);
  s.quadraticCurveTo(0, w * 0.5, -len / 2, 0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2 });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0.004, w * 0.5);
  const o = new THREE.Mesh(geo, [inMat, skinMat]);
  return o;
}

export const PLACE = {
  egg: () => {
    const g = new THREE.Group();
    const e = makeEggHalf();
    e.position.y = 0.115;
    g.add(e);
    return g;
  },
  avoSlice: () => {
    const g = new THREE.Group();
    g.add(crescent(0.42 * v(0.1), 0.06, 0.025, mat.avo, mat.avoSkin));
    return g;
  },
  radish: radishSlice,
  tomato: () => {
    const g = new THREE.Group();
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.06 * v(0.1), 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat.tomato);
    g.add(h);
    const cut = new THREE.Mesh(new THREE.CircleGeometry(0.06, 20), mat.tomatoIn);
    cut.rotation.x = Math.PI / 2;
    cut.position.y = 0.001;
    // boca abajo no: la cara cortada mira arriba
    h.rotation.x = Math.PI;
    h.position.y = 0.06;
    cut.rotation.x = -Math.PI / 2;
    cut.position.y = 0.06;
    g.add(cut);
    return g;
  },
  sprouts: () => {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const leaf = new THREE.Group();
      for (const s of [-1, 1]) {
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), mat.green);
        l.scale.set(1, 0.2, 0.55);
        l.position.set(s * 0.03, 0.03, 0);
        l.rotation.z = s * 0.4;
        leaf.add(l);
      }
      leaf.position.set((Math.random() - 0.5) * 0.06, 0, (Math.random() - 0.5) * 0.06);
      leaf.rotation.y = Math.random() * 6;
      g.add(leaf);
    }
    return g;
  },
  blueberry: () => {
    const g = new THREE.Group();
    g.add(sphereish(0.05, mat.blue, 0.9));
    return g;
  },
  raspberry: () => {
    const g = new THREE.Group();
    const o = new THREE.Mesh(new THREE.IcosahedronGeometry(0.065 * v(0.1), 2), mat.rasp);
    o.scale.y = 1.15;
    o.position.y = 0.065;
    g.add(o);
    return g;
  },
  strawberry: () => {
    const g = new THREE.Group();
    const o = crescent(0.17, 0.07, 0.02, mat.strawIn, mat.straw);
    g.add(o);
    return g;
  },
  banana: () => disc(0.085 * v(0.08), 0.03, mat.banana, mat.bananaIn),
  mint: () => {
    const g = new THREE.Group();
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 8), mat.mint);
    l.scale.set(1, 0.15, 0.55);
    l.position.y = 0.012;
    g.add(l);
    return g;
  },
};

export const SPRINKLE = {
  chili: () => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.008, 0.02 * v(0.5)), mat.chili);
    o.position.y = 0.006;
    return o;
  },
  sesame: () => {
    const o = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), mat.sesame);
    o.scale.set(1, 0.4, 0.6);
    o.position.y = 0.006;
    return o;
  },
  granola: () => {
    const o = new THREE.Mesh(new THREE.DodecahedronGeometry(0.03 + Math.random() * 0.03, 0), mat.gran);
    o.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    o.position.y = 0.025;
    return o;
  },
};

export function makePlaced(kind, sprinkle = false) {
  const o = sprinkle ? SPRINKLE[kind]() : PLACE[kind]();
  const g = new THREE.Group();
  g.add(o);
  return shadow(g);
}
