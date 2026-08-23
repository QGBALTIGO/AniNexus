import fs from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();

const ACTIVE_PREVIEW_DIRS=[
  'preview-v6','preview-v8','preview-v9','preview-v10','preview-v11','preview-v12',
  'preview-v14','preview-v15','preview-v18','preview-v19','preview-v20','preview-v21',
  'preview-v22','preview-v23','preview-v24','preview-v27','preview-v32','preview-v33',
  'preview-v35','preview-v36','preview-v37','preview-v38','preview-v39','preview-v40'
];

const ARCHIVED_PREVIEW_DIRS=[
  'preview-v4','preview-v5','preview-v7','preview-v13','preview-v16','preview-v17',
  'preview-v25','preview-v26','preview-v28','preview-v29','preview-v30','preview-v31','preview-v34'
];

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

const rootNames=new Set(entries.map(x=>x.name));
for(const name of rootNames){
  if(/^tmp-.*marker/i.test(name))throw new Error(`Temporary marker must not live in repository root: ${name}`);
}

console.log(`[layout] ${ACTIVE_PREVIEW_DIRS.length} active frontend layers; ${ARCHIVED_PREVIEW_DIRS.length} archived layers; structure OK`);

export {ACTIVE_PREVIEW_DIRS,ARCHIVED_PREVIEW_DIRS};
