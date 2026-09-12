import {test,expect} from '@playwright/test';
import {achievementCatalog,levelFromXp} from '../lib/achievements.mjs';
const ORIGIN=process.env.ANINEXUS_E2E_ORIGIN||'http://qgbaltigo.github.io:4173/AniNexus/';
const LOCAL_STATIC_ORIGIN=process.env.ANINEXUS_LOCAL_STATIC_ORIGIN||'';
const pageUrl=route=>`${ORIGIN}?build=44.55.1&p=${encodeURIComponent(route)}`;
const firstVisitUrl=route=>{const url=new URL(pageUrl(route));if(url.hostname.endsWith('github.io'))url.hostname='127.0.0.1';return url.href};
async function fulfillLocalStatic(route){const requested=new URL(route.request().url()),pathname=requested.pathname.startsWith('/AniNexus/')?requested.pathname:`/AniNexus${requested.pathname}`,local=new URL(pathname+requested.search,LOCAL_STATIC_ORIGIN);let lastError;for(let attempt=0;attempt<3;attempt++){try{const response=await route.fetch({url:local.href});return await route.fulfill({response})}catch(error){lastError=error;if(!/ECONNRESET|ECONNREFUSED|socket hang up/i.test(String(error?.message))||attempt===2)throw error;await new Promise(resolve=>setTimeout(resolve,80*(attempt+1)))}}throw lastError}
async function bridgeProductionAssets(page){if(!new URL(ORIGIN).hostname.endsWith('github.io'))return;const origin=new URL(firstVisitUrl('/')).origin;await page.route(`${origin}/**`,async route=>{const requested=new URL(route.request().url());if(!/^\/(?:preview-v\d+|assets|data)\//.test(requested.pathname))return route.continue();const response=await route.fetch({url:`${origin}/AniNexus${requested.pathname}${requested.search}`});return route.fulfill({response})})}
async function noOverflow(page,t=7){const x=await page.evaluate(()=>({s:document.documentElement.scrollWidth,w:innerWidth}));expect(x.s).toBeLessThanOrEqual(x.w+t)}
async function clear(page){await page.evaluate(()=>{for(const k of ['aninexus:favorites','aninexus:mediaState:v2','aninexus:mediaState:v1','aninexus:list','aninexus:listStatus','aninexus:community:activity:v40','aninexus:community:threads:v40'])localStorage.removeItem(k);window.AniNexusMediaState?.sync?.()})}
async function allowAccountActions(page,user={id:'e2e-member',username:'e2e-member'}){await page.evaluate(user=>{window.AniNexusAuth={...(window.AniNexusAuth||{}),getUser:async()=>user,requireAccount:async()=>user};document.documentElement.dataset.nxAuthState='authenticated'},user)}
async function waitForLogin(page){await page.waitForURL(url=>{const current=new URL(url);return current.searchParams.get('p')==='/login'||current.pathname.replace(/\/+$/,'').endsWith('/login')},{timeout:15000});await expect(page.locator('.nx38-auth-page')).toBeVisible({timeout:15000})}
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
function catalogPage(page=1,count=25){return Array.from({length:count},(_,index)=>anime(page*1000+index+1))}
function discoveryCatalog(){
  return Array.from({length:12},(_,index)=>{
    const item=anime(700+index),services=index%3===0?['Crunchyroll','Netflix']:index%3===1?['Netflix','Prime Video']:['Crunchyroll','Disney+'];
    item.title={...item.title,english:`Dublado Teste ${index+1}`,userPreferred:`Dublado Teste ${index+1}`};
    item.format=index%3===1?'MOVIE':'TV';
    item.externalLinks=services.map(site=>({site,url:`https://${site.toLowerCase().replace(/[^a-z]+/g,'')}.example/${item.id}`,type:'STREAMING'}));
    return item;
  });
}
function graphData(query='',variables={}){
  const ids=Array.isArray(variables.ids)&&variables.ids.length?variables.ids:[101,102,103,104],media=ids.map(Number).filter(Boolean).map(anime),airingAt=Number(variables.start)||Math.floor(Date.now()/1000)+3600;
  const Page={pageInfo:{total:media.length,currentPage:1,lastPage:1,hasNextPage:false},media,airingSchedules:media.map((item,i)=>({airingAt:airingAt+3600*(i+1),episode:i+1,media:item}))};
  if(/studios\s*\(\s*sort\s*:/.test(query))return{Page:{...Page,studios:[{id:1,name:'Estúdio Teste',isAnimationStudio:true,favourites:1000,media:{nodes:media}}]}};
  if(/\bseason:Page/.test(query))return{season:Page,schedule:Page,top:Page,popular:Page,soon:Page,reading:Page};
  const aliases=[...query.matchAll(/\b(a\d+):Media/g)].map(x=>x[1]);if(aliases.length)return Object.fromEntries(aliases.map((key,i)=>[key,anime(201+i)]));
  const pageAliases=[...query.matchAll(/\b(a\d+):Page/g)].map(x=>x[1]);if(pageAliases.length)return Object.fromEntries(pageAliases.map((key,i)=>[key,{media:[anime(201+i)]}]));
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
  await page.route('https://graphql.anilist.co/',async route=>{
    let body={};try{body=route.request().postDataJSON()||{}}catch{}
    const data=graphData(body.query,body.variables);
    if(/\bseason:Page/.test(body.query||'')){
      data.reading={...(data.reading||{}),media:mangaRank.slice(0,6)};
      data.topReading={...(data.topReading||{}),media:mangaRank};
    }
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data})});
  });
  await page.route('**/api/home?**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({season:animeRank.slice(0,6),schedule:[],top:animeRank,popular:animeRank.slice(0,6),reading:mangaRank.slice(0,6),topReading:mangaRank,soon:animeRank.slice(0,6)})}));
  await page.route('**/api/reading?**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:mangaRank,pageInfo:{total:mangaRank.length,currentPage:1,lastPage:1,hasNextPage:false}})}));
  await page.route('**/api/characters/ranking',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({metricsSource:'aninexus',metric:'favorites',items:rankedCharacters()})}));
}
function themeApiData(count=24){return{anime:[{slug:'anime-teste-101',animethemes:Array.from({length:count},(_,index)=>({type:index%3===2?'ED':'OP',sequence:index+1,song:{title:`Tema ${index+1}`,artists:[{name:`Artista ${index+1}`}]},animethemeentries:[{episodes:String(index+1),nsfw:false,spoiler:false,videos:[{link:`https://v.animethemes.moe/test-${index+1}.webm`,mimetype:'video/webm',resolution:1080,nc:true,subbed:false,lyrics:false}]}]}))}]}}
test.beforeEach(async({page})=>{if(LOCAL_STATIC_ORIGIN){const publicOrigin=new URL(ORIGIN).origin;await page.route(`${publicOrigin}/**`,fulfillLocalStatic)}await page.route('https://a.storyblok.com/**',route=>route.fulfill({status:200,contentType:'image/gif',body:imageBytes}));await page.route('https://s4.anilist.co/**',route=>route.fulfill({status:200,contentType:'image/gif',body:imageBytes}));await page.route('https://graphql.anilist.co/',async route=>{let body={};try{body=route.request().postDataJSON()||{}}catch{}await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:graphData(body.query,body.variables)})})});await page.route('https://api.jikan.moe/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:null})}))});
test.afterEach(async({page})=>{await page.unrouteAll({behavior:'ignoreErrors'})});

test('V44 Home is the current renderer',async({page})=>{await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx35-home')).toBeVisible({timeout:30000});await expect(page.locator('.aqx-home')).toHaveCount(0);await expect(page.locator('.nx35-kicker,.nx35-signals,.nx35-hero-actions')).toHaveCount(0);await expect(page.locator('meta[name="aninexus-build"]')).toHaveAttribute('content','2026-09-11-v44.55.1')});

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

test('achievement page renders all 40 milestones and persists pins titles and privacy',async({page},testInfo)=>{
  let payload=achievementPayload();const writes=[];
  const rebuild=overrides=>{payload=achievementPayload({unlockedCount:payload.unlockedCount,pins:overrides.pins??payload.pins,shareFeed:overrides.shareFeed??payload.preferences.shareFeed,equippedTitle:overrides.equippedTitle===undefined?payload.equippedTitle:overrides.equippedTitle})};
  await page.route('**/api/achievements/catalog',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({total:achievementDefinitions.length,items:achievementDefinitions})}));
  await page.route(/\/api\/me\/achievements(?:\/.*)?(?:\?.*)?$/,async route=>{const request=route.request(),url=new URL(request.url()),method=request.method();if(url.pathname.endsWith('/pins')&&method==='PUT'){const body=request.postDataJSON();writes.push({path:'pins',body});rebuild({pins:body.ids});return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)})}if(url.pathname.endsWith('/preferences')&&method==='PATCH'){const body=request.postDataJSON();writes.push({path:'preferences',body});rebuild({shareFeed:body.shareFeed,equippedTitle:body.equippedTitle});return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)})}return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)})});
  await page.setViewportSize({width:1440,height:900});await page.goto(pageUrl('/conquistas'),{waitUntil:'domcontentloaded'});
  const collection=page.locator('.nx48-achievements-page');await expect(collection).toBeVisible({timeout:30000});await expect(collection.locator('.nx48-achievement-card')).toHaveCount(40);await expect(collection.locator('.nx48-overview-main')).toContainText('18 de 40');await expect(collection.locator('.nx48-overview-main')).toContainText('45% concluído');await expect(collection.locator('#nx48AchievementsHero .nx48-overview')).toHaveCount(1);await expect(collection.locator('.nx48-shell>.nx48-overview')).toHaveCount(0);
  const desktopColumns=await collection.locator('.nx48-achievement-card').evaluateAll(cards=>new Set(cards.slice(0,4).map(card=>Math.round(card.getBoundingClientRect().left))).size);expect(desktopColumns).toBe(4);
  await expect(collection.locator('[data-achievement-id="ratings-specialist"]')).toContainText('Avalie 50 obras diferentes.');
  await collection.locator('[data-achievement-pin="profile-nexus-identity"]').click();await expect.poll(()=>writes.filter(write=>write.path==='pins').length).toBe(1);expect(writes.at(-1)).toEqual({path:'pins',body:{ids:[achievementDefinitions[0].id,achievementDefinitions[7].id,'profile-nexus-identity']}});await expect(collection.locator('[data-achievement-pin="profile-nexus-identity"]')).toHaveAttribute('aria-pressed','true');await expect(collection.locator('.nx48-pinned-count')).toHaveText('3 de 3');
  await expect(collection.locator('[data-achievement-pin="library-first-step"]')).toBeDisabled();expect(writes.filter(write=>write.path==='pins')).toHaveLength(1);
  await collection.locator('[data-achievement-title]').selectOption('Enciclopédia Viva');await expect.poll(()=>writes.some(write=>write.path==='preferences'&&write.body.equippedTitle==='Enciclopédia Viva')).toBe(true);
  await collection.locator('.nx48-toggle').click();await expect(collection.locator('[data-achievement-feed-toggle]')).not.toBeChecked();await expect.poll(()=>writes.some(write=>write.path==='preferences'&&write.body.shareFeed===false)).toBe(true);
  await collection.getByRole('button',{name:'Bloqueadas',exact:true}).click();await expect(collection.locator('.nx48-achievement-card')).toHaveCount(22);
  await page.setViewportSize({width:390,height:844});await page.reload({waitUntil:'domcontentloaded'});await expect(page.locator('.nx48-achievement-card')).toHaveCount(40);const mobileColumns=await page.locator('.nx48-achievement-card').evaluateAll(cards=>new Set(cards.slice(0,4).map(card=>Math.round(card.getBoundingClientRect().left))).size);expect(mobileColumns).toBe(2);await page.screenshot({path:testInfo.outputPath('achievements-mobile.png')});const tier=page.locator('.nx48-collection [data-achievement-tier]');await tier.focus();await expect(tier).toHaveCSS('outline-style','none');await expect(tier).toHaveCSS('box-shadow','none');await tier.selectOption('GOLD');await expect(page.locator('.nx48-achievement-card')).toHaveCount(7);await page.evaluate(()=>scrollTo(0,700));await expect(page.locator('.nx48-achievements-island')).toHaveClass(/show/);await expect(page.locator('.nx48-achievements-island-arrow')).toHaveCSS('border-radius','50%');await noOverflow(page,2);
});

test('Home awards rotates all 32 winners with responsive art and no imported community metrics',async({page})=>{
  test.setTimeout(90000);
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
  await expect.poll(()=>frame.evaluate(element=>parseFloat(getComputedStyle(element,'::after').opacity))).toBeGreaterThan(.5);
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
  expect(communityPresentation.display).toBe('none');
  expect(communityPresentation.backgroundImage).toBe('none');
  expect(communityPresentation.copySize).toBeGreaterThanOrEqual(12);
  expect(communityPresentation.copyWeight).toBe(400);
  expect(communityPresentation.nameWeight).toBe(600);
  expect(communityPresentation.titleWeight).toBe(700);
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

test('Home community cover survives initialization without redundant metadata fetches',async({page})=>{
  let communityMediaQueries=0;
  await page.unroute('https://graphql.anilist.co/');
  await page.route('https://graphql.anilist.co/',async route=>{let body={};try{body=route.request().postDataJSON()||{}}catch{}const query=String(body.query||''),isCommunityMedia=/media\(id_in:\$ids,type:ANIME\)/.test(query);if(isCommunityMedia){communityMediaQueries++;const data=communityMediaQueries===1?graphData(query,body.variables):{Page:{media:[]}};return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data})})}return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:graphData(query,body.variables)})})});
  await page.addInitScript(pixel=>localStorage.setItem('aninexus:community:activity:v40',JSON.stringify([{id:'single-owner',kind:'state',media_id:101,username:'kayky',display_name:'Kayky Sousa',status:'CURRENT',created_at:new Date().toISOString(),title:'Anime Teste 101',cover:pixel,media:{id:101,title:'Anime Teste 101',cover:pixel}}])),pixel);
  await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});
  const hero=page.locator('#nx35CommunityHero');
  const card=hero.locator('.nx35-community-card.compact').first();
  await expect(card).toBeVisible({timeout:30000});
  await expect(hero).toHaveAttribute('data-nx-community-owner','shared');
  await expect(card.locator('.nx35-community-cover>a>img')).toHaveAttribute('src',pixel);
  await page.waitForTimeout(1100);
  expect(communityMediaQueries).toBe(0);
  await expect(card.locator('.nx35-community-cover>a>img')).toHaveAttribute('src',pixel);
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
  const destinations=[['anime','.nx21-catalog-page'],['manga','.nx21-reading-page'],['season','.nx-season'],['schedule','.nx18-schedule'],['news','.nx35-news-page'],['home','.nx35-home']];
  for(const[key,selector]of destinations){
    await page.locator(`.main-nav [data-nav="${key}"]`).click();
    await expect(page.locator(selector)).toBeVisible({timeout:30000});
    await expect(page.locator(key==='home'?'.nx44-radio--inline':'.nx44-radio--float')).toHaveAttribute('data-state','playing');
    expect(await page.evaluate(()=>document.querySelector('#nx44RadioAudio')===window.__nxOriginalAudio),key).toBe(true);
  }
  expect(await page.evaluate(()=>window.__nxPlayCalls)).toBe(1);
});

test('radio navigation reaches modern Home after a cold non-Home entry',async({page})=>{
  await bridgeProductionAssets(page);
  await page.addInitScript(()=>sessionStorage.setItem('aninexus:radio:activated:v44','1'));
  await page.goto(firstVisitUrl('/animes/catalogo'),{waitUntil:'domcontentloaded'});
  await expect(page.locator('.nx21-catalog-page')).toBeVisible({timeout:30000});
  await expect.poll(()=>page.evaluate(()=>window.__NX_HOME_V35_LOADER__?.status)).toBe('ready');
  expect(await page.evaluate(()=>window.AniNexusRadio.navigate('/'))).toBe(true);
  await expect(page.locator('.nx35-home')).toBeVisible({timeout:30000});
  await expect(page.locator('.hero,.aqx-home')).toHaveCount(0);
  await expect(page.locator('#app')).not.toContainText('Descubra. Acompanhe. Compartilhe.');
});

test('ordinary navigation keeps one healthy document across primary destinations',async({page})=>{
  await bridgeProductionAssets(page);
  await page.goto(firstVisitUrl('/'),{waitUntil:'domcontentloaded'});
  await expect(page.locator('.nx35-home')).toBeVisible({timeout:30000});
  const documentOrigin=await page.evaluate(()=>performance.timeOrigin);
  const destinations=[['anime','.nx21-catalog-page'],['manga','.nx21-reading-page'],['schedule','.nx18-schedule'],['news','.nx35-news-page'],['home','.nx35-home']];
  for(const[key,selector]of destinations){
    await page.locator(`.main-nav [data-nav="${key}"]`).click();
    await expect(page.locator(selector)).toBeVisible({timeout:30000});
    expect(await page.evaluate(()=>performance.timeOrigin),key).toBe(documentOrigin);
    await expect(page.locator('.nx-route-fail')).toHaveCount(0);
  }
});

test('mobile login click renders the account shell without reloading the document',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await bridgeProductionAssets(page);
  await page.goto(firstVisitUrl('/'),{waitUntil:'domcontentloaded'});
  await expect(page.locator('.nx35-home')).toBeVisible({timeout:30000});
  const documentOrigin=await page.evaluate(()=>performance.timeOrigin);
  await page.locator('[data-action="drawer-open"]:visible').first().click();
  await page.locator('#drawer [data-action="login"]').click();
  await waitForLogin(page);
  expect(await page.evaluate(()=>performance.timeOrigin)).toBe(documentOrigin);
  await expect(page.locator('#topbar')).toBeVisible();
  await expect(page.locator('.nx-route-fail')).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveClass(/nx-dedicated-route-boot/);
});

test('mobile work card click opens its detail without a reload or stuck route loader',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await bridgeProductionAssets(page);
  await page.goto(firstVisitUrl('/animes/catalogo'),{waitUntil:'domcontentloaded'});
  const card=page.locator('[data-nx21-open]').first();
  await expect(card).toBeVisible({timeout:30000});
  const documentOrigin=await page.evaluate(()=>performance.timeOrigin);
  await card.click();
  await expect(page.locator('.nx22-detail:not(.nx22-fail)')).toBeVisible({timeout:30000});
  expect(await page.evaluate(()=>performance.timeOrigin)).toBe(documentOrigin);
  await expect(page).toHaveURL(/\/anime\/[^/?#]+-\d+/);
  await expect(page.locator('.nx-route-fail')).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveClass(/nx-dedicated-route-boot/);
});

test('route guard replaces unrelated markup with an owned failure instead of revealing it',async({page,browserName})=>{
  test.skip(browserName!=='chromium','The accelerated ten-second timeout is deterministic in Chromium.');
  await page.addInitScript(()=>{
    const nativeTimeout=window.setTimeout.bind(window);
    window.setTimeout=(callback,delay,...args)=>nativeTimeout(callback,delay===10000?80:delay,...args);
    addEventListener('DOMContentLoaded',()=>{document.querySelector('#app').innerHTML='<main class="wrong-route-renderer">Interface de outra rota</main>'},{once:true});
  });
  await page.route('**/preview-v20/catalog-v20.js*',route=>route.abort('failed'));
  await page.goto(pageUrl('/animes/catalogo'),{waitUntil:'domcontentloaded'});
  const failure=page.locator('.nx-route-fail[data-route-owner="catalog"]');
  await expect(failure).toBeVisible({timeout:5000});
  await expect(page.locator('.wrong-route-renderer')).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveClass(/nx-dedicated-route-boot/);
});

test('slow authentication keeps a recognizable shell without repainting the whole body black',async({page})=>{
  let releaseSdk;
  const sdkGate=new Promise(resolve=>{releaseSdk=resolve});
  await page.route('**/runtime-config.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:`window.__ANINEXUS_CONFIG__=Object.freeze({environment:'test',siteOrigin:location.origin,apiOrigin:'https://api.clerk.test',clerkPublishableKey:['pk','test','dGVzdC5jbGVyay5hY2NvdW50cy5kZXYk'].join('_'),authEnabled:true});`}));
  await page.route('https://test.clerk.accounts.dev/**',async route=>{await sdkGate;await route.abort('failed')});
  await page.goto(pageUrl('/login'),{waitUntil:'domcontentloaded'});
  const auth=page.locator('.nx38-auth-page');
  await expect(auth).toBeVisible({timeout:5000});
  await expect(page.locator('#nx38ClerkLoading')).toContainText('Preparando acesso seguro');
  await expect(page.locator('#topbar')).toBeVisible();
  const visual=await page.evaluate(()=>({body:getComputedStyle(document.body).backgroundColor,page:getComputedStyle(document.querySelector('.nx38-auth-page')).backgroundColor,boot:document.documentElement.classList.contains('nx-dedicated-route-boot')}));
  expect(visual.body).toBe('rgb(8, 6, 11)');
  expect(visual.page).toBe('rgb(8, 6, 8)');
  expect(visual.boot).toBe(false);
  releaseSdk();
});

test('shared navigation starts new pages at the top and restores the previous history entry',async({page})=>{
  await page.goto(pageUrl('/animes/catalogo'),{waitUntil:'domcontentloaded'});
  await expect(page.locator('.nx21-catalog-page')).toBeVisible({timeout:30000});
  const initialEntry=await page.evaluate(()=>history.state?.__aninexusEntryId);
  await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto'});
  await page.mouse.wheel(0,700);
  await expect.poll(()=>page.evaluate(()=>Math.round(scrollY)),{timeout:3000}).toBeGreaterThan(100);
  const previousY=await page.evaluate(()=>Math.round(scrollY));
  expect(previousY).toBeGreaterThan(100);
  expect(await page.evaluate(()=>window.AniNexusGo('/quem-somos',{popstate:false}))).toBe(true);
  await expect(page.locator('.nx-inst')).toBeVisible({timeout:10000});
  await expect.poll(()=>page.evaluate(()=>Math.round(scrollY))).toBeLessThanOrEqual(2);
  await expect.poll(()=>page.evaluate(key=>JSON.parse(sessionStorage.getItem('aninexus:navigation-scroll:v1')||'{}')[key]?.y||0,initialEntry),{timeout:3000}).toBeGreaterThanOrEqual(previousY-2);
  await expect(page.locator('body')).not.toHaveClass(/nx21-catalog-active|nx38-auth-active/);
  await page.goBack({waitUntil:'domcontentloaded'});
  await expect(page.locator('.nx21-catalog-page')).toBeVisible({timeout:30000});
  await expect.poll(()=>page.evaluate(()=>Math.round(scrollY)),{timeout:5000}).toBeGreaterThanOrEqual(previousY-12);
  await expect.poll(()=>page.evaluate(()=>Math.round(scrollY)),{timeout:5000}).toBeLessThanOrEqual(previousY+12);
});

test('detail runtime removes a failed load and succeeds on the next real attempt',async({page})=>{
  await bridgeProductionAssets(page);
  let runtimeRequests=0,runtimeFailures=0,allowRuntime=false;
  await page.route('**/preview-v22/detail-v22.js*',route=>{runtimeRequests++;if(!allowRuntime){runtimeFailures++;return route.abort('failed')}return route.fallback()});
  await page.addInitScript(()=>sessionStorage.setItem('aninexus:radio:activated:v44','1'));
  await page.goto(firstVisitUrl('/animes/catalogo'),{waitUntil:'domcontentloaded'});
  const card=page.locator('[data-nx21-open]').first();
  await expect(card).toBeVisible({timeout:30000});
  await expect.poll(()=>runtimeFailures).toBeGreaterThanOrEqual(1);
  const requestsBeforeRetry=runtimeRequests;allowRuntime=true;
  await card.click();
  await expect(page.locator('.nx22-detail:not(.nx22-fail)')).toBeVisible({timeout:30000});
  expect(runtimeRequests).toBeGreaterThan(requestsBeforeRetry);
  await expect(page.locator('script[data-nx22-runtime-state="failed"]')).toHaveCount(0);
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

test('local activity adopts the signed-in member name avatar and public profile',async({page})=>{await page.addInitScript(pixel=>localStorage.setItem('aninexus:community:activity:v40',JSON.stringify([{id:'signed-member',kind:'state',media_id:101,username:'',display_name:'',avatar_url:'',status:'CURRENT',created_at:new Date().toISOString(),title:'Anime Teste 101',cover:pixel,local:true}])),pixel);await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});await page.evaluate(pixel=>{window.AniNexusAccountData=async()=>({displayName:'Kayky Sousa',username:'kayky',avatarUrl:pixel});dispatchEvent(new CustomEvent('aninexus:account-identity-changed'))},pixel);const hero=page.locator('#nx35CommunityHero');await expect(hero).toContainText('Kayky Sousa',{timeout:30000});await expect(hero.locator('.nx35-community-avatar>img')).toHaveAttribute('src',pixel);await expect(hero.getByRole('link',{name:'Kayky Sousa',exact:true})).toHaveAttribute('href',/kayky/);await expect(hero.locator('.nx35-community-cover>a')).toHaveAttribute('href',/anime/);await expect(hero).not.toContainText('Sua lista')});

test('mobile drawer prioritizes the account, library and compact destinations',async({page},testInfo)=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(firstVisitUrl('/'),{waitUntil:'domcontentloaded'});
  await expect(page.locator('.nx42-consent')).toBeVisible();
  await page.locator('[data-action="drawer-open"]').click();
  const drawer=page.locator('#drawer'),panel=drawer.locator('.drawer-panel'),auth=drawer.locator('.drawer-auth-card'),links=drawer.locator('.drawer-nav-grid>a'),library=drawer.locator('.drawer-library-link'),theme=drawer.locator('[data-nx-drawer-theme]'),install=drawer.locator('[data-nx-install]');
  await expect(panel).toBeVisible();
  await expect(links).toHaveCount(6);
  expect(await links.locator('strong').allTextContents()).toEqual(['Início','Animes','Mangás','Temporadas','Programação','Notícias']);
  await expect(drawer.locator('.drawer-nav-grid small')).toHaveCount(0);
  await expect(library).toBeVisible();
  await expect(library).toHaveAttribute('href','/minha-biblioteca');
  await expect(auth.getByRole('button',{name:'Entrar',exact:true})).toBeVisible();
  await expect(auth.getByRole('button',{name:'Criar conta',exact:true})).toBeVisible();
  await expect.poll(()=>panel.evaluate(element=>Math.abs(innerWidth-element.getBoundingClientRect().right))).toBeLessThanOrEqual(1);
  const geometry=await panel.evaluate(element=>{const box=element.getBoundingClientRect();return{top:box.top,bottom:Math.abs(innerHeight-box.bottom),height:box.height,radius:parseFloat(getComputedStyle(element).borderTopLeftRadius)}});
  expect(Math.abs(geometry.top)).toBeLessThanOrEqual(1);
  expect(geometry.bottom).toBeLessThanOrEqual(1);
  expect(geometry.height).toBeGreaterThanOrEqual(843);
  expect(geometry.radius).toBe(0);
  await expect(theme).toBeVisible();
  await expect(theme).toHaveAttribute('data-nx-theme-bound','1');
  await expect(drawer.locator('.nx42-theme-card')).toHaveCount(0);
  const initialTheme=await page.locator('html').getAttribute('data-theme'),nextTheme=initialTheme==='dark'?'light':'dark';
  await theme.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme',nextTheme);
  await expect(theme).toHaveAttribute('data-nx-theme-bound','1');
  await theme.press('Enter');
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
  await expect(auth.locator('.drawer-profile-link')).toHaveCount(0);
  await expect(auth.getByRole('button',{name:'Pesquisar',exact:true})).toBeVisible();
  await expect(auth.getByRole('button',{name:'Configurações da conta',exact:true})).toBeVisible();
  await expect(auth.getByRole('button',{name:'Sair da conta',exact:true})).toBeVisible();
  await expect(auth.getByRole('button',{name:'Fechar menu',exact:true})).toBeVisible();
  await expect(auth.getByRole('button',{name:'Entrar',exact:true})).toHaveCount(0);
  const accountAlignment=await auth.evaluate(element=>{const avatar=element.querySelector('.drawer-account-avatar').getBoundingClientRect(),copy=element.querySelector('.drawer-auth-copy').getBoundingClientRect(),tools=element.querySelector('.drawer-account-tools').getBoundingClientRect(),box=element.getBoundingClientRect();return{avatarTop:Math.abs(avatar.top-copy.top),toolsTop:Math.abs(tools.top-copy.top),left:avatar.left-box.left,right:box.right-tools.right,height:box.height}});
  expect(accountAlignment.avatarTop).toBeLessThanOrEqual(2);
  expect(accountAlignment.toolsTop).toBeLessThanOrEqual(2);
  expect(accountAlignment.left).toBeGreaterThanOrEqual(-1);
  expect(accountAlignment.right).toBeGreaterThanOrEqual(-1);
  expect(accountAlignment.height).toBeLessThanOrEqual(64);
  await page.screenshot({path:testInfo.outputPath('drawer-authenticated-mobile.png')});
  await auth.getByRole('button',{name:'Sair da conta',exact:true}).click();
  const signout=page.locator('#drawerSignoutConfirm');
  await expect(signout).toBeVisible();
  await expect(signout.getByRole('heading',{name:'Sair da sua conta?'})).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('drawer-signout-mobile.png')});
  await signout.getByRole('button',{name:'Cancelar',exact:true}).click();
  await expect(signout).toBeHidden();
  await auth.getByRole('button',{name:'Pesquisar',exact:true}).click();
  await expect(drawer).toBeHidden();
  await expect(page.locator('#searchOverlay')).toBeVisible();
  await page.locator('#searchOverlay .search-close').click();
  await page.locator('[data-action="drawer-open"]').click();
  await expect(panel).toBeVisible();
  await page.evaluate(()=>window.AniNexusAuthV38.syncDrawerIdentity());
  await page.setViewportSize({width:320,height:700});
  await expect(auth.getByRole('button',{name:'Entrar',exact:true})).toBeVisible();
  await expect(auth.getByRole('button',{name:'Criar conta',exact:true})).toBeVisible();
  await expect(links).toHaveCount(6);
  await noOverflow(page,2);
});

test('mobile search closes explicitly and finds public users by handle',async({page},testInfo)=>{
  await page.route('**/api/users/search?**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:[{username:'kayky',displayName:'Kayky Sousa',avatarUrl:pixel}]})}));
  await page.route('**/api/users/kayky',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({profile:{username:'kayky',displayName:'Kayky Sousa',avatarUrl:pixel,privacy:'public',isPrivate:false,showLibrary:true,showActivity:true,showStats:true},stats:null,library:[],mangaLibrary:[],activity:[],impressions:[],achievements:[]})}));
  await page.setViewportSize({width:390,height:844});
  await page.goto(firstVisitUrl('/'),{waitUntil:'domcontentloaded'});
  await page.keyboard.press('Control+K');
  const overlay=page.locator('#searchOverlay'),input=page.locator('#searchInput');
  await expect(overlay).toBeVisible();
  await expect(overlay.locator('.search-close')).toBeVisible();
  await input.fill('@kay');
  await expect(overlay.locator('[data-search-kind="USER"]')).toHaveAttribute('aria-pressed','true');
  const result=overlay.getByRole('link',{name:/Kayky Sousa/});
  await expect(result).toBeVisible();
  await expect(result).toContainText('@kayky');
  await expect(result).toHaveAttribute('href','/u/kayky');
  await page.screenshot({path:testInfo.outputPath('search-users-mobile.png')});
  await overlay.locator('.search-close').click();
  await expect(overlay).toBeHidden();
  await page.keyboard.press('Control+K');
  await input.fill('@kay');
  await expect(result).toBeVisible();
  await result.click();
  await expect.poll(()=>page.evaluate(()=>new URLSearchParams(location.search).get('p')||location.pathname)).toBe('/u/kayky');
  await expect(overlay).toBeHidden();
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
      await next.evaluate(button=>button.click());
      const expected=Math.min(metrics.max,Math.round((metrics.start+metrics.unit*metrics.visible)/metrics.unit)*metrics.unit);
      await expect.poll(()=>rail.evaluate(element=>element.scrollLeft)).toBeGreaterThanOrEqual(expected-5);
    }
  }
});

test('Home character ranking favorites and reorders with internal counts',async({page})=>{
  await mockInternalRankings(page);
  let writeMethod='';
  const favoriteRoute=async route=>{
    const request=route.request(),url=new URL(request.url());
    if(request.method()==='GET')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:[{characterId:501}]})});
    writeMethod=request.method();
    const id=Number(url.pathname.split('/').pop());
    await new Promise(resolve=>setTimeout(resolve,180));
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,characterId:id,favorite:request.method()==='PUT',favoriteCount:request.method()==='PUT'?99:12})});
  };
  await page.route('**/api/me/character-favorites',favoriteRoute);
  await page.route('**/api/me/character-favorites/*',favoriteRoute);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.setViewportSize({width:1440,height:900});
  await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});
  await allowAccountActions(page,{id:'character-member'});
  const section=page.locator('.nx47-character-ranking'),cards=section.locator('.nx47-character-card');
  await expect(section).toBeVisible({timeout:30000});
  await expect(cards).toHaveCount(10);
  await expect(cards.first().locator('h3')).toHaveText('Monkey D. Luffy');
  await expect(section.getByRole('button',{name:/Remover Naruto Uzumaki/})).toHaveAttribute('aria-pressed','true');
  await expect(section.locator('.nx45-rank-score,.nx35-score')).toHaveCount(0);
  const order=await page.locator('#nx42TopManga,.nx47-character-ranking,#nx35Awards').evaluateAll(nodes=>nodes.map(node=>node.id||node.className));
  expect(order[0]).toBe('nx42TopManga');
  const anya=section.getByRole('button',{name:/Adicionar Anya Forger/});
  await anya.evaluate(button=>{window.__nxOriginalCharacterButton=button});
  await page.evaluate(()=>{window.__nxCharacterAnimations=[];document.addEventListener('animationstart',event=>{if(event.target.matches?.('[data-character-favorite="508"]'))window.__nxCharacterAnimations.push(event.animationName)},true)});
  await anya.click();
  const anyaFavorite=section.locator('[data-character-favorite="508"]');
  await expect.poll(()=>page.evaluate(()=>window.__nxCharacterAnimations)).toContain('nx39-action-pop');
  await expect(anyaFavorite).toHaveAttribute('aria-pressed','true');
  await expect.poll(()=>writeMethod).toBe('PUT');
  await expect(cards.first().locator('h3')).toHaveText('Anya Forger');
  await expect(cards.first().locator('.nx47-character-count')).toContainText('99 favoritos');
  await expect(cards.first().getByRole('button')).toHaveAttribute('aria-pressed','true');
  const activeVisual=await cards.first().getByRole('button').evaluate(button=>{const reference=document.createElement('button');reference.dataset.nxActionOwner='global';reference.dataset.nxActionKind='compact';reference.setAttribute('aria-pressed','true');document.body.append(reference);const result={background:getComputedStyle(button).backgroundColor,expectedBackground:getComputedStyle(reference).backgroundColor,fill:getComputedStyle(button.querySelector('svg')).fill};reference.remove();return result});
  expect(activeVisual.background).toBe(activeVisual.expectedBackground);expect(activeVisual.fill).toBe('rgb(255, 255, 255)');
  await expect(cards.first().getByRole('button')).not.toHaveClass(/nx39-pop/,{timeout:2000});
  expect(await anyaFavorite.evaluate(button=>button===window.__nxOriginalCharacterButton)).toBe(true);
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
  await anyaFavorite.click();
  await expect.poll(()=>writeMethod).toBe('DELETE');
  await expect(anyaFavorite).toHaveAttribute('aria-pressed','false');
  await expect(section.locator('[data-character-card="508"] .nx47-character-count')).toContainText('12 favoritos');
  await expect(anyaFavorite).toBeEnabled();
  await page.emulateMedia({reducedMotion:'reduce'});
  await anyaFavorite.click();
  await expect.poll(()=>writeMethod).toBe('PUT');
  await expect(anyaFavorite).toHaveAttribute('aria-pressed','true');
  await expect(anyaFavorite).toHaveCSS('animation-name','none');
});

test('static fallback never turns provider metrics into AniNexus rankings',async({page})=>{test.skip(!new URL(ORIGIN).hostname.endsWith('github.io'),'This policy is exercised by the static provider fallback.');await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});await expect(page.locator('#nx35Top .nx35-metric-empty')).toContainText('avaliações da comunidade',{timeout:30000});await expect(page.locator('#nx35Popular .nx35-metric-empty')).toContainText('listas, favoritos e impressões');await expect(page.locator('#nx42TopManga .nx45-ranking-empty')).toContainText('comunidade avalia');await expect(page.locator('#nx35Top .nx35-rank')).toHaveCount(0);await expect(page.locator('#nx35Popular .nx35-anime')).toHaveCount(0);await expect(page.locator('#nx42TopManga .nx35-rank')).toHaveCount(0)});

test('Home Top 10 opens the complete catalog ranking and survives a reload',async({page})=>{
  const requests=[];
  const hosted=new URL(ORIGIN).hostname.endsWith('github.io');
  const catalogEndpoint=hosted?'https://graphql.anilist.co/api/catalog?**':'**/api/catalog?**';
  await page.route('**/runtime-config.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:`window.__ANINEXUS_CONFIG__=Object.freeze({environment:'test',siteOrigin:'https://qgbaltigo.github.io/AniNexus',apiOrigin:'https://graphql.anilist.co',clerkPublishableKey:'pk_test_home_ranking',authEnabled:true});`}));
  await mockInternalRankings(page);
  await page.route(catalogEndpoint,route=>{const url=new URL(route.request().url()),params=Object.fromEntries(url.searchParams),current=Number(params.page||1);requests.push(params);const items=Array.from({length:25},(_,index)=>rankedMedia(7000+(current-1)*25+index+1));return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items,pageInfo:{total:100,currentPage:current,lastPage:4,hasNextPage:current<4}})})});
  await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});
  const topSection=page.locator('#nx35Top').locator('xpath=ancestor::section[1]');
  const rankingLink=topSection.getByRole('link',{name:'Ver ranking'});
  await expect(rankingLink).toHaveAttribute('data-nx27-path','/animes/catalogo?secao=ranking');
  await rankingLink.click();
  await expect(page.getByRole('heading',{name:'Top 100 Animes'})).toBeVisible({timeout:30000});
  await expect(page.locator('.nx21-rank')).toHaveCount(100);
  const navigated=new URL(page.url());
  if(hosted)expect(navigated.searchParams.get('p')).toBe('/animes/catalogo?secao=ranking');
  else expect(`${navigated.pathname}${navigated.search}`).toBe('/animes/catalogo?secao=ranking');
  expect(requests.filter(request=>request.sort==='SCORE').map(request=>request.page).sort()).toEqual(['1','2','3','4']);
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:'Top 100 Animes'})).toBeVisible({timeout:30000});
  await expect(page.locator('.nx21-rank')).toHaveCount(100);
});

test('Home ranking clicks are not swallowed by horizontal drag support',async({page})=>{test.skip(new URL(ORIGIN).hostname.endsWith('github.io'),'Rankings require internal AniNexus metrics.');await mockInternalRankings(page);await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});await expect(page.locator('#nx35Top .nx35-rank h3').first()).toBeVisible({timeout:30000});await page.locator('#nx35Top .nx35-rank h3').first().click();await page.waitForURL(url=>url.searchParams.get('p')?.startsWith('/anime/')||url.pathname.startsWith('/anime/'),{timeout:10000});await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});const manga=page.locator('#nx42TopManga a[data-nx42-type="manga"]').first();await expect(manga).toBeVisible({timeout:30000});await expect(manga).toHaveAttribute('data-nx23-dedicated',/\/manga\/.+-\d+/);await manga.locator('h3').click();await page.waitForURL(url=>url.searchParams.get('p')?.startsWith('/manga/')||url.pathname.startsWith('/manga/'),{timeout:10000})});

test('Awards presents every edition and winner in a rich isolated archive',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto(pageUrl('/anime-awards'),{waitUntil:'domcontentloaded'});
  await expect(page.locator('.nx45-awards-page')).toBeVisible({timeout:30000});
  await expect(page.getByRole('heading',{name:'Vencedores de 2026'})).toBeVisible();
  await expect(page.locator('[data-nx45-year]')).toHaveCount(10);
  await expect(page.locator('[data-nx45-year-select] option')).toHaveCount(10);
  await expect(page.locator('.nx45-award-card')).toHaveCount(32);
  await expect(page.locator('[data-nx45-count]')).toHaveText('32 resultados');
  await expect(page.locator('.nx45-award-feature-art img')).toBeVisible();
  await expect(page.locator('.nx45-award-related-item')).toHaveCount(6);
  await expect(page.locator('#topbar')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  const fourthWinner=await page.locator('.nx45-award-card').nth(3).locator('.nx45-award-card-copy strong').textContent();
  await page.locator('.nx45-award-card').nth(3).click();
  await expect(page.locator('.nx45-award-feature h2')).toHaveText(fourthWinner);
  await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(100);
  await expect(page.locator('.nx45-award-feature')).toBeFocused();
  await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';scrollTo(0,0)});
  await expect(page.locator('body')).not.toHaveClass(/nx45-awards-scrolled/);
  await page.evaluate(()=>scrollTo(0,1000));
  await expect(page.locator('body')).toHaveClass(/nx45-awards-scroll-down/);
  await expect(page.locator('#nx45AwardsIsland')).toHaveClass(/show/);
  await expect.poll(async()=>{const box=await page.locator('#topbar').boundingBox();return box?.y+box?.height||0}).toBeLessThanOrEqual(1);
  await page.waitForTimeout(650);
  await page.evaluate(()=>scrollTo(0,700));
  await expect(page.locator('body')).toHaveClass(/nx45-awards-scroll-up/);
  await expect(page.locator('#nx45AwardsIsland')).not.toHaveClass(/expanded/);
  await expect.poll(async()=>{const box=await page.locator('#topbar').boundingBox();return box?.y+box?.height||0}).toBeLessThanOrEqual(1);
  await page.evaluate(()=>scrollTo(0,0));
  await page.locator('[data-nx45-next]').click();
  await expect(page.locator('[data-nx45-stage-index]')).toHaveText('05 / 32');
  await page.getByRole('button',{name:/Vozes/}).click();
  await expect(page.locator('.nx45-award-card')).toHaveCount(10);
  await expect(page.locator('[data-nx45-count]')).toHaveText('10 resultados');
  await page.locator('[data-nx45-year="2017"]').click();
  await expect(page.getByRole('heading',{name:'Vencedores de 2017'})).toBeVisible();
  await expect(page.locator('.nx45-award-card')).toHaveCount(14);
  await expect(page.locator('.nx45-award-card img')).toHaveCount(14);
  await expect(page.locator('.nx45-award-card-art.is-archive')).toHaveCount(0);
  await expect(page.locator('[data-nx45-year-select]')).toHaveValue('2017');
  await noOverflow(page,2);
  await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});
  await expect(page.locator('.nx35-home')).toBeVisible({timeout:30000});
  await expect(page.locator('#nx35Awards.nx46-home-awards')).toBeVisible({timeout:30000});
  await expect(page.locator('.nx45-awards-page')).toHaveCount(0);
});

test('Awards mobile keeps the full year legible and the archive in one column',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(pageUrl('/anime-awards'),{waitUntil:'domcontentloaded'});
  const select=page.locator('[data-nx45-year-select]');
  await expect(select).toBeVisible({timeout:30000});
  await expect(select).toHaveValue('2026');
  expect((await select.boundingBox()).width).toBeGreaterThanOrEqual(100);
  await expect(page.locator('.nx45-awards-intro>[data-nx45-years]')).toBeHidden();
  await expect(page.locator('.nx45-award-card')).toHaveCount(32);
  await expect(page.locator('.nx45-award-related')).toBeHidden();
  const topSpacing=await page.evaluate(()=>document.querySelector('.nx45-awards-title').getBoundingClientRect().top-document.querySelector('#topbar').getBoundingClientRect().bottom);
  expect(topSpacing).toBeLessThanOrEqual(18);
  const stageButtons=await page.locator('.nx45-awards-stage-nav button').evaluateAll(nodes=>nodes.map(node=>({width:node.getBoundingClientRect().width,radius:getComputedStyle(node).borderRadius})));
  expect(stageButtons.every(button=>button.width<=34&&button.radius==='0px')).toBe(true);
  const filterLayout=await page.locator('[data-nx45-filters] button').evaluateAll(nodes=>nodes.map(node=>{const box=node.getBoundingClientRect();return{x:box.x,right:box.right,y:box.y,clips:node.scrollWidth>node.clientWidth}}));
  expect(filterLayout.every(item=>item.x>=0&&item.right<=390&&!item.clips)).toBe(true);
  expect(new Set(filterLayout.map(item=>Math.round(item.y))).size).toBeGreaterThan(1);
  const firstTwo=await page.locator('.nx45-award-card').evaluateAll(nodes=>nodes.slice(0,2).map(node=>node.getBoundingClientRect()));
  expect(Math.round(firstTwo[0].x)).toBe(Math.round(firstTwo[1].x));
  expect(firstTwo[1].y).toBeGreaterThan(firstTwo[0].y+firstTwo[0].height-2);
  expect(await page.locator('.nx45-award-card-copy strong').evaluateAll(nodes=>nodes.every(node=>node.scrollHeight<=node.clientHeight+1))).toBe(true);
  await select.selectOption('2018');
  await expect(page.getByRole('heading',{name:'Vencedores de 2018'})).toBeVisible();
  await expect(page.locator('.nx45-award-card')).toHaveCount(17);
  const activeYear=page.locator('[data-nx45-year="2018"]');
  await expect(activeYear).toHaveAttribute('aria-pressed','true');
  await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';scrollTo(0,1000)});
  await expect(page.locator('#nx45AwardsIsland')).toBeVisible();
  await expect.poll(async()=>{const box=await page.locator('#topbar').boundingBox();return box?.y+box?.height||0}).toBeLessThanOrEqual(1);
  expect((await page.locator('.nx45-awards-island-head').boundingBox()).height).toBeLessThanOrEqual(49);
  await expect(page.locator('.nx45-awards-island-chevron')).toHaveCSS('border-radius','50%');
  await expect(page.locator('.nx45-awards-island-panel')).toBeHidden();
  const awardsScrollY=await page.evaluate(()=>scrollY);
  await page.locator('.nx45-awards-island-head').click();
  await expect(page.locator('.nx45-awards-island-panel')).toBeVisible();
  await page.waitForTimeout(600);
  await expect(page.locator('#nx45AwardsIsland')).toHaveClass(/expanded/);
  await expect(page.locator('.nx45-awards-island-panel')).toBeVisible();
  expect(Math.abs((await page.evaluate(()=>scrollY))-awardsScrollY)).toBeLessThanOrEqual(2);
  await noOverflow(page,2);
});

test('production detail paints from the internal API without waiting for external providers',async({page})=>{const origin=new URL(firstVisitUrl('/')).origin,assetPrefix=new URL(ORIGIN).hostname.endsWith('github.io')?'/AniNexus':'',base=anime(101),normalized={id:base.id,idMal:null,mediaType:'ANIME',title:base.title.english,titleRomaji:base.title.romaji,titleNative:base.title.native,synonyms:[],cover:pixel,coverColor:'#ef2a5c',banner:pixel,description:base.description,genres:base.genres,tags:['Action'],tagDetails:[{name:'Action',rank:90,isMediaSpoiler:false}],score:8.2,meanScore:8.1,popularity:1000,favourites:100,episodes:12,duration:24,format:'TV',status:'RELEASING',season:'SUMMER',seasonYear:2026,country:'JP',source:'ORIGINAL',startDate:base.startDate,endDate:null,studios:[],streaming:[],nextAiringEpisode:null,trailer:null,characters:[],staff:[],relations:[],recommendations:[]};let apiHits=0;await page.route(`${origin}/preview-v22/**`,async route=>{const requested=new URL(route.request().url()),response=await route.fetch({url:`${origin}${assetPrefix}${requested.pathname}${requested.search}`});await route.fulfill({response})});await page.route(`${origin}/api/anime/101`,async route=>{apiHits++;await new Promise(resolve=>setTimeout(resolve,80));await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(normalized)})});await page.unroute('https://graphql.anilist.co/');await page.route('https://graphql.anilist.co/',route=>route.abort('failed'));const started=Date.now();await page.goto(firstVisitUrl('/anime/anime-teste-101'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx22-detail:not(.nx22-loading):not(.nx22-fail)')).toBeVisible({timeout:5000});await expect(page.getByRole('heading',{name:'Anime Teste 101'})).toBeVisible();expect(Date.now()-started).toBeLessThan(5000);expect(apiHits).toBe(1);await page.getByRole('tab',{name:'Personagens & equipe'}).click();await expect(page.locator('.nx22-detail-empty')).toHaveCount(2);await expect(page.locator('.nx22-detail-empty').first()).toContainText('Personagens ainda não disponíveis');await page.getByRole('tab',{name:'Franquia'}).click();await expect(page.locator('.nx22-detail-empty')).toContainText('Franquia ainda não disponível');await noOverflow(page,2)});

test('detail metrics and tags are presented in the requested Portuguese AniQuim pattern',async({page})=>{
  const tags=['Polyamorous','Coming of Age','Family Life','Espionage'],media={id:101,mediaType:'ANIME',metricsSource:'aninexus',title:'Anime Teste 101',titleRomaji:'Anime Teste 101',cover:pixel,banner:'',description:'Uma história.',genres:['Action'],tags,tagDetails:tags.map(name=>({name,rank:90,isMediaSpoiler:false})),score:9,meanScore:9,popularity:328,listCount:95,ratingCount:95,favourites:12,episodes:12,format:'TV',status:'RELEASING',country:'JP',source:'ORIGINAL',studios:[],streaming:[],nextAiringEpisode:{episode:12,airingAt:Date.now()/1000+345600},characters:[],staff:[],relations:[],recommendations:[]};
  await page.route('**/api/anime/101',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(media)}));
  await page.setViewportSize({width:390,height:844});await page.goto(firstVisitUrl('/anime/anime-teste-101'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx22-detail:not(.nx22-fail)')).toBeVisible({timeout:30000});
  await expect(page.locator('.nx22-stats strong')).toHaveText(['9.00','328','95']);
  await expect(page.locator('.nx22-chips [data-nx22-tag]')).toHaveText(['Poliamor','Amadurecimento','Vida em família','Espionagem']);
  const chipStyles=await page.locator('.nx22-chips a').evaluateAll(chips=>chips.map(chip=>({genre:chip.classList.contains('genre'),radius:parseFloat(getComputedStyle(chip).borderRadius),background:getComputedStyle(chip).backgroundColor})));expect(chipStyles.every(chip=>chip.radius<=6)).toBe(true);expect(chipStyles.find(chip=>chip.genre)?.background).not.toBe(chipStyles.find(chip=>!chip.genre)?.background);
  await expect(page.locator('[data-nx22-rating],[data-nx22-rating-star]')).toHaveCount(0);await expect(page.locator('.nx22-hero-bg')).toHaveClass(/is-cover-fallback/);await expect(page.locator('.nx22-hero-bg')).not.toHaveClass(/is-invalid/);await expect(page.locator('.nx22-hero-bg img')).toHaveCSS('filter',/blur\(/);
  await expect(page.locator('.nx22-fav')).toHaveCSS('background-image','none');await expect(page.locator('.nx22-list')).toHaveCSS('background-image','none');
  await expect(page.locator('.nx22-hero .nx22-airing')).toHaveCount(0);await expect(page.locator('.nx22-content>.nx22-overview-schedule')).toBeVisible();await expect(page.locator('.nx22-airing-copy small')).toHaveText('PRÓXIMO EPISÓDIO');await expect(page.locator('.nx22-airing-countdown')).toContainText('ESTREIA EM');await expect(page.locator('#nx22Synopsis')).toHaveText('Uma história.');
  await expect(page.locator('.nx42-official-watch,[data-member-telegram]')).toHaveCount(0);await expect(page.getByRole('heading',{name:'Gêneros e temas'})).toHaveCount(0);
  const akira=page.locator('.nx22-akira-file');await expect(akira).toBeVisible();await expect(akira).toContainText('Arquivo X da Akira');await expect(akira).toContainText('Anime Teste 101');await expect(akira.locator('img')).toHaveAttribute('src',/akira-arquivo-x-v1\.png$/);
  const schedule=await page.locator('.nx22-overview-schedule .nx22-airing').boundingBox(),content=await page.locator('.nx22-content').boundingBox(),synopsis=await page.getByRole('heading',{name:'Sinopse'}).boundingBox(),akiraBox=await akira.boundingBox();expect(schedule.height).toBeGreaterThanOrEqual(60);expect(Math.abs((schedule.x+schedule.width/2)-(content.x+content.width/2))).toBeLessThanOrEqual(1);expect(schedule.y+schedule.height).toBeLessThan(synopsis.y);expect(synopsis.y).toBeLessThan(akiraBox.y);
  const navGeometry=await page.evaluate(()=>{const nav=document.querySelector('.nx22-tabs').getBoundingClientRect(),row=document.querySelector('.nx22-tabs-row').getBoundingClientRect(),first=document.querySelector('.nx22-content').firstElementChild.getBoundingClientRect();return{navHeight:nav.height,rowHeight:row.height,gap:first.top-nav.bottom}});expect(navGeometry.navHeight).toBeLessThanOrEqual(navGeometry.rowHeight+1);expect(navGeometry.gap).toBeLessThanOrEqual(14);
});

test('anime and manga synopsis removes source credits and upgrades through the cached server translation',async({page})=>{
  const translated='Uma jovem parte em uma aventura decisiva com seus amigos, enfrenta novos perigos e descobre que sua própria história pode transformar o mundo.';
  await page.route('https://translate.googleapis.com/**',route=>route.abort('failed'));
  await page.route('https://api.mymemory.translated.net/**',route=>route.abort('failed'));
  for(const item of [{type:'anime',id:101,mediaType:'ANIME',source:'A young traveler begins a decisive adventure with close friends, faces dangerous enemies, and learns that their own story can change the entire world. (Source: Crunchyroll)'},{type:'manga',id:202,mediaType:'MANGA',source:'After moving to a distant town, a quiet student meets an unlikely companion and uncovers a mystery that connects their families across generations. (Source: VIZ Media)'}]){
    const media={id:item.id,mediaType:item.mediaType,metricsSource:'aninexus',title:`Obra ${item.id}`,titleRomaji:`Obra ${item.id}`,cover:pixel,banner:pixel,description:item.source,genres:['Adventure'],tags:[],tagDetails:[],score:8,meanScore:8,popularity:10,listCount:2,format:item.mediaType==='MANGA'?'MANGA':'TV',status:'FINISHED',country:'JP',source:'ORIGINAL',studios:[],streaming:[{site:'VIZ',url:'https://www.viz.com',type:'STREAMING'}],characters:[],staff:[],relations:[],recommendations:[]};
    await page.route(`**/api/${item.type}/${item.id}`,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(media)}));
    await page.route(`**/api/synopsis/${item.type}/${item.id}`,async route=>{await new Promise(resolve=>setTimeout(resolve,350));await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({text:`${translated} (Fonte: VIZ Media)`,language:'pt-BR',translated:true})})});
    await page.goto(firstVisitUrl(`/${item.type}/obra-${item.id}`),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx22-detail:not(.nx22-fail)')).toBeVisible({timeout:30000});
    await expect(page.locator('#nx22Synopsis')).not.toContainText(/Source:|Fonte:/i);await expect(page.locator('.nx22-akira-file')).toContainText(`Obra ${item.id}`);await expect(page.locator('#nx22Synopsis')).toHaveText(translated,{timeout:3000});await expect(page.locator('#nx22SynopsisNote')).toHaveCount(0);await expect(page.getByRole('heading',{name:item.type==='manga'?'Onde ler':'Onde assistir'})).toBeVisible();await expect(page.getByRole('heading',{name:'Gêneros e temas'})).toHaveCount(0);
  }
});

test('detail replaces a broken remote banner with the available cover',async({page})=>{
  const broken='https://images.example.test/broken-banner.jpg',media={id:101,mediaType:'ANIME',metricsSource:'aninexus',title:'Anime Teste 101',titleRomaji:'Anime Teste 101',cover:pixel,banner:broken,description:'Uma história.',genres:['Mystery'],tags:[],tagDetails:[],score:8,popularity:12,listCount:3,format:'TV',status:'FINISHED',country:'JP',source:'ORIGINAL',studios:[],streaming:[],characters:[],staff:[],relations:[],recommendations:[]};
  await page.route('**/api/anime/101',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(media)}));await page.route(broken,route=>route.abort('failed'));
  await page.goto(firstVisitUrl('/anime/anime-teste-101'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx22-detail:not(.nx22-fail)')).toBeVisible({timeout:30000});const hero=page.locator('.nx22-hero-bg'),image=hero.locator('img');await expect(hero).toHaveClass(/is-cover-fallback/);await expect(hero).not.toHaveClass(/is-invalid/);await expect(image).toHaveAttribute('src',pixel);
});

test('detail tabs stay in one document, load real sections and preserve cross-media franchise links',async({page})=>{
  test.setTimeout(60000);
  await page.addInitScript(()=>sessionStorage.setItem('nx22:detail:anime:101',JSON.stringify({t:Date.now(),data:{id:101,mediaType:'ANIME',title:{english:'Cache antigo sem elenco'},characters:{edges:[]},staff:{edges:[]}}})));
  const related={id:202,mediaType:'MANGA',title:'Mangá Relacionado',titleRomaji:'Manga Relacionado',cover:pixel,description:'',genres:['Adventure'],tags:[],tagDetails:[],format:'MANGA',status:'FINISHED',country:'JP',source:'MANGA'};
  const unresolvedRelated={id:null,idMal:1735,mediaType:'ANIME',title:'Anime Relacionado por MAL',titleRomaji:'Anime Relacionado por MAL',cover:pixel,description:'',genres:[],tags:[],tagDetails:[],format:'TV',status:'',country:'JP',source:'MANGA'};
  const recommended={id:303,mediaType:'ANIME',title:'Anime Recomendado',titleRomaji:'Anime Recomendado',cover:pixel,description:'',genres:['Action'],tags:[],tagDetails:[],format:'TV',status:'FINISHED',country:'JP',source:'ORIGINAL'};
  const characters=[{id:1,name:'Personagem Principal',native:'主人公',role:'MAIN',image:pixel},...Array.from({length:13},(_,index)=>({id:index+10,name:`Personagem ${index+2}`,role:'SUPPORTING',image:pixel}))],staff=[{id:999,name:'Licenciadora indevida',role:'Licenciamento',image:''},{id:2,name:'Diretora Teste',role:'Director',image:pixel},...Array.from({length:9},(_,index)=>({id:index+30,name:`Equipe ${index+2}`,role:'Producer',image:pixel}))],relations=[{relationType:'ADAPTATION',media:related},{relationType:'SEQUEL',media:unresolvedRelated},...Array.from({length:5},(_,index)=>({relationType:'SIDE_STORY',media:{...related,id:220+index,title:`Relação ${index+3}`,titleRomaji:`Relacao ${index+3}`}}))];
  const media={id:101,mediaType:'ANIME',metricsSource:'aninexus',title:'Anime Abas 101',titleRomaji:'Anime Abas 101',cover:pixel,banner:pixel,description:'Uma história em português.',genres:['Action'],tags:[],tagDetails:[],score:8,popularity:12,listCount:3,format:'TV',status:'FINISHED',country:'JP',source:'ORIGINAL',studios:[],streaming:[],characters,staff,relations,recommendations:[{rating:15,media:recommended}]};
  const impression={id:'10000000-0000-4000-8000-000000000001',body:'Trecho seguro e ||segredo importante||.',has_spoilers:true,hideSpoilers:true,status_snapshot:'CURRENT',progress_snapshot:7,score_snapshot:8,impression_stage:'PRELIMINARY',created_at:new Date().toISOString(),likes_count:2,replies_count:1,user:{username:'reviewer',displayName:'Reviewer',avatarUrl:pixel},username:'reviewer',display_name:'Reviewer',avatar_url:pixel};
  const characterWrites=[],moderationWrites=[];let characterDeleteAttempts=0;
  await page.route('**/api/anime/101',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(media)}));
  await page.route(/\/api\/anime\/101\/impressions(?:\?.*)?$/,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:[impression]})}));
  await page.route('**/api/anime/101/episodes/*/comments/spoiler-check',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({allowed:true,userProgress:2,episodesAhead:0,status:'CURRENT'})}));
  await page.route(/\/api\/anime\/101\/episodes\/\d+\/comments(?:\?.*)?$/,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({animeId:101,episode:1,items:[],sort:'recent',hideSpoilers:true})}));
  await page.route('**/api/me/likes?**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:[]})}));
  await page.route('**/api/anime/101/activity',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({mediaId:101,mediaType:'ANIME',total:12,statuses:{PLANNING:5,CURRENT:3,COMPLETED:2,PAUSED:1,DROPPED:1},reactionTotal:10,reactions:[{key:'LOVE',label:'Amei',count:6,percentage:60},{key:'WOW',label:'De arrepiar',count:4,percentage:40}]})}));
  await page.route('**/api/me/character-favorites',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:[{characterId:1}]})}));
  await page.route('**/api/me/character-favorites/*',route=>{const request=route.request(),method=request.method();characterWrites.push({method,body:method==='PUT'?request.postDataJSON():null});if(method==='DELETE'&&++characterDeleteAttempts===1)return route.fulfill({status:503,contentType:'application/json',body:'{"error":"temporarily unavailable"}'});return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,characterId:Number(new URL(request.url()).pathname.split('/').pop()),favorite:method==='PUT',favoriteCount:method==='PUT'?4:3})})});
  await page.route('**/api/admin/content/IMPRESSION/*',route=>{moderationWrites.push({method:route.request().method(),body:route.request().postDataJSON()});return route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'})});
  await page.setViewportSize({width:1280,height:800});await page.goto(firstVisitUrl('/anime/anime-teste-101'),{waitUntil:'domcontentloaded'});await allowAccountActions(page,{id:'detail-character-member',username:'detail-member',role:'moderator'});await expect(page.locator('.nx22-detail:not(.nx22-fail)')).toBeVisible({timeout:30000});await expect(page.locator('.nx22-headcopy h1')).toHaveText('Anime Abas 101');await page.evaluate(()=>window.__nxTabDocument={created:Date.now()});
  await expect(page.locator('.nx22-translation-note')).toHaveCount(0);await expect(page.getByRole('tab',{name:'Atividade'})).toHaveCount(0);await expect(page.getByRole('tab',{name:'Impressões'})).toBeVisible();await expect(page.getByRole('tab',{name:'Comentários'})).toHaveCount(0);
  await expect(page.locator('.nx22-tabs-share,[data-nx22-share-menu]')).toHaveCount(0);await expect(page.locator('[data-nx22-share]')).toHaveCount(1);
  await expect(page.locator('#nx22Activity')).toHaveAttribute('data-state','ready');await expect(page.locator('.nx22-activity-card')).toHaveClass(/nx49-activity/);await expect(page.locator('#nx22Activity .nx49-activity-status')).toHaveCount(5);await expect(page.locator('#nx22Activity')).toContainText('Quero ver');await expect(page.locator('#nx22Activity')).toContainText('Amei 60%');
  await expect(page.locator('.nx50-social')).toHaveCount(0);await page.getByRole('tab',{name:'Impressões'}).click();await expect(page.locator('#nx22Panel .nx50-social')).toBeVisible();await expect(page.locator('.nx50-social-head,.nx50-comments')).toHaveCount(0);await expect(page.locator('.nx50-composer[data-nx50-composer="impression"]')).toBeVisible();await expect(page.locator('.nx50-editor-frame')).toBeVisible();await expect(page.locator('[data-nx50-mark-spoiler] svg,[data-nx50-help] svg')).toHaveCount(2);await expect(page.locator('[data-nx50-sort="popular"]')).toHaveClass(/active/);await expect(page.locator('.nx50-like svg,.nx50-reply-action svg')).toHaveCount(2);await expect(page.locator('#nx22Panel')).not.toContainText('♡');await expect(page.locator('#nx22Activity')).toHaveCount(0);const renderedSpoiler=page.locator('[data-nx50-spoiler]');await expect(renderedSpoiler).toHaveAttribute('aria-label','Revelar trecho com spoiler');expect(await renderedSpoiler.evaluate(element=>element.tagName)).toBe('SPAN');await renderedSpoiler.focus();await page.keyboard.press('Enter');await expect(renderedSpoiler).toHaveClass(/revealed/);await page.keyboard.press('Enter');await expect(renderedSpoiler).not.toHaveClass(/revealed/);
  await page.setViewportSize({width:390,height:844});const compactImpression=await page.locator('.nx50-impression-card').evaluate(card=>{const box=card.getBoundingClientRect(),header=card.querySelector(':scope>header').getBoundingClientRect(),byline=card.querySelector('.nx50-byline').getBoundingClientRect(),context=card.querySelector('.nx50-context').getBoundingClientRect(),body=card.querySelector(':scope>.nx50-body').getBoundingClientRect(),footer=card.querySelector(':scope>footer').getBoundingClientRect(),action=card.querySelector('.nx50-icon-action').getBoundingClientRect();return{height:box.height,bylineHeight:byline.height,contextGap:context.top-byline.bottom,bodyGap:body.top-header.bottom,footerGap:footer.top-body.bottom,actionHeight:action.height}});expect(compactImpression.height).toBeLessThanOrEqual(130);expect(compactImpression.bylineHeight).toBeLessThanOrEqual(18);expect(compactImpression.contextGap).toBeLessThanOrEqual(4);expect(compactImpression.bodyGap).toBeLessThanOrEqual(6);expect(compactImpression.footerGap).toBeLessThanOrEqual(5);expect(compactImpression.actionHeight).toBeLessThanOrEqual(30);await page.setViewportSize({width:1280,height:800});
  const impressionEditor=page.locator('.nx50-composer[data-nx50-composer="impression"] textarea');await impressionEditor.fill('Parte segura e parte secreta');await impressionEditor.evaluate(element=>element.setSelectionRange(15,29));await page.locator('[data-nx50-mark-spoiler]').click();await expect(impressionEditor).toHaveValue('Parte segura e ||parte secreta||');await page.locator('[data-nx50-help]').click();await expect(page.getByRole('heading',{name:'Como funcionam as impressões'})).toBeVisible();await page.getByRole('button',{name:'Fechar ajuda'}).last().click();const actionLabels=await page.locator('.nx50-impression-card .nx50-card-actions button').evaluateAll(buttons=>buttons.map(button=>button.getAttribute('aria-label')));expect(actionLabels).toEqual(['Denunciar publicação','Remover publicação como moderador']);await page.locator('[data-nx50-moderate]').click();await expect(page.locator('.nx50-delete-dialog')).toContainText('todas as respostas ligadas a ela');await page.getByRole('button',{name:'Remover',exact:true}).click();await expect.poll(()=>moderationWrites.at(-1)).toMatchObject({method:'PATCH',body:{hidden:true}});
  await page.getByRole('tab',{name:'Geral',exact:true}).click();const neutralUrl=page.url();await page.evaluate(()=>{window.__nxDetailArticle=document.querySelector('.nx22-detail');window.__nxDetailPanel=document.querySelector('#nx22Panel')});await page.locator('.nx22-synopsis').click({position:{x:8,y:8}});await page.waitForTimeout(350);expect(page.url()).toBe(neutralUrl);expect(await page.evaluate(()=>window.__nxDetailArticle===document.querySelector('.nx22-detail')&&window.__nxDetailPanel===document.querySelector('#nx22Panel'))).toBe(true);
  const overviewCast=page.locator('.nx22-detail-rail-section',{has:page.getByRole('heading',{name:'Personagens principais'})});await expect(overviewCast.getByText('Ver todos',{exact:true})).toHaveCount(0);await expect(overviewCast.locator('.nx44-rail-actions')).toBeVisible();const overviewControls=await overviewCast.evaluate(section=>{const head=section.querySelector('.nx22-section-head').getBoundingClientRect(),actions=section.querySelector('.nx44-rail-actions').getBoundingClientRect(),heart=section.querySelector('.nx22-character-favorite').getBoundingClientRect();return{headTop:head.top,headBottom:head.bottom,actionsTop:actions.top,actionsBottom:actions.bottom,heartWidth:heart.width,heartHeight:heart.height}});expect(overviewControls.actionsTop).toBeGreaterThanOrEqual(overviewControls.headTop-1);expect(overviewControls.actionsBottom).toBeLessThanOrEqual(overviewControls.headBottom+1);expect(overviewControls.heartWidth).toBeLessThanOrEqual(30);expect(overviewControls.heartHeight).toBeLessThanOrEqual(30);
  await page.getByRole('tab',{name:'Personagens & equipe'}).click();await expect(page.locator('#nx22Panel')).toContainText('Personagem Principal');await expect(page.locator('#nx22Panel')).toContainText('Diretora Teste');await expect(page.locator('#nx22Panel')).toContainText('Direção');await expect(page.locator('#nx22Panel')).not.toContainText('Licenciadora indevida');await expect(page.locator('.nx50-social')).toHaveCount(0);await expect(page.locator('.nx22-cast-panel [data-nx22-rail],.nx22-cast-panel [data-nx44-rail-dir]')).toHaveCount(0);await expect(page.locator('.nx22-cast-panel .nx22-people-grid')).toHaveCount(2);const castColumns=await page.locator('.nx22-cast-panel .nx22-people-grid').first().evaluate(grid=>[...grid.children].slice(0,4).map(item=>Math.round(item.getBoundingClientRect().left)));expect(new Set(castColumns.slice(0,3)).size).toBe(3);expect(castColumns[3]).toBe(castColumns[0]);await expect(page.locator('[data-nx22-character-favorite="1"]')).toHaveAttribute('aria-pressed','true');const retryFavorite=page.locator('[data-nx22-character-favorite="10"]');await retryFavorite.click();await expect.poll(()=>characterWrites.at(-1)).toMatchObject({method:'PUT',body:{name:'Personagem 2',work:'Anime Abas 101',mediaId:101,mediaType:'ANIME'}});await expect(retryFavorite).toHaveAttribute('aria-pressed','true');await expect(retryFavorite).toBeEnabled();await retryFavorite.click();await expect.poll(()=>characterWrites.filter(item=>item.method==='DELETE').length).toBe(2);await expect(retryFavorite).toHaveAttribute('aria-pressed','false');await expect(page.locator('#toastRoot')).not.toContainText('Não foi possível atualizar o personagem agora');
  await page.getByRole('tab',{name:'Franquia'}).click();await expect(page.locator('.nx22-related')).toHaveCount(7);await expect(page.locator('.nx22-related').first()).toContainText('Mangá Relacionado');await expect(page.locator('.nx22-related').first()).toHaveAttribute('data-nx22-media-type','MANGA');await expect(page.locator('[data-nx22-search-title="Anime Relacionado por MAL"]')).toBeVisible();await expect(page.locator('.nx50-social')).toHaveCount(0);await expect(page.locator('.nx22-static-section [data-nx22-rail],.nx22-static-section [data-nx44-rail-dir]')).toHaveCount(0);const relationColumns=await page.locator('.nx22-related-grid-full').evaluate(grid=>[...grid.children].slice(0,4).map(item=>Math.round(item.getBoundingClientRect().left)));expect(new Set(relationColumns.slice(0,3)).size).toBe(3);expect(relationColumns[3]).toBe(relationColumns[0]);
  await page.setViewportSize({width:390,height:844});await noOverflow(page,2);const mobileRelationColumns=await page.locator('.nx22-related-grid-full').evaluate(grid=>[...grid.children].slice(0,4).map(item=>Math.round(item.getBoundingClientRect().left)));expect(new Set(mobileRelationColumns.slice(0,3)).size).toBe(3);expect(mobileRelationColumns[3]).toBe(mobileRelationColumns[0]);await page.getByRole('tab',{name:'Personagens & equipe'}).click();await noOverflow(page,2);const mobileCastColumns=await page.locator('.nx22-cast-panel .nx22-people-grid').first().evaluate(grid=>[...grid.children].slice(0,4).map(item=>Math.round(item.getBoundingClientRect().left)));expect(new Set(mobileCastColumns.slice(0,3)).size).toBe(3);expect(mobileCastColumns[3]).toBe(mobileCastColumns[0]);await page.getByRole('tab',{name:'Geral',exact:true}).click();await expect(overviewCast.locator('.nx44-rail-actions')).toBeVisible();const mobileOverviewControls=await overviewCast.evaluate(section=>{const head=section.querySelector('.nx22-section-head').getBoundingClientRect(),actions=section.querySelector('.nx44-rail-actions').getBoundingClientRect(),heart=section.querySelector('.nx22-character-favorite').getBoundingClientRect();return{headTop:head.top,headBottom:head.bottom,actionsTop:actions.top,actionsBottom:actions.bottom,heartWidth:heart.width,heartHeight:heart.height}});expect(mobileOverviewControls.actionsTop).toBeGreaterThanOrEqual(mobileOverviewControls.headTop-1);expect(mobileOverviewControls.actionsBottom).toBeLessThanOrEqual(mobileOverviewControls.headBottom+1);expect(mobileOverviewControls.heartWidth).toBeLessThanOrEqual(29);expect(mobileOverviewControls.heartHeight).toBeLessThanOrEqual(29);
  await page.getByRole('tab',{name:'Recomendações'}).click();await expect(page.locator('.nx22-rec')).toContainText('Anime Recomendado');
  await page.getByRole('tab',{name:'Geral',exact:true}).click();await expect(page.locator('#nx22Activity')).toBeVisible();await expect(page.locator('.nx50-social')).toHaveCount(0);
  expect(await page.evaluate(()=>Boolean(window.__nxTabDocument))).toBe(true);expect(await page.evaluate(()=>performance.getEntriesByType('navigation').length)).toBe(1);await page.getByRole('tab',{name:'Franquia'}).click();await page.locator('[data-nx22-search-title="Anime Relacionado por MAL"]').click();await expect(page.locator('.nx21-catalog-page')).toBeVisible({timeout:30000});await expect.poll(()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('nx:v46:anime-catalog-state')||'{}'))).toMatchObject({mode:'SEARCH',search:'Anime Relacionado por MAL'});await noOverflow(page,2);
});

test('mobile detail navigation opens as an AniQuim-style bottom sheet',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('aninexus:privacy:v1',JSON.stringify({analytics:false,at:Date.now()})));
  await page.setViewportSize({width:390,height:844});await page.goto(firstVisitUrl('/anime/anime-teste-101'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx22-detail:not(.nx22-fail)')).toBeVisible({timeout:30000});const toggle=page.locator('[data-nx22-tabs-toggle]'),row=page.locator('.nx22-tabs-row');await expect(toggle).toBeVisible();await expect(page.getByRole('tab',{name:'Geral',exact:true})).toBeVisible();await expect(row).toHaveAttribute('data-nx22-right','1');await expect(page.locator('.nx22-tabs-share,[data-nx22-share-menu]')).toHaveCount(0);await toggle.click();await expect(toggle).toHaveAttribute('aria-expanded','true');const sheet=page.locator('.nx22-tabs-sheet');await expect(sheet).toBeVisible();await expect(sheet.locator('header strong')).toHaveText('Menu');await page.waitForTimeout(350);const geometry=await sheet.evaluate(element=>{const box=element.getBoundingClientRect();return{left:box.left,right:390-box.right,bottom:844-box.bottom,radius:getComputedStyle(element).borderRadius}});expect(Math.abs(geometry.left)).toBeLessThanOrEqual(1);expect(Math.abs(geometry.right)).toBeLessThanOrEqual(16);expect(Math.abs(geometry.bottom)).toBeLessThanOrEqual(1);expect(geometry.radius).toBe('0px');await sheet.locator('[data-nx22-sheet-tab="franquia"]').click();await expect(page.getByRole('tab',{name:'Franquia'})).toHaveAttribute('aria-selected','true');await expect(toggle).toHaveAttribute('aria-expanded','false');await expect(sheet).toBeHidden();await noOverflow(page,2);
});

for(const item of [{kind:'anime',route:'/anime/anime-teste-101',id:101,catalog:'/animes/catalogo',filterSelector:'[data-nx22-genre]',filterKey:'genre',filterValue:'Action',catalogState:'nx:v46:anime-catalog-state'},{kind:'mangá',route:'/manga/manga-teste-202',id:202,catalog:'/mangas',filterSelector:'[data-nx22-genre]',filterKey:'genre',filterValue:'Action',catalogState:'nx:v46:reading-catalog-state'}]){
  test(`${item.kind} detail uses AniQuim-sized controls, stable clicks and filtered genres`,async({page})=>{
    await page.addInitScript(()=>{const now=Date.now(),state={status:'CURRENT',progress:2,score:null,reaction:'',updatedAt:now};localStorage.setItem('aninexus:mediaState:v2',JSON.stringify({101:state}));localStorage.setItem('aninexus:mangaState:v2',JSON.stringify({202:{...state,volumeProgress:1}}))});
    await page.route('**/api/**/rating',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({score:8.5,votes:24})}));
    await page.setViewportSize({width:390,height:844});
    await page.goto(pageUrl(item.route),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx22-detail:not(.nx22-fail)')).toBeVisible({timeout:30000});await allowAccountActions(page);
    const title=page.locator('.nx22-headcopy h1'),list=page.locator('.nx22-list'),favorite=page.locator('.nx22-fav'),averageStars=page.locator('.nx22-average-star');
    expect(parseFloat(await title.evaluate(element=>getComputedStyle(element).fontSize))).toBeLessThanOrEqual(30);expect(parseFloat(await list.evaluate(element=>getComputedStyle(element).height))).toBeGreaterThanOrEqual(42);expect(parseFloat(await favorite.evaluate(element=>getComputedStyle(element).width))).toBeGreaterThanOrEqual(42);await expect(averageStars).toHaveCount(5);
    await expect(page.locator('[data-nx22-back]')).toBeVisible();await expect(page.locator('[data-nx22-rating],[data-nx22-rating-star]')).toHaveCount(0);await expect(page.getByRole('tab',{name:'Impressões'})).toBeVisible();await expect(page.getByRole('tab',{name:'Comentários'})).toHaveCount(0);
    expect((await page.locator('[data-nx22-back]').boundingBox()).y).toBeGreaterThanOrEqual(54);await expect(favorite).toHaveCSS('background-image','none');await expect(favorite).toHaveAttribute('aria-pressed','false');await expect(list).toHaveCSS('background-image',/linear-gradient/);
    await expect(page.locator('.nx22-stats').first()).toContainText('NOTA MÉDIA');await expect(page.locator('.nx22-stats').first()).toContainText('POPULARIDADE');await expect(page.locator('.nx22-stats').first()).toContainText('MEMBROS');
    await expect(page.locator('.nx22-hero-bg img')).toHaveCSS('object-fit','cover');await expect(page.locator('.nx22-cover')).toHaveCSS('aspect-ratio','2 / 3');
    const aligned=await page.locator('.nx22-stats>div').evaluateAll(cells=>cells.map(cell=>{const strong=cell.querySelector('strong').getBoundingClientRect(),label=cell.querySelector(':scope>span').getBoundingClientRect();return Math.abs((strong.left+strong.width/2)-(label.left+label.width/2))}));expect(aligned.every(delta=>delta<=1)).toBe(true);
    const averageGap=await page.locator('.nx22-average-value').evaluate(element=>{const score=element.querySelector('strong').getBoundingClientRect(),stars=element.querySelector('.nx22-average-stars').getBoundingClientRect();return stars.left-score.right});expect(averageGap).toBeLessThanOrEqual(6);
    await page.evaluate(()=>window.__nxStableDocument={created:Date.now()});await favorite.click();await expect(favorite).toHaveAttribute('aria-pressed','true');await expect(favorite).toHaveCSS('background-image',/linear-gradient/);expect(await page.evaluate(()=>Boolean(window.__nxStableDocument))).toBe(true);
    await page.locator('[data-nx22-tabs-toggle]').click();await expect(page.locator('.nx22-tabs-sheet')).toBeVisible();await page.locator('[data-nx22-sheet-tab="elenco"]').click();expect(await page.evaluate(()=>Boolean(window.__nxStableDocument))).toBe(true);
    await page.locator(`.nx22-chips ${item.filterSelector}`).first().click();
    await expect(page.locator('.nx21-catalog-page')).toBeVisible({timeout:30000});
    await expect.poll(()=>page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)||'{}'),item.catalogState)).toMatchObject({mode:'SEARCH',filters:{[item.filterKey]:item.filterValue}});
    const path=await page.evaluate(()=>{const url=new URL(location.href),restored=url.searchParams.get('p');return(restored||url.pathname).split('?')[0].replace(/^\/AniNexus/,'')});expect(path).toBe(item.catalog);await noOverflow(page,2);
  });
}

test('radio-preserving manga navigation reuses the eager shared detail renderer',async({page})=>{
  const item={...rankedMedia(6201,'MANGA'),mediaType:'MANGA',description:'Uma história de leitura para validar a navegação contínua.',tags:['Adventure'],tagDetails:[{name:'Adventure',rank:90,isMediaSpoiler:false}],characters:[],staff:[],relations:[],recommendations:[]};
  await page.addInitScript(()=>sessionStorage.setItem('aninexus:radio:activated:v44','1'));
  await page.route('**/api/reading?**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:[item],pageInfo:{total:1,currentPage:1,lastPage:1,hasNextPage:false}})}));
  await page.route(`**/api/manga/${item.id}`,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(item)}));
  await page.goto(firstVisitUrl('/mangas'),{waitUntil:'domcontentloaded'});
  const card=page.locator('.nx21-card').first();
  await expect(card).toBeVisible({timeout:30000});
  await expect.poll(()=>page.evaluate(()=>window.AniNexusRadio?.activated)).toBe(true);
  await card.locator('h3').click();
  await expect(page.locator('.nx22-detail:not(.nx22-fail)')).toBeVisible({timeout:15000});
  await expect(page.locator('.detail-hero,.nx-detail,.nx42-manga-page')).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>({owner:window.__NX_ROUTE_OWNER__,ready:window.__NX_V22_DETAIL_READY__,runtime:document.querySelectorAll('script[src*="/preview-v22/detail-v22.js"]').length,dynamicRuntime:document.querySelectorAll('script[data-nx22-detail-runtime]').length,styles:document.querySelectorAll('link[data-nx22-detail-css]').length,path:location.pathname}))).toMatchObject({owner:'detail',ready:true,runtime:1,dynamicRuntime:0,styles:1,path:expect.stringMatching(/^\/manga\//)});
  await page.waitForTimeout(500);
  await expect(page.locator('.nx22-detail')).toHaveCount(1);
  await expect(page.locator('.detail-hero,.nx-detail,.nx42-manga-page')).toHaveCount(0);
  await noOverflow(page,2);
});

test('the latest news destination wins when an older article is still loading',async({page})=>{
  let releaseArticle,markRequested;
  const delayed=new Promise(resolve=>{releaseArticle=resolve}),requested=new Promise(resolve=>{markRequested=resolve});
  const item=slug=>({id:slug,slug,title:slug==='artigo-a'?'Artigo antigo em carregamento':'Artigo mais recente escolhido',summary:'Uma notícia de anime em português para validar a navegação mais recente.',event_type:'ANIME',source_name:'AniNexus Notícias',language:'pt-BR',published_at:new Date().toISOString(),facts:['A publicação foi confirmada.'],body:{sections:[{heading:'Atualização',paragraphs:['Conteúdo completo da notícia escolhida.']}]}});
  await page.route('**/api/news?limit=60',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:[item('artigo-a'),item('artigo-b')]})}));
  await page.route('**/api/news/artigo-a',async route=>{markRequested();await delayed;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(item('artigo-a'))}).catch(()=>{})});
  await page.route('**/api/news/artigo-b',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(item('artigo-b'))}));
  await page.goto(firstVisitUrl('/noticias/artigo-a'),{waitUntil:'domcontentloaded'});
  await requested;
  await page.evaluate(()=>window.NX35NewsData.go('/noticias/artigo-b'));
  await expect.poll(()=>page.evaluate(()=>new URL(location.href).pathname)).toBe('/noticias/artigo-b');
  releaseArticle();
  await expect(page.locator('.nx35-article-head h1')).toHaveText('Artigo mais recente escolhido',{timeout:15000});
  await page.waitForTimeout(250);
  await expect(page.locator('.nx35-article-head h1')).not.toHaveText('Artigo antigo em carregamento');
});

test('news paints the first healthy feed while a fallback source is still pending',async({page})=>{
  const item={id:'news-fast',slug:'noticia-rapida',title:'Notícia rápida do AniNexus',summary:'Uma atualização em português pronta para leitura.',event_type:'ANIME',source_name:'AniNexus Notícias',language:'pt-BR',published_at:new Date().toISOString(),expires_at:new Date(Date.now()+86400000).toISOString(),reading_minutes:1};
  await page.route('**/api/news?limit=60',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:[item]})}));
  await page.route('**/data/news.json*',async route=>{await new Promise(resolve=>setTimeout(resolve,7000));await route.fulfill({status:200,contentType:'application/json',body:'{"items":[]}'}).catch(()=>{})});
  await page.route('**/data/news-v36-seed.json*',async route=>{await new Promise(resolve=>setTimeout(resolve,7000));await route.fulfill({status:200,contentType:'application/json',body:'{"items":[]}'}).catch(()=>{})});
  const started=Date.now();await page.goto(firstVisitUrl('/noticias'),{waitUntil:'domcontentloaded'});await expect.poll(()=>page.evaluate(()=>({feed:window.NX35NewsData?.feed?.map(item=>item.title)||[],route:window.NX35NewsData?.route?.(),shell:Boolean(document.querySelector('#nx35NewsResults'))})),{timeout:2500}).toMatchObject({feed:[item.title],route:'/noticias',shell:true});await expect(page.locator('.nx35-ncard',{hasText:item.title})).toBeVisible({timeout:2500});expect(Date.now()-started).toBeLessThan(2500);
});

test('native news slugs with underscores open the reader',async({page})=>{const slug='life-a-felicidade-depende-de-nos-sera-publicado-pela-newpop-jbox_manga-211a006a',origin=new URL(firstVisitUrl('/')).origin;await page.route(`${origin}/api/news/${slug}`,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:'211a006a',slug,title:'Life, A Felicidade Depende de Nós será publicado pela NewPOP',summary:'A editora confirmou a publicação brasileira do mangá.',event_type:'MANGA',source_name:'AniNexus Notícias',language:'pt-BR',published_at:new Date().toISOString(),facts:['A publicação foi confirmada.'],body:{sections:[{heading:'Publicação no Brasil',paragraphs:['A edição brasileira foi anunciada oficialmente.']}]}})}));await page.goto(firstVisitUrl(`/noticias/${slug}`),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx35-reader')).toBeVisible({timeout:15000});await expect(page.getByRole('heading',{name:/Felicidade Depende de Nós/})).toBeVisible();await expect(page.locator('#app')).not.toContainText('Página não encontrada');await noOverflow(page,2)});

test('a superseded route timeout never overwrites the current page',async({page,browserName})=>{
  test.skip(browserName!=='chromium','The stale timeout clock is exercised once.');
  await page.route('**/preview-v20/catalog-v20.js*',route=>route.abort('failed'));
  await page.goto(pageUrl('/animes/catalogo'),{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>{const url=new URL(location.href);url.searchParams.set('p','/');history.pushState({},'',url);dispatchEvent(new PopStateEvent('popstate'))});
  await expect(page.locator('.nx35-home')).toBeVisible({timeout:15000});
  await page.waitForTimeout(10500);
  await expect(page.locator('.nx35-home')).toBeVisible();
  await expect(page.locator('.nx-route-fail')).toHaveCount(0);
});

test('selected anime library paints before the manga request finishes',async({page})=>{
  let releaseManga;
  const mangaGate=new Promise(resolve=>{releaseManga=resolve});
  await page.addInitScript(()=>{
    const now=Date.now();
    localStorage.setItem('aninexus:mediaState:v2',JSON.stringify({'101':{status:'CURRENT',progress:2,updatedAt:now}}));
    localStorage.setItem('aninexus:mangaState:v2',JSON.stringify({'202':{status:'CURRENT',progress:7,updatedAt:now}}));
  });
  await page.unroute('https://graphql.anilist.co/');
  await page.route('https://graphql.anilist.co/',async route=>{
    const body=route.request().postDataJSON()||{};
    if(body.variables?.type==='MANGA')await mangaGate;
    const media=(body.variables?.ids||[]).map(id=>{const item=anime(Number(id));if(body.variables?.type==='MANGA'){item.format='MANGA';item.chapters=50;item.episodes=null;item.title={...item.title,english:`Mangá Teste ${id}`,userPreferred:`Mangá Teste ${id}`}}return item});
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{Page:{media}}})});
  });
  await page.goto(pageUrl('/meus-animes'),{waitUntil:'domcontentloaded'});
  await expect(page.locator('.nx49-media-card',{hasText:'Anime Teste 101'})).toBeVisible({timeout:10000});
  expect(await page.locator('.nx49-media-card').count()).toBe(1);
  releaseManga();
  await page.getByRole('button',{name:/Meus mangás/}).first().click();
  await expect(page.locator('.nx49-media-card',{hasText:'Mangá Teste 202'})).toBeVisible({timeout:10000});
});

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

test('manga catalog mirrors the complete anime experience with reading-specific sections',async({page})=>{
  const requests=[];
  const readingEndpoint=new URL(ORIGIN).hostname.endsWith('github.io')?'https://graphql.anilist.co/api/reading?**':'**/api/reading?**';
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.route('**/runtime-config.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:`window.__ANINEXUS_CONFIG__=Object.freeze({environment:'test',siteOrigin:'https://qgbaltigo.github.io/AniNexus',apiOrigin:'https://graphql.anilist.co',clerkPublishableKey:'pk_test_manga_catalog',authEnabled:true});`}));
  await page.route(readingEndpoint,route=>{const url=new URL(route.request().url()),params=Object.fromEntries(url.searchParams),current=Number(params.page||1),format=params.format||'MANGA';requests.push(params);const items=Array.from({length:25},(_,index)=>({...rankedMedia(5000+(current-1)*25+index+1,'MANGA'),format}));return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items,pageInfo:{total:1250,currentPage:current,lastPage:50,hasNextPage:current<50}})})});
  await page.route('**/api/me/manga-library',route=>route.fulfill({status:200,contentType:'application/json',body:'{"mangaList":[],"favorites":[]}'}));
  await page.setViewportSize({width:390,height:844});
  await page.goto(pageUrl('/mangas'),{waitUntil:'domcontentloaded'});
  const catalog=page.locator('.nx21-catalog-page.nx21-reading-page');
  await expect(catalog).toBeVisible({timeout:30000});
  await expect(page.getByRole('heading',{name:'Catálogo de Mangás'})).toBeVisible();
  await expect(page.locator('.nx21-card')).toHaveCount(25);
  await expect(page.locator('.nx21-card>p,.nx21-genres,.nx21-rank')).toHaveCount(0);
  await expect(page.locator('.nx21-card').first().locator('[data-manga-list],[data-manga-fav]')).toHaveCount(2);
  await expect.poll(()=>requests.at(-1)?.sort).toBe('DISCOVER');
  expect(requests.at(-1)?.discover).toBe('300');

  await page.evaluate(()=>{
    window.__mangaActionRequests=[];
    window.AniNexusAuth={...window.AniNexusAuth,enabled:true,requireAccount:async()=>({id:'manga-reader'}),api:async(path,options={})=>{
      const method=String(options.method||'GET').toUpperCase();
      window.__mangaActionRequests.push({path,method,body:options.body||null});
      if(path==='/api/me')return{user:{id:'manga-reader'}};
      return method==='GET'?{items:[]}:{ok:true};
    }};
    dispatchEvent(new CustomEvent('aninexus:account-identity-changed',{detail:{user:{id:'manga-reader'}}}));
  });
  await expect.poll(()=>page.evaluate(()=>window.__mangaActionRequests.filter(request=>request.method==='GET').length)).toBeGreaterThanOrEqual(2);
  const favorite=page.locator('.nx21-card').first().locator('[data-manga-fav]');
  const catalogUrl=page.url();
  await expect(favorite).toBeEnabled();
  await favorite.click();
  await expect(favorite).toHaveAttribute('aria-pressed','true');
  expect(page.url()).toBe(catalogUrl);
  await expect.poll(()=>page.evaluate(()=>window.__mangaActionRequests.find(request=>request.method==='PUT'))).toMatchObject({method:'PUT'});
  const favoriteWrite=await page.evaluate(()=>window.__mangaActionRequests.find(request=>request.method==='PUT'));
  expect(favoriteWrite.path).toMatch(/^\/api\/me\/favorites\/\d+$/);
  expect(JSON.parse(favoriteWrite.body)).toEqual({mediaType:'MANGA'});

  const menuTrigger=page.getByRole('button',{name:'Abrir menu do catálogo'});
  await menuTrigger.click();
  const menu=page.getByRole('dialog',{name:'Menu'});
  await expect(menu.locator('.nx21-mobile-option')).toHaveCount(7);
  expect(await menu.locator('.nx21-mobile-option').allTextContents()).toEqual(['Todos','Mangás','One-Shots','Light Novels','Ranking','Mais populares','Busca']);
  await menu.getByRole('button',{name:'One-Shots',exact:true}).click();
  await expect(page.getByRole('heading',{name:'One-Shots'})).toBeVisible();
  await expect.poll(()=>requests.at(-1)?.format).toBe('ONE_SHOT');
  await expect(page.locator('.nx21-rank')).toHaveCount(0);

  await menuTrigger.click();
  await page.getByRole('dialog',{name:'Menu'}).getByRole('button',{name:'Ranking',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Top 100 Mangás'})).toBeVisible();
  await expect(page.locator('.nx21-card')).toHaveCount(100,{timeout:30000});
  await expect(page.locator('.nx21-rank')).toHaveCount(100);
  await expect(page.locator('.nx21-score,.nx21-rank-label')).toHaveCount(0);
  const mangaRanks=await page.locator('.nx21-card').evaluateAll(cards=>[cards[0],cards.at(-1)].map(card=>{const poster=card.querySelector('.nx21-poster').getBoundingClientRect(),rank=card.querySelector('.nx21-rank').getBoundingClientRect(),actions=card.querySelector('.nx21-actions').getBoundingClientRect();return{inside:rank.left>=poster.left&&rank.top>=poster.top&&rank.right<=poster.right&&rank.bottom<=poster.bottom,clearOfActions:rank.right<actions.left}}));
  expect(mangaRanks.every(rank=>rank.inside&&rank.clearOfActions)).toBe(true);
  expect(requests.filter(request=>request.sort==='SCORE').map(request=>request.page).sort()).toEqual(['1','2','3','4']);

  await menuTrigger.click();
  await page.getByRole('dialog',{name:'Menu'}).getByRole('button',{name:'Mais populares',exact:true}).click();
  await expect.poll(()=>requests.at(-1)?.sort).toBe('POPULAR');
  expect(requests.at(-1)?.communityOnly).toBe('1');
  await expect(page.locator('.nx21-rank,.nx21-rank-label')).toHaveCount(0);

  await menuTrigger.click();
  await page.getByRole('dialog',{name:'Menu'}).getByRole('button',{name:'Busca',exact:true}).click();
  await expect(page.locator('#nx21Search')).toBeVisible();
  await expect(page.getByRole('button',{name:'Filtros',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Filtros',exact:true}).click();
  const filters=page.getByRole('dialog',{name:'Filtros'});
  await expect(filters).toBeVisible();
  await expect(filters.getByRole('button',{name:'Mangá',exact:true})).toBeVisible();
  await expect(filters.getByRole('button',{name:'One-shot',exact:true})).toBeVisible();
  await expect(filters.getByRole('button',{name:'Light novel',exact:true})).toBeVisible();
  await expect(filters.getByText('Temporada',{exact:true})).toHaveCount(0);
  await filters.getByRole('button',{name:'Fechar filtros'}).click();
  await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';scrollTo({top:500,behavior:'instant'});dispatchEvent(new Event('scroll'))});
  await expect(page.locator('body')).toHaveClass(/nx21-catalog-scrolled/);
  await expect(page.locator('body')).toHaveClass(/nx21-catalog-scroll-down/);
  await expect(page.locator('#nx21Island')).toHaveClass(/show/);
  await expect(page.locator('#nx21Island')).not.toHaveClass(/expanded/);
  const compactIsland=await page.locator('#nx21Island').evaluate(element=>({top:Math.round(element.getBoundingClientRect().top),head:Math.round(element.querySelector('.nx21-island-head').getBoundingClientRect().height),panelHidden:element.querySelector('.nx21-island-panel').getAttribute('aria-hidden')}));
  expect(compactIsland).toEqual({top:0,head:44,panelHidden:'true'});
  await expect.poll(()=>page.locator('#topbar').evaluate(element=>new DOMMatrixReadOnly(getComputedStyle(element).transform).m42)).toBeLessThan(-40);
  await page.waitForTimeout(420);
  await page.evaluate(()=>{scrollTo({top:Math.max(90,scrollY-120),behavior:'instant'});dispatchEvent(new Event('scroll'))});
  await expect(page.locator('body')).toHaveClass(/nx21-catalog-scroll-up/);
  await expect(page.locator('#nx21Island')).toHaveClass(/expanded/);
  await expect(page.locator('#nx21IslandSearch')).toBeVisible();
  const expandedIsland=await page.locator('#nx21Island').evaluate(element=>({top:Math.round(element.getBoundingClientRect().top),head:Math.round(element.querySelector('.nx21-island-head').getBoundingClientRect().height),panelHidden:element.querySelector('.nx21-island-panel').getAttribute('aria-hidden')}));
  expect(expandedIsland).toEqual({top:58,head:54,panelHidden:'false'});

  await page.evaluate(()=>{history.pushState({},'', '/animes/catalogo');dispatchEvent(new PopStateEvent('popstate'))});
  await expect(page.locator('.nx21-catalog-page[data-nx21-catalog-kind="anime"]')).toBeVisible();
  await page.goBack();
  await expect(catalog).toBeVisible();
  await expect(page.locator('.nx42-manga-page,.catalog-head')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Buscar Mangás'})).toBeVisible();
  const centering=await page.locator('.nx21-title').evaluate(element=>{const box=element.getBoundingClientRect(),chrome=element.closest('.nx21-chrome').getBoundingClientRect();return{titleCenter:box.left+box.width/2,chromeCenter:chrome.left+chrome.width/2}});
  expect(Math.abs(centering.titleCenter-centering.chromeCenter)).toBeLessThan(2);
  await noOverflow(page,2);

  for(const [width,columns] of [[768,3],[1440,5]]){
    await page.evaluate(()=>sessionStorage.removeItem('nx:v46:reading-catalog-state'));
    await page.setViewportSize({width,height:900});
    await page.goto(pageUrl('/mangas'),{waitUntil:'domcontentloaded'});
    await expect(page.locator('.nx21-card')).toHaveCount(25,{timeout:30000});
    const actual=await page.locator('.nx21-card').evaluateAll((cards,count)=>new Set(cards.slice(0,count).map(card=>Math.round(card.getBoundingClientRect().left))).size,columns);
    expect(actual).toBe(columns);
    await noOverflow(page,2);
  }
});

test('administration V55 organizes reports, team roles and atomic moderation decisions',async({page,browserName})=>{
  test.skip(browserName!=='chromium','The administrative interaction contract is covered once in Chromium.');
  await page.setViewportSize({width:1280,height:820});
  await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});
  await page.evaluate(pixel=>{
    const admin={id:'11111111-1111-4111-8111-111111111111',username:'admin',displayName:'Admin AniNexus',role:'admin',status:'active',avatarUrl:pixel};
    const moderator={id:'22222222-2222-4222-8222-222222222222',username:'mod',display_name:'Moderadora',role:'moderator',status:'active',avatar_url:pixel,created_at:new Date().toISOString(),last_seen_at:new Date().toISOString()};
    const member={id:'33333333-3333-4333-8333-333333333333',username:'membro',display_name:'Membro Teste',email:'membro@example.com',role:'user',status:'active',avatar_url:pixel,created_at:new Date().toISOString(),last_seen_at:new Date().toISOString(),list_count:4,impression_count:2};
    const report={id:'44444444-4444-4444-8444-444444444444',reporter_username:'leitor',reporter_display_name:'Leitor',target_type:'IMPRESSION',target_id:'55555555-5555-4555-8555-555555555555',target_username:'autor',target_display_name:'Autor',target_excerpt:'Conteúdo denunciado para análise da equipe.',target_exists:true,target_hidden:false,status:'open',reason:'SPOILER_NAO_MARCADO: revela o final',assigned_to:null,created_at:new Date().toISOString()};
    window.__nxAdminCalls=[];window.__nxAdminReportResolved=false;
    window.AniNexusAuth={enabled:true,ready:async()=>({user:{id:'clerk-admin'}}),api:async(path,options={})=>{
      let body=null;try{body=options.body?JSON.parse(options.body):null}catch{}
      window.__nxAdminCalls.push({path,method:options.method||'GET',body});
      if(path==='/api/me')return{user:admin};
      if(path==='/api/admin/overview')return{users:{total:18,active:16,suspended:1,banned:1,new_week:3,moderators:1,admins:1},reports:{total:4,open:1,reviewing:0,resolved:2,dismissed:1},content:{impressions:12,threads:3,posts:5,comments:8}};
      if(path.startsWith('/api/admin/v2/reports?'))return{items:window.__nxAdminReportResolved?[]:[report]};
      if(path==='/api/admin/v2/reports/'+report.id&&options.method==='PATCH'){Object.assign(report,{status:body.status,assigned_to:body.assignedTo,assignee_display_name:'Admin AniNexus'});return{ok:true,report}};
      if(path==='/api/admin/v2/reports/'+report.id+'/decision'){window.__nxAdminReportResolved=true;return{ok:true,report:{...report,status:'resolved'}}}
      if(path.startsWith('/api/admin/v2/users?role=team'))return{items:[{...admin,display_name:admin.displayName,avatar_url:pixel,created_at:new Date().toISOString()},moderator]};
      if(path.startsWith('/api/admin/v2/users?'))return{items:[member]};
      if(path==='/api/admin/v2/users/'+member.id+'/moderation'){member.role=body.role;return{user:{...member,displayName:member.display_name},notificationSent:true}}
      if(path.startsWith('/api/admin/audit-log'))return{items:[]};
      throw new Error('Unexpected admin API '+path);
    }};
    document.documentElement.dataset.nxAuthState='authenticated';
    window.AniNexusGo('/admin');
  },pixel);
  await expect(page.locator('.nx54-admin-workspace')).toBeVisible({timeout:15000});
  await expect(page.getByRole('heading',{name:'Administração'})).toBeVisible();
  await expect(page.locator('.nx54-admin-nav button')).toHaveText(['Visão geral','Denúncias1','Equipe2','Usuários','Auditoria']);
  await page.getByRole('button',{name:/Denúncias/}).click();
  await expect(page.locator('.nx54-report')).toContainText('Conteúdo denunciado para análise da equipe.');
  await expect(page.locator('.nx54-report')).toContainText('Spoiler não marcado');
  await page.getByRole('button',{name:'Assumir análise'}).click();
  await expect(page.locator('.nx54-report')).toContainText('Responsável: Admin AniNexus');
  await page.getByRole('button',{name:'Ocultar e resolver'}).click();
  const reportDialog=page.locator('.nx54-dialog');
  await reportDialog.locator('textarea[name="reason"]').fill('Confirmação após revisar o contexto completo.');
  await reportDialog.getByRole('button',{name:'Ocultar e resolver'}).click();
  await expect(page.locator('.nx54-empty')).toContainText('Nenhuma denúncia');
  await page.getByRole('button',{name:'Usuários'}).click();
  await expect(page.locator('.nx54-user')).toContainText('Membro Teste');
  await page.getByRole('button',{name:'Alterar função'}).click();
  const roleDialog=page.locator('.nx54-dialog');
  await roleDialog.locator('select[name="role"]').selectOption('moderator');
  await roleDialog.locator('textarea[name="reason"]').fill('Aprovado para colaborar com a moderação.');
  await roleDialog.getByRole('button',{name:'Salvar função'}).click();
  await expect(page.locator('#nx54AdminNotice')).toContainText('recebeu uma notificação');
  const calls=await page.evaluate(()=>window.__nxAdminCalls);
  expect(calls).toContainEqual(expect.objectContaining({path:'/api/admin/v2/reports/44444444-4444-4444-8444-444444444444/decision',method:'PATCH',body:{decision:'hide',reason:'Confirmação após revisar o contexto completo.'}}));
  expect(calls).toContainEqual(expect.objectContaining({path:'/api/admin/v2/users/33333333-3333-4333-8333-333333333333/moderation',method:'PATCH',body:{role:'moderator',reason:'Aprovado para colaborar com a moderação.'}}));
  await noOverflow(page,2);
});

test('moderator administration stays compact on mobile and hides administrator-only controls',async({page,browserName})=>{
  test.skip(browserName!=='chromium','The mobile role boundary is covered once in Chromium.');
  await page.setViewportSize({width:390,height:844});
  await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});
  await page.evaluate(pixel=>{
    const moderator={id:'22222222-2222-4222-8222-222222222222',username:'mod',displayName:'Moderadora',role:'moderator',status:'active',avatarUrl:pixel};
    window.AniNexusAuth={enabled:true,ready:async()=>({user:{id:'clerk-mod'}}),api:async path=>{
      if(path==='/api/me')return{user:moderator};
      if(path==='/api/admin/overview')return{users:{total:12,active:12,new_week:1,moderators:1,admins:1},reports:{open:0,reviewing:0},content:{impressions:8,threads:2,posts:2,comments:3}};
      if(path.startsWith('/api/admin/v2/users?role=team'))return{items:[{...moderator,display_name:moderator.displayName,avatar_url:pixel,created_at:new Date().toISOString()}]};
      if(path.startsWith('/api/admin/v2/users?'))return{items:[]};
      if(path.startsWith('/api/admin/v2/reports?'))return{items:[]};
      throw new Error('Unexpected moderator API '+path);
    }};
    document.documentElement.dataset.nxAuthState='authenticated';
    window.AniNexusGo('/admin');
  },pixel);
  await expect(page.getByRole('heading',{name:'Moderação'})).toBeVisible({timeout:15000});
  await expect(page.getByRole('button',{name:'Auditoria'})).toHaveCount(0);
  await page.locator('.nx54-admin-nav').getByRole('button',{name:/Equipe/}).click();
  await expect(page.locator('.nx54-permissions')).toContainText('Não altera cargos');
  await expect(page.getByRole('button',{name:'Alterar função'})).toHaveCount(0);
  const mobileGeometry=await page.evaluate(()=>{const shell=document.querySelector('.nx54-admin-shell').getBoundingClientRect(),workspace=document.querySelector('.nx54-admin-workspace').getBoundingClientRect(),aside=document.querySelector('.nx54-admin-layout>aside').getBoundingClientRect();return{shellRight:shell.right,workspaceRight:workspace.right,asideRight:aside.right}});
  expect(mobileGeometry.workspaceRight).toBeLessThanOrEqual(mobileGeometry.shellRight+1);
  expect(mobileGeometry.asideRight).toBeLessThanOrEqual(mobileGeometry.shellRight+1);
  await noOverflow(page,2);
});

test('Home reading cards share anime actions and trailers play inside AniNexus',async({page})=>{
  const publishedAt=new Date().toISOString(),trailers={generatedAt:publishedAt,freshnessWindowDays:21,total:3,items:[
    {videoId:'abc123XYZ01',title:'Anime Teste: trailer final',kind:'TRAILER',publishedAt,source:'Fonte Teste',thumbnail:portrait},
    {videoId:'abc123XYZ02',title:'Segunda Temporada: novo teaser',kind:'TEASER',publishedAt,source:'Fonte Teste',thumbnail:portrait},
    {videoId:'abc123XYZ03',title:'Filme Teste: vídeo promocional',kind:'PV',publishedAt,source:'Fonte Teste',thumbnail:portrait},
  ]};
  await mockInternalRankings(page);
  await page.route('**/data/trailers.json*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(trailers)}));
  await page.route('**/api/trailers?**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(trailers)}));
  await page.route('https://www.youtube-nocookie.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Player de teste</title>'}));
  await page.setViewportSize({width:1440,height:900});
  await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});
  const reading=page.locator('#nx35Reading .nx35-reading').first();
  await expect(reading).toBeVisible({timeout:30000});
  await expect(reading.locator('.nx35-format')).toHaveCount(0);
  await expect(reading.locator('[data-manga-list],[data-manga-fav]')).toHaveCount(2);
  await expect(reading.locator('.nx35-score')).toBeVisible();
  const readingLayout=await reading.locator('.nx35-book').evaluate(element=>{const score=element.querySelector('.nx35-score').getBoundingClientRect(),actions=element.querySelector('aside').getBoundingClientRect();return{scoreLeft:score.left,scoreRight:score.right,actionsLeft:actions.left}});
  expect(readingLayout.scoreLeft).toBeLessThan(readingLayout.actionsLeft);expect(readingLayout.scoreRight).toBeLessThan(readingLayout.actionsLeft);
  await expect(reading.locator('[data-manga-list]')).toHaveCSS('width','34px');
  await expect(reading.locator('[data-manga-fav]')).toHaveCSS('height','34px');
  await page.evaluate(()=>{window.__mangaWrites=[];window.AniNexusAuth={...window.AniNexusAuth,enabled:true,requireAccount:async()=>({id:'manga-test'}),api:async(path,options={})=>{window.__mangaWrites.push({path,method:options.method||'GET',body:options.body||null});if(path==='/api/me')return{user:{id:'manga-test'}};if((options.method||'GET')==='GET')return{items:[]};return{ok:true}}};dispatchEvent(new CustomEvent('aninexus:account-identity-changed',{detail:{user:{id:'manga-test'}}}))});
  const heart=reading.locator('[data-manga-fav]');
  await expect(heart).toBeEnabled();
  await heart.click();
  await expect(heart).toHaveAttribute('aria-pressed','true');
  await expect(heart).toHaveClass(/active/);
  await expect.poll(()=>page.evaluate(()=>window.__mangaWrites.some(write=>write.method==='PUT'&&write.body?.includes('MANGA')))).toBe(true);
  const favoriteVisual=await heart.evaluate(button=>({background:getComputedStyle(button).backgroundColor,fill:getComputedStyle(button.querySelector('svg')).fill}));
  expect(favoriteVisual.background).not.toBe('rgba(0, 0, 0, 0)');
  expect(favoriteVisual.fill).not.toBe('none');
  await reading.locator('[data-manga-list]').click();
  await expect(page.locator('.nx20-media-layer[data-media-type="MANGA"]')).toBeVisible();
  await page.locator('[data-nx20-status="COMPLETED"]').click();
  await page.locator('[data-nx20-save]').click();
  await expect(page.locator('.nx20-media-layer')).toHaveCount(0);
  const listAction=reading.locator('[data-manga-list]');
  await expect(listAction).toHaveAttribute('aria-pressed','true');
  await expect(listAction).toHaveClass(/active/);
  await expect(listAction.locator('path')).toHaveAttribute('d','m5 12.5 4.2 4.2L19 7');
  await expect.poll(()=>page.evaluate(()=>window.__mangaWrites.some(write=>write.method==='PUT'&&write.path.includes('/api/me/manga-list/')))).toBe(true);

  const trailerSection=page.locator('.nx42-trailers-section'),cards=trailerSection.locator('.nx42-trailer');
  await expect(trailerSection).toBeVisible({timeout:30000});
  await expect(cards).toHaveCount(3);
  await expect(trailerSection).not.toContainText('Fonte Teste');
  const ratio=await cards.first().locator('.nx42-trailer-media').evaluate(element=>{const box=element.getBoundingClientRect();return box.width/box.height});
  expect(ratio).toBeGreaterThan(1.74);expect(ratio).toBeLessThan(1.82);
  const before=page.url();
  await cards.first().click();
  const modal=page.locator('.nx42-trailer-modal');
  await expect(modal).toBeVisible();
  await expect(modal.locator('[role="dialog"]')).toHaveAttribute('aria-modal','true');
  await expect(modal.locator('iframe')).toHaveAttribute('src',/youtube-nocookie\.com\/embed\/abc123XYZ01\?.*autoplay=1/);
  expect(page.url()).toBe(before);
  await page.setViewportSize({width:390,height:844});
  const closeGeometry=await modal.getByRole('button',{name:'Fechar trailer'}).last().evaluate(button=>{const box=button.getBoundingClientRect();return{width:box.width,height:box.height,borderRadius:getComputedStyle(button).borderRadius}});
  expect(Math.min(closeGeometry.width,closeGeometry.height)).toBeGreaterThanOrEqual(39);expect(Math.max(closeGeometry.width,closeGeometry.height)).toBeLessThanOrEqual(41);expect(Math.abs(closeGeometry.width-closeGeometry.height)).toBeLessThan(1);expect(parseFloat(closeGeometry.borderRadius)).toBeGreaterThanOrEqual(19);
  await modal.getByRole('button',{name:'Fechar trailer'}).last().click();
  await expect(modal).toHaveCount(0);
  const mobile=await cards.first().evaluate(element=>({width:element.getBoundingClientRect().width,rail:element.parentElement.clientWidth}));
  expect(mobile.width/mobile.rail).toBeGreaterThan(.8);expect(mobile.width/mobile.rail).toBeLessThan(.9);
  await noOverflow(page,3);
});

test('single Home impression is complete and does not look like a broken rail',async({page})=>{
  const impression={id:'10000000-0000-4000-8000-000000000001',mediaId:101,mediaType:'ANIME',body:'Uma estreia excelente, mas ||uma revelação|| muda tudo.',segments:[{type:'text',content:'Uma estreia excelente, mas '},{type:'spoiler',content:'uma revelação'},{type:'text',content:' muda tudo.'}],hasSpoilers:true,hideSpoilers:true,createdAt:new Date().toISOString(),user:{username:'kayky',displayName:'Kayky Sousa',avatarUrl:pixel},statusSnapshot:'CURRENT',progressSnapshot:5,scoreSnapshot:9,impressionStage:'PRELIMINARY',likesCount:7,repliesCount:2,media:{id:101,title:'Anime Teste 101',cover:pixel,banner:pixel,format:'TV',episodes:12,seasonYear:2026}};
  await page.addInitScript(impression=>localStorage.setItem('aninexus:impressions:v1',JSON.stringify([impression])),impression);
  await page.route('**/api/feed/impressions**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:[impression],hasMore:false,filter:'all',sort:'recent',hideSpoilers:true})}));
  await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});
  const card=page.locator('.nx38-impression-home-card').first();
  await expect(card).toBeVisible({timeout:30000});
  await expect(card).toContainText('Uma estreia excelente');await expect(page.locator('[data-home-imp-filter],[data-home-imp-sort],[data-home-imp-hide],.nx38-impressions-feed-filters')).toHaveCount(0);const partialSpoiler=card.locator('[data-home-imp-spoiler]');await expect(partialSpoiler).toHaveAttribute('aria-label','Revelar trecho com spoiler');expect(await partialSpoiler.evaluate(element=>element.tagName)).toBe('SPAN');await partialSpoiler.focus();await page.keyboard.press('Enter');await expect(partialSpoiler).toHaveClass(/revealed/);
  await expect(card.locator('.nx38-impression-identity')).toContainText('Kayky Sousa');
  await expect(card.locator('.nx38-impression-identity')).toContainText('@kayky');
  await expect(card.locator('.nx38-impression-meta-row')).toContainText('Assistindo');
  await expect(card.locator('.nx38-impression-meta-row')).toContainText('episódio 5 de 12');
  await expect(card.locator('.nx38-impression-metric')).toHaveCount(2);
  await expect(card.locator('.nx38-impression-metric svg')).toHaveCount(2);
  await expect(card.locator('.nx38-impression-metric').first()).toContainText('7');
  await expect(card.locator('.nx38-impression-metric').last()).toContainText('2');
  await expect(card.locator('.nx38-impression-meta-row')).not.toContainText(/♡|↩/);
  await expect(card.locator('.nx38-impression-meta-row')).not.toContainText('sem spoilers');
  await expect(card.locator('.nx38-impression-media-copy')).toContainText('Série · 2026 · 12 ep.');
  await expect(page.locator('.nx38-impressions-rail')).toHaveAttribute('data-count','1');
  expect(await card.locator('.nx38-impression-author').evaluate(link=>{const url=new URL(link.href);return url.searchParams.get('p')||url.pathname})).toBe('/u/kayky');
  expect(await card.locator('.nx38-impression-context').evaluate(link=>{const url=new URL(link.href);return url.searchParams.get('p')||url.pathname})).toBe('/anime/anime-teste-101');
  const layout=await page.locator('.nx38-impressions-rail').evaluate(rail=>{const card=rail.firstElementChild?.getBoundingClientRect(),box=rail.getBoundingClientRect();return{cardWidth:card?.width||0,cardHeight:card?.height||0,railWidth:box.width}});
  expect(layout.cardWidth).toBeGreaterThanOrEqual(340);
  expect(layout.cardWidth).toBeLessThanOrEqual(392);
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

test('dedicated pages have one renderer and never flash a legacy layout',async({page,browserName})=>{test.skip(browserName!=='chromium','A troca temporal de layout é auditada uma vez no Chromium.');await page.addInitScript(()=>{window.__nxLayouts=[];const record=()=>{const el=document.querySelector('#app')?.firstElementChild;if(!el)return;const value=`${el.tagName}.${String(el.className||'').trim()}`;if(window.__nxLayouts.at(-1)!==value)window.__nxLayouts.push(value)};new MutationObserver(record).observe(document,{childList:true,subtree:true});addEventListener('DOMContentLoaded',record,{once:true})});const cases=[['/','nx35-home'],['/animes/catalogo','nx21-catalog-page'],['/mangas','nx21-catalog-page'],['/animes/programacao','nx18-schedule'],['/animes/temporadas','nx-season'],['/anime/anime-teste-101','nx22-detail'],['/noticias','nx35-news-page'],['/comunidade','nx40-community'],['/conquistas','nx48-achievements-page'],['/login','nx38-auth-page'],['/admin','nx38-admin-page'],['/meus-animes','nx38-library'],['/termos-de-uso','nx-legal'],['/quem-somos','nx-inst']];for(const[route,prefix]of cases){if(route==='/conquistas'){await page.route('**/api/achievements/catalog',request=>request.fulfill({status:200,contentType:'application/json',body:JSON.stringify({total:achievementDefinitions.length,items:achievementDefinitions})}),{times:1})}await page.goto(pageUrl(route),{waitUntil:'domcontentloaded'});await expect(page.locator(`.${prefix}`).first()).toBeVisible({timeout:30000});await page.waitForTimeout(300);const history=await page.evaluate(()=>window.__nxLayouts||[]);expect(history,`${route}: ${history.join(' -> ')}`).not.toContain(expect.stringMatching(/detail-hero|nx-detail(?:-loading)?|catalog-hero|community-page|news-hero|prose|nx42-manga-page/));expect(history.every(value=>value.includes(prefix)),`${route}: ${history.join(' -> ')}`).toBe(true)}});

test('Home Catalog Programação Temporadas and Meus Animes share compact circular actions',async({page})=>{
  test.setTimeout(90000);
  const targets=[['/','button[data-fav]'],['/animes/catalogo','.nx21-actions button[data-fav]'],['/animes/programacao','.nx18-cover-actions button[data-nx18-fav]'],['/animes/temporadas','button[data-nx-fav]']];
  for(const [route,selector] of targets){await page.goto(pageUrl(route),{waitUntil:'domcontentloaded'});const b=page.locator(selector).first();await expect(b).toBeVisible({timeout:30000});await expect(b).toHaveCSS('width','34px');await expect(b).toHaveCSS('height','34px');await expect(b).toHaveCSS('border-radius',/50%|1[67]px/);await expect(b).toHaveCSS('display','grid')}
  await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});await expect(page.locator('button[data-fav]').first()).toBeVisible({timeout:30000});const ids=await page.evaluate(()=>[...document.querySelectorAll('button[data-fav]')].map(x=>Number(x.dataset.fav)).filter(Boolean).slice(0,1));await page.evaluate(ids=>{const id=ids[0],now=Date.now();localStorage.setItem('aninexus:favorites',JSON.stringify([id]));localStorage.setItem('aninexus:mediaState:v2',JSON.stringify({[id]:{status:'CURRENT',progress:1,score:null,reaction:'',updatedAt:now}}));localStorage.setItem('aninexus:mediaState:v1',localStorage.getItem('aninexus:mediaState:v2'))},ids);const id=ids[0];await page.route('**/api/me/library',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({user:{username:'teste'},list:[{media_id:id,status:'CURRENT',progress:1,media:anime(id)}],favorites:[{media_id:id,media:anime(id)}],impressions:[],impressionCount:0})}));await page.goto(pageUrl('/meus-animes'),{waitUntil:'domcontentloaded'});const lb=page.locator('.nx38-library-card-actions button[data-fav]').first();await expect(lb).toBeVisible({timeout:30000});await expect(lb).toHaveCSS('width','34px');await expect(lb).toHaveCSS('height','34px');await expect(lb).toHaveCSS('border-radius',/50%|1[67]px/)
});

test('favorite double click and burst represent one intention',async({page})=>{await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});await expect(page.locator('[data-nx35-home].data-ready')).toBeVisible({timeout:30000});await expect.poll(()=>page.evaluate(()=>Boolean(window.AniNexusMediaActions&&window.AniNexusMediaState))).toBe(true);await allowAccountActions(page);await clear(page);const b=page.locator('button[data-fav]').first();await expect(b).toBeVisible({timeout:30000});await b.dblclick({delay:40});await expect(b).toHaveClass(/active/);await page.waitForTimeout(380);await b.click();await expect(b).not.toHaveClass(/active/);await page.waitForTimeout(380);await b.evaluate(el=>{for(let i=0;i<7;i++)el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}))});await expect(b).toHaveClass(/active/)});

test('visitors reach login before favorite list or character state can change',async({page})=>{
  await mockInternalRankings(page);
  const privateWrites=[];
  page.on('request',request=>{if(request.method()!=='GET'&&/\/api\/me\//.test(new URL(request.url()).pathname))privateWrites.push(request.url())});

  await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});await expect(page.locator('button[data-fav]').first()).toBeVisible({timeout:30000});await clear(page);const favoritesBefore=await page.evaluate(()=>localStorage.getItem('aninexus:favorites'));
  await page.locator('button[data-fav]').first().click();await waitForLogin(page);
  expect(await page.evaluate(()=>localStorage.getItem('aninexus:favorites'))).toBe(favoritesBefore);expect(privateWrites).toHaveLength(0);

  await page.goto(pageUrl('/animes/programacao'),{waitUntil:'domcontentloaded'});await expect(page.locator('[data-nx18-status]').first()).toBeVisible({timeout:30000});await clear(page);
  await page.locator('[data-nx18-status]').first().click();await waitForLogin(page);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('aninexus:mediaState:v2')||'{}'))).toEqual({});expect(privateWrites).toHaveLength(0);

  await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});const character=page.locator('[data-character-favorite]').first();await expect(character).toBeVisible({timeout:30000});
  await character.click();await waitForLogin(page);expect(privateWrites).toHaveLength(0);
});

test('visitors reach login before publishing impressions or news comments',async({page},testInfo)=>{
  const writes=[];page.on('request',request=>{if(request.method()==='POST'&&/\/(?:impressions|comments)(?:\/|$)/.test(new URL(request.url()).pathname))writes.push(request.url())});
  await page.setViewportSize({width:390,height:844});await page.route(/\/api\/anime\/101\/impressions(?:\?.*)?$/,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:[]})}));await page.goto(pageUrl('/anime/anime-teste-101'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx22-detail')).toBeVisible({timeout:30000});await page.getByRole('tab',{name:'Impressões'}).click();const impressionPrompt=page.locator('.nx50-login-prompt');await expect(impressionPrompt).toBeVisible();await expect(page.locator('.nx50-composer')).toHaveCount(0);const impressionPromptGeometry=await impressionPrompt.evaluate(prompt=>{const box=prompt.getBoundingClientRect(),button=prompt.querySelector('button').getBoundingClientRect();return{promptWidth:box.width,buttonWidth:button.width,radius:getComputedStyle(prompt).borderRadius}});expect(impressionPromptGeometry.buttonWidth).toBeLessThan(impressionPromptGeometry.promptWidth*.6);expect(parseFloat(impressionPromptGeometry.radius)).toBeGreaterThanOrEqual(10);await impressionPrompt.screenshot({path:testInfo.outputPath('impression-login-prompt-mobile.png')});await page.getByRole('button',{name:'Entre na sua conta para publicar uma impressão'}).click();await waitForLogin(page);expect(writes).toHaveLength(0);

  const slug='comentario-de-visitante-teste';await page.route(`**/api/news/${slug}`,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:'visitor-news',slug,title:'Notícia de teste',summary:'Resumo de teste.',event_type:'ANIME',source_name:'AniNexus Notícias',language:'pt-BR',published_at:new Date().toISOString(),facts:[],body:{sections:[{heading:'Atualização',paragraphs:['Conteúdo de teste para comentários.']}]}})}));await page.route(new RegExp(`/api/news/${slug}/comments(?:\\?.*)?$`),route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:[],sort:'popular',hideSpoilers:true})}));await page.goto(firstVisitUrl(`/noticias/${slug}`),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx50-news-comments .nx50-login-prompt')).toBeVisible({timeout:30000});await expect(page.locator('.nx42-news-comment-form')).toHaveCount(0);await page.getByRole('button',{name:'Entre na sua conta para publicar um comentário'}).click();await page.waitForURL(url=>{const current=new URL(url);return current.searchParams.get('p')==='/login'||current.pathname.replace(/\/+$/,'').endsWith('/login')},{timeout:15000});expect(writes).toHaveLength(0);
});

test('institutional actions and search dismissal remain aligned at every viewport',async({page},testInfo)=>{
  test.setTimeout(120000);
  for(const width of [360,390,768,1440]){
    await page.setViewportSize({width,height:900});
    for(const path of ['/colabore','/contato','/quem-somos','/dmca']){
      await page.goto(pageUrl(path),{waitUntil:'domcontentloaded'});
      await expect(page.locator('.nx-inst,.nx-legal').first()).toBeVisible({timeout:20000});
      const icons=await page.locator('.nx-inst-btn svg').evaluateAll(items=>items.map(icon=>{const i=icon.getBoundingClientRect(),b=icon.parentElement.getBoundingClientRect();return{size:i.width,dy:Math.abs((b.top+b.bottom-i.top-i.bottom)/2),inside:i.left>=b.left&&i.right<=b.right,fill:getComputedStyle(icon).fill}}));
      for(const icon of icons){expect(icon.size).toBeLessThanOrEqual(20);expect(icon.dy).toBeLessThanOrEqual(1);expect(icon.inside).toBe(true);expect(icon.fill).toBe('none')}
      await noOverflow(page,2);
      if(path==='/contato'){
        const before=page.url();
        await page.locator('.nx-inst-hero-actions [data-nx-inst]').click();
        await expect.poll(()=>page.locator('#formulario').evaluate(element=>Math.abs(element.getBoundingClientRect().top))).toBeLessThan(120);
        expect(page.url()).toBe(before);
        await expect(page.locator('#nxContactForm')).toBeVisible();
      }
    }
    if(await page.getByRole('button',{name:'Abrir menu',exact:true}).isVisible()){
      await page.evaluate(()=>window.AniNexusAuthV38.syncDrawerIdentity({id:'alignment-member',username:'member',firstName:'Member'}));
      await page.getByRole('button',{name:'Abrir menu',exact:true}).click();
      await page.locator('[data-nx-drawer-search]').click();
    }else{
      await page.locator('#topbar [data-action="search"]').click();
    }
    const close=page.locator('.search-close');await expect(close).toBeVisible();
    const closeBox=await close.boundingBox();expect(Math.abs(closeBox.width-closeBox.height)).toBeLessThanOrEqual(1);
    await close.click();await expect(close).toBeHidden();
  }
});

test('impression replies keep compact aligned text including nested spoilers',async({page},testInfo)=>{
  const now=new Date().toISOString(),rootId='51000000-0000-4000-8000-000000000001';
  const root={id:rootId,body:'Estou curioso sobre a obra.',username:'diego',created_at:new Date(Date.now()-86_400_000).toISOString(),status_snapshot:'PLANNING',replies_count:2};
  const replies=[{id:'51000000-0000-4000-8000-000000000002',body:'Teste',username:'diego',created_at:now,depth:0},{id:'51000000-0000-4000-8000-000000000003',body:'Resposta com ||um segredo|| e texto depois.',username:'reader',created_at:now,depth:2}];
  await page.route(/\/api\/anime\/101\/impressions(?:\?.*)?$/,route=>route.fulfill({json:{items:[root]}}));
  await page.route(`**/api/impressions/${rootId}/replies?**`,route=>route.fulfill({json:{items:replies}}));
  await page.route('**/api/me/likes?**',route=>route.fulfill({json:{items:[]}}));
  await page.goto(pageUrl('/anime/anime-teste-101'),{waitUntil:'domcontentloaded'});
  await page.getByRole('tab',{name:'Impressões'}).click();await page.getByRole('button',{name:'Abrir respostas'}).click();
  await expect(page.locator('.nx50-reply')).toHaveCount(2);
  await expect(page.locator('.nx50-card > header time')).toHaveText('há 1 dia');
  await expect(page.locator('.nx50-reply').first().getByRole('button',{name:'Responder a @diego',exact:true})).toBeVisible();
  for(const width of [360,390,768,1440]){
    await page.setViewportSize({width,height:900});
    const layouts=await page.locator('.nx50-reply').evaluateAll(items=>items.map(item=>{const byline=item.querySelector('.nx50-author').getBoundingClientRect(),body=item.querySelector('.nx50-body').getBoundingClientRect(),footer=item.querySelector('footer').getBoundingClientRect();return{bodyGap:body.top-byline.bottom,footerGap:footer.top-body.bottom,alignment:Math.abs(body.left-byline.left)}}));
    for(const layout of layouts){expect(layout.bodyGap).toBeLessThanOrEqual(6);expect(layout.footerGap).toBeLessThanOrEqual(5);expect(layout.alignment).toBeLessThanOrEqual(1)}
    await noOverflow(page,2);
    if(width===390)await page.locator('.nx50-list').screenshot({path:testInfo.outputPath('compact-replies-mobile.png')});
  }
});

test('news community comments reuse the complete social system on mobile',async({page},testInfo)=>{
  const slug='comentarios-sociais-teste',rootId='41000000-0000-4000-8000-000000000001',replyId='41000000-0000-4000-8000-000000000002',otherId='41000000-0000-4000-8000-000000000003',now=new Date().toISOString();
  const items=[
    {id:rootId,parent_id:null,root_id:rootId,depth:0,body:'Começo seguro e ||revelação da notícia||.',has_spoilers:true,hideSpoilers:true,created_at:now,likes_count:2,replies_count:1,username:'news-owner',display_name:'News Owner',avatar_url:pixel,user:{username:'news-owner',displayName:'News Owner',avatarUrl:pixel}},
    {id:replyId,parent_id:rootId,root_id:rootId,depth:1,body:'Resposta respeitosa.',has_spoilers:false,hideSpoilers:true,created_at:now,likes_count:1,replies_count:0,username:'reader',display_name:'Reader',avatar_url:pixel,user:{username:'reader',displayName:'Reader',avatarUrl:pixel}},
    {id:otherId,parent_id:null,root_id:otherId,depth:0,body:'Outro ponto de vista.',has_spoilers:false,hideSpoilers:true,created_at:now,likes_count:0,replies_count:0,username:'other-member',display_name:'Other Member',avatar_url:pixel,user:{username:'other-member',displayName:'Other Member',avatarUrl:pixel}},
  ],writes=[];
  await page.setViewportSize({width:390,height:844});
  await page.route(`**/api/news/${slug}`,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:'news-social',slug,title:'Notícia com conversa',summary:'Resumo da notícia para teste.',event_type:'ANIME',source_name:'AniNexus Notícias',language:'pt-BR',published_at:now,facts:[],body:{sections:[{heading:'Atualização',paragraphs:['Conteúdo da notícia para validar a conversa.']}]}})}));
  await page.route(new RegExp(`/api/news/${slug}/comments(?:/[^/?]+)?(?:\\?.*)?$`),route=>{const request=route.request(),url=new URL(request.url()),method=request.method(),commentId=url.pathname.split('/').at(-1)==='comments'?null:url.pathname.split('/').at(-1);if(method==='GET')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items,sort:url.searchParams.get('sort')||'popular',hideSpoilers:url.searchParams.get('hideSpoilers')!=='false'})});writes.push({kind:'comment',method,commentId,body:request.postDataJSON()});return route.fulfill({status:method==='POST'?201:200,contentType:'application/json',body:JSON.stringify({ok:true,id:commentId||'41000000-0000-4000-8000-000000000004'})})});
  await page.route('**/api/me/likes?**',route=>route.fulfill({status:200,contentType:'application/json',body:'{"items":[]}'}));
  await page.route('**/api/likes',route=>{writes.push({kind:'like',method:route.request().method(),body:route.request().postDataJSON()});return route.fulfill({status:200,contentType:'application/json',body:'{"liked":true,"likesCount":3}'})});
  await page.route('**/api/admin/content/NEWS_COMMENT/*',route=>{writes.push({kind:'moderation',method:route.request().method(),body:route.request().postDataJSON()});return route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'})});
  await page.goto(firstVisitUrl(`/noticias/${slug}`),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx50-news-comments')).toBeVisible({timeout:30000});
  const moderator={id:'news-owner-id',username:'news-owner',role:'moderator'};await allowAccountActions(page,moderator);await page.evaluate(user=>dispatchEvent(new CustomEvent('aninexus:account-identity-changed',{detail:{user}})),moderator);
  const section=page.locator('.nx50-news-comments');await expect(section.locator('.nx50-composer[data-nx50-composer="news"]')).toBeVisible();await expect(section.locator('.nx42-news-comment-form')).toHaveCount(0);await expect(section.locator('.nx50-news-card')).toHaveCount(2);await expect(section.locator('[data-nx50-mark-spoiler] svg,[data-nx50-help] svg')).toHaveCount(2);await expect(section.locator('.nx50-like svg,.nx50-reply-action svg')).toHaveCount(4);await expect(section).not.toContainText('↩');
  const spoiler=section.locator('[data-nx50-spoiler]');await expect(spoiler).toHaveCount(1);await spoiler.click();await expect(spoiler).toHaveClass(/revealed/);
  const owner=section.locator(`[data-nx50-news-comment="${rootId}"]`),other=section.locator(`[data-nx50-news-comment="${otherId}"]`);await expect(owner.getByRole('button',{name:'Editar publicação'})).toBeVisible();await expect(owner.getByRole('button',{name:'Excluir publicação'})).toBeVisible();await expect(other.getByRole('button',{name:'Denunciar publicação'})).toBeVisible();await expect(other.getByRole('button',{name:'Remover publicação como moderador'})).toBeVisible();
  await owner.getByRole('button',{name:'Abrir respostas'}).click();await expect(owner.locator('.nx50-reply')).toHaveCount(1);await expect(owner.locator('.nx50-reply')).toContainText('Resposta respeitosa.');await expect(owner.locator('.nx50-reply .nx50-like svg')).toHaveCount(1);
  const composer=section.locator('.nx50-composer[data-nx50-composer="news"]'),editor=composer.locator('textarea');await editor.fill('Texto público e segredo final');await editor.evaluate(element=>element.setSelectionRange(16,29));await composer.locator('[data-nx50-mark-spoiler]').click();await expect(editor).toHaveValue('Texto público e ||segredo final||');await composer.getByRole('button',{name:'Publicar',exact:true}).click();await expect.poll(()=>writes.find(entry=>entry.kind==='comment'&&entry.method==='POST')?.body).toEqual({text:'Texto público e ||segredo final||'});
  await owner.getByRole('button',{name:'Curtir comentário'}).click();await expect.poll(()=>writes.some(entry=>entry.kind==='like'&&entry.body?.likeableType==='NEWS_COMMENT')).toBe(true);
  await other.getByRole('button',{name:'Remover publicação como moderador'}).click();await expect(page.locator('.nx50-delete-dialog')).toContainText('todas as respostas ligadas a ele');await page.getByRole('button',{name:'Remover',exact:true}).click();await expect.poll(()=>writes.find(entry=>entry.kind==='moderation')).toMatchObject({method:'PATCH',body:{hidden:true}});
  await owner.getByRole('button',{name:'Excluir publicação'}).click();await expect(page.getByRole('heading',{name:'Excluir comentário?'})).toBeVisible();await expect(page.locator('.nx50-delete-dialog')).toContainText('todas as respostas ligadas a ele');await page.getByRole('button',{name:'Excluir',exact:true}).click();await expect.poll(()=>writes.some(entry=>entry.kind==='comment'&&entry.method==='DELETE'&&entry.commentId===rootId)).toBe(true);
  const repliesBox=owner.locator('.nx50-replies');if(await repliesBox.isVisible())await owner.getByRole('button',{name:'Abrir respostas'}).click();const geometry=await section.locator('.nx50-news-card').first().evaluate(card=>{const box=card.getBoundingClientRect(),header=card.querySelector(':scope>header').getBoundingClientRect(),byline=card.querySelector('.nx50-byline').getBoundingClientRect(),body=card.querySelector(':scope>.nx50-body').getBoundingClientRect(),footer=card.querySelector(':scope>footer').getBoundingClientRect();return{height:box.height,bylineHeight:byline.height,bodyGap:body.top-header.bottom,footerGap:footer.top-body.bottom}});expect(geometry.height).toBeLessThanOrEqual(130);expect(geometry.bylineHeight).toBeLessThanOrEqual(18);expect(geometry.bodyGap).toBeLessThanOrEqual(6);expect(geometry.footerGap).toBeLessThanOrEqual(5);await page.screenshot({path:testInfo.outputPath('news-comments-mobile.png'),fullPage:true});await noOverflow(page,2);
});

test('Programação opens one modal and saved status reaches Home and Community',async({page})=>{
  await page.goto(pageUrl('/animes/programacao'),{waitUntil:'domcontentloaded'});await allowAccountActions(page);await clear(page);const card=page.locator('.nx18-card').first();await expect(card).toBeVisible({timeout:30000});const list=card.locator('button[data-nx18-status]').first();await expect(list).toBeVisible();const id=Number(await list.getAttribute('data-nx18-status'));const animeTitle=(await card.locator('h3').first().textContent())?.trim()||'';expect(id).toBeGreaterThan(0);
  await list.click();await expect(page.locator('.nx20-media-layer')).toHaveCount(1,{timeout:20000});await expect(page.locator('.nx20-modal')).toHaveCount(1);await page.locator('[data-nx20-status="CURRENT"]').click();const progress=page.locator('[data-nx20-progress]');if(await progress.count())await progress.fill('1');await page.locator('[data-nx20-save]').click();const savedStatus=await page.evaluate(id=>JSON.parse(localStorage.getItem('aninexus:mediaState:v2')||'{}')[id]?.status,id);expect(savedStatus).toBe('CURRENT');
  const activity=await page.evaluate(id=>(JSON.parse(localStorage.getItem('aninexus:community:activity:v40')||'[]')).find(x=>Number(x.media_id)===id&&x.status==='CURRENT'),id);expect(activity).toBeTruthy();
  await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx35-home')).toBeVisible({timeout:30000});await expect(page.locator('#nx35CommunityHero')).toContainText('está assistindo',{timeout:15000});if(animeTitle)await expect(page.locator('#nx35CommunityHero')).toContainText(animeTitle,{timeout:15000});
  const malformed=`${ORIGIN}?build=38.0.0&p=${encodeURIComponent('/comunidade?build=35.0.0')}`;await page.goto(malformed,{waitUntil:'domcontentloaded'});await expect(page.locator('.nx40-community')).toBeVisible({timeout:30000});await expect(page.locator('.nx40-community')).not.toContainText('O que você está assistindo hoje?');await expect(page.locator('.nx40-feed')).toContainText('está assistindo');if(animeTitle)await expect(page.locator('.nx40-feed')).toContainText(animeTitle);await noOverflow(page)
});

test('Programação shares the catalog chrome and reveals a compact guide on scroll',async({page})=>{
  test.setTimeout(90000);
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const viewport of [{width:390,height:844,titleSize:26,headerHeight:58},{width:1440,height:900,titleSize:31,headerHeight:66}]){
    await page.setViewportSize({width:viewport.width,height:viewport.height});
    await page.goto(pageUrl('/animes/programacao'),{waitUntil:'domcontentloaded'});
    await expect(page.locator('.nx18-card').first()).toBeVisible({timeout:30000});
    const top=await page.evaluate(()=>{const hero=document.querySelector('#nx18Hero'),title=document.querySelector('.nx18-title'),heading=title.querySelector('h1'),heroStyle=getComputedStyle(hero),titleBox=title.getBoundingClientRect(),heroBox=hero.getBoundingClientRect();return{background:heroStyle.backgroundImage,line:parseFloat(heroStyle.borderBottomWidth),heroTop:Math.round(heroBox.top),titleSize:parseFloat(getComputedStyle(heading).fontSize),titleCenter:titleBox.left+titleBox.width/2,heroCenter:heroBox.left+heroBox.width/2,target:Math.ceil(hero.offsetHeight+220)}});
    expect(top.background).toContain('linear-gradient');
    expect(top.line).toBe(1);
    expect(top.heroTop).toBe(0);
    expect(top.titleSize).toBe(viewport.titleSize);
    expect(Math.abs(top.titleCenter-top.heroCenter)).toBeLessThan(2);
    await expect(page.locator('#topbar')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');

    await page.evaluate(target=>{document.documentElement.style.scrollBehavior='auto';scrollTo({top:target,behavior:'instant'});dispatchEvent(new Event('scroll'))},top.target);
    await expect(page.locator('body')).toHaveClass(/nx18-island-visible/);
    await expect(page.locator('body')).toHaveClass(/nx18-header-hidden/);
    await expect(page.locator('#nx18Island')).toHaveClass(/show/);
    await expect.poll(()=>page.locator('#topbar').evaluate(element=>new DOMMatrixReadOnly(getComputedStyle(element).transform).m42)).toBeLessThan(-40);
    const compact=await page.locator('#nx18Island').evaluate(element=>{const island=element.getBoundingClientRect(),head=element.querySelector('.nx18-island-head').getBoundingClientRect();return{top:Math.round(island.top),headHeight:Math.round(head.height)}});
    expect(compact.top).toBe(0);
    expect(compact.headHeight).toBe(44);

    await page.evaluate(()=>{scrollTo({top:Math.max(90,scrollY-120),behavior:'instant'});dispatchEvent(new Event('scroll'))});
    await expect(page.locator('body')).not.toHaveClass(/nx18-header-hidden/);
    await expect(page.locator('#nx18Island')).toHaveClass(/expanded/);
    await expect(page.locator('#topbar')).toHaveClass(/is-scrolled/);
    await expect(page.locator('#topbar')).not.toHaveCSS('background-color','rgba(0, 0, 0, 0)');
    await expect.poll(()=>page.locator('#topbar').evaluate(element=>new DOMMatrixReadOnly(getComputedStyle(element).transform).m42)).toBeGreaterThan(-1);
    const expanded=await page.locator('#nx18Island').evaluate(element=>{const island=element.getBoundingClientRect(),head=element.querySelector('.nx18-island-head').getBoundingClientRect(),days=element.querySelector('.nx18-days').getBoundingClientRect();return{top:Math.round(island.top),headHeight:Math.round(head.height),daysVisible:days.height>30,right:island.right}});
    expect(expanded.top).toBe(viewport.headerHeight);
    expect(expanded.headHeight).toBe(54);
    expect(expanded.daysVisible).toBe(true);
    expect(expanded.right).toBeLessThanOrEqual(viewport.width);
    await noOverflow(page,2);
  }
});

test('season pagination keeps loaded titles after failure and continues beyond five pages',async({page})=>{
  test.setTimeout(60000);
  if(!new URL(ORIGIN).hostname.endsWith('github.io')){
    await page.route('**/animes/temporadas/**',async route=>{
      if(route.request().resourceType()!=='document')return route.continue();
      return route.fulfill({response:await route.fetch({url:ORIGIN})});
    });
  }
  let failSecond=true;
  const pages=[];
  const respond=async(route,variables,normalized=false)=>{
    const current=Number(variables.page||1);
    pages.push(current);
    if(current===2&&failSecond)return route.fulfill({status:503,body:'Unavailable'});
    const items=Array.from({length:30},(_,i)=>normalized?rankedMedia(current*1000+i):anime(current*1000+i));
    const pageInfo={currentPage:current,total:180,lastPage:6,hasNextPage:current<6};
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(normalized?{items,pageInfo}:{data:{Page:{media:items,pageInfo}}})});
  };
  await page.route('https://graphql.anilist.co/',route=>respond(route,route.request().postDataJSON().variables||{}));
  await page.route('**/api/catalog?**',route=>respond(route,Object.fromEntries(new URL(route.request().url()).searchParams),true));
  await page.goto(pageUrl('/animes/temporadas/2025/inverno'),{waitUntil:'domcontentloaded'});
  await expect(page.locator('.nx-season-card')).toHaveCount(30,{timeout:20000});
  await expect(page.locator('[data-nx-retry]')).toBeVisible({timeout:20000});
  await expect(page.locator('.nx-season-card')).toHaveCount(30);
  failSecond=false;
  await page.locator('[data-nx-retry]').click();
  await expect(page.locator('.nx-season-card')).toHaveCount(180,{timeout:20000});
  await expect(page.locator('.nx-season-load-status')).toHaveCount(0);
  expect(pages).toContain(6);
  for(const [width,columns] of [[1440,5],[900,4],[620,3],[390,2],[320,2]]){
    await page.setViewportSize({width,height:900});
    const layout=await page.locator('.nx-season-grid').evaluate(element=>({columns:getComputedStyle(element).gridTemplateColumns.split(' ').length,width:element.firstElementChild.getBoundingClientRect().width}));
    expect(layout.columns).toBe(columns);
    expect(layout.width).toBeLessThan(260);
    const controls=await page.evaluate(()=>{
      const shell=document.querySelector('.nx-season-hero .nx-season-shell').getBoundingClientRect();
      return [...document.querySelectorAll('.nx-season-control-line button')].every(button=>{const box=button.getBoundingClientRect();return box.left>=shell.left-1&&box.right<=shell.right+1});
    });
    expect(controls).toBe(true);
    await noOverflow(page,2);
  }
  await page.locator('.nx-season-tabs [data-nx-season="SPRING"]').click();
  await expect(page.locator('.nx-season')).toHaveAttribute('data-season','SPRING');
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.locator('.nx-season')).toHaveAttribute('data-season','SPRING');
  await expect(page.locator('.main-nav [data-nav="season"]')).toHaveAttribute('aria-current','page');
});

test('season stops repeated pages and cannot restore itself after leaving the route',async({page})=>{
  let requests=0,release;
  const pending=new Promise(resolve=>{release=resolve});
  const respond=async(route,normalized=false)=>{
    requests++;
    if(requests>2)await pending;
    const items=Array.from({length:4},(_,i)=>normalized?rankedMedia(100+i):anime(100+i));
    const pageInfo={hasNextPage:true,total:60};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(normalized?{items,pageInfo}:{data:{Page:{media:items,pageInfo}}})}).catch(()=>{});
  };
  await page.route('**/api/catalog?**',route=>respond(route,true));
  await page.route('https://graphql.anilist.co/',route=>respond(route));
  await page.goto(pageUrl('/animes/temporadas/2025/inverno'),{waitUntil:'domcontentloaded'});
  await expect(page.locator('[data-nx-retry]')).toBeVisible({timeout:15000});
  await expect(page.locator('.nx-season-card')).toHaveCount(4);
  expect(requests).toBe(2);
  await page.locator('[data-nx-retry]').click();
  await expect.poll(()=>requests).toBe(3);
  await page.evaluate(()=>{
    const url=new URL(location.href);
    url.searchParams.set('p','/noticias');
    history.pushState({},'',url);
    dispatchEvent(new PopStateEvent('popstate'));
  });
  release();
  await expect(page.locator('.nx35-news-page')).toBeVisible({timeout:15000});
  await expect(page.locator('.nx-season')).toHaveCount(0);
});

test('production season bridge preserves discovery, sequels and ongoing filters',async({page})=>{
  await bridgeProductionAssets(page);
  const requests=[];
  await page.route('**/api/catalog?**',route=>{
    const params=Object.fromEntries(new URL(route.request().url()).searchParams);
    requests.push(params);
    const ongoing=params.status==='RELEASING';
    const items=Array.from({length:4},(_,i)=>({...rankedMedia((ongoing?500:100)+i),status:ongoing?'RELEASING':'FINISHED',startDate:{year:2000,month:1,day:1},relationTypes:i%2?['PREQUEL']:[]}));
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items,pageInfo:{total:4,currentPage:1,hasNextPage:false}})});
  });
  await page.goto(firstVisitUrl('/animes/temporadas'),{waitUntil:'domcontentloaded'});
  await expect(page.locator('.nx-season-card')).toHaveCount(4,{timeout:20000});
  await expect(page.locator('.nx-season-stats strong').nth(2)).toHaveText('2');
  await expect(page.locator('[data-nx-still]')).toHaveCount(4,{timeout:20000});
  expect(requests.every(request=>request.sort==='DISCOVER')).toBe(true);
  expect(requests.some(request=>request.status==='RELEASING')).toBe(true);
  await page.locator('.nx-season [data-nx-menu="type"]').click();
  await page.locator('.nx-popover [data-nx-type="SERIES"]').click();
  await expect(page.locator('[data-nx-still]')).toHaveCount(4);
});

test('Temporadas and Notícias share the same five-hub chrome and scroll guide',async({page})=>{
  test.setTimeout(120000);
  await page.emulateMedia({reducedMotion:'reduce'});
  const routes=[
    {route:'/animes/temporadas',root:'.nx-season',ready:'.nx-season-card',hero:'.nx-season-hero',title:'.nx-season-title h1',titleGroup:'.nx-season-title',guide:'.nx-v10-seasonbar',head:'.nx-v10-seasonbar__head',panel:'.nx-v10-seasonbar__controls',down:'nx-scroll-down',up:'nx-scroll-up'},
    {route:'/noticias',root:'.nx35-news-page',ready:'.nx35-ncard',hero:'#nx35NewsHero',title:'.nx35-news-heading h1',titleGroup:'.nx35-news-heading',guide:'#nx35NewsIsland',head:'.nx35-news-island-head',panel:'.nx35-news-island-panel',down:'nx35-news-scroll-down',up:'nx35-news-scroll-up'},
  ];
  for(const viewport of [{width:390,height:844,titleSize:26,headerHeight:58},{width:1440,height:900,titleSize:31,headerHeight:66}]){
    await page.setViewportSize({width:viewport.width,height:viewport.height});
    for(const item of routes){
      await page.goto(pageUrl(item.route),{waitUntil:'domcontentloaded'});
      await expect(page.locator(item.root)).toBeVisible({timeout:30000});
      await expect(page.locator(item.ready).first()).toBeVisible({timeout:30000});
      if(item.route==='/noticias'){
        await expect(page.locator('[data-nx35-cats],[data-cat]')).toHaveCount(0);
        await expect(page.locator('.main-nav [data-nav="news"]')).toHaveAttribute('aria-current','page');
        const search=page.locator('#nx35NewsHero [data-nx35-news-search]');
        await expect(search).toBeVisible();
        await search.fill('zzzz-no-news-match');
        await expect(page.locator('.nx35-news-empty')).toContainText('Nenhuma notícia encontrada');
        await search.fill('');
        await expect(page.locator(item.ready).first()).toBeVisible();
      }
      await expect(page.locator(item.guide)).toHaveAttribute('aria-hidden','true');
      const top=await page.evaluate(({hero,title,titleGroup})=>{const heroNode=document.querySelector(hero),titleNode=document.querySelector(title),titleBox=document.querySelector(titleGroup).getBoundingClientRect(),heroBox=heroNode.getBoundingClientRect(),style=getComputedStyle(heroNode);return{background:style.backgroundImage,line:parseFloat(style.borderBottomWidth),heroTop:Math.round(heroBox.top),titleSize:parseFloat(getComputedStyle(titleNode).fontSize),titleCenter:titleBox.left+titleBox.width/2,heroCenter:heroBox.left+heroBox.width/2,target:Math.ceil(heroNode.offsetHeight+240)}},{hero:item.hero,title:item.title,titleGroup:item.titleGroup});
      expect(top.background).toContain('linear-gradient');
      expect(top.line).toBe(1);
      expect(top.heroTop).toBe(0);
      expect(top.titleSize).toBe(viewport.titleSize);
      expect(Math.abs(top.titleCenter-top.heroCenter)).toBeLessThan(2);
      await expect(page.locator('#topbar')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
      if(item.route==='/animes/temporadas'){
        const stats=page.locator('.nx-season-stats');
        await expect(stats).toBeVisible();
        for(const label of ['ANIMES','ESTREIAS','SEQUÊNCIAS'])await expect(stats).toContainText(label);
        const counts=await stats.locator('strong').allTextContents();
        expect(Number(counts[0])).toBeGreaterThan(0);
        expect(Number(counts[1])+Number(counts[2])).toBe(Number(counts[0]));
        const controls=await page.evaluate(()=>{const box=element=>{const rect=element.getBoundingClientRect();return{top:rect.top,bottom:rect.bottom,height:rect.height}};const rail=document.querySelector('.nx-season-tabs');return{rail:box(rail),year:box(document.querySelector('.nx-year-pill')),buttons:[...rail.querySelectorAll('button')].map(box)}});
        expect(Math.abs(controls.year.top-controls.rail.top)).toBeLessThan(.6);
        expect(Math.abs(controls.year.bottom-controls.rail.bottom)).toBeLessThan(.6);
        for(const button of controls.buttons){expect(button.top).toBeGreaterThanOrEqual(controls.rail.top);expect(button.bottom).toBeLessThanOrEqual(controls.rail.bottom)}
      }

      await page.evaluate(target=>{document.documentElement.style.scrollBehavior='auto';scrollTo({top:target,behavior:'instant'});dispatchEvent(new Event('scroll'))},top.target);
      await expect(page.locator('body')).toHaveClass(new RegExp(item.down));
      await expect(page.locator(item.guide)).toHaveClass(/show/);
      await expect(page.locator(item.guide)).not.toHaveClass(/expanded/);
      await expect(page.locator(item.guide)).toHaveAttribute('aria-hidden','false');
      await expect(page.locator(item.panel)).toHaveAttribute('aria-hidden','true');
      await expect.poll(()=>page.locator('#topbar').evaluate(element=>new DOMMatrixReadOnly(getComputedStyle(element).transform).m42)).toBeLessThan(-40);
      const compact=await page.locator(item.guide).evaluate((element,head)=>({top:Math.round(element.getBoundingClientRect().top),head:Math.round(element.querySelector(head).getBoundingClientRect().height)}),item.head);
      expect(compact).toEqual({top:0,head:44});

      await page.evaluate(()=>{scrollTo({top:Math.max(90,scrollY-140),behavior:'instant'});dispatchEvent(new Event('scroll'))});
      await expect(page.locator('body')).toHaveClass(new RegExp(item.up));
      await expect(page.locator(item.guide)).toHaveClass(/expanded/);
      await expect(page.locator(item.panel)).toHaveAttribute('aria-hidden','false');
      await expect.poll(()=>page.locator('#topbar').evaluate(element=>new DOMMatrixReadOnly(getComputedStyle(element).transform).m42)).toBeGreaterThan(-1);
      const expanded=await page.locator(item.guide).evaluate((element,args)=>({top:Math.round(element.getBoundingClientRect().top),head:Math.round(element.querySelector(args.head).getBoundingClientRect().height),panel:Math.round(element.querySelector(args.panel).getBoundingClientRect().height)}),{head:item.head,panel:item.panel});
      expect(expanded.top).toBe(viewport.headerHeight);
      expect(expanded.head).toBe(54);
      expect(expanded.panel).toBeGreaterThan(30);
      if(item.route==='/animes/temporadas'){
        const controls=await page.evaluate(()=>{const box=element=>{const rect=element.getBoundingClientRect();return{top:rect.top,bottom:rect.bottom,height:rect.height}};const rail=document.querySelector('.nx-v10-seasonbar__seasons');return{rail:box(rail),year:box(document.querySelector('.nx-v10-seasonbar__row>.nx-v10-seasonbar__btn')),buttons:[...rail.querySelectorAll('button')].map(box)}});
        expect(Math.abs(controls.year.top-controls.rail.top)).toBeLessThan(.6);
        expect(Math.abs(controls.year.bottom-controls.rail.bottom)).toBeLessThan(.6);
        for(const button of controls.buttons){expect(button.top).toBeGreaterThanOrEqual(controls.rail.top);expect(button.bottom).toBeLessThanOrEqual(controls.rail.bottom)}
      }
      await page.locator(item.head).click();
      await expect(page.locator(item.guide)).not.toHaveClass(/expanded/);
      await page.locator(item.head).click();
      await expect(page.locator(item.guide)).toHaveClass(/expanded/);
      await noOverflow(page,2);
    }
  }
});

test('Community V40 exposes public activity without a discussion composer',async({page})=>{
  let threadRequests=0;await page.route('**/api/community/threads**',route=>{threadRequests++;return route.fulfill({json:{items:[]}})});
  await page.goto(pageUrl('/comunidade'),{waitUntil:'domcontentloaded'});
  await expect(page.locator('.nx40-community')).toBeVisible({timeout:30000});
  await expect(page.locator('#nx40Stats')).toBeVisible();await expect(page.locator('#nx40Feed')).toBeVisible();
  await expect(page.locator('#nx40Trending')).toBeVisible();
  await expect(page.locator('#nx40ThreadModal,[data-nx40-new],.nx40-tabs')).toHaveCount(0);
  expect(threadRequests).toBe(0);await noOverflow(page);
});

test('Catalog exposes all pages, keeps its chrome together and darkens the header only after scroll',async({page})=>{
  const requested=[];
  await page.unroute('https://graphql.anilist.co/');
  await page.route('https://graphql.anilist.co/',async route=>{const body=route.request().postDataJSON(),current=Number(body.variables?.page||1);requested.push(body);await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{Page:{pageInfo:{total:5000,currentPage:current,lastPage:200,hasNextPage:current<200},media:catalogPage(current)}}})})});
  await page.setViewportSize({width:1440,height:900});
  await page.goto(pageUrl('/animes/catalogo'),{waitUntil:'domcontentloaded'});
  await expect(page.locator('.nx21-card')).toHaveCount(25,{timeout:30000});
  await expect(page.locator('#nx21Count')).toHaveText('5.000+ títulos');
  await expect(page.locator('.nx21-pages').getByRole('button',{name:'1',exact:true})).toBeVisible();
  await expect(page.locator('.nx21-pages').getByRole('button',{name:'2',exact:true})).toBeVisible();
  await expect(page.locator('.nx21-pages').getByRole('button',{name:'200',exact:true})).toBeVisible();
  const columns=await page.locator('.nx21-card').evaluateAll(cards=>new Set(cards.slice(0,5).map(card=>Math.round(card.getBoundingClientRect().left))).size);
  expect(columns).toBe(5);
  const topGeometry=await page.evaluate(()=>{const chrome=document.querySelector('.nx21-chrome').getBoundingClientRect(),heading=document.querySelector('.nx21-intro h1').getBoundingClientRect(),title=document.querySelector('.nx21-title').getBoundingClientRect(),tabs=document.querySelector('#nx21Hero .nx21-tabbar').getBoundingClientRect();return{chromeTop:Math.round(chrome.top),titleTop:Math.round(heading.top),tabsTop:Math.round(tabs.top),titleCenter:title.left+title.width/2,chromeCenter:chrome.left+chrome.width/2}});
  expect(topGeometry.chromeTop).toBe(0);
  expect(topGeometry.titleTop).toBeGreaterThanOrEqual(90);
  expect(topGeometry.titleTop).toBeLessThanOrEqual(125);
  expect(topGeometry.tabsTop).toBeLessThanOrEqual(205);
  expect(Math.abs(topGeometry.titleCenter-topGeometry.chromeCenter)).toBeLessThan(2);
  await expect(page.locator('#topbar')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';scrollTo({top:500,behavior:'instant'});dispatchEvent(new Event('scroll'))});
  await expect(page.locator('body')).toHaveClass(/nx21-catalog-scrolled/);
  await expect(page.locator('body')).toHaveClass(/nx21-catalog-scroll-down/);
  await expect(page.locator('#topbar')).toHaveClass(/is-scrolled/);
  await expect(page.locator('#topbar')).not.toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  await expect(page.locator('#nx21Island')).toHaveClass(/show/);
  await expect(page.locator('#nx21Island')).not.toHaveClass(/expanded/);
  await expect.poll(()=>page.locator('#nx21Island').evaluate(element=>Math.round(element.getBoundingClientRect().top))).toBe(0);
  const compact=await page.locator('#nx21Island').evaluate(element=>{const box=element.getBoundingClientRect(),head=element.querySelector('.nx21-island-head').getBoundingClientRect(),roundedTop=Math.round(box.top);return{top:Object.is(roundedTop,-0)?0:roundedTop,head:Math.round(head.height),hidden:element.querySelector('.nx21-island-panel').getAttribute('aria-hidden')}});
  expect(compact).toEqual({top:0,head:44,hidden:'true'});
  await expect.poll(()=>page.locator('#topbar').evaluate(element=>new DOMMatrixReadOnly(getComputedStyle(element).transform).m42)).toBeLessThan(-40);
  await page.waitForTimeout(420);
  await page.evaluate(()=>{scrollTo({top:Math.max(90,scrollY-140),behavior:'instant'});dispatchEvent(new Event('scroll'))});
  await expect(page.locator('body')).toHaveClass(/nx21-catalog-scroll-up/);
  await expect(page.locator('#nx21Island')).toHaveClass(/expanded/);
  await expect.poll(()=>page.locator('#topbar').evaluate(element=>new DOMMatrixReadOnly(getComputedStyle(element).transform).m42)).toBeGreaterThan(-1);
  const scrolledGeometry=await page.evaluate(()=>{const header=document.querySelector('#topbar').getBoundingClientRect(),island=document.querySelector('#nx21Island').getBoundingClientRect(),head=document.querySelector('.nx21-island-head').getBoundingClientRect(),tabs=document.querySelector('#nx21Island .nx21-tabbar').getBoundingClientRect();return{headerBottom:Math.round(header.bottom),islandTop:Math.round(island.top),headHeight:Math.round(head.height),tabsHeight:Math.round(tabs.height),panelHidden:document.querySelector('#nx21Island .nx21-island-panel').getAttribute('aria-hidden')}});
  expect(scrolledGeometry.islandTop).toBe(scrolledGeometry.headerBottom);
  expect(scrolledGeometry.headHeight).toBe(54);
  expect(scrolledGeometry.tabsHeight).toBe(42);
  expect(scrolledGeometry.panelHidden).toBe('false');
  await page.locator('[data-nx21-island-toggle]').click();
  await expect(page.locator('#nx21Island')).not.toHaveClass(/expanded/);
  await page.locator('[data-nx21-island-toggle]').click();
  await expect(page.locator('#nx21Island')).toHaveClass(/expanded/);
  await page.locator('.nx21-pages').getByRole('button',{name:'2',exact:true}).click();
  await expect(page.locator('.nx21-card').first().locator('h3')).toHaveText('Anime Teste 2001',{timeout:10000});
  expect(requested.some(body=>Number(body.variables?.page)===2)).toBe(true);
  await noOverflow(page,2);
});

test('Catalog search and filters work together in a complete modal',async({page})=>{
  const requested=[];
  await page.unroute('https://graphql.anilist.co/');
  await page.route('https://graphql.anilist.co/',async route=>{const body=route.request().postDataJSON(),current=Number(body.variables?.page||1);requested.push(body);await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{Page:{pageInfo:{total:75,currentPage:current,lastPage:3,hasNextPage:current<3},media:catalogPage(current)}}})})});
  await page.setViewportSize({width:1280,height:900});
  await page.goto(pageUrl('/animes/catalogo'),{waitUntil:'domcontentloaded'});
  await expect(page.locator('.nx21-card')).toHaveCount(25,{timeout:30000});
  await page.getByRole('button',{name:'Busca',exact:true}).click();
  await expect(page.locator('#nx21Search')).toBeVisible();
  await page.getByRole('button',{name:'Filtros',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Filtros'});await expect(dialog).toBeVisible();
  const closeSize=await dialog.getByRole('button',{name:'Fechar filtros'}).evaluate(button=>{const box=button.getBoundingClientRect();return{width:box.width,height:box.height}});
  expect(Math.abs(closeSize.width-closeSize.height)).toBeLessThanOrEqual(1);
  await dialog.getByRole('button',{name:'Filme',exact:true}).click();
  await dialog.getByRole('button',{name:'Finalizado',exact:true}).click();
  await dialog.locator('#nx21Year').selectOption('2026');
  await dialog.locator('#nx21Genre').selectOption('Action');
  await dialog.getByRole('button',{name:/Aplicar/}).click();
  await expect(dialog).toBeHidden();
  await expect.poll(()=>requested.at(-1)?.variables?.format).toBe('MOVIE');
  expect(requested.at(-1)?.variables).toMatchObject({status:'FINISHED',year:2026,genre:'Action'});
  await page.locator('#nx21Search').fill('Naruto');
  await expect.poll(()=>requested.at(-1)?.variables?.search,{timeout:3000}).toBe('Naruto');
  await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';scrollTo({top:420,behavior:'instant'});dispatchEvent(new Event('scroll'))});
  await expect(page.locator('body')).toHaveClass(/nx21-catalog-scroll-down/);
  await expect(page.locator('#nx21Island')).toHaveClass(/show/);
  await expect(page.locator('#nx21Island')).not.toHaveClass(/expanded/);
  await expect.poll(()=>page.locator('#topbar').evaluate(element=>new DOMMatrixReadOnly(getComputedStyle(element).transform).m42)).toBeLessThan(-40);
  await page.waitForTimeout(420);
  await page.evaluate(()=>{scrollTo({top:Math.max(90,scrollY-120),behavior:'instant'});dispatchEvent(new Event('scroll'))});
  await expect(page.locator('body')).toHaveClass(/nx21-catalog-scroll-up/);
  await expect(page.locator('#nx21Island')).toHaveClass(/expanded/);
  await expect(page.locator('#nx21IslandSearch')).toBeVisible();
  await expect(page.locator('#nx21IslandSearch')).toHaveValue('Naruto');
  await noOverflow(page,2);
});

test('Catalog mobile menu exposes a complete Top 100 and a full search bar',async({page})=>{
  const requests=[];
  const catalogEndpoint=new URL(ORIGIN).hostname.endsWith('github.io')?'https://graphql.anilist.co/api/catalog?**':'**/api/catalog?**';
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.route('**/runtime-config.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:`window.__ANINEXUS_CONFIG__=Object.freeze({environment:'test',siteOrigin:'https://qgbaltigo.github.io/AniNexus',apiOrigin:'https://graphql.anilist.co',clerkPublishableKey:'pk_test_catalog',authEnabled:true});`}));
  await page.route(catalogEndpoint,route=>{const url=new URL(route.request().url()),current=Number(url.searchParams.get('page')||1);requests.push(Object.fromEntries(url.searchParams));const items=Array.from({length:25},(_,index)=>rankedMedia(300+(current-1)*25+index+1));return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items,pageInfo:{total:804,currentPage:current,lastPage:33,hasNextPage:true}})})});
  await page.setViewportSize({width:390,height:844});
  await page.goto(pageUrl('/animes/catalogo'),{waitUntil:'domcontentloaded'});
  await expect(page.locator('.nx21-card')).toHaveCount(25,{timeout:30000});
  await expect(page.locator('.nx21-results-head')).toHaveCount(0);
  await expect(page.locator('.nx21-card>p,.nx21-genres,.nx21-rank')).toHaveCount(0);
  await expect.poll(()=>requests.at(-1)?.sort).toBe('DISCOVER');
  expect(requests.at(-1)?.discover).toBe('500');
  const gradient=await page.locator('.nx21-chrome').evaluate(element=>getComputedStyle(element).backgroundImage);
  expect(gradient).toContain('linear-gradient');
  const menuTrigger=page.getByRole('button',{name:'Abrir menu do catálogo'});
  await menuTrigger.press('Enter');
  const menu=page.getByRole('dialog',{name:'Menu'});await expect(menu).toBeVisible();
  await expect(menu.locator('.nx21-mobile-option')).toHaveCount(7);
  await menu.getByRole('button',{name:'Ranking',exact:true}).click();
  await expect(menu).toBeHidden();
  await expect(page.locator('.nx21-card')).toHaveCount(100,{timeout:30000});
  const scoreRequests=requests.filter(request=>request.sort==='SCORE');
  expect(scoreRequests.map(request=>request.page).sort()).toEqual(['1','2','3','4']);
  expect(scoreRequests.every(request=>!('communityOnly' in request))).toBe(true);
  await expect(page.locator('.nx21-rank')).toHaveCount(100);
  await expect.poll(()=>page.locator('.nx21-rank').last().evaluate(element=>element.textContent)).toBe('100');
  await expect(page.locator('.nx21-score,.nx21-rank-label')).toHaveCount(0);
  const animeRanks=await page.locator('.nx21-card').evaluateAll(cards=>[cards[0],cards.at(-1)].map(card=>{const poster=card.querySelector('.nx21-poster').getBoundingClientRect(),rank=card.querySelector('.nx21-rank').getBoundingClientRect(),actions=card.querySelector('.nx21-actions').getBoundingClientRect();return{inside:rank.left>=poster.left&&rank.top>=poster.top&&rank.right<=poster.right&&rank.bottom<=poster.bottom,clearOfActions:rank.right<actions.left}}));
  expect(animeRanks.every(rank=>rank.inside&&rank.clearOfActions)).toBe(true);
  await menuTrigger.press('Enter');
  await page.getByRole('dialog',{name:'Menu'}).getByRole('button',{name:'Mais membros',exact:true}).click();
  await expect.poll(()=>requests.at(-1)?.sort).toBe('MEMBERS');
  expect(requests.at(-1)?.communityOnly).toBe('1');
  await expect(page.locator('.nx21-rank,.nx21-rank-label')).toHaveCount(0);
  await expect(page.locator('.nx21-card').first()).toBeVisible();
  await menuTrigger.press('Enter');
  await page.getByRole('dialog',{name:'Menu'}).getByRole('button',{name:'Mais populares',exact:true}).click();
  await expect.poll(()=>requests.at(-1)?.sort).toBe('POPULAR');
  expect(requests.at(-1)?.communityOnly).toBe('1');
  await expect(page.locator('.nx21-rank,.nx21-rank-label')).toHaveCount(0);
  await expect(page.locator('.nx21-card').first()).toBeVisible();
  await menuTrigger.press('Enter');
  const requestsBeforeSearch=requests.length;
  await page.getByRole('dialog',{name:'Menu'}).getByRole('button',{name:'Busca',exact:true}).click();
  await expect(page.locator('#nx21Search')).toBeVisible();
  await expect.poll(()=>requests.length).toBeGreaterThan(requestsBeforeSearch);
  await expect.poll(()=>requests.at(-1)?.sort).toBe('DISCOVER');
  await expect(page.locator('.nx21-card')).toHaveCount(25,{timeout:30000});
  await page.locator('#nx21Search').focus();
  await expect(page.locator('#nx21Search')).toHaveCSS('outline-style','none');
  const filters=page.getByRole('button',{name:'Filtros',exact:true});await expect(filters).toBeVisible();
  expect((await filters.boundingBox())?.width||0).toBeGreaterThan(80);
  const mask=await page.locator('#nx21Hero .nx21-tabs').evaluate(element=>getComputedStyle(element).webkitMaskImage||getComputedStyle(element).maskImage);
  expect(mask).toContain('linear-gradient');
  await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';scrollTo({top:500,behavior:'instant'});dispatchEvent(new Event('scroll'))});
  await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(54);
  await expect(page.locator('body')).toHaveClass(/nx21-catalog-scrolled/);
  await expect(page.locator('body')).toHaveClass(/nx21-catalog-scroll-down/);
  await expect(page.locator('#nx21Island')).toHaveClass(/show/);
  await expect(page.locator('#nx21Island')).not.toHaveClass(/expanded/);
  await expect.poll(()=>page.locator('#topbar').evaluate(element=>new DOMMatrixReadOnly(getComputedStyle(element).transform).m42)).toBeLessThan(-40);
  await page.waitForTimeout(420);
  await page.evaluate(()=>{scrollTo({top:Math.max(90,scrollY-120),behavior:'instant'});dispatchEvent(new Event('scroll'))});
  await expect(page.locator('body')).toHaveClass(/nx21-catalog-scroll-up/);
  await expect(page.locator('#nx21Island')).toHaveClass(/expanded/);
  await expect(page.locator('#nx21IslandSearch')).toBeVisible();
  const islandGeometry=await page.locator('#nx21Island').evaluate(element=>({top:Math.round(element.getBoundingClientRect().top),head:Math.round(element.querySelector('.nx21-island-head').getBoundingClientRect().height),panel:Math.round(element.querySelector('.nx21-island-panel').getBoundingClientRect().height)}));
  expect(islandGeometry.top).toBe(58);
  expect(islandGeometry.head).toBe(54);
  expect(islandGeometry.panel).toBeGreaterThan(70);
  await expect.poll(()=>page.locator('#topbar').evaluate(element=>new DOMMatrixReadOnly(getComputedStyle(element).transform).m42)).toBeGreaterThan(-1);
  await noOverflow(page,2);
});

test('Catalog uses two comfortable columns on phones and scales through tablet',async({page})=>{
  await page.unroute('https://graphql.anilist.co/');
  await page.route('https://graphql.anilist.co/',async route=>{const body=route.request().postDataJSON(),current=Number(body.variables?.page||1);await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{Page:{pageInfo:{total:5000,currentPage:current,lastPage:200,hasNextPage:true},media:catalogPage(current)}}})})});
  for(const [width,expectedColumns] of [[320,2],[360,2],[390,2],[430,2],[768,3],[820,3],[1024,4],[1280,5],[1440,5],[1920,5]]){
    await page.setViewportSize({width,height:844});
    await page.goto(pageUrl('/animes/catalogo'),{waitUntil:'domcontentloaded'});
    await expect(page.locator('.nx21-card')).toHaveCount(25,{timeout:30000});
    const columns=await page.locator('.nx21-card').evaluateAll((cards,count)=>new Set(cards.slice(0,count).map(card=>Math.round(card.getBoundingClientRect().left))).size,expectedColumns);
    expect(columns).toBe(expectedColumns);
    const first=await page.locator('.nx21-card').first().evaluate(card=>{const box=card.getBoundingClientRect();return{width:box.width,left:box.left,right:box.right}});
    expect(first.width).toBeGreaterThan(width<=320?135:width<=430?150:200);
    expect(first.left).toBeGreaterThanOrEqual(7);
    expect(first.right).toBeLessThanOrEqual(width-7);
    await noOverflow(page,2);
  }
});

test('Catalog opens dedicated anime detail without action click leaking to card',async({page})=>{const hosted=new URL(ORIGIN).hostname.endsWith('github.io');await page.goto(pageUrl('/animes/catalogo'),{waitUntil:'domcontentloaded'});await allowAccountActions(page);const card=page.locator('.nx21-card').first();await expect(card).toBeVisible({timeout:30000});const before=page.url(),fav=card.locator('button[data-fav]').first();await fav.click();expect(page.url()).toBe(before);await page.waitForTimeout(380);await card.locator('h3').click();await page.waitForURL(u=>{const url=new URL(u);return url.searchParams.get('p')?.startsWith('/anime/')===true||url.pathname.startsWith('/anime/')},{timeout:15000});if(!hosted){const selectedPath=new URL(page.url()).pathname;await page.goto(pageUrl(selectedPath),{waitUntil:'domcontentloaded'})}await expect(page.locator('.nx22-detail')).toBeVisible({timeout:30000})});

test('mobile openings load only the selected video and stay inside the viewport',async({page})=>{await page.setViewportSize({width:390,height:844});let mediaRequests=0;await page.route('https://api.animethemes.moe/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(themeApiData())}));await page.route('https://v.animethemes.moe/**',route=>{mediaRequests++;return route.fulfill({status:200,contentType:'video/webm',body:''})});await page.goto(pageUrl('/anime/anime-teste-101'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx22-detail')).toBeVisible({timeout:30000});await page.locator('[data-nx22-tabs-toggle]').click();await page.locator('[data-nx22-sheet-tab="aberturas"]').click();await expect(page.locator('#nx22Themes')).toHaveAttribute('data-state','ready',{timeout:15000});await expect(page.locator('.nx22-theme-card')).toHaveCount(24);expect(mediaRequests).toBe(0);await expect(page.locator('.nx22-theme-card video[src]')).toHaveCount(0);await noOverflow(page);await page.locator('[data-nx22-theme-play]').first().click();await expect(page.locator('.nx22-theme-card video[src]')).toHaveCount(1);await expect(page.locator('.nx22-theme-card video[preload="metadata"]')).toHaveCount(1);await expect(page.locator('.nx22-theme-card:not(.is-loaded) video[src]')).toHaveCount(0);await noOverflow(page)});

test('mobile openings hide technical upstream errors',async({page})=>{await page.setViewportSize({width:390,height:844});await page.route('https://api.animethemes.moe/**',route=>route.abort('failed'));await page.goto(pageUrl('/anime/anime-teste-101'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx22-detail')).toBeVisible({timeout:30000});await page.locator('[data-nx22-tabs-toggle]').click();await page.locator('[data-nx22-sheet-tab="aberturas"]').click();await expect(page.locator('#nx22Themes')).toHaveAttribute('data-state','error',{timeout:15000});await expect(page.locator('#nx22Themes')).toContainText('Não foi possível carregar este acervo agora');await expect(page.locator('#nx22Themes')).not.toContainText(/Load failed|Failed to fetch|NetworkError/i);await expect(page.getByRole('button',{name:'Tentar novamente'})).toBeVisible();await noOverflow(page,2)});

test('anime detail failures hide provider diagnostics and dependent forms',async({page})=>{await page.unroute('https://graphql.anilist.co/');await page.route('https://graphql.anilist.co/',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({errors:[{message:'upstream diagnostic'}]})}));await page.goto(pageUrl('/anime/anime-teste-101'),{waitUntil:'domcontentloaded'});const failure=page.locator('.nx22-fail');await expect(failure).toBeVisible({timeout:30000});await expect(failure).toContainText('O catálogo está temporariamente indisponível');await expect(failure).not.toContainText(/AniList|upstream|503|diagnostic/i);await expect(page.locator('.nx50-social')).toHaveCount(0);await noOverflow(page,2)});

test('anime detail light theme styles navigation and community access coherently',async({page})=>{await page.addInitScript(()=>localStorage.setItem('aninexus:theme','light'));await page.goto(pageUrl('/anime/anime-teste-101'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx22-detail:not(.nx22-fail)')).toBeVisible({timeout:30000});await expect(page.locator('html')).toHaveAttribute('data-theme','light');await expect(page.locator('.topbar')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');await page.evaluate(()=>scrollTo(0,160));await expect(page.locator('.topbar')).toHaveClass(/is-scrolled/);await expect(page.locator('.topbar')).not.toHaveCSS('background-color','rgba(0, 0, 0, 0)');await expect(page.locator('.nx22-info-card').first()).toHaveCSS('background-color','rgb(255, 255, 255)');await page.getByRole('tab',{name:'Impressões'}).click();await expect(page.locator('.nx50-login-cta')).toHaveCSS('color','rgb(107, 52, 69)');await noOverflow(page,2)});

test('News and authentication remain healthy after V40',async({page})=>{await page.goto(pageUrl('/noticias'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx35-news-page')).toBeVisible({timeout:30000});await noOverflow(page);await page.goto(pageUrl('/login'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx38-auth-page')).toBeVisible({timeout:15000});await expect(page.locator('.nx38-auth-card h2')).toHaveText('Ativação segura em andamento');await expect(page.locator('.nx38-auth-unavailable')).toContainText('Nenhum dado privado');await noOverflow(page)});

test('mobile authentication is compact readable and never overflows',async({page})=>{for(const width of [320,360,390,430]){await page.setViewportSize({width,height:844});await page.goto(pageUrl('/login'),{waitUntil:'domcontentloaded'});const auth=page.locator('.nx38-auth-page');await expect(auth).toBeVisible({timeout:15000});await expect(page.locator('.nx38-auth-benefits')).toBeHidden();await expect(page.locator('.nx38-auth-copy>p')).toBeHidden();const storyHeight=await page.locator('.nx38-auth-story').evaluate(element=>element.getBoundingClientRect().height);expect(storyHeight).toBeLessThan(140);await noOverflow(page,2)}});

test('desktop header keeps only the six approved destinations and gains chrome after scroll',async({page})=>{await page.setViewportSize({width:1440,height:900});await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});const labels=await page.locator('.main-nav>a').allTextContents();expect(labels.map(x=>x.trim())).toEqual(['Início','Animes','Mangás','Temporadas','Programação','Notícias']);await expect(page.locator('.main-nav')).toBeVisible();await expect(page.locator('.menu-btn')).toBeHidden();await expect(page.locator('.top-actions>[data-action="search"]')).toBeVisible();await expect(page.locator('.top-actions>[data-action="theme"]')).toBeVisible();await expect(page.locator('.top-actions>[data-action="notifications"]')).toBeHidden();await expect(page.locator('.top-actions>[data-action="login"]')).toBeVisible();await expect(page.locator('.top-actions>[data-action="register"]')).toBeVisible();await expect(page.locator('#topbar')).not.toHaveClass(/is-scrolled/);await page.evaluate(()=>scrollTo(0,180));await expect(page.locator('#topbar')).toHaveClass(/is-scrolled/);await expect(page.locator('#app main')).toHaveCount(1);await expect(page.locator('main main')).toHaveCount(0);await noOverflow(page,2)});

test('desktop header uses restrained navigation and account typography',async({page})=>{await page.setViewportSize({width:1440,height:900});await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});await expect(page.locator('.main-nav')).toBeVisible({timeout:30000});const typography=await page.evaluate(()=>{const read=element=>{const style=getComputedStyle(element);return{weight:parseInt(style.fontWeight,10),shadow:style.textShadow,spacing:style.letterSpacing}};return{nav:[...document.querySelectorAll('.main-nav>a')].map(read),login:read(document.querySelector('.top-actions>[data-action="login"]')),signup:read(document.querySelector('.top-actions>[data-action="register"]'))}});expect(typography.nav.every(item=>item.weight===600&&item.shadow==='none')).toBe(true);expect(typography.login.weight).toBe(600);expect(typography.signup.weight).toBe(600);expect(typography.login.shadow).toBe('none');expect(typography.signup.shadow).toBe('none');expect(typography.signup.spacing).toBe('normal');await noOverflow(page,2)});

test('authenticated notification drawer loads once and marks an item as read',async({page})=>{await page.setViewportSize({width:1440,height:900});await page.route('**/runtime-config.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:'window.__ANINEXUS_CONFIG__=Object.freeze({authEnabled:false});'}));await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});await page.evaluate(()=>{window.__nx43NotificationCalls=[];window.AniNexusAuth={api:async(path,options={})=>{window.__nx43NotificationCalls.push({path,method:options.method||'GET'});if(options.method==='PATCH')return{};return{items:[{id:'11111111-1111-4111-8111-111111111111',kind:'SYSTEM',title:'Primeira conquista',body:'Você desbloqueou um novo marco.',href:null,read_at:null,created_at:new Date().toISOString()}]}}};document.documentElement.dataset.nxAuthState='authenticated'});const trigger=page.locator('[data-action="notifications"]');await expect(trigger).toBeVisible();await trigger.click();await expect(page.locator('#notificationPanel')).toBeVisible();await expect(page.locator('.nx43-notification-row')).toContainText('Primeira conquista');await expect(page.locator('.nx43-notification-badge')).toBeVisible();await page.locator('.nx43-notification-row').click();await expect(page.locator('.nx43-notification-row')).not.toHaveClass(/is-unread/);await expect(page.locator('.nx43-notification-badge')).toBeHidden();const calls=await page.evaluate(()=>window.__nx43NotificationCalls);expect(calls.filter(call=>call.path.includes('/api/me/notifications?limit=20'))).toHaveLength(1);expect(calls.some(call=>call.method==='PATCH')).toBe(true);await page.getByRole('button',{name:'Fechar notificações'}).first().click();await expect(page.locator('#notificationPanel')).toBeHidden()});

test('account overview exposes real profile connections and one responsive notification center',async({page},testInfo)=>{
  const apiCalls=[];
  await page.route('**/runtime-config.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:`window.__ANINEXUS_CONFIG__=Object.freeze({environment:'test',siteOrigin:location.origin,apiOrigin:'https://api.clerk.com',clerkPublishableKey:['pk','test','dGVzdC5jbGVyay5hY2NvdW50cy5kZXYk'].join('_'),authEnabled:true});`}));
  await page.route('https://test.clerk.accounts.dev/npm/@clerk/ui@1/dist/ui.browser.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:'window.__internal_ClerkUICtor=function ClerkUI(){};'}));
  await page.route('https://test.clerk.accounts.dev/npm/@clerk/clerk-js@6/dist/clerk.browser.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:`window.Clerk={user:{id:'clerk_test'},session:{getToken:async()=>\"token\"},load:async()=>{},addListener:()=>{},openUserProfile:()=>{window.__accountSecurityOpened=true},signOut:async()=>{}};`}));
  await page.route('https://api.clerk.com/**',route=>{const request=route.request(),url=new URL(request.url()),path=url.pathname,method=request.method();apiCalls.push({path,method});let body={};if(path==='/api/me')body={user:{id:'10000000-0000-4000-8000-000000000001',username:'kayky',displayName:'Kayky',email:'kayky@example.com',role:'admin',privacy:'public',emailVerified:true,createdAt:'2026-01-01T00:00:00.000Z'}};else if(path==='/api/me/list')body={items:[{status:'CURRENT'},{status:'COMPLETED'},{status:'COMPLETED'}]};else if(path==='/api/me/follows')body={items:[{media_id:101},{media_id:102}]};else if(path==='/api/me/import-status')body={imported:true};else if(path==='/api/me/profile-connections')body={following:[{username:'luffy',displayName:'Monkey D. Luffy',avatarUrl:pixel}],followers:[{username:'nami',displayName:'Nami',avatarUrl:pixel},{username:'zoro',displayName:'Roronoa Zoro',avatarUrl:pixel}]};else if(path==='/api/me/notifications')body={total:2,unread:1,items:[{id:'11111111-1111-4111-8111-111111111111',kind:'EPISODE',title:'Novo episódio disponível',body:'One Piece recebeu um novo episódio.',url:'/anime/one-piece-21',read_at:null,created_at:new Date().toISOString()},{id:'22222222-2222-4222-8222-222222222222',kind:'COMMUNITY',title:'Nova resposta',body:'Alguém respondeu sua impressão.',url:'/comunidade',read_at:new Date().toISOString(),created_at:new Date(Date.now()-86400000).toISOString()}]};else if(path==='/api/me/notifications/read-all')body={ok:true,updated:1};return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})});
  await page.setViewportSize({width:390,height:844});
  await page.goto(pageUrl('/minha-conta'),{waitUntil:'domcontentloaded'});
  const account=page.locator('.nx56-account-page');
  await expect(account).toBeVisible({timeout:15000});
  await expect(account.locator('.nx56-account-hero')).toContainText('Kayky');
  const mobileBell=page.locator('[data-action="notifications"]');
  await expect(mobileBell).toBeVisible();
  await mobileBell.click();
  await expect(page.locator('.nx43-notification-sheet')).toBeVisible();
  await expect(page.locator('.nx43-notification-row').first()).toContainText('Novo episódio disponível');
  await page.screenshot({path:testInfo.outputPath('notification-sheet-mobile.png')});
  await page.locator('.nx43-notification-close').click();
  await expect(account).toContainText('TÍTULOS SEGUIDOS');
  await expect(account.locator('[data-connection-tab="followers"]')).toContainText('2');
  await account.locator('[data-connection-tab="followers"]').click();
  await expect(account.locator('[data-connection-panel="followers"]')).toContainText('Nami');
  await expect(account.locator('.nx56-notification-row')).toHaveCount(2);
  await account.getByRole('button',{name:/Marcar todas como lidas/}).click();
  await expect(account.locator('[data-account-unread-summary]')).toHaveText('Tudo em dia');
  await expect(account.locator('[data-export]')).toHaveCount(0);
  await noOverflow(page,2);
  await page.waitForTimeout(500);
  await expect(account).toBeVisible();
  await expect(page.locator('#app')).toHaveCSS('opacity','1');
  await page.screenshot({path:testInfo.outputPath('account-center-mobile.png'),fullPage:true});
  await page.setViewportSize({width:1440,height:900});
  await page.reload({waitUntil:'domcontentloaded'});
  const desktopAccount=page.locator('.nx56-account-page');
  await expect(desktopAccount.locator('.nx56-overview-grid')).toBeVisible({timeout:15000});
  await expect(desktopAccount.locator('.nx56-stat-grid>*')).toHaveCount(5);
  await noOverflow(page,2);
  await page.waitForTimeout(500);
  await expect(desktopAccount).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('account-center-desktop.png'),fullPage:true});
  expect(apiCalls.some(call=>call.path==='/api/me/profile-connections')).toBe(true);
  expect(apiCalls.some(call=>call.path==='/api/me/notifications/read-all'&&call.method==='POST')).toBe(true);
});

test('authenticated account menu separates identity and does not duplicate notifications',async({page})=>{await page.setViewportSize({width:1440,height:900});await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});await page.evaluate(pixel=>{window.AniNexusAccountData=async()=>({displayName:'Kayky Sousa',username:'kayky',avatarUrl:pixel});const chip=document.createElement('button');chip.type='button';chip.className='nx38-account-chip';chip.innerHTML=`<i><img src="${pixel}" alt=""></i><span>Kayky</span>`;document.querySelector('.top-actions')?.append(chip)},pixel);const trigger=page.getByRole('button',{name:'Abrir menu da conta'});await expect(trigger).toBeVisible();await trigger.click();const menu=page.locator('.nx42-account-menu');await expect(menu).toBeVisible();await expect(menu.locator('header strong')).toHaveText('Kayky Sousa');await expect(menu.locator('header span')).toHaveText('@kayky');await expect(menu.locator('header img')).toHaveAttribute('src',pixel);await expect(menu.getByRole('button',{name:'Notificações'})).toHaveCount(0);const identity=await menu.locator('header>div').evaluate(element=>({display:getComputedStyle(element).display,gap:parseFloat(getComputedStyle(element).rowGap),nameBottom:element.querySelector('strong').getBoundingClientRect().bottom,handleTop:element.querySelector('span').getBoundingClientRect().top}));expect(identity.display).toBe('grid');expect(identity.gap).toBeGreaterThanOrEqual(4);expect(identity.handleTop).toBeGreaterThan(identity.nameBottom);await trigger.click();await expect(menu).toBeHidden();await page.evaluate(pixel=>dispatchEvent(new CustomEvent('aninexus:account-identity-changed',{detail:{user:{displayName:'Kayky Atualizado',username:'kayky',avatarUrl:pixel}}})),pixel);await trigger.click();await expect(page.locator('.nx42-account-menu header strong')).toHaveText('Kayky Atualizado');await noOverflow(page,2)});

test('all required widths stay inside the viewport',async({page,browserName})=>{test.skip(browserName!=='chromium','A matriz completa de larguras roda uma vez; Firefox e WebKit executam os fluxos críticos.');for(const width of [320,360,375,390,414,768,820,1024,1280,1440,1920]){await page.setViewportSize({width,height:width<600?844:900});await page.goto(pageUrl(width<600?'/animes/catalogo':'/'),{waitUntil:'domcontentloaded'});await page.locator('#app main').first().waitFor({state:'visible',timeout:30000});await noOverflow(page,8)}});

test('public navigation degrades gracefully when AniList is unavailable',async({page})=>{await page.unroute('https://graphql.anilist.co/');await page.route('https://graphql.anilist.co/',route=>route.abort('failed'));await page.goto(pageUrl('/animes/catalogo'),{waitUntil:'domcontentloaded'});await expect(page.locator('#app main').first()).toBeVisible({timeout:30000});await expect(page.locator('body')).not.toContainText('HTTP 500');await noOverflow(page)});

test('mobile Community and Programação do not overflow',async({page})=>{await page.setViewportSize({width:390,height:844});for(const route of ['/comunidade','/animes/programacao']){await page.goto(pageUrl(route),{waitUntil:'domcontentloaded'});await expect(page.locator(route==='/comunidade'?'.nx40-community':'.nx18-schedule').first()).toBeVisible({timeout:30000});await noOverflow(page)}});

test('public profile and profile editor are complete across viewports',async({page},testInfo)=>{
  await page.setViewportSize({width:390,height:844});
  await page.route('**/runtime-config.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:`window.__ANINEXUS_CONFIG__=Object.freeze({environment:'test',siteOrigin:'https://qgbaltigo.github.io/AniNexus',apiOrigin:'https://graphql.anilist.co',clerkPublishableKey:'pk_test_profile',authEnabled:true});`}));
  await page.route('**/api/users/kayky',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({profile:{username:'kayky',displayName:'Kayky',avatarUrl:pixel,bannerUrl:pixel,bio:'Esta descrição não deve aparecer.',location:'Cuiabá, MT',websiteUrl:'https://example.com',instagramHandle:'kayky',telegramHandle:'kayky',role:'user',privacy:'public',isPrivate:false,createdAt:'2026-01-01T00:00:00.000Z'},stats:{list_total:18,watching:4,completed:10,episodes_watched:320,average_score:8.7},rank:{name:'Nível Nexus 4',xp:320,nextXp:450},library:[{media_id:101,status:'CURRENT',progress:5,score:9,media:{id:101,title:'Anime Teste 101',cover:pixel}}],mangaLibrary:[{media_id:201,status:'CURRENT',progress:12,media:{id:201,title:'Mangá Teste',cover:pixel}}],favoriteCharacters:[{id:40,name:'Monkey D. Luffy',image:pixel,work:'ONE PIECE'}],activity:[{media_id:101,status:'CURRENT',progress:5,created_at:new Date().toISOString(),media:{id:101,title:'Anime Teste 101',cover:pixel}}],impressions:[{id:'one',media_id:101,body:'Uma ótima estreia.',spoiler:false,created_at:new Date().toISOString(),media:{id:101,title:'Anime Teste 101',cover:pixel}}]})}));
  await page.goto(pageUrl('/u/kayky'),{waitUntil:'domcontentloaded'});const profile=page.locator('.nx38p-page');await expect(profile).toBeVisible({timeout:15000});await expect(profile.locator('.nx38p-person h1')).toHaveText('Kayky');await expect(profile.locator('.nx38p-summary-stats')).toContainText('320');await expect(profile).not.toContainText('Esta descrição não deve aparecer.');await expect(profile.locator('[data-profile-tab="all"]')).toBeVisible();await expect(profile.locator('[data-profile-tab="manga"]')).toBeVisible();await expect(profile.locator('[data-profile-tab="characters"]')).toBeVisible();const svgBoxes=await page.locator('.nx38p-meta svg,.nx38p-socials svg,.nx38p-share svg,.nx38p-content-nav svg').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect()));expect(svgBoxes.length).toBeGreaterThan(4);for(const box of svgBoxes){expect(box.width).toBeLessThanOrEqual(20);expect(box.height).toBeLessThanOrEqual(20)}await profile.locator('[data-profile-tab="manga"]').click();await expect(profile.locator('[data-profile-panel="manga"] .nx38p-media')).toContainText('Mangá Teste');await profile.locator('[data-profile-tab="characters"]').click();await expect(profile.locator('[data-profile-panel="characters"]')).toContainText('Monkey D. Luffy');await page.screenshot({path:testInfo.outputPath('public-profile-mobile.png')});await noOverflow(page,2);
  await page.setViewportSize({width:1440,height:900});await page.reload({waitUntil:'domcontentloaded'});await expect(page.locator('.nx38p-layout')).toBeVisible();await page.screenshot({path:testInfo.outputPath('public-profile-desktop.png')});await noOverflow(page,2);await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{window.AniNexusAuth={api:async path=>path.startsWith('/api/me/username-availability')?{available:true}:path==='/api/me/list-transfers'?{items:[]}:{user:{id:'user_kayky',username:'kayky',displayName:'Kayky',privacy:'public'}}};window.AniNexusProfileV38.openEditor({id:'user_kayky',username:'kayky',displayName:'Kayky',avatarUrl:'',bannerUrl:'',privacy:'public',showLibrary:true,showActivity:true,showStats:true})});await expect(page.getByRole('heading',{name:'Personalizar perfil'})).toBeVisible();await expect(page.locator('input[name="username"]')).toHaveValue('kayky');await expect(page.locator('input[name="avatarUrl"]')).toHaveCount(0);await expect(page.locator('[data-media-input="avatar"]')).toHaveAttribute('accept','image/jpeg,image/png,image/webp');await expect(page.locator('[data-media-input="banner"]')).toBeAttached();await expect(page.locator('input[name="avatarPreset"]')).toHaveCount(8);await page.locator('.nx38pe-avatar-option',{hasText:'Vermelho'}).click();await expect(page.locator('[data-preview-avatar] img')).toHaveAttribute('src',/mascot-red\.png/);await page.locator('.nx38pe-panels').evaluate(element=>{element.scrollTop=0});await page.screenshot({path:testInfo.outputPath('profile-settings-profile-mobile.png')});await page.getByRole('button',{name:'Privacidade'}).click();await expect(page.locator('input[name="privacy"]')).toHaveCount(3);await expect(page.locator('[data-settings-panel="privacy"]')).toContainText('feeds públicos globais');await page.screenshot({path:testInfo.outputPath('profile-settings-privacy-mobile.png')});await page.getByRole('button',{name:'Importar e exportar'}).click();await expect(page.getByRole('button',{name:'Importar agora'})).toBeVisible();await expect(page.getByRole('button',{name:'Exportar animes'})).toBeVisible();await expect(page.locator('input[name="bio"]')).toHaveCount(0);await expect(page.locator('input[name="location"]')).toHaveCount(0);await page.screenshot({path:testInfo.outputPath('profile-settings-transfer-mobile.png')});await noOverflow(page,2);await page.setViewportSize({width:1440,height:900});await expect(page.locator('.nx38pe-layout')).toBeVisible();await page.screenshot({path:testInfo.outputPath('profile-settings-transfer-desktop.png')});await page.getByRole('button',{name:'Perfil',exact:true}).click();await page.screenshot({path:testInfo.outputPath('profile-settings-profile-desktop.png')});await noOverflow(page,2)
});

test('public profile deep-links to an unlocked achievement and shows three pinned badges',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const collection=achievementPayload({pins:[achievementDefinitions[0].id,achievementDefinitions[7].id,achievementDefinitions[11].id]}),target='completed-living-encyclopedia';
  await page.route('**/runtime-config.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:`window.__ANINEXUS_CONFIG__=Object.freeze({environment:'test',siteOrigin:'https://qgbaltigo.github.io/AniNexus',apiOrigin:'https://graphql.anilist.co',clerkPublishableKey:'pk_test_profile',authEnabled:true});`}));
  await page.route('**/api/users/kayky',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({profile:{username:'kayky',displayName:'Kayky',avatarUrl:pixel,bannerUrl:pixel,bio:'Anime, mangá e boas conversas.',role:'user',privacy:'public',isPrivate:false,showLibrary:false,showActivity:false,showStats:false,createdAt:'2026-01-01T00:00:00.000Z',equippedTitle:collection.equippedTitle},rank:collection.level,achievements:collection.items.filter(item=>item.unlocked),pinnedAchievements:collection.pins.map(id=>collection.items.find(item=>item.id===id)),stats:null,library:[],mangaLibrary:[],activity:[],impressions:[]})}));
  await page.goto(pageUrl(`/u/kayky?tab=achievements&achievement=${target}`),{waitUntil:'domcontentloaded'});const profile=page.locator('.nx38p-page'),targetCard=profile.locator(`[data-public-achievement-id="${target}"]`);await expect(profile).toBeVisible({timeout:15000});await expect(profile.locator('.nx48-profile-title')).toHaveText('Enciclopédia Viva');await expect(profile.locator('.nx48-profile-pin')).toHaveCount(3);await expect(profile.locator('[data-profile-panel="achievements"]')).toHaveClass(/active/);await expect(targetCard).toHaveClass(/is-target/);await expect(targetCard).toContainText('Enciclopédia Viva');await expect(targetCard).toContainText('Concluiu 100 animes.');await noOverflow(page,2);
  const badges=await profile.locator('.nx48-profile-achievements .nx48-badge').evaluateAll(items=>items.map(item=>{const badge=item.getBoundingClientRect(),icon=item.querySelector('svg').getBoundingClientRect();return{dx:Math.abs((badge.left+badge.right-icon.left-icon.right)/2),dy:Math.abs((badge.top+badge.bottom-icon.top-icon.bottom)/2)}}));
  expect(badges.length).toBeGreaterThan(0);for(const badge of badges){expect(badge.dx).toBeLessThanOrEqual(1);expect(badge.dy).toBeLessThanOrEqual(1)}
});

test('anime rankings and list hub share one responsive dedicated renderer',async({page})=>{
  test.setTimeout(120000);
  const items=discoveryCatalog();
  await page.unroute('https://graphql.anilist.co/');
  await page.route('https://graphql.anilist.co/',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{Page:{media:items,pageInfo:{total:items.length,currentPage:1,lastPage:1,hasNextPage:false}}}})}));
  await page.route('**/api/list/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items,pageInfo:{total:items.length,currentPage:1,lastPage:1,hasNextPage:false}})}));
  await page.route('**/api/lists',route=>route.fulfill({status:200,contentType:'application/json',body:'[]'}));
  const routes=[
    ['/melhores-animes-para-assistir','Melhores animes para assistir'],
    ['/animes-mais-assistidos','Animes mais assistidos'],
    ['/animes-mais-aguardados','Animes mais aguardados']
  ];
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
    await page.setViewportSize(viewport);
    for(const [path,title] of routes){
      await page.goto(pageUrl(path),{waitUntil:'domcontentloaded'});
      const root=page.locator('.nx48-lists-page');
      await expect(root).toBeVisible({timeout:30000});
      await expect(root.getByRole('heading',{name:title,level:1})).toBeVisible();
      await expect(root.locator('.nx48-list-media')).toHaveCount(12);
      await expect(root.locator('.catalog-head,.nx-list-group')).toHaveCount(0);
      await expect(root.locator('.nx48-list-tabs:not(.is-compact) a')).toHaveCount(4);
      if(viewport.width<600){
        const columns=await root.locator('.nx48-list-media').evaluateAll(cards=>new Set(cards.slice(0,4).map(card=>Math.round(card.getBoundingClientRect().left))).size);
        expect(columns).toBe(2);
        await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';scrollTo({top:700,behavior:'instant'});dispatchEvent(new Event('scroll'))});
        await page.waitForTimeout(360);
        await expect(root.locator('.nx48-list-island')).toHaveClass(/show/);
        await expect.poll(()=>page.locator('#topbar').evaluate(element=>element.getBoundingClientRect().bottom)).toBeLessThanOrEqual(2);
        await expect(root.locator('.nx48-list-island-arrow')).toHaveCSS('border-radius','50%');
        const scrollBefore=await page.evaluate(()=>scrollY);
        await root.locator('[data-nx48-island-toggle]').click();
        await expect(root.locator('.nx48-list-island-panel')).toBeVisible();
        await expect.poll(async()=>Math.abs((await page.evaluate(()=>scrollY))-scrollBefore)).toBeLessThanOrEqual(12);
        await page.waitForTimeout(420);
        expect(Math.abs((await page.evaluate(()=>scrollY))-scrollBefore)).toBeLessThanOrEqual(2);
      }
      await noOverflow(page,2);
    }
    await page.goto(pageUrl('/listas-de-animes'),{waitUntil:'domcontentloaded'});
    const hub=page.locator('.nx48-lists-page');
    await expect(hub.locator('.nx48-list-group').first()).toBeVisible({timeout:30000});
    await expect(hub.locator('#nx48ListHub')).toContainText('Melhores animes para assistir');
    await expect(hub.locator('.nx48-list-card')).toHaveCount(13);
    await expect(hub.locator('.nx-list-group,#listsHub')).toHaveCount(0);
    await noOverflow(page,2);
  }
});

test('studio hub uses dedicated swipeable rails and responsive controls',async({page})=>{
  const studios=Array.from({length:3},(_,index)=>({id:index+1,name:['MAPPA','Bones','Kyoto Animation'][index],mediaTotal:28-index*5,media:Array.from({length:12},(_,mediaIndex)=>anime(900+index*20+mediaIndex))}));
  await page.unroute('https://graphql.anilist.co/');
  await page.route('https://graphql.anilist.co/',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{Page:{studios:studios.map(studio=>({...studio,isAnimationStudio:true,media:{pageInfo:{total:studio.mediaTotal},nodes:studio.media}})),pageInfo:{total:36,currentPage:1,lastPage:3,hasNextPage:true}}}})}));
  await page.route('**/api/studios?**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:studios,pageInfo:{total:36,currentPage:1,lastPage:3,hasNextPage:true}})}));
  await page.setViewportSize({width:390,height:844});
  await page.goto(pageUrl('/animes/estudios'),{waitUntil:'domcontentloaded'});
  const root=page.locator('.nx47-studios-page');
  await expect(root).toBeVisible({timeout:30000});
  await expect(root.getByText('Explore por estúdio',{exact:true})).toHaveCount(0);
  await expect(root.locator('.nx47-studios-directory-head')).toHaveCount(0);
  await expect(root.locator('.nx47-studio-block')).toHaveCount(3);
  const firstRail=root.locator('[data-nx47-studio-rail-list]').first();
  await expect.poll(()=>firstRail.evaluate(rail=>rail.scrollWidth>rail.clientWidth)).toBe(true);
  const before=await firstRail.evaluate(rail=>rail.scrollLeft);
  await root.locator('.nx47-studio-block').first().getByRole('button',{name:'Próximas produções'}).click();
  await expect.poll(()=>firstRail.evaluate(rail=>rail.scrollLeft)).toBeGreaterThan(before+100);
  await root.locator('#nx47StudioControls').getByPlaceholder('Buscar estúdio...').fill('Bones');
  await expect(root.locator('.nx47-studio-block')).toHaveCount(1);
  await expect(root.locator('.nx47-studio-block')).toContainText('Bones');
  await noOverflow(page,2);
});

test('Home discovery links open the matching anime catalog tabs',async({page})=>{
  const routeState=()=>page.evaluate(()=>{const current=new URL(location.href),restored=current.searchParams.get('p'),route=restored?new URL(restored,location.origin):current;return{path:route.pathname,section:route.searchParams.get('secao')}});
  await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});
  const popular=page.locator('.nx35-section').filter({has:page.locator('#nx35Popular')});
  await popular.getByRole('link',{name:'Ver todos'}).click();
  await expect(page.locator('.nx21-catalog-page')).toBeVisible({timeout:30000});
  await expect.poll(routeState).toEqual({path:'/animes/catalogo',section:'populares'});
  await expect(page.locator('.nx21-tab[data-nx21-mode="POPULAR"]').first()).toHaveAttribute('aria-pressed','true');

  await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});
  const soon=page.locator('.nx35-section').filter({has:page.locator('#nx35Soon')});
  await soon.getByRole('link',{name:'Ver todos'}).click();
  await expect(page.locator('.nx21-catalog-page')).toBeVisible({timeout:30000});
  await expect.poll(routeState).toEqual({path:'/animes/catalogo',section:'breve'});
  await expect(page.locator('.nx21-tab[data-nx21-mode="SOON"]').first()).toHaveAttribute('aria-pressed','true');
});

test('Onde assistir is a platform-first responsive catalog with standard scroll chrome',async({page})=>{
  const items=discoveryCatalog();
  await page.unroute('https://graphql.anilist.co/');
  await page.route('https://graphql.anilist.co/',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{Page:{media:items,pageInfo:{total:items.length,currentPage:1,lastPage:1,hasNextPage:false}}}})}));
  await page.route('**/api/catalog?**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items,pageInfo:{total:items.length,currentPage:1,lastPage:1,hasNextPage:false}})}));
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
    await page.setViewportSize(viewport);
    await page.goto(pageUrl('/animes/onde-assistir'),{waitUntil:'domcontentloaded'});
    const pageRoot=page.locator('.nx47-watch-page');
    await expect(pageRoot).toBeVisible({timeout:30000});
    await expect(page.locator('.nx47-provider-card')).toHaveCount(9);
    await expect(page.locator('.nx47-provider-card .nx47-provider-logo img')).toHaveCount(9);
    await expect(page.locator('.nx47-provider-wordmark')).toHaveCount(0);
    await expect.poll(()=>page.locator('.nx47-provider-card .nx47-provider-logo img').evaluateAll(images=>images.filter(image=>image.complete&&image.naturalWidth>0).length)).toBe(9);
    await expect(page.locator('#nx47WatchResults')).not.toHaveAttribute('aria-busy','true');
    await expect(page.locator('.nx42-official-watch,[data-member-telegram]')).toHaveCount(0);
    const initial=await page.evaluate(()=>{const bar=document.querySelector('#topbar').getBoundingClientRect(),title=document.querySelector('.nx47-title-row').getBoundingClientRect();return{barBottom:bar.bottom,titleTop:title.top}});
    expect(initial.titleTop).toBeGreaterThanOrEqual(initial.barBottom-1);
    await page.locator('#nx47Providers [data-nx47-provider="netflix"]').click();
    await expect(page.locator('#nx47Providers [data-nx47-provider="netflix"]')).toHaveAttribute('aria-pressed','true');
    await expect(page.locator('#nx47WatchTitle')).toHaveText('Animes na Netflix');
    await expect(page.locator('#nx47WatchResults .nx47-media-card')).toHaveCount(8);
    if(viewport.width<600){
      const columns=await page.locator('.nx47-provider-card').evaluateAll(cards=>new Set(cards.slice(0,3).map(card=>Math.round(card.getBoundingClientRect().left))).size);
      expect(columns).toBe(1);
      await expect.poll(async()=>{const before=await page.evaluate(()=>scrollY);await page.waitForTimeout(80);const after=await page.evaluate(()=>scrollY);return Math.abs(after-before)},{timeout:3000}).toBeLessThanOrEqual(1);
      await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';scrollTo({top:0,left:0,behavior:'instant'})});
      await expect.poll(()=>page.evaluate(()=>Math.round(scrollY))).toBeLessThanOrEqual(1);
      await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';scrollTo(0,180)});
      await expect.poll(()=>page.evaluate(()=>Math.round(scrollY))).toBeGreaterThan(100);
      await expect.poll(()=>page.evaluate(()=>document.querySelector('#topbar').getBoundingClientRect().bottom),{timeout:3000}).toBeLessThanOrEqual(2);
      const chrome=await page.evaluate(()=>{const bar=document.querySelector('#topbar').getBoundingClientRect(),island=document.querySelector('.nx47-island').getBoundingClientRect();return{barBottom:bar.bottom,islandTop:island.top,islandHeight:island.height}});
      expect(chrome.barBottom).toBeLessThanOrEqual(2);expect(chrome.islandTop).toBeLessThanOrEqual(2);expect(chrome.islandHeight).toBeLessThanOrEqual(49);
      const scrollBefore=await page.evaluate(()=>scrollY);
      await page.locator('[data-nx47-island-toggle]').evaluate(button=>button.click());
      await expect(page.locator('.nx47-island-panel')).toBeVisible();
      expect(Math.abs((await page.evaluate(()=>scrollY))-scrollBefore)).toBeLessThanOrEqual(12);
    }
    await noOverflow(page,2);
  }
});

test('Animes dublados has usable search filters pagination data and standard actions',async({page})=>{
  const items=discoveryCatalog();
  const hosted=new URL(ORIGIN).hostname.endsWith('github.io');
  await page.unroute('https://graphql.anilist.co/');
  await page.route('https://graphql.anilist.co/',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{Page:{media:items,pageInfo:{total:items.length,currentPage:1,lastPage:1,hasNextPage:false}}}})}));
  await page.route('**/api/dublados?**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items,pageInfo:{total:25,currentPage:1,lastPage:3,hasNextPage:true}})}));
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
    await page.setViewportSize(viewport);
    await page.goto(pageUrl('/animes/dublados'),{waitUntil:'domcontentloaded'});
    const pageRoot=page.locator('.nx47-dubbed-page');
    await expect(pageRoot).toBeVisible({timeout:30000});
    await expect(pageRoot.getByRole('heading',{name:'Animes dublados',level:1})).toBeVisible();
    await expect(pageRoot.getByText('Vozes em português',{exact:true})).toHaveCount(0);
    await expect(pageRoot.getByText('CATÁLOGO DUBLADO',{exact:true})).toHaveCount(0);
    await expect(page.locator('#nx47DubbedResults .nx47-media-card')).toHaveCount(12);
    await expect(page.locator('#nx47DubbedCount')).toContainText(hosted?'12 títulos confirmados':'25 títulos confirmados');
    if(hosted)await expect(page.getByRole('navigation',{name:'Paginação dos animes dublados'})).toHaveCount(0);
    else await expect(page.getByRole('navigation',{name:'Paginação dos animes dublados'})).toContainText('Página 1 de 3');
    const headerFilters=page.locator('.nx47-intro #nx47DubbedHeaderFilters');
    const controls=headerFilters.locator('#nx47DubbedControls');
    await expect(headerFilters.locator('.nx47-segmented')).toBeVisible();
    await expect(headerFilters.locator('.nx47-search')).toBeVisible();
    await expect(page.locator('.nx47-dubbed-nav-band')).toHaveCount(0);
    await expect(page.locator('.nx47-dubbed-section .nx47-segmented,.nx47-dubbed-section .nx47-search')).toHaveCount(0);
    await headerFilters.getByRole('button',{name:'Filmes',exact:true}).click();
    await expect(page.locator('#nx47DubbedResults .nx47-media-card')).toHaveCount(4);
    const search=controls.getByPlaceholder('Buscar nesta página...');
    await search.fill('Dublado Teste 2');
    await expect(page.locator('#nx47DubbedResults .nx47-media-card')).toHaveCount(1);
    await expect(page.locator('#nx47DubbedResults')).toContainText('Dublado Teste 2');
    await headerFilters.getByRole('button',{name:'Todos',exact:true}).click();
    await controls.getByRole('button',{name:'Limpar busca'}).click();
    await expect(page.locator('#nx47DubbedResults .nx47-media-card')).toHaveCount(12);
    const actionBox=await page.locator('#nx47DubbedResults [data-list]').first().evaluate(button=>button.getBoundingClientRect());
    expect(actionBox.width).toBeGreaterThanOrEqual(31);expect(actionBox.width).toBeLessThanOrEqual(35);expect(Math.abs(actionBox.width-actionBox.height)).toBeLessThanOrEqual(1);
    if(viewport.width<600){
      const centered=await page.evaluate(()=>{const header=document.querySelector('#nx47DubbedHeaderFilters'),headerBox=header.getBoundingClientRect(),segment=header.querySelector('.nx47-segmented').getBoundingClientRect(),search=header.querySelector('.nx47-search').getBoundingClientRect(),center=headerBox.left+headerBox.width/2;return{segment:Math.abs(segment.left+segment.width/2-center),search:Math.abs(search.left+search.width/2-center)}});
      expect(centered.segment).toBeLessThanOrEqual(2);expect(centered.search).toBeLessThanOrEqual(2);
      const buttons=await headerFilters.locator('.nx47-segmented button').evaluateAll(nodes=>nodes.map(node=>{const box=node.getBoundingClientRect();return{width:Math.round(box.width),height:Math.round(box.height),top:Math.round(box.top)}}));
      expect(new Set(buttons.map(button=>button.width)).size).toBe(1);
      expect(new Set(buttons.map(button=>button.height)).size).toBe(1);
      expect(new Set(buttons.map(button=>button.top)).size).toBe(1);
      const segmentFit=await headerFilters.locator('.nx47-segmented').evaluate(group=>{const outer=group.getBoundingClientRect();return[...group.querySelectorAll('button')].every(button=>{const box=button.getBoundingClientRect();return box.top>=outer.top&&box.bottom<=outer.bottom})});
      expect(segmentFit).toBe(true);
      const columns=await page.locator('#nx47DubbedResults .nx47-media-card').evaluateAll(cards=>new Set(cards.slice(0,4).map(card=>Math.round(card.getBoundingClientRect().left))).size);
      expect(columns).toBe(2);
      await page.evaluate(()=>scrollTo(0,360));await page.waitForTimeout(320);
      await expect(page.locator('.nx47-island')).toHaveClass(/show/);
      await expect.poll(()=>page.locator('#topbar').evaluate(element=>element.getBoundingClientRect().bottom)).toBeLessThanOrEqual(2);
      await expect(page.locator('.nx47-island-arrow')).toHaveCSS('border-radius','50%');
      const scrollBefore=await page.evaluate(()=>scrollY);
      await page.locator('[data-nx47-island-toggle]').click();
      await expect(page.locator('.nx47-island-panel')).toBeVisible();
      await expect.poll(async()=>Math.abs((await page.evaluate(()=>scrollY))-scrollBefore)).toBeLessThanOrEqual(12);
    }
    await noOverflow(page,2);
  }
});
