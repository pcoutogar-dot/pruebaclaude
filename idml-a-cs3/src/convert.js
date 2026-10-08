'use strict';
// Orquesta la conversión: IDML -> carpeta de resultados (script .jsx, INX experimental, textos, informe...).
const { readPackage, buildModel, UserError } = require('./idml');
const { buildScript } = require('./jsxgen');
const { buildInx } = require('./inx');
const R = require('./report');

function safeName(name) {
  const n = String(name || 'documento').replace(/\.(idml|zip)$/i, '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
  return n || 'documento';
}

function convert(bytes, options) {
  options = options || {};
  const date = options.date || new Date();
  const dateStr = date.toISOString().slice(0, 10);
  const pkg = readPackage(bytes, options.zip);
  const nameRaw = String(options.name || 'documento').replace(/\.idml$/i, '');
  const model = buildModel(pkg, { name: nameRaw });
  const folder = safeName(nameRaw) + '_para_CS3';
  const names = { jsx: '1_reconstruir_en_CS3.jsx', inx: options.inx === false ? null : '2_EXPERIMENTAL_documento.inx' };
  const files = [];
  files.push({ name: names.jsx, data: buildScript(model, { date }) });
  let inxStats = null;
  if (names.inx) {
    try {
      const r = buildInx(pkg);
      inxStats = r.stats;
      files.push({ name: names.inx, data: r.text });
    } catch (e) {
      names.inx = null;
      model.warnings.push({ level: 'warn', text: 'No se pudo generar el INX experimental: ' + e.message });
    }
  }
  files.push({ name: 'LEEME.txt', data: R.leeme(model, names, { date: dateStr }) });
  files.push({ name: 'informe.html', data: R.reportHtml(model, { date: dateStr }) });
  files.push(...R.textFiles(model, { rtf: options.rtf !== false }));
  for (const e of model.embedded) files.push({ name: 'imagenes_incrustadas/' + e.name, data: e.bytes });
  const out = files.map((f) => ({ name: folder + '/' + f.name, data: f.data }));
  return {
    folder, files: out, model, inxStats,
    summary: Object.assign({}, model.stats, { warnings: model.warnings.filter((w) => w.level === 'warn').map((w) => w.text) }),
  };
}

module.exports = { convert, safeName, UserError };
