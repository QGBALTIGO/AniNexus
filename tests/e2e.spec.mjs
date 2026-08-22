import {test,expect} from '@playwright/test';
const ORIGIN=process.env.ANINEXUS_E2E_ORIGIN||'http://qgbaltigo.github.io:4173/AniNexus/';
const pageUrl=route=>`${ORIGIN}?build=35.0.0&p=${encodeURIComponent(route)}`;
async function noLegacy404(page){await expect(page.locator('body')).not.toContainText('Página não encontrada')}
async function noHorizontalOverflow(page,tolerance=7){const x=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:innerWidth}));expect(x.scroll).toBeLessThanOrEqual(x.inner+tolerance)}
async function waitForAny(page,selectors,timeout=25000){await Promise.any(selectors.map(s=>page.locator(s).first().waitFor({state:'visible',timeout})))}
test.describe.configure({mode:'serial'});

test('V35 Home is the first and only visible Home renderer',async({page})=>{
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

test('Top 10 and achievements stay aligned to AniNexus V35',async({page})=>{
  await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});await expect(page.locator('#nx35Top .nx35-rank').first()).toBeVisible({timeout:30000});await expect(page.locator('.nx35-achievement-section')).toBeVisible();const align=await page.locator('.nx35-achievement-section .nx35-head').evaluate(el=>getComputedStyle(el).textAlign);expect(align).toBe('center');
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

test('season, Programação, search and auth chrome remain functional',async({page})=>{
  await page.goto(pageUrl('/animes/temporadas'),{waitUntil:'domcontentloaded'});await waitForAny(page,['.nx-season-card','.nx-season']);await noLegacy404(page);await page.goto(pageUrl('/animes/programacao'),{waitUntil:'domcontentloaded'});await waitForAny(page,['[data-nx18-open]','.nx18-card','.nx18-island'],30000);await noLegacy404(page);await page.locator('[data-action="search"]').first().click();await expect(page.locator('#searchOverlay')).toBeVisible();await page.keyboard.press('Escape');await page.locator('[data-action="login"]').first().click();await expect(page.locator('#authOverlay')).toBeVisible();
});
