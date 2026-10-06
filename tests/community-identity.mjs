import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import test from 'node:test';

const baseline = process.env.ANX_CANDIDATE_BASELINE_REF;
if (baseline) assert.match(baseline, /^[a-f0-9]{40}$/);
const source = baseline ? execFileSync('git', ['show', `${baseline}:preview-v40/activity-v40.js`], {cwd: new URL('..', import.meta.url), encoding: 'utf8'}) : fs.readFileSync(new URL('../preview-v40/activity-v40.js', import.meta.url), 'utf8');
const A = {id: 'fixture-internal-a', username: 'fixture_a', display_name: 'Fixture A'};
const B = {id: 'fixture-internal-b', username: 'fixture_b', display_name: 'Fixture B'};
const legacyKey = 'aninexus:community:activity:v40';
const plain = value => JSON.parse(JSON.stringify(value));
const deferred = () => {let resolve; const promise = new Promise(yes => {resolve = yes;}); return {promise, resolve};};
const settle = async () => {for (let i = 0; i < 30; i++) await Promise.resolve();};
function target() {
  const listeners = new Map();
  return {addEventListener(name, fn) {const list = listeners.get(name) || []; list.push(fn); listeners.set(name, list);}, dispatchEvent(event) {for (const fn of [...(listeners.get(event.type) || [])]) fn(event);}, emit(type, detail) {this.dispatchEvent({type, detail});}};
}
function fixture({stored = {}, enabled = true, account, summaries} = {}) {
  const window = target(), document = Object.assign(target(), {readyState: 'loading', querySelector: () => null});
  const values = new Map(Object.entries(stored).map(([key, value]) => [key, JSON.stringify(value)]));
  const h = {window, document, values, owner: A, requests: [], changed: []};
  window.AniNexusAuth = {enabled, publicApi: async path => {h.requests.push(path); return summaries ? summaries(path, h) : {items: []};}};
  window.AniNexusAccountData = () => account ? account(h) : Promise.resolve(h.owner);
  window.addEventListener('aninexus:community-activity-changed', event => h.changed.push(plain(event.detail)));
  vm.runInNewContext(source, {window, document, location: {hostname: 'aninexus.fixture'}, AbortSignal,
    localStorage: {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key)},
    addEventListener: window.addEventListener.bind(window), dispatchEvent: window.dispatchEvent.bind(window),
    CustomEvent: class {constructor(type, options = {}) {this.type = type; this.detail = options.detail;}},
    fetch: async () => {throw new Error('Unexpected external request');}, console});
  h.api = window.AniNexusCommunityActivity;
  h.confirm = (user, confirmed = true) => {h.owner = user; window.emit('aninexus:account-identity-changed', {user, confirmed});};
  h.boot = async () => {document.emit('DOMContentLoaded'); await h.api.identity(); await settle();};
  h.record = (id, type = 'ANIME') => h.api.record(id, {status: 'CURRENT', progress: 2}, Date.now(), false, type);
  return h;
}

test('B never sees or reattributes the local activity recorded by A', async () => {
  const h = fixture(); await h.boot(); h.record(101); const a = h.api.local();
  assert.equal(a.length, 1); assert.equal((await h.api.enrich(a))[0].username, A.username);
  h.confirm(B); assert.deepEqual(plain(h.api.local()), []); assert.deepEqual(plain(await h.api.enrich(a)), []);
  h.record(202, 'MANGA'); assert.deepEqual(plain(h.api.local()).map(row => row.media_id), [202]);
  assert.equal((await h.api.enrich(h.api.local()))[0].username, B.username);
});

test('unowned legacy activity is ignored rather than assigned to a signed-in member', async () => {
  const h = fixture({stored: {[legacyKey]: [{id: 'legacy', local: true, kind: 'state', media_id: 909, status: 'CURRENT', username: 'você'}]}});
  await h.boot(); assert.deepEqual(plain(h.api.local()), []);
  assert.deepEqual(plain(await h.api.enrich(JSON.parse(h.values.get(legacyKey)))), []);
});

test('logout and uncertain identity immediately hide cached local history', async () => {
  const h = fixture(); await h.boot(); h.record(101);
  h.confirm(A, false); assert.deepEqual(plain(h.api.local()), []);
  h.confirm(A); assert.equal(h.api.local().length, 1);
  h.confirm(null); assert.deepEqual(plain(h.api.local()), []); assert.equal(h.record(202), null);
});

test('a late identity read cannot revive A after B is confirmed', async () => {
  const old = deferred(); const h = fixture({account: () => old.promise});
  const identity = h.api.identity(); h.confirm(B); old.resolve(A); await identity; await settle();
  h.record(202); assert.equal((await h.api.enrich(h.api.local()))[0]?.username, B.username);
});

test('a late enrichment captured before a switch cannot publish A under B', async () => {
  const pending = deferred(); let delayed = false;
  const h = fixture({account: current => delayed ? pending.promise : Promise.resolve(current.owner)});
  await h.boot(); h.record(101); delayed = true;
  const enriched = h.api.enrich(h.api.local()); h.confirm(B); pending.resolve(A);
  assert.deepEqual(plain(await enriched), []);
});

test('seed reads only anime and manga snapshots owned by the confirmed account', async () => {
  const h = fixture({stored: {'aninexus:mediaOwner': A.id, 'aninexus:mangaOwner': B.id,
    'aninexus:mediaState:v2': {101: {status: 'CURRENT', updatedAt: Date.now()}},
    'aninexus:mangaState:v2': {909: {status: 'CURRENT', updatedAt: Date.now()}}}});
  await h.boot(); h.api.seed(); assert.deepEqual(plain(h.api.local()).map(row => row.media_id), [101]);
});

test('delayed metadata for A cannot write into B history', async () => {
  const pending = deferred(); const h = fixture({summaries: () => pending.promise});
  await h.boot(); h.record(101); h.confirm(B); h.record(202);
  pending.resolve({items: [{id: 101, mediaType: 'ANIME', title: 'A only', cover: 'https://fixture.invalid/a.jpg'}]}); await settle();
  assert.deepEqual(plain(h.api.local()).map(row => row.media_id), [202]); assert.equal(h.api.local()[0].title, '');
});

test('same-owner refresh and offline actions preserve owned history without duplicate identity reads', async () => {
  let reads = 0; const h = fixture({account: current => {reads++; return Promise.resolve(current.owner);}});
  await h.boot(); h.record(101); h.confirm({...A, display_name: 'Updated A'}); h.record(202, 'MANGA');
  assert.equal(h.api.local().length, 2); assert.equal((await h.api.enrich(h.api.local()))[0].display_name, 'Updated A'); assert.equal(reads, 1);
});

test('another tab storage notification exposes only the active owner', async () => {
  const h = fixture(); await h.boot(); h.record(101); const oldKey = h.api.key;
  h.confirm(B); h.window.dispatchEvent({type: 'storage', key: oldKey});
  assert.deepEqual(plain(h.api.local()), []); assert.deepEqual(h.changed.at(-1)?.items || [], []);
});

test('public remote activity remains public and keeps its original actor', async () => {
  const h = fixture(); await h.boot();
  const rows = [{id: 'remote', kind: 'state', media_id: 101, username: 'another_member', user_id: B.id, display_name: 'Other member'}, {id: 'unknown', username: 'você', display_name: 'Unidentified remote'}];
  assert.deepEqual(plain(await h.api.enrich(rows)), rows);
});

test('a static local preview retains anonymous activity without inventing account ownership', async () => {
  const h = fixture({enabled: false}); h.record(101); const rows = await h.api.enrich(h.api.local());
  assert.equal(rows.length, 1); assert.equal(rows[0].username, ''); assert.equal(rows[0].display_name, 'Sua lista');
});

test('a backend logout without a header event revokes activity ownership', async () => {
  const h=fixture();await h.boot();h.record(101);
  h.document.emit('aninexus:media-sync-read-status',{mediaType:'ACCOUNT',resource:'identity',ok:true,owner:null});
  assert.deepEqual(plain(h.api.local()),[]);assert.deepEqual(plain(await h.api.enrich([{...h.api.record(202),local:true}])),[]);
});

test('the validated sync owner prevents an old AccountData profile restoring another owner',async()=>{
  const h=fixture({account:()=>Promise.resolve(A)});await h.boot();h.record(101);
  h.document.emit('aninexus:media-sync-read-status',{mediaType:'ACCOUNT',resource:'identity',ok:true,owner:B.id});await settle();
  assert.deepEqual(plain(h.api.local()),[]);assert.equal(await h.api.identity(),null);assert.equal(h.record(202),null);
  h.confirm(B);h.record(202);assert.equal((await h.api.enrich(h.api.local()))[0].username,B.username);
});

test('sync suspension blocks a stale identity helper until a fresh confirmation',async()=>{
  const h=fixture({account:()=>Promise.resolve(A)});await h.boot();h.record(101);
  h.document.emit('aninexus:media-sync-read-identity',{suspended:true});
  assert.equal(await h.api.identity(),null);assert.deepEqual(plain(h.api.local()),[]);
  h.confirm(A);assert.equal(h.api.local().length,1);
});

test('another tab changing the list owner suspends local history before SDK notification',async()=>{
  const h=fixture();await h.boot();h.record(101);h.values.set('aninexus:mediaOwner',JSON.stringify(B.id));
  h.window.dispatchEvent({type:'storage',key:'aninexus:mediaOwner'});
  assert.deepEqual(plain(h.api.local()),[]);assert.equal(await h.api.identity(),null);
});
