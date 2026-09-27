// Render the real identity-provider form with local AniNexus assets, without submitting credentials.
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
const out='audit-artifacts/real-auth-theme';
await fs.mkdir(out,{recursive:true});
const runtime=await (await fetch('https://aninexus.com.br/runtime-config.js')).text();
const browser=await chromium.launch(),context=await browser.newContext({viewport:{width:390,height:844},locale:'pt-BR',serviceWorkers:'block'});
await context.addInitScript(()=>{localStorage.setItem('aninexus:theme','light');localStorage.setItem('aninexus:privacy:v1',JSON.stringify({analytics:false}));});
await context.route('https://aninexus.com.br/**',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(!['GET','HEAD'].includes(request.method()))return route.fulfill({status:409,json:{error:'AUDIT_READ_ONLY'}});
  if(url.pathname==='/runtime-config.js')return route.fulfill({contentType:'application/javascript',body:runtime});
  if(/^\/(?:api|media)\//.test(url.pathname)||url.pathname==='/clerk-localization-ptbr.json')return route.continue();
  const response=await route.fetch({url:`http://127.0.0.1:4173${url.pathname}${url.search}`});return route.fulfill({response});
});
const page=await context.newPage(),errors=[],records=[],accessibility=[];page.on('pageerror',error=>errors.push(error.message));
try{
  for(const route of ['/login','/criar-conta']){
    await page.goto(`https://aninexus.com.br${route}`,{waitUntil:'domcontentloaded'});
    const input=page.locator('input[name="identifier"],input[name="emailAddress"]').first();
    await input.waitFor({state:'visible',timeout:30000});
    if(route==='/criar-conta'){
      await expect(page.getByText('Concordo com os', {exact:false})).toBeVisible();
      await expect(page.locator('#app')).not.toContainText('I agree');
    }
    await input.fill('qa-theme@example.invalid');
    const handle=await input.elementHandle();
    for(const theme of ['light','dark','light']){
      await page.evaluate(value=>{localStorage.setItem('aninexus:theme',value);document.documentElement.dataset.theme=value;},theme);
      await expect(input).toHaveValue('qa-theme@example.invalid');
      const sameNode=await input.evaluate((element,original)=>element===original,handle);
      if(!sameNode)throw new Error('Theme change remounted the identity form');
      for(const width of [320,390,1440]){
        await page.setViewportSize({width,height:width<768?844:900});
        await page.waitForTimeout(200);
        const metrics=await input.evaluate(element=>({color:getComputedStyle(element).color,background:getComputedStyle(element).backgroundColor,overflow:document.documentElement.scrollWidth-innerWidth}));
        if(metrics.overflow>2)throw new Error(`Auth overflow ${route} ${theme} ${width}`);
        await page.screenshot({path:`${out}/${route.slice(1)}-${theme}-${width}.png`,fullPage:true});
        records.push({route,theme,width,sameNode,...metrics});
        if(width===390){const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();accessibility.push({route,theme,violations:results.violations.filter(item=>['serious','critical'].includes(item.impact))});}
      }
    }
  }
}finally{
  await fs.writeFile(`${out}/results.json`,JSON.stringify({records,errors,accessibility},null,2));await browser.close();
}
console.log(JSON.stringify({count:records.length,errors,accessibility:accessibility.map(({route,theme,violations})=>({route,theme,violations:violations.map(item=>({id:item.id,nodes:item.nodes.map(node=>({target:node.target,summary:node.failureSummary}))}))}))}));
