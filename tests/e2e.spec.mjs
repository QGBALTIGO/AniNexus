import {test,expect} from '@playwright/test';
const ORIGIN=process.env.ANINEXUS_E2E_ORIGIN||'http://qgbaltigo.github.io:4173/AniNexus/';
const pageUrl=route=>`${ORIGIN}?build=38.1.0&p=${encodeURIComponent(route)}`;
async function noLegacy404(page){await expect(page.locator('body')).not.toContainText('Página não encontrada')}
async function noHorizontalOverflow(page,tolerance=7){const x=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:innerWidth}));expect(x.scroll).toBeLessThanOrEqual(x.inner+tolerance)}
async function waitForAny(page,selectors,timeout=25000){await Promise.any(selectors.map(s=>page.locator(s).first().waitFor({state:'visible',timeout})))}
test.describe.configure({mode:'serial'});

test('V35 Home remains the single visible Home renderer under V38 shell',async({page})=>{
  await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});
  await expect(page.locator('.nx35-home')).toBeVisible({timeout:30000});
  await expect(page.locator('.aqx-home')).toHaveCount(0);
  await expect(page.locator('.nx35-hero')).toHaveCount(1);
  await expect(page.locator('.nx35-hero-actions a')).toHaveCount(2);
  await expect(page.locator('.aqx-tags')).toHaveCount(0);
  await noLegacy404(page);
});

test('Home community does not repaint when countdown ticks',async({page})=>{
  await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx35-home')).toBeVisible({timeout:30000});
  const community=page.locator('#nx35CommunityHero');await expect(community).toBeVisible();
  const before=await community.evaluate(el=>el.innerHTML);await page.waitForTimeout(2200);const after=await community.evaluate(el=>el.innerHTML);
  expect(after).toBe(before);
});

test('Home upcoming episodes use the exact Programação card system',async({page})=>{
  await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});const cards=page.locator('#nx35Schedule .nx18-card');await expect(cards.first()).toBeVisible({timeout:30000});expect(await cards.count()).toBeGreaterThan(1);
  const first=cards.first();await expect(first.locator('.nx18-cover')).toBeVisible();await expect(first.locator('.nx18-info')).toBeVisible();await expect(first.locator('.nx18-air')).toBeVisible();await expect(first.locator('.nx18-episode')).toBeVisible();
});

test('all overflowing Home rails expose weak directional fade state',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx35-home')).toBeVisible({timeout:30000});
  const rails=page.locator('.nx35-edge .nx35-rail');expect(await rails.count()).toBeGreaterThan(2);
  for(let i=0;i<Math.min(4,await rails.count());i++){const rail=rails.nth(i),host=rail.locator('..');const overflowing=await rail.evaluate(el=>el.scrollWidth>el.clientWidth+2);if(overflowing)expect(await host.getAttribute('data-right')).toBe('1')}
  await noHorizontalOverflow(page);
});

test('Top 10 and achievements stay aligned to AniNexus',async({page})=>{
  await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});await expect(page.locator('#nx35Top .nx35-rank').first()).toBeVisible({timeout:30000});await expect(page.locator('.nx35-achievement-section')).toBeVisible();const align=await page.locator('.nx35-achievement-section .nx35-head').evaluate(el=>getComputedStyle(el).textAlign);expect(align).toBe('center');
});

test('favorite toggles independently and list status changes then removes like ANIQuim',async({page})=>{
  await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx35-home')).toBeVisible({timeout:30000});
  await page.evaluate(()=>{localStorage.removeItem('aninexus:favorites');localStorage.removeItem('aninexus:mediaState:v2');localStorage.removeItem('aninexus:mediaState:v1');localStorage.removeItem('aninexus:list');localStorage.removeItem('aninexus:listStatus');window.AniNexusMediaState?.sync?.()});
  const ids=await page.evaluate(()=>{
    const out=[];for(const b of document.querySelectorAll('button[data-fav]')){const id=Number(b.dataset.fav);if(id&&!out.includes(id))out.push(id);if(out.length===2)break}return out;
  });
  expect(ids.length).toBe(2);
  const [a,b]=ids,fa=page.locator(`button[data-fav="${a}"]`),fb=page.locator(`button[data-fav="${b}"]`);
  await fa.first().click();await expect(fa.first()).toHaveClass(/active/);
  await fb.first().click();await expect(fb.first()).toHaveClass(/active/);await expect(fa.first()).toHaveClass(/active/);
  await fa.first().click();await expect(fa.first()).not.toHaveClass(/active/);await expect(fb.first()).toHaveClass(/active/);
  expect(await page.evaluate(([a,b])=>{const s=new Set(JSON.parse(localStorage.getItem('aninexus:favorites')||'[]').map(Number));return !s.has(a)&&s.has(b)},[a,b])).toBe(true);

  const list=page.locator(`button[data-list="${a}"]`).first();await list.click();await expect(page.locator('.nx20-modal')).toBeVisible();
  await page.locator('[data-nx20-status="PLANNING"]').click();await page.locator('[data-nx20-save]').click();await expect(list).toHaveAttribute('data-nx-unified-status','PLANNING');await expect(list).toHaveAttribute('aria-label',/Quero Ver/);
  await list.click();await page.locator('[data-nx20-status="CURRENT"]').click();await page.locator('[data-nx20-save]').click();await expect(list).toHaveAttribute('data-nx-unified-status','CURRENT');await expect(list).toHaveAttribute('aria-label',/Assistindo/);
  await list.click();await page.locator('[data-nx20-remove]').click();await expect(list).toHaveAttribute('data-nx-unified-status','');await expect(list).not.toHaveClass(/active/);await expect(list).toHaveAttribute('aria-label','Adicionar à lista');
});

test('Meus Animes filters the library, publishes an impression and surfaces it on Home',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx35-home')).toBeVisible({timeout:30000});
  const ids=await page.evaluate(()=>{
    const out=[];for(const b of document.querySelectorAll('button[data-fav]')){const id=Number(b.dataset.fav);if(id&&!out.includes(id))out.push(id);if(out.length===2)break}return out;
  });
  expect(ids.length).toBe(2);
  await page.evaluate(([a,b])=>{
    const now=Date.now();
    localStorage.setItem('aninexus:favorites',JSON.stringify([a]));
    const states={};states[a]={status:'CURRENT',progress:3,reaction:'',score:8.5,updatedAt:now};states[b]={status:'PLANNING',progress:0,reaction:'',score:null,updatedAt:now-1000};
    localStorage.setItem('aninexus:mediaState:v2',JSON.stringify(states));localStorage.setItem('aninexus:mediaState:v1',JSON.stringify(states));localStorage.setItem('aninexus:impressions:v1','[]');
  },ids);
  await page.goto(pageUrl('/meus-animes'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx38-library')).toBeVisible({timeout:30000});await noLegacy404(page);await noHorizontalOverflow(page);
  await expect(page.locator('.nx38-library-stat').nth(0)).toContainText('1');await expect(page.locator('.nx38-library-grid .nx38-library-card')).toHaveCount(2);
  await page.locator('[data-lib-filter="CURRENT"]').first().click();await expect(page.locator('.nx38-library-grid .nx38-library-card')).toHaveCount(1);
  await page.locator('[data-lib-impression]').first().click();await expect(page.locator('#nx38ImpressionModal')).toBeVisible();await page.locator('#nx38ImpressionForm textarea').fill('Gostei bastante do ritmo deste episódio.');await page.locator('.nx38-impression-submit').click();
  await expect(page.locator('.nx38-library-stat').nth(3)).toContainText('1');
  await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx35-home')).toBeVisible({timeout:30000});await expect(page.locator('#nx38HomeImpressions')).toBeVisible({timeout:10000});await expect(page.locator('.nx38-impression-home-card').first()).toContainText('Gostei bastante do ritmo deste episódio.');await noHorizontalOverflow(page);
});

test('news hub is Portuguese-only or deliberately empty',async({page})=>{
  await page.goto(pageUrl('/noticias'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx35-news-page')).toBeVisible({timeout:30000});await expect(page.locator('#nx35NewsSearch')).toBeVisible();
  const cards=page.locator('.nx35-ncard');if(await cards.count()){const text=(await cards.allTextContents()).join(' ');expect(text).not.toMatch(/All the News and Reviews|Interest Fool Night/i);await expect(cards.first()).toContainText('Ler no AniNexus')}else await expect(page.locator('.nx35-news-empty')).toBeVisible();
  await noLegacy404(page);
});

test('news card opens same internal slug and reader has proportional typography',async({page})=>{
  await page.goto(pageUrl('/noticias'),{waitUntil:'domcontentloaded'});const card=page.locator('.nx35-ncard').first();if(!await card.count())return;await expect(card).toBeVisible({timeout:30000});const href=await card.getAttribute('href');expect(href||'').toMatch(/^\/noticias\/[a-z0-9-]+$/);await card.click();await expect(page.locator('.nx35-reader')).toBeVisible({timeout:30000});await expect(page.locator('.nx35-article-head h1')).not.toHaveText('');const size=parseFloat(await page.locator('.nx35-article-head h1').evaluate(el=>getComputedStyle(el).fontSize));expect(size).toBeLessThanOrEqual(53);await expect(page.locator('.nx35-reader')).not.toContainText('Ler na fonte');await noLegacy404(page);
});

test('mobile Home and News never overflow horizontally',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx35-home')).toBeVisible({timeout:30000});await noHorizontalOverflow(page);await page.goto(pageUrl('/noticias'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx35-news-page')).toBeVisible({timeout:30000});await noHorizontalOverflow(page);
});

test('catalog and dedicated anime detail remain healthy',async({page})=>{
  await page.goto(pageUrl('/animes/catalogo'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx21-card').first()).toBeVisible({timeout:30000});expect(await page.locator('.nx21-card').count()).toBeGreaterThan(3);const card=page.locator('.nx21-card').first(),target=card.locator('h3').first();await (await target.count()?target:card).click();await page.waitForURL(u=>(new URL(u)).searchParams.get('p')?.startsWith('/anime/')===true,{timeout:15000});await expect(page.locator('.nx22-detail')).toBeVisible({timeout:30000});await noLegacy404(page);
});

test('season, Programação and search remain functional',async({page})=>{
  await page.goto(pageUrl('/animes/temporadas'),{waitUntil:'domcontentloaded'});await waitForAny(page,['.nx-season-card','.nx-season']);await noLegacy404(page);await page.goto(pageUrl('/animes/programacao'),{waitUntil:'domcontentloaded'});await waitForAny(page,['[data-nx18-open]','.nx18-card','.nx18-island'],30000);await noLegacy404(page);await page.locator('[data-action="search"]').first().click();await expect(page.locator('#searchOverlay')).toBeVisible();await page.keyboard.press('Escape');
});

test('Entrar opens the dedicated V38 login page instead of the legacy modal',async({page})=>{
  await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx35-home')).toBeVisible({timeout:30000});await page.locator('[data-action="login"]').first().click();await page.waitForURL(u=>(new URL(u)).searchParams.get('p')==='/login',{timeout:10000});await expect(page.locator('.nx38-auth-page')).toBeVisible({timeout:10000});await expect(page.locator('.nx38-auth-card h2')).toHaveText('Entre na sua conta');await expect(page.locator('#authOverlay')).toBeHidden();await noLegacy404(page);
});

test('Criar conta has confirmation, password requirements and terms',async({page})=>{
  await page.goto(pageUrl('/criar-conta'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx38-auth-page')).toBeVisible({timeout:10000});await expect(page.locator('#nx38-username')).toBeVisible();await expect(page.locator('#nx38-email')).toBeVisible();await expect(page.locator('#nx38-password')).toBeVisible();await expect(page.locator('#nx38-confirm')).toBeVisible();await expect(page.locator('#nx38Rules')).toContainText('10 ou mais caracteres');await expect(page.locator('.nx38-auth-check')).toContainText('Termos de Serviço');await noHorizontalOverflow(page);await noLegacy404(page);
});

test('mobile authentication pages fit without horizontal overflow',async({page})=>{
  await page.setViewportSize({width:390,height:844});for(const route of ['/login','/criar-conta','/minha-conta']){await page.goto(pageUrl(route),{waitUntil:'domcontentloaded'});await waitForAny(page,['.nx38-auth-page','.nx38-account-page'],10000);await noHorizontalOverflow(page);await noLegacy404(page)}
});
