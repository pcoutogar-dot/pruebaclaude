// Versión para Google Docs: sin objetos flotantes ni superposiciones; todo en flujo (tablas + imágenes en línea)
const fs=require('fs'),path=require('path');
const D=require('docx');
const {Document,Packer,Paragraph,TextRun,ImageRun,Table,TableRow,TableCell,WidthType,BorderStyle,ShadingType,
 AlignmentType,VerticalAlign,LineRuleType,Footer,PageNumber,LevelFormat,UnderlineType,TableLayoutType,SectionType,HeightRule,Header,TabStopType,HorizontalPositionRelativeFrom,VerticalPositionRelativeFrom,TextWrappingType}=D;
const S=__dirname, G=S+'/gd', OUT=process.argv[2];
const table=JSON.parse(fs.readFileSync(S+'/table.json','utf8'));
const TW=11906/827, tw=px=>Math.round(px*TW);
const hp=px=>Math.max(2,Math.floor(px*0.71983*2+0.15));
const P96=px=>px*0.95976;          // px del escenario -> px a 96 ppp (tamaño de imagen)
const NAVY='143548', SKY='9DDFEA';
const img=(f,wpx,hpx)=>new ImageRun({type:'png',data:fs.readFileSync(path.join(G,f)),transformation:{width:P96(wpx),height:P96(hpx)}});
const NB={style:BorderStyle.NONE,size:0,color:'FFFFFF'}, NOB={top:NB,bottom:NB,left:NB,right:NB};
const sp=(px)=>new Paragraph({spacing:{before:0,after:0,line:tw(px),lineRule:LineRuleType.EXACT},children:[new TextRun({text:'',size:2})]});
// ---------------- tabla del Título preliminar ----------------
function buildTable(){
  // 5 columnas de rejilla: la 3.ª columna se divide para que la fila 1 tenga sus dos listas en celdas propias (sin tabla anidada)
  const G=[108,112,216,85,0].map(tw); G[4]=tw(670)-G[0]-G[1]-G[2]-G[3];
  const COLS=[G[0],G[1],G[2]+G[3],G[4]];
  const B={style:BorderStyle.SINGLE,size:6,color:'D1EDF9'};
  const borders={top:B,bottom:B,left:B,right:B};
  const COLOR={blue:'1A7BB9',green:'1F9D63'};
  const PX={c:11.5,n:11.2}, LHM={c:270,n:266};   // interlineado en múltiplos (Docs ignora el exacto)
  function textRuns(runs,base){
    const out=[];
    runs.forEach(r=>{
      if(r.t==='\n'){out.push(new TextRun({break:1}));return;}
      const o={text:r.t,font:base.font,size:hp(base.px),bold:!!r.b||!!base.bold,color:COLOR[r.color]||base.color};
      if(r.u) o.underline={type:UnderlineType.THICK,color:'9DDFEA'};
      out.push(new TextRun(o));
    });
    return out;
  }
  function bulletPara(runs,kind,cls){
    return new Paragraph({numbering:{reference:'vi',level:0},spacing:{line:LHM[cls],lineRule:LineRuleType.AUTO,before:0,after:0},
      children:textRuns(runs,{font:'Arial',px:PX[cls],color:'222222'})});
  }
  function cellK(c){
    const pa=c.paras[0].runs; const kids=[];
    kids.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:0,after:tw(5)},children:[new ImageRun({type:'png',data:fs.readFileSync(S+'/'+c.icon+'.png'),transformation:{width:23,height:23}})]}));
    const runs=[]; let chip=null;
    pa.forEach(r=>{
      if(r.em) runs.push(new TextRun({text:r.t+'\u00a0',font:'Lora',bold:true,size:hp(17),color:NAVY}));
      else if(r.chip) chip=r.t;
      else if(r.t!=='\n') runs.push(new TextRun({text:r.t,font:'Poppins',bold:true,size:hp(11.2),color:NAVY}));
    });
    kids.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{line:216,lineRule:LineRuleType.AUTO,before:0,after:0},children:runs}));
    if(chip) kids.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:tw(6),after:0},children:[
      new TextRun({text:' ♥ '+chip+' ',font:'Arial',bold:true,size:hp(8.6),color:NAVY,characterSpacing:24,shading:{type:ShadingType.CLEAR,color:'auto',fill:'9DDFEA'}})]}));
    return new TableCell({rowSpan:c.rowspan,width:{size:COLS[0],type:WidthType.DXA},borders,verticalAlign:VerticalAlign.CENTER,
      shading:{type:ShadingType.CLEAR,color:'auto',fill:'D1EDF9'},margins:{top:0,bottom:0,left:tw(5),right:tw(5)},children:kids});
  }
  function cellS(c){
    const runs=[];
    c.paras.forEach(p=>p.runs.forEach(r=>{
      const bold=!!r.b||c.blue;
      runs.push(new TextRun({text:r.t,font:bold?'Poppins':'Poppins',bold,size:hp(10.4),color:c.blue?COLOR.blue:NAVY}));
    }));
    return new TableCell({width:{size:COLS[1],type:WidthType.DXA},borders,verticalAlign:VerticalAlign.CENTER,
      shading:{type:ShadingType.CLEAR,color:'auto',fill:'F8F9FA'},margins:{top:tw(4),bottom:tw(3),left:tw(8),right:tw(6)},
      children:[new Paragraph({alignment:AlignmentType.CENTER,spacing:{line:221,lineRule:LineRuleType.AUTO,before:0,after:0},children:runs})]});
  }
  function cellC(c){
    const allBlue=c.paras.every(p=>p.runs.every(r=>r.color==='blue'||!r.t.trim()));
    if(allBlue) c.paras.forEach(p=>p.runs.forEach(r=>{delete r.color;}));
    const w=c.colspan===2?COLS[2]+COLS[3]:COLS[2];
    let kids;
    const items=c.paras.filter(p=>p.runs.length);
    const blueAll=c.paras.length && false;
    if(c.two){
      const half=Math.ceil(items.length/2);
      const NB={style:BorderStyle.NONE,size:0,color:'FFFFFF'};
      return [new TableCell({columnSpan:1,width:{size:G[2],type:WidthType.DXA},borders:{...borders,right:NB},margins:{top:0,bottom:0,left:tw(8),right:tw(4)},children:items.slice(0,half).map(p=>bulletPara(p.runs,'li','c'))}),
              new TableCell({columnSpan:2,width:{size:G[3]+G[4],type:WidthType.DXA},borders:{...borders,left:NB},margins:{top:0,bottom:0,left:tw(4),right:tw(6)},children:items.slice(half).map(p=>bulletPara(p.runs,'li','c'))})];
    } else kids=items.map(p=>bulletPara(p.runs,'li','c'));
    return new TableCell({columnSpan:c.colspan+1,width:{size:w,type:WidthType.DXA},borders,margins:{top:0,bottom:0,left:tw(8),right:tw(6)},children:kids});
  }
  function cellN(c){
    const items=c.paras.filter(p=>p.runs.length);
    const kids=[];
    items.forEach((p,i)=>{ kids.push(new Paragraph({numbering:{reference:'vi',level:0},spacing:{line:LHM.n,lineRule:LineRuleType.AUTO,before:i?tw(5):0,after:0},
      children:textRuns(p.runs,{font:'Arial',px:PX.n,color:'222222'})})); });
    return new TableCell({width:{size:COLS[3],type:WidthType.DXA},borders,shading:{type:ShadingType.CLEAR,color:'auto',fill:'F6FBFE'},
      margins:{top:tw(1),bottom:0,left:tw(8),right:tw(6)},children:kids});
  }
  // los textos con clase "blue" heredan el azul: marcarlo en los runs
  table.forEach(r=>r.forEach(c=>{ if(c.cls==='c'||c.cls==='n') c.paras.forEach(p=>p.runs.forEach(x=>{})); }));
  const rows=table.map(r=>new TableRow({children:r.flatMap(c=>[].concat(({k:cellK,s:cellS,c:cellC,n:cellN})[c.cls](c)))}));
  return new Table({width:{size:COLS.reduce((a,b)=>a+b),type:WidthType.DXA},layout:TableLayoutType.FIXED,rows,columnWidths:G});
}



// ================= formas de dibujo (DrawingML) =================
// docx no sabe crear formas: se inserta un marcador de texto y luego se sustituye por el XML de la forma.
const SZ=JSON.parse(fs.readFileSync(S+'/gd_sizes.json','utf8'));
const LY=JSON.parse(fs.readFileSync(S+'/gd_layout.json','utf8'));
const LH=pt=>pt*1.5*1.38934;   // alto de línea sencillo de Poppins (px)
const EMU=px=>Math.round(px*9142);            // px del escenario -> EMU
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const SHAPES={}; let SID=0;
function rx(t,{font='Poppins',bold=false,pt=10,color=NAVY,spacing=0}={}){
  return `<w:r><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/>${bold?'<w:b/><w:bCs/>':''}<w:color w:val="${color}"/>${spacing?`<w:spacing w:val="${spacing}"/>`:''}<w:sz w:val="${Math.round(pt*2)}"/><w:szCs w:val="${Math.round(pt*2)}"/></w:rPr><w:t xml:space="preserve">${esc(t)}</w:t></w:r>`;
}
function px(runs,{jc='center',line=240}={}){
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="${line}" w:lineRule="auto"/><w:jc w:val="${jc}"/></w:pPr>${runs.join('')}</w:p>`;
}
// forma en línea: prst = roundRect | flowChartDelay ...
function shape({w,h,prst='roundRect',adj=null,fill='FFFFFF',line=null,lineW=0.75,paras,ins=[0,0,0,0],anchor='ctr'}){
  const id='§SH'+(++SID)+'§', n=5000+SID;
  const av=adj===null?'<a:avLst/>':`<a:avLst><a:gd name="adj" fmla="val ${adj}"/></a:avLst>`;
  const ln=line?`<a:ln w="${Math.round(lineW*12700)}"><a:solidFill><a:srgbClr val="${line}"/></a:solidFill></a:ln>`:'<a:ln><a:noFill/></a:ln>';
  SHAPES[id]=`<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${EMU(w)}" cy="${EMU(h)}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${n}" name="Forma ${n}"/><wp:cNvGraphicFramePr/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:wsp><wps:cNvSpPr/><wps:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${EMU(w)}" cy="${EMU(h)}"/></a:xfrm><a:prstGeom prst="${prst}">${av}</a:prstGeom><a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>${ln}</wps:spPr><wps:txbx><w:txbxContent>${paras.join('')}</w:txbxContent></wps:txbx><wps:bodyPr rot="0" vert="horz" wrap="square" lIns="${EMU(ins[3])}" tIns="${EMU(ins[0])}" rIns="${EMU(ins[1])}" bIns="${EMU(ins[2])}" anchor="${anchor}" anchorCtr="0"><a:noAutofit/></wps:bodyPr></wps:wsp></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  return new TextRun({text:id});
}
function groupBadge({w,h,off=24,badge=52,paras}){
  const id='§SH'+(++SID)+'§', n=5000+SID, bw=w-off;
  const box=`<wps:wsp><wps:cNvPr id="${n+900}" name="Bloque"/><wps:cNvSpPr/><wps:spPr><a:xfrm><a:off x="${EMU(off)}" y="${EMU(off)}"/><a:ext cx="${EMU(bw)}" cy="${EMU(h)}"/></a:xfrm><a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 11000"/></a:avLst></a:prstGeom><a:solidFill><a:srgbClr val="D1EDF9"/></a:solidFill><a:ln><a:noFill/></a:ln></wps:spPr><wps:txbx><w:txbxContent>${paras.join('')}</w:txbxContent></wps:txbx><wps:bodyPr rot="0" vert="horz" wrap="square" lIns="${EMU(30)}" tIns="${EMU(12)}" rIns="${EMU(26)}" bIns="${EMU(10)}" anchor="ctr" anchorCtr="0"><a:noAutofit/></wps:bodyPr></wps:wsp>`;
  const pic=`<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${n+901}" name="Librito"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdBADGE"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${EMU(badge)}" cy="${EMU(badge)}"/></a:xfrm><a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>`;
  const W=EMU(w),H=EMU(h+off);
  SHAPES[id]=`<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${W}" cy="${H}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${n}" name="Titular ${n}"/><wp:cNvGraphicFramePr/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"><wpg:wgp><wpg:cNvGrpSpPr/><wpg:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${W}" cy="${H}"/><a:chOff x="0" y="0"/><a:chExt cx="${W}" cy="${H}"/></a:xfrm></wpg:grpSpPr>${box}${pic}</wpg:wgp></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  return new TextRun({text:id});
}
// imagen de fondo detrás del texto, anclada al propio párrafo (se mueve con él)
const behind=(f,wpx,hpx,xPage,yPara=0,rel=HorizontalPositionRelativeFrom.PAGE,z=1)=>new ImageRun({type:'png',data:fs.readFileSync(path.join(G,f)),transformation:{width:P96(wpx),height:P96(hpx)},
  floating:{horizontalPosition:{relative:rel,offset:EMU(xPage)},verticalPosition:{relative:VerticalPositionRelativeFrom.PARAGRAPH,offset:EMU(yPara)},
    behindDocument:true,allowOverlap:true,lockAnchor:true,zIndex:z,wrap:{type:TextWrappingType.NONE}}});
function pillRow(items,{x0=0,gap=6,h,pt,padL,rel,center=false,pageW=0,mkRuns,after=0}){
  let x=x0; const widths=items.map(p=>p.w+padL*2);
  if(center){const tot=widths.reduce((a,b)=>a+b,0)+gap*(items.length-1); x=(pageW-tot)/2;}
  const kids=[],tabs=[];
  items.forEach((p,j)=>{
    kids.push(behind(p.img,widths[j],h,x,-(h-pt*1.389*1.5)/2,rel));
    tabs.push({type:TabStopType.LEFT,position:tw(x+padL)});
    kids.push(new TextRun({text:'\t'}),...mkRuns(p));
    x+=widths[j]+gap;
  });
  return new Paragraph({tabStops:tabs,spacing:{before:0,after:tw(after),line:240,lineRule:LineRuleType.AUTO},children:kids});
}
const pill=(lab,t,w,{h=19,pt=7.5,stroke='CFE3EC'}={})=>shape({w:w+30,h,adj:50000,fill:'FFFFFF',line:stroke,ins:[0,6,0,6],
  paras:[px([rx(lab+' ',{bold:true,pt}),rx(t,{pt,color:'2B2B2B'})],{line:240})]});
const chip=(t,w)=>shape({w:w+34,h:29,adj:50000,fill:'FFFFFF',line:'8A8F94',ins:[0,4,0,4],paras:[px([rx(t,{pt:8.5,color:'4B4F53'})])]});

// ---------------- portada: bandas en cabecera/pie, texto editable en el centro ----------------
const band=(f,h)=>new Paragraph({spacing:{before:0,after:0,line:240,lineRule:LineRuleType.AUTO},children:[img(f,827,h)]});
const coverFooter=new Footer({children:[new Paragraph({style:'tight',children:[img('band_bot.png',827,332)]})]});
const cover=[
  new Paragraph({style:'tight',children:[img('band_top.png',827,381)]}),
  sp(20),
  new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:0,after:0,line:200,lineRule:LineRuleType.AUTO},children:[
    new TextRun({text:'DECRETO 51/2025,',font:'Poppins',bold:true,size:63,color:NAVY}),new TextRun({break:1}),
    new TextRun({text:'DE 24 DE FEBRERO',font:'Poppins',bold:true,size:63,color:NAVY})]}),
  new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:0,after:0},children:[img('squig.png',244,24)]}),
  new Paragraph({alignment:AlignmentType.CENTER,indent:{left:tw(113),right:tw(113)},spacing:{before:0,after:tw(37),line:240,lineRule:LineRuleType.AUTO},children:[
    new TextRun({text:'Por el que se regula la planificación y ordenación del empleo público, y el ingreso, promoción interna y provisión de puestos de trabajo del personal de la Administración General de la Junta de Andalucía.',font:'Poppins',size:21,color:'3A4A55'})]}),
  ...LY.chips.map((row,ri)=>new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:0,after:tw(ri?0:18),line:240,lineRule:LineRuleType.AUTO},
    children:[...row.items.map(c=>behind(c.img,c.tw+34,29,c.x-17,-(29-LH(8.5))/2)),
      new TextRun({text:row.items.map(c=>c.t.replace(/ /g,'\u00a0')).join(' '.repeat(row.n)),font:'Poppins',size:17,color:'4B4F53'})]})),
  new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:tw(34),after:0},children:[new ImageRun({type:'png',data:fs.readFileSync('/home/user/pruebaclaude/virginia-jurado/assets/logo-vjl.png'),transformation:{width:P96(58),height:P96(55)}})]})];

// ---------------- página 2: estructura ----------------
const p2=[];
// bloque del decreto: fondo anclado al propio párrafo (offset negativo hacia arriba)
p2.push(new Paragraph({indent:{left:tw(30),right:tw(34)},spacing:{before:0,after:tw(55),line:240,lineRule:LineRuleType.AUTO},children:[
  behind('decree_bg.png',697,172,53,-52),
  new TextRun({text:'Decreto 51/2025, de 24 de febrero, por el que se regula la planificación y ordenación del empleo público, y el ingreso, promoción interna y provisión de puestos de trabajo del personal de la Administración General de la Junta de Andalucía.',font:'Poppins',bold:true,size:24,color:NAVY})]}));
p2.push(new Paragraph({indent:{left:tw(22)},spacing:{before:0,after:tw(22),line:240,lineRule:LineRuleType.AUTO},children:[
  behind('label_bg.png',147,33,79,-(33-LH(8.5))/2),
  new TextRun({text:'ESTRUCTURA',font:'Poppins',bold:true,size:17,color:'FFFFFF',characterSpacing:42})]}));
const titulos=[['Título preliminar','Disposiciones generales','node_dot.png',[44,25],8],['Título I','Planificación y ordenación del empleo público','node_I.png',[44,49],-4],
 ['Título II','Selección de personal','node_II.png',[44,49],-4],['Título III','Promoción interna del personal funcionario de carrera y del personal laboral','node_III.png',[44,49],-4],
 ['Título IV','Provisión de puestos de trabajo y movilidad del personal funcionario y laboral','node_IV.png',[44,49],-4],['Título V','Adquisición y pérdida de la relación de servicio','node_V.png',[44,49],-4]];
const IND=tw(66);
titulos.forEach(([kick,name,node,[nw,nh],ny],i)=>{
  const last=i===titulos.length-1, rows=LY.rows[i];
  const seg=(h)=>last?[]:[behind('vline.png',2,h,100,0,HorizontalPositionRelativeFrom.PAGE,1)];
  // antetítulo (lleva la bolita)
  p2.push(new Paragraph({indent:{left:IND},spacing:{before:0,after:0,line:240,lineRule:LineRuleType.AUTO},children:[
    behind(node,nw,nh,79,ny,HorizontalPositionRelativeFrom.PAGE,5),...seg(LH(6)+6),
    new TextRun({text:kick.toUpperCase(),font:'Poppins',bold:true,size:12,color:'6F8290'})]}));
  // nombre del Título
  const nameAfter=rows.length?9:0;
  p2.push(new Paragraph({indent:{left:IND},spacing:{before:0,after:tw(nameAfter),line:240,lineRule:LineRuleType.AUTO},children:[
    ...seg(LH(10.5)*(name.length>70?2:1)+nameAfter+4),new TextRun({text:name,font:'Poppins',bold:true,size:21,color:NAVY})]}));
  // filas de pastillas
  rows.forEach((r,ri)=>{
    const after=ri<rows.length-1?12.4:21;
    const runs=[];
    r.forEach((p,j)=>{
      if(j) runs.push(new TextRun({text:' '.repeat(p.nsp),font:'Poppins',size:15}));
      runs.push(new TextRun({text:p.lab.replace(/ /g,'\u00a0')+'\u00a0',font:'Poppins',bold:true,size:15,color:NAVY}));
      runs.push(new TextRun({text:p.t.replace(/ /g,'\u00a0'),font:'Poppins',size:15,color:'2B2B2B'}));
    });
    p2.push(new Paragraph({indent:{left:tw(81)},spacing:{before:0,after:tw(after),line:240,lineRule:LineRuleType.AUTO},children:[
      ...r.map(p=>behind(p.img,p.tw+30,19,p.x-15,-(19-LH(7.5))/2,HorizontalPositionRelativeFrom.PAGE,3)),...seg(LH(7.5)+after+4),...runs]}));
  });
});
p2.push(new Paragraph({spacing:{before:0,after:0},children:[behind('bar.png',58.8+2,5,79+264.3-1,20.5),img('ast.png',22,23),
  new TextRun({text:'  Este decreto desarrolla los Títulos ',font:'Poppins',size:20,color:NAVY}),
  new TextRun({text:'8, 9 y 10',font:'Poppins',bold:true,size:22,color:NAVY}),
  new TextRun({text:' de la ',font:'Poppins',size:20,color:NAVY}),new TextRun({text:'LFPA',font:'Poppins',bold:true,size:20,color:NAVY}),new TextRun({text:'.',font:'Poppins',size:20,color:NAVY})]}));

// ---------------- página 3: barra de título + tabla ----------------
const p3=[
  new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:0,after:tw(16+(48-LH(15))/2),line:240,lineRule:LineRuleType.AUTO},children:[
    behind('bar_title.png',669,48,79,-(48-LH(15))/2),new TextRun({text:'Título preliminar: Disposiciones generales',font:'Poppins',bold:true,size:30,color:'FFFFFF'})]}),
  buildTable(), sp(2)];

const footer=new Footer({children:[new Paragraph({alignment:AlignmentType.RIGHT,children:[new TextRun({children:[PageNumber.CURRENT],font:'Arial',size:21,color:'24262A'})]})]});
const emptyF=new Footer({children:[new Paragraph({children:[]})]}), emptyH=new Header({children:[new Paragraph({children:[]})]});
const page={size:{width:11906,height:16838}};
const doc=new Document({creator:'Opovisual',title:'Decreto 51/2025, de 24 de febrero',
  styles:{default:{document:{run:{font:'Poppins',size:20,color:NAVY},paragraph:{spacing:{before:0,after:0}}}},paragraphStyles:[{id:'tight',name:'Ajustado',basedOn:'Normal',run:{size:2},paragraph:{spacing:{before:0,after:0,line:240,lineRule:LineRuleType.AUTO}}}]},
  numbering:{config:[{reference:'vi',levels:[{level:0,format:LevelFormat.BULLET,text:'●',alignment:AlignmentType.LEFT,
    style:{paragraph:{indent:{left:tw(12),hanging:tw(11)}},run:{color:'6FD0E0',size:12,font:'Arial'}}}]}]},
  sections:[
    {properties:{titlePage:true,page:{...page,margin:{top:0,bottom:tw(332),left:0,right:0,header:0,footer:0}}},
     footers:{first:coverFooter,default:emptyF},children:cover},
    {properties:{type:SectionType.NEXT_PAGE,page:{...page,margin:{top:tw(90),bottom:tw(56),left:tw(79),right:tw(79),header:0,footer:165}}},headers:{default:emptyH},footers:{default:footer},children:p2},
    {properties:{type:SectionType.NEXT_PAGE,page:{...page,margin:{top:tw(57+(48-LH(15))/2),bottom:tw(56),left:tw(79),right:tw(79),header:0,footer:165}}},headers:{default:emptyH},footers:{default:footer},children:p3}
  ]});
const JSZip=require('/opt/node-tools/node_modules/jszip');
Packer.toBuffer(doc).then(async b=>{
  const z=await JSZip.loadAsync(b); let x=await z.file('word/document.xml').async('string');
  let n=0;
  for(const [id,xml] of Object.entries(SHAPES)){
    const re=new RegExp('<w:r>(?:(?!<w:r>).)*?<w:t[^>]*>'+id.replace(/[§]/g,'§')+'</w:t></w:r>','s');
    if(!re.test(x)) throw new Error('marcador no encontrado '+id);
    x=x.replace(re,xml); n++;
  }
  z.file('word/document.xml',x);
  z.file('word/media/librito_grupo.png',fs.readFileSync(G+'/badge.png'));
  let rels=await z.file('word/_rels/document.xml.rels').async('string');
  rels=rels.replace('</Relationships>','<Relationship Id="rIdBADGE" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/librito_grupo.png"/></Relationships>');
  z.file('word/_rels/document.xml.rels',rels);
  fs.writeFileSync(OUT,await z.generateAsync({type:'nodebuffer',compression:'DEFLATE'}));
  console.log('written',OUT,'formas',n);
});
