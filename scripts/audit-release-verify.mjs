// Verify served runtime bytes against the locally built production artifact.
import fs from 'node:fs/promises';
import path from 'node:path';
import https from 'node:https';
import {createHash} from 'node:crypto';
import {ACTIVE_PREVIEW_DIRS} from './repository-layout.mjs';
const origin='https://aninexus.com.br';
const artifact=process.argv[2]||'public';
const release=await (await fetch(origin+'/release.json',{cache:'no-store'})).json();
const cert=await new Promise((resolve,reject)=>{
  const req=https.get(origin,res=>{const certificate=res.socket.getPeerCertificate();resolve({authorized:res.socket.authorized,subject:certificate.subject,issuer:certificate.issuer,validTo:certificate.valid_to});res.resume()});
  req.on('error',reject);req.setTimeout(15000,()=>req.destroy(new Error('TLS timeout')));
});
const files=['index.html','runtime-config.js','clerk-localization-ptbr.json'];
for(const directory of ACTIVE_PREVIEW_DIRS)for(const file of await fs.readdir(path.join(artifact,directory)))if(/\.(js|css)$/.test(file))files.push(directory+'/'+file);
const queue=[...files],results=[];
const hash=buffer=>createHash('sha256').update(buffer).digest('hex');
async function worker(){while(queue.length){const file=queue.shift(),local=await fs.readFile(path.join(artifact,file)),res=await fetch(origin+'/'+file+'?audit='+release.commit,{signal:AbortSignal.timeout(15000),cache:'no-store'}),remote=Buffer.from(await res.arrayBuffer());results.push({file,status:res.status,match:res.ok&&hash(local)===hash(remote)});}}
await Promise.all([worker(),worker(),worker()]);
const health=await (await fetch(origin+'/health/ready')).json();
const endRelease=await (await fetch(origin+'/release.json',{cache:'no-store'})).json();
const result={checkedAt:new Date().toISOString(),release,endRelease,certificate:cert,health,files:results.length,mismatches:results.filter(x=>!x.match)};
await fs.mkdir('audit-artifacts',{recursive:true});await fs.writeFile('audit-artifacts/release-verification.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
if(!cert.authorized||!health.ok||result.mismatches.length||endRelease.commit!==release.commit)process.exitCode=1;
