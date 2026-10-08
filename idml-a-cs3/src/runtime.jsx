// ============================================================================
//  Reconstructor para InDesign CS3  (se ejecuta DENTRO de InDesign CS3)
//  Lee la variable DATA (definida arriba) y crea un documento nuevo con las
//  páginas, colores, estilos, textos e imágenes del original.
//  Código en ES3 (el JavaScript de ExtendScript): sin let/const/flechas/JSON.
// ============================================================================

var LOG = [];            // avisos
var PROPFAIL = {};       // propiedades que CS3 rechazó
var MISSING_FONTS = {};
var MISSING_IMAGES = [];
var DOC = null;
var LAY = {}, SW = {}, PS = {}, CS = {}, MS = {}, FR = {}, MI = {};
var STAT = { items: 0, stories: 0, images: 0, tables: 0 };
var LOCKED = [];         // objetos que se bloquean al final (un objeto bloqueado ya no se puede tocar)
var SCRIPT_FOLDER = null;
var IDX = null;
var INSTALLED = null;
var G_ = null;
try { G_ = $.global; } catch (e0) { G_ = this; }

var SEEN = {};
function log(m) { if (!SEEN.hasOwnProperty(m)) { SEEN[m] = true; LOG.push(m); } }
function failProp(what, key) { var k = what + "." + key; PROPFAIL[k] = (PROPFAIL[k] || 0) + 1; }
function inArray(a, v) { var i; for (i = 0; i < a.length; i++) { if (a[i] === v) { return true; } } return false; }
function keysOf(o) { var r = [], k; for (k in o) { if (o.hasOwnProperty(k)) { r.push(k); } } return r; }

// ---------------------------------------------------------------- enumeraciones
// CS3 llama a las constantes en camelCase (leftAlign); versiones posteriores en MAYUSCULAS (LEFT_ALIGN).
function cls(name) {
  var c;
  try { c = G_[name]; if (c !== undefined) { return c; } } catch (e) { }
  try { return eval(name); } catch (e2) { }
  return null;
}
function en(c, v) {
  var C = cls(c), a, b, r;
  if (!C || v === undefined || v === null) { return undefined; }
  a = v.charAt(0).toLowerCase() + v.substring(1);
  b = v.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/([A-Z])([A-Z][a-z])/g, "$1_$2").toUpperCase();
  try { r = C[a]; } catch (e) { }
  if (r !== undefined) { return r; }
  try { r = C[b]; } catch (e1) { }
  if (r !== undefined) { return r; }
  try { r = C[v]; } catch (e2) { }
  return r;
}

// ---------------------------------------------------------------- muestras y estilos
function swatch(name) {
  var s = null;
  if (SW.hasOwnProperty(name)) { return SW[name]; }
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
    } catch (e) { failProp("tabs", "tabStops"); }
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
      } catch (eb) { failProp(what, "bulletChar"); }
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
      failProp(what, k);
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
  throw new Error("textWrap");
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
    } catch (e) { failProp(what, k); }
  }
}

// ---------------------------------------------------------------- documento
function setupDocument() {
  var d = DATA.doc, vp, dp, mp;
  DOC = app.documents.add();
  vp = DOC.viewPreferences;
  try { vp.horizontalMeasurementUnits = en("MeasurementUnits", "Points"); vp.verticalMeasurementUnits = en("MeasurementUnits", "Points"); } catch (e) { log("No se pudieron fijar las unidades en puntos."); }
  try { vp.rulerOrigin = en("RulerOrigin", "SpreadOrigin"); } catch (e1) { log("No se pudo fijar el origen de reglas."); }
  try { DOC.zeroPoint = [0, 0]; } catch (e1z) { }
  dp = DOC.documentPreferences;
  try { dp.facingPages = d.facing; } catch (e2) { log("facingPages"); }
  try { dp.pageWidth = d.w; dp.pageHeight = d.h; } catch (e3) { log("No se pudo fijar el tamaño de página."); }
  try { dp.pageBinding = en("PageBindingOptions", d.binding); } catch (e4) {
    if (d.binding !== "LeftToRight") { log("CS3 no deja cambiar desde un script la encuadernación de derecha a izquierda: hazlo en Archivo > Ajustar documento."); }
  }
  try { dp.startPageNumber = d.startPage; } catch (e5) {
    if (d.startPage !== 1) {
      try { DOC.sections.item(0).continueNumbering = false; DOC.sections.item(0).pageNumberStart = d.startPage; }
      catch (e5b) { log("No se pudo fijar el número de la primera página (" + d.startPage + ")."); }
    }
  }
  try {
    dp.documentBleedUniformSize = false;
    dp.documentBleedTopOffset = d.bleed.top; dp.documentBleedBottomOffset = d.bleed.bottom;
    dp.documentBleedInsideOrLeftOffset = d.bleed.inside; dp.documentBleedOutsideOrRightOffset = d.bleed.outside;
  } catch (e6) { log("No se pudo fijar el sangrado."); }
  try {
    dp.documentSlugUniformSize = false;
    dp.slugTopOffset = d.slug.top; dp.slugBottomOffset = d.slug.bottom;
    dp.slugInsideOrLeftOffset = d.slug.inside; dp.slugRightOrOutsideOffset = d.slug.outside;
  } catch (e7) { }
  if (d.grid) {
    try { DOC.gridPreferences.baselineStart = d.grid.start; DOC.gridPreferences.baselineDivision = d.grid.division; }
    catch (e7b) { log("No se pudo fijar la cuadrícula de líneas base."); }
  }
  mp = DOC.marginPreferences;
  try { mp.top = d.margins.top; mp.bottom = d.margins.bottom; mp.left = d.margins.left; mp.right = d.margins.right; mp.columnCount = d.margins.columns; mp.columnGutter = d.margins.gutter; } catch (e8) { }
}

function buildLayers() {
  var L = DATA.layers, i, lyr;
  if (!L.length) { return; }
  for (i = L.length - 1; i >= 0; i--) {
    try {
      if (i === L.length - 1) { lyr = DOC.layers.item(0); lyr.name = L[i].n; } else { lyr = DOC.layers.add({ name: L[i].n }); }
      LAY[L[i].id] = lyr;
    } catch (e) { log("No se pudo crear la capa \"" + L[i].n + "\"."); }
  }
  // la primera capa de IDML es la de mas arriba
  for (i = L.length - 1; i >= 0; i--) {
    try { if (LAY[L[i].id]) { LAY[L[i].id].move(en("LocationOptions", "AtBeginning")); } } catch (e1) { log("No se pudo ordenar las capas."); break; }
  }
}

function buildColors() {
  var C = DATA.colors, T = DATA.tints, Gd = DATA.grads, i, c, g, j, st, col;
  for (i = 0; i < C.length; i++) {
    c = C[i];
    try {
      DOC.colors.add({ name: c.n, model: en("ColorModel", c.m), space: en("ColorSpace", c.s), colorValue: c.v });
    } catch (e) {
      try { DOC.colors.item(c.n).name; } catch (e1) { log("No se pudo crear el color \"" + c.n + "\"."); }
    }
  }
  for (i = 0; i < T.length; i++) {
    try {
      DOC.tints.add(swatch(T[i].b), { name: T[i].n, tintValue: T[i].v });     // CS3: el color base es el primer argumento
    } catch (e2) {
      try { DOC.tints.add({ name: T[i].n, baseColor: swatch(T[i].b), tintValue: T[i].v }); }   // versiones posteriores
      catch (e2b) { log("No se pudo crear el tono \"" + T[i].n + "\"."); }
    }
  }
  for (i = 0; i < Gd.length; i++) {
    g = Gd[i];
    try {
      var gr = DOC.gradients.add({ name: g.n, type: en("GradientType", g.t) });
      for (j = 0; j < g.st.length; j++) {
        st = g.st[j];
        col = swatch(st.c);
        if (j >= gr.gradientStops.length) { gr.gradientStops.add({ stopColor: col, location: st.l }); }
        else { gr.gradientStops.item(j).stopColor = col; gr.gradientStops.item(j).location = st.l; }
      }
    } catch (e3) { log("No se pudo crear el degradado \"" + g.n + "\"."); }
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
    try { PS[s.id] = DOC.paragraphStyles.add({ name: s.n }); } catch (e2) { try { PS[s.id] = DOC.paragraphStyles.item(s.n); PS[s.id].name; } catch (e3) { log("No se pudo crear el estilo de párrafo \"" + s.n + "\"."); } }
  }
  for (i = 0; i < cs.length; i++) {
    s = cs[i];
    if (s.k === "none") { CS[s.id] = noneC; continue; }
    try { CS[s.id] = DOC.characterStyles.add({ name: s.n }); } catch (e4) { try { CS[s.id] = DOC.characterStyles.item(s.n); CS[s.id].name; } catch (e5) { log("No se pudo crear el estilo de carácter \"" + s.n + "\"."); } }
  }
  for (i = 0; i < ps.length; i++) {
    s = ps[i];
    if (!PS[s.id] || s.k === "none") { continue; }
    applyProps(PS[s.id], s.p, "estilo");
    try { if (s.b && PS[s.b] && s.k !== "basic") { PS[s.id].basedOn = PS[s.b]; } } catch (e6) { failProp("estilo", "basedOn"); }
    try { if (s.nx && PS[s.nx]) { PS[s.id].nextStyle = PS[s.nx]; } } catch (e7) { failProp("estilo", "nextStyle"); }
  }
  for (i = 0; i < cs.length; i++) {
    s = cs[i];
    if (!CS[s.id] || s.k === "none") { continue; }
    applyProps(CS[s.id], s.p, "estilo");
    try { if (s.b && CS[s.b]) { CS[s.id].basedOn = CS[s.b]; } } catch (e8) { failProp("estilo", "basedOn"); }
  }
}

// ---------------------------------------------------------------- objetos
function applyMargins(page, m) {
  var mp;
  try {
    mp = page.marginPreferences;
    mp.top = m.top; mp.bottom = m.bottom; mp.left = m.left; mp.right = m.right;
    mp.columnCount = m.columns; mp.columnGutter = m.gutter;
  } catch (e) { failProp("página", "márgenes"); }
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
      } catch (e2) { failProp("trazado", "curvas"); }
    }
  }
}

function rotateItem(o, angle) {
  var ok = false, d, m;
  try {
    o.rotationAngle = angle;
    d = (o.rotationAngle - angle) % 360;
    if (Math.abs(d) < 0.5 || Math.abs(d - 360) < 0.5 || Math.abs(d + 360) < 0.5) { ok = true; }
  } catch (e) { }
  if (!ok) {
    try {
      m = app.transformationMatrices.add({ counterclockwiseRotationAngle: angle });
      o.transform(en("CoordinateSpaces", "PasteboardCoordinates"), en("AnchorPoint", "CenterAnchor"), m);
      ok = true;
    } catch (e1) { }
  }
  if (!ok) { try { o.rotate(angle); ok = true; } catch (e2) { } }
  if (!ok) { failProp("objeto", "rotación"); }
}

function indexFolder(fold, depth) {
  var list, i, f, n;
  try { list = fold.getFiles(); } catch (e) { return; }
  for (i = 0; i < list.length; i++) {
    f = list[i];
    if (f instanceof Folder) { if (depth < 6) { indexFolder(f, depth + 1); } }
    else { n = f.name; try { n = decodeURI(n); } catch (e1) { } IDX[n.toLowerCase()] = f; }
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
    try { o = page.groups.add(arr); } catch (e) { log("No se pudo agrupar objetos."); return arr[0]; }
    return o;
  }
  try {
    if (kind === "text") { o = addItem(page.textFrames, g.b); }
    else if (kind === "rect") { o = addItem(page.rectangles, g.b); }
    else if (kind === "oval") { o = addItem(page.ovals, g.b); }
    else if (kind === "poly") { o = addItem(page.polygons, g.b); }
    else if (kind === "line") { o = addItem(page.graphicLines, g.b); }
  } catch (e1) { failProp("objeto", "crear " + kind); return null; }
  if (!o) { return null; }
  STAT.items++;
  if (it.layer && LAY[it.layer]) { try { o.itemLayer = LAY[it.layer]; } catch (e2) { failProp("objeto", "capa"); } }
  if (g.m === "p") { try { setPath(o, g); } catch (e3) { failProp("objeto", "trazado"); } }
  applyProps(o, it.props, "objeto");
  if (it.tfp) { try { applyPrefs(o.textFramePreferences, it.tfp, "marco"); } catch (e4) { failProp("marco", "preferencias"); } }
  if (it.wrap) { try { applyPrefs(o.textWrapPreferences, it.wrap, "ajuste"); } catch (e5) { failProp("ajuste", "preferencias"); } }
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
    try { obj = (i === 0) ? DOC.masterSpreads.item(0) : DOC.masterSpreads.add(); } catch (e) { log("No se pudo crear la maestra " + m.n); continue; }
    try { obj.namePrefix = m.pre; } catch (e1) { }
    try { obj.baseName = m.base; } catch (e2) { }
    MS[m.id] = obj;
    if (obj.pages.length !== m.pages.length) { log("La maestra \"" + m.n + "\" tiene " + m.pages.length + " páginas y en CS3 quedó con " + obj.pages.length + "."); }
    for (j = 0; j < m.pages.length && j < obj.pages.length; j++) { applyMargins(obj.pages.item(j), m.pages[j].m); }
  }
  for (i = 0; i < M.length; i++) {
    if (M[i].am && MS[M[i].am] && MS[M[i].id]) { try { MS[M[i].id].appliedMaster = MS[M[i].am]; } catch (e3) { failProp("maestra", "basada en otra"); } }
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
  var P = DATA.pages, i, pg, p, n = P.length, ov, j, mi, c;
  while (DOC.pages.length < n) { DOC.pages.add(); }
  for (i = 0; i < n; i++) {
    p = P[i]; pg = DOC.pages.item(i);
    try {
      if (p.master && MS[p.master]) { pg.appliedMaster = MS[p.master]; }
      else { try { pg.appliedMaster = en("NothingEnum", "Nothing"); } catch (e0) { pg.appliedMaster = null; } }
    } catch (e) { log("No se pudo aplicar la maestra a la página " + p.label); }
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
      try { c = mi.override(DOC.pages.item(i)); c.remove(); } catch (e2) { failProp("maestra", "sustitución"); }
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
      } catch (e) { failProp("objeto", "página"); }
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
    } catch (e) { failProp("párrafo", "estilo"); }
  }
  for (i = 0; i < cr.length; i++) {
    r = cr[i];
    try {
      rng = rangeOf(container, r[0], r[1]);
      if (!rng) { continue; }
      st = r[2] ? CS[r[2]] : null;
      if (st) { applyCStyle(rng, st); }
      if (r[3]) { applyProps(rng, r[3], "carácter"); }
    } catch (e1) { failProp("carácter", "estilo"); }
  }
}

function buildTable(story, t) {
  var tbl, i, c, cell, ip, total, bodyRows, rows, other, anchor;
  try {
    total = story.insertionPoints.length;
    ip = story.insertionPoints.item(Math.min(t.pos, total - 1));
    bodyRows = t.rows - t.header - t.footer;
    tbl = ip.tables.add({ headerRowCount: t.header, bodyRowCount: bodyRows, footerRowCount: t.footer, columnCount: t.cols });
  } catch (e) { log("No se pudo crear una tabla."); return; }
  try {
    for (i = 0; i < t.cols; i++) { if (t.colW[i]) { tbl.columns.item(i).width = t.colW[i]; } }
    for (i = 0; i < t.rows; i++) { if (t.rowH[i]) { tbl.rows.item(i).height = t.rowH[i]; } }
  } catch (e1) { failProp("tabla", "medidas"); }
  for (i = 0; i < t.cells.length; i++) {
    c = t.cells[i];
    try {
      cell = tbl.rows.item(c.r).cells.item(c.c);
      if (c.t) { cell.contents = c.t; applyRanges(cell, c.pr, c.cr); }
      if (c.fill) { var sw = swatch(c.fill); if (sw) { cell.fillColor = sw; } }
    } catch (e2) { failProp("tabla", "celda"); }
  }
  for (i = 0; i < t.cells.length; i++) {
    c = t.cells[i];
    if (c.rs > 1 || c.cs > 1) {
      try {
        cell = tbl.rows.item(c.r).cells.item(c.c);
        other = tbl.rows.item(c.r + c.rs - 1).cells.item(c.c + c.cs - 1);
        cell.merge(other);
      } catch (e3) { failProp("tabla", "combinar"); }
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
    for (j = 1; j < frames.length; j++) {
      try { frames[j - 1].nextTextFrame = frames[j]; } catch (e) { log("No se pudieron enlazar marcos de texto."); break; }
    }
    try {
      story = frames[0].parentStory;
      if (s.t) { setText(story, s.t, frames[0]); }
      if (story.characters.length !== s.t.length) { log("Un texto tiene " + story.characters.length + " caracteres en vez de " + s.t.length + "; el formato puede desplazarse."); }
      applyRanges(story, s.pr, s.cr);
      for (k = s.tb.length - 1; k >= 0; k--) { buildTable(story, s.tb[k]); }
      STAT.stories++;
    } catch (e1) { log("No se pudo rellenar un texto: " + e1.message); }
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
  for (i = 0; i < LOCKED.length; i++) { try { LOCKED[i].locked = true; } catch (e0) { failProp("objeto", "bloqueo"); } }
  try {
    DOC.viewPreferences.horizontalMeasurementUnits = en("MeasurementUnits", d.units.h);
    DOC.viewPreferences.verticalMeasurementUnits = en("MeasurementUnits", d.units.v);
  } catch (e3) { }
  try { app.activeWindow.activePage = DOC.pages.item(0); } catch (e4) { }
}

function listOf(o) { return keysOf(o).join(", "); }

function summary() {
  var lines = [], k, fails = [], n;
  lines.push("Documento reconstruido: " + DOC.pages.length + " páginas, " + STAT.items + " objetos, " + STAT.stories + " textos, " + STAT.images + " imágenes, " + STAT.tables + " tablas.");
  if (keysOf(MISSING_FONTS).length) { lines.push("FUENTES QUE NO ESTÁN INSTALADAS en este ordenador (se usó otra): " + listOf(MISSING_FONTS)); }
  if (MISSING_IMAGES.length) { lines.push("IMÁGENES NO ENCONTRADAS (marcos vacíos): " + MISSING_IMAGES.join(", ")); }
  for (k in PROPFAIL) { if (PROPFAIL.hasOwnProperty(k)) { fails.push(k + " x" + PROPFAIL[k]); } }
  if (fails.length) { lines.push("CS3 no aceptó algunas propiedades: " + fails.join("; ")); }
  for (n = 0; n < LOG.length; n++) { lines.push(LOG[n]); }
  return lines;
}

// el registro completo va al escritorio (la carpeta de scripts de InDesign queda muy escondida)
function writeLog(lines) {
  var f, base = null;
  try { if (Folder.desktop && Folder.desktop.exists) { base = Folder.desktop; } } catch (e0) { }
  if (!base) { base = SCRIPT_FOLDER; }
  if (!base) { return null; }
  try {
    f = new File(base.fsName + "/resultado_reconstruccion.txt");
    f.encoding = "UTF-8";
    f.open("w");
    f.write("\uFEFF" + lines.join("\r\n"));
    f.close();
    return f;
  } catch (e) { return null; }
}

function main() {
  var oldLevel = null, oldRedraw = null, oldUnit = null, lines, shown, i, lf;
  try { SCRIPT_FOLDER = File($.fileName).parent; } catch (e0) { SCRIPT_FOLDER = null; }
  try { oldLevel = app.scriptPreferences.userInteractionLevel; app.scriptPreferences.userInteractionLevel = en("UserInteractionLevels", "NeverInteract"); } catch (e1) { }
  try { oldUnit = app.scriptPreferences.measurementUnit; app.scriptPreferences.measurementUnit = en("MeasurementUnits", "Points"); } catch (e1b) { }
  try { oldRedraw = app.scriptPreferences.enableRedraw; app.scriptPreferences.enableRedraw = false; } catch (e2) { }
  try {
    loadInstalledFonts();
    setupDocument();
    buildLayers();
    buildColors();
    buildStyles();
    buildMasters();
    buildPages();
    askImagesFolder();
    buildSpreads();
    buildStories();
    finishDocument();
  } catch (e) {
    log("ERROR GRAVE: " + e.message + (e.line ? " (linea " + e.line + ")" : ""));
  }
  try { if (oldRedraw !== null) { app.scriptPreferences.enableRedraw = oldRedraw; } } catch (e3) { }
  try { if (oldUnit !== null) { app.scriptPreferences.measurementUnit = oldUnit; } } catch (e3b) { }
  try { if (oldLevel !== null) { app.scriptPreferences.userInteractionLevel = oldLevel; } } catch (e4) { }
  if (!DOC) { alert("No se pudo crear el documento.\n" + LOG.join("\n")); return; }
  lines = summary();
  lf = writeLog(lines);
  shown = lines.slice(0, 14);
  if (lines.length > 14) { shown.push("... (" + (lines.length - 14) + " avisos más" + (lf ? ": mira resultado_reconstruccion.txt en el escritorio" : "") + ")"); }
  alert(shown.join("\n\n"));
}

main();
