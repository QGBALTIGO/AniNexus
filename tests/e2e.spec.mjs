import {test,expect} from '@playwright/test';
import {achievementCatalog,levelFromXp} from '../lib/achievements.mjs';
const ORIGIN=process.env.ANINEXUS_E2E_ORIGIN||'http://qgbaltigo.github.io:4173/AniNexus/';
const LOCAL_STATIC_ORIGIN=process.env.ANINEXUS_LOCAL_STATIC_ORIGIN||'';
const pageUrl=route=>`${ORIGIN}?build=44.15.0&p=${encodeURIComponent(route)}`;
const firstVisitUrl=route=>{const url=new URL(pageUrl(route));if(url.hostname.endsWith('github.io'))url.hostname='127.0.0.1';return url.href};
async function fulfillLocalStatic(route){const requested=new URL(route.request().url()),pathname=requested.pathname.startsWith('/AniNexus/')?requested.pathname:`/AniNexus${requested.pathname}`,local=new URL(pathname+requested.search,LOCAL_STATIC_ORIGIN);let lastError;for(let attempt=0;attempt<3;attempt++){try{const response=await route.fetch({url:local.href});return await route.fulfill({response})}catch(error){lastError=error;if(!/ECONNRESET|ECONNREFUSED|socket hang up/i.test(String(error?.message))||attempt===2)throw error;await new Promise(resolve=>setTimeout(resolve,80*(attempt+1)))}}throw lastError}
async function bridgeProductionAssets(page){if(!new URL(ORIGIN).hostname.endsWith('github.io'))return;const origin=new URL(firstVisitUrl('/')).origin;await page.route(`${origin}/**`,async route=>{const requested=new URL(route.request().url());if(!/^\/(?:preview-v\d+|assets|data)\//.test(requested.pathname))return route.continue();const response=await route.fetch({url:`${origin}/AniNexus${requested.pathname}${requested.search}`});return route.fulfill({response})})}
async function noOverflow(page,t=7){const x=await page.evaluate(()=>({s:document.documentElement.scrollWidth,w:innerWidth}));expect(x.s).toBeLessThanOrEqual(x.w+t)}
async function clear(page){await page.evaluate(()=>{for(const k of ['aninexus:favorites','aninexus:mediaState:v2','aninexus:mediaState:v1','aninexus:list','aninexus:listStatus','aninexus:community:activity:v40','aninexus:community:threads:v40'])localStorage.removeItem(k);window.AniNexusMediaState?.sync?.()})}
const pixel='data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
const portrait='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22150%22 viewBox=%220 0 100 150%22%3E%3Crect width=%22100%22 height=%22150%22 fill=%22%23ef2a5c%22/%3E%3Ccircle cx=%2250%22 cy=%2235%22 r=%2220%22 fill=%22white%22/%3E%3C/svg%3E';
const imageBytes=Buffer.from('R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=','base64');
const achievementDefinitions=achievementCatalog();
function achievementPayload({unlockedCount=18,pins=[achievementDefinitions[0].id,achievementDefinitions[7].id],shareFeed=true,equippedTitle='Enciclopédia Viva'}={}){
  const pinnedSlots=new Map(pins.map((id,index)=>[id,index+1]));
  const items=achievementDefinitions.map((item,index)=>{const unlocked=index<unlockedCount,progress=unlocked?item.target:Math.max(0,Math.min(item.target-1,Math.ceil(item.target*.62)));return{...item,progress,progressValue:progress,unlocked,unlockedAt:unlocked?'2026-09-03T15:00:00.000Z':null,pinnedSlot:pinnedSlots.get(item.id)||null}});
  const unlocked=items.filter(item=>item.unlocked),xp=unlocked.reduce((total,item)=>total+item.xp,0),availableTitles=unlocked.map(item=>item.rewardTitle).filter(Boolean);
  return{total:items.length,unlockedCount:unlocked.length,percentage:Math.round(unlocked.length/items.length*100),xp,level:levelFromXp(xp),metrics:{library:64,completed:31,episodes:820,ratings:36,contributions:14,genres:9,streak:11,planning:12,current:4,statusVariety:5},items,pins,availableTitles,equippedTitle:availableTitles.includes(equippedTitle)?equippedTitle:null,preferences:{shareFeed,timezone:'America/Cuiaba'}};
}
function achievementFeed(){return achievementDefinitions.slice(0,7).map((item,index)=>({...item,username:['kayky','sobroza','andreluiz','nathancezar'][index%4],displayName:`Membro ${index+1}`,avatarUrl:index%2?pixel:null,unlockedAt:new Date(Date.now()-(index+1)*180000).toISOString(),batchCount:index===0?4:1,url:`/u/kayky?tab=achievements&achievement=${item.id}`}))}
function anime(id=101){const provider=id%2?{site:'Crunchyroll',url:`https://www.crunchyroll.com/watch/${id}`,type:'STREAMING',icon:pixel,color:'#fff'}:{site:'YouTube',url:`https://www.youtube.com/watch?v=${id}`,type:'STREAMING',icon:pixel,color:'#fff'};return{id,title:{romaji:`Anime Teste ${id}`,english:`Anime Teste ${id}`,native:`Teste ${id}`,userPreferred:`Anime Teste ${id}`},coverImage:{extraLarge:pixel,large:pixel},bannerImage:portrait,averageScore:82,popularity:1000,genres:['Action','Adventure'],episodes:12,format:'TV',status:'RELEASING',seasonYear:2026,description:'Uma história de teste.',externalLinks:[provider],startDate:{year:2026,month:1,day:1},endDate:null,studios:{nodes:[]},relations:{edges:[]},recommendations:{nodes:[]},characters:{edges:[]},staff:{edges:[]}}}
function graphData(query='',variables={}){
  const ids=Array.isArray(variables.ids)&&variables.ids.length?variables.ids:[101,102,103,104],media=ids.map(Number).filter(Boolean).map(anime),airingAt=Number(variables.start)||Math.floor(Date.now()/1000)+3600;
  const Page={pageInfo:{total:media.length,currentPage:1,lastPage:1,hasNextPage:false},media,airingSchedules:media.map((item,i)=>({airingAt:airingAt+3600*(i+1),episode:i+1,media:item}))};
  if(/studios\s*\(\s*sort\s*:/.test(query))return{Page:{...Page,studios:[{id:1,name:'Estúdio Teste',isAnimationStudio:true,favourites:1000,media:{nodes:media}}]}};
  if(/\bseason:Page/.test(query))return{season:Page,schedule:Page,top:Page,popular:Page,soon:Page,reading:Page};
  const aliases=[...query.matchAll(/\b(a\d+):Media/g)].map(x=>x[1]);if(aliases.length)return Object.fromEntries(aliases.map((key,i)=>[key,anime(201+i)]));
  if(/\bMedia\s*\(\s*id\s*:\s*\$id/.test(query))return{Media:anime(Number(variables.id)||101)};
  if(/\bMedia\s*\(/.test(query)&&!/\bmedia\s*\(/.test(query))return{Media:anime(Number(variables.id)||101)};
  return{Page};
}
function rankedMedia(id,type='ANIME'){
  const manga=type==='MANGA',title=manga?`Mangá AniNexus ${id}`:`Anime AniNexus ${id}`,score=Math.max(7.8,9.9-(id%10)*.2);
  return{id,title,titleRomaji:title,titleNative:'',cover:portrait,banner:portrait,score,meanScore:score-.1,metricsSource:'aninexus',ratingCount:80-(id%10)*5,listCount:140-(id%10)*8,popularity:220-(id%10)*10,favourites:60-(id%10)*3,genres:manga?['Drama','Fantasy']:['Action','Adventure'],format:manga?'MANGA':'TV',status:manga?'RELEASING':'FINISHED',seasonYear:2026,startDate:{year:2026,month:1,day:1},episodes:manga?null:12,chapters:manga?48:null,volumes:manga?8:null,streaming:[]};
}
function rankedCharacters(){
  const names=[['Monkey D. Luffy','ONE PIECE'],['Naruto Uzumaki','Naruto'],['Satoru Gojo','JUJUTSU KAISEN'],['Son Goku','Dragon Ball Z'],['Levi Ackerman','Attack on Titan'],['Frieren','Frieren e a Jornada para o Além'],['Killua Zoldyck','Hunter x Hunter (2011)'],['Maomao','Diários de uma Apotecária'],['Anya Forger','SPY x FAMILY'],['Edward Elric','Fullmetal Alchemist: Brotherhood']];
  return names.map(([name,work],index)=>({id:500+index,name,nativeName:`Nome ${index+1}`,image:portrait,work,mediaId:100+index,favoriteCount:20-index,rank:index+1}));
}
async function mockInternalRankings(page){
  const animeRank=Array.from({length:10},(_,index)=>rankedMedia(101+index)),mangaRank=Array.from({length:10},(_,index)=>rankedMedia(201+index,'MANGA'));
  await page.route('**/api/home?**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({season:animeRank.slice(0,6),schedule:[],top:animeRank,popular:animeRank.slice(0,6),reading:mangaRank.slice(0,6),topReading:mangaRank,soon:animeRank.slice(0,6)})}));
  await page.route('**/api/reading?**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:mangaRank,pageInfo:{total:mangaRank.length,currentPage:1,lastPage:1,hasNextPage:false}})}));
  await page.route('**/api/characters/ranking',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({metricsSource:'aninexus',metric:'favorites',items:rankedCharacters()})}));
}
function themeApiData(count=24){return{anime:[{slug:'anime-teste-101',animethemes:Array.from({length:count},(_,index)=>({type:index%3===2?'ED':'OP',sequence:index+1,song:{title:`Tema ${index+1}`,artists:[{name:`Artista ${index+1}`}]},animethemeentries:[{episodes:String(index+1),nsfw:false,spoiler:false,videos:[{link:`https://v.animethemes.moe/test-${index+1}.webm`,mimetype:'video/webm',resolution:1080,nc:true,subbed:false,lyrics:false}]}]}))}]}}
test.describe.configure({mode:'serial'});
test.beforeEach(async({page})=>{if(LOCAL_STATIC_ORIGIN){const publicOrigin=new URL(ORIGIN).origin;await page.route(`${publicOrigin}/**`,fulfillLocalStatic)}await page.route('https://a.storyblok.com/**',route=>route.fulfill({status:200,contentType:'image/gif',body:imageBytes}));await page.route('https://s4.anilist.co/**',route=>route.fulfill({status:200,contentType:'image/gif',body:imageBytes}));await page.route('https://graphql.anilist.co/',async route=>{let body={};try{body=route.request().postDataJSON()||{}}catch{}await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:graphData(body.query,body.variables)})})});await page.route('https://api.jikan.moe/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:null})}))});

test('V44 Home is the current renderer',async({page})=>{await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx35-home')).toBeVisible({timeout:30000});await expect(page.locator('.aqx-home')).toHaveCount(0);await expect(page.locator('.nx35-kicker,.nx35-signals,.nx35-hero-actions')).toHaveCount(0);await expect(page.locator('meta[name="aninexus-build"]')).toHaveAttribute('content','2026-09-03-v44.15.0')});

test('Home theme is complete and empty achievements do not consume space',async({page})=>{await page.addInitScript(()=>localStorage.setItem('aninexus:theme','dark'));await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx35-home')).toBeVisible({timeout:30000});await expect(page.locator('.nx35-achievement-section')).toBeHidden();await page.locator('[data-action="theme"]').click();await expect(page.locator('html')).toHaveAttribute('data-theme','light');await expect(page.locator('body')).toHaveCSS('background-color','rgb(246, 243, 244)');await expect(page.locator('.nx35-hero h1')).toHaveCSS('color','rgb(36, 24, 30)');await noOverflow(page,2)});

test('Home achievement feed shows four cards on desktop and a page-and-a-half on mobile',async({page})=>{
  await page.route('**/api/achievements/feed?**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:achievementFeed()})}));
  await page.setViewportSize({width:1440,height:900});
  await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});
  const section=page.locator('.nx35-achievement-section'),rail=section.locator('.nx48-achievement-feed-rail');
  await expect(section).toBeVisible({timeout:30000});
  await expect(section).toContainText('Conquistas desbloqueadas');
  await expect(section.locator('.nx48-feed-card')).toHaveCount(7);
  await expect(section.getByRole('link',{name:/Ver conquistas/i})).toBeVisible();
  await expect(section.locator('.nx48-feed-card').first()).toHaveAttribute('href',/(?:tab=achievements&achievement=|tab%3Dachievements%26achievement%3D)profile-new-face/i);
  const desktop=await rail.evaluate(element=>{const card=element.firstElementChild.getBoundingClientRect();return{ratio:element.clientWidth/card.width,left:element.scrollLeft}});
  expect(desktop.ratio).toBeGreaterThan(3.8);expect(desktop.ratio).toBeLessThan(4.25);
  const next=section.locator('[data-nx44-rail-dir="next"]');await expect(next).toBeEnabled();await next.click();
  await expect.poll(()=>rail.evaluate(element=>element.scrollLeft),{timeout:3000}).toBeGreaterThan(desktop.left+500);
  await page.setViewportSize({width:390,height:844});await page.reload({waitUntil:'domcontentloaded'});
  const mobileSection=page.locator('.nx35-achievement-section'),mobileRail=mobileSection.locator('.nx48-achievement-feed-rail');await expect(mobileSection).toBeVisible({timeout:30000});
  const mobile=await mobileRail.evaluate(element=>{const card=element.firstElementChild.getBoundingClientRect(),styles=getComputedStyle(element);return{ratio:element.clientWidth/card.width,unit:card.width+(parseFloat(styles.columnGap||styles.gap)||0),left:element.scrollLeft}});
  expect(mobile.ratio).toBeGreaterThan(1.42);expect(mobile.ratio).toBeLessThan(1.58);
  await mobileSection.locator('[data-nx44-rail-dir="next"]').click();
  await expect.poll(async()=>((await mobileRail.evaluate(element=>element.scrollLeft))-mobile.left)/mobile.unit,{timeout:3000}).toBeGreaterThan(1.7);
  await noOverflow(page,2);
});

test('achievement page renders all 40 milestones and persists pins titles and privacy',async({page})=>{
  let payload=achievementPayload();const writes=[];
  const rebuild=overrides=>{payload=achievementPayload({unlockedCount:payload.unlockedCount,pins:overrides.pins??payload.pins,shareFeed:overrides.shareFeed??payload.preferences.shareFeed,equippedTitle:overrides.equippedTitle===undefined?payload.equippedTitle:overrides.equippedTitle})};
  await page.route('**/api/achievements/catalog',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({total:achievementDefinitions.length,items:achievementDefinitions})}));
  await page.route(/\/api\/me\/achievements(?:\/.*)?(?:\?.*)?$/,async route=>{const request=route.request(),url=new URL(request.url()),method=request.method();if(url.pathname.endsWith('/pins')&&method==='PUT'){const body=request.postDataJSON();writes.push({path:'pins',body});rebuild({pins:body.ids});return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)})}if(url.pathname.endsWith('/preferences')&&method==='PATCH'){const body=request.postDataJSON();writes.push({path:'preferences',body});rebuild({shareFeed:body.shareFeed,equippedTitle:body.equippedTitle});return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)})}return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)})});
  await page.setViewportSize({width:1440,height:900});await page.goto(pageUrl('/conquistas'),{waitUntil:'domcontentloaded'});
  const collection=page.locator('.nx48-achievements-page');await expect(collection).toBeVisible({timeout:30000});await expect(collection.locator('.nx48-achievement-card')).toHaveCount(40);await expect(collection.locator('.nx48-overview-main')).toContainText('18 de 40 conquistas');await expect(collection.locator('.nx48-overview-main')).toContainText('45% concluído');
  const desktopColumns=await collection.locator('.nx48-achievement-card').evaluateAll(cards=>new Set(cards.slice(0,4).map(card=>Math.round(card.getBoundingClientRect().left))).size);expect(desktopColumns).toBe(4);
  await expect(collection.locator('[data-achievement-id="ratings-specialist"]')).toContainText(/31 \/ 50|62%/);
  await collection.locator('[data-achievement-pin="profile-nexus-identity"]').click();await expect.poll(()=>writes.filter(write=>write.path==='pins').length).toBe(1);expect(writes.at(-1)).toEqual({path:'pins',body:{ids:[achievementDefinitions[0].id,achievementDefinitions[7].id,'profile-nexus-identity']}});await expect(collection.locator('[data-achievement-pin="profile-nexus-identity"]')).toHaveAttribute('aria-pressed','true');
  await collection.locator('[data-achievement-pin="library-first-step"]').click();await expect(collection.locator('[data-achievement-feedback]')).toContainText('até três medalhas');expect(writes.filter(write=>write.path==='pins')).toHaveLength(1);
  await collection.locator('[data-achievement-title]').selectOption('Enciclopédia Viva');await expect.poll(()=>writes.some(write=>write.path==='preferences'&&write.body.equippedTitle==='Enciclopédia Viva')).toBe(true);
  await collection.locator('.nx48-toggle').click();await expect(collection.locator('[data-achievement-feed-toggle]')).not.toBeChecked();await expect.poll(()=>writes.some(write=>write.path==='preferences'&&write.body.shareFeed===false)).toBe(true);
  await collection.getByRole('button',{name:'Bloqueadas',exact:true}).click();await expect(collection.locator('.nx48-achievement-card')).toHaveCount(22);
  await page.setViewportSize({width:390,height:844});await page.reload({waitUntil:'domcontentloaded'});await expect(page.locator('.nx48-achievement-card')).toHaveCount(40);const mobileColumns=await page.locator('.nx48-achievement-card').evaluateAll(cards=>new Set(cards.slice(0,3).map(card=>Math.round(card.getBoundingClientRect().left))).size);expect(mobileColumns).toBe(1);await noOverflow(page,2);
});

test('Home awards rotates all 32 winners with responsive art and no imported community metrics',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});
  const awards=page.locator('#nx35Awards.nx46-home-awards');
  await expect(awards).toBeVisible({timeout:30000});
  await expect(awards.locator('.nx46-home-award-card')).toHaveCount(32);
  await expect(awards.locator('.nx46-home-award-feature.is-current h3')).toHaveText('My Hero Academia FINAL SEASON');
  const section=awards.locator('xpath=ancestor::section[1]'),railActions=section.locator('.nx44-rail-actions');
  await expect(awards.locator('.nx46-home-awards-topline,.nx46-home-awards-tabs')).toHaveCount(0);
  await expect(section).not.toContainText('32 categorias oficiais');
  await expect(awards.locator('[data-home-award-autoplay]')).toHaveCount(0);
  await expect(awards.locator('.nx46-home-award-feature-foot')).toHaveCount(0);
  await expect(awards).not.toContainText(/de 32 categorias|Abrir no AniNexus/i);
  await expect(awards.locator('.nx46-home-award-feature.is-current img')).toHaveAttribute('src',/a\.storyblok\.com.*(?:3840x2160|1920x1080)/);
  await expect(railActions.locator('[data-nx44-rail-dir="prev"]')).toBeDisabled();
  await expect(railActions.locator('[data-nx44-rail-dir="next"]')).toBeEnabled();
  await expect(railActions.getByRole('link',{name:'Ver premiação completa'})).toBeVisible();
  const desktopCard=await awards.locator('.nx46-home-award-card').first().evaluate(element=>{const box=element.getBoundingClientRect();return{width:box.width,height:box.height}});
  expect(desktopCard.width).toBeGreaterThan(250);
  expect(desktopCard.height).toBeLessThan(150);
  await expect.poll(()=>awards.locator('.nx46-home-award-feature.is-current h3').textContent(),{timeout:10000}).not.toBe('My Hero Academia FINAL SEASON');
  await awards.locator('.nx46-home-award-card',{hasText:'Charles Emmanuel'}).click();
  await expect(awards.locator('.nx46-home-award-feature.is-current h3')).toHaveText('Charles Emmanuel');
  await expect(awards.locator('.nx46-home-award-feature.is-current')).toContainText('Português Brasileiro');
  await page.waitForTimeout(7600);
  await expect(awards.locator('.nx46-home-award-feature.is-current h3')).toHaveText('Charles Emmanuel');
  await expect(awards).not.toContainText(/nota|popularidade|favoritos/i);
  await noOverflow(page,2);
  await page.setViewportSize({width:390,height:844});
  await page.reload({waitUntil:'domcontentloaded'});
  const mobile=page.locator('#nx35Awards.nx46-home-awards');
  await expect(mobile).toBeVisible({timeout:30000});
  await expect(mobile.locator('.nx46-home-award-card')).toHaveCount(32);
  const mobileImage=mobile.locator('.nx46-home-award-feature.is-current img');
  await expect(mobileImage).toHaveAttribute('src',/a\.storyblok\.com/);
  await expect.poll(()=>mobileImage.evaluate(image=>image.complete&&image.naturalWidth>0)).toBe(true);
  const reloadedWinner=await mobile.locator('.nx46-home-award-feature.is-current h3').textContent();
  await expect.poll(()=>mobile.locator('.nx46-home-award-feature.is-current h3').textContent(),{timeout:10000}).not.toBe(reloadedWinner);
  const mobileGeometry=await mobile.locator('.nx46-home-award-feature.is-current').evaluate(element=>{const box=element.getBoundingClientRect(),copy=element.querySelector('.nx46-home-award-feature-copy').getBoundingClientRect(),art=element.querySelector('.nx46-home-award-feature-art').getBoundingClientRect();return{left:box.left,right:box.right,copyLeft:copy.left,copyRight:copy.right,width:box.width,height:box.height,artRatio:art.width/art.height}});
  expect(mobileGeometry.copyLeft).toBeGreaterThanOrEqual(mobileGeometry.left-.5);
  expect(mobileGeometry.copyRight).toBeLessThanOrEqual(mobileGeometry.right+.5);
  expect(mobileGeometry.width).toBeLessThanOrEqual(362);
  expect(mobileGeometry.height).toBeGreaterThanOrEqual(320);
  expect(mobileGeometry.height).toBeLessThan(470);
  expect(mobileGeometry.artRatio).toBeGreaterThan(1.7);
  expect(mobileGeometry.artRatio).toBeLessThan(1.85);
  await noOverflow(page,2);
  await expect(mobile.locator('.nx46-home-award-card[data-open-anime]')).toHaveCount(0);
  const featured=mobile.locator('.nx46-home-award-feature.is-current');
  const mediaId=await featured.getAttribute('data-open-anime');
  expect(Number(mediaId)).toBeGreaterThan(0);
  await featured.click();
  await page.waitForURL(url=>(url.searchParams.get('p')||url.pathname).includes(`/anime/`)&&(url.searchParams.get('p')||url.pathname).endsWith(`-${mediaId}`),{timeout:10000});
});

test('Home rails share aligned controls smooth movement and directional fades',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(()=>localStorage.setItem('aninexus:theme','dark'));
  await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});
  const section=page.locator('#nx35Season').locator('xpath=ancestor::section[1]');
  const rail=section.locator('.nx44-rail');
  const frame=section.locator('.nx44-rail-frame');
  const actions=section.locator('.nx44-rail-actions');
  const previous=actions.locator('[data-nx44-rail-dir="prev"]');
  const next=actions.locator('[data-nx44-rail-dir="next"]');
  await expect(rail).toBeVisible({timeout:30000});
  await expect(actions).toBeVisible();
  await expect(previous).toBeDisabled();
  await expect(next).toBeEnabled();
  await expect(frame).toHaveAttribute('data-nx44-left','0');
  await expect(frame).toHaveAttribute('data-nx44-right','1');
  expect(await frame.evaluate(element=>parseFloat(getComputedStyle(element,'::after').opacity))).toBeGreaterThan(.5);
  expect(await actions.evaluate(element=>[...element.children].map(child=>child.tagName))).toEqual(['BUTTON','BUTTON','A']);
  const geometry=await actions.evaluate(element=>{const box=element.getBoundingClientRect(),head=element.closest('.nx35-head').getBoundingClientRect();return{left:box.left,right:box.right,headLeft:head.left,headRight:head.right}});
  expect(geometry.left).toBeGreaterThanOrEqual(geometry.headLeft-.5);
  expect(geometry.right).toBeLessThanOrEqual(geometry.headRight+.5);
  const presentation=await section.evaluate(element=>{
    const head=element.querySelector('.nx35-head'),copy=head.firstElementChild,actions=head.querySelector('.nx44-rail-actions'),button=actions.querySelector('.nx44-rail-button'),icon=button.querySelector('.nx44-rail-chevron'),link=actions.querySelector('a'),title=head.querySelector('h2'),subtitle=head.querySelector('p'),cardTitle=element.querySelector('.nx44-rail h3');
    const sectionBox=element.getBoundingClientRect(),copyBox=copy.getBoundingClientRect(),actionsBox=actions.getBoundingClientRect(),buttonBox=button.getBoundingClientRect(),iconBox=icon.getBoundingClientRect(),buttonStyle=getComputedStyle(button),copyStyle=getComputedStyle(copy),actionsStyle=getComputedStyle(actions),linkStyle=getComputedStyle(link);
    return{sectionLeft:sectionBox.left,sectionRight:sectionBox.right,copyLeft:copyBox.left,copyRight:copyBox.right,copyBottom:copyBox.bottom,actionsTop:actionsBox.top,copyBorderBottom:parseFloat(copyStyle.borderBottomWidth),copyBorderColor:copyStyle.borderBottomColor,actionsBorderTop:parseFloat(actionsStyle.borderTopWidth),actionsBorderBottom:parseFloat(actionsStyle.borderBottomWidth),buttonWidth:buttonBox.width,buttonHeight:buttonBox.height,iconCenterX:Math.abs((iconBox.left+iconBox.right)/2-(buttonBox.left+buttonBox.right)/2),iconCenterY:Math.abs((iconBox.top+iconBox.bottom)/2-(buttonBox.top+buttonBox.bottom)/2),borderWidth:parseFloat(buttonStyle.borderTopWidth),background:buttonStyle.backgroundColor,titleSize:parseFloat(getComputedStyle(title).fontSize),subtitleSize:parseFloat(getComputedStyle(subtitle).fontSize),linkSize:parseFloat(linkStyle.fontSize),linkWeight:parseInt(linkStyle.fontWeight,10),cardTitleSize:parseFloat(getComputedStyle(cardTitle).fontSize)};
  });
  expect(presentation.copyLeft).toBeGreaterThan(presentation.sectionLeft+5);
  expect(presentation.copyRight).toBeLessThan(presentation.sectionRight-5);
  expect(presentation.copyBottom).toBeLessThanOrEqual(presentation.actionsTop+.5);
  expect(presentation.copyBorderBottom).toBe(1);
  expect(presentation.copyBorderColor).toContain('255, 255, 255');
  expect(presentation.actionsBorderTop).toBe(0);
  expect(presentation.actionsBorderBottom).toBe(0);
  expect(presentation.buttonWidth).toBeLessThanOrEqual(32.5);
  expect(presentation.buttonHeight).toBeLessThanOrEqual(32.5);
  expect(presentation.iconCenterX).toBeLessThanOrEqual(.5);
  expect(presentation.iconCenterY).toBeLessThanOrEqual(.5);
  expect(presentation.borderWidth).toBe(0);
  expect(presentation.background).toBe('rgba(0, 0, 0, 0)');
  expect(presentation.titleSize).toBeGreaterThanOrEqual(24);
  expect(presentation.subtitleSize).toBeGreaterThanOrEqual(13);
  expect(presentation.linkSize).toBeGreaterThanOrEqual(13);
  expect(presentation.linkWeight).toBeLessThanOrEqual(700);
  expect(presentation.cardTitleSize).toBeGreaterThanOrEqual(14);
  const tonalBorders=await page.locator('.nx35-section.tonal.nx44-has-rail').first().evaluate(element=>{const style=getComputedStyle(element);return{top:parseFloat(style.borderTopWidth),bottom:parseFloat(style.borderBottomWidth)}});
  expect(tonalBorders).toEqual({top:0,bottom:0});
  const movement=await rail.evaluate(element=>{
    const first=element.firstElementChild,second=first?.nextElementSibling,style=getComputedStyle(element),gap=parseFloat(style.columnGap||style.gap)||0,unit=second?second.getBoundingClientRect().left-first.getBoundingClientRect().left:first.getBoundingClientRect().width+gap,visibleItems=Math.max(1,Math.floor((element.clientWidth+gap)/unit)),max=Math.max(0,element.scrollWidth-element.clientWidth);
    return{unit,visibleItems,target:Math.min(max,element.clientWidth,unit*visibleItems)};
  });
  expect(movement.visibleItems).toBeGreaterThanOrEqual(2);
  expect(movement.target).toBeGreaterThan(movement.unit*1.5);
  await next.click();
  await expect.poll(()=>rail.evaluate(element=>element.scrollLeft)).toBeGreaterThanOrEqual(movement.target-5);
  await expect(frame).toHaveAttribute('data-nx44-left','1');
  await expect(previous).toBeEnabled();
  await noOverflow(page,2);
});

test('Home schedule uses bare official brands aligned episodes and one content surface',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.addInitScript(()=>localStorage.setItem('aninexus:theme','dark'));
  await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});
  const schedule=page.locator('#nx35Schedule');
  await expect(schedule.locator('.nx18-card').first()).toBeVisible({timeout:30000});
  const crunchy=schedule.locator('.nx18-provider-logo[data-provider="crunchyroll"] img').first();
  const youtube=schedule.locator('.nx18-provider-logo[data-provider="youtube"] img').first();
  await expect(crunchy).toBeVisible();
  await expect(youtube).toBeVisible();
  expect(new URL(await crunchy.getAttribute('src'),page.url()).pathname).toMatch(/\/assets\/streaming\/crunchyroll\.svg$/);
  expect(new URL(await youtube.getAttribute('src'),page.url()).pathname).toMatch(/\/assets\/streaming\/youtube\.svg$/);

  const providerPresentation=await schedule.locator('.nx18-stream').first().evaluate(link=>{const logo=link.querySelector('img'),linkStyle=getComputedStyle(link),logoStyle=getComputedStyle(logo);return{border:parseFloat(linkStyle.borderTopWidth),radius:parseFloat(linkStyle.borderTopLeftRadius),background:linkStyle.backgroundColor,shadow:linkStyle.boxShadow,logoBackground:logoStyle.backgroundColor,logoPadding:parseFloat(logoStyle.paddingTop)}});
  expect(providerPresentation).toEqual({border:0,radius:0,background:'rgba(0, 0, 0, 0)',shadow:'none',logoBackground:'rgba(0, 0, 0, 0)',logoPadding:0});

  const episodeGeometry=await schedule.locator('.nx18-card').first().evaluate(card=>{const info=card.querySelector('.nx18-info'),episode=card.querySelector('.nx18-episode'),label=episode.querySelector('small'),number=episode.querySelector('strong'),infoBox=info.getBoundingClientRect(),episodeBox=episode.getBoundingClientRect(),labelBox=label.getBoundingClientRect(),numberBox=number.getBoundingClientRect(),numberStyle=getComputedStyle(number);return{right:infoBox.right-episodeBox.right,bottom:infoBox.bottom-episodeBox.bottom,insideLeft:episodeBox.left>=infoBox.left,insideTop:episodeBox.top>=infoBox.top,orderGap:numberBox.top-labelBox.bottom,fontStyle:numberStyle.fontStyle,fontSize:parseFloat(numberStyle.fontSize),letterSpacing:numberStyle.letterSpacing}});
  expect(episodeGeometry.right).toBeGreaterThanOrEqual(13);
  expect(episodeGeometry.right).toBeLessThanOrEqual(15);
  expect(episodeGeometry.bottom).toBeGreaterThanOrEqual(12);
  expect(episodeGeometry.bottom).toBeLessThanOrEqual(14);
  expect(episodeGeometry.insideLeft).toBe(true);
  expect(episodeGeometry.insideTop).toBe(true);
  expect(episodeGeometry.orderGap).toBeGreaterThanOrEqual(2);
  expect(episodeGeometry.fontStyle).toBe('italic');
  expect(episodeGeometry.fontSize).toBe(32);
  expect(episodeGeometry.letterSpacing).toBe('normal');

  const scheduleTypography=await schedule.locator('.nx18-card').first().evaluate(card=>{const weight=selector=>{const element=card.querySelector(selector);return element?parseInt(getComputedStyle(element).fontWeight,10):null};return{air:weight('.nx18-air'),time:weight('.nx18-air b'),title:weight('h3'),countdown:weight('.nx18-countdown>span'),countdownLabel:weight('.nx18-countdown small'),score:weight('.nx18-score b'),episodeLabel:weight('.nx18-episode small'),titleSpacing:getComputedStyle(card.querySelector('h3')).letterSpacing}});
  expect(scheduleTypography).toEqual({air:600,time:600,title:600,countdown:600,countdownLabel:500,score:null,episodeLabel:600,titleSpacing:'normal'});

  const surfaces=await page.locator('.nx35-home .nx35-section, .nx35-home .nx38-impressions-home').evaluateAll(elements=>[...new Set(elements.map(element=>getComputedStyle(element).backgroundColor))]);
  expect(surfaces).toEqual(['rgb(8, 6, 8)']);

  const programLink=page.getByRole('link',{name:'Programação completa',exact:true});
  const newsLink=page.getByRole('link',{name:'Todas as notícias',exact:true});
  await expect(programLink).toBeVisible();
  await expect(newsLink).toBeVisible({timeout:15000});
  const linkStyles=await Promise.all([programLink,newsLink].map(link=>link.evaluate(element=>{const style=getComputedStyle(element),icon=element.querySelector('svg')?.getBoundingClientRect();return{fontSize:style.fontSize,fontWeight:style.fontWeight,fontFamily:style.fontFamily,minHeight:style.minHeight,iconWidth:icon?.width,iconHeight:icon?.height}})));
  expect(linkStyles[0]).toEqual(linkStyles[1]);
  await noOverflow(page,2);
});

test('production Home falls back when its API returns empty successful payloads',async({page})=>{test.skip(new URL(ORIGIN).hostname.endsWith('github.io'),'This regression requires the production fetch bridge.');const origin=new URL(ORIGIN).origin;await page.route(`${origin}/api/home**`,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({season:[],schedule:[],top:[],popular:[],reading:[],soon:[]})}));await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});await expect(page.locator('#nx35Season .nx35-anime').first()).toBeVisible({timeout:30000});await expect(page.locator('#nx35Schedule .nx18-card').first()).toBeVisible();await expect(page.locator('#nx35Top .nx35-metric-empty')).toContainText('avaliações da comunidade');await expect(page.locator('#nx35Popular .nx35-metric-empty')).toContainText('listas, favoritos e impressões');await expect(page.locator('#nx35Top .nx35-rank')).toHaveCount(0);await expect(page.locator('#nx35Popular .nx35-anime')).toHaveCount(0);await expect(page.locator('#nx35Reading .nx35-reading').first()).toBeVisible();await expect(page.locator('#nx35Soon .nx35-anime').first()).toBeVisible();await expect(page.locator('[data-nx35-retry]')).toHaveCount(0)});

test('production schedule renders normalized VPS titles covers and internal scores on mobile',async({page})=>{test.skip(new URL(ORIGIN).hostname.endsWith('github.io'),'This regression requires the production API path.');await page.setViewportSize({width:390,height:844});const origin=new URL(ORIGIN).origin,now=Math.floor(Date.now()/1000)+3600,normalized={id:901,title:'Título Normalizado da VPS',titleRomaji:'VPS Normalized Title',cover:pixel,score:8.7,metricsSource:'aninexus',genres:['Action'],episodes:12,format:'TV',seasonYear:2026,streaming:[]};await page.route(`${origin}/api/schedule**`,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{airingAt:now,episode:4,media:normalized}])}));await page.goto(pageUrl('/animes/programacao'),{waitUntil:'domcontentloaded'});const card=page.locator('.nx18-card').first();await expect(card).toBeVisible({timeout:30000});await expect(card.locator('h3')).toHaveText('Título Normalizado da VPS');await expect(card.locator('.nx18-cover img')).toHaveAttribute('src',pixel);await expect(card.locator('.nx18-score')).toContainText('8.7');await noOverflow(page,2)});

test('mobile header always exposes account access while anonymous',async({page})=>{await page.setViewportSize({width:390,height:844});await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});await expect(page.locator('.top-actions>[data-action="login"]')).toBeVisible({timeout:15000});await expect(page.locator('.top-actions>[data-action="register"]')).toBeHidden();await expect(page.locator('.menu-btn')).toBeVisible();await noOverflow(page,2)});

test('mobile Home starts with transparent header centered copy spacing and clipped member avatar',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(({pixel,portrait})=>localStorage.setItem('aninexus:community:activity:v40',JSON.stringify([{id:'avatar-test',kind:'state',media_id:101,username:'kayky',display_name:'Kayky Sousa',avatar_url:portrait,status:'CURRENT',created_at:new Date().toISOString(),title:'Anime Teste 101',cover:pixel,media:{id:101,title:'Anime Teste 101',cover:pixel}}])),{pixel,portrait});
  await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});
  await expect(page.locator('.nx35-home')).toBeVisible({timeout:30000});
  const avatar=page.locator('#nx35CommunityHero .nx35-community-avatar>img').first();
  await expect(avatar).toBeVisible({timeout:15000});
  await expect(avatar).toHaveAttribute('src',portrait);
  await expect.poll(()=>avatar.evaluate(img=>img.naturalHeight/img.naturalWidth)).toBe(1.5);
  const avatarGeometry=await avatar.evaluate(img=>{const holder=img.parentElement,box=img.getBoundingClientRect(),holderBox=holder.getBoundingClientRect(),style=getComputedStyle(img);return{left:box.left,top:box.top,right:box.right,bottom:box.bottom,width:box.width,height:box.height,holderLeft:holderBox.left,holderTop:holderBox.top,holderRight:holderBox.right,holderBottom:holderBox.bottom,holderWidth:holderBox.width,holderHeight:holderBox.height,fit:style.objectFit,position:style.objectPosition,overflow:getComputedStyle(holder).overflow}});
  expect(avatarGeometry.left).toBeGreaterThanOrEqual(avatarGeometry.holderLeft-.5);
  expect(avatarGeometry.top).toBeGreaterThanOrEqual(avatarGeometry.holderTop-.5);
  expect(avatarGeometry.right).toBeLessThanOrEqual(avatarGeometry.holderRight+.5);
  expect(avatarGeometry.bottom).toBeLessThanOrEqual(avatarGeometry.holderBottom+.5);
  expect(avatarGeometry.holderWidth-avatarGeometry.width).toBeLessThanOrEqual(4.5);
  expect(avatarGeometry.holderHeight-avatarGeometry.height).toBeLessThanOrEqual(4.5);
  expect(avatarGeometry.fit).toBe('cover');
  expect(avatarGeometry.position).toMatch(/^50% 0(?:px|%)$/);
  expect(avatarGeometry.overflow).toBe('hidden');
  const communityPresentation=await page.locator('#nx35CommunityHero .nx35-community-card.compact').first().evaluate(card=>{const before=getComputedStyle(card,'::before'),copy=card.querySelector('p'),name=copy.querySelector('b'),title=copy.querySelector('strong'),time=card.querySelector('small');return{display:before.display,backgroundImage:before.backgroundImage,opacity:parseFloat(before.opacity),copySize:parseFloat(getComputedStyle(copy).fontSize),copyWeight:parseInt(getComputedStyle(copy).fontWeight,10),nameWeight:parseInt(getComputedStyle(name).fontWeight,10),titleWeight:parseInt(getComputedStyle(title).fontWeight,10),timeSize:parseFloat(getComputedStyle(time).fontSize),timeWeight:parseInt(getComputedStyle(time).fontWeight,10)}});
  expect(communityPresentation.display).toBe('block');
  expect(communityPresentation.backgroundImage).toContain('image/svg+xml');
  expect(communityPresentation.opacity).toBeGreaterThanOrEqual(.72);
  expect(communityPresentation.opacity).toBeLessThanOrEqual(.76);
  expect(communityPresentation.copySize).toBeGreaterThanOrEqual(11);
  expect(communityPresentation.copyWeight).toBe(600);
  expect(communityPresentation.nameWeight).toBe(600);
  expect(communityPresentation.titleWeight).toBe(600);
  expect(communityPresentation.timeSize).toBeGreaterThanOrEqual(9);
  expect(communityPresentation.timeWeight).toBe(500);
  const initial=await page.evaluate(()=>{const header=document.querySelector('#topbar'),copy=document.querySelector('.nx35-hero-copy'),live=document.querySelector('.nx35-live'),grid=document.querySelector('.nx35-hero-grid'),copyBox=copy.getBoundingClientRect(),liveBox=live.getBoundingClientRect(),style=getComputedStyle(header);return{background:style.backgroundColor,position:style.position,textAlign:getComputedStyle(copy).textAlign,gap:parseFloat(getComputedStyle(grid).rowGap),separation:liveBox.top-copyBox.bottom}});
  expect(initial.background).toBe('rgba(0, 0, 0, 0)');
  expect(initial.position).toBe('fixed');
  expect(initial.textAlign).toBe('center');
  expect(initial.gap).toBeGreaterThanOrEqual(44);
  expect(initial.separation).toBeGreaterThanOrEqual(40);
  await page.evaluate(()=>scrollTo(0,160));
  await expect(page.locator('#topbar')).toHaveClass(/is-scrolled/);
  await expect.poll(()=>page.locator('#topbar').evaluate(element=>getComputedStyle(element).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  await noOverflow(page,2);
});

test('Home community banner survives initialization with one shared renderer',async({page})=>{
  let communityMediaQueries=0;
  await page.unroute('https://graphql.anilist.co/');
  await page.route('https://graphql.anilist.co/',async route=>{let body={};try{body=route.request().postDataJSON()||{}}catch{}const query=String(body.query||''),isCommunityMedia=/media\(id_in:\$ids,type:ANIME\)/.test(query);if(isCommunityMedia){communityMediaQueries++;const data=communityMediaQueries===1?graphData(query,body.variables):{Page:{media:[]}};return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data})})}return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:graphData(query,body.variables)})})});
  await page.addInitScript(pixel=>localStorage.setItem('aninexus:community:activity:v40',JSON.stringify([{id:'single-owner',kind:'state',media_id:101,username:'kayky',display_name:'Kayky Sousa',status:'CURRENT',created_at:new Date().toISOString(),title:'Anime Teste 101',cover:pixel,media:{id:101,title:'Anime Teste 101',cover:pixel}}])),pixel);
  await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});
  const hero=page.locator('#nx35CommunityHero');
  const card=hero.locator('.nx35-community-card.compact').first();
  await expect(card).toBeVisible({timeout:30000});
  await expect(hero).toHaveAttribute('data-nx-community-owner','shared');
  await expect.poll(()=>card.evaluate(element=>getComputedStyle(element,'::before').backgroundImage)).toContain('image/svg+xml');
  await page.waitForTimeout(1100);
  expect(communityMediaQueries).toBe(1);
  expect(await card.evaluate(element=>getComputedStyle(element,'::before').backgroundImage)).toContain('image/svg+xml');
});

test('radio has a stable volume popover and becomes one floating button after play',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await bridgeProductionAssets(page);
  await page.addInitScript(()=>{
    class FakeSocket extends EventTarget{
      static CONNECTING=0;static OPEN=1;
      constructor(){super();this.readyState=0;setTimeout(()=>{this.readyState=1;this.dispatchEvent(new Event('open'));this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({op:0,d:{heartbeat:30000}})}));this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({op:1,t:'TRACK_UPDATE',d:{song:{title:'Akatsuki',artists:[{nameRomaji:'Arashi'}]}}})}))},50)}
      send(){}close(){this.readyState=3;this.dispatchEvent(new Event('close'))}
    }
    Object.defineProperty(window,'WebSocket',{value:FakeSocket,configurable:true,writable:true});
    HTMLMediaElement.prototype.play=function(){queueMicrotask(()=>this.dispatchEvent(new Event('playing')));return Promise.resolve()};
    HTMLMediaElement.prototype.pause=function(){queueMicrotask(()=>this.dispatchEvent(new Event('pause')))};
  });
  await page.goto(firstVisitUrl('/'),{waitUntil:'domcontentloaded'});
  const inline=page.locator('.nx44-radio--inline');
  await expect(inline).toBeVisible({timeout:30000});
  await expect(inline).toContainText('Akatsuki');
  await expect(inline).toContainText('Arashi');
  await expect(inline.locator('button')).toHaveCount(2);
  const volumeButton=inline.getByRole('button',{name:/Ajustar volume/});
  await volumeButton.click();
  await expect(volumeButton).toHaveAttribute('aria-expanded','true');
  await expect(inline.locator('[data-nx44-volume-panel]')).toBeVisible();
  const range=inline.locator('[data-nx44-volume-range]');
  await expect(range).toHaveCount(1);
  await range.evaluate(input=>{input.value='36';input.dispatchEvent(new Event('input',{bubbles:true}))});
  expect(await page.locator('#nx44RadioAudio').evaluate(audio=>Math.round(audio.volume*100))).toBe(36);
  await expect(inline.locator('[data-nx44-volume-value]')).toHaveText('36%');
  expect(await inline.evaluate(element=>getComputedStyle(element,'::before').backgroundImage)).toContain('radio-background-v44.png');
  await inline.getByRole('button',{name:'Ouvir rádio'}).click();
  await expect(inline).toHaveAttribute('data-state','playing');
  await page.evaluate(()=>window.AniNexusRadio.navigate('/animes/catalogo'));
  await expect(page.locator('.nx21-catalog-page')).toBeVisible({timeout:30000});
  const floating=page.locator('.nx44-radio--float');
  await expect(floating).toBeVisible();
  await expect(floating).toHaveAttribute('data-state','playing');
  await expect(floating.locator('button')).toHaveCount(1);
  await expect(floating.locator('input')).toHaveCount(0);
  await expect(page.locator('#nx44RadioAudio')).toHaveCount(1);
  await noOverflow(page,2);
});

test('internal pages do not show the radio before an explicit Home play',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await bridgeProductionAssets(page);
  await page.goto(firstVisitUrl('/animes/temporadas'),{waitUntil:'domcontentloaded'});
  await expect(page.locator('.nx-season')).toBeVisible({timeout:30000});
  await expect(page.locator('.nx44-radio')).toHaveCount(0);
  await expect(page.locator('#nx44RadioAudio')).toHaveCount(1);
});

test('header navigation preserves the same playing audio node',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await bridgeProductionAssets(page);
  await page.addInitScript(()=>{
    class FakeSocket extends EventTarget{static CONNECTING=0;static OPEN=1;constructor(){super();this.readyState=1}send(){}close(){this.readyState=3}}
    Object.defineProperty(window,'WebSocket',{value:FakeSocket,configurable:true,writable:true});
    HTMLMediaElement.prototype.play=function(){window.__nxPlayCalls=(window.__nxPlayCalls||0)+1;queueMicrotask(()=>this.dispatchEvent(new Event('playing')));return Promise.resolve()};
    HTMLMediaElement.prototype.pause=function(){queueMicrotask(()=>this.dispatchEvent(new Event('pause')))};
  });
  await page.goto(firstVisitUrl('/'),{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Ouvir rádio'}).click();
  await expect(page.locator('.nx44-radio--inline')).toHaveAttribute('data-state','playing');
  await page.evaluate(()=>window.__nxOriginalAudio=document.querySelector('#nx44RadioAudio'));
  const destinations=[['anime','.nx21-catalog-page'],['manga','.nx42-manga-page'],['season','.nx-season'],['schedule','.nx18-schedule'],['news','.nx35-news-page'],['home','.nx35-home']];
  for(const[key,selector]of destinations){
    await page.locator(`.main-nav [data-nav="${key}"]`).click();
    await expect(page.locator(selector)).toBeVisible({timeout:30000});
    await expect(page.locator(key==='home'?'.nx44-radio--inline':'.nx44-radio--float')).toHaveAttribute('data-state','playing');
    expect(await page.evaluate(()=>document.querySelector('#nx44RadioAudio')===window.__nxOriginalAudio),key).toBe(true);
  }
  expect(await page.evaluate(()=>window.__nxPlayCalls)).toBe(1);
});

test('floating radio stays above first-visit privacy controls',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await bridgeProductionAssets(page);
  await page.addInitScript(()=>{class FakeSocket extends EventTarget{static CONNECTING=0;static OPEN=1;constructor(){super();this.readyState=1}send(){}close(){this.readyState=3}}Object.defineProperty(window,'WebSocket',{value:FakeSocket,configurable:true,writable:true});HTMLMediaElement.prototype.play=function(){queueMicrotask(()=>this.dispatchEvent(new Event('playing')));return Promise.resolve()};HTMLMediaElement.prototype.pause=function(){queueMicrotask(()=>this.dispatchEvent(new Event('pause')))}});
  await page.goto(firstVisitUrl('/'),{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Ouvir rádio'}).click();
  await page.evaluate(()=>window.AniNexusRadio.navigate('/animes/catalogo'));
  await expect(page.locator('.nx21-catalog-page')).toBeVisible({timeout:30000});
  const floating=page.locator('.nx44-radio--float'),consent=page.locator('.nx42-consent');
  await expect(floating).toBeVisible({timeout:30000});
  await expect(consent).toBeVisible({timeout:15000});
  await expect.poll(async()=>{const radioBox=await floating.boundingBox(),consentBox=await consent.boundingBox();return consentBox.y-(radioBox.y+radioBox.height)}).toBeGreaterThanOrEqual(10);
  await noOverflow(page,2);
});

test('radio resumes after a full document reload only after the user starts it',async({page})=>{await page.setViewportSize({width:1440,height:900});await page.addInitScript(()=>{class FakeSocket extends EventTarget{static CONNECTING=0;static OPEN=1;constructor(){super();this.readyState=1}send(){}close(){this.readyState=3}}Object.defineProperty(window,'WebSocket',{value:FakeSocket,configurable:true,writable:true});HTMLMediaElement.prototype.play=function(){queueMicrotask(()=>this.dispatchEvent(new Event('playing')));return Promise.resolve()};HTMLMediaElement.prototype.pause=function(){queueMicrotask(()=>this.dispatchEvent(new Event('pause')))}});await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});const inline=page.locator('.nx44-radio--inline');await expect(inline).toHaveAttribute('data-state','paused',{timeout:30000});await inline.getByRole('button',{name:'Ouvir rádio'}).click();await expect(inline).toHaveAttribute('data-state','playing');await page.reload({waitUntil:'domcontentloaded'});const resumed=page.locator('.nx44-radio--inline');await expect(resumed).toHaveAttribute('data-state','playing');expect(JSON.parse(await page.evaluate(()=>sessionStorage.getItem('aninexus:radio:resume:v44')))).toMatchObject({playing:true});await resumed.getByRole('button',{name:'Pausar rádio'}).click();await expect(resumed).toHaveAttribute('data-state','paused');expect(await page.evaluate(()=>sessionStorage.getItem('aninexus:radio:resume:v44'))).toBeNull();await page.reload({waitUntil:'domcontentloaded'});await expect(page.locator('.nx44-radio--inline')).toHaveAttribute('data-state','paused');await noOverflow(page,2)});

test('starting the radio in a second tab pauses the first tab',async({browser})=>{const context=await browser.newContext({viewport:{width:390,height:844}});await context.addInitScript(()=>{class FakeSocket extends EventTarget{static CONNECTING=0;static OPEN=1;constructor(){super();this.readyState=1}send(){}close(){this.readyState=3}}Object.defineProperty(window,'WebSocket',{value:FakeSocket,configurable:true,writable:true});HTMLMediaElement.prototype.play=function(){queueMicrotask(()=>this.dispatchEvent(new Event('playing')));return Promise.resolve()};HTMLMediaElement.prototype.pause=function(){queueMicrotask(()=>this.dispatchEvent(new Event('pause')))}});const first=await context.newPage(),second=await context.newPage();await first.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});await second.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});await first.getByRole('button',{name:'Ouvir rádio'}).click();await expect(first.locator('.nx44-radio')).toHaveAttribute('data-state','playing');await second.getByRole('button',{name:'Ouvir rádio'}).click();await expect(second.locator('.nx44-radio')).toHaveAttribute('data-state','playing');await expect(first.locator('.nx44-radio')).toHaveAttribute('data-state','paused');await context.close()});

test('legacy local activity never renders a broken voce profile link',async({page})=>{await page.addInitScript(()=>localStorage.setItem('aninexus:community:activity:v40',JSON.stringify([{id:'legacy-voce',kind:'state',media_id:101,username:'você',status:'CURRENT',created_at:new Date().toISOString(),title:'Anime Teste 101',local:true}])));await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});const hero=page.locator('#nx35CommunityHero');await expect(hero).toContainText('Sua lista',{timeout:30000});await expect(hero).not.toContainText('você');await expect(hero.locator('a[href*="/u/voc"]')).toHaveCount(0)});

test('local activity adopts the signed-in member name avatar and public profile',async({page})=>{await page.addInitScript(pixel=>localStorage.setItem('aninexus:community:activity:v40',JSON.stringify([{id:'signed-member',kind:'state',media_id:101,username:'',display_name:'',avatar_url:'',status:'CURRENT',created_at:new Date().toISOString(),title:'Anime Teste 101',cover:pixel,local:true}])),pixel);await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});await page.evaluate(pixel=>{window.AniNexusAccountData=async()=>({displayName:'Kayky Sousa',username:'kayky',avatarUrl:pixel});dispatchEvent(new CustomEvent('aninexus:account-identity-changed'))},pixel);const hero=page.locator('#nx35CommunityHero');await expect(hero).toContainText('Kayky Sousa',{timeout:30000});await expect(hero.locator('.nx35-community-avatar>img')).toHaveAttribute('src',pixel);await expect(hero.locator('a').first()).toHaveAttribute('href',/kayky/);await expect(hero).not.toContainText('Sua lista')});

test('mobile drawer is colorful account-aware and limited to six destinations',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(firstVisitUrl('/'),{waitUntil:'domcontentloaded'});
  await expect(page.locator('.nx42-consent')).toBeVisible();
  await page.locator('[data-action="drawer-open"]').click();
  const drawer=page.locator('#drawer'),panel=drawer.locator('.drawer-panel'),auth=drawer.locator('.drawer-auth-card'),links=drawer.locator('.drawer-nav-grid>a'),theme=drawer.locator('[data-nx-drawer-theme]'),install=drawer.locator('[data-nx-install]');
  await expect(panel).toBeVisible();
  await expect(links).toHaveCount(6);
  expect(await links.locator('strong').allTextContents()).toEqual(['Início','Animes','Mangás','Temporadas','Programação','Notícias']);
  await expect(drawer.locator('.drawer-nav-grid small')).toHaveCount(6);
  await expect(auth.getByRole('button',{name:'Entrar',exact:true})).toBeVisible();
  await expect(auth.getByRole('button',{name:'Criar conta',exact:true})).toBeVisible();
  await expect.poll(()=>panel.evaluate(element=>Math.abs(innerWidth-element.getBoundingClientRect().right))).toBeLessThanOrEqual(1);
  const geometry=await panel.evaluate(element=>{const box=element.getBoundingClientRect();return{top:box.top,bottom:Math.abs(innerHeight-box.bottom),height:box.height,radius:parseFloat(getComputedStyle(element).borderTopLeftRadius)}});
  expect(Math.abs(geometry.top)).toBeLessThanOrEqual(1);
  expect(geometry.bottom).toBeLessThanOrEqual(1);
  expect(geometry.height).toBeGreaterThanOrEqual(843);
  expect(geometry.radius).toBe(0);
  await expect(theme).toBeVisible();
  await expect(drawer.locator('.nx42-theme-card')).toHaveCount(0);
  const initialTheme=await page.locator('html').getAttribute('data-theme'),nextTheme=initialTheme==='dark'?'light':'dark';
  await theme.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme',nextTheme);
  await theme.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme',initialTheme);
  await expect(install).toBeVisible();
  await page.evaluate(()=>Object.defineProperty(navigator,'userAgent',{configurable:true,get:()=> 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'}));
  await install.click();
  const guide=page.locator('.nx44-install-sheet');
  await expect(guide).toBeVisible();
  await expect(guide.getByRole('heading',{name:'Instalar o AniNexus'})).toBeVisible();
  await expect(guide.locator('li')).toHaveCount(3);
  await expect(guide).toContainText('Adicionar à Tela de Início');
  await guide.getByRole('button',{name:'Entendi'}).click();
  await expect(guide).toHaveCount(0);
  await page.evaluate(()=>{window.__nxNativeInstallPrompted=false;const event=new Event('beforeinstallprompt',{cancelable:true});Object.defineProperty(event,'prompt',{value:async()=>{window.__nxNativeInstallPrompted=true}});Object.defineProperty(event,'userChoice',{value:Promise.resolve({outcome:'dismissed'})});dispatchEvent(event)});
  await expect(install).toHaveAttribute('data-install-ready','native');
  await install.click();
  expect(await page.evaluate(()=>window.__nxNativeInstallPrompted)).toBe(true);
  const mascot=drawer.locator('.drawer-mascot-perch img');
  await expect(mascot).toBeVisible();
  const mascotGeometry=await drawer.evaluate(element=>{const perch=element.querySelector('.drawer-mascot-perch').getBoundingClientRect(),image=element.querySelector('.drawer-mascot-perch img').getBoundingClientRect(),utilities=element.querySelector('.drawer-utilities').getBoundingClientRect();return{width:image.width,imageCenter:image.left+image.width/2,perchCenter:perch.left+perch.width/2,imageBottom:image.bottom,perchBottom:perch.bottom,utilitiesTop:utilities.top,pointer:getComputedStyle(element.querySelector('.drawer-mascot-perch')).pointerEvents}});
  expect(mascotGeometry.width).toBeLessThanOrEqual(180);
  expect(Math.abs(mascotGeometry.imageCenter-mascotGeometry.perchCenter)).toBeLessThanOrEqual(1);
  expect(Math.abs(mascotGeometry.imageBottom-mascotGeometry.perchBottom)).toBeLessThanOrEqual(2);
  expect(mascotGeometry.utilitiesTop).toBeGreaterThanOrEqual(mascotGeometry.perchBottom-1);
  expect(mascotGeometry.pointer).toBe('none');
  await page.evaluate(()=>window.AniNexusAuthV38.syncDrawerIdentity({id:'user_without_photo',firstName:'Kayky',username:'kayky',imageUrl:'https://img.clerk.com/default.png',hasImage:false}));
  await expect(auth.locator('.drawer-account-avatar img')).toHaveAttribute('src',/assets\/avatars\/mascot-/);
  await page.evaluate(pixel=>window.AniNexusAuthV38.syncDrawerIdentity({firstName:'Kayky',username:'kayky',imageUrl:pixel}),pixel);
  await expect(auth).toHaveAttribute('data-auth-state','authenticated');
  await expect(auth.locator('.drawer-account-avatar img')).toHaveAttribute('src',pixel);
  await expect(auth.locator('h3')).toHaveText('Kayky');
  await expect(auth.locator('p')).toHaveText('@kayky');
  await expect(auth.getByRole('button',{name:'Minha conta',exact:true})).toBeVisible();
  await expect(auth.getByRole('button',{name:'Entrar',exact:true})).toHaveCount(0);
  await page.evaluate(()=>window.AniNexusAuthV38.syncDrawerIdentity());
  await page.setViewportSize({width:320,height:700});
  await expect(auth.getByRole('button',{name:'Entrar',exact:true})).toBeVisible();
  await expect(auth.getByRole('button',{name:'Criar conta',exact:true})).toBeVisible();
  await expect(links).toHaveCount(6);
  await noOverflow(page,2);
});

test('Home keeps anime and manga rankings separate and visually distinct',async({page})=>{
  test.skip(new URL(ORIGIN).hostname.endsWith('github.io'),'Rankings require internal AniNexus metrics.');
  await mockInternalRankings(page);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width:1440,height:900});
  await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});
  const animeRank=page.locator('#nx35Top .nx45-rank-anime'),mangaRank=page.locator('#nx42TopManga .nx45-rank-manga');
  await expect(animeRank.first()).toBeVisible({timeout:30000});
  await expect(mangaRank.first()).toBeVisible({timeout:30000});
  expect(await animeRank.count()).toBeGreaterThan(0);
  expect(await mangaRank.count()).toBeGreaterThan(0);
  await expect(animeRank.first().locator('.nx45-rank-actions button')).toHaveCount(2);
  await expect(animeRank.first().locator('.nx45-rank-facts')).not.toBeEmpty();
  await expect(mangaRank.first().locator('.nx45-rank-facts')).not.toBeEmpty();
  const rankingPresentation=await animeRank.first().evaluate(card=>{
    const cover=card.querySelector('.nx35-rank-cover'),number=card.querySelector('.nx35-rank-num'),score=card.querySelector('.nx45-rank-score'),votes=card.querySelector('.nx45-rank-votes'),section=card.closest('section'),head=section.querySelector('.nx35-head'),copy=head.firstElementChild;
    return{duplicatePosition:card.querySelectorAll('.nx45-rank-position').length,coverScore:Boolean(cover.querySelector(':scope > b')),scoreInMetadata:Boolean(score&&score.parentElement?.classList.contains('nx45-rank-community')),scoreSharesReviews:Boolean(score&&votes&&score.parentElement===votes.parentElement),numberZ:Number(getComputedStyle(number).zIndex),coverZ:Number(getComputedStyle(cover).zIndex),headBottom:parseFloat(getComputedStyle(head).borderBottomWidth),copyBottom:parseFloat(getComputedStyle(copy).borderBottomWidth)};
  });
  expect(rankingPresentation.duplicatePosition).toBe(0);
  expect(rankingPresentation.coverScore).toBe(false);
  expect(rankingPresentation.scoreInMetadata).toBe(true);
  expect(rankingPresentation.scoreSharesReviews).toBe(true);
  expect(rankingPresentation.numberZ).toBeGreaterThan(rankingPresentation.coverZ);
  expect(rankingPresentation.headBottom).toBe(0);
  expect(rankingPresentation.copyBottom).toBe(1);
  const animeCopyGap=await animeRank.first().evaluate(card=>{const title=card.querySelector('h3'),facts=card.querySelector('.nx45-rank-facts'),range=document.createRange();range.selectNodeContents(title);return facts.getBoundingClientRect().top-range.getBoundingClientRect().bottom});
  expect(animeCopyGap).toBeLessThanOrEqual(7);
  await expect(page.locator('#nx35Top [data-nx42-type="manga"]')).toHaveCount(0);
  await expect(page.locator('#nx42TopManga [data-open-anime]')).toHaveCount(0);
  const animeBox=await animeRank.first().boundingBox(),mangaBox=await mangaRank.first().boundingBox();
  expect(animeBox.height).toBeGreaterThan(mangaBox.height+100);
  expect(mangaBox.width).toBeGreaterThan(animeBox.width+50);
  await page.setViewportSize({width:390,height:844});
  await expect(animeRank.first()).toBeVisible();
  await expect(mangaRank.first()).toBeVisible();
  await noOverflow(page,3);
});

test('Top 10 arrows replace all cards visible on the current page',async({page})=>{
  test.skip(new URL(ORIGIN).hostname.endsWith('github.io'),'Rankings require internal AniNexus metrics.');
  await mockInternalRankings(page);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width:1440,height:900});
  await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:width===390?844:900});
    for(const rootSelector of ['#nx35Top','#nx42TopManga','#nx47Characters']){
      const section=page.locator(rootSelector).locator('xpath=ancestor::section[1]'),rail=section.locator('.nx35-rank-rail'),next=section.locator('[data-nx44-rail-dir="next"]');
      await expect(rail).toBeVisible({timeout:30000});
      await rail.evaluate(element=>element.scrollTo({left:0,behavior:'auto'}));
      await page.waitForTimeout(50);
      const metrics=await rail.evaluate(element=>{const first=element.firstElementChild,second=first?.nextElementSibling,style=getComputedStyle(element),gap=parseFloat(style.columnGap||style.gap)||0,unit=second?second.getBoundingClientRect().left-first.getBoundingClientRect().left:first.getBoundingClientRect().width+gap,visible=Math.max(1,Math.ceil((element.clientWidth+gap)/unit)),max=Math.max(0,element.scrollWidth-element.clientWidth);return{start:element.scrollLeft,unit,visible,max}});
      expect(metrics.visible).toBeGreaterThanOrEqual(width===390?2:4);
      await expect(next).toBeEnabled();
      await next.click();
      const expected=Math.min(metrics.max,Math.round((metrics.start+metrics.unit*metrics.visible)/metrics.unit)*metrics.unit);
      await expect.poll(()=>rail.evaluate(element=>element.scrollLeft)).toBeGreaterThanOrEqual(expected-5);
    }
  }
});

test('Home character ranking favorites and reorders with internal counts',async({page})=>{
  test.skip(new URL(ORIGIN).hostname.endsWith('github.io')&&!!LOCAL_STATIC_ORIGIN,'Authenticated write behavior is covered against the source shell.');
  await mockInternalRankings(page);
  let writeMethod='';
  const favoriteRoute=async route=>{
    const request=route.request(),url=new URL(request.url());
    if(request.method()==='GET')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:[{characterId:501}]})});
    writeMethod=request.method();
    const id=Number(url.pathname.split('/').pop());
    await new Promise(resolve=>setTimeout(resolve,180));
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,characterId:id,favorite:true,favoriteCount:99})});
  };
  await page.route('**/api/me/character-favorites',favoriteRoute);
  await page.route('**/api/me/character-favorites/*',favoriteRoute);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.setViewportSize({width:1440,height:900});
  await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});
  const section=page.locator('.nx47-character-ranking'),cards=section.locator('.nx47-character-card');
  await expect(section).toBeVisible({timeout:30000});
  await expect(cards).toHaveCount(10);
  await expect(cards.first().locator('h3')).toHaveText('Monkey D. Luffy');
  await expect(section.getByRole('button',{name:/Remover Naruto Uzumaki/})).toHaveAttribute('aria-pressed','true');
  await expect(section.locator('.nx45-rank-score,.nx35-score')).toHaveCount(0);
  const order=await page.locator('#nx42TopManga,.nx47-character-ranking,#nx35Awards').evaluateAll(nodes=>nodes.map(node=>node.id||node.className));
  expect(order[0]).toBe('nx42TopManga');
  const anya=section.getByRole('button',{name:/Adicionar Anya Forger/});
  await anya.click();
  const anyaFavorite=section.locator('[data-character-favorite="508"]');
  await expect(anyaFavorite).toHaveClass(/nx39-pop/);
  await expect(anyaFavorite).toHaveAttribute('aria-pressed','true');
  await expect.poll(()=>writeMethod).toBe('PUT');
  await expect(cards.first().locator('h3')).toHaveText('Anya Forger');
  await expect(cards.first().locator('.nx47-character-count')).toContainText('99 favoritos');
  await expect(cards.first().getByRole('button')).toHaveAttribute('aria-pressed','true');
  const activeVisual=await cards.first().getByRole('button').evaluate(button=>({background:getComputedStyle(button).backgroundColor,fill:getComputedStyle(button.querySelector('svg')).fill}));
  expect(activeVisual).toEqual({background:'rgba(189, 24, 59, 0.93)',fill:'rgb(255, 255, 255)'});
  await expect(section.locator('.nx47-character-status')).toHaveCount(0);
  await expect(section).not.toContainText(/foi adicionado aos|foi removido dos/i);
  await page.setViewportSize({width:390,height:844});
  await expect(cards.first().locator('img')).toHaveCSS('object-fit','cover');
  const visual=await section.evaluate(element=>{
    const portrait=element.querySelector('.nx47-character-portrait'),button=element.querySelector('.nx47-character-favorite'),portraitBox=portrait.getBoundingClientRect(),buttonBox=button.getBoundingClientRect();
    return{kicker:element.querySelector('.nx35-head small')?.textContent?.trim(),bar:getComputedStyle(element,'::before').content,actionKind:button.dataset.nxActionKind,width:Math.round(buttonBox.width),height:Math.round(buttonBox.height),right:Math.round(portraitBox.right-buttonBox.right),bottom:Math.round(portraitBox.bottom-buttonBox.bottom)};
  });
  expect(visual).toEqual({kicker:'RANKING',bar:'none',actionKind:'compact',width:34,height:34,right:9,bottom:9});
  await noOverflow(page,3);
});

test('static fallback never turns provider metrics into AniNexus rankings',async({page})=>{test.skip(!new URL(ORIGIN).hostname.endsWith('github.io'),'This policy is exercised by the static provider fallback.');await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});await expect(page.locator('#nx35Top .nx35-metric-empty')).toContainText('avaliações da comunidade',{timeout:30000});await expect(page.locator('#nx35Popular .nx35-metric-empty')).toContainText('listas, favoritos e impressões');await expect(page.locator('#nx42TopManga .nx45-ranking-empty')).toContainText('comunidade avalia');await expect(page.locator('#nx35Top .nx35-rank')).toHaveCount(0);await expect(page.locator('#nx35Popular .nx35-anime')).toHaveCount(0);await expect(page.locator('#nx42TopManga .nx35-rank')).toHaveCount(0)});

test('Home ranking clicks are not swallowed by horizontal drag support',async({page})=>{test.skip(new URL(ORIGIN).hostname.endsWith('github.io'),'Rankings require internal AniNexus metrics.');await mockInternalRankings(page);await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});await expect(page.locator('#nx35Top .nx35-rank h3').first()).toBeVisible({timeout:30000});await page.locator('#nx35Top .nx35-rank h3').first().click();await page.waitForURL(url=>url.searchParams.get('p')?.startsWith('/anime/')||url.pathname.startsWith('/anime/'),{timeout:10000});await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});const manga=page.locator('#nx42TopManga a[data-nx42-type="manga"]').first();await expect(manga).toBeVisible({timeout:30000});await expect(manga).toHaveAttribute('data-nx23-dedicated',/\/manga\/.+-\d+/);await manga.locator('h3').click();await page.waitForURL(url=>url.searchParams.get('p')?.startsWith('/manga/')||url.pathname.startsWith('/manga/'),{timeout:10000})});

test('Awards uses a compact editorial grid without dead desktop regions',async({page})=>{await page.setViewportSize({width:1440,height:900});await page.goto(pageUrl('/anime-awards'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx42-awards-page')).toBeVisible({timeout:30000});await expect(page.getByRole('heading',{name:'Os destaques de cada ano'})).toBeVisible();const cards=page.locator('.nx42-award-winner');await expect(cards.first()).toBeVisible();expect(await cards.count()).toBeGreaterThanOrEqual(4);const boxes=await cards.evaluateAll(nodes=>nodes.slice(0,6).map(node=>node.getBoundingClientRect()));expect(Math.max(...boxes.map(box=>box.height))).toBeLessThan(430);expect(new Set(boxes.slice(0,3).map(box=>Math.round(box.y))).size).toBe(1);await noOverflow(page,2)});

test('production detail paints from the internal API without waiting for external providers',async({page})=>{const origin=new URL(firstVisitUrl('/')).origin,assetPrefix=new URL(ORIGIN).hostname.endsWith('github.io')?'/AniNexus':'',base=anime(101),normalized={id:base.id,idMal:null,mediaType:'ANIME',title:base.title.english,titleRomaji:base.title.romaji,titleNative:base.title.native,synonyms:[],cover:pixel,coverColor:'#ef2a5c',banner:pixel,description:base.description,genres:base.genres,tags:['Action'],tagDetails:[{name:'Action',rank:90,isMediaSpoiler:false}],score:8.2,meanScore:8.1,popularity:1000,favourites:100,episodes:12,duration:24,format:'TV',status:'RELEASING',season:'SUMMER',seasonYear:2026,country:'JP',source:'ORIGINAL',startDate:base.startDate,endDate:null,studios:[],streaming:[],nextAiringEpisode:null,trailer:null,characters:[],staff:[],relations:[],recommendations:[]};let apiHits=0;await page.route(`${origin}/preview-v22/**`,async route=>{const requested=new URL(route.request().url()),response=await route.fetch({url:`${origin}${assetPrefix}${requested.pathname}${requested.search}`});await route.fulfill({response})});await page.route(`${origin}/api/anime/101`,async route=>{apiHits++;await new Promise(resolve=>setTimeout(resolve,80));await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(normalized)})});await page.unroute('https://graphql.anilist.co/');await page.route('https://graphql.anilist.co/',route=>route.abort('failed'));const started=Date.now();await page.goto(firstVisitUrl('/anime/anime-teste-101'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx22-detail:not(.nx22-loading):not(.nx22-fail)')).toBeVisible({timeout:5000});await expect(page.getByRole('heading',{name:'Anime Teste 101'})).toBeVisible();expect(Date.now()-started).toBeLessThan(5000);expect(apiHits).toBe(1);await noOverflow(page,2)});

test('native news slugs with underscores open the reader',async({page})=>{const slug='life-a-felicidade-depende-de-nos-sera-publicado-pela-newpop-jbox_manga-211a006a',origin=new URL(firstVisitUrl('/')).origin;await page.route(`${origin}/api/news/${slug}`,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:'211a006a',slug,title:'Life, A Felicidade Depende de Nós será publicado pela NewPOP',summary:'A editora confirmou a publicação brasileira do mangá.',event_type:'MANGA',source_name:'AniNexus Notícias',language:'pt-BR',published_at:new Date().toISOString(),facts:['A publicação foi confirmada.'],body:{sections:[{heading:'Publicação no Brasil',paragraphs:['A edição brasileira foi anunciada oficialmente.']}]}})}));await page.goto(firstVisitUrl(`/noticias/${slug}`),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx35-reader')).toBeVisible({timeout:15000});await expect(page.getByRole('heading',{name:/Felicidade Depende de Nós/})).toBeVisible();await expect(page.locator('#app')).not.toContainText('Página não encontrada');await noOverflow(page,2)});

test('news repairs AnimeNew image hosts and renders the cover',async({page})=>{
  const now=new Date(),expires=new Date(now.getTime()+86400000),item={id:'image-host-test',slug:'imagem-anime-new-teste',title:'Anime ganha novo trailer e data de estreia',summary:'O novo trailer do anime foi divulgado com informações sobre a estreia da temporada.',eventType:'TRAILER',category:'Trailers',image:'https://animenew.com.br/wp-content/uploads/2026/09/capa-teste.webp',language:'pt-BR',sourceContent:[{type:'paragraph',text:'O trailer foi divulgado.',runs:[{text:'O trailer foi divulgado.'}]}],contentMode:'full',publishedAt:now.toISOString(),expiresAt:expires.toISOString()};
  const body=JSON.stringify({items:[item]});
  await page.route('**/api/news?limit=60',route=>route.fulfill({status:200,contentType:'application/json',body}));
  await page.route('**/data/news.json*',route=>route.fulfill({status:200,contentType:'application/json',body}));
  await page.route('**/data/news-v36-seed.json*',route=>route.fulfill({status:200,contentType:'application/json',body:'{"items":[]}'}));
  await page.route('https://animenew.com.br/wp-content/**',route=>route.abort('failed'));
  await page.route('https://wp.animenew.com.br/wp-content/**',route=>route.fulfill({status:200,contentType:'image/gif',body:imageBytes}));
  await page.goto(pageUrl('/noticias'),{waitUntil:'domcontentloaded'});
  const card=page.locator('.nx35-ncard',{hasText:item.title}).first(),image=card.locator('img[data-news-image]');
  await expect(card).toBeVisible({timeout:30000});
  await expect(image).toHaveAttribute('src','https://wp.animenew.com.br/wp-content/uploads/2026/09/capa-teste.webp');
  await expect.poll(()=>image.evaluate(node=>node.complete&&node.naturalWidth>0)).toBe(true);
  await expect(card.locator('.nx35-news-art')).toHaveCount(0);
});

test('manga catalog is a dedicated responsive product surface',async({page})=>{for(const width of [390,768,1440]){await page.setViewportSize({width,height:width===390?844:900});await page.goto(pageUrl('/mangas'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx42-manga-page')).toBeVisible({timeout:30000});await expect(page.getByRole('heading',{name:'Catálogo de Mangás'})).toBeVisible();await expect(page.locator('.nx42-manga-card').first()).toBeVisible();await expect(page.locator('#nx42MangaSearch')).toBeVisible();await noOverflow(page,3)}});

test('single Home impression is complete and does not look like a broken rail',async({page})=>{
  const impression={id:'imp-one',media_id:101,media_type:'ANIME',body:'Uma estreia excelente e cheia de personalidade.',created_at:new Date().toISOString(),username:'kayky',display_name:'Kayky Sousa',avatar_url:pixel,status:'CURRENT',progress:5,score:9,reaction:'LOVE',media:{id:101,title:'Anime Teste 101',cover:pixel,banner:pixel,format:'TV',episodes:12,seasonYear:2026}};
  await page.route(`${new URL(ORIGIN).origin}/api/community/impressions**`,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:[impression]})}));
  await page.addInitScript(({pixel,impression})=>localStorage.setItem('aninexus:impressions:v1',JSON.stringify([{...impression,mediaId:101,createdAt:impression.created_at,media:{...impression.media,cover:pixel}}])),{pixel,impression});
  await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});
  const card=page.locator('.nx38-impression-home-card').first();
  await expect(card).toBeVisible({timeout:30000});
  await expect(card).toContainText('Uma estreia excelente');
  await expect(card.locator('.nx38-impression-identity')).toContainText('Kayky Sousa');
  await expect(card.locator('.nx38-impression-identity')).toContainText('@kayky');
  await expect(card.locator('.nx38-impression-meta-row')).toContainText('Assistindo');
  await expect(card.locator('.nx38-impression-meta-row')).toContainText('episódio 5 de 12');
  await expect(card.locator('.nx38-impression-meta-row')).toContainText('Amei');
  await expect(card.locator('.nx38-impression-meta-row')).toContainText('sem spoilers');
  await expect(card.locator('.nx38-impression-media-copy')).toContainText('Série · 2026 · 12 ep.');
  await expect(page.locator('.nx38-impressions-rail')).toHaveAttribute('data-count','1');
  expect(await card.locator('.nx38-impression-author').evaluate(link=>{const url=new URL(link.href);return url.searchParams.get('p')||url.pathname})).toBe('/u/kayky');
  expect(await card.locator('.nx38-impression-context').evaluate(link=>{const url=new URL(link.href);return url.searchParams.get('p')||url.pathname})).toBe('/anime/anime-teste-101');
  const layout=await page.locator('.nx38-impressions-rail').evaluate(rail=>{const card=rail.firstElementChild?.getBoundingClientRect(),box=rail.getBoundingClientRect();return{cardWidth:card?.width||0,cardHeight:card?.height||0,railWidth:box.width}});
  expect(layout.cardWidth).toBeGreaterThan(layout.railWidth*.96);
  expect(layout.cardHeight).toBeLessThan(270);
  const previous=page.locator('[data-imp-prev]');
  const next=page.locator('[data-imp-next]');
  await expect(previous).toBeDisabled();
  await expect(next).toBeDisabled();
  await expect(previous).toHaveClass(/nx44-rail-button/);
  await expect(next.locator('.nx44-rail-icon')).toHaveCount(1);
  await expect(previous).toBeVisible();
  await expect(next).toBeVisible();
  const community=page.locator('.nx38-impressions-actions a',{hasText:'Abrir comunidade'});
  await expect(community).toBeVisible();
  expect(await community.evaluate(link=>{const url=new URL(link.href);return url.searchParams.get('p')||url.pathname})).toBe('/comunidade');
  await page.setViewportSize({width:390,height:844});
  await expect(previous).toBeVisible();
  await expect(next).toBeVisible();
  await expect(community).toBeVisible();
  const mobile=await card.evaluate(node=>node.getBoundingClientRect());
  expect(mobile.width).toBeGreaterThan(340);
  await noOverflow(page,2);
});

test('dedicated pages have one renderer and never flash a legacy layout',async({page,browserName})=>{test.skip(browserName!=='chromium','A troca temporal de layout é auditada uma vez no Chromium.');await page.addInitScript(()=>{window.__nxLayouts=[];const record=()=>{const el=document.querySelector('#app')?.firstElementChild;if(!el)return;const value=`${el.tagName}.${String(el.className||'').trim()}`;if(window.__nxLayouts.at(-1)!==value)window.__nxLayouts.push(value)};new MutationObserver(record).observe(document,{childList:true,subtree:true});addEventListener('DOMContentLoaded',record,{once:true})});const cases=[['/','nx35-home'],['/animes/catalogo','nx21-catalog-page'],['/animes/programacao','nx18-schedule'],['/animes/temporadas','nx-season'],['/anime/anime-teste-101','nx22-detail'],['/noticias','nx35-news-page'],['/comunidade','nx40-community'],['/conquistas','nx48-achievements-page'],['/login','nx38-auth-page'],['/admin','nx38-admin-page'],['/meus-animes','nx38-library'],['/termos-de-uso','nx-legal'],['/quem-somos','nx-inst']];for(const[route,prefix]of cases){if(route==='/conquistas'){await page.route('**/api/achievements/catalog',request=>request.fulfill({status:200,contentType:'application/json',body:JSON.stringify({total:achievementDefinitions.length,items:achievementDefinitions})}),{times:1})}await page.goto(pageUrl(route),{waitUntil:'domcontentloaded'});await expect(page.locator(`.${prefix}`).first()).toBeVisible({timeout:30000});await page.waitForTimeout(300);const history=await page.evaluate(()=>window.__nxLayouts||[]);expect(history,`${route}: ${history.join(' -> ')}`).not.toContain(expect.stringMatching(/detail-hero|nx-detail(?:-loading)?|catalog-hero|community-page|news-hero|prose/));expect(history.every(value=>value.includes(prefix)),`${route}: ${history.join(' -> ')}`).toBe(true)}});

test('Home Catalog Programação Temporadas and Meus Animes share compact circular actions',async({page})=>{
  test.setTimeout(90000);
  const targets=[['/','button[data-fav]'],['/animes/catalogo','.nx21-actions button[data-fav]'],['/animes/programacao','.nx18-cover-actions button[data-nx18-fav]'],['/animes/temporadas','button[data-nx-fav]']];
  for(const [route,selector] of targets){await page.goto(pageUrl(route),{waitUntil:'domcontentloaded'});const b=page.locator(selector).first();await expect(b).toBeVisible({timeout:30000});await expect(b).toHaveCSS('width','34px');await expect(b).toHaveCSS('height','34px');await expect(b).toHaveCSS('border-radius',/50%|1[67]px/);await expect(b).toHaveCSS('display','grid')}
  await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});await expect(page.locator('button[data-fav]').first()).toBeVisible({timeout:30000});const ids=await page.evaluate(()=>[...document.querySelectorAll('button[data-fav]')].map(x=>Number(x.dataset.fav)).filter(Boolean).slice(0,1));await page.evaluate(ids=>{const id=ids[0],now=Date.now();localStorage.setItem('aninexus:favorites',JSON.stringify([id]));localStorage.setItem('aninexus:mediaState:v2',JSON.stringify({[id]:{status:'CURRENT',progress:1,score:null,reaction:'',updatedAt:now}}));localStorage.setItem('aninexus:mediaState:v1',localStorage.getItem('aninexus:mediaState:v2'))},ids);const id=ids[0];await page.route('**/api/me/library',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({user:{username:'teste'},list:[{media_id:id,status:'CURRENT',progress:1,media:anime(id)}],favorites:[{media_id:id,media:anime(id)}],impressions:[],impressionCount:0})}));await page.goto(pageUrl('/meus-animes'),{waitUntil:'domcontentloaded'});const lb=page.locator('.nx38-library-card-actions button[data-fav]').first();await expect(lb).toBeVisible({timeout:30000});await expect(lb).toHaveCSS('width','34px');await expect(lb).toHaveCSS('height','34px');await expect(lb).toHaveCSS('border-radius',/50%|1[67]px/)
});

test('favorite double click and burst represent one intention',async({page})=>{await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});await expect(page.locator('[data-nx35-home].data-ready')).toBeVisible({timeout:30000});await expect.poll(()=>page.evaluate(()=>Boolean(window.AniNexusMediaActions&&window.AniNexusMediaState))).toBe(true);await clear(page);const b=page.locator('button[data-fav]').first();await expect(b).toBeVisible({timeout:30000});await b.dblclick({delay:40});await expect(b).toHaveClass(/active/);await page.waitForTimeout(380);await b.click();await expect(b).not.toHaveClass(/active/);await page.waitForTimeout(380);await b.evaluate(el=>{for(let i=0;i<7;i++)el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}))});await expect(b).toHaveClass(/active/)});

test('Programação opens one modal and saved status reaches Home and Community',async({page})=>{
  await page.goto(pageUrl('/animes/programacao'),{waitUntil:'domcontentloaded'});await clear(page);const card=page.locator('.nx18-card').first();await expect(card).toBeVisible({timeout:30000});const list=card.locator('button[data-nx18-status]').first();await expect(list).toBeVisible();const id=Number(await list.getAttribute('data-nx18-status'));const animeTitle=(await card.locator('h3').first().textContent())?.trim()||'';expect(id).toBeGreaterThan(0);
  await list.click();await expect(page.locator('.nx20-media-layer')).toHaveCount(1,{timeout:20000});await expect(page.locator('.nx20-modal')).toHaveCount(1);await page.locator('[data-nx20-status="CURRENT"]').click();const progress=page.locator('[data-nx20-progress]');if(await progress.count())await progress.fill('1');await page.locator('[data-nx20-save]').click();const savedStatus=await page.evaluate(id=>JSON.parse(localStorage.getItem('aninexus:mediaState:v2')||'{}')[id]?.status,id);expect(savedStatus).toBe('CURRENT');
  const activity=await page.evaluate(id=>(JSON.parse(localStorage.getItem('aninexus:community:activity:v40')||'[]')).find(x=>Number(x.media_id)===id&&x.status==='CURRENT'),id);expect(activity).toBeTruthy();
  await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx35-home')).toBeVisible({timeout:30000});await expect(page.locator('#nx35CommunityHero')).toContainText('está assistindo',{timeout:15000});if(animeTitle)await expect(page.locator('#nx35CommunityHero')).toContainText(animeTitle,{timeout:15000});
  const malformed=`${ORIGIN}?build=38.0.0&p=${encodeURIComponent('/comunidade?build=35.0.0')}`;await page.goto(malformed,{waitUntil:'domcontentloaded'});await expect(page.locator('.nx40-community')).toBeVisible({timeout:30000});await expect(page.locator('.nx40-community')).not.toContainText('O que você está assistindo hoje?');await expect(page.locator('.nx40-feed')).toContainText('está assistindo');if(animeTitle)await expect(page.locator('.nx40-feed')).toContainText(animeTitle);await noOverflow(page)
});

test('Community V40 exposes activity impressions discussions trends and local composer',async({page})=>{
  let postedThread=null;
  await page.route('**/api/community/threads**',async route=>{if(route.request().method()==='POST'){postedThread={id:'thread-test',username:'teste',...route.request().postDataJSON(),replies:0,created_at:new Date().toISOString()};return route.fulfill({status:201,contentType:'application/json',body:JSON.stringify(postedThread)})}return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:postedThread?[postedThread]:[]})})});
  await page.goto(pageUrl('/comunidade'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx40-community')).toBeVisible({timeout:30000});for(const label of ['Tudo','Atividade','Impressões','Discussões'])await expect(page.getByRole('button',{name:label,exact:true})).toBeVisible();await expect(page.locator('#nx40Stats')).toBeVisible();await expect(page.locator('#nx40Trending')).toBeVisible();await page.locator('[data-nx40-new]').click();await expect(page.locator('#nx40ThreadModal')).toBeVisible();await page.locator('#nx40ThreadForm input[name="title"]').fill('Discussão de teste');await page.locator('#nx40ThreadForm textarea').fill('Uma conversa de teste para validar a Comunidade V40.');await page.locator('#nx40ThreadForm button[type="submit"]').click();await expect(page.locator('#nx40ThreadModal')).toBeHidden();await expect(page.locator('.nx40-feed')).toContainText('Discussão de teste');await noOverflow(page)
});

test('Catalog opens dedicated anime detail without action click leaking to card',async({page})=>{const hosted=new URL(ORIGIN).hostname.endsWith('github.io');await page.goto(pageUrl('/animes/catalogo'),{waitUntil:'domcontentloaded'});const card=page.locator('.nx21-card').first();await expect(card).toBeVisible({timeout:30000});const before=page.url(),fav=card.locator('button[data-fav]').first();await fav.click();expect(page.url()).toBe(before);await page.waitForTimeout(380);await card.locator('h3').click();await page.waitForURL(u=>{const url=new URL(u);return url.searchParams.get('p')?.startsWith('/anime/')===true||url.pathname.startsWith('/anime/')},{timeout:15000});if(!hosted){const selectedPath=new URL(page.url()).pathname;await page.goto(pageUrl(selectedPath),{waitUntil:'domcontentloaded'})}await expect(page.locator('.nx22-detail')).toBeVisible({timeout:30000})});

test('mobile openings load only the selected video and stay inside the viewport',async({page})=>{await page.setViewportSize({width:390,height:844});let mediaRequests=0;await page.route('https://api.animethemes.moe/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(themeApiData())}));await page.route('https://v.animethemes.moe/**',route=>{mediaRequests++;return route.fulfill({status:200,contentType:'video/webm',body:''})});await page.goto(pageUrl('/anime/anime-teste-101'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx22-detail')).toBeVisible({timeout:30000});await page.getByRole('tab',{name:'Aberturas & encerramentos'}).click();await expect(page.locator('#nx22Themes')).toHaveAttribute('data-state','ready',{timeout:15000});await expect(page.locator('.nx22-theme-card')).toHaveCount(24);expect(mediaRequests).toBe(0);await expect(page.locator('.nx22-theme-card video[src]')).toHaveCount(0);await noOverflow(page);await page.locator('[data-nx22-theme-play]').first().click();await expect(page.locator('.nx22-theme-card video[src]')).toHaveCount(1);await expect(page.locator('.nx22-theme-card video[preload="metadata"]')).toHaveCount(1);await expect(page.locator('.nx22-theme-card:not(.is-loaded) video[src]')).toHaveCount(0);await noOverflow(page)});

test('mobile openings hide technical upstream errors',async({page})=>{await page.setViewportSize({width:390,height:844});await page.route('https://api.animethemes.moe/**',route=>route.abort('failed'));await page.goto(pageUrl('/anime/anime-teste-101'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx22-detail')).toBeVisible({timeout:30000});await page.getByRole('tab',{name:'Aberturas & encerramentos'}).click();await expect(page.locator('#nx22Themes')).toHaveAttribute('data-state','error',{timeout:15000});await expect(page.locator('#nx22Themes')).toContainText('Não foi possível carregar este acervo agora');await expect(page.locator('#nx22Themes')).not.toContainText(/Load failed|Failed to fetch|NetworkError/i);await expect(page.getByRole('button',{name:'Tentar novamente'})).toBeVisible();await noOverflow(page,2)});

test('anime detail failures hide provider diagnostics and dependent forms',async({page})=>{await page.unroute('https://graphql.anilist.co/');await page.route('https://graphql.anilist.co/',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({errors:[{message:'upstream diagnostic'}]})}));await page.goto(pageUrl('/anime/anime-teste-101'),{waitUntil:'domcontentloaded'});const failure=page.locator('.nx22-fail');await expect(failure).toBeVisible({timeout:30000});await expect(failure).toContainText('O catálogo está temporariamente indisponível');await expect(failure).not.toContainText(/AniList|upstream|503|diagnostic/i);await expect(page.locator('.nx42-impressions')).toHaveCount(0);await noOverflow(page,2)});

test('anime detail light theme styles navigation content and forms coherently',async({page})=>{await page.addInitScript(()=>localStorage.setItem('aninexus:theme','light'));await page.goto(pageUrl('/anime/anime-teste-101'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx22-detail:not(.nx22-fail)')).toBeVisible({timeout:30000});await expect(page.locator('html')).toHaveAttribute('data-theme','light');await expect(page.locator('.topbar')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');await page.evaluate(()=>scrollTo(0,160));await expect(page.locator('.topbar')).toHaveClass(/is-scrolled/);await expect(page.locator('.topbar')).not.toHaveCSS('background-color','rgba(0, 0, 0, 0)');await expect(page.locator('.nx22-info-card').first()).toHaveCSS('background-color','rgb(255, 255, 255)');await expect(page.locator('.nx42-impression-form')).toHaveCSS('background-color','rgb(255, 255, 255)');await noOverflow(page,2)});

test('News and authentication remain healthy after V40',async({page})=>{await page.goto(pageUrl('/noticias'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx35-news-page')).toBeVisible({timeout:30000});await noOverflow(page);await page.goto(pageUrl('/login'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx38-auth-page')).toBeVisible({timeout:15000});await expect(page.locator('.nx38-auth-card h2')).toHaveText('Ativação segura em andamento');await expect(page.locator('.nx38-auth-unavailable')).toContainText('Nenhum dado privado');await noOverflow(page)});

test('mobile authentication is compact readable and never overflows',async({page})=>{for(const width of [320,360,390,430]){await page.setViewportSize({width,height:844});await page.goto(pageUrl('/login'),{waitUntil:'domcontentloaded'});const auth=page.locator('.nx38-auth-page');await expect(auth).toBeVisible({timeout:15000});await expect(page.locator('.nx38-auth-benefits')).toBeHidden();await expect(page.locator('.nx38-auth-copy>p')).toBeHidden();const storyHeight=await page.locator('.nx38-auth-story').evaluate(element=>element.getBoundingClientRect().height);expect(storyHeight).toBeLessThan(140);await noOverflow(page,2)}});

test('desktop header keeps only the six approved destinations and gains chrome after scroll',async({page})=>{await page.setViewportSize({width:1440,height:900});await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});const labels=await page.locator('.main-nav>a').allTextContents();expect(labels.map(x=>x.trim())).toEqual(['Início','Animes','Mangás','Temporadas','Programação','Notícias']);await expect(page.locator('.main-nav')).toBeVisible();await expect(page.locator('.menu-btn')).toBeHidden();await expect(page.locator('.top-actions>[data-action="search"]')).toBeVisible();await expect(page.locator('.top-actions>[data-action="theme"]')).toBeVisible();await expect(page.locator('.top-actions>[data-action="notifications"]')).toBeHidden();await expect(page.locator('.top-actions>[data-action="login"]')).toBeVisible();await expect(page.locator('.top-actions>[data-action="register"]')).toBeVisible();await expect(page.locator('#topbar')).not.toHaveClass(/is-scrolled/);await page.evaluate(()=>scrollTo(0,180));await expect(page.locator('#topbar')).toHaveClass(/is-scrolled/);await expect(page.locator('#app main')).toHaveCount(1);await expect(page.locator('main main')).toHaveCount(0);await noOverflow(page,2)});

test('desktop header uses restrained navigation and account typography',async({page})=>{await page.setViewportSize({width:1440,height:900});await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});await expect(page.locator('.main-nav')).toBeVisible({timeout:30000});const typography=await page.evaluate(()=>{const read=element=>{const style=getComputedStyle(element);return{weight:parseInt(style.fontWeight,10),shadow:style.textShadow,spacing:style.letterSpacing}};return{nav:[...document.querySelectorAll('.main-nav>a')].map(read),login:read(document.querySelector('.top-actions>[data-action="login"]')),signup:read(document.querySelector('.top-actions>[data-action="register"]'))}});expect(typography.nav.every(item=>item.weight===600&&item.shadow==='none')).toBe(true);expect(typography.login.weight).toBe(600);expect(typography.signup.weight).toBe(600);expect(typography.login.shadow).toBe('none');expect(typography.signup.shadow).toBe('none');expect(typography.signup.spacing).toBe('normal');await noOverflow(page,2)});

test('authenticated notification drawer loads once and marks an item as read',async({page})=>{await page.setViewportSize({width:1440,height:900});await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});await page.evaluate(()=>{window.__nx43NotificationCalls=[];window.AniNexusAuth={api:async(path,options={})=>{window.__nx43NotificationCalls.push({path,method:options.method||'GET'});if(options.method==='PATCH')return{};return{items:[{id:'11111111-1111-4111-8111-111111111111',kind:'SYSTEM',title:'Primeira conquista',body:'Você desbloqueou um novo marco.',href:null,read_at:null,created_at:new Date().toISOString()}]}}};document.documentElement.dataset.nxAuthState='authenticated'});const trigger=page.locator('[data-action="notifications"]');await expect(trigger).toBeVisible();await trigger.click();await expect(page.locator('#notificationPanel')).toBeVisible();await expect(page.locator('.nx43-notification-row')).toContainText('Primeira conquista');await expect(page.locator('.nx43-notification-badge')).toBeVisible();await page.locator('.nx43-notification-row').click();await expect(page.locator('.nx43-notification-row')).not.toHaveClass(/is-unread/);await expect(page.locator('.nx43-notification-badge')).toBeHidden();const calls=await page.evaluate(()=>window.__nx43NotificationCalls);expect(calls.filter(call=>call.path.includes('/api/me/notifications?limit=20'))).toHaveLength(1);expect(calls.some(call=>call.method==='PATCH')).toBe(true);await page.getByRole('button',{name:'Fechar notificações'}).first().click();await expect(page.locator('#notificationPanel')).toBeHidden()});

test('authenticated account menu separates identity and does not duplicate notifications',async({page})=>{await page.setViewportSize({width:1440,height:900});await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});await page.evaluate(pixel=>{window.AniNexusAccountData=async()=>({displayName:'Kayky Sousa',username:'kayky',avatarUrl:pixel});const chip=document.createElement('button');chip.type='button';chip.className='nx38-account-chip';chip.innerHTML=`<i><img src="${pixel}" alt=""></i><span>Kayky</span>`;document.querySelector('.top-actions')?.append(chip)},pixel);const trigger=page.getByRole('button',{name:'Abrir menu da conta'});await expect(trigger).toBeVisible();await trigger.click();const menu=page.locator('.nx42-account-menu');await expect(menu).toBeVisible();await expect(menu.locator('header strong')).toHaveText('Kayky Sousa');await expect(menu.locator('header span')).toHaveText('@kayky');await expect(menu.locator('header img')).toHaveAttribute('src',pixel);await expect(menu.getByRole('button',{name:'Notificações'})).toHaveCount(0);const identity=await menu.locator('header>div').evaluate(element=>({display:getComputedStyle(element).display,gap:parseFloat(getComputedStyle(element).rowGap),nameBottom:element.querySelector('strong').getBoundingClientRect().bottom,handleTop:element.querySelector('span').getBoundingClientRect().top}));expect(identity.display).toBe('grid');expect(identity.gap).toBeGreaterThanOrEqual(4);expect(identity.handleTop).toBeGreaterThan(identity.nameBottom);await trigger.click();await expect(menu).toBeHidden();await page.evaluate(pixel=>dispatchEvent(new CustomEvent('aninexus:account-identity-changed',{detail:{user:{displayName:'Kayky Atualizado',username:'kayky',avatarUrl:pixel}}})),pixel);await trigger.click();await expect(page.locator('.nx42-account-menu header strong')).toHaveText('Kayky Atualizado');await noOverflow(page,2)});

test('all required widths stay inside the viewport',async({page,browserName})=>{test.skip(browserName!=='chromium','A matriz completa de larguras roda uma vez; Firefox e WebKit executam os fluxos críticos.');for(const width of [320,360,375,390,414,768,820,1024,1280,1440,1920]){await page.setViewportSize({width,height:width<600?844:900});await page.goto(pageUrl(width<600?'/animes/catalogo':'/'),{waitUntil:'domcontentloaded'});await page.locator('#app main').first().waitFor({state:'visible',timeout:30000});await noOverflow(page,8)}});

test('public navigation degrades gracefully when AniList is unavailable',async({page})=>{await page.unroute('https://graphql.anilist.co/');await page.route('https://graphql.anilist.co/',route=>route.abort('failed'));await page.goto(pageUrl('/animes/catalogo'),{waitUntil:'domcontentloaded'});await expect(page.locator('#app main').first()).toBeVisible({timeout:30000});await expect(page.locator('body')).not.toContainText('HTTP 500');await noOverflow(page)});

test('mobile Community and Programação do not overflow',async({page})=>{await page.setViewportSize({width:390,height:844});for(const route of ['/comunidade','/animes/programacao']){await page.goto(pageUrl(route),{waitUntil:'domcontentloaded'});await expect(page.locator(route==='/comunidade'?'.nx40-community':'.nx18-schedule').first()).toBeVisible({timeout:30000});await noOverflow(page)}});

test('public profile and profile editor are complete on mobile',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.route('**/runtime-config.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:`window.__ANINEXUS_CONFIG__=Object.freeze({environment:'test',siteOrigin:'https://qgbaltigo.github.io/AniNexus',apiOrigin:'https://graphql.anilist.co',clerkPublishableKey:'pk_test_profile',authEnabled:true});`}));
  await page.route('**/api/users/kayky',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({profile:{username:'kayky',displayName:'Kayky',avatarUrl:pixel,bannerUrl:pixel,bio:'Anime, mangá e boas conversas.',location:'Cuiabá, MT',websiteUrl:'https://example.com',instagramHandle:'kayky',telegramHandle:'kayky',role:'user',privacy:'public',isPrivate:false,createdAt:'2026-01-01T00:00:00.000Z'},stats:{list_total:18,watching:4,completed:10,episodes_watched:320,average_score:8.7},library:[{media_id:101,status:'CURRENT',progress:5,score:9,media:{id:101,title:'Anime Teste 101',cover:pixel}}],activity:[{media_id:101,status:'CURRENT',progress:5,created_at:new Date().toISOString(),media:{id:101,title:'Anime Teste 101',cover:pixel}}],impressions:[{id:'one',media_id:101,body:'Uma ótima estreia.',spoiler:false,created_at:new Date().toISOString(),media:{id:101,title:'Anime Teste 101',cover:pixel}}]})}));
  await page.goto(pageUrl('/u/kayky'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx38p-page')).toBeVisible({timeout:15000});await expect(page.locator('.nx38p-person h1')).toHaveText('Kayky');await expect(page.locator('.nx38p-stats')).toContainText('320');const svgBoxes=await page.locator('.nx38p-meta svg,.nx38p-socials svg,.nx38p-share svg,.nx38p-content-nav svg').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect()));expect(svgBoxes.length).toBeGreaterThan(4);for(const box of svgBoxes){expect(box.width).toBeLessThanOrEqual(20);expect(box.height).toBeLessThanOrEqual(20)}await page.getByRole('button',{name:'Assistindo'}).click();await expect(page.locator('.nx38p-media:visible')).toBeVisible();await noOverflow(page,2);
  await page.evaluate(()=>window.AniNexusProfileV38.openEditor({id:'user_kayky',username:'kayky',displayName:'Kayky',avatarUrl:'',bannerUrl:'',bio:'Anime e mangá',privacy:'public',showLibrary:true,showActivity:true,showStats:true}));await expect(page.getByRole('heading',{name:'Personalizar perfil'})).toBeVisible();await expect(page.locator('input[name="username"]')).toHaveValue('kayky');await expect(page.locator('input[name="avatarUrl"]')).toBeVisible();await expect(page.locator('input[name="avatarPreset"]')).toHaveCount(8);await page.locator('.nx38pe-avatar-option',{hasText:'Vermelho'}).click();await expect(page.locator('[data-preview-avatar] img')).toHaveAttribute('src',/mascot-red\.png/);await noOverflow(page,2)
});

test('public profile deep-links to an unlocked achievement and shows three pinned badges',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const collection=achievementPayload({pins:[achievementDefinitions[0].id,achievementDefinitions[7].id,achievementDefinitions[11].id]}),target='completed-living-encyclopedia';
  await page.route('**/runtime-config.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:`window.__ANINEXUS_CONFIG__=Object.freeze({environment:'test',siteOrigin:'https://qgbaltigo.github.io/AniNexus',apiOrigin:'https://graphql.anilist.co',clerkPublishableKey:'pk_test_profile',authEnabled:true});`}));
  await page.route('**/api/users/kayky',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({profile:{username:'kayky',displayName:'Kayky',avatarUrl:pixel,bannerUrl:pixel,bio:'Anime, mangá e boas conversas.',role:'user',privacy:'public',isPrivate:false,showLibrary:false,showActivity:false,showStats:false,createdAt:'2026-01-01T00:00:00.000Z',equippedTitle:collection.equippedTitle},rank:collection.level,achievements:collection.items.filter(item=>item.unlocked),pinnedAchievements:collection.pins.map(id=>collection.items.find(item=>item.id===id)),stats:null,library:[],mangaLibrary:[],activity:[],impressions:[]})}));
  await page.goto(pageUrl(`/u/kayky?tab=achievements&achievement=${target}`),{waitUntil:'domcontentloaded'});const profile=page.locator('.nx38p-page'),targetCard=profile.locator(`[data-public-achievement-id="${target}"]`);await expect(profile).toBeVisible({timeout:15000});await expect(profile.locator('.nx48-profile-title')).toHaveText('Enciclopédia Viva');await expect(profile.locator('.nx48-profile-pin')).toHaveCount(3);await expect(profile.locator('[data-profile-panel="achievements"]')).toHaveClass(/active/);await expect(targetCard).toHaveClass(/is-target/);await expect(targetCard).toContainText('Enciclopédia Viva');await expect(targetCard).toContainText('Concluiu 100 animes.');await noOverflow(page,2);
});

test('discovery hubs replace placeholder pages and remain responsive',async({page})=>{await page.setViewportSize({width:390,height:844});await page.goto(pageUrl('/listas-de-animes'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx-list-group').first()).toBeVisible({timeout:15000});await expect(page.locator('#listsHub')).toContainText('Melhores animes para assistir');await noOverflow(page,2);await page.goto(pageUrl('/animes/estudios'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx-studio-card').first()).toBeVisible({timeout:15000});await noOverflow(page,2)});
