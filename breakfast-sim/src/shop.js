// Nevera = inventario + tienda. Hoja 2D (rápida y clara) con "fotitos" de los
// alimentos generadas a partir de los propios modelos 3D del juego.
import * as THREE from 'three';
import { makePlaced } from './ingredients.js';
import * as P from './props.js';

// pack: unidades por compra · price: monedas · scope: una unidad por plato (si no, por uso)
export const ITEMS = {
  avocado: { name: 'Aguacates', pack: 2, price: 6, scope: true, thumb: () => P.makeAvocadoHalf() },
  ricotta: { name: 'Ricotta', pack: 3, price: 5, scope: true, thumb: () => jar('#fbf7ee', '#e9e2d4') },
  honey: { name: 'Miel', pack: 6, price: 6, scope: true, thumb: () => jar('#e39a2a', '#c98a3a') },
  egg: { name: 'Huevos', pack: 6, price: 4, thumb: () => makePlaced('egg') },
  radish: { name: 'Rabanitos', pack: 8, price: 3, thumb: () => cluster('radish', 3) },
  tomato: { name: 'Tomates cherry', pack: 10, price: 3, thumb: () => cluster('tomato', 3) },
  sprouts: { name: 'Brotes', pack: 10, price: 3, thumb: () => cluster('sprouts', 2) },
  chili: { name: 'Chile en escamas', pack: 20, price: 2, thumb: () => cluster('chili', 18, true) },
  sesame: { name: 'Sésamo', pack: 20, price: 2, thumb: () => cluster('sesame', 18, true) },
  yogurt: { name: 'Yogur griego', pack: 4, price: 5, scope: true, thumb: () => jar('#fbf8f1', '#f0ece4') },
  blueberry: { name: 'Arándanos', pack: 30, price: 4, thumb: () => cluster('blueberry', 6) },
  raspberry: { name: 'Frambuesas', pack: 20, price: 4, thumb: () => cluster('raspberry', 4) },
  strawberry: { name: 'Fresas', pack: 16, price: 4, thumb: () => cluster('strawberry', 3) },
  banana: { name: 'Plátano', pack: 12, price: 3, thumb: () => cluster('banana', 3) },
  granola: { name: 'Granola', pack: 20, price: 3, thumb: () => cluster('granola', 12, true) },
  mint: { name: 'Menta', pack: 12, price: 2, thumb: () => cluster('mint', 3) },
  milk: { name: 'Leche fresca', pack: 6, price: 4, scope: true, thumb: () => bottle() },
  cinnamon: { name: 'Canela', pack: 20, price: 2, thumb: () => jar('#9a5a2c', '#7a4a24') },
  beans: { name: 'Café de especialidad', pack: 6, price: 6, scope: true, thumb: () => jar('#4a2c1a', '#b98a5c') },
  instant: { name: 'Café soluble', pack: 20, price: 1, scope: true, thumb: () => P.makeInstantJar() },
  butter: { name: 'Margarina', pack: 20, price: 1, scope: true, thumb: () => P.makeButterTub() },
};

// qué ingrediente gasta cada herramienta
export const TOOL_ITEM = {
  avoCut: 'avocado', grind: 'beans', foamMilk: 'milk', instant: 'instant', ricotta: 'ricotta', honey: 'honey', drizzle: 'honey',
  egg: 'egg', radish: 'radish', tomato: 'tomato', sprouts: 'sprouts', chili: 'chili', sesame: 'sesame',
  yogurt: 'yogurt', blueberry: 'blueberry', raspberry: 'raspberry', strawberry: 'strawberry',
  banana: 'banana', granola: 'granola', mint: 'mint', cinnamon: 'cinnamon', butter: 'butter',
};

// Cocina y vajilla (permanentes) y premium (dinero real, vía StoreKit en iOS)
const KITCHEN = [
  { id: 'toaster', icon: '🍞', name: 'Tostadora retro', price: 40 },
  { id: 'espresso', icon: '☕', name: 'Cafetera espresso', price: 120 },
  { id: 'grinder', icon: '⚙️', name: 'Molinillo', price: 45 },
  { id: 'bowlwood', icon: '🥥', name: 'Bol de coco', price: 25 },
  { id: 'mugpink', icon: '🌸', name: 'Taza rosa empolvado', price: 18 },
  { id: 'marble', icon: '🤍', name: 'Encimera de mármol', price: 90 },
];
const PREMIUM = [
  { id: 'coins1', icon: '🪙', name: '120 monedas', eur: '0,99 €' },
  { id: 'coins2', icon: '💰', name: '700 monedas', eur: '4,99 €' },
  { id: 'tokyo', icon: '🗼', name: 'Escenario Tokio + desayuno japonés', eur: '2,99 €' },
  { id: 'paris', icon: '🥐', name: 'Escenario París + croissants', eur: '2,99 €' },
];

function jar(fill, lid) {
  const g = P.makeJar(new THREE.MeshStandardMaterial({ color: fill, roughness: 0.5 }), 0.42);
  g.children[2].material = new THREE.MeshStandardMaterial({ color: lid, roughness: 0.6 });
  return g;
}
function bottle() {
  const pts = [[0, 0], [0.16, 0], [0.17, 0.05], [0.17, 0.45], [0.09, 0.62], [0.07, 0.72], [0, 0.72]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 32), new THREE.MeshStandardMaterial({ color: '#fbfaf6', roughness: 0.25 })));
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.07, 24), new THREE.MeshStandardMaterial({ color: '#8fb3d9', roughness: 0.5 }));
  cap.position.y = 0.75;
  g.add(cap);
  return g;
}
function cluster(kind, n, sprinkle = false) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const o = makePlaced(kind, sprinkle);
    const a = (i / n) * Math.PI * 2, d = n > 1 ? (sprinkle ? Math.random() * 0.08 : 0.07) : 0;
    o.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
    g.add(o);
  }
  return g;
}

// ---------- Fotitos a partir del 3D ----------
const thumbs = {};
function renderThumbs(renderer, env) {
  const S = 160;
  const rt = new THREE.WebGLRenderTarget(S, S, { samples: 4 });
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.environment = env;
  scene.environmentIntensity = 0.6;
  scene.add(new THREE.HemisphereLight('#fff6ea', '#c9a98a', 1.6));
  const sun = new THREE.DirectionalLight('#fff0dc', 2.4);
  sun.position.set(-2, 4, 3);
  scene.add(sun);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
  const buf = new Uint8Array(S * S * 4);
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  const prevClear = renderer.getClearAlpha();
  renderer.setClearColor(0x000000, 0);
  for (const [id, it] of Object.entries(ITEMS)) {
    const o = it.thumb();
    scene.add(o);
    const box = new THREE.Box3().setFromObject(o);
    const size = box.getSize(new THREE.Vector3()).length();
    const ctr = box.getCenter(new THREE.Vector3());
    cam.position.copy(ctr).add(new THREE.Vector3(0.6, 0.75, 1).normalize().multiplyScalar(size * 1.9));
    cam.lookAt(ctr);
    renderer.setRenderTarget(rt);
    renderer.clear();
    renderer.render(scene, cam);
    renderer.readRenderTargetPixels(rt, 0, 0, S, S, buf);
    const img = x.createImageData(S, S);
    for (let row = 0; row < S; row++) img.data.set(buf.subarray((S - 1 - row) * S * 4, (S - row) * S * 4), row * S * 4);
    x.putImageData(img, 0, 0);
    thumbs[id] = c.toDataURL('image/png');
    scene.remove(o);
  }
  renderer.setRenderTarget(null);
  renderer.setClearColor(0x000000, prevClear);
  rt.dispose();
}

// ---------- Estado ----------
export class Shop {
  constructor({ renderer, env, onChange }) {
    this.renderer = renderer;
    this.env = env;
    this.onChange = onChange;
    this.coins = 30;
    this.stock = {};
    for (const [id, it] of Object.entries(ITEMS)) this.stock[id] = it.pack;
    this.owned = new Set();
    this.paid = new Set(); // "station:item" ya pagados en el plato actual
    this.tab = 'fridge';
    this.el = document.getElementById('shop');
    this.grid = document.getElementById('shopGrid');
    this.tabs = document.getElementById('shopTabs');
    document.getElementById('shopClose').onclick = () => this.close();
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.close();
    });
    this.sync();
  }

  itemFor(tool) {
    return TOOL_ITEM[tool.id] || null;
  }

  qty(tool) {
    const id = this.itemFor(tool);
    return id ? this.stock[id] : null;
  }

  // ¿se puede usar? (gasta una unidad si toca). Devuelve una función de reembolso.
  use(tool, station) {
    const id = this.itemFor(tool);
    if (!id) return () => {};
    const it = ITEMS[id];
    const key = `${station}:${id}`;
    if (it.scope && this.paid.has(key)) return () => {};
    if (this.stock[id] <= 0) {
      this.open('fridge', id);
      return null;
    }
    this.stock[id]--;
    if (it.scope) this.paid.add(key);
    this.sync();
    return () => {
      this.stock[id]++;
      if (it.scope) this.paid.delete(key);
      this.sync();
    };
  }

  newDish(station) {
    for (const k of [...this.paid]) if (!station || k.startsWith(station + ':')) this.paid.delete(k);
  }

  earn(n) {
    this.coins += n;
    this.sync();
  }

  sync() {
    document.querySelectorAll('[data-coins]').forEach((e) => (e.textContent = this.coins));
    this.onChange?.();
    if (this.el.classList.contains('open')) this.render();
  }

  open(tab = 'fridge', highlight = null) {
    if (!Object.keys(thumbs).length) renderThumbs(this.renderer, this.env);
    this.tab = tab;
    this.highlight = highlight;
    this.render();
    this.el.classList.add('open');
  }

  close() {
    this.el.classList.remove('open');
  }

  render() {
    const T = [['fridge', '🧊 Nevera'], ['kitchen', '🍳 Cocina'], ['premium', '✨ Especial']];
    this.tabs.innerHTML = T.map(([id, l]) => `<button class="tab${id === this.tab ? ' on' : ''}" data-tab="${id}">${l}</button>`).join('');
    this.tabs.querySelectorAll('button').forEach((b) => (b.onclick = () => {
      this.tab = b.dataset.tab;
      this.highlight = null;
      this.render();
    }));
    let html = '';
    if (this.tab === 'fridge') {
      for (const [id, it] of Object.entries(ITEMS)) {
        const n = this.stock[id], can = this.coins >= it.price;
        html += `<div class="item${id === this.highlight ? ' hi' : ''}${n ? '' : ' empty'}">
          <img src="${thumbs[id]}" alt="">
          <b>${it.name}</b>
          <small>${n ? `Tienes ${n}` : 'Se acabó'}</small>
          <button data-buy="${id}" ${can ? '' : 'disabled'}>+${it.pack} · ${it.price} 🪙</button>
        </div>`;
      }
    } else if (this.tab === 'kitchen') {
      for (const k of KITCHEN) {
        const own = this.owned.has(k.id);
        html += `<div class="item"><div class="emoji">${k.icon}</div><b>${k.name}</b>
          <small>${own ? 'En tu cocina' : 'Para siempre'}</small>
          <button data-own="${k.id}" ${own || this.coins < k.price ? 'disabled' : ''}>${own ? '✓' : `${k.price} 🪙`}</button></div>`;
      }
    } else {
      for (const k of PREMIUM) {
        html += `<div class="item"><div class="emoji">${k.icon}</div><b>${k.name}</b>
          <small>Compra en App Store</small><button data-iap="${k.id}">${k.eur}</button></div>`;
      }
      html += `<p class="note">En la app de iOS estas compras usan el sistema de pago de Apple. En el prototipo no cobran nada.</p>`;
    }
    this.grid.innerHTML = html;
    this.grid.querySelectorAll('[data-buy]').forEach((b) => (b.onclick = () => {
      const it = ITEMS[b.dataset.buy];
      if (this.coins < it.price) return;
      this.coins -= it.price;
      this.stock[b.dataset.buy] += it.pack;
      this.sync();
    }));
    this.grid.querySelectorAll('[data-own]').forEach((b) => (b.onclick = () => {
      const k = KITCHEN.find((q) => q.id === b.dataset.own);
      this.coins -= k.price;
      this.owned.add(k.id);
      this.sync();
    }));
    this.grid.querySelectorAll('[data-iap]').forEach((b) => (b.onclick = () => {
      b.textContent = 'Próximamente';
    }));
    const hi = this.grid.querySelector('.hi');
    if (hi) hi.scrollIntoView({ block: 'center' });
  }
}
