// ============================================================================
//  Comprobación para InDesign CS3  (se ejecuta DENTRO de InDesign CS3)
//  Crea un documento de prueba y comprueba, una por una, las operaciones que usa el
//  script de reconstrucción. Escribe el resultado en el Escritorio (diagnostico_CS3.txt)
//  y lo muestra en pantalla. No toca ningún otro documento: el de prueba se cierra sin guardar.
//  Código en ES3 (el JavaScript de ExtendScript): sin let/const/flechas/JSON.
// ============================================================================

var REPORT = [];
var NCHECK = 0, NFAIL = 0;
var FAILS = [];          // líneas [FALLA]
var DIFFS = [];          // líneas [distinto]: no existe, pero el script de reconstrucción lo resuelve de otra forma
var MISSING = [];        // "Clase: propiedad1, propiedad2" que este CS3 no tiene
var DOC = null;
var OLD_LEVEL;
var G_ = null;
try { G_ = $.global; } catch (e0) { G_ = this; }

function txt(e) {
  var m = "";
  try { m = (e && e.message !== undefined) ? String(e.message) : String(e); } catch (x) { m = "?"; }
  try { if (e && e.number) { m += " [error " + e.number + "]"; } } catch (x1) { }
  m = m.replace(/[\r\n]+/g, " ");
  if (m.length > 200) { m = m.substring(0, 200) + "..."; }
  return m;
}
function say(s) { REPORT.push(s); try { $.writeln(s); } catch (e) { } }
function head(s) { say(""); say("== " + s + " =="); }
function pass(n, extra) { NCHECK++; say("[ok]     " + n + (extra ? "   ->   " + extra : "")); }
function bad(n, e) { var m; NCHECK++; NFAIL++; m = "[FALLA]  " + n + "   ->   " + txt(e); FAILS.push(m); say(m); }
function info(n, v) { say("[info]   " + n + (v === undefined ? "" : ": " + v)); }
// soft: si falla no es un fallo, solo una diferencia que el script de reconstrucción ya sabe sortear (se dice cómo)
function t(n, fn, soft) {
  var r, m;
  try { r = fn(); pass(n, (r === undefined || r === null) ? "" : String(r)); return true; }
  catch (e) {
    if (soft) { NCHECK++; m = "[distinto] " + n + "   ->   " + txt(e) + "      (" + soft + ")"; DIFFS.push(m); say(m); }
    else { bad(n, e); }
    return false;
  }
}
// prueba varias formas de hacer lo mismo y dice cuáles funcionan (solo falla si no funciona ninguna)
function alts(n, list) {
  var i, good = [], nope = [];
  for (i = 0; i < list.length; i++) {
    try { list[i][1](); good.push(list[i][0]); } catch (e) { nope.push(list[i][0] + " (" + txt(e) + ")"); }
  }
  if (good.length) { pass(n, "funciona: " + good.join("  ;  ") + (nope.length ? "      NO funciona: " + nope.join("  ;  ") : "")); }
  else { bad(n, "no funciona ninguna forma: " + nope.join("  ;  ")); }
  return good.length > 0;
}

// ---------------------------------------------------------------- constantes (igual que en el script de reconstrucción)
function cls(name) {
  var c;
  try { c = G_[name]; if (c !== undefined) { return c; } } catch (e) { }
  try { return eval(name); } catch (e2) { }
  return null;
}
function squash(s) { return String(s).replace(/_/g, "").toLowerCase(); }
function members(C) {
  var out = [], k, list, i, skip = { reflect: 1, toString: 1, valueOf: 1, name: 1, length: 1, prototype: 1, constructor: 1 };
  try { for (k in C) { if (!skip[k]) { out.push(k); } } } catch (e) { }
  if (!out.length) {
    try { list = C.reflect.properties; for (i = 0; i < list.length; i++) { if (!skip[list[i].name]) { out.push(list[i].name); } } } catch (e1) { }
  }
  return out;
}
function scanEnum(C, v) {
  var want = squash(v), list = members(C), i;
  for (i = 0; i < list.length; i++) { if (squash(list[i]) === want) { return C[list[i]]; } }
  return undefined;
}
function en(c, v) {
  var C = cls(c), a, b, r;
  if (!C || v === undefined || v === null) { return undefined; }
  a = v.charAt(0).toLowerCase() + v.substring(1);
  b = v.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/([A-Z])([A-Z][a-z])/g, "$1_$2").toUpperCase();
  try { r = C[a]; } catch (e) { }
  if (r === undefined) { try { r = C[b]; } catch (e1) { } }
  if (r === undefined) { try { r = C[v]; } catch (e2) { } }
  if (r === undefined) { try { r = C[v.toLowerCase()]; } catch (e3) { } }
  if (r === undefined) { r = scanEnum(C, v); }
  return r;
}
function need(c, v) {
  var r = en(c, v);
  if (r === undefined) { throw new Error("no existe la constante " + c + "." + v); }
  return r;
}

// clases que, según la versión, se llaman de otra forma: su ausencia no es un fallo si la otra existe
var SOFT = { TextWrapModes: 1, TextWrapTypes: 1 };

function checkEnums() {
  var cn, C, list, i, miss;
  head("Constantes (enumeraciones) de este InDesign");
  for (cn in EXPECT_ENUMS) {
    if (!EXPECT_ENUMS.hasOwnProperty(cn)) { continue; }
    list = EXPECT_ENUMS[cn];
    C = cls(cn);
    if (!C) {
      if (SOFT[cn]) { info("la clase " + cn + " no existe en este InDesign (normal: se usa la otra variante)"); }
      else { bad("clase " + cn, "no existe"); }
      continue;
    }
    miss = [];
    for (i = 0; i < list.length; i++) { if (en(cn, list[i]) === undefined) { miss.push(list[i]); } }
    if (!miss.length) { pass("constantes de " + cn, list.length + " de " + list.length); }
    else if (SOFT[cn]) { info("constantes de " + cn + " que faltan", miss.join(", ") + "      las que tiene: " + members(C).join(", ")); }
    else { bad("constantes de " + cn, "faltan " + miss.join(", ") + "      las que tiene este InDesign: " + members(C).join(", ")); }
  }
}

// ---------------------------------------------------------------- propiedades (por reflexión)
function propSet(o) {
  var r = {}, props, i;
  try {
    props = o.reflect.properties;
    for (i = 0; i < props.length; i++) { r[props[i].name] = true; }
  } catch (e) { return null; }
  return r;
}
function checkProps(label, o, names) {
  var have, miss = [], i, v;
  if (!o) { info("propiedades de " + label, "(sin objeto de muestra)"); return; }
  have = propSet(o);
  for (i = 0; i < names.length; i++) {
    if (have) { if (!have[names[i]]) { miss.push(names[i]); } }
    else { try { v = o[names[i]]; if (v === undefined) { miss.push(names[i]); } } catch (e) { } }
  }
  if (miss.length) { say("[no hay] " + label + ": " + miss.join(", ")); MISSING.push(label + ": " + miss.join(", ")); }
  else { pass("propiedades de " + label, names.length + " de " + names.length + (have ? "" : " (sin reflexión: comprobadas leyéndolas)")); }
}

// ---------------------------------------------------------------- entorno
function environment() {
  head("Entorno");
  try { info("InDesign", app.name + " " + app.version); } catch (e) { }
  try { info("idioma de InDesign", String(app.locale)); } catch (e1) { }
  try { info("sistema", $.os); } catch (e2) { }
  try { info("ExtendScript", $.version + " build " + $.build); } catch (e3) { }
  try { info("este script", $.fileName); } catch (e4) { }
  try { info("Escritorio", Folder.desktop.fsName); } catch (e5) { }
  try { info("carpeta temporal", Folder.temp.fsName); } catch (e6) { }
  try { info("documentos abiertos al empezar", app.documents.length); } catch (e7) { }
  try { info("fuentes instaladas", app.fonts.length); } catch (e8) { }
}

// ---------------------------------------------------------------- las pruebas con un documento de verdad
var pg, tf, tf2, tf3, rc, rc2, ov, pl, ln, ps, cs, c1, mA, mItem, tbl, png, imgRect;

function mk(coll, b) {
  var o;
  try { return coll.add({ geometricBounds: b }); } catch (e) { }
  o = coll.add();
  o.geometricBounds = b;
  return o;
}

function docChecks() {
  var vp = DOC.viewPreferences, dp = DOC.documentPreferences;

  head("Documento nuevo");
  t("unidades en puntos (viewPreferences)", function () { vp.horizontalMeasurementUnits = need("MeasurementUnits", "Points"); vp.verticalMeasurementUnits = need("MeasurementUnits", "Points"); });
  t("origen de reglas = pliego", function () { vp.rulerOrigin = need("RulerOrigin", "SpreadOrigin"); });
  t("punto cero (zeroPoint)", function () { DOC.zeroPoint = [0, 0]; });
  t("páginas enfrentadas (facingPages)", function () { dp.facingPages = true; });
  t("tamaño de página", function () { dp.pageWidth = 400; dp.pageHeight = 600; return dp.pageWidth + " x " + dp.pageHeight; });
  t("encuadernación (pageBinding)", function () { dp.pageBinding = need("PageBindingOptions", "LeftToRight"); }, "el script avisa si el original es de derecha a izquierda");
  t("número de la primera página (startPageNumber)", function () { dp.startPageNumber = 1; }, "el script usa la sección");
  t("número de la primera página (sección)", function () { var sc = DOC.sections.item(0); sc.continueNumbering = false; sc.pageNumberStart = 3; return "empieza en " + sc.pageNumberStart; });
  t("sangrado", function () {
    dp.documentBleedUniformSize = false;
    dp.documentBleedTopOffset = 5; dp.documentBleedBottomOffset = 5; dp.documentBleedInsideOrLeftOffset = 5; dp.documentBleedOutsideOrRightOffset = 5;
  });
  t("margen de anotaciones (slug)", function () {
    dp.documentSlugUniformSize = false;
    dp.slugTopOffset = 6; dp.slugBottomOffset = 6; dp.slugInsideOrLeftOffset = 6; dp.slugRightOrOutsideOffset = 6;
  });
  t("cuadrícula de líneas base", function () { DOC.gridPreferences.baselineStart = 36; DOC.gridPreferences.baselineDivision = 12; });
  t("márgenes y columnas del documento", function () {
    var mp = DOC.marginPreferences;
    mp.top = 30; mp.bottom = 30; mp.left = 30; mp.right = 30; mp.columnCount = 2; mp.columnGutter = 12;
  });

  head("Lo que trae de fábrica un documento nuevo");
  t("estilos de párrafo de fábrica", function () {
    var i, out = [];
    for (i = 0; i < DOC.paragraphStyles.length && i < 6; i++) { out.push(i + "=" + DOC.paragraphStyles.item(i).name); }
    return out.join(", ");
  });
  t("estilos de carácter de fábrica", function () {
    var i, out = [];
    for (i = 0; i < DOC.characterStyles.length && i < 6; i++) { out.push(i + "=" + DOC.characterStyles.item(i).name); }
    return out.join(", ");
  });
  t("maestra de fábrica", function () { return DOC.masterSpreads.item(0).name + " con " + DOC.masterSpreads.item(0).pages.length + " página(s)"; });
  t("página 1 y su maestra", function () { return DOC.pages.length + " página(s); maestra aplicada: " + DOC.pages.item(0).appliedMaster.name; });
  t("pliego de una página (page.parent)", function () { return DOC.pages.item(0).parent.pages.length + " página(s) en el pliego"; });
  t("capa de fábrica", function () { return DOC.layers.length + " capa(s): " + DOC.layers.item(0).name; });
  t("preferencias del script (interacción, unidades, redibujado)", function () {
    var sp = app.scriptPreferences, a = sp.userInteractionLevel, b = sp.measurementUnit, c = sp.enableRedraw;
    sp.measurementUnit = need("MeasurementUnits", "Points");
    sp.enableRedraw = false; sp.enableRedraw = c;
    sp.measurementUnit = b; sp.userInteractionLevel = a;
  });
  t("diálogos del script (confirm, Folder.selectDialog)", function () { return typeof confirm + ", " + typeof Folder.selectDialog; });

  head("Capas");
  t("crear una capa y moverla arriba", function () { var l = DOC.layers.add({ name: "PruebaCapa" }); l.move(need("LocationOptions", "AtBeginning")); return DOC.layers.length + " capas"; });
  t("renombrar la primera capa", function () { DOC.layers.item(DOC.layers.length - 1).name = "PruebaCapa0"; });
  t("capa: visible y bloqueada", function () { var l = DOC.layers.item(0); l.visible = true; l.locked = false; });
  t("capa: imprimible (printable)", function () { DOC.layers.item(0).printable = true; }, "el script lo omite");

  head("Colores y muestras");
  t("muestras de fábrica del documento nuevo", function () {
    var i, out = [];
    for (i = 0; i < DOC.swatches.length; i++) { out.push(DOC.swatches.item(i).name + " <" + DOC.swatches.item(i).reflect.name + ">"); }
    return out.join(", ");
  });
  t("colores de fábrica: modelo y valor", function () {
    var i, c, out = [];
    for (i = 0; i < DOC.colors.length; i++) { c = DOC.colors.item(i); out.push(c.name + " " + String(c.model) + " [" + c.colorValue + "]"); }
    return out.join("  ;  ");
  });
  alts("crear un color CMYK", [
    ["colors.add({name, model, space, colorValue})", function () { DOC.colors.add({ name: "PruebaCMYK1", model: need("ColorModel", "Process"), space: need("ColorSpace", "CMYK"), colorValue: [10, 20, 30, 40] }); }],
    ["colors.add() y luego asignar cada valor", function () {
      var c = DOC.colors.add(); c.name = "PruebaCMYK2"; c.model = need("ColorModel", "Process"); c.space = need("ColorSpace", "CMYK"); c.colorValue = [10, 20, 30, 40];
    }]
  ]);
  try { c1 = DOC.colors.item("PruebaCMYK1"); c1.name; } catch (e1) { try { c1 = DOC.colors.item("PruebaCMYK2"); c1.name; } catch (e2) { c1 = null; } }
  t("crear un color RGB", function () { DOC.colors.add({ name: "PruebaRGB", model: need("ColorModel", "Process"), space: need("ColorSpace", "RGB"), colorValue: [255, 0, 0] }); });
  t("crear un color directo (spot)", function () { DOC.colors.add({ name: "PruebaSpot", model: need("ColorModel", "Spot"), space: need("ColorSpace", "CMYK"), colorValue: [0, 100, 100, 0] }); });
  alts("crear un tono", [
    ["tints.add(color, {name, tintValue})", function () { DOC.tints.add(c1, { name: "PruebaTono1", tintValue: 50 }); }],
    ["tints.add({name, baseColor, tintValue})", function () { DOC.tints.add({ name: "PruebaTono2", baseColor: c1, tintValue: 50 }); }]
  ]);
  t("crear un degradado", function () {
    var g = DOC.gradients.add({ name: "PruebaDegradado", type: need("GradientType", "Linear") });
    g.gradientStops.item(0).stopColor = c1;
    g.gradientStops.item(1).stopColor = DOC.colors.item("PruebaRGB");
    g.gradientStops.add({ stopColor: c1, location: 50 });
    return g.gradientStops.length + " paradas";
  });

  head("Fuentes");
  t("lista de fuentes (app.fonts.everyItem)", function () {
    var all = app.fonts.everyItem(), fams = all.fontFamily, stys = all.fontStyleName, i, seen = {}, ex = [];
    for (i = 0; i < fams.length && ex.length < 8; i++) { if (!seen[fams[i]]) { seen[fams[i]] = 1; ex.push(fams[i] + " " + stys[i]); } }
    return fams.length + " fuentes; por ejemplo: " + ex.join(", ");
  });
  t("una fuente por posición (app.fonts.item)", function () { var f = app.fonts.item(0); return f.name + " | familia " + f.fontFamily + " | estilo " + f.fontStyleName; });

  head("Estilos");
  t("estilo de párrafo: crear", function () { ps = DOC.paragraphStyles.add({ name: "PruebaP" }); });
  if (ps) {
    t("estilo de párrafo: tamaño, interlineado y alineación", function () { ps.pointSize = 14; ps.leading = 16; ps.justification = need("Justification", "LeftAlign"); });
    t("estilo de párrafo: interlineado automático", function () { ps.leading = need("Leading", "Auto"); });
    t("estilo de párrafo: fuente (appliedFont con un objeto Font)", function () { ps.appliedFont = app.fonts.item(0); });
    t("estilo de párrafo: estilo de fuente (fontStyle)", function () { ps.fontStyle = app.fonts.item(0).fontStyleName; return ps.fontStyle; });
    t("estilo de párrafo: color de relleno (fillColor)", function () { ps.fillColor = c1; });
    t("estilo de párrafo: tabuladores (tabStops.add)", function () { ps.tabStops.add({ alignment: need("TabStopAlignment", "LeftAlign"), position: 100, leader: "", alignmentCharacter: "" }); });
    t("estilo de párrafo: sangrías y espacios", function () { ps.firstLineIndent = 10; ps.leftIndent = 5; ps.spaceBefore = 3; ps.spaceAfter = 3; });
    t("estilo de párrafo: guionado", function () { ps.hyphenation = true; ps.hyphenateWordsLongerThan = 6; });
    t("estilo de párrafo: filete inferior", function () { ps.ruleBelow = true; ps.ruleBelowLineWeight = 1; ps.ruleBelowColor = c1; ps.ruleBelowWidth = need("RuleWidth", "ColumnWidth"); });
    t("estilo de párrafo: viñetas", function () { ps.bulletsAndNumberingListType = need("ListType", "BulletList"); });
    t("estilo de párrafo: carácter de la viñeta", function () { ps.bulletChar.bulletCharacterType = need("BulletCharacterType", "UnicodeOnly"); ps.bulletChar.bulletCharacterValue = 8226; });
    t("estilo de párrafo: basedOn y nextStyle", function () { var p2 = DOC.paragraphStyles.add({ name: "PruebaP2" }); p2.basedOn = ps; p2.nextStyle = ps; });
  }
  t("estilo de carácter: crear y dar propiedades", function () {
    cs = DOC.characterStyles.add({ name: "PruebaC" });
    cs.pointSize = 10; cs.fillColor = c1; cs.capitalization = need("Capitalization", "AllCaps"); cs.position = need("Position", "Superscript");
  });

  head("Páginas y maestras");
  t("maestra nueva (masterSpreads.add)", function () { mA = DOC.masterSpreads.add(); return DOC.masterSpreads.length + " maestras"; });
  if (mA) {
    t("nombre de la maestra (namePrefix, baseName)", function () { mA.namePrefix = "Z"; mA.baseName = "Prueba"; return mA.name; });
    t("páginas de la maestra", function () { return mA.pages.length + " (con páginas enfrentadas debería ser 2)"; });
    t("márgenes de una página de la maestra", function () { var mp = mA.pages.item(0).marginPreferences; mp.top = 20; mp.bottom = 20; mp.left = 20; mp.right = 20; mp.columnCount = 1; mp.columnGutter = 12; });
    t("objeto en una página de la maestra", function () { mItem = mk(mA.pages.item(0).textFrames, [20, 20, 60, 120]); });
  }
  t("añadir páginas (pages.add)", function () { var n = DOC.pages.length; DOC.pages.add(); DOC.pages.add(); DOC.pages.add(); return n + " -> " + DOC.pages.length + " páginas"; });
  t("pliegos del documento", function () {
    var i, out = [];
    for (i = 0; i < DOC.spreads.length; i++) { out.push(DOC.spreads.item(i).pages.length); }
    return DOC.spreads.length + " pliegos, con " + out.join(" + ") + " páginas";
  });
  if (mA) { t("aplicar una maestra a una página (appliedMaster)", function () { DOC.pages.item(1).appliedMaster = mA; }); }
  alts("quitar la maestra de una página", [
    ["appliedMaster = NothingEnum.nothing", function () { DOC.pages.item(2).appliedMaster = need("NothingEnum", "Nothing"); }],
    ["appliedMaster = null", function () { DOC.pages.item(2).appliedMaster = null; }]
  ]);
  t("márgenes de una página", function () { var mp = DOC.pages.item(1).marginPreferences; mp.top = 30; mp.bottom = 30; mp.left = 30; mp.right = 30; mp.columnCount = 2; mp.columnGutter = 10; });
  if (mItem) { t("sustituir un objeto de la maestra en una página (override) y quitarlo", function () { var o = mItem.override(DOC.pages.item(1)); o.remove(); }); }

  pg = DOC.pages.item(0);
  head("Objetos");
  alts("crear un rectángulo", [
    ["rectangles.add({geometricBounds})", function () { rc = pg.rectangles.add({ geometricBounds: [200, 30, 280, 130] }); }],
    ["rectangles.add() y luego geometricBounds", function () { rc2 = pg.rectangles.add(); rc2.geometricBounds = [200, 160, 280, 260]; }]
  ]);
  if (!rc) { rc = rc2; }
  t("crear un marco de texto", function () { tf = mk(pg.textFrames, [30, 30, 180, 250]); return tf.geometricBounds; });
  t("crear un óvalo", function () { ov = mk(pg.ovals, [300, 30, 360, 130]); });
  t("crear un polígono", function () { pl = mk(pg.polygons, [300, 160, 360, 260]); });
  t("crear una línea", function () { ln = mk(pg.graphicLines, [400, 30, 420, 260]); });
  if (pl) {
    t("trazado: puntos (paths.item(0).entirePath)", function () { pl.paths.item(0).entirePath = [[300, 160], [380, 160], [340, 240]]; return pl.paths.item(0).entirePath.length + " puntos"; });
    t("trazado: direcciones de las curvas (leftDirection, rightDirection)", function () { var pp = pl.paths.item(0).pathPoints.item(0); pp.leftDirection = [290, 160]; pp.rightDirection = [310, 160]; });
  }
  if (ln) { t("trazado abierto (pathType)", function () { ln.paths.item(0).entirePath = [[400, 30], [420, 260]]; ln.paths.item(0).pathType = need("PathType", "OpenPath"); }); }
  if (rc) {
    alts("girar un objeto", [
      ["rotationAngle", function () { rc.rotationAngle = 30; if (Math.abs(rc.rotationAngle - 30) > 0.5) { throw new Error("quedó en " + rc.rotationAngle); } rc.rotationAngle = 0; }],
      ["transform con una matriz", function () { var m = app.transformationMatrices.add({ counterclockwiseRotationAngle: 15 }); rc.transform(need("CoordinateSpaces", "PasteboardCoordinates"), need("AnchorPoint", "CenterAnchor"), m); }],
      ["rotate()", function () { rc.rotate(10); }]
    ]);
    t("relleno y contorno (fillColor, strokeColor, strokeWeight)", function () { rc.fillColor = c1; rc.strokeColor = c1; rc.strokeWeight = 2; });
    t("muestra Ninguno en el relleno (fillColor)", function () {
      var i, none = null;
      for (i = 0; i < DOC.swatches.length; i++) { if (DOC.swatches.item(i).reflect.name === "Swatch") { none = DOC.swatches.item(i); break; } }
      if (!none) { throw new Error("no se encontró la muestra Ninguno entre las muestras del documento"); }
      rc.fillColor = none;
      return none.name;
    });
    t("tinta del relleno (fillTint)", function () { rc.fillTint = 50; });
    t("alineación y extremos del contorno", function () { rc.strokeAlignment = need("StrokeAlignment", "CenterAlignment"); rc.endCap = need("EndCap", "ButtEndCap"); rc.endJoin = need("EndJoin", "MiterEndJoin"); rc.miterLimit = 4; });
    t("opacidad (transparencySettings.blendingSettings.opacity)", function () { rc.transparencySettings.blendingSettings.opacity = 50; });
    alts("esquinas redondeadas", [
      ["topLeftCornerOption + topLeftCornerRadius", function () { rc.topLeftCornerOption = need("CornerOptions", "RoundedCorner"); rc.topLeftCornerRadius = 8; }],
      ["cornerOption + cornerRadius", function () { rc.cornerOption = need("CornerOptions", "RoundedCorner"); rc.cornerRadius = 8; }]
    ]);
    t("capa del objeto (itemLayer)", function () { rc.itemLayer = DOC.layers.item(0); });
    t("etiqueta (label)", function () { rc.label = "prueba"; });
    t("ocultar y mostrar (visible)", function () { rc.visible = false; rc.visible = true; });
    alts("ajuste de texto alrededor del objeto", [
      ["textWrapPreferences.textWrapMode", function () { rc.textWrapPreferences.textWrapMode = need("TextWrapModes", "BoundingBoxTextWrap"); }],
      ["textWrapPreferences.textWrapType (TextWrapTypes)", function () { rc.textWrapPreferences.textWrapType = need("TextWrapTypes", "BoundingBoxTextWrap"); }],
      ["textWrapPreferences.textWrapType (TextWrapType)", function () { rc.textWrapPreferences.textWrapType = need("TextWrapType", "BoundingBoxTextWrap"); }]
    ]);
    t("ajuste de texto: lado y distancias", function () { var w = rc.textWrapPreferences; w.textWrapSide = need("TextWrapSideOptions", "BothSides"); w.textWrapOffset = [3, 4, 5, 6]; });
  }
  if (tf) {
    t("marco de texto: columnas y margen interior (textFramePreferences)", function () { var p = tf.textFramePreferences; p.textColumnCount = 2; p.textColumnGutter = 12; p.insetSpacing = [5, 5, 5, 5]; });
    t("marco de texto: alineación vertical y primera línea base", function () { var p = tf.textFramePreferences; p.verticalJustification = need("VerticalJustification", "TopAlign"); p.firstBaselineOffset = need("FirstBaselineOffset", "AscentOffset"); });
  }
  if (pl) { t("bloquear y desbloquear un objeto (locked)", function () { pl.locked = true; pl.locked = false; }); }
  if (rc && ov) { t("agrupar objetos (groups.add)", function () { pg.groups.add([rc, ov]); }); }

  head("Texto");
  if (tf) {
    alts("poner texto en un marco", [
      ["parentStory.contents", function () { tf.parentStory.contents = "Primera línea de prueba\rSegunda línea con más texto"; }],
      ["marco.contents", function () { tf.contents = "Primera línea de prueba\rSegunda línea con más texto"; }]
    ]);
    t("contar caracteres (characters.length)", function () { return tf.parentStory.characters.length + " caracteres"; });
    t("añadir al final (insertionPoints[-1].contents)", function () { tf.parentStory.insertionPoints[-1].contents = " fin"; });
    t("carácter especial: número de página", function () { tf.parentStory.insertionPoints[-1].contents = need("SpecialCharacters", "AutoPageNumber"); });
    t("rango de caracteres (characters.itemByRange)", function () { return "[" + tf.parentStory.characters.itemByRange(0, 4).contents + "]"; });
    if (ps) {
      alts("aplicar un estilo de párrafo a un rango", [
        ["appliedParagraphStyle", function () { tf.parentStory.characters.itemByRange(0, 4).appliedParagraphStyle = ps; }],
        ["applyParagraphStyle(estilo, false)", function () { tf.parentStory.characters.itemByRange(0, 4).applyParagraphStyle(ps, false); }]
      ]);
    }
    if (cs) {
      alts("aplicar un estilo de carácter a un rango", [
        ["appliedCharacterStyle", function () { tf.parentStory.characters.itemByRange(2, 6).appliedCharacterStyle = cs; }],
        ["applyCharacterStyle(estilo, false)", function () { tf.parentStory.characters.itemByRange(2, 6).applyCharacterStyle(cs, false); }]
      ]);
    }
    t("formato directo en un rango (tamaño, color, alineación)", function () {
      var r = tf.parentStory.characters.itemByRange(0, 4);
      r.pointSize = 18; r.fillColor = c1; r.justification = need("Justification", "CenterAlign");
    });
    t("fuente en un rango (appliedFont con un objeto Font)", function () { tf.parentStory.characters.itemByRange(0, 4).appliedFont = app.fonts.item(0); });
    t("enlazar dos marcos de texto (nextTextFrame)", function () { tf2 = mk(pg.textFrames, [30, 260, 180, 380]); tf.nextTextFrame = tf2; });
  }
  t("tabla: crear dentro de un texto", function () {
    var story;
    tf3 = mk(pg.textFrames, [440, 30, 560, 250]);
    story = tf3.parentStory;
    story.contents = "x";
    tbl = story.insertionPoints.item(0).tables.add({ headerRowCount: 1, bodyRowCount: 1, footerRowCount: 0, columnCount: 2 });
    return tbl.rows.length + " filas x " + tbl.columns.length + " columnas";
  });
  if (tbl) {
    t("tabla: texto, anchura, altura y color de las celdas", function () {
      tbl.cells.item(0).contents = "A"; tbl.columns.item(0).width = 80; tbl.rows.item(0).height = 20; tbl.cells.item(1).fillColor = c1;
    });
    t("tabla: combinar celdas (merge)", function () { tbl.rows.item(1).cells.item(0).merge(tbl.rows.item(1).cells.item(1)); });
  }

  head("Imágenes");
  png = null;
  t("crear un PNG de prueba en la carpeta temporal", function () {
    var f = new File(Folder.temp.fsName + "/idml_a_cs3_prueba.png");
    f.encoding = "BINARY";
    f.open("w");
    f.write(String.fromCharCode.apply(null, PNG_BYTES));
    f.close();
    if (!f.exists) { throw new Error("el archivo no existe después de escribirlo"); }
    png = f;
    return f.fsName;
  });
  if (png) {
    t("colocar la imagen en un marco (place)", function () {
      var res;
      imgRect = pg.rectangles.add({ geometricBounds: [440, 270, 520, 350] });
      res = imgRect.place(png);
      return (res && res.length ? res.length + " objeto(s) devuelto(s)" : "sin lista de resultado") + "; gráficos en el marco: " + imgRect.graphics.length;
    });
    t("límites del gráfico colocado (graphics.item(0).geometricBounds)", function () {
      var g = imgRect.graphics.item(0);
      g.geometricBounds = [440, 270, 500, 330];
      return g.geometricBounds;
    });
    t("ajustar el contenido al marco (fit)", function () { imgRect.fit(need("FitOptions", "FillProportionally")); });
    try { png.remove(); } catch (ep) { }
  }

  head("Propiedades que existen en este InDesign (según su propio modelo de objetos)");
  checkProps("ParagraphStyle", ps, EXPECT_PROPS.ParagraphStyle);
  checkProps("CharacterStyle", cs, EXPECT_PROPS.CharacterStyle);
  checkProps("TextFrame", tf, EXPECT_PROPS.PageItem);
  checkProps("Rectangle", rc, EXPECT_PROPS.PageItem);
  checkProps("Oval", ov, EXPECT_PROPS.PageItem);
  checkProps("Polygon", pl, EXPECT_PROPS.PageItem);
  checkProps("GraphicLine", ln, EXPECT_PROPS.PageItem.concat(EXPECT_PROPS.LineEnds));
  checkProps("Rectangle (esquinas)", rc, EXPECT_PROPS.Corners);
  checkProps("TextFramePreference", tf ? tf.textFramePreferences : null, EXPECT_PROPS.TextFramePreference);
  checkProps("TextWrapPreference", rc ? rc.textWrapPreferences : null, ["textWrapSide", "textWrapOffset", "textWrapMode", "textWrapType"]);
  checkProps("DocumentPreference", DOC.documentPreferences, ["facingPages", "pageWidth", "pageHeight", "pageBinding", "startPageNumber", "documentBleedUniformSize", "documentBleedTopOffset", "documentBleedBottomOffset", "documentBleedInsideOrLeftOffset", "documentBleedOutsideOrRightOffset", "documentSlugUniformSize", "slugTopOffset", "slugBottomOffset", "slugInsideOrLeftOffset", "slugRightOrOutsideOffset"]);
  checkProps("ViewPreference", DOC.viewPreferences, ["horizontalMeasurementUnits", "verticalMeasurementUnits", "rulerOrigin"]);
  checkProps("MarginPreference", DOC.marginPreferences, ["top", "bottom", "left", "right", "columnCount", "columnGutter"]);
  checkProps("GridPreference", DOC.gridPreferences, ["baselineStart", "baselineDivision"]);
  checkProps("Layer", DOC.layers.item(0), ["name", "visible", "locked", "printable"]);
  checkProps("Page", DOC.pages.item(0), ["appliedMaster", "marginPreferences", "name"]);
}

function closeTestDoc() {
  head("Limpieza");
  t("cerrar el documento de prueba sin guardarlo", function () { DOC.close(need("SaveOptions", "No")); DOC = null; });
  if (DOC) { info("ATENCION", "no se pudo cerrar el documento de prueba (se llama Sin título): ciérralo a mano sin guardar"); }
}

// ---------------------------------------------------------------- resultado
function reportPath() {
  var base = null;
  try { if (Folder.desktop && Folder.desktop.exists) { base = Folder.desktop; } } catch (e0) { }
  if (!base) { try { base = File($.fileName).parent; } catch (e1) { base = null; } }
  return base ? base.fsName + "/diagnostico_CS3.txt" : null;
}

function writeReport(p) {
  var f, ok;
  if (!p) { return false; }
  try {
    f = new File(p);
    f.encoding = "UTF-8";
    if (!f.open("w")) { return false; }       // open() y write() devuelven false (sin error) si no se puede escribir
    ok = f.write("\uFEFF" + REPORT.join("\r\n"));
    f.close();
    return ok !== false;
  } catch (e) { return false; }
}

function clip(s, n) { return s.length > n ? s.substring(0, n) + "..." : s; }

function showResult(p, saved) {
  var L = [], i;
  L.push("Comprobación de CS3 terminada: " + NCHECK + " pruebas, " + NFAIL + " fallos" + (DIFFS.length ? " y " + DIFFS.length + " diferencias que el script ya sabe sortear." : "."));
  for (i = 0; i < FAILS.length && i < 10; i++) { L.push(clip(FAILS[i], 170)); }
  if (FAILS.length > 10) { L.push("... y " + (FAILS.length - 10) + " fallos más (están en el informe)."); }
  if (DIFFS.length) {
    L.push("Diferencias con CS6 (ya previstas):");
    for (i = 0; i < DIFFS.length && i < 5; i++) { L.push("   " + clip(DIFFS[i].replace(/^\[distinto\] /, ""), 120)); }
  }
  if (MISSING.length) {
    L.push("Propiedades que este InDesign no tiene:");
    for (i = 0; i < MISSING.length && i < 6; i++) { L.push("   " + clip(MISSING[i], 150)); }
    if (MISSING.length > 6) { L.push("   ... y " + (MISSING.length - 6) + " clases más (están en el informe)."); }
  }
  L.push(saved ? "Informe completo, para enviarlo tal cual: " + p : "No se pudo guardar el informe en el Escritorio.");
  try { alert(L.join("\n")); } catch (e) { }
}

function main() {
  var p, saved;
  say("COMPROBACION DE INDESIGN CS3   (IDML a CS3, version " + CONVERTER + ")");
  try { info("fecha", new Date().toString()); } catch (e) { }
  environment();
  try { OLD_LEVEL = app.scriptPreferences.userInteractionLevel; app.scriptPreferences.userInteractionLevel = need("UserInteractionLevels", "NeverInteract"); } catch (e1) { OLD_LEVEL = undefined; }
  checkEnums();
  head("Crear el documento de prueba");
  t("crear un documento nuevo (app.documents.add)", function () { DOC = app.documents.add(); return "ok"; });
  if (DOC) {
    try { docChecks(); } catch (e2) { bad("error inesperado durante las pruebas", e2); }
    try { closeTestDoc(); } catch (e3) { bad("error al cerrar el documento de prueba", e3); }
  }
  try { if (OLD_LEVEL !== undefined) { app.scriptPreferences.userInteractionLevel = OLD_LEVEL; } } catch (e4) { }
  say("");
  say("RESUMEN: " + NCHECK + " pruebas, " + NFAIL + " fallos, " + DIFFS.length + " diferencias previstas, " + MISSING.length + " clases con propiedades que faltan.");
  p = reportPath();
  saved = writeReport(p);
  showResult(p, saved);
}

try { main(); } catch (eMain) {
  try { alert("La comprobación se detuvo por un error inesperado: " + txt(eMain) + (eMain && eMain.line ? " (línea " + eMain.line + ")" : "")); } catch (x) { }
}
