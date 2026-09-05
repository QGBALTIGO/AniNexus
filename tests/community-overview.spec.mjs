import {test,expect,devices} from '@playwright/test';
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
test.afterEach(async({page})=>{await page.unrouteAll({behavior:'ignoreErrors'})});
async function setup(page){
  const state={fail:false,pending:false,overview:fixture,impressions:[],threadRequests:0,activity:[{media_id:101,media_type:'MANGA',username:'alice',display_name:'Alice',status:'CURRENT',progress:3,reactions:['Amei','Que arte!'],media:{id:101,title:'Leitura em andamento',cover},created_at:new Date().toISOString()}]};
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
    if(path==='/api/community/activity')return route.fulfill({json:{items:state.activity}});
    if(path==='/api/community/impressions')return route.fulfill({json:{items:state.impressions}});
    if(path==='/api/community/threads')state.threadRequests++;
    return route.fulfill({json:{items:[],user:null}});
  });
  await page.route('https://graphql.anilist.co/',route=>route.fulfill({json:{data:{Media:{id:101,title:{english:'Obra 1'},type:'MANGA',format:'MANGA',coverImage:{large:cover},chapters:30,volumes:3},Page:{media:[],pageInfo:{hasNextPage:false}}}}}));
  await page.route('https://api.jikan.moe/**',route=>route.fulfill({json:{data:[]}}));
  return state;
}
const noOverflow=async page=>expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);

test('Home previews merge duplicate snapshots without mixing members or anime and manga',async({page})=>{
  const state=await setup(page),now=Date.now();
  const entry={media_id:101,media_type:'ANIME',username:'alice',display_name:'Alice',status:'PAUSED',title:'Anime em pausa',cover,created_at:new Date(now).toISOString()};
  state.activity=[entry,{...entry,username:'bob',display_name:'Bob'},state.activity[0],{...entry,media_id:999,title:'Título temporariamente indisponível',cover:''}];
  await page.addInitScript(entry=>localStorage.setItem('aninexus:community:activity:v40',JSON.stringify([{...entry,id:'local-copy'},{...entry,id:'old-copy',status:'CURRENT',created_at:new Date(Date.parse(entry.created_at)-60000).toISOString()}])),entry);
  await page.goto(url('/'));
  for(const id of ['#nx35CommunityHero','#nx35Community']){
    const root=page.locator(id);await expect(root.locator('.nx35-community-card')).toHaveCount(3);
    await expect(root).not.toContainText('indisponível');await expect(root).toContainText('Bob');
    await expect(root.locator('[data-media-type=ANIME][data-status=PAUSED]')).toHaveCount(2);
    const reading=root.locator('[data-media-type=MANGA]');await expect(reading).toContainText('está lendo');
    await expect(reading).toContainText('Cap. 3');await expect(reading).not.toContainText('Episódio');
    await expect(reading.locator('strong a')).toHaveAttribute('href',/manga/);
    await expect(reading.getByLabel('Que arte!',{exact:true})).toBeVisible();
    await expect(root.locator('.nx35-community-status svg')).toHaveCount(3);
  }
  await noOverflow(page);
});

test('Local reading activity preserves volumes and multiple reactions independently of anime',async({page})=>{
  await setup(page);await page.goto(url('/'));
  await expect(page.locator('#nx35CommunityHero .nx35-community-card')).toHaveCount(1);
  const result=await page.evaluate(()=>{
    const state={status:'CURRENT',progress:5,volumeProgress:2,reactions:['Amei','Que arte!'],updatedAt:Date.now()};
    document.dispatchEvent(new CustomEvent('aninexus:manga-media-state-changed',{detail:{id:101,state}}));
    document.dispatchEvent(new CustomEvent('aninexus:media-state-changed',{detail:{id:101,state:{...state,volumeProgress:0}}}));
    return window.AniNexusCommunityActivity.local().filter(x=>x.local);
  });
  expect(result).toHaveLength(2);
  expect(result.find(x=>x.media_type==='MANGA')).toMatchObject({progress:5,volume_progress:2,reactions:['Amei','Que arte!']});
  expect(result.find(x=>x.media_type==='ANIME')).toMatchObject({progress:5,volume_progress:0});
  await expect(page.locator('#nx35CommunityHero')).toContainText('Vol. 2');
});

test('Both Home community previews keep readable covers, type and status colors in both themes',async({page},info)=>{
  test.setTimeout(120000);
  await setup(page);await page.addInitScript(()=>localStorage.setItem('aninexus:privacy:v1',JSON.stringify({analytics:false,at:Date.now()})));
  await page.goto(url('/'));
  for(const theme of ['dark','light']){
    await page.evaluate(value=>localStorage.setItem('aninexus:theme',value),theme);
    for(const width of [1440,390,320]){
      await page.setViewportSize({width,height:900});await page.goto(url('/'));
      await expect(page.locator('#nx35CommunityHero .nx35-community-card')).toHaveCount(1);
      for(const id of ['#nx35CommunityHero','#nx35Community']){
        const root=page.locator(id),card=root.locator('.nx35-community-card').first();
        await root.scrollIntoViewIfNeeded();
        await expect(card.locator('.nx35-community-cover>a>img')).toBeVisible();
        await expect.poll(()=>card.locator('.nx35-community-cover>a>img').evaluate(img=>img.naturalWidth)).toBeGreaterThan(0);
        expect(await card.evaluate(el=>getComputedStyle(el,'::before').display)).toBe('none');
        expect(await card.locator('p').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(12);
        const framed=id==='#nx35Community'?card:page.locator('.nx35-live');
        await expect(framed).toHaveCSS('border-radius','8px');
        for(const side of ['top','right','bottom','left'])await expect(framed).toHaveCSS(`border-${side}-width`,'1px');
        await expect(card.locator('.nx35-community-status')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
        await root.screenshot({path:info.outputPath(`home-${id.slice(1)}-${theme}-${width}.png`)});
      }
      const results=await new AxeBuilder({page}).include('.nx35-live').include('#nx35Community').withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
      expect(results.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([]);
      await noOverflow(page);
    }
  }
});

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
  await expect(page.locator('#nx40Members')).toContainText('@alice');
  await page.locator('[data-nx40-days="30"]').click();await expect(page.locator('#nx40Members')).toContainText('@bob');
  await expect(page.locator('#nx40Members')).not.toContainText('@alice');
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
  await expect(page.locator('#nx40Feed')).toContainText('@alice');
  state.fail=false;await page.locator('[data-nx40-retry]').click();await expect(page.locator('#nx40Stats')).toContainText('1.200');
  await expect(page.getByRole('button',{name:'Nova discussão'})).toHaveCount(0);
  await expect(page.locator('#nx40ThreadModal,.nx40-tabs')).toHaveCount(0);
  expect(state.threadRequests).toBe(0);
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
      await expect(page.locator('#nx40Ranking')).toHaveCSS('background-color',theme==='dark'?'rgb(24, 18, 22)':'rgb(255, 255, 255)');
      for(const selector of ['#nx40Ranking','.nx40-tool:has(#nx40Members)','.nx40-stat','#nx40Feed .nx40-card']){
        const card=page.locator(selector).first();
        await expect(card).toHaveCSS('border-radius','8px');
        for(const side of ['top','right','bottom','left'])await expect(card).toHaveCSS(`border-${side}-width`,'1px');
      }
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
  await expect(page.locator('#nx40Feed')).toContainText('@alice');
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
  await expect(page.locator('#nx40Feed')).toContainText('@alice');
  await expect(page.locator('#topbar')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  await noOverflow(page);
});

test('Touch layouts keep portrait avatars, reactions and the guide circular',async({browser,browserName},info)=>{
  const {defaultBrowserType,...device}=devices['iPhone 13'];
  const context=await browser.newContext({...device,isMobile:browserName==='firefox'?false:device.isMobile,reducedMotion:'reduce'});
  const page=await context.newPage();
  try{
    const state=await setup(page),portrait='https://s4.anilist.co/portrait-avatar.png';
    // A tall raster catches intrinsic image sizing as well as coarse-pointer minima.
    const bytes=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=40;c.height=120;const ctx=c.getContext('2d');ctx.fillStyle='#1a9b9f';ctx.fillRect(0,0,40,120);ctx.fillStyle='#f8d080';ctx.fillRect(8,24,24,36);return c.toDataURL().split(',')[1]});
    await page.route(portrait,route=>route.fulfill({body:Buffer.from(bytes,'base64'),contentType:'image/png'}));
    state.overview={...fixture,activeMembers:fixture.activeMembers.map(m=>({...m,avatar_url:portrait,count:1})),newMembers:[{username:'alice',display_name:'Alice',avatar_url:portrait}]};
    state.activity=state.activity.map(x=>({...x,avatar_url:portrait,reactions:['LOVE','Que arte!','Uma reação antiga sem equivalente']}));
    await page.goto(url('/comunidade'));
    await expect(page.locator('#nx40Feed .nx40-card')).toHaveCount(1);
    await expect(page.locator('#nx40Members')).toContainText('1 atividade');
    await expect(page.locator('#nx40Members')).not.toContainText('1 atividades');
    await expect(page.locator('#nx40NewMembers')).toContainText('+1 entrou hoje');
    for(const selector of ['#nx40Members .nx40-avatar','#nx40NewMembers .nx40-avatar','#nx40Feed .nx40-avatar','#nx40Feed .nx40-reaction-marks>span']){
      for(const element of await page.locator(selector).all()){
        await element.scrollIntoViewIfNeeded();
        const box=await element.boundingBox();expect(Math.abs(box.width-box.height)).toBeLessThan(0.5);
        const img=element.locator('img');
        if(await img.count()){await expect.poll(()=>img.evaluate(el=>el.naturalHeight)).toBe(120);const bounds=await img.boundingBox();expect(Math.abs(bounds.width-bounds.height)).toBeLessThan(0.5)}
        expect(await element.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
      }
    }
    await page.locator('#nx40Members').scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('touch-members.png')});
    const button=page.locator('[data-nx40-guide]');await expect(button).toBeVisible();
    await expect(button).toHaveCSS('width','40px');await expect(button).toHaveCSS('height','40px');
    await button.click();await expect(page.locator('#nx40GuideLinks')).toBeVisible();
    await page.locator('#nx40Feed').scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('touch-activity.png')});
    await noOverflow(page);
  }finally{await page.unrouteAll({behavior:'ignoreErrors'});await context.close()}
});

test('Community separates impressions, expands activity and never exposes discussions or unresolved cards',async({page})=>{
  const state=await setup(page),now=Date.now(),entry=state.activity[0];
  state.activity=Array.from({length:9},(_,i)=>({...entry,media_id:101+i,created_at:new Date(now-i*60000).toISOString()}));
  state.activity.push({...entry,created_at:new Date(now-999999).toISOString()},{...entry,media_id:999,media:null,title:'Título temporariamente indisponível',cover:''});
  state.impressions=[{...entry,id:'impression-a',body:'Uma leitura que vale cada capítulo.'},{...entry,id:'impression-b',body:'Não mostre este spoiler',spoiler:true}];
  await page.goto(url('/comunidade'));
  await expect(page.locator('#nx40Feed .nx40-card')).toHaveCount(6);
  await expect(page.locator('#nx40Feed')).not.toContainText('indisponível');
  await expect(page.locator('#nx40Feed')).not.toContainText('Uma leitura');
  await expect(page.locator('#nx40Impressions .nx40-impression')).toHaveCount(2);
  await expect(page.locator('#nx40Impressions')).toContainText('Uma leitura que vale cada capítulo.');
  await expect(page.locator('#nx40Impressions')).not.toContainText('Não mostre este spoiler');
  await page.getByRole('button',{name:'Carregar mais atividade',exact:true}).click();
  await expect(page.locator('#nx40Feed .nx40-card')).toHaveCount(9);
  await expect(page.locator('[data-nx40-more-activity]')).toBeHidden();
  await expect(page.locator('#nx40Feed .nx40-card').nth(6).locator('a').first()).toBeFocused();
  await expect(page.locator('#nx40ThreadModal,[data-nx40-new],.nx40-tabs')).toHaveCount(0);
  expect(state.threadRequests).toBe(0);
  await noOverflow(page);
});
