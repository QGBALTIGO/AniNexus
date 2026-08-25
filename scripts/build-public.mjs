import fs from 'node:fs/promises';
import path from 'node:path';
import {ACTIVE_PREVIEW_DIRS} from './repository-layout.mjs';

const root=process.cwd();
const pub=path.join(root,'public');
const exists=async p=>fs.access(p).then(()=>true).catch(()=>false);

await fs.mkdir(pub,{recursive:true});
await fs.rm(path.join(pub,'release.json'),{force:true});

// Production uses the same shell as GitHub Pages. Only classified runtime layers are copied.
await fs.copyFile(path.join(root,'index.html'),path.join(pub,'index.html'));
for(const file of ['404.html','robots.txt','sitemap.xml']){
  if(await exists(path.join(root,file)))await fs.copyFile(path.join(root,file),path.join(pub,file));
}

const publicSiteOrigin=String(process.env.PUBLIC_SITE_ORIGIN||'https://qgbaltigo.github.io/AniNexus').replace(/\/+$/,'');
const publicApiOrigin=String(process.env.PUBLIC_API_ORIGIN||'').replace(/\/+$/,'');
const clerkPublishableKey=String(process.env.PUBLIC_CLERK_PUBLISHABLE_KEY||process.env.CLERK_PUBLISHABLE_KEY||'');
const requestedAuth=String(process.env.PUBLIC_AUTH_ENABLED||'').toLowerCase()==='true';
const authEnabled=requestedAuth&&/^https:\/\//.test(publicApiOrigin)&&/^pk_(?:test|live)_/.test(clerkPublishableKey);
if(requestedAuth&&!authEnabled)throw new Error('PUBLIC_AUTH_ENABLED requires an HTTPS PUBLIC_API_ORIGIN and a valid public Clerk key');
const runtimeConfig={environment:process.env.NODE_ENV==='production'?'production':'preview',siteOrigin:publicSiteOrigin,apiOrigin:publicApiOrigin,clerkPublishableKey,authEnabled};
await fs.writeFile(path.join(pub,'runtime-config.js'),`window.__ANINEXUS_CONFIG__ = Object.freeze(${JSON.stringify(runtimeConfig).replace(/</g,'\\u003c')});\n`,'utf8');
if (authEnabled) {
  const shellPath=path.join(pub,'index.html');
  const shell=await fs.readFile(shellPath,'utf8');
  const apiOrigin=new URL(publicApiOrigin).origin;
  await fs.writeFile(shellPath,shell.replace("connect-src 'self'",`connect-src 'self' ${apiOrigin}`),'utf8');
}

// The VPS release is served directly by Nginx, so /public must be self-contained.
// Fastify also serves these files from /assets; keeping a copy here preserves that
// behavior while allowing the same artifact to run without the application server.
const publicAssets=path.join(pub,'assets');
await fs.rm(publicAssets,{recursive:true,force:true});
await fs.cp(path.join(root,'assets'),publicAssets,{recursive:true,force:true});
await fs.copyFile(path.join(root,'.nojekyll'),path.join(pub,'.nojekyll'));

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

console.log(`[build-public] copied assets + ${ACTIVE_PREVIEW_DIRS.length} runtime layers + ${refs.length} validated local references`);
