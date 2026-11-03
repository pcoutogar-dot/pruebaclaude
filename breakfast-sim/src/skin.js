// Piel de media aguacate que se pela por donde pasa el dedo.
//
// En vez de celdas (que dejaban bordes pixelados), la piel es una superficie
// lisa y lo que está pegado se define con una máscara de alta resolución:
//  - el desgarro se dibuja con formas suaves e irregulares → bordes orgánicos
//  - la tira que estás tirando es una copia de la piel que solo muestra su zona
//    y se levanta hacia el dedo con algo de retraso (blandita)
//  - al soltar, la tira SIEMPRE se despega y cae (nunca se queda enganchada)
import * as THREE from 'three';

const SEG = 96; // alrededor (media vuelta)
const PTS = 48; // a lo largo
const MW = 1024, MH = 832; // máscara (proporción ≈ superficie real)

// perfil suavizado (curva) a partir de los puntos del aguacate
function smoothProfile(profile) {
  const curve = new THREE.SplineCurve(profile.map(([x, y]) => new THREE.Vector2(x, y)));
  const pts = curve.getSpacedPoints(PTS - 1);
  pts[0].x = 0;
  pts[pts.length - 1].x = 0;
  return pts;
}

// máscaras: opaco = sí, transparente = no (así se pueden "restar" entre ellas)
function maskCanvas(fill) {
  const c = document.createElement('canvas');
  c.width = MW;
  c.height = MH;
  const x = c.getContext('2d', { willReadFrequently: true });
  if (fill) {
    x.fillStyle = fill;
    x.fillRect(0, 0, MW, MH);
  }
  return c;
}

export class Skin {
  constructor(profile, material) {
    this.pts = smoothProfile(profile);
    const geo = new THREE.LatheGeometry(this.pts, SEG, 0, Math.PI);
    this.base = geo.attributes.position.array.slice();
    this.normals = geo.attributes.normal.array.slice();
    this.uv = geo.attributes.uv.array;
    this.count = geo.attributes.position.count;

    // piel pegada: blanco = pegada, negro = ya pelada
    this.attached = maskCanvas('#fff');
    this.attachedTex = new THREE.CanvasTexture(this.attached);
    this.mat = material.clone();
    this.mat.alphaMap = this.attachedTex;
    this.mat.alphaTest = 0.5;
    this.mat.onBeforeCompile = material.onBeforeCompile;
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.castShadow = this.mesh.receiveShadow = true;
    this.mesh.userData.skin = this;

    // tira que se está levantando
    this.stripC = maskCanvas(null);
    this.stripTex = new THREE.CanvasTexture(this.stripC);
    this.stripMat = material.clone();
    this.stripMat.alphaMap = this.stripTex;
    this.stripMat.alphaTest = 0.5;
    this.stripMat.onBeforeCompile = material.onBeforeCompile;
    const sg = geo.clone();
    this.strip = new THREE.Mesh(sg, this.stripMat);
    this.strip.castShadow = true;
    this.strip.visible = false;
    this.strip.frustumCulled = false;
    this.sVal = new Float32Array(this.count).fill(-1); // cuándo entró cada vértice en la tira
    this.reset();
  }

  reset() {
    const a = this.attached.getContext('2d');
    a.globalCompositeOperation = 'source-over';
    a.fillStyle = '#fff';
    a.fillRect(0, 0, MW, MH);
    this.attachedTex.needsUpdate = true;
    this.cur = null;
    this.clearStrip();
    this.vis = null;
  }

  clearStrip() {
    this.stripC.getContext('2d').clearRect(0, 0, MW, MH);
    this.stripTex.needsUpdate = true;
    this.sVal.fill(-1);
    this.strip.geometry.attributes.position.array.set(this.base);
    this.strip.geometry.attributes.position.needsUpdate = true;
    this.strip.visible = false;
  }

  // punto local (espacio del torno) → uv de la piel
  uvOf(p) {
    const phi = THREE.MathUtils.clamp(Math.atan2(p.x, p.z), 0, Math.PI);
    // v: buscar a qué altura del perfil corresponde
    const y = p.y, P = this.pts;
    let v = 0;
    for (let i = 1; i < P.length; i++) {
      if (y <= P[i].y) {
        v = (i - 1 + (y - P[i - 1].y) / Math.max(1e-6, P[i].y - P[i - 1].y)) / (P.length - 1);
        break;
      }
      v = 1;
    }
    return new THREE.Vector2(phi / Math.PI, THREE.MathUtils.clamp(v, 0, 1));
  }

  isAttached(uv) {
    const d = this.attached.getContext('2d').getImageData(uv.x * (MW - 1), (1 - uv.y) * (MH - 1), 1, 1).data;
    return d[3] > 128;
  }

  // empieza a tirar si tocas piel pegada
  begin(uv) {
    if (!this.isAttached(uv)) return false;
    this.cur = { len: 0, shown: 0, last: uv.clone(), finger: null };
    this.strip.visible = true;
    this.stamp(uv, 0.22);
    return true;
  }

  // la tira crece siguiendo el camino del dedo; despacio = más ancha
  extend(uv, speed) {
    const c = this.cur;
    if (!c) return;
    const d = uv.distanceTo(c.last);
    const w = THREE.MathUtils.clamp(0.28 - speed * 0.6, 0.16, 0.28);
    const n = Math.max(1, Math.ceil(d / 0.02));
    for (let k = 1; k <= n; k++) {
      c.len += d / n;
      this.stamp(new THREE.Vector2().lerpVectors(c.last, uv, k / n), w);
    }
    c.last = uv.clone();
  }

  // un "bocado" de piel con borde irregular (varios círculos de tamaños distintos)
  stamp(uv, w) {
    const s = this.stripC.getContext('2d');
    s.fillStyle = '#fff';
    const cx = uv.x * MW, cy = (1 - uv.y) * MH, R = w * MW * 0.5;
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * 6.28, d = R * 0.35 * Math.random();
      s.beginPath();
      s.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d, R * (0.6 + Math.random() * 0.45), R * (0.55 + Math.random() * 0.45), Math.random() * 3, 0, 7);
      s.fill();
    }
    // solo cuenta lo que sigue pegado
    s.globalCompositeOperation = 'destination-in';
    s.drawImage(this.attached, 0, 0);
    s.globalCompositeOperation = 'source-over';
    this.stripTex.needsUpdate = true;
    // vértices que pasan a formar parte de la tira (para levantarlos)
    const uvs = this.uv, r2 = (w * 0.62) ** 2;
    for (let k = 0; k < this.count; k++) {
      if (this.sVal[k] >= 0) continue;
      const du = uvs[k * 2] - uv.x, dv = (uvs[k * 2 + 1] - uv.y) * (MH / MW);
      if (du * du + dv * dv < r2) this.sVal[k] = this.cur.len;
    }
  }

  setFinger(p) {
    if (this.cur) this.cur.finger = p.clone();
  }

  // levanta la tira: lo primero que despegaste se levanta más (va hacia el dedo)
  deform(dt) {
    const c = this.cur;
    if (!c) return;
    c.shown += (c.len + 0.12 - c.shown) * Math.min(1, dt * 8); // retraso blandito
    const pos = this.strip.geometry.attributes.position, a = pos.array, b = this.base, n = this.normals, f = c.finger;
    for (let k = 0; k < this.count; k++) {
      const s = this.sVal[k];
      if (s < 0) continue;
      const l = THREE.MathUtils.smoothstep(c.shown - s, 0, 0.3);
      const l2 = l * l;
      let x = b[k * 3] + n[k * 3] * 0.1 * l, y = b[k * 3 + 1] + n[k * 3 + 1] * 0.1 * l, z = b[k * 3 + 2] + n[k * 3 + 2] * 0.1 * l;
      if (f) {
        x += (f.x - x) * 0.4 * l2;
        y += (f.y - y) * 0.4 * l2;
        z += (f.z - z) * 0.4 * l2;
      }
      a[k * 3] = x;
      a[k * 3 + 1] = y;
      a[k * 3 + 2] = z;
    }
    pos.needsUpdate = true;
    this.strip.geometry.computeVertexNormals();
  }

  // copia "congelada" de una máscara (para el trozo que cae)
  frozen(canvas) {
    const c = document.createElement('canvas');
    c.width = MW / 2;
    c.height = MH / 2;
    c.getContext('2d').drawImage(canvas, 0, 0, MW / 2, MH / 2);
    return new THREE.CanvasTexture(c);
  }

  // suelta la tira: se separa de la piel y devuelve el trozo (geometría + máscara + puntos para la física)
  finish() {
    const c = this.cur;
    if (!c) return null;
    this.deform(1);
    const geo = this.strip.geometry.clone();
    const alpha = this.frozen(this.stripC);
    const pts = [];
    const a = geo.attributes.position.array;
    for (let k = 0; k < this.count; k += 7) if (this.sVal[k] >= 0) pts.push(new THREE.Vector3(a[k * 3], a[k * 3 + 1], a[k * 3 + 2]));
    // quitar esa zona de la piel pegada
    const att = this.attached.getContext('2d');
    att.globalCompositeOperation = 'destination-out';
    att.drawImage(this.stripC, 0, 0);
    att.globalCompositeOperation = 'source-over';
    this.attachedTex.needsUpdate = true;
    this.cur = null;
    this.clearStrip();
    return pts.length ? { geo, alpha, pts } : null;
  }

  // lo que queda pegado se desprende de una vez como un trozo grande
  dropRest() {
    const geo = this.mesh.geometry.clone();
    const alpha = this.frozen(this.attached);
    const pts = [];
    const a = geo.attributes.position.array, img = this.attached.getContext('2d').getImageData(0, 0, MW, MH).data;
    for (let k = 0; k < this.count; k += 9) {
      const px = Math.round(this.uv[k * 2] * (MW - 1)), py = Math.round((1 - this.uv[k * 2 + 1]) * (MH - 1));
      if (img[(py * MW + px) * 4 + 3] > 128) pts.push(new THREE.Vector3(a[k * 3], a[k * 3 + 1], a[k * 3 + 2]));
    }
    this.attached.getContext('2d').clearRect(0, 0, MW, MH);
    this.attachedTex.needsUpdate = true;
    return pts.length ? { geo, alpha, pts } : null;
  }

  // fracción de piel pegada en la parte que se ve desde arriba
  remaining(matrixWorld) {
    if (!this.vis) {
      // qué zonas miran hacia arriba (las únicas que se pueden pelar con el dedo)
      const nm = new THREE.Matrix3().getNormalMatrix(matrixWorld), v = new THREE.Vector3();
      this.vis = [];
      for (let k = 0; k < this.count; k += 5) {
        v.fromArray(this.normals, k * 3).applyMatrix3(nm).normalize();
        if (v.y > 0.55) this.vis.push(k);
      }
    }
    const img = this.attached.getContext('2d').getImageData(0, 0, MW, MH).data;
    let left = 0;
    for (const k of this.vis) {
      const px = Math.round(this.uv[k * 2] * (MW - 1)), py = Math.round((1 - this.uv[k * 2 + 1]) * (MH - 1));
      if (img[(py * MW + px) * 4 + 3] > 128) left++;
    }
    return this.vis.length ? left / this.vis.length : 0;
  }
}
