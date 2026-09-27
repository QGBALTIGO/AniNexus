import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const origin=process.env.ANINEXUS_E2E_ORIGIN||'http://127.0.0.1:4174/';
const firstId='11111111-1111-4111-8111-111111111111';
const secondId='22222222-2222-4222-8222-222222222222';
const thirdId='33333333-3333-4333-8333-333333333333';
const base={id:firstId,mediaId:21,mediaType:'ANIME',mediaTitle:'One Piece',type:'SCORE_AT_DEADLINE',question:'One Piece terá nota média de pelo menos 88/100 no AniList na próxima leitura?',criteria:'SIM se a primeira leitura válida da nota média no AniList for maior ou igual a 88/100. Sem leitura válida, a previsão será anulada.',source:'AniList',sourceUrl:'https://anilist.co/anime/21',status:'OPEN',opensAt:'2030-09-01T12:00:00Z',closesAt:'2030-09-30T12:00:00Z',resolutionDeadline:'2030-10-01T12:00:00Z',yesCount:1,noCount:0,voteCount:1,trend24h:{yesDelta:0,noDelta:0,since:'2030-09-27T12:00:00Z',completeWindow:false}};
const second={...base,id:secondId,mediaTitle:'The Beginning After the End: uma história com um título muito longo',question:'A nota média de The Beginning After the End terá alcançado o critério publicado na leitura indicada?',yesCount:15,noCount:5,voteCount:20};
const closed={...base,id:thirdId,mediaTitle:'Frieren',status:'VOID',closesAt:'2020-09-30T12:00:00Z',resolutionDeadline:'2020-10-01T12:00:00Z'};

async function fixture(page,{theme='dark',signedIn=false,items=[base,second,closed],mine=[],handler,path='/previsoes'}={}){
  const state={items,mine,calls:[],failure:0,voteFailure:0,handler};
  await page.addInitScript(({theme,signedIn})=>{
    localStorage.setItem('aninexus:theme',theme);
    localStorage.setItem('aninexus:privacy:v1',JSON.stringify({analytics:false}));
    window.__predictionSignedIn=signedIn;
    sessionStorage.setItem('nx35:public:v8',JSON.stringify({at:Date.now(),data:{season:[],schedule:[],top:[],popular:[],soon:[],reading:[],topReading:[]}}));
  },{theme,signedIn});
  await page.route('**/runtime-config.js*',route=>route.fulfill({contentType:'application/javascript',body:`window.__ANINEXUS_CONFIG__={apiOrigin:'https://api.clerk.com',clerkPublishableKey:['pk','test','dGVzdC5jbGVyay5hY2NvdW50cy5kZXYk'].join('_'),authEnabled:true};`}));
  await page.route('https://test.clerk.accounts.dev/npm/@clerk/ui@1/dist/ui.browser.js',route=>route.fulfill({contentType:'application/javascript',body:'window.__internal_ClerkUICtor=function(){};'}));
  await page.route('https://test.clerk.accounts.dev/npm/@clerk/clerk-js@6/dist/clerk.browser.js',route=>route.fulfill({contentType:'application/javascript',body:'window.Clerk={get user(){return window.__predictionSignedIn?{id:"fixture"}:null},session:{getToken:async()=>"fixture-token"},load:async()=>{},addListener:()=>{}};'}));
  await page.route('https://graphql.anilist.co/**',route=>route.fulfill({json:{data:{}}}));
  await page.route('https://api.jikan.moe/**',route=>route.fulfill({json:{data:[]}}));
  await page.route('**/api/**',async route=>{
    const request=route.request(),url=new URL(request.url()),call={path:url.pathname,query:url.searchParams,method:request.method(),body:request.postDataJSON()};
    state.calls.push(call);
    const custom=await state.handler?.(call,state);if(custom)return route.fulfill(custom);
    if(call.path==='/api/predictions/ranking')return route.fulfill({json:{items:[{rank:1,username:'leitor',displayName:'Leitor',correct:80,total:100,accuracy:80,confidence:.71}],minimumResolved:20}});
    if(call.path==='/api/predictions')return route.fulfill(state.failure?{status:state.failure,json:{error:'UNAVAILABLE'}}:{json:{items:state.items,nextOffset:null}});
    if(call.path.match(/^\/api\/predictions\/[\da-f-]+\/detail$/)){const id=call.path.split('/')[3],item=state.items.find(i=>i.id===id)||closed;return route.fulfill({json:{item,collective:{votes:item.voteCount,weightedYesPercent:item.voteCount?Math.round(item.yesCount/item.voteCount*100):null,conviction:item.voteCount?50:null},history:[{at:'2030-09-01T12:00:00Z',yesCount:0,noCount:0},{at:'2030-09-20T12:00:00Z',yesCount:item.yesCount,noCount:item.noCount}],arguments:[],related:state.items.filter(i=>i.id!==id)}});}
    if(call.path.match(/^\/api\/me\/predictions\/[\da-f-]+\/detail$/))return route.fulfill({json:{userVote:state.mine.find(i=>i.id===call.path.split('/')[4])?.userVote||null,following:false,argument:null}});
    if(call.path==='/api/me/predictions')return route.fulfill({json:{items:state.mine,nextOffset:null}});
    if(call.path.endsWith('/vote'))return route.fulfill(state.voteFailure?{status:state.voteFailure,json:{error:'PREDICTION_CLOSED'}}:{json:{item:{...base,yesCount:call.body.choice==='YES'?2:1,noCount:call.body.choice==='NO'?1:0,voteCount:2},userVote:{choice:call.body.choice,eligible:true}}});
    return route.fulfill({json:{user:signedIn?{id:'fixture',username:'leitor',displayName:'Leitor'}:null,items:[]}});
  });
  await page.goto(new URL(path,origin).href);
  if(path==='/previsoes')await expect(page.locator('.nx61-predictions h1')).toHaveText('Previsões');
  return state;
}

for(const theme of ['dark','light'])test(`predictions ${theme}: consistent cards, honest consensus, criteria and responsive route`,async({page},info)=>{
  await fixture(page,{theme});
  await expect(page).toHaveTitle('Previsões | AniNexus');
  const first=page.locator(`[data-prediction="${firstId}"]`),popular=page.locator(`[data-prediction="${secondId}"]`);
  await expect(first).toContainText('1 Sim · 0 Não');await expect(first).not.toContainText('100%');
  await expect(popular).toContainText('75%');await expect(popular).toContainText('25%');
  await first.getByText('Critérios e fontes',{exact:true}).click();
  await expect(first.locator('details')).toContainText('30/09/2030, 09:00 (Brasília)');
  await expect(first.locator('details')).toContainText('01/10/2030, 09:00 (Brasília)');
  await expect(first.getByRole('link',{name:/Fonte: AniList/})).toHaveAttribute('rel','noopener noreferrer');
  const voided=page.locator(`[data-prediction="${thirdId}"]`);
  await expect(voided.getByRole('button',{name:'Sim',exact:true})).toBeDisabled();
  for(const width of [320,390,768,1440]){
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),`${width}: no page overflow`).toBeLessThanOrEqual(2);
    if(width===390||width===1440)await page.screenshot({path:info.outputPath(`predictions-${theme}-${width}.png`)});
  }
  const accessibility=await new AxeBuilder({page}).include('.nx61-predictions').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(accessibility.violations).toEqual([]);
  await page.evaluate(()=>window.AniNexusGo('/'));
  await expect(page.locator('.nx35-home')).toBeVisible();await expect(page.locator('.nx61-predictions')).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveClass(/nx61-predictions-active/);
  await expect(page.locator('.nx35-hero')).toBeVisible();await expect(page.locator('.nx61-scroll-track')).toHaveCount(0);
});

test('predictions guest: login prompt never submits a vote or queries private predictions',async({page})=>{
  const state=await fixture(page);const first=page.locator(`[data-prediction="${firstId}"]`);
  await first.getByRole('button',{name:'Sim',exact:true}).click();
  await expect(first.getByRole('link',{name:'Entre na sua conta para registrar seu palpite.'})).toHaveAttribute('href','/login');
  await page.getByRole('button',{name:'Meus palpites',exact:true}).click();
  await expect(page.locator('[data-pred-body]')).toContainText('Entre para acompanhar suas previsões e resultados.');
  expect(state.calls.filter(c=>c.path==='/api/me/predictions'||c.method==='PUT')).toEqual([]);
});

test('predictions voting: changing a vote is singular even while identity lookup is pending',async({page})=>{
  let release;const gate=new Promise(resolve=>release=resolve);
  const state=await fixture(page,{signedIn:true,mine:[{...base,userVote:{choice:'YES'}}],handler:async call=>call.path.endsWith('/vote')?(await gate,{json:{item:{...base,yesCount:1,noCount:1,voteCount:2},userVote:{choice:'NO',eligible:true}}}):null});
  const first=page.locator(`[data-prediction="${firstId}"]`);
  await expect(first.getByRole('button',{name:'Sim',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.evaluate(()=>{const original=window.AniNexusAuth;window.__predictionIdentityResolves=[];window.AniNexusAuth={...original,getUser:()=>new Promise(resolve=>{window.__predictionIdentityResolves.push(()=>resolve({id:'fixture'}));})};});
  await first.getByRole('button',{name:'Não',exact:true}).evaluate(button=>{button.click();button.click();});
  await page.evaluate(()=>window.__predictionIdentityResolves.forEach(resolve=>resolve()));
  await expect.poll(()=>state.calls.filter(c=>c.method==='PUT').length).toBe(1);
  await expect(first.getByRole('button',{name:'Não',exact:true})).toBeDisabled();
  release();await expect(first.getByRole('button',{name:'Não',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(first).toContainText('Seu palpite: Não.');
  expect(state.calls.filter(c=>c.method==='PUT').map(c=>c.body)).toEqual([{choice:'NO'}]);
});

test('predictions voting: failed writes preserve the last choice and closed voting disables changes',async({page})=>{
  const state=await fixture(page,{signedIn:true,mine:[{...base,userVote:{choice:'YES'}}]});
  const first=page.locator(`[data-prediction="${firstId}"]`);
  await expect(first.getByRole('button',{name:'Sim',exact:true})).toHaveAttribute('aria-pressed','true');
  state.voteFailure=500;await first.getByRole('button',{name:'Não',exact:true}).click();
  await expect(first).toContainText('Não foi possível salvar.');
  await expect(first.getByRole('button',{name:'Sim',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(first.getByRole('button',{name:'Não',exact:true})).toBeEnabled();
  state.voteFailure=409;await first.getByRole('button',{name:'Não',exact:true}).click();
  await expect(first).toContainText('Os palpites já foram encerrados.');
  await expect(first.getByRole('button',{name:'Sim',exact:true})).toBeDisabled();
  await expect(first.getByRole('button',{name:'Não',exact:true})).toBeDisabled();
});

test('predictions: empty/error/retry and disabled feature are distinct states',async({page})=>{
  const state=await fixture(page,{items:[]});await expect(page.locator('[data-pred-body]')).toContainText('Nenhuma previsão por aqui ainda');
  state.failure=503;await page.getByRole('button',{name:'Novas',exact:true}).click();
  await expect(page.locator('[data-pred-body]')).toContainText('Não foi possível carregar agora');
  state.failure=0;state.items=[base];await page.getByRole('button',{name:'Tentar novamente'}).click();
  await expect(page.locator(`[data-prediction="${firstId}"]`)).toBeVisible();
  state.failure=404;await page.getByRole('button',{name:'Em alta',exact:true}).click();
  await expect(page.locator('[data-pred-body]')).toContainText('Previsões em preparação');
});

test('predictions: evidence audit envelope and ranking percentage use the backend contract',async({page})=>{
  await fixture(page,{items:[{...base,status:'RESOLVED',result:'YES',evidence:{source:'AniList',sourceUrl:base.sourceUrl,observation:{source:'AniList',observedAt:'2030-10-01T12:03:00Z',data:{averageScore:89}}}}]});
  await page.getByText('Critérios e fontes',{exact:true}).click();
  await expect(page.locator('.nx61-pred-card details')).toContainText('Resultado: Sim');
  await expect(page.locator('.nx61-pred-card details')).toContainText('01/10/2030, 09:03 (Brasília)');
  await expect(page.locator('.nx61-pred-card details')).toContainText('89/100');
  await page.getByRole('button',{name:'Ranking',exact:true}).click();
  await expect(page.locator('.nx61-pred-ranking')).toContainText('80 acertos / 100 · 80%');
  await expect(page.locator('.nx61-pred-ranking')).not.toContainText('8000%');
});

test('predictions: personal pagination loads the next page instead of repeating the first',async({page})=>{
  const first={...base,userVote:{choice:'YES'}},next={...second,userVote:{choice:'NO'}};
  const state=await fixture(page,{signedIn:true,handler:call=>call.path==='/api/me/predictions'?{json:{items:call.query.get('offset')==='30'?[next]:[first],nextOffset:call.query.get('offset')==='30'?null:30}}:null});
  await page.getByRole('button',{name:'Meus palpites',exact:true}).click();
  await expect(page.locator('[data-prediction]')).toHaveCount(1);
  await page.getByRole('button',{name:'Carregar mais',exact:true}).click();
  await expect(page.locator('[data-prediction]')).toHaveCount(2);
  await expect(page.getByRole('button',{name:'Carregar mais',exact:true})).toBeHidden();
  expect(state.calls.some(c=>c.path==='/api/me/predictions'&&c.query.get('offset')==='30')).toBe(true);
});

test('predictions: notification deep link opens a resolved item outside the first page',async({page})=>{
  await fixture(page,{path:'/previsoes?previsao='+thirdId,items:[base]});
  await expect(page.locator('.nx62-detail h1')).toContainText(closed.question);
  await expect(page.locator('.nx62-result')).toContainText('anulada');
});

for(const theme of ['dark','light'])test(`prediction detail ${theme}: complete responsive page, real chart ranges and accessible controls`,async({page},info)=>{
  const now=Date.now(),history=[0,3,6].map((days,index)=>({at:new Date(now-(6-days)*86400000).toISOString(),yesCount:index+1,noCount:index}));
  await fixture(page,{theme,path:'/previsoes?previsao='+firstId,handler:call=>call.path==='/api/predictions/'+firstId+'/detail'?{json:{item:{...base,yesCount:3,noCount:2,voteCount:5},collective:{votes:5,estimatedYesPercent:54,weightedYesPercent:60,conviction:70},history,arguments:[{id:'a',text:'Acompanharei a fonte e compararei a nota no prazo.',choice:'YES',createdAt:new Date(now).toISOString(),author:{username:'leitor',displayName:'Leitor'}}],related:[second]}}:null});
  await expect(page.locator('.nx62-detail h1')).toContainText('One Piece');
  await expect(page.locator('.nx62-intelligence')).toContainText('54% Sim');
  await expect(page.locator('.nx62-intelligence')).toContainText('60% Sim');
  await expect(page.locator('.nx62-chart-panel svg')).toBeVisible();
  await expect(page.locator('.nx62-argument')).toContainText('Acompanharei a fonte');
  await expect(page.locator('.nx62-disclaimer')).toContainText('Não há depósitos, saques, prêmios');
  const allPath=await page.locator('.nx62-chart-line.yes').getAttribute('d');
  await page.getByRole('button',{name:'1D',exact:true}).click();
  await expect(page.locator('.nx62-chart-panel svg')).toBeVisible();
  expect(await page.locator('.nx62-chart-line.yes').getAttribute('d')).not.toBe(allPath);
  await page.getByRole('button',{name:'Tudo',exact:true}).click();
  await expect(page.locator('.nx62-chart-panel svg')).toBeVisible();
  for(const width of [320,390,768,1160]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),`${width} overflow`).toBeLessThanOrEqual(2);if(width===390||width===1160)await page.screenshot({path:info.outputPath(`prediction-detail-${theme}-${width}.png`),fullPage:true});}
  const a11y=await new AxeBuilder({page}).include('.nx62-detail').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(a11y.violations).toEqual([]);
});

test('prediction detail: Prever opens the vote section and saves choice with confidence',async({page})=>{
  const state=await fixture(page,{signedIn:true,path:'/previsoes?previsao='+firstId+'&foco=prever'});
  await expect(page.locator('#nx62-prever')).toBeVisible();
  await expect.poll(()=>page.locator('#nx62-prever').evaluate(el=>Math.round(el.getBoundingClientRect().top))).toBeGreaterThanOrEqual(0);
  await page.locator('[data-pred-choice="YES"]').click();
  await page.locator('[data-pred-confidence="75"]').click();
  await page.getByRole('button',{name:'Confirmar previsão'}).click();
  await expect.poll(()=>state.calls.filter(call=>call.path==='/api/me/predictions/'+firstId+'/vote').length).toBe(1);
  expect(state.calls.find(call=>call.path==='/api/me/predictions/'+firstId+'/vote').body).toEqual({choice:'YES',confidence:75});
});

test('predictions: rounded consensus sums to 100 and identity errors leave a retryable vote',async({page})=>{
  const state=await fixture(page,{signedIn:true,items:[{...base,yesCount:15,noCount:25,voteCount:40}]});
  const first=page.locator(`[data-prediction="${firstId}"]`);
  await expect(first.locator('.nx61-pred-consensus')).toContainText('38%');
  await expect(first.locator('.nx61-pred-consensus')).toContainText('62%');
  await page.evaluate(()=>{const original=window.AniNexusAuth;window.AniNexusAuth={...original,getUser:async()=>{throw Error('Temporary identity failure')}};});
  await first.getByRole('button',{name:'Sim',exact:true}).click();
  await expect(first).toContainText('Não foi possível salvar.');
  await expect(first.getByRole('button',{name:'Sim',exact:true})).toBeEnabled();
  expect(state.calls.filter(c=>c.method==='PUT')).toEqual([]);
});

test('predictions: a stale guest identity result cannot replace a newer selected filter',async({page})=>{
  await fixture(page);
  await expect(page.locator(`[data-prediction="${firstId}"]`)).toBeVisible();
  await page.evaluate(()=>{const original=window.AniNexusAuth;let calls=0;window.AniNexusAuth={...original,getUser:()=>++calls===1?new Promise(resolve=>{window.__predictionIdentityResolve=()=>resolve(null);}):Promise.resolve(null)};});
  await page.getByRole('button',{name:'Meus palpites',exact:true}).click();
  await expect(page.locator('[data-pred-body]')).toContainText('Carregando previsões');
  await page.getByRole('button',{name:'Novas',exact:true}).click();
  await expect(page.locator(`[data-prediction="${firstId}"]`)).toBeVisible();
  await page.evaluate(()=>window.__predictionIdentityResolve());
  await expect(page.locator(`[data-prediction="${firstId}"]`)).toBeVisible();
  await expect(page.getByRole('button',{name:'Novas',exact:true})).toHaveAttribute('aria-pressed','true');
});

test('predictions embeds: late detail data cannot enter another tab and the general tab restores it once',async({page})=>{
  let release,firstCall=true;const gate=new Promise(resolve=>release=resolve);
  await fixture(page,{path:'/anime/one-piece-21',handler:async call=>{
    if(call.path==='/api/anime/21')return{json:{id:21,mediaType:'ANIME',type:'ANIME',title:'One Piece',description:'Uma aventura em português.',status:'RELEASING',cover:'/assets/logo.png',genres:['Adventure'],relations:[],characters:[],staff:[],recommendations:[]}};
    if(call.path==='/api/predictions'&&call.query.get('mediaId')==='21'){
      if(firstCall){firstCall=false;await gate;}
      return{json:{items:[base],nextOffset:null}};
    }
    return null;
  }});
  await expect(page.locator('.nx22-detail h1')).toHaveText('One Piece');
  await expect.poll(()=>firstCall).toBe(false);
  await page.locator('[data-nx22-tab="recomendacoes"]').click();
  const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/predictions');release();await response;
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await expect(page.locator('#nx22Panel .nx61-pred-embed')).toHaveCount(0);
  await page.locator('[data-nx22-tab="geral"]').click();
  await expect(page.locator('#nx22Panel .nx61-pred-embed')).toHaveCount(1);
  await expect(page.locator('#nx22Panel .nx61-pred-embed')).toContainText('Previsões sobre esta obra');
  await page.locator('[data-nx22-tab="recomendacoes"]').click();
  await expect(page.locator('#nx22Panel .nx61-pred-embed')).toHaveCount(0);
  await page.locator('[data-nx22-tab="geral"]').click();
  await expect(page.locator('#nx22Panel .nx61-pred-embed')).toHaveCount(1);
});

test('predictions embeds: community stays below its opening and empty home creates no blank shelf',async({page})=>{
  const state=await fixture(page,{path:'/comunidade'});
  await expect(page.locator('.nx40-community h1')).toHaveText('Comunidade');
  await expect(page.locator('.nx40-community .nx40-main > .nx61-pred-embed')).toHaveCount(1);
  await expect(page.locator('.nx40-community .nx40-hero .nx61-pred-embed')).toHaveCount(0);
  state.items=[];await page.evaluate(()=>window.AniNexusGo('/'));
  await expect(page.locator('.nx35-home')).toBeVisible();
  await expect(page.locator('.nx35-home .nx61-pred-embed')).toHaveCount(0);
  await expect(page.locator('.nx35-home .nx61-pred-home')).toHaveCount(0);
});

test('predictions Home appears on first visit below impressions, recovers a transient request, and scrolls as a carousel',async({page})=>{
  let requests=0;
  await fixture(page,{path:'/',handler:call=>call.path==='/api/predictions'?(++requests===1?{status:503,json:{error:'TEMPORARY'}}:{json:{items:[base,second,closed],nextOffset:null}}):null});
  const home=page.locator('.nx35-home'),section=home.locator('.nx61-pred-home');
  await expect(section.locator('.nx61-pred-home-card')).toHaveCount(3,{timeout:15000});
  expect(requests).toBeGreaterThanOrEqual(2);
  expect(await section.evaluate(el=>el.previousElementSibling?.id)).toBe('nx38HomeImpressions');
  await expect(home.locator('#nx35Community .nx61-pred-embed')).toHaveCount(0);
  await page.setViewportSize({width:390,height:844});
  const rail=section.locator('.nx61-pred-home-rail');
  await expect(rail).toHaveAttribute('aria-roledescription','carrossel');
  await expect.poll(()=>rail.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeGreaterThan(20);
  await rail.evaluate(el=>{el.scrollLeft=0;});
  await expect.poll(()=>rail.evaluate(el=>el.scrollLeft)).toBe(0);
  await expect(section.getByRole('button',{name:/Próximos itens de Previsões/})).toBeEnabled();
  const before=await rail.evaluate(el=>el.scrollLeft);
  await section.getByRole('button',{name:/Próximos itens de Previsões/}).click();
  await expect.poll(()=>rail.evaluate(el=>el.scrollLeft)).toBeGreaterThan(before);
  await expect(section.locator('.nx61-pred-home-card').first()).toContainText('Consenso geral');
  await expect(section.locator('.nx61-pred-home-card').first()).toContainText('Tendência 24h');
  await expect(section.locator('.nx61-pred-home-card').first()).toContainText('Votos');
  await expect(section.locator('.nx61-pred-home-card').first()).toContainText('Prazo');
  await expect(section.locator('.nx61-pred-home-card').first()).toContainText('100% Sim · 0% Não');
  await expect(section.locator('.nx61-pred-home-card').first()).toContainText('Votos1');
  await expect(section.locator('.nx61-pred-home-card').first()).toContainText('Sim +0');
  await expect(section.locator('.nx61-pred-home-card').first().locator('.nx61-pred-home-bar .yes')).toHaveAttribute('style','width:100%');
  await expect(section.locator('.nx61-pred-home-card').nth(1).locator('.nx61-pred-home-bar .yes')).toHaveAttribute('style','width:75%');
  await expect(section.locator('.nx61-pred-home-card').nth(1).locator('.nx61-pred-home-bar .no')).toHaveAttribute('style','width:25%');
  await expect(section.getByRole('link',{name:'Prever'}).first()).toHaveAttribute('href',new RegExp('/previsoes\\?previsao='+firstId));
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
});

test('predictions Home does not invent a trend before the first vote',async({page})=>{
  await fixture(page,{path:'/',items:[{...base,yesCount:0,noCount:0,voteCount:0,trend24h:{yesDelta:0,noDelta:0,since:'2030-09-27T12:00:00Z',completeWindow:false}}]});
  const card=page.locator('.nx61-pred-home-card').first();await expect(card).toBeVisible();
  await expect(card.locator('.nx61-pred-home-meta')).toContainText('Tendência 24h—');
  await expect(card.locator('.nx61-pred-home-meta')).toContainText('Votos0');
  await expect(card.locator('.nx61-pred-home-bar .yes')).toHaveAttribute('style','width:0%');
});

test('predictions: expired open cards are closed and date evidence is not presented as a score',async({page})=>{
  const expired={...base,closesAt:'2020-09-30T12:00:00Z'};
  const dateEvidence={...second,status:'RESOLVED',type:'CATALOG_DATE_OBSERVED',result:'YES',evidence:{observation:{observedAt:'2030-10-01T12:03:00Z',data:{startDate:{year:2031,month:1,day:8}}}}};
  await fixture(page,{items:[expired,dateEvidence]});
  const first=page.locator(`[data-prediction="${firstId}"]`),dated=page.locator(`[data-prediction="${secondId}"]`);
  await expect(first.locator('header small')).toHaveText('Palpites encerrados');
  await expect(first.getByRole('button',{name:'Sim',exact:true})).toBeDisabled();
  await dated.getByText('Critérios e fontes',{exact:true}).click();
  await expect(dated.locator('details')).toContainText('Data no catálogo: 08/01/2031.');
  await expect(dated.locator('details')).not.toContainText('Nota na fonte');
});

test('predictions: identity outage does not hide public cards and cannot record a vote',async({page})=>{
  const state=await fixture(page,{signedIn:true,items:[base]});
  const first=page.locator(`[data-prediction="${firstId}"]`);
  await expect(first).toBeVisible();
  const privateReads=state.calls.filter(call=>call.path==='/api/me/predictions').length;
  await page.evaluate(()=>{const original=window.AniNexusAuth;window.AniNexusAuth={...original,getUser:async()=>{throw Error('Identity provider temporarily unavailable')}};});
  await page.getByRole('button',{name:'Novas',exact:true}).click();
  await expect(first).toBeVisible();
  await expect(page.locator('[data-pred-body]')).not.toContainText('Não foi possível carregar agora');
  expect(state.calls.filter(call=>call.path==='/api/me/predictions')).toHaveLength(privateReads);
  await first.getByRole('button',{name:'Sim',exact:true}).click();
  await expect(first).toContainText('Não foi possível salvar.');
  await expect(first.getByRole('button',{name:'Sim',exact:true})).toBeEnabled();
  expect(state.calls.filter(call=>call.method==='PUT')).toEqual([]);
});

test('predictions: same-route notification navigation refreshes its target and back removes it',async({page})=>{
  const state=await fixture(page,{items:[base]});
  await expect(page.locator(`[data-prediction="${firstId}"]`)).toBeVisible();
  await page.getByRole('button',{name:'Ranking',exact:true}).click();
  await expect(page.locator('.nx61-pred-ranking')).toBeVisible();
  await page.evaluate(id=>window.AniNexusGo('/previsoes?previsao='+id),thirdId);
  await expect(page.locator('.nx62-detail h1')).toBeVisible();
  await expect(page.locator('.nx62-result')).toContainText('anulada');
  await expect(page.locator('.nx61-pred-ranking')).toHaveCount(0);
  expect(state.calls.some(call=>call.path==='/api/predictions/'+thirdId+'/detail')).toBe(true);
  await page.goBack();
  await expect(page).toHaveURL(new URL('/previsoes',origin).href);
  await expect(page.locator(`[data-prediction="${firstId}"]`)).toBeVisible();
  await expect(page.locator(`[data-prediction="${thirdId}"]`)).toHaveCount(0);
  await expect(page.locator('[data-prediction]')).toHaveCount(1);
});

test('predictions: native hash navigation refreshes an already mounted page',async({page})=>{
  await fixture(page,{items:[base]});
  await expect(page.locator(`[data-prediction="${firstId}"]`)).toBeVisible();
  await page.evaluate(id=>{location.hash=id;},thirdId);
  await expect(page.locator('.nx62-detail h1')).toBeVisible();
  await expect(page.locator('.nx62-result')).toContainText('anulada');
  await page.evaluate(()=>{location.hash='';});
  await expect(page.locator('.nx62-detail')).toHaveCount(0);
  await expect(page.locator(`[data-prediction="${firstId}"]`)).toBeVisible();
});

test('predictions: ineligible votes explain why reputation is unchanged',async({page})=>{
  const resolved={...base,status:'RESOLVED',result:'YES'};
  await fixture(page,{signedIn:true,items:[resolved],mine:[{...resolved,userVote:{choice:'YES',eligible:false}}]});
  const first=page.locator(`[data-prediction="${firstId}"]`);
  await expect(first.locator('.nx61-pred-feedback')).toContainText('Seu palpite: Sim.');
  await expect(first.locator('.nx61-pred-feedback')).toContainText('Este palpite ficou fora da janela válida e não altera sua reputação.');
  await expect(first.getByRole('button',{name:'Sim',exact:true})).toBeDisabled();
});

test('predictions presentation: score questions use the immutable structured rule and a precise local date',async({page})=>{
  const longTitle='Honzuki no Gekokujou: Ryoushu no Youjo — uma temporada com nome muito longo';
  const item={...base,mediaTitle:longTitle,rule:{threshold:78,windowSeconds:3600},resolutionDeadline:'2030-10-05T18:00:00Z',question:longTitle+' terá nota média de pelo menos 78/100 no AniList na leitura de 2030-10-05 18:00:00 UTC?'};
  const original=JSON.stringify(item),state=await fixture(page,{items:[item,{...second,rule:{threshold:0},resolutionDeadline:'2030-10-05T01:30:00Z'}]});
  const first=page.locator(`[data-prediction="${firstId}"]`);
  await expect(first.locator('header>span')).toHaveText(longTitle);
  await expect(first.locator('h3')).toHaveText('Terá nota média de pelo menos 78/100 no AniList na consulta de 05/10/2030, às 15h (Brasília)?');
  await expect(first.locator('h3')).not.toContainText(longTitle);
  await expect(page.locator(`[data-prediction="${secondId}"] h3`)).toHaveText('Terá nota média de pelo menos 0/100 no AniList na consulta de 04/10/2030, às 22h30 (Brasília)?');
  await first.getByText('Critérios e fontes',{exact:true}).click();
  await expect(first.locator('details>p').first()).toHaveText(item.criteria);
  expect(JSON.stringify(state.items[0])).toBe(original);
});

test('predictions presentation: unsupported or malformed rules retain the registered question',async({page})=>{
  const variants=[{type:'CATALOG_DATE_OBSERVED'},{rule:null},{rule:{threshold:null}},{rule:{threshold:'78'}},{rule:{threshold:100.5}},{rule:{threshold:-1}},{rule:{threshold:101}},{resolutionDeadline:null},{resolutionDeadline:''},{resolutionDeadline:'not-a-date'},{resolutionDeadline:'2030-02-30T18:00:00Z'},{resolutionDeadline:'2030-10-05T24:00:00Z'}];
  const items=variants.map((v,index)=>({...base,rule:{threshold:78},id:`fallback-${index}`,question:`Pergunta registrada ${index}`, ...v}));
  await fixture(page,{items});
  for(const item of items)await expect(page.locator(`[data-prediction="${item.id}"] h3`)).toHaveText(item.question);
});

test('predictions presentation: compact cards align their links without stretching expanded full cards',async({page},info)=>{
  const items=[{...base,rule:{threshold:78}},{...second,rule:{threshold:85}},{...closed,status:'OPEN',closesAt:base.closesAt,rule:{threshold:91}}];
  await fixture(page,{items});
  await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>document.fonts.ready);
  const cards=page.locator('.nx61-predictions [data-prediction]');
  const before=await cards.nth(1).boundingBox();
  await cards.first().getByText('Critérios e fontes',{exact:true}).click();
  const after=await cards.nth(1).boundingBox();expect(after.height).toBeCloseTo(before.height,0);
  expect((await cards.first().boundingBox()).height).toBeGreaterThan(after.height);
  await page.evaluate(()=>window.AniNexusGo('/'));
  const embed=page.locator('.nx35-home .nx61-pred-home');await expect(embed).toHaveCount(1);
  for(const theme of ['dark','light'])for(const width of [320,390,768,1440]){
    await page.setViewportSize({width,height:900});await page.evaluate(theme=>{localStorage.setItem('aninexus:theme',theme);document.documentElement.dataset.theme=theme;},theme);
    await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
    await page.evaluate(async()=>{await document.fonts.ready;await document.fonts.load('800 16px Manrope');});
    await embed.evaluate(el=>scrollTo({top:scrollY+el.getBoundingClientRect().top-100,behavior:'instant'}));
    const positions=await embed.locator('[data-prediction]').evaluateAll(nodes=>nodes.map(el=>({height:el.getBoundingClientRect().height,top:el.getBoundingClientRect().top,link:el.querySelector('.nx61-pred-home-buttons').getBoundingClientRect().top})));
    for(const item of positions.filter(p=>Math.abs(p.top-positions[0].top)<1)){
      expect(item.height).toBeCloseTo(positions[0].height,0);expect(item.link).toBeCloseTo(positions[0].link,0);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
    if(width===390||width===1440)await page.screenshot({path:info.outputPath(`compact-refined-${theme}-${width}.png`),animations:'disabled'});
  }
});
