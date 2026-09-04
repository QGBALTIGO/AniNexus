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
  const media = Array.from({ length: 25 }, (_, index) => ({
    id: page * 1000 + index + 1,
    type: 'ANIME',
    title: { english: `Anime ${page}-${index + 1}`, romaji: `Anime ${page}-${index + 1}`, native: '' },
    coverImage: { extraLarge: 'https://example.com/poster.jpg', large: 'https://example.com/poster.jpg', color: '#a61b38' },
    genres: ['Action'], tags: [], episodes: 12, format: 'TV', status: 'FINISHED', seasonYear: 2026,
    startDate: { year: 2026, month: 1, day: 1 }, endDate: null, studios: { nodes: [] }, externalLinks: []
  }));
  return new Response(JSON.stringify({ data: { Page: { pageInfo: { total: 5000, currentPage: page, lastPage: 200, hasNextPage: page < 200 }, media } } }), { status: 200, headers: { 'content-type': 'application/json' } });
};

const { getCatalog } = await import('../lib/provider.mjs');
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

test.after(async () => { await pool.end(); });
