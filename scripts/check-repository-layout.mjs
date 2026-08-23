import fs from 'node:fs/promises';
import path from 'node:path';
import {ACTIVE_PREVIEW_DIRS,ARCHIVED_PREVIEW_DIRS} from './repository-layout.mjs';

const root=process.cwd();
const entries=await fs.readdir(root,{withFileTypes:true});
const rootPreviews=entries.filter(x=>x.isDirectory()&&/^preview-v\d+$/.test(x.name)).map(x=>x.name).sort();
const expected=[...ACTIVE_PREVIEW_DIRS].sort();

if(JSON.stringify(rootPreviews)!==JSON.stringify(expected)){
  const unexpected=rootPreviews.filter(x=>!expected.includes(x));
  const missing=expected.filter(x=>!rootPreviews.includes(x));
  throw new Error([
    'Repository layout drift detected.',
    unexpected.length?`Unexpected root preview layers: ${unexpected.join(', ')}`:'',
    missing.length?`Missing active preview layers: ${missing.join(', ')}`:'',
    'Classify historical code under legacy/ and document any genuinely new runtime layer.'
  ].filter(Boolean).join('\n'));
}

for(const name of ARCHIVED_PREVIEW_DIRS){
  const archived=path.join(root,'legacy',name);
  try{await fs.access(archived)}catch{throw new Error(`Missing archived layer: legacy/${name}`)}
}

for(const required of ['docs/ARCHITECTURE.md','legacy/README.md','CONTRIBUTING.md']){
  try{await fs.access(path.join(root,required))}catch{throw new Error(`Missing repository guide: ${required}`)}
}

for(const {name} of entries){
  if(/^tmp-.*marker/i.test(name))throw new Error(`Temporary marker must not live in repository root: ${name}`);
}

console.log(`[layout] ${ACTIVE_PREVIEW_DIRS.length} active frontend layers; ${ARCHIVED_PREVIEW_DIRS.length} archived layers; structure OK`);
