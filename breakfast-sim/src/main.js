import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import './look.js';
import './style.css';
import { buildRoom } from './room.js';
import { Toast } from './toast.js';
import { Sfx } from './audio.js';
import { PourSurface, cremaBase, bowlBase, makeSurfaceMesh } from './pour.js';
import { makePlaced } from './ingredients.js';
import { Shop } from './shop.js';
import { AvocadoPrep } from './avocado.js';
import { CoffeeProc, setMugLevel } from './coffee.js';
import { ToasterProc } from './toaster.js';
import * as P from './props.js';
import { Physics, CANNON } from './physics.js';
import { Droplets } from './fx.js';
import { jelly, updateJelly, burst } from './juice.js';
import { Honey, LIQUIDS } from './honey.js';
import { Flow } from './spill.js';
import { noiseBump } from './textures.js';
import * as TG from './texgen.js';
import { real } from './real.js';

// ---------- Render ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
// iPhone tiene DPR 3: limitamos a 2 para ir fluidos sin perder nitidez
let dpr = Math.min(window.devicePixelRatio, 2);
renderer.setPixelRatio(dpr);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap; // sombras más sólidas y mucho más baratas
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 60);

// Rendimiento: se dibuja directo (sin pasadas de postproceso) y la resolución
// baja sola si el móvil no llega a 40 fps.
const perf = { slow: 0, t: 0 };
function adaptQuality(raw) {
  perf.t += raw;
  if (perf.t < 4) return; // los primeros segundos no cuentan (carga)
  if (raw > 1 / 40) perf.slow += raw;
  else perf.slow = Math.max(0, perf.slow - raw * 0.5);
  if (perf.slow > 1.5 && dpr > 1) {
    dpr = Math.max(1, dpr - 0.25);
    renderer.setPixelRatio(dpr);
    renderer.setSize(innerWidth, innerHeight);
    perf.slow = 0;
  }
}

const room = buildRoom(scene);
const physics = new Physics();
const droplets = new Droplets(scene);
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
  avo.scale.setScalar(0.8);
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
  // tarrito de ricotta: de aquí se carga el cuchillo
  const ricottaPot = new THREE.Group();
  {
    const pot = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.17, 0], [0.2, 0.03], [0.22, 0.2], [0.2, 0.2], [0.18, 0.05], [0, 0.05]].map(([x, y]) => new THREE.Vector2(x, y)), 40),
      new THREE.MeshStandardMaterial({ color: '#e9d2c4', roughness: 0.4 }));
    const cheese = new THREE.Mesh(new THREE.SphereGeometry(0.19, 28, 12), new THREE.MeshStandardMaterial({ color: '#fbf7ee', roughness: 0.75 }));
    cheese.scale.y = 0.35;
    cheese.position.y = 0.15;
    pot.castShadow = cheese.castShadow = true;
    ricottaPot.add(pot, cheese);
    ricottaPot.position.set(-0.95, 0, 1.15);
  }
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
  g.add(board, toast.group, avo, knife, napkin, mug, steam, bowl, juice, daisies, plant, oats, beans, hang, ricottaPot);

  // superficies "manuales"
  const latte = new PourSurface({ drawBase: cremaBase, milk: '#f8eedf', halo: '#d6ad84', push: 1, size: [5, 9], capacity: 2400 });
  const coffee = mug.userData.coffee;
  coffee.material.map = latte.texture;
  coffee.material.roughness = 0.5;
  coffee.rotation.z = 0;
  coffee.material.needsUpdate = true;
  const yogurt = new PourSurface({ drawBase: bowlBase, milk: '#fbf8f1', halo: '#e2dccf', push: 0.55, size: [10, 15], capacity: 3600, height: true });
  // superficie con relieve: el yogur a cucharadas tiene volumen
  const ysurf = new THREE.Mesh(
    new THREE.RingGeometry(0.0001, bowl.userData.surfaceR, 72, 24),
    new THREE.MeshStandardMaterial({
      map: yogurt.texture, roughness: 0.35, displacementMap: yogurt.heightTexture, displacementScale: 0.085,
      bumpMap: yogurt.heightTexture, bumpScale: 3,
    }),
  );
  ysurf.rotation.x = -Math.PI / 2;
  ysurf.receiveShadow = true;
  ysurf.castShadow = true;
  ysurf.position.y = bowl.userData.surfaceY;
  bowl.add(ysurf);
  const bowlPlaced = new THREE.Group();
  bowlPlaced.position.y = bowl.userData.surfaceY;
  bowl.add(bowlPlaced);

  sets.golden = {
    group: g, toast, steam, latte, yogurt, ysurf, coffee, mug, bowl, bowlPlaced,
    items: { board, toast: toast.group, avo, knife, napkin, mug, steam, bowl, juice, daisies, plant, ricottaPot },
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
const COFFEE_ZONE = new THREE.Vector3(6.7, 0.02, -0.3);
const prepBoard = P.makeBoard();
prepBoard.scale.setScalar(0.8);
prepBoard.position.set(4.0, 0, 0.55);
prepBoard.rotation.y = Math.PI / 2;
const avoPrep = new AvocadoPrep({ physics, debris: sets.golden.group, home: AVO_ZONE });
const zoneLight = new THREE.PointLight('#ffd9ad', 7, 7, 1.6);
zoneLight.position.set(4.8, 2.3, 0.8);
const zoneLight2 = new THREE.PointLight('#ffd9ad', 6, 7, 1.6);
zoneLight2.position.set(6.8, 2.3, 0.8);
sets.golden.group.add(prepBoard, avoPrep.holder, zoneLight, zoneLight2);
const coffeeProc = new CoffeeProc({ mug: sets.golden.mug, latte: sets.golden.latte, parent: sets.golden.group, droplets });

// tostadora en la zona de preparación (con sitio alrededor)
const toasterProc = new ToasterProc({
  parent: sets.golden.group,
  getToast: () => sets.golden.toast,
  getHome: () => {
    const e = homes.get(sets.golden.toast.group);
    const [x, z, ry] = e ? (portrait ? e.port : e.land) : [0, 0, 0];
    return { pos: new THREE.Vector3(x, sets.golden.items.board.userData.top * 0.9 + 0.005, z), ry };
  },
});
toasterProc.obj.position.set(5.3, 0, -1.0);
toasterProc.obj.scale.setScalar(1.6);

// obstáculos físicos: tablas, taza, bol, vaso… (siguen a su objeto)
physics.static(new CANNON.Box(new CANNON.Vec3(0.55, 0.035, 0.85)), 4.0, 0.032, 0.55);
{
  const it = sets.golden.items;
  physics.follow(it.board, new CANNON.Box(new CANNON.Vec3(0.92, 0.04, 0.6)), new THREE.Vector3(0, 0.035, 0));
  physics.follow(it.mug, new CANNON.Cylinder(0.38, 0.36, 0.76, 16), new THREE.Vector3(0, 0.38, 0));
  physics.follow(it.bowl, new CANNON.Cylinder(0.56, 0.3, 0.4, 16), new THREE.Vector3(0, 0.2, 0));
  physics.follow(it.ricottaPot, new CANNON.Cylinder(0.22, 0.2, 0.2, 12), new THREE.Vector3(0, 0.1, 0));
}

// naranjas y limón en la zona de preparación: para jugar (y, más adelante, exprimir)
function citrus(color, r, sy = 1) {
  const g = new THREE.Group();
  // piel escaneada de cítrico real (la naranja es la del limón con otro tono)
  const t = real('citrus', [3, 2], { diff: sy > 1 ? 'citrus' : 'orange' });
  const peel = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), new THREE.MeshStandardMaterial({
    map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, roughness: 1, normalScale: new THREE.Vector2(1.5, 1.5),
  }));
  peel.scale.y = sy;
  peel.castShadow = peel.receiveShadow = true;
  g.add(peel);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.04, 8), new THREE.MeshStandardMaterial({ color: '#6b5a2a' }));
  stem.position.y = r * sy;
  g.add(stem);
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshStandardMaterial({ color: '#4f7a3a', roughness: 0.5 }));
  leaf.scale.set(1, 0.15, 0.45);
  leaf.position.set(0.06, r * sy + 0.01, 0);
  leaf.rotation.z = 0.3;
  g.add(leaf);
  return g;
}
for (const [color, r, sy, x, z] of [['#f39a2c', 0.36, 0.95, 8.0, -1.1], ['#f6a33a', 0.33, 0.95, 8.6, -0.85], ['#f2d64a', 0.27, 1.25, 8.25, -0.25]]) {
  const o = citrus(color, r, sy);
  o.position.set(x, r * sy + 0.02, z);
  o.rotation.z = (Math.random() - 0.5) * 0.4;
  sets.golden.group.add(o);
  physics.add(o, [[new CANNON.Sphere(r * (sy > 1 ? 1.08 : 1))]], { mass: 1, home: o.position.clone() });
}
// golpes blanditos: lo ligero suena agudo, lo pesado más grave
physics.onImpact = (v, it) => {
  if (v > 12 && it.mesh.userData.tip?.key === 'juice') breakPending = true;
  hitSound(v, it);
};
const hitSound = (v, it) => sfx.plop(Math.min(1.1, v / 18), (it.body.mass < 0.2 ? 1.15 : 0.6) + Math.random() * 0.2);
physics.onRespawn = () => sfx.boing(1.3);

// ---------- Cuchillo que se carga y cuchara de yogur ----------
// Para untar: primero cargas el cuchillo en la fuente (tarrina, tarro, aguacate)
// y luego lo pasas por la tostada; la capa se va gastando.
const knifeLoad = { kind: null, amount: 0 };
const SPREAD_SRC = {
  avocado: () => sets.golden.items.avo,
  ricotta: () => sets.golden.items.ricottaPot,
  butter: () => sets.cutre.items.tub,
};
const SPREAD_COLOR = { avocado: '#9cc456', ricotta: '#fbf7ee', butter: '#f6e08f' };
const SPREAD_NAME = { avocado: 'el aguacate', ricotta: 'el tarro de ricotta', butter: 'la tarrina de margarina' };
for (const m of ['golden', 'cutre']) {
  const k = sets[m].items.knife;
  const blob = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 10), new THREE.MeshStandardMaterial({ color: '#fff', roughness: 0.45 }));
  blob.scale.set(1.3, 0.3, 0.7);
  blob.position.set(0.58, 0.04, 0);
  blob.visible = false;
  k.add(blob);
  k.userData.blob = blob;
}
function updateKnifeBlob() {
  const blob = sets[mood].items.knife.userData.blob;
  blob.visible = knifeLoad.amount > 0.02;
  if (!blob.visible) return;
  blob.material.color.set(SPREAD_COLOR[knifeLoad.kind] || '#fff');
  const a = Math.sqrt(knifeLoad.amount);
  blob.scale.set(1.3 * a + 0.2, 0.3 * a + 0.05, 0.7 * a + 0.1);
}
// el cuchillo sigue al dedo: la punta de la hoja queda bajo el dedo
// (va hacia su sitio con suavidad: ver updateKnife)
const knifeGoal = { pos: null, ry: 0, k: null };
function moveKnife(point, dir) {
  const k = sets[mood].items.knife;
  if (knifeGoal.k !== k || !knifeGoal.pos) knifeGoal.ry = k.rotation.y;
  knifeGoal.k = k;
  if (dir && dir.lengthSq() > 1e-5) knifeGoal.ry = -Math.atan2(dir.z, dir.x);
  const fwd = new THREE.Vector3(Math.cos(knifeGoal.ry), 0, -Math.sin(knifeGoal.ry));
  knifeGoal.pos = new THREE.Vector3(point.x - fwd.x * 0.6, point.y + 0.01, point.z - fwd.z * 0.6);
}
// Lo que rascas con el cuchillo queda marcado: hoyitos en la carne del aguacate
// y en la margarina; el montón de ricotta baja.
const scoopables = [];
function markScoop(mesh, dark, light) {
  mesh.userData.scoop = { dark, light, orig: null };
  scoopables.push(mesh);
}
function scoopMark(h, dx, dy) {
  const sc = h.object.userData.scoop;
  if (!sc || !h.uv) return;
  const map = h.object.material.map, img = map.image, x = img.getContext('2d');
  if (!sc.orig) sc.orig = x.getImageData(0, 0, img.width, img.height);
  const r = img.width * 0.05;
  x.save();
  x.translate(h.uv.x * img.width, (1 - h.uv.y) * img.height);
  x.rotate(Math.atan2(dy, dx));
  x.globalAlpha = 0.3;
  x.fillStyle = sc.dark;
  x.beginPath();
  x.ellipse(0, 0, r * 1.3, r * 0.7, 0, 0, 7);
  x.fill();
  x.globalAlpha = 0.5;
  x.strokeStyle = sc.light;
  x.lineWidth = r * 0.2;
  x.beginPath();
  x.arc(0, r * 0.15, r * 0.9, Math.PI * 1.1, Math.PI * 1.9);
  x.stroke();
  x.restore();
  map.needsUpdate = true;
}
{
  const g = sets.golden.items, c = sets.cutre.items;
  markScoop(g.avo.children[0].children[1], '#8fb04c', '#fbf7c4');
  // la tarrina se abre al usarla y deja ver la margarina
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const cx = cv.getContext('2d');
  cx.fillStyle = '#f6e08f';
  cx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  const marg = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.36), new THREE.MeshStandardMaterial({ map: t, roughness: 0.35 }));
  marg.rotation.x = -Math.PI / 2;
  marg.position.y = 0.222;
  c.tub.add(marg);
  markScoop(marg, '#dcc260', '#fff6c8');
  c.tub.userData.lid = c.tub.children[1];
}
function resetScoops() {
  for (const m of scoopables) {
    const sc = m.userData.scoop;
    if (sc.orig) {
      m.material.map.image.getContext('2d').putImageData(sc.orig, 0, 0);
      m.material.map.needsUpdate = true;
    }
  }
  sets.golden.items.ricottaPot.children[1].scale.y = 0.35;
  const tub = sets.cutre.items.tub;
  tub.userData.open = false;
  tub.userData.lid.position.set(0, 0.24, 0);
  tub.userData.lid.rotation.set(0, 0, 0);
}
function updateKnife(dt) {
  // tapa de la tarrina: se aparta al abrirla
  const tub = sets.cutre.items.tub, lid = tub.userData.lid;
  if (tub.userData.open) {
    lid.position.lerp(new THREE.Vector3(0.62, 0.02, 0.12), Math.min(1, dt * 7));
    lid.rotation.y += (0.5 - lid.rotation.y) * Math.min(1, dt * 7);
  }
  const k = knifeGoal.k;
  if (!k || !knifeGoal.pos) return;
  // al rascar, la hoja se inclina y se hunde un poco
  k.rotation.z += ((knifeGoal.tilt || 0) - k.rotation.z) * Math.min(1, dt * 12);
  k.position.lerp(knifeGoal.pos, 1 - Math.exp(-dt * 20));
  const d = ((knifeGoal.ry - k.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  k.rotation.y += d * (1 - Math.exp(-dt * 12));
}

// tarro de yogur para verter (origen en el borde por donde cae)
const yogPot = new THREE.Group();
{
  const body = new THREE.Group();
  const cer = new THREE.MeshStandardMaterial({ color: '#f5efe6', roughness: 0.6 });
  const pot = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.16, 0], [0.19, 0.02], [0.21, 0.32], [0.2, 0.33], [0.185, 0.04], [0, 0.04]].map(([x, y]) => new THREE.Vector2(x, y)), 36), cer);
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.207, 0.2, 0.12, 36, 1, true), new THREE.MeshStandardMaterial({ color: '#a9c4d8', roughness: 0.7 }));
  label.position.y = 0.16;
  const fill = new THREE.Mesh(new THREE.CircleGeometry(0.19, 28), new THREE.MeshStandardMaterial({ color: '#fbf8f1', roughness: 0.4 }));
  fill.rotation.x = -Math.PI / 2;
  fill.position.y = 0.28;
  body.add(pot, label, fill);
  yogPot.userData = { label, fill };
  body.position.set(-0.2, -0.32, 0);
  yogPot.add(body);
  yogPot.traverse((c) => c.isMesh && (c.castShadow = true));
  yogPot.visible = false;
  scene.add(yogPot);
}
const ACAI = { c: ['#6a2c70', '#7a3582', '#5c2463'], h: '#47194d' };
const yogStream = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 1, 12, 1, true), new THREE.MeshStandardMaterial({ color: '#fbf8f1', roughness: 0.4 }));
yogStream.visible = false;
scene.add(yogStream);

// el bol también rebosa: el yogur sube por encima del borde, gotea por fuera y
// forma un charco en la encimera
const bowlOver = (() => {
  const mat = new THREE.MeshStandardMaterial({ color: '#fbf8f1', roughness: 0.35 });
  const drips = [0.4, 1.7, 2.9, 4.3, 5.4].map((a) => {
    const m = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    m.userData.a = a;
    m.castShadow = true;
    m.visible = false;
    sets.golden.bowl.add(m);
    return m;
  });
  const blob = new THREE.Shape();
  for (let i = 0; i <= 40; i++) {
    const t = (i / 40) * Math.PI * 2, r = 1 + 0.18 * Math.sin(3 * t) + 0.1 * Math.sin(7 * t + 1);
    i ? blob.lineTo(Math.cos(t) * r, Math.sin(t) * r) : blob.moveTo(Math.cos(t) * r, Math.sin(t) * r);
  }
  const puddle = new THREE.Mesh(new THREE.ShapeGeometry(blob, 40), mat);
  puddle.rotation.x = -Math.PI / 2;
  puddle.position.y = 0.012;
  puddle.visible = false;
  sets.golden.bowl.add(puddle);
  // perfil exterior del bol, del borde hacia abajo
  const OUT = [[0.555, 0.39], [0.55, 0.38], [0.46, 0.2], [0.29, 0.02], [0.25, 0.0]];
  return function update(over) {
    const ys = sets.golden.ysurf;
    const f = Math.min(1, over / 1500);
    ys.material.displacementScale = 0.085 + f * 0.12; // el montón sube por encima del borde
    drips.forEach((m, i) => {
      const g = Math.min(1, Math.max(0, (over - 150 - i * 140) / 700));
      m.visible = g > 0.02;
      if (!m.visible) return;
      const yEnd = 0.39 - 0.39 * g, pts = [];
      for (let k = 0; k < OUT.length; k++) {
        const [r, y] = OUT[k];
        if (y >= yEnd) pts.push(new THREE.Vector2(r + 0.012, y));
        else {
          const [r0, y0] = OUT[k - 1], t = (y0 - yEnd) / (y0 - y);
          pts.push(new THREE.Vector2(r0 + (r - r0) * t + 0.012, yEnd));
          break;
        }
      }
      pts.reverse();
      const w = 0.12 + 0.2 * g;
      m.geometry.dispose();
      m.geometry = new THREE.LatheGeometry(pts, 6, m.userData.a - w / 2, w);
    });
    const pr = Math.max(0, over - 700);
    puddle.visible = pr > 0;
    puddle.scale.setScalar(0.42 + Math.min(0.26, pr / 4000));
  };
})();

// ---------- Miel ----------
const honey = new Honey(scene);
const oil = new Honey(scene, LIQUIDS.oil);
const liquidOf = (t) => (t?.liq === 'oil' ? oil : honey);
let honeySess = null;
const honeyPools = [];
const DOWN = new THREE.Vector3(0, -1, 0);
function surfTopY(info) {
  const s = sets[mood], v = new THREE.Vector3();
  return info.kind === 'toast' ? s.toast.group.getWorldPosition(v).y + s.toast.topY : s.ysurf.getWorldPosition(v).y + 0.03;
}
// dónde cae la miel: en la tostada, en el yogur… o fuera (mancha la tabla o la encimera)
function honeyDeposit(a, b, w) {
  const hs = honeySess, s = sets[mood];
  if (!hs) return;
  ray.set(new THREE.Vector3(b.x, b.y + 1, b.z), DOWN);
  const h = ray.intersectObject(hs.info.surface, false)[0];
  if (h && h.uv && (hs.info.kind !== 'toast' || h.face.normal.y > 0.5)) {
    const uv = h.uv.clone();
    const prev = hs.prevUV && hs.prevUV.distanceTo(uv) < 0.15 ? hs.prevUV : uv;
    const isOil = hs.L.kind === 'oil';
    if (hs.info.kind === 'toast') s.toast.paint(prev.x, prev.y, uv.x, uv.y, hs.L.kind, w * 1.7);
    else s.yogurt.drizzle(prev, uv, isOil ? 'rgba(196,178,52,0.7)' : undefined, 5 * w + 1.5);
    hs.prevUV = uv;
    if (clock.elapsedTime - (hs.poolAt || 0) > 0.05) {
      hs.poolAt = clock.elapsedTime;
      honeyPools.push({ kind: hs.info.kind, uv, age: 0, oil: isOil });
    }
    return h.point.y;
  }
  hs.prevUV = null;
  const below = ray.intersectObjects([s.items.board || s.items.towel, s.bowl].filter(Boolean), true)[0];
  const y = below ? below.point.y + 0.004 : 0.012;
  hs.L.spill(b, y);
  return y;
}

const spoonGoal = { pos: null };
const spoon = new THREE.Group();
{
  const wood = new THREE.MeshStandardMaterial({ color: '#c9a27a', roughness: 0.55 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 12), wood);
  head.scale.set(1, 0.35, 1.4);
  const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.6, 4, 10), wood);
  handle.rotation.x = Math.PI / 2 - 0.35;
  handle.position.set(0, 0.12, 0.42);
  const load = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 10), new THREE.MeshStandardMaterial({ color: '#fbf8f1', roughness: 0.4 }));
  load.scale.set(1, 0.6, 1.2);
  load.position.y = 0.04;
  spoon.add(head, handle, load);
  spoon.userData.load = load;
  spoon.traverse((c) => c.isMesh && (c.castShadow = true));
  spoon.visible = false;
  scene.add(spoon);
}
setMugLevel(sets.cutre.mug, 0);

// ---------- Composición horizontal (3/4) y vertical (casi cenital) ----------
// Cada objeto tiene su sitio y aire alrededor: nada encima de la tabla salvo
// lo que se prepara en ella. [x, z, giro]
const PORTRAIT = {
  golden: {
    board: [-0.15, 0.05, 0.04], toast: [-0.45, 0.06, 0.12], knife: [-0.1, -0.44, 0.04], avo: [0.5, -0.38, -Math.PI / 2, 0.072],
    napkin: [1.2, -0.95, 0.3], mug: [1.2, -0.95, -0.6], steam: [1.2, -0.95],
    juice: [-1.15, -1.0], daisies: [0.15, -1.32], bowl: [1.0, 1.18], plant: [-1.9, -1.25], ricottaPot: [-0.95, 1.0],
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
    const it = o.userData.phys;
    if (it) {
      it.body.position.set(x, y, z);
      it.body.quaternion.setFromEuler(0, ry, 0);
      it.body.velocity.set(0, 0, 0);
      it.body.angularVelocity.set(0, 0, 0);
      it.home.set(x, y, z);
      it.body.wakeUp();
    }
  }
}

// ---------- Cosas que se pueden volcar sin querer ----------
// El vaso de zumo y el jarrón son objetos sueltos: un golpe (del dedo, del
// cuchillo, de algo que lances) los tumba. Al recogerlos quedan de pie.
const tippables = [];
function makeTippable(key, h, shape, mass, onSpill) {
  const items = sets.golden.items, o = items[key];
  const holder = new THREE.Group();
  holder.position.copy(o.position);
  holder.position.y += h;
  holder.rotation.y = o.rotation.y;
  o.parent.add(holder);
  holder.add(o);
  o.position.set(0, -h, 0);
  o.rotation.y = 0;
  const e = homes.get(o);
  if (e) {
    e.o = holder;
    e.land[3] += h;
    e.port[3] += h;
    homes.set(holder, e);
  }
  items[key] = holder;
  const it = physics.add(holder, [[shape]], { mass, home: holder.position.clone(), angularDamping: 0.35 });
  const t = { key, holder, inner: o, it, tipped: false, onSpill };
  holder.userData.tip = t;
  tippables.push(t);
  return t;
}
// zumo derramado: corre por la encimera hacia donde se vuelca el vaso
const juiceFlow = new Flow(sets.golden.group, '#f6a43a');
juiceFlow.onDrip = (q) => droplets.splash(new THREE.Vector3(q.x, 0, 1.7), '#f6a43a', 1, 0.3, -3);
function spillJuice(t, all = false) {
  if (t.empty) return;
  t.empty = true;
  t.inner.children[1].visible = false; // el zumo ya no está en el vaso…
  const p = t.holder.position;
  const d = new THREE.Vector3(0, 1, 0).applyQuaternion(t.holder.quaternion).setY(0);
  if (all || d.lengthSq() < 0.01) {
    // roto o de pie: se desparrama en todas direcciones
    for (let i = 0; i < 6; i++) juiceFlow.pour(p, new THREE.Vector3(Math.cos(i), 0, Math.sin(i)), 14, 1.6, 0.3, 0.6);
  } else {
    d.normalize();
    // …sale por la boca del vaso y corre por la encimera
    juiceFlow.pour({ x: p.x + d.x * 0.4, z: p.z + d.z * 0.4 }, d, 90, 3.0, 0.9, 0.5);
  }
  droplets.splash(new THREE.Vector3(p.x, 0.2, p.z), '#f6a43a', 14, 2.2, 0.02);
}
const juiceTip = makeTippable('juice', 0.44, new CANNON.Cylinder(0.26, 0.22, 0.86, 12), 0.5, (t) => {
  if (t.empty || t.broken) return;
  spillJuice(t);
  sfx.plop(1.2, 0.5);
  say('¡Ups! 🍊', 'Se ha volcado el zumo. Mantén el dedo encima para recogerlo');
});
// un golpe fuerte rompe el vaso
const shardMat = new THREE.MeshStandardMaterial({ color: '#e8f6fb', roughness: 0.05, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
shardMat.defines = { NO_MATTE: '' };
const shards = [];
let breakPending = false;
function breakGlass() {
  const t = juiceTip;
  if (t.broken) return;
  t.broken = true;
  const p = t.holder.position.clone();
  spillJuice(t, true);
  t.holder.visible = false;
  t.it.grabbable = false;
  t.it.body.collisionResponse = false;
  t.it.body.type = CANNON.Body.STATIC;
  for (let i = 0; i < 11; i++) {
    const sh = new THREE.Shape();
    const w = 0.06 + Math.random() * 0.1, h = 0.1 + Math.random() * 0.16;
    sh.moveTo(-w / 2, 0);
    sh.lineTo(w / 2, Math.random() * 0.04);
    sh.lineTo((Math.random() - 0.5) * w, h);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), shardMat);
    m.castShadow = true;
    const a = (i / 11) * Math.PI * 2;
    m.position.set(p.x + Math.cos(a) * 0.12, Math.max(0.15, p.y) + Math.random() * 0.3, p.z + Math.sin(a) * 0.12);
    m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    sets.golden.group.add(m);
    const it = physics.add(m, [[new CANNON.Box(new CANNON.Vec3(w / 2, 0.012, h / 2))]], { mass: 0.03, grabbable: false, home: null, angularDamping: 0.5 });
    it.body.velocity.set(Math.cos(a) * (2 + Math.random() * 4), 2 + Math.random() * 4, Math.sin(a) * (2 + Math.random() * 4));
    it.body.angularVelocity.set(Math.random() * 12 - 6, Math.random() * 12 - 6, Math.random() * 12 - 6);
    shards.push(it);
  }
  sfx.crash();
  say('¡Crash! 🫣', 'Se ha roto el vaso. Mañana habrá uno nuevo');
}
makeTippable('daisies', 0.25, new CANNON.Cylinder(0.12, 0.17, 0.5, 12), 0.35, () => {
  sfx.plop(1, 0.8);
  say('¡Ay, las flores! 🌼', 'Mantén el dedo encima para ponerlas de pie');
});
function resetTippables() {
  for (const t of tippables) {
    const b = t.it.body, h = t.it.home;
    b.position.set(h.x, h.y, h.z);
    b.quaternion.setFromEuler(0, t.holder.rotation.y, 0);
    b.velocity.set(0, 0, 0);
    b.angularVelocity.set(0, 0, 0);
    t.tipped = false;
    t.empty = false;
  }
  juiceTip.inner.children[1].visible = true;
  juiceFlow.clear();
  for (const it of shards) {
    physics.remove(it);
    it.mesh.removeFromParent();
  }
  shards.length = 0;
  if (juiceTip.broken) {
    juiceTip.broken = false;
    juiceTip.holder.visible = true;
    juiceTip.it.grabbable = true;
    juiceTip.it.body.collisionResponse = true;
    juiceTip.it.body.type = CANNON.Body.DYNAMIC;
  }
}
const tipUp = new THREE.Vector3();
function updateTippables(dt) {
  for (const t of tippables) {
    const tip = tipUp.set(0, 1, 0).applyQuaternion(t.holder.quaternion).y < 0.5;
    if (tip && !t.tipped) {
      t.tipped = true;
      t.onSpill?.(t);
    } else if (!tip && !t.it.held) t.tipped = false;
  }
  juiceFlow.update(dt);
  // los cambios en el mundo físico se hacen fuera del paso de simulación
  if (breakPending) {
    breakPending = false;
    breakGlass();
  }
}
// el dedo (o el utensilio que llevas) ocupa sitio en el mundo
const fingerBody = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC, material: physics.mat });
fingerBody.addShape(new CANNON.Sphere(0.14));
fingerBody.allowSleep = false; // si se duerme, deja de moverse y no empuja nada
fingerBody.position.set(0, -50, 0);
physics.world.addBody(fingerBody);
let fingerGoal = null;
function updateFinger(dt) {
  const p = fingerBody.position;
  if (!fingerGoal) {
    fingerBody.velocity.set(0, 0, 0);
    p.set(0, -50, 0);
  } else if (p.y < -10) p.set(fingerGoal.x, fingerGoal.y, fingerGoal.z);
  else {
    const k = 1 / Math.max(dt, 0.016), c = (v) => Math.max(-12, Math.min(12, v));
    fingerBody.velocity.set(c((fingerGoal.x - p.x) * k), 0, c((fingerGoal.z - p.z) * k));
    fingerBody.wakeUp();
    // lo que está en reposo "duerme": se despierta si el dedo pasa cerca
    for (const it of physics.items) {
      const q = it.body.position;
      if (Math.abs(q.x - p.x) < 0.7 && Math.abs(q.z - p.z) < 0.7) it.body.wakeUp();
    }
  }
}

// ---------- Estaciones y herramientas ----------
// Cada estación es una "manualidad" con herramientas libres. No hay resultado
// correcto: tú decides cuándo está listo.
const T = (id, icon, label, type, hint, extra = {}) => ({ id, icon, label, type, hint, ...extra });
const H = {
  heat: 'Mantén el dedo sobre el pan para tostarlo. Muévelo para dorarlo a tu gusto… ¡o quémalo!',
  spread: 'Unta a tu manera: despacio deja grumos, rápido una capa fina. Las vetas siguen tu dedo.',
  oil: 'Mantén pulsado para echar un chorrito de aceite de oliva: cae fino, se corta rápido y empapa el pan.',
  honey: 'Mantén pulsado y mueve: la miel cae en hilo, con retraso. Quieto se enrosca; rápido se afina. Ojo, que fuera mancha.',
  place: 'Toca para colocar y arrastra para moverlo. Puedes apilar unas cosas sobre otras.',
  orient: 'Toca para colocar y arrastra para girarla. ¿Abanico, espiral, en fila?',
  sprinkle: 'Desliza para espolvorear donde quieras.',
};
const P_ = (id, icon, label, hint, extra) => T(id, icon, label, 'proc', hint, extra);
// todo lo que se coloca o espolvorea vale en cualquier plato: sin límites
const TOPPINGS = [
  T('avoSlice', '🥑', 'Láminas', 'place', H.orient, {
    orient: true,
    qty: () => avoPrep.slices,
    lock: () => (avoPrep.slices > 0 ? null : 'Lamina el aguacate primero (pestaña 🥑, paso Laminar)'),
  }),
  T('egg', '🥚', 'Huevo', 'place', H.place),
  T('blueberry', '🫐', 'Arándanos', 'place', H.place),
  T('raspberry', '🍓', 'Frambuesa', 'place', H.place),
  T('strawberry', '🍓', 'Fresa', 'place', H.orient, { orient: true }),
  T('banana', '🍌', 'Plátano', 'place', H.place),
  T('radish', '🌸', 'Rabanito', 'place', H.place),
  T('tomato', '🍅', 'Cherry', 'place', H.place),
  T('sprouts', '🌱', 'Brotes', 'place', H.place),
  T('mint', '🌿', 'Menta', 'place', H.orient, { orient: true }),
  T('granola', '🥣', 'Granola', 'sprinkle', H.sprinkle),
  T('coco', '🥥', 'Coco', 'sprinkle', H.sprinkle),
  T('chili', '🌶️', 'Chile', 'sprinkle', H.sprinkle),
  T('sesame', '✨', 'Sésamo', 'sprinkle', H.sprinkle),
];
const STATIONS = {
  golden: [
    {
      id: 'avocado', label: 'Aguacate', icon: '🥑', width: 2.3, steps: [
        { id: 'cut', label: 'Cortar', done: () => avoPrep.cut, tools: [P_('avoCut', '🔪', 'Cuchillo', 'Desliza el dedo a lo largo del aguacate para abrirlo con el cuchillo.')] },
        { id: 'open', label: 'Abrir', done: () => avoPrep.open, tools: [P_('avoOpen', '🔄', 'Girar', 'Arrastra para girar y separar las dos mitades.')] },
        { id: 'pit', label: 'Hueso', done: () => avoPrep.pitless, tools: [P_('avoPit', '🟤', 'Hueso', 'Coge el hueso con el dedo y sácalo arrastrando.')] },
        { id: 'peel', label: 'Pelar', done: () => avoPrep.peeled, tools: [P_('avoPeel', '🫳', 'Pelar', 'Pon el dedo en la piel y tira: se pela por donde lo pases. Despacio sale una tira ancha; deprisa, fina. Un tirón brusco la rompe.')] },
        { id: 'slice', label: 'Laminar', done: () => false, tools: [P_('avoSliceCut', '🔪', 'Laminar', 'Desliza de lado a lado para cortar láminas. O déjalo así para machacarlo en la tostada.')] },
      ],
    },
    {
      id: 'toast', label: 'Tostada', icon: '🍞', surface: 'toast', width: 2.6, steps: [
        {
          id: 'toaster', label: 'Tostar', done: () => toasterProc.done, tools: [
            P_('toasterUse', '🍞', 'Tostadora', 'Toca para meter el pan. Arrastra hacia abajo para bajar la palanca. Toca otra vez para que salte cuando te guste.'),
            T('noToast', '⏭️', 'Sin tostar', 'skip', 'Pasar sin tostar.', { run: () => (toasterProc.state = 'skipped') }),
          ],
        },
        {
          id: 'dress', label: 'Preparar', done: () => false, tools: [
        T('avocado', '🥑', 'Aguacate', 'spread', 'Carga el cuchillo en el medio aguacate y úntalo: despacio deja tropezones, rápido queda cremoso.',
          { lock: () => (avoPrep.peeled ? null : 'Primero prepara el aguacate en la pestaña 🥑') }),
        T('ricotta', '🤍', 'Ricotta', 'spread', 'Carga el cuchillo en el tarro de ricotta y úntala a tu manera.'),
        T('honey', '🍯', 'Miel', 'honeydrip', H.honey),
        T('oil', '🫒', 'Aceite', 'honeydrip', H.oil, { liq: 'oil' }),
        T('yogurtPourT', '🫙', 'Yogur', 'jarpour', 'Mantén pulsado para echar yogur del tarro encima. Sí, en la tostada también.'),
        ...TOPPINGS,
      ],
        },
      ],
    },
    {
      id: 'bowl', label: 'Bol', icon: '🥣', surface: 'bowl', width: 1.7, tools: [
        T('yogurtPour', '🫙', 'Yogur', 'jarpour', 'Mantén pulsado para verter el yogur del tarro: cae espeso y se va plegando. Muévete para repartirlo.'),
        T('spoonSwirl', '🥄', 'Cuchara', 'spoon', 'Arrastra la cuchara por el yogur para removerlo, extenderlo y dibujar remolinos.'),
        T('acaiPour', '🍇', 'Açaí', 'jarpour', 'Mantén pulsado para servir el açaí: un batido morado y espeso. Luego decóralo en filas, como en las fotos.', { col: 'acai' }),
        T('drizzle', '🍯', 'Miel', 'honeydrip', H.honey),
        T('oilBowl', '🫒', 'Aceite', 'honeydrip', H.oil, { liq: 'oil' }),
        ...TOPPINGS,
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
    { id: 'table', label: 'Mesa', icon: '✨', tools: [], hint: 'Toca lo que quieras preparar. Cuando esté a tu gusto, a trabajar.' },
  ],
  cutre: [
    {
      id: 'toast', label: 'Tostada', icon: '🍞', surface: 'toast', width: 1.6, tools: [
        T('heat', '🔥', 'Tostar', 'heat', H.heat),
        T('butter', '🧈', 'Margarina', 'spread', 'Carga el cuchillo en la tarrina y unta la margarina… es lo que hay.'),
      ],
    },
    {
      id: 'coffee', label: 'Café', icon: '☕', width: 1.15, tools: [
        T('instant', '🥄', 'Soluble', 'instant', 'Toca la taza: agua del grifo caliente y una cucharada de soluble. Ya está. Sin ritual.'),
      ],
    },
    { id: 'table', label: 'Mesa', icon: '✨', tools: [], hint: 'Toca lo que quieras preparar. Cuando esté a tu gusto, a trabajar.' },
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
  if (station.id === 'avocado') return prepBoard; // cámara fija aunque lances el aguacate
  if (station.id === 'toast' && mood === 'golden' && curStep()?.id === 'toaster') return toasterProc.obj;
  if (station.id === 'coffee' && mood === 'golden' && curStep()?.id === 'grind') return coffeeProc.grinder;
  return { toast: s.toast.group, bowl: s.bowl, coffee: s.mug }[station.id];
}

// ---------- UI ----------
const $ = (id) => document.getElementById(id);
const hint = $('hint'), tools = $('tools'), fade = $('fade'), msg = $('msg');
// la pista sale en un globo junto a Tosti y se esconde sola: no tapa el juego
let hintTimer;
function showHint(text, ms = 5000) {
  if (text !== undefined) hint.textContent = text;
  $('bubble').classList.add('show');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => $('bubble').classList.remove('show'), ms);
}
const sfx = new Sfx();

function renderUI() {
  // pasos del proceso: puntitos + nombre del paso
  const steps = $('steps');
  steps.innerHTML = station.steps
    ? station.steps.map((st, i) => `<i class="${i === station.stepIdx ? 'on' : st.done() ? 'done' : ''}"></i>`).join('') + `<em>${curStep().label}</em>`
    : '';
  tools.innerHTML = '';
  const list = curTools();
  for (const t of list) {
    const b = document.createElement('button');
    const q = t.qty ? t.qty() : shop.qty(t);
    const locked = t.lock?.();
    b.className = 'chip' + (t === tool ? ' on' : '') + (q === 0 ? ' empty' : '') + (locked ? ' locked' : '');
    b.innerHTML = `<span>${locked ? '🔒' : t.icon}</span><em>${t.label}</em>${q === null || q === undefined ? '' : `<b class="qty">${q}</b>`}`;
    b.onclick = () => {
      if (locked) {
        say('Aún no', locked);
        return;
      }
      if (t.type === 'skip') {
        t.run();
        renderUI();
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
  const text = tool ? tool.hint : station.hint;
  if (text !== hint.textContent || steps.innerHTML !== renderUI.lastSteps) showHint(text);
  renderUI.lastSteps = steps.innerHTML;
  if (uiReady) renderNav();
  ghostSoon();
}

// ---------- Manita guía: enseña el gesto que toca, sobre el objeto ----------
// Aparece al llegar a un paso o al cambiar de herramienta, y vuelve si llevas
// un rato sin tocar nada.
const GESTURE = {
  avoCut: 'swipeH', avoOpen: 'dragDown', avoPit: 'dragUp', avoPeel: 'dragUp', avoSliceCut: 'swipeV',
  grind: 'circle', brew: 'holdCircle', foamMilk: 'hold', pourMilk: 'hold', instant: 'tap',
};
function gestureFor(t) {
  if (!t) return null;
  if (t.id === 'toasterUse') return toasterProc.state === 'in' ? 'dragDown' : toasterProc.done ? null : 'tap';
  if (GESTURE[t.id]) return GESTURE[t.id];
  return { spread: 'zigzag', heat: 'hold', place: 'tap', sprinkle: 'swipeH', jarpour: 'hold', honeydrip: 'hold', spoon: 'zigzag', smear: 'swipeV', dust: 'swipeH', drizzle: 'zigzag' }[t.type] || null;
}
const GESTURE_TXT = {
  swipeH: 'Desliza', swipeV: 'Desliza', dragDown: 'Arrastra', dragUp: 'Tira', zigzag: 'Unta',
  circle: 'Gira', holdCircle: 'Mantén y gira', hold: 'Mantén pulsado', tap: 'Toca',
};
const ghost = { el: null, kind: null, t: 0, wait: 0.8, idle: 0, cycles: 0 };
function ghostFor(kind) {
  ghost.kind = kind;
  $('ghostTxt').textContent = (tool?.type === 'spoon' && kind ? 'Remueve' : GESTURE_TXT[kind]) || '';
  ghost.t = 0;
  ghost.cycles = 0;
}
function ghostSoon() {
  ghost.wait = 1.0;
  ghost.kind = null;
}
function ghostPath(kind, t) {
  // t en [0,1): devuelve desplazamiento en px, escala y opacidad
  const s = Math.sin(t * Math.PI), e = t < 0.15 ? t / 0.15 : t > 0.85 ? (1 - t) / 0.15 : 1;
  switch (kind) {
    case 'swipeH': return { x: -70 + 140 * t, y: 0, k: 1, o: e };
    case 'swipeV': return { x: 0, y: -55 + 110 * t, k: 1, o: e };
    case 'dragDown': return { x: 0, y: -40 + 100 * t, k: 1, o: e };
    case 'dragUp': return { x: 10, y: 30 - 100 * t, k: 1, o: e };
    case 'zigzag': return { x: -60 + 120 * t, y: Math.sin(t * Math.PI * 4) * 28, k: 1, o: e };
    case 'circle': return { x: Math.cos(t * Math.PI * 4) * 45, y: Math.sin(t * Math.PI * 4) * 45, k: 1, o: e };
    case 'holdCircle': return { x: Math.cos(t * Math.PI * 2) * 22, y: Math.sin(t * Math.PI * 2) * 22, k: 0.88, o: e };
    case 'hold': return { x: 0, y: 0, k: 0.82 + 0.08 * Math.cos(t * Math.PI * 6), o: e };
    case 'tap': return { x: 0, y: -12 * s * (t < 0.5 ? 1 : 0), k: t > 0.45 && t < 0.6 ? 0.8 : 1, o: e };
    default: return { x: 0, y: 0, k: 1, o: 0 };
  }
}
function ghostAnchor() {
  let o = focusObject();
  if (tool?.type === 'spread' && station.id === 'toast') o = sets[mood].toast.group;
  if (tool?.id === 'avoPit') o = avoPrep.A.pit;
  if (!o) return null;
  const v = o.getWorldPosition(new THREE.Vector3());
  v.y += 0.35;
  v.project(camera);
  return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight };
}
function updateGhost(dt) {
  const el = $('ghost');
  ghost.idle += dt;
  if (ghost.wait > 0) {
    ghost.wait -= dt;
    if (ghost.wait <= 0 && !tween) ghostFor(gestureFor(tool));
    else if (ghost.wait <= 0) ghost.wait = 0.3;
  }
  // si llevas un rato sin tocar nada, te lo vuelve a enseñar
  if (!ghost.kind && ghost.idle > 7 && !drag) {
    ghost.idle = 0;
    ghostFor(gestureFor(tool));
  }
  const a = ghost.kind && !drag ? ghostAnchor() : null;
  if (!a) {
    el.style.opacity = 0;
    return;
  }
  ghost.t += dt / 1.6;
  if (ghost.t >= 1) {
    ghost.t = 0;
    if (++ghost.cycles >= 2) ghost.kind = null;
  }
  const g = ghostPath(ghost.kind, ghost.t);
  el.style.opacity = g.o * 0.95;
  el.style.transform = `translate(${a.x + g.x - 12}px, ${a.y + g.y - 6}px) scale(${g.k})`;
}

// ---------- Navegación: flechas ‹ ›, deslizar y "dónde estoy" ----------
function stationIndex() {
  return STATIONS[mood].indexOf(station);
}
function navigate(dir) {
  const list = STATIONS[mood], i = stationIndex() + dir;
  if (i < 0 || i >= list.length) return;
  selectStation(list[i]);
  sfx.plop(0.5, 1.5);
}
// En la mesa, cada cosa lleva su etiqueta: tocas lo que quieras preparar
const tableStation = () => STATIONS[mood].find((st) => st.id === 'table');
function hubAnchor(st) {
  const s = sets[mood];
  return { avocado: s.items.avo, toast: s.toast.group, bowl: s.bowl, coffee: s.mug }[st.id];
}
function renderHub() {
  const hub = $('hub');
  hub.innerHTML = '';
  for (const st of STATIONS[mood]) {
    if (st.id === 'table') continue;
    const b = document.createElement('button');
    b.className = 'hubtag';
    b.innerHTML = `<span>${st.icon}</span>${st.label}`;
    b.onclick = () => {
      selectStation(st);
      sfx.plop(0.5, 1.5);
    };
    b._st = st;
    hub.appendChild(b);
  }
}
const hubV = new THREE.Vector3();
function updateHub() {
  const hub = $('hub'), show = station.id === 'table' && !tween;
  hub.classList.toggle('on', show);
  if (!show) return;
  for (const b of hub.children) {
    const o = hubAnchor(b._st);
    o.getWorldPosition(hubV);
    hubV.y += b._st.id === 'avocado' ? 0.75 : b._st.id === 'toast' ? 0.3 : 0.95;
    hubV.project(camera);
    const x = THREE.MathUtils.clamp(((hubV.x + 1) / 2) * innerWidth, 64, innerWidth - 64);
    const y = THREE.MathUtils.clamp(((1 - hubV.y) / 2) * innerHeight, 170, innerHeight - 250);
    b.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
  }
}

function renderNav() {
  $('homeBtn').hidden = station.id === 'table';
}

function selectStation(st) {
  station = st;
  ghostFor(null);
  if (st.steps) st.stepIdx = firstOpenStep(st);
  const list = curTools();
  tool = list.find((t) => !t.lock?.()) || null;
  renderUI();
  renderNav();
  ghostSoon();
}

function applyMood(m) {
  mood = m;
  knifeGoal.pos = null;
  room.setMood(m, renderer);
  sets.golden.group.visible = m === 'golden';
  sets.cutre.group.visible = m === 'cutre';
  document.body.dataset.mood = m;
  document.querySelectorAll('#mood button').forEach((b) => b.classList.toggle('on', b.dataset.mood === m));
  undo.length = 0;
  renderHub();
  selectStation(tableStation());
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
    if (mood === 'golden') {
      toasterProc.reset();
      const h = toasterProc.getHome();
      s.toast.group.position.copy(h.pos);
      s.toast.group.rotation.set(0, h.ry, 0);
    }
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
  {
    const r = $('work').getBoundingClientRect();
    burst(r.left + r.width / 2, r.top, ['🪙', '✨', '💛'], 10);
  }
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
    toasterProc.reset();
    resetTippables();
    resetScoops();
    honey.spills.clear();
    oil.spills.clear();
    {
      const h = toasterProc.getHome();
      sets.golden.toast.group.position.copy(h.pos);
      sets.golden.toast.group.rotation.set(0, h.ry, 0);
    }
    setMugLevel(sets.cutre.mug, 0);
    for (const list of Object.values(STATIONS))
      for (const st of list) if (st.steps) st.steps.forEach((x) => (x.adv = false));
    shop.newDish();
    undo.length = 0;
    usedToday.clear();
    day++;
    minutes = 7 * 60 + 30;
    tick();
    selectStation(tableStation());
    fade.classList.remove('on');
  }, 900);
});
$('fridgeBtn').addEventListener('click', () => shop.open('fridge'));
$('homeBtn').addEventListener('click', () => {
  selectStation(tableStation());
  sfx.plop(0.5, 1.2);
});
$('more').addEventListener('click', () => $('menu').classList.toggle('open'));

// ---------- Modo foto: encuadra, elige filtro, dispara y comparte ----------
const photo = { on: false, flat: false, f: 0, blob: null };
const FILTERS = [
  ['Natural', 'none'],
  ['Cálido', 'sepia(0.22) saturate(1.2) brightness(1.03)'],
  ['Pastel', 'saturate(0.82) brightness(1.08) contrast(0.92)'],
  ['Vivo', 'saturate(1.35) contrast(1.06)'],
];
function setPhoto(on) {
  photo.on = on;
  photo.flat = false;
  document.body.classList.toggle('photo', on);
  $('photoResult').classList.remove('show');
  $('photoAngle').textContent = '📐 Desde arriba';
  renderer.domElement.style.filter = on ? FILTERS[photo.f][1] : '';
  if (on) selectStation(tableStation());
  free.pan.set(0, 0, 0);
  free.zoom = 1;
}
$('photoBtn').addEventListener('click', () => setPhoto(true));
$('photoClose').addEventListener('click', () => setPhoto(false));
$('photoAngle').addEventListener('click', () => {
  photo.flat = !photo.flat;
  $('photoAngle').textContent = photo.flat ? '📐 De lado' : '📐 Desde arriba';
});
$('photoFilter').addEventListener('click', () => {
  photo.f = (photo.f + 1) % FILTERS.length;
  $('photoFilter').textContent = `🎨 ${FILTERS[photo.f][0]}`;
  renderer.domElement.style.filter = FILTERS[photo.f][1];
});
$('photoShot').addEventListener('click', () => {
  // se dibuja y se copia en el mismo instante (formato 4:5, el de Instagram)
  renderer.render(scene, camera);
  const src = renderer.domElement, r = $('photoFrame').getBoundingClientRect(), k = src.width / innerWidth;
  const out = document.createElement('canvas');
  out.width = 1080;
  out.height = 1350;
  const x = out.getContext('2d');
  const f = FILTERS[photo.f][1];
  if (f !== 'none' && 'filter' in x) x.filter = f;
  x.drawImage(src, r.left * k, r.top * k, r.width * k, r.height * k, 0, 0, 1080, 1350);
  x.filter = 'none';
  x.font = '800 36px "Baloo 2", ui-rounded, sans-serif';
  x.fillStyle = 'rgba(255,255,255,0.94)';
  x.shadowColor = 'rgba(60,35,25,0.5)';
  x.shadowBlur = 10;
  x.fillText(`☀️ desayuno · día ${day}`, 40, 1350 - 44);
  $('photoImg').src = out.toDataURL('image/jpeg', 0.9);
  out.toBlob((b) => (photo.blob = b), 'image/jpeg', 0.9);
  $('photoHelp').textContent = '';
  $('flash').classList.add('on');
  setTimeout(() => $('flash').classList.remove('on'), 120);
  sfx.plop(1, 2.4);
  setTimeout(() => $('photoResult').classList.add('show'), 150);
});
$('photoAgain').addEventListener('click', () => $('photoResult').classList.remove('show'));
$('photoShare').addEventListener('click', async () => {
  const file = photo.blob && new File([photo.blob], 'desayuno.jpg', { type: 'image/jpeg' });
  try {
    if (file && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Mi desayuno' });
      return;
    }
  } catch (e) {
    if (e.name === 'AbortError') return;
  }
  $('photoHelp').textContent = 'Mantén pulsada la foto para guardarla y súbela a Instagram 📲';
});
$('tosti').addEventListener('click', () => {
  // Tosti enseña otra vez la pista y el gesto
  showHint();
  ghostFor(gestureFor(tool));
});
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

// Lo que colocas cae desde un poquito arriba, se aplasta al aterrizar y rebota
// como gelatina. Se anima la pieza interior, así puedes seguir arrastrándola.
function pop(obj, { quiet = false, delay = 0 } = {}) {
  const c = obj.children[0];
  anims.push({ c, y0: c.position.y, s0: c.scale.clone(), t: -delay, quiet, landed: false });
  c.scale.setScalar(0.001);
}
// cada cosa que colocas seguida sube una notita de la escala
let combo = 0, comboAt = -10;
function landNote(vol = 1) {
  if (clock.elapsedTime - comboAt > 2.2) combo = 0;
  comboAt = clock.elapsedTime;
  sfx.note(combo++, vol);
}

// altura del yogur en un punto (el relieve se dibuja en la GPU; aquí se lee del mapa)
let yogMap = null, yogMapT = 0;
function yogLift(uv) {
  const s = sets.golden;
  if (!s.yogurt.h || !uv) return 0;
  if (!yogMap) yogMap = s.yogurt.h.getContext('2d').getImageData(0, 0, 256, 256).data;
  const x = Math.min(255, Math.max(0, (uv.x * 256) | 0)), y = Math.min(255, Math.max(0, ((1 - uv.y) * 256) | 0));
  return (yogMap[(y * 256 + x) * 4] / 255) * s.ysurf.material.displacementScale;
}
function restOnYogurt(o, h) {
  const s = sets.golden;
  if (mood !== 'golden' || o.parent !== s.bowlPlaced) return;
  if (h.object === s.ysurf && h.uv) {
    o.userData.uv = h.uv.clone();
    o.position.y = yogLift(o.userData.uv);
  } else o.userData.uv = null; // apoyado sobre otra pieza
}
function placeAt(holder, h, kind, sprinkle = false, opts) {
  const o = makePlaced(kind, sprinkle);
  holder.add(o);
  o.position.copy(holder.worldToLocal(h.point.clone()));
  restOnYogurt(o, h);
  o.rotation.y = Math.random() * Math.PI * 2;
  holder.add(o);
  pop(o, opts);
  return o;
}

// tocar cualquier cosa de la cocina la hace temblar un poquito (boing)
function wobblables() {
  const skip = new Set(['board', 'toast', 'napkin', 'steam', 'towel']);
  const list = Object.entries(sets[mood].items).filter(([k]) => !skip.has(k)).map(([, o]) => o);
  if (mood === 'golden') list.push(toasterProc.obj, coffeeProc.grinder);
  return list.filter((o) => o.visible);
}
function tapWobble(e) {
  const list = wobblables();
  const h = cast(e, list);
  let o = h?.object;
  while (o && !list.includes(o)) o = o.parent;
  if (!o) return;
  jelly(o, 0.8);
  sfx.boing(0.85 + Math.random() * 0.5);
}

// ---------- Coger y lanzar (mantén el dedo sobre un objeto suelto) ----------
let pendingGrab = null;
function physItemAt(e) {
  const h = cast(e, physics.meshes());
  let o = h?.object;
  while (o && !o.userData.phys) o = o.parent;
  return o ? o.userData.phys : null;
}
function startGrab(it) {
  if (drag?.kind === 'proc') drag.proc.up(drag.step, null, procCtx);
  physics.grab(it);
  drag = { kind: 'grab', it };
  sfx.plop(0.8, 1.3);
  showHint('✋ Lo tienes. Suéltalo donde quieras… o lánzalo con un gesto.');
}

// ---------- Un dedo interactúa · dos dedos mueven la vista ----------
// Con dos dedos arrastras la encimera; pellizcando acercas o alejas. Un dedo
// nunca mueve la cámara: siempre actúa sobre lo que tocas.
const touches = new Map();
const free = { pan: new THREE.Vector3(), zoom: 1 };
let pan = null, panLock = false, goTap = null;
function touchMid() {
  const [a, b] = [...touches.values()];
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) };
}
function clampFree() {
  // la vista no se sale de la encimera
  const t = want.base || want.target;
  free.pan.x = THREE.MathUtils.clamp(free.pan.x, -3.6 - t.x, 8.6 - t.x);
  free.pan.z = THREE.MathUtils.clamp(free.pan.z, -1.4 - t.z, 2.2 - t.z);
  free.zoom = THREE.MathUtils.clamp(free.zoom, 0.5, 2);
}
function panBy(x0, y0, x1, y1) {
  const a = procCtx.planePoint({ clientX: x0, clientY: y0 }, 0), b = procCtx.planePoint({ clientX: x1, clientY: y1 }, 0);
  if (a && b) free.pan.add(a.sub(b));
  clampFree();
}
// ¿a qué zona pertenece lo que tocas? (tocar algo de otra zona te lleva a ella)
function ownerAt(e) {
  const s = sets[mood];
  const groups = mood === 'golden'
    ? { avocado: [avoPrep.holder, prepBoard], toast: [s.toast.group, s.items.board, toasterProc.obj], bowl: [s.bowl], coffee: [s.mug, coffeeProc.grinder] }
    : { toast: [s.toast.group, s.items.towel, s.items.tub], coffee: [s.mug] };
  const all = Object.values(groups).flat().filter((o) => o.visible);
  const h = cast(e, all);
  if (!h) return null;
  for (const [id, list] of Object.entries(groups)) {
    for (const root of list) {
      let o = h.object;
      while (o) {
        if (o === root) return STATIONS[mood].find((st) => st.id === id);
        o = o.parent;
      }
    }
  }
  return null;
}
el.addEventListener('wheel', (e) => {
  // ordenador: rueda/trackpad mueve la vista; Ctrl + rueda (o pellizco) acerca
  e.preventDefault();
  if (e.ctrlKey) free.zoom *= Math.exp(e.deltaY * 0.01);
  else panBy(0, 0, -e.deltaX, -e.deltaY);
  clampFree();
}, { passive: false });

el.addEventListener('pointerdown', (e) => {
  sfx.ensure();
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  try {
    el.setPointerCapture(e.pointerId);
  } catch {}
  if (touches.size >= 2) {
    // segundo dedo: se cancela lo que hacía el primero y pasas a mover la vista
    if (touches.size === 2) {
      if (drag) up(null);
      goTap = null;
      pan = touchMid();
      panLock = true;
      $('bubble').classList.remove('show');
    }
    return;
  }
  if (panLock) return;
  ghost.kind = null;
  ghost.idle = 0;
  if (photo.on) {
    // en modo foto, un dedo encuadra
    drag = { kind: 'photopan', x: e.clientX, y: e.clientY };
    return;
  }
  const owner = ownerAt(e);
  if (owner && owner !== station) {
    goTap = { st: owner, x: e.clientX, y: e.clientY, t: performance.now() };
    return;
  }
  lastX = e.clientX;
  lastY = e.clientY;
  pendingGrab = null;
  const grabbable = mood === 'golden' ? physItemAt(e) : null;
  if (grabbable) {
    pendingGrab = { it: grabbable, t: clock.elapsedTime, x: e.clientX, y: e.clientY, e };
    // anillo que se cierra: "mantén para coger"
    const ring = $('holdRing');
    ring.style.left = `${e.clientX}px`;
    ring.style.top = `${e.clientY}px`;
  }
  handleDown(e);
  // si ningún gesto usa este toque, se coge el objeto al instante
  if (!grabbable && drag?.kind === 'orbit') tapWobble(e);
  if (grabbable && drag?.kind === 'orbit') {
    pendingGrab = null;
    startGrab(grabbable);
    physics.holdTo(grabbable, procCtx.planePoint(e, grabY(grabbable)), clock.elapsedTime);
  }
});
const grabY = (it) => Math.max(it.body.position.y, 0.9);

function handleDown(e) {
  // procesos (aguacate, café) y café soluble
  if (tool && tool.type === 'proc') {
    const proc = station.id === 'avocado' ? avoPrep : station.id === 'toast' ? toasterProc : coffeeProc;
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
      // ¿estás cargando el cuchillo en la fuente o untando en la tostada?
      const src = SPREAD_SRC[tool.id]?.();
      const hs = src ? cast(e, [src]) : null;
      if (hs) {
        if (knifeLoad.kind !== tool.id) {
          if (!pay()) return;
          knifeLoad.kind = tool.id;
          knifeLoad.amount = 0;
        }
        drag = { kind: 'load', src };
        jelly(src, 0.35);
        src.userData.open = true; // (tarrina) se destapa
        knifeGoal.tilt = -0.32;
        moveKnife(hs.point);
        return;
      }
      const h = hitSurface(e, info);
      if (h) {
        if (knifeLoad.kind !== tool.id || knifeLoad.amount < 0.03) {
          say('Carga el cuchillo', `Pásalo primero por ${SPREAD_NAME[tool.id]}`);
          return;
        }
        undo.push(s.toast.snapshot());
        drag = { kind: 'spread', uv: h.uv.clone(), point: h.point.clone() };
        knifeGoal.tilt = 0;
        // el primer contacto deja el pegote; luego lo vas extendiendo
        for (let i = 0; i < 3; i++) s.toast.paint(h.uv.x, h.uv.y, h.uv.x + 0.003, h.uv.y + 0.003 * i, tool.id, Math.min(1.25, knifeLoad.amount * 1.5));
        knifeLoad.amount *= 0.8;
        updateKnifeBlob();
        sfx.plop(0.6, 0.8);
        moveKnife(h.point);
        return;
      }
    } else if (tool.type === 'honeydrip') {
      // la miel se puede empezar a echar en cualquier sitio (también fuera, sin querer)
      const y = surfTopY(info), pt = procCtx.planePoint(e, y);
      if (pt) {
        if (!pay()) return;
        undo.push(info.kind === 'toast' ? s.toast.snapshot() : s.yogurt.snapshot());
        const L = liquidOf(tool);
        honeySess = { info, prevUV: null, L };
        L.start(pt, y, honeyDeposit);
        drag = { kind: 'honey', y, L };
        return;
      }
    } else if (tool.type === 'jarpour') {
      const h = hitSurface(e, info);
      if (h) {
        if (!pay()) return;
        undo.push(s.yogurt.snapshot());
        drag = { kind: 'jarpour', uv: h.uv.clone(), point: h.point.clone(), info };
        return;
      }
    } else if (tool.type === 'spoon') {
      const h = hitSurface(e, info);
      if (h) {
        undo.push(s.yogurt.snapshot());
        drag = { kind: 'spoon', uv: h.uv.clone(), info };
        spoonGoal.pos = h.point.clone();
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
}

function sprinkleAt(d, h) {
  const n = 2 + ((Math.random() * 3) | 0);
  for (let i = 0; i < n; i++) {
    const o = placeAt(d.info.holder, h, tool.id, true, { quiet: i > 0, delay: i * 0.04 });
    o.position.x += (Math.random() - 0.5) * 0.14;
    o.position.z += (Math.random() - 0.5) * 0.14;
    o.rotation.x = (Math.random() - 0.5) * 0.6;
    d.items.push(o);
  }
}

el.addEventListener('pointermove', (e) => {
  const tp = touches.get(e.pointerId);
  if (tp) {
    tp.x = e.clientX;
    tp.y = e.clientY;
  }
  if (pan && touches.size >= 2) {
    const m = touchMid();
    panBy(pan.x, pan.y, m.x, m.y);
    if (m.d > 10 && pan.d > 10) free.zoom *= pan.d / m.d;
    clampFree();
    pan = m;
    return;
  }
  if (panLock) return;
  if (drag?.kind === 'photopan') {
    panBy(drag.x, drag.y, e.clientX, e.clientY);
    drag.x = e.clientX;
    drag.y = e.clientY;
    return;
  }
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;
  if (pendingGrab && Math.hypot(e.clientX - pendingGrab.x, e.clientY - pendingGrab.y) > 12) pendingGrab = null;
  if (!drag) return;
  const s = sets[mood];
  // el dedo/utensilio ocupa sitio: puede volcar cosas sin querer
  fingerGoal = ['orbit', 'grab', 'proc'].includes(drag.kind) ? null : procCtx.planePoint(e, 0.55);
  switch (drag.kind) {
    case 'grab': {
      const p = procCtx.planePoint(e, grabY(drag.it));
      if (p) physics.holdTo(drag.it, p, clock.elapsedTime);
      break;
    }
    case 'load': {
      const h = cast(e, [drag.src]);
      if (h) {
        const d = Math.hypot(dx, dy);
        // se carga según lo que rasques de verdad: hay que pasar la hoja
        knifeLoad.amount = Math.min(1, knifeLoad.amount + d * 0.0045);
        moveKnife(h.point, new THREE.Vector3(dx, 0, dy));
        scoopMark(h, dx, dy);
        if (drag.src === s.items.ricottaPot) {
          const cheese = drag.src.children[1];
          cheese.scale.y = Math.max(0.14, cheese.scale.y - d * 0.0005);
        }
        sfx.scrape(d * 0.0012);
        updateKnifeBlob();
      }
      break;
    }
    case 'jarpour': {
      const h = hitSurface(e, drag.info);
      if (h) {
        drag.uv = h.uv.clone();
        drag.point = h.point.clone();
      }
      break;
    }
    case 'honey': {
      const pt = procCtx.planePoint(e, drag.y);
      if (pt) drag.L.setTarget(pt);
      break;
    }
    case 'spoon': {
      const h = hitSurface(e, drag.info);
      if (!h) break;
      // el dorso de la cuchara remueve el yogur y deja el surco
      if (s.yogurt.groove(drag.uv, h.uv)) sfx.scrape(drag.uv.distanceTo(h.uv) * 0.4);
      spoonGoal.pos = h.point.clone();
      drag.uv = h.uv.clone();
      break;
    }
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
      if (drag.uv && knifeLoad.amount > 0.01) {
        s.toast.paint(drag.uv.x, drag.uv.y, h.uv.x, h.uv.y, tool.id, knifeLoad.amount);
        knifeLoad.amount = Math.max(0, knifeLoad.amount - drag.uv.distanceTo(h.uv) * 0.3);
        sfx.scrape(drag.uv.distanceTo(h.uv));
        updateKnifeBlob();
        if (knifeLoad.amount <= 0.01 && !drag.warned) {
          drag.warned = true;
          say('Se acabó la carga', `Vuelve a pasar el cuchillo por ${SPREAD_NAME[tool.id]}`);
        }
      }
      moveKnife(h.point, drag.point ? h.point.clone().sub(drag.point) : null);
      drag.point = h.point.clone();
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
      if (h) {
        drag.obj.position.copy(drag.info.holder.worldToLocal(h.point.clone()));
        restOnYogurt(drag.obj, h);
      }
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
      break; // un dedo en vacío no hace nada: la vista se mueve con dos
  }
});
const up = (e) => {
  if (e) {
    touches.delete(e.pointerId);
    if (touches.size < 2) pan = null;
    if (touches.size === 0 && panLock) {
      panLock = false;
      return;
    }
    if (panLock) return;
    // toque corto sobre algo de otra zona: vas allí
    if (goTap) {
      const g = goTap;
      goTap = null;
      if (Math.hypot(e.clientX - g.x, e.clientY - g.y) < 14 && performance.now() - g.t < 500) {
        selectStation(g.st);
        sfx.plop(0.5, 1.5);
      }
      return;
    }
  }
  ghost.idle = 0;
  pendingGrab = null;
  if (drag?.kind === 'proc') drag.proc.up(drag.step, e, procCtx);
  if (drag?.kind === 'grab') {
    physics.release(drag.it);
    // al recoger algo volcado, lo dejas de pie
    const t = drag.it.mesh.userData.tip;
    if (t) {
      const b = drag.it.body;
      b.quaternion.set(0, 0, 0, 1);
      b.angularVelocity.set(0, 0, 0);
      b.velocity.scale(0.3, b.velocity);
    }
    renderUI();
  }
  if (drag?.kind === 'honey') drag.L.release();
  if (drag?.kind === 'spoon') spoonGoal.pos = null;
  knifeGoal.tilt = 0;
  fingerGoal = null;
  drag = null;
  sfx.stop();
};
let instantAnim = null;
const planeHit = new THREE.Vector3();
const procCtx = {
  sfx,
  time: 0,
  cast: (e, objs) => cast(e, objs),
  // logro: campanita + chispitas sobre lo que estás preparando
  chime: () => {
    sfx.chime();
    const o = focusObject();
    if (o) {
      const p = procCtx.screenOf(o.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.4, 0)));
      burst(p.x, p.y);
    }
  },
  wobble: (o, k) => jelly(o, k),
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
let tween = null, lastFocus = undefined;
const fovFor = (width, dist, a) => THREE.MathUtils.radToDeg(2 * Math.atan(width / 2 / dist / a));

function computeView() {
  computeBase();
  // encima del encuadre de la zona va lo que tú hayas movido con dos dedos
  want.base = want.target.clone();
  want.target.add(free.pan);
  want.dist *= free.zoom;
}
function computeBase() {
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
      want.fov = 30;
    } else {
      want.dist = 8.6;
      const minH = THREE.MathUtils.degToRad(44);
      const hNow = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(30) / 2) * a);
      want.fov = hNow < minH ? THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(minH / 2) / a)) : 30;
    }
    if (photo.flat) want.dir.set(0, 1, 0.16).normalize(); // foto cenital (flat-lay)
    return;
  }
  const w = station.width;
  f.getWorldPosition(want.target);
  want.target.y += 0.15;
  want.dir.copy(FOCUS_DIR);
  want.dist = 5;
  if (p) {
    want.fov = fovFor(w, 5, a);
    want.target.z += w * 0.12; // deja sitio a la fila de herramientas
  } else if (tight) {
    want.fov = fovFor(w * 1.9, 5, a);
    want.target.z += w * 0.1;
  } else {
    want.fov = Math.max(26, fovFor(w * 1.7, 5, a));
    want.target.z += w * 0.2;
  }
}

function resize() {
  renderer.setSize(innerWidth, innerHeight);
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
  const rawDt = clock.getDelta();
  adaptQuality(rawDt);
  const dt = Math.min(rawDt, 0.05) * (window.__timeScale || 1);
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
    sfx.scrape(0.006);
  }
  procCtx.time = time;
  // coger: tras mantener el dedo un instante sobre un objeto suelto
  if (pendingGrab && time - pendingGrab.t > 0.3) {
    const g = pendingGrab;
    pendingGrab = null;
    startGrab(g.it);
    const p = procCtx.planePoint(g.e, grabY(g.it));
    if (p) physics.holdTo(g.it, p, time);
  }
  updateFinger(dt);
  physics.step(dt);
  if (mood === 'golden') updateTippables(dt);
  updateJelly(dt);
  updateKnife(dt);
  droplets.update(dt);
  if (s.yogurt) {
    // si echas más yogur, lo que ya estaba colocado sube con él (no se hunde)
    // (se relee el mapa como mucho 3 veces por segundo: leerlo cuesta)
    yogMapT = (yogMapT || 0) + dt;
    if (yogMapT > 0.33 && s.bowlPlaced.children.length) {
      yogMapT = 0;
      yogMap = null;
      for (const o of s.bowlPlaced.children) if (o.userData.uv) o.position.y = yogLift(o.userData.uv);
    }
    s.yogurt.relax(dt);
    bowlOver(s.yogurt.over || 0);
  }
  // tarro de yogur: sigue al dedo, se inclina al verter y cae un chorro espeso que se pliega
  const potOn = (station.id === 'bowl' || station.id === 'toast') && tool?.type === 'jarpour';
  // açaí: batido morado intenso (dos tonos) en vez de yogur blanco
  const acai = potOn && tool.col === 'acai';
  if (potOn && yogPot.userData.acai !== acai) {
    yogPot.userData.acai = acai;
    yogPot.userData.fill.material.color.set(acai ? '#6a2c70' : '#fbf8f1');
    yogPot.userData.label.material.color.set(acai ? '#d9b8e0' : '#a9c4d8');
    yogStream.material.color.set(acai ? '#6a2c70' : '#fbf8f1');
  }
  yogStream.visible = false;
  if (!potOn) yogPot.visible = false;
  else {
    const pouring = drag?.kind === 'jarpour';
    // en reposo: apoyado en la encimera, al lado del bol (sin taparlo)
    const bowlTop = station.id === 'toast'
      ? s.toast.group.getWorldPosition(new THREE.Vector3()).setY(0).add(new THREE.Vector3(0, 0.34, 1.05))
      : s.bowl.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(portrait ? -0.95 : 0.95, 0.34, -0.15));
    const goal = pouring ? drag.point.clone().add(new THREE.Vector3(0, 0.62, 0)) : bowlTop;
    if (!yogPot.visible) {
      yogPot.visible = true;
      yogPot.position.copy(goal);
    }
    yogPot.position.lerp(goal, Math.min(1, dt * 10));
    yogPot.rotation.z += ((pouring ? -1.9 : 0) - yogPot.rotation.z) * Math.min(1, dt * 8);
    if (pouring && Math.abs(yogPot.rotation.z + 1.9) < 0.4) {
      // el punto de caída "dibuja" pequeños pliegues
      const fold = new THREE.Vector2(Math.sin(time * 7) * 0.025, Math.cos(time * 5.3) * 0.02);
      const uvF = drag.uv.clone().add(fold);
      if (drag.info.kind === 'toast') {
        // en la tostada: el yogur cae espeso y se queda encima
        const prev = drag.prevUV || uvF;
        s.toast.paint(prev.x, prev.y, uvF.x, uvF.y, 'yogurt', 1.15);
        s.toast.paint(uvF.x, uvF.y, uvF.x + 0.004, uvF.y, 'yogurt', 1.15);
        drag.prevUV = uvF;
      } else s.yogurt.ribbon(uvF, dt, acai ? ACAI : null);
      const top = yogPot.position, bot = drag.point;
      const h = top.y - bot.y;
      yogStream.visible = true;
      yogStream.scale.set(1 + Math.sin(time * 9) * 0.12, h, 1 + Math.cos(time * 7) * 0.12);
      yogStream.position.set(top.x + Math.sin(time * 7) * 0.01, bot.y + h / 2, top.z);
      sfx.scrape(0.003);
    }
    if (s.yogurt.over > 250 && pouring && drag.info.kind !== 'toast' && !drag.warned) {
      drag.warned = true;
      say('¡A rebosar! 🥣', 'Sigue si quieres… se sale por el borde');
    }
  }
  // cuchara: descansa junto al bol; al usarla va hacia el dedo con suavidad
  const spoonOn = station.id === 'bowl' && tool?.id === 'spoonSwirl';
  if (!spoonOn) spoon.visible = false;
  else {
    const rest = s.bowl.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(portrait ? -0.9 : 0.9, 0.05, 0.1));
    const goal = spoonGoal.pos ? spoonGoal.pos.clone().add(new THREE.Vector3(0, 0.04, 0)) : rest;
    if (!spoon.visible) {
      spoon.visible = true;
      spoon.position.copy(goal);
    }
    spoon.position.lerp(goal, 1 - Math.exp(-dt * 16));
    spoon.rotation.z += ((spoonGoal.pos ? 0.45 : 0) - spoon.rotation.z) * Math.min(1, dt * 10);
  }
  spoon.userData.load.visible = false;
  // miel: el hilo sigue cayendo aunque sueltes; lo caído se extiende despacio
  honey.update(dt);
  oil.update(dt);
  for (let i = honeyPools.length - 1; i >= 0; i--) {
    const q = honeyPools[i];
    q.age += dt;
    // el aceite es más fluido: se extiende más que la miel
    const k = q.oil ? 1.8 : 1;
    if (q.kind === 'toast') s.toast.honeyPool(q.uv.x, q.uv.y, (10 + q.age * 14) * k, 0.05, q.oil);
    else if (s.yogurt) s.yogurt.honeyPool(q.uv, (6 + q.age * 8) * k, 0.03, q.oil ? '196,178,52' : undefined);
    if (q.age > 1.4) honeyPools.splice(i, 1);
  }
  // cuchara de miel y botella de aceite: descansan junto a lo que preparas
  for (const L of [honey, oil]) {
    const on = tool?.type === 'honeydrip' && liquidOf(tool) === L && (station.id === 'toast' || station.id === 'bowl');
    if (!on && !L.running) L.dipper.visible = false;
    else if (!L.running) {
      const o = station.id === 'toast' ? s.toast.group : s.bowl;
      const rest = o.getWorldPosition(new THREE.Vector3()).setY(L.cfg.restY).add(new THREE.Vector3(0.2, 0, 1.0));
      if (!L.dipper.visible) {
        L.dipper.visible = true;
        L.dipper.position.copy(rest);
      }
      L.dipper.position.lerp(rest, 1 - Math.exp(-dt * 6));
    }
  }
  if (mood === 'golden') {
    const inCoffee = station.id === 'coffee';
    // la taza viaja a la zona de preparación mientras haces el café
    const e = homes.get(s.mug);
    const home = e ? (portrait ? e.port : e.land) : [s.mug.position.x, s.mug.position.z];
    const tx = inCoffee ? COFFEE_ZONE.x : home[0], tz = inCoffee ? COFFEE_ZONE.z : home[1];
    s.mug.position.x += (tx - s.mug.position.x) * Math.min(1, dt * 4);
    s.mug.position.z += (tz - s.mug.position.z) * Math.min(1, dt * 4);
    s.steam.position.set(s.mug.position.x, 0.62, s.mug.position.z);
    avoPrep.update(dt, station.id === 'avocado' ? curStep().id : null, procCtx);
    toasterProc.update(dt, procCtx);
    if (toasterProc.state !== 'toasting') sfx.sizzle(false);
    coffeeProc.update(dt, inCoffee ? curStep().id : null, procCtx);
    s.items.avo.visible = avoPrep.open;
    // el medio aguacate de la mesa refleja lo que has hecho (sin hueso, pelado)
    const inner = s.items.avo.children[0];
    if (inner) {
      inner.children[2].visible = !avoPrep.pitless;
      inner.children[0].material.color.set(avoPrep.peeled ? '#b9dc66' : '#4b7a2c');
    }
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
  // viaje de cámara entre estaciones: aceleración y frenada suaves, y se aleja
  // un poco a mitad de camino (arco) para no atravesar objetos
  const focusNow = focusObject();
  if (focusNow !== lastFocus) {
    lastFocus = focusNow;
    // al ir a otra zona, la vista vuelve a su encuadre
    want.target.sub(free.pan);
    want.dist /= free.zoom;
    free.pan.set(0, 0, 0);
    free.zoom = 1;
    tween = { t: 0, from: { target: cur.target.clone(), dir: cur.dir.clone(), dist: cur.dist, fov: cur.fov } };
  }
  if (tween) {
    tween.t = Math.min(1, tween.t + dt / 1.3);
    const e = tween.t < 0.5 ? 4 * tween.t ** 3 : 1 - (-2 * tween.t + 2) ** 3 / 2;
    const f = tween.from;
    cur.target.copy(f.target).lerp(want.target, e);
    cur.dir.copy(f.dir).lerp(want.dir, e).normalize();
    cur.dist = f.dist + (want.dist - f.dist) * e + Math.sin(tween.t * Math.PI) * Math.max(f.dist, want.dist) * 0.22;
    cur.fov = f.fov + (want.fov - f.fov) * e;
    if (tween.t >= 1) tween = null;
  } else {
    const k = 1 - Math.exp(-dt * (pan ? 30 : 6)); // con dos dedos la vista va pegada a la mano
    cur.target.lerp(want.target, k);
    cur.dir.lerp(want.dir, k).normalize();
    cur.dist += (want.dist - cur.dist) * k;
    cur.fov += (want.fov - cur.fov) * k;
  }
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
    const a = anims[i], FALL = 0.17;
    a.t += dt;
    if (a.t < 0) continue;
    if (a.t < FALL) {
      // cae
      const f = a.t / FALL;
      a.c.position.y = a.y0 + 0.3 * (1 - f * f);
      a.c.scale.copy(a.s0).multiplyScalar(Math.min(1, 0.4 + f * 1.2));
    } else {
      // aterriza: se aplasta y rebota
      if (!a.landed) {
        a.landed = true;
        if (!a.quiet) landNote();
      }
      const tt = a.t - FALL, q = 0.3 * Math.exp(-9 * tt) * Math.cos(21 * tt);
      a.c.position.y = a.y0;
      a.c.scale.set(a.s0.x * (1 + 0.6 * q), a.s0.y * (1 - q), a.s0.z * (1 + 0.6 * q));
      if (tt > 0.6) {
        a.c.scale.copy(a.s0);
        anims.splice(i, 1);
      }
    }
  }

  updateGhost(dt);
  updateHub();
  $('holdRing').classList.toggle('on', !!pendingGrab);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
loop();

window.__bs = {
  scene, camera, sets, applyMood, selectStation, STATIONS, shop, avoPrep, coffeeProc, physics, knifeLoad, toasterProc,
  free,
  breakGlass: () => (breakPending = true),
  flowCount: () => juiceFlow.p.length,
  shardCount: () => shards.length,
  dpr: () => dpr,
  honeySpills: () => honey.spills.children.length,
  finger: () => [fingerBody.position.x, fingerBody.position.y, fingerBody.position.z].map((v) => v.toFixed(2)).join(',') + ' goal ' + (fingerGoal ? fingerGoal.toArray().map((v) => v.toFixed(2)).join(',') : 'null') + ' drag ' + (drag ? drag.kind : 'none'),
  juicePos: () => juiceTip.holder.position.toArray().map((v) => v.toFixed(2)).join(','),
  tipped: () => tippables.filter((t) => t.tipped).map((t) => t.key).join(',') || 'nada',
  get station() { return station; },
  settled: () => !tween && cur.target.distanceTo(want.target) < 0.01 && Math.abs(cur.fov - want.fov) < 0.1,
};
