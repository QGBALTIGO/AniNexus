import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {readFileSync} from 'node:fs';

const origin=process.env.ANINEXUS_E2E_ORIGIN||'http://127.0.0.1:4173/';
const localStaticOrigin=process.env.ANINEXUS_LOCAL_STATIC_ORIGIN||'';
const url=path=>`${origin}?p=${encodeURIComponent(path)}`;
const cover='https://s4.anilist.co/community-test.png';
const image=readFileSync(new URL('../assets/avatars/mascot-pink.png',import.meta.url));
const works=Array.from({length:6},(_,i)=>({id:101+i,mediaType:i===0?'MANGA':'ANIME',title:`Obra ${i+1}`,cover,count:12-i}));
const fixture={totals:{works:1200,reactions:75,completed:42,impressions:18,ratings:36},distribution:[{label:'Amei',count:40},{label:'Chorei',count:35}],rankings:['Chorei','Amei','Esperava mais','Final incrível','Pesado demais','Que arte!'].flatMap(label=>works.map((m,i)=>({...m,label,rank:i+1}))),favorites:works,dropped:[{...works[0],dropped:2,completed:8}],studios:[{name:'Studio A',count:12}],activeMembers:[{username:'alice',display_name:'Alice',count:12,days:7},{username:'bob',display_name:'Bob',count:30,days:30}],newMembers:[{username:'alice',display_name:'Alice'}],joinedToday:1};
test.use({contextOptions:{reducedMotion:'reduce'}});
async function setup(page){
  const state={fail:false,pending:false,overview:fixture};
  if(localStaticOrigin)await page.route(`${new URL(origin).origin}/**`,async route=>{
    const requested=new URL(route.request().url()),path=requested.pathname.replace(/^\/AniNexus(?=\/)/,'');
    for(let attempt=0;attempt<3;attempt++){
      try{const response=await route.fetch({url:new URL(path+requested.search,localStaticOrigin).href});return await route.fulfill({response})}
      catch(error){if(attempt===2||!/ECONNRESET|ECONNREFUSED|socket hang up/.test(String(error)))throw error;await new Promise(resolve=>setTimeout(resolve,100*(attempt+1)))}
    }
  });
  await page.route('**/runtime-config.js*',route=>route.fulfill({contentType:'application/javascript',body:`window.__ANINEXUS_CONFIG__=Object.freeze({environment:'test',siteOrigin:'https://qgbaltigo.github.io/AniNexus',apiOrigin:'https://graphql.anilist.co',clerkPublishableKey:'pk_test_community',authEnabled:true});`}));
  await page.route(cover,route=>route.fulfill({body:image,contentType:'image/png'}));
  await page.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/community/overview')return route.fulfill(state.fail?{status:503,json:{error:'TEMPORARY'}}:{json:state.overview});
    if(path==='/api/community/activity')return route.fulfill({json:{items:[{media_id:101,media_type:'MANGA',username:'alice',display_name:'Alice',status:'CURRENT',progress:3,reactions:['Amei','Que arte!'],media:{id:101,title:'Leitura em andamento',cover},created_at:new Date().toISOString()}]}});
    if(path==='/api/community/threads'&&route.request().method()==='POST')return route.fulfill({status:201,json:{ok:true}});
    return route.fulfill({json:{items:[],user:null}});
  });
  await page.route('https://graphql.anilist.co/',route=>route.fulfill({json:{data:{Media:{id:101,title:{english:'Obra 1'},type:'MANGA',format:'MANGA',coverImage:{large:cover},chapters:30,volumes:3},Page:{media:[],pageInfo:{hasNextPage:false}}}}}));
  await page.route('https://api.jikan.moe/**',route=>route.fulfill({json:{data:[]}}));
  return state;
}
const noOverflow=async page=>expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);

test('Community overview adapts the podium, counts and scroll guide across desktop and mobile',async({page},info)=>{
  await setup(page);
  for(const width of [1440,390,320]){
    await page.setViewportSize({width,height:900});await page.goto(url('/comunidade'));
    await expect(page.locator('#nx40Stats')).toContainText('1.200');
    await expect(page.locator('.nx40-podium .nx40-poster-card:visible')).toHaveCount(width>760?3:1);
    await expect(page.locator('.nx40-ranking-list .nx40-mini-media:visible')).toHaveCount(width>760?3:5);
    await expect(page.locator('#topbar')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
    await noOverflow(page);
    await page.screenshot({path:info.outputPath(`community-${width}.png`),fullPage:width===390});
    await page.evaluate(()=>scrollTo({top:600,behavior:'instant'}));
    await expect(page.locator('body')).toHaveClass(/nx40-scrolled/);
    const guide=page.locator('#nx40Guide');await expect(guide).toBeVisible();
    await guide.locator('button').click();await expect(page.locator('#nx40GuideLinks')).toBeVisible();
    await guide.locator('button').click();await expect(page.locator('#nx40GuideLinks')).toBeHidden();
    await noOverflow(page);
  }
});

test('Community uses shared reactions, typed reading actions and real member periods',async({page})=>{
  await setup(page);await page.goto(url('/comunidade'));
  await expect(page.locator('#nx40Members')).toContainText('Alice');
  await page.locator('[data-nx40-days="30"]').click();await expect(page.locator('#nx40Members')).toContainText('Bob');
  await expect(page.locator('#nx40Members')).not.toContainText('Alice');
  await page.locator('.nx40-more-reactions summary').click();
  await page.locator('[data-nx40-reaction="Que arte!"]').click();
  await expect(page.locator('#nx40ReactionTitle')).toContainText('Que arte!');
  const first=page.locator('.nx40-podium .nx40-poster-card').first(),heart=first.locator('[data-manga-fav]');
  await expect(heart).toHaveAttribute('data-nx-action-owner','global');
  await expect(heart).toHaveCSS('width','34px');await heart.click();await expect(heart).toHaveAttribute('aria-pressed','true');
  await expect(heart.locator('svg')).toHaveCount(1);
  await expect(first.locator('[data-manga-list] svg')).toHaveCount(1);
  expect(await page.evaluate(()=>window.AniNexusMediaState.isFavorite(101))).toBe(false);
  await first.locator('[data-manga-list]').click();const editor=page.locator('.nx20-media-layer');
  await expect(editor).toBeVisible();await expect(editor).toContainText('Lendo');await expect(editor).not.toContainText('Assistindo');
  await page.keyboard.press('Escape');await expect(editor).toHaveCount(0);
  await expect(page.locator('#nx40Feed')).toContainText('está lendo');await expect(page.locator('#nx40Feed').getByLabel('Que arte!',{exact:true})).toBeVisible();
});

test('Community unavailable overview can retry without fabricating totals or losing its feed',async({page})=>{
  const state=await setup(page);state.fail=true;await page.goto(url('/comunidade'));
  await expect(page.locator('#nx40OverviewNotice')).toContainText('indisponíveis');
  await expect(page.locator('#nx40Stats .nx40-stat b').first()).toHaveText('—');
  await expect(page.locator('#nx40Feed')).toContainText('Alice');
  state.fail=false;await page.locator('[data-nx40-retry]').click();await expect(page.locator('#nx40Stats')).toContainText('1.200');
  await page.locator('[data-nx40-new]').click();const form=page.locator('#nx40ThreadForm');
  await expect(form).toHaveAttribute('aria-modal','true');await expect(form.locator('input[name="title"]')).toBeFocused();
  await page.keyboard.press('Escape');await expect(page.locator('[data-nx40-new]')).toBeFocused();
  await noOverflow(page);
});

test('Community keeps text, reaction controls and surfaces readable in both themes',async({page})=>{
  await setup(page);
  await page.addInitScript(()=>localStorage.setItem('aninexus:privacy:v1',JSON.stringify({analytics:false,at:Date.now()})));
  await page.goto(url('/comunidade'));
  for(const theme of ['dark','light']){
    await page.evaluate(value=>localStorage.setItem('aninexus:theme',value),theme);
    for(const width of [1440,390]){
      await page.setViewportSize({width,height:900});await page.goto(url('/comunidade'));
      await expect(page.locator('#nx40Stats')).toContainText('1.200');
      await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
      await expect(page.locator('.nx40-main')).toHaveCSS('background-color',theme==='dark'?'rgb(16, 12, 20)':'rgb(255, 255, 255)');
      const results=await new AxeBuilder({page}).include('.nx40-community').withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
      expect(results.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([]);
      await noOverflow(page);
    }
  }
});

test('Community with few contributions does not stack empty statistics sections',async({page})=>{
  const state=await setup(page);
  state.overview={...fixture,rankings:fixture.rankings.filter(r=>r.label==='Amei'),dropped:[],studios:[],favorites:[]};
  await page.goto(url('/comunidade'));
  await expect(page.locator('#nx40Stats')).toContainText('1.200');
  await expect(page.locator('#nx40Comparisons')).toBeHidden();
  for(const id of ['nx40Dropped','nx40Studios','nx40Favorites'])await expect(page.locator('#'+id).locator('..')).toBeHidden();
  await expect(page.locator('#nx40Feed')).toContainText('Alice');
  await expect(page.locator('#nx40ReactionRanking')).toBeVisible();
});

test('Community leaves no conflicting page state after navigating away and returning',async({page})=>{
  await setup(page);await page.goto(url('/comunidade'));
  await expect(page.locator('#nx40Stats')).toContainText('1.200');
  await page.evaluate(()=>{history.pushState({},'','?p=/mangas');dispatchEvent(new PopStateEvent('popstate'))});
  await expect(page.locator('body')).not.toHaveClass(/nx40-community-active/);
  await expect(page.locator('html')).not.toHaveClass(/nx40-community-ready|nx40-community-boot/);
  await expect(page.locator('.nx21-catalog-page')).toBeVisible();
  await page.evaluate(()=>{history.pushState({},'','?p=/comunidade');dispatchEvent(new PopStateEvent('popstate'))});
  await expect(page.locator('.nx40-community')).toHaveCount(1);
  await expect(page.locator('#nx40Stats')).toContainText('1.200');
  await expect(page.locator('#nx40Feed')).toContainText('Alice');
  await expect(page.locator('#topbar')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  await noOverflow(page);
});
