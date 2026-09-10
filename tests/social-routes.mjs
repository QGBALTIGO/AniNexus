import test from 'node:test';
import assert from 'node:assert/strict';
import { registerSocialRoutes } from '../lib/social-routes.mjs';

const USER_ID = '10000000-0000-4000-8000-000000000001';
const CONTENT_ID = '20000000-0000-4000-8000-000000000001';
const PARENT_ID = '30000000-0000-4000-8000-000000000001';

function harness(query, user = { id: USER_ID, username: 'teste', display_name: 'Teste' }) {
  const routes = new Map();
  const app = {};
  for (const method of ['get', 'post', 'patch', 'delete']) app[method] = (path, ...handlers) => routes.set(`${method.toUpperCase()} ${path}`, handlers.at(-1));
  registerSocialRoutes(app, {
    q: query,
    currentUser: async () => user,
    requireUser: async () => user,
    rateForUser: () => ({}),
    publicRate: {},
    safeInt: (value, min = 1, max = Number.MAX_SAFE_INTEGER) => { const number = Number(value); return Number.isSafeInteger(number) && number >= min && number <= max ? number : null; },
    withActorAvatars: rows => rows,
    hydrateCommunityMedia: async rows => rows,
    mediaProjection: `'{}'::jsonb`,
    recordContributionAchievement: async () => {},
  });
  return routes;
}

function response() {
  return { status: 200, payload: null, code(status) { this.status = status; return this; }, send(payload) { this.payload = payload; return payload; } };
}

test('creating an impression captures immutable status progress and score snapshots', async () => {
  const calls = [];
  const routes = harness(async (sql, params) => {
    calls.push({ sql, params });
    if (sql.startsWith('SELECT status,progress,score')) return { rows: [{ status: 'CURRENT', progress: 6, score: 9 }] };
    if (sql.includes('INSERT INTO impressions')) return { rows: [{ id: CONTENT_ID, created_at: new Date().toISOString(), status_snapshot: 'CURRENT', progress_snapshot: 6, score_snapshot: 9, impression_stage: 'PRELIMINARY', has_spoilers: true }] };
    throw new Error(`unexpected query: ${sql}`);
  });
  const reply = response();
  await routes.get('POST /api/anime/:id/impressions')({ params: { id: '42' }, body: { text: 'Começo seguro, ||final secreto||.', impressionStage: 'PRELIMINARY' } }, reply);
  const insert = calls.find(call => call.sql.includes('INSERT INTO impressions'));
  assert.equal(reply.status, 201);
  assert.deepEqual(insert.params, [USER_ID, 42, 'ANIME', 'Começo seguro, ||final secreto||.', false, true, 'CURRENT', 6, 9, 'PRELIMINARY']);
});

test('editing an impression reparses spoilers without updating its snapshots', async () => {
  const calls = [];
  const routes = harness(async (sql, params) => { calls.push({ sql, params }); return { rows: [{ id: CONTENT_ID, body: 'Novo ||spoiler||', has_spoilers: true, edited_at: new Date().toISOString(), status_snapshot: 'CURRENT', progress_snapshot: 6, score_snapshot: 9, impression_stage: 'PRELIMINARY' }] }; });
  const result = await routes.get('PATCH /api/impressions/:id')({ params: { id: CONTENT_ID }, body: { text: 'Novo ||spoiler||' } }, response());
  const update = calls[0];
  assert.match(update.sql, /SET body=\$3,spoiler=false,has_spoilers=\$4/);
  assert.doesNotMatch(update.sql.split('WHERE')[0], /status_snapshot|progress_snapshot|score_snapshot/);
  assert.equal(update.params[3], true);
  assert.deepEqual(result.segments.map(segment => segment.type), ['text', 'spoiler']);
});

test('editing an impression reply is author-scoped and reparses partial spoilers', async () => {
  const calls = [];
  const routes = harness(async (sql, params) => { calls.push({ sql, params }); return { rows: [{ id: PARENT_ID, body: 'Resposta com ||segredo||', has_spoilers: true, edited_at: new Date().toISOString() }] }; });
  const result = await routes.get('PATCH /api/impressions/:id/replies/:replyId')({ params: { id: CONTENT_ID, replyId: PARENT_ID }, body: { text: 'Resposta com ||segredo||' } }, response());
  assert.match(calls[0].sql, /impression_id=\$2 AND user_id=\$3/);
  assert.deepEqual(calls[0].params.slice(0, 3), [PARENT_ID, CONTENT_ID, USER_ID]);
  assert.deepEqual(result.segments.map(segment => segment.type), ['text', 'spoiler']);
});

test('impression replies disappear when their root impression is hidden', async () => {
  let query = '';
  const routes = harness(async sql => { query = sql; return { rows: [] }; });
  const result = await routes.get('GET /api/impressions/:id/replies')({ params: { id: CONTENT_ID }, query: { hideSpoilers: 'true' } }, response());
  assert.match(query, /JOIN impressions i ON i\.id=r\.impression_id AND i\.hidden=false/);
  assert.deepEqual(result.items, []);
});

test('episode replies are scoped to the same anime and episode before depth is inherited', async () => {
  const calls = [];
  const routes = harness(async (sql, params) => { calls.push({ sql, params }); return { rows: [{ id: CONTENT_ID, parent_id: PARENT_ID, root_id: PARENT_ID, depth: 3, created_at: new Date().toISOString() }] }; });
  const reply = response();
  await routes.get('POST /api/anime/:id/episodes/:episode/comments')({ params: { id: '42', episode: '9' }, body: { text: 'Resposta', parentId: PARENT_ID } }, reply);
  assert.equal(reply.status, 201);
  assert.match(calls[0].sql, /media_type='ANIME' AND media_id=\$1 AND subject_number=\$2/);
  assert.match(calls[0].sql, /parent\.depth\+1/);
  assert.deepEqual(calls[0].params.slice(0, 5), [42, 9, USER_ID, 'Resposta', PARENT_ID]);
});

test('progress warning allows untracked and completed users but blocks episodes ahead', async () => {
  for (const [row, expected] of [
    [null, { allowed: true, userProgress: null, episodesAhead: null, status: null }],
    [{ status: 'COMPLETED', progress: 1 }, { allowed: true, userProgress: 1, episodesAhead: 8, status: 'COMPLETED' }],
    [{ status: 'CURRENT', progress: 2 }, { allowed: false, userProgress: 2, episodesAhead: 7, status: 'CURRENT' }],
  ]) {
    const routes = harness(async () => ({ rows: row ? [row] : [] }));
    const result = await routes.get('GET /api/anime/:id/episodes/:episode/comments/spoiler-check')({ params: { id: '42', episode: '9' } }, response());
    assert.deepEqual(result, expected);
  }
});

test('popular episode comments rank roots without relying on a nested select alias', async () => {
  let query = '';
  const routes = harness(async sql => { query = sql; return { rows: [] }; });
  await routes.get('GET /api/anime/:id/episodes/:episode/comments')({ params: { id: '42', episode: '9' }, query: { sort: 'popular' } }, response());
  assert.match(query, /ranked_like\.likeable_type='ANIME_COMMENT'/);
  assert.match(query, /root_comment\.created_at/);
  assert.doesNotMatch(query, /THEN likes_count/);
});
