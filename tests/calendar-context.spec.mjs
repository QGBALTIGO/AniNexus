import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const code=fs.readFileSync(new URL('../preview-v18/schedule.js',import.meta.url),'utf8');
test.use({timezoneId:'America/Cuiaba'});
async function fixture(page,{empty=false,signed=false,stale=false}={}){
  const calls=[],state={fail:false};
  const items=[false,true].map((adult,index)=>({airingAt:1791291600+index*3600,episode:2,media:{id:101+index,title:{romaji:adult?'Obra adulta fixture':'Obra pública fixture'},isAdult:adult,genres:[],format:'TV',externalLinks:[]}}));
  await page.clock.install({time:new Date('2026-10-06T12:00:00Z')});
  await page.route('**/*',async r=>{
    const request=r.request(),url=new URL(request.url());
    if(request.isNavigationRequest())return r.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><meta charset="utf-8"><div id="app"></div>'});
    if(url.pathname==='/api/schedule'){calls.push(url);return r.fulfill({status:state.fail?503:200,json:state.fail?{error:'UNAVAILABLE'}:empty?[]:items});}
    if(url.hostname==='graphql.anilist.co'){calls.push(url);return r.fulfill({status:503,json:{error:'UNAVAILABLE'}});}
    return r.abort();
  });
  await page.goto('https://fixture.test/animes/programacao');
  await page.evaluate(({signed,stale,items})=>{
    window.AniNexusRuntime={jsonRequest:async(url,options)=>{const response=await fetch(url,options);return {response,body:await response.json()}}};
    window.AniNexusAuth={enabled:true,getUser:async()=>signed?{id:'provider-fixture'}:null,api:async()=>({user:signed?{id:'owner-fixture'}:null})};
    localStorage.setItem('aninexus:mediaOwner',JSON.stringify('owner-fixture'));
    localStorage.setItem('aninexus:mediaState:v2',JSON.stringify({101:{status:'CURRENT',progress:1}}));
    if(stale)localStorage.setItem('nx:v18:schedule:v2:America/Cuiaba:2026-10-06',JSON.stringify({savedAt:Date.now()-300000,items}));
  },{signed,stale,items});
  if(stale)state.fail=true;
  await page.addScriptTag({content:code});return {calls,state};
}
test('calendar uses local midnight and keeps the public filter without an adult-content control',async({page})=>{
  const {calls}=await fixture(page);await expect(page.locator('#nx18Root')).toContainText('Obra pública fixture');await expect(page.locator('#nx18Root')).not.toContainText('Obra adulta fixture');
  await expect(page.locator('#nx18Hero')).toContainText('America/Cuiaba');
  expect(Number(calls[0].searchParams.get('start'))).toBe(Date.parse('2026-10-06T04:00:00Z')/1000);
  expect(Number(calls[0].searchParams.get('end'))).toBe(Date.parse('2026-10-13T04:00:00Z')/1000);
  await expect(page.getByLabel('Mostrar conteúdo adulto')).toHaveCount(0);
});
test('empty successful schedule stays empty without querying a second provider',async({page})=>{
  const {calls}=await fixture(page,{empty:true});await expect(page.locator('#nx18Root')).toContainText('Nenhum episódio');expect(calls).toHaveLength(1);
});
test('personal calendar requires login and confirmed ownership',async({page})=>{
  await fixture(page);await page.getByRole('button',{name:'Meus animes',exact:true}).first().click();await expect(page.locator('#nx18PersonalFeedback')).toContainText('Entre para filtrar');await expect(page.locator('#nx18PersonalFeedback').getByRole('link',{name:'Entrar'})).toHaveAttribute('href','/login');
});
test('personal filter survives the same owner and resets when identity becomes uncertain',async({page})=>{
  await fixture(page,{signed:true});
  await page.getByRole('button',{name:'Meus animes',exact:true}).first().click();await expect(page.getByRole('button',{name:'Meus animes',exact:true}).first()).toHaveClass(/active/);
  await expect(page.locator('#nx18Root')).not.toContainText('Obra adulta fixture');
  await page.evaluate(()=>dispatchEvent(new CustomEvent('aninexus:account-identity-changed',{detail:{confirmed:true,user:{id:'owner-fixture'}}})));
  await expect(page.getByRole('button',{name:'Meus animes',exact:true}).first()).toHaveClass(/active/);
  await page.evaluate(()=>document.dispatchEvent(new CustomEvent('aninexus:media-sync-read-identity',{detail:{suspended:true}})));
  await expect(page.getByRole('button',{name:'Meus animes',exact:true}).first()).not.toHaveClass(/active/);
});
test('stale schedule clearly reports a failed refresh and retries without reloading',async({page})=>{
  const {state}=await fixture(page,{stale:true});await expect(page.locator('#nx18Root')).toContainText('Exibindo a programação salva anteriormente');await expect(page.locator('#nx18Root')).toContainText('Obra pública fixture');
  state.fail=false;await page.locator('#nx18Root').getByRole('button',{name:'Tentar novamente'}).click();await expect(page.locator('#nx18Root')).not.toContainText('Exibindo a programação salva anteriormente');await expect(page.locator('#nx18Root')).toContainText('Obra pública fixture');
});
