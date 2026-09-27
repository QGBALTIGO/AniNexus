import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const origin=process.env.ANINEXUS_E2E_ORIGIN||'http://127.0.0.1:4174/';
const firstId='11111111-1111-4111-8111-111111111111';
const secondId='22222222-2222-4222-8222-222222222222';
const thirdId='33333333-3333-4333-8333-333333333333';
const base={id:firstId,mediaId:21,mediaType:'ANIME',mediaTitle:'One Piece',type:'SCORE_AT_DEADLINE',question:'One Piece terá nota média de pelo menos 88/100 no AniList na próxima leitura?',criteria:'SIM se a primeira leitura válida da nota média no AniList for maior ou igual a 88/100. Sem leitura válida, a previsão será anulada.',source:'AniList',sourceUrl:'https://anilist.co/anime/21',status:'OPEN',opensAt:'2030-09-01T12:00:00Z',closesAt:'2030-09-30T12:00:00Z',resolutionDeadline:'2030-10-01T12:00:00Z',yesCount:1,noCount:0,voteCount:1};
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
    if(call.path==='/api/me/predictions')return route.fulfill({json:{items:state.mine,nextOffset:null}});
    if(call.path.endsWith('/vote'))return route.fulfill(state.voteFailure?{status:state.voteFailure,json:{error:'PREDICTION_CLOSED'}}:{json:{item:{...base,yesCount:call.body.choice==='YES'?2:1,noCount:call.body.choice==='NO'?1:0,voteCount:2},userVote:{choice:call.body.choice,eligible:true}}});
    return route.fulfill({json:{user:signedIn?{id:'fixture',username:'leitor',displayName:'Leitor'}:null,items:[]}});
  });
  await page.goto(new URL(path,origin).href);
  if(path.startsWith('/previsoes'))await expect(page.locator('.nx61-predictions h1')).toHaveText('Previsões');
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
  await fixture(page,{path:'/previsoes?previsao='+thirdId,items:[base],handler:call=>call.path==='/api/predictions/'+thirdId?{json:{item:closed}}:null});
  const linked=page.locator(`[data-prediction="${thirdId}"]`);
  await expect(linked).toBeVisible();await expect(linked).toContainText('Anulada');
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
  const state=await fixture(page,{items:[base],handler:call=>call.path==='/api/predictions/'+thirdId?{json:{item:closed}}:null});
  await expect(page.locator(`[data-prediction="${firstId}"]`)).toBeVisible();
  await page.getByRole('button',{name:'Ranking',exact:true}).click();
  await expect(page.locator('.nx61-pred-ranking')).toBeVisible();
  await page.evaluate(id=>window.AniNexusGo('/previsoes?previsao='+id),thirdId);
  await expect(page.locator(`[data-prediction="${thirdId}"]`)).toBeVisible();
  await expect(page.getByRole('button',{name:'Em alta',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.nx61-pred-ranking')).toHaveCount(0);
  expect(state.calls.some(call=>call.path==='/api/predictions/'+thirdId)).toBe(true);
  await page.goBack();
  await expect(page).toHaveURL(new URL('/previsoes',origin).href);
  await expect(page.locator(`[data-prediction="${firstId}"]`)).toBeVisible();
  await expect(page.locator(`[data-prediction="${thirdId}"]`)).toHaveCount(0);
  await expect(page.locator('[data-prediction]')).toHaveCount(1);
});

test('predictions: native hash navigation refreshes an already mounted page',async({page})=>{
  await fixture(page,{items:[base],handler:call=>call.path==='/api/predictions/'+thirdId?{json:{item:closed}}:null});
  await expect(page.locator(`[data-prediction="${firstId}"]`)).toBeVisible();
  await page.evaluate(id=>{location.hash=id;},thirdId);
  await expect(page.locator(`[data-prediction="${thirdId}"]`)).toBeVisible();
  await page.evaluate(()=>{location.hash='';});
  await expect(page.locator(`[data-prediction="${thirdId}"]`)).toHaveCount(0);
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
