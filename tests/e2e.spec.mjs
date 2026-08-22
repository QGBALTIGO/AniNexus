import { test, expect } from '@playwright/test';

const ORIGIN=process.env.ANINEXUS_E2E_ORIGIN||'http://qgbaltigo.github.io:4173/AniNexus/';
const pageUrl=route=>`${ORIGIN}?build=31.2.0&p=${encodeURIComponent(route)}`;

async function noLegacy404(page){await expect(page.locator('body')).not.toContainText('Página não encontrada')}
async function noHorizontalOverflow(page,tolerance=3){const overflow=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:innerWidth}));expect(overflow.scroll).toBeLessThanOrEqual(overflow.inner+tolerance)}
async function waitForAny(page,selectors,timeout=20000){await Promise.any(selectors.map(s=>page.locator(s).first().waitFor({state:'visible',timeout})))}

test.describe.configure({mode:'serial'});

test('home boots with AniNexus identity, native news, search and auth controls',async({page})=>{
  await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});
  await expect(page.locator('.brand').first()).toContainText('AniNexus');
  await expect(page.locator('.aqx-home')).toBeVisible({timeout:30000});
  await expect(page.locator('.aqx-hero h1')).toContainText(/Avalie|Descubra|Compartilhe/);
  await expect(page.locator('.nx31-universe-strip')).toBeVisible({timeout:15000});
  await expect(page.locator('.nx31-live-brand')).toBeVisible({timeout:15000});
  await expect(page.locator('.aqx-tags')).toHaveCount(0);
  await expect(page.locator('#nx30News')).toBeVisible({timeout:30000});
  await expect(page.locator('[data-nx31-home-news]').first()).toBeVisible({timeout:30000});
  await page.locator('[data-action="search"]').first().click();
  await expect(page.locator('#searchOverlay')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('[data-action="login"]').first().click();
  await expect(page.locator('#authOverlay')).toBeVisible();
  await page.keyboard.press('Escape');
  await noLegacy404(page);
});

test('home news opens an internal AniNexus article route',async({page})=>{
  await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});
  const news=page.locator('[data-nx31-home-news]').first();
  await expect(news).toBeVisible({timeout:30000});
  await news.click();
  await page.waitForURL(u=>(new URL(u)).searchParams.get('p')?.startsWith('/noticias/')===true,{timeout:15000});
  await expect(page.locator('.nx31-news')).toBeVisible({timeout:30000});
  await noLegacy404(page);
});

test('native news hub stays inside AniNexus and supports filters/search',async({page})=>{
  await page.goto(pageUrl('/noticias'),{waitUntil:'domcontentloaded'});
  await expect(page.locator('.nx31-news')).toBeVisible({timeout:30000});
  await expect(page.locator('.nx31-card').first()).toBeVisible({timeout:30000});
  expect(await page.locator('.nx31-card').count()).toBeGreaterThan(0);
  await expect(page.locator('[data-nx31-cat="Tudo"]')).toBeVisible();
  await expect(page.locator('#nx31Search')).toBeVisible();
  await expect(page.locator('.nx31-card').first().locator('b')).toContainText('Ler no AniNexus');
  const href=await page.locator('.nx31-card').first().getAttribute('href');
  expect(href||'').toMatch(/^\/noticias\//);
  await expect(page.locator('a[href^="http"]').filter({hasText:'Ler na fonte'})).toHaveCount(0);
  await noLegacy404(page);
});

test('native news article renders internally with source credit and related stories',async({page})=>{
  await page.goto(pageUrl('/noticias'),{waitUntil:'domcontentloaded'});
  const first=page.locator('.nx31-card').first();
  await expect(first).toBeVisible({timeout:30000});
  const href=await first.getAttribute('href');
  expect(href).toBeTruthy();
  await page.goto(pageUrl(href),{waitUntil:'domcontentloaded'});
  await expect(page.locator('.nx31-article')).toBeVisible({timeout:30000});
  await expect(page.locator('.nx31-article-head h1')).not.toHaveText('');
  await expect(page.locator('.nx31-article-body')).toContainText('Contexto da publicação');
  await expect(page.locator('.nx31-article-side')).toContainText('FONTE MONITORADA');
  await expect(page.locator('.nx31-article')).not.toContainText('Ler na fonte');
  await noLegacy404(page);
});

test('catalog loads real anime cards and mode switching works',async({page})=>{
  await page.goto(pageUrl('/animes/catalogo'),{waitUntil:'domcontentloaded'});
  await expect(page.locator('.nx21-card').first()).toBeVisible({timeout:30000});
  expect(await page.locator('.nx21-card').count()).toBeGreaterThan(3);
  const top=page.locator('[data-nx21-mode="TOP"]');
  if(await top.count()){await top.click();await expect(page.locator('.nx21-card').first()).toBeVisible({timeout:30000});await expect(top).toHaveClass(/active/)}
  await noLegacy404(page);
});

test('catalog card opens dedicated anime detail',async({page})=>{
  await page.goto(pageUrl('/animes/catalogo'),{waitUntil:'domcontentloaded'});
  const card=page.locator('.nx21-card').first();await expect(card).toBeVisible({timeout:30000});
  const clickTarget=card.locator('h3').first();await (await clickTarget.count()?clickTarget:card).click();
  await page.waitForURL(u=>(new URL(u)).searchParams.get('p')?.startsWith('/anime/')===true,{timeout:15000});
  await expect(page.locator('.nx22-detail')).toBeVisible({timeout:30000});await noLegacy404(page);
});

test('anime detail keeps metadata, state controls and trailer responsiveness',async({page})=>{
  await page.goto(pageUrl('/anime/demon-slayer-kimetsu-no-yaiba-101922'),{waitUntil:'domcontentloaded'});
  await expect(page.locator('.nx22-detail')).toBeVisible({timeout:30000});
  await expect(page.locator('.nx22-quick article')).toHaveCount(4);
  await expect(page.locator('.nx22-quick')).toContainText('LANÇAMENTO');
  await expect(page.locator('.nx22-quick')).toContainText('TÉRMINO');
  await expect(page.locator('#nx22Synopsis')).not.toHaveText('');
  const list=page.locator('.nx22-list');await expect(list).toBeVisible();await list.click();
  await expect(page.locator('.nx20-media-layer')).toBeVisible({timeout:12000});
  await page.locator('[data-nx20-status="PLANNING"]').click();
  await expect(page.locator('.nx20-progress')).toHaveCount(0);
  await expect(page.locator('.nx20-rating')).toHaveCount(0);
  await page.locator('[data-nx20-save]').click();
  const iframe=page.locator('.nx22-video iframe');if(await iframe.count()){const box=await iframe.boundingBox();const ratio=(box?.width||1)/(box?.height||1);expect(ratio).toBeGreaterThan(1.65);expect(ratio).toBeLessThan(1.9)}
});

test('seasons and schedule dedicated pages load without route contamination',async({page})=>{
  await page.goto(pageUrl('/animes/temporadas'),{waitUntil:'domcontentloaded'});await waitForAny(page,['.nx-season-card','.nx-season']);await noLegacy404(page);
  await page.goto(pageUrl('/animes/programacao'),{waitUntil:'domcontentloaded'});await waitForAny(page,['[data-nx18-open]','.nx18-schedule','.nx18-island'],30000);await noLegacy404(page);
});

test('mobile core screens have no horizontal overflow',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  for(const route of ['/','/noticias','/anime/demon-slayer-kimetsu-no-yaiba-101922']){
    await page.goto(pageUrl(route),{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(800);
    await noHorizontalOverflow(page,6);
  }
});
