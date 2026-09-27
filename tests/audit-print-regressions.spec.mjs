import {test,expect} from '@playwright/test';
const origin=process.env.ANINEXUS_E2E_ORIGIN||'http://127.0.0.1:4174/';
const widths=[320,360,375,390,393,412,430,480,768,820,1024,1280,1366,1440,1920];
const cover='/assets/logo.png';
async function partialManga(page,theme='dark'){
  await page.addInitScript(theme=>{localStorage.setItem('aninexus:theme',theme);localStorage.setItem('aninexus:privacy:v1',JSON.stringify({analytics:false}));},theme);
  await page.route('**/api/manga/999',route=>route.fulfill({json:{id:999,mediaType:'MANGA',title:'The Beginning After the End',cover,description:'Uma história em português para reproduzir uma ficha com poucos dados.',status:null,format:'MANGA',genres:[],studios:[],staff:[],characters:[],relations:[],recommendations:[],tags:[],streaming:[]}}));
  await page.route('https://graphql.anilist.co/**',route=>route.fulfill({json:{data:{Media:null}}}));
  await page.route('https://api.jikan.moe/**',route=>route.fulfill({json:{data:null}}));
  await page.goto(new URL('/manga/the-beginning-after-the-end-999',origin).href);
  await expect(page.locator('#app h1')).toHaveText('The Beginning After the End');
}
for(const theme of ['dark','light'])test(`print: sparse manga has no artificial gap or narrow empty state ${theme}`,async({page},info)=>{
  await page.setViewportSize({width:430,height:932});
  await partialManga(page,theme);
  await page.locator('.nx22-akira-file').scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath('sparse-general.png')});
  const gap=await page.evaluate(()=>{const a=document.querySelector('.nx22-akira-file').getBoundingClientRect(),b=document.querySelector('.nx22-layout aside').getBoundingClientRect();return b.top-a.bottom});
  expect(gap,'Ficha técnica must follow content, not a viewport-sized internal main').toBeLessThan(64);
  await expect(page.locator('.nx22-akira-file')).not.toContainText(/já está concluída|Arquivo completo/);
  await page.locator('[data-nx22-tab="recomendacoes"]').click();
  await page.screenshot({path:info.outputPath('empty-recommendations.png')});
  const empty=page.locator('.nx22-detail-empty');await expect(empty).toBeVisible();
  expect((await empty.boundingBox()).width).toBeGreaterThan(350);
  for(const width of widths){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),`${width}`).toBeLessThanOrEqual(2);}
});
test('print: notification symbols use the same semantic mapping in every surface',async({page})=>{
  await page.goto(new URL('/quem-somos',origin).href);
  const mapping=await page.evaluate(()=>window.AniNexusUI?['EPISODE','NEWS','COMMUNITY','SYSTEM'].map(kind=>window.AniNexusUI.notification({kind})).concat(window.AniNexusUI.notification({kind:'SYSTEM',url:'/conquistas'})):[]);
  expect(mapping.map(x=>x.icon)).toEqual(['play','news','people','bell','trophy']);
  expect(new Set(mapping.map(x=>x.svg)).size).toBe(5);
});
test('print: home no longer displays redundant catalog calls to action',async({page})=>{
  await page.goto(origin);
  await expect(page.locator('.nx35-home')).toBeVisible();
  await expect(page.locator('.nx35-hero-actions')).toHaveCount(0);
});
for(const theme of ['dark','light'])test(`print: account loading communicates progress without a distorted spinner ${theme}`,async({page},info)=>{
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(value=>{localStorage.setItem('aninexus:theme',value);localStorage.setItem('aninexus:privacy:v1',JSON.stringify({analytics:false}));},theme);
  await page.route('**/runtime-config.js*',route=>route.fulfill({contentType:'application/javascript',body:`window.__ANINEXUS_CONFIG__={apiOrigin:'https://api.clerk.com',clerkPublishableKey:['pk','test','dGVzdC5jbGVyay5hY2NvdW50cy5kZXYk'].join('_'),authEnabled:true};`}));
  await page.route('https://test.clerk.accounts.dev/npm/@clerk/ui@1/dist/ui.browser.js',route=>route.fulfill({contentType:'application/javascript',body:'window.__internal_ClerkUICtor=function(){};'}));
  await page.route('https://test.clerk.accounts.dev/npm/@clerk/clerk-js@6/dist/clerk.browser.js',route=>route.fulfill({contentType:'application/javascript',body:'window.Clerk={user:{id:"fixture"},session:{getToken:async()=>"fixture-token"},load:async()=>{},addListener:()=>{}};'}));
  let release;const gate=new Promise(resolve=>release=resolve);
  await page.route('https://api.clerk.com/**',async route=>{await gate;await route.fulfill({json:{items:[]}})});
  await page.goto(new URL('/minha-conta',origin).href);
  const loading=page.getByRole('status').filter({hasText:'Carregando sua conta'});
  await expect(loading).toBeVisible();
  await expect(loading).toHaveAttribute('aria-busy','true');
  const bounds=await loading.locator('.nx61-loading-heading>i').boundingBox();expect(bounds.width).toBe(bounds.height);
  await page.screenshot({path:info.outputPath('account-loading.png')});
  await page.emulateMedia({reducedMotion:'reduce'});
  expect(await loading.locator('.nx61-loading-heading>i').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
  release();
});
test('print: horizontal position stays visible and follows keyboard scrolling',async({page})=>{
  await page.setViewportSize({width:320,height:844});await partialManga(page);
  const tabs=page.locator('.nx22-tab-list'),track=page.locator('.nx22-tabs-row>.nx61-scroll-track');
  await expect(track).toBeVisible();
  const before=await track.locator('i').evaluate(el=>getComputedStyle(el).transform);
  await tabs.evaluate(el=>el.scrollTo({left:el.scrollWidth,behavior:'instant'}));
  await expect.poll(()=>track.locator('i').evaluate(el=>getComputedStyle(el).transform)).not.toBe(before);
  await page.setViewportSize({width:1920,height:900});await expect(track).toBeHidden();
});
test('print: news back control matches the shared title back control',async({page},info)=>{
  await page.setViewportSize({width:390,height:844});await partialManga(page);
  const metrics=locator=>locator.evaluate(el=>{const s=getComputedStyle(el),v=getComputedStyle(el.querySelector('svg'));return{width:s.width,height:s.height,radius:s.borderRadius,iconWidth:v.width,stroke:v.strokeWidth}});
  const detail=await metrics(page.locator('.nx22-back'));
  const item={id:'fixture',slug:'noticia-teste',title:'Novo anime ganha data de estreia',summary:'Uma nova temporada foi anunciada para o Brasil.',category:'Animes',language:'pt-BR',publishedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString(),sourceUrl:'https://example.com/noticia',sourceContent:[{type:'paragraph',text:'A produção confirmou o lançamento da nova temporada para o próximo ano.'}],contentMode:'full'};
  await page.route('**/api/news*',route=>route.fulfill({json:{items:[item]}}));
  await page.route('**/api/news/**',route=>route.fulfill({json:{item}}));
  await page.goto(new URL('/noticias/noticia-teste',origin).href);
  const back=page.locator('.nx40-reader-actions [data-back]');await expect(back).toBeVisible();
  expect(await metrics(back)).toEqual(detail);
  await page.screenshot({path:info.outputPath('news-back.png')});
});
