import fs from 'node:fs/promises';
import path from 'node:path';
import {ACTIVE_PREVIEW_DIRS} from './repository-layout.mjs';

const root=process.cwd();
const pub=path.join(root,'public');
const exists=async p=>fs.access(p).then(()=>true).catch(()=>false);

await fs.mkdir(pub,{recursive:true});

// Production uses the same shell as GitHub Pages. Only classified runtime layers are copied.
await fs.copyFile(path.join(root,'index.html'),path.join(pub,'index.html'));

for(const name of await fs.readdir(pub)){
  if(/^preview-v\d+$/.test(name)&&!ACTIVE_PREVIEW_DIRS.includes(name)){
    await fs.rm(path.join(pub,name),{recursive:true,force:true});
  }
}

for(const name of ACTIVE_PREVIEW_DIRS){
  const src=path.join(root,name),dst=path.join(pub,name);
  if(!(await exists(src)))throw new Error(`Missing active frontend layer: ${name}`);
  await fs.rm(dst,{recursive:true,force:true});
  await fs.cp(src,dst,{recursive:true,force:true});
}

if(await exists(path.join(root,'data'))){
  const dst=path.join(pub,'data');
  await fs.rm(dst,{recursive:true,force:true});
  await fs.cp(path.join(root,'data'),dst,{recursive:true,force:true});
}

// Validate every local CSS/JS reference used by the shell before the image is built.
const html=await fs.readFile(path.join(pub,'index.html'),'utf8');
const refs=[...html.matchAll(/(?:src|href)=["']\.\/([^"'#?]+)(?:\?[^"']*)?["']/g)].map(m=>m[1]);
const missing=[];
for(const ref of refs){
  if(ref.startsWith('assets/'))continue; // assets are served from /assets by Fastify.
  if(!(await exists(path.join(pub,ref))))missing.push(ref);
}
if(missing.length)throw new Error(`Production shell references missing files: ${[...new Set(missing)].join(', ')}`);

console.log(`[build-public] copied ${ACTIVE_PREVIEW_DIRS.length} runtime layers + ${refs.length} validated local references`);
