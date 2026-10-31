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
import * as P from './props.js';

// ---------- Render ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
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
const target = new THREE.Vector3(0.0, 0.5, 0.1);
const camDir = new THREE.Vector3(0.48, 0.66, 0.92).normalize();
let camDist = 8.6;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.28, 0.6, 0.92);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const room = buildRoom(scene);

// ---------- Los dos desayunos ----------
function shadows(o) {
  o.traverse((c) => {
    if (c.isMesh && c.castShadow === false && !c.material.transparent) c.castShadow = true;
  });
  return o;
}

const sets = {};
{
  // Mañana dorada
  const g = new THREE.Group();
  const board = P.makeBoard();
  board.position.set(0.0, 0, 0.35);
  board.rotation.y = 0.06;
  g.add(board);
  const toast = new Toast('sourdough');
  toast.group.position.set(-0.15, board.userData.top, 0.32);
  toast.group.rotation.y = 0.12;
  g.add(toast.group);
  const avo = P.makeAvocadoHalf();
  avo.position.set(0.68, board.userData.top, 0.68);
  avo.rotation.y = -0.5;
  g.add(avo);
  const knife = P.makeKnife({ fancy: true });
  knife.position.set(0.45, board.userData.top, 0.0);
  knife.rotation.y = 0.5;
  g.add(knife);
  const napkin = P.makeNapkin();
  napkin.position.set(1.85, 0, -0.35);
  napkin.rotation.y = 0.3;
  g.add(napkin);
  const mug = P.makeMug({ fancy: true });
  mug.position.set(1.85, 0.02, -0.35);
  mug.rotation.y = -0.6;
  g.add(mug);
  const steam = P.makeSteam();
  steam.position.set(1.85, 0.62, -0.35);
  g.add(steam);
  const bowl = P.makeBowl();
  bowl.position.set(-1.55, 0, 0.75);
  g.add(bowl);
  const juice = P.makeJuice();
  juice.position.set(-1.65, 0, -0.45);
  g.add(juice);
  const daisies = P.makeDaisies();
  daisies.position.set(0.85, 0, -1.15);
  g.add(daisies);
  const plant = P.makePlant(1.2);
  plant.position.set(-3.2, 0, -1.0);
  g.add(plant);
  // balda: tarros + planta colgante
  const oats = P.makeJar(new THREE.MeshStandardMaterial({ color: '#e3cfa6', roughness: 1 }), 0.55);
  oats.position.set(0.05, 2.39, -1.38);
  const beans = P.makeJar(new THREE.MeshStandardMaterial({ color: '#4a2c1a', roughness: 0.5 }), 0.42);
  beans.position.set(0.5, 2.39, -1.38);
  const hang = P.makePlant(0.7, true);
  hang.position.set(1.5, 2.39, -1.38);
  g.add(oats, beans, hang);
  sets.golden = { group: shadows(g), toast, steam, spread: 'avocado' };
}
{
  // Piso compartido
  const g = new THREE.Group();
  const towel = P.makePaperTowel();
  towel.position.set(-0.1, 0, 0.35);
  towel.rotation.y = -0.15;
  g.add(towel);
  const toast = new Toast('sandwich');
  toast.group.position.set(-0.15, towel.userData.top, 0.35);
  toast.group.rotation.y = -0.1;
  g.add(toast.group);
  const tub = P.makeButterTub();
  tub.position.set(0.95, 0, 0.75);
  tub.rotation.y = -0.4;
  g.add(tub);
  const knife = P.makeKnife({ fancy: false });
  knife.position.set(0.6, 0.0, 0.05);
  knife.rotation.y = 0.9;
  g.add(knife);
  const mug = P.makeMug({ fancy: false });
  mug.position.set(1.75, 0, -0.3);
  g.add(mug);
  const steam = P.makeSteam(2);
  steam.position.set(1.75, 0.62, -0.3);
  g.add(steam);
  const jar = P.makeInstantJar();
  jar.position.set(-1.4, 0, -0.6);
  jar.rotation.y = 0.5;
  g.add(jar);
  sets.cutre = { group: shadows(g), toast, steam, spread: 'butter' };
}
scene.add(sets.golden.group, sets.cutre.group);

// ---------- Estado ----------
let mood = 'golden';
let done = false;
const toppings = new THREE.Group();
sets.golden.toast.group.add(toppings);
const anims = [];

function applyMood(m) {
  mood = m;
  room.setMood(m, renderer);
  sets.golden.group.visible = m === 'golden';
  sets.cutre.group.visible = m === 'cutre';
  document.body.dataset.mood = m;
  document.querySelectorAll('#mood button').forEach((b) => b.classList.toggle('on', b.dataset.mood === m));
  hint.textContent = m === 'golden'
    ? 'Desliza el dedo sobre la tostada para untar el aguacate'
    : 'Desliza el dedo para untar la margarina';
  updateBar();
}

function resetToast() {
  sets[mood].toast.reset();
  if (mood === 'golden') {
    toppings.clear();
    anims.length = 0;
  }
  done = false;
  updateBar();
}

// ---------- Toppings al terminar ----------
const easeOutBack = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);

function drop(obj, delay, height = 0.6) {
  const to = obj.position.clone();
  obj.position.y += height;
  obj.scale.setScalar(0.001);
  anims.push({ obj, to, from: obj.position.clone(), t0: clock.elapsedTime + delay, dur: 0.55, s: obj.userData.s || 1 });
  toppings.add(obj);
}

function addToppings() {
  const t = sets.golden.toast;
  const r = Math.random;
  [[-0.2, 0.06, 0.4], [0.2, -0.06, -0.3]].forEach(([x, y, rot], i) => {
    const e = P.makeEggHalf();
    e.position.copy(t.local(x, y)).add(new THREE.Vector3(0, 0.085, 0));
    e.rotation.y = rot;
    drop(e, i * 0.18);
  });
  const chili = new THREE.MeshStandardMaterial({ color: '#c8361f', roughness: 0.6 });
  const salt = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.15 });
  const sesame = new THREE.MeshStandardMaterial({ color: '#efe2c4', roughness: 0.5 });
  const green = new THREE.MeshStandardMaterial({ color: '#79a94f', roughness: 0.5 });
  const sprinkle = (mat, n, size, delay) => {
    for (let i = 0; i < n; i++) {
      const [x, y] = t.randomPointInside();
      const m = new THREE.Mesh(new THREE.BoxGeometry(size, size * 0.4, size * (0.6 + r())), mat);
      m.position.copy(t.local(x, y)).add(new THREE.Vector3(0, 0.015, 0));
      m.rotation.set(r() * 0.5, r() * 6, r() * 0.5);
      drop(m, delay + r() * 0.5, 0.3);
    }
  };
  sprinkle(chili, 34, 0.022, 0.5);
  sprinkle(salt, 22, 0.018, 0.7);
  sprinkle(sesame, 18, 0.016, 0.8);
  for (let i = 0; i < 9; i++) {
    const [x, y] = t.randomPointInside();
    const leaf = new THREE.Group();
    for (const s of [-1, 1]) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), green);
      l.scale.set(1, 0.2, 0.55);
      l.position.set(s * 0.03, 0.03, 0);
      l.rotation.z = s * 0.4;
      l.castShadow = true;
      leaf.add(l);
    }
    leaf.position.copy(t.local(x, y));
    leaf.rotation.y = r() * 6;
    drop(leaf, 1.0 + r() * 0.4, 0.4);
  }
}

function finish() {
  done = true;
  sfx.chime();
  if (mood === 'golden') {
    addToppings();
    say('Qué maravilla ✨', 'Tostada de masa madre con aguacate y huevo mollet');
  } else {
    say('Bueno… se come 🫠', 'Con un poco más de sueldo podrías comprar masa madre y aguacate');
  }
}

// ---------- UI ----------
const hint = document.getElementById('hint');
const fill = document.getElementById('fill');
const pct = document.getElementById('pct');
const msg = document.getElementById('msg');
const fade = document.getElementById('fade');
const sfx = new Sfx();

function updateBar() {
  const c = Math.min(1, sets[mood].toast.covered / 0.8);
  fill.style.width = `${(c * 100).toFixed(0)}%`;
  pct.textContent = `${(c * 100).toFixed(0)}%`;
}

let msgTimer;
function say(title, sub) {
  msg.innerHTML = `<b>${title}</b><span>${sub}</span>`;
  msg.classList.add('show');
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => msg.classList.remove('show'), 4200);
}

document.querySelectorAll('#mood button').forEach((b) =>
  b.addEventListener('click', () => {
    if (b.dataset.mood === mood) return;
    fade.classList.add('on');
    setTimeout(() => {
      applyMood(b.dataset.mood);
      done = sets[mood].toast.covered >= 0.8;
      fade.classList.remove('on');
    }, 450);
  }),
);
document.getElementById('reset').addEventListener('click', resetToast);
const soundBtn = document.getElementById('sound');
soundBtn.addEventListener('click', () => {
  sfx.on = !sfx.on;
  soundBtn.classList.toggle('off', !sfx.on);
  if (!sfx.on) sfx.stop();
});

// reloj: la mañana avanza tranquila
const timeEl = document.getElementById('time');
let minutes = 7 * 60 + 32;
setInterval(() => {
  if (minutes < 8 * 60 + 15) minutes++;
  timeEl.textContent = `${String((minutes / 60) | 0).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}, 2500);

// ---------- Input: untar o girar un poco la cámara ----------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let mode = null, lastUV = null, lastX = 0, lastY = 0;
let yaw = 0, pitch = 0, yawT = 0, pitchT = 0;

function hitToast(e) {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const h = ray.intersectObject(sets[mood].toast.mesh, false)[0];
  if (h && h.face.normal.y > 0.5 && h.uv) return h.uv.clone();
  return null;
}

const el = renderer.domElement;
el.addEventListener('pointerdown', (e) => {
  sfx.ensure();
  el.setPointerCapture(e.pointerId);
  lastX = e.clientX;
  lastY = e.clientY;
  const uv = hitToast(e);
  if (uv) {
    mode = 'paint';
    lastUV = uv;
  } else mode = 'orbit';
});
el.addEventListener('pointermove', (e) => {
  if (!mode) {
    el.style.cursor = hitToast(e) ? 'crosshair' : 'grab';
    return;
  }
  if (mode === 'paint') {
    const uv = hitToast(e);
    if (uv) {
      if (lastUV) {
        const t = sets[mood].toast;
        t.paint(lastUV.x, lastUV.y, uv.x, uv.y, sets[mood].spread);
        sfx.scrape(lastUV.distanceTo(uv));
      }
      lastUV = uv;
    } else {
      lastUV = null;
      sfx.stop();
    }
  } else {
    yawT = THREE.MathUtils.clamp(yawT - (e.clientX - lastX) * 0.004, -0.45, 0.45);
    pitchT = THREE.MathUtils.clamp(pitchT + (e.clientY - lastY) * 0.003, -0.25, 0.2);
  }
  lastX = e.clientX;
  lastY = e.clientY;
});
const up = () => {
  mode = null;
  lastUV = null;
  sfx.stop();
};
el.addEventListener('pointerup', up);
el.addEventListener('pointercancel', up);

// ---------- Encuadre adaptado a móvil vertical ----------
function resize() {
  const a = innerWidth / innerHeight;
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  camera.aspect = a;
  // mantenemos un ángulo horizontal mínimo para que quepa el desayuno en vertical
  const minH = THREE.MathUtils.degToRad(44);
  let vfov = 30;
  const hNow = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(vfov) / 2) * a);
  camDist = 8.6;
  if (hNow < minH) {
    vfov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(minH / 2) / a));
    if (vfov > 58) {
      camDist *= Math.tan(THREE.MathUtils.degToRad(vfov) / 2) / Math.tan(THREE.MathUtils.degToRad(58) / 2);
      vfov = 58;
    }
    camDist *= 0.92;
  }
  camera.fov = vfov;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ---------- Loop ----------
const clock = new THREE.Clock();
const tmp = new THREE.Vector3();
applyMood('golden');

function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  // cámara: inercia suave + balanceo muy lento en reposo
  yaw += (yawT - yaw) * (1 - Math.exp(-dt * 5));
  pitch += (pitchT - pitch) * (1 - Math.exp(-dt * 5));
  const sway = Math.sin(time * 0.17) * 0.03;
  tmp.copy(camDir)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw + sway)
    .multiplyScalar(camDist);
  tmp.y += pitch * camDist + Math.sin(time * 0.23) * 0.03;
  camera.position.copy(target).add(tmp);
  camera.lookAt(target);

  const s = sets[mood];
  s.toast.flush();
  updateBar();
  if (!done && s.toast.covered >= 0.8) finish();
  s.steam.userData.update(time, camera);
  room.update(time);

  for (const a of anims) {
    const k = THREE.MathUtils.clamp((time - a.t0) / a.dur, 0, 1);
    if (k <= 0) continue;
    a.obj.position.lerpVectors(a.from, a.to, 1 - Math.pow(1 - k, 3));
    a.obj.scale.setScalar(Math.max(0.001, easeOutBack(k)) * a.s);
    if (k === 1 && !a.played) {
      a.played = true;
      if (a.obj.children.length > 2) sfx.plop();
    }
  }

  composer.render();
  requestAnimationFrame(loop);
}
loop();

window.__bs = { scene, camera, sets, applyMood, finish };
