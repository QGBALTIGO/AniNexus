import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const origin = process.env.ANINEXUS_E2E_ORIGIN || 'http://qgbaltigo.github.io:4174/AniNexus/';
const output = process.env.ANINEXUS_VISUAL_OUTPUT || 'test-results/visual-v42';
const executablePath = process.env.ANINEXUS_CHROMIUM_EXECUTABLE_PATH || undefined;
const requestedCase = String(process.env.ANINEXUS_VISUAL_CASE || '').trim();
const mappedHost = new URL(origin).hostname === 'qgbaltigo.github.io';
const buildUrl = route => `${origin}?build=44.21.0&p=${encodeURIComponent(route)}`;
const artwork = new URL('assets/logo.png', origin).href;
const communityArtwork = new URL('assets/radio-background-v44.png', origin).href;
const media = (id, type = 'ANIME') => ({
  id,
  type,
  title: { romaji: `Obra de teste ${id}`, english: `Obra de teste ${id}`, native: `Obra ${id}`, userPreferred: `Obra de teste ${id}` },
  coverImage: { extraLarge: artwork, large: artwork },
  bannerImage: artwork,
  averageScore: 80 + (id % 10),
  popularity: 12_000 + id,
  favourites: 800 + id,
  genres: type === 'MANGA' ? ['Adventure', 'Drama'] : ['Action', 'Fantasy'],
  episodes: type === 'MANGA' ? null : 12,
  chapters: type === 'MANGA' ? 84 : null,
  volumes: type === 'MANGA' ? 10 : null,
  format: type === 'MANGA' ? 'MANGA' : 'TV',
  status: 'RELEASING',
  seasonYear: 2026,
  description: 'Uma história sobre escolhas, amizade e descobertas em um universo cheio de possibilidades.',
  externalLinks: [],
  startDate: { year: 2026, month: 7, day: 4 },
  endDate: null,
  studios: { nodes: [{ name: 'Estúdio AniNexus' }] },
  relations: { edges: [] },
  recommendations: { nodes: [] },
  characters: { edges: [] },
  staff: { edges: [] },
});
const graphData = (query = '', variables = {}) => {
  const type = /type\s*:\s*MANGA/.test(query) ? 'MANGA' : 'ANIME';
  const currentPage = Number(variables.page || 1), requestedCount = Math.min(25, Number(variables.perPage || 12));
  const ids = Array.isArray(variables.ids) && variables.ids.length ? variables.ids : Array.from({ length: requestedCount }, (_, index) => currentPage * 1000 + 101 + index);
  const items = ids.map(Number).filter(Boolean).map(id => media(id, type));
  const airingAt = Number(variables.start) || Math.floor(Date.now() / 1000) + 3600;
  const Page = { pageInfo: { total: 5000, currentPage, lastPage: 200, hasNextPage: currentPage < 200 }, media: items, airingSchedules: items.slice(0, 6).map((item, index) => ({ airingAt: airingAt + 3600 * index, episode: index + 1, media: item })) };
  if (/\bseason:Page/.test(query)) return { season: Page, schedule: Page, top: Page, popular: Page, soon: Page, reading: { ...Page, media: items.map(item => media(item.id, 'MANGA')) } };
  const aliases = [...query.matchAll(/\b(a\d+):Media/g)].map(match => match[1]);
  if (aliases.length) return Object.fromEntries(aliases.map((key, index) => [key, media(201 + index, type)]));
  if (/\bMedia\s*\(/.test(query) && !/\bmedia\s*\(/.test(query)) return { Media: media(Number(variables.id) || 101, type) };
  return { Page };
};
const cases = [
  { name: 'mobile-home-dark', route: '/', selector: '.nx35-home', ready: '.nx35-anime', width: 390, height: 844, theme: 'dark' },
  { name: 'desktop-home-dark', route: '/', selector: '.nx35-home', ready: '.nx35-anime', width: 1440, height: 900, theme: 'dark' },
  { name: 'mobile-community-dark', route: '/comunidade', selector: '.nx40-community', ready: '.nx40-tabs', width: 390, height: 844, theme: 'dark' },
  { name: 'mobile-mangas-light', route: '/mangas', selector: '.nx21-catalog-page.nx21-reading-page', ready: '.nx21-card', width: 390, height: 844, theme: 'light' },
  { name: 'mobile-mangas-dark', route: '/mangas', selector: '.nx21-catalog-page.nx21-reading-page', ready: '.nx21-card', width: 390, height: 844, theme: 'dark' },
  { name: 'tablet-mangas-dark', route: '/mangas', selector: '.nx21-catalog-page.nx21-reading-page', ready: '.nx21-card', width: 768, height: 1024, theme: 'dark' },
  { name: 'desktop-mangas-dark', route: '/mangas', selector: '.nx21-catalog-page.nx21-reading-page', ready: '.nx21-card', width: 1440, height: 900, theme: 'dark' },
  { name: 'mobile-catalog-dark', route: '/animes/catalogo', selector: '.nx21-catalog-page', ready: '.nx21-card', width: 390, height: 844, theme: 'dark' },
  { name: 'tablet-catalog-dark', route: '/animes/catalogo', selector: '.nx21-catalog-page', ready: '.nx21-card', width: 768, height: 1024, theme: 'dark' },
  { name: 'desktop-catalog-dark', route: '/animes/catalogo', selector: '.nx21-catalog-page', ready: '.nx21-card', width: 1440, height: 900, theme: 'dark' },
  { name: 'mobile-schedule-dark', route: '/animes/programacao', selector: '.nx18-schedule', ready: '.nx18-card', width: 390, height: 844, theme: 'dark' },
  { name: 'tablet-schedule-dark', route: '/animes/programacao', selector: '.nx18-schedule', ready: '.nx18-card', width: 768, height: 1024, theme: 'dark' },
  { name: 'desktop-schedule-dark', route: '/animes/programacao', selector: '.nx18-schedule', ready: '.nx18-card', width: 1440, height: 900, theme: 'dark' },
  { name: 'mobile-season-dark', route: '/animes/temporadas', selector: '.nx-season', ready: '.nx-season-card', width: 390, height: 844, theme: 'dark' },
  { name: 'desktop-season-dark', route: '/animes/temporadas', selector: '.nx-season', ready: '.nx-season-card', width: 1440, height: 900, theme: 'dark' },
  { name: 'mobile-news-dark', route: '/noticias', selector: '.nx35-news-page', ready: '.nx35-ncard', width: 390, height: 844, theme: 'dark' },
  { name: 'desktop-news-dark', route: '/noticias', selector: '.nx35-news-page', ready: '.nx35-ncard', width: 1440, height: 900, theme: 'dark' },
  { name: 'desktop-detail-light', route: '/anime/obra-de-teste-101', selector: '.nx22-detail:not(.nx22-fail)', ready: '.nx22-hero', width: 1440, height: 900, theme: 'light' },
];
const selectedCases = requestedCase ? cases.filter(item => item.name === requestedCase) : cases;
if (!selectedCases.length) throw new Error(`Unknown visual case: ${requestedCase}`);

await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath,
  args: mappedHost ? ['--host-resolver-rules=MAP qgbaltigo.github.io 127.0.0.1'] : [],
});
const results = [];

try {
  for (const item of selectedCases) {
    const context = await browser.newContext({
      viewport: { width: item.width, height: item.height },
      colorScheme: item.theme,
      locale: 'pt-BR',
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error?.message || error)));
    await page.route('**/runtime-config.js*', route => route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `window.__ANINEXUS_CONFIG__=Object.freeze({environment:'visual',siteOrigin:'https://qgbaltigo.github.io/AniNexus',apiOrigin:'https://graphql.anilist.co',clerkPublishableKey:'pk_test_visual',authEnabled:true});`,
    }));
    const fulfillCatalog = route => {
      const url = new URL(route.request().url()), currentPage = Number(url.searchParams.get('page') || 1), type = url.pathname.endsWith('/reading') ? 'MANGA' : 'ANIME';
      const items = Array.from({ length: 25 }, (_, index) => ({ ...media(currentPage * 1000 + 101 + index, type), metricsSource: 'aninexus', ratingCount: 30, listCount: 80 }));
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items, pageInfo: { total: 5000, currentPage, lastPage: 200, hasNextPage: currentPage < 200 } }) });
    };
    await page.route('**/api/catalog?**', fulfillCatalog);
    await page.route('**/api/reading?**', fulfillCatalog);
    await page.route('https://graphql.anilist.co/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/catalog' || url.pathname === '/api/reading') return fulfillCatalog(route);
      let body = {};
      try { body = route.request().postDataJSON() || {}; } catch {}
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: graphData(body.query, body.variables) }) });
    });
    await page.addInitScript(theme => {
      localStorage.setItem('aninexus:theme', theme);
      localStorage.setItem('aninexus:privacy:v1', JSON.stringify({ analytics: false, at: Date.now() }));
    }, item.theme);
    if (item.route === '/') {
      await page.addInitScript(({ cover, avatar }) => localStorage.setItem('aninexus:community:activity:v40', JSON.stringify(Array.from({ length: 3 }, (_, index) => ({
        id: `visual-community-${index}`,
        kind: 'state',
        media_id: 101 + index,
        username: index === 1 ? 'kayky' : 'ani_member',
        display_name: index === 1 ? 'Kayky Sousa' : 'Membro AniNexus',
        avatar_url: avatar,
        status: ['CURRENT', 'PLANNING', 'COMPLETED'][index],
        created_at: new Date(Date.now() - index * 3_600_000).toISOString(),
        title: `Obra de teste ${101 + index}`,
        cover,
        banner: cover,
        media: { id: 101 + index, title: `Obra de teste ${101 + index}`, cover },
      })))), { cover: communityArtwork, avatar: artwork });
    }
    await page.goto(buildUrl(item.route), { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.locator(item.selector).first().waitFor({ state: 'visible', timeout: 30_000 });
    await page.locator(item.ready).first().waitFor({ state: 'visible', timeout: 30_000 });
    const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < scrollHeight; y += Math.max(320, Math.floor(item.height * 0.72))) {
      await page.evaluate(top => scrollTo({ top, behavior: 'instant' }), y);
      await page.waitForTimeout(35);
    }
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(300);
    const geometry = await page.evaluate(() => ({
      viewport: innerWidth,
      document: document.documentElement.scrollWidth,
      title: document.title,
      theme: document.documentElement.dataset.theme,
    }));
    await page.screenshot({ path: `${output}/${item.name}-viewport.png` });
    await page.screenshot({ path: `${output}/${item.name}.png`, fullPage: true });
    if (item.route === '/') {
      const reading = page.locator('#nx35Reading').locator('xpath=ancestor::section[1]');
      const trailers = page.locator('.nx42-trailers-section');
      await reading.scrollIntoViewIfNeeded();
      await reading.screenshot({ path: `${output}/${item.name}-reading.png` });
      await trailers.waitFor({ state: 'visible', timeout: 15_000 });
      await trailers.scrollIntoViewIfNeeded();
      await trailers.screenshot({ path: `${output}/${item.name}-trailers.png` });
      await trailers.locator('.nx42-trailer').first().click();
      const trailerModal = page.locator('.nx42-trailer-modal');
      await trailerModal.waitFor({ state: 'visible', timeout: 10_000 });
      await page.screenshot({ path: `${output}/${item.name}-trailer-modal.png` });
      await page.keyboard.press('Escape');
      await trailerModal.waitFor({ state: 'detached', timeout: 3_000 });
    }
    if (item.name === 'desktop-home-dark') {
      await page.locator('.nx35-live').screenshot({ path: `${output}/desktop-home-community-panel.png` });
      await page.locator('#nx35Schedule').locator('xpath=ancestor::section[1]').screenshot({ path: `${output}/desktop-home-schedule.png` });
    }
    if (item.name === 'desktop-catalog-dark') {
      await page.evaluate(() => { scrollTo({ top: 520, behavior: 'instant' }); dispatchEvent(new Event('scroll')); });
      await page.waitForFunction(() => document.body.classList.contains('nx21-catalog-scroll-down'));
      await page.waitForTimeout(450);
      await page.screenshot({ path: `${output}/desktop-catalog-dark-scrolled.png` });
      await page.screenshot({ path: `${output}/desktop-catalog-dark-scroll-down.png` });
      await page.evaluate(() => { scrollTo({ top: Math.max(90, scrollY - 150), behavior: 'instant' }); dispatchEvent(new Event('scroll')); });
      await page.waitForFunction(() => document.body.classList.contains('nx21-catalog-scroll-up'));
      await page.waitForTimeout(450);
      await page.screenshot({ path: `${output}/desktop-catalog-dark-scroll-up.png` });
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
      await page.locator('#nx21Hero').getByRole('button', { name: 'Busca', exact: true }).click();
      await page.locator('#nx21Hero').getByRole('button', { name: 'Filtros', exact: true }).click();
      await page.getByRole('dialog', { name: 'Filtros' }).waitFor({ state: 'visible' });
      await page.screenshot({ path: `${output}/desktop-catalog-dark-filters.png` });
    }
    if (item.name === 'mobile-catalog-dark') {
      await page.locator('[data-nx21-menu]:visible').first().click();
      const menu = page.getByRole('dialog', { name: 'Menu' });
      await menu.waitFor({ state: 'visible' });
      await page.waitForTimeout(280);
      await page.screenshot({ path: `${output}/mobile-catalog-dark-menu.png` });
      await menu.getByRole('button', { name: 'Ranking', exact: true }).click();
      await page.waitForFunction(() => document.querySelectorAll('.nx21-rank').length === 100);
      await page.screenshot({ path: `${output}/mobile-catalog-dark-ranking.png` });
      await page.locator('[data-nx21-menu]:visible').first().click();
      await page.getByRole('dialog', { name: 'Menu' }).getByRole('button', { name: 'Mais populares', exact: true }).click();
      try {
        await page.locator('.nx21-card').first().waitFor({ state: 'visible' });
      } catch (error) {
        const state = await page.evaluate(() => { const card = document.querySelector('.nx21-card'), results = document.querySelector('#nx21Results'); return { cards: document.querySelectorAll('.nx21-card').length, classes: document.body.className, scrollY, results: results?.textContent?.trim().slice(0, 160), card: card ? { classes: card.className, visibility: getComputedStyle(card).visibility, opacity: getComputedStyle(card).opacity, top: card.getBoundingClientRect().top } : null }; });
        throw new Error(`Popular catalog did not reveal: ${JSON.stringify(state)}`, { cause: error });
      }
      await page.screenshot({ path: `${output}/mobile-catalog-dark-popular.png` });
      await page.locator('[data-nx21-menu]:visible').first().click();
      await page.getByRole('dialog', { name: 'Menu' }).getByRole('button', { name: 'Busca', exact: true }).click();
      await page.locator('[data-nx21-search]:visible').first().waitFor({ state: 'visible' });
      await page.screenshot({ path: `${output}/mobile-catalog-dark-search.png` });
      await page.evaluate(() => { scrollTo({ top: 520, behavior: 'instant' }); dispatchEvent(new Event('scroll')); });
      await page.waitForFunction(() => document.body.classList.contains('nx21-catalog-scroll-down'));
      await page.waitForTimeout(450);
      await page.screenshot({ path: `${output}/mobile-catalog-dark-scrolled.png` });
      await page.screenshot({ path: `${output}/mobile-catalog-dark-scroll-down.png` });
      await page.evaluate(() => { scrollTo({ top: Math.max(90, scrollY - 130), behavior: 'instant' }); dispatchEvent(new Event('scroll')); });
      await page.waitForFunction(() => document.body.classList.contains('nx21-catalog-scroll-up'));
      await page.waitForTimeout(450);
      await page.screenshot({ path: `${output}/mobile-catalog-dark-scroll-up.png` });
    }
    if (item.name === 'mobile-mangas-light' || item.name === 'mobile-mangas-dark') {
      const mangaPrefix = item.name;
      await page.locator('[data-nx21-menu]:visible').first().click();
      const menu = page.getByRole('dialog', { name: 'Menu' });
      await menu.waitFor({ state: 'visible' });
      await page.waitForTimeout(280);
      await page.screenshot({ path: `${output}/${mangaPrefix}-menu.png` });
      await menu.getByRole('button', { name: 'Ranking', exact: true }).click();
      await page.waitForFunction(() => document.querySelectorAll('.nx21-rank').length === 100);
      await page.screenshot({ path: `${output}/${mangaPrefix}-ranking.png` });
      await page.locator('[data-nx21-menu]:visible').first().click();
      await page.getByRole('dialog', { name: 'Menu' }).getByRole('button', { name: 'Busca', exact: true }).click();
      await page.locator('[data-nx21-search]:visible').first().waitFor({ state: 'visible' });
      await page.screenshot({ path: `${output}/${mangaPrefix}-search.png` });
    }
    if (item.name === 'desktop-mangas-dark') {
      await page.locator('#nx21Hero').getByRole('button', { name: 'Ranking', exact: true }).click();
      await page.waitForFunction(() => document.querySelectorAll('.nx21-rank').length === 100);
      await page.screenshot({ path: `${output}/desktop-mangas-dark-ranking.png` });
    }
    if (item.route === '/animes/programacao') {
      const target = await page.locator('#nx18Hero').evaluate(hero => Math.ceil(hero.offsetHeight + 220));
      await page.evaluate(top => { scrollTo({ top, behavior: 'instant' }); dispatchEvent(new Event('scroll')); }, target);
      await page.waitForFunction(() => document.body.classList.contains('nx18-header-hidden') && document.querySelector('#nx18Island')?.classList.contains('show'));
      await page.waitForTimeout(420);
      await page.screenshot({ path: `${output}/${item.name}-scroll-down.png` });
      await page.evaluate(() => { scrollTo({ top: Math.max(90, scrollY - 130), behavior: 'instant' }); dispatchEvent(new Event('scroll')); });
      await page.waitForFunction(() => !document.body.classList.contains('nx18-header-hidden') && document.querySelector('#nx18Island')?.classList.contains('expanded'));
      await page.waitForTimeout(420);
      await page.screenshot({ path: `${output}/${item.name}-scroll-up.png` });
    }
    if (item.route === '/animes/temporadas') {
      const target = await page.locator('.nx-season-hero').evaluate(hero => Math.ceil(hero.offsetHeight + 240));
      await page.evaluate(top => { scrollTo({ top, behavior: 'instant' }); dispatchEvent(new Event('scroll')); }, target);
      await page.waitForFunction(() => document.body.classList.contains('nx-scroll-down') && document.querySelector('.nx-v10-seasonbar')?.classList.contains('show'));
      await page.waitForTimeout(420);
      await page.screenshot({ path: `${output}/${item.name}-scroll-down.png` });
      await page.evaluate(() => { scrollTo({ top: Math.max(90, scrollY - 140), behavior: 'instant' }); dispatchEvent(new Event('scroll')); });
      await page.waitForFunction(() => document.body.classList.contains('nx-scroll-up') && document.querySelector('.nx-v10-seasonbar')?.classList.contains('expanded'));
      await page.waitForTimeout(420);
      await page.screenshot({ path: `${output}/${item.name}-scroll-up.png` });
    }
    if (item.route === '/noticias') {
      const target = await page.locator('#nx35NewsHero').evaluate(hero => Math.ceil(hero.offsetHeight + 240));
      await page.evaluate(top => { scrollTo({ top, behavior: 'instant' }); dispatchEvent(new Event('scroll')); }, target);
      await page.waitForFunction(() => document.body.classList.contains('nx35-news-scroll-down') && document.querySelector('#nx35NewsIsland')?.classList.contains('show'));
      await page.waitForTimeout(420);
      await page.screenshot({ path: `${output}/${item.name}-scroll-down.png` });
      await page.evaluate(() => { scrollTo({ top: Math.max(90, scrollY - 140), behavior: 'instant' }); dispatchEvent(new Event('scroll')); });
      await page.waitForFunction(() => document.body.classList.contains('nx35-news-scroll-up') && document.querySelector('#nx35NewsIsland')?.classList.contains('expanded'));
      await page.waitForTimeout(420);
      await page.screenshot({ path: `${output}/${item.name}-scroll-up.png` });
    }
    results.push({ name: item.name, ...geometry, errors });
    await context.close();
  }
} finally {
  await browser.close();
}

const failed = results.filter(item => item.document > item.viewport + 2 || item.errors.length || item.theme !== selectedCases.find(entry => entry.name === item.name)?.theme);
for (const result of results) console.log(JSON.stringify(result));
if (failed.length) {
  console.error(`Visual smoke failed for: ${failed.map(item => item.name).join(', ')}`);
  process.exitCode = 1;
}
