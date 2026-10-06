import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

const baseline=process.env.ANX_PERF_BASELINE_REF;
if(baseline&&!/^[a-f0-9]{40}$/i.test(baseline))throw new Error('Baseline must be an immutable commit');
const source=file=>baseline?execFileSync('git',['show',`${baseline}:${file}`],{encoding:'utf8'}):readFileSync(new URL('../'+file,import.meta.url),'utf8');
const fixtures=Array.from({length:120},(_,i)=>`<article><p>no ep. ${i+1}, ${i+2} eps</p>${[false,true].map(reading=>`<button ${reading?'data-manga-list':'data-list'}="${i+1}"></button><button ${reading?'data-manga-fav':'data-fav'}="${i+1}"></button>`).join('')}</article>`).join('');

async function openFixture(page,body=fixtures){
  await page.route('**/*',route=>route.request().isNavigationRequest()?route.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><html><head><meta charset="utf-8"><meta name="description"><link rel="canonical"><meta name="theme-color"></head><body><div class="drawer-content"><button data-nx-drawer-theme></button></div><button class="nx38-account-chip">Conta</button><div id="app"><h1>Fixture</h1>${body}<textarea>ep. 9</textarea><div class="nx40-source-flow">ep. 9</div></div></body></html>`}):route.abort());
  await page.goto('https://fixture.test/observer-fixture');
  await page.evaluate(()=>{
    localStorage.setItem('aninexus:privacy:v1','{"analytics":false}');
    localStorage.setItem('aninexus:mediaState:v2',JSON.stringify({1:{status:'CURRENT',progress:2}}));
    localStorage.setItem('aninexus:mangaState:v2',JSON.stringify({1:{status:'PAUSED',progress:3}}));
    localStorage.setItem('aninexus:favorites','[1]');
    localStorage.setItem('aninexus:mangaFavorites','[2]');
    window.fixtureCounts={mediaQueries:0,storageReads:0,treeTextVisits:0,themePaints:0,globalQueries:0};
    const query=document.querySelectorAll.bind(document);document.querySelectorAll=selector=>{window.fixtureCounts.globalQueries++;if(/data-(?:manga-)?(?:list|fav)|data-nx.*(?:list|fav|status)/.test(selector))window.fixtureCounts.mediaQueries++;return query(selector)};
    const read=Storage.prototype.getItem;Storage.prototype.getItem=function(key){window.fixtureCounts.storageReads++;return read.call(this,key)};
    const walker=document.createTreeWalker.bind(document);document.createTreeWalker=(...args)=>{const result=walker(...args),next=result.nextNode.bind(result);result.nextNode=()=>{const node=next();if(node)window.fixtureCounts.treeTextVisits++;return node};return result};
    const descriptor=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');Object.defineProperty(Element.prototype,'innerHTML',{...descriptor,set(value){if(this.matches('[data-nx-drawer-theme]'))window.fixtureCounts.themePaints++;descriptor.set.call(this,value)}});
  });
}
const inject=(page,file)=>page.addScriptTag({content:source(file)});

test('full media refresh collects controls once per type and preserves typed duplicate actions',async({page})=>{
  await openFixture(page);await inject(page,'preview-v19/media-state-v2.js');
  await expect(page.locator('[data-list="1"]')).toHaveAttribute('aria-label','Assistindo. Clique para alterar');
  await expect(page.locator('[data-manga-list="1"]')).toHaveAttribute('aria-label','Pausei. Clique para alterar');
  await expect(page.locator('[data-fav="1"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('[data-manga-fav="1"]')).toHaveAttribute('aria-pressed','false');
  const counts=await page.evaluate(()=>{window.fixtureCounts.mediaQueries=0;window.fixtureCounts.storageReads=0;window.AniNexusMediaState.sync();window.AniNexusMangaState.sync();return {...window.fixtureCounts}});
  expect(counts.mediaQueries).toBeLessThanOrEqual(4);expect(counts.storageReads).toBeLessThanOrEqual(30);
  await page.evaluate(()=>{const copies=document.querySelector('article').cloneNode(true);document.querySelector('#app').append(copies)});
  await expect(page.locator('[data-list="1"]')).toHaveCount(2);
  await page.evaluate(()=>{window.AniNexusMediaState.put(1,{status:'COMPLETED'},12);window.AniNexusMediaState.favorite(1,false)});
  for(const control of await page.locator('[data-list="1"]').all())await expect(control).toHaveAttribute('aria-label','Terminei. Clique para alterar');
  for(const control of await page.locator('[data-fav="1"]').all())await expect(control).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('[data-manga-list="1"]').first()).toHaveAttribute('aria-label','Pausei. Clique para alterar');
});

test('product theme reaches idle and incremental text cleanup preserves excluded content and theme controls',async({page})=>{
  await openFixture(page);await inject(page,'preview-v42/product-v42.js');
  await expect(page.locator('article p').first()).toHaveText('no episódio 1, 2 episódios');
  await expect(page.locator('textarea')).toHaveValue('ep. 9');await expect(page.locator('.nx40-source-flow')).toHaveText('ep. 9');
  await expect(page.locator('.nx38-account-chip')).toHaveAttribute('aria-haspopup','menu');
  await page.waitForTimeout(240);
  const idle=await page.evaluate(()=>({...window.fixtureCounts}));await page.waitForTimeout(180);
  expect(await page.evaluate(()=>window.fixtureCounts.themePaints)).toBe(idle.themePaints);
  const edited=await page.evaluate(()=>{window.fixtureCounts.treeTextVisits=0;const p=document.createElement('p');p.id='newParagraph';p.textContent='ep. 7';document.querySelector('#app').append(p);return document.documentElement.dataset.theme});
  await expect(page.locator('#newParagraph')).toHaveText('episódio 7');
  expect(await page.evaluate(()=>window.fixtureCounts.treeTextVisits)).toBeLessThan(30);
  await page.locator('[data-nx-drawer-theme]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme',edited==='dark'?'light':'dark');
  const painted=await page.evaluate(()=>window.fixtureCounts.themePaints);await page.waitForTimeout(180);expect(await page.evaluate(()=>window.fixtureCounts.themePaints)).toBe(painted);
});

test('new accessible rails are enhanced as a batch without rescanning all document controls',async({page})=>{
  await openFixture(page,'<div class="nx35-rail" aria-label="Seleção própria"></div>');await inject(page,'preview-v38/seo-v38.js');
  await expect(page.locator('.nx35-rail')).toHaveAttribute('tabindex','0');await expect(page.locator('.nx35-rail')).toHaveAttribute('aria-label','Seleção própria');
  await page.waitForTimeout(100);
  await page.evaluate(async()=>{window.fixtureCounts.globalQueries=0;for(let i=0;i<20;i++){const rail=document.createElement('div');rail.className='nx35-rail newRail';rail.innerHTML='<span class="nx35-rank-num">01</span>';document.querySelector('#app').append(rail);await Promise.resolve()}});
  await expect(page.locator('.newRail')).toHaveCount(20);
  for(const rail of await page.locator('.newRail').all()){await expect(rail).toHaveAttribute('tabindex','0');await expect(rail).toHaveAttribute('aria-label','Conteúdo rolável');await expect(rail.locator('.nx35-rank-num')).toHaveAttribute('aria-hidden','true')}
  expect(await page.evaluate(()=>window.fixtureCounts.globalQueries)).toBeLessThanOrEqual(4);
  await page.evaluate(()=>{document.querySelector('h1').textContent='Nova página';dispatchEvent(new CustomEvent('aninexus:route-changed'))});
  await expect(page).toHaveTitle('Nova página | AniNexus');
});

test('actual Home countdown preserves its elements between ticks and switches day format only at the boundary',async({page})=>{
  await openFixture(page,'<div id="clock" data-nx35-airing="2000000000"></div>');
  const home=source('preview-v35/home-v35.js'),functionStart=home.indexOf('  function updateCountdowns()'),next=home.indexOf('\n  function ',functionStart+1),declaration=home.lastIndexOf('  const countdownParts=',functionStart),start=declaration>=0?declaration:functionStart;
  expect(functionStart).toBeGreaterThan(0);expect(next).toBeGreaterThan(functionStart);
  await page.addScriptTag({content:`(()=>{const app=document.querySelector('#app');${home.slice(start,next)}window.fixtureCountdown=updateCountdowns})();`});
  await page.evaluate(()=>{window.fixtureNow=(2000000000-172801)*1000;Date.now=()=>window.fixtureNow;window.fixtureCountdown();window.fixtureClockParts=[...document.querySelector('#clock').children];window.fixtureClockAdded=0;new MutationObserver(rs=>{window.fixtureClockAdded+=rs.flatMap(r=>[...r.addedNodes]).filter(n=>n.nodeType===1).length}).observe(document.querySelector('#clock'),{childList:true,subtree:true})});
  await page.evaluate(()=>{for(let i=0;i<10;i++){window.fixtureNow+=1000;window.fixtureCountdown()}});
  expect(await page.evaluate(()=>window.fixtureClockParts.every((node,i)=>node===document.querySelector('#clock').children[i]))).toBe(true);expect(await page.evaluate(()=>window.fixtureClockAdded)).toBe(0);
  await expect(page.locator('#clock .days')).toHaveText('1d');
  await page.evaluate(()=>{window.fixtureNow=(2000000000-90)*1000;window.fixtureCountdown()});await expect(page.locator('#clock .days')).toHaveCount(0);await expect(page.locator('#clock')).toContainText('00:01:30');
  await page.evaluate(()=>{window.fixtureNow=2000000000*1000;window.fixtureCountdown()});await expect(page.locator('#clock')).toBeHidden();
});
