import {performance} from 'node:perf_hooks';

const target = new URL(process.env.LOAD_TARGET || 'http://127.0.0.1:3000');
const productionHosts = new Set(['aninexus.com.br', 'www.aninexus.com.br', 'qgbaltigo.github.io']);
if (!['http:', 'https:'].includes(target.protocol)) throw new Error('O destino de carga precisa usar HTTP ou HTTPS.');
const targetHost = target.hostname.toLowerCase().replace(/\.$/, '');
const local = ['127.0.0.1', 'localhost', '::1'].includes(targetHost);
if (productionHosts.has(targetHost)) throw new Error('Carga em produção é bloqueada por este script.');
if (!local && String(process.env.LOAD_TEST_ALLOW_HOST || '').toLowerCase().replace(/\.$/, '') !== targetHost) {
  throw new Error(`Destino não local recusado. Defina LOAD_TEST_ALLOW_HOST=${targetHost} somente para um staging autorizado.`);
}

const durationSeconds = Math.max(1, Math.min(300, Number(process.env.LOAD_DURATION_SECONDS || 20)));
const requestsPerSecond = Math.max(1, Math.min(5000, Number(process.env.LOAD_RPS || 25)));
const concurrency = Math.max(1, Math.min(500, Number(process.env.LOAD_CONCURRENCY || 20)));
const safeRoutes = [
  '/health',
  '/health/ready',
  '/api/news?limit=20',
  '/api/characters/ranking'
];
const upstreamRoutes = ['/api/catalog?page=1&perPage=25&sort=POPULAR', '/api/reading?page=1&perPage=25&sort=POPULAR'];
const includeUpstream = process.env.LOAD_INCLUDE_UPSTREAM === '1';
if (includeUpstream && process.env.LOAD_UPSTREAM_ISOLATED !== '1') {
  throw new Error('Rotas de provedor exigem LOAD_UPSTREAM_ISOLATED=1 e egress interceptado por fixtures no staging.');
}
const routes = includeUpstream ? [...safeRoutes, ...upstreamRoutes] : safeRoutes;
const config = {target: target.origin, profile: includeUpstream ? 'isolated-upstream' : 'local-data-only', durationSeconds, requestsPerSecond, concurrency, total: durationSeconds * requestsPerSecond, routes};
if (process.argv.includes('--dry-run')) {
  console.log(JSON.stringify(config, null, 2));
  process.exit(0);
}

const samples = [];
const statuses = new Map();
let failures = 0;
const active = new Set();
const startedAt = performance.now();
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, Math.max(0, milliseconds)));

async function request(index) {
  const started = performance.now();
  try {
    const response = await fetch(new URL(routes[index % routes.length], target), {
      headers: {accept: 'application/json', 'user-agent': 'AniNexus-local-load-check/1.0'},
      redirect: 'error',
      signal: AbortSignal.timeout(10_000)
    });
    statuses.set(response.status, (statuses.get(response.status) || 0) + 1);
    if (!response.ok) failures++;
    await response.arrayBuffer();
  } catch {
    failures++;
    statuses.set('network', (statuses.get('network') || 0) + 1);
  } finally {
    samples.push(performance.now() - started);
  }
}

for (let index = 0; index < config.total; index++) {
  const dueAt = startedAt + (index * 1000 / requestsPerSecond);
  await wait(dueAt - performance.now());
  while (active.size >= concurrency) await Promise.race(active);
  const task = request(index).finally(() => active.delete(task));
  active.add(task);
}
await Promise.all(active);

samples.sort((a, b) => a - b);
const percentile = value => samples[Math.min(samples.length - 1, Math.floor(samples.length * value))] || 0;
const elapsedSeconds = (performance.now() - startedAt) / 1000;
console.log(JSON.stringify({
  ...config,
  completed: samples.length,
  achievedRps: Number((samples.length / elapsedSeconds).toFixed(2)),
  failures,
  errorRate: Number((failures / Math.max(1, samples.length)).toFixed(4)),
  latencyMs: {p50: Number(percentile(.50).toFixed(1)), p95: Number(percentile(.95).toFixed(1)), p99: Number(percentile(.99).toFixed(1))},
  statuses: Object.fromEntries(statuses)
}, null, 2));
if (failures / Math.max(1, samples.length) > Number(process.env.LOAD_MAX_ERROR_RATE || .001)) process.exitCode = 1;
