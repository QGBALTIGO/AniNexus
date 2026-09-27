// Git archive may apply core.autocrlf on Windows. Rehydrate tracked blobs directly.
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const ref=process.argv[2];
if(!ref)throw new Error('A Git release ref is required');
const commit=execFileSync('git',['rev-parse',ref],{encoding:'utf8'}).trim();
const root=path.resolve('audit-artifacts','api-release-'+commit.slice(0,12));
const files=execFileSync('git',['ls-tree','-r','--name-only',commit],{encoding:'utf8'}).trim().split('\n');
const checksums={};
for(const file of files){
  if(file.startsWith('/')||file.split('/').includes('..'))throw new Error('Unsafe Git path');
  const contents=execFileSync('git',['show',commit+':'+file],{maxBuffer:30*1024*1024});
  const target=path.join(root,file);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,contents);
  if(file.startsWith('sql/')&&file.endsWith('.sql'))checksums[path.basename(file)]=createHash('sha256').update(contents).digest('hex');
}
await fs.writeFile(path.join(root,'.release-sql-checksums.json'),JSON.stringify(checksums));
console.log(JSON.stringify({commit,root,files:files.length,sql:Object.keys(checksums).length}));

