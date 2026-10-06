import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import {load} from 'cheerio';

const baseline=process.env.ANX06_BASELINE_REF;
if(baseline)assert.match(baseline,/^[a-f0-9]{40}$/);
const read=file=>baseline?execFileSync('git',['show',`${baseline}:${file}`],{cwd:new URL('..',import.meta.url),encoding:'utf8'}):readFileSync(new URL('../'+file,import.meta.url),'utf8');
const runtimeSource=read('preview-v38/runtime-v38.js'),drawerSource=read('preview-v6/app.js'),adminSource=read('preview-v38/admin-v38.js');
const drawerMarkup=read('index.html').match(/<aside class="drawer"[\s\S]*?<\/aside>/)[0];
const focused=(browser,node)=>assert.equal(browser.document.activeElement===node,true,'Expected focus on the chosen control');

// HTML/selectors come from the real components. This adapter supplies DOM focus,
// capture/bubbling, layout visibility, attributes and mutation notifications.
function browser(){
  const $=load(`<html><body><div id="topbar"><button id="opener" data-action="drawer-open">Menu</button><button data-action="search">Pesquisar</button></div><button id="outside">Outside</button>${drawerMarkup}<div id="searchOverlay" hidden><input id="searchInput"><button data-action="search-close">Fechar busca</button></div><div id="authOverlay" hidden></div><div id="app"><div class="nx38-admin-page"></div></div><span id="year"></span></body></html>`);
  const wrappers=new WeakMap(),observers=[],windowEvents=new Map(),frames=[];
  const event=(type,extra={})=>({type,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},stopImmediatePropagation(){this.stopped=true;this.immediate=true;},...extra});
  const add=(events,type,fn,options)=>{const list=events.get(type)||[];list.push({fn,capture:options===true||!!options?.capture});events.set(type,list);};
  const emit=(events,e,capture)=>{for(const listener of [...(events.get(e.type)||[])]){if(capture!==undefined&&capture!==listener.capture)continue;listener.fn(e);if(e.immediate)break;}};
  const mutate=target=>queueMicrotask(()=>{for(const o of [...observers])if(o.connected&&(o.root===document.documentElement||o.root===target||o.root?.contains(target)))o.callback([{addedNodes:[],target}]);});
  const dispatch=e=>{
    emit(document.events,e,true);
    if(!e.stopped)for(let node=e.target;node&&!e.stopped;node=node.parentElement){emit(node.events,e,false);if(!e.stopped)node['on'+e.type]?.(e);}
    if(!e.stopped)emit(document.events,e,false);
    return e;
  };
  class Element{
    constructor(node){this.node=node;this.events=new Map();this._value=null;}
    get tagName(){return this.node.name.toUpperCase();} get parentElement(){return wrap(this.node.parent);}
    get isConnected(){let n=this.node;while(n?.parent)n=n.parent;return n===$.root()[0];}
    get hidden(){return this.hasAttribute('hidden');} set hidden(on){on?this.setAttribute('hidden',''):this.removeAttribute('hidden');}
    get inert(){return this.hasAttribute('inert');} set inert(on){on?this.setAttribute('inert',''):this.removeAttribute('inert');}
    get disabled(){return this.hasAttribute('disabled');} set disabled(on){on?this.setAttribute('disabled',''):this.removeAttribute('disabled');}
    get tabIndex(){const raw=this.getAttribute('tabindex');return raw!==null?Number(raw):this.matches('button,input:not([type="hidden"]),select,textarea,a[href],[contenteditable="true"]')?0:-1;}
    set tabIndex(value){this.setAttribute('tabindex',value);}
    get value(){return this._value??this.getAttribute('value')??(this.tagName==='TEXTAREA'?this.textContent:this.tagName==='SELECT'?this.querySelector('option[selected],option')?.getAttribute('value')||'':'');} set value(value){this._value=String(value);}
    get elements(){return Object.fromEntries(this.querySelectorAll('[name]').map(x=>[x.getAttribute('name'),x]));}
    get className(){return this.getAttribute('class')||'';} set className(value){this.setAttribute('class',value);}
    get dataset(){return new Proxy({}, {get:(_,key)=>this.getAttribute('data-'+String(key).replace(/[A-Z]/g,c=>'-'+c.toLowerCase()))});}
    get classList(){return{add:(...names)=>{ $(this.node).addClass(names.join(' '));mutate(this);},remove:(...names)=>{$(this.node).removeClass(names.join(' '));mutate(this);},contains:name=>$(this.node).hasClass(name)};}
    get innerHTML(){return $(this.node).html()||'';} set innerHTML(value){$(this.node).html(value);mutate(this);}
    get textContent(){return $(this.node).text();} set textContent(value){$(this.node).text(value);mutate(this);}
    get style(){return{getPropertyValue:name=>(this.getAttribute('style')||'').match(new RegExp(`${name}:\\s*([^;]+)`))?.[1]?.trim()||'',setProperty:(name,value)=>this.setAttribute('style',`${name}:${value}`),removeProperty:()=>this.removeAttribute('style')};}
    getAttribute(name){return $(this.node).attr(name)??null;} hasAttribute(name){return this.getAttribute(name)!==null;}
    setAttribute(name,value){$(this.node).attr(name,String(value));mutate(this);} removeAttribute(name){$(this.node).removeAttr(name);mutate(this);}
    querySelector(selector){return wrap($(this.node).find(selector)[0]);} querySelectorAll(selector){return $(this.node).find(selector).toArray().map(wrap);}
    matches(selector){return $(this.node).is(selector);} closest(selector){return wrap($(this.node).closest(selector)[0]);}
    contains(other){return this===other||!!$(other?.node).parents().toArray().includes(this.node);}
    append(child){$(this.node).append(child.node);mutate(this);} remove(){const parent=this.parentElement;$(this.node).remove();if(document.activeElement===this||this.contains(document.activeElement))document.activeElement=document.body;mutate(parent);}
    getClientRects(){if(!this.isConnected)return[];for(let x=this;x;x=x.parentElement)if(x.hidden||x.style.getPropertyValue('display')==='none'||['hidden','collapse'].includes(x.style.getPropertyValue('visibility')))return[];return[{}];}
    addEventListener(type,fn,options){add(this.events,type,fn,options);} removeEventListener(type,fn){this.events.set(type,(this.events.get(type)||[]).filter(x=>x.fn!==fn));}
    focus(){if(!this.isConnected||this.matches(':disabled')||!this.getClientRects().length||this.closest('[inert]'))return;document.activeElement=this;dispatch(event('focusin',{target:this}));}
  }
  function wrap(node){if(!node?.name)return null;if(!wrappers.has(node))wrappers.set(node,new Element(node));return wrappers.get(node);}
  const document={events:new Map(),querySelector:selector=>wrap($(selector)[0]),querySelectorAll:selector=>$(selector).toArray().map(wrap),createElement:name=>wrap($(`<${name}></${name}>`)[0]),addEventListener(type,fn,options){add(this.events,type,fn,options);},removeEventListener(type,fn){this.events.set(type,(this.events.get(type)||[]).filter(x=>x.fn!==fn));}};
  document.body=document.querySelector('body');document.documentElement=document.querySelector('html');document.activeElement=document.body;
  const location={hostname:'fixture.test',origin:'https://fixture.test',href:'https://fixture.test/admin',pathname:'/admin',search:''};
  const window={document,fetch:async()=>{throw new Error('Unexpected fetch');},addEventListener:(type,fn,options)=>add(windowEvents,type,fn,options)};
  const context=vm.createContext({window,document,location,URL,URLSearchParams,performance:{now:()=>0},HTMLElement:Element,Element,AbortController,queueMicrotask,setTimeout,clearTimeout,requestAnimationFrame:fn=>frames.push(fn),getComputedStyle:node=>({display:node.style.getPropertyValue('display')||'block',visibility:node.style.getPropertyValue('visibility')||'visible'}),addEventListener:(type,fn,options)=>add(windowEvents,type,fn,options),removeEventListener:(type,fn)=>windowEvents.set(type,(windowEvents.get(type)||[]).filter(x=>x.fn!==fn)),MutationObserver:class{constructor(callback){this.callback=callback;observers.push(this);}observe(root){this.root=root;this.connected=true;}disconnect(){this.connected=false;}},console});
  const marker=runtimeSource.indexOf('window.AniNexusRuntime=Object.freeze('),end=runtimeSource.indexOf('\n',marker);
  vm.runInContext(runtimeSource.slice(0,end)+'\n})();',context);
  const region=drawerSource.slice(drawerSource.indexOf('function openDrawer'),drawerSource.indexOf('function wireAuth'));
  const globals=drawerSource.match(/^function globalEvents\(\).*$/m)[0];
  vm.runInContext(`const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];function render(){}function setupSearch(){}function wireLinks(){}function bindImageFallback(){}\n${region}\n${globals}\nglobalEvents();`,context);
  vm.runInContext(adminSource.replace('setTimeout(mount, 0);','window.fixtureDecisionDialog=decisionDialog;'),context);
  const flush=async()=>{for(let n=0;n<10;n++){await Promise.resolve();for(const fn of frames.splice(0))fn();}};
  const key=(key,shiftKey=false,target=document.activeElement)=>dispatch(event('keydown',{key,shiftKey,target}));
  const click=target=>{target.focus();return dispatch(event('click',{target}));};
  const run=code=>vm.runInContext(code,context);
  return{window,document,location,flush,key,click,run,emit:type=>emit(windowEvents,event(type)),runtime:window.AniNexusRuntime};
}

test('drawer focuses its visible panel close control and wraps Tab in both directions',async()=>{
  const b=browser(),trigger=b.document.querySelector('#opener');b.click(trigger);await b.flush();
  const panel=b.document.querySelector('.drawer-panel'),first=panel.querySelector('[data-action="drawer-close"]'),last=panel.querySelector('[data-nx-install]');
  focused(b,first);
  const back=b.key('Tab',true);assert.equal(back.defaultPrevented,true);focused(b,last);
  const next=b.key('Tab');assert.equal(next.defaultPrevented,true);focused(b,first);
  b.document.querySelector('#outside').focus();assert.equal(panel.contains(b.document.activeElement),true);
  b.key('Escape');assert.equal(b.document.querySelector('#drawer').hidden,true);focused(b,trigger);
});

test('drawer backdrop closes and restores focus; stale animation cannot focus a closed drawer',async()=>{
  const b=browser(),trigger=b.document.querySelector('#opener');b.click(trigger);await b.flush();
  b.click(b.document.querySelector('.drawer-backdrop'));await b.flush();focused(b,trigger);
  b.click(trigger);b.run('closeDrawer()');await b.flush();focused(b,trigger);
});

test('drawer skips hidden, disabled, negative-tabindex and CSS-invisible controls dynamically',async()=>{
  const b=browser();b.click(b.document.querySelector('#opener'));await b.flush();
  const panel=b.document.querySelector('.drawer-panel'),close=panel.querySelector('[data-action="drawer-close"]'),last=panel.querySelector('[data-nx-install]');
  last.disabled=true;panel.querySelector('[data-nx-drawer-theme]').tabIndex=-1;
  const links=panel.querySelectorAll('a[href]');links.at(-1).hidden=true;links.at(-2).style.setProperty('display','none');
  close.focus();b.key('Tab',true);focused(b,links.at(-3));
});

test('hidden or removed drawer releases containment and does not focus a disconnected trigger',async()=>{
  for(const removed of [false,true]){
    const b=browser(),trigger=b.document.querySelector('#opener');b.click(trigger);await b.flush();trigger.remove();
    const drawer=b.document.querySelector('#drawer');removed?drawer.remove():drawer.hidden=true;await b.flush();
    const outside=b.document.querySelector('#outside');outside.focus();focused(b,outside);assert.equal(b.key('Tab').defaultPrevented,false);
  }
});

test('search keeps its existing focus/return behavior when opened from the drawer',async()=>{
  const b=browser();b.click(b.document.querySelector('#opener'));await b.flush();const trigger=b.document.querySelector('[data-nx-drawer-search]');
  // Auth normally reveals these tools; use the actual control once visible.
  trigger.closest('[hidden]').hidden=false;trigger.focus();b.run('openSearch(document.activeElement)');await b.flush();
  assert.equal(b.document.querySelector('#drawer').hidden,true);focused(b,b.document.querySelector('#searchInput'));
  b.run('closeSearch()');assert.equal(b.document.querySelector('#searchOverlay').hidden,true);assert.equal(b.key('Tab').defaultPrevented,false);
});

test('administrative dialog focuses the reason, wraps boundaries and contains outside focus',async()=>{
  const b=browser(),trigger=b.document.querySelector('#outside');trigger.focus();const result=b.window.fixtureDecisionDialog({title:'Fixture',text:'Fixture'});await b.flush();
  const form=b.document.querySelector('.nx54-dialog'),first=form.querySelector('[data-dialog-cancel]'),last=form.querySelector('[type="submit"]');
  focused(b,form.elements.reason);first.focus();b.key('Tab',true);focused(b,last);b.key('Tab');focused(b,first);
  trigger.focus();assert.equal(form.contains(b.document.activeElement),true);b.key('Escape');assert.equal(await result,null);focused(b,trigger);
});

test('administrative reason validation, valid submit and backdrop cancellation are preserved',async()=>{
  const b=browser(),trigger=b.document.querySelector('#outside');trigger.focus();
  const result=b.window.fixtureDecisionDialog({title:'Fixture',text:'Fixture',role:true,currentRole:'user',suspension:true});await b.flush();const form=b.document.querySelector('.nx54-dialog');
  form.elements.reason.value='x';form.onsubmit({preventDefault(){}});assert.ok(form.isConnected);assert.match(form.querySelector('[role="alert"]').textContent,/3 caracteres/);
  form.elements.reason.value='  Justificativa fixture  ';form.elements.role.value='moderator';form.elements.duration.value='168';form.onsubmit({preventDefault(){}});
  assert.deepEqual(JSON.parse(JSON.stringify(await result)),{reason:'Justificativa fixture',role:'moderator',hours:168});focused(b,trigger);
  const canceled=b.window.fixtureDecisionDialog({title:'Fixture',text:'Fixture'});b.click(b.document.querySelector('.nx54-dialog-backdrop'));assert.equal(await canceled,null);
});

test('administrative removal or route departure cancels without leaving a focus trap',async()=>{
  for(const removed of [false,true]){
    const b=browser();const result=b.window.fixtureDecisionDialog({title:'Fixture',text:'Fixture'});await b.flush();
    if(removed)b.document.querySelector('.nx54-dialog-layer').remove();else{b.location.href='https://fixture.test/noticias';b.location.pathname='/noticias';b.emit('aninexus:route-changed');}
    await b.flush();assert.equal(b.document.querySelector('.nx54-dialog-layer')===null,true);
    assert.equal(await result,null);const outside=b.document.querySelector('#outside');outside.focus();focused(b,outside);assert.equal(b.key('Tab').defaultPrevented,false);
  }
});

test('nested managed scopes preserve the upper owner and restore the lower scope',async()=>{
  const b=browser();assert.equal(typeof b.runtime.containFocus,'function');
  const outer=b.document.createElement('div');outer.innerHTML='<button id="outer-first">First</button><button id="inner-opener">Nested</button>';b.document.body.append(outer);
  const releaseOuter=b.runtime.containFocus(outer,{owner:'outer',returnFocus:b.document.querySelector('#outside')});outer.querySelector('#inner-opener').focus();
  const inner=b.document.createElement('div');inner.innerHTML='<button id="inner-first">First</button><button id="inner-last">Last</button>';b.document.body.append(inner);
  const releaseInner=b.runtime.containFocus(inner,{owner:'inner'});b.key('Tab',true);focused(b,inner.querySelector('#inner-last'));
  releaseInner();focused(b,outer.querySelector('#inner-opener'));releaseOuter();focused(b,b.document.querySelector('#outside'));
});

test('existing external dialogs keep their own focus handler and normal controls work after release',async()=>{
  const b=browser();b.click(b.document.querySelector('#opener'));await b.flush();
  const external=b.document.createElement('div');external.setAttribute('aria-modal','true');external.innerHTML='<button id="external-first">Close</button><button id="external-last">Save</button>';b.document.body.append(external);
  let handled=0;external.addEventListener('keydown',e=>{if(e.key==='Tab'){handled++;e.preventDefault();external.querySelector('#external-last').focus();}});
  external.querySelector('#external-first').focus();b.key('Tab');assert.equal(handled,1);focused(b,external.querySelector('#external-last'));
  external.remove();await b.flush();b.run('closeDrawer()');const outside=b.document.querySelector('#outside');outside.focus();focused(b,outside);assert.equal(b.key('Tab').defaultPrevented,false);
});

test('a stale drawer opening frame cannot close or own a subsequent opening',async()=>{
  const b=browser(),trigger=b.document.querySelector('#opener');b.click(trigger);b.run('closeDrawer()');b.click(trigger);await b.flush();
  assert.equal(b.document.querySelector('#drawer').hidden,false);assert.equal(b.document.querySelector('.drawer-panel').contains(b.document.activeElement),true);
  b.key('Escape');focused(b,trigger);
});

test('Escape closes only the upper administrative decision over an open drawer',async()=>{
  const b=browser();b.click(b.document.querySelector('#opener'));await b.flush();const parentControl=b.document.activeElement;
  const result=b.window.fixtureDecisionDialog({title:'Fixture',text:'Fixture'});await b.flush();b.key('Escape');
  assert.equal(await result,null);assert.equal(b.document.querySelector('#drawer').hidden,false);focused(b,parentControl);
  b.key('Escape');assert.equal(b.document.querySelector('#drawer').hidden,true);focused(b,b.document.querySelector('#opener'));
});

test('empty scopes stay keyboard reachable and restore only the temporary tabindex',async()=>{
  const b=browser(),root=b.document.createElement('div');b.document.body.append(root);
  const release=b.runtime.containFocus(root);focused(b,root);assert.equal(root.tabIndex,-1);assert.equal(b.key('Tab').defaultPrevented,true);
  release();assert.equal(root.hasAttribute('tabindex'),false);
  root.tabIndex=-2;const again=b.runtime.containFocus(root);again();assert.equal(root.tabIndex,-2);
});

test('disabled fieldsets and hidden ancestors do not enter the keyboard sequence',async()=>{
  const b=browser(),root=b.document.createElement('div');root.innerHTML='<button id="first">First</button><fieldset disabled><input id="disabled-child"></fieldset><div hidden><button>Hidden</button></div><div aria-hidden="true"><button>Hidden to accessibility</button></div><button id="last">Last</button>';b.document.body.append(root);
  const release=b.runtime.containFocus(root);b.key('Tab',true);focused(b,root.querySelector('#last'));
  root.querySelector('#last').disabled=true;await b.flush();focused(b,root.querySelector('#first'));release();
});

test('a new administrative decision cancels the previous owner without leaking listeners',async()=>{
  const b=browser(),trigger=b.document.querySelector('#outside');trigger.focus();const first=b.window.fixtureDecisionDialog({title:'First',text:'Fixture'});
  const second=b.window.fixtureDecisionDialog({title:'Second',text:'Fixture'});await b.flush();assert.equal(b.document.querySelectorAll('.nx54-dialog-layer').length,1);assert.equal(await first,null);
  b.key('Escape');assert.equal(await second,null);focused(b,trigger);assert.equal(b.key('Tab').defaultPrevented,false);
});
