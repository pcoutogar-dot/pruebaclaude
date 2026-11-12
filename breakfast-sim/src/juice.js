// "Tacto" del juego: todo es un poco de gelatina y da gusto tocarlo.
//  - jelly(): un objeto se aplasta y rebota con un muelle amortiguado
//  - burst(): chispitas y corazones al conseguir algo
import * as THREE from 'three';

const jellies = new Map();

// kick > 0 = se aplasta primero (como al caer); kick < 0 = se estira (como al cogerlo)
export function jelly(obj, kick = 1) {
  if (!obj) return;
  let j = jellies.get(obj);
  if (!j) {
    j = { base: obj.scale.clone(), x: 0, v: 0 };
    jellies.set(obj, j);
  }
  j.v += 7 * kick;
}

export function updateJelly(dt) {
  const n = Math.max(1, Math.ceil(dt / 0.02)), h = dt / n;
  for (const [obj, j] of jellies) {
    for (let i = 0; i < n; i++) {
      j.v += (-260 * j.x - 11 * j.v) * h;
      j.x += j.v * h;
    }
    j.x = THREE.MathUtils.clamp(j.x, -0.3, 0.3);
    obj.scale.set(j.base.x * (1 + 0.6 * j.x), j.base.y * (1 - j.x), j.base.z * (1 + 0.6 * j.x));
    if (Math.abs(j.x) < 0.002 && Math.abs(j.v) < 0.03) {
      obj.scale.copy(j.base);
      jellies.delete(obj);
    }
  }
}

const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// chispitas en pantalla (x, y en píxeles)
export function burst(x, y, emojis = ['✨', '💛', '🤍', '✨'], n = 8) {
  if (calm) return;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.className = 'burst';
    s.textContent = emojis[i % emojis.length];
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.6, d = 40 + Math.random() * 45;
    s.style.left = `${x}px`;
    s.style.top = `${y}px`;
    s.style.setProperty('--dx', `${Math.cos(a) * d}px`);
    s.style.setProperty('--dy', `${Math.sin(a) * d - 25}px`);
    s.style.setProperty('--r', `${(Math.random() - 0.5) * 90}deg`);
    s.style.animationDelay = `${Math.random() * 0.08}s`;
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 1100);
  }
}
