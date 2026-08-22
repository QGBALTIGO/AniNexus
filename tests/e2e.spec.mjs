import { test, expect } from '@playwright/test';
const ORIGIN=process.env.ANINEXUS_E2E_ORIGIN||'http://qgbaltigo.github.io:4173/AniNexus/';
const pageUrl=route=>`${ORIGIN}?build=33.0.0&p=${encodeURIComponent(route)}`;
async function noLegacy404(page){await expect(page.locator('body')).not.toContainText('Página não encontrada')}
async function noHorizontalOverflow(page,tolerance=6){const x=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:innerWidth}));expect(x.scroll).toBeLessThanOrEqual(x.inner+tolerance)}
async function waitForAny(page,selectors,timeout=25000){await Promise.any(selectors.map(s=>page.locator(s).first().waitFor({state:'visible',timeout})))}
test.describe.configure({mode:'serial'});

test('V33 home has one AniNexus hero, no Tags, news and manga',async({page})=>{
  await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});await expect(page.locator('.aqx-home')).toBeVisible({timeout:30000});
  await expect(page.locator('.nx33-brand-lockup')).toHaveCount(1);await expect(page.locator('.nx33-hero-actions')).toHaveCount(1);await expect(page.locator('.nx33-hero-actions a')).toHaveCount(2);await expect(page.locator('.nx33-orbit')).toHaveCount(1);
  await expect(page.locator('.aqx-tags')).toHaveCount(0);await expect(page.locator('#nx33HomeNews')).toBeVisible({timeout:30000});await expect(page.locator('#nx33Reading')).toBeVisible({timeout:30000});
  await expect(page.locator('.nx33-news-feature')).toBeVisible({timeout:30000});await noLegacy404(page);
});

test('home news always opens an internal AniNexus article',async({page})=>{
  await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});const news=page.locator('[data-nx33-route^="/noticias/"]').first();await expect(news).toBeVisible({timeout:30000});const internal=await news.getAttribute('data-nx33-route');expect(internal||'').toMatch(/^\/noticias\/[a-z0-9-]+$/);await news.click();await page.waitForURL(u=>(new URL(u)).searchParams.get('p')?.startsWith('/noticias/')===true,{timeout:15000});await expect(page.locator('.nx32-reader')).toBeVisible({timeout:30000});await noLegacy404(page);
});

test('V33 news hub is internal, searchable and categorized',async({page})=>{
  await page.goto(pageUrl('/noticias'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx32-news-page')).toBeVisible({timeout:30000});await expect(page.locator('.nx32-card').first()).toBeVisible({timeout:30000});expect(await page.locator('.nx32-card').count()).toBeGreaterThan(0);await expect(page.locator('[data-nx33-category="ALL"]')).toBeVisible();await expect(page.locator('#nx32Search')).toBeVisible();await expect(page.locator('.nx32-card').first()).toContainText('Ler no AniNexus');const href=await page.locator('.nx32-card').first().getAttribute('href');expect(href||'').toMatch(/^\/noticias\//);await expect(page.locator('a[target="_blank"]')).toHaveCount(0);await noLegacy404(page);
});

test('V33 article reader has structured reading UI and no outbound source CTA',async({page})=>{
  await page.goto(pageUrl('/noticias'),{waitUntil:'domcontentloaded'});const first=page.locator('.nx32-card').first();await expect(first).toBeVisible({timeout:30000});const href=await first.getAttribute('href');expect(href).toBeTruthy();await page.goto(pageUrl(href),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx32-reader')).toBeVisible({timeout:30000});await expect(page.locator('.nx32-reading-progress')).toBeVisible();await expect(page.locator('.nx32-article-head h1')).not.toHaveText('');await expect(page.locator('.nx32-editorial-note')).toContainText('Como esta matéria foi criada');await expect(page.locator('.nx32-article')).not.toContainText('Ler na fonte');await expect(page.locator('.nx33-update-note')).toBeVisible();await expect(page.locator('.nx32-article-section').first()).toBeVisible();await noLegacy404(page);
});

test('news filters and search update without navigation',async({page})=>{
  await page.goto(pageUrl('/noticias'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx32-card').first()).toBeVisible({timeout:30000});const start=page.url();await page.locator('[data-nx33-category="MANGA"]').click();await expect(page.locator('[data-nx33-category="MANGA"]')).toHaveClass(/active/);const search=page.locator('#nx32Search');await search.fill('manga');expect(page.url()).toBe(start);await noLegacy404(page);
});

test('scrollable home rail gets contextual edge shadow state',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});await expect(page.locator('.aqx-home')).toBeVisible({timeout:30000});const host=page.locator('.aqx-rail-shell.nx33-edge-host').first();await expect(host).toBeVisible({timeout:30000});const state=await host.getAttribute('data-nx33-right');expect(['0','1']).toContain(state);const rail=host.locator('.aqx-rail');if(await rail.evaluate(el=>el.scrollWidth>el.clientWidth)){expect(state).toBe('1')}await noHorizontalOverflow(page,7);
});

test('mobile V33 home, news hub and reader do not overflow',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto(pageUrl('/'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx33-brand-lockup')).toBeVisible({timeout:30000});await noHorizontalOverflow(page,7);await page.goto(pageUrl('/noticias'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx32-news-page')).toBeVisible({timeout:30000});await noHorizontalOverflow(page,7);const href=await page.locator('.nx32-card').first().getAttribute('href');if(href){await page.goto(pageUrl(href),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx32-reader')).toBeVisible({timeout:30000});await noHorizontalOverflow(page,7)}
});

test('catalog and dedicated anime detail remain healthy',async({page})=>{
  await page.goto(pageUrl('/animes/catalogo'),{waitUntil:'domcontentloaded'});await expect(page.locator('.nx21-card').first()).toBeVisible({timeout:30000});expect(await page.locator('.nx21-card').count()).toBeGreaterThan(3);const card=page.locator('.nx21-card').first(),target=card.locator('h3').first();await (await target.count()?target:card).click();await page.waitForURL(u=>(new URL(u)).searchParams.get('p')?.startsWith('/anime/')===true,{timeout:15000});await expect(page.locator('.nx22-detail')).toBeVisible({timeout:30000});await expect(page.locator('.nx22-quick article')).toHaveCount(4);await noLegacy404(page);
});

test('season schedule search and auth chrome remain functional',async({page})=>{
  await page.goto(pageUrl('/animes/temporadas'),{waitUntil:'domcontentloaded'});await waitForAny(page,['.nx-season-card','.nx-season']);await noLegacy404(page);await page.goto(pageUrl('/animes/programacao'),{waitUntil:'domcontentloaded'});await waitForAny(page,['[data-nx18-open]','.nx18-schedule','.nx18-island'],30000);await noLegacy404(page);await page.locator('[data-action="search"]').first().click();await expect(page.locator('#searchOverlay')).toBeVisible();await page.keyboard.press('Escape');await page.locator('[data-action="login"]').first().click();await expect(page.locator('#authOverlay')).toBeVisible();
});
