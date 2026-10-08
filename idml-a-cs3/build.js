#!/usr/bin/env node
'use strict';
// Empaqueta el conversor y la interfaz en UN SOLO archivo HTML que funciona sin internet:
//   dist/idml-a-cs3.html        página completa (para guardar y abrir con doble clic)
//   dist/idml-a-cs3.fragmento.html   solo el contenido (para publicarlo como artefacto)
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'src');
const MODULES = ['xml', 'zip', 'geometry', 'props', 'idml', 'jsxgen', 'inx', 'report', 'convert'];

function bundle() {
  const defs = MODULES.map((name) => {
    const code = fs.readFileSync(path.join(SRC, name + '.js'), 'utf8');
    return '__defs[' + JSON.stringify(name) + '] = function (module, exports, require) {\n' + code + '\n};';
  });
  // el texto del script para CS3 va incrustado como cadena
  const runtime = fs.readFileSync(path.join(SRC, 'runtime.jsx'), 'utf8');
  defs.push('__defs["runtime_src"] = function (module) { module.exports = ' + JSON.stringify(runtime) + '; };');
  return '(function (global) {\n"use strict";\nvar __defs = {}, __cache = {};\n' +
    'function __require(name) {\n  name = name.replace(/^\\.\\//, "");\n  if (__cache[name]) { return __cache[name].exports; }\n' +
    '  if (!__defs[name]) { throw new Error("módulo no encontrado: " + name); }\n' +
    '  var m = { exports: {} }; __cache[name] = m; __defs[name](m, m.exports, __require); return m.exports;\n}\n' +
    defs.join('\n') + '\nglobal.IDML2CS3 = __require("convert");\n})(window);\n';
}

function sampleBase64() {
  const { buildIdml } = require('./test/fixture');
  return Buffer.from(buildIdml()).toString('base64');
}

function main() {
  const tpl = fs.readFileSync(path.join(SRC, 'ui.html'), 'utf8');
  const code = bundle().replace(/<\/script/gi, '<\\/script');
  const fragment = tpl.replace('/*__BUNDLE__*/', () => code).replace('__SAMPLE_B64__', () => sampleBase64());
  const full = '<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n</head>\n<body>\n' + fragment + '\n</body>\n</html>\n';
  fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'dist', 'idml-a-cs3.html'), full);
  fs.writeFileSync(path.join(__dirname, 'dist', 'idml-a-cs3.fragmento.html'), fragment);
  console.log('dist/idml-a-cs3.html  ' + Math.round(full.length / 1024) + ' KB');
}

main();
