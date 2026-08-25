import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root=path.resolve(process.argv[2]||'public');
const errors=[];
const required=['index.html','.nojekyll','assets/favicon.png','assets/logo.png'];

const exists=async file=>fs.access(path.join(root,file)).then(()=>true).catch(()=>false);
for(const file of required)if(!(await exists(file)))errors.push(`arquivo obrigatório ausente: ${file}`);

async function walk(dir){
  const files=[];
  for(const entry of await fs.readdir(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())files.push(...await walk(full));
    else if(entry.isFile())files.push(full);
  }
  return files;
}

function balancedCss(source,file){
  let depth=0,quote='',comment=false;
  for(let i=0;i<source.length;i++){
    const ch=source[i],next=source[i+1];
    if(comment){if(ch==='*'&&next==='/'){comment=false;i++}continue}
    if(quote){if(ch==='\\'){i++;continue}if(ch===quote)quote='';continue}
    if(ch==='/'&&next==='*'){comment=true;i++;continue}
    if(ch==='"'||ch==="'"){quote=ch;continue}
    if(ch==='{')depth++;
    if(ch==='}'&&--depth<0){errors.push(`CSS com chave excedente: ${file}`);return}
  }
  if(comment)errors.push(`CSS com comentário não encerrado: ${file}`);
  if(quote)errors.push(`CSS com string não encerrada: ${file}`);
  if(depth)errors.push(`CSS com chaves desequilibradas: ${file}`);
}

function localReference(value){
  const ref=value.trim();
  if(!ref||ref.startsWith('#')||ref.startsWith('//')||/^(?:data|https?|mailto|tel):/i.test(ref))return null;
  const clean=decodeURIComponent(ref.split(/[?#]/,1)[0]).replace(/^\.\//,'').replace(/^\//,'');
  if(!clean||!path.posix.extname(clean))return null;
  const normalized=path.posix.normalize(clean);
  if(normalized==='..'||normalized.startsWith('../'))return {error:`referência fora do artefato: ${ref}`};
  return {file:normalized};
}

if(await exists('index.html')){
  const html=await fs.readFile(path.join(root,'index.html'),'utf8');
  for(const marker of ['<!doctype html','<html','<head','<body','<meta name="aninexus-build"','</html>']){
    if(!html.toLowerCase().includes(marker))errors.push(`index.html sem ${marker}`);
  }
  if(!html.includes('<base href="/">'))errors.push('index.html de produção sem base absoluta /');
  for(const match of html.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)){
    const ref=localReference(match[1]);
    if(ref?.error)errors.push(ref.error);
    else if(ref?.file&&!(await exists(ref.file)))errors.push(`referência local ausente: ${ref.file}`);
  }
}

const files=await walk(root);
for(const file of files){
  const relative=path.relative(root,file).replaceAll(path.sep,'/');
  const size=(await fs.stat(file)).size;
  if(size===0&&!relative.endsWith('.nojekyll'))errors.push(`arquivo vazio: ${relative}`);
  if(relative.endsWith('.js')){
    const checked=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
    if(checked.status!==0)errors.push(`JavaScript inválido: ${relative}\n${checked.stderr.trim()}`);
  }
  if(relative.endsWith('.css'))balancedCss(await fs.readFile(file,'utf8'),relative);
}

if(errors.length){
  console.error(`Validação do artefato falhou (${errors.length}):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

console.log(`Artefato estático válido: ${files.length} arquivos verificados em ${root}`);
