import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import * as predictionCore from './predictions.mjs';
import {OFFICIAL_EVENTS} from './predictions-official-events.mjs';

export const SOURCE_URL = 'https://graphql.anilist.co';
export const WORKER_INTERVAL_MS = 300_000;
const HOUR = 3_600_000, DAY = 24 * HOUR;
const LOCK_ID = 84110635;
const MAX_RESPONSE_BYTES = 1_000_000;
export const DISCOVERY_QUERY = `query PredictionCandidates {
  Page(page:1,perPage:20) { media(type:ANIME,status:RELEASING,isAdult:false,
    popularity_greater:999,averageScore_greater:49,averageScore_lesser:94,sort:[POPULARITY_DESC,ID]) {
    id type status popularity averageScore title { romaji english native } coverImage { large }
  } }
}`;
export const RESOLUTION_QUERY = `query PredictionScores($ids:[Int]) {
  Page(page:1,perPage:50) { media(id_in:$ids,isAdult:false) { id type averageScore } }
}`;

export function nextPredictionDeadline(now = new Date()) {
  const time = new Date(now);
  if (!Number.isFinite(+time)) throw new TypeError('INVALID_CLOCK');
  const deadline = new Date(Date.UTC(time.getUTCFullYear(), time.getUTCMonth(), time.getUTCDate(), 18));
  deadline.setUTCDate(deadline.getUTCDate() + ((8 - deadline.getUTCDay()) % 7));
  if (+deadline - +time < 2 * DAY) deadline.setUTCDate(deadline.getUTCDate() + 7);
  return deadline;
}

export function predictionWeek(date) {
  const value = new Date(date);
  const start = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  const thursday = new Date(+start + 3 * DAY);
  const year = thursday.getUTCFullYear();
  const first = new Date(Date.UTC(year, 0, 4));
  first.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7));
  return {key: `${year}-W${String(1 + Math.round((+start - +first) / (7 * DAY))).padStart(2, '0')}`,
    start, end: new Date(+start + 7 * DAY)};
}

export function retryDelay(value, now = new Date()) {
  let delay = /^\d+(?:\.\d+)?$/.test(String(value || '')) ? Number(value) * 1000 : Date.parse(value) - +now;
  if (!Number.isFinite(delay) || delay <= 0) delay = 60_000;
  // A remote header never causes a blocking sleep. Persist the bounded retry time.
  return Math.max(30_000, Math.min(7 * DAY, delay));
}

function validScore(media) {
  return media && Number.isSafeInteger(media.id) && media.id > 0 && ['ANIME', 'MANGA'].includes(media.type)
    && Number.isInteger(media.averageScore) && media.averageScore >= 0 && media.averageScore <= 100;
}
export function eligibleCandidate(media) {
  return validScore(media) && media.type === 'ANIME' && media.status === 'RELEASING'
    && Number.isInteger(media.popularity) && media.popularity >= 1000
    && media.averageScore >= 50 && media.averageScore <= 93;
}

async function boundedJson(response) {
  if (Number(response.headers?.get?.('content-length') || 0) > MAX_RESPONSE_BYTES) throw new Error('SOURCE_TOO_LARGE');
  const reader = response.body?.getReader?.();
  if (!reader) throw new Error('SOURCE_INVALID_BODY');
  let bytes = 0;
  const parts = [];
  try {
    while (true) {
      const {value, done} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) throw new Error('SOURCE_TOO_LARGE');
      parts.push(value);
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  return JSON.parse(Buffer.concat(parts).toString('utf8'));
}

export function createPredictionsWorker({pool, fetchImpl = globalThis.fetch, core = predictionCore,
  enabled = process.env.PREDICTIONS_ENABLED === '1', authorized = process.env.PREDICTIONS_ANILIST_AUTHORIZED === '1',
  timeoutMs = 12_000, intervalMs = WORKER_INTERVAL_MS, logger = console,
  officialEvents = OFFICIAL_EVENTS, legacyScoreMode = false} = {}) {
  let running = false, stopped = false, timer = null, wake = null;
  const stopController = new AbortController();
  const canRun = enabled === true && authorized === true;
  const log = (event, data = {}) => logger?.info?.('[predictions-worker]', {event, ...data});
  const fail = code => logger?.warn?.('[predictions-worker]', {event: 'cycle_failed', code});

  async function cycle() {
    if (!canRun) return {status: 'DISABLED'};
    if (stopped) return {status: 'STOPPED'};
    if (running) return {status: 'BUSY'};
    running = true;
    let client, locked = false, lost = false;
    const connectionLost = () => { lost = true; };
    const report = {status: 'OK', published: 0, resolved: 0, voided: 0, pending: 0, locked: 0};
    try {
      client = await pool.connect();
      client.on?.('error', connectionLost);
      client.on?.('end', connectionLost);
      locked = Boolean((await client.query('SELECT pg_try_advisory_lock($1) acquired', [LOCK_ID])).rows[0]?.acquired);
      if (!locked) return {status: 'LOCKED_BY_OTHER_WORKER'};
      const assertActive = () => { if (stopped || lost) throw new Error(stopped ? 'WORKER_STOPPED' : 'LOCK_CONNECTION_LOST'); };
      const clock = async () => {
        assertActive();
        const date = new Date((await client.query('SELECT clock_timestamp() AS prediction_now')).rows[0]?.prediction_now);
        if (!Number.isFinite(+date)) throw new Error('INVALID_DB_CLOCK');
        return date;
      };
      const state = async name => (await client.query('SELECT next_run_at,details FROM prediction_job_state WHERE name=$1', [name])).rows[0];
      const writeState = async (name, at, details = {}) => client.query(`INSERT INTO prediction_job_state(name,next_run_at,details)
        VALUES($1,$2,$3::jsonb) ON CONFLICT(name) DO UPDATE SET next_run_at=EXCLUDED.next_run_at,details=EXCLUDED.details,updated_at=clock_timestamp()`,
        [name, at, JSON.stringify(details)]);
      const currentSourceState = await state('source');
      let nextSourceAttempt = +new Date(currentSourceState?.next_run_at || 0);
      let failures = Number(currentSourceState?.details?.failures || 0);
      const source = async (query, variables = {}) => {
        const now = await clock();
        if (+now < nextSourceAttempt) return null;
        const controller = new AbortController();
        const abort = () => controller.abort();
        stopController.signal.addEventListener('abort', abort, {once: true});
        const expiry = setTimeout(abort, Math.max(10, Math.min(30_000, timeoutMs)));
        try {
          const response = await fetchImpl(SOURCE_URL, {method: 'POST', redirect: 'error', signal: controller.signal,
            headers: {'Content-Type': 'application/json', Accept: 'application/json', 'Cache-Control': 'no-cache', 'User-Agent': 'AniNexus-Predictions/1.0'},
            body: JSON.stringify({query, variables})});
          if (response.status === 429) {
            nextSourceAttempt = +await clock() + retryDelay(response.headers.get('retry-after'), now);
            await writeState('source', new Date(nextSourceAttempt), {failures: ++failures, reason: 'RATE_LIMITED'});
            await response.body?.cancel?.().catch(() => {});
            return null;
          }
          if (!response.ok) { await response.body?.cancel?.().catch(() => {}); throw new Error('SOURCE_HTTP_ERROR'); }
          const body = await boundedJson(response);
          if (!body || (Array.isArray(body.errors) && body.errors.length) || body.errors !== undefined && !Array.isArray(body.errors)
            || !Array.isArray(body.data?.Page?.media)) throw new Error('SOURCE_INVALID_GRAPHQL');
          const observedAt = await clock();
          failures = 0;
          nextSourceAttempt = +observedAt + (response.headers.get('x-ratelimit-remaining') === '0'
            ? retryDelay(response.headers.get('retry-after'), observedAt) : 0);
          await writeState('source', new Date(nextSourceAttempt), {failures: 0, reason: 'OK'});
          return {media: body.data.Page.media.slice(0, 50), observedAt};
        } catch (error) {
          if (stopped || lost) throw error;
          nextSourceAttempt = +await clock() + Math.min(15 * 60_000, 60_000 * 2 ** Math.min(4, failures++));
          await writeState('source', new Date(nextSourceAttempt), {failures, reason: 'SOURCE_UNAVAILABLE'});
          log('source_unavailable');
          return null;
        } finally {
          clearTimeout(expiry);
          stopController.signal.removeEventListener('abort', abort);
        }
      };

      const now = await clock();
      report.locked = (await core.lockPredictions(pool)).locked || 0;
      const dueOfficial=(await client.query(`SELECT * FROM prediction_questions WHERE type='OFFICIAL_EVENT'
          AND status IN ('OPEN','LOCKED') AND resolution_deadline<=$1 ORDER BY resolution_deadline,id LIMIT 50`,[now])).rows;
      for(const question of dueOfficial){
        const saved=await state(`official-observation:${question.id}`);
        assertActive();
        const result=await core.resolvePrediction(pool,question.id,saved?.details?.observation||null);
        if(result.status==='RESOLVED')report.resolved++;
        else if(result.status==='VOID')report.voided++;
        else report.pending++;
      }
      if(officialEvents.length){
        const discoveryState=await state('official-discovery');
        if(+new Date(discoveryState?.next_run_at||0)<=+now){
          for(const event of officialEvents){
            const candidate=core.generateOfficialEventCandidate(event,await clock());
            if(!candidate.ok)continue;
            assertActive();
            const published=await core.publishPrediction(pool,candidate.candidate);
            if(published.created)report.published++;
          }
          await writeState('official-discovery',new Date(+await clock()+HOUR),{count:officialEvents.length});
        }
      }
      // Historical score tests exercise this path explicitly. Production never
      // generates or resolves AniList score/catalog questions after migration 038.
      if(legacyScoreMode){
      const due = (await client.query(`SELECT * FROM prediction_questions WHERE type='SCORE_AT_DEADLINE'
        AND status IN ('OPEN','LOCKED') AND resolution_deadline<=$1 ORDER BY resolution_deadline,id LIMIT 50`, [now])).rows;
      const needsSource = [];
      const recordResult = result => {
        if (result.status === 'RESOLVED') report.resolved++;
        else if (result.status === 'VOID') report.voided++;
        else report.pending++;
      };
      for (const question of due) {
        const saved = await state(`observation:${question.id}`);
        await clock(); // The advisory-lock connection must still be alive before any mutation.
        if (saved?.details?.observation) recordResult(await core.resolvePrediction(pool, question.id, saved.details.observation));
        else if (+now > +new Date(question.resolution_deadline) + HOUR) recordResult(await core.resolvePrediction(pool, question.id));
        else needsSource.push(question);
      }
      if (needsSource.length) {
        const ids = [...new Set(needsSource.map(item => Number(item.media_id)))];
        const result = await source(RESOLUTION_QUERY, {ids});
        const observations = [];
        for (const question of needsSource) {
          const matches = result?.media.filter(item => item?.id === Number(question.media_id)) || [];
          const media = matches.length === 1 && validScore(matches[0]) && matches[0].type === question.media_type ? matches[0] : null;
          if (media && +result.observedAt >= +new Date(question.resolution_deadline) && +result.observedAt <= +new Date(question.resolution_deadline) + HOUR) {
            const observation = {source: 'AniList', mediaId: media.id, mediaType: media.type, observedAt: result.observedAt.toISOString(), data: {averageScore: media.averageScore}};
            observations.push({name: `observation:${question.id}`, observed_at: observation.observedAt, observation});
          }
        }
        // One atomic statement retains every first observation from the response.
        // A later resolver failure cannot make the next question consume a newer score.
        if (observations.length) await client.query(`INSERT INTO prediction_job_state(name,next_run_at,details)
          SELECT entry.name,entry.observed_at,jsonb_build_object('observation',entry.observation)
          FROM jsonb_to_recordset($1::jsonb) AS entry(name text,observed_at timestamptz,observation jsonb)
          ON CONFLICT(name) DO NOTHING`, [JSON.stringify(observations)]);
        for (const question of needsSource) {
          const observation = (await state(`observation:${question.id}`))?.details?.observation || null;
          await clock();
          recordResult(await core.resolvePrediction(pool, question.id, observation));
        }
      }

      const discoveryNow = await clock();
      const discoveryState = await state('discovery');
      if (+new Date(discoveryState?.next_run_at || 0) <= +discoveryNow && nextSourceAttempt <= +discoveryNow) {
        // Persist before fetching: a crash/restart cannot multiply daily discovery attempts.
        await writeState('discovery', new Date(+discoveryNow + DAY), {attemptedAt: discoveryNow.toISOString()});
        const deadline = nextPredictionDeadline(discoveryNow), week = predictionWeek(deadline);
        const existing = (await client.query(`SELECT media_id,media_type FROM prediction_questions
          WHERE resolution_deadline >= $1 AND resolution_deadline < $2 ORDER BY created_at LIMIT 11`, [week.start, week.end])).rows;
        let available = Math.max(0, 10 - existing.length);
        if (available) {
          const result = await source(DISCOVERY_QUERY);
          const seen = new Set(existing.map(item => `${item.media_type}:${item.media_id}`));
          for (const media of (result?.media || []).slice(0, 20)) {
            if (!available) break;
            if (!eligibleCandidate(media) || seen.has(`ANIME:${media.id}`)) continue;
            const title = media.title?.romaji || media.title?.english || media.title?.native;
            if (typeof title !== 'string' || !title.trim() || title.length > 300) continue;
            let cover = null;
            try { const url = new URL(media.coverImage?.large); if (url.protocol === 'https:' && url.href.length <= 2000) cover = url.href; } catch {}
            const candidate = core.generatePredictionCandidate({mediaId: media.id, mediaType: 'ANIME', title, cover,
              averageScore: media.averageScore, status: media.status, popularity: media.popularity, observedAt: result.observedAt.toISOString()},
            {now: await clock(), deadline, threshold: media.averageScore + 2, type: 'SCORE_AT_DEADLINE', dedupeKey: `auto-score:${week.key}:ANIME:${media.id}`});
            if (!candidate.ok) continue;
            assertActive();
            const published = await core.publishPrediction(pool, candidate.candidate);
            seen.add(`ANIME:${media.id}`);
            if (published.created) { available--; report.published++; }
          }
        }
      }
      }
      log('cycle_complete', report);
      return report;
    } catch (error) {
      const code = stopped ? 'WORKER_STOPPED' : lost ? 'LOCK_CONNECTION_LOST' : 'WORKER_ERROR';
      fail(code);
      return {...report, status: 'ERROR', code};
    } finally {
      if (locked && !lost) await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => { lost = true; });
      client?.removeListener?.('error', connectionLost);
      client?.removeListener?.('end', connectionLost);
      client?.release?.(lost);
      running = false;
    }
  }

  async function run() {
    if (!canRun) { log('disabled'); return; }
    while (!stopped) {
      await cycle();
      if (stopped) break;
      await new Promise(resolveWait => {
        wake = resolveWait;
        timer = setTimeout(resolveWait, Math.max(60_000, Math.min(HOUR, intervalMs)));
      });
      timer = null; wake = null;
    }
  }
  function stop() { stopped = true; stopController.abort(); if (timer) clearTimeout(timer); wake?.(); }
  return {cycle, run, stop};
}

async function main() {
  // No connection, migration, fetch or timer is created when the feature is disabled.
  if (process.env.PREDICTIONS_ENABLED !== '1' || process.env.PREDICTIONS_ANILIST_AUTHORIZED !== '1') {
    console.info('[predictions-worker] disabled; both feature and source authorization flags are required');
    return;
  }
  const {pool, initDb} = await import('./db.mjs');
  let worker, stopping = false;
  const shutdown = () => { stopping = true; worker?.stop(); };
  process.once('SIGTERM', shutdown); process.once('SIGINT', shutdown);
  try { await initDb(); if (!stopping) { worker = createPredictionsWorker({pool}); await worker.run(); } }
  finally { process.removeListener('SIGTERM', shutdown); process.removeListener('SIGINT', shutdown); await pool.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => { console.error('[predictions-worker] startup failed'); process.exitCode = 1; });
}
