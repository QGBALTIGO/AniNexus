import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const origin=process.env.ANINEXUS_E2E_ORIGIN||'http://127.0.0.1:4173/';
const url=path=>`${origin}?p=${encodeURIComponent(path)}`;
const snapshots=new WeakMap();
// Persistence checks use reduced motion; animated cross-page controls are covered in e2e.spec.mjs.
test.use({contextOptions:{reducedMotion:'reduce'}});
test.afterEach(async({page},info)=>{if(info.status!==info.expectedStatus)await info.attach('sync-state',{body:JSON.stringify({remote:snapshots.get(page),local:await page.evaluate(()=>({...localStorage})).catch(()=>null),input:await page.evaluate(()=>window.__mediaInput).catch(()=>null)}),contentType:'application/json'})});
const cover='https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx105778-euxXZEIfDY2u.png';
const coverBytes=readFileSync(new URL('../assets/avatars/mascot-pink.png',import.meta.url));
const media=(id=301,format='MANGA')=>({id,format,type:format==='TV'?'ANIME':'MANGA',title:{english:`Leitura ${id}`,romaji:`Leitura ${id}`},coverImage:{large:cover,extraLarge:cover},chapters:48,volumes:8,episodes:12,genres:['Drama'],status:'FINISHED',seasonYear:2026,description:'Uma jornada.',relations:{edges:[]},recommendations:{nodes:[]},characters:{edges:[]},staff:{edges:[]},studios:{nodes:[]}});

async function setup(page){
  await page.addInitScript(()=>{window.__mediaInput=[];for(const type of ['pointerdown','pointerup','click'])addEventListener(type,event=>{window.__mediaInput.push({type,tag:event.target.tagName,button:event.target.closest('button')?.outerHTML.slice(0,400),x:event.clientX,y:event.clientY,scroll:scrollY});if(window.__mediaInput.length>40)window.__mediaInput.shift()},true)});
  await page.route(cover,route=>route.fulfill({contentType:'image/png',body:coverBytes}));
  await page.addInitScript(()=>localStorage.setItem('aninexus:privacy:v1','{"analytics":false}'));
  const remote={favorites:[],manga:[],anime:[],writes:[],fail:false,delayFavorites:false,favoriteReads:0};snapshots.set(page,remote);
  await page.route('https://graphql.anilist.co/',route=>{
    const {query='',variables={}}=route.request().postDataJSON();
    const type=query.includes('type:MANGA')?'MANGA':'TV',items=[media(301,type),media(302,'ONE_SHOT'),media(303,'NOVEL')];
    const Page={media:items,pageInfo:{total:3,currentPage:1,lastPage:1,hasNextPage:false},airingSchedules:[]};
    return route.fulfill({json:{data:{Media:media(Number(variables.id)||301,Number(variables.id)===303?'NOVEL':type),Page,season:Page,reading:Page,topReading:Page,top:Page,popular:Page,soon:Page,schedule:Page}}});
  });
  await page.route('https://api.jikan.moe/**',route=>route.fulfill({json:{data:[]}}));
  await page.route('**/api/**',async route=>{
    const request=route.request(),path=new URL(request.url()).pathname,method=request.method();
    if(/^\/api\/(?:manga|anime)\/\d+$/.test(path)){const id=Number(path.split('/').at(-1));return route.fulfill({json:{...media(id,id===303?'NOVEL':path.includes('/anime/')?'TV':'MANGA'),title:`Leitura ${id}`,cover,characters:[],staff:[],relations:[],recommendations:[],studios:[]}})}
    if(path==='/api/me')return route.fulfill({json:{user:{id:'reader-a',username:'reader'}}});
    if(path.includes('/api/me/')){
      const manga=path.includes('manga'),key=manga?'manga':'anime',id=Number(path.split('/').at(-1));
      if(method==='GET'&&path.endsWith('favorites')){const body=JSON.stringify({items:remote.favorites});remote.favoriteReads++;if(remote.delayFavorites)await new Promise(resolve=>setTimeout(resolve,900));return route.fulfill({body,contentType:'application/json'})}
      if(method==='GET')return route.fulfill({json:path.endsWith('favorites')?{items:remote.favorites}:path.endsWith('manga-library')?{list:remote.manga.map(x=>({...x,media:media(x.media_id)})),favorites:remote.favorites.filter(x=>x.media_type==='MANGA').map(x=>({...x,media:media(x.media_id)}))}:{items:remote[key]}});
      const body=request.postDataJSON()||{};remote.writes.push({path,method,body});
      if(remote.fail)return route.fulfill({status:503,json:{error:'TEMPORARY'}});
      if(path.includes('favorites')){
        const type=body.mediaType||new URL(request.url()).searchParams.get('mediaType');
        remote.favorites=remote.favorites.filter(x=>x.media_id!==id||x.media_type!==type);
        if(method==='PUT')remote.favorites.push({media_id:id,media_type:type});
      }else{
        remote[key]=remote[key].filter(x=>x.media_id!==id);
        if(method==='PUT')remote[key].push({media_id:id,...body,volume_progress:body.volumeProgress,updated_at:new Date().toISOString()});
      }
      return route.fulfill({json:{ok:true}});
    }
    const reading=!path.includes('catalog'),items=[301,302,303].map(id=>({...media(id,reading?(id===303?'NOVEL':id===302?'ONE_SHOT':'MANGA'):'TV'),title:`Leitura ${id}`,cover,mediaType:reading?'MANGA':'ANIME',metricsSource:'aninexus',popularity:100,listCount:20}));
    return route.fulfill({json:{items,pageInfo:{total:3,currentPage:1,lastPage:1,hasNextPage:false},reading:items,topReading:items}});
  });
  return remote;
}
async function login(page){
  expect(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  await page.evaluate(()=>{
    window.AniNexusAuth={...window.AniNexusAuth,enabled:true,api:async(path,options={})=>{
      const response=await fetch(path,{...options,headers:{'content-type':'application/json'}});
      if(!response.ok)throw Object.assign(new Error('API'),{status:response.status});return response.json();
    }};
    dispatchEvent(new CustomEvent('aninexus:account-identity-changed',{detail:{user:{id:'reader-a'}}}));
  });
}

test('manga actions persist multiple reactions and reading progress independently from favorites',async({page},testInfo)=>{
  const remote=await setup(page);await page.goto(url('/mangas'),{waitUntil:'domcontentloaded'});await login(page);
  const card=page.locator('[data-manga-open="301"]').first(),heart=card.locator('[data-manga-fav]'),plus=card.locator('[data-manga-list]');
  await expect(heart).toBeVisible();await expect(heart).toHaveCSS('width','34px');
  await heart.click();await expect.poll(()=>remote.favorites.length).toBe(1);await expect(heart).toHaveAttribute('aria-pressed','true');
  await plus.click();const modal=page.getByRole('dialog');await expect(modal).toBeVisible();
  await expect(modal).toContainText('Leitura 301');await expect(modal).not.toContainText('Assistindo');
  await modal.locator('[data-nx20-status="CURRENT"]').click();
  await modal.getByRole('spinbutton',{name:'Capítulos lidos',exact:true}).fill('3');
  await modal.getByRole('spinbutton',{name:'Capítulos lidos',exact:true}).press('Tab');
  await modal.locator('[data-nx20-reaction="Amei"]').click();await modal.locator('[data-nx20-reaction="Viciante"]').click();
  await page.screenshot({path:testInfo.outputPath('reading-desktop.png')});
  await modal.getByRole('slider').fill('8.5');await modal.locator('[data-nx20-save]').click();
  await expect.poll(()=>remote.manga[0]?.reactions).toEqual(['Amei','Viciante']);
  expect(remote.manga[0]).toMatchObject({status:'CURRENT',progress:3,score:8.5});expect(remote.anime).toEqual([]);
  await page.goto(url('/mangas'),{waitUntil:'domcontentloaded'});await login(page);await expect(heart).toHaveAttribute('aria-pressed','true');
  await plus.click();await expect(modal.locator('[data-nx20-reaction="Amei"]')).toHaveAttribute('aria-pressed','true');
  await modal.locator('[data-nx20-remove]').click();await expect.poll(()=>remote.manga.length).toBe(0);
  await expect(heart).toHaveAttribute('aria-pressed','true');await expect(plus).toHaveAttribute('aria-pressed','false');
});

test('novel volumes and manga detail use the shared editor and isolated IDs',async({page},testInfo)=>{
  const remote=await setup(page);await page.setViewportSize({width:390,height:844});await page.goto(url('/mangas'),{waitUntil:'domcontentloaded'});await login(page);
  await page.locator('[data-manga-list="303"]').click();const modal=page.getByRole('dialog');
  await expect(modal).toContainText('Light novel');await modal.locator('[data-nx20-status="CURRENT"]').click();
  await expect(modal.getByRole('spinbutton',{name:'Capítulos lidos',exact:true})).toHaveCount(0);
  await modal.getByRole('spinbutton',{name:'Volumes lidos',exact:true}).fill('2');await modal.getByRole('spinbutton').press('Tab');
  await page.screenshot({path:testInfo.outputPath('reading-mobile.png')});
  await modal.locator('[data-nx20-reaction="Amei"]').click();await modal.locator('[data-nx20-save]').click();
  await expect.poll(()=>remote.manga[0]?.volumeProgress).toBe(2);
  await page.goto(url('/manga/leitura-301'),{waitUntil:'domcontentloaded'});await login(page);
  const heart=page.locator('.detail-actions [data-manga-fav]');await expect(heart).toBeVisible();await heart.click();
  await expect.poll(()=>remote.favorites.some(x=>x.media_id===301&&x.media_type==='MANGA')).toBe(true);
  expect(remote.favorites.some(x=>x.media_type==='ANIME')).toBe(false);
  await page.locator('.detail-actions [data-manga-list]').click();await expect(modal).toContainText('Quero ler');
  await page.keyboard.press('Escape');await expect(modal).toHaveCount(0);
  await expect(page.locator('.detail-actions [data-manga-list]')).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
});

test('failed writes stay pending and retry without losing state or leaking across accounts',async({page})=>{
  const remote=await setup(page);await page.goto(url('/mangas'),{waitUntil:'domcontentloaded'});await login(page);remote.fail=true;
  const heart=page.locator('[data-manga-fav="301"]');await heart.click();await expect(page.locator('.nx-media-sync-notice')).toBeVisible();
  await expect(heart).toHaveAttribute('aria-pressed','true');remote.fail=false;
  await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();await expect.poll(()=>remote.favorites.length).toBe(1);
  await page.evaluate(()=>dispatchEvent(new CustomEvent('aninexus:account-identity-changed',{detail:{user:null}})));
  await expect(heart).toHaveAttribute('aria-pressed','false');
  expect(await page.evaluate(()=>localStorage.getItem('aninexus:mangaFavorites'))).toBeNull();
});

test('anime and manga IDs stay separate and every status preserves compact geometry',async({page})=>{
  test.setTimeout(90000);
  const remote=await setup(page);await page.goto(url('/mangas'),{waitUntil:'domcontentloaded'});await login(page);
  await page.locator('[data-manga-fav="301"]').click();await expect.poll(()=>remote.favorites.length).toBe(1);
  await page.goto(url('/animes/catalogo'),{waitUntil:'domcontentloaded'});await login(page);
  const heart=page.locator('[data-fav="301"]'),plus=page.locator('[data-list="301"]');
  await expect(heart).toHaveAttribute('aria-pressed','false');await heart.click();await expect.poll(()=>remote.favorites.length).toBe(2);
  for(const status of ['PLANNING','CURRENT','PAUSED','COMPLETED','DROPPED']){
    await plus.click();const modal=page.locator('.nx20-modal');await modal.locator(`[data-nx20-status="${status}"]`).click();
    if(status==='CURRENT')await modal.locator('[data-nx20-progress]').fill('3');
    await modal.locator('[data-nx20-save]').click();await expect(modal).toHaveCount(0);
    await expect.poll(()=>remote.anime[0]?.status).toBe(status);await expect(plus).toHaveCSS('width','34px');
    await expect(plus).toHaveAttribute('data-nx-unified-status',status);
  }
  expect(remote.manga).toEqual([]);await expect(heart).toHaveAttribute('aria-pressed','true');
  await page.goto(url('/mangas'),{waitUntil:'domcontentloaded'});await login(page);
  await expect(page.locator('[data-manga-list="301"]')).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('[data-manga-fav="301"]')).toHaveAttribute('aria-pressed','true');
});

test('late account hydration cannot undo a successful favorite click',async({page})=>{
  const remote=await setup(page);await page.goto(url('/mangas'),{waitUntil:'domcontentloaded'});await login(page);
  await expect(page.locator('[data-manga-fav="301"]')).toBeVisible();remote.favorites=[{media_id:302,media_type:'MANGA'}];remote.delayFavorites=true;
  const reads=remote.favoriteReads;await page.evaluate(()=>dispatchEvent(new CustomEvent('aninexus:media-sync-retry')));
  await expect.poll(()=>remote.favoriteReads).toBeGreaterThan(reads);
  await page.locator('[data-manga-fav="301"]').click();await expect.poll(()=>remote.favorites.length).toBe(2);
  await page.waitForTimeout(1100);
  await expect(page.locator('[data-manga-fav="301"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('[data-manga-fav="302"]')).toHaveAttribute('aria-pressed','true');
  expect(remote.writes.filter(x=>x.method==='DELETE')).toEqual([]);
});

test('manga library keeps favorites independent when editing and removing a reading',async({page})=>{
  const remote=await setup(page);remote.manga=[{media_id:301,status:'CURRENT',progress:3,reactions:['Amei']}];remote.favorites=[{media_id:301,media_type:'MANGA'}];
  await page.goto(url('/mangas'),{waitUntil:'domcontentloaded'});await login(page);
  await page.evaluate(()=>{history.pushState({},'','?p=/meus-mangas');dispatchEvent(new PopStateEvent('popstate'))});
  const library=page.locator('#nx42MangaLibrary');await expect(library.locator('[data-manga-list="301"]')).toBeVisible();
  await expect(library).toContainText('3 capítulos lidos');
  await library.locator('[data-manga-list="301"]').click();const modal=page.getByRole('dialog');
  await expect(modal.locator('[data-nx20-reaction="Amei"]')).toHaveAttribute('aria-pressed','true');
  await modal.getByRole('spinbutton',{name:'Capítulos lidos',exact:true}).fill('4');
  await modal.locator('[data-nx20-save]').click();await expect(library).toContainText('4 capítulos lidos');
  await expect.poll(()=>remote.manga[0]?.progress).toBe(4);
  await library.locator('[data-manga-list="301"]').click();await modal.locator('[data-nx20-remove]').click();
  await expect.poll(()=>remote.manga.length).toBe(0);await expect(library.locator('[data-manga-list="301"]')).toHaveAttribute('aria-pressed','false');
  await expect(library.locator('[data-manga-fav="301"]')).toHaveAttribute('aria-pressed','true');
  await library.locator('[data-manga-fav="301"]').click();await expect.poll(()=>remote.favorites.length).toBe(0);
  await expect(library).toContainText('Nada nesta categoria');
  await page.evaluate(()=>{history.pushState({},'','?p=/mangas');dispatchEvent(new PopStateEvent('popstate'))});
  await expect(page.locator('[data-manga-list="301"]')).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('[data-manga-fav="301"]')).toHaveAttribute('aria-pressed','false');
});

test('background synchronization preserves the control being pressed',async({page})=>{
  const remote=await setup(page);await page.goto(url('/mangas'),{waitUntil:'domcontentloaded'});await login(page);
  const heart=page.locator('[data-manga-fav="301"]');await expect(heart).toBeVisible();
  await heart.scrollIntoViewIfNeeded();const box=await heart.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  expect(await heart.evaluate(button=>{const icon=button.querySelector('svg');window.AniNexusMangaState.sync();return button.querySelector('svg')===icon})).toBe(true);
  await page.mouse.up();await expect.poll(()=>remote.favorites.length).toBe(1);
  await expect(heart).toHaveAttribute('aria-pressed','true');await expect(page.getByRole('dialog')).toHaveCount(0);
});
