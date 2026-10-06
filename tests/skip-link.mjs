import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import {load} from 'cheerio';

const baseline=process.env.ANX13_BASELINE_REF;
if(baseline&&!/^[a-f0-9]{40}$/i.test(baseline))throw new Error('Baseline must be an immutable commit');
const read=file=>baseline?execFileSync('git',['show',`${baseline}:${file}`],{encoding:'utf8'}):readFileSync(new URL('../'+file,import.meta.url),'utf8');

// Real index anchor, complete runtime and shipped navigation handlers; all
// DOM/history/clock state is synthetic. Fetch must never be called.
function browser(initial){
  const index=load(read('index.html')),skip=index('.nx-skip-link').toString(),$=load('<html><head></head><body>'+skip+'<button id="headerControl">Menu</button><div id="app" tabindex="-1"><main><input id="draft" value="Rascunho intacto"><button id="normalControl">Continuar</button></main></div></body></html>');
  const nodes=new WeakMap(),windowEvents=new Map(),observers=[],frames=[],timers=[],assignments=[],requests=[];let url=new URL(initial),sequence=0,context;
  const on=(map,type,fn,options)=>{const list=map.get(type)||[];list.push({fn,capture:options===true||!!options?.capture,once:!!options?.once});map.set(type,list)};
  const emit=(map,event,capture)=>{for(const listener of[...(map.get(event.type)||[])]){if(capture!==undefined&&listener.capture!==capture)continue;listener.fn(event);if(listener.once)map.set(event.type,(map.get(event.type)||[]).filter(x=>x!==listener));if(event.immediate)break}};
  const event=(type,options={})=>({type,button:0,isTrusted:true,defaultPrevented:false,preventDefault(){this.defaultPrevented=true},stopPropagation(){this.stopped=true},stopImmediatePropagation(){this.stopped=true;this.immediate=true},...options});
  class Element{
    constructor(node){this.node=node;this.events=new Map();this.scrolls=[];this.value=node.attribs?.value||'';this.dataset=new Proxy({}, {get:(_,key)=>this.getAttribute('data-'+String(key).replace(/[A-Z]/g,c=>'-'+c.toLowerCase())),set:(_,key,value)=>{this.setAttribute('data-'+String(key).replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),value);return true},deleteProperty:(_,key)=>{this.removeAttribute('data-'+String(key).replace(/[A-Z]/g,c=>'-'+c.toLowerCase()));return true}})}
    get nodeType(){return 1}get tagName(){return this.node.name.toUpperCase()}get parentElement(){return wrap(this.node.parent)}get childNodes(){return(this.node.children||[]).map(wrap)}
    get isConnected(){let node=this.node;while(node?.parent)node=node.parent;return node===$.root()[0]}
    get href(){return new URL(this.getAttribute('href')||'',document.baseURI).href}set href(value){this.setAttribute('href',value)}get target(){return this.getAttribute('target')||''}
    get classList(){return{add:(...names)=>$(this.node).addClass(names.join(' ')),remove:(...names)=>$(this.node).removeClass(names.join(' ')),contains:name=>$(this.node).hasClass(name),toggle:(name,on)=>$(this.node).toggleClass(name,on)}}
    get id(){return this.getAttribute('id')||''}get scrollHeight(){return 5000}get hidden(){return this.hasAttribute('hidden')}
    getAttribute(name){return $(this.node).attr(name)??null}setAttribute(name,value){$(this.node).attr(name,String(value))}removeAttribute(name){$(this.node).removeAttr(name)}hasAttribute(name){return this.getAttribute(name)!==null}
    querySelector(selector){return wrap($(this.node).find(selector)[0])}querySelectorAll(selector){return $(this.node).find(selector).toArray().map(wrap)}matches(selector){return $(this.node).is(selector)}closest(selector){return wrap($(this.node).closest(selector)[0])}
    append(n){$(this.node).append(n.node)}remove(){$(this.node).remove()}
    addEventListener(type,fn,options){on(this.events,type,fn,options)}removeEventListener(type,fn){this.events.set(type,(this.events.get(type)||[]).filter(x=>x.fn!==fn))}
    focus(){document.activeElement=this;document.dispatchEvent(event('focusin',{target:this}))}blur(){if(document.activeElement===this)document.activeElement=null}
    scrollIntoView(options){this.scrolls.push(options);context.scrollY=300}
  }
  class ImageElement extends Element{}
  function wrap(node){if(!node)return null;if(node.type==='text')return{nodeType:3};if(!nodes.has(node))nodes.set(node,new Element(node));return nodes.get(node)}
  const document={baseURI:new URL(url.hostname.endsWith('github.io')?'/AniNexus/':'/',url.origin).href,readyState:'loading',activeElement:null,events:new Map(),querySelector:s=>wrap($(s)[0]),querySelectorAll:s=>$(s).toArray().map(wrap),createElement:n=>wrap($('<'+n+'></'+n+'>')[0]),addEventListener(type,fn,options){on(this.events,type,fn,options)},removeEventListener(type,fn){this.events.set(type,(this.events.get(type)||[]).filter(x=>x.fn!==fn))},dispatchEvent(e){emit(this.events,e)}};
  document.documentElement=document.querySelector('html');document.head=document.querySelector('head');document.body=document.querySelector('body');
  const dispatch=e=>{emit(windowEvents,e,true);if(!e.stopped)emit(windowEvents,e,false);return!e.defaultPrevented};
  const location={get href(){return url.href},get origin(){return url.origin},get hostname(){return url.hostname},get pathname(){return url.pathname},get search(){return url.search},get hash(){return url.hash},set hash(value){const before=url.href;url.hash=value;dispatch(event('hashchange',{oldURL:before,newURL:url.href}))},assign(value){assignments.push(String(value));url=new URL(value,url)}};
  const history={state:{fixture:'kept'},writes:0,pushState(state,_title,value){this.writes++;this.state=state;url=new URL(value,url)},replaceState(state,_title,value){this.writes++;this.state=state;url=new URL(value,url)}};
  const storage=new Map(),sessionStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value))};
  const window={document,fetch:async path=>{requests.push(path);throw new Error('Unexpected network request')},addEventListener:(type,fn,options)=>on(windowEvents,type,fn,options),removeEventListener:(type,fn)=>windowEvents.set(type,(windowEvents.get(type)||[]).filter(x=>x.fn!==fn)),dispatchEvent:dispatch};
  context={window,document,location,history,sessionStorage,Element,HTMLElement:Element,HTMLImageElement:ImageElement,URL,URLSearchParams,AbortController,AbortSignal,Intl,Date,Math,Number,Object,Map,Set,WeakMap,Promise,console,navigator:{onLine:true},performance:{now:()=>0,timeOrigin:1},scrollY:0,scrollX:0,innerHeight:800,scrollTo:()=>{},requestAnimationFrame:fn=>{frames.push(fn);return++sequence},cancelAnimationFrame:()=>{},setTimeout:(fn,delay)=>{timers.push({fn,delay});return++sequence},clearTimeout:()=>{},addEventListener:window.addEventListener,removeEventListener:window.removeEventListener,dispatchEvent:dispatch,CustomEvent:class{constructor(type,options={}){Object.assign(this,event(type,options))}},PopStateEvent:class{constructor(type,options={}){Object.assign(this,event(type,{...options,isTrusted:false}))}},MutationObserver:class{constructor(callback){observers.push(this);this.callback=callback}observe(){}disconnect(){}},fetch:window.fetch};
  window.scrollTo=context.scrollTo;
  for(const file of['preview-v38/runtime-v38.js','preview-v23/router-v23.js','preview-v27/navigation-v27.js'])runInNewContext(read(file),context,{filename:file});
  async function flush(){for(let turn=0;turn<5;turn++){await Promise.resolve();for(const fn of frames.splice(0))fn();await Promise.resolve()}}
  async function start(){document.readyState='complete';const e=event('DOMContentLoaded');emit(document.events,e);emit(windowEvents,e);await flush()}
  async function send(type,target,options={}){const e=event(type,{target,...options});emit(windowEvents,e,true);if(!e.stopped)emit(document.events,e,true);for(let n=target;n&&!e.stopped;n=n.parentElement)emit(n.events,e,false);if(!e.stopped)emit(document.events,e,false);if(!e.stopped)emit(windowEvents,e,false);await flush();return e}
  async function click(options={}){const a=document.querySelector('.nx-skip-link'),e=await send('click',a,options);if(!e.defaultPrevented&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey&&e.button===0){const target=new URL(a.href);if(target.pathname===url.pathname&&target.search===url.search){location.hash=target.hash;document.querySelector('#app')?.focus()}else location.assign(target.href)}await flush();return e}
  async function enter(){const a=document.querySelector('.nx-skip-link'),e=await send('keydown',a,{key:'Enter'});if(!e.defaultPrevented)await click({detail:0})}
  async function navigate(value){history.pushState(history.state,'',value);dispatch(event('aninexus:route-changed',{detail:{type:'push'}}));for(const o of observers)o.callback([{addedNodes:[]}]);await flush()}
  return{document,location,history,requests,assignments,start,click,enter,send,navigate,flush};
}

for(const pages of[false,true]){
  const page=path=>pages?'https://fixture.github.io/AniNexus/?build=fixture&p='+encodeURIComponent(path):'https://aninexus.test'+path;
  for(const path of['/','/animes/catalogo?secao=busca&genre=Action&page=2','/mangas?secao=light-novels','/dmca?fixture=1#formulario','/previsoes?previsao=11111111-1111-4111-8111-111111111111#argumentos','/previsoes#11111111-1111-4111-8111-111111111111']){
    test(`${pages?'Pages':'VPS'} ${path}: skip activation focuses content without navigating or losing context`,async()=>{
      const r=browser(page(path));await r.start();const before=r.location.href,app=r.document.querySelector('#app'),draft=r.document.querySelector('#draft'),a=r.document.querySelector('.nx-skip-link');draft.value='Edição ainda não enviada';
      const target=new URL(a.href),source=new URL(before);assert.equal(target.pathname,source.pathname);assert.equal(target.search,source.search);assert.equal(a.getAttribute('data-route-fragment'),'app');
      if(source.hash)assert.equal(target.hash,source.hash,'Existing fragment identity must survive modified activation');
      const writes=r.history.writes;await r.enter();assert.equal(r.location.href,before);assert.equal(r.document.activeElement,app);assert.equal(app.scrolls.length,1);assert.equal(r.history.writes,writes);assert.equal(r.document.querySelector('#draft'),draft);assert.equal(draft.value,'Edição ainda não enviada');assert.equal(r.assignments.length,0);assert.equal(r.requests.length,0);
      for(const options of[{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true},{button:1},{defaultPrevented:true}]){const e=await r.click(options);assert.equal(e.defaultPrevented,!!options.defaultPrevented);assert.equal(r.location.href,before);assert.equal(app.scrolls.length,1)}
      const control=r.document.querySelector('#normalControl');control.focus();assert.equal(r.document.activeElement,control,'No focus trap may remain after skip activation');
    });
  }
  test(`${pages?'Pages':'VPS'}: the global skip link follows subsequent route and query changes`,async()=>{
    const r=browser(page('/'));await r.start();await r.navigate(page('/mangas?secao=busca&genre=Fantasy'));assert.equal(new URL(r.document.querySelector('.nx-skip-link').href).search,new URL(r.location.href).search);
    await r.navigate(page('/dmca?fixture=changed')+'#english');const before=r.location.href;await r.click();assert.equal(r.location.href,before);assert.equal(r.document.activeElement,r.document.querySelector('#app'));
  });
}
