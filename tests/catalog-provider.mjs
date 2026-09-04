import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL = 'postgres://aninexus:aninexus@127.0.0.1:1/aninexus';
process.env.REDIS_URL = 'redis://127.0.0.1:1';
process.env.PERSIST_MEDIA_CACHE = 'false';

const requests = [];
globalThis.fetch = async (_url, options = {}) => {
  const body = JSON.parse(options.body || '{}');
  requests.push(body);
  const page = Number(body.variables?.page || 1);
  const reading = body.query?.includes('type:MANGA');
  const media = Array.from({ length: 25 }, (_, index) => ({
    id: page * 1000 + index + 1,
    type: reading ? 'MANGA' : 'ANIME',
    title: body.variables?.minimumPopularity && index === 0
      ? { english: '(Title to be Announced)', romaji: '(Title to be Announced)', native: '' }
      : { english: `${reading ? 'Mangá' : 'Anime'} ${page}-${index + 1}`, romaji: `${reading ? 'Manga' : 'Anime'} ${page}-${index + 1}`, native: '' },
    coverImage: body.variables?.minimumPopularity && index === 0
      ? { extraLarge: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/default.jpg', large: '', color: null }
      : { extraLarge: 'https://example.com/poster.jpg', large: 'https://example.com/poster.jpg', color: '#a61b38' },
    genres: ['Action'], tags: [], episodes: reading ? null : 12, chapters: reading ? 20 : null, volumes: reading ? 3 : null,
    format: reading ? (body.variables?.format || 'MANGA') : 'TV', status: 'FINISHED', seasonYear: reading ? null : 2026,
    startDate: { year: 2026, month: 1, day: 1 }, endDate: null, studios: { nodes: [] }, externalLinks: [],
    ...(body.variables?.season ? { relations: { edges: [{ relationType: 'PREQUEL' }] } } : {})
  }));
  return new Response(JSON.stringify({ data: { Page: { pageInfo: { total: 5000, currentPage: page, lastPage: 200, hasNextPage: page < 200 }, media } } }), { status: 200, headers: { 'content-type': 'application/json' } });
};

const { getCatalog, getReading } = await import('../lib/provider.mjs');
const { pool } = await import('../lib/db.mjs');

test('catalog omits inactive optional variables and keeps deep pagination', async () => {
  const result = await getCatalog({ page: 2, perPage: 25, sort: 'NEW' });
  assert.equal(result.items.length, 25);
  assert.equal(result.pageInfo.total, 5000);
  assert.equal(result.pageInfo.currentPage, 2);
  const variables = requests.at(-1).variables;
  assert.deepEqual(Object.keys(variables).sort(), ['page', 'perPage', 'sort']);
  assert.equal(variables.page, 2);
});

test('catalog sends only filters that the visitor selected', async () => {
  await getCatalog({ page: 1, perPage: 25, sort: 'NEW', search: 'Naruto', genre: 'Action', format: 'TV', year: 2002 });
  assert.deepEqual(requests.at(-1).variables, {
    page: 1, perPage: 25, sort: ['START_DATE_DESC'], search: 'Naruto', genre: 'Action', format: 'TV', year: 2002
  });
});

test('catalog discovery requests relevant titles and removes provisional covers', async () => {
  const result = await getCatalog({ page: 3, perPage: 25, sort: 'DISCOVER', discover: 500 });
  assert.equal(result.items.length, 24);
  assert.equal(requests.at(-1).variables.minimumPopularity, 500);
  assert.deepEqual(requests.at(-1).variables.sort, ['POPULARITY_DESC']);
  assert.match(requests.at(-1).query, /popularity_greater:\$minimumPopularity/);
  assert.ok(result.items.every(item => !/Title to be Announced/i.test(item.title)));
});

test('reading catalog mirrors discovery, format and search filters', async () => {
  const result = await getReading({
    page: 4, perPage: 25, sort: 'DISCOVER', discover: 300, format: 'ONE_SHOT',
    status: 'FINISHED', year: 2024, genre: 'Drama', tag: 'School'
  });
  assert.equal(result.items.length, 24);
  assert.deepEqual(requests.at(-1).variables, {
    page: 4, perPage: 25, sort: ['POPULARITY_DESC'], genre: 'Drama', tag: 'School',
    format: 'ONE_SHOT', status: 'FINISHED', startDateGreater: 20240000,
    startDateLesser: 20241231, minimumPopularity: 300
  });
  assert.match(requests.at(-1).query, /type:MANGA/);
  assert.match(requests.at(-1).query, /startDate_greater:\$startDateGreater/);
});

test('season discovery preserves pagination and sequel metadata without community sorting', async () => {
  const result = await getCatalog({ page: 6, perPage: 30, sort: 'DISCOVER', season: 'SUMMER', year: 2026 });
  const request = requests.at(-1);
  assert.deepEqual(request.variables.sort, ['POPULARITY_DESC', 'ID']);
  assert.equal(request.variables.page, 6);
  assert.equal(request.variables.season, 'SUMMER');
  assert.equal(result.pageInfo.hasNextPage, true);
  assert.match(request.query, /relations\{edges\{relationType\}\}/);
  assert.deepEqual(result.items[0].relationTypes, ['PREQUEL']);
});

test('community-only reading orders never fall back to external popularity', async () => {
  const before = requests.length;
  const result = await getReading({ page: 1, perPage: 25, sort: 'POPULAR', communityOnly: 1 });
  assert.equal(result.items.length, 0);
  assert.equal(requests.length, before);
});

test.after(async () => { await pool.end(); });
