import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import {load} from 'cheerio';

const sourceFiles=['preview-v23/route-guard-v23.js','preview-v23/router-v23.js','preview-v27/navigation-v27.js','preview-v20/catalog-v20.js','preview-v23/catalog-filter-bridge-v23.js'];
const baseline=process.env.ANX10_BASELINE_REF;
if(baseline&&!/^[a-f0-9]{40}$/i.test(baseline))throw new Error('Baseline must be an immutable commit');
const readSource=file=>baseline?execFileSync('git',['show',`${baseline}:${file}`],{encoding:'utf8'}):readFileSync(new URL('../'+file,import.meta.url),'utf8');

// Execute the complete shipped catalog and navigation sources. Only the DOM,
// history, clock and HTTP boundary are synthetic; no network or real accounts.
function browser(initial,{saved={},incoming}={}){
  const $=load('<html><head></head><body><div id="app" tabindex="-1"></div></body></html>'),nodes=new WeakMap(),windowListeners=new Map(),observers=[],frames=new Map(),timers=new Map(),requests=[],assignments=[];
  let sequence=0,clock=0,frameClock=0,url=new URL(initial),entries=[url.href],entryStates=[{fixture:'retained'}],index=0,context;
  const listeners=(map,name,fn,options)=>{const list=map.get(name)||[];list.push({fn,capture:options===true||!!options?.capture,once:!!options?.once});map.set(name,list)};
  const emit=(map,event,capture)=>{for(const listener of [...(map.get(event.type)||[])]){if(capture!==undefined&&listener.capture!==capture)continue;listener.fn(event);if(listener.once)map.set(event.type,(map.get(event.type)||[]).filter(value=>value!==listener));if(event.immediate)break}};
  const event=(type,extra={})=>({type,button:0,isTrusted:true,defaultPrevented:false,preventDefault(){this.defaultPrevented=true},stopPropagation(){this.stopped=true},stopImmediatePropagation(){this.stopped=true;this.immediate=true},...extra});
  const mutation=addedNodes=>queueMicrotask(()=>{for(const observer of observers)if(observer.connected)observer.callback([{addedNodes}])});
  class Element{
    constructor(node){this.node=node;this.events=new Map();this.value=node.attribs?.value||'';this.style={setProperty(){},getPropertyValue(){return''}};this.dataset=new Proxy({}, {get:(_,key)=>this.getAttribute('data-'+String(key).replace(/[A-Z]/g,c=>'-'+c.toLowerCase())),set:(_,key,value)=>{this.setAttribute('data-'+String(key).replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),value);return true},deleteProperty:(_,key)=>{this.removeAttribute('data-'+String(key).replace(/[A-Z]/g,c=>'-'+c.toLowerCase()));return true}})}
    get nodeType(){return 1}get tagName(){return this.node.name.toUpperCase()}get parentElement(){return wrap(this.node.parent)}
    get isConnected(){let node=this.node;while(node?.parent)node=node.parent;return node===$.root()[0]}
    get childNodes(){return(this.node.children||[]).map(wrap)}get firstElementChild(){return wrap($(this.node).children()[0])}
    get className(){return this.getAttribute('class')||''}set className(value){this.setAttribute('class',value)}
    get classList(){return{add:(...names)=>$(this.node).addClass(names.join(' ')),remove:(...names)=>$(this.node).removeClass(names.join(' ')),contains:name=>$(this.node).hasClass(name),toggle:(name,on)=>$(this.node).toggleClass(name,on)}}
    get id(){return this.getAttribute('id')||''}set id(value){this.setAttribute('id',value)}
    get target(){return this.getAttribute('target')||''}get href(){return new URL(this.getAttribute('href')||'',document.baseURI).href}set href(value){this.setAttribute('href',value)}
    get hidden(){return this.hasAttribute('hidden')}set hidden(value){value?this.setAttribute('hidden',''):this.removeAttribute('hidden')}
    get disabled(){return this.hasAttribute('disabled')}set disabled(value){value?this.setAttribute('disabled',''):this.removeAttribute('disabled')}
    get tabIndex(){return Number(this.getAttribute('tabindex')??(['A','BUTTON','INPUT','SELECT'].includes(this.tagName)?0:-1))}
    get innerHTML(){return $(this.node).html()||''}set innerHTML(value){$(this.node).html(value);mutation(this.childNodes.filter(node=>node instanceof Element))}
    get textContent(){return $(this.node).text()}set textContent(value){$(this.node).text(value)}
    get scrollHeight(){return 5000}get clientWidth(){return 500}get offsetWidth(){return 100}get offsetLeft(){return 0}
    getAttribute(name){return $(this.node).attr(name)??null}setAttribute(name,value){$(this.node).attr(name,String(value))}removeAttribute(name){$(this.node).removeAttr(name)}hasAttribute(name){return this.getAttribute(name)!==null}
    querySelector(selector){return wrap($(this.node).find(selector.replace(/^:scope\s*>/,'>'))[0])}querySelectorAll(selector){return $(this.node).find(selector.replace(/^:scope\s*>/,'>')).toArray().map(wrap)}
    closest(selector){return wrap($(this.node).closest(selector)[0])}matches(selector){return $(this.node).is(selector)}contains(other){return other===this||!!$(other?.node).parents().toArray().includes(this.node)}
    append(...children){for(const child of children)$(this.node).append(child instanceof Element?child.node:child?.node||String(child));mutation(this.childNodes.filter(node=>node instanceof Element))}
    insertAdjacentHTML(position,value){assert.equal(position,'beforeend');$(this.node).append(value);mutation(this.childNodes.filter(node=>node instanceof Element))}remove(){$(this.node).remove()}
    addEventListener(name,fn,options){listeners(this.events,name,fn,options)}removeEventListener(name,fn){this.events.set(name,(this.events.get(name)||[]).filter(value=>value.fn!==fn))}
    focus(){document.activeElement=this}blur(){if(document.activeElement===this)document.activeElement=null}
    getBoundingClientRect(){return{bottom:500,width:200,height:300,x:0,y:200}}scrollIntoView(){context.scrollY=300}scrollTo(){}
  }
  function wrap(node){if(!node)return null;if(node.type==='text')return{node,nodeType:3};if(!nodes.has(node))nodes.set(node,new Element(node));return nodes.get(node)}
  const document={baseURI:new URL(url.hostname.endsWith('github.io')?'/AniNexus/':'/',url.origin).href,readyState:'loading',referrer:'',title:'',events:new Map(),activeElement:null,querySelector:selector=>wrap($(selector)[0]),querySelectorAll:selector=>$(selector).toArray().map(wrap),createElement:name=>wrap($('<'+name+'></'+name+'>')[0]),addEventListener(name,fn,options){listeners(this.events,name,fn,options)},dispatchEvent(value){emit(this.events,value)}};
  document.documentElement=document.querySelector('html');document.head=document.querySelector('head');document.body=document.querySelector('body');
  const dispatch=value=>{emit(windowListeners,value,true);if(!value.stopped)emit(windowListeners,value,false);return !value.defaultPrevented};
  const location={get href(){return url.href},get origin(){return url.origin},get hostname(){return url.hostname},get pathname(){return url.pathname},get search(){return url.search},get hash(){return url.hash},assign(value){assignments.push(String(value));url=new URL(value,url)}};
  const history={state:entryStates[0],get length(){return entries.length},pushState(state,_title,value){url=new URL(value,url);this.state=state;entries=entries.slice(0,index+1);entryStates=entryStates.slice(0,index+1);entries.push(url.href);entryStates.push(state);index++},replaceState(state,_title,value){url=new URL(value,url);this.state=state;entries[index]=url.href;entryStates[index]=state}};
  const storage=new Map(Object.entries(saved)),sessionStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)};
  if(incoming)sessionStorage.setItem('nx23:catalog:incoming',JSON.stringify(incoming));
  const media={id:101,title:'Fixture de catálogo',cover:'/fixture.svg',format:'TV',genres:['Action'],metricsSource:'aninexus',score:8,ratingCount:1};
  const api=async path=>{requests.push(String(path));const p=new URL(path,url).searchParams,page=Number(p.get('page'))||1;return{items:[media],pageInfo:{currentPage:page,lastPage:8,total:200,hasNextPage:page<8}}};
  const window={__NX_V22_DETAIL_READY__:true,AniNexusAuth:{enabled:true,publicApi:api},AniNexusRuntime:{jsonRequest:async path=>({response:{ok:true},body:await api(path)}),withDeadline:(fn,{signal})=>fn(signal),abortableDelay:async()=>{}}};
  context={window,document,location,history,sessionStorage,localStorage:sessionStorage,Node:{TEXT_NODE:3},Element,HTMLElement:Element,URL,URLSearchParams,AbortController,AbortSignal,Intl,Date,Math,Number,Object,Map,Set,WeakMap,Symbol,Promise,console,navigator:{},performance:{now:()=>frameClock,timeOrigin:1},scrollY:0,scrollX:0,innerHeight:800,matchMedia:()=>({matches:true}),getComputedStyle:()=>({getPropertyValue:()=>''}),scrollTo:options=>{context.scrollY=options.top||0},queueMicrotask,requestAnimationFrame:fn=>{const id=++sequence;frames.set(id,fn);return id},cancelAnimationFrame:id=>frames.delete(id),setTimeout:(fn,delay=0)=>{const id=++sequence;timers.set(id,{fn,at:clock+delay});return id},clearTimeout:id=>timers.delete(id),addEventListener:(name,fn,options)=>listeners(windowListeners,name,fn,options),removeEventListener:(name,fn)=>windowListeners.set(name,(windowListeners.get(name)||[]).filter(value=>value.fn!==fn)),dispatchEvent:dispatch,CustomEvent:class{constructor(type,options={}){Object.assign(this,event(type,options))}},PopStateEvent:class{constructor(type,options={}){Object.assign(this,event(type,{...options,isTrusted:false}))}},MutationObserver:class{constructor(callback){this.callback=callback;observers.push(this)}observe(){this.connected=true}disconnect(){this.connected=false}},fetch:async()=>{throw new Error('Unexpected network request')}};
  window.scrollTo=context.scrollTo;window.addEventListener=context.addEventListener;window.dispatchEvent=context.dispatchEvent;Object.defineProperty(window,'scrollY',{get:()=>context.scrollY});
  for(const file of sourceFiles)runInNewContext(readSource(file),context,{filename:file});
  async function flush(){for(let turn=0;turn<40;turn++){await Promise.resolve();for(const[id,timer]of[...timers])if(timer.at<=clock){timers.delete(id);timer.fn()}for(const[id,fn]of[...frames]){frames.delete(id);frameClock+=16;fn()}await Promise.resolve()}}
  async function send(type,target,options={}){const value=event(type,{target,...options});emit(windowListeners,value,true);if(!value.stopped)emit(document.events,value,true);const chain=[];for(let node=target;node;node=node.parentElement)chain.push(node);for(const node of[...chain].reverse())if(!value.stopped)emit(node.events,value,true);for(const node of chain)if(!value.stopped)emit(node.events,value,false);if(!value.stopped)emit(document.events,value,false);if(!value.stopped)emit(windowListeners,value,false);await flush();return value}
  async function traverse(delta){const next=index+delta;assert.ok(next>=0&&next<entries.length);index=next;url=new URL(entries[index]);history.state=entryStates[index];dispatch(event('popstate',{state:history.state}));await flush()}
  const params=()=>{const u=new URL(location.href);return u.searchParams.get('p')?new URL(u.searchParams.get('p'),u.origin).searchParams:u.searchParams};
  return{document,location,history,requests,assignments,params,flush,send,click:selector=>send('click',typeof selector==='string'?document.querySelector(selector):selector),change:async(selector,value)=>{const n=document.querySelector(selector);assert.ok(n,selector);n.value=value;await send('change',n)},input:async value=>{const n=document.querySelector('[data-nx21-search]');n.value=value;await send('input',n)},advance:async ms=>{clock+=ms;await flush()},back:()=>traverse(-1),forward:()=>traverse(1),scroll:y=>{context.scrollY=y},scrollY:()=>context.scrollY,stored:key=>sessionStorage.getItem(key)};
}

const pathUrl=(pages,path)=>pages?'https://fixture.github.io/AniNexus/?build=fixture&p='+encodeURIComponent(path):'https://aninexus.test'+path;
const fullQuery='secao=busca&q=Obra+%26+cora%C3%A7%C3%A3o&genre=Action&tag=Martial+Arts&format=TV&year=2024&season=FALL&status=FINISHED&sort=TITLE&direction=ASC&page=3';
for(const pages of[false,true]){
  const label=pages?'Pages':'VPS';
  test(`${label}: a shared URL restores the full applied selection and page in a fresh tab`,async()=>{
    const r=browser(pathUrl(pages,'/animes/catalogo?'+fullQuery));await r.flush();
    const p=new URL(r.requests.at(-1),'https://fixture.test').searchParams;
    for(const[key,value]of new URLSearchParams(fullQuery))if(key!=='secao')assert.equal(p.get(key==='q'?'search':key),value,key);
    assert.equal(r.document.querySelector('[data-nx21-search]').value,'Obra & coração');
    assert.equal(r.params().get('genre'),'Action');assert.equal(r.params().get('page'),'3');assert.equal(r.history.state.fixture,'retained');
    await r.click('[data-nx21-filters]');assert.equal(r.document.querySelector('#nx21Genre option[selected]').getAttribute('value'),'Action');assert.equal(r.document.querySelector('#nx21Tag option[selected]').getAttribute('value'),'Martial Arts');assert.equal(r.document.querySelector('#nx21Year option[selected]').getAttribute('value'),'2024');assert.equal(r.document.querySelector('[data-nx21-filter-key="format"][data-nx21-filter-value="TV"]').getAttribute('aria-pressed'),'true');assert.equal(r.document.querySelector('[data-nx21-direction="ASC"]').getAttribute('aria-pressed'),'true');await r.click('[data-nx21-filter-close]');
    const copy=browser(r.location.href);await copy.flush();assert.equal(copy.requests.at(-1),r.requests.at(-1));assert.equal(copy.location.href,r.location.href);
  });
  test(`${label}: applied filters, search and pagination create reproducible history entries`,async()=>{
    const r=browser(pathUrl(pages,'/animes/catalogo?secao=busca'));await r.flush();await r.click('[data-nx21-filters]');
    await r.change('#nx21Genre','Action');await r.change('#nx21Tag','Martial Arts');await r.change('#nx21Year','2024');
    await r.click('[data-nx21-filter-key="format"][data-nx21-filter-value="TV"]');await r.click('[data-nx21-filter-key="status"][data-nx21-filter-value="FINISHED"]');await r.click('[data-nx21-filter-key="season"][data-nx21-filter-value="FALL"]');await r.click('[data-nx21-filter-key="sort"][data-nx21-filter-value="TITLE"]');
    assert.equal(r.params().get('genre'),null,'Draft filters must not change the shared URL');await r.click('[data-nx21-filter-apply]');const applied=r.location.href;
    assert.equal(r.params().get('genre'),'Action');assert.equal(r.params().get('direction'),'ASC');
    await r.input('Busca & nova');await r.advance(320);assert.equal(r.params().get('q'),'Busca & nova');const searched=r.location.href;
    await r.click('[data-nx21-page="2"]');assert.equal(r.params().get('page'),'2');const paged=r.location.href;
    await r.back();assert.equal(r.location.href,searched);await r.back();assert.equal(r.location.href,applied);await r.forward();assert.equal(r.location.href,searched);await r.forward();assert.equal(r.location.href,paged);
    const copy=browser(paged);await copy.flush();assert.equal(new URL(copy.requests.at(-1),'https://fixture.test').searchParams.get('page'),'2');
  });
  test(`${label}: removing filters and clearing search update the URL without reviving saved state`,async()=>{
    const r=browser(pathUrl(pages,'/animes/catalogo?'+fullQuery));await r.flush();await r.click('[data-nx21-filters]');await r.change('#nx21Genre','');await r.click('[data-nx21-filter-apply]');assert.equal(r.params().get('genre'),null);assert.equal(r.params().get('tag'),'Martial Arts');assert.equal(r.params().get('page'),null);
    await r.click('[data-nx21-search-clear]');assert.equal(r.params().get('q'),null);assert.equal(r.params().get('tag'),'Martial Arts');
    await r.click('[data-nx21-filters]');await r.click('[data-nx21-filter-clear]');await r.click('[data-nx21-filter-apply]');assert.equal(r.params().get('tag'),null);assert.equal(r.params().get('format'),null);
    const saved={'nx:v46:anime-catalog-state':JSON.stringify({mode:'TOP',search:'wrong',filters:{genre:'Romance'}})},copy=browser(r.location.href,{saved});await copy.flush();assert.equal(copy.params().get('genre'),null);assert.equal(copy.document.querySelector('[data-nx21-search]').value,'');
  });
  test(`${label}: legacy detail genre handoff migrates into a shareable URL once`,async()=>{
    const r=browser(pathUrl(pages,'/animes/catalogo'),{incoming:{genre:'Fantasy',tag:'Magic'}});await r.flush();assert.equal(r.params().get('genre'),'Fantasy');assert.equal(r.params().get('tag'),'Magic');assert.equal(r.stored('nx23:catalog:incoming'),null);
    const count=r.requests.length;await r.flush();assert.equal(r.requests.length,count);const copy=browser(r.location.href);await copy.flush();assert.equal(copy.params().get('genre'),'Fantasy');assert.equal(new URL(copy.requests.at(-1),'https://fixture.test').searchParams.get('genre'),'Fantasy');
  });
  test(`${label}: an explicit shared URL wins over a leftover legacy genre handoff`,async()=>{
    const r=browser(pathUrl(pages,'/animes/catalogo?'+fullQuery),{incoming:{genre:'Romance',search:'old title'}});await r.flush();assert.equal(r.params().get('genre'),'Action');assert.equal(r.params().get('q'),'Obra & coração');assert.equal(r.params().get('page'),'3');assert.equal(r.stored('nx23:catalog:incoming'),null);
  });
  test(`${label}: manga selections share reading filters and native manga detail context`,async()=>{
    const r=browser(pathUrl(pages,'/mangas?secao=busca&q=Novel&genre=Fantasy&format=NOVEL&year=2020&status=HIATUS&sort=NEW&direction=DESC&page=2'));await r.flush();assert.match(r.requests.at(-1),/^\/api\/reading\?/);assert.equal(r.params().get('format'),'NOVEL');
    const before=r.location.href,link=r.document.querySelector('a[data-native-media-link]');assert.match(link.href,/manga/);await r.send('click',link,{ctrlKey:true});assert.equal(r.location.href,before);
    await r.click(link);const previous=JSON.parse(r.stored('nx22:previous-path')),source=new URL(before);assert.equal(previous.path,source.searchParams.get('p')||source.pathname+source.search);
  });
}

test('browser Back from a native detail restores catalog filters, page and source scroll',async()=>{
  const r=browser(pathUrl(false,'/animes/catalogo?'+fullQuery));await r.flush();const source=r.location.href,entry=r.history.state.__aninexusEntryId;r.scroll(740);const link=r.document.querySelector('a[data-native-media-link]');await r.click(link);assert.equal(JSON.parse(r.stored('nx22:previous-path')).path,new URL(source).pathname+new URL(source).search);await r.back();assert.equal(r.location.href,source);assert.equal(r.params().get('page'),'3');assert.equal(r.scrollY(),740);assert.equal(r.history.state.__aninexusEntryId,entry);
});

test('malformed URL enums and page bounds normalize safely without navigation loops',async()=>{
  const r=browser(pathUrl(false,'/mangas?secao=busca&format=TV&season=FALL&status=nope&sort=nope&direction=nope&year=-1&page=Infinity&q=Safe'));await r.flush();const p=new URL(r.requests.at(-1),'https://fixture.test').searchParams;assert.equal(p.get('format'),null);assert.equal(p.get('season'),null);assert.equal(p.get('status'),null);assert.equal(p.get('year'),null);assert.equal(p.get('sort'),'DISCOVER');assert.equal(p.get('direction'),'DESC');assert.equal(p.get('page'),'1');const href=r.location.href,count=r.requests.length;await r.flush();assert.equal(r.location.href,href);assert.equal(r.requests.length,count);assert.equal(r.history.length,1);
});

test('Pages outer filter parameters migrate into p while encoded route values take precedence',async()=>{
  const initial=pathUrl(true,'/mangas?secao=busca&genre=Fantasy')+'&genre=Romance&tag=Martial+Arts&q=Title+%26+%E6%BC%AB%E7%94%BB&page=2&utm_source=fixture',r=browser(initial);await r.flush();
  assert.equal(r.params().get('genre'),'Fantasy');assert.equal(r.params().get('tag'),'Martial Arts');assert.equal(r.params().get('q'),'Title & 漫画');assert.equal(r.params().get('page'),'2');
  const outer=new URL(r.location.href);assert.equal(outer.searchParams.get('genre'),null);assert.equal(outer.searchParams.get('q'),null);assert.equal(outer.searchParams.get('utm_source'),'fixture');assert.equal(outer.searchParams.get('build'),'fixture');
  const copy=browser(r.location.href);await copy.flush();assert.equal(copy.requests.at(-1),r.requests.at(-1));
});

test('Pages outer section migrates into p when no encoded section is present',async()=>{
  const r=browser(pathUrl(true,'/mangas')+'&secao=light-novels');await r.flush();
  assert.equal(r.params().get('secao'),'light-novels');
  assert.equal(new URL(r.requests.at(-1),'https://fixture.test').searchParams.get('format'),'NOVEL');
  assert.equal(new URL(r.location.href).searchParams.get('secao'),null);
  const copy=browser(r.location.href);await copy.flush();assert.equal(copy.requests.at(-1),r.requests.at(-1));
});
