// Adversarial browser pass. All API calls and remote images are isolated fixtures.
import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {widths,routes as routeMatrix} from './audit-manifest.mjs';
const args=Object.fromEntries(process.argv.slice(2).map(x=>x.replace(/^--/,'').split('=')));
const targets=['/','/animes/catalogo','/mangas','/light-novels','/animes/programacao','/animes/temporadas','/animes/onde-assistir','/animes/dublados','/animes/estudios','/listas-de-animes','/animes-em-alta','/anime/obra-20','/manga/obra-30013','/noticias','/noticias/nao-existe','/comunidade','/anime-awards','/conquistas','/u/qa_usuario','/login','/criar-conta','/minha-conta','/meus-animes','/meus-mangas','/admin'];
const states=(args.states||'500,404,empty,null,offline').split(','),out=`audit-artifacts/${args.run||'chaos'}`;
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch();
let tasks=(args.scope==='all'?routeMatrix.map(item=>item.route):targets).flatMap(route=>states.map(state=>({route,state})));
if(args['exclude-existing']){
  const done=JSON.parse(await fs.readFile(`audit-artifacts/${args['exclude-existing']}/summary.json`,'utf8'));
  const keys=new Set(done.filter(item=>!item.failure).map(item=>`${item.route}|${item.state}`));
  tasks=tasks.filter(item=>!keys.has(`${item.route}|${item.state}`));
}
if(args.routes)tasks=tasks.filter(t=>args.routes.split(',').includes(t.route));
const records=[];
async function worker(){
  while(tasks.length){
    const task=tasks.shift(),context=await browser.newContext({viewport:{width:390,height:844},locale:'pt-BR',serviceWorkers:'block'}),page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await context.addInitScript(()=>localStorage.setItem('aninexus:privacy:v1',JSON.stringify({analytics:false})));
    await context.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url()),remote=url.hostname!=='127.0.0.1';
      const data=url.pathname.startsWith('/api/')||remote&&request.resourceType()!=='image'&&request.resourceType()!=='font';
      if(!data&&!remote)return route.continue();
      if(request.resourceType()==='image')return route.abort('failed');
      if(task.state==='offline')return route.abort('internetdisconnected');
      if(task.state==='timeout')await new Promise(resolve=>setTimeout(resolve,22000));
      const status=['500','404'].includes(task.state)?Number(task.state):200;
      const body=task.state==='null'?'null':task.state==='empty'?(url.hostname==='graphql.anilist.co'?JSON.stringify({data:{Media:null,Page:{media:[],airingSchedules:[],pageInfo:{hasNextPage:false}}}}):JSON.stringify({items:[],results:[],data:[],pageInfo:{hasNextPage:false}})):JSON.stringify({error:'AUDIT_INTERNAL_DIAGNOSTIC',message:'AUDIT_INTERNAL_DIAGNOSTIC'});
      await route.fulfill({status,contentType:'application/json',body}).catch(()=>{});
    });
    try{
      await page.goto(`http://127.0.0.1:4174${task.route}`,{waitUntil:'domcontentloaded'});
      await page.waitForTimeout(task.state==='timeout'?19000:5200);
      const views=[];
      for(const width of widths){
        await page.setViewportSize({width,height:844});
        views.push(await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,appVisible:!!document.querySelector('#app')&&getComputedStyle(document.querySelector('#app')).visibility!=='hidden'})));
      }
      await page.setViewportSize({width:390,height:844});
      const content=await page.locator('#app').innerText();
      const h1=await page.locator('#app h1').allTextContents();
      const name=task.route==='/'?'home':task.route.slice(1).replaceAll('/','--'),screenshot=`${name}--${task.state}.png`;
      await page.screenshot({path:`${out}/${screenshot}`});
      const unresolvedLoading=/Carregando perfil|Organizando suas conquistas|Consultando catálogo|Consultando seleção|Carregando ranking/.test(content);
      const record={...task,h1,content:content.slice(0,2000),errors:[...new Set(errors)],views,screenshot,unresolvedLoading,diagnosticLeak:content.includes('AUDIT_INTERNAL_DIAGNOSTIC')};
      records.push(record);await fs.appendFile(`${out}/results.jsonl`,JSON.stringify(record)+'\n');
      console.log(JSON.stringify({...task,errors:record.errors,diagnosticLeak:record.diagnosticLeak,h1,textLength:content.length,overflow:views.filter(v=>v.scrollWidth>v.width+2).map(v=>v.width)}));
    }catch(error){const record={...task,failure:error.message,errors};records.push(record);await fs.appendFile(`${out}/results.jsonl`,JSON.stringify(record)+'\n');console.log(JSON.stringify(record))}
    finally{await context.close()}
  }
}
try{await Promise.all([worker(),worker()])}finally{await fs.writeFile(`${out}/summary.json`,JSON.stringify(records,null,2));await browser.close()}
if(records.some(x=>x.failure||x.errors?.length||x.diagnosticLeak||x.unresolvedLoading||(x.content||'').trim().length<20||x.views?.some(v=>!v.appVisible||v.scrollWidth>v.width+2)))process.exitCode=1;
