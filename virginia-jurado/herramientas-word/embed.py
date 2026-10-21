# Incrusta Poppins y Lora (ofuscadas, ECMA-376) en un .docx generado
import sys,os,re,uuid,zipfile,shutil
src,dst=sys.argv[1],sys.argv[2]
F='/home/user/pruebaclaude/virginia-jurado/assets/fonts/'
FONTS={'Poppins':{'Regular':'Poppins-Regular','Bold':'Poppins-Bold'},
       'Poppins SemiBold':{'Regular':'Poppins-SemiBold'},
       'Poppins Medium':{'Regular':'Poppins-Medium'},
       'Lora':{'Regular':'Lora-Regular','Bold':'Lora-Bold'}}
zin=zipfile.ZipFile(src); files={n:zin.read(n) for n in zin.namelist()}
rels=['<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">']
entries=[]; k=0
for name,styles in FONTS.items():
    emb=''
    for st in ('Regular','Bold'):
        if st not in styles: continue
        k+=1; g=str(uuid.uuid4()).upper(); key=bytes.fromhex(g.replace('-',''))[::-1]
        data=bytearray(open(F+styles[st]+'.ttf','rb').read())
        for i in range(32): data[i]^=key[i%16]
        files[f'word/fonts/font{k}.odttf']=bytes(data)
        rels.append(f'<Relationship Id="rIdF{k}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/font{k}.odttf"/>')
        emb+=f'<w:embed{st} r:id="rIdF{k}" w:fontKey="{{{g}}}"/>'
    entries.append(f'<w:font w:name="{name}"><w:charset w:val="00"/><w:family w:val="auto"/><w:pitch w:val="variable"/>{emb}</w:font>')
rels.append('</Relationships>')
ft=files['word/fontTable.xml'].decode()
for name in FONTS: ft=re.sub(r'<w:font w:name="%s">.*?</w:font>'%re.escape(name),'',ft,flags=re.S)
if ft.rstrip().endswith('/>') and '</w:fonts>' not in ft:
    ft=ft.rstrip()[:-2]+'></w:fonts>'
ft=ft.replace('</w:fonts>',''.join(entries)+'</w:fonts>')
if 'xmlns:r=' not in ft: ft=ft.replace('<w:fonts ','<w:fonts xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ',1)
files['word/fontTable.xml']=ft.encode()
files['word/_rels/fontTable.xml.rels']=''.join(rels).encode()
st=files['word/settings.xml'].decode()
if '<w:embedTrueTypeFonts' not in st:
    m=re.search(r'<w:settings[^>]*>',st)
    after=m.end()
    for tag in ('zoom','removePersonalInformation','removeDateAndTime','doNotDisplayPageBoundaries','displayBackgroundShape','printPostScriptOverText','printFractionalCharacterWidth','printFormsData'):
        z=re.search(r'<w:%s[^>]*/>'%tag,st)
        if z: after=z.end()
    st=st[:after]+'<w:embedTrueTypeFonts/>'+st[after:]
files['word/settings.xml']=st.encode()
ct=files['[Content_Types].xml'].decode()
if 'Extension="odttf"' not in ct:
    ct=ct.replace('<Default ','<Default ContentType="application/vnd.openxmlformats-officedocument.obfuscatedFont" Extension="odttf"/><Default ',1)
files['[Content_Types].xml']=ct.encode()
with zipfile.ZipFile(dst,'w',zipfile.ZIP_DEFLATED) as z:
    order=['[Content_Types].xml']+[n for n in files if n!='[Content_Types].xml']
    for n in order: z.writestr(n,files[n])
print('incrustadas',k,'fuentes en',dst)
