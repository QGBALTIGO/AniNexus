import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const ORIGIN = process.env.ANINEXUS_E2E_ORIGIN || 'http://qgbaltigo.github.io:4173/AniNexus/';
const LOCAL_STATIC_ORIGIN = process.env.ANINEXUS_LOCAL_STATIC_ORIGIN || '';
const pageUrl = route => `${ORIGIN}?build=44.4.0&p=${encodeURIComponent(route)}`;
const pixel = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

async function fulfillLocalStatic(route) {
  const requested = new URL(route.request().url());
  const local = new URL(requested.pathname + requested.search, LOCAL_STATIC_ORIGIN);
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await route.fetch({ url: local.href });
      return await route.fulfill({ response });
    } catch (error) {
      lastError = error;
      if (!/ECONNRESET|socket hang up/i.test(String(error?.message)) || attempt === 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }
  throw lastError;
}

function media(id = 101) {
  return { id, title: { romaji: `Anime ${id}`, english: `Anime ${id}`, userPreferred: `Anime ${id}` }, coverImage: { extraLarge: pixel, large: pixel }, bannerImage: pixel, averageScore: 82, popularity: 1000, genres: ['Action'], episodes: 12, format: 'TV', status: 'RELEASING', seasonYear: 2026, description: 'Sinopse em português.', externalLinks: [], startDate: { year: 2026, month: 1, day: 1 }, endDate: null, studios: { nodes: [] }, relations: { edges: [] }, recommendations: { nodes: [] }, characters: { edges: [] }, staff: { edges: [] } };
}

function graphData(query = '', variables = {}) {
  const ids = Array.isArray(variables.ids) && variables.ids.length ? variables.ids : [101, 102, 103, 104];
  const items = ids.map(Number).filter(Boolean).map(media);
  const airingAt = Number(variables.start) || Math.floor(Date.now() / 1000) + 3600;
  const Page = { pageInfo: { total: items.length, currentPage: 1, lastPage: 1, hasNextPage: false }, media: items, airingSchedules: items.map((item, index) => ({ airingAt: airingAt + 3600 * (index + 1), episode: index + 1, media: item })) };
  if (/\bseason:Page/.test(query)) return { season: Page, schedule: Page, top: Page, popular: Page, soon: Page, reading: Page };
  const aliases = [...query.matchAll(/\b(a\d+):Media/g)].map(match => match[1]);
  if (aliases.length) return Object.fromEntries(aliases.map((key, index) => [key, media(201 + index)]));
  if (/\bMedia\s*\(/.test(query) && !/\bmedia\s*\(/.test(query)) return { Media: media(Number(variables.id) || 101) };
  return { Page };
}

test.beforeEach(async ({ page }) => {
  if (LOCAL_STATIC_ORIGIN) {
    const publicOrigin = new URL(ORIGIN).origin;
    await page.route(`${publicOrigin}/**`, fulfillLocalStatic);
  }
  await page.route('https://graphql.anilist.co/', async route => {
    let body = {}; try { body = route.request().postDataJSON() || {}; } catch {}
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: graphData(body.query, body.variables) }) });
  });
});

for (const route of ['/', '/animes/catalogo', '/mangas', '/animes/programacao', '/anime/anime-teste-101', '/comunidade', '/noticias', '/login', '/admin', '/quem-somos', '/termos-de-uso']) {
  test(`WCAG AA sem falhas sérias em ${route}`, async ({ page }) => {
    await page.goto(pageUrl(route), { waitUntil: 'domcontentloaded' });
    await page.locator('#app main').first().waitFor({ state: 'visible', timeout: 30_000 });
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    const blocking = results.violations.filter(item => ['serious', 'critical'].includes(item.impact));
    const summary = blocking.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target.join(' ')).slice(0, 30) }));
    expect(summary, blocking.map(item => `${item.id}: ${item.help} (${item.nodes.length})`).join('\n')).toEqual([]);
  });
}
