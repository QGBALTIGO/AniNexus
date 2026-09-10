import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {cacheDeadline, CacheDeadlineError} from '../lib/cache.mjs';
import {SharedRateLimitStore} from '../lib/rate-limit-store.mjs';
import {migrationSqlForTransaction} from '../lib/db.mjs';

function browserRuntime(fetchImpl = async () => ({status: 204, ok: true})) {
  const source = fs.readFileSync(new URL('../preview-v38/runtime-v38.js', import.meta.url), 'utf8');
  const marker = 'window.AniNexusRuntime=Object.freeze(';
  const start = source.indexOf(marker);
  const end = source.indexOf('\n', start);
  assert.ok(end > 0, 'browser deadline runtime marker is missing');
  const bootstrap = `${source.slice(0, end)}\n})();`;
  const window = {fetch: fetchImpl, document: {querySelector: selector => selector === 'meta[name="aninexus-build"]' ? {content: 'test-release.1'} : null}};
  vm.runInNewContext(bootstrap, {
    window,
    location: {hostname: 'aninexus.test', origin: 'https://aninexus.test', href: 'https://aninexus.test/'},
    performance: {now: () => 0},
    AbortController,
    Error,
    Promise,
    Object,
    Math,
    Number,
    URL,
    setTimeout,
    clearTimeout
  });
  return window.AniNexusRuntime;
}

test('browser deadline covers work that never settles and classifies timeout', async () => {
  const runtime = browserRuntime();
  await assert.rejects(
    runtime.withDeadline(() => new Promise(() => {}), {timeout: 15, label: 'Teste'}),
    error => error.name === 'TimeoutError' && error.code === 'REQUEST_TIMEOUT' && error.category === 'timeout'
  );
});

test('browser deadline immediately respects an already-cancelled navigation', async () => {
  const runtime = browserRuntime();
  const controller = new AbortController();
  controller.abort('route-change');
  await assert.rejects(
    runtime.withDeadline(() => new Promise(() => {}), {timeout: 1000, signal: controller.signal}),
    error => error.name === 'AbortError' && error.category === 'navigation'
  );
});

test('JSON body consumption is inside the same browser deadline', async () => {
  const runtime = browserRuntime(async () => ({status: 200, ok: true, json: () => new Promise(() => {})}));
  await assert.rejects(runtime.jsonRequest('/slow-body', {}, {timeout: 15}), error => error.name === 'TimeoutError');
});

test('browser correlation keeps one navigation id per generation and adds the release', () => {
  const runtime = browserRuntime();
  const first = runtime.correlationHeaders();
  assert.equal(first['x-aninexus-client-release'], 'test-release.1');
  assert.equal(runtime.correlationHeaders()['x-aninexus-navigation-id'], first['x-aninexus-navigation-id']);
  runtime.renewNavigationId();
  assert.notEqual(runtime.correlationHeaders()['x-aninexus-navigation-id'], first['x-aninexus-navigation-id']);
});

test('Redis operations have a bounded deadline', async () => {
  await assert.rejects(cacheDeadline(new Promise(() => {}), 'test redis', 15), CacheDeadlineError);
  assert.equal(await cacheDeadline(Promise.resolve('PONG'), 'test redis', 100), 'PONG');
});

test('migration bookkeeping keeps legacy outer transactions atomic', () => {
  assert.equal(migrationSqlForTransaction('BEGIN;\nSET LOCAL statement_timeout = \'60s\';\nSELECT 1;\nCOMMIT;'), "SET LOCAL statement_timeout = '60s';\nSELECT 1;");
  const procedural = 'DO $$\nBEGIN\n  PERFORM 1;\nEND $$;';
  assert.equal(migrationSqlForTransaction(procedural), procedural);
});

test('shared rate limiter uses one atomic Redis script and isolates route buckets', async () => {
  const calls = [];
  const client = {eval: async (script, options) => { calls.push({script, options}); return [3, 900]; }};
  const globalStore = new SharedRateLimitStore({continueExceeding: false}, 'test:rate:', client);
  const routeStore = globalStore.child({routeInfo: {method: 'GET', url: '/api/catalog'}});
  const result = await new Promise((resolve, reject) => routeStore.incr('user:123', (error, value) => error ? reject(error) : resolve(value), 1000, 10));
  assert.deepEqual(result, {current: 3, ttl: 900});
  assert.equal(calls.length, 1);
  assert.match(calls[0].options.keys[0], /^aninexus:rate:[a-f0-9]{16}:[a-f0-9]{32}$/);
  assert.deepEqual(calls[0].options.arguments.slice(0, 2), ['1000', '10']);
});

test('shared rate limiter fails closed with a retryable infrastructure status', async () => {
  const client = {eval: async () => { throw new Error('redis unavailable'); }};
  const store = new SharedRateLimitStore({}, 'test:rate:', client);
  await assert.rejects(
    new Promise((resolve, reject) => store.incr('ip:127.0.0.1', error => error ? reject(error) : resolve(), 1000, 10)),
    error => error.code === 'RATE_LIMIT_UNAVAILABLE' && error.statusCode === 503
  );
});

test('navigation guards reject stale writes and retry without a document reload', () => {
  const guard = fs.readFileSync(new URL('../preview-v23/route-guard-v23.js', import.meta.url), 'utf8');
  const auth = fs.readFileSync(new URL('../preview-v38/auth-guard-v38.js', import.meta.url), 'utf8');
  const news = fs.readFileSync(new URL('../preview-v32/news-route-guard-v32.js', import.meta.url), 'utf8');
  assert.match(guard, /if\(!isCurrent\(\)\)\{abandon\(\)/);
  assert.match(auth, /if\(!current\(\)\)/);
  assert.match(news, /if\(!current\(\)\)/);
  assert.doesNotMatch(`${guard}\n${auth}\n${news}`, /location\.reload\(\)/);
  assert.match(guard, /aninexus:route-retry/);
});

test('library starts both media requests but waits only for the selected one', () => {
  const library = fs.readFileSync(new URL('../preview-v38/library-unified-v49.js', import.meta.url), 'utf8');
  assert.doesNotMatch(library, /Promise\.allSettled\(\[loadDataset\('ANIME'\), loadDataset\('MANGA'\)\]\)/);
  assert.match(library, /const secondary = loadDataset\(secondaryType, signal\)/);
  assert.match(library, /const primary = await loadDataset\(primaryType, signal\)/);
  assert.match(library, /state\.errors\[state\.media\]/);
});
