'use strict';
// INX EXPERIMENTAL para InDesign CS3.
//
// INX era el formato XML de intercambio de InDesign CS2-CS5. IDML (CS4+) es, en esencia, el mismo
// vocabulario XML pero repartido en un paquete ZIP. Este módulo hace lo más directo:
//   1. une las partes del paquete (spreads, stories, estilos...) en un único XML <Document>,
//   2. rebaja los números de versión a los de CS3 (DOMVersion 5.0),
//   3. quita los elementos que sabemos que son posteriores a CS3.
//
// NO HE PODIDO PROBARLO CON UN INDESIGN CS3 REAL. Es posible que CS3 lo abra, que lo abra con
// avisos o que lo rechace. El script de reconstrucción (.jsx) es el camino fiable.
const X = require('./xml');

// Elementos que no existen en CS3 (por versión en la que aparecieron).
const NEWER_ELEMENTS = new Set([
  // CS4
  'TextVariable', 'TextVariableInstance', 'ConditionSet', 'Condition', 'CrossReferenceFormat', 'CrossReferenceSource',
  'BuildingBlock', 'ParagraphDestination', 'MediaItem', 'Movie', 'Sound', 'MultiStateObject', 'StateType',
  // CS5
  'Footnote', 'FootnoteOption', 'GrepStyle', 'NestedGrepStyle', 'AnimationSetting', 'TimingList', 'Timing', 'TimingSet', 'MotionPreset',
  'CheckBox', 'ComboBox', 'ListBox', 'RadioButton', 'SignatureField', 'TextBox', 'EPubExportPreference', 'HTMLExportPreference',
  // CS6
  'Article', 'ArticleMember', 'AlternateLayout', 'LinkedPageItemOption', 'LiquidLayout', 'TextFrameFittingOption', 'FrameFittingOption',
]);

// Atributos propios de versiones posteriores (CS5.5/CS6): marcas internas de cambio y diseño líquido.
const NEWER_ATTRS = new Set([
  'ParentInterfaceChangeCount', 'TargetInterfaceChangeCount', 'LastUpdatedInterfaceChangeCount',
  'HorizontalLayoutConstraints', 'VerticalLayoutConstraints', 'AppliedAlternateLayout', 'LayoutRule',
  'SnapshotBlendingMode', 'OptionalPage', 'PageTransitionType', 'PageTransitionDirection', 'PageTransitionDuration',
  'SpanColumnType', 'SpanColumnCount', 'SplitColumnInsideGutter', 'SplitColumnOutsideGutter',
  'AutoSizingType', 'AutoSizingReferencePoint', 'UseNoLineBreaksForAutoSizing',
]);

function prune(el, stats) {
  el.kids = el.kids.filter((k) => {
    if (k.name === undefined) return true;
    if (NEWER_ELEMENTS.has(k.name)) { stats.elements++; return false; }
    return true;
  });
  for (const a of Object.keys(el.attrs)) {
    if (NEWER_ATTRS.has(a)) { delete el.attrs[a]; stats.attrs++; }
  }
  for (const k of el.kids) if (k.name !== undefined) prune(k, stats);
}

function buildInx(pkg, opts) {
  opts = opts || {};
  const stats = { elements: 0, attrs: 0, parts: 0 };
  const src = pkg.designmap;
  const attrs = {};
  for (const k of Object.keys(src.attrs)) if (!k.startsWith('xmlns')) attrs[k] = src.attrs[k];
  attrs.DOMVersion = '5.0';
  const doc = { name: 'Document', attrs, kids: [] };

  const partBySrc = new Map(pkg.parts.map((p) => [p.src, p]));
  for (const k of src.kids) {
    if (k.name === undefined) continue;
    if (k.name.startsWith('idPkg:')) {
      const part = partBySrc.get(k.attrs.src);
      if (!part) continue;
      stats.parts++;
      if (part.type === 'Preferences' || part.type === 'Tags' || part.type === 'Graphic' || part.type === 'Fonts' || part.type === 'Styles' ||
        part.type === 'MasterSpread' || part.type === 'Spread' || part.type === 'Story' || part.type === 'BackingStory') {
        for (const c of part.root.kids) if (c.name !== undefined) doc.kids.push(c);
      }
    } else {
      doc.kids.push(k);
    }
  }
  prune(doc, stats);
  const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<?aid style="50" type="document" readerVersion="5.0" featureSet="257" product="5.0(640)" ?>\n';
  return { text: head + X.serialize(doc) + '\n', stats };
}

module.exports = { buildInx, NEWER_ELEMENTS, NEWER_ATTRS };
