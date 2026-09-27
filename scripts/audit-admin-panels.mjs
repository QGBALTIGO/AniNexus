// Authorized production read-only QA. Private session/evidence remain ignored.
import fs from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const preview=process.env.AUDIT_PREVIEW==='1';
const out=`audit-artifacts/${preview?'preview':'post-release'}-admin-panels`;
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch();
const context=await browser.newContext({storageState:'audit-artifacts/auth-state.json',viewport:{width:1440,height:900},locale:'pt-BR',serviceWorkers:'block'});
await context.addInitScript(()=>localStorage.setItem('aninexus:privacy:v1',JSON.stringify({analytics:false})));
const blocked=[];
if(preview)await context.route(/https:\/\/aninexus\.com\.br\/preview-v\d+\/.*\.(?:css|js)(?:\?.*)?$/,async route=>{
  const url=new URL(route.request().url());
  const response=await route.fetch({url:'http://127.0.0.1:4173'+url.pathname+url.search});
  return route.fulfill({response});
});
await context.route('https://aninexus.com.br/api/**',route=>{
  const req=route.request(),pathname=new URL(req.url()).pathname;
  if(['GET','HEAD'].includes(req.method())||/^\/api\/auth\/(clerk|session)/.test(pathname))return route.continue();
  blocked.push({pathname,method:req.method()});return route.fulfill({status:409,json:{error:'AUDIT_READ_ONLY'}});
});
const page=await context.newPage(),records=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto('https://aninexus.com.br/admin');
  await expect(page.locator('[data-admin-tab="audit"]')).toBeVisible({timeout:30000});
  for(const appearance of [{width:390,theme:'light'},{width:1440,theme:'dark'}]){
    await page.setViewportSize({width:appearance.width,height:900});
    if(await page.locator('html').getAttribute('data-theme')!==appearance.theme)await page.locator('#topbar [data-action="theme"]').click();
    for(const section of ['overview','reports','team','users','audit']){
      await page.locator(`[data-admin-tab="${section}"]`).click();
      await expect(page.locator(`[data-admin-tab="${section}"]`)).toHaveAttribute('aria-current','page');
      await expect(page.locator('[data-admin-workspace]')).not.toHaveAttribute('aria-busy','true');
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
      await page.screenshot({path:`${out}/${section}-${appearance.width}-${appearance.theme}.png`,fullPage:true});
      const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
      const violations=axe.violations.filter(x=>['serious','critical'].includes(x.impact)).map(x=>({id:x.id,nodes:x.nodes.map(n=>n.target)}));
      const record={section,...appearance,violations};records.push(record);console.log(JSON.stringify({...record,violations:violations.map(v=>({...v,nodes:v.nodes.slice(0,12)}))}));
    }
  }
}finally{await fs.writeFile(`${out}/results.json`,JSON.stringify({records,errors,blocked},null,2));await browser.close();}
if(records.some(x=>x.violations.length)||errors.length)process.exitCode=1;
