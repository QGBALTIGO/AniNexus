import {test,expect} from '@playwright/test';
const origin=process.env.ANINEXUS_E2E_ORIGIN||'http://127.0.0.1:4174/';
const node=(id,title,format='TV',year=2000)=>({key:`ANIME:${id}`,id,mediaType:'ANIME',title,format,year,cover:null});
const graph={root:'ANIME:1',nodes:[node(1,'Naruto'),node(2,'Naruto Shippuden','TV',2007),node(3,'The Last','MOVIE',2014),node(4,'História paralela','ONA',2017)],edges:[{from:'ANIME:1',to:'ANIME:2',relation:'SEQUEL'},{from:'ANIME:2',to:'ANIME:3',relation:'SIDE_STORY'},{from:'ANIME:1',to:'ANIME:4',relation:'SPIN_OFF'}],order:{sequence:['ANIME:1','ANIME:2'],release:['ANIME:1','ANIME:2','ANIME:3','ANIME:4'],cycle:false},partial:true};
async function prepare(page,{theme='dark',member=true,relations=[],response=route=>route.fulfill({json:graph})}={}){
  await page.addInitScript(theme=>localStorage.setItem('aninexus:theme',theme),theme);
  await page.route('**/api/anime/1',route=>route.fulfill({json:{id:1,mediaType:'ANIME',title:'Naruto',description:'Sinopse em português.',cover:'/assets/logo.png',status:'FINISHED',relations,characters:[],staff:[],recommendations:[]}}));
  await page.route('**/api/anime/1/franchise',response);
  await page.route('**/api/me/franchise-progress*',route=>route.fulfill({json:{items:[{media_id:1,media_type:'ANIME',status:'COMPLETED',progress:220}]}}));
  await page.goto(new URL('/anime/naruto-1',origin).href);await expect(page.locator('#app h1')).toHaveText('Naruto');
  await page.evaluate(member=>{window.AniNexusAuth={enabled:member,apiOrigin:'',getUser:async()=>member?{id:'fixture'}:null,api:async path=>{const r=await fetch(path);if(!r.ok)throw Error('Unavailable');return r.json()}}},member);
  await page.getByRole('tab',{name:'Franquia',exact:true}).click();
}
for(const theme of ['dark','light'])test(`franchise ${theme}: sequence progress filters and next missing sequel`,async({page},info)=>{
  await page.setViewportSize({width:390,height:844});await prepare(page,{theme});
  const section=page.locator('.nx61-franchise');await expect(section).toContainText('Você completou 1 de 4 obras catalogadas · 25%');
  await expect(section.locator('.nx61-franchise-list li')).toHaveCount(2);await expect(section.locator('.nx61-franchise-next')).toContainText('Naruto Shippuden');
  const select=section.getByLabel('Visualização');await select.selectOption('extras');await expect(section.locator('.nx61-franchise-list li')).toHaveCount(1);await expect(section.locator('.nx61-franchise-list')).toContainText('The Last');
  await select.selectOption('chronological');await expect(section).toContainText('Ainda não existe uma ordem cronológica revisada');await expect(section.locator('.nx61-franchise-list')).toHaveCount(0);
  await select.selectOption('spinoff');await expect(section.locator('.nx61-franchise-list')).toContainText('História paralela');
  await select.selectOption('release');await expect(section.locator('.nx61-franchise-list li')).toHaveCount(4);
  await section.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('franchise-mobile.png')});
  for(const width of [320,390,768,1440,1920]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);}
  await page.screenshot({path:info.outputPath('franchise-desktop.png')});
  await page.evaluate(()=>{window.AniNexusAuth.getUser=async()=>null;dispatchEvent(new CustomEvent('aninexus:account-identity-changed',{detail:{user:null}}))});
  await expect(section).not.toContainText('Você completou');await expect(section).not.toContainText('Sua história continua');await expect(section).toContainText('Entre para acompanhar');
});
test('franchise: failure retries without inventing relationships',async({page})=>{
  let broken=true;await prepare(page,{member:false,response:route=>route.fulfill(broken?{status:503,json:{error:'UNAVAILABLE'}}:{json:graph})});
  await expect(page.getByText('As relações não carregaram agora.',{exact:false})).toBeVisible();broken=false;await page.locator('[data-franchise-retry]').click();
  await expect(page.locator('.nx61-franchise-list li')).toHaveCount(2);await expect(page.locator('.nx61-franchise-progress')).toContainText('Entre para acompanhar');
});
test('franchise: late response does not overwrite another detail panel',async({page})=>{
  let release;const gate=new Promise(resolve=>release=resolve);await prepare(page,{member:false,response:async route=>{await gate;return route.fulfill({json:graph})}});
  await page.getByRole('tab',{name:'Recomendações',exact:true}).click();release();await expect(page.locator('#nx22Panel')).toContainText('Você também pode gostar');
  await expect(page.locator('.nx61-franchise')).toHaveCount(0);
});

const knownRelations=[{relationType:'ADAPTATION',media:{id:202,mediaType:'MANGA',title:'Mangá Relacionado',format:'MANGA'}},{relationType:'SEQUEL',media:{id:null,idMal:1735,mediaType:'ANIME',title:'Anime Relacionado por MAL',format:'TV'}}];
test('franchise: unavailable graph preserves known cross-media and unresolved title navigation',async({page})=>{
  await prepare(page,{member:false,relations:knownRelations,response:route=>route.fulfill({status:503,json:{error:'UNAVAILABLE'}})});
  await expect(page.locator('#nx22Panel')).toContainText('As relações já disponíveis continuam abaixo');
  await expect(page.locator('.nx22-related')).toHaveCount(2);
  await expect(page.locator('[data-nx22-open="202"]')).toHaveAttribute('data-nx22-media-type','MANGA');
  await page.locator('[data-nx22-search-title="Anime Relacionado por MAL"]').click();
  await expect(page.locator('.nx21-catalog-page')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('nx:v46:anime-catalog-state')||'{}'))).toMatchObject({mode:'SEARCH',search:'Anime Relacionado por MAL'});
});

test('franchise: successful graph retains unmatched source references across filter changes',async({page})=>{
  await prepare(page,{member:false,relations:knownRelations});
  await expect(page.locator('.nx61-franchise')).toBeVisible();
  const reference=page.locator('.nx61-franchise-unmapped [data-nx22-search-title="Anime Relacionado por MAL"]');
  await expect(reference).toHaveCount(1);await page.getByLabel('Visualização').selectOption('release');await expect(reference).toHaveCount(1);
  await page.getByLabel('Visualização').selectOption('extras');await expect(reference).toHaveCount(1);await reference.click();
  await expect(page.locator('.nx21-catalog-page')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('nx:v46:anime-catalog-state')||'{}'))).toMatchObject({search:'Anime Relacionado por MAL'});
});

