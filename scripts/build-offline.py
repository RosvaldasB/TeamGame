"""Build a file:// compatible, self-contained demo. No runtime Python dependency."""
from pathlib import Path
import base64,re
root=Path(__file__).resolve().parent.parent
engine=(root/'game.js').read_text()
engine=re.sub(r"import .*?;\n",'',engine,count=1)
engine=re.sub(r'\bexport\s+','',engine)
crypto='''const randomInt=max=>{if(max<=0)throw Error('Invalid random range');const a=new Uint32Array(1);const limit=4294967296-(4294967296%max);do{crypto.getRandomValues(a);}while(a[0]>=limit);return a[0]%max;};
const randomBytes=n=>{const a=new Uint8Array(n);crypto.getRandomValues(a);return{toString:()=>Array.from(a,x=>x.toString(16).padStart(2,'0')).join('')};};\n'''
app=(root/'public/app.js').read_text().replace("import { MEDIA_EVENTS } from './media.js';",'')
css=(root/'public/style.css').read_text()
for name in ['office-entrance','office-conflict']:
    uri='data:image/png;base64,'+base64.b64encode((root/f'public/assets/{name}.png').read_bytes()).decode()
    css=css.replace(f'assets/{name}.png',uri)
html=(root/'public/index.html').read_text().replace('<link rel="stylesheet" href="/style.css">','<style>'+css+'</style>')
script=crypto+engine+'\n'+(root/'public/offline-adapter.js').read_text()+'\n'+app
html=html.replace('<script type="module" src="/app.js"></script>','<script>"use strict";\n'+script.replace('</script','<\\/script').replace('</body','<\\/body')+'\n</script>')
(root/'OFFLINE_DEMO.html').write_text(html)
print('OFFLINE_DEMO.html built:',len(html.encode()),'bytes')
