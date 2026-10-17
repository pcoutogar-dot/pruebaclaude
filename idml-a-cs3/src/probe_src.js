'use strict';
// Texto del script de comprobación que se ejecuta dentro de CS3 (src/probe.jsx).
// Al empaquetar para el navegador, build.js sustituye este módulo por el texto ya incrustado.
let src = null;
try {
  const fs = require('fs');
  const path = require('path');
  src = fs.readFileSync(path.join(__dirname, 'probe.jsx'), 'utf8');
} catch (_) { src = null; }
module.exports = src;
