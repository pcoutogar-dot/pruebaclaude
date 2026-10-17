// ============================================================================
//  Reconstructor para InDesign CS3  (se ejecuta DENTRO de InDesign CS3)
//  Lee la variable DATA (definida arriba) y crea un documento nuevo con las
//  páginas, colores, estilos, textos e imágenes del original.
//  Código en ES3 (el JavaScript de ExtendScript): sin let/const/flechas/JSON.
// ============================================================================

if (typeof DIAG === "undefined") { var DIAG = false; }     // modo paso a paso (lo define la cabecera del script)
if (typeof CONVERTER === "undefined") { var CONVERTER = "?"; }
var LOG = [];            // avisos
var PROPFAIL = {};       // propiedades que CS3 rechazó (cuántas veces)
var PROPERR = {};        // el primer mensaje de error de cada una
var MISSING_FONTS = {};
var MISSING_IMAGES = [];
var TRACE = [];          // fases (y pasos, en modo diagnóstico) ya hechos: si InDesign se cuelga, se ve dónde
var T0 = new Date().getTime();
var DOC = null;
var LAY = {}, SW = {}, PS = {}, CS = {}, MS = {}, FR = {}, MI = {};
var STAT = { items: 0, stories: 0, images: 0, tables: 0 };
var LOCKED = [];         // objetos que se bloquean al final (un objeto bloqueado ya no se puede tocar)
var SCRIPT_FOLDER = null;
var IDX = null;
var IDX_COUNT = 0;
var INSTALLED = null;
var LOGPATH = null;
var FINISHED = false;
var OLD = {};
var G_ = null;
try { G_ = $.global; } catch (e0) { G_ = this; }

var SEEN = {};
function log(m) { if (!SEEN.hasOwnProperty(m)) { SEEN[m] = true; LOG.push(m); } }
// texto corto de un error (el mensaje real de CS3 es lo más útil para corregir el conversor)
function errText(e) {
  var m = "";
  try { m = (e && e.message !== undefined) ? String(e.message) : String(e); } catch (x) { m = "?"; }
  try { if (e && e.number) { m += " [error " + e.number + "]"; } } catch (x1) { }
  m = m.replace(/[\r\n]+/g, " ");
  if (m.length > 170) { m = m.substring(0, 170) + "..."; }
  return m;
}
function failProp(what, key, err) {
  var k = what + "." + key;
  PROPFAIL[k] = (PROPFAIL[k] || 0) + 1;
  if (err !== undefined && !PROPERR.hasOwnProperty(k)) { PROPERR[k] = errText(err); }
}
function inArray(a, v) { var i; for (i = 0; i < a.length; i++) { if (a[i] === v) { return true; } } return false; }
function keysOf(o) { var r = [], k; for (k in o) { if (o.hasOwnProperty(k)) { r.push(k); } } return r; }

// ---- seguimiento: cada fase queda anotada en el registro del Escritorio
function secs() { return Math.round((new Date().getTime() - T0) / 100) / 10; }
function trace(m) { TRACE.push(secs() + " s  " + m); }
// pasos finos: solo en modo diagnóstico (DIAG), y con el registro guardado en cada uno por si InDesign se cuelga
function step(m) { if (DIAG) { trace("   " + m); flushLog(); } }

// ---------------------------------------------------------------- enumeraciones
// CS3 llama a las constantes en camelCase (leftAlign); versiones posteriores en MAYUSCULAS (LEFT_ALIGN).
function cls(name) {
  var c;
  try { c = G_[name]; if (c !== undefined) { return c; } } catch (e) { }
  try { return eval(name); } catch (e2) { }
  return null;
}
var ENUM_CACHE = {};
function squash(t) { return String(t).replace(/_/g, "").toLowerCase(); }
// último recurso: recorrer las constantes de la clase y comparar sin mayúsculas ni guiones bajos
function scanEnum(C, v) {
  var want = squash(v), k, list, i, n;
  try { for (k in C) { if (squash(k) === want) { return C[k]; } } } catch (e) { }
  try {
    list = C.reflect.properties;
    for (i = 0; i < list.length; i++) { n = list[i].name; if (squash(n) === want) { return C[n]; } }
  } catch (e1) { }
  return undefined;
}
function en(c, v) {
  var C = cls(c), a, b, r, key;
  if (!C || v === undefined || v === null) { return undefined; }
  key = c + "." + v;
  if (ENUM_CACHE.hasOwnProperty(key)) { return ENUM_CACHE[key]; }
  a = v.charAt(0).toLowerCase() + v.substring(1);
  b = v.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/([A-Z])([A-Z][a-z])/g, "$1_$2").toUpperCase();
  try { r = C[a]; } catch (e) { }
  if (r === undefined) { try { r = C[b]; } catch (e1) { } }
  if (r === undefined) { try { r = C[v]; } catch (e2) { } }
  if (r === undefined) { try { r = C[v.toLowerCase()]; } catch (e3) { } }
  if (r === undefined) { r = scanEnum(C, v); }
  ENUM_CACHE[key] = r;
  return r;
}

// ---------------------------------------------------------------- muestras y estilos
// Las muestras de fábrica (Ninguno, Papel, Negro, Registro) se reconocen por lo que son y no por su nombre,
// que cambia según el idioma de InDesign.
var BUILT = {};
function findBuiltins() {
  var cols, i, c, v, s, reg = en("ColorModel", "Registration");
  try {
    cols = DOC.colors;
    for (i = 0; i < cols.length; i++) {
      c = cols.item(i);
      try {
        if (reg !== undefined && c.model == reg) { if (!BUILT.Registration) { BUILT.Registration = c; } continue; }
        v = c.colorValue;
        if (v && v.length === 4 && v[0] === 0 && v[1] === 0 && v[2] === 0) {
          if (v[3] === 100 && !BUILT.Black) { BUILT.Black = c; }
          if (v[3] === 0 && !BUILT.Paper) { BUILT.Paper = c; }
        }
      } catch (e1) { }
    }
  } catch (e) { }
  try {
    for (i = 0; i < DOC.swatches.length; i++) {
      s = DOC.swatches.item(i);
      if (s.reflect.name === "Swatch") { BUILT.None = s; break; }
    }
  } catch (e2) { }
}

function swatch(name) {
  var s = null;
  if (SW.hasOwnProperty(name)) { return SW[name]; }
  if (BUILT[name]) { SW[name] = BUILT[name]; return SW[name]; }
  try { s = DOC.swatches.item(name); s.name; } catch (e) { s = null; }
  if (!s && name === "None") { try { s = DOC.swatches.item(0); s.name; } catch (e1) { s = null; } }
  if (!s) { try { s = DOC.colors.item(name); s.name; } catch (e2) { s = null; } }
  SW[name] = s;
  if (!s) { log("No se encontró la muestra de color \"" + name + "\"."); }
  return s;
}

function dec(v) {
  var t;
  if (v === null || v === undefined || typeof v !== "object") { return v; }
  t = v[0];
  if (typeof t !== "string") { return v; }     // lista de numeros
  if (t === "e") { return en(v[1], v[2]); }
  if (t === "sw") { return swatch(v[1]); }
  return v;
}

// INSTALLED[familia][estilo] = posición de esa fuente en app.fonts
function loadInstalledFonts() {
  var all, fams, stys, i;
  INSTALLED = {};
  try {
    all = app.fonts.everyItem();
    fams = all.fontFamily;
    stys = all.fontStyleName;
    for (i = 0; i < fams.length; i++) {
      if (!INSTALLED[fams[i]]) { INSTALLED[fams[i]] = {}; }
      INSTALLED[fams[i]][stys[i]] = i;
    }
  } catch (e) { INSTALLED = null; }
}

function pickFont(fam, style) {
  var st, k, idx;
  if (!INSTALLED) { return null; }
  st = INSTALLED[fam];
  if (!st) { return null; }
  idx = (style && st[style] !== undefined) ? st[style] : undefined;
  if (idx === undefined) {
    if (style) { log("La fuente \"" + fam + "\" no tiene el estilo \"" + style + "\" en este ordenador; se usa otro."); }
    if (st["Regular"] !== undefined) { idx = st["Regular"]; }
    else { for (k in st) { if (st.hasOwnProperty(k)) { idx = st[k]; break; } } }
  }
  return app.fonts.item(idx);
}

function setFont(t, family, style) {
  var fam = FONT_SUBSTITUTIONS[family] || family, ok = false, f;
  if (INSTALLED && !INSTALLED[fam]) { MISSING_FONTS[family] = true; return false; }
  try { f = pickFont(fam, style); if (f) { t.appliedFont = f; ok = true; } } catch (e) { }
  if (!ok) { try { f = app.fonts.item(fam + "\t" + (style || "Regular")); f.name; t.appliedFont = f; ok = true; } catch (e1) { } }
  if (!ok) { try { t.appliedFont = fam; ok = true; } catch (e2) { } }
  if (!ok) { MISSING_FONTS[family] = true; return false; }
  if (style) { try { t.fontStyle = style; } catch (e3) { } }
  return true;
}

function setTabs(t, tabs) {
  var i, x;
  for (i = 0; i < tabs.length; i++) {
    x = tabs[i];
    try {
      t.tabStops.add({ alignment: en("TabStopAlignment", x.alignment), position: x.position, leader: x.leader, alignmentCharacter: x.alignmentCharacter });
    } catch (e) { failProp("tabs", "tabStops", e); }
  }
}

function applyProps(t, p, what) {
  var k, val, hadFont = false;
  if (!p) { return; }
  if (p.appliedFont !== undefined) { hadFont = true; setFont(t, p.appliedFont, p.fontStyle); }
  for (k in p) {
    if (!p.hasOwnProperty(k)) { continue; }
    if (k === "appliedFont") { continue; }
    if (k === "fontStyle" && hadFont) { continue; }
    if (k === "tabStops") { setTabs(t, p[k]); continue; }
    if (k === "locked") { LOCKED.push(t); continue; }
    if (k === "bulletChar") {
      try {
        t.bulletChar.bulletCharacterType = en("BulletCharacterType", p[k].type);
        t.bulletChar.bulletCharacterValue = p[k].value;
      } catch (eb) { failProp(what, "bulletChar", eb); }
      continue;
    }
    try {
      val = dec(p[k]);
      if (val === undefined || val === null) { continue; }
      if (k === "opacity") { t.transparencySettings.blendingSettings.opacity = val; continue; }
      t[k] = val;
    } catch (e) {
      if (k === "topLeftCornerOption" || k === "topLeftCornerRadius") {
        // versiones con una sola opcion de esquina para los cuatro vertices
        try { t[k === "topLeftCornerOption" ? "cornerOption" : "cornerRadius"] = val; continue; } catch (e1) { }
      }
      if (k.indexOf("Corner") > 0 && k.indexOf("topLeft") !== 0) { continue; }
      failProp(what, k, e);
    }
  }
}

function setWrapMode(target, v) {
  var val = dec(v), names = ["TextWrapTypes", "TextWrapType", "TextWrapModes"], i;
  if (val !== undefined) { try { target.textWrapMode = val; return; } catch (e) { } }
  for (i = 0; i < names.length; i++) {
    val = en(names[i], v[2]);
    if (val !== undefined) { target.textWrapType = val; return; }
  }
  throw new Error("CS3 no tiene ninguna de las propiedades de ajuste de texto probadas (" + names.join(", ") + ")");
}

function applyPrefs(target, p, what) {
  var k, val;
  if (!p) { return; }
  for (k in p) {
    if (!p.hasOwnProperty(k)) { continue; }
    try {
      if (k === "textWrapMode") { setWrapMode(target, p[k]); continue; }
      val = dec(p[k]);
      if (val !== undefined && val !== null) { target[k] = val; }
    } catch (e) { failProp(what, k, e); }
  }
}

// ---------------------------------------------------------------- documento
function setupDocument() {
  var d = DATA.doc, vp, dp, mp;
  DOC = app.documents.add();
  trace("documento nuevo creado");
  vp = DOC.viewPreferences;
  try { vp.horizontalMeasurementUnits = en("MeasurementUnits", "Points"); vp.verticalMeasurementUnits = en("MeasurementUnits", "Points"); } catch (e) { log("No se pudieron fijar las unidades en puntos: " + errText(e)); }
  try { vp.rulerOrigin = en("RulerOrigin", "SpreadOrigin"); } catch (e1) { log("No se pudo fijar el origen de reglas: " + errText(e1)); }
  try { DOC.zeroPoint = [0, 0]; } catch (e1z) { }
  dp = DOC.documentPreferences;
  try { dp.facingPages = d.facing; } catch (e2) { log("No se pudo fijar las páginas enfrentadas: " + errText(e2)); }
  try { dp.pageWidth = d.w; dp.pageHeight = d.h; } catch (e3) { log("No se pudo fijar el tamaño de página: " + errText(e3)); }
  try { dp.pageBinding = en("PageBindingOptions", d.binding); } catch (e4) {
    if (d.binding !== "LeftToRight") { log("CS3 no deja cambiar desde un script la encuadernación de derecha a izquierda: hazlo en Archivo > Ajustar documento."); }
  }
  try { dp.startPageNumber = d.startPage; } catch (e5) {
    if (d.startPage !== 1) {
      try { DOC.sections.item(0).continueNumbering = false; DOC.sections.item(0).pageNumberStart = d.startPage; }
      catch (e5b) { log("No se pudo fijar el número de la primera página (" + d.startPage + "): " + errText(e5b)); }
    }
  }
  try {
    dp.documentBleedUniformSize = false;
    dp.documentBleedTopOffset = d.bleed.top; dp.documentBleedBottomOffset = d.bleed.bottom;
    dp.documentBleedInsideOrLeftOffset = d.bleed.inside; dp.documentBleedOutsideOrRightOffset = d.bleed.outside;
  } catch (e6) { log("No se pudo fijar el sangrado: " + errText(e6)); }
  try {
    dp.documentSlugUniformSize = false;
    dp.slugTopOffset = d.slug.top; dp.slugBottomOffset = d.slug.bottom;
    dp.slugInsideOrLeftOffset = d.slug.inside; dp.slugRightOrOutsideOffset = d.slug.outside;
  } catch (e7) { }
  if (d.grid) {
    try { DOC.gridPreferences.baselineStart = d.grid.start; DOC.gridPreferences.baselineDivision = d.grid.division; }
    catch (e7b) { log("No se pudo fijar la cuadrícula de líneas base: " + errText(e7b)); }
  }
  mp = DOC.marginPreferences;
  try { mp.top = d.margins.top; mp.bottom = d.margins.bottom; mp.left = d.margins.left; mp.right = d.margins.right; mp.columnCount = d.margins.columns; mp.columnGutter = d.margins.gutter; } catch (e8) { log("No se pudieron fijar los márgenes del documento: " + errText(e8)); }
}

function buildLayers() {
  var L = DATA.layers, i, lyr;
  if (!L.length) { return; }
  for (i = L.length - 1; i >= 0; i--) {
    try {
      if (i === L.length - 1) { lyr = DOC.layers.item(0); lyr.name = L[i].n; } else { lyr = DOC.layers.add({ name: L[i].n }); }
      LAY[L[i].id] = lyr;
    } catch (e) { log("No se pudo crear la capa \"" + L[i].n + "\": " + errText(e)); }
  }
  // la primera capa de IDML es la de mas arriba
  for (i = L.length - 1; i >= 0; i--) {
    try { if (LAY[L[i].id]) { LAY[L[i].id].move(en("LocationOptions", "AtBeginning")); } } catch (e1) { log("No se pudo ordenar las capas: " + errText(e1)); break; }
  }
}

function addColor(c) {
  var p = { name: c.n }, m = en("ColorModel", c.m), sp = en("ColorSpace", c.s), col;
  if (m !== undefined) { p.model = m; }
  if (sp !== undefined) { p.space = sp; }
  p.colorValue = c.v;
  try { return DOC.colors.add(p); } catch (e) {
    // alternativa: crear el color vacío y darle los valores uno a uno
    col = DOC.colors.add();
    col.name = c.n;
    if (m !== undefined) { col.model = m; }
    if (sp !== undefined) { col.space = sp; }
    col.colorValue = c.v;
    return col;
  }
}

function buildColors() {
  var C = DATA.colors, T = DATA.tints, Gd = DATA.grads, i, c, g, j, st, col, gr;
  for (i = 0; i < C.length; i++) {
    c = C[i];
    step("color " + c.n);
    try { addColor(c); } catch (e) {
      try { DOC.colors.item(c.n).name; } catch (e1) { log("No se pudo crear el color \"" + c.n + "\": " + errText(e)); }
    }
  }
  for (i = 0; i < T.length; i++) {
    step("tono " + T[i].n);
    try {
      DOC.tints.add(swatch(T[i].b), { name: T[i].n, tintValue: T[i].v });     // CS3: el color base es el primer argumento
    } catch (e2) {
      try { DOC.tints.add({ name: T[i].n, baseColor: swatch(T[i].b), tintValue: T[i].v }); }   // versiones posteriores
      catch (e2b) { log("No se pudo crear el tono \"" + T[i].n + "\": " + errText(e2) + " / " + errText(e2b)); }
    }
  }
  for (i = 0; i < Gd.length; i++) {
    g = Gd[i];
    step("degradado " + g.n);
    try {
      gr = DOC.gradients.add({ name: g.n, type: en("GradientType", g.t) });
      for (j = 0; j < g.st.length; j++) {
        st = g.st[j];
        col = swatch(st.c);
        if (j >= gr.gradientStops.length) { gr.gradientStops.add({ stopColor: col, location: st.l }); }
        else { gr.gradientStops.item(j).stopColor = col; gr.gradientStops.item(j).location = st.l; }
      }
    } catch (e3) { log("No se pudo crear el degradado \"" + g.n + "\": " + errText(e3)); }
  }
}

function buildStyles() {
  var ps = DATA.ps, cs = DATA.cs, i, s, basicP = null, noneP = null, noneC = null;
  try { noneP = DOC.paragraphStyles.item(0); basicP = DOC.paragraphStyles.item(1); basicP.name; } catch (e) { basicP = noneP; }
  try { noneC = DOC.characterStyles.item(0); } catch (e1) { }
  for (i = 0; i < ps.length; i++) {
    s = ps[i];
    if (s.k === "none") { PS[s.id] = noneP; continue; }
    if (s.k === "basic") { PS[s.id] = basicP; continue; }
    try { PS[s.id] = DOC.paragraphStyles.add({ name: s.n }); } catch (e2) { try { PS[s.id] = DOC.paragraphStyles.item(s.n); PS[s.id].name; } catch (e3) { log("No se pudo crear el estilo de párrafo \"" + s.n + "\": " + errText(e2)); } }
  }
  for (i = 0; i < cs.length; i++) {
    s = cs[i];
    if (s.k === "none") { CS[s.id] = noneC; continue; }
    try { CS[s.id] = DOC.characterStyles.add({ name: s.n }); } catch (e4) { try { CS[s.id] = DOC.characterStyles.item(s.n); CS[s.id].name; } catch (e5) { log("No se pudo crear el estilo de carácter \"" + s.n + "\": " + errText(e4)); } }
  }
  for (i = 0; i < ps.length; i++) {
    s = ps[i];
    if (!PS[s.id] || s.k === "none") { continue; }
    step("estilo de párrafo " + s.n);
    applyProps(PS[s.id], s.p, "estilo");
    try { if (s.b && PS[s.b] && s.k !== "basic") { PS[s.id].basedOn = PS[s.b]; } } catch (e6) { failProp("estilo", "basedOn", e6); }
    try { if (s.nx && PS[s.nx]) { PS[s.id].nextStyle = PS[s.nx]; } } catch (e7) { failProp("estilo", "nextStyle", e7); }
  }
  for (i = 0; i < cs.length; i++) {
    s = cs[i];
    if (!CS[s.id] || s.k === "none") { continue; }
    step("estilo de carácter " + s.n);
    applyProps(CS[s.id], s.p, "estilo");
    try { if (s.b && CS[s.b]) { CS[s.id].basedOn = CS[s.b]; } } catch (e8) { failProp("estilo", "basedOn", e8); }
  }
}

// ---------------------------------------------------------------- objetos
function applyMargins(page, m) {
  var mp;
  try {
    mp = page.marginPreferences;
    mp.top = m.top; mp.bottom = m.bottom; mp.left = m.left; mp.right = m.right;
    mp.columnCount = m.columns; mp.columnGutter = m.gutter;
  } catch (e) { failProp("página", "márgenes", e); }
}

function setPath(o, g) {
  var i, pts = g.pts, arr = [], pp;
  for (i = 0; i < pts.length; i++) { arr.push([pts[i][0], pts[i][1]]); }
  o.paths.item(0).entirePath = arr;
  if (g.open) { try { o.paths.item(0).pathType = en("PathType", "OpenPath"); } catch (e) { } }
  for (i = 0; i < pts.length; i++) {
    if (pts[i].length > 2) {
      try {
        pp = o.paths.item(0).pathPoints.item(i);
        pp.leftDirection = [pts[i][2], pts[i][3]];
        pp.rightDirection = [pts[i][4], pts[i][5]];
      } catch (e2) { failProp("trazado", "curvas", e2); }
    }
  }
}

function rotateItem(o, angle) {
  var ok = false, d, m, last = null;
  try {
    o.rotationAngle = angle;
    d = (o.rotationAngle - angle) % 360;
    if (Math.abs(d) < 0.5 || Math.abs(d - 360) < 0.5 || Math.abs(d + 360) < 0.5) { ok = true; }
  } catch (e) { last = e; }
  if (!ok) {
    try {
      m = app.transformationMatrices.add({ counterclockwiseRotationAngle: angle });
      o.transform(en("CoordinateSpaces", "PasteboardCoordinates"), en("AnchorPoint", "CenterAnchor"), m);
      ok = true;
    } catch (e1) { last = e1; }
  }
  if (!ok) { try { o.rotate(angle); ok = true; } catch (e2) { last = e2; } }
  if (!ok) { failProp("objeto", "rotación", last); }
}

function indexFolder(fold, depth) {
  var list, i, f, n;
  if (IDX_COUNT > 30000) { return; }      // por si eligen una carpeta enorme (p. ej. todo el disco)
  try { list = fold.getFiles(); } catch (e) { return; }
  for (i = 0; i < list.length; i++) {
    f = list[i];
    if (f instanceof Folder) { if (depth < 6) { indexFolder(f, depth + 1); } }
    else { n = f.name; try { n = decodeURI(n); } catch (e1) { } IDX[n.toLowerCase()] = f; IDX_COUNT++; }
  }
}

function findImage(img) {
  var f, key;
  if (img.uri) { try { f = new File(img.uri); if (f.exists) { return f; } } catch (e) { } }
  if (!IDX) { IDX = {}; if (SCRIPT_FOLDER) { indexFolder(SCRIPT_FOLDER, 0); } }
  key = (img.saved || img.name || "").toLowerCase();
  if (key && IDX[key]) { return IDX[key]; }
  return null;
}

function askImagesFolder() {
  var needed = 0, missing = 0, sp, i, j, items, x;
  function scan(list) {
    var k, it;
    for (k = 0; k < list.length; k++) {
      it = list[k];
      if (it.kids) { scan(it.kids); }
      if (it.img && it.img.name) { needed++; if (!findImage(it.img)) { missing++; } }
    }
  }
  for (i = 0; i < DATA.spreads.length; i++) { scan(DATA.spreads[i].items); }
  if (missing === 0) { return; }
  var level = null;
  try { level = app.scriptPreferences.userInteractionLevel; app.scriptPreferences.userInteractionLevel = en("UserInteractionLevels", "InteractWithAll"); } catch (e0) { }
  try {
    if (confirm("No se encuentran " + missing + " de " + needed + " imágenes enlazadas.\n\nAhora puedes elegir la carpeta donde están: la carpeta descomprimida si has metido ahí las imágenes (y la carpeta imagenes_incrustadas), o la carpeta Links del documento original.\n\nSi pulsas No, se crearán los marcos vacíos.")) {
      x = Folder.selectDialog("Elige la carpeta con las imágenes");
      if (x) { indexFolder(x, 0); }
    }
  } catch (e) { }
  try { if (level !== null) { app.scriptPreferences.userInteractionLevel = level; } } catch (e1) { }
}

function placeImage(o, it) {
  var img = it.img, f = findImage(img), res, gr;
  if (!img.name && !img.saved) { return; }
  if (!f) { MISSING_IMAGES.push(img.name || img.saved); try { o.label = "FALTA: " + (img.name || img.saved); } catch (e0) { } return; }
  step("imagen " + (img.name || img.saved));
  try {
    if (img.page) { try { app.pdfPlacePreferences.pageNumber = img.page; } catch (e1) { } }
    res = o.place(f);
    gr = (res && res.length) ? res[0] : o.graphics.item(0);
    if (img.b) { gr.geometricBounds = img.b; }
    else {
      try { o.fit(en("FitOptions", "FillProportionally")); }
      catch (e2) { try { o.fit(en("FitOptions", "Proportionally")); } catch (e2b) { } }
    }
    STAT.images++;
  } catch (e) {
    MISSING_IMAGES.push((img.name || img.saved) + " (error al colocarla)");
    log("No se pudo colocar la imagen \"" + (img.name || img.saved) + "\": " + errText(e));
  }
}

// add({geometricBounds}) es la forma habitual; si CS3 no la acepta, se crea y luego se coloca
function addItem(coll, b) {
  var o;
  try { return coll.add({ geometricBounds: b }); } catch (e) { }
  o = coll.add();
  o.geometricBounds = b;
  return o;
}

function createItem(it, page, isMaster) {
  var o = null, g = it.g, kind = it.t, kids, i, k, arr = [];
  if (kind === "group") {
    for (i = 0; i < it.kids.length; i++) { k = createItem(it.kids[i], page, isMaster); if (k) { arr.push(k); } }
    if (arr.length < 2) { return arr.length ? arr[0] : null; }
    try { o = page.groups.add(arr); } catch (e) { log("No se pudo agrupar objetos: " + errText(e)); return arr[0]; }
    return o;
  }
  step("objeto " + it.id + " (" + kind + ")");
  try {
    if (kind === "text") { o = addItem(page.textFrames, g.b); }
    else if (kind === "rect") { o = addItem(page.rectangles, g.b); }
    else if (kind === "oval") { o = addItem(page.ovals, g.b); }
    else if (kind === "poly") { o = addItem(page.polygons, g.b); }
    else if (kind === "line") { o = addItem(page.graphicLines, g.b); }
  } catch (e1) { failProp("objeto", "crear " + kind, e1); return null; }
  if (!o) { return null; }
  STAT.items++;
  if (it.layer && LAY[it.layer]) { try { o.itemLayer = LAY[it.layer]; } catch (e2) { failProp("objeto", "capa", e2); } }
  if (g.m === "p") { try { setPath(o, g); } catch (e3) { failProp("objeto", "trazado", e3); } }
  applyProps(o, it.props, "objeto");
  if (it.tfp) { try { applyPrefs(o.textFramePreferences, it.tfp, "marco"); } catch (e4) { failProp("marco", "preferencias", e4); } }
  if (it.wrap) { try { applyPrefs(o.textWrapPreferences, it.wrap, "ajuste"); } catch (e5) { failProp("ajuste", "preferencias", e5); } }
  if (kind === "text") { FR[it.id] = o; }
  if (it.img) { placeImage(o, it); }
  if (g.r) { rotateItem(o, g.r); }
  if (isMaster) { MI[it.id] = o; }
  return o;
}

function buildMasters() {
  var M = DATA.masters, i, j, m, obj, pg;
  for (i = 0; i < M.length; i++) {
    m = M[i];
    try { obj = (i === 0) ? DOC.masterSpreads.item(0) : DOC.masterSpreads.add(); } catch (e) { log("No se pudo crear la maestra " + m.n + ": " + errText(e)); continue; }
    try { obj.namePrefix = m.pre; } catch (e1) { }
    try { obj.baseName = m.base; } catch (e2) { }
    MS[m.id] = obj;
    if (obj.pages.length !== m.pages.length) { log("La maestra \"" + m.n + "\" tiene " + m.pages.length + " páginas y en CS3 quedó con " + obj.pages.length + "."); }
    for (j = 0; j < m.pages.length && j < obj.pages.length; j++) { applyMargins(obj.pages.item(j), m.pages[j].m); }
  }
  for (i = 0; i < M.length; i++) {
    if (M[i].am && MS[M[i].am] && MS[M[i].id]) { try { MS[M[i].id].appliedMaster = MS[M[i].am]; } catch (e3) { failProp("maestra", "basada en otra", e3); } }
  }
  for (i = 0; i < M.length; i++) {
    m = M[i]; obj = MS[m.id];
    if (!obj) { continue; }
    for (j = 0; j < m.items.length; j++) {
      pg = obj.pages.item(Math.min(m.items[j].p || 0, obj.pages.length - 1));
      createItem(m.items[j], pg, true);
    }
  }
}

function buildPages() {
  var P = DATA.pages, i, pg, p, n = P.length, ov, j, mi, c, guard = 0, firstErr = null;
  while (DOC.pages.length < n && guard < n + 5) {
    try { DOC.pages.add(); } catch (eAdd) { firstErr = eAdd; break; }
    guard++;
  }
  if (DOC.pages.length < n) {
    log("Solo se pudieron crear " + DOC.pages.length + " de " + n + " páginas" + (firstErr ? ": " + errText(firstErr) : "") + ".");
    n = DOC.pages.length;
  }
  trace(n + " páginas en el documento");
  for (i = 0; i < n; i++) {
    p = P[i]; pg = DOC.pages.item(i);
    try {
      if (p.master && MS[p.master]) { pg.appliedMaster = MS[p.master]; }
      else { try { pg.appliedMaster = en("NothingEnum", "Nothing"); } catch (e0) { pg.appliedMaster = null; } }
    } catch (e) { log("No se pudo aplicar la maestra a la página " + p.label + ": " + errText(e)); }
    applyMargins(pg, p.m);
  }
  // comprobar que los pliegos coinciden con los originales
  for (i = 0; i < DATA.spreads.length; i++) {
    try {
      if (DOC.pages.item(DATA.spreads[i].pages[0]).parent.pages.length !== DATA.spreads[i].pages.length) {
        log("El pliego " + (i + 1) + " no se ha formado igual que en el original; los objetos pueden quedar descolocados.");
      }
    } catch (e1) { }
  }
  // objetos de la maestra que en el original estaban "sustituidos" en esa pagina
  for (i = 0; i < n; i++) {
    p = P[i];
    for (j = 0; j < p.ovr.length; j++) {
      mi = MI[p.ovr[j]];
      if (!mi) { continue; }
      try { c = mi.override(DOC.pages.item(i)); c.remove(); } catch (e2) { failProp("maestra", "sustitución", e2); }
    }
  }
}

function buildSpreads() {
  var S = DATA.spreads, i, j, sp, pg;
  for (i = 0; i < S.length; i++) {
    sp = S[i];
    for (j = 0; j < sp.items.length; j++) {
      try {
        pg = DOC.pages.item(sp.pages[Math.min(sp.items[j].p || 0, sp.pages.length - 1)]);
        createItem(sp.items[j], pg, false);
      } catch (e) { failProp("objeto", "página", e); }
    }
  }
}

// ---------------------------------------------------------------- textos
var SPECIAL = { 7: "IndentHereTab", 8: "RightIndentTab", 23: "PreviousPageNumber", 24: "AutoPageNumber", 25: "NextPageNumber" };

function hasMarkers(t) { return /[\u0007\u0008\u0017\u0018\u0019]/.test(t); }

function setText(container, text, frame) {
  var i, last = 0, ch, v;
  if (!hasMarkers(text)) {
    try { container.contents = text; } catch (e) { if (frame) { frame.contents = text; } else { throw e; } }
    return;
  }
  try { container.contents = ""; } catch (e0) { if (frame) { frame.contents = ""; } else { throw e0; } }
  for (i = 0; i < text.length; i++) {
    ch = text.charCodeAt(i);
    if (SPECIAL[ch]) {
      if (i > last) { container.insertionPoints[-1].contents = text.substring(last, i); }
      v = en("SpecialCharacters", SPECIAL[ch]);
      if (v !== undefined) { container.insertionPoints[-1].contents = v; }
      last = i + 1;
    }
  }
  if (last < text.length) { container.insertionPoints[-1].contents = text.substring(last); }
}

function rangeOf(container, s, e) {
  var n = container.characters.length;
  if (n === 0) { return null; }
  if (e > n) { e = n; }
  if (s >= e) { return null; }
  return container.characters.itemByRange(s, e - 1);
}

function applyPStyle(rng, st) { try { rng.appliedParagraphStyle = st; } catch (e) { rng.applyParagraphStyle(st, false); } }
function applyCStyle(rng, st) { try { rng.appliedCharacterStyle = st; } catch (e) { rng.applyCharacterStyle(st, false); } }

function applyRanges(container, pr, cr) {
  var i, r, rng, st;
  for (i = 0; i < pr.length; i++) {
    r = pr[i];
    try {
      rng = rangeOf(container, r[0], r[1]);
      if (!rng) { continue; }
      st = PS[r[2]];
      if (st) { applyPStyle(rng, st); }
      if (r[3]) { applyProps(rng, r[3], "párrafo"); }
    } catch (e) { failProp("párrafo", "estilo", e); }
  }
  for (i = 0; i < cr.length; i++) {
    r = cr[i];
    try {
      rng = rangeOf(container, r[0], r[1]);
      if (!rng) { continue; }
      st = r[2] ? CS[r[2]] : null;
      if (st) { applyCStyle(rng, st); }
      if (r[3]) { applyProps(rng, r[3], "carácter"); }
    } catch (e1) { failProp("carácter", "estilo", e1); }
  }
}

function buildTable(story, t) {
  var tbl, i, c, cell, ip, total, bodyRows, rows, other, anchor;
  step("tabla de " + t.rows + "x" + t.cols);
  try {
    total = story.insertionPoints.length;
    ip = story.insertionPoints.item(Math.min(t.pos, total - 1));
    bodyRows = t.rows - t.header - t.footer;
    tbl = ip.tables.add({ headerRowCount: t.header, bodyRowCount: bodyRows, footerRowCount: t.footer, columnCount: t.cols });
  } catch (e) { log("No se pudo crear una tabla: " + errText(e)); return; }
  try {
    for (i = 0; i < t.cols; i++) { if (t.colW[i]) { tbl.columns.item(i).width = t.colW[i]; } }
    for (i = 0; i < t.rows; i++) { if (t.rowH[i]) { tbl.rows.item(i).height = t.rowH[i]; } }
  } catch (e1) { failProp("tabla", "medidas", e1); }
  for (i = 0; i < t.cells.length; i++) {
    c = t.cells[i];
    try {
      cell = tbl.rows.item(c.r).cells.item(c.c);
      if (c.t) { cell.contents = c.t; applyRanges(cell, c.pr, c.cr); }
      if (c.fill) { var sw = swatch(c.fill); if (sw) { cell.fillColor = sw; } }
    } catch (e2) { failProp("tabla", "celda", e2); }
  }
  for (i = 0; i < t.cells.length; i++) {
    c = t.cells[i];
    if (c.rs > 1 || c.cs > 1) {
      try {
        cell = tbl.rows.item(c.r).cells.item(c.c);
        other = tbl.rows.item(c.r + c.rs - 1).cells.item(c.c + c.cs - 1);
        cell.merge(other);
      } catch (e3) { failProp("tabla", "combinar", e3); }
    }
  }
  STAT.tables++;
}

function buildStories() {
  var S = DATA.stories, i, j, s, frames, f, story, k;
  for (i = 0; i < S.length; i++) {
    s = S[i]; frames = [];
    for (j = 0; j < s.fr.length; j++) { if (FR[s.fr[j]]) { frames.push(FR[s.fr[j]]); } }
    if (!frames.length) { continue; }
    step("texto " + s.id + " (" + frames.length + " marcos)");
    for (j = 1; j < frames.length; j++) {
      try { frames[j - 1].nextTextFrame = frames[j]; } catch (e) { log("No se pudieron enlazar marcos de texto: " + errText(e)); break; }
    }
    try {
      story = frames[0].parentStory;
      if (s.t) { setText(story, s.t, frames[0]); }
      if (story.characters.length !== s.t.length) { log("Un texto tiene " + story.characters.length + " caracteres en vez de " + s.t.length + "; el formato puede desplazarse."); }
      applyRanges(story, s.pr, s.cr);
      for (k = s.tb.length - 1; k >= 0; k--) { buildTable(story, s.tb[k]); }
      STAT.stories++;
    } catch (e1) { log("No se pudo rellenar un texto: " + errText(e1)); }
  }
}

// ---------------------------------------------------------------- final
function finishDocument() {
  var d = DATA.doc, i, L = DATA.layers;
  for (i = 0; i < L.length; i++) {
    if (!LAY[L[i].id]) { continue; }
    try { if (!L[i].vis) { LAY[L[i].id].visible = false; } } catch (e) { }
    try { if (L[i].lock) { LAY[L[i].id].locked = true; } } catch (e1) { }
    try { if (!L[i].print) { LAY[L[i].id].printable = false; } } catch (e2) { }
  }
  for (i = 0; i < LOCKED.length; i++) { try { LOCKED[i].locked = true; } catch (e0) { failProp("objeto", "bloqueo", e0); } }
  try {
    DOC.viewPreferences.horizontalMeasurementUnits = en("MeasurementUnits", d.units.h);
    DOC.viewPreferences.verticalMeasurementUnits = en("MeasurementUnits", d.units.v);
  } catch (e3) { }
  try { app.activeWindow.activePage = DOC.pages.item(0); } catch (e4) { }
}

// ---------------------------------------------------------------- registro y resultado
function listOf(o) { return keysOf(o).join(", "); }

// "a, b, c y 4 más"
function more(list, max) {
  if (list.length <= max) { return list.join(", "); }
  return list.slice(0, max).join(", ") + " y " + (list.length - max) + " más";
}

function envInfo() {
  var s = [];
  try { s.push("InDesign " + app.version); } catch (e) { }
  try { if (app.locale !== undefined) { s.push("idioma " + String(app.locale)); } } catch (e1) { }
  try { if ($.os) { s.push(String($.os)); } } catch (e2) { }
  try { if ($.version) { s.push("ExtendScript " + $.version + ($.build !== undefined ? " build " + $.build : "")); } } catch (e3) { }
  return s.join(" | ");
}

function headline() {
  var n = "?";
  try { n = DOC.pages.length; } catch (e) { }
  return "Documento reconstruido: " + n + " páginas, " + STAT.items + " objetos, " + STAT.stories + " textos, " + STAT.images + " imágenes, " + STAT.tables + " tablas.";
}

// "estilo.hyphenation x3  <-  mensaje de CS3"
function failList(withText) {
  var out = [], k;
  for (k in PROPFAIL) {
    if (PROPFAIL.hasOwnProperty(k)) { out.push(k + " x" + PROPFAIL[k] + (withText && PROPERR[k] ? "   <-   " + PROPERR[k] : "")); }
  }
  return out;
}

// el registro completo va al escritorio (la carpeta de scripts de InDesign queda muy escondida)
function logPath() {
  var base = null;
  if (LOGPATH) { return LOGPATH; }
  try { if (Folder.desktop && Folder.desktop.exists) { base = Folder.desktop; } } catch (e0) { }
  if (!base) { base = SCRIPT_FOLDER; }
  if (!base) { return null; }
  LOGPATH = base.fsName + "/resultado_reconstruccion.txt";
  return LOGPATH;
}

function logLines() {
  var L = [], f, i;
  if (FINISHED) { L.push("IDML a CS3 - registro de la reconstrucción"); }
  else { L.push("** EJECUCION INCOMPLETA ** Si InDesign sigue trabajando, espera. Si se cerró o se quedó colgado, el problema está justo después del último paso de la lista PASOS (al final de este archivo)."); }
  L.push("Documento original: " + DATA.meta.name + "   (conversor " + CONVERTER + ")");
  L.push("Entorno: " + envInfo());
  L.push("Modo paso a paso: " + (DIAG ? "sí" : "no"));
  L.push("");
  if (DOC) {
    L.push(headline());
    if (keysOf(MISSING_FONTS).length) { L.push("FUENTES QUE NO ESTÁN INSTALADAS en este ordenador (se usó otra): " + listOf(MISSING_FONTS)); }
    if (MISSING_IMAGES.length) { L.push("IMÁGENES NO ENCONTRADAS (marcos vacíos): " + MISSING_IMAGES.join(", ")); }
    L.push("");
  }
  f = failList(true);
  if (f.length) {
    L.push("PROPIEDADES QUE CS3 NO ACEPTÓ (" + f.length + "), con el mensaje de error de CS3:");
    for (i = 0; i < f.length; i++) { L.push("  " + f[i]); }
    L.push("");
  }
  if (LOG.length) {
    L.push("AVISOS (" + LOG.length + "):");
    for (i = 0; i < LOG.length; i++) { L.push("  " + LOG[i]); }
    L.push("");
  }
  L.push("PASOS:");
  for (i = 0; i < TRACE.length; i++) { L.push("  " + TRACE[i]); }
  return L;
}

// open() y write() devuelven false (sin error) si no se puede escribir, p. ej. en una carpeta protegida
function writeLog(lines) {
  var p = logPath(), f, ok;
  if (!p) { return null; }
  try {
    f = new File(p);
    f.encoding = "UTF-8";
    if (!f.open("w")) { return null; }
    ok = f.write("\uFEFF" + lines.join("\r\n"));
    f.close();
    return ok === false ? null : f;
  } catch (e) { return null; }
}

function flushLog() { try { return writeLog(logLines()) !== null; } catch (e) { return false; } }

// si la ejecución anterior no llegó al final (InDesign se cerró o se colgó), esta vez se anota cada paso
function previousRunIncomplete() {
  var p = logPath(), f, t = "";
  if (!p) { return false; }
  try {
    f = new File(p);
    if (!f.exists) { return false; }
    f.encoding = "UTF-8";
    if (!f.open("r")) { return false; }
    t = f.read(300);
    f.close();
  } catch (e) { return false; }
  return String(t).indexOf("INCOMPLETA") >= 0;
}

function alertLines() {
  var L = [], f, i;
  L.push(headline());
  if (keysOf(MISSING_FONTS).length) { L.push("FUENTES QUE NO ESTÁN INSTALADAS en este ordenador (se usó otra): " + more(keysOf(MISSING_FONTS), 8)); }
  if (MISSING_IMAGES.length) { L.push("IMÁGENES NO ENCONTRADAS (marcos vacíos): " + more(MISSING_IMAGES, 8)); }
  f = failList(false);
  if (f.length) { L.push("CS3 no aceptó algunas propiedades: " + more(f, 8)); }
  for (i = 0; i < LOG.length && i < 6; i++) { L.push(LOG[i]); }
  if (LOG.length > 6) { L.push("... y " + (LOG.length - 6) + " avisos más"); }
  return L;
}

function phase(name, fn) {
  var t = new Date().getTime();
  trace("> " + name);
  flushLog();
  try {
    fn();
    trace("  listo (" + (Math.round((new Date().getTime() - t) / 100) / 10) + " s)");
  } catch (e) {
    log("ERROR en la fase «" + name + "»: " + errText(e) + (e && e.line ? " (línea " + e.line + ")" : ""));
    trace("  FALLÓ: " + errText(e));
  }
}

function restorePrefs() {
  try { if (OLD.redraw !== undefined) { app.scriptPreferences.enableRedraw = OLD.redraw; } } catch (e3) { }
  try { if (OLD.unit !== undefined) { app.scriptPreferences.measurementUnit = OLD.unit; } } catch (e3b) { }
  try { if (OLD.level !== undefined) { app.scriptPreferences.userInteractionLevel = OLD.level; } } catch (e4) { }
}

function main() {
  var al, saved;
  try { SCRIPT_FOLDER = File($.fileName).parent; } catch (e0) { SCRIPT_FOLDER = null; }
  if (!DIAG && previousRunIncomplete()) {
    DIAG = true;
    log("La ejecución anterior se quedó a medias: esta vez se anota cada paso en el registro (modo diagnóstico).");
  }
  trace("inicio");
  try { OLD.level = app.scriptPreferences.userInteractionLevel; app.scriptPreferences.userInteractionLevel = en("UserInteractionLevels", "NeverInteract"); } catch (e1) { }
  try { OLD.unit = app.scriptPreferences.measurementUnit; app.scriptPreferences.measurementUnit = en("MeasurementUnits", "Points"); } catch (e1b) { }
  try { OLD.redraw = app.scriptPreferences.enableRedraw; app.scriptPreferences.enableRedraw = false; } catch (e2) { }
  // cada fase va por separado: si una falla, las demás se intentan igualmente
  phase("fuentes instaladas", loadInstalledFonts);
  phase("documento", setupDocument);
  if (DOC) {
    phase("muestras de fábrica", findBuiltins);
    phase("capas", buildLayers);
    phase("colores", buildColors);
    phase("estilos", buildStyles);
    phase("páginas maestras", buildMasters);
    phase("páginas", buildPages);
    phase("imágenes", askImagesFolder);
    phase("objetos", buildSpreads);
    phase("textos", buildStories);
    phase("final", finishDocument);
  }
  restorePrefs();
  FINISHED = true;
  trace("fin");
  saved = flushLog();
  if (!DOC) { alert("No se pudo crear el documento.\n" + LOG.join("\n") + (saved ? "\n\nRegistro: " + logPath() : "")); return; }
  al = alertLines();
  al.push(saved ? "Registro completo, con los mensajes de error de CS3: " + logPath() : "No se pudo guardar el registro en el Escritorio (esto es solo el resumen).");
  alert(al.join("\n\n"));
}

function fatal(e) {
  var msg = "Error inesperado: " + errText(e) + ((e && e.line) ? " (línea " + e.line + ")" : ""), saved = false;
  try { restorePrefs(); } catch (x) { }
  try { log(msg); trace("FALLO GRAVE: " + msg); FINISHED = true; saved = flushLog(); } catch (x1) { }
  try { alert(msg + (saved ? "\n\nRegistro: " + logPath() : "")); } catch (x2) { }
}

try { main(); } catch (eMain) { fatal(eMain); }
