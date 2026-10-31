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
import { Shop } from './shop.js';
import { AvocadoPrep } from './avocado.js';
import { CoffeeProc, setMugLevel } from './coffee.js';
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
let uiReady = false;
const shop = new Shop({ renderer, env: scene.environment, onChange: () => uiReady && renderUI() });

// ---------- Los dos desayunos ----------
const sets = {};
{
  // Mañana dorada
  const g = new THREE.Group();
  const board = P.makeBoard();
  board.position.set(0.0, 0, 0.35);
  board.rotation.y = 0.06;
  board.scale.setScalar(0.9);
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
  bowl.position.set(-1.8, 0, 0.85);
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
  const yogurt = new PourSurface({ drawBase: bowlBase, milk: '#fbf8f1', halo: '#d8d0c2', push: 0.55, size: [10, 15], capacity: 1500 });
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

// ---------- Zona de preparación (a la derecha de la encimera) ----------
// Aquí se hacen los procesos (pelar, colar...) sin amontonar la mesa del desayuno.
const AVO_ZONE = new THREE.Vector3(3.55, 0.065, 0.15);
const COFFEE_ZONE = new THREE.Vector3(5.7, 0.02, -0.3);
const prepBoard = P.makeBoard();
prepBoard.scale.setScalar(0.8);
prepBoard.position.set(4.0, 0, 0.55);
prepBoard.rotation.y = Math.PI / 2;
const avoPrep = new AvocadoPrep();
avoPrep.group.position.copy(AVO_ZONE);
const zoneLight = new THREE.PointLight('#ffd9ad', 7, 7, 1.6);
zoneLight.position.set(4.8, 2.3, 0.8);
sets.golden.group.add(prepBoard, avoPrep.group, zoneLight);
const coffeeProc = new CoffeeProc({ mug: sets.golden.mug, latte: sets.golden.latte, parent: sets.golden.group });
setMugLevel(sets.cutre.mug, 0);

// ---------- Composición horizontal (3/4) y vertical (casi cenital) ----------
// Cada objeto tiene su sitio y aire alrededor: nada encima de la tabla salvo
// lo que se prepara en ella. [x, z, giro]
const PORTRAIT = {
  golden: {
    board: [-0.15, 0.05, 0.04], toast: [-0.3, 0.02, 0.12], knife: [0.42, 0.3, 1.25], avo: [1.38, 0.02, -1.2, 0],
    napkin: [1.2, -0.95, 0.3], mug: [1.2, -0.95, -0.6], steam: [1.2, -0.95],
    juice: [-1.15, -1.0], daisies: [0.15, -1.32], bowl: [1.0, 1.18], plant: [-1.9, -1.25],
  },
  cutre: {
    towel: [-0.15, 0.05], toast: [-0.2, 0.05], knife: [0.8, 0.35, 1.2],
    mug: [1.0, -0.95], steam: [1.0, -0.95], jar: [-1.0, -1.0, 0.5], tub: [0.9, 1.2, -0.3],
  },
};
const layout = [];
const homes = new Map();
for (const m of ['golden', 'cutre']) {
  for (const [k, o] of Object.entries(sets[m].items)) {
    const land = [o.position.x, o.position.z, o.rotation.y, o.position.y];
    const port = PORTRAIT[m][k];
    if (port) {
      const e = { o, land, port: [port[0], port[1], port[2] ?? land[2], port[3] ?? land[3]] };
      layout.push(e);
      homes.set(o, e);
    }
  }
}
let portrait = null;
function applyLayout(p) {
  if (p === portrait) return;
  portrait = p;
  for (const { o, land, port } of layout) {
    const [x, z, ry, y] = p ? port : land;
    o.position.y = y;
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
  heat: 'Mantén el dedo sobre el pan para tostarlo. Muévelo para dorarlo a tu gusto… ¡o quémalo!',
  spread: 'Unta a tu manera: despacio deja grumos, rápido una capa fina. Las vetas siguen tu dedo.',
  honey: 'Desliza para dejar caer un hilo de miel.',
  place: 'Toca para colocar y arrastra para moverlo. Puedes apilar unas cosas sobre otras.',
  orient: 'Toca para colocar y arrastra para girarla. ¿Abanico, espiral, en fila?',
  sprinkle: 'Desliza para espolvorear donde quieras.',
};
const P_ = (id, icon, label, hint, extra) => T(id, icon, label, 'proc', hint, extra);
const STATIONS = {
  golden: [
    {
      id: 'avocado', label: 'Aguacate', icon: '🥑', width: 2.3, steps: [
        { id: 'cut', label: 'Cortar', done: () => avoPrep.cut, tools: [P_('avoCut', '🔪', 'Cuchillo', 'Desliza el dedo a lo largo del aguacate para abrirlo con el cuchillo.')] },
        { id: 'open', label: 'Abrir', done: () => avoPrep.open, tools: [P_('avoOpen', '🔄', 'Girar', 'Arrastra para girar y separar las dos mitades.')] },
        { id: 'pit', label: 'Hueso', done: () => avoPrep.pitless, tools: [P_('avoPit', '🟤', 'Hueso', 'Coge el hueso con el dedo y sácalo arrastrando.')] },
        { id: 'peel', label: 'Pelar', done: () => avoPrep.peeled, tools: [P_('avoPeel', '🫳', 'Pelar', 'Pasa el dedo por la piel para pelarla tira a tira.')] },
        { id: 'slice', label: 'Laminar', done: () => false, tools: [P_('avoSliceCut', '🔪', 'Laminar', 'Desliza de lado a lado para cortar láminas. O déjalo así para machacarlo en la tostada.')] },
      ],
    },
    {
      id: 'toast', label: 'Tostada', icon: '🍞', surface: 'toast', width: 1.9, tools: [
        T('heat', '🔥', 'Tostar', 'heat', H.heat),
        T('avocado', '🥑', 'Aguacate', 'spread', 'Machaca y unta el aguacate a tu manera: despacio deja tropezones, rápido queda cremoso.',
          { lock: () => (avoPrep.peeled ? null : 'Primero prepara el aguacate en la pestaña 🥑') }),
        T('ricotta', '🤍', 'Ricotta', 'spread', H.spread),
        T('honey', '🍯', 'Miel', 'spread', H.honey),
        T('avoSlice', '🥑', 'Láminas', 'place', H.orient, {
          orient: true,
          qty: () => avoPrep.slices,
          lock: () => (avoPrep.slices > 0 ? null : 'Lamina el aguacate primero (pestaña 🥑, paso Laminar)'),
        }),
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
      id: 'coffee', label: 'Café', icon: '☕', surface: 'coffee', width: 1.7, steps: [
        { id: 'grind', label: 'Moler', done: () => coffeeProc.ground, tools: [P_('grind', '⚙️', 'Manivela', 'Gira el dedo en círculos para moler el café. Más vueltas, molienda más fina.')] },
        { id: 'brew', label: 'Colar', done: () => coffeeProc.brewed, tools: [P_('brew', '🫖', 'Hervidor', 'Mantén pulsado y vierte el agua en espiral sobre el filtro. ¡Si apuntas fuera, encharcas!')] },
        { id: 'foam', label: 'Espumar', done: () => coffeeProc.foamed, tools: [P_('foamMilk', '🥛', 'Espumar', 'Mantén pulsado para espumar la leche. Más tiempo, más espuma.')] },
        {
          id: 'art', label: 'Latte art', done: () => false, tools: [
            P_('pourMilk', '🥛', 'Verter', 'Mantén pulsado para verter. Primero se mezcla; el dibujo sale cuando la taza está casi llena. Mueve rápido para cortar… y cuidado, que se desborda.'),
            T('etch', '✏️', 'Dibujar', 'smear', 'Arrastra por la espuma para dibujar lo que quieras.'),
            T('cinnamon', '🟤', 'Canela', 'dust', 'Desliza para espolvorear canela.'),
          ],
        },
      ],
    },
    { id: 'table', label: 'Mesa', icon: '✨', tools: [], hint: 'Tu desayuno. Arrastra para mirarlo desde otro ángulo.' },
  ],
  cutre: [
    {
      id: 'toast', label: 'Tostada', icon: '🍞', surface: 'toast', width: 1.6, tools: [
        T('heat', '🔥', 'Tostar', 'heat', H.heat),
        T('butter', '🧈', 'Margarina', 'spread', 'Unta la margarina… es lo que hay.'),
      ],
    },
    {
      id: 'coffee', label: 'Café', icon: '☕', width: 1.15, tools: [
        T('instant', '🥄', 'Soluble', 'instant', 'Toca la taza: agua del grifo caliente y una cucharada de soluble. Ya está. Sin ritual.'),
      ],
    },
    { id: 'table', label: 'Mesa', icon: '✨', tools: [], hint: 'Tu desayuno. Arrastra para mirarlo desde otro ángulo.' },
  ],
};
for (const list of Object.values(STATIONS)) for (const st of list) st.stepIdx = 0;
const curStep = () => (station.steps ? station.steps[station.stepIdx] : null);
const curTools = () => (station.steps ? curStep().tools : station.tools);
function firstOpenStep(st) {
  const i = st.steps.findIndex((x) => !x.done());
  return i < 0 ? st.steps.length - 1 : i;
}

let mood = 'golden';
let station = STATIONS.golden[0];
let tool = null;
const undo = [];
const anims = [];

function focusObject() {
  const s = sets[mood];
  if (station.id === 'avocado') return avoPrep.group;
  if (station.id === 'coffee' && mood === 'golden' && curStep()?.id === 'grind') return coffeeProc.grinder;
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
  // pasos del proceso (1 Cortar · 2 Abrir · ...)
  const steps = $('steps');
  steps.innerHTML = '';
  steps.style.display = station.steps ? '' : 'none';
  if (station.steps) {
    const open = firstOpenStep(station);
    station.steps.forEach((st, i) => {
      const b = document.createElement('button');
      const done = st.done();
      b.className = 'step' + (i === station.stepIdx ? ' on' : '') + (done ? ' done' : '') + (i > open ? ' locked' : '');
      b.innerHTML = `<i>${done ? '✓' : i + 1}</i>${st.label}`;
      b.onclick = () => {
        if (i > open) return;
        station.stepIdx = i;
        tool = st.tools[0];
        renderUI();
      };
      steps.appendChild(b);
    });
  }
  tools.innerHTML = '';
  const list = curTools();
  for (const t of list) {
    const b = document.createElement('button');
    const q = t.qty ? t.qty() : shop.qty(t);
    const locked = t.lock?.();
    b.className = 'chip' + (t === tool ? ' on' : '') + (q === 0 ? ' empty' : '') + (locked ? ' locked' : '');
    b.innerHTML = `<span>${locked ? '🔒' : t.icon}</span>${t.label}${q === null || q === undefined ? '' : `<b class="qty">${q}</b>`}`;
    b.onclick = () => {
      if (locked) {
        say('Aún no', locked);
        return;
      }
      tool = t;
      renderUI();
    };
    tools.appendChild(b);
  }
  tools.style.display = list.length > 1 || (list.length && !station.steps) ? '' : 'none';
  const table = station.id === 'table';
  $('work').style.display = table ? '' : 'none';
  $('reset').style.display = table ? 'none' : '';
  hint.textContent = tool ? tool.hint : station.hint;
}

function selectStation(st) {
  station = st;
  if (st.steps) st.stepIdx = firstOpenStep(st);
  const list = curTools();
  tool = list.find((t) => !t.lock?.()) || null;
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
  } else if (station.id === 'coffee' && mood === 'golden') coffeeProc.reset();
  else if (station.id === 'coffee') setMugLevel(sets.cutre.mug, 0);
  else if (station.id === 'avocado') avoPrep.reset();
  else return;
  if (station.steps) {
    station.stepIdx = 0;
    station.steps.forEach((x) => (x.adv = false));
    selectStation(station);
  }
  shop.newDish(station.id);
  undo.length = 0;
});

// ---------- Ir a trabajar: cobra según la hora y empieza un nuevo día ----------
let day = 1;
const usedToday = new Set();
$('work').addEventListener('click', () => {
  const onTime = minutes <= 8 * 60 + 15;
  const base = onTime ? 30 : 15;
  const mimo = Math.min(20, usedToday.size * 2);
  shop.earn(base + mimo);
  say(`Día ${day} · +${base + mimo} 🪙`, `${onTime ? 'Llegaste a tiempo ☀️' : 'Llegaste tarde… 🏃'} (+${base}) · mimo +${mimo}`);
  fade.classList.add('on');
  setTimeout(() => {
    for (const s of Object.values(sets)) {
      s.toast.reset();
      s.toast.placed.clear();
      if (s.yogurt) {
        s.yogurt.reset();
        s.bowlPlaced.clear();
        s.latte.reset();
      }
    }
    avoPrep.reset();
    coffeeProc.reset();
    setMugLevel(sets.cutre.mug, 0);
    for (const list of Object.values(STATIONS))
      for (const st of list) if (st.steps) st.steps.forEach((x) => (x.adv = false));
    shop.newDish();
    undo.length = 0;
    usedToday.clear();
    day++;
    minutes = 7 * 60 + 30;
    tick();
    selectStation(STATIONS[mood][0]);
    fade.classList.remove('on');
  }, 900);
});
$('fridgeBtn').addEventListener('click', () => shop.open('fridge'));
const soundBtn = $('sound');
soundBtn.addEventListener('click', () => {
  sfx.on = !sfx.on;
  soundBtn.classList.toggle('off', !sfx.on);
  if (!sfx.on) sfx.stop();
});

const timeEl = $('time');
let minutes = 7 * 60 + 30;
function tick() {
  timeEl.textContent = `${String((minutes / 60) | 0).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  document.body.classList.toggle('late', minutes > 8 * 60 + 15);
}
setInterval(() => {
  if (minutes < 9 * 60 + 30) minutes++;
  tick();
}, 2500);
tick();

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

const ROUND = new Set(['blueberry', 'raspberry', 'tomato']);

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
  // procesos (aguacate, café) y café soluble
  if (tool && tool.type === 'proc') {
    const proc = station.id === 'avocado' ? avoPrep : coffeeProc;
    const step = curStep().id;
    if (step === 'art') undo.push(coffeeProc.snapshot());
    if (proc.down(step, e, procCtx)) {
      if (!shop.use(tool, station.id)) return;
      usedToday.add(tool.id);
      drag = { kind: 'proc', proc, step };
      return;
    }
  }
  if (tool && tool.type === 'instant') {
    const h = cast(e, [sets.cutre.mug]);
    if (h && !instantAnim) {
      if (!shop.use(tool, station.id)) return;
      instantAnim = { t: 0 };
      sfx.plop();
      return;
    }
  }
  if (tool?.lock?.()) {
    say('Aún no', tool.lock());
    return;
  }
  const info = surfaceInfo();
  if (tool && info) {
    const s = sets[mood];
    // gasta ingrediente al empezar (si toca). Sin existencias → abre la nevera.
    const pay = () => {
      const r = shop.use(tool, station.id);
      if (r) usedToday.add(tool.id);
      return r;
    };
    if (tool.type === 'heat') {
      const h = hitSurface(e, info);
      if (h) {
        undo.push(s.toast.snapshot());
        drag = { kind: 'heat', uv: h.uv.clone(), info };
        return;
      }
    } else if (tool.type === 'spread') {
      const h = hitSurface(e, info);
      if (h) {
        if (!pay()) return;
        undo.push(s.toast.snapshot());
        drag = { kind: 'spread', uv: h.uv.clone() };
        return;
      }
    } else if (tool.type === 'place') {
      // lo redondo rueda: no se apila, se apoya en la superficie
      const h = hitSurface(e, info, { withPlaced: !ROUND.has(tool.id) });
      if (h) {
        let refund;
        if (tool.id === 'avoSlice') {
          avoPrep.slices--;
          refund = () => avoPrep.slices++;
          renderUI();
        } else refund = pay();
        if (!refund) return;
        const o = placeAt(info.holder, h, tool.id);
        undo.push(() => {
          o.removeFromParent();
          refund();
        });
        sfx.plop();
        drag = { kind: tool.orient ? 'orient' : 'move', obj: o, info, start: h.point.clone() };
        return;
      }
    } else if (tool.type === 'sprinkle') {
      const h = hitSurface(e, info, { withPlaced: true });
      if (h) {
        const refund = pay();
        if (!refund) return;
        const items = [];
        undo.push(() => {
          items.forEach((o) => o.removeFromParent());
          refund();
        });
        drag = { kind: 'sprinkle', items, info, acc: 1 };
        sprinkleAt(drag, h);
        return;
      }
    } else if (['pour', 'smear', 'dust', 'drizzle'].includes(tool.type)) {
      const surf = info.kind === 'coffee' ? s.latte : s.yogurt;
      const h = hitSurface(e, info);
      if (h && surf) {
        if (!pay()) return;
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
    case 'proc':
      drag.proc.move(drag.step, e, procCtx);
      break;
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
    case 'heat': {
      const h = hitSurface(e, drag.info);
      drag.uv = h ? h.uv.clone() : null;
      break;
    }
    case 'move': {
      const h = hitSurface(e, drag.info, { withPlaced: !ROUND.has(tool.id), exclude: drag.obj });
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
const up = (e) => {
  if (drag?.kind === 'proc') drag.proc.up(drag.step, e, procCtx);
  drag = null;
  sfx.stop();
};
let instantAnim = null;
const planeHit = new THREE.Vector3();
const procCtx = {
  sfx,
  time: 0,
  cast: (e, objs) => cast(e, objs),
  chime: () => sfx.chime(),
  say: (a, b) => say(a, b),
  planePoint: (e, y) => {
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), planeHit) ? planeHit.clone() : null;
  },
  screenOf: (v) => {
    const p = v.clone().project(camera);
    return { x: ((p.x + 1) / 2) * innerWidth, y: ((1 - p.y) / 2) * innerHeight };
  },
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
      want.fov = fovFor(3.9, 9, a);
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
uiReady = true;
renderUI();
computeView();
cur.target.copy(want.target);
cur.dir.copy(want.dir);
cur.dist = want.dist;
cur.fov = want.fov;

function loop() {
  const dt = Math.min(clock.getDelta(), 0.05) * (window.__timeScale || 1);
  const time = clock.elapsedTime;
  const s = sets[mood];

  // tostar mientras se mantiene pulsado
  if (drag && drag.kind === 'heat') {
    if (drag.uv) {
      s.toast.heat(drag.uv.x, drag.uv.y, dt);
      sfx.sizzle(true);
    } else sfx.sizzle(false);
  }
  // verter mientras se mantiene pulsado (aunque el dedo no se mueva)
  if (drag && drag.kind === 'pour' && drag.uv) {
    drag.surf.pour(drag.uv, dt);
    sfx.scrape(drag.surf.full ? 0 : 0.006);
    if (drag.surf.full && !drag.warned) {
      drag.warned = true;
      say(station.id === 'coffee' ? 'La taza está llena ☕' : 'El bol está lleno 🥣', 'Ahora decora a tu gusto');
    }
  }
  procCtx.time = time;
  if (mood === 'golden') {
    const inCoffee = station.id === 'coffee';
    // la taza viaja a la zona de preparación mientras haces el café
    const e = homes.get(s.mug);
    const home = e ? (portrait ? e.port : e.land) : [s.mug.position.x, s.mug.position.z];
    const tx = inCoffee ? COFFEE_ZONE.x : home[0], tz = inCoffee ? COFFEE_ZONE.z : home[1];
    s.mug.position.x += (tx - s.mug.position.x) * Math.min(1, dt * 4);
    s.mug.position.z += (tz - s.mug.position.z) * Math.min(1, dt * 4);
    s.steam.position.set(s.mug.position.x, 0.62, s.mug.position.z);
    avoPrep.update(dt, station.id === 'avocado' ? curStep().id : null);
    coffeeProc.update(dt, inCoffee ? curStep().id : null, procCtx);
    s.items.avo.visible = avoPrep.open;
  }
  if (instantAnim) {
    instantAnim.t += dt;
    setMugLevel(sets.cutre.mug, Math.min(0.85, instantAnim.t * 1.4));
    if (instantAnim.t > 0.62) {
      instantAnim = null;
      say('Café listo ☕', 'Instantáneo… y un poco triste. Con una cafetera esto sería otra cosa');
    }
  }
  // al terminar un paso, pasa solo al siguiente
  if (station.steps) {
    const st = curStep();
    if (st.done() && !st.adv && station.stepIdx < station.steps.length - 1) {
      st.adv = true;
      st.advAt = clock.elapsedTime + 0.9;
      sfx.chime();
      renderUI();
    } else if (st.advAt && clock.elapsedTime > st.advAt && !drag) {
      st.advAt = 0;
      const next = firstOpenStep(station);
      if (next !== station.stepIdx) {
        station.stepIdx = next;
        tool = curTools()[0];
        renderUI();
      }
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
  // el vapor no tapa el latte art mientras trabajas en la taza
  s.steam.visible = station.id !== 'coffee';
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

window.__bs = {
  scene, camera, sets, applyMood, selectStation, STATIONS, shop, avoPrep, coffeeProc,
  get station() { return station; },
  settled: () => cur.target.distanceTo(want.target) < 0.01 && Math.abs(cur.fov - want.fov) < 0.1,
};
