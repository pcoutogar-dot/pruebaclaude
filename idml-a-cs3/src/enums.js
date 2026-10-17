'use strict';
// Constantes (enumeraciones) que el script de reconstrucción puede pedirle a InDesign, con el nombre que tienen en IDML.
// CS3 las llama en camelCase (leftAlign) y versiones posteriores en MAYUSCULAS (LEFT_ALIGN); el script las busca de las dos formas.
// Las usa la comprobación 0_comprobar_CS3.jsx y la simulación de las pruebas.
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
  TextWrapTypes: ['None', 'BoundingBoxTextWrap', 'Contour', 'JumpObjectTextWrap', 'NextColumnTextWrap', 'UserModified'],
  TextWrapSideOptions: ['BothSides', 'LeftSide', 'RightSide', 'SideTowardsSpine', 'SideAwayFromSpine', 'LargestArea'],
  Leading: ['Auto'],
  ListType: ['NoList', 'BulletList', 'NumberedList'],
  BulletCharacterType: ['UnicodeOnly', 'UnicodeWithFont', 'GlyphWithFont'],
  RuleWidth: ['ColumnWidth', 'TextWidth'],
  ArrowHead: ['None', 'SimpleArrowHead', 'SimpleWideArrowHead', 'TriangleArrowHead', 'TriangleWideArrowHead', 'BarbedArrowHead', 'CurvedArrowHead', 'CircleArrowHead', 'CircleSolidArrowHead', 'SquareArrowHead', 'SquareSolidArrowHead', 'BarArrowHead'],
  SaveOptions: ['No', 'Yes', 'Ask'],
};

module.exports = { ENUMS };
