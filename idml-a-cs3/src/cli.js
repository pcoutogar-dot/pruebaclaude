#!/usr/bin/env node
'use strict';
// Uso:  node src/cli.js documento.idml [-o resultado.zip] [--dir carpeta] [--sin-inx] [--sin-rtf]
const fs = require('fs');
const path = require('path');
const { convert, UserError } = require('./convert');
const { writeZip } = require('./zip');

function main(argv) {
  const args = argv.slice(2);
  if (!args.length || args.includes('-h') || args.includes('--help')) {
    console.log('Uso: node src/cli.js documento.idml [-o resultado.zip] [--dir carpeta] [--sin-inx] [--sin-rtf]');
    return args.length ? 0 : 1;
  }
  let input = null; let outZip = null; let outDir = null;
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-o') outZip = args[++i];
    else if (a === '--dir') outDir = args[++i];
    else if (a === '--sin-inx') opts.inx = false;
    else if (a === '--sin-rtf') opts.rtf = false;
    else input = a;
  }
  if (!input) { console.error('Falta el archivo .idml'); return 1; }
  let res;
  try {
    const bytes = new Uint8Array(fs.readFileSync(input));
    res = convert(bytes, Object.assign({ name: path.basename(input) }, opts));
  } catch (e) {
    console.error((e instanceof UserError ? '' : 'Error: ') + e.message);
    return 2;
  }
  if (outDir) {
    for (const f of res.files) {
      const dest = path.join(outDir, f.name);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, f.data);
    }
    console.log('Carpeta escrita en ' + path.join(outDir, res.folder));
  } else {
    const dest = outZip || (res.folder + '.zip');
    fs.writeFileSync(dest, writeZip(res.files));
    console.log('Escrito ' + dest);
  }
  const s = res.summary;
  console.log(s.pages + ' páginas, ' + s.items + ' objetos, ' + s.stories + ' textos, ' + s.images + ' imágenes.');
  for (const w of s.warnings) console.log(' · ' + w);
  return 0;
}

process.exitCode = main(process.argv);
