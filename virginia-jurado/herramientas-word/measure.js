document.fonts.ready.then(function(){ setTimeout(function(){
 const K=.95976, PH=1122.52;
 const pages=[...document.querySelectorAll('.page')];
 function st(r,pi){const pt=pages[pi].getBoundingClientRect().top;return {x:+(r.left/K).toFixed(1),y:+((r.top-pt)/K).toFixed(1),w:+(r.width/K).toFixed(1),h:+(r.height/K).toFixed(1)};}
 function lines(el,pi){const rg=document.createRange();rg.selectNodeContents(el);const rs=[...rg.getClientRects()];const ys=[];rs.forEach(r=>{const s=st(r,pi);if(!ys.some(v=>Math.abs(v.y-s.y)<3))ys.push(s)});return ys;}
 const out={};
 const q=(sel,pi)=>[...pages[pi].querySelectorAll(sel)];
 out.cover={t:q('.cv-t',0).map(e=>({box:st(e.getBoundingClientRect(),0),lines:lines(e,0)})),s:q('.cv-s',0).map(e=>({box:st(e.getBoundingClientRect(),0),lines:lines(e,0)}))};
 out.p2={title:q('.doc-title',1).map(e=>({box:st(e.getBoundingClientRect(),1),lines:lines(e,1)})),
   items:q('.it',1).map(it=>({box:st(it.getBoundingClientRect(),1),small:st(it.querySelector('small').getBoundingClientRect(),1),h3:st(it.querySelector('h3').getBoundingClientRect(),1),h3lines:lines(it.querySelector('h3'),1),pills:[...it.querySelectorAll('.pill')].map(p=>st(p.getBoundingClientRect(),1))})),
   nota:q('.nota2 p, .callout.nota p',1).map(e=>({box:st(e.getBoundingClientRect(),1)}))};
 out.p3={h1:q('.h1',2).map(e=>st(e.getBoundingClientRect(),2)),tbl:q('.tbl',2).map(e=>st(e.getBoundingClientRect(),2))};
 document.body.setAttribute('data-m',JSON.stringify(out));
},300);});
