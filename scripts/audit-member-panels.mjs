// Production member session, read-only: inspect dialogs; never save or submit.
import fs from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const preview=process.env.AUDIT_PREVIEW==='1';
const out=`audit-artifacts/${preview?'preview':'post-release'}-member-panels`;
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch();
const context=await browser.newContext({storageState:'audit-artifacts/auth-state.json',viewport:{width:390,height:900},locale:'pt-BR',serviceWorkers:'block'});
await context.addInitScript(()=>localStorage.setItem('aninexus:privacy:v1',JSON.stringify({analytics:false})));
if(preview)await context.route(/https:\/\/aninexus\.com\.br\/preview-v\d+\/.*\.(?:css|js)(?:\?.*)?$/,async route=>{
  const url=new URL(route.request().url());
  const response=await route.fetch({url:'http://127.0.0.1:4173'+url.pathname+url.search});
  return route.fulfill({response});
});
const blocked=[];
await context.route('https://aninexus.com.br/api/**',route=>{
  const req=route.request(),pathname=new URL(req.url()).pathname;
  if(['GET','HEAD'].includes(req.method())||/^\/api\/auth\/(clerk|session)/.test(pathname))return route.continue();
  blocked.push({pathname,method:req.method()});return route.fulfill({status:409,json:{error:'AUDIT_READ_ONLY'}});
});
const page=await context.newPage(),records=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
async function inspect(name,appearance,scope){
  const axe=new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']);
  if(scope)axe.include(scope);
  const result=await axe.analyze();
  const violations=result.violations.filter(x=>['serious','critical'].includes(x.impact)).map(x=>({id:x.id,nodes:x.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}));
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  await page.screenshot({path:`${out}/${name}-${appearance.width}-${appearance.theme}.png`,fullPage:true});
  const record={name,...appearance,violations,overflow};records.push(record);console.log(JSON.stringify(record));
}
try{
  for(const appearance of [{width:390,theme:'light'},{width:1440,theme:'dark'}]){
    await page.setViewportSize({width:appearance.width,height:900});
    await page.goto('https://aninexus.com.br/minha-conta');
    await expect(page.locator('[data-edit-profile]').first()).toBeVisible({timeout:30000});
    if(await page.locator('html').getAttribute('data-theme')!==appearance.theme)await page.locator('#topbar [data-action="theme"]').click();
    await inspect('account',appearance);
    await page.locator('[data-edit-profile]').first().click();
    for(const tab of ['profile','privacy','transfer']){
      await page.locator(`[data-settings-tab="${tab}"]`).click();
      await expect(page.locator(`[data-settings-panel="${tab}"]`)).toBeVisible();
      await inspect('settings-'+tab,appearance,'.nx38pe-layer');
      await page.locator('.nx38pe-panels').evaluate(el=>el.scrollTop=el.scrollHeight);
      await inspect('settings-'+tab+'-bottom',appearance,'.nx38pe-layer');
    }
    await page.keyboard.press('Escape');
    const notifications=page.locator('#topbar [data-action="notifications"]');
    await notifications.click();
    await expect(page.locator('#notificationPanel')).toBeVisible();
    await page.waitForTimeout(350);
    await inspect('notification-drawer',appearance,'#notificationPanel');
    await page.locator('.nx43-notification-sheet').getByRole('button',{name:'Fechar notificações'}).click();
    await page.goto('https://aninexus.com.br/minha-biblioteca');
    await expect(page.locator('.nx49-media-card').first()).toBeVisible({timeout:30000});
    await inspect('library',appearance);
    await page.locator('[data-nx49-filter-open]').click();
    await expect(page.locator('.nx49-filter-dialog')).toBeVisible();
    await inspect('library-filter',appearance,'.nx49-filter-dialog');
    await page.keyboard.press('Escape');
  }
}finally{await fs.writeFile(`${out}/results.json`,JSON.stringify({records,errors,blocked},null,2));await browser.close();}
if(records.some(x=>x.violations.length||x.overflow>2)||errors.length)process.exitCode=1;
