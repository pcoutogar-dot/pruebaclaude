// Construye el .docx a partir de spec.json (páginas posicionadas) y table.json (tabla de la pág. 3)
const fs=require('fs'),path=require('path');
const D=require('docx');
const {Document,Packer,Paragraph,TextRun,ImageRun,Table,TableRow,TableCell,WidthType,BorderStyle,ShadingType,
 AlignmentType,VerticalAlign,LineRuleType,TabStopType,Footer,PageNumber,LevelFormat,
 HorizontalPositionRelativeFrom,VerticalPositionRelativeFrom,TextWrappingType,UnderlineType,TableLayoutType}=D;
const S=__dirname, OUT=process.argv[2];
const spec=JSON.parse(fs.readFileSync(S+'/spec.json','utf8'));
const table=JSON.parse(fs.readFileSync(S+'/table.json','utf8'));
const TW=11906/827;                 // twips por px del escenario
const tw=px=>Math.round(px*TW);
const hp=px=>Math.max(2,Math.floor(px*0.71983*2+0.15));   // medios puntos
const NAVY='143548';
function run(r){
  if(r.br) return new TextRun({break:1});
  if(r.tab) return new TextRun({text:'\t'});
  const o={text:r.t,font:r.font||'Poppins',size:hp(r.px),bold:!!r.bold,color:r.color||NAVY};
  if(r.spacing) o.characterSpacing=Math.round(r.spacing*0.71983*20);
  if(r.caps) o.allCaps=true;
  if(r.shade) o.shading={type:ShadingType.CLEAR,color:'auto',fill:r.shade};
  return new TextRun(o);
}
function bgImage(file){
  return new ImageRun({type:'png',data:fs.readFileSync(path.join(S,file)),transformation:{width:793.7,height:1122.5},
    floating:{horizontalPosition:{relative:HorizontalPositionRelativeFrom.PAGE,offset:0},verticalPosition:{relative:VerticalPositionRelativeFrom.PAGE,offset:0},
      behindDocument:true,allowOverlap:true,wrap:{type:TextWrappingType.NONE}}});
}
const children=[];
spec.pages.forEach((pg,pi)=>{
  let cur=0;  // posición vertical (px) ya ocupada en la página
  pg.paras.forEach((p,k)=>{
    const before=p.y-cur;
    const o={spacing:{line:tw(p.L),lineRule:LineRuleType.EXACT,before:0,after:0},
      indent:{left:tw(p.indL||0),right:tw(p.indR||0)},alignment:p.align==='center'?AlignmentType.CENTER:AlignmentType.LEFT,
      children:p.runs.map(run)};
    if(p.tabs) o.tabStops=p.tabs.map(x=>({type:TabStopType.LEFT,position:tw(x)}));
    if(k===0){
      // párrafo espaciador: lleva la imagen de fondo y ocupa justo el hueco superior
      children.push(new Paragraph({pageBreakBefore:pi>0,spacing:{line:tw(before),lineRule:LineRuleType.EXACT,before:0,after:0},children:[bgImage(pg.bg),new TextRun({text:'',size:2})]}));
    } else if(before>0.3){
      o.spacing.before=tw(before);
    }
    children.push(new Paragraph(o));
    cur=p.y+p.L*p.n;
  });
  if(pg.table_y){
    children.push(new Paragraph({spacing:{line:tw(pg.table_y-cur),lineRule:LineRuleType.EXACT,before:0,after:0},children:[new TextRun({text:'',size:2})]}));
    children.push(buildTable());
  }
});

// ---------------- tabla del Título preliminar ----------------
function buildTable(){
  const COLS=[108,112,301,149].map(tw); COLS[3]=tw(670)-COLS[0]-COLS[1]-COLS[2];
  const B={style:BorderStyle.SINGLE,size:6,color:'D1EDF9'};
  const borders={top:B,bottom:B,left:B,right:B};
  const COLOR={blue:'1A7BB9',green:'1F9D63'};
  const PX={c:11.5,n:11.2}, LH={c:14.0,n:13.8};
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
    return new Paragraph({numbering:{reference:'vi',level:0},spacing:{line:tw(LH[cls]),lineRule:LineRuleType.EXACT,before:0,after:0},
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
    kids.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{line:tw(15),lineRule:LineRuleType.EXACT,before:0,after:0},children:runs}));
    if(chip) kids.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:tw(6),after:0},children:[
      new TextRun({text:' ♥ '+chip+' ',font:'Arial',bold:true,size:hp(8.6),color:NAVY,characterSpacing:24,shading:{type:ShadingType.CLEAR,color:'auto',fill:'9DDFEA'}})]}));
    return new TableCell({rowSpan:c.rowspan,width:{size:COLS[0],type:WidthType.DXA},borders,verticalAlign:VerticalAlign.CENTER,
      shading:{type:ShadingType.CLEAR,color:'auto',fill:'D1EDF9'},margins:{top:tw(8),bottom:tw(8),left:tw(5),right:tw(5)},children:kids});
  }
  function cellS(c){
    const runs=[];
    c.paras.forEach(p=>p.runs.forEach(r=>{
      const bold=!!r.b||c.blue;
      runs.push(new TextRun({text:r.t,font:bold?'Poppins':'Poppins Medium',bold,size:hp(10.4),color:c.blue?COLOR.blue:NAVY}));
    }));
    return new TableCell({width:{size:COLS[1],type:WidthType.DXA},borders,verticalAlign:VerticalAlign.CENTER,
      shading:{type:ShadingType.CLEAR,color:'auto',fill:'F8F9FA'},margins:{top:tw(4),bottom:tw(3),left:tw(8),right:tw(6)},
      children:[new Paragraph({alignment:AlignmentType.CENTER,spacing:{line:tw(14.4),lineRule:LineRuleType.EXACT,before:0,after:0},children:runs})]});
  }
  function cellC(c){
    const w=c.colspan===2?COLS[2]+COLS[3]:COLS[2];
    let kids;
    const items=c.paras.filter(p=>p.runs.length);
    const blueAll=c.paras.length && false;
    if(c.two){
      const half=Math.ceil(items.length/2), iw=Math.round((w-tw(14))/2);
      const NB={style:BorderStyle.NONE,size:0,color:'FFFFFF'}; const nb={top:NB,bottom:NB,left:NB,right:NB};
      const col=list=>new TableCell({width:{size:iw,type:WidthType.DXA},borders:nb,margins:{top:0,bottom:0,left:0,right:tw(7)},children:list.map(p=>bulletPara(p.runs,'li','c'))});
      kids=[new Table({width:{size:w-tw(14),type:WidthType.DXA},columnWidths:[iw,iw],borders:{top:NB,bottom:NB,left:NB,right:NB,insideHorizontal:NB,insideVertical:NB},
        rows:[new TableRow({children:[col(items.slice(0,half)),col(items.slice(half))]})]}),new Paragraph({spacing:{line:20,lineRule:LineRuleType.EXACT,before:0,after:0},children:[new TextRun({text:'',size:2})]})];
    } else kids=items.map(p=>bulletPara(p.runs,'li','c'));
    return new TableCell({columnSpan:c.colspan,width:{size:w,type:WidthType.DXA},borders,margins:{top:tw(2),bottom:tw(2),left:tw(8),right:tw(6)},children:kids});
  }
  function cellN(c){
    const items=c.paras.filter(p=>p.runs.length);
    const kids=[];
    items.forEach((p,i)=>{ kids.push(new Paragraph({numbering:{reference:'vi',level:0},spacing:{line:tw(LH.n),lineRule:LineRuleType.EXACT,before:i?tw(5):0,after:0},
      children:textRuns(p.runs,{font:'Arial',px:PX.n,color:'222222'})})); });
    return new TableCell({width:{size:COLS[3],type:WidthType.DXA},borders,shading:{type:ShadingType.CLEAR,color:'auto',fill:'F6FBFE'},
      margins:{top:tw(4),bottom:tw(3),left:tw(8),right:tw(6)},children:kids});
  }
  // los textos con clase "blue" heredan el azul: marcarlo en los runs
  table.forEach(r=>r.forEach(c=>{ if(c.cls==='c'||c.cls==='n') c.paras.forEach(p=>p.runs.forEach(x=>{})); }));
  const rows=table.map(r=>new TableRow({children:r.map(c=>({k:cellK,s:cellS,c:cellC,n:cellN})[c.cls](c))}));
  return new Table({width:{size:COLS.reduce((a,b)=>a+b),type:WidthType.DXA},columnWidths:COLS,layout:TableLayoutType.FIXED,rows});
}

const footer=new Footer({children:[new Paragraph({alignment:AlignmentType.RIGHT,children:[new TextRun({children:[PageNumber.CURRENT],font:'Arial',size:21,color:'24262A'})]})]});
const doc=new Document({
  creator:'Opovisual',title:'Decreto 51/2025, de 24 de febrero',
  styles:{default:{document:{run:{font:'Poppins',size:20,color:NAVY}}}},
  numbering:{config:[{reference:'vi',levels:[{level:0,format:LevelFormat.BULLET,text:'●',alignment:AlignmentType.LEFT,
    style:{paragraph:{indent:{left:tw(12),hanging:tw(11)}},run:{color:'6FD0E0',size:12,font:'Arial'}}}]}]},
  sections:[{properties:{titlePage:true,page:{size:{width:11906,height:16838},margin:{top:0,bottom:560,left:tw(79),right:tw(79),header:0,footer:165}}},
    headers:{},footers:{default:footer,first:new Footer({children:[new Paragraph({children:[]})]})},children}]
});
Packer.toBuffer(doc).then(b=>{fs.writeFileSync(OUT,b);console.log('written',OUT,b.length);});
