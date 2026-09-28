import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {spawnSync} from 'node:child_process';
import {createPredictionsWorker, nextPredictionDeadline, predictionWeek, eligibleCandidate, retryDelay, SOURCE_URL} from '../lib/predictions-worker.mjs';
import {evaluatePrediction, generatePredictionCandidate, generateOfficialEventCandidate, validatePredictionCandidate} from '../lib/predictions.mjs';
import {OFFICIAL_EVENTS} from '../lib/predictions-official-events.mjs';

const NOW = new Date('2026-10-05T18:05:00.000Z');
const HOUR = 3_600_000;
const response = (media, status = 200, headers = {}) => new Response(JSON.stringify({data: {Page: {media}}}), {status, headers});
const media = (id = 1, extra = {}) => ({id, type: 'ANIME', status: 'RELEASING', popularity: 25000,
  averageScore: 78, title: {romaji: `Anime ${id}`}, coverImage: {large: 'https://example.com/cover.jpg'}, ...extra});
const question = (id = 'q1', extra = {}) => ({id, media_id: 1, media_type: 'ANIME', source: 'AniList', type: 'SCORE_AT_DEADLINE',
  status: 'LOCKED', opens_at: '2026-09-28T18:00:00.000Z', closes_at: '2026-10-04T18:00:00.000Z',
  resolution_deadline: '2026-10-05T18:00:00.000Z', rule: {threshold: 80, windowSeconds: 3600}, ...extra});

function harness({now = NOW, questions = [], discovery = false, acquired = true, fetcher, resolverFails = 0} = {}) {
  const state = {now: new Date(now), questions: structuredClone(questions), jobs: new Map(), calls: [], resolves: [], published: [], events: [], clients: []};
  if (!discovery) state.jobs.set('discovery', {next_run_at: '2099-01-01T00:00:00Z', details: {}});
  const pool = {async connect() {
    const client = new EventEmitter();
    state.clients.push(client);
    client.release = broken => state.events.push({kind: 'release', client, broken});
    client.query = async (sql, values = []) => {
      state.events.push({kind: 'query', sql, values, client});
      if (sql.includes('pg_try_advisory_lock')) return {rows: [{acquired}]};
      if (sql.includes('pg_advisory_unlock')) return {rows: [{unlocked: true}]};
      if (sql.startsWith('SELECT clock_timestamp()')) return {rows: [{prediction_now: new Date(state.now)}]};
      if (sql.startsWith('SELECT next_run_at,details')) return {rows: state.jobs.has(values[0]) ? [structuredClone(state.jobs.get(values[0]))] : []};
      if (sql.startsWith('INSERT INTO prediction_job_state')) {
        if (sql.includes('jsonb_to_recordset')) {
          for (const row of JSON.parse(values[0])) if (!state.jobs.has(row.name)) state.jobs.set(row.name, {next_run_at: row.observed_at, details: {observation: row.observation}});
          return {rows: []};
        }
        if (!sql.includes('DO NOTHING') || !state.jobs.has(values[0])) state.jobs.set(values[0], {next_run_at: values[1], details: JSON.parse(values[2])});
        return {rows: []};
      }
      if (sql.startsWith("SELECT * FROM prediction_questions WHERE type='OFFICIAL_EVENT'")) return {rows: state.questions.filter(q => q.type === 'OFFICIAL_EVENT'
        && ['OPEN', 'LOCKED'].includes(q.status) && +new Date(q.resolution_deadline) <= +values[0]).slice(0, 50)};
      if (sql.startsWith('SELECT * FROM prediction_questions')) return {rows: state.questions.filter(q => q.type === 'SCORE_AT_DEADLINE'
        && ['OPEN', 'LOCKED'].includes(q.status) && +new Date(q.resolution_deadline) <= +values[0]).sort((a, b) => +new Date(a.resolution_deadline) - +new Date(b.resolution_deadline)).slice(0, 50)};
      if (sql.startsWith('SELECT media_id,media_type FROM prediction_questions')) return {rows: state.questions.filter(q => +new Date(q.resolution_deadline) >= +values[0] && +new Date(q.resolution_deadline) < +values[1]).slice(0, 11)};
      throw new Error(`Unexpected test SQL: ${sql}`);
    };
    return client;
  }};
  const core = {
    generatePredictionCandidate,
    generateOfficialEventCandidate,
    async lockPredictions() { let locked = 0; for (const q of state.questions) if (q.status === 'OPEN' && +new Date(q.closes_at) <= +state.now) {q.status = 'LOCKED'; locked++;} return {locked}; },
    async resolvePrediction(_pool, id, observation = null) {
      state.resolves.push({id, observation});
      if (resolverFails-- > 0) throw new Error('SIMULATED_DB_FAILURE_AFTER_OBSERVATION');
      const q = state.questions.find(item => item.id === id);
      const decision = evaluatePrediction(q, observation, state.now);
      if (['RESOLVED', 'VOID'].includes(decision.status)) {q.status = decision.status; q.result = decision.result;}
      return decision;
    },
    async publishPrediction(_pool, candidate) {
      assert.equal(validatePredictionCandidate(candidate, state.now).ok, true);
      if (state.questions.some(q => q.dedupe_key === candidate.dedupeKey)) return {created: false};
      state.published.push(candidate);
      state.questions.push({id: `new-${state.published.length}`, dedupe_key: candidate.dedupeKey, media_id: candidate.mediaId,
        media_type: candidate.mediaType, resolution_deadline: candidate.resolutionDeadline, status: 'OPEN', type: candidate.type});
      return {created: true};
    },
  };
  const fetchImpl = async (url, options) => {
    state.calls.push({url, options}); state.events.push({kind: 'fetch'});
    return fetcher ? fetcher({url, options, state}) : response([media(1, {averageScore: 82})]);
  };
  const worker = options => createPredictionsWorker({pool, core, fetchImpl, enabled: true, authorized: true, logger: {info() {}, warn() {}}, officialEvents: [], legacyScoreMode: true, ...options});
  return {state, worker, pool};
}

test('disabled is the default and both flags are required before any connection', async () => {
  for (const options of [{enabled: false, authorized: false}, {enabled: true, authorized: false}, {enabled: false, authorized: true}]) {
    const {worker, state} = harness();
    assert.equal((await worker(options).cycle()).status, 'DISABLED');
    assert.equal(state.clients.length, 0); assert.equal(state.calls.length, 0);
  }
});

test('production mode publishes only curated official events and never asks for scores',async()=>{
  const now=new Date('2026-09-28T02:00:00Z');
  const event=OFFICIAL_EVENTS[0];
  const {worker,state}=harness({now,fetcher:()=>{throw Error('AniList must not be queried')}});
  const options={legacyScoreMode:false,officialEvents:[event]};
  const first=await worker(options).cycle();
  assert.equal(first.status,'OK');assert.equal(first.published,1);
  assert.equal(state.published[0].type,'OFFICIAL_EVENT');assert.equal(state.calls.length,0);
  assert.equal((await worker(options).cycle()).published,0);
});

test('standalone disabled worker does not import or connect database', () => {
  const result = spawnSync(process.execPath, ['lib/predictions-worker.mjs'], {cwd: new URL('..', import.meta.url), encoding: 'utf8', timeout: 5000,
    env: {...process.env, PREDICTIONS_ENABLED: '0', PREDICTIONS_ANILIST_AUTHORIZED: '0', DATABASE_URL: 'not-a-database'}});
  assert.equal(result.status, 0); assert.match(result.stdout, /disabled/); assert.equal(result.stderr, '');
});

test('deadline is Monday 18 UTC with at least 48 hours and stable ISO year', () => {
  assert.equal(nextPredictionDeadline('2026-10-03T18:00:00Z').toISOString(), '2026-10-05T18:00:00.000Z');
  assert.equal(nextPredictionDeadline('2026-10-03T18:00:00.001Z').toISOString(), '2026-10-12T18:00:00.000Z');
  assert.equal(nextPredictionDeadline('2026-10-05T17:00:00Z').toISOString(), '2026-10-12T18:00:00.000Z');
  assert.equal(predictionWeek('2027-01-01T00:00:00Z').key, '2026-W53');
  assert.equal(predictionWeek('2027-01-04T18:00:00Z').key, '2027-W01');
  assert.throws(() => nextPredictionDeadline('not a date'), /INVALID_CLOCK/);
});

test('candidate source schema excludes missing, fractional, stale status and low volume', () => {
  assert.equal(eligibleCandidate(media()), true);
  for (const extra of [{averageScore: null}, {averageScore: '80'}, {averageScore: 78.5}, {averageScore: 49}, {averageScore: 94},
    {popularity: 999}, {status: 'FINISHED'}, {type: 'MANGA'}, {id: 0}]) assert.equal(eligibleCandidate(media(1, extra)), false);
});

test('worker owns one session advisory lock and opens no transaction over network', async () => {
  const {worker, state} = harness({questions: [question()]});
  const result = await worker().cycle();
  assert.equal(result.resolved, 1);
  const lock = state.events.find(e => e.sql?.includes('pg_try_advisory_lock'));
  const unlock = state.events.find(e => e.sql?.includes('pg_advisory_unlock'));
  assert.equal(lock.client, unlock.client); assert.equal(state.events.at(-1).kind, 'release');
  assert.equal(state.events.some(e => /^BEGIN/i.test(e.sql || '')), false);
  assert.equal(state.calls[0].url, SOURCE_URL); assert.equal(state.calls[0].options.redirect, 'error');
});

test('second process cannot fetch or write without session lock', async () => {
  const {worker, state} = harness({acquired: false, questions: [question()]});
  assert.equal((await worker().cycle()).status, 'LOCKED_BY_OTHER_WORKER');
  assert.equal(state.calls.length, 0); assert.equal(state.resolves.length, 0);
  assert.equal(state.events.some(e => e.sql?.includes('pg_advisory_unlock')), false);
});

test('valid first score resolves yes, persists evidence before core and reuses it after failure', async () => {
  const {worker, state} = harness({questions: [question()], resolverFails: 1});
  assert.equal((await worker().cycle()).status, 'ERROR');
  assert.equal(state.jobs.get('observation:q1').details.observation.data.averageScore, 82);
  state.now = new Date('2026-10-05T20:00:00Z');
  assert.equal((await worker().cycle()).resolved, 1);
  assert.equal(state.calls.length, 1);
  assert.equal(state.questions[0].result, 'YES');
});

test('atomic batch evidence survives failure of the first resolver without changing later outcomes', async () => {
  let updatedScore = 82;
  const {worker, state} = harness({questions: [question(), question('q2', {media_id: 2})], resolverFails: 1,
    fetcher: () => response([media(1, {averageScore: updatedScore}), media(2, {averageScore: updatedScore})])});
  assert.equal((await worker().cycle()).status, 'ERROR');
  assert.equal(state.jobs.get('observation:q1').details.observation.data.averageScore, 82);
  assert.equal(state.jobs.get('observation:q2').details.observation.data.averageScore, 82);
  assert.equal(state.events.filter(e => e.sql?.includes('jsonb_to_recordset')).length, 1);
  updatedScore = 75;
  state.now = new Date('2026-10-05T20:00:00Z');
  assert.equal((await worker().cycle()).resolved, 2);
  assert.equal(state.calls.length, 1);
  assert.deepEqual(state.questions.map(q => q.result), ['YES', 'YES']);
});

test('late first response cannot resolve and missing observation becomes VOID', async () => {
  const {worker, state} = harness({questions: [question()], fetcher: ({state: value}) => {value.now = new Date('2026-10-05T19:00:00.001Z'); return response([media(1, {averageScore: 99})]);}});
  assert.equal((await worker().cycle()).voided, 1);
  assert.equal(state.jobs.has('observation:q1'), false); assert.equal(state.questions[0].result, null);
});

test('exact window end accepts valid data; one millisecond after does not', async () => {
  const {worker, state} = harness({questions: [question()], fetcher: ({state: value}) => {value.now = new Date('2026-10-05T19:00:00Z'); return response([media(1, {averageScore: 79})]);}});
  assert.equal((await worker().cycle()).resolved, 1); assert.equal(state.questions[0].result, 'NO');
});

test('expired question is annulled without querying external source', async () => {
  const {worker, state} = harness({now: '2026-10-05T19:00:01Z', questions: [question()]});
  assert.equal((await worker().cycle()).voided, 1); assert.equal(state.calls.length, 0);
});

test('future question is not resolved even when its score is above threshold', async () => {
  const {worker, state} = harness({now: '2026-10-05T17:59:59Z', questions: [question()]});
  assert.equal((await worker().cycle()).resolved, 0); assert.equal(state.calls.length, 0); assert.equal(state.resolves.length, 0);
});

test('HTTP 200 GraphQL errors invalidate even present score, never resolve false', async () => {
  const {worker, state} = harness({questions: [question()], fetcher: () => new Response(JSON.stringify({data: {Page: {media: [media()]}}, errors: [{message: 'degraded'}]}))});
  const result = await worker().cycle();
  assert.equal(result.pending, 1); assert.equal(result.resolved, 0);
  assert.equal(state.resolves[0].observation, null); assert.equal(state.jobs.has('observation:q1'), false);
});

test('missing, wrong ID/type and invalid score are pending, not zero', async () => {
  for (const list of [[], [media(1, {averageScore: null})], [media(1, {averageScore: '79'})], [media(1, {averageScore: 79.9})],
    [media(1, {averageScore: 101})], [media(2)], [media(1, {type: 'MANGA'})], [media(1, {averageScore: 70}), media(1, {averageScore: 90})]]) {
    const {worker, state} = harness({questions: [question()], fetcher: () => response(list)});
    assert.equal((await worker().cycle()).pending, 1); assert.equal(state.jobs.has('observation:q1'), false);
  }
});

test('429 Retry-After persists across worker restart without sleeping', async () => {
  let calls = 0;
  const {worker, state} = harness({questions: [question()], fetcher: () => ++calls === 1 ? new Response('{}', {status: 429, headers: {'retry-after': '600'}}) : response([media(1, {averageScore: 81})])});
  assert.equal((await worker().cycle()).pending, 1);
  state.now = new Date(+NOW + 5 * 60_000);
  assert.equal((await worker().cycle()).pending, 1); assert.equal(calls, 1);
  state.now = new Date(+NOW + 11 * 60_000);
  assert.equal((await worker().cycle()).resolved, 1); assert.equal(calls, 2);
  assert.equal(retryDelay('600', NOW), 600_000);
  assert.equal(retryDelay(new Date(+NOW + 90_000).toUTCString(), NOW), 90_000);
  assert.equal(retryDelay('bad', NOW), 60_000);
});

test('timeout is bounded and records pending outcome instead of hanging', async () => {
  const {worker, state} = harness({questions: [question()], fetcher: ({options}) => new Promise((resolveFetch, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted')), {once: true}))});
  const result = await worker({timeoutMs: 10}).cycle();
  assert.equal(result.pending, 1); assert.equal(state.questions[0].status, 'LOCKED');
});

test('oversized source body is rejected', async () => {
  const {worker, state} = harness({questions: [question()], fetcher: () => response([media()], 200, {'content-length': '1000001'})});
  assert.equal((await worker().cycle()).pending, 1); assert.equal(state.jobs.has('observation:q1'), false);
});

test('graceful stop aborts in-flight fetch, releases lock and blocks next cycle', async () => {
  let began;
  const started = new Promise(r => {began = r;});
  const {worker, state} = harness({questions: [question()], fetcher: ({options}) => {began(); return new Promise((resolveFetch, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted'))));}});
  const instance = worker(), promise = instance.cycle();
  await started; instance.stop();
  assert.equal((await promise).code, 'WORKER_STOPPED');
  assert.equal((await instance.cycle()).status, 'STOPPED'); assert.equal(state.resolves.length, 0);
  assert.equal(state.events.at(-1).kind, 'release');
});

test('lost advisory-lock connection cannot publish or resolve after network returns', async () => {
  const {worker, state} = harness({questions: [question()], fetcher: ({state: value}) => {value.clients[0].emit('error', new Error('connection lost')); return response([media()]);}});
  assert.equal((await worker().cycle()).code, 'LOCK_CONNECTION_LOST'); assert.equal(state.resolves.length, 0);
  assert.equal(state.events.at(-1).broken, true);
});

test('discovery caps globally at ten per ISO week and publishes score+2 once per media', async () => {
  const now = '2026-10-01T12:00:00Z';
  const initial = [question('existing', {media_id: 1})];
  const {worker, state} = harness({now, questions: initial, discovery: true,
    fetcher: () => response([media(1), media(2), media(2), ...Array.from({length: 18}, (_, i) => media(i + 3))])});
  assert.equal((await worker().cycle()).published, 9);
  assert.equal(state.published.length, 9); assert.equal(new Set(state.published.map(q => q.mediaId)).size, 9);
  assert.ok(state.published.every(q => q.rule.threshold === 80 && q.type === 'SCORE_AT_DEADLINE'));
  assert.ok(state.published.every(q => q.dedupeKey.startsWith('auto-score:2026-W41:ANIME:')));
  assert.ok(state.published.every(q => +new Date(q.resolutionDeadline) - +new Date(q.closesAt) === 24 * HOUR));
  await worker().cycle(); assert.equal(state.calls.length, 1);
});

test('weekly global cap suppresses fetch and daily discovery survives restart', async () => {
  const {worker, state} = harness({now: '2026-10-01T12:00:00Z', questions: Array.from({length: 10}, (_, i) => question(`q${i}`, {media_id: i + 1})), discovery: true});
  assert.equal((await worker().cycle()).published, 0); assert.equal(state.calls.length, 0);
  assert.ok(state.jobs.has('discovery'));
  state.now = new Date('2026-10-01T13:00:00Z'); await worker().cycle(); assert.equal(state.calls.length, 0);
});

test('discovery rejects invalid candidate rows and does not create placeholder questions', async () => {
  const {worker, state} = harness({now: '2026-10-01T12:00:00Z', discovery: true,
    fetcher: () => response([media(1, {title: null}), media(2, {averageScore: null}), media(3, {status: 'FINISHED'}), media(4, {type: 'MANGA'})])});
  assert.equal((await worker().cycle()).published, 0); assert.equal(state.published.length, 0);
});

test('resolution query and work batch are bounded to fifty entries', async () => {
  const {worker, state} = harness({questions: Array.from({length: 60}, (_, i) => question(`q${i}`, {media_id: i + 1})),
    fetcher: ({options}) => response(JSON.parse(options.body).variables.ids.map(id => media(id, {averageScore: 81})))});
  assert.equal((await worker().cycle()).resolved, 50);
  assert.equal(JSON.parse(state.calls[0].options.body).variables.ids.length, 50);
  assert.equal(state.questions.filter(q => q.status === 'LOCKED').length, 10);
});

test('same worker cannot overlap cycles and final rows are not reprocessed', async () => {
  let began, finish;
  const started = new Promise(r => {began = r;});
  const {worker, state} = harness({questions: [question()], fetcher: () => {began(); return new Promise(r => {finish = () => r(response([media(1, {averageScore: 80})]));});}});
  const instance = worker(), first = instance.cycle(); await started;
  assert.equal((await instance.cycle()).status, 'BUSY'); finish(); await first;
  await instance.cycle(); assert.equal(state.calls.length, 1); assert.equal(state.resolves.length, 1);
});
