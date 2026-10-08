'use strict';
// Simulación mínima (y estricta) del modelo de objetos de InDesign para ejecutar el script generado.
// No es InDesign: sirve para detectar errores de lógica/sintaxis en el script y comprobar qué documento
// resultaría. Las propiedades que CS3 no tiene lanzan error, como haría ExtendScript.
const vm = require('node:vm');

const ENUMS = {
  MeasurementUnits: ['Points', 'Millimeters', 'Picas', 'Inches', 'Centimeters', 'Ciceros', 'Agates'],
  RulerOrigin: ['SpreadOrigin', 'PageOrigin', 'SpineOrigin'],
  PageBindingOptions: ['LeftToRight', 'RightToLeft'],
  ColorModel: ['Process', 'Spot', 'Registration'],
  ColorSpace: ['CMYK', 'RGB', 'LAB'],
  GradientType: ['Linear', 'Radial'],
  LocationOptions: ['AtBeginning', 'AtEnd', 'Before', 'After'],
  NothingEnum: ['Nothing'],
  UserInteractionLevels: ['NeverInteract', 'InteractWithAll', 'InteractWithAlerts'],
  FitOptions: ['FillProportionally', 'Proportionally', 'ContentToFrame', 'FrameToContent'],
  SpecialCharacters: ['AutoPageNumber', 'NextPageNumber', 'PreviousPageNumber', 'IndentHereTab', 'RightIndentTab'],
  CoordinateSpaces: ['PasteboardCoordinates', 'InnerCoordinates'],
  AnchorPoint: ['CenterAnchor', 'TopLeftAnchor'],
  PathType: ['OpenPath', 'ClosedPath'],
  TabStopAlignment: ['LeftAlign', 'CenterAlign', 'RightAlign', 'CharacterAlign'],
  Justification: ['LeftAlign', 'CenterAlign', 'RightAlign', 'LeftJustified', 'CenterJustified', 'RightJustified', 'FullyJustified', 'ToBindingSide', 'AwayFromBindingSide'],
  Capitalization: ['Normal', 'SmallCaps', 'AllCaps', 'CapToSmallCap'],
  Position: ['Normal', 'Superscript', 'Subscript', 'OTSuperscript'],
  StartParagraph: ['Anywhere', 'NextColumn', 'NextFrame', 'NextPage'],
  SingleWordJustification: ['LeftAlign', 'CenterAlign', 'RightAlign', 'FullyJustified'],
  StrokeAlignment: ['CenterAlignment', 'InsideAlignment', 'OutsideAlignment'],
  EndCap: ['ButtEndCap', 'RoundEndCap', 'ProjectingEndCap'],
  EndJoin: ['MiterEndJoin', 'RoundEndJoin', 'BevelEndJoin'],
  CornerOptions: ['None', 'RoundedCorner', 'InverseRoundedCorner', 'InsetCorner', 'BevelCorner', 'FancyCorner'],
  VerticalJustification: ['TopAlign', 'CenterAlign', 'BottomAlign', 'JustifyAlign'],
  FirstBaselineOffset: ['AscentOffset', 'CapHeight', 'LeadingOffset', 'XHeight', 'FixedHeight'],
  TextWrapModes: ['None', 'BoundingBoxTextWrap', 'Contour', 'JumpObjectTextWrap', 'NextColumnTextWrap'],
  TextWrapSideOptions: ['BothSides', 'LeftSide', 'RightSide', 'LargestArea'],
  Leading: ['Auto'],
};

const SPECIAL_CHAR = { AutoPageNumber: '\u0018', NextPageNumber: '\u0019', PreviousPageNumber: '\u0017', IndentHereTab: '\u0007', RightIndentTab: '\u0008' };

const TEXT_PROPS = ['pointSize', 'leading', 'fontStyle', 'appliedFont', 'tracking', 'horizontalScale', 'verticalScale', 'baselineShift', 'skew', 'kerningValue', 'capitalization', 'position', 'underline', 'strikeThru', 'noBreak', 'ligatures', 'overprintFill', 'fillColor', 'strokeColor', 'fillTint', 'strokeTint', 'strokeWeight', 'justification', 'firstLineIndent', 'leftIndent', 'rightIndent', 'lastLineIndent', 'spaceBefore', 'spaceAfter', 'keepWithNext', 'keepLinesTogether', 'keepAllLinesTogether', 'keepFirstLines', 'keepLastLines', 'startParagraph', 'hyphenation', 'hyphenateWordsLongerThan', 'hyphenateAfterFirst', 'hyphenateBeforeLast', 'hyphenateLadderLimit', 'hyphenateCapitalizedWords', 'dropCapCharacters', 'dropCapLines', 'autoLeading', 'alignToBaseline', 'minimumWordSpacing', 'desiredWordSpacing', 'maximumWordSpacing', 'minimumLetterSpacing', 'desiredLetterSpacing', 'maximumLetterSpacing', 'minimumGlyphScaling', 'desiredGlyphScaling', 'maximumGlyphScaling', 'singleWordJustification'];
const ITEM_PROPS = ['geometricBounds', 'fillColor', 'fillTint', 'strokeColor', 'strokeTint', 'strokeWeight', 'strokeAlignment', 'endCap', 'endJoin', 'miterLimit', 'overprintFill', 'overprintStroke', 'gradientFillAngle', 'gradientStrokeAngle', 'topLeftCornerOption', 'topRightCornerOption', 'bottomLeftCornerOption', 'bottomRightCornerOption', 'topLeftCornerRadius', 'topRightCornerRadius', 'bottomLeftCornerRadius', 'bottomRightCornerRadius', 'itemLayer', 'label', 'visible', 'locked', 'rotationAngle', 'nextTextFrame', 'previousTextFrame', 'contents'];

function createMock(opts) {
  opts = opts || {};
  const style = opts.enumStyle || 'camel';
  const reject = new Set(opts.rejectProps || []);
  const state = { docs: [], alerts: [], confirms: [], dialogs: [], placed: [] };

  const fail = (p) => { throw new Error("Object does not support the property or method '" + p + "'"); };
  const camel = (v) => v.charAt(0).toLowerCase() + v.slice(1);
  const upper = (v) => v.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/([A-Z])([A-Z][a-z])/g, '$1_$2').toUpperCase();

  // ---- enumeraciones
  const enumObjs = {};
  for (const cls of Object.keys(ENUMS)) {
    const o = {};
    for (const v of ENUMS[cls]) {
      const val = { __enum: cls + '.' + v, valueOf() { return this.__enum; }, toString() { return this.__enum; } };
      if (/^[A-Z]+$/.test(v)) o[v] = val; else if (style === 'camel') o[camel(v)] = val; else o[upper(v)] = val;
    }
    enumObjs[cls] = o;
  }
  const enumName = (x) => (x && x.__enum ? x.__enum : x);

  // ---- objetos
  function invalid() {
    return new Proxy({}, { get: (t, p) => (p === 'isValid' ? false : (() => { throw new Error('Invalid object'); })()), set: () => { throw new Error('Invalid object'); } });
  }
  function obj(type, allowed, init, extra) {
    const store = Object.assign({}, init);
    const target = { __type: type, __store: store };
    const allow = new Set(allowed);
    const p = new Proxy(target, {
      get(t, k) {
        if (k === '__type') return type;
        if (k === '__store') return store;
        if (k === '__self') return p;
        if (extra && Object.prototype.hasOwnProperty.call(extra, k)) { const v = extra[k]; return typeof v === 'function' && v.__getter ? v() : v; }
        if (k === 'isValid') return true;
        return store[k];
      },
      set(t, k, v) {
        if (extra && extra.__set && extra.__set(k, v, p)) return true;
        if (reject.has(k) || !allow.has(k)) fail(String(k));
        store[k] = v;
        return true;
      },
    });
    return p;
  }
  const getter = (fn) => { fn.__getter = true; return fn; };

  // ---- colecciones
  function coll(items, hooks) {
    hooks = hooks || {};
    const find = (x) => {
      if (typeof x === 'number') { const i = x < 0 ? items.length + x : x; return items[i] || invalid(); }
      return items.find((o) => o.name === x) || invalid();
    };
    return new Proxy(items, {
      get(t, k) {
        if (k === 'length') return t.length;
        if (k === 'item') return (x) => find(x);
        if (k === 'itemByName') return (x) => find(String(x));
        if (k === 'add') return hooks.add ? hooks.add : () => fail('add');
        if (k === 'everyItem') return () => new Proxy({}, { get: (_, pk) => t.map((o) => o[pk]) });
        if (k === 'itemByRange') return hooks.itemByRange ? hooks.itemByRange : () => fail('itemByRange');
        if (k === 'toArray') return () => t.slice();
        if (typeof k === 'string' && /^-?\d+$/.test(k)) { const n = Number(k); const i = n < 0 ? t.length + n : n; return hooks.at ? hooks.at(i) : t[i]; }
        if (k === Symbol.iterator) return t[Symbol.iterator].bind(t);
        return t[k];
      },
    });
  }
  function applyInit(o, init) { if (init) for (const k of Object.keys(init)) o[k] = init[k]; return o; }

  // ---- texto (historias, rangos, celdas)
  function textContainer(doc) {
    const chars = [];
    const defaultChar = (ch) => ({ ch, ps: doc.__store.paragraphStyles[1], cs: doc.__store.characterStyles[0], p: {} });
    const mkRange = (a, b) => {
      const fn = (k, v) => {
        if (k === 'appliedParagraphStyle') { for (let i = a; i <= b; i++) chars[i].ps = v; return true; }
        if (k === 'appliedCharacterStyle') { for (let i = a; i <= b; i++) chars[i].cs = v; return true; }
        if (!TEXT_PROPS.includes(k) || reject.has(k)) fail(k);
        if (k === 'appliedFont' && (!v || (typeof v === 'object' && v.isValid === false))) throw new Error('invalid font');
        for (let i = a; i <= b; i++) chars[i].p[k] = v;
        return true;
      };
      return new Proxy({}, {
        get: (t, k) => (k === 'length' ? b - a + 1 : k === 'contents' ? chars.slice(a, b + 1).map((c) => c.ch).join('') : undefined),
        set: (t, k, v) => fn(k, v),
      });
    };
    const api = {
      chars,
      get text() { return chars.map((c) => c.ch).join(''); },
      setText(s) { chars.length = 0; for (const ch of s) { if (ch.length === 2) { chars.push(defaultChar(ch[0])); chars.push(defaultChar(ch[1])); } else chars.push(defaultChar(ch)); } },
      append(x) {
        const s = x && x.__enum ? SPECIAL_CHAR[x.__enum.split('.')[1]] : String(x);
        if (s === undefined) fail('contents');
        for (const ch of s) chars.push(defaultChar(ch));
      },
      range: mkRange,
    };
    const characters = coll(chars.map(() => 0), {});
    const charsColl = new Proxy({}, {
      get(t, k) {
        if (k === 'length') return chars.length;
        if (k === 'itemByRange') return (a, b) => {
          if (a < 0 || b >= chars.length || a > b) throw new Error('itemByRange fuera de rango: ' + a + '..' + b + ' de ' + chars.length);
          return mkRange(a, b);
        };
        if (k === 'item') return (i) => mkRange(i, i);
        return undefined;
      },
    });
    void characters;
    api.characters = charsColl;
    api.insertionPoints = new Proxy({}, {
      get(t, k) {
        const mkIp = (idx) => new Proxy({}, {
          get: (_, kk) => (kk === 'tables' ? { add: (init) => api.addTable(idx, init, doc) } : undefined),
          set: (_, kk, v) => { if (kk !== 'contents') fail(kk); api.append(v); return true; },
        });
        if (k === 'length') return chars.length + 1;
        if (k === 'item') return (i) => mkIp(i < 0 ? chars.length + 1 + i : i);
        if (typeof k === 'string' && /^-?\d+$/.test(k)) { const n = Number(k); return mkIp(n < 0 ? chars.length + 1 + n : n); }
        return undefined;
      },
    });
    api.facade = new Proxy({}, {
      get: (t, k) => (k === 'contents' ? api.text : k === 'characters' ? api.characters : k === 'insertionPoints' ? api.insertionPoints : k === 'length' ? chars.length : undefined),
      set: (t, k, v) => { if (k !== 'contents') fail(String(k)); api.setText(String(v)); return true; },
    });
    api.tables = [];
    api.addTable = (idx, init, d) => {
      const tbl = makeTable(init, d);
      api.tables.push({ pos: idx, table: tbl });
      return tbl;
    };
    return api;
  }

  function makeTable(init, doc) {
    const rowsN = (init.headerRowCount || 0) + (init.bodyRowCount || 0) + (init.footerRowCount || 0);
    const colsN = init.columnCount;
    const cells = [];
    const rows = []; const cols = [];
    for (let r = 0; r < rowsN; r++) {
      const rowCells = [];
      for (let c = 0; c < colsN; c++) {
        const tc = textContainer(doc);
        const cell = obj('Cell', ['fillColor'], { r, c, merged: null }, {
          __set(k, v) { if (k === 'contents') { tc.setText(String(v)); return true; } return false; },
          contents: getter(() => tc.text),
          characters: tc.characters,
          texts: { item: () => ({ characters: tc.characters }) },
          merge(other) { cell.__store.merged = other.__store ? { r: other.__store.r, c: other.__store.c } : null; },
          __text: tc,
        });
        rowCells.push(cell); cells.push(cell);
      }
      rows.push(obj('Row', ['height'], { r }, { cells: coll(rowCells) }));
    }
    for (let c = 0; c < colsN; c++) cols.push(obj('Column', ['width'], { c }));
    return { __table: true, rows: coll(rows), columns: coll(cols), cells: coll(cells), rowsN, colsN, init };
  }

  // ---- documento
  function newDocument() {
    const doc = obj('Document', [], {}, {});
    const st = doc.__store;
    st.facing = true;
    const mkStyle = (name, kind) => {
      const s = obj(kind, ['name', 'basedOn', 'nextStyle'].concat(TEXT_PROPS), { name }, {});
      s.__store.tabs = [];
      Object.defineProperty(s.__store, 'tabStops', { enumerable: false, value: null, writable: true });
      return s;
    };
    const withTabs = (s) => {
      const tabs = s.__store.tabs;
      const ex = { tabStops: { add: (init) => { if (!init || typeof init !== 'object') fail('tabStops.add'); tabs.push(init); return init; } } };
      return new Proxy(s, { get: (t, k) => (k === 'tabStops' ? ex.tabStops : t[k]), set: (t, k, v) => { t[k] = v; return true; } });
    };
    st.paragraphStyles = [mkStyle('[No paragraph style]', 'ParagraphStyle'), mkStyle('[Basic Paragraph]', 'ParagraphStyle')].map(withTabs);
    st.characterStyles = [mkStyle('[No character style]', 'CharacterStyle')].map(withTabs);
    st.colors = []; st.tints = []; st.gradients = [];
    const mkLayer = (init) => {
      const l = obj('Layer', ['name', 'visible', 'locked', 'printable'], { visible: true, locked: false, printable: true }, {
        move(to) {
          const i = st.layers.indexOf(l);
          st.layers.splice(i, 1);
          if (enumName(to) === 'LocationOptions.AtBeginning') st.layers.unshift(l); else st.layers.push(l);
        },
      });
      return applyInit(l, init);
    };
    st.layers = [mkLayer({ name: 'Layer 1' })];
    st.pagesArr = []; st.masters = [];

    const prefs = (name, props, init) => obj(name, props, init || {});
    const view = prefs('ViewPreferences', ['horizontalMeasurementUnits', 'verticalMeasurementUnits', 'rulerOrigin']);
    const dp = obj('DocumentPreferences', ['pageWidth', 'pageHeight', 'pageBinding', 'startPageNumber', 'documentBleedUniformSize', 'documentBleedTopOffset', 'documentBleedBottomOffset', 'documentBleedInsideOrLeftOffset', 'documentBleedOutsideOrRightOffset', 'documentSlugUniformSize', 'slugTopOffset', 'slugBottomOffset', 'slugInsideOrLeftOffset', 'slugRightOrOutsideOffset'], { pageWidth: 612, pageHeight: 792 }, {
      __set(k, v) { if (k === 'facingPages') { st.facing = v; resizeMasters(); return true; } return false; },
      facingPages: getter(() => st.facing),
    });
    const marginPrefs = () => obj('MarginPreferences', ['top', 'bottom', 'left', 'right', 'columnCount', 'columnGutter'], { top: 36, bottom: 36, left: 36, right: 36, columnCount: 1, columnGutter: 12 });
    st.margin = marginPrefs();

    function pageItemsApi(owner, page) {
      const make = (kind) => (init) => {
        const it = makeItem(kind, page, init, owner);
        owner.items.push(it);
        return it;
      };
      const mk = (kind) => ({ add: make(kind) });
      return {
        textFrames: mk('text'), rectangles: mk('rect'), ovals: mk('oval'), polygons: mk('poly'), graphicLines: mk('line'),
        groups: { add: (arr) => { const g = makeItem('group', page, {}, owner); g.__store.kids = arr; for (const k of arr) { k.__store.group = g; const i = owner.items.indexOf(k); if (i >= 0) owner.items.splice(i, 1); } owner.items.push(g); return g; } },
      };
    }

    function makePage(owner, label) {
      const store = { items: [] };
      const ownerHolder = { items: store.items };
      const api = pageItemsApi(ownerHolder, null);
      const page = obj('Page', ['appliedMaster', 'name'], { name: label, applied: null }, Object.assign({}, api, {
        marginPreferences: marginPrefs(),
        parent: getter(() => owner.spread()),
        __items: store.items,
        __set(k, v) {
          if (k === 'appliedMaster') { if (v && v.isValid === false) throw new Error('invalid master'); page.__store.applied = v; return true; }
          return false;
        },
        appliedMaster: getter(() => page.__store.applied),
      }));
      // los elementos creados conocen su página
      for (const kind of ['textFrames', 'rectangles', 'ovals', 'polygons', 'graphicLines']) {
        const orig = api[kind].add;
        api[kind].add = (init) => { const it = orig(init); it.__store.page = page; return it; };
      }
      const g0 = api.groups.add;
      api.groups.add = (arr) => { const g = g0(arr); g.__store.page = page; return g; };
      return page;
    }

    function initialAppliedMaster() { return st.masters[0] || null; }

    function makeItem(kind, page, init, owner) {
      const store = { kind, kids: null, graphics: [], paths: null, story: null, rot: 0 };
      const graphics = [];
      const it = obj('PageItem:' + kind, ITEM_PROPS, { kind, layer: null, props: {} }, {
        __kind: kind,
        __set(k, v, self) {
          if (k === 'itemLayer') { if (v && v.isValid === false) throw new Error('invalid layer'); self.__store.layer = v; return true; }
          if (k === 'geometricBounds') { if (!Array.isArray(v) && !(v && typeof v.length === 'number') || v.length !== 4) throw new Error('bad bounds'); self.__store.bounds = Array.from(v); if (kind !== 'text' || true) setDefaultPath(self); return true; }
          if (k === 'rotationAngle') { if (reject.has('rotationAngle')) fail(k); self.__store.rot = v; return true; }
          if (k === 'contents') { if (kind !== 'text') fail(k); storyOf(self).setText(String(v)); return true; }
          if (k === 'nextTextFrame') {
            if (kind !== 'text') fail(k);
            const other = v;
            self.__store.next = other; other.__store.prev = self;
            const s = storyOf(self);
            other.__store.story = s; s.frames.push(other);
            return true;
          }
          if (k === 'fillColor' || k === 'strokeColor') { if (v && v.isValid === false) throw new Error('invalid swatch'); self.__store[k] = v; return true; }
          return false;
        },
        parentStory: getter(() => (kind === 'text' ? storyOf(it).facade : fail('parentStory'))),
        contents: getter(() => (kind === 'text' ? storyOf(it).text : fail('contents'))),
        rotationAngle: getter(() => it.__store.rot),
        textFramePreferences: kind === 'text' ? obj('TextFramePreferences', ['textColumnCount', 'textColumnGutter', 'textColumnFixedWidth', 'useFixedColumnWidth', 'verticalJustification', 'firstBaselineOffset', 'minimumFirstBaselineOffset', 'ignoreWrap', 'insetSpacing']) : undefined,
        textWrapPreferences: obj('TextWrapPreferences', ['textWrapMode', 'textWrapSide', 'textWrapOffset', 'inverse']),
        transparencySettings: { blendingSettings: obj('BlendingSettings', ['opacity']) },
        paths: getter(() => coll([pathObj(it)])),
        graphics: coll(graphics),
        place(f) {
          if (!f || !f.exists) throw new Error('file does not exist');
          const g = obj('Graphic', ['geometricBounds'], { geometricBounds: it.__store.bounds && it.__store.bounds.slice(), file: f.fsName });
          graphics.push(g); state.placed.push({ file: f.fsName, item: it });
          return [g];
        },
        fit(opt) { it.__store.fitted = enumName(opt); },
        override(pg) { const c = makeItem(kind, pg, {}, { items: pg.__items }); c.__store.bounds = it.__store.bounds; c.__store.overrideOf = it; pg.__items.push(c); return c; },
        remove() { const arr = it.__store.page ? it.__store.page.__items : null; if (arr) { const i = arr.indexOf(it); if (i >= 0) arr.splice(i, 1); } it.__store.removed = true; },
        rotate(a) { it.__store.rot = a; },
        transform() { it.__store.transformed = true; },
        pdf: undefined,
      });
      applyInit(it, init);
      return it;
    }
    function storyOf(item) {
      if (!item.__store.story) {
        const s = textContainer(doc);
        s.frames = [item];
        item.__store.story = s;
        // expone texto con la forma de un Story
      }
      return item.__store.story;
    }
    function setDefaultPath(item) {
      const b = item.__store.bounds;
      if (item.__store.customPath) return;
      item.__store.path = { pts: [[b[1], b[0]], [b[1], b[2]], [b[3], b[2]], [b[3], b[0]]], open: false, dirs: {} };
    }
    function pathObj(item) {
      const kind = item.__store.kind;
      if (!item.__store.path) setDefaultPath(item);
      const P = item.__store.path;
      return obj('Path', ['entirePath', 'pathType'], {}, {
        __set(k, v) {
          if (k === 'entirePath') { if (reject.has('entirePath')) fail(k); P.pts = Array.from(v).map((p) => Array.from(p)); item.__store.customPath = true; return true; }
          if (k === 'pathType') { P.open = enumName(v) === 'PathType.OpenPath'; return true; }
          return false;
        },
        entirePath: getter(() => P.pts),
        pathPoints: coll(P.pts.map((_, i) => obj('PathPoint', ['leftDirection', 'rightDirection', 'anchor'], {}, {
          __set(k, v) { if (k === 'leftDirection' || k === 'rightDirection') { P.dirs[i] = P.dirs[i] || {}; P.dirs[i][k] = Array.from(v); return true; } return false; },
        }))),
      });
    }
    void kindHelpers;

    function kindHelpers() { }

    // páginas / pliegos
    function spreadsOf() {
      const pages = st.pagesArr; const out = [];
      if (st.facing) {
        if (pages.length) out.push([pages[0]]);
        for (let i = 1; i < pages.length; i += 2) out.push(pages.slice(i, i + 2));
      } else pages.forEach((p) => out.push([p]));
      return out;
    }
    const spreadObjFor = (page) => {
      const group = spreadsOf().find((g) => g.includes(page.__self || page)) || [page];
      return { pages: coll(group.slice()) };
    };
    function addPage() {
      const owner = { spread: () => spreadObjFor(page), items: [] };
      const page = makePage(owner, String(st.pagesArr.length + 1));
      page.__store.applied = initialAppliedMaster();
      st.pagesArr.push(page);
      return page;
    }
    function makeMaster(first) {
      const n = st.facing ? 2 : 1;
      const pg = [];
      const m = obj('MasterSpread', ['namePrefix', 'baseName'], { namePrefix: first ? 'A' : String.fromCharCode(65 + st.masters.length), baseName: 'Master' }, {
        name: getter(() => m.__store.namePrefix + '-' + m.__store.baseName),
        pages: getter(() => coll(pg)),
        __pages: pg,
      });
      const owner = { spread: () => ({ pages: coll(pg) }), items: [] };
      for (let i = 0; i < n; i++) pg.push(makePage(owner, String.fromCharCode(65 + i)));
      return m;
    }
    function resizeMasters() {
      for (const m of st.masters) {
        const want = st.facing ? 2 : 1;
        const arr = m.__pages;
        while (arr.length > want) arr.pop();
        while (arr.length < want) {
          const owner = { spread: () => ({ pages: coll(arr) }), items: [] };
          arr.push(makePage(owner, String.fromCharCode(65 + arr.length)));
        }
      }
    }
    const m0 = makeMaster(true);
    st.masters.push(m0);
    addPage();

    const named = (init, allowed, type) => {
      const o = obj(type, allowed, {}, {});
      applyInit(o, init);
      return o;
    };
    const ex = {
      viewPreferences: view,
      documentPreferences: dp,
      marginPreferences: st.margin,
      colors: coll(st.colors, { add: (init) => { if (st.colors.concat(st.tints, st.gradients).some((c) => c.name === init.name)) throw new Error('name must be unique'); const c = named(init, ['name', 'model', 'space', 'colorValue'], 'Color'); st.colors.push(c); return c; } }),
      tints: coll(st.tints, { add: (init) => { if (!init.baseColor || init.baseColor.isValid === false) throw new Error('bad base'); const c = named(init, ['name', 'baseColor', 'tintValue'], 'Tint'); st.tints.push(c); return c; } }),
      gradients: coll(st.gradients, {
        add: (init) => {
          const stops = [obj('GradientStop', ['stopColor', 'location'], { location: 0 }), obj('GradientStop', ['stopColor', 'location'], { location: 100 })];
          const g = obj('Gradient', ['name', 'type'], {}, { gradientStops: coll(stops, { add: (i2) => { const s = named(i2, ['stopColor', 'location'], 'GradientStop'); stops.push(s); return s; } }) });
          applyInit(g, init); st.gradients.push(g); return g;
        },
      }),
      layers: coll(st.layers, {
        add: (init) => { const l = mkLayer(init); st.layers.unshift(l); return l; },
      }),
      paragraphStyles: coll(st.paragraphStyles, { add: (init) => { if (st.paragraphStyles.some((s) => s.name === init.name)) throw new Error('name must be unique'); const s = withTabs(mkStyle(init.name, 'ParagraphStyle')); st.paragraphStyles.push(s); return s; } }),
      characterStyles: coll(st.characterStyles, { add: (init) => { if (st.characterStyles.some((s) => s.name === init.name)) throw new Error('name must be unique'); const s = withTabs(mkStyle(init.name, 'CharacterStyle')); st.characterStyles.push(s); return s; } }),
      masterSpreads: coll(st.masters, { add: () => { const m = makeMaster(false); st.masters.push(m); return m; } }),
      pages: coll(st.pagesArr, { add: () => addPage() }),
    };
    // las layers se añaden "encima" del todo; el objeto Document usa una vista de swatches calculada
    Object.defineProperty(ex, 'swatches', {
      get() {
        const builtin = ['None', 'Paper', 'Black', 'Registration'].map((n) => obj('Swatch', [], { name: n }));
        return coll(builtin.concat(st.colors, st.tints, st.gradients));
      },
      enumerable: true,
    });
    const docProxy = new Proxy(ex, { get: (t, k) => (k === '__store' ? st : k === '__type' ? 'Document' : k === 'isValid' ? true : t[k]), set: (t, k) => fail(String(k)) });
    return docProxy;
  }

  // ---- aplicación
  const fonts = [];
  for (const [fam, sty] of (opts.fonts || [['Minion Pro', 'Regular'], ['Minion Pro', 'Bold'], ['Myriad Pro', 'Bold'], ['Myriad Pro', 'Regular'], ['Arial', 'Regular'], ['Arial', 'Bold']])) {
    fonts.push(obj('Font', [], { name: fam + '\t' + sty, fontFamily: fam, fontStyleName: sty }));
  }
  const documents = coll(state.docs, { add: () => { const d = newDocument(); state.docs.push(d); return d; } });
  const app = {
    name: 'Adobe InDesign', version: '5.0',
    documents,
    fonts: coll(fonts, {}),
    scriptPreferences: obj('ScriptPreferences', ['userInteractionLevel', 'enableRedraw'], { userInteractionLevel: enumObjs.UserInteractionLevels[style === 'camel' ? 'interactWithAll' : 'INTERACT_WITH_ALL'], enableRedraw: true }),
    pdfPlacePreferences: obj('PdfPlacePreferences', ['pageNumber']),
    activeWindow: obj('Window', ['activePage']),
    transformationMatrices: { add: (init) => init },
  };

  // ---- sistema de archivos virtual
  const vfs = opts.vfs || {};
  const norm = (p) => String(p).replace(/\\/g, '/');
  class MFile {
    constructor(p) { this.path = norm(p); }
    get exists() { return this.path in vfs && vfs[this.path] !== 'dir'; }
    get name() { return encodeURI(this.path.split('/').pop()); }
    get fsName() { return this.path; }
    get parent() { return new MFolder(this.path.split('/').slice(0, -1).join('/') || '/'); }
    open() { return true; } write(s) { state.logFile = s; return true; } close() { return true; }
  }
  class MFolder {
    constructor(p) { this.path = norm(p); }
    get fsName() { return this.path; }
    get name() { return encodeURI(this.path.split('/').pop()); }
    getFiles() {
      const pre = this.path.replace(/\/$/, '') + '/';
      const seen = new Map();
      for (const k of Object.keys(vfs)) {
        if (!k.startsWith(pre)) continue;
        const rest = k.slice(pre.length);
        const first = rest.split('/')[0];
        if (rest.includes('/')) seen.set(first, new MFolder(pre + first)); else seen.set(first, new MFile(k));
      }
      return Array.from(seen.values());
    }
    static selectDialog(msg) { state.dialogs.push(msg); return opts.pickFolder ? new MFolder(opts.pickFolder) : null; }
  }
  Object.setPrototypeOf(MFolder, Function.prototype);

  const sandbox = Object.assign({}, enumObjs, {
    app,
    File: function File(p) { return new MFile(p); },
    Folder: MFolder,
    alert: (m) => { state.alerts.push(String(m)); },
    confirm: (m) => { state.confirms.push(String(m)); return !!opts.confirmYes; },
    $: { fileName: opts.scriptPath || '/virtual/scripts/reconstruir.jsx', global: null },
  });
  sandbox.File.prototype = MFile.prototype;
  sandbox.$.global = sandbox;
  return { sandbox, state, app };
}

function runJsx(code, opts) {
  const m = createMock(opts);
  const ctx = vm.createContext(m.sandbox);
  let error = null;
  // ExtendScript interpreta las directivas #target / #include antes de ejecutar
  const src = code.replace(/^#.*$/gm, '//');
  try { vm.runInContext(src, ctx, { filename: 'reconstruir.jsx', timeout: 20000 }); } catch (e) { error = e; }
  return { state: m.state, error, doc: m.state.docs[0] };
}

// instantánea plana del documento para las pruebas
function snapshot(doc) {
  return JSON.parse(JSON.stringify(snapshotRaw(doc)));
}
function snapshotRaw(doc) {
  const st = doc.__store;
  const num = (b) => (b ? b.map((v) => Math.round(v * 1000) / 1000) : b);
  const itemSnap = (it) => {
    const s = it.__store;
    const o = {
      kind: s.kind, bounds: num(s.bounds), rot: s.rot || 0, layer: s.layer ? s.layer.name : null,
      fill: s.fillColor && s.fillColor.name, stroke: s.strokeColor && s.strokeColor.name,
      label: s.label, visible: s.visible,
    };
    if (s.kids) o.kids = s.kids.map(itemSnap);
    if (s.path && s.customPath) o.path = s.path.pts.map((p) => p.map((v) => Math.round(v * 1000) / 1000));
    if (s.path && s.path.open) o.open = true;
    if (s.path && Object.keys(s.path.dirs).length) o.dirs = s.path.dirs;
    for (const k of Object.keys(s)) {
      if (/^(topLeft|topRight|bottomLeft|bottomRight)Corner|fillTint|strokeWeight|gradientFillAngle|strokeAlignment/.test(k)) o[k] = s[k] && s[k].__enum ? s[k].__enum : s[k];
    }
    if (it.graphics.length) o.graphic = { file: it.graphics.item(0).geometricBounds && it.graphics.item(0).__store.file, bounds: num(it.graphics.item(0).geometricBounds) };
    if (s.fitted) o.fitted = s.fitted;
    if (s.removed) o.removed = true;
    return o;
  };
  const pageSnap = (p) => ({
    name: p.name, master: p.__store.applied ? p.__store.applied.name : null,
    margins: ['top', 'bottom', 'left', 'right', 'columnCount', 'columnGutter'].map((k) => p.marginPreferences[k]),
    spreadPages: p.parent.pages.length,
    items: p.__items.filter((i) => !i.__store.group).map(itemSnap),
  });
  return {
    prefs: {
      w: doc.documentPreferences.pageWidth, h: doc.documentPreferences.pageHeight, facing: doc.documentPreferences.facingPages,
      units: enumOf(doc.viewPreferences.horizontalMeasurementUnits), origin: enumOf(doc.viewPreferences.rulerOrigin),
    },
    layers: st.layers.map((l) => ({ name: l.name, visible: l.visible, locked: l.locked })),
    colors: st.colors.map((c) => ({ name: c.name, model: enumOf(c.model), space: enumOf(c.space), v: c.colorValue })),
    tints: st.tints.map((t) => ({ name: t.name, base: t.baseColor.name, v: t.tintValue })),
    gradients: st.gradients.map((g) => ({ name: g.name, stops: Array.from({ length: g.gradientStops.length }, (_, i) => [g.gradientStops.item(i).stopColor && g.gradientStops.item(i).stopColor.name, g.gradientStops.item(i).location]) })),
    pstyles: st.paragraphStyles.map((s) => ({ name: s.name, basedOn: s.basedOn && s.basedOn.name, next: s.nextStyle && s.nextStyle.name, props: plain(s.__store), tabs: s.__store.tabs })),
    cstyles: st.characterStyles.map((s) => ({ name: s.name, basedOn: s.basedOn && s.basedOn.name, props: plain(s.__store) })),
    masters: st.masters.map((m) => ({ name: m.name, pages: m.__pages.map(pageSnap) })),
    pages: st.pagesArr.map(pageSnap),
  };
}
function enumOf(x) { return x && x.__enum ? x.__enum : x; }
function plain(store) {
  const o = {};
  for (const k of Object.keys(store)) {
    if (k === 'name' || k === 'basedOn' || k === 'nextStyle' || k === 'tabs') continue;
    const v = store[k];
    o[k] = v && v.__enum ? v.__enum : v && v.__store && v.__store.fontFamily ? 'font:' + v.__store.name : v && v.name && typeof v === 'object' ? 'obj:' + v.name : v;
  }
  return o;
}

// historia de un marco de texto -> { text, runs }
function storyOf(frame) {
  const s = frame.__store.story;
  const chars = s.chars;
  return {
    text: s.text,
    paras: chars.map((c) => c.ps && c.ps.name),
    cstyles: chars.map((c) => c.cs && c.cs.name),
    props: chars.map((c) => plain2(c.p)),
    tables: s.tables,
  };
}
function plain2(p) {
  const o = {};
  for (const k of Object.keys(p)) { const v = p[k]; o[k] = v && v.__enum ? v.__enum : v && v.__store && v.__store.fontFamily ? 'font:' + v.__store.name : v && v.name ? 'obj:' + v.name : v; }
  return o;
}

module.exports = { runJsx, snapshot, storyOf, createMock };
