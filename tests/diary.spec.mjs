import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const origin=process.env.ANINEXUS_E2E_ORIGIN||'http://127.0.0.1:4174/';
const entry={id:'10000000-0000-4000-8000-000000000001',media_id:1,media_type:'ANIME',media_snapshot:{title:'Frieren'},entry_date:'2026-09-27',kind:'EPISODE',start_unit:1,end_unit:3,score:9.5,favorite:true,rewatch:false,completed:false,reactions:['Amei'],note:'Uma fantasia marcante.',spoiler:true};
const stats={entries:1,anime_works:1,manga_works:0,episodes:3,chapters:0,minutes:72,estimated_minutes:72,without_duration:0,average_score:'9.5',rewatches:0,completions:0,genres:[{genre:'Fantasy'}]};
async function setup(page,{theme='dark',signedIn=true,failRead=false,failWrite=false,late=false}={}){
  const state={items:[structuredClone(entry)],writes:[],failRead,failWrite,release:null};
  const gate=late?new Promise(resolve=>state.release=resolve):Promise.resolve();
  await page.addInitScript(({theme,signedIn})=>{localStorage.setItem('aninexus:theme',theme);localStorage.setItem('aninexus:privacy:v1',JSON.stringify({analytics:false}));window.__signedIn=signedIn;},{theme,signedIn});
  await page.route('**/runtime-config.js*',r=>r.fulfill({contentType:'application/javascript',body:`window.__ANINEXUS_CONFIG__={apiOrigin:'https://api.clerk.com',clerkPublishableKey:['pk','test','dGVzdC5jbGVyay5hY2NvdW50cy5kZXYk'].join('_'),authEnabled:true};`}));
  await page.route('https://test.clerk.accounts.dev/npm/@clerk/ui@1/dist/ui.browser.js',r=>r.fulfill({contentType:'application/javascript',body:'window.__internal_ClerkUICtor=function(){};'}));
  await page.route('https://test.clerk.accounts.dev/npm/@clerk/clerk-js@6/dist/clerk.browser.js',r=>r.fulfill({contentType:'application/javascript',body:'window.Clerk={get user(){return window.__signedIn?{id:"fixture"}:null},session:{getToken:async()=>"fixture-token"},load:async()=>{},addListener:()=>{}};'}));
  await page.route('https://api.clerk.com/**',async r=>{
    const req=r.request(),path=new URL(req.url()).pathname;
    if(!path.startsWith('/api/me/diary'))return r.fulfill({json:{user:signedIn?{id:'fixture',username:'leitor',displayName:'Leitor'}:null,items:[]}});
    if(req.method()!=='GET'){
      const body=req.method()==='DELETE'?null:req.postDataJSON();state.writes.push({method:req.method(),body,path});
      if(state.failWrite)return r.fulfill({status:503,json:{error:'TEMPORARILY_UNAVAILABLE'}});
      if(req.method()==='POST')state.items.push({...entry,id:'10000000-0000-4000-8000-000000000002',note:body.note,spoiler:body.spoiler,score:body.score});
      if(req.method()==='PATCH')state.items=state.items.map(item=>item.id===path.split('/').at(-1)?{...item,...body}:item);
      if(req.method()==='DELETE')state.items=state.items.filter(item=>item.id!==path.split('/').at(-1));
      return r.fulfill({json:{item:state.items.at(-1),removed:true}});
    }
    await gate;
    if(state.failRead)return r.fulfill({status:503,json:{error:'TEMPORARILY_UNAVAILABLE'}});
    if(path.endsWith('/titles'))return r.fulfill({json:{items:[{media_id:1,media_type:'ANIME',title:'Frieren'},{media_id:1,media_type:'MANGA',title:'Frieren mangá'}]}});
    if(path.endsWith('/recap'))return r.fulfill({json:{stats:{...stats,entries:state.items.length}}});
    return r.fulfill({json:{items:state.items,nextCursor:null}});
  });
  await page.setViewportSize({width:390,height:844});await page.goto(new URL('minha-biblioteca?view=diary',origin).href);return state;
}
for(const theme of ['dark','light'])test(`diary ${theme}: dates, spoilers, responsive recap and downloadable private card`,async({page},info)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));await setup(page,{theme});
  const diary=page.locator('.nx61-diary');await expect(diary.getByRole('heading',{name:'Meu diário',exact:true})).toBeVisible();await expect(diary.getByText('Frieren',{exact:true})).toBeVisible();
  await expect(diary.getByText('Uma fantasia marcante.',{exact:true})).toBeHidden();await diary.getByText('Mostrar anotação com spoiler').click();await expect(diary.getByText('Uma fantasia marcante.',{exact:true})).toBeVisible();
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:info.outputPath('diary-mobile.png')});
  expect(await diary.locator('.nx61-diary-head').evaluate(el=>el.getBoundingClientRect().top-document.querySelector('#topbar').getBoundingClientRect().bottom)).toBeGreaterThanOrEqual(20);
  for(const width of [320,360,375,390,393,412,430,480,768,820,1024,1280,1366,1440,1920]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),String(width)).toBeLessThanOrEqual(2);}
  const findings=await new AxeBuilder({page}).include('.nx61-diary').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(findings.violations).toEqual([]);
  await diary.getByRole('button',{name:'Criar card do período'}).click();const dialog=page.getByRole('dialog');await expect(dialog.getByRole('heading',{name:'Seu card está pronto'})).toBeVisible();
  await expect.poll(()=>dialog.locator('img').evaluate(img=>img.naturalWidth)).toBe(1080);await page.screenshot({path:info.outputPath('diary-card.png')});
  const downloadPromise=page.waitForEvent('download');await dialog.getByRole('link',{name:'Baixar card'}).click();const download=await downloadPromise;expect(download.suggestedFilename()).toMatch(/^aninexus-.*\.png$/);
  await page.keyboard.press('Escape');await expect(dialog).toBeHidden();expect(errors).toEqual([]);
});
test('diary: failed save preserves text and retry key, manga units, editing and deletion',async({page},info)=>{
  const state=await setup(page,{failWrite:true});await page.getByRole('button',{name:'Novo registro',exact:true}).click();const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Obra',{exact:true}).selectOption('MANGA:1');await expect(dialog.getByLabel('Tipo de registro')).toHaveValue('CHAPTER');
  const findings=await new AxeBuilder({page}).include('.nx61-diary-dialog').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(findings.violations).toEqual([]);
  await dialog.getByLabel('Anotação',{exact:true}).fill('Meu texto não pode desaparecer.');await dialog.getByLabel('Nota nesta data').fill('0');
  await dialog.getByRole('button',{name:'Salvar registro',exact:true}).click();await expect(dialog).toContainText('Seu texto continua aqui');await expect(dialog.getByLabel('Anotação',{exact:true})).toHaveValue('Meu texto não pode desaparecer.');
  await page.screenshot({path:info.outputPath('diary-form-error.png')});state.failWrite=false;await dialog.getByRole('button',{name:'Salvar registro',exact:true}).click();await expect(dialog).toHaveCount(0);expect(state.writes.length).toBe(2);expect(state.writes[0].body).toEqual(state.writes[1].body);expect(state.writes[1].body.mediaType).toBe('MANGA');expect(state.writes[1].body.score).toBe(0);
  await page.getByRole('button',{name:'Editar registro de Frieren'}).first().click();await page.getByRole('dialog').getByLabel('Nota nesta data').fill('8.2');await page.getByRole('button',{name:'Salvar alterações'}).click();await expect(page.locator('.nx61-diary-entry').first()).toContainText('Nota 8,2/10');
  await page.getByRole('button',{name:'Excluir registro de Frieren'}).first().click();await page.getByRole('button',{name:'Cancelar',exact:true}).click();expect(state.writes.filter(w=>w.method==='DELETE')).toHaveLength(0);
  await page.getByRole('button',{name:'Excluir registro de Frieren'}).first().click();await page.getByRole('dialog').getByRole('button',{name:'Excluir registro',exact:true}).click();await expect(page.locator('.nx61-diary-entry')).toHaveCount(1);expect(state.writes.every(w=>w.path.startsWith('/api/me/diary'))).toBe(true);
});
test('diary: recoverable read failure and honest empty state',async({page})=>{
  const state=await setup(page,{failRead:true});await expect(page.locator('[data-diary-feedback]')).toContainText('Seus registros foram preservados');state.failRead=false;state.items=[];await page.locator('[data-diary-feedback]').getByRole('button',{name:'Tentar novamente'}).click();await expect(page.locator('.nx61-diary-empty')).toContainText('Não presumimos as datas');await expect(page.getByRole('button',{name:'Criar card do período'})).toBeDisabled();
});
test('diary: guest and late response after logout do not reveal entries',async({page})=>{
  const state=await setup(page,{late:true});await expect(page.getByRole('heading',{name:'Meu diário',exact:true})).toBeVisible();await page.evaluate(()=>{window.__signedIn=false;dispatchEvent(new CustomEvent('aninexus:account-identity-changed',{detail:{user:null}}));});state.release();await expect(page.locator('.nx61-diary-entry')).toHaveCount(0);await expect(page.locator('.nx61-diary')).not.toContainText('Uma fantasia marcante.');
});

test('diary: repeated confirmation preserves reading and an unsaved note, while changed authority hides both',async({page})=>{
  await setup(page);await expect(page.locator('.nx61-diary-entry')).toHaveCount(1);
  await page.getByRole('button',{name:'Novo registro',exact:true}).click();
  await page.getByRole('dialog').getByLabel('Anotação',{exact:true}).fill('Rascunho privado preservado.');
  await page.evaluate(()=>dispatchEvent(new CustomEvent('aninexus:account-identity-changed',{detail:{user:{id:'fixture'},confirmed:true}})));
  await expect(page.getByRole('dialog').getByLabel('Anotação',{exact:true})).toHaveValue('Rascunho privado preservado.');
  await expect(page.locator('.nx61-diary-entry')).toHaveCount(1);
  await page.evaluate(()=>{window.__signedIn=false;dispatchEvent(new CustomEvent('aninexus:account-identity-changed',{detail:{user:null,confirmed:true}}));});
  await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.nx61-diary-entry')).toHaveCount(0);
  await expect(page.locator('.nx61-diary')).not.toContainText('Frieren');
});
test('diary: library navigation and browser history preserve the dedicated screen',async({page})=>{
  await setup(page);await page.getByRole('link',{name:'Voltar à biblioteca',exact:true}).click();await expect(page.locator('.nx49-library')).toBeVisible();
  await page.locator('.nx49-library').getByRole('link',{name:'Meu diário',exact:true}).first().click();await expect(page.getByRole('heading',{name:'Meu diário',exact:true})).toBeVisible();
  await page.goBack();await expect(page.locator('.nx49-library')).toBeVisible();await page.goForward();await expect(page.getByRole('heading',{name:'Meu diário',exact:true})).toBeVisible();
});
