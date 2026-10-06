import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import test from 'node:test';

const baselineRef = process.env.ANX08_BASELINE_REF;
if (baselineRef) assert.match(baselineRef, /^[a-f0-9]{40}$/, 'baseline must be an immutable commit');
const source = name => baselineRef ? execFileSync('git', ['show', `${baselineRef}:${name}`], {cwd: new URL('..', import.meta.url), encoding: 'utf8'}) : fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const syncSource = source('preview-v39/media-sync-v39.js');
const librarySource = source('preview-v38/library-unified-v49.js');
const authSource = source('preview-v38/auth-v38.js');
const radioSource = source('preview-v44/radio-v44.js');
const A = {id: 'fixture-member-a', username: 'fixture_a'};
const B = {id: 'fixture-member-b', username: 'fixture_b'};
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return {promise, resolve, reject}; };
const settle = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };

function target() {
  const listeners = new Map();
  return {
    addEventListener(name, fn) { const list = listeners.get(name) || []; list.push(fn); listeners.set(name, list); },
    dispatchEvent(event) { for (const fn of [...(listeners.get(event.type) || [])]) fn(event); return true; },
    emit(name, detail) { this.dispatchEvent({type: name, detail}); }
  };
}
function node() {
  const styles = new Map();
  return Object.assign(target(), {
    innerHTML: '', textContent: '', value: '', hidden: false, isConnected: true, dataset: {},
    classList: {add() {}, remove() {}, toggle() {}, contains: () => false},
    style: {getPropertyValue: name => styles.get(name)?.value || '', getPropertyPriority: name => styles.get(name)?.priority || '', setProperty(name, value, priority = '') { styles.set(name, {value, priority}); }, removeProperty: name => styles.delete(name)},
    setAttribute() {}, removeAttribute() {}, remove() { this.isConnected = false; }, focus() {}, getBoundingClientRect: () => ({bottom: 100}), querySelector: () => null, querySelectorAll: () => []
  });
}
function browser({stored = {}, route = '/', api} = {}) {
  const writes = [], requests = [], values = new Map(Object.entries(stored).map(([key, value]) => [key, JSON.stringify(value)]));
  const app = node(), controls = new Map(), notices = [];
  app.before = item => notices.push(item);
  let markup = '';
  Object.defineProperty(app, 'innerHTML', {get: () => markup, set(value) { markup = value; controls.clear(); }});
  const control = selector => {
    const attr = selector.match(/^\[([^=\]]+)/)?.[1] || (selector.startsWith('.') ? selector.slice(1) : null);
    if (!attr || !markup.includes(attr)) return null;
    if (!controls.has(selector)) controls.set(selector, node());
    return controls.get(selector);
  };
  const document = Object.assign(target(), {
    readyState: 'loading', body: node(), documentElement: node(), scripts: [], head: node(),
    querySelector(selector) { if (selector === '#app') return app; return control(selector); },
    querySelectorAll(selector) {
      if (selector === '[data-nx49-status]') return ['ALL', 'CURRENT', 'COMPLETED', 'FAVORITES'].map(status => {
        const item = control(`[data-nx49-status="${status}"]`);
        if (item) item.dataset.nx49Status = status;
        return item;
      }).filter(Boolean);
      return [];
    },
    createElement: () => node()
  });
  const localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem(key, value) { values.set(key, value); writes.push({key, value: JSON.parse(value)}); },
    removeItem(key) { values.delete(key); writes.push({key, removed: true}); }
  };
  const window = target();
  const h = {window, document, localStorage, app, controls, notices, writes, requests, owner: A,
    favorites: [], anime: [], manga: [], syncs: {ANIME: 0, MANGA: 0}, closes: {ANIME: 0, MANGA: 0}};
  window.AniNexusAuth = {enabled: true, async api(path, options = {}) {
    const request = {path, method: options.method || 'GET', options, owner: h.owner?.id || null};
    requests.push(request);
    if (api) { const result = api(request, h); if (result !== undefined) return result; }
    if (request.method !== 'GET') return {};
    if (path === '/api/me') return {user: h.owner};
    if (path === '/api/me/favorites') return {items: h.favorites};
    if (path === '/api/me/list') return {items: h.anime};
    if (path === '/api/me/manga-list') return {items: h.manga};
    if (path === '/api/me/library' || path === '/api/me/manga-library') return {user: h.owner, list: path.includes('manga-') ? h.manga : h.anime, favorites: [], impressions: []};
    throw new Error(`Unexpected request ${path}`);
  }};
  for (const [type, name] of [['ANIME', 'AniNexusMediaState'], ['MANGA', 'AniNexusMangaState']]) window[name] = {
    sync() { h.syncs[type]++; }, close() { h.closes[type]++; }
  };
  window.AniNexusRuntime = {withDeadline: (fn, options = {}) => fn(options.signal || new AbortController().signal), correlationHeaders: () => ({}), deadlineError: () => Object.assign(new Error('fixture aborted'), {name: 'AbortError'})};
  const timers = [];
  h.context = vm.createContext({window, document, localStorage, sessionStorage: localStorage,
    location: {hostname: 'fixture.test', origin: 'https://fixture.test', pathname: route, href: `https://fixture.test${route}`},
    history: {replaceState() {}}, scrollY: 0, URL, URLSearchParams, AbortController,
    CustomEvent: class { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } },
    addEventListener: window.addEventListener.bind(window), dispatchEvent: window.dispatchEvent.bind(window),
    queueMicrotask, setTimeout: fn => (timers.push(fn), timers.length), clearTimeout() {},
    requestAnimationFrame: () => 1, cancelAnimationFrame() {}, getComputedStyle: () => ({getPropertyValue: () => '66'}), console,
    fetch: () => { throw new Error('Unexpected direct fetch'); }, atob: value => Buffer.from(value, 'base64').toString()
  });
  h.run = script => vm.runInContext(script, h.context);
  h.flushTimers = async () => { for (const fn of timers.splice(0)) fn(); await settle(); };
  h.boot = async () => { document.emit('DOMContentLoaded'); await settle(); };
  h.identity = (user, extra = {}) => window.emit('aninexus:account-identity-changed', {user, ...extra});
  h.read = (key, fallback = null) => JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
  h.count = path => requests.filter(request => request.path === path && request.method === 'GET').length;
  return h;
}
const owners = user => ({'aninexus:mediaOwner': user.id, 'aninexus:mangaOwner': user.id});
const row = (id, title, status = 'CURRENT') => ({media_id: id, status, updated_at: '2026-01-01T00:00:00Z', media: {id, title}});
function headerBrowser() {
  const h = browser(), actions = node(), baseQuery = h.document.querySelector;
  actions.insertBefore = () => {};
  h.document.querySelector = selector => selector === '.top-actions' ? actions : baseQuery(selector);
  h.document.scripts = ['ui@1/dist/ui.browser.js', 'clerk-js@6/dist/clerk.browser.js'].map(suffix => ({src: `https://fixture.clerk.test/npm/@clerk/${suffix}`, dataset: {loaded: 'true'}}));
  h.window.__internal_ClerkUICtor = function () {};
  h.window.__ANINEXUS_CONFIG__ = {authEnabled: true, apiOrigin: 'https://fixture-api.test', clerkPublishableKey: `pk_test_${Buffer.from('fixture.clerk.test$').toString('base64')}`};
  h.window.Clerk = {user: {id: 'fixture-clerk'}, session: {getToken: async () => 'fixture-token'}, load: async () => {}, addListener() {}};
  h.context.fetch = async path => path.includes('clerk-localization') ? {ok: true, json: async () => ({})} : {ok: true, status: 200, json: async () => ({user: h.owner})};
  return h;
}

test('bootstrap shares identity and favorites while preserving typed list reads', async () => {
  const h = browser(); h.favorites = [{media_id: 101, media_type: 'ANIME'}, {media_id: 202, media_type: 'MANGA'}];
  h.run(syncSource); await h.boot();
  assert.equal(h.count('/api/me'), 1);
  assert.equal(h.count('/api/me/favorites'), 1);
  assert.equal(h.count('/api/me/list'), 1); assert.equal(h.count('/api/me/manga-list'), 1);
  assert.deepEqual(h.read('aninexus:favorites'), [101]); assert.deepEqual(h.read('aninexus:mangaFavorites'), [202]);
  assert.equal(h.read('aninexus:mediaOwner'), A.id); assert.equal(h.read('aninexus:mangaOwner'), A.id);
});

test('same owner events neither duplicate pending reads nor clear local edits', async () => {
  const favorites = deferred(), anime = deferred(), manga = deferred();
  const h = browser({stored: owners(A), api: ({path}) => path === '/api/me/favorites' ? favorites.promise : path === '/api/me/list' ? anime.promise : path === '/api/me/manga-list' ? manga.promise : undefined});
  h.run(syncSource); await h.boot(); const counts = h.requests.length;
  h.localStorage.setItem('aninexus:favorites:pending:v1', JSON.stringify({101: true}));
  h.identity({...A, displayName: 'Updated fixture'}); h.identity(A); await settle();
  assert.equal(h.requests.length, counts); assert.deepEqual(h.read('aninexus:favorites:pending:v1'), {101: true});
  favorites.resolve({items: []}); anime.resolve({items: []}); manga.resolve({items: []}); await settle();
  const completed = h.requests.length; h.identity(A); await settle(); assert.equal(h.requests.length, completed);
});

test('owner switch ignores late favorites and lists from the previous owner', async () => {
  const oldFavorites = deferred(), oldAnime = deferred(), oldManga = deferred();
  const h = browser({stored: {...owners(A), 'aninexus:favorites': [1]}, api: ({path, owner}) => owner === A.id && path === '/api/me/favorites' ? oldFavorites.promise : owner === A.id && path === '/api/me/list' ? oldAnime.promise : owner === A.id && path === '/api/me/manga-list' ? oldManga.promise : undefined});
  h.run(syncSource); await h.boot(); h.owner = B; h.favorites = [{media_id: 202, media_type: 'MANGA'}]; h.anime = [row(303, 'B fixture')]; h.identity(B); await settle();
  oldFavorites.resolve({items: [{media_id: 909, media_type: 'ANIME'}]}); oldAnime.resolve({items: [row(909, 'A late')]}); oldManga.resolve({items: [row(909, 'A late manga')]}); await settle();
  assert.deepEqual(h.read('aninexus:favorites'), []); assert.deepEqual(h.read('aninexus:mangaFavorites'), [202]);
  assert.deepEqual(Object.keys(h.read('aninexus:mediaState:v2')), ['303']); assert.deepEqual(h.read('aninexus:mangaState:v2'), {});
  assert.equal(h.read('aninexus:mediaOwner'), B.id); assert.equal(h.count('/api/me/favorites'), 2);
});

test('a late bootstrap identity cannot restore storage after logout before owner confirmation', async () => {
  const me = deferred(); const h = browser({api: ({path}) => path === '/api/me' ? me.promise : undefined});
  h.favorites = [{media_id: 909, media_type: 'ANIME'}]; h.run(syncSource); await h.boot(); h.owner = null; h.identity(null);
  me.resolve({user: A}); await settle();
  assert.equal(h.count('/api/me/favorites'), 0); assert.equal(h.count('/api/me/list'), 0);
  assert.equal(h.read('aninexus:favorites'), null); assert.equal(h.read('aninexus:mediaOwner'), null);
});

test('a late bootstrap identity cannot overwrite a newly confirmed owner', async () => {
  const me = deferred(); const h = browser({api: ({path}) => path === '/api/me' ? me.promise : undefined});
  h.run(syncSource); await h.boot(); h.owner = B; h.favorites = [{media_id: 202, media_type: 'MANGA'}]; h.identity(B); await settle();
  me.resolve({user: A}); await settle();
  assert.equal(h.read('aninexus:mediaOwner'), B.id); assert.deepEqual(h.read('aninexus:mangaFavorites'), [202]);
  assert.equal(h.count('/api/me/favorites'), 1);
});

test('missing identity payload and unconfirmed Clerk fallback preserve ownership and pending', async () => {
  const h = browser({stored: {...owners(A), 'aninexus:favorites': [101], 'aninexus:favorites:pending:v1': {101: true}}});
  h.run(syncSource); h.window.emit('aninexus:account-identity-changed'); h.identity({id: 'fixture-clerk-id'}, {confirmed: false}); await settle();
  assert.equal(h.read('aninexus:mediaOwner'), A.id); assert.deepEqual(h.read('aninexus:favorites'), [101]);
  assert.deepEqual(h.read('aninexus:favorites:pending:v1'), {101: true}); assert.equal(h.requests.length, 0);
});

test('online and retry bursts share one read cycle and failed reads remain retryable', async () => {
  let unavailable = true;
  const h = browser({api: ({path}) => path === '/api/me' && unavailable ? Promise.reject(Object.assign(new Error('fixture unavailable'), {status: 503})) : undefined});
  h.run(syncSource); await h.boot(); assert.equal(h.count('/api/me/favorites'), 0);
  unavailable = false; h.window.emit('online'); h.window.emit('aninexus:media-sync-retry'); h.window.emit('online'); await settle();
  assert.equal(h.count('/api/me'), 2); assert.equal(h.count('/api/me/favorites'), 1);
  assert.equal(h.count('/api/me/list'), 1); assert.equal(h.count('/api/me/manga-list'), 1);
  h.window.emit('aninexus:media-sync-retry'); await settle(); assert.equal(h.count('/api/me/favorites'), 2);
});

test('an unauthenticated identity read can recover on an explicit retry', async () => {
  const h = browser(); h.owner = null; h.run(syncSource); await h.boot();
  h.owner = A; h.window.emit('aninexus:media-sync-retry'); await settle();
  assert.equal(h.count('/api/me'), 2); assert.equal(h.count('/api/me/favorites'), 1); assert.equal(h.read('aninexus:mediaOwner'), A.id);
});

test('late hydration preserves successful local favorite and state edits in both media types', async () => {
  const favorites = deferred(), anime = deferred(), manga = deferred();
  const h = browser({stored: owners(A), api: ({path, method}) => method === 'GET' && path === '/api/me/favorites' ? favorites.promise : method === 'GET' && path === '/api/me/list' ? anime.promise : method === 'GET' && path === '/api/me/manga-list' ? manga.promise : undefined});
  h.run(syncSource); await h.boot();
  for (const [prefix, favKey, stateKey, id] of [['', 'aninexus:favorites', 'aninexus:mediaState:v2', 101], ['manga-', 'aninexus:mangaFavorites', 'aninexus:mangaState:v2', 202]]) {
    h.localStorage.setItem(favKey, JSON.stringify([id])); h.document.emit(`aninexus:${prefix}favorite-changed`, {id, favorite: true});
    const state = {status: 'CURRENT', progress: 7, updatedAt: Date.parse('2026-02-01T00:00:00Z')};
    h.localStorage.setItem(stateKey, JSON.stringify({[id]: state})); h.document.emit(`aninexus:${prefix}media-state-changed`, {id, state});
  }
  await settle(); favorites.resolve({items: []}); anime.resolve({items: []}); manga.resolve({items: []}); await settle();
  assert.deepEqual(h.read('aninexus:favorites'), [101]); assert.deepEqual(h.read('aninexus:mangaFavorites'), [202]);
  assert.equal(h.read('aninexus:mediaState:v2')[101].progress, 7); assert.equal(h.read('aninexus:mangaState:v2')[202].progress, 7);
  assert.equal(h.requests.filter(request => request.method === 'DELETE').length, 0);
});

test('previous owner write failure cannot announce pending work in the new owner', async () => {
  const oldWrite = deferred();
  const h = browser({stored: owners(A), api: ({method, owner}) => method !== 'GET' && owner === A.id ? oldWrite.promise : undefined});
  const notices = []; h.document.addEventListener('aninexus:media-sync-pending', event => notices.push(event.detail));
  h.run(syncSource); await h.boot(); h.document.emit('aninexus:favorite-changed', {id: 101, favorite: true}); await settle();
  h.owner = B; h.identity(B); await settle(); oldWrite.reject(new Error('A write failed late')); await settle();
  assert.deepEqual(notices, []); assert.deepEqual(h.read('aninexus:favorites:pending:v1', {}), {});
});

test('previous owner write success cannot clear a new owner pending edit with the same id', async () => {
  const oldWrite = deferred(), newWrite = deferred();
  const h = browser({stored: owners(A), api: ({method, owner}) => method !== 'GET' ? (owner === A.id ? oldWrite.promise : newWrite.promise) : undefined});
  h.run(syncSource); await h.boot(); h.document.emit('aninexus:favorite-changed', {id: 101, favorite: true}); await settle();
  h.owner = B; h.identity(B); await settle(); h.document.emit('aninexus:favorite-changed', {id: 101, favorite: true});
  oldWrite.resolve({}); await settle(); assert.deepEqual(h.read('aninexus:favorites:pending:v1'), {101: true});
  newWrite.resolve({}); await settle(); assert.deepEqual(h.read('aninexus:favorites:pending:v1'), {});
});

test('library same-owner confirmation preserves in-flight aggregates and later filters', async () => {
  const anime = deferred(), manga = deferred();
  const h = browser({route: '/minha-biblioteca', api: ({path}) => path === '/api/me/library' ? anime.promise : path === '/api/me/manga-library' ? manga.promise : undefined});
  h.run(librarySource); await h.boot(); h.identity(A); h.identity({...A, displayName: 'Updated fixture'}); await settle();
  assert.equal(h.count('/api/me/library'), 1); assert.equal(h.count('/api/me/manga-library'), 1);
  assert.equal(h.requests[0].options.signal.aborted, false);
  anime.resolve({user: A, list: [row(101, 'Alpha fixture'), row(102, 'Beta fixture', 'COMPLETED')]}); await settle();
  assert.match(h.app.innerHTML, /Seus animes/); assert.match(h.controls.get('[data-nx49-content]').innerHTML, /Alpha fixture/);
  h.document.querySelector('[data-nx49-status="CURRENT"]').emit('click');
  const search = h.document.querySelector('[data-nx49-search]'); search.dispatchEvent({type: 'input', target: {value: 'Alpha'}});
  const filters = h.document.querySelector('[data-nx49-filter-layer]'); filters.hidden = false;
  h.identity({...A, displayName: 'Updated visible fixture'}); await settle();
  assert.equal(h.document.querySelector('[data-nx49-search]'), search); assert.equal(filters.hidden, false);
  assert.match(h.document.querySelector('.nx49-profile-identity').innerHTML, /Updated visible fixture/);
  manga.resolve({user: A, list: []}); await settle();
  assert.equal(h.count('/api/me/library'), 1); assert.equal(h.count('/api/me/manga-library'), 1);
  assert.match(h.controls.get('[data-nx49-content]').innerHTML, /Alpha fixture/); assert.doesNotMatch(h.controls.get('[data-nx49-content]').innerHTML, /Beta fixture/);
});

test('library owner switch aborts old aggregates and rejects their late data', async () => {
  const oldAnime = deferred(), oldManga = deferred();
  const h = browser({route: '/minha-biblioteca', stored: owners(A), api: ({path, owner}) => owner === A.id && path === '/api/me/library' ? oldAnime.promise : owner === A.id && path === '/api/me/manga-library' ? oldManga.promise : undefined});
  h.run(librarySource); await h.boot(); h.identity(A); await settle(); const previous = [...h.requests];
  h.owner = B; h.anime = [row(303, 'B current fixture')]; h.identity(B); await settle();
  assert.equal(previous[0].options.signal.aborted, true);
  oldAnime.resolve({user: A, list: [row(909, 'A stale fixture')]}); oldManga.resolve({user: A, list: [row(909, 'A stale manga')]}); await settle();
  assert.match(h.controls.get('[data-nx49-content]').innerHTML, /B current fixture/); assert.doesNotMatch(h.app.innerHTML, /A stale/);
});

test('library ignores missing identity and suspends unconfirmed identity without extra reads', async () => {
  const h = browser({route: '/minha-biblioteca'}); h.run(librarySource); await h.boot(); const requests = h.requests.length;
  h.window.emit('aninexus:account-identity-changed'); await settle(); assert.equal(h.app.hidden, false);
  h.identity({id: 'fixture-clerk'}, {confirmed: false}); await settle();
  assert.equal(h.requests.length, requests);
  assert.equal(h.app.hidden, true); assert.match(h.notices.at(-1)?.innerHTML || '', /Confirmando sua conta/);
});

test('unconfirmed account switch aborts aggregates and cannot accept late previous-owner data', async () => {
  const anime = deferred(), manga = deferred();
  const h = browser({route: '/minha-biblioteca', stored: owners(A), api: ({path}) => path === '/api/me/library' ? anime.promise : path === '/api/me/manga-library' ? manga.promise : undefined});
  h.run(librarySource); await h.boot(); h.owner = B; h.identity({id: 'fixture-clerk-b'}, {confirmed: false});
  anime.resolve({user: A, list: [row(909, 'A private late fixture')]}); manga.resolve({user: A, list: []}); await settle();
  assert.doesNotMatch(h.controls.get('[data-nx49-content]')?.innerHTML || '', /A private late fixture/);
  assert.equal(h.requests[0].options.signal.aborted, true); assert.equal(h.app.hidden, true);
  assert.equal(h.app.style.getPropertyValue('display'), 'none'); assert.equal(h.app.style.getPropertyPriority('display'), 'important');
  assert.equal(h.controls.get('[data-nx49-content]')?.innerHTML || '', '');
  assert.equal(h.read('aninexus:mediaOwner'), A.id);
});

test('same owner reconfirmation restores existing library controls and pending without another aggregate', async () => {
  const h = browser({route: '/minha-biblioteca', stored: {...owners(A), 'aninexus:favorites:pending:v1': {101: true}}});
  h.anime = [row(101, 'Alpha fixture'), row(102, 'Beta fixture', 'COMPLETED')]; h.run(librarySource); await h.boot();
  h.document.querySelector('[data-nx49-status="CURRENT"]').emit('click');
  const search = h.document.querySelector('[data-nx49-search]'); search.dispatchEvent({type: 'input', target: {value: 'Alpha'}});
  const filters = h.document.querySelector('[data-nx49-filter-layer]'); filters.hidden = false;
  h.identity({id: 'fixture-clerk'}, {confirmed: false}); assert.equal(h.app.hidden, true);
  const localState = {status: 'CURRENT', progress: 7};
  h.document.emit('aninexus:media-state-changed', {id: 101, state: localState});
  h.localStorage.setItem('aninexus:mediaState:pending:v1', JSON.stringify({101: localState}));
  h.identity({...A, displayName: 'Reconfirmed fixture'}); await settle();
  assert.equal(h.app.hidden, false); assert.equal(h.document.querySelector('[data-nx49-search]'), search); assert.equal(filters.hidden, false);
  assert.equal(h.notices.at(-1).isConnected, false);
  assert.equal(h.count('/api/me/library'), 1); assert.equal(h.count('/api/me/manga-library'), 1);
  assert.deepEqual(h.read('aninexus:favorites:pending:v1'), {101: true});
  assert.deepEqual(h.read('aninexus:mediaState:pending:v1'), {101: localState}); assert.match(h.controls.get('[data-nx49-content]').innerHTML, /ep\. 7/);
  assert.match(h.controls.get('[data-nx49-content]').innerHTML, /Alpha fixture/); assert.doesNotMatch(h.controls.get('[data-nx49-content]').innerHTML, /Beta fixture/);
});

test('same owner reconfirmation retries only the aggregate canceled while still loading', async () => {
  const manga = deferred();
  const h = browser({route: '/minha-biblioteca', stored: owners(A), api: ({path}, current) => path === '/api/me/manga-library' && current.count(path) === 1 ? manga.promise : undefined});
  h.anime = [row(101, 'Alpha cached fixture')]; h.run(librarySource); await h.boot();
  const search = h.document.querySelector('[data-nx49-search]'); search.dispatchEvent({type: 'input', target: {value: 'Alpha'}});
  h.identity({id: 'fixture-clerk'}, {confirmed: false}); h.identity(A); await settle();
  assert.equal(h.count('/api/me/library'), 1); assert.equal(h.count('/api/me/manga-library'), 2);
  assert.equal(h.document.querySelector('[data-nx49-search]'), search);
  manga.resolve({user: A, list: [row(909, 'Canceled manga fixture')]}); await settle();
  assert.doesNotMatch(h.app.innerHTML, /Canceled manga fixture/);
});

test('a newly confirmed owner replaces suspended private UI before it becomes visible', async () => {
  const h = browser({route: '/minha-biblioteca', stored: owners(A)}); h.anime = [row(101, 'A private fixture')];
  h.run(librarySource); await h.boot(); h.identity({id: 'fixture-clerk-b'}, {confirmed: false});
  assert.equal(h.app.hidden, true); h.owner = B; h.anime = [row(303, 'B confirmed fixture')]; h.identity(B); await settle();
  assert.equal(h.app.hidden, false); assert.equal(h.app.style.getPropertyValue('display'), ''); assert.equal(h.notices.at(-1).isConnected, false);
  assert.match(h.controls.get('[data-nx49-content]').innerHTML, /B confirmed fixture/); assert.doesNotMatch(h.controls.get('[data-nx49-content]').innerHTML, /A private fixture/);
  assert.equal(h.count('/api/me/library'), 2); assert.equal(h.count('/api/me/manga-library'), 2);
});

test('leaving the suspended library restores the app container for other routes', async () => {
  const h = browser({route: '/minha-biblioteca', stored: owners(A)}); h.run(librarySource); await h.boot();
  h.identity({id: 'fixture-clerk-b'}, {confirmed: false}); assert.equal(h.app.hidden, true);
  h.context.location.href = 'https://fixture.test/noticias'; h.context.location.pathname = '/noticias'; h.window.emit('popstate'); await h.flushTimers();
  assert.equal(h.app.hidden, false); assert.equal(h.app.style.getPropertyValue('display'), ''); assert.equal(h.notices.at(-1).isConnected, false);
  h.app.innerHTML = '<main>News route fixture</main>'; h.owner = B; h.identity(B); await settle();
  assert.match(h.app.innerHTML, /News route fixture/);
});

test('returning to the same library route while suspended remounts after confirmation', async () => {
  const h = browser({route: '/minha-biblioteca', stored: owners(A)}); h.anime = [row(101, 'Alpha restored fixture')];
  h.run(librarySource); await h.boot(); h.identity({id: 'fixture-clerk'}, {confirmed: false});
  h.context.location.href = 'https://fixture.test/noticias'; h.context.location.pathname = '/noticias'; h.window.emit('popstate'); await h.flushTimers();
  h.app.innerHTML = '<main>Other route fixture</main>';
  h.context.location.href = 'https://fixture.test/minha-biblioteca'; h.context.location.pathname = '/minha-biblioteca';
  h.app.innerHTML = '<main>Library route loading fixture</main>'; h.window.emit('popstate'); await h.flushTimers();
  assert.equal(h.app.hidden, true); h.identity(A); await settle();
  assert.equal(h.app.hidden, false); assert.match(h.controls.get('[data-nx49-content]')?.innerHTML || '', /Alpha restored fixture/);
  assert.equal(h.count('/api/me/library'), 2); assert.equal(h.count('/api/me/manga-library'), 2);
});

test('a suspended library filter does not trap header Tab or close on Escape', async () => {
  const h = browser({route: '/minha-biblioteca', stored: owners(A)}); h.run(librarySource); await h.boot();
  const filters = h.document.querySelector('[data-nx49-filter-layer]'); filters.hidden = false;
  h.identity({id: 'fixture-clerk'}, {confirmed: false});
  let prevented = false; h.document.activeElement = node();
  h.document.dispatchEvent({type: 'keydown', key: 'Tab', preventDefault() { prevented = true; }});
  assert.equal(prevented, false);
  h.document.dispatchEvent({type: 'keydown', key: 'Escape'}); assert.equal(filters.hidden, false);
  h.identity(A); await settle(); assert.equal(h.document.querySelector('[data-nx49-filter-layer]'), filters); assert.equal(filters.hidden, false);
});

test('library logout invalidates private aggregates and ignores stale responses', async () => {
  const anime = deferred(), manga = deferred();
  const h = browser({route: '/minha-biblioteca', stored: owners(A), api: ({path, owner}) => owner === A.id && path === '/api/me/library' ? anime.promise : owner === A.id && path === '/api/me/manga-library' ? manga.promise : owner === null ? Promise.reject(Object.assign(new Error('fixture auth'), {status: 401})) : undefined});
  h.run(librarySource); await h.boot(); h.owner = null; h.identity(null); await settle();
  anime.resolve({user: A, list: [row(909, 'A private fixture')]}); manga.resolve({user: A, list: []}); await settle();
  assert.match(h.app.innerHTML, /Sua biblioteca começa aqui/); assert.doesNotMatch(h.app.innerHTML, /A private/);
});

test('header marks API identity confirmed and its Clerk fallback unconfirmed', async () => {
  const h = headerBrowser(), events = [];
  h.window.addEventListener('aninexus:account-identity-changed', event => events.push(event.detail));
  let response = {user: A};
  h.context.fetch = async path => path.includes('clerk-localization') ? {ok: true, json: async () => ({})} : {ok: true, status: 200, json: async () => response};
  h.run(authSource); await settle(); assert.equal(events.at(-1)?.confirmed, true); assert.equal(events.at(-1).user.id, A.id);
  response = {}; await h.window.AniNexusAuthV38.syncHeader(); assert.equal(events.at(-1).confirmed, false);
  h.context.fetch = async () => { throw new Error('fixture unavailable'); }; await h.window.AniNexusAuthV38.syncHeader(); assert.equal(events.at(-1).confirmed, false);
  h.window.Clerk.user = null; await h.window.AniNexusAuthV38.syncHeader(); assert.equal(events.at(-1).confirmed, true); assert.equal(events.at(-1).user, null);
});

test('unconfirmed identity suspends authenticated writes without clearing pending state', async () => {
  const h = browser({stored: owners(A)}); h.run(syncSource); await h.boot();
  h.identity({id: 'fixture-clerk'}, {confirmed: false});
  h.document.emit('aninexus:manga-favorite-changed', {id: 202, favorite: true}); await settle();
  assert.equal(h.requests.filter(request => request.method !== 'GET').length, 0);
  assert.deepEqual(h.read('aninexus:mangaFavorites:pending:v1'), {202: true}); assert.equal(h.read('aninexus:mangaOwner'), A.id);
  h.identity(A); await settle();
  assert.equal(h.requests.filter(request => request.path === '/api/me/favorites/202' && request.method === 'PUT').length, 1);
  assert.deepEqual(h.read('aninexus:mangaFavorites:pending:v1'), {});
});

test('a repeated unconfirmed identity fences an identity retry before pending can cross accounts', async () => {
  const retryIdentity = deferred(); let retrying = false;
  const h = browser({stored: owners(A), api: ({path}) => retrying && path === '/api/me' ? retryIdentity.promise : undefined});
  h.run(syncSource); await h.boot(); h.identity({id: 'fixture-clerk-a'}, {confirmed: false});
  h.localStorage.setItem('aninexus:favorites:pending:v1', JSON.stringify({101: true}));
  retrying = true; h.window.emit('aninexus:media-sync-retry'); await settle();
  const pendingRead = h.requests.at(-1); assert.equal(pendingRead.path, '/api/me');
  h.owner = B; h.identity({id: 'fixture-clerk-b'}, {confirmed: false}); retryIdentity.resolve({user: A}); await settle();
  assert.equal(h.requests.filter(request => request.owner === B.id && request.method !== 'GET').length, 0);
  assert.equal(pendingRead.options.signal?.aborted, true);
  assert.equal(h.read('aninexus:mediaOwner'), A.id); assert.deepEqual(h.read('aninexus:favorites:pending:v1'), {101: true});
  h.identity(B); await settle();
  assert.equal(h.read('aninexus:mediaOwner'), B.id); assert.equal(h.requests.filter(request => request.owner === B.id && request.method !== 'GET').length, 0);
});

test('a failed favorites read preserves storage and succeeds on the next explicit cycle', async () => {
  let unavailable = true;
  const h = browser({stored: {...owners(A), 'aninexus:favorites': [101]}, api: ({path}) => path === '/api/me/favorites' && unavailable ? Promise.reject(new Error('fixture favorites unavailable')) : undefined});
  h.run(syncSource); await h.boot(); assert.deepEqual(h.read('aninexus:favorites'), [101]); assert.equal(h.count('/api/me/favorites'), 1);
  unavailable = false; h.favorites = [{media_id: 202, media_type: 'MANGA'}]; h.window.emit('aninexus:media-sync-retry'); await settle();
  assert.deepEqual(h.read('aninexus:mangaFavorites'), [202]); assert.equal(h.count('/api/me/favorites'), 2);
});

test('an old identity rejection cannot remove the newly confirmed owner used for writes', async () => {
  const me = deferred(); const h = browser({api: ({path}) => path === '/api/me' ? me.promise : undefined});
  h.run(syncSource); await h.boot(); h.owner = B; h.identity(B); await settle(); me.reject(new Error('A late identity failure')); await settle();
  h.document.emit('aninexus:manga-favorite-changed', {id: 202, favorite: true}); await settle();
  assert.equal(h.count('/api/me'), 1); assert.equal(h.read('aninexus:mangaOwner'), B.id);
  assert.equal(h.requests.filter(request => request.method === 'PUT' && request.owner === B.id).length, 1);
});

test('unknown initial library owner validates aggregate owner after first confirmation', async () => {
  const oldAnime = deferred(), oldManga = deferred();
  const h = browser({route: '/minha-biblioteca', api: ({path, owner}) => owner === A.id && path === '/api/me/library' ? oldAnime.promise : owner === A.id && path === '/api/me/manga-library' ? oldManga.promise : undefined});
  h.run(librarySource); await h.boot(); h.owner = B; h.anime = [row(303, 'B first confirmed fixture')]; h.identity(B); await settle();
  oldAnime.resolve({user: A, list: [row(909, 'A stale fixture')]}); oldManga.resolve({user: A, list: []}); await settle();
  assert.match(h.controls.get('[data-nx49-content]').innerHTML, /B first confirmed fixture/);
  assert.equal(h.count('/api/me/library'), 2); assert.equal(h.count('/api/me/manga-library'), 2);
});

test('radio account identity cannot resolve from an unconfirmed Clerk fallback', async () => {
  const h = browser(); h.document.documentElement.dataset.nxAuthState = 'authenticated';
  const boundary = radioSource.indexOf('  const saved ='); assert.ok(boundary > 0);
  h.run(`${radioSource.slice(0, boundary)}\n})();`); // Real identity coordinator without audio initialization.
  h.identity(A); h.identity({id: 'fixture-clerk'}, {confirmed: false});
  const user = await h.window.AniNexusAccountData();
  assert.equal(user.id, A.id); assert.equal(h.count('/api/me'), 1);
});

test('identity switch aborts a sync write waiting for the real auth token before fetch', async () => {
  const h = headerBrowser(); h.run(authSource); await settle(); h.run(syncSource); await h.boot();
  const token = deferred(), sent = [];
  h.window.Clerk.session.getToken = () => token.promise;
  h.context.fetch = async (path, options = {}) => { sent.push({path, method: options.method || 'GET'}); return {ok: true, status: 200, json: async () => ({user: h.owner, items: []})}; };
  h.document.emit('aninexus:favorite-changed', {id: 101, favorite: true}); await settle();
  h.owner = B; h.identity(B); token.resolve('fixture-token'); await settle();
  assert.equal(sent.filter(request => request.method === 'PUT').length, 0);
  assert.equal(h.read('aninexus:mediaOwner'), B.id);
});
