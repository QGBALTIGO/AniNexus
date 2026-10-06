import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {load} from 'cheerio';

const predictionId='11111111-1111-4111-8111-111111111111';
const sources=['preview-v23/route-guard-v23.js','preview-v23/router-v23.js','preview-v27/navigation-v27.js','preview-v14/legal.js','preview-v44/predictions-v61.js'];

// Exercise complete renderers and navigation scripts. Cheerio supplies selector
// and HTML parsing; the adapter supplies native URL/history/event semantics.
function browser(initial,{signedIn=false}={}){
  const $=load('<html><head></head><body><div id="app"></div></body></html>'),nodes=new WeakMap(),windowListeners=new Map(),observers=[],frames=new Map(),timers=new Map(),requests=[],assignments=[];
  let sequence=0,clock=0,url=new URL(initial),entries=[url.href],entryStates=[null],index=0,context;
  const listeners=(map,name,fn,options)=>{const list=map.get(name)||[];list.push({fn,capture:options===true||!!options?.capture,once:!!options?.once});map.set(name,list)};
  const emit=(map,event,capture)=>{for(const listener of [...(map.get(event.type)||[])]){if(capture!==undefined&&listener.capture!==capture)continue;listener.fn(event);if(listener.once)map.set(event.type,(map.get(event.type)||[]).filter(value=>value!==listener));if(event.immediate)break}};
  const event=(type,extra={})=>({type,button:0,isTrusted:true,defaultPrevented:false,preventDefault(){this.defaultPrevented=true},stopPropagation(){this.stopped=true},stopImmediatePropagation(){this.stopped=true;this.immediate=true},...extra});
  const mutation=addedNodes=>{queueMicrotask(()=>{for(const observer of observers)if(observer.connected)observer.callback([{addedNodes}])})};
  class Element{
    constructor(node){this.node=node;this.events=new Map();this.scrolls=[];this.value=node.attribs?.value||'';this.dataset=new Proxy({}, {get:(_,key)=>this.getAttribute('data-'+String(key).replace(/[A-Z]/g,c=>'-'+c.toLowerCase())),set:(_,key,value)=>{this.setAttribute('data-'+String(key).replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),value);return true},deleteProperty:(_,key)=>{this.removeAttribute('data-'+String(key).replace(/[A-Z]/g,c=>'-'+c.toLowerCase()));return true}});}
    get nodeType(){return 1} get tagName(){return this.node.name.toUpperCase()} get parentElement(){return wrap(this.node.parent)}
    get isConnected(){let node=this.node;while(node?.parent)node=node.parent;return node===$.root()[0]}
    get childNodes(){return (this.node.children||[]).map(wrap)} get firstElementChild(){return wrap($(this.node).children()[0])}
    get className(){return this.getAttribute('class')||''} set className(value){this.setAttribute('class',value)}
    get classList(){return{add:(...names)=>$(this.node).addClass(names.join(' ')),remove:(...names)=>$(this.node).removeClass(names.join(' ')),contains:name=>$(this.node).hasClass(name),toggle:(name,on)=>$(this.node).toggleClass(name,on)}}
    get id(){return this.getAttribute('id')||''} set id(value){this.setAttribute('id',value)}
    get target(){return this.getAttribute('target')||''} get href(){return new URL(this.getAttribute('href')||'',document.baseURI).href} set href(value){this.setAttribute('href',value)}
    get innerHTML(){return $(this.node).html()||''} set innerHTML(value){$(this.node).html(value);this.renders=(this.renders||0)+1;mutation(this.childNodes.filter(node=>node instanceof Element))}
    get textContent(){return $(this.node).text()} set textContent(value){$(this.node).text(value)}
    get scrollHeight(){return 5000}
    getAttribute(name){return $(this.node).attr(name)??null} setAttribute(name,value){$(this.node).attr(name,String(value))} removeAttribute(name){$(this.node).removeAttr(name)} hasAttribute(name){return this.getAttribute(name)!==null}
    querySelector(selector){return wrap($(this.node).find(selector.replace(/^:scope\s*>/, '>'))[0])} querySelectorAll(selector){return $(this.node).find(selector.replace(/^:scope\s*>/, '>')).toArray().map(wrap)}
    closest(selector){return wrap($(this.node).closest(selector)[0])} matches(selector){return $(this.node).is(selector)} contains(other){return other===this||!!$(other?.node).parents().toArray().includes(this.node)}
    append(...children){for(const child of children)$(this.node).append(child instanceof Element?child.node:child?.node||String(child));mutation(this.childNodes.filter(node=>node instanceof Element))}
    replaceWith(other){$(this.node).replaceWith(other.node);mutation([other])} remove(){$(this.node).remove()}
    addEventListener(name,fn,options){listeners(this.events,name,fn,options)} removeEventListener(name,fn){this.events.set(name,(this.events.get(name)||[]).filter(value=>value.fn!==fn))}
    focus(){document.activeElement=this} blur(){if(document.activeElement===this)document.activeElement=null}
    scrollIntoView(options){this.scrolls.push(options);context.scrollY=300}
    reportValidity(){return true} reset(){throw new Error('Fragment navigation must not reset the form')}
  }
  function wrap(node){if(!node)return null;if(node.type==='text')return{node,nodeType:3};if(!nodes.has(node))nodes.set(node,new Element(node));return nodes.get(node)}
  const document={baseURI:new URL(url.hostname.endsWith('github.io')?'/AniNexus/':'/',url.origin).href,readyState:'loading',referrer:'',title:'',events:new Map(),activeElement:null,querySelector:selector=>wrap($(selector)[0]),querySelectorAll:selector=>$(selector).toArray().map(wrap),getElementById:id=>wrap($('[id]').toArray().find(node=>node.attribs.id===id)),createElement:name=>wrap($('<'+name+'></'+name+'>')[0]),addEventListener(name,fn,options){listeners(this.events,name,fn,options)},dispatchEvent(value){emit(this.events,value)}};
  document.documentElement=document.querySelector('html');document.head=document.querySelector('head');document.body=document.querySelector('body');
  const dispatch=value=>{emit(windowListeners,value,true);if(!value.stopped)emit(windowListeners,value,false);return !value.defaultPrevented};
  const location={get href(){return url.href},get origin(){return url.origin},get hostname(){return url.hostname},get pathname(){return url.pathname},get search(){return url.search},get hash(){return url.hash},set hash(value){const next=new URL(url);next.hash=value;if(next.href===url.href)return;const old=url.href;url=next;entries=entries.slice(0,index+1);entryStates=entryStates.slice(0,index+1);entries.push(url.href);entryStates.push(history.state);index++;dispatch(event('hashchange',{oldURL:old,newURL:url.href}))},assign(value){assignments.push(String(value));url=new URL(value,url)}};
  const history={state:null,pushState(state,_title,value){url=new URL(value,url);this.state=state;entries=entries.slice(0,index+1);entryStates=entryStates.slice(0,index+1);entries.push(url.href);entryStates.push(state);index++},replaceState(state,_title,value){url=new URL(value,url);this.state=state;entries[index]=url.href;entryStates[index]=state}};
  const storage=new Map(),sessionStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value))};
  const item={id:predictionId,mediaTitle:'Obra de fixture',mediaType:'ANIME',question:'Haverá anúncio oficial?',status:'OPEN',closesAt:'2099-01-01T00:00:00Z',resolutionDeadline:'2099-02-01T00:00:00Z',voteCount:0,yesCount:0,noCount:0,criteria:'Anúncio oficial',source:'Crunchyroll'};
  const window={AniNexusAuth:{getUser:async()=>signedIn?{id:'fixture-session'}:null,publicApi:async path=>{requests.push(path);assert.equal(path,'/api/predictions/'+predictionId+'/detail');return{item,history:[],arguments:[],related:[],collective:{}}},api:async(path,options)=>{requests.push(path);assert.equal(options?.method,undefined,'Fragment navigation must not submit a vote or argument');assert.equal(path,'/api/me/predictions/'+predictionId+'/detail');return{userVote:{choice:'YES',confidence:50},argument:{text:'Argumento inicial de fixture'}}}}};
  context={window,document,location,history,sessionStorage,Element,URL,URLSearchParams,AbortController,AbortSignal,Intl,Date,Math,Number,Object,Map,Set,WeakMap,Symbol,Promise,console,navigator:{},performance:{now:()=>++clock,timeOrigin:1},scrollY:0,scrollX:0,innerHeight:800,scrollTo:options=>{context.scrollY=options.top||0},queueMicrotask,requestAnimationFrame:fn=>{const id=++sequence;frames.set(id,fn);return id},cancelAnimationFrame:id=>frames.delete(id),setTimeout:(fn,delay=0)=>{const id=++sequence;timers.set(id,{fn,delay});return id},clearTimeout:id=>timers.delete(id),addEventListener:(name,fn,options)=>listeners(windowListeners,name,fn,options),removeEventListener:(name,fn)=>windowListeners.set(name,(windowListeners.get(name)||[]).filter(value=>value.fn!==fn)),dispatchEvent:dispatch,CustomEvent:class{constructor(type,options={}){Object.assign(this,event(type,options))}},PopStateEvent:class{constructor(type,options={}){Object.assign(this,event(type,{...options,isTrusted:false}))}},MutationObserver:class{constructor(callback){this.callback=callback;observers.push(this)}observe(){this.connected=true}disconnect(){this.connected=false}},fetch:async()=>{throw new Error('Unexpected real fetch')}};
  window.scrollTo=context.scrollTo;
  for(const file of sources)runInNewContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context,{filename:file});
  async function flush(){for(let turn=0;turn<35;turn++){await Promise.resolve();for(const [id,timer]of [...timers])if(timer.delay===0){timers.delete(id);timer.fn()}for(const [id,fn]of [...frames]){frames.delete(id);fn()}await Promise.resolve()}}
  async function start(){document.readyState='complete';const value=event('DOMContentLoaded');emit(document.events,value);emit(windowListeners,value);await flush()}
  async function click(anchor,options={}){const value=event('click',{target:anchor,...options});emit(windowListeners,value,true);if(!value.stopped)emit(document.events,value,true);for(let node=anchor;node&&!value.stopped;node=node.parentElement)emit(node.events,value,false);if(!value.stopped)emit(document.events,value,false);if(!value.stopped)emit(windowListeners,value,false);if(anchor.tagName==='A'&&!value.defaultPrevented&&!value.ctrlKey&&!value.metaKey&&!value.shiftKey&&!value.altKey&&value.button===0){const destination=new URL(anchor.href);if(destination.pathname===url.pathname&&destination.search===url.search)location.hash=destination.hash;else location.assign(destination.href)}await flush();return value}
  async function traverse(delta){const next=index+delta;assert.ok(next>=0&&next<entries.length);const old=url.href;index=next;url=new URL(entries[index]);history.state=entryStates[index];dispatch(event('popstate',{state:history.state}));if(new URL(old).hash!==url.hash)dispatch(event('hashchange',{oldURL:old,newURL:url.href}));await flush()}
  return{document,location,history,requests,assignments,start,flush,click,back:()=>traverse(-1),forward:()=>traverse(1),dispatch};
}

for(const origin of ['https://aninexus.test','https://fixture.github.io/AniNexus']){
  const pages=origin.includes('github.io'),page=path=>pages?origin+'/?build=fixture&p='+encodeURIComponent(path):origin+path;
  test(`legal fragments preserve route, draft, native history and modified clicks (${pages?'Pages':'VPS'})`,async()=>{
    const runtime=browser(page('/dmca?fixture=1'));await runtime.start();
    const {document,location}=runtime,form=document.querySelector('#nxLegalDmca'),draft=form.querySelector('textarea');draft.value='Rascunho de fixture que deve permanecer';
    const links=document.querySelectorAll('.nx-legal-side a'),formLink=links.find(link=>link.textContent==='Formulário'),english=links.find(link=>link.textContent==='English version');
    assert.equal(new URL(formLink.href).pathname,new URL(location.href).pathname);assert.equal(new URL(formLink.href).search,new URL(location.href).search);assert.equal(new URL(formLink.href).hash,'#formulario');
    for(const options of [{ctrlKey:true},{metaKey:true},{button:1}]){const modified=await runtime.click(formLink,options);assert.equal(modified.defaultPrevented,false);assert.equal(location.hash,'')}
    await runtime.click(formLink,{detail:0});assert.equal(location.hash,'#formulario');assert.equal(document.activeElement.textContent,'Enviar notificação de remoção');
    await runtime.click(english);assert.equal(location.hash,'#english');assert.equal(document.querySelector('#nxLegalDmca'),form);assert.equal(draft.value,'Rascunho de fixture que deve permanecer');
    await runtime.back();assert.equal(location.hash,'#formulario');await runtime.forward();assert.equal(location.hash,'#english');assert.equal(document.querySelector('#nxLegalDmca'),form);assert.equal(runtime.assignments.length,0);
  });
  test(`prediction fragments preserve identity, query, selected vote and draft (${pages?'Pages':'VPS'})`,async()=>{
    const runtime=browser(page('/previsoes?previsao='+predictionId+'&fixture=1'),{signedIn:true});await runtime.start();
    const {document,location}=runtime,host=document.querySelector('.nx62-detail'),draft=host.querySelector('textarea');draft.value='Outro argumento de fixture ainda não enviado';
    const focus=host.querySelector('[data-pred-focus]'),choice=host.querySelector('[data-pred-choice="NO"]');await runtime.click(choice);
    assert.equal(new URL(focus.href).search,new URL(location.href).search);assert.equal(new URL(focus.href).hash,'#nx62-prever');
    for(const options of [{ctrlKey:true},{metaKey:true},{button:1}]){const modified=await runtime.click(focus,options);assert.equal(modified.defaultPrevented,false);assert.equal(location.hash,'')}
    const before=runtime.requests.length;await runtime.click(focus,{detail:0});assert.equal(location.hash,'#nx62-prever');assert.equal(document.querySelector('.nx62-detail'),host);assert.equal(choice.getAttribute('aria-pressed'),'true');assert.equal(document.activeElement.getAttribute('data-pred-choice'),'NO');
    await runtime.back();await runtime.forward();assert.equal(document.querySelector('.nx62-detail'),host);assert.equal(draft.value,'Outro argumento de fixture ainda não enviado');assert.equal(runtime.requests.length,before);assert.equal(runtime.assignments.length,0);
  });
  test(`direct legal and prediction fragments focus after rendering (${pages?'Pages':'VPS'})`,async()=>{
    const legal=browser(page('/dmca?fixture=1')+'#formulario');await legal.start();assert.equal(legal.document.activeElement?.textContent,'Enviar notificação de remoção');
    const prediction=browser(page('/previsoes?previsao='+predictionId)+'#nx62-prever');await prediction.start();assert.equal(prediction.document.activeElement?.getAttribute('data-pred-choice'),'YES');
  });
  test(`native prediction argument hash preserves the existing editor (${pages?'Pages':'VPS'})`,async()=>{
    const runtime=browser(page('/previsoes?previsao='+predictionId),{signedIn:true});await runtime.start();const host=runtime.document.querySelector('.nx62-detail'),draft=host.querySelector('textarea');draft.value='Rascunho preservado em navegação nativa';const before=runtime.requests.length;
    runtime.location.hash='argumentos';await runtime.flush();assert.equal(runtime.document.activeElement,draft);assert.equal(runtime.document.querySelector('.nx62-detail'),host);assert.equal(draft.value,'Rascunho preservado em navegação nativa');assert.equal(runtime.requests.length,before);
  });
  test(`direct Prever query still focuses the voting controls (${pages?'Pages':'VPS'})`,async()=>{
    const runtime=browser(page('/previsoes?previsao='+predictionId+'&foco=prever'));await runtime.start();assert.equal(runtime.document.activeElement?.getAttribute('data-pred-choice'),'YES');assert.equal(runtime.location.hash,'');
  });
}

test('legacy prediction hash identity remains reachable when jumping to the vote',async()=>{
  const runtime=browser('https://aninexus.test/previsoes?fixture=1#'+predictionId);await runtime.start();const host=runtime.document.querySelector('.nx62-detail'),focus=host.querySelector('[data-pred-focus]');
  await runtime.click(focus);assert.equal(new URL(runtime.location.href).searchParams.get('previsao'),predictionId);assert.equal(new URL(runtime.location.href).searchParams.get('fixture'),'1');assert.equal(runtime.location.hash,'#nx62-prever');assert.equal(runtime.document.querySelector('.nx62-detail'),host);
});

test('Pages restored fragments and legacy prediction ids retain their route',async()=>{
  const legal=browser('https://fixture.github.io/AniNexus/?p='+encodeURIComponent('/dmca#formulario'));await legal.start();assert.equal(legal.document.activeElement?.textContent,'Enviar notificação de remoção');
  const runtime=browser('https://fixture.github.io/AniNexus/?build=fixture&p='+encodeURIComponent('/previsoes?fixture=1#'+predictionId));await runtime.start();const host=runtime.document.querySelector('.nx62-detail');await runtime.click(host.querySelector('[data-pred-focus]'));
  const destination=new URL(runtime.location.href),path=new URL(destination.searchParams.get('p'),destination.origin);assert.equal(path.pathname,'/previsoes');assert.equal(path.searchParams.get('previsao'),predictionId);assert.equal(path.searchParams.get('fixture'),'1');assert.equal(destination.searchParams.get('build'),'fixture');assert.equal(destination.hash,'#nx62-prever');assert.equal(runtime.document.querySelector('.nx62-detail'),host);
});

test('prediction comment gate focuses the vote without bypassing login',async()=>{
  const runtime=browser('https://aninexus.test/previsoes?previsao='+predictionId);await runtime.start();const host=runtime.document.querySelector('.nx62-detail'),gate=host.querySelector('.nx62-comment-gate a');await runtime.click(gate);assert.equal(runtime.location.hash,'#nx62-prever');assert.equal(runtime.location.pathname,'/previsoes');assert.equal(new URL(runtime.location.href).searchParams.get('previsao'),predictionId);assert.equal(runtime.assignments.length,0);
  await runtime.click(host.querySelector('[data-pred-confirm]'));assert.equal(host.querySelector('[data-pred-vote-feedback] a').getAttribute('href'),'/login');assert.equal(runtime.requests.length,1);
});
