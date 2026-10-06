import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import test from 'node:test';

const baselineRef = process.env.ANX07_BASELINE_REF;
if (baselineRef) assert.match(baselineRef,/^[a-f0-9]{40}$/,'baseline must be an immutable commit');
const source = name => baselineRef ? execFileSync('git',['show',`${baselineRef}:${name}`],{cwd:new URL('..',import.meta.url),encoding:'utf8'}) : fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const syncSource = source('preview-v39/media-sync-v39.js');
const actionsSource = source('preview-v39/media-actions-v39.js');
const librarySource = source('preview-v38/library-unified-v49.js');
const A = {id:'fixture-a',username:'fixture_a'}, B = {id:'fixture-b',username:'fixture_b'};
const settle = async () => {for (let index = 0; index < 60; index++) await Promise.resolve();};
const deferred = () => {let resolve,reject; const promise = new Promise((yes,no) => {resolve = yes; reject = no;}); return {promise,resolve,reject};};
const unavailable = status => Promise.reject(Object.assign(new Error('fixture unavailable'), {status}));
const owned = {'aninexus:mediaOwner':A.id,'aninexus:mangaOwner':A.id};
const state901 = {status:'CURRENT',progress:4,updatedAt:1};
const row = (id = 101,type = 'ANIME') => ({media_id:id,media_type:type,status:'CURRENT',progress:1,updated_at:'2026-01-01T00:00:00Z',media:{id,mediaType:type,title:`Fresh ${type} fixture ${id}`,cover:'/fixture-cover.svg'}});

function target() {
  const listeners = new Map();
  return {addEventListener(name,fn) {const list = listeners.get(name) || []; list.push(fn); listeners.set(name,list);},
    dispatchEvent(event) {for (const fn of [...(listeners.get(event.type) || [])]) fn(event); return true;},
    emit(type,detail) {return this.dispatchEvent({type,detail,currentTarget:this});}};
}
function node() {
  const children = new Map(), styles = new Map(), classes = new Set();
  return Object.assign(target(), {innerHTML:'',textContent:'',value:'',hidden:false,isConnected:true,dataset:{},childNodes:[],nodeType:1,
    classList:{add(...items) {items.forEach(item => classes.add(item));},remove(...items) {items.forEach(item => classes.delete(item));},contains:item => classes.has(item),toggle() {}},
    style:{getPropertyValue:name => styles.get(name)?.value || '',getPropertyPriority:name => styles.get(name)?.priority || '',setProperty(name,value,priority = '') {styles.set(name,{value,priority});},removeProperty:name => styles.delete(name)},
    setAttribute() {},removeAttribute() {},remove() {this.isConnected = false;},focus() {},append() {},matches:() => false,
    getBoundingClientRect:() => ({bottom:100}),getClientRects:() => [1],
    querySelector(selector) {if (!children.has(selector)) children.set(selector,node()); return children.get(selector);},querySelectorAll:() => []});
}
function browser({api,stored = {},library = false} = {}) {
  const values = new Map(Object.entries(stored).map(([key,value]) => [key,JSON.stringify(value)])), requests = [], notices = [], controls = new Map(), timers = new Map();
  const app = node(); let markup = '', timerId = 0;
  app.before = item => notices.push(item);
  Object.defineProperty(app,'innerHTML',{get:() => markup,set(value) {markup = value; controls.clear();}});
  function control(selector) {
    const attr = selector.match(/^\[([^=\]]+)/)?.[1] || (selector.startsWith('.') ? selector.slice(1) : null);
    if (!attr || !markup.includes(attr)) return null;
    if (!controls.has(selector)) {const item = node(); item.querySelector = () => null; if (selector === '[data-nx49-filter-layer]') item.hidden = true; controls.set(selector,item);}
    return controls.get(selector);
  }
  const document = Object.assign(target(), {readyState:'loading',body:node(),head:node(),documentElement:node(),
    querySelector(selector) {if (selector === '#app') return app; if (selector === '.nx-media-sync-notice') return notices.find(item => item.isConnected && item.className === 'nx-media-sync-notice') || null; return control(selector);},
    querySelectorAll(selector) {
      if (selector === '[data-nx49-media]') return ['ANIME','MANGA'].map(type => {const item = control(`[data-nx49-media="${type}"]`); if (item) item.dataset.nx49Media = type; return item;}).filter(Boolean);
      if (selector === '[data-nx49-view="IMPRESSIONS"]') return [control(selector)].filter(Boolean);
      if (selector === '[data-nx49-status]') return ['ALL','CURRENT','COMPLETED'].map(status => {const item = control(`[data-nx49-status="${status}"]`); if (item) item.dataset.nx49Status = status; return item;}).filter(Boolean);
      return [];
    },createElement:node});
  document.body.append = item => notices.push(item);
  const localStorage = {getItem:key => values.get(key) ?? null,setItem:(key,value) => values.set(key,value),removeItem:key => values.delete(key)};
  const window = target();
  const h = {window,document,app,requests,controls,owner:A,statuses:[]};
  document.addEventListener('aninexus:media-sync-read-status',event => h.statuses.push(event.detail));
  window.AniNexusAuth = {enabled:true,async api(path,options = {}) {
    const request = {path,method:options.method || 'GET',owner:h.owner,options}; requests.push(request);
    if (api) {const result = api(request,h); if (result !== undefined) return result;}
    if (request.method !== 'GET') return {};
    if (path === '/api/me') return {user:h.owner};
    if (path === '/api/me/favorites') return {items:[]};
    if (path === '/api/me/list' || path === '/api/me/manga-list') return {items:[]};
    if (path === '/api/me/library' || path === '/api/me/manga-library') return {user:h.owner,list:[row(h.owner?.id === B.id ? 201 : 101,path.includes('manga-') ? 'MANGA' : 'ANIME')],favorites:[],impressions:[]};
    throw new Error(`Unexpected fixture request ${path}`);
  }};
  for (const name of ['AniNexusMediaState','AniNexusMangaState']) window[name] = {sync() {},close() {}};
  window.AniNexusRuntime = {withDeadline:(fn,options = {}) => fn(options.signal || new AbortController().signal),deadlineError:() => Object.assign(new Error('fixture aborted'),{name:'AbortError'})};
  const context = vm.createContext({window,document,localStorage,location:{hostname:'fixture.test',origin:'https://fixture.test',href:'https://fixture.test/minha-biblioteca',pathname:'/minha-biblioteca'},
    history:{replaceState() {}},URL,URLSearchParams,AbortController,performance:{now:() => 1},Node:{TEXT_NODE:3},
    CustomEvent:class {constructor(type,options = {}) {this.type = type; this.detail = options.detail;}},
    addEventListener:window.addEventListener.bind(window),dispatchEvent:window.dispatchEvent.bind(window),queueMicrotask,
    setTimeout:fn => {timers.set(++timerId,fn); return timerId;},clearTimeout:id => timers.delete(id),requestAnimationFrame:() => 1,cancelAnimationFrame() {},
    getComputedStyle:() => ({getPropertyValue:() => '66'}),MutationObserver:class {observe() {}},scrollY:0,console});
  h.run = script => vm.runInContext(script,context);
  h.run(actionsSource); h.run(syncSource); if (library) h.run(librarySource);
  h.boot = async () => {document.emit('DOMContentLoaded'); await settle();};
  h.identity = (user,extra = {}) => window.emit('aninexus:account-identity-changed',{user,...extra});
  h.retry = () => window.emit('aninexus:media-sync-retry');
  h.read = key => JSON.parse(localStorage.getItem(key) || 'null');
  h.count = path => requests.filter(request => request.path === path && request.method === 'GET').length;
  h.notice = () => document.querySelector('.nx-media-sync-notice');
  h.text = () => h.notice()?.querySelector('span').textContent || h.notice()?.innerHTML || '';
  h.expireTimers = async () => {for (const [id,fn] of [...timers]) {timers.delete(id); fn();} await settle();};
  return h;
}

test('background list failure is visible while independent V49 aggregates are fresh',async () => {
  const h = browser({library:true,stored:{...owned,'aninexus:mediaState:v2':{901:state901}},api:({path}) => ['/api/me/list','/api/me/manga-list'].includes(path) ? unavailable(503) : undefined});
  await h.boot();
  assert.match(h.document.querySelector('[data-nx49-content]').innerHTML,/Fresh ANIME fixture/,'aggregate succeeds independently of the background list');
  assert.equal(h.read('aninexus:mediaState:v2')[901].progress,4);
  assert.match(h.text(),/atualização automática/i);
  assert.doesNotMatch(h.text(),/salvo neste navegador|cache|desatualizad/i,'read warning does not claim local fallback or stale aggregates');
  await h.expireTimers(); assert.ok(h.notice(),'read failure remains visible until recovery');
});

test('one failed shared favorites read preserves both typed local favorites',async () => {
  const h = browser({stored:{...owned,'aninexus:favorites':[901],'aninexus:mangaFavorites':[902]},api:({path}) => path === '/api/me/favorites' ? unavailable(503) : undefined});
  await h.boot(); assert.equal(h.count('/api/me/favorites'),1);
  assert.deepEqual(h.read('aninexus:favorites'),[901]); assert.deepEqual(h.read('aninexus:mangaFavorites'),[902]);
  assert.deepEqual(h.statuses.filter(item => item.resource === 'favorites' && !item.ok).map(item => item.mediaType).sort(),['ANIME','MANGA']);
  assert.match(h.text(),/atualização automática/i);
});

test('invalid 200 item envelopes preserve data and remain failures; valid empty arrays clear removed records',async () => {
  for (const invalid of [{},{items:null},{items:{}},{items:[null]},{items:[{}]},{items:[{media_id:901,media_type:'WRONG',status:'CURRENT'}]}]) {
    let response = invalid;
    const h = browser({stored:{...owned,'aninexus:mediaState:v2':{901:state901},'aninexus:favorites':[901]},api:({path}) => ['/api/me/list','/api/me/favorites'].includes(path) ? response : undefined});
    await h.boot(); assert.equal(h.read('aninexus:mediaState:v2')[901].progress,4); assert.deepEqual(h.read('aninexus:favorites'),[901]); assert.match(h.text(),/atualização automática/i);
    response = {items:[]}; h.retry(); await settle();
    assert.deepEqual(h.read('aninexus:mediaState:v2'),{}); assert.deepEqual(h.read('aninexus:favorites'),[]); assert.equal(h.notice(),null);
  }
});

test('invalid 200 identity envelope cannot confirm logout or erase pending local state',async () => {
  for (const response of [null,{},{user:{}},{user:[]},{user:'fixture'},{user:{id:{}}}]) {
    const h = browser({stored:{...owned,'aninexus:mediaState:v2':{901:state901},'aninexus:mediaState:pending:v1':{901:state901}},api:({path}) => path === '/api/me' ? response : undefined});
    await h.boot(); assert.equal(h.read('aninexus:mediaOwner'),A.id); assert.equal(h.read('aninexus:mediaState:pending:v1')[901].progress,4);
    assert.match(h.text(),/atualização automática/i);
  }
});

test('explicit anonymous identity confirms logout and clears former-owner pending state',async () => {
  const h = browser({stored:{...owned,'aninexus:mediaState:v2':{901:state901},'aninexus:mediaState:pending:v1':{901:state901}},api:({path}) => path === '/api/me' ? {user:null} : undefined});
  await h.boot();
  assert.equal(h.read('aninexus:mediaOwner'),null);
  assert.equal(h.read('aninexus:mediaState:pending:v1'),null);
  assert.equal(h.notice(),null);
  assert.equal(h.count('/api/me/list'),0);
});

test('canonical same-owner confirmation clears identity failure without hiding a failed list read',async () => {
  let identityFails = false;
  const h = browser({api:({path}) => path === '/api/me' && identityFails ? {} : path === '/api/me/list' ? unavailable(503) : undefined});
  await h.boot();
  identityFails = true; h.retry(); await settle();
  assert.match(h.text(),/confirmar a conta/i);
  assert.equal(h.statuses.filter(item => item.resource === 'identity').at(-1).ok,false);
  h.identity(A,{confirmed:true}); await settle();
  assert.equal(h.statuses.filter(item => item.resource === 'identity').at(-1).ok,true);
  assert.doesNotMatch(h.text(),/confirmar a conta/i);
  assert.match(h.text(),/atualização automática/i);
  assert.equal(h.count('/api/me/list'),1,'account confirmation does not add a hydration cycle');
});

test('invalid item envelopes leave pending local edits untouched and do not flush writes',async () => {
  const h = browser({stored:{...owned,'aninexus:mediaState:v2':{901:state901},'aninexus:mediaState:pending:v1':{901:state901},'aninexus:favorites':[901],'aninexus:favorites:pending:v1':{901:true}},api:({path,method}) => method === 'GET' && ['/api/me/list','/api/me/favorites'].includes(path) ? {items:null} : undefined});
  await h.boot(); assert.equal(h.read('aninexus:mediaState:pending:v1')[901].progress,4); assert.equal(h.read('aninexus:favorites:pending:v1')[901],true);
  assert.equal(h.requests.filter(request => request.method !== 'GET').length,0);
});

test('resource 401 is unavailable for a confirmed owner; initial me 401 stays anonymous',async () => {
  const h = browser({stored:{...owned,'aninexus:mediaState:v2':{901:state901}},api:({path}) => path === '/api/me/list' ? unavailable(401) : undefined});
  await h.boot(); assert.equal(h.read('aninexus:mediaState:v2')[901].progress,4); assert.match(h.text(),/atualização automática/i);
  const guest = browser({api:({path}) => path === '/api/me' ? unavailable(401) : undefined}); await guest.boot(); assert.equal(guest.notice(),null); assert.equal(guest.count('/api/me/list'),0);
});

test('partial recovery only clears the resource that actually succeeds',async () => {
  let animeFail = true,mangaFail = true;
  const h = browser({api:({path}) => path === '/api/me/list' && animeFail || path === '/api/me/manga-list' && mangaFail ? unavailable(503) : undefined});
  await h.boot(); assert.match(h.text(),/atualização automática/i);
  animeFail = false; h.retry(); await settle(); assert.ok(h.notice(),'manga failure survives successful anime and favorites reads');
  mangaFail = false; h.retry(); await settle(); assert.equal(h.notice(),null);
});

test('notice retry keeps warning until confirmed success and retry/online bursts share one cycle',async () => {
  let failing = true; const delayed = deferred();
  const h = browser({api:({path}) => path === '/api/me/list' ? failing ? unavailable(503) : delayed.promise : undefined});
  await h.boot(); failing = false; h.notice().querySelector('button').onclick(); h.retry(); h.window.emit('online'); await settle();
  assert.ok(h.notice(),'clicking retry alone is not recovery');
  for (const path of ['/api/me','/api/me/favorites','/api/me/list','/api/me/manga-list']) assert.equal(h.count(path),2,`${path} is one per cycle`);
  delayed.resolve({items:[]}); await settle(); assert.equal(h.notice(),null);
});

test('read recovery retains a separate pending write notice',async () => {
  let failing = true; const h = browser({api:({path}) => path === '/api/me/list' && failing ? unavailable(503) : undefined});
  await h.boot(); h.document.emit('aninexus:media-sync-pending',{mediaType:'ANIME'}); assert.match(h.text(),/Salvo neste navegador/);
  failing = false; h.retry(); await settle(); assert.match(h.text(),/Sincronização com a conta pendente/); assert.doesNotMatch(h.text(),/atualização automática/i);
});

test('write notice timeout cannot dismiss an unresolved read failure',async () => {
  const h = browser({api:({path}) => path === '/api/me/list' ? unavailable(503) : undefined}); await h.boot();
  h.document.emit('aninexus:media-sync-pending',{mediaType:'ANIME'}); await h.expireTimers();
  assert.match(h.text(),/atualização automática/i); assert.doesNotMatch(h.text(),/Salvo neste navegador/);
});

test('late previous-owner read errors do not announce failure in the new account',async () => {
  const old = deferred(); const h = browser({api:({path,owner}) => path === '/api/me/list' && owner?.id === A.id ? old.promise : undefined});
  await h.boot(); h.owner = B; h.identity(B); await settle(); const before = h.statuses.length;
  old.reject(Object.assign(new Error('A late fixture failure'),{status:503})); await settle(); assert.equal(h.statuses.length,before); assert.equal(h.notice(),null);
});

test('late previous-owner success cannot clear a new-account read warning',async () => {
  const old = deferred(); const h = browser({api:({path,owner}) => path === '/api/me/list' ? owner?.id === A.id ? old.promise : unavailable(503) : undefined});
  await h.boot(); h.owner = B; h.identity(B); await settle(); assert.match(h.text(),/atualização automática/i); const before = h.statuses.length;
  old.resolve({items:[row(909)]}); await settle(); assert.equal(h.statuses.length,before); assert.ok(h.notice());
});

test('suspension hides recovery notice and same-owner confirmation preserves pending data and library controls',async () => {
  const h = browser({library:true,stored:{...owned,'aninexus:mediaState:pending:v1':{901:state901}},api:({path}) => path === '/api/me/list' ? unavailable(503) : undefined});
  await h.boot(); const search = h.document.querySelector('[data-nx49-search]'), filter = h.document.querySelector('[data-nx49-filter-layer]');
  search.dispatchEvent({type:'input',target:{value:'Fresh'}}); filter.hidden = false; assert.ok(h.notice());
  h.identity({id:'fixture-clerk-a'},{confirmed:false}); await settle(); assert.equal(h.notice(),null); assert.equal(h.read('aninexus:mediaState:pending:v1')[901].progress,4);
  h.identity(A,{confirmed:true}); await settle(); assert.match(h.text(),/atualização automática/i); assert.equal(h.read('aninexus:mediaState:pending:v1')[901].progress,4);
  assert.equal(h.document.querySelector('[data-nx49-search]'),search); assert.equal(h.document.querySelector('[data-nx49-filter-layer]'),filter); assert.equal(filter.hidden,false);
});

for (const type of ['ANIME','MANGA']) for (const count of [0,1,2]) test(`V49 impression result grammar is correct for ${count} ${type} rows`,async () => {
  const impressions = Array.from({length:count},(_,index) => ({id:`fixture-impression-${index}`,media_id:101 + index,media_type:type,body:'Impressão sintética',created_at:'2026-01-01T00:00:00Z',media:row(101 + index,type).media}));
  const h = browser({library:true,api:({path}) => ['/api/me/library','/api/me/manga-library'].includes(path) ? {user:A,list:[],favorites:[],impressions:(path.includes('manga-') ? 'MANGA' : 'ANIME') === type ? impressions : []} : undefined});
  await h.boot(); h.document.querySelector('[data-nx49-view="IMPRESSIONS"]').emit('click');
  assert.equal(h.document.querySelector('[data-nx49-result-count]').textContent,`${count} ${count === 1 ? 'impressão' : 'impressões'}`);
  if (count) assert.match(h.document.querySelector('[data-nx49-content]').innerHTML,new RegExp(`data-media-type="${type}"`));
});
