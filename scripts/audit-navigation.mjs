// Read-only route traversal with real public data. Records failures; never treats screenshots as a pass.
import fs from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
import {routes} from './audit-manifest.mjs';
const origin=process.env.AUDIT_ORIGIN||'http://127.0.0.1:4173';
const options=Object.fromEntries(process.argv.slice(2).map(arg=>arg.replace(/^--/,'').split('=')));
const selected=options.routes?routes.filter(item=>options.routes.split(',').includes(item.route)||options.routes.split(',').includes(item.family)):routes;
const out=`audit-artifacts/${options.run||'navigation-adversarial'}`;await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch(),context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',serviceWorkers:'block',locale:'pt-BR'});
await context.addInitScript(()=>{localStorage.setItem('aninexus:privacy:v1',JSON.stringify({analytics:false}));localStorage.setItem('aninexus:theme','light');});
await context.route(`${origin}/api/**`,route=>['GET','HEAD'].includes(route.request().method())?route.continue():route.fulfill({status:409,json:{error:'AUDIT_READ_ONLY'}}));
const page=await context.newPage(),records=[];let errors=[];page.on('pageerror',error=>errors.push(error.message));
const ready=async()=>{
  await expect(page.locator('#app')).toBeVisible({timeout:20000});
  await expect.poll(()=>page.locator('#app').innerText(),{timeout:20000}).not.toMatch(/^\s*$/);
  await page.waitForFunction(()=>!document.querySelector('.nx22-loading'),null,{timeout:20000});
  await page.waitForFunction(()=>!document.querySelector('.nx54-admin-loading'),null,{timeout:20000});
};
try{
  for(const item of selected){
    errors=[];const record={route:item.route,checks:[],errors:[]};
    try{
      await page.setViewportSize({width:390,height:844});
      await page.goto(origin+item.route,{waitUntil:'domcontentloaded'});await ready();
      const canonical=new URL(page.url()).pathname+new URL(page.url()).search;
      record.canonical=canonical;record.checks.push('cold-entry');
      await page.reload({waitUntil:'domcontentloaded'});await ready();
      expect(new URL(page.url()).pathname+new URL(page.url()).search).toBe(canonical);record.checks.push('reload');
      const search=page.locator('#topbar [data-action="search"]');await search.focus();await page.keyboard.press('Enter');
      await expect(page.locator('#searchInput')).toBeFocused();await page.keyboard.press('Escape');
      await expect(page.locator('#searchOverlay')).toBeHidden();await expect(search).toBeFocused();record.checks.push('keyboard-search-return');
      const destination=canonical==='/'?'/quem-somos':'/';
      const link=page.locator(`a[href="${destination}"]`).first();
      await link.click();await ready();await expect.poll(()=>new URL(page.url()).pathname).toBe(destination);
      await page.goBack();await ready();expect(new URL(page.url()).pathname+new URL(page.url()).search).toBe(canonical);record.checks.push('back');
      await page.goForward();await ready();expect(new URL(page.url()).pathname).toBe(destination);record.checks.push('forward');
      await page.goBack();await ready();
      for(const size of [{width:844,height:390},{width:640,height:450},{width:320,height:568}]){
        await page.setViewportSize(size);await page.waitForTimeout(100);
        expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
        await expect(page.locator('#topbar [data-action="search"]')).toBeVisible();
      }
      record.checks.push('landscape','reflow-640','narrow-320','reduced-motion');
      await page.screenshot({path:`${out}/${item.id}.png`});
      if(errors.length)throw new Error(errors.join('; '));
    }catch(error){record.failure=error.message;await page.screenshot({path:`${out}/${item.id}-failure.png`}).catch(()=>{});}
    record.errors=[...errors];records.push(record);await fs.appendFile(`${out}/results.jsonl`,JSON.stringify(record)+'\n');console.log(JSON.stringify(record));
  }
}finally{await fs.writeFile(`${out}/summary.json`,JSON.stringify({records},null,2));await browser.close();}
if(records.some(item=>item.failure))process.exitCode=1;
