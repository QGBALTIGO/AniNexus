// Browser lab observations, not field Core Web Vitals or a mobile-device certification.
import fs from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
import {routes} from './audit-manifest.mjs';
const preview=process.env.AUDIT_PREVIEW==='1',out=`audit-artifacts/${process.env.AUDIT_RUN||'performance-final'}`;await fs.mkdir(out,{recursive:true});
const selectedPaths=process.env.AUDIT_ROUTES?.split(','),seen=new Set(),selected=routes.filter(r=>selectedPaths?selectedPaths.includes(r.route):!['alias','notfound'].includes(r.family)&&!seen.has(r.family)&&seen.add(r.family));
const browser=await chromium.launch(),records=[];
try{for(const width of [390,1440])for(const item of selected){
  const context=await browser.newContext({viewport:{width,height:900},locale:'pt-BR',serviceWorkers:'block'}),page=await context.newPage();
  const errors=[],network=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)network.push({path:new URL(r.url()).pathname,status:r.status()})});
  if(preview)await context.route(/https:\/\/aninexus\.com\.br\/preview-v\d+\/.*\.(?:css|js)(?:\?.*)?$/,async route=>{
    const url=new URL(route.request().url()),response=await route.fetch({url:'http://127.0.0.1:4173'+url.pathname+url.search});return route.fulfill({response});
  });
  await context.route('https://aninexus.com.br/api/**',route=>['GET','HEAD'].includes(route.request().method())?route.continue():route.fulfill({status:409,json:{error:'AUDIT_READ_ONLY'}}));
  await page.addInitScript(()=>{
    localStorage.setItem('aninexus:privacy:v1',JSON.stringify({analytics:false}));localStorage.setItem('aninexus:theme','dark');
    window.__auditPerf={lcp:null,shifts:[],interactions:[],longTasks:[]};
    const observe=(type,fn,options={})=>{if(PerformanceObserver.supportedEntryTypes.includes(type))new PerformanceObserver(list=>list.getEntries().forEach(fn)).observe({type,buffered:true,...options})};
    observe('largest-contentful-paint',e=>window.__auditPerf.lcp={ms:e.startTime,element:e.element?.tagName,className:e.element?.className});
    observe('layout-shift',e=>{if(!e.hadRecentInput)window.__auditPerf.shifts.push({at:e.startTime,value:e.value,sources:e.sources?.map(s=>({tag:s.node?.tagName,className:s.node?.className}))})});
    observe('event',e=>{if(e.interactionId)window.__auditPerf.interactions.push({name:e.name,duration:e.duration})},{durationThreshold:16});
    observe('longtask',e=>window.__auditPerf.longTasks.push({at:e.startTime,duration:e.duration}));
  });
  try{
    await page.goto('https://aninexus.com.br'+item.route,{waitUntil:'domcontentloaded',timeout:30000});
    await expect(page.locator('#app')).toBeVisible({timeout:20000});
    await page.waitForTimeout(6500);
    const search=page.locator('#topbar [data-action="search"]');await search.click();await page.locator('#searchInput').fill('Naruto');await page.waitForTimeout(600);await page.keyboard.press('Escape');
    const metrics=await page.evaluate(()=>{
      const p=window.__auditPerf,n=performance.getEntriesByType('navigation')[0],resources=performance.getEntriesByType('resource');
      let cls=0,total=0,start=0,last=0;for(const s of p.shifts){if(s.at-last>1000||s.at-start>5000){total=0;start=s.at}total+=s.value;last=s.at;cls=Math.max(cls,total)}
      const fonts=[...document.fonts].map(f=>({family:f.family,status:f.status,display:f.display}));
      const visible=[...document.querySelectorAll('#app h1,#app h2,#app p,#app button,#topbar a')].filter(el=>el.getClientRects().length).slice(0,160);
      const typography=visible.map(el=>{const s=getComputedStyle(el);return{tag:el.tagName,className:typeof el.className==='string'?el.className:'',family:s.fontFamily,size:s.fontSize,weight:s.fontWeight,lineHeight:s.lineHeight}});
      return{ttfbMs:n.responseStart-n.startTime,lcp:p.lcp,cls,largestObservedInteractionMs:Math.max(0,...p.interactions.map(x=>x.duration)),longTasks:p.longTasks,layoutShifts:p.shifts,domNodes:document.querySelectorAll('*').length,resourceCount:resources.length,knownTransferBytes:resources.reduce((sum,x)=>sum+x.transferSize,0),slowResources:resources.filter(x=>x.duration>1500).map(x=>({path:new URL(x.name).pathname,ms:Math.round(x.duration),kind:x.initiatorType})),fonts,typography};
    });
    records.push({route:item.route,family:item.family,width,metrics,errors,network});
    console.log(JSON.stringify({route:item.route,width,ttfb:Math.round(metrics.ttfbMs),lcp:Math.round(metrics.lcp?.ms||0),cls:metrics.cls,interaction:metrics.largestObservedInteractionMs,errors:errors.length}));
  }catch(error){records.push({route:item.route,width,failure:error.message,errors,network});console.log(JSON.stringify({route:item.route,width,failure:error.message}))}
  finally{await context.close();await fs.writeFile(`${out}/results.json`,JSON.stringify({method:'Fresh Chromium contexts, no CPU/network throttling, 6.5-second observation then search interaction; interaction duration is not field INP.',records},null,2))}
}}finally{await browser.close()}
