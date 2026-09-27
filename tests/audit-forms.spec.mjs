import {test,expect} from '@playwright/test';
const origin=process.env.ANINEXUS_E2E_ORIGIN||'http://127.0.0.1:4174/';
const forms=[
  {path:'/contato',form:'#nxContactForm',status:'#nxContactStatus',endpoint:'/api/contact',name:'name',fields:{name:'Pessoa de teste',email:'qa@example.invalid',message:'Mensagem isolada de teste, não enviar ao servidor real.'}},
  {path:'/dmca',form:'#nxLegalDmca',status:'#nxLegalStatus',endpoint:'/api/dmca',name:'requesterName',fields:{requesterName:'Pessoa de teste',requesterEmail:'qa@example.invalid',rightsHolder:'Titular de teste',contentUrl:'https://aninexus.com.br/anime/teste-20',description:'Solicitação fictícia usada apenas na regressão isolada do formulário.',signature:'Pessoa de teste'}},
];
test.beforeEach(async({page})=>{
  await page.route('**/api/**',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));
  await page.addInitScript(()=>localStorage.setItem('aninexus:privacy:v1','{"analytics":false}'));
});
test.afterEach(async({page})=>page.unrouteAll({behavior:'ignoreErrors'}));
async function fill(page,item){
  for(const [name,value] of Object.entries(item.fields))await page.locator(`${item.form} [name="${name}"]`).fill(value);
  if(item.path==='/contato')await page.locator('[name=category]').selectOption('Sugestão ou feedback');
  else{await page.locator('[name=goodFaith]').check();await page.locator('[name=accuracy]').check()}
}
for(const item of forms){
  test(`${item.path} rejects an empty form without submitting`,async({page})=>{
    let calls=0;await page.route(`**${item.endpoint}`,route=>{calls++;return route.fulfill({status:200,body:'{}'})});
    await page.goto(new URL(item.path,origin).href);await page.locator(`${item.form} button[type=submit]`).click();
    expect(calls).toBe(0);await expect(page.locator(`${item.form} :invalid`).first()).toBeFocused();
    for(const control of await page.locator(`${item.form} input:not([type=hidden]),${item.form} textarea,${item.form} select`).all()){
      if(await control.isVisible())expect(await control.evaluate(el=>el.labels?.length||0)).toBeGreaterThan(0);
    }
  });
  for(const failure of ['500','429','offline','timeout'])test(`${item.path} ${failure} preserves data and recovers`,async({page})=>{
    test.setTimeout(45000);let healthy=false,calls=0;
    await page.route(`**${item.endpoint}`,async route=>{
      calls++;
      if(healthy)return route.fulfill({status:201,contentType:'application/json',body:'{"ok":true}'});
      if(failure==='offline')return route.abort('internetdisconnected');
      if(failure==='timeout'){await new Promise(r=>setTimeout(r,16000));return route.fulfill({status:504,body:'{}'}).catch(()=>{})}
      return route.fulfill({status:Number(failure),body:'{"error":"INTERNAL_DIAGNOSTIC"}'});
    });
    await page.goto(new URL(item.path,origin).href);await fill(page,item);
    const button=page.locator(`${item.form} button[type=submit]`);await button.click();
    await expect(page.locator(item.status)).toContainText(failure==='429'?'Muitas tentativas':'Não foi possível confirmar',{timeout:15000});
    await expect(button).toBeEnabled();await expect(page.locator(`${item.form} [name="${item.name}"]`)).toHaveValue('Pessoa de teste');
    await expect(page.locator(item.status)).not.toContainText(/INTERNAL_DIAGNOSTIC|Failed to fetch|NetworkError|AbortError/);
    expect(calls).toBe(1);healthy=true;await button.click();
    await expect(page.locator(item.status)).toContainText(item.path==='/contato'?'Mensagem recebida':'Notificação registrada');
    await expect(page.locator(`${item.form} [name="${item.name}"]`)).toHaveValue('');expect(calls).toBe(2);
  });
  test(`${item.path} prevents duplicate submission while pending`,async({page})=>{
    let release,calls=0;const gate=new Promise(r=>{release=r});
    await page.route(`**${item.endpoint}`,async route=>{calls++;await gate;return route.fulfill({status:200,body:'{}'})});
    await page.goto(new URL(item.path,origin).href);await fill(page,item);
    await page.locator(`${item.form} button[type=submit]`).click();
    await expect(page.locator(item.form)).toHaveAttribute('aria-busy','true');
    await page.locator(item.form).evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
    expect(calls).toBe(1);release();await expect(page.locator(`${item.form} button[type=submit]`)).toBeEnabled();expect(calls).toBe(1);
  });
}
