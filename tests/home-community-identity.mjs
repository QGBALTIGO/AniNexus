import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import test from 'node:test';

const baseline = process.env.ANX_CANDIDATE_BASELINE_REF;
if (baseline) assert.match(baseline, /^[a-f0-9]{40}$/);
const source = baseline ? execFileSync('git', ['show', `${baseline}:preview-v40/home-community-v40.js`], {cwd: new URL('..', import.meta.url), encoding: 'utf8'}) : fs.readFileSync(new URL('../preview-v40/home-community-v40.js', import.meta.url), 'utf8');
const deferred = () => {let resolve; const promise = new Promise(yes => {resolve = yes;}); return {promise, resolve};};
const settle = async () => {for (let i = 0; i < 50; i++) await Promise.resolve();};
function fixture() {
  const listeners = new Map(), timers = new Map(); let timer = 0;
  const h = {owner: 'a', local: [], publicRows: [], requests: [], timers, apiResponse: null, metadataResponse: null};
  const hero = {isConnected: true, dataset: {}, cards: [], markup: '', querySelectorAll(selector) {if(selector === '.nx35-community-art')return[];if(selector === '[data-community-local]')return this.cards.filter(card=>card.local);return[];},querySelector() {return this.cards[0] || null;}};
  Object.defineProperty(hero, 'innerHTML', {get: () => hero.markup, set(value) {hero.markup = value; hero.cards = [...value.matchAll(/<article[^>]*data-community-kind[^>]*>/g)].map(match => {const card = {local: /data-community-local/.test(match[0]), remove() {hero.cards = hero.cards.filter(item=>item!==card);}};return card;});}});
  const document = {readyState: 'loading', documentElement: {}, addEventListener() {}, querySelector: selector => selector === '.nx35-home' ? {isConnected: true} : selector === '#nx35CommunityHero' ? hero : null};
  const window = {AniNexusAuth: {enabled: true, publicApi: async path => {h.requests.push(path); if(path.startsWith('/api/community/activity'))return h.apiResponse ? h.apiResponse.promise : {items: h.publicRows};return {items: []};}}, AniNexusCommunityActivity: {get key() {return h.owner;},local: () => h.local,enrich: async rows=>rows.filter(row=>!row.local||row.owner_id===h.owner),merge: rows=>rows,mediaSummaries: async()=>h.metadataResponse ? h.metadataResponse.promise : []}};
  const instrumented=source.replace(/\}\)\(\);\s*$/, 'window.__homeCandidate={paint,load};\n})();');
  vm.runInNewContext(instrumented, {window,document,location:{hostname:'aninexus.fixture'},URL,addEventListener:(name,fn)=>{const list=listeners.get(name)||[];list.push(fn);listeners.set(name,list);},setTimeout:fn=>{timers.set(++timer,fn);return timer;},clearTimeout:id=>timers.delete(id),MutationObserver:class{observe(){}},console});
  h.hero=hero;h.api=window.__homeCandidate;h.emit=(name,detail)=>{for(const fn of listeners.get(name)||[])fn({detail});};
  return h;
}
const local={id:'local-a',owner_id:'a',local:true,kind:'state',username:'fixture_a',display_name:'Fixture A',media_id:101,title:'A work',cover:'https://fixture.invalid/a.jpg',status:'CURRENT'};
const publicRow={id:'public',kind:'state',username:'public_member',display_name:'Public member',media_id:202,title:'Public work',cover:'https://fixture.invalid/b.jpg',status:'CURRENT'};

test('uncertain identity removes painted local cards synchronously while preserving public cards',async()=>{
  const h=fixture();h.local=[local];h.publicRows=[publicRow];await h.api.paint();assert.equal(h.hero.cards.length,2);
  h.owner='';h.local=[];h.apiResponse=deferred();h.emit('aninexus:account-identity-changed',{user:null,confirmed:false});
  assert.equal(h.hero.cards.length,1);assert.equal(h.hero.cards[0].local,false);
});

test('pending public reads cannot restore the previous owner after a switch',async()=>{
  const h=fixture();h.local=[local];h.apiResponse=deferred();const paint=h.api.paint();await settle();
  h.owner='b';h.local=[];h.emit('aninexus:account-identity-changed',{user:{id:'b'},confirmed:true});
  h.apiResponse.resolve({items:[publicRow]});await paint;assert.equal(h.hero.cards.length,0);assert.doesNotMatch(h.hero.innerHTML,/A work/);
});

test('local activity awaiting media metadata is filtered again against the current owner',async()=>{
  const h=fixture();h.local=[{...local,cover:''}];h.metadataResponse=deferred();const load=h.api.load();await settle();h.owner='b';h.local=[];
  h.metadataResponse.resolve([{id:101,mediaType:'ANIME',title:'A work',cover:'https://fixture.invalid/a.jpg'}]);
  assert.equal((await load).length,0);
});

test('same confirmed owner does not blank already painted local activity',async()=>{
  const h=fixture();h.local=[local];await h.api.paint();h.emit('aninexus:account-identity-changed',{user:{id:'a'},confirmed:true});
  assert.equal(h.hero.cards.length,1);assert.match(h.hero.innerHTML,/A work/);
});

test('sync-only logout activity notification also removes private cards immediately',async()=>{
  const h=fixture();h.local=[local];h.publicRows=[publicRow];await h.api.paint();h.owner='';h.local=[];
  h.emit('aninexus:community-activity-changed',{items:[]});assert.equal(h.hero.cards.length,1);assert.equal(h.hero.cards[0].local,false);
});
