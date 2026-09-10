import http from 'k6/http';
import {check, sleep} from 'k6';

const target = String(__ENV.TARGET || 'http://127.0.0.1:3000').replace(/\/+$/, '');
const parsedTarget = new URL(target);
if (!['http:', 'https:'].includes(parsedTarget.protocol)) throw new Error('O destino de carga precisa usar HTTP ou HTTPS.');
const host = parsedTarget.hostname.toLowerCase().replace(/\.$/, '');
const production = ['aninexus.com.br', 'www.aninexus.com.br', 'qgbaltigo.github.io'].includes(host);
if (production) throw new Error('Carga em produção é bloqueada por este script.');
if (!['127.0.0.1', 'localhost', '::1'].includes(host) && __ENV.ALLOW_HOST !== host) {
  throw new Error(`Defina ALLOW_HOST=${host} para confirmar um staging autorizado.`);
}
const includeUpstream = __ENV.INCLUDE_UPSTREAM === '1';
if (includeUpstream && __ENV.UPSTREAM_ISOLATED !== '1') throw new Error('Rotas de provedor exigem UPSTREAM_ISOLATED=1 e egress interceptado por fixtures.');

const executor = String(__ENV.EXECUTOR || 'arrival');
const arrivalRate = Math.max(1, Math.min(2000, Number(__ENV.ARRIVAL_RATE || 5)));
const vus = Math.max(1, Math.min(5000, Number(__ENV.VUS || 20)));
const duration = __ENV.DURATION || '30s';

export const options = {
  scenarios: executor === 'vus' ? {
    sessions: {executor: 'ramping-vus', startVUs: 0, stages: [{duration: __ENV.RAMP_UP || '15s', target: vus}, {duration, target: vus}, {duration: __ENV.RAMP_DOWN || '10s', target: 0}]}
  } : {
    arrivals: {executor: 'constant-arrival-rate', rate: arrivalRate, timeUnit: '1s', duration, preAllocatedVUs: Math.min(vus, 100), maxVUs: vus}
  },
  thresholds: {
    checks: ['rate>0.999'],
    dropped_iterations: ['count==0'],
    http_req_failed: ['rate<0.001'],
    http_req_duration: ['p(95)<300', 'p(99)<1000']
  }
};

const safeRoutes = ['/health', '/health/ready', '/api/news?limit=20', '/api/characters/ranking'];
const upstreamRoutes = ['/api/catalog?page=1&perPage=25&sort=POPULAR', '/api/reading?page=1&perPage=25&sort=POPULAR'];
const routes = includeUpstream ? [...safeRoutes, ...upstreamRoutes] : safeRoutes;
const callsPerIteration = 3;

export default function () {
  for (let call = 0; call < callsPerIteration; call++) {
    const response = http.get(`${target}${routes[(__ITER * callsPerIteration + call) % routes.length]}`, {headers: {'User-Agent': 'AniNexus-staging-load-check/1.0'}, timeout: '10s'});
    check(response, {'resposta saudável': value => value.status >= 200 && value.status < 400});
  }
  sleep(Number(__ENV.THINK_SECONDS || 1));
}
