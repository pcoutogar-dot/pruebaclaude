import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import './style.css';
import { buildRoom } from './room.js';
import { Toast } from './toast.js';
import { Sfx } from './audio.js';
import { PourSurface, cremaBase, bowlBase, makeSurfaceMesh } from './pour.js';
import { makePlaced } from './ingredients.js';
import * as P from './props.js';

// ---------- Render ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
// iPhone tiene DPR 3: limitamos a 2 para ir fluidos sin perder nitidez
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 60);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.28, 0.6, 0.92));
composer.addPass(new OutputPass());

const room = buildRoom(scene);

// ---------- Los dos desayunos ----------
const sets = {};
{
  // Mañana dorada
  const g = new THREE.Group();
  const board = P.makeBoard();
  board.position.set(0.0, 0, 0.35);
  board.rotation.y = 0.06;
  const toast = new Toast('sourdough');
  toast.group.position.set(-0.15, board.userData.top, 0.32);
  toast.group.rotation.y = 0.12;
  const avo = P.makeAvocadoHalf();
  avo.position.set(0.68, board.userData.top, 0.68);
  avo.rotation.y = -0.5;
  const knife = P.makeKnife({ fancy: true });
  knife.position.set(0.45, board.userData.top, 0.0);
  knife.rotation.y = 0.5;
  const napkin = P.makeNapkin();
  napkin.position.set(1.85, 0, -0.35);
  napkin.rotation.y = 0.3;
  const mug = P.makeMug({ fancy: true });
  mug.position.set(1.85, 0.02, -0.35);
  mug.rotation.y = -0.6;
  const steam = P.makeSteam();
  steam.position.set(1.85, 0.62, -0.35);
  const bowl = P.makeBowl();
  bowl.position.set(-1.55, 0, 0.75);
  const juice = P.makeJuice();
  juice.position.set(-1.65, 0, -0.45);
  const daisies = P.makeDaisies();
  daisies.position.set(0.85, 0, -1.15);
  const plant = P.makePlant(1.2);
  plant.position.set(-3.2, 0, -1.0);
  const oats = P.makeJar(new THREE.MeshStandardMaterial({ color: '#e3cfa6', roughness: 1 }), 0.55);
  oats.position.set(0.05, 2.39, -1.38);
  const beans = P.makeJar(new THREE.MeshStandardMaterial({ color: '#4a2c1a', roughness: 0.5 }), 0.42);
  beans.position.set(0.5, 2.39, -1.38);
  const hang = P.makePlant(0.7, true);
  hang.position.set(1.5, 2.39, -1.38);
  g.add(board, toast.group, avo, knife, napkin, mug, steam, bowl, juice, daisies, plant, oats, beans, hang);

  // superficies "manuales"
  const latte = new PourSurface({ drawBase: cremaBase, milk: '#f8eedf', halo: '#d6ad84', push: 1, size: [5, 9], capacity: 2400 });
  const coffee = mug.userData.coffee;
  coffee.material.map = latte.texture;
  coffee.material.roughness = 0.5;
  coffee.rotation.z = 0;
  coffee.material.needsUpdate = true;
  const yogurt = new PourSurface({ drawBase: bowlBase, milk: '#fbf8f1', halo: '#e4dfd4', push: 0.55, size: [10, 15], capacity: 1500 });
  const ysurf = makeSurfaceMesh(yogurt, bowl.userData.surfaceR, 0.4);
  ysurf.position.y = bowl.userData.surfaceY;
  bowl.add(ysurf);
  const bowlPlaced = new THREE.Group();
  bowlPlaced.position.y = bowl.userData.surfaceY;
  bowl.add(bowlPlaced);

  sets.golden = {
    group: g, toast, steam, latte, yogurt, ysurf, coffee, mug, bowl, bowlPlaced,
    items: { board, toast: toast.group, avo, knife, napkin, mug, steam, bowl, juice, daisies, plant },
  };
}
{
  // Piso compartido
  const g = new THREE.Group();
  const towel = P.makePaperTowel();
  towel.position.set(-0.1, 0, 0.35);
  towel.rotation.y = -0.15;
  const toast = new Toast('sandwich');
  toast.group.position.set(-0.15, towel.userData.top, 0.35);
  toast.group.rotation.y = -0.1;
  const tub = P.makeButterTub();
  tub.position.set(0.95, 0, 0.75);
  tub.rotation.y = -0.4;
  const knife = P.makeKnife({ fancy: false });
  knife.position.set(0.6, 0.0, 0.05);
  knife.rotation.y = 0.9;
  const mug = P.makeMug({ fancy: false });
  mug.position.set(1.75, 0, -0.3);
  const steam = P.makeSteam(2);
  steam.position.set(1.75, 0.62, -0.3);
  const jar = P.makeInstantJar();
  jar.position.set(-1.4, 0, -0.6);
  jar.rotation.y = 0.5;
  g.add(towel, toast.group, tub, knife, mug, steam, jar);
  sets.cutre = { group: g, toast, steam, mug, items: { towel, toast: toast.group, tub, knife, mug, steam, jar } };
}
for (const s of Object.values(sets)) {
  s.toast.placed = new THREE.Group();
  s.toast.group.add(s.toast.placed);
  scene.add(s.group);
}

// ---------- Composición horizontal (3/4) y vertical (casi cenital) ----------
const PORTRAIT = {
  golden: {
    napkin: [0.85, -0.85, 0.3], mug: [0.85, -0.85, -0.6], steam: [0.85, -0.85],
    juice: [-0.8, -0.95], daisies: [-0.05, -1.3], bowl: [-0.75, 1.3], plant: [-1.7, -1.2],
  },
  cutre: { mug: [0.8, -0.85], steam: [0.8, -0.85], jar: [-0.8, -0.95, 0.5], tub: [0.9, 1.25, -0.3] },
};
const SHIFT = ['board', 'toast', 'avo', 'knife', 'towel'];
const layout = [];
for (const m of ['golden', 'cutre']) {
  for (const [k, o] of Object.entries(sets[m].items)) {
    const land = [o.position.x, o.position.z, o.rotation.y];
    let port = PORTRAIT[m][k];
    if (SHIFT.includes(k)) port = [land[0], land[1] - 0.3, land[2]];
    if (port) layout.push({ o, land, port: [port[0], port[1], port[2] ?? land[2]] });
  }
}
let portrait = null;
function applyLayout(p) {
  if (p === portrait) return;
  portrait = p;
  for (const { o, land, port } of layout) {
    const [x, z, ry] = p ? port : land;
    o.position.x = x;
    o.position.z = z;
    o.rotation.y = ry;
  }
}

// ---------- Estaciones y herramientas ----------
// Cada estación es una "manualidad" con herramientas libres. No hay resultado
// correcto: tú decides cuándo está listo.
const T = (id, icon, label, type, hint, extra = {}) => ({ id, icon, label, type, hint, ...extra });
const H = {
  spread: 'Unta a tu manera: despacio deja grumos, rápido una capa fina. Las vetas siguen tu dedo.',
  honey: 'Desliza para dejar caer un hilo de miel.',
  place: 'Toca para colocar y arrastra para moverlo. Puedes apilar unas cosas sobre otras.',
  orient: 'Toca para colocar y arrastra para girarla. ¿Abanico, espiral, en fila?',
  sprinkle: 'Desliza para espolvorear donde quieras.',
};
const STATIONS = {
  golden: [
    {
      id: 'toast', label: 'Tostada', icon: '🍞', surface: 'toast', width: 1.9, tools: [
        T('avocado', '🥑', 'Aguacate', 'spread', H.spread),
        T('ricotta', '🤍', 'Ricotta', 'spread', H.spread),
        T('honey', '🍯', 'Miel', 'spread', H.honey),
        T('avoSlice', '🥑', 'Láminas', 'place', H.orient, { orient: true }),
        T('egg', '🥚', 'Huevo', 'place', H.place),
        T('radish', '🌸', 'Rabanito', 'place', H.place),
        T('tomato', '🍅', 'Cherry', 'place', H.place),
        T('sprouts', '🌱', 'Brotes', 'place', H.place),
        T('chili', '🌶️', 'Chile', 'sprinkle', H.sprinkle),
        T('sesame', '✨', 'Sésamo', 'sprinkle', H.sprinkle),
      ],
    },
    {
      id: 'bowl', label: 'Bol', icon: '🥣', surface: 'bowl', width: 1.7, tools: [
        T('yogurt', '🥛', 'Yogur', 'pour', 'Mantén pulsado para verter. Muévete para repartirlo… o no.'),
        T('blueberry', '🫐', 'Arándanos', 'place', H.place),
        T('raspberry', '🍓', 'Frambuesa', 'place', H.place),
        T('strawberry', '🍓', 'Fresa', 'place', H.orient, { orient: true }),
        T('banana', '🍌', 'Plátano', 'place', H.place),
        T('granola', '🥣', 'Granola', 'sprinkle', H.sprinkle),
        T('mint', '🌿', 'Menta', 'place', H.orient, { orient: true }),
        T('drizzle', '🍯', 'Miel', 'drizzle', H.honey),
      ],
    },
    {
      id: 'coffee', label: 'Café', icon: '☕', surface: 'coffee', width: 1.15, tools: [
        T('milk', '🥛', 'Leche', 'pour', 'Mantén pulsado para verter la leche. Balancea el dedo para hacer capas.'),
        T('etch', '✏️', 'Dibujar', 'smear', 'Arrastra por la espuma: el corte de un corazón, una hoja… o lo que quieras.'),
        T('cinnamon', '🟤', 'Canela', 'dust', 'Desliza para espolvorear canela.'),
      ],
    },
    { id: 'table', label: 'Mesa', icon: '✨', tools: [], hint: 'Tu desayuno. Arrastra para mirarlo desde otro ángulo.' },
  ],
  cutre: [
    {
      id: 'toast', label: 'Tostada', icon: '🍞', surface: 'toast', width: 1.6, tools: [
        T('butter', '🧈', 'Margarina', 'spread', 'Unta la margarina… es lo que hay.'),
      ],
    },
    {
      id: 'coffee', label: 'Café', icon: '☕', width: 1.15, tools: [],
      hint: 'Con café soluble no hay mucho arte posible. Ahorra para una cafetera y leche de verdad ☕',
    },
    { id: 'table', label: 'Mesa', icon: '✨', tools: [], hint: 'Tu desayuno. Arrastra para mirarlo desde otro ángulo.' },
  ],
};

let mood = 'golden';
let station = STATIONS.golden[0];
let tool = station.tools[0];
const undo = [];
const anims = [];

function focusObject() {
  const s = sets[mood];
  return { toast: s.toast.group, bowl: s.bowl, coffee: s.mug }[station.id];
}

// ---------- UI ----------
const $ = (id) => document.getElementById(id);
const hint = $('hint'), tabs = $('tabs'), tools = $('tools'), fade = $('fade'), msg = $('msg');
const sfx = new Sfx();

function renderUI() {
  tabs.innerHTML = '';
  for (const st of STATIONS[mood]) {
    const b = document.createElement('button');
    b.className = 'tab' + (st === station ? ' on' : '');
    b.innerHTML = `<span>${st.icon}</span>${st.label}`;
    b.onclick = () => selectStation(st);
    tabs.appendChild(b);
  }
  tools.innerHTML = '';
  for (const t of station.tools) {
    const b = document.createElement('button');
    b.className = 'chip' + (t === tool ? ' on' : '');
    b.innerHTML = `<span>${t.icon}</span>${t.label}`;
    b.onclick = () => {
      tool = t;
      renderUI();
    };
    tools.appendChild(b);
  }
  tools.style.display = station.tools.length ? '' : 'none';
  hint.textContent = tool ? tool.hint : station.hint;
}

function selectStation(st) {
  station = st;
  tool = st.tools[0] || null;
  renderUI();
}

function applyMood(m) {
  mood = m;
  room.setMood(m, renderer);
  sets.golden.group.visible = m === 'golden';
  sets.cutre.group.visible = m === 'cutre';
  document.body.dataset.mood = m;
  document.querySelectorAll('#mood button').forEach((b) => b.classList.toggle('on', b.dataset.mood === m));
  undo.length = 0;
  selectStation(STATIONS[m][0]);
}

let msgTimer;
function say(title, sub) {
  msg.innerHTML = `<b>${title}</b><span>${sub}</span>`;
  msg.classList.add('show');
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => msg.classList.remove('show'), 3200);
}

document.querySelectorAll('#mood button').forEach((b) =>
  b.addEventListener('click', () => {
    if (b.dataset.mood === mood) return;
    fade.classList.add('on');
    setTimeout(() => {
      applyMood(b.dataset.mood);
      fade.classList.remove('on');
    }, 450);
  }),
);

$('undo').addEventListener('click', () => {
  const u = undo.pop();
  if (u) u();
});
$('reset').addEventListener('click', () => {
  const s = sets[mood];
  if (station.id === 'toast') {
    s.toast.reset();
    s.toast.placed.clear();
  } else if (station.id === 'bowl') {
    s.yogurt.reset();
    s.bowlPlaced.clear();
  } else if (station.id === 'coffee' && s.latte) s.latte.reset();
  else return;
  undo.length = 0;
});
const soundBtn = $('sound');
soundBtn.addEventListener('click', () => {
  sfx.on = !sfx.on;
  soundBtn.classList.toggle('off', !sfx.on);
  if (!sfx.on) sfx.stop();
});

const timeEl = $('time');
let minutes = 7 * 60 + 32;
setInterval(() => {
  if (minutes < 8 * 60 + 15) minutes++;
  timeEl.textContent = `${String((minutes / 60) | 0).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}, 2500);

// ---------- Input ----------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const el = renderer.domElement;
let drag = null; // estado del gesto en curso
let yaw = 0, pitch = 0, yawT = 0, pitchT = 0, lastX = 0, lastY = 0;

function cast(e, objects) {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  return ray.intersectObjects(objects, true)[0] || null;
}

// superficie + contenedor de la estación actual
function surfaceInfo() {
  const s = sets[mood];
  if (station.surface === 'toast') return { surface: s.toast.mesh, holder: s.toast.placed, kind: 'toast' };
  if (station.surface === 'bowl') return { surface: s.ysurf, holder: s.bowlPlaced, kind: 'bowl' };
  if (station.surface === 'coffee') return { surface: s.coffee, holder: null, kind: 'coffee' };
  return null;
}

function hitSurface(e, info, { withPlaced = false, exclude = null } = {}) {
  const objs = [info.surface];
  if (withPlaced && info.holder) for (const c of info.holder.children) if (c !== exclude) objs.push(c);
  const h = cast(e, objs);
  if (!h) return null;
  if (h.object === info.surface && info.kind === 'toast' && h.face.normal.y < 0.5) return null;
  return h;
}

function pop(obj) {
  obj.userData.s = obj.scale.x;
  obj.scale.setScalar(0.001);
  anims.push({ obj, t0: clock.elapsedTime, dur: 0.35 });
}

function placeAt(holder, h, kind, sprinkle = false) {
  const o = makePlaced(kind, sprinkle);
  o.position.copy(holder.worldToLocal(h.point.clone()));
  o.rotation.y = Math.random() * Math.PI * 2;
  holder.add(o);
  pop(o);
  return o;
}

el.addEventListener('pointerdown', (e) => {
  sfx.ensure();
  el.setPointerCapture(e.pointerId);
  lastX = e.clientX;
  lastY = e.clientY;
  const info = surfaceInfo();
  if (tool && info) {
    const s = sets[mood];
    if (tool.type === 'spread') {
      const h = hitSurface(e, info);
      if (h) {
        undo.push(s.toast.snapshot());
        drag = { kind: 'spread', uv: h.uv.clone() };
        return;
      }
    } else if (tool.type === 'place') {
      const h = hitSurface(e, info, { withPlaced: true });
      if (h) {
        const o = placeAt(info.holder, h, tool.id);
        undo.push(() => o.removeFromParent());
        sfx.plop();
        drag = { kind: tool.orient ? 'orient' : 'move', obj: o, info, start: h.point.clone() };
        return;
      }
    } else if (tool.type === 'sprinkle') {
      const h = hitSurface(e, info, { withPlaced: true });
      if (h) {
        const items = [];
        undo.push(() => items.forEach((o) => o.removeFromParent()));
        drag = { kind: 'sprinkle', items, info, acc: 1 };
        sprinkleAt(drag, h);
        return;
      }
    } else if (['pour', 'smear', 'dust', 'drizzle'].includes(tool.type)) {
      const surf = info.kind === 'coffee' ? s.latte : s.yogurt;
      const h = hitSurface(e, info);
      if (h && surf) {
        undo.push(surf.snapshot());
        drag = { kind: tool.type, surf, uv: h.uv.clone(), info };
        return;
      }
    }
  }
  drag = { kind: 'orbit' };
});

function sprinkleAt(d, h) {
  const n = 2 + ((Math.random() * 3) | 0);
  for (let i = 0; i < n; i++) {
    const o = placeAt(d.info.holder, h, tool.id, true);
    o.position.x += (Math.random() - 0.5) * 0.14;
    o.position.z += (Math.random() - 0.5) * 0.14;
    o.rotation.x = (Math.random() - 0.5) * 0.6;
    d.items.push(o);
  }
}

el.addEventListener('pointermove', (e) => {
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;
  if (!drag) return;
  const s = sets[mood];
  switch (drag.kind) {
    case 'spread': {
      const h = hitSurface(e, surfaceInfo());
      if (!h) {
        drag.uv = null;
        sfx.stop();
        break;
      }
      if (drag.uv) {
        s.toast.paint(drag.uv.x, drag.uv.y, h.uv.x, h.uv.y, tool.id);
        sfx.scrape(drag.uv.distanceTo(h.uv));
      }
      drag.uv = h.uv.clone();
      break;
    }
    case 'move': {
      const h = hitSurface(e, drag.info, { withPlaced: true, exclude: drag.obj });
      if (h) drag.obj.position.copy(drag.info.holder.worldToLocal(h.point.clone()));
      break;
    }
    case 'orient': {
      const h = hitSurface(e, drag.info, { withPlaced: true, exclude: drag.obj });
      if (h) {
        const a = drag.info.holder.worldToLocal(drag.start.clone());
        const b = drag.info.holder.worldToLocal(h.point.clone());
        if (a.distanceTo(b) > 0.03) drag.obj.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
      }
      break;
    }
    case 'sprinkle': {
      drag.acc += Math.hypot(dx, dy);
      if (drag.acc > 14) {
        drag.acc = 0;
        const h = hitSurface(e, drag.info, { withPlaced: true });
        if (h) sprinkleAt(drag, h);
      }
      break;
    }
    case 'pour':
    case 'smear':
    case 'dust':
    case 'drizzle': {
      const h = hitSurface(e, drag.info);
      if (!h) break;
      if (drag.kind === 'smear') drag.surf.smear(drag.uv, h.uv);
      if (drag.kind === 'dust') drag.surf.sprinkle(h.uv, '#7a4a24', 5);
      if (drag.kind === 'drizzle') drag.surf.drizzle(drag.uv, h.uv);
      if (drag.kind === 'smear') sfx.scrape(drag.uv.distanceTo(h.uv) * 0.5);
      drag.uv = h.uv.clone();
      break;
    }
    case 'orbit':
      yawT = THREE.MathUtils.clamp(yawT - dx * 0.004, -0.45, 0.45);
      pitchT = THREE.MathUtils.clamp(pitchT + dy * 0.003, -0.25, 0.2);
      break;
  }
});
const up = () => {
  drag = null;
  sfx.stop();
};
el.addEventListener('pointerup', up);
el.addEventListener('pointercancel', up);

// ---------- Cámara: vista general o primer plano de la estación ----------
const OV = {
  land: { target: new THREE.Vector3(0.0, 0.5, 0.1), dir: new THREE.Vector3(0.48, 0.66, 0.92).normalize() },
  port: { target: new THREE.Vector3(0.0, 0.15, 0.2), dir: new THREE.Vector3(0.12, 1.45, 0.95).normalize() },
};
const FOCUS_DIR = new THREE.Vector3(0.12, 1.75, 0.8).normalize();
const want = { target: new THREE.Vector3(), dir: new THREE.Vector3(), dist: 8, fov: 30 };
const cur = { target: new THREE.Vector3(0, 0.3, 0), dir: OV.land.dir.clone(), dist: 8, fov: 30 };
const tmp = new THREE.Vector3();
const fovFor = (width, dist, a) => THREE.MathUtils.radToDeg(2 * Math.atan(width / 2 / dist / a));

function computeView() {
  const a = innerWidth / innerHeight, p = a < 0.9, tight = a > 1.8;
  const f = focusObject();
  if (!f) {
    const c = p ? OV.port : OV.land;
    want.target.copy(c.target);
    want.dir.copy(c.dir);
    if (p) {
      want.dist = 9;
      want.fov = fovFor(3.3, 9, a);
    } else if (tight) {
      want.dist = 7.4;
      want.target.x += 1.3;
      want.fov = 30;
    } else {
      want.dist = 8.6;
      const minH = THREE.MathUtils.degToRad(44);
      const hNow = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(30) / 2) * a);
      want.fov = hNow < minH ? THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(minH / 2) / a)) : 30;
    }
    return;
  }
  const w = station.width;
  f.getWorldPosition(want.target);
  want.target.y += 0.15;
  want.dir.copy(FOCUS_DIR);
  want.dist = 5;
  if (p) {
    want.fov = fovFor(w, 5, a);
    want.target.z += w * 0.28; // deja el objeto por encima de la tarjeta inferior
  } else if (tight) {
    want.fov = fovFor(w * 1.9, 5, a);
    want.target.x += w * 0.45; // deja hueco a la tarjeta de la derecha
  } else {
    want.fov = Math.max(26, fovFor(w * 1.7, 5, a));
    want.target.z += w * 0.2;
  }
}

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  applyLayout(camera.aspect < 0.9);
}
addEventListener('resize', resize);
resize();

// ---------- Loop ----------
const clock = new THREE.Clock();
const easeOutBack = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
applyMood('golden');
computeView();
cur.target.copy(want.target);
cur.dir.copy(want.dir);
cur.dist = want.dist;
cur.fov = want.fov;

function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;
  const s = sets[mood];

  // verter mientras se mantiene pulsado (aunque el dedo no se mueva)
  if (drag && drag.kind === 'pour' && drag.uv) {
    drag.surf.pour(drag.uv, dt);
    sfx.scrape(drag.surf.full ? 0 : 0.006);
    if (drag.surf.full && !drag.warned) {
      drag.warned = true;
      say(station.id === 'coffee' ? 'La taza está llena ☕' : 'El bol está lleno 🥣', 'Ahora decora a tu gusto');
    }
  }
  if (s.latte) {
    s.latte.render();
    s.yogurt.render();
  }
  s.toast.flush();

  computeView();
  const k = 1 - Math.exp(-dt * 3.5);
  cur.target.lerp(want.target, k);
  cur.dir.lerp(want.dir, k).normalize();
  cur.dist += (want.dist - cur.dist) * k;
  cur.fov += (want.fov - cur.fov) * k;
  if (Math.abs(camera.fov - cur.fov) > 0.01) {
    camera.fov = cur.fov;
    camera.updateProjectionMatrix();
  }
  yaw += (yawT - yaw) * (1 - Math.exp(-dt * 5));
  pitch += (pitchT - pitch) * (1 - Math.exp(-dt * 5));
  const sway = Math.sin(time * 0.17) * 0.02;
  tmp.copy(cur.dir).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw + sway).multiplyScalar(cur.dist);
  tmp.y += pitch * cur.dist + Math.sin(time * 0.23) * 0.02;
  camera.position.copy(cur.target).add(tmp);
  camera.lookAt(cur.target);

  s.steam.userData.update(time, camera);
  room.update(time);

  for (let i = anims.length - 1; i >= 0; i--) {
    const a = anims[i];
    const t = THREE.MathUtils.clamp((time - a.t0) / a.dur, 0, 1);
    a.obj.scale.setScalar(Math.max(0.001, easeOutBack(t)) * a.obj.userData.s);
    if (t === 1) anims.splice(i, 1);
  }

  composer.render();
  requestAnimationFrame(loop);
}
loop();

window.__bs = { scene, camera, sets, applyMood, selectStation, STATIONS, get station() { return station; } };
