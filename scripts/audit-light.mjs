import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const browser=await chromium.launch(),context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
await page.addInitScript(()=>localStorage.setItem('aninexus:privacy:v1',JSON.stringify({analytics:false})));
const results=[];
const routeArgs=process.argv.find(x=>x.startsWith('--routes='))?.slice(9);
if(process.argv.includes('--cold'))await page.addInitScript(()=>localStorage.setItem('aninexus:theme','light'));
for(const route of routeArgs?routeArgs.split(','):['/anime/naruto-20','/manga/one-piece-30013','/animes/programacao','/animes/temporadas','/noticias','/login','/termos-de-uso','/quem-somos','/comunidade','/animes/catalogo']){
  await page.goto(`http://127.0.0.1:4173${route}`);await page.waitForTimeout(1800);
  if(await page.locator('html').getAttribute('data-theme')!=='light'){
    await page.setViewportSize({width:1440,height:900});await page.locator('#topbar [data-action="theme"]').click();await page.setViewportSize({width:390,height:844});
  }
  const audit=await new AxeBuilder({page}).exclude('iframe').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  const violations=audit.violations.map(x=>({id:x.id,impact:x.impact,nodes:x.nodes.map(n=>({target:n.target,html:n.html,summary:n.failureSummary}))}));
  const colors=await page.locator('h1,.nx22-synopsis,.nx22-synopsis p,.site-footer,.site-footer .footer-brand,.nx38-auth-page,.nx18-schedule,.nx-season,.nx35-news-page').evaluateAll(nodes=>nodes.map(n=>({selector:n.className,tag:n.tagName,color:getComputedStyle(n).color,background:getComputedStyle(n).backgroundColor})));
  await fs.mkdir('audit-artifacts/light-preview',{recursive:true});
  await page.screenshot({path:`audit-artifacts/light-preview/${route.slice(1).replaceAll('/','--')}.png`,fullPage:true});
  results.push({route,violations,colors});console.log(JSON.stringify({route,violations:violations.map(x=>({id:x.id,nodes:x.nodes.length})),colors}));
}
await fs.writeFile(`audit-artifacts/${process.argv.includes('--cold')?'cold-':''}light-a11y.json`,JSON.stringify(results,null,2));await browser.close();
