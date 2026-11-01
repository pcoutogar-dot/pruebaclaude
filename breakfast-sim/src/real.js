// Texturas escaneadas reales (Poly Haven, licencia CC0), comprimidas para móvil.
// Cada una trae color + relieve (normal map) + rugosidad.
import * as THREE from 'three';

const files = import.meta.glob('./tex/*.jpg', { eager: true, import: 'default' });
const loader = new THREE.TextureLoader();
const cache = {};

function load(file, srgb) {
  if (cache[file]) return cache[file];
  const t = loader.load(files[`./tex/${file}.jpg`]);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return (cache[file] = t);
}

// nombre de Poly Haven → { map, normalMap, roughnessMap } con su repetición
export function real(name, repeat = [1, 1], { diff = name, nor = name, rough = name } = {}) {
  const out = {
    map: load(`${diff}_diff`, true).clone(),
    normalMap: load(`${nor}_nor_gl`, false).clone(),
    roughnessMap: load(`${rough}_rough`, false).clone(),
  };
  for (const t of Object.values(out)) {
    t.repeat.set(...repeat);
    t.needsUpdate = true;
  }
  return out;
}
