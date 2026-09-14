import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { achievementCatalog, levelFromXp } from '../lib/achievements.mjs';

const ORIGIN = process.env.ANINEXUS_E2E_ORIGIN || 'http://qgbaltigo.github.io:4173/AniNexus/';
const LOCAL_STATIC_ORIGIN = process.env.ANINEXUS_LOCAL_STATIC_ORIGIN || '';
const pageUrl = route => `${ORIGIN}?build=44.57.1&p=${encodeURIComponent(route)}`;
const pixel = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
const achievementDefinitions = achievementCatalog();
const achievementItems = achievementDefinitions.map((item, index) => ({
  ...item,
  progress: index < 18 ? item.target : Math.max(0, Math.min(item.target - 1, Math.ceil(item.target * .62))),
  unlocked: index < 18,
  unlockedAt: index < 18 ? '2026-09-03T15:00:00.000Z' : null,
  pinnedSlot: index === 0 ? 1 : index === 7 ? 2 : null,
}));
const achievementXp = achievementItems.filter(item => item.unlocked).reduce((total, item) => total + item.xp, 0);
const achievementPayload = {
  total: 40, unlockedCount: 18, percentage: 45, xp: achievementXp, level: levelFromXp(achievementXp),
  items: achievementItems, pins: [achievementDefinitions[0].id, achievementDefinitions[7].id],
  availableTitles: ['Enciclopédia Viva'], equippedTitle: 'Enciclopédia Viva',
  preferences: { shareFeed: true, timezone: 'America/Cuiaba' },
};
const publicProfilePayload = {
  profile: {
    username: 'accessibility', displayName: 'Perfil de teste', avatarUrl: pixel, bannerUrl: pixel,
    bio: 'Perfil público usado para verificar a experiência acessível.', location: 'Cuiabá, MT',
    websiteUrl: 'https://example.com', instagramHandle: 'accessibility', role: 'user', privacy: 'public',
    isPrivate: false, createdAt: '2026-01-01T00:00:00.000Z',
  },
  social: { followers: 12, following: 8 },
  stats: {
    list_total: 18, manga_total: 7, total_titles: 25, watching: 4, reading: 2, completed: 10,
    manga_completed: 3, episodes_watched: 320, chapters_read: 144, average_score: 8.7,
    manga_average_score: 8.4, overall_average_score: 8.6,
    statuses: [{ media_type: 'ANIME', status: 'CURRENT', total: 4 }, { media_type: 'ANIME', status: 'COMPLETED', total: 10 }],
    scores: [{ media_type: 'ANIME', score: 8, total: 6 }, { media_type: 'ANIME', score: 9, total: 9 }],
    formats: [{ media_type: 'ANIME', format: 'TV', total: 16 }, { media_type: 'ANIME', format: 'MOVIE', total: 2 }],
    years: [{ media_type: 'ANIME', year: 2025, total: 7 }, { media_type: 'ANIME', year: 2026, total: 11 }],
  },
  rank: { name: 'Nível Nexus 4', xp: 320, levelFloor: 250, nextXp: 450 },
  library: [{ media_id: 101, status: 'CURRENT', progress: 5, score: 9, updated_at: '2026-09-14T12:00:00.000Z', media: { id: 101, title: 'Anime Teste 101', cover: pixel, episodes: 12, format: 'TV' } }],
  mangaLibrary: [{ media_id: 201, status: 'CURRENT', progress: 12, score: 8, updated_at: '2026-09-14T11:00:00.000Z', media: { id: 201, title: 'Mangá Teste', cover: pixel, format: 'MANGA' } }],
  favorites: [{ media_id: 101, media_type: 'ANIME', media: { id: 101, title: 'Anime Teste 101', cover: pixel } }],
  favoriteCharacters: [{ id: 40, name: 'Monkey D. Luffy', image: pixel, work: 'ONE PIECE' }],
  activity: [{ media_id: 101, status: 'CURRENT', progress: 5, created_at: '2026-09-14T12:00:00.000Z', media: { id: 101, title: 'Anime Teste 101', cover: pixel } }],
  impressions: [{ id: 'one', media_id: 101, body: 'Uma ótima estreia.', spoiler: false, created_at: '2026-09-14T12:00:00.000Z', media: { id: 101, title: 'Anime Teste 101', cover: pixel } }],
  connections: { following: [{ username: 'nami', displayName: 'Nami', avatarUrl: pixel }], followers: [{ username: 'zoro', displayName: 'Zoro', avatarUrl: pixel }] },
  achievements: [], pinnedAchievements: [],
};

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
      if (!/ECONNRESET|ECONNREFUSED|socket hang up/i.test(String(error?.message)) || attempt === 2) throw error;
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
  const pageAliases = [...query.matchAll(/\b(a\d+):Page/g)].map(match => match[1]);
  if (pageAliases.length) return Object.fromEntries(pageAliases.map((key, index) => [key, { media: [media(201 + index)] }]));
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
  const catalogItems = [101, 102, 103, 104].map(id => ({ ...media(id), externalLinks: [{ site: id % 2 ? 'Crunchyroll' : 'Netflix', url: `https://stream.example/${id}`, type: 'STREAMING' }] }));
  await page.route('**/api/catalog?**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: catalogItems, pageInfo: { total: 4, currentPage: 1, lastPage: 1, hasNextPage: false } }) }));
  await page.route('**/api/dublados?**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: catalogItems, pageInfo: { total: 4, currentPage: 1, lastPage: 1, hasNextPage: false } }) }));
  await page.route('**/api/studios?**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [{ id: 1, name: 'Estúdio Teste', mediaTotal: 12, media: catalogItems }], pageInfo: { total: 1, currentPage: 1, lastPage: 1, hasNextPage: false } }) }));
  await page.route('**/api/list/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: catalogItems, pageInfo: { total: 4, currentPage: 1, lastPage: 1, hasNextPage: false } }) }));
  await page.route('**/api/lists', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/achievements/catalog', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ total: 40, items: achievementDefinitions }) }));
  await page.route(/\/api\/me\/achievements(?:\/.*)?(?:\?.*)?$/, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(achievementPayload) }));
  await page.route(/\/api\/users\/accessibility(?:\?.*)?$/, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(publicProfilePayload) }));
});
test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: 'ignoreErrors' }); });

for (const route of ['/', '/animes/catalogo', '/animes/onde-assistir', '/animes/dublados', '/animes/estudios', '/melhores-animes-para-assistir', '/animes-mais-assistidos', '/animes-mais-aguardados', '/listas-de-animes', '/mangas', '/animes/programacao', '/anime-awards', '/anime/anime-teste-101', '/comunidade', '/noticias', '/conquistas', '/u/accessibility', '/login', '/admin', '/quem-somos', '/termos-de-uso']) {
  test(`WCAG AA sem falhas sérias em ${route}`, async ({ page }) => {
    if (route === '/u/accessibility') {
      test.slow();
      await page.route('**/runtime-config.js*', request => request.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: "window.__ANINEXUS_CONFIG__=Object.freeze({environment:'test',siteOrigin:'https://qgbaltigo.github.io/AniNexus',apiOrigin:'https://graphql.anilist.co',clerkPublishableKey:'pk_test_profile_accessibility',authEnabled:true});",
      }));
    }
    await page.goto(pageUrl(route), { waitUntil: 'domcontentloaded' });
    await page.locator('#app main').first().waitFor({ state: 'visible', timeout: 30_000 });
    if (route === '/comunidade') {
      await expect(page.locator('html')).toHaveClass(/nx40-community-ready/);
      await expect(page.locator('#app')).toHaveCSS('opacity', '1');
    }
    const profileTabs = route === '/u/accessibility'
      ? ['overview', 'all', 'manga', 'characters', 'statistics', 'social', 'achievements']
      : [null];
    for (const tab of profileTabs) {
      if (tab && tab !== 'overview') await page.locator(`[data-profile-tab="${tab}"]`).click();
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      const blocking = results.violations.filter(item => ['serious', 'critical'].includes(item.impact));
      const summary = blocking.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target.join(' ')).slice(0, 30) }));
      expect(summary, `${tab || route}\n${blocking.map(item => `${item.id}: ${item.help} (${item.nodes.length})`).join('\n')}`).toEqual([]);
    }
  });
}
