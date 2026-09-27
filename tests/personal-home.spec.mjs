import {test,expect} from '@playwright/test';
const origin=process.env.ANINEXUS_E2E_ORIGIN||'http://127.0.0.1:4174/';
const base={id:1,mediaType:'ANIME',title:'One Piece',cover:null,progress:1142,total:null,status:'CURRENT',next:1143};
const fixture={timeZone:'America/Cuiaba',continue:[base,{...base,id:2,title:'Um mangá de nome muito longo para validar que o card não ultrapassa a tela',mediaType:'MANGA',progress:8,next:9}],todayItems:[{...base,airingAt:1790523000,episode:1143}],week:[{...base,day:'2026-09-27',airingAt:1790523000,episode:1143}],backlog:[{...base,id:3,title:'Re:Zero',remaining:3}],premieres:[{...base,id:4,title:'Nova temporada',date:'2027-01-10'}],coverage:{tracked:4}};
async function authFixture(page,home,{theme='dark',signedIn=true}={}){
  await page.addInitScript(({theme,signedIn})=>{localStorage.setItem('aninexus:theme',theme);localStorage.setItem('aninexus:privacy:v1',JSON.stringify({analytics:false}));window.__signedIn=signedIn;},{theme,signedIn});
  await page.route('**/runtime-config.js*',route=>route.fulfill({contentType:'application/javascript',body:`window.__ANINEXUS_CONFIG__={apiOrigin:'https://api.clerk.com',clerkPublishableKey:['pk','test','dGVzdC5jbGVyay5hY2NvdW50cy5kZXYk'].join('_'),authEnabled:true};`}));
  await page.route('https://test.clerk.accounts.dev/npm/@clerk/ui@1/dist/ui.browser.js',route=>route.fulfill({contentType:'application/javascript',body:'window.__internal_ClerkUICtor=function(){};'}));
  await page.route('https://test.clerk.accounts.dev/npm/@clerk/clerk-js@6/dist/clerk.browser.js',route=>route.fulfill({contentType:'application/javascript',body:'window.Clerk={get user(){return window.__signedIn?{id:"fixture"}:null},session:{getToken:async()=>"fixture-token"},load:async()=>{},addListener:()=>{}};'}));
  await page.route('https://api.clerk.com/**',route=>{if(route.request().url().includes('/api/me/home'))return home(route);return route.fulfill({json:{user:signedIn?{id:'fixture',username:'leitor',displayName:'Leitor'}:null,items:[]}})});
}
for(const theme of ['dark','light'])test(`personal home ${theme}: meaningful real progress, both media, all viewports`,async({page},info)=>{
  const requests=[];await authFixture(page,route=>{requests.push(route.request());return route.fulfill({json:fixture})},{theme});
  await page.setViewportSize({width:390,height:844});await page.goto(origin);
  const hub=page.locator('.nx61-personal-home');await expect(hub.getByRole('heading',{name:'Hoje, no seu ritmo.'})).toBeVisible();
  await expect(hub).toContainText('Você parou no episódio 1142');await expect(hub).toContainText('Próximo capítulo: 9');
  await expect(hub).toContainText('3 episódios pendentes');await expect(hub).toContainText('America/Cuiaba');await expect(page.locator('.nx35-hero')).toBeHidden();
  expect(await hub.locator('.nx61-home-head').evaluate(el=>el.getBoundingClientRect().top-document.querySelector('#topbar').getBoundingClientRect().bottom)).toBeGreaterThanOrEqual(20);
  await page.screenshot({path:info.outputPath('personal-home-mobile.png'),fullPage:false});
  for(const width of [320,360,375,390,393,412,430,480,768,820,1024,1280,1366,1440,1920]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),String(width)).toBeLessThanOrEqual(2);}
  await page.screenshot({path:info.outputPath('personal-home-desktop.png')});
  expect(requests.every(r=>r.method()==='GET')).toBe(true);
  await hub.getByRole('button',{name:'Atualizar',exact:true}).click();await expect(hub).toContainText('Você parou no episódio 1142');
});
test('personal home: guest does not query private data',async({page})=>{
  let calls=0;await authFixture(page,route=>{calls++;return route.fulfill({json:fixture})},{signedIn:false});await page.goto(origin);
  await expect(page.locator('.nx35-home')).toBeVisible();await expect(page.locator('.nx35-hero')).toBeVisible();await expect(page.locator('.nx61-personal-home')).toHaveCount(0);expect(calls).toBe(0);
});
test('personal home: continue opens the correct dedicated detail route',async({page})=>{
  await authFixture(page,route=>route.fulfill({json:fixture}));
  await page.route('**/api/anime/1',route=>route.fulfill({json:{id:1,mediaType:'ANIME',title:'One Piece',description:'Uma aventura em português.',status:'RELEASING',cover:'/assets/logo.png',relations:[],characters:[],staff:[],recommendations:[]}}));
  await page.goto(origin);await expect(page.locator('.nx61-continue-card').first()).toBeVisible();await page.locator('.nx61-continue-card').first().click();
  await expect(page).toHaveURL(/\/anime\/one-piece-1$/);await expect(page.locator('.nx22-detail h1')).toHaveText('One Piece');
});
test('personal home: failure is recoverable and empty account is honest',async({page},info)=>{
  let fail=true;await authFixture(page,route=>route.fulfill(fail?{status:503,json:{error:'TEMPORARILY_UNAVAILABLE'}}:{json:{...fixture,continue:[],todayItems:[],week:[],backlog:[],premieres:[],coverage:{tracked:0}}}));
  await page.goto(origin);const hub=page.locator('.nx61-personal-home');await expect(hub).toContainText('Sua central não carregou agora.');
  fail=false;await hub.getByRole('button',{name:'Tentar novamente'}).click();await expect(hub).toContainText('Marque uma obra como assistindo');await expect(hub).not.toContainText('1142');
  await page.screenshot({path:info.outputPath('personal-home-empty.png')});
});
test('personal home: late response cannot restore private data after sign out',async({page})=>{
  let release;const gate=new Promise(resolve=>release=resolve);await authFixture(page,async route=>{await gate;try{await route.fulfill({json:fixture})}catch{}});
  await page.goto(origin);await expect(page.getByText('Carregando sua central',{exact:true})).toBeVisible();
  await page.evaluate(()=>{window.__signedIn=false;dispatchEvent(new CustomEvent('aninexus:account-identity-changed',{detail:{user:null}}))});release();
  await expect(page.locator('.nx61-personal-home')).toHaveCount(0);await expect(page.locator('.nx35-hero')).toBeVisible();
  await page.evaluate(()=>dispatchEvent(new Event('visibilitychange')));await expect(page.locator('.nx61-personal-home')).toHaveCount(0);
});
