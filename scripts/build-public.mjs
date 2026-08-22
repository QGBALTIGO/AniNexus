import fs from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const pub=path.join(root,'public');
const exists=async p=>fs.access(p).then(()=>true).catch(()=>false);

await fs.mkdir(pub,{recursive:true});

// Production must use the exact same HTML/runtime layers that GitHub Pages uses.
await fs.copyFile(path.join(root,'index.html'),path.join(pub,'index.html'));

for(const name of await fs.readdir(root)){
  if(!/^preview-v\d+$/.test(name))continue;
  const src=path.join(root,name),dst=path.join(pub,name);
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

console.log(`[build-public] copied runtime shell + ${refs.length} validated local references`);
