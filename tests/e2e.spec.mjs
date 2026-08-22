import { test, expect } from '@playwright/test';

const ORIGIN=process.env.ANINEXUS_E2E_ORIGIN||'http://qgbaltigo.github.io:4173/AniNexus/';
const pageUrl=route=>`${ORIGIN}?build=32.0.0&p=${encodeURIComponent(route)}`;

async function noLegacy404(page){await expect(page.locator('body')).not.toContainText('Página não encontrada')}
async function noHorizontalOverflow(page,tolerance=5){const overflow=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:innerWidth}));expect(overflow.scroll).toBeLessThanOrEqual(overflow.inner+tolerance)}
async function waitForAny(page,selectors,timeout=20000){await Promise.any(selectors.map(s=>page.locator(s).first().waitFor({state:'visible',timeout})))}

test.describe.configure({mode:'serial'});

test('home boots with AniNexus identity, no Tags, native news and auth controls',async({page})=>{
  await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});
  await expect(page.locator('.brand').first()).toContainText('AniNexus');
  await expect(page.locator('.aqx-home')).toBeVisible({timeout:30000});
  await expect(page.locator('.nx31-hero-sigil')).toBeVisible({timeout:15000});
  await expect(page.locator('.nx31-live-brand')).toBeVisible({timeout:15000});
  await expect(page.locator('.aqx-tags')).toHaveCount(0);
  await expect(page.locator('#nx30News')).toBeVisible({timeout:30000});
  await expect(page.locator('[data-nx32-home-route]').first()).toBeVisible({timeout:30000});
  await page.locator('[data-action="search"]').first().click();
  await expect(page.locator('#searchOverlay')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('[data-action="login"]').first().click();
  await expect(page.locator('#authOverlay')).toBeVisible();
  await page.keyboard.press('Escape');
  await noLegacy404(page);
});

test('home news always routes to an internal AniNexus article',async({page})=>{
  await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});
  const news=page.locator('[data-nx32-home-route]').first();
  await expect(news).toBeVisible({timeout:30000});
  const internal=await news.getAttribute('data-nx32-home-route');
  expect(internal||'').toMatch(/^\/noticias\/[a-z0-9-]+$/);
  await news.click();
  await page.waitForURL(u=>(new URL(u)).searchParams.get('p')?.startsWith('/noticias/')===true,{timeout:15000});
  await expect(page.locator('.nx32-reader')).toBeVisible({timeout:30000});
  await noLegacy404(page);
});

test('V32 news hub has filters search internal cards and no outbound reading CTA',async({page})=>{
  await page.goto(pageUrl('/noticias'),{waitUntil:'domcontentloaded'});
  await expect(page.locator('.nx32-news-page')).toBeVisible({timeout:30000});
  await expect(page.locator('.nx32-card').first()).toBeVisible({timeout:30000});
  expect(await page.locator('.nx32-card').count()).toBeGreaterThan(0);
  await expect(page.locator('[data-nx32-category="ALL"]')).toBeVisible();
  await expect(page.locator('#nx32Search')).toBeVisible();
  await expect(page.locator('.nx32-card').first()).toContainText('Ler no AniNexus');
  const href=await page.locator('.nx32-card').first().getAttribute('href');
  expect(href||'').toMatch(/^\/noticias\//);
  await expect(page.locator('a').filter({hasText:'Ler na fonte'})).toHaveCount(0);
  await noLegacy404(page);
});

test('V32 article reader has progress summary editorial note and related content',async({page})=>{
  await page.goto(pageUrl('/noticias'),{waitUntil:'domcontentloaded'});
  const first=page.locator('.nx32-card').first();await expect(first).toBeVisible({timeout:30000});
  const href=await first.getAttribute('href');expect(href).toBeTruthy();
  await page.goto(pageUrl(href),{waitUntil:'domcontentloaded'});
  await expect(page.locator('.nx32-reader')).toBeVisible({timeout:30000});
  await expect(page.locator('.nx32-reading-progress')).toBeVisible();
  await expect(page.locator('.nx32-article-head h1')).not.toHaveText('');
  await expect(page.locator('.nx32-editorial-note')).toContainText('Como esta matéria foi criada');
  await expect(page.locator('.nx32-article')).not.toContainText('Ler na fonte');
  const summary=page.locator('.nx32-summary-box');if(await summary.count())await expect(summary).toContainText('EM RESUMO');
  await noLegacy404(page);
});

test('V32 news filter and search update results without leaving the page',async({page})=>{
  await page.goto(pageUrl('/noticias'),{waitUntil:'domcontentloaded'});
  await expect(page.locator('.nx32-card').first()).toBeVisible({timeout:30000});
  await page.locator('[data-nx32-category="MANGA"]').click();
  await expect(page.locator('[data-nx32-category="MANGA"]')).toHaveClass(/active/);
  const search=page.locator('#nx32Search');await search.fill('manga');
  await expect(page.locator('.nx32-news-page')).toBeVisible();
  await noLegacy404(page);
});

test('catalog loads real anime cards and dedicated detail remains healthy',async({page})=>{
  await page.goto(pageUrl('/animes/catalogo'),{waitUntil:'domcontentloaded'});
  await expect(page.locator('.nx21-card').first()).toBeVisible({timeout:30000});
  expect(await page.locator('.nx21-card').count()).toBeGreaterThan(3);
  const card=page.locator('.nx21-card').first(),clickTarget=card.locator('h3').first();
  await (await clickTarget.count()?clickTarget:card).click();
  await page.waitForURL(u=>(new URL(u)).searchParams.get('p')?.startsWith('/anime/')===true,{timeout:15000});
  await expect(page.locator('.nx22-detail')).toBeVisible({timeout:30000});
  await expect(page.locator('.nx22-quick article')).toHaveCount(4);
  await noLegacy404(page);
});

test('anime detail keeps list-state contract and responsive trailer',async({page})=>{
  await page.goto(pageUrl('/anime/demon-slayer-kimetsu-no-yaiba-101922'),{waitUntil:'domcontentloaded'});
  await expect(page.locator('.nx22-detail')).toBeVisible({timeout:30000});
  const list=page.locator('.nx22-list');await expect(list).toBeVisible();await list.click();
  await expect(page.locator('.nx20-media-layer')).toBeVisible({timeout:12000});
  await page.locator('[data-nx20-status="PLANNING"]').click();
  await expect(page.locator('.nx20-progress')).toHaveCount(0);
  await expect(page.locator('.nx20-rating')).toHaveCount(0);
  await page.locator('[data-nx20-save]').click();
  const iframe=page.locator('.nx22-video iframe');if(await iframe.count()){const box=await iframe.boundingBox();const ratio=(box?.width||1)/(box?.height||1);expect(ratio).toBeGreaterThan(1.65);expect(ratio).toBeLessThan(1.9)}
});

test('season and schedule dedicated pages still load',async({page})=>{
  await page.goto(pageUrl('/animes/temporadas'),{waitUntil:'domcontentloaded'});await waitForAny(page,['.nx-season-card','.nx-season']);await noLegacy404(page);
  await page.goto(pageUrl('/animes/programacao'),{waitUntil:'domcontentloaded'});await waitForAny(page,['[data-nx18-open]','.nx18-schedule','.nx18-island'],30000);await noLegacy404(page);
});

test('mobile home news hub reader and detail have no horizontal overflow',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});await expect(page.locator('.aqx-home')).toBeVisible({timeout:30000});await noHorizontalOverflow(page,7);
  await page.goto(pageUrl('/noticias'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx32-news-page')).toBeVisible({timeout:30000});await noHorizontalOverflow(page,7);
  const href=await page.locator('.nx32-card').first().getAttribute('href');if(href){await page.goto(pageUrl(href),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx32-reader')).toBeVisible({timeout:30000});await noHorizontalOverflow(page,7)}
  await page.goto(pageUrl('/anime/demon-slayer-kimetsu-no-yaiba-101922'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx22-detail')).toBeVisible({timeout:30000});await noHorizontalOverflow(page,7);
});
