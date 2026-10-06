import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import test from 'node:test';

const baseline = process.env.ANX_CANDIDATE_BASELINE_REF;
if (baseline) assert.match(baseline, /^[a-f0-9]{40}$/);
const source = baseline ? execFileSync('git', ['show', `${baseline}:preview-v40/community-v40.js`], {cwd: new URL('..', import.meta.url), encoding: 'utf8'}) : fs.readFileSync(new URL('../preview-v40/community-v40.js', import.meta.url), 'utf8');
const deferred = () => {let resolve; const promise = new Promise(yes => {resolve = yes;}); return {promise, resolve};};
const settle = async () => {for (let i = 0; i < 40; i++) await Promise.resolve();};
function target() {
  const listeners = new Map();
  return {addEventListener(name, fn) {const list = listeners.get(name) || []; list.push(fn); listeners.set(name, list);}, dispatchEvent(event) {for (const fn of [...(listeners.get(event.type) || [])]) fn(event);}, emit(type, detail) {this.dispatchEvent({type, detail});}};
}
function fixture({api} = {}) {
  const window = target(), app = {present: false, querySelector(selector) {return this.present ? {} : null;}};
  const element = () => ({classList: {add() {}, remove() {}, toggle() {}}});
  const document = Object.assign(target(), {readyState: 'loading', body: element(), documentElement: element(), querySelector: selector => selector === '#app' ? app : null, querySelectorAll: () => []});
  const timers = new Map(); let timer = 0;
  const h = {window, app, document, requests: [], renders: [], overviewRenders: [], local: [], timers};
  const location = {hostname: 'aninexus.fixture', href: 'https://aninexus.fixture/comunidade'};
  window.AniNexusAuth = {enabled: true, publicApi: async path => {
    h.requests.push(path);
    if (api) {const result = api(path, h); if (result !== undefined) return result;}
    return path === '/api/community/overview' ? {totals: {}, rankings: []} : {items: []};
  }};
  window.AniNexusCommunityActivity = {local: () => h.local, enrich: async rows => rows.filter(row => !row.local || h.local.some(local => local.id === row.id && local.owner_id === row.owner_id)), mediaSummaries: async () => [], merge: rows => rows};
  const instrumentation = `shell=()=>{app.present=true;mounted=true;};render=()=>window.__candidate.render(items);renderOverview=()=>window.__candidate.overview(overviewState);window.__candidate.mount=mount;window.__candidate.load=load;window.__candidate.overviewLoad=loadOverview;`;
  window.__candidate = {render: rows => h.renders.push(JSON.parse(JSON.stringify(rows))), overview: state => h.overviewRenders.push(state)};
  vm.runInNewContext(source.replace(/\}\)\(\);\s*$/, `${instrumentation}\n})();`), {window, document, location, URL, scrollY: 0, addEventListener: window.addEventListener.bind(window), requestAnimationFrame: () => 1, setTimeout: fn => {timers.set(++timer, fn); return timer;}, clearTimeout: id => timers.delete(id), console});
  h.go = path => {location.href = `https://aninexus.fixture${path}`;};
  h.burst = () => {for (const name of ['aninexus:route-changed', 'popstate', 'aninexus:navigate']) window.emit(name);};
  h.flush = async () => {for (const [id, fn] of [...timers]) {timers.delete(id); fn();} await settle();};
  h.count = path => h.requests.filter(request => request === path).length;
  return h;
}
const activityPath = '/api/community/activity?limit=40&includeManga=1';

test('one route burst starts one feed cycle and one overview request', async () => {
  const pending = deferred(), h = fixture({api: path => path === activityPath ? pending.promise : undefined});
  h.burst(); await settle(); assert.equal(h.count(activityPath), 1); assert.equal(h.count('/api/community/overview'), 1);
  pending.resolve({items: []}); await settle(); assert.equal(h.renders.length, 1);
});

test('same mounted route signals after completion do not refetch the feed', async () => {
  const h = fixture(); h.burst(); await settle(); const count = h.requests.length;
  h.burst(); await settle(); assert.equal(h.requests.length, count);
});

test('leaving before a response fences the stale paint and a return gets a fresh cycle', async () => {
  const pending = deferred(); let first = true;
  const h = fixture({api: path => {if (path === activityPath && first) {first = false; return pending.promise;}}});
  h.burst(); await settle(); h.go('/animes'); h.burst(); await settle(); const before=h.renders.length;
  pending.resolve({items: [{id: 'stale', media_id: 909, title: 'Stale old route', cover: 'fixture'}]}); await settle(); assert.equal(h.renders.length, before);
  h.app.present = false; h.go('/comunidade'); h.burst(); await settle();
  assert.equal(h.count(activityPath), 2); assert.equal(h.renders.length, 1); assert.deepEqual(h.renders[0], []);
});

test('refresh bursts coalesce and permit a fresh request after a failed feed', async () => {
  const h = fixture({api: path => path === activityPath ? Promise.reject(new Error('synthetic feed unavailable')) : undefined});
  h.burst(); await settle(); for (let i = 0; i < 3; i++) h.window.emit('aninexus:community-activity-changed');
  await h.flush(); assert.equal(h.count(activityPath), 2);
});

test('parallel overview retry calls share the pending response', async () => {
  const pending = deferred(), h = fixture({api: path => path === '/api/community/overview' ? pending.promise : undefined});
  h.app.present = true;
  const first = h.window.__candidate.overviewLoad(), second = h.window.__candidate.overviewLoad(); await settle();
  assert.equal(h.count('/api/community/overview'), 1);
  pending.resolve({totals: {}, rankings: []}); await Promise.all([first, second]);
});

test('an owner change immediately removes local cards while retaining public community content', async () => {
  const publicRow = {id: 'public', media_id: 202, title: 'Public work', cover: 'fixture', username: 'public_member'};
  const h = fixture({api: path => path === activityPath ? {items: [publicRow]} : undefined});
  h.local = [{id: 'a-local', kind: 'state', local: true, owner_id: 'a', media_id: 101, title: 'A only', cover: 'fixture', status: 'CURRENT'}];
  h.burst(); await settle(); assert.equal(h.renders.at(-1).length, 2);
  h.local = []; h.window.emit('aninexus:community-activity-changed', {items: []});
  assert.deepEqual(h.renders.at(-1).map(row => row.id), ['public']);
});
