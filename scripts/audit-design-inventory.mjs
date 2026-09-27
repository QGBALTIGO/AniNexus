import fs from 'node:fs/promises';
import * as css from 'css-tree';
import {ACTIVE_PREVIEW_DIRS} from './repository-layout.mjs';
const properties=new Set(['font-family','font-size','font-weight','line-height','letter-spacing','border-radius','box-shadow','transition','animation','gap','padding','margin','color','background-color']);
const values={},files=[];
for(const dir of ACTIVE_PREVIEW_DIRS)for(const name of await fs.readdir(dir))if(name.endsWith('.css')){
  const file=`${dir}/${name}`;files.push(file);const ast=css.parse(await fs.readFile(file,'utf8'),{positions:true});
  css.walk(ast,node=>{if(node.type!=='Declaration'||!properties.has(node.property))return;const value=css.generate(node.value);values[node.property]??={};values[node.property][value]??={count:0,locations:[]};const entry=values[node.property][value];entry.count++;if(entry.locations.length<6)entry.locations.push({file,line:node.loc?.start.line})});
}
await fs.mkdir('audit-artifacts',{recursive:true});await fs.writeFile('audit-artifacts/design-system-inventory.json',JSON.stringify({files,values},null,2));
for(const property of ['font-family','font-size','border-radius','transition'])console.log(JSON.stringify({property,unique:Object.keys(values[property]||{}).length,mostUsed:Object.entries(values[property]||{}).sort((a,b)=>b[1].count-a[1].count).slice(0,8).map(([value,{count}])=>({value,count}))}));
