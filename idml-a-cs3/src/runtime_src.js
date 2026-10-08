'use strict';
// Texto del script que se ejecuta dentro de CS3 (src/runtime.jsx).
// Al empaquetar para el navegador, build.js sustituye este módulo por el texto ya incrustado.
let src = null;
try {
  const fs = require('fs');
  const path = require('path');
  src = fs.readFileSync(path.join(__dirname, 'runtime.jsx'), 'utf8');
} catch (_) { src = null; }
module.exports = src;
