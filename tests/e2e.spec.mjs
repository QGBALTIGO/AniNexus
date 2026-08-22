import { test, expect } from '@playwright/test';

const ORIGIN=process.env.ANINEXUS_E2E_ORIGIN||'http://qgbaltigo.github.io:4173/AniNexus/';
const pageUrl=route=>`${ORIGIN}?build=25.0.0&p=${encodeURIComponent(route)}`;

async function noLegacy404(page){
  await expect(page.locator('body')).not.toContainText('Página não encontrada');
}
async function noHorizontalOverflow(page,tolerance=3){
  const overflow=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:innerWidth}));
  expect(overflow.scroll).toBeLessThanOrEqual(overflow.inner+tolerance);
}
async function waitForAny(page,selectors,timeout=20000){
  await Promise.any(selectors.map(s=>page.locator(s).first().waitFor({state:'visible',timeout})));
}

test.describe.configure({mode:'serial'});

test('home boots with shared header, search and auth controls',async({page})=>{
  await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});
  await expect(page.locator('.brand').first()).toContainText('AniNexus');
  await expect(page.locator('[data-action="search"]').first()).toBeVisible();
  await page.locator('[data-action="search"]').first().click();
  await expect(page.locator('#searchOverlay')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#searchOverlay')).toBeHidden();
  await page.locator('[data-action="login"]').first().click();
  await expect(page.locator('#authOverlay')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#authOverlay')).toBeHidden();
  await page.locator('[data-action="register"]').first().click();
  await expect(page.locator('#authOverlay')).toBeVisible();
  await page.keyboard.press('Escape');
  await noLegacy404(page);
});

test('catalog loads real anime cards and mode switching works',async({page})=>{
  await page.goto(pageUrl('/animes/catalogo'),{waitUntil:'domcontentloaded'});
  await expect(page.locator('.nx21-card').first()).toBeVisible({timeout:30000});
  expect(await page.locator('.nx21-card').count()).toBeGreaterThan(3);
  await noLegacy404(page);
  const top=page.locator('[data-nx21-mode="TOP"]');
  if(await top.count()){
    await top.click();
    await expect(page.locator('.nx21-card').first()).toBeVisible({timeout:30000});
    await expect(page.locator('[data-nx21-mode="TOP"]')).toHaveClass(/active/);
  }
});

test('catalog card always opens the dedicated V25 anime detail',async({page})=>{
  await page.goto(pageUrl('/animes/catalogo'),{waitUntil:'domcontentloaded'});
  const card=page.locator('.nx21-card').first();
  await expect(card).toBeVisible({timeout:30000});
  const clickTarget=card.locator('h3').first();
  await (await clickTarget.count()?clickTarget:card).click();
  await page.waitForURL(u=>(new URL(u)).searchParams.get('p')?.startsWith('/anime/')===true,{timeout:15000});
  await expect(page.locator('.nx22-detail')).toBeVisible({timeout:30000});
  await noLegacy404(page);
});

test('anime detail no longer flashes or lands on not-found',async({page})=>{
  await page.goto(pageUrl('/anime/demon-slayer-kimetsu-no-yaiba-101922'),{waitUntil:'domcontentloaded'});
  await expect(page.locator('.nx22-detail')).toBeVisible({timeout:30000});
  await noLegacy404(page);
  await expect(page.locator('.nx22-headcopy h1')).not.toHaveText('');
  await expect(page.locator('.nx22-quick article')).toHaveCount(4);
  await expect(page.locator('.nx22-quick')).toContainText('LANÇAMENTO');
  await expect(page.locator('.nx22-quick')).toContainText('TÉRMINO');
  await expect(page.locator('#nx22Synopsis')).not.toHaveText('');
  await expect(page.locator('.nx22-info-card').first()).toContainText('Formato');
  await expect(page.locator('.nx22-info-card').first()).toContainText('Estúdio');
});

test('shared + obeys status-specific rules and keeps the labeled detail button',async({page})=>{
  await page.goto(pageUrl('/anime/demon-slayer-kimetsu-no-yaiba-101922'),{waitUntil:'domcontentloaded'});
  await expect(page.locator('.nx22-detail')).toBeVisible({timeout:30000});
  const list=page.locator('.nx22-list');
  await expect(list).toBeVisible();
  await expect(list).toContainText('Adicionar à lista');

  await list.click();
  const modal=page.locator('.nx20-media-layer');
  await expect(modal).toBeVisible({timeout:12000});
  await expect(page.locator('.nx20-statuses button.active')).toHaveCount(0);

  // Quero Ver: expectation is allowed, but progress and rating make no sense.
  await page.locator('[data-nx20-status="PLANNING"]').click();
  await expect(page.locator('.nx20-progress')).toHaveCount(0);
  await expect(page.locator('.nx20-rating')).toHaveCount(0);
  await expect(page.locator('.nx20-feedback')).toBeVisible();
  await page.locator('[data-nx20-save]').click();
  await expect(modal).toHaveCount(0);
  await expect(list).toHaveAttribute('data-nx-unified-status','PLANNING');
  await expect(list).toContainText('Quero Ver');

  // Assistindo: at ep. 0 reaction/rating stay locked; ep. 1 unlocks them.
  await list.click();
  await expect(page.locator('.nx20-media-layer')).toBeVisible();
  await page.locator('[data-nx20-status="CURRENT"]').click();
  await expect(page.locator('.nx20-progress')).toBeVisible();
  await expect(page.locator('.nx20-feedback')).toHaveClass(/locked/);
  await expect(page.locator('.nx20-rating')).toHaveClass(/locked/);
  await page.locator('[data-nx20-step="1"]').click();
  await expect(page.locator('[data-nx20-score]')).toBeVisible();
  await expect(page.locator('[data-nx20-reaction]').first()).toBeVisible();
  await page.locator('[data-nx20-save]').click();
  await expect(list).toHaveAttribute('data-nx-unified-status','CURRENT');
  await expect(list).toContainText('Assistindo');

  const fav=page.locator('.nx22-fav');
  await fav.click();
  await expect(fav).toHaveClass(/active/);
  await fav.click();
});

test('anime detail embeds trailer when upstream provides one',async({page})=>{
  await page.goto(pageUrl('/anime/demon-slayer-kimetsu-no-yaiba-101922'),{waitUntil:'domcontentloaded'});
  await expect(page.locator('.nx22-detail')).toBeVisible({timeout:30000});
  const iframe=page.locator('.nx22-video iframe');
  if(await iframe.count()){
    await expect(iframe).toHaveAttribute('src',/youtube-nocookie\.com\/embed\//);
    const box=await iframe.boundingBox();
    expect(box?.width||0).toBeGreaterThan(200);
    const ratio=(box?.width||1)/(box?.height||1);
    expect(ratio).toBeGreaterThan(1.65);
    expect(ratio).toBeLessThan(1.9);
  }
});

test('anime detail is genuinely mobile responsive',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(pageUrl('/anime/demon-slayer-kimetsu-no-yaiba-101922'),{waitUntil:'domcontentloaded'});
  await expect(page.locator('.nx22-detail')).toBeVisible({timeout:30000});
  await noLegacy404(page);
  await noHorizontalOverflow(page);
  const heroDisplay=await page.locator('.nx22-hero-grid').evaluate(el=>getComputedStyle(el).display);
  expect(heroDisplay).toBe('block');
  const layoutColumns=await page.locator('.nx22-layout').evaluate(el=>getComputedStyle(el).gridTemplateColumns);
  expect(layoutColumns.split(' ').length).toBe(1);
  const quickCount=await page.locator('.nx22-quick article').count();
  expect(quickCount).toBe(4);
});

test('detail tabs render characters, franchise and recommendations without breaking layout',async({page})=>{
  await page.goto(pageUrl('/anime/demon-slayer-kimetsu-no-yaiba-101922'),{waitUntil:'domcontentloaded'});
  await expect(page.locator('.nx22-detail')).toBeVisible({timeout:30000});
  for(const tab of ['personagens','franquia','recomendacoes']){
    const b=page.locator(`[data-nx22-tab="${tab}"]`);
    await b.click();
    await expect(b).toHaveClass(/active/);
    await expect(page.locator('#nx22StablePanel')).not.toBeEmpty();
  }
});

test('news page loads editorial stories with source/date links',async({page})=>{
  await page.goto(pageUrl('/noticias'),{waitUntil:'domcontentloaded'});
  await expect(page.locator('.nx22-news')).toBeVisible({timeout:20000});
  await expect(page.locator('.nx22-news-card').first()).toBeVisible({timeout:30000});
  expect(await page.locator('.nx22-news-card').count()).toBeGreaterThan(0);
  await expect(page.locator('.nx22-news-card').first()).toContainText(/Crunchyroll|MyAnimeList|Anime News Network|ANN/);
  await expect(page.locator('.nx22-read').first()).toHaveAttribute('href',/^https:\/\//);
  await noLegacy404(page);
});

test('seasons and schedule dedicated pages load without route contamination',async({page})=>{
  await page.goto(pageUrl('/animes/temporadas'),{waitUntil:'domcontentloaded'});
  await waitForAny(page,['.nx-season-card','.nx-season']);
  await noLegacy404(page);
  await page.goto(pageUrl('/animes/programacao'),{waitUntil:'domcontentloaded'});
  await waitForAny(page,['[data-nx18-open]','.nx18-schedule','.nx18-island'],30000);
  await noLegacy404(page);
  expect(await page.locator('.nx-v10-seasonbar').count()).toBe(0);
});

test('mobile drawer opens and closes without horizontal overflow',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(pageUrl('/animes/catalogo'),{waitUntil:'domcontentloaded'});
  await page.locator('[data-action="drawer-open"]').click();
  await expect(page.locator('#drawer')).toBeVisible();
  await noHorizontalOverflow(page,6);
  await page.locator('[data-action="drawer-close"]').first().click();
  await expect(page.locator('#drawer')).toBeHidden();
});
