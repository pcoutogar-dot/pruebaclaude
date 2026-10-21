# Compara la posición vertical de cada párrafo posicionado entre el PDF de referencia (Chrome) y el render del Word (LibreOffice)
import json,pdfplumber,os,sys
S=os.path.dirname(os.path.abspath(__file__))
spec=json.load(open(S+'/spec.json'))
ref=pdfplumber.open('/home/user/pruebaclaude/virginia-jurado/decreto-51-2025-muestra.pdf')
lo=pdfplumber.open(S+'/out.pdf')
K=0.71983
corr=json.load(open(S+'/corr.json')) if os.path.exists(S+'/corr.json') else {}
rep=[]
for pi,pg in enumerate(spec['pages']):
    rp,lp=ref.pages[pi],lo.pages[pi]; rw=rp.extract_words(); lw=lp.extract_words()
    def base(page,words):
        H=page.height
        for w in words:
            ch=min(page.chars,key=lambda c:abs(c['x0']-w['x0'])+abs(c['top']-w['top']))
            w['base']=H-ch['matrix'][5]
    base(rp,rw); base(lp,lw)
    for p in pg['paras']:
        txt=next((r['t'] for r in p['runs'] if r.get('t','').strip()),'').replace(' ',' ').split()[0]
        if p['runs'][0].get('caps'): txt=txt.upper()
        y0=(p['y']-corr.get(p['id'],0))*K
        c=[w for w in rw if w['text'].startswith(txt) and abs(w['top']-y0)<20]
        if not c: rep.append((p['id'],txt,'no ref')); continue
        cw=min(c,key=lambda w:abs(w['top']-y0))
        d=[w for w in lw if w['text'].startswith(txt) and abs(w['x0']-cw['x0'])<25 and abs(w['top']-cw['top'])<30]
        if not d: rep.append((p['id'],txt,'no lo')); continue
        dw=min(d,key=lambda w:abs(w['top']-cw['top']))
        delta=(cw['base']-dw['base'])/K
        rep.append((p['id'],txt,round(delta,2)))
        if '--apply' in sys.argv: corr[p['id']]=round(corr.get(p['id'],0)+delta,2)
for r in rep: print(r)
if '--apply' in sys.argv: json.dump(corr,open(S+'/corr.json','w'),indent=1)
