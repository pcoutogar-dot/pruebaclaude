'use strict';
// Traducción de atributos IDML -> propiedades del modelo de scripting de InDesign CS3.
// El valor resultante ya va "codificado" para el script de reconstrucción:
//   número / texto / booleano  -> tal cual
//   ['e', Clase, Valor]        -> enumeración (se resuelve en CS3, que usa nombres distintos a CS6)
//   ['sw', nombre]             -> muestra de color por nombre
//   ['ps', id] / ['cs', id]    -> estilo de párrafo / de carácter por id
const { round } = require('./geometry');
const { kidsEl, firstEl, textOf } = require('./xml');

// tipos: n número, i entero, b booleano, s texto, e enumeración (clase), c color
const TEXT_ATTRS = {
  PointSize: ['pointSize', 'n'],
  FontStyle: ['fontStyle', 's'],
  Tracking: ['tracking', 'n'],
  HorizontalScale: ['horizontalScale', 'n'],
  VerticalScale: ['verticalScale', 'n'],
  BaselineShift: ['baselineShift', 'n'],
  Skew: ['skew', 'n'],
  KerningValue: ['kerningValue', 'n'],
  Capitalization: ['capitalization', 'e', 'Capitalization'],
  Position: ['position', 'e', 'Position'],
  Underline: ['underline', 'b'],
  StrikeThru: ['strikeThru', 'b'],
  NoBreak: ['noBreak', 'b'],
  Ligatures: ['ligatures', 'b'],
  OverprintFill: ['overprintFill', 'b'],
  FillColor: ['fillColor', 'c'],
  StrokeColor: ['strokeColor', 'c'],
  FillTint: ['fillTint', 'tint'],
  StrokeTint: ['strokeTint', 'tint'],
  StrokeWeight: ['strokeWeight', 'n'],
  // párrafo
  Justification: ['justification', 'e', 'Justification'],
  FirstLineIndent: ['firstLineIndent', 'n'],
  LeftIndent: ['leftIndent', 'n'],
  RightIndent: ['rightIndent', 'n'],
  LastLineIndent: ['lastLineIndent', 'n'],
  SpaceBefore: ['spaceBefore', 'n'],
  SpaceAfter: ['spaceAfter', 'n'],
  KeepWithNext: ['keepWithNext', 'i'],
  KeepLinesTogether: ['keepLinesTogether', 'b'],
  KeepAllLinesTogether: ['keepAllLinesTogether', 'b'],
  KeepFirstLines: ['keepFirstLines', 'i'],
  KeepLastLines: ['keepLastLines', 'i'],
  StartParagraph: ['startParagraph', 'e', 'StartParagraph'],
  Hyphenation: ['hyphenation', 'b'],
  HyphenateWordsLongerThan: ['hyphenateWordsLongerThan', 'i'],
  HyphenateAfterFirst: ['hyphenateAfterFirst', 'i'],
  HyphenateBeforeLast: ['hyphenateBeforeLast', 'i'],
  HyphenateLadderLimit: ['hyphenateLadderLimit', 'i'],
  HyphenateCapitalizedWords: ['hyphenateCapitalizedWords', 'b'],
  DropCapCharacters: ['dropCapCharacters', 'i'],
  DropCapLines: ['dropCapLines', 'i'],
  AutoLeading: ['autoLeading', 'n'],
  AlignToBaseline: ['alignToBaseline', 'b'],
  MinimumWordSpacing: ['minimumWordSpacing', 'n'],
  DesiredWordSpacing: ['desiredWordSpacing', 'n'],
  MaximumWordSpacing: ['maximumWordSpacing', 'n'],
  MinimumLetterSpacing: ['minimumLetterSpacing', 'n'],
  DesiredLetterSpacing: ['desiredLetterSpacing', 'n'],
  MaximumLetterSpacing: ['maximumLetterSpacing', 'n'],
  MinimumGlyphScaling: ['minimumGlyphScaling', 'n'],
  DesiredGlyphScaling: ['desiredGlyphScaling', 'n'],
  MaximumGlyphScaling: ['maximumGlyphScaling', 'n'],
  SingleWordJustification: ['singleWordJustification', 'e', 'SingleWordJustification'],
};

// Atributos de texto que existen en IDML pero CS3 no sabe reproducir con este conversor.
const TEXT_UNSUPPORTED = {
  BulletsAndNumberingListType: (v) => v !== 'NoList',
  RuleAbove: (v) => v === 'true',
  RuleBelow: (v) => v === 'true',
  ParagraphShadingOn: (v) => v === 'true',
  ParagraphBorderOn: (v) => v === 'true',
  SpanColumnType: (v) => v !== 'SingleColumn',
  OTFFigureStyle: () => false,
};

const OBJECT_ATTRS = {
  FillColor: ['fillColor', 'c'],
  StrokeColor: ['strokeColor', 'c'],
  FillTint: ['fillTint', 'tint'],
  StrokeTint: ['strokeTint', 'tint'],
  StrokeWeight: ['strokeWeight', 'n'],
  GradientFillAngle: ['gradientFillAngle', 'n'],
  GradientStrokeAngle: ['gradientStrokeAngle', 'n'],
  StrokeAlignment: ['strokeAlignment', 'e', 'StrokeAlignment'],
  EndCap: ['endCap', 'e', 'EndCap'],
  EndJoin: ['endJoin', 'e', 'EndJoin'],
  MiterLimit: ['miterLimit', 'n'],
  OverprintFill: ['overprintFill', 'b'],
  OverprintStroke: ['overprintStroke', 'b'],
  TopLeftCornerOption: ['topLeftCornerOption', 'e', 'CornerOptions'],
  TopRightCornerOption: ['topRightCornerOption', 'e', 'CornerOptions'],
  BottomLeftCornerOption: ['bottomLeftCornerOption', 'e', 'CornerOptions'],
  BottomRightCornerOption: ['bottomRightCornerOption', 'e', 'CornerOptions'],
  TopLeftCornerRadius: ['topLeftCornerRadius', 'n'],
  TopRightCornerRadius: ['topRightCornerRadius', 'n'],
  BottomLeftCornerRadius: ['bottomLeftCornerRadius', 'n'],
  BottomRightCornerRadius: ['bottomRightCornerRadius', 'n'],
};

const FRAME_ATTRS = {
  TextColumnCount: ['textColumnCount', 'i'],
  TextColumnGutter: ['textColumnGutter', 'n'],
  TextColumnFixedWidth: ['textColumnFixedWidth', 'n'],
  UseFixedColumnWidth: ['useFixedColumnWidth', 'b'],
  VerticalJustification: ['verticalJustification', 'e', 'VerticalJustification'],
  FirstBaselineOffset: ['firstBaselineOffset', 'e', 'FirstBaselineOffset'],
  MinimumFirstBaselineOffset: ['minimumFirstBaselineOffset', 'n'],
  IgnoreWrap: ['ignoreWrap', 'b'],
};

function num(s) {
  if (s === undefined || s === null || s === '') return undefined;
  const v = Number(s);
  return Number.isFinite(v) ? v : undefined;
}

// Convierte un valor IDML según su tipo. ctx.color(ref) devuelve el nombre de la muestra o null.
function convertValue(raw, spec, ctx) {
  const type = spec[1];
  switch (type) {
    case 'n': { const v = num(raw); return v === undefined ? undefined : round(v, 4); }
    case 'i': { const v = num(raw); return v === undefined ? undefined : Math.round(v); }
    case 'b': return raw === 'true' ? true : raw === 'false' ? false : undefined;
    case 's': return raw === '' ? undefined : String(raw).replace(/^\$ID\//, '');
    case 'e': return raw ? ['e', spec[2], String(raw).replace(/^\$ID\//, '')] : undefined;
    case 'tint': { const v = num(raw); return v === undefined || v < 0 ? undefined : round(v, 2); }
    case 'c': {
      const name = ctx.color(raw);
      return name === null || name === undefined ? undefined : ['sw', name];
    }
    default: return undefined;
  }
}

function pickAttrs(attrs, table, ctx, out) {
  for (const k of Object.keys(attrs)) {
    const spec = table[k];
    if (!spec) continue;
    const v = convertValue(attrs[k], spec, ctx);
    if (v !== undefined) out[spec[0]] = v;
  }
  return out;
}

// ---- Properties (elementos hijo con atributo type) ----
// readPropValue devuelve: texto, número, lista, registro u objeto elemento (si no tiene type).
function readPropValue(el) {
  const t = el.attrs.type;
  if (t === 'list') return kidsEl(el).map(readPropValue);
  if (t === 'record') {
    const o = {};
    for (const k of kidsEl(el)) o[k.name] = readPropValue(k);
    return o;
  }
  if (t === undefined) return el;
  const s = textOf(el).trim();
  if (t === 'unit' || t === 'double' || t === 'long' || t === 'short' || t === 'int') { const v = num(s); return v === undefined ? s : v; }
  if (t === 'bool') return s === 'true';
  return s;
}

function readProperties(el) {
  const out = {};
  const p = firstEl(el, 'Properties');
  if (!p) return out;
  for (const k of kidsEl(p)) out[k.name] = readPropValue(k);
  return out;
}

const TAB_ALIGN = { LeftAlign: 'LeftAlign', CenterAlign: 'CenterAlign', RightAlign: 'RightAlign', CharacterAlign: 'CharacterAlign' };

// Propiedades de texto de un elemento (estilo o rango). Devuelve { props, basedOn, extra }
function textProps(el, ctx) {
  const props = {};
  pickAttrs(el.attrs, TEXT_ATTRS, ctx, props);
  const P = readProperties(el);
  if (typeof P.AppliedFont === 'string' && P.AppliedFont) props.appliedFont = P.AppliedFont;
  if (P.Leading !== undefined) {
    if (typeof P.Leading === 'number') props.leading = round(P.Leading, 4);
    else if (String(P.Leading).replace(/^\$ID\//, '') === 'Auto') props.leading = ['e', 'Leading', 'Auto'];
  }
  if (Array.isArray(P.TabList)) {
    const tabs = [];
    for (const t of P.TabList) {
      if (!t || typeof t !== 'object' || t.Position === undefined) continue;
      tabs.push({
        position: round(Number(t.Position), 3),
        alignment: TAB_ALIGN[t.Alignment] || 'LeftAlign',
        leader: typeof t.Leader === 'string' ? t.Leader : '',
        alignmentCharacter: typeof t.AlignmentCharacter === 'string' ? t.AlignmentCharacter : '',
      });
    }
    if (tabs.length) props.tabStops = tabs;
  }
  for (const k of Object.keys(TEXT_UNSUPPORTED)) {
    if (el.attrs[k] !== undefined && TEXT_UNSUPPORTED[k](el.attrs[k]) && ctx.unsupported) ctx.unsupported(k);
  }
  return { props, properties: P };
}

function objectProps(el, ctx) {
  const props = {};
  pickAttrs(el.attrs, OBJECT_ATTRS, ctx, props);
  // esquinas: formato antiguo (una sola opción para las cuatro)
  if (el.attrs.CornerOption && el.attrs.CornerOption !== 'None' && !el.attrs.TopLeftCornerOption) {
    const opt = ['e', 'CornerOptions', el.attrs.CornerOption];
    const r = num(el.attrs.CornerRadius);
    for (const c of ['topLeft', 'topRight', 'bottomLeft', 'bottomRight']) {
      props[c + 'CornerOption'] = opt;
      if (r !== undefined) props[c + 'CornerRadius'] = round(r, 3);
    }
  }
  // tinta -1 = sin tinta
  if (el.attrs.Visible === 'false') props.visible = false;
  return props;
}

function framePrefs(el, ctx) {
  const tfp = {};
  const t = firstEl(el, 'TextFramePreference');
  if (t) {
    pickAttrs(t.attrs, FRAME_ATTRS, ctx, tfp);
    const P = readProperties(t);
    if (Array.isArray(P.InsetSpacing) && P.InsetSpacing.length === 4 && P.InsetSpacing.every((v) => typeof v === 'number')) {
      tfp.insetSpacing = P.InsetSpacing.map((v) => round(v, 3));
    }
    if (t.attrs.AutoSizingType && t.attrs.AutoSizingType !== 'Off' && ctx.unsupported) ctx.unsupported('AutoSizingType');
  }
  const wrap = {};
  const w = firstEl(el, 'TextWrapPreference');
  if (w) {
    const mode = w.attrs.TextWrapMode;
    if (mode && mode !== 'None') {
      wrap.textWrapMode = ['e', 'TextWrapModes', mode];
      if (w.attrs.TextWrapSide) wrap.textWrapSide = ['e', 'TextWrapSideOptions', w.attrs.TextWrapSide];
      const P = readProperties(w);
      const o = P.TextWrapOffset;
      if (o && o.attrs) {
        wrap.textWrapOffset = ['Top', 'Left', 'Bottom', 'Right'].map((k) => round(num(o.attrs[k]) || 0, 3));
      }
    }
  }
  return { tfp, wrap };
}

module.exports = {
  TEXT_ATTRS, OBJECT_ATTRS, FRAME_ATTRS, num, convertValue, pickAttrs, readProperties, readPropValue,
  textProps, objectProps, framePrefs,
};
