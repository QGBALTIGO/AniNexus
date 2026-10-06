import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import test from 'node:test';

const baseline = process.env.ANX_CANDIDATE_BASELINE_REF;
if (baseline) assert.match(baseline, /^[a-f0-9]{40}$/);
const source = baseline ? execFileSync('git', ['show', `${baseline}:preview-v44/radio-v44.js`], {cwd: new URL('..', import.meta.url), encoding: 'utf8'}) : fs.readFileSync(new URL('../preview-v44/radio-v44.js', import.meta.url), 'utf8');
function target() {const listeners=new Map();return{addEventListener(name,fn){const list=listeners.get(name)||[];list.push(fn);listeners.set(name,list);},emit(type,detail){for(const fn of listeners.get(type)||[])fn({type,...detail});}};}
function element() {
  const attributes=new Map(),controls=new Map();let markup='';
  const node=Object.assign(target(),{className:'',dataset:{},hidden:false,isConnected:false,textContent:'',style:{setProperty(){},removeProperty(){}},
    setAttribute:(key,value)=>attributes.set(key,String(value)),getAttribute:key=>attributes.get(key)||null,removeAttribute:key=>attributes.delete(key),
    remove(){this.isConnected=false;},focus(){},append(child){child.isConnected=true;},replaceChildren(value){this.textContent=String(value);},
    querySelector:selector=>controls.get(selector)||null,
    classList:{contains:name=>node.className.split(/\s+/).includes(name)},getBoundingClientRect:()=>({top:800})});
  Object.defineProperty(node,'innerHTML',{get:()=>markup,set(value){markup=value;controls.clear();for(const match of value.matchAll(/<\w+\b[^>]*\b(data-nx44-[a-z-]+)\b[^>]*>/g)){const child=element();child.hidden=/\bhidden\b/.test(match[0]);for(const attr of match[0].matchAll(/([a-z-]+)="([^"]*)"/g))child.setAttribute(attr[1],attr[2]);controls.set(`[${match[1]}]`,child);}}});
  return node;
}
function fixture({inline=false,activated=true}={}) {
  const h={fail:null,playCalls:0,loads:0,sections:[],timers:new Map(),owner:null,pending:null};let timer=0;
  const window=target(),body=element(),app=element(),home=element();app.firstElementChild={};
  const audio=Object.assign(element(),{paused:true,volume:0.72,muted:false,load(){h.loads++;},pause(){this.paused=true;this.emit('pause');},async play(){h.playCalls++;if(h.pending)await h.pending;if(h.fail)throw h.fail;this.paused=false;this.emit('playing');}});
  Object.defineProperty(audio,'src',{get:()=>audio.getAttribute('src'),set:value=>audio.setAttribute('src',value)});
  const document=Object.assign(target(),{body,documentElement:{dataset:{nxAuthState:'anonymous'}},querySelector:selector=>selector==='#app'?app:selector==='.nx35-home .nx35-hero-copy'&&inline?home:null,
    createElement:tag=>{if(tag==='audio')return audio;const section=element();h.sections.push(section);return section;}});
  const storage=new Map(activated?[['aninexus:radio:activated:v44','1']]:[]),store={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
  vm.runInNewContext(source,{window,document,localStorage:store,sessionStorage:store,location:{hostname:'aninexus.fixture',href:'https://aninexus.fixture/animes',origin:'https://aninexus.fixture'},navigator:{onLine:true},URL,
    addEventListener:window.addEventListener.bind(window),dispatchEvent:event=>window.emit(event.type,{detail:event.detail}),
    CustomEvent:class{constructor(type,options={}){this.type=type;this.detail=options.detail;}},MutationObserver:class{observe(){} disconnect(){}},
    setTimeout:(fn,delay)=>{h.timers.set(++timer,{fn,delay});return timer;},clearTimeout:id=>h.timers.delete(id),setInterval:()=>1,clearInterval(){},requestAnimationFrame:()=>1,cancelAnimationFrame(){},matchMedia:()=>({matches:false}),innerHeight:900,console});
  h.window=window;h.audio=audio;h.store=storage;h.api=window.AniNexusRadio;h.mount=()=>{for(const [id,job] of [...h.timers])if(job.delay===45){h.timers.delete(id);job.fn();}};
  h.mount();h.ui=()=>h.sections.findLast(section=>section.isConnected);h.control=()=>h.ui().querySelector('[data-nx44-play]');
  return h;
}
const failure=Object.assign(new Error('fixture stream unavailable'),{name:'NetworkError'});

test('floating stream failure displays a live status and an explicit retry action',async()=>{
  const h=fixture();h.fail=failure;await h.api.play();
  assert.equal(h.ui().dataset.state,'error');const status=h.ui().querySelector('[data-nx44-status]');assert.ok(status,'floating status exists');
  assert.equal(status.hidden,false);assert.equal(status.getAttribute('role'),'status');assert.match(status.textContent,/Rádio indisponível/);
  assert.match(h.control().getAttribute('aria-label'),/Tentar rádio novamente/);
});

test('floating retry recovers without duplicating audio and clears the failure status',async()=>{
  const h=fixture();h.fail=failure;await h.api.play();h.fail=null;h.control().emit('click',{detail:0});await Promise.resolve();
  assert.equal(h.ui().dataset.state,'playing');assert.equal(h.ui().querySelector('[data-nx44-status]')?.hidden,true);assert.equal(h.playCalls,2);assert.equal(h.loads,2);
  h.control().emit('click',{detail:0});assert.equal(h.audio.paused,true);assert.equal(h.ui().dataset.state,'paused');
});

test('inline and floating playback retain explicit play and pause states',async()=>{
  for(const inline of [true,false]){const h=fixture({inline});assert.equal(h.playCalls,0);assert.equal(h.ui().dataset.state,'paused');await h.api.play();assert.equal(h.ui().dataset.state,'playing');assert.match(h.control().getAttribute('aria-label'),/Pausar rádio/);h.api.pause();assert.equal(h.ui().dataset.state,'paused');assert.match(h.control().getAttribute('aria-label'),/Ouvir rádio/);}
});

test('blocked autoplay remains paused and does not report a stream outage',async()=>{
  const h=fixture();h.fail=Object.assign(new Error('fixture blocked'),{name:'NotAllowedError'});await h.api.play();
  assert.equal(h.ui().dataset.state,'paused');assert.equal(h.ui().querySelector('[data-nx44-status]')?.hidden,true);assert.equal(h.store.has('aninexus:radio:resume:v44'),false);
});

test('audio error and offline events announce failure only for active playback',async()=>{
  const h=fixture();h.audio.emit('error');assert.equal(h.ui().dataset.state,'paused');await h.api.play();h.audio.emit('error');assert.equal(h.ui().dataset.state,'error');assert.equal(h.ui().querySelector('[data-nx44-status]')?.hidden,false);
  h.api.pause();h.window.emit('offline');assert.equal(h.ui().dataset.state,'paused');
});

test('cold internal routes create no player or autoplay without activation',()=>{
  const h=fixture({activated:false});assert.equal(h.ui(),undefined);assert.equal(h.playCalls,0);
});

test('a late rejected play attempt cannot turn a user pause into a stream failure',async()=>{
  let reject;const h=fixture();h.pending=new Promise((resolve,no)=>{reject=no;});const start=h.api.play();h.api.pause();reject(failure);await start;
  assert.equal(h.ui().dataset.state,'paused');assert.equal(h.store.has('aninexus:radio:resume:v44'),false);
});

test('a late successful play attempt cannot broadcast playback after a user pause',async()=>{
  let resolve;const h=fixture();h.pending=new Promise(yes=>{resolve=yes;});const start=h.api.play();h.api.pause();resolve();await start;
  assert.equal(h.ui().dataset.state,'paused');assert.equal(h.store.has('aninexus:radio:active-tab:v44'),false);assert.equal(h.audio.paused,true);
});
