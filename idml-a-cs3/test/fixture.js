'use strict';
// Generador de un IDML sintético (estructura fiel a lo que escribe InDesign CS6, DOMVersion 8.0).
// No es un documento real de InDesign: sirve para probar el conversor sin tener InDesign a mano.
const zlib = require('node:zlib');
const { writeZip, crc32 } = require('../src/zip');

const NS = 'xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging"';
const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const AID = '<?aid style="50" type="document" readerVersion="6.0" featureSet="257" product="8.0(370)" ?>\n';

function part(type, inner) {
  return HEAD + AID + '<idPkg:' + type + ' ' + NS + ' DOMVersion="8.0">\n' + inner + '\n</idPkg:' + type + '>\n';
}
function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// Rectángulo: TL, BL, BR, TR (como lo escribe InDesign)
function rectPath(x1, y1, x2, y2) {
  const p = (x, y) => '<PathPointType Anchor="' + x + ' ' + y + '" LeftDirection="' + x + ' ' + y + '" RightDirection="' + x + ' ' + y + '"/>';
  return '<Properties><PathGeometry><GeometryPathType PathOpen="false"><PathPointArray>' +
    p(x1, y1) + p(x1, y2) + p(x2, y2) + p(x2, y1) + '</PathPointArray></GeometryPathType></PathGeometry></Properties>';
}
function ovalPath(cx, cy, rx, ry) {
  const k = 0.5523;
  const pt = (ax, ay, lx, ly, rx_, ry_) => '<PathPointType Anchor="' + ax + ' ' + ay + '" LeftDirection="' + lx + ' ' + ly + '" RightDirection="' + rx_ + ' ' + ry_ + '"/>';
  return '<Properties><PathGeometry><GeometryPathType PathOpen="false"><PathPointArray>' +
    pt(cx, cy - ry, cx + k * rx, cy - ry, cx - k * rx, cy - ry) +
    pt(cx - rx, cy, cx - rx, cy - k * ry, cx - rx, cy + k * ry) +
    pt(cx, cy + ry, cx - k * rx, cy + ry, cx + k * rx, cy + ry) +
    pt(cx + rx, cy, cx + rx, cy + k * ry, cx + rx, cy - k * ry) +
    '</PathPointArray></GeometryPathType></PathGeometry></Properties>';
}
function polyPath(points, open) {
  return '<Properties><PathGeometry><GeometryPathType PathOpen="' + (open ? 'true' : 'false') + '"><PathPointArray>' +
    points.map(([x, y]) => '<PathPointType Anchor="' + x + ' ' + y + '" LeftDirection="' + x + ' ' + y + '" RightDirection="' + x + ' ' + y + '"/>').join('') +
    '</PathPointArray></GeometryPathType></PathGeometry></Properties>';
}

// PNG de 2x2 píxeles válido (para la imagen incrustada)
function tinyPng() {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(2, 0); ihdr.writeUInt32BE(2, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.from([0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 255, 255, 0]); // 2 filas: filtro 0 + 2 px RGB
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function content(text) { return '<Content>' + esc(text) + '</Content>'; }
function csr(inner, attrs, props) {
  return '<CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[No character style]"' + (attrs ? ' ' + attrs : '') + '>' +
    (props ? '<Properties>' + props + '</Properties>' : '') + inner + '</CharacterStyleRange>';
}
function psr(style, inner, attrs) {
  return '<ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/' + style + '"' + (attrs ? ' ' + attrs : '') + '>' + inner + '</ParagraphStyleRange>';
}
function story(id, inner) {
  return part('Story', '<Story Self="' + id + '" AppliedTOCStyle="n" TrackChanges="false" StoryTitle="$ID/" AppliedNamedGrid="n">' +
    '<StoryPreference OpticalMarginAlignment="false" OpticalMarginSize="12" FrameType="TextFrameType" StoryOrientation="Horizontal" StoryDirection="LeftToRightDirection"/>' +
    '<InCopyExportOption IncludeGraphicProxies="true" IncludeAllResources="false"/>' + inner + '</Story>');
}

function buildParts(opts) {
  opts = opts || {};
  const files = {};

  files['mimetype'] = 'application/vnd.adobe.indesign-idml-package';
  files['META-INF/container.xml'] = HEAD + '<container><rootfiles><rootfile full-path="designmap.xml" media-type="text/xml"/></rootfiles></container>';

  files['designmap.xml'] = HEAD + AID +
    '<Document ' + NS + ' DOMVersion="8.0" Self="d" StoryList="u1f3 u2a1 u3b2 u3b3 u4c1 u5d1" Name="prueba.idml" ZeroPoint="0 0" ActiveLayer="ub7">\n' +
    '<Language Self="Language/$ID/Spanish%3a Castilian" Name="$ID/Spanish: Castilian" SingleQuotes="‘’" DoubleQuotes="“”" PrimaryLanguageName="$ID/Spanish" SublanguageName="$ID/Castilian" Id="269" HyphenationVendor="Proximity" SpellingVendor="Proximity"/>\n' +
    '<idPkg:Graphic src="Resources/Graphic.xml"/>\n<idPkg:Fonts src="Resources/Fonts.xml"/>\n<idPkg:Styles src="Resources/Styles.xml"/>\n' +
    '<idPkg:Preferences src="Resources/Preferences.xml"/>\n<idPkg:Tags src="XML/Tags.xml"/>\n' +
    '<Layer Self="ub7" Name="Capa 1" Visible="true" Locked="false" IgnoreWrap="false" ShowGuides="true" LockGuides="false" UI="true" Expendable="true" Printable="true"><Properties><LayerColor type="enumeration">LightBlue</LayerColor></Properties></Layer>\n' +
    '<Layer Self="ub8" Name="Fondo" Visible="true" Locked="true" IgnoreWrap="false" ShowGuides="true" LockGuides="false" UI="true" Expendable="true" Printable="true"><Properties><LayerColor type="enumeration">Red</LayerColor></Properties></Layer>\n' +
    '<idPkg:MasterSpread src="MasterSpreads/MasterSpread_ud6.xml"/>\n' +
    '<idPkg:Spread src="Spreads/Spread_ud8.xml"/>\n<idPkg:Spread src="Spreads/Spread_ud9.xml"/>\n' +
    '<Section Self="ucs" Length="3" Name="" ContinueNumbering="false" IncludeSectionPrefix="false" PageNumberStart="1" PageNumberStyle="Arabic" SectionPrefix="" Marker="" PageStart="up1"/>\n' +
    '<idPkg:BackingStory src="XML/BackingStory.xml"/>\n' +
    '<idPkg:Story src="Stories/Story_u1f3.xml"/>\n<idPkg:Story src="Stories/Story_u2a1.xml"/>\n<idPkg:Story src="Stories/Story_u3b2.xml"/>\n' +
    '<idPkg:Story src="Stories/Story_u3b3.xml"/>\n<idPkg:Story src="Stories/Story_u4c1.xml"/>\n<idPkg:Story src="Stories/Story_u5d1.xml"/>\n' +
    '</Document>\n';

  files['XML/Tags.xml'] = part('Tags', '<XMLTag Self="XMLTag/Root" Name="Root"><Properties><TagColor type="enumeration">LightBlue</TagColor></Properties></XMLTag>');
  files['XML/BackingStory.xml'] = part('BackingStory', '<XmlStory Self="ubs" AppliedTOCStyle="n" TrackChanges="false" StoryTitle="$ID/" AppliedNamedGrid="n"><XMLElement Self="di2i3" MarkupTag="XMLTag/Root" XMLContent="ubs"/></XmlStory>');

  files['Resources/Fonts.xml'] = part('Fonts',
    '<FontFamily Self="di2" Name="Minion Pro"><Font Self="di2Font/Minion Pro%5ERegular" FontFamily="Minion Pro" Name="Minion Pro Regular" PostScriptName="MinionPro-Regular" Status="Installed" FontStyleName="Regular" FontType="OpenTypeCFF" WritingScript="0" FullName="Minion Pro" FullNameNative="Minion Pro" FontStyleNameNative="Regular" PlatformName="$ID/" Version="Version 2.000"/>' +
    '<Font Self="di2Font/Minion Pro%5EBold" FontFamily="Minion Pro" Name="Minion Pro Bold" PostScriptName="MinionPro-Bold" Status="Installed" FontStyleName="Bold" FontType="OpenTypeCFF" WritingScript="0" FullName="Minion Pro Bold" FullNameNative="Minion Pro Bold" FontStyleNameNative="Bold" PlatformName="$ID/" Version="Version 2.000"/></FontFamily>' +
    '<FontFamily Self="di3" Name="Myriad Pro"><Font Self="di3Font/Myriad Pro%5EBold" FontFamily="Myriad Pro" Name="Myriad Pro Bold" PostScriptName="MyriadPro-Bold" Status="Installed" FontStyleName="Bold" FontType="OpenTypeCFF" WritingScript="0" FullName="Myriad Pro Bold" FullNameNative="Myriad Pro Bold" FontStyleNameNative="Bold" PlatformName="$ID/" Version="Version 2.000"/></FontFamily>' +
    '<FontFamily Self="di4" Name="Fuente Rara"><Font Self="di4Font/Fuente Rara%5ERegular" FontFamily="Fuente Rara" Name="Fuente Rara Regular" PostScriptName="FuenteRara" Status="NotAvailable" FontStyleName="Regular" FontType="TrueType" WritingScript="0" FullName="Fuente Rara" FullNameNative="Fuente Rara" FontStyleNameNative="Regular" PlatformName="$ID/" Version="1.0"/></FontFamily>');

  files['Resources/Graphic.xml'] = part('Graphic',
    '<Color Self="Color/Black" Model="Process" Space="CMYK" ColorValue="0 0 0 100" ColorOverride="Specialblack" BaseColor="n" AlternateSpace="NoAlternateColor" AlternateColorValue="" Name="Black" ColorEditable="false" ColorRemovable="false" Visible="true" SwatchCreatorID="7937" SwatchColorGroupReference="n"/>\n' +
    '<Color Self="Color/Paper" Model="Process" Space="CMYK" ColorValue="0 0 0 0" ColorOverride="Specialpaper" BaseColor="n" AlternateSpace="NoAlternateColor" AlternateColorValue="" Name="Paper" ColorEditable="true" ColorRemovable="false" Visible="true" SwatchCreatorID="7937" SwatchColorGroupReference="n"/>\n' +
    '<Color Self="Color/Registration" Model="Registration" Space="CMYK" ColorValue="100 100 100 100" ColorOverride="Specialregistration" BaseColor="n" AlternateSpace="NoAlternateColor" AlternateColorValue="" Name="Registration" ColorEditable="false" ColorRemovable="false" Visible="true" SwatchCreatorID="7937" SwatchColorGroupReference="n"/>\n' +
    '<Color Self="Color/Rojo" Model="Process" Space="CMYK" ColorValue="0 100 100 0" ColorOverride="Normal" BaseColor="n" AlternateSpace="NoAlternateColor" AlternateColorValue="" Name="Rojo" ColorEditable="true" ColorRemovable="true" Visible="true" SwatchCreatorID="7937" SwatchColorGroupReference="n"/>\n' +
    '<Color Self="Color/AzulRGB" Model="Process" Space="RGB" ColorValue="0 51 204" ColorOverride="Normal" BaseColor="n" AlternateSpace="NoAlternateColor" AlternateColorValue="" Name="AzulRGB" ColorEditable="true" ColorRemovable="true" Visible="true" SwatchCreatorID="7937" SwatchColorGroupReference="n"/>\n' +
    '<Color Self="Color/PANTONE 185 C" Model="Spot" Space="CMYK" ColorValue="0 91 76 0" ColorOverride="Normal" BaseColor="n" AlternateSpace="NoAlternateColor" AlternateColorValue="" Name="PANTONE 185 C" ColorEditable="true" ColorRemovable="true" Visible="true" SwatchCreatorID="7937" SwatchColorGroupReference="n"/>\n' +
    '<Color Self="Color/C=15 M=100 Y=100 K=0" Model="Process" Space="CMYK" ColorValue="15 100 100 0" ColorOverride="Normal" BaseColor="n" AlternateSpace="NoAlternateColor" AlternateColorValue="" Name="C=15 M=100 Y=100 K=0" ColorEditable="true" ColorRemovable="true" Visible="true" SwatchCreatorID="7937" SwatchColorGroupReference="n"/>\n' +
    '<Tint Self="Tint/Rojo 50%25" Name="Rojo 50%" BaseColor="Color/Rojo" TintValue="50" ColorEditable="true" ColorRemovable="true" Visible="true" SwatchCreatorID="7937" SwatchColorGroupReference="n"/>\n' +
    '<Gradient Self="Gradient/Degradado" Type="Linear" Name="Degradado" ColorEditable="true" ColorRemovable="true" Visible="true" SwatchCreatorID="7937" SwatchColorGroupReference="n">' +
    '<GradientStop Self="Gradient/DegradadoGradientStop0" StopColor="Color/Rojo" Location="0" Midpoint="50"/>' +
    '<GradientStop Self="Gradient/DegradadoGradientStop1" StopColor="Color/AzulRGB" Location="100" Midpoint="50"/></Gradient>\n' +
    '<Swatch Self="Swatch/None" Name="None" ColorEditable="false" ColorRemovable="false" Visible="true" SwatchCreatorID="7937" SwatchColorGroupReference="n"/>\n' +
    '<StrokeStyle Self="StrokeStyle/$ID/Solid" Name="$ID/Solid"/>');

  files['Resources/Preferences.xml'] = part('Preferences',
    '<DocumentPreference PageHeight="792" PageWidth="612" PagesPerDocument="3" FacingPages="true" DocumentBleedTopOffset="8.5" DocumentBleedBottomOffset="8.5" DocumentBleedInsideOrLeftOffset="8.5" DocumentBleedOutsideOrRightOffset="8.5" DocumentBleedUniformSize="true" DocumentSlugUniformSize="false" SlugTopOffset="0" SlugBottomOffset="28.35" SlugInsideOrLeftOffset="0" SlugRightOrOutsideOffset="0" PreserveLayoutWhenShuffling="true" AllowPageShuffle="true" OverprintBlack="true" PageBinding="LeftToRight" ColumnDirection="Horizontal" Intent="PrintIntent" StartPageNumber="1"/>\n' +
    '<MarginPreference ColumnCount="1" ColumnGutter="12" Top="36" Bottom="36" Left="36" Right="36" ColumnDirection="Horizontal" ColumnsPositions="0 540"/>\n' +
    '<ViewPreference HorizontalMeasurementUnits="Millimeters" VerticalMeasurementUnits="Millimeters" RulerOrigin="SpreadOrigin" ShowRulers="true"/>\n' +
    '<TextDefault AppliedLanguage="Language/$ID/Spanish%3a Castilian" PointSize="12" FontStyle="Regular" FillColor="Color/Black"><Properties><AppliedFont type="string">Minion Pro</AppliedFont><Leading type="enumeration">Auto</Leading></Properties></TextDefault>');

  const tabs = '<TabList type="list"><ListItem type="record"><Alignment type="enumeration">RightAlign</Alignment><AlignmentCharacter type="string">.</AlignmentCharacter><Leader type="string">.</Leader><Position type="unit">200</Position></ListItem></TabList>';
  files['Resources/Styles.xml'] = part('Styles',
    '<RootCharacterStyleGroup Self="u86">\n' +
    '<CharacterStyle Self="CharacterStyle/$ID/[No character style]" Imported="false" KeyboardShortcut="0 0" Name="$ID/[No character style]"/>\n' +
    '<CharacterStyle Self="CharacterStyle/Negrita" Imported="false" KeyboardShortcut="0 0" Name="Negrita" FontStyle="Bold"><Properties><BasedOn type="string">$ID/[No character style]</BasedOn></Properties></CharacterStyle>\n' +
    '<CharacterStyleGroup Self="CharacterStyleGroup/Extras" Name="Extras"><CharacterStyle Self="CharacterStyle/Extras%3aResaltado" Imported="false" KeyboardShortcut="0 0" Name="Resaltado" FillColor="Color/Rojo" Underline="true" Capitalization="AllCaps"><Properties><BasedOn type="string">$ID/[No character style]</BasedOn></Properties></CharacterStyle></CharacterStyleGroup>\n' +
    '</RootCharacterStyleGroup>\n' +
    '<RootParagraphStyleGroup Self="u87">\n' +
    '<ParagraphStyle Self="ParagraphStyle/$ID/[No paragraph style]" Name="$ID/[No paragraph style]" Imported="false" NextStyle="ParagraphStyle/$ID/[No paragraph style]" KeyboardShortcut="0 0"/>\n' +
    '<ParagraphStyle Self="ParagraphStyle/$ID/NormalParagraphStyle" Name="$ID/NormalParagraphStyle" Imported="false" NextStyle="ParagraphStyle/$ID/NormalParagraphStyle" KeyboardShortcut="0 0" FontStyle="Regular" PointSize="12" Justification="LeftAlign" FillColor="Color/Black"><Properties><BasedOn type="string">$ID/[No paragraph style]</BasedOn><Leading type="enumeration">Auto</Leading><AppliedFont type="string">Minion Pro</AppliedFont></Properties></ParagraphStyle>\n' +
    '<ParagraphStyle Self="ParagraphStyle/Titulo" Name="Titulo" Imported="false" NextStyle="ParagraphStyle/Cuerpo" KeyboardShortcut="0 0" FontStyle="Bold" PointSize="24" Justification="CenterAlign" SpaceAfter="12" Tracking="-10" FillColor="Color/Rojo"><Properties><BasedOn type="object">ParagraphStyle/$ID/NormalParagraphStyle</BasedOn><Leading type="unit">28</Leading><AppliedFont type="string">Myriad Pro</AppliedFont></Properties></ParagraphStyle>\n' +
    '<ParagraphStyle Self="ParagraphStyle/Cuerpo" Name="Cuerpo" Imported="false" NextStyle="ParagraphStyle/Cuerpo" KeyboardShortcut="0 0" PointSize="10" Justification="LeftJustified" FirstLineIndent="12" LeftIndent="0" SpaceBefore="0" SpaceAfter="3" KeepWithNext="1" Hyphenation="true"><Properties><BasedOn type="object">ParagraphStyle/$ID/NormalParagraphStyle</BasedOn><Leading type="unit">12.5</Leading></Properties></ParagraphStyle>\n' +
    '<ParagraphStyleGroup Self="ParagraphStyleGroup/Notas" Name="Notas"><ParagraphStyle Self="ParagraphStyle/Notas%3aPrecio" Name="Precio" Imported="false" NextStyle="ParagraphStyle/Notas%3aPrecio" KeyboardShortcut="0 0" PointSize="9" Justification="RightAlign"><Properties><BasedOn type="object">ParagraphStyle/Cuerpo</BasedOn>' + tabs + '</Properties></ParagraphStyle></ParagraphStyleGroup>\n' +
    '</RootParagraphStyleGroup>\n' +
    '<RootCellStyleGroup Self="u88"><CellStyle Self="CellStyle/$ID/[None]" Name="$ID/[None]"/></RootCellStyleGroup>\n' +
    '<RootTableStyleGroup Self="u89"><TableStyle Self="TableStyle/$ID/[No table style]" Name="$ID/[No table style]"/></RootTableStyleGroup>\n' +
    '<RootObjectStyleGroup Self="u8a"><ObjectStyle Self="ObjectStyle/$ID/[None]" Name="$ID/[None]"/></RootObjectStyleGroup>');

  // ------------------------------------------------------------ máster
  const masterItems =
    '<TextFrame Self="umf1" ParentStory="u3b2" PreviousTextFrame="n" NextTextFrame="n" ContentType="TextType" ItemLayer="ub7" Visible="true" ItemTransform="1 0 0 1 -612 -396" FillColor="Swatch/None" StrokeColor="Swatch/None" StrokeWeight="0">' +
    rectPath(36, 740, 100, 760) + '<TextFramePreference TextColumnCount="1" TextColumnGutter="12"/></TextFrame>\n' +
    '<TextFrame Self="umf2" ParentStory="u3b3" PreviousTextFrame="n" NextTextFrame="n" ContentType="TextType" ItemLayer="ub7" Visible="true" ItemTransform="1 0 0 1 0 -396" FillColor="Swatch/None" StrokeColor="Swatch/None" StrokeWeight="0">' +
    rectPath(512, 740, 576, 760) + '<TextFramePreference TextColumnCount="1" TextColumnGutter="12"/></TextFrame>\n' +
    '<Rectangle Self="umr1" ContentType="GraphicType" ItemLayer="ub8" Visible="true" ItemTransform="1 0 0 1 0 -396" FillColor="Color/Rojo" FillTint="20" StrokeColor="Swatch/None" StrokeWeight="0">' +
    rectPath(0, 0, 612, 12) + '</Rectangle>';
  files['MasterSpreads/MasterSpread_ud6.xml'] = part('MasterSpread',
    '<MasterSpread Self="ud6" ItemTransform="1 0 0 1 0 0" OverrideList="" Name="A-Master" NamePrefix="A" BaseName="Master" ShowMasterItems="true" PageCount="2" AppliedMaster="n">\n' +
    '<Page Self="umL" GeometricBounds="0 0 792 612" ItemTransform="1 0 0 1 -612 -396" Name="A" AppliedMaster="n" OverrideList="" MasterPageTransform="1 0 0 1 0 0" TabOrder="" GridStartingPoint="TopOutside" UseMasterGrid="true"><MarginPreference ColumnCount="1" ColumnGutter="12" Top="36" Bottom="36" Left="36" Right="36" ColumnDirection="Horizontal" ColumnsPositions="0 540"/></Page>\n' +
    '<Page Self="umR" GeometricBounds="0 0 792 612" ItemTransform="1 0 0 1 0 -396" Name="B" AppliedMaster="n" OverrideList="" MasterPageTransform="1 0 0 1 0 0" TabOrder="" GridStartingPoint="TopOutside" UseMasterGrid="true"><MarginPreference ColumnCount="1" ColumnGutter="12" Top="36" Bottom="36" Left="36" Right="36" ColumnDirection="Horizontal" ColumnsPositions="0 540"/></Page>\n' +
    masterItems + '\n</MasterSpread>');

  // ------------------------------------------------------------ pliego 1 (página 1, derecha)
  const tfp2 = '<TextFramePreference TextColumnCount="2" TextColumnGutter="12" TextColumnFixedWidth="264" UseFixedColumnWidth="false" FirstBaselineOffset="AscentOffset" VerticalJustification="TopAlign"><Properties><InsetSpacing type="list"><ListItem type="unit">6</ListItem><ListItem type="unit">5</ListItem><ListItem type="unit">4</ListItem><ListItem type="unit">3</ListItem></InsetSpacing></Properties></TextFramePreference>';
  const wrap = '<TextWrapPreference Inverse="false" ApplyToMasterPageOnly="false" TextWrapSide="BothSides" TextWrapMode="BoundingBoxTextWrap"><Properties><TextWrapOffset Top="3" Left="4" Bottom="5" Right="6"/></Properties></TextWrapPreference>';
  const pngLink = '<Link Self="ulk1" AssetURL="$ID/" AssetID="$ID/" LinkResourceURI="file:/C:/Users/Ana/Documents/Mi%20carpeta/foto%20uno.png" LinkResourceFormat="$ID/PNG" StoredState="Normal" LinkResourceModified="false"/>';
  files['Spreads/Spread_ud8.xml'] = part('Spread',
    '<Spread Self="ud8" FlattenerOverride="Default" BindingLocation="1" AllowPageShuffle="true" ShowMasterItems="true" PageCount="1" ItemTransform="1 0 0 1 0 0">\n' +
    '<FlattenerPreference LineArtAndTextResolution="300" GradientAndMeshResolution="150" ClipComplexRegions="false" ConvertAllStrokesToOutlines="false" ConvertAllTextToOutlines="false"><Properties><RasterVectorBalance type="double">100</RasterVectorBalance></Properties></FlattenerPreference>\n' +
    '<Page Self="up1" GeometricBounds="0 0 792 612" ItemTransform="1 0 0 1 0 -396" Name="1" AppliedMaster="ud6" OverrideList="" TabOrder="" GridStartingPoint="TopOutside" UseMasterGrid="true"><MarginPreference ColumnCount="1" ColumnGutter="12" Top="36" Bottom="36" Left="36" Right="36" ColumnDirection="Horizontal" ColumnsPositions="0 540"/></Page>\n' +
    '<TextFrame Self="ut1" ParentStory="u1f3" PreviousTextFrame="n" NextTextFrame="ut2" ContentType="TextType" ItemLayer="ub7" Visible="true" Name="$ID/" ItemTransform="1 0 0 1 0 -396" FillColor="Swatch/None" StrokeColor="Color/Black" StrokeWeight="0.5" CornerOption="None">' +
    rectPath(36, 36, 576, 400) + tfp2 + wrap + '</TextFrame>\n' +
    '<Rectangle Self="ur1" ContentType="GraphicType" ItemLayer="ub7" Visible="true" ItemTransform="1 0 0 1 0 -396" FillColor="Color/PANTONE 185 C" StrokeColor="Color/Black" StrokeWeight="1" TopLeftCornerOption="RoundedCorner" TopLeftCornerRadius="8" TopRightCornerOption="RoundedCorner" TopRightCornerRadius="8" BottomLeftCornerOption="RoundedCorner" BottomLeftCornerRadius="8" BottomRightCornerOption="RoundedCorner" BottomRightCornerRadius="8">' +
    rectPath(36, 420, 236, 520) +
    '<Image Self="ui1" Space="$ID/#Links_RGB" ActualPpi="72 72" EffectivePpi="36 36" ImageRenderingIntent="UseColorSettings" ItemTransform="100 0 0 50 36 420" Visible="true"><Properties><Profile type="string">$ID/Embedded</Profile><GraphicBounds Left="0" Top="0" Right="2" Bottom="2"/></Properties>' + pngLink + '</Image></Rectangle>\n' +
    '<Guide Self="ugd1" Orientation="Vertical" Location="306" ViewThreshold="5" FitToPage="true" Locked="false" ItemLayer="ub7"/>\n' +
    '</Spread>');

  // ------------------------------------------------------------ pliego 2 (páginas 2 y 3)
  const embedded = '<Link Self="ulk2" AssetURL="$ID/" AssetID="$ID/" LinkResourceURI="file:/C:/Users/Ana/Documents/embebida.png" LinkResourceFormat="$ID/PNG" StoredState="Embedded" LinkResourceModified="false"/>';
  files['Spreads/Spread_ud9.xml'] = part('Spread',
    '<Spread Self="ud9" FlattenerOverride="Default" BindingLocation="0" AllowPageShuffle="true" ShowMasterItems="true" PageCount="2" ItemTransform="1 0 0 1 0 0">\n' +
    '<Page Self="up2" GeometricBounds="0 0 792 612" ItemTransform="1 0 0 1 -612 -396" Name="2" AppliedMaster="ud6" OverrideList="" TabOrder="" GridStartingPoint="TopOutside" UseMasterGrid="true"><MarginPreference ColumnCount="1" ColumnGutter="12" Top="36" Bottom="36" Left="36" Right="36" ColumnDirection="Horizontal" ColumnsPositions="0 540"/></Page>\n' +
    '<Page Self="up3" GeometricBounds="0 0 792 612" ItemTransform="1 0 0 1 0 -396" Name="3" AppliedMaster="ud6" OverrideList="umf2" TabOrder="" GridStartingPoint="TopOutside" UseMasterGrid="true"><MarginPreference ColumnCount="2" ColumnGutter="14" Top="40" Bottom="30" Left="50" Right="44" ColumnDirection="Horizontal" ColumnsPositions="0 250 264 518"/></Page>\n' +
    // continuación del texto principal, en la página 2
    '<TextFrame Self="ut2" ParentStory="u1f3" PreviousTextFrame="ut1" NextTextFrame="n" ContentType="TextType" ItemLayer="ub7" Visible="true" ItemTransform="1 0 0 1 -612 -396" FillColor="Swatch/None" StrokeColor="Swatch/None" StrokeWeight="0">' +
    rectPath(36, 36, 576, 300) + '<TextFramePreference TextColumnCount="1" TextColumnGutter="12"/></TextFrame>\n' +
    // tabla (página 2)
    '<TextFrame Self="ut4" ParentStory="u4c1" PreviousTextFrame="n" NextTextFrame="n" ContentType="TextType" ItemLayer="ub7" Visible="true" ItemTransform="1 0 0 1 -612 -396" FillColor="Swatch/None" StrokeColor="Swatch/None" StrokeWeight="0">' +
    rectPath(36, 320, 336, 420) + '<TextFramePreference TextColumnCount="1" TextColumnGutter="12"/></TextFrame>\n' +
    // texto del lomo, girado 90° en la página 3
    '<TextFrame Self="ut3" ParentStory="u2a1" PreviousTextFrame="n" NextTextFrame="n" ContentType="TextType" ItemLayer="ub7" Visible="true" ItemTransform="0 1 -1 0 300 -250" FillColor="Color/Rojo" FillTint="50" StrokeColor="Swatch/None" StrokeWeight="0">' +
    rectPath(0, 0, 300, 40) + '<TextFramePreference TextColumnCount="1" TextColumnGutter="12" VerticalJustification="CenterAlign"/></TextFrame>\n' +
    // copia local (override) del marco del número de página en la página 3
    '<TextFrame Self="ut5" ParentStory="u5d1" PreviousTextFrame="n" NextTextFrame="n" ContentType="TextType" ItemLayer="ub7" Visible="true" ItemTransform="1 0 0 1 0 -396" FillColor="Swatch/None" StrokeColor="Swatch/None" StrokeWeight="0">' +
    rectPath(512, 740, 576, 760) + '<TextFramePreference TextColumnCount="1" TextColumnGutter="12"/></TextFrame>\n' +
    // imagen incrustada en la página 3
    '<Rectangle Self="ur2" ContentType="GraphicType" ItemLayer="ub7" Visible="true" ItemTransform="1 0 0 1 0 -396" FillColor="Swatch/None" StrokeColor="Swatch/None" StrokeWeight="0">' +
    rectPath(300, 450, 400, 500) +
    '<Image Self="ui2" Space="$ID/#Links_RGB" ActualPpi="72 72" EffectivePpi="25 25" ImageRenderingIntent="UseColorSettings" ItemTransform="100 0 0 100 300 425" Visible="true"><Properties><Profile type="string">$ID/Embedded</Profile><GraphicBounds Left="0" Top="0" Right="2" Bottom="2"/><Contents><![CDATA[' + tinyPng().toString('base64') + ']]></Contents></Properties>' + embedded + '</Image></Rectangle>\n' +
    // óvalo con tinta y degradado
    '<Oval Self="uo1" ContentType="Unassigned" ItemLayer="ub7" Visible="true" ItemTransform="1 0 0 1 -612 -396" FillColor="Tint/Rojo 50%25" StrokeColor="Color/AzulRGB" StrokeWeight="2">' + ovalPath(400, 500, 60, 30) + '</Oval>\n' +
    // triángulo
    '<Polygon Self="up_tri" ContentType="Unassigned" ItemLayer="ub7" Visible="true" ItemTransform="1 0 0 1 -612 -396" FillColor="Gradient/Degradado" StrokeColor="Swatch/None" StrokeWeight="0">' +
    polyPath([[100, 600], [200, 600], [150, 520]]) + '</Polygon>\n' +
    // línea
    '<GraphicLine Self="ul1" ContentType="Unassigned" ItemLayer="ub7" Visible="true" ItemTransform="1 0 0 1 -612 -396" FillColor="Swatch/None" StrokeColor="Color/Black" StrokeWeight="3">' +
    polyPath([[40, 650], [300, 660]], true) + '</GraphicLine>\n' +
    // grupo con dos rectángulos (el grupo se desplaza 10,10)
    '<Group Self="ug1" ItemLayer="ub7" Visible="true" ItemTransform="1 0 0 1 10 10">' +
    '<Rectangle Self="ur3" ContentType="GraphicType" ItemLayer="ub7" Visible="true" ItemTransform="1 0 0 1 -612 -396" FillColor="Color/AzulRGB" StrokeColor="Swatch/None" StrokeWeight="0">' + rectPath(400, 600, 450, 650) + '</Rectangle>' +
    '<Rectangle Self="ur4" ContentType="GraphicType" ItemLayer="ub7" Visible="true" ItemTransform="1 0 0 1 -612 -396" FillColor="Color/Paper" StrokeColor="Color/Black" StrokeWeight="1">' + rectPath(460, 600, 510, 650) + '</Rectangle>' +
    '</Group>\n' +
    '</Spread>');

  // ------------------------------------------------------------ historias
  const cs = (txt) => csr(content(txt));
  files['Stories/Story_u1f3.xml'] = story('u1f3',
    psr('Titulo', csr(content('Título de prueba ñandú') + '<Br/>')) +
    psr('Cuerpo',
      csr(content('Texto normal con ')) +
      '<CharacterStyleRange AppliedCharacterStyle="CharacterStyle/Negrita">' + content('negrita') + '</CharacterStyleRange>' +
      csr(content(' y un salto\u2028forzado, tab\tcon tabulación y ')) +
      '<CharacterStyleRange AppliedCharacterStyle="CharacterStyle/Extras%3aResaltado">' + content('resaltado') + '</CharacterStyleRange>' +
      csr(content(' más <ángulos> & “comillas” — €.') + '<Br/>')) +
    psr('Cuerpo', csr(content('Segundo párrafo con tamaño local y '), 'PointSize="14" FillColor="Color/AzulRGB" Tracking="50"', '<AppliedFont type="string">Myriad Pro</AppliedFont>') +
      csr(content('cursiva falsa'), 'FontStyle="Italic" Position="Superscript"') + csr(content('.') + '<Br/>'), 'Justification="CenterAlign" SpaceBefore="6"') +
    psr('Notas%3aPrecio', csr(content('Café\t2,50') + '<Br/>')) +
    psr('Cuerpo', csr('<Br/>')) + // párrafo vacío
    psr('Cuerpo', csr(content('Último párrafo, sin salto final.'))));
  files['Stories/Story_u2a1.xml'] = story('u2a1', psr('Titulo', csr(content('LOMO'), 'PointSize="18"')));
  files['Stories/Story_u3b2.xml'] = story('u3b2', psr('Cuerpo', csr('<Content><?ACE 18?></Content>')));
  files['Stories/Story_u3b3.xml'] = story('u3b3', psr('Cuerpo', csr('<Content><?ACE 18?></Content>'), 'Justification="RightAlign"'));
  files['Stories/Story_u5d1.xml'] = story('u5d1', psr('Cuerpo', csr(content('Pág. ') + '<Content><?ACE 18?></Content>'), 'Justification="RightAlign"'));
  const cell = (r, c, txt, extra) => '<Cell Self="ucell' + r + c + '" Name="' + c + ':' + r + '" RowSpan="1" ColumnSpan="1" AppliedCellStyle="CellStyle/$ID/[None]" AppliedCellStylePriority="0" FillColor="' + (extra || 'Swatch/None') + '">' +
    psr('Cuerpo', csr(content(txt) + '<Br/>')).replace('<Br/></CharacterStyleRange>', '</CharacterStyleRange>') + '</Cell>';
  files['Stories/Story_u4c1.xml'] = story('u4c1',
    psr('Cuerpo', csr(
      '<Table Self="utab1" HeaderRowCount="0" FooterRowCount="0" BodyRowCount="2" ColumnCount="2" AppliedTableStyle="TableStyle/$ID/[No table style]" TableDirection="LeftToRightDirection">' +
      '<Row Self="utab1Row0" Name="0" SingleRowHeight="20"/><Row Self="utab1Row1" Name="1" SingleRowHeight="30"/>' +
      '<Column Self="utab1Column0" Name="0" SingleColumnWidth="100"/><Column Self="utab1Column1" Name="1" SingleColumnWidth="200"/>' +
      cell(0, 0, 'A1') + cell(0, 1, 'B1', 'Color/Rojo') + cell(1, 0, 'A2') + cell(1, 1, 'B2') +
      '</Table><Br/>')));

  return files;
}

function pack(parts) {
  const list = [];
  // "mimetype" debe ir primero y sin comprimir (como hace InDesign)
  list.push({ name: 'mimetype', data: parts['mimetype'] });
  for (const k of Object.keys(parts)) if (k !== 'mimetype' && parts[k] !== null) list.push({ name: k, data: parts[k] });
  return writeZip(list);
}

// Variante del documento de prueba: mutate(parts) puede cambiar, añadir o quitar (null) partes.
function buildIdmlWith(mutate) {
  const parts = buildParts();
  mutate(parts);
  return pack(parts);
}

function buildIdml(opts) {
  const parts = buildParts(opts);
  const list = [];
  // "mimetype" debe ir primero y sin comprimir (como hace InDesign)
  list.push({ name: 'mimetype', data: parts['mimetype'] });
  for (const k of Object.keys(parts)) if (k !== 'mimetype') list.push({ name: k, data: parts[k] });
  return writeZip(list);
}

module.exports = { buildIdml, buildIdmlWith, pack, buildParts, tinyPng, rectPath, part, story, psr, csr, content };
