// La cocina: paredes, ventana, encimera, armarios y la luz.
// Dos "moods": 'cutre' (piso compartido) y 'golden' (mañana dorada).
import * as THREE from 'three';
import {
  plasterTexture, oakTexture, laminateTexture, tileTextures, skyTexture, softDot, shaftTexture,
} from './textures.js';

const std = (color, roughness = 0.8, o = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...o });

const MOODS = {
  golden: {
    bg: '#f3e5d3', wall: '#f4e7d7', cabinet: '#b7c2a2', knob: '#c9a46a', frame: '#fbf6ee',
    sun: ['#ffd29a', 4.6], hemi: ['#fff1df', '#c9a08e', 1.0], env: 0.22, exposure: 0.86,
    sky: 1.7,
  },
  cutre: {
    bg: '#c6c6c0', wall: '#d2cec4', cabinet: '#d9d2c2', knob: '#8f8f8f', frame: '#e4e2dc',
    sun: ['#dce4ee', 1.0], hemi: ['#e7edf2', '#7d7a72', 1.75], env: 0.25, exposure: 0.92,
    sky: 1.05,
  },
};

export function buildRoom(scene) {
  const g = new THREE.Group();
  scene.add(g);
  const tex = {
    golden: {
      wall: plasterTexture('#f4e7d7', 2),
      counter: oakTexture(4),
      tiles: tileTextures('zellige', 9),
      sky: skyTexture('golden'),
    },
    cutre: {
      wall: plasterTexture('#d2cec4', 8),
      counter: laminateTexture(5),
      tiles: tileTextures('bath', 3),
      sky: skyTexture('cutre'),
    },
  };
  tex.golden.tiles.map.wrapS = tex.golden.tiles.map.wrapT = THREE.RepeatWrapping;
  tex.cutre.tiles.map.wrapS = tex.cutre.tiles.map.wrapT = THREE.RepeatWrapping;
  for (const k of ['golden', 'cutre']) {
    const t = tex[k].tiles;
    t.bump.wrapS = t.bump.wrapT = THREE.RepeatWrapping;
    const rep = k === 'golden' ? [9, 1.4] : [16, 2.4];
    t.map.repeat.set(...rep);
    t.bump.repeat.set(...rep);
  }

  const wallMat = std('#ffffff', 0.95);
  const tileMat = std('#ffffff', 0.22, { bumpScale: 2 });
  const counterMat = std('#ffffff', 0.5);
  const edgeMat = std('#d7b089', 0.55);
  const cabMat = std('#b7c2a2', 0.7);
  const knobMat = std('#c9a46a', 0.3, { metalness: 0.8 });
  const frameMat = std('#fbf6ee', 0.5);
  const skyMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });

  const add = (geo, mat, pos, { cast = true, receive = true } = {}) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos);
    m.castShadow = cast;
    m.receiveShadow = receive;
    g.add(m);
    return m;
  };

  // pared del fondo + salpicadero de azulejo
  add(new THREE.PlaneGeometry(14, 10), wallMat, [2, 2, -1.6], { cast: false });
  add(new THREE.PlaneGeometry(14, 1.4), tileMat, [2, 0.7, -1.59], { cast: false });

  // pared izquierda con hueco de ventana (z -1.2..1.4, y 0.9..3.1)
  const WX = -4, T = 0.25;
  const wall = (z0, z1, y0, y1) =>
    add(new THREE.BoxGeometry(T, y1 - y0, z1 - z0), wallMat, [WX - T / 2, (y0 + y1) / 2, (z0 + z1) / 2]);
  wall(-1.6, 6, -3, 0.9);
  wall(-1.6, 6, 3.1, 8);
  wall(-1.6, -1.2, 0.9, 3.1);
  wall(1.4, 6, 0.9, 3.1);
  // marco, parteluces y alféizar
  const bar = (sy, sz, pos) => add(new THREE.BoxGeometry(0.1, sy, sz), frameMat, pos);
  bar(2.2, 0.08, [WX - 0.05, 2.0, 0.1]);
  bar(0.08, 2.6, [WX - 0.05, 2.0, 0.1]);
  bar(0.1, 2.7, [WX - 0.05, 3.1, 0.1]);
  bar(2.3, 0.1, [WX - 0.05, 2.0, -1.2]);
  bar(2.3, 0.1, [WX - 0.05, 2.0, 1.4]);
  add(new THREE.BoxGeometry(0.4, 0.07, 2.9), frameMat, [WX + 0.1, 0.88, 0.1]);
  // cielo de fuera (no proyecta sombra)
  const sky = add(new THREE.PlaneGeometry(10, 8), skyMat, [WX - 1.8, 2.2, 0.1], { cast: false, receive: false });
  sky.rotation.y = Math.PI / 2;

  // encimera
  const top = add(new THREE.BoxGeometry(14, 0.14, 3.3), [edgeMat, edgeMat, counterMat, edgeMat, edgeMat, edgeMat], [2, -0.07, 0.05]);
  top.receiveShadow = true;
  // armarios bajos con puertas y pomos
  add(new THREE.BoxGeometry(14, 3, 3.1), cabMat, [2, -1.64, -0.05]);
  for (let i = 0; i < 7; i++) {
    const x = -3.4 + i * 1.6;
    add(new THREE.BoxGeometry(1.5, 1.2, 0.05), cabMat, [x, -0.85, 1.52]);
    const k = add(new THREE.SphereGeometry(0.06, 16, 12), knobMat, [x + 0.55, -0.42, 1.58]);
    k.scale.z = 0.6;
  }

  // balda en la pared (solo en golden)
  const shelf = new THREE.Group();
  const board = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.08, 0.42), std('#d9b48a', 0.6, { map: oakTexture(14) }));
  board.castShadow = board.receiveShadow = true;
  shelf.add(board);
  for (const x of [-1.1, 1.1]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.25, 0.3), std('#2f2a26', 0.4, { metalness: 0.6 }));
    b.position.set(x, -0.16, -0.05);
    b.castShadow = true;
    shelf.add(b);
  }
  shelf.position.set(0.7, 2.35, -1.38);
  g.add(shelf);

  // luces
  const hemi = new THREE.HemisphereLight('#fff', '#000', 1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff', 4);
  const sunDir = new THREE.Vector3(-1, 0.5, -0.22).normalize();
  sun.position.copy(sunDir).multiplyScalar(16);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 6, bottom: -4, near: 2, far: 30 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 6;
  sun.shadow.intensity = 0.72; // sombras suaves, nunca negras
  scene.add(sun);
  scene.add(sun.target);

  // rayos de luz (falso volumétrico) + motas de polvo flotando
  const beams = new THREE.Group();
  const shaftMat = new THREE.MeshBasicMaterial({
    map: shaftTexture(), color: '#ffe2b8', transparent: true, opacity: 0.1,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const beamDir = sunDir.clone().negate();
  for (const [z, w] of [[-0.6, 1.1], [0.7, 1.2]]) {
    for (const rot of [0, Math.PI / 2]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, 7), shaftMat);
      p.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), beamDir);
      p.rotateY(rot);
      p.position.set(WX, 2.0, z).addScaledVector(beamDir, 3.2);
      beams.add(p);
    }
  }
  scene.add(beams);

  const N = 180;
  const pos = new Float32Array(N * 3);
  const seeds = [];
  for (let i = 0; i < N; i++) {
    const t = Math.random() * 6, z = -1.1 + Math.random() * 2.4, y = 0.9 + Math.random() * 2.1;
    const base = new THREE.Vector3(WX, y, z).addScaledVector(beamDir, 0.3 + t);
    seeds.push({ base, ph: Math.random() * 10, sp: 0.2 + Math.random() * 0.4 });
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    map: softDot(), size: 0.035, color: '#fff3dc', transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  scene.add(dust);

  function update(time) {
    for (let i = 0; i < N; i++) {
      const s = seeds[i];
      pos[i * 3] = s.base.x + Math.sin(time * s.sp + s.ph) * 0.15;
      pos[i * 3 + 1] = s.base.y + Math.sin(time * s.sp * 0.7 + s.ph * 2) * 0.12;
      pos[i * 3 + 2] = s.base.z + Math.cos(time * s.sp * 0.5 + s.ph) * 0.15;
    }
    dustGeo.attributes.position.needsUpdate = true;
    shaftMat.opacity = 0.09 + Math.sin(time * 0.4) * 0.015;
  }

  function setMood(mood, renderer) {
    const M = MOODS[mood], T = tex[mood];
    scene.background = new THREE.Color(M.bg);
    scene.fog = new THREE.Fog(M.bg, 14, 30);
    wallMat.map = T.wall;
    counterMat.map = T.counter;
    tileMat.map = T.tiles.map;
    tileMat.bumpMap = T.tiles.bump;
    skyMat.map = T.sky;
    skyMat.color.setScalar(M.sky);
    for (const m of [wallMat, counterMat, tileMat, skyMat]) m.needsUpdate = true;
    edgeMat.color.set(mood === 'golden' ? '#d7b089' : '#8f8d88');
    counterMat.roughness = mood === 'golden' ? 0.55 : 0.35;
    cabMat.color.set(M.cabinet);
    knobMat.color.set(M.knob);
    frameMat.color.set(M.frame);
    sun.color.set(M.sun[0]);
    sun.intensity = M.sun[1];
    hemi.color.set(M.hemi[0]);
    hemi.groundColor.set(M.hemi[1]);
    hemi.intensity = M.hemi[2];
    scene.environmentIntensity = M.env;
    renderer.toneMappingExposure = M.exposure;
    shelf.visible = beams.visible = dust.visible = mood === 'golden';
  }

  return { group: g, update, setMood, shelf };
}
