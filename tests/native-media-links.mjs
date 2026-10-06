import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {load} from 'cheerio';

const sources=['preview-v8/hotfix.js','preview-v20/catalog-v20.js','preview-v23/route-guard-v23.js','preview-v23/router-v23.js','preview-v27/navigation-v27.js','preview-v35/home-v35.js','preview-v39/media-actions-v39.js'];
// All data is synthetic; no network, real authentication, or persisted data.
function browser(initial,{kind='home',mediaType='ANIME',card='animeCard',rail=false}={}){
  const $=load('<html><head></head><body><div id="app"></div></body></html>'),nodes=new WeakMap(),windowListeners=new Map(),observers=[],frames=new Map(),timers=new Map(),requests=[],assignments=[];
  let sequence=0,clock=0,url=new URL('/fixture-cards',initial),entries=[url.href],entryStates=[null],index=0,context;
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
  const actions=[];
  const mediaState=type=>({sync(){},isFavorite:()=>false,favorite:(id,value)=>actions.push(['favorite',type,id,value]),open:async id=>actions.push(['list',type,id])});
  const window={__NX_V22_DETAIL_READY__:true,AniNexusAuth:{requireAccount:async()=>({id:'fixture-account'})},AniNexusMediaState:mediaState('ANIME'),AniNexusMangaState:mediaState('MANGA'),AniNexusRuntime:{}};
  context={window,document,location,history,sessionStorage,localStorage:sessionStorage,Node:{TEXT_NODE:3},Element,URL,URLSearchParams,AbortController,AbortSignal,Intl,Date,Math,Number,Object,Map,Set,WeakMap,Symbol,Promise,console,navigator:{},performance:{now:()=>clock,timeOrigin:1},scrollY:0,scrollX:0,innerHeight:800,scrollTo:options=>{context.scrollY=options.top||0},queueMicrotask,requestAnimationFrame:fn=>{const id=++sequence;frames.set(id,fn);return id},cancelAnimationFrame:id=>frames.delete(id),setTimeout:(fn,delay=0)=>{const id=++sequence;timers.set(id,{fn,delay});return id},clearTimeout:id=>timers.delete(id),addEventListener:(name,fn,options)=>listeners(windowListeners,name,fn,options),removeEventListener:(name,fn)=>windowListeners.set(name,(windowListeners.get(name)||[]).filter(value=>value.fn!==fn)),dispatchEvent:dispatch,CustomEvent:class{constructor(type,options={}){Object.assign(this,event(type,options))}},PopStateEvent:class{constructor(type,options={}){Object.assign(this,event(type,{...options,isTrusted:false}))}},ResizeObserver:class{observe(){}disconnect(){}},MutationObserver:class{constructor(callback){this.callback=callback;observers.push(this)}observe(){this.connected=true}disconnect(){this.connected=false}},fetch:async()=>{throw new Error('Unexpected real fetch')}};
  window.scrollTo=context.scrollTo;window.addEventListener=context.addEventListener;window.dispatchEvent=context.dispatchEvent;
  for(const src of ['preview-v40/activity-v40.js','preview-v40/home-community-v40.js','preview-v40/community-v40.js']){const script=document.createElement('script');script.setAttribute('data-nx40-src',src);script.setAttribute('data-loaded','1');document.head.append(script)};
  for(const file of sources){
    let source=readFileSync(new URL('../'+file,import.meta.url),'utf8');
    // Scope-only test seams expose the real private renderers and binders. Their
    // bodies and the actual shared event handlers execute without substitution.
    if(file.endsWith('home-v35.js'))source=source.replace(/\}\)\(\);\s*$/, 'window.__homeCards={animeCard,rankCard,readingCard,scheduleCard,awardFeature,bindCards,bindNavigation,bindRail};})();');
    if(file.endsWith('catalog-v20.js'))source=source.replace(/\}\)\(\);\s*$/, 'window.__catalogCards={cardMarkup,state,CATALOGS};})();');
    runInNewContext(source,context,{filename:file});
  }
  const media={id:101,title:{english:'Obra & coração de fixture'},coverImage:{large:'/fixture-cover.svg'},metricsSource:'aninexus',averageScore:85,ratingCount:2,genres:['Action'],externalLinks:[{type:'STREAMING',site:'Crunchyroll',url:'https://www.crunchyroll.com/fixture'}]};
  url=new URL(initial);history.replaceState(history.state,'',initial);
  const app=document.querySelector('#app');
  if(kind==='home'){
    document.body.classList.add('nx35-home-active');
    const value=card==='scheduleCard'?{media,airingAt:2099999999,episode:2}:card==='awardFeature'?{id:'fixture-award',media,media_id:media.id,winner:media.title.english,category:'Fixture',work:media.title.english}:media;
    const markup=window.__homeCards[card](value,1);
    app.innerHTML='<main class="nx35-home">'+(rail?'<div class="nx35-edge"><div class="nx35-rail">'+markup+'</div></div>':markup)+'</main>';
    if(rail){const el=app.querySelector('.nx35-rail');el.scrollWidth=900;el.clientWidth=150;el.scrollLeft=100;window.__homeCards.bindRail(el)}
    window.__homeCards.bindCards();window.__homeCards.bindNavigation();
  }else{
    document.body.classList.add('nx21-catalog');
    window.__catalogCards.state.catalog=window.__catalogCards.CATALOGS[mediaType==='MANGA'?'manga':'anime'];
    app.innerHTML=window.__catalogCards.cardMarkup(media,0);
  }
  window.AniNexusMediaActions.neutralize(app);
  async function flush(){for(let turn=0;turn<35;turn++){await Promise.resolve();for(const [id,timer]of [...timers])if(timer.delay===0){timers.delete(id);timer.fn()}for(const [id,fn]of [...frames]){frames.delete(id);fn()}await Promise.resolve()}}
  async function start(){document.readyState='complete';const value=event('DOMContentLoaded');emit(document.events,value);emit(windowListeners,value);await flush()}
  async function click(anchor,options={}){const value=event('click',{target:anchor,...options});emit(windowListeners,value,true);if(!value.stopped)emit(document.events,value,true);const chain=[];for(let node=anchor;node;node=node.parentElement)chain.push(node);for(const node of [...chain].reverse())if(!value.stopped)emit(node.events,value,true);for(const node of chain)if(!value.stopped)emit(node.events,value,false);if(!value.stopped)emit(document.events,value,false);if(!value.stopped)emit(windowListeners,value,false);if(anchor.tagName==='A'&&!value.defaultPrevented&&!value.ctrlKey&&!value.metaKey&&!value.shiftKey&&!value.altKey&&value.button===0){const destination=new URL(anchor.href);if(destination.pathname===url.pathname&&destination.search===url.search)location.hash=destination.hash;else location.assign(destination.href)}await flush();return value}
  async function pointer(type,target,options={}){const value=event(type,{target,pointerType:'mouse',clientX:140,pointerId:1,...options});emit(windowListeners,value,true);if(!value.stopped)emit(document.events,value,true);const chain=[];for(let node=target;node;node=node.parentElement)chain.push(node);for(const node of [...chain].reverse())if(!value.stopped)emit(node.events,value,true);for(const node of chain)if(!value.stopped)emit(node.events,value,false);if(!value.stopped)emit(document.events,value,false);if(!value.stopped)emit(windowListeners,value,false);return value}
  async function keydown(target,key,options={}){const value=event('keydown',{target,key,...options});emit(windowListeners,value,true);if(!value.stopped)emit(document.events,value,true);for(let node=target;node&&!value.stopped;node=node.parentElement)emit(node.events,value,false);if(!value.stopped)emit(document.events,value,false);if(!value.stopped)emit(windowListeners,value,false);if(key==='Enter'&&target.tagName==='A'&&!value.defaultPrevented)await click(target,{detail:0,...options});await flush();return value}
  async function traverse(delta){const next=index+delta;assert.ok(next>=0&&next<entries.length);const old=url.href;index=next;url=new URL(entries[index]);history.state=entryStates[index];dispatch(event('popstate',{state:history.state}));if(new URL(old).hash!==url.hash)dispatch(event('hashchange',{oldURL:old,newURL:url.href}));await flush()}
  return{document,location,history,requests,assignments,actions,keydown,pointer,stored:key=>sessionStorage.getItem(key),setScroll:y=>{context.scrollY=y},start,flush,click,advance:ms=>{clock+=ms},back:()=>traverse(-1),forward:()=>traverse(1),dispatch};
}


const homeCards=['animeCard','rankCard','readingCard','scheduleCard','awardFeature'];
for(const pages of [false,true]){
  const origin=pages?'https://fixture.github.io/AniNexus/':'https://aninexus.test/';
  for(const entry of [...homeCards.map(card=>({kind:'home',card,mediaType:card==='readingCard'?'MANGA':'ANIME'})),{kind:'catalog',mediaType:'ANIME'},{kind:'catalog',mediaType:'MANGA'}]){
    const label=`${entry.kind}/${entry.card||entry.mediaType} (${pages?'Pages':'VPS'})`;
    const path=entry.kind==='home'?'/':entry.mediaType==='MANGA'?'/mangas':'/animes/catalogo';
    const initial=pages?origin+'?build=fixture&p='+encodeURIComponent(path):new URL(path,origin).href;
    test(`${label}: native link semantics and isolated actions`,async()=>{
      const runtime=browser(initial,entry),{document}=runtime,article=document.querySelector('article'),link=article.querySelector('a[data-native-media-link]');
      assert.ok(link,'The current card renderer must emit a native opening anchor');
      const href=new URL(link.href),detail=pages?href.searchParams.get('p'):href.pathname;
      assert.equal(detail,`/${entry.mediaType==='MANGA'?'manga':'anime'}/obra-coracao-de-fixture-101`);
      assert.equal(link.getAttribute('aria-label'),'Abrir Obra & coração de fixture');
      assert.equal(article.getAttribute('tabindex'),null,'Only the link, not the card container, is a keyboard stop');
      assert.equal(article.querySelectorAll('a button,a a,a input').length,0);
      const cover=article.querySelector('img');if(cover)assert.equal(cover.getAttribute('alt'),'Obra & coração de fixture');
      const before=runtime.location.href,bodyClass=document.body.className;
      for(const options of [{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true},{button:1},{type:'auxclick',button:1}]){
        const click=await runtime.click(link,options);assert.equal(click.defaultPrevented,false);assert.equal(runtime.location.href,before);assert.equal(document.body.className,bodyClass,'Modified activation must leave the source view intact');
      }
      for(const options of [{ctrlKey:true},{metaKey:true}]){const entered=await runtime.keydown(link,'Enter',options);assert.equal(entered.defaultPrevented,false);assert.equal(runtime.location.href,before)}
      const buttons=article.querySelectorAll('button');
      if(buttons.length){
        assert.equal(buttons.length,2);assert.ok(buttons.every(button=>button.getAttribute('aria-label')));
        await runtime.click(buttons[1]);assert.deepEqual(runtime.actions.at(-1),['favorite',entry.mediaType,101,true]);assert.equal(runtime.location.href,before);
        const guarded=await runtime.click(link,{ctrlKey:true});assert.equal(guarded.defaultPrevented,false,'Native modified links must survive the action click guard');assert.equal(runtime.location.href,before);
        await runtime.click(buttons[0]);assert.deepEqual(runtime.actions.at(-1),['list',entry.mediaType,101]);assert.equal(runtime.location.href,before);
      }
      runtime.advance(600);const space=await runtime.keydown(link,' ');assert.equal(space.defaultPrevented,false);assert.equal(runtime.location.href,before);
      runtime.setScroll(360);const sourceEntry=runtime.history.state.__aninexusEntryId;
      const entered=await runtime.keydown(link,'Enter');assert.equal(entered.defaultPrevented,false,'The browser owns Enter on the opening anchor');
      const current=new URL(runtime.location.href);assert.equal(pages?current.searchParams.get('p'):current.pathname,detail);assert.equal(runtime.assignments.length,pages?1:0,'Plain activation must retain the existing VPS SPA / Pages fallback navigation');
      assert.equal(JSON.parse(runtime.stored('nx22:previous-path')).path,path,'The existing detail back path must still be recorded');
      if(!pages)assert.equal(JSON.parse(runtime.stored('aninexus:navigation-scroll:v1'))[sourceEntry].y,360,'SPA navigation must preserve the source entry scroll');
    });
    test(`${label}: prevented activation stays prevented`,async()=>{
      const runtime=browser(initial,entry),link=runtime.document.querySelector('a[data-native-media-link]');assert.ok(link);const before=runtime.location.href,bodyClass=runtime.document.body.className;
      const click=await runtime.click(link,{defaultPrevented:true});assert.equal(click.defaultPrevented,true);assert.equal(runtime.location.href,before);assert.equal(runtime.document.body.className,bodyClass);
    });
  }
}

test('native Home links preserve mouse rail dragging without navigating, then permit a normal click',async()=>{
  const runtime=browser('https://aninexus.test/',{rail:true}),link=runtime.document.querySelector('a[data-native-media-link]'),rail=runtime.document.querySelector('.nx35-rail'),before=runtime.location.href;
  await runtime.pointer('pointerdown',link);await runtime.pointer('pointermove',link,{clientX:100});assert.equal(rail.scrollLeft,140,'Opening links must still support the original rail drag');
  await runtime.pointer('pointerup',link,{clientX:100});const dragged=await runtime.click(link);assert.equal(dragged.defaultPrevented,true);assert.equal(runtime.location.href,before,'The router must not navigate before the rail cancels the drag click');
  await runtime.pointer('pointerdown',link);await runtime.pointer('pointerup',link);await runtime.click(link);assert.equal(runtime.location.pathname,'/anime/obra-coracao-de-fixture-101');
});
test('modified Home pointer activation remains native and does not drag the rail',async()=>{
  for(const options of [{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true},{button:1}]){
    const runtime=browser('https://aninexus.test/',{rail:true}),link=runtime.document.querySelector('a[data-native-media-link]'),rail=runtime.document.querySelector('.nx35-rail');
    await runtime.pointer('pointerdown',link,options);await runtime.pointer('pointermove',link,{...options,clientX:100});await runtime.pointer('pointerup',link,options);assert.equal(rail.scrollLeft,100);const value=await runtime.click(link,options);assert.equal(value.defaultPrevented,false);assert.equal(runtime.location.pathname,'/');
  }
});

test('canceled Home rail drag never consumes the next modified native activation',async()=>{
  for(const options of [{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true},{button:1}]){
    const runtime=browser('https://aninexus.test/',{rail:true}),link=runtime.document.querySelector('a[data-native-media-link]');
    await runtime.pointer('pointerdown',link);await runtime.pointer('pointermove',link,{clientX:100});await runtime.pointer('pointercancel',link);await runtime.pointer('pointerdown',link,options);const click=await runtime.click(link,options);assert.equal(click.defaultPrevented,false);assert.equal(runtime.location.pathname,'/');
  }
});
test('a modified native activation after rail movement bypasses drag click cancellation',async()=>{
  const runtime=browser('https://aninexus.test/',{rail:true}),link=runtime.document.querySelector('a[data-native-media-link]');
  await runtime.pointer('pointerdown',link);await runtime.pointer('pointermove',link,{clientX:100});await runtime.pointer('pointerup',link);const click=await runtime.click(link,{ctrlKey:true});assert.equal(click.defaultPrevented,false);assert.equal(runtime.location.pathname,'/');
});
