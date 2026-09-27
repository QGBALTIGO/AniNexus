// Real member, read-only. Preview swaps only the four assets in this hotfix.
import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const preview=process.env.AUDIT_PREVIEW==='1';
const out=`audit-artifacts/home-restoration-${preview?'preview':'live'}`;
await fs.mkdir(out,{recursive:true});
const assets=new Set(['/preview-v44/personal-home-v61.js','/preview-v44/personal-home-v61.css','/preview-v44/rails-v44.js','/preview-v44/consistency-v61.css']);
const browser=await chromium.launch();
const context=await browser.newContext({storageState:'audit-artifacts/auth-state.json',viewport:{width:390,height:844},locale:'pt-BR',serviceWorkers:'block'});
const blocked=[],failures=[],errors=[],records=[];
await context.addInitScript(()=>localStorage.setItem('aninexus:privacy:v1',JSON.stringify({analytics:false})));
if(preview)await context.route('https://aninexus.com.br/preview-v44/**',async route=>{
  const url=new URL(route.request().url());
  if(!assets.has(url.pathname))return route.continue();
  const response=await route.fetch({url:'http://127.0.0.1:4173'+url.pathname});return route.fulfill({response});
});
await context.route('https://aninexus.com.br/api/**',route=>{
  const req=route.request(),path=new URL(req.url()).pathname;
  if(['GET','HEAD'].includes(req.method())||/^\/api\/auth\/(clerk|session)/.test(path))return route.continue();
  blocked.push({path,method:req.method()});return route.fulfill({status:409,json:{error:'AUDIT_READ_ONLY'}});
});
const page=await context.newPage();
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.url().includes('/api/home')&&r.status()>=400)failures.push({path:new URL(r.url()).pathname,status:r.status()})});
try{
  await page.goto('https://aninexus.com.br/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#nx35Season .nx35-anime').first()).toBeVisible({timeout:25000});
  const shelf=page.locator('.nx61-personal-home');
  await expect(shelf.locator('.nx61-continue-card').first()).toBeVisible({timeout:25000});
  await expect(page.getByText('Hoje, no seu ritmo.',{exact:true})).toHaveCount(0);
  await expect(page.locator('.nx61-scroll-track')).toHaveCount(0);
  expect(await shelf.evaluate(el=>({previous:!!el.previousElementSibling.querySelector('#nx47Characters'),next:!!el.nextElementSibling.querySelector('#nx35Awards')}))).toEqual({previous:true,next:true});
  for(const theme of ['dark','light'])for(const width of [390,1440]){
    await page.setViewportSize({width,height:900});
    await page.evaluate(t=>{localStorage.setItem('aninexus:theme',t);document.documentElement.dataset.theme=t;},theme);
    await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
    await expect(page.locator('.nx35-hero')).toBeVisible();
    await page.screenshot({path:`${out}/home-${theme}-${width}.png`});
    await shelf.scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>[...document.querySelectorAll('.nx61-personal-home img')].every(img=>{const b=img.getBoundingClientRect();return b.left>=innerWidth||b.right<=0||b.top>=innerHeight||b.bottom<=0||img.complete;}));
    const metrics=await shelf.evaluate(el=>({count:el.querySelectorAll('.nx61-continue-card').length,covers:[...el.querySelectorAll('img')].filter(img=>img.naturalWidth>0).length,overflow:document.documentElement.scrollWidth-innerWidth,poster:el.querySelector('.nx35-cover').getBoundingClientRect().width,peer:document.querySelector('#nx35Season .nx35-cover').getBoundingClientRect().width}));
    expect(metrics.overflow).toBeLessThanOrEqual(2);expect(Math.abs(metrics.poster-metrics.peer)).toBeLessThanOrEqual(1);
    await page.screenshot({path:`${out}/continue-${theme}-${width}.png`});
    records.push({theme,width,...metrics});
  }
  expect(blocked).toEqual([]);expect(errors).toEqual([]);expect(failures).toEqual([]);
  console.log(JSON.stringify({preview,records,season:await page.locator('#nx35Season .nx35-anime').count(),schedule:await page.locator('#nx35Schedule .nx18-card').count(),blocked,failures,errors}));
}finally{await fs.writeFile(`${out}/results.json`,JSON.stringify({preview,records,blocked,failures,errors},null,2));await browser.close();}
