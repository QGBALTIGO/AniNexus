// Real public/member QA. Never votes or edits a member's data.
// Usage after deployment: node scripts/audit-predictions-live.mjs [expected-release-id]
import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';

const origin='https://aninexus.com.br';
const out='audit-artifacts/predictions-live';
const expectedRelease=process.argv[2]||null;
const results={startedAt:new Date().toISOString(),release:null,endRelease:null,records:[],blocked:[],failures:[],errors:[],checks:[]};
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch();
const release=async()=>{const response=await fetch(origin+'/release.json',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Release metadata HTTP '+response.status);return response.json();};
const loadedFonts=page=>page.evaluate(async()=>{await document.fonts.ready;await Promise.all([document.fonts.load('800 28px Manrope'),document.fonts.load('800 20px "Nunito Sans"')]);await document.fonts.ready;});
const setAppearance=async(page,theme,width)=>{await page.setViewportSize({width,height:900});await page.evaluate(value=>{localStorage.setItem('aninexus:theme',value);document.documentElement.dataset.theme=value;},theme);await loadedFonts(page);await expect(page.locator('html')).toHaveAttribute('data-theme',theme);};
const visibleAncestors=locator=>expect.poll(()=>locator.evaluate(el=>{for(let node=el;node;node=node.parentElement)if(Number(getComputedStyle(node).opacity)<.999)return false;return true;}),{message:'Home reveal transition must finish before visual evidence',timeout:5000}).toBe(true);

try{
  results.release=await release();
  if(expectedRelease)expect(results.release.releaseId||results.release.release||results.release.id).toBe(expectedRelease);
  for(const mode of ['public','member']){
    const context=await browser.newContext({...(mode==='member'?{storageState:'audit-artifacts/auth-state.json'}:{}),viewport:{width:390,height:900},locale:'pt-BR',colorScheme:'dark',serviceWorkers:'block'});
    await context.addInitScript(()=>{localStorage.setItem('aninexus:privacy:v1',JSON.stringify({analytics:false}));localStorage.setItem('aninexus:theme','dark');});
    // Session exchange is the only allowed non-read API operation. In particular,
    // vote, library, profile, notification-read and other business writes are blocked.
    await context.route(origin+'/api/**',route=>{
      const req=route.request(),pathname=new URL(req.url()).pathname;
      if(['GET','HEAD'].includes(req.method())||(req.method()==='POST'&&/^\/api\/auth\/(?:clerk|session)(?:\/|$)/.test(pathname)))return route.continue();
      results.blocked.push({mode,path:pathname,method:req.method()});
      return route.fulfill({status:409,json:{error:'AUDIT_READ_ONLY'}});
    });
    const page=await context.newPage();page.setDefaultTimeout(45000);
    page.on('pageerror',error=>results.errors.push({mode,message:error.message}));
    page.on('response',response=>{
      const u=new URL(response.url());
      if(u.origin===origin&&/^\/api\/(?:predictions|me\/predictions|me\/home|home)(?:\/|$)/.test(u.pathname)&&response.status()>=400)results.failures.push({mode,path:u.pathname,status:response.status()});
    });
    try{
      await page.goto(origin+'/previsoes',{waitUntil:'domcontentloaded'});
      await expect(page.locator('.nx61-predictions h1')).toHaveText('Previsões');
      await expect(page).toHaveTitle('Previsões | AniNexus');
      const loggedIn=await page.evaluate(async()=>Boolean(await window.AniNexusAuth?.getUser?.()));
      expect(loggedIn,mode==='member'?'Existing member session must still authenticate':'Public context must remain anonymous').toBe(mode==='member');
      const cards=page.locator('.nx61-predictions [data-prediction]');
      await expect(cards.first()).toBeVisible({timeout:60000});
      expect(await cards.count()).toBeGreaterThan(0);
      const first=cards.first();await first.getByText('Critérios e fontes',{exact:true}).click();
      await expect(first.locator('details')).toHaveAttribute('open','');
      await expect(first.locator('details')).toContainText('Brasília');
      expect((await first.locator('details>p').first().textContent()).trim().length).toBeGreaterThan(20);
      await expect(first.getByRole('link',{name:/Fonte: AniList/})).toHaveAttribute('href',/^https:\/\/anilist\.co\/(anime|manga)\/\d+$/);
      for(const theme of ['dark','light'])for(const width of [390,1440]){
        await setAppearance(page,theme,width);await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
        const metrics=await page.locator('.nx61-predictions').evaluate(host=>({cards:host.querySelectorAll('[data-prediction]').length,overflow:document.documentElement.scrollWidth-innerWidth,titleFont:getComputedStyle(host.querySelector('h1')).font,controls:host.querySelectorAll('[data-pred-vote]').length,criteriaOpen:!!host.querySelector('details[open]'),consensusReady:host.querySelectorAll('.nx61-pred-consensus').length}));
        expect(metrics.overflow).toBeLessThanOrEqual(2);
        await page.screenshot({path:`${out}/predictions-${mode}-${theme}-${width}.png`,animations:'disabled'});
        results.records.push({mode,route:'predictions',theme,width,...metrics});
      }
      if(mode==='member'){
        await page.getByRole('button',{name:'Meus palpites',exact:true}).click();
        await expect(page.locator('[data-pred-body] .nx61-pred-loading')).toHaveCount(0);
        await expect(page.locator('[data-pred-body]')).not.toContainText('Não foi possível carregar agora');
        await expect(page.locator('[data-pred-body]')).not.toContainText('Entre para acompanhar suas previsões');
        results.checks.push({mode,check:'private-list-read',ok:true});
      }
      await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
      await expect(page.locator('.nx35-hero')).toBeVisible();
      await expect(page.getByText('Hoje, no seu ritmo.',{exact:true})).toHaveCount(0);
      const embedded=page.locator('.nx35-home .nx61-pred-embed');await expect(embedded).toHaveCount(1,{timeout:60000});
      const position=await embedded.evaluate(el=>({withinCommunity:!!el.parentElement.querySelector('#nx35Community'),insideHero:!!el.closest('.nx35-hero'),afterAwards:!!(document.querySelector('#nx35Awards').compareDocumentPosition(el)&Node.DOCUMENT_POSITION_FOLLOWING)}));
      expect(position).toEqual({withinCommunity:true,insideHero:false,afterAwards:true});
      const shelf=page.locator('.nx61-personal-home');
      if(mode==='member'){
        await expect(shelf.locator('.nx61-continue-card').first()).toBeVisible({timeout:60000});
        expect(await shelf.evaluate(el=>({previous:!!el.previousElementSibling.querySelector('#nx47Characters'),next:!!el.nextElementSibling.querySelector('#nx35Awards')}))).toEqual({previous:true,next:true});
      }else await expect(shelf).toHaveCount(0);
      for(const theme of ['dark','light'])for(const width of [390,1440]){
        await setAppearance(page,theme,width);await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
        await page.screenshot({path:`${out}/home-${mode}-${theme}-${width}.png`,animations:'disabled'});
        await embedded.evaluate(el=>scrollTo({top:scrollY+el.getBoundingClientRect().top-100,behavior:'instant'}));
        await visibleAncestors(embedded);
        expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
        await page.screenshot({path:`${out}/home-predictions-${mode}-${theme}-${width}.png`,animations:'disabled'});
        if(mode==='member'){
          await shelf.scrollIntoViewIfNeeded();await visibleAncestors(shelf);
          await expect.poll(()=>shelf.locator('img').evaluateAll(images=>images.filter(img=>{const r=img.getBoundingClientRect();return r.right>0&&r.left<innerWidth&&r.bottom>0&&r.top<innerHeight;}).every(img=>img.complete)),{message:'Visible continuation covers must finish loading',timeout:15000}).toBe(true);
          const covers=await shelf.locator('.nx61-continue-card').evaluateAll(cards=>cards.filter(card=>{const r=card.getBoundingClientRect();return r.right>0&&r.left<innerWidth;}).map(card=>({title:card.querySelector('h3')?.textContent,imageLoaded:!!card.querySelector('img')?.naturalWidth,fallback:!!card.querySelector('.nx61-cover-fallback')})));
          results.checks.push({mode,check:'visible-continuation-covers',theme,width,covers,ok:covers.every(card=>card.imageLoaded||card.fallback)});
          expect(covers.every(card=>card.imageLoaded||card.fallback),'No blank or broken continuation cover').toBe(true);
          await page.screenshot({path:`${out}/continue-${theme}-${width}.png`,animations:'disabled'});
        }
        results.records.push({mode,route:'home',theme,width,predictions:await embedded.locator('[data-prediction]').count(),continue:await shelf.locator('.nx61-continue-card').count(),...position});
      }
      await expect(page.locator('.nx61-scroll-track')).toHaveCount(0);
      results.checks.push({mode,check:'public-and-home-render',ok:true});
    }catch(error){results.checks.push({mode,check:'live-qa',ok:false,message:error.message});await page.screenshot({path:`${out}/failure-${mode}.png`}).catch(()=>{});process.exitCode=1;}
    finally{await context.close();}
  }
  expect(results.blocked,'No business write should even be attempted').toEqual([]);
  expect(results.errors,'Unexpected browser runtime errors').toEqual([]);
  expect(results.failures,'Prediction/Home API failures').toEqual([]);
  results.endRelease=await release();expect(results.endRelease.commit).toBe(results.release.commit);
}catch(error){results.checks.push({check:'audit',ok:false,message:error.message});process.exitCode=1;}
finally{results.finishedAt=new Date().toISOString();await fs.writeFile(`${out}/results.json`,JSON.stringify(results,null,2));await browser.close();console.log(JSON.stringify(results));}

