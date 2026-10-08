'use strict';
// Matrices de transformación de IDML: ItemTransform="a b c d tx ty"
//   x' = a*x + c*y + tx ;  y' = b*x + d*y + ty   (eje Y hacia abajo)

const IDENTITY = [1, 0, 0, 1, 0, 0];

function parseMatrix(s) {
  if (!s) return IDENTITY.slice();
  const v = String(s).trim().split(/\s+/).map(Number);
  return v.length === 6 && v.every(Number.isFinite) ? v : IDENTITY.slice();
}

// aplica primero c y luego p  (p · c)
function mul(p, c) {
  return [
    p[0] * c[0] + p[2] * c[1],
    p[1] * c[0] + p[3] * c[1],
    p[0] * c[2] + p[2] * c[3],
    p[1] * c[2] + p[3] * c[3],
    p[0] * c[4] + p[2] * c[5] + p[4],
    p[1] * c[4] + p[3] * c[5] + p[5],
  ];
}

function apply(m, x, y) {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

// Descompone una matriz en rotación/escala/cizalla.
function decompose(m) {
  const sx = Math.hypot(m[0], m[1]);
  const det = m[0] * m[3] - m[1] * m[2];
  const sy = sx === 0 ? 0 : det / sx;
  let theta = Math.atan2(m[1], m[0]);                   // rotación en sentido horario (eje Y abajo)
  const dot = m[0] * m[2] + m[1] * m[3];
  const shear = sx === 0 || sy === 0 ? 0 : dot / (sx * Math.abs(sy));
  if (det < 0) {
    // Con reflejo, la matriz se puede leer como "reflejo en X + giro" o "reflejo en Y + giro":
    // se elige la lectura de menor giro (un simple reflejo horizontal no debe salir como un giro de 180°).
    const tx = Math.atan2(-m[1], -m[0]);
    const ty = Math.atan2(m[1], m[0]);
    theta = Math.abs(tx) <= Math.abs(ty) ? tx : ty;
  }
  return { sx, sy, theta, shear, flipped: det < 0 };
}

function rotatePoint(p, c, phi) {                        // gira p alrededor de c (matriz con Y abajo)
  const cs = Math.cos(phi); const sn = Math.sin(phi);
  const dx = p[0] - c[0]; const dy = p[1] - c[1];
  return [c[0] + cs * dx - sn * dy, c[1] + sn * dx + cs * dy];
}

function bbox(points) {
  let x1 = Infinity; let y1 = Infinity; let x2 = -Infinity; let y2 = -Infinity;
  for (const p of points) {
    if (p[0] < x1) x1 = p[0]; if (p[0] > x2) x2 = p[0];
    if (p[1] < y1) y1 = p[1]; if (p[1] > y2) y2 = p[1];
  }
  return { x1, y1, x2, y2 };
}

// Ángulo en grados, sentido antihorario visual (el que muestra InDesign), en (-180, 180].
function uiAngle(theta) {
  let a = -theta * 180 / Math.PI;
  while (a > 180) a -= 360;
  while (a <= -180) a += 360;
  return Math.abs(a) < 1e-6 ? 0 : a;
}

function round(v, d) {
  const f = Math.pow(10, d === undefined ? 4 : d);
  const r = Math.round(v * f) / f;
  return Object.is(r, -0) ? 0 : r;
}

module.exports = { IDENTITY, parseMatrix, mul, apply, decompose, rotatePoint, bbox, uiAngle, round };
