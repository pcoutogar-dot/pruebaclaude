// Versión para Google Docs: sin objetos flotantes ni superposiciones; todo en flujo (tablas + imágenes en línea)
const fs=require('fs'),path=require('path');
const D=require('docx');
const {Document,Packer,Paragraph,TextRun,ImageRun,Table,TableRow,TableCell,WidthType,BorderStyle,ShadingType,
 AlignmentType,VerticalAlign,LineRuleType,Footer,PageNumber,LevelFormat,UnderlineType,TableLayoutType,SectionType,HeightRule}=D;
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
  const COLS=[108,112,301,149].map(tw); COLS[3]=tw(670)-COLS[0]-COLS[1]-COLS[2];
  const B={style:BorderStyle.SINGLE,size:6,color:'D1EDF9'};
  const borders={top:B,bottom:B,left:B,right:B};
  const COLOR={blue:'1A7BB9',green:'1F9D63'};
  const PX={c:11.5,n:11.2}, LH={c:13.4,n:13.2};
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
      runs.push(new TextRun({text:r.t,font:bold?'Poppins':'Poppins',bold,size:hp(10.4),color:c.blue?COLOR.blue:NAVY}));
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


// ---------------- portada: imagen a página completa ----------------
const cover=[new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:0,after:0},children:[new ImageRun({type:'png',data:fs.readFileSync(G+'/cover.png'),transformation:{width:790,height:1117}})]})];

// ---------------- página 2: estructura ----------------
const p2=[];
p2.push(new Table({width:{size:tw(669),type:WidthType.DXA},columnWidths:[tw(669)],layout:TableLayoutType.FIXED,borders:{...NOB,insideHorizontal:NB,insideVertical:NB},
  rows:[new TableRow({children:[new TableCell({width:{size:tw(669),type:WidthType.DXA},borders:NOB,shading:{type:ShadingType.CLEAR,color:'auto',fill:'D1EDF9'},
    margins:{top:tw(12),bottom:tw(16),left:tw(26),right:tw(26)},children:[
      new Paragraph({spacing:{before:0,after:tw(4)},children:[img('badge.png',36,36)]}),
      new Paragraph({spacing:{before:0,after:0,line:312,lineRule:LineRuleType.AUTO},children:[new TextRun({text:'Decreto 51/2025, de 24 de febrero, por el que se regula la planificación y ordenación del empleo público, y el ingreso, promoción interna y provisión de puestos de trabajo del personal de la Administración General de la Junta de Andalucía.',font:'Poppins',bold:true,size:24,color:NAVY})]})]})]})]}));
p2.push(sp(16));
p2.push(new Paragraph({spacing:{before:0,after:0},children:[img('label.png',147,33)]}));
p2.push(sp(12));
const titulos=[
 ['Título preliminar','Disposiciones generales',[],'node_dot.png',[44,25]],
 ['Título I','Planificación y ordenación del empleo público',['Planificación de recursos humanos','Planes de ordenación de recursos humanos','Oferta de empleo público'],'node_I.png',[44,49]],
 ['Título II','Selección de personal',['Normas generales','Sistema de selección','Inicio y desarrollo de los procesos selectivos','Personal funcionario en prácticas','Comisiones de selección','Selección de personal funcionario interino y personal laboral temporal'],'node_II.png',[44,49]],
 ['Título III','Promoción interna del personal funcionario de carrera y del personal laboral',['Normas generales','Promoción interna vertical del personal funcionario de carrera','Promoción interna horizontal del personal funcionario de carrera'],'node_III.png',[44,49]],
 ['Título IV','Provisión de puestos de trabajo y movilidad del personal funcionario y laboral',['Normas generales','Procedimientos ordinarios de provisión de personal funcionario de carrera','Procedimientos de provisión de carácter extraordinario'],'node_IV.png',[44,49]],
 ['Título V','Adquisición y pérdida de la relación de servicio',['Adquisición y pérdida de la condición de personal funcionario de carrera','Rehabilitación de la condición de personal funcionario de carrera','Adquisición y pérdida de la condición de personal laboral fijo'],'node_V.png',[44,49]]];
const ROM=['I','II','III','IV','V','VI'];
const CA=tw(33),CB=tw(33),CC=tw(669)-CA-CB;
const LINE={style:BorderStyle.SINGLE,size:12,color:SKY};
const rowsT=[];
titulos.forEach(([kick,name,caps,node,[nw,nh]],i)=>{
  const last=i===titulos.length-1;
  const content=[
    new Paragraph({spacing:{before:0,after:tw(3)},children:[new TextRun({text:kick.toUpperCase(),font:'Poppins',bold:true,size:12,color:'6F8290'})]}),
    new Paragraph({spacing:{before:0,after:tw(caps.length?6:0)},children:[new TextRun({text:name,font:'Poppins',bold:true,size:21,color:NAVY})]})];
  if(caps.length){
    const runs=[];
    caps.forEach((t,j)=>{
      if(j) runs.push(new TextRun({text:'   ',font:'Poppins',size:15}));
      const sh={type:ShadingType.CLEAR,color:'auto',fill:'E3F3FA'};
      runs.push(new TextRun({text:'\u00a0Capítulo\u00a0'+ROM[j]+'\u00a0\u00a0',font:'Poppins',bold:true,size:15,color:NAVY,shading:sh}));
      runs.push(new TextRun({text:t.replace(/ /g,'\u00a0')+'\u00a0',font:'Poppins',size:15,color:'2B2B2B',shading:sh}));
    });
    content.push(new Paragraph({spacing:{before:0,after:0,line:372,lineRule:LineRuleType.AUTO},children:runs}));
  }
  content.push(new Paragraph({spacing:{before:0,after:0,line:tw(last?2:10),lineRule:LineRuleType.EXACT},children:[new TextRun({text:'',size:2})]}));
  rowsT.push(new TableRow({children:[
    new TableCell({columnSpan:2,width:{size:CA+CB,type:WidthType.DXA},borders:NOB,margins:{top:0,bottom:0,left:0,right:0},verticalAlign:VerticalAlign.TOP,
      children:[new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:0,after:0},children:[img(node,nw,nh)]})]}),
    new TableCell({rowSpan:2,width:{size:CC,type:WidthType.DXA},borders:NOB,margins:{top:tw(i===0?0:2),bottom:0,left:0,right:0},children:content})]}));
  rowsT.push(new TableRow({children:[
    new TableCell({width:{size:CA,type:WidthType.DXA},borders:{...NOB,right:last?NB:LINE},margins:{top:0,bottom:0,left:0,right:0},children:[sp(1)]}),
    new TableCell({width:{size:CB,type:WidthType.DXA},borders:{...NOB,left:last?NB:LINE},margins:{top:0,bottom:0,left:0,right:0},children:[sp(1)]})]}));
});
p2.push(new Table({width:{size:tw(669),type:WidthType.DXA},columnWidths:[CA,CB,CC],layout:TableLayoutType.FIXED,borders:{...NOB,insideHorizontal:NB,insideVertical:NB},rows:rowsT}));
p2.push(sp(14));
p2.push(new Paragraph({spacing:{before:0,after:0},children:[img('ast.png',22,23),
  new TextRun({text:'  Este decreto desarrolla los Títulos ',font:'Poppins',size:20,color:NAVY}),
  new TextRun({text:'8, 9 y 10',font:'Poppins',bold:true,size:22,color:NAVY,shading:{type:ShadingType.CLEAR,color:'auto',fill:SKY}}),
  new TextRun({text:' de la ',font:'Poppins',size:20,color:NAVY}),new TextRun({text:'LFPA',font:'Poppins',bold:true,size:20,color:NAVY}),new TextRun({text:'.',font:'Poppins',size:20,color:NAVY})]}));

// ---------------- página 3: título + tabla ----------------
const p3=[];
p3.push(new Table({width:{size:tw(669),type:WidthType.DXA},columnWidths:[tw(669)],layout:TableLayoutType.FIXED,borders:{...NOB,insideHorizontal:NB,insideVertical:NB},
  rows:[new TableRow({children:[new TableCell({width:{size:tw(669),type:WidthType.DXA},borders:NOB,shading:{type:ShadingType.CLEAR,color:'auto',fill:NAVY},verticalAlign:VerticalAlign.CENTER,
    margins:{top:tw(8),bottom:tw(8),left:tw(10),right:tw(10)},children:[new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:0,after:0},
      children:[new TextRun({text:'Título preliminar: Disposiciones generales',font:'Poppins',bold:true,size:30,color:'FFFFFF'})]})]})]})]}));
p3.push(sp(10));
p3.push(buildTable());
p3.push(sp(2));

const footer=new Footer({children:[new Paragraph({alignment:AlignmentType.RIGHT,children:[new TextRun({children:[PageNumber.CURRENT],font:'Arial',size:21,color:'24262A'})]})]});
const empty=new Footer({children:[new Paragraph({children:[]})]});
const page={size:{width:11906,height:16838}};
const doc=new Document({creator:'Opovisual',title:'Decreto 51/2025, de 24 de febrero',
  styles:{default:{document:{run:{font:'Poppins',size:20,color:NAVY},paragraph:{spacing:{before:0,after:0}}}}},
  numbering:{config:[{reference:'vi',levels:[{level:0,format:LevelFormat.BULLET,text:'\u25CF',alignment:AlignmentType.LEFT,
    style:{paragraph:{indent:{left:tw(12),hanging:tw(11)}},run:{color:'6FD0E0',size:12,font:'Arial'}}}]}]},
  sections:[
    {properties:{page:{...page,margin:{top:0,bottom:0,left:0,right:0,header:0,footer:0}}},footers:{default:empty},children:cover},
    {properties:{type:SectionType.NEXT_PAGE,page:{...page,margin:{top:tw(48),bottom:tw(56),left:tw(79),right:tw(79),header:0,footer:165}}},footers:{default:footer},
     children:[...p2,new Paragraph({pageBreakBefore:true,spacing:{before:0,after:0,line:20,lineRule:LineRuleType.EXACT},children:[new TextRun({text:'',size:2})]}),...p3]}]});
Packer.toBuffer(doc).then(b=>{fs.writeFileSync(OUT,b);console.log('written',OUT,b.length);});
