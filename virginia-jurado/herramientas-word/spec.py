# Genera spec.json: párrafos posicionados (en px del escenario de 827 px) para cada página
import json,sys,os
S=os.path.dirname(os.path.abspath(__file__))
m=json.load(open(S+'/m.json'))
corr=json.load(open(S+'/corr.json')) if os.path.exists(S+'/corr.json') else {}
NAVY='143548'
def R(t,font='Poppins',px=12,bold=False,color=NAVY,**k):
    d={'t':t,'font':font,'px':px,'bold':bold,'color':color}; d.update(k); return d
pages=[]
# ---------- portada
t=m['cover']['t'][0]; s=m['cover']['s'][0]
pages.append({'bg':'bg1.png','paras':[
 {'id':'cv_t','y':t['box']['y'],'L':51,'n':2,'align':'center','runs':[R('DECRETO 51/2025,',px=44,bold=True,spacing=.01*44),{'br':1},R('DE 24 DE FEBRERO',px=44,bold=True,spacing=.01*44)]},
 {'id':'cv_s','y':s['box']['y'],'L':23,'n':len(s['lines']),'align':'center','indL':34,'indR':34,
  'runs':[R('Por el que se regula la planificación y ordenación del empleo público, y el ingreso, promoción interna y provisión de puestos de trabajo del personal de la Administración General de la Junta de Andalucía.',px=14.5,color='3A4A55')]},
]})
# ---------- estructura
p2=m['p2']; tt=p2['title'][0]
paras=[{'id':'p2_title','y':tt['lines'][0]['y']-2.25,'L':24.5,'n':len(tt['lines']),'indL':28,'indR':28,
  'runs':[R('Decreto 51/2025, de 24 de febrero, por el que se regula la planificación y ordenación del empleo público, y el ingreso, promoción interna y provisión de puestos de trabajo del personal de la Administración General de la Junta de Andalucía.',px=16.8,bold=True)]}]
kick=['Título preliminar','Título I','Título II','Título III','Título IV','Título V']
names=['Disposiciones generales','Planificación y ordenación del empleo público','Selección de personal','Promoción interna del personal funcionario de carrera y del personal laboral','Provisión de puestos de trabajo y movilidad del personal funcionario y laboral','Adquisición y pérdida de la relación de servicio']
caps=[[],['Planificación de recursos humanos','Planes de ordenación de recursos humanos','Oferta de empleo público'],
['Normas generales','Sistema de selección','Inicio y desarrollo de los procesos selectivos','Personal funcionario en prácticas','Comisiones de selección','Selección de personal funcionario interino y personal laboral temporal'],
['Normas generales','Promoción interna vertical del personal funcionario de carrera','Promoción interna horizontal del personal funcionario de carrera'],
['Normas generales','Procedimientos ordinarios de provisión de personal funcionario de carrera','Procedimientos de provisión de carácter extraordinario'],
['Adquisición y pérdida de la condición de personal funcionario de carrera','Rehabilitación de la condición de personal funcionario de carrera','Adquisición y pérdida de la condición de personal laboral fijo']]
ROM=['I','II','III','IV','V','VI']
for i,it in enumerate(p2['items']):
    paras.append({'id':f'k{i}','y':it['small']['y']+3,'L':8.6,'n':1,'indL':66,'runs':[R(kick[i],px=8.6,font='Poppins SemiBold',color='6F8290',caps=True)]})
    paras.append({'id':f'h{i}','y':it['h3']['y'],'L':21,'n':len(it['h3lines']),'indL':66,'runs':[R(names[i],px=14.6,font='Poppins SemiBold')]})
    rows={}
    for j,pl in enumerate(it['pills']): rows.setdefault(round(pl['y']),[]).append((j,pl))
    for ry,lst in sorted(rows.items()):
        runs=[];tabs=[]
        for j,pl in lst:
            tabs.append(pl['x']+12-79)
            runs+= [{'tab':1},R('Capítulo '+ROM[j],px=10.4,font='Poppins SemiBold'),R(' ',px=10.4,color='2B2B2B',spacing=3),R(caps[i][j].replace(' ',' '),px=10.4,color='2B2B2B')]
        paras.append({'id':f'p{i}_{ry}','y':ry+1,'L':21,'n':1,'tabs':tabs,'runs':runs})
nb=p2['nota'][0]['box']
paras.append({'id':'nota','y':nb['y'],'L':24,'n':1,'indL':nb['x']-79,'runs':[R('Este decreto desarrolla los Títulos ',px=14),R('8, 9 y 10',px=15.5,bold=True,shade='9DDFEA'),R(' de la ',px=14),R('LFPA',px=14,font='Poppins Medium'),R('.',px=14)]})
pages.append({'bg':'bg2.png','paras':paras,'pnum':True})
# ---------- tabla
h1=m['p3']['h1'][0]
pages.append({'bg':'bg3.png','paras':[{'id':'sec','y':h1['y'],'L':48,'n':1,'align':'center','runs':[R('Título preliminar: Disposiciones generales',px=21.2,bold=True,color='FFFFFF',spacing=-.01*21.2)]}],
              'table_y':m['p3']['tbl'][0]['y'],'pnum':True})
for pg in pages:
    for p in pg['paras']: p['y']+=corr.get(p['id'],0)
json.dump({'pages':pages},open(S+'/spec.json','w'),ensure_ascii=False,indent=1)
print('ok',[len(p['paras']) for p in pages])
