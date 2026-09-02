import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const origin = process.env.ANINEXUS_E2E_ORIGIN || 'http://qgbaltigo.github.io:4174/AniNexus/';
const output = process.env.ANINEXUS_VISUAL_OUTPUT || 'test-results/visual-v42';
const executablePath = process.env.ANINEXUS_CHROMIUM_EXECUTABLE_PATH || undefined;
const mappedHost = new URL(origin).hostname === 'qgbaltigo.github.io';
const buildUrl = route => `${origin}?build=44.5.0&p=${encodeURIComponent(route)}`;
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
  const ids = Array.isArray(variables.ids) && variables.ids.length ? variables.ids : Array.from({ length: 12 }, (_, index) => 101 + index);
  const items = ids.map(Number).filter(Boolean).map(id => media(id, type));
  const airingAt = Number(variables.start) || Math.floor(Date.now() / 1000) + 3600;
  const Page = { pageInfo: { total: 120, currentPage: 1, lastPage: 10, hasNextPage: true }, media: items, airingSchedules: items.slice(0, 6).map((item, index) => ({ airingAt: airingAt + 3600 * index, episode: index + 1, media: item })) };
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
  { name: 'mobile-mangas-light', route: '/mangas', selector: '.nx42-manga-page', ready: '.nx42-manga-card', width: 390, height: 844, theme: 'light' },
  { name: 'tablet-catalog-dark', route: '/animes/catalogo', selector: '.nx21-catalog-page', ready: '.nx21-card', width: 768, height: 1024, theme: 'dark' },
  { name: 'desktop-detail-light', route: '/anime/obra-de-teste-101', selector: '.nx22-detail:not(.nx22-fail)', ready: '.nx22-hero', width: 1440, height: 900, theme: 'light' },
];

await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath,
  args: mappedHost ? ['--host-resolver-rules=MAP qgbaltigo.github.io 127.0.0.1'] : [],
});
const results = [];

try {
  for (const item of cases) {
    const context = await browser.newContext({
      viewport: { width: item.width, height: item.height },
      colorScheme: item.theme,
      locale: 'pt-BR',
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error?.message || error)));
    await page.route('https://graphql.anilist.co/**', async route => {
      let body = {};
      try { body = route.request().postDataJSON() || {}; } catch {}
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: graphData(body.query, body.variables) }) });
    });
    await page.addInitScript(theme => localStorage.setItem('aninexus:theme', theme), item.theme);
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
    if (item.name === 'desktop-home-dark') {
      await page.locator('.nx35-live').screenshot({ path: `${output}/desktop-home-community-panel.png` });
      await page.locator('#nx35Schedule').locator('xpath=ancestor::section[1]').screenshot({ path: `${output}/desktop-home-schedule.png` });
    }
    results.push({ name: item.name, ...geometry, errors });
    await context.close();
  }
} finally {
  await browser.close();
}

const failed = results.filter(item => item.document > item.viewport + 2 || item.errors.length || item.theme !== cases.find(entry => entry.name === item.name)?.theme);
for (const result of results) console.log(JSON.stringify(result));
if (failed.length) {
  console.error(`Visual smoke failed for: ${failed.map(item => item.name).join(', ')}`);
  process.exitCode = 1;
}
