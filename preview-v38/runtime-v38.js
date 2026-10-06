'use strict';
(() => {
  if(window.__NX38_RUNTIME__)return;window.__NX38_RUNTIME__=true;
  window.__NX38_BOOT_AT=performance.now();
  const IS_PAGES=location.hostname.endsWith('github.io');
  const ANILIST='https://graphql.anilist.co';
  const nativeFetch=window.fetch.bind(window);
  const makeNavigationId=()=>globalThis.crypto?.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
  const navigationId=()=>window.__NX_NAVIGATION_ID__||(window.__NX_NAVIGATION_ID__=makeNavigationId());
  const renewNavigationId=()=>window.__NX_NAVIGATION_ID__=makeNavigationId();
  const clientRelease=()=>String(window.document?.querySelector?.('meta[name="aninexus-build"]')?.content||'').slice(0,80);
  const correlationHeaders=()=>({'x-aninexus-navigation-id':navigationId(),...(clientRelease()?{'x-aninexus-client-release':clientRelease()}: {})});

  const deadlineError=(category,label)=>Object.assign(new Error(category==='timeout'?`${label} excedeu o tempo limite`:`${label} foi cancelada`),{
    name:category==='timeout'?'TimeoutError':'AbortError',
    code:category==='timeout'?'REQUEST_TIMEOUT':'REQUEST_CANCELLED',
    category
  });
  const abortableDelay=(milliseconds,signal)=>new Promise((resolve,reject)=>{
    if(signal?.aborted)return reject(deadlineError('navigation','Espera'));
    const timer=setTimeout(done,Math.max(0,Number(milliseconds)||0));
    function done(){signal?.removeEventListener('abort',cancel);resolve()}
    function cancel(){clearTimeout(timer);signal?.removeEventListener('abort',cancel);reject(deadlineError('navigation','Espera'))}
    signal?.addEventListener('abort',cancel,{once:true});
  });
  async function withDeadline(task,{timeout=12000,signal,label='Operação'}={}){
    const controller=new AbortController();
    let category='',timer=0,removeExternal=()=>{};
    const cancel=()=>{if(category)return;category='navigation';controller.abort(signal?.reason)};
    if(signal?.aborted)cancel();
    else if(signal){signal.addEventListener('abort',cancel,{once:true});removeExternal=()=>signal.removeEventListener('abort',cancel)}
    if(!category)timer=setTimeout(()=>{if(category)return;category='timeout';controller.abort()},Math.max(1,Number(timeout)||12000));
    const interrupted=controller.signal.aborted?Promise.reject(deadlineError(category||'navigation',label)):new Promise((_,reject)=>controller.signal.addEventListener('abort',()=>reject(deadlineError(category||'navigation',label)),{once:true}));
    try{return await Promise.race([Promise.resolve().then(()=>task(controller.signal)),interrupted])}
    finally{if(timer)clearTimeout(timer);removeExternal()}
  }
  async function jsonRequest(input,init={},options={}){
    return withDeadline(async signal=>{
      const target=new URL(typeof input==='string'?input:input?.url||String(input),location.href);
      const headers={...(init.headers||{}),...(target.origin===location.origin?correlationHeaders(): {})};
      const response=await window.fetch(input,{...init,headers,signal});
      if(response.status===204)return{response,body:null};
      let body={};
      try{body=await response.json()}
      catch(error){if(response.ok)throw Object.assign(new Error('Resposta JSON inválida'),{name:'DataError',code:'INVALID_RESPONSE',category:'data',cause:error})}
      return{response,body};
    },{...options,signal:options.signal||init.signal});
  }
  const focusScopes=[];
  let focusObserver=null,redirectingFocus=false;
  const focusVisible=node=>!!(node?.isConnected&&!node.closest('[hidden],[inert],[aria-hidden="true"]')&&node.getClientRects().length&&!['hidden','collapse'].includes(getComputedStyle(node).visibility));
  const focusEnabled=node=>focusVisible(node)&&!node.matches(':disabled')&&node.getAttribute('type')!=='hidden';
  const focusControls=root=>[...root.querySelectorAll('a[href],area[href],button,input,select,textarea,iframe,object,embed,[contenteditable="true"],[tabindex]')]
    .filter(node=>focusEnabled(node)&&node.tabIndex>=0)
    .sort((a,b)=>(a.tabIndex>0?a.tabIndex:Infinity)-(b.tabIndex>0?b.tabIndex:Infinity));
  function focusTarget(scope,backwards=false){
    const requested=typeof scope.initialFocus==='function'?scope.initialFocus():scope.initialFocus;
    const controls=focusControls(scope.root);
    if(backwards)return controls.at(-1)||scope.root;
    return [scope.lastFocus,requested,...controls].find(node=>scope.root.contains(node)&&focusEnabled(node))||scope.root;
  }
  function moveFocus(scope,target=focusTarget(scope)){
    if(!target||redirectingFocus)return;
    if(target===scope.root&&!target.hasAttribute('tabindex')){target.tabIndex=-1;scope.addedTabIndex=true;}
    redirectingFocus=true;
    try{target.focus({preventScroll:true});}finally{redirectingFocus=false;}
    scope.lastFocus=document.activeElement;
  }
  function currentFocusScope(){
    for(const scope of [...focusScopes]){
      const active=scope.isActive();
      if(!active||!focusVisible(scope.root))scope.release({restore:active,reason:'inactive'});
      if(scope.foreign&&!focusVisible(scope.foreign))scope.foreign=null;
    }
    return focusScopes.at(-1);
  }
  function foreignFocus(scope,target){
    if(scope.foreign&&focusVisible(scope.foreign))return true;
    if(scope.root.contains(target))return false;
    const modal=target?.closest?.('[aria-modal="true"],dialog[open]');
    if(modal&&!scope.root.contains(modal)&&!modal.contains(scope.root)&&focusVisible(modal)){scope.foreign=modal;return true;}
    return false;
  }
  function onContainedFocus(event){
    if(redirectingFocus)return;
    const scope=currentFocusScope();if(!scope||foreignFocus(scope,event.target))return;
    if(scope.root.contains(event.target)){scope.lastFocus=event.target;return;}
    moveFocus(scope);
  }
  function onContainedKey(event){
    const scope=currentFocusScope();if(!scope||foreignFocus(scope,event.target))return;
    if(event.key==='Escape'&&scope.onEscape){event.preventDefault();event.stopPropagation();scope.onEscape();return;}
    if(event.key!=='Tab'||event.defaultPrevented)return;
    const controls=focusControls(scope.root),index=controls.indexOf(document.activeElement);
    if(!controls.length||index<0||(!event.shiftKey&&index===controls.length-1)||(event.shiftKey&&index===0)){
      event.preventDefault();moveFocus(scope,event.shiftKey?controls.at(-1)||scope.root:controls[0]||scope.root);
    }
  }
  function reconcileFocus(){
    const scope=currentFocusScope();
    if(scope&&!foreignFocus(scope,document.activeElement)&&(!scope.root.contains(document.activeElement)||!focusEnabled(document.activeElement)))moveFocus(scope);
  }
  function containFocus(root,{owner=root,initialFocus,returnFocus=document.activeElement,onEscape,onRelease,isActive=()=>true}={}){
    for(const scope of [...focusScopes])if(scope.owner===owner)scope.release({restore:false,reason:'superseded'});
    const scope={root,owner,initialFocus,returnFocus,onEscape,isActive,lastFocus:null,foreign:null,addedTabIndex:false,released:false};
    scope.release=({restore=true,reason='closed'}={})=>{
      if(scope.released)return;scope.released=true;
      const top=focusScopes.at(-1)===scope;
      focusScopes.splice(focusScopes.indexOf(scope),1);
      if(scope.addedTabIndex&&root.getAttribute('tabindex')==='-1')root.removeAttribute('tabindex');
      if(!focusScopes.length){
        document.removeEventListener('keydown',onContainedKey,true);document.removeEventListener('focusin',onContainedFocus,true);
        for(const name of ['popstate','aninexus:route-changed','resize'])removeEventListener(name,reconcileFocus);
        focusObserver?.disconnect();focusObserver=null;
      }
      onRelease?.(reason);
      if(restore&&top){
        const next=focusScopes.at(-1);
        if(focusEnabled(returnFocus)&&(!next||next.root.contains(returnFocus)))returnFocus.focus({preventScroll:true});
        else if(next)moveFocus(next);
      }
    };
    if(!focusScopes.length){
      document.addEventListener('keydown',onContainedKey,true);document.addEventListener('focusin',onContainedFocus,true);
      for(const name of ['popstate','aninexus:route-changed','resize'])addEventListener(name,reconcileFocus);
      focusObserver=new MutationObserver(reconcileFocus);
      focusObserver.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','inert','aria-hidden','style','class','disabled','tabindex']});
    }
    focusScopes.push(scope);
    if(!isActive()||!focusVisible(root))scope.release({restore:false,reason:'inactive'});
    else moveFocus(scope);
    return scope.release;
  }
  window.AniNexusRuntime=Object.freeze({withDeadline,jsonRequest,abortableDelay,deadlineError,navigationId,renewNavigationId,correlationHeaders,containFocus});
  // One semantic icon vocabulary for both notification surfaces. Never insert
  // server-provided markup: the returned SVG is selected from this fixed map.
  const uiPaths={
    play:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3Z"/>',
    news:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h3M8 15h8M8 18h8"/>',
    people:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v2"/>',
    bell:'<path d="M6 9a6 6 0 0 1 12 0c0 6 2 6 2 8H4c0-2 2-2 2-8M10 21h4"/>',
    trophy:'<path d="M8 3h8v6a4 4 0 0 1-8 0ZM8 5H4v2a4 4 0 0 0 4 4M16 5h4v2a4 4 0 0 1-4 4M12 13v5M8 21h8M9 18h6"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 11h18M8 15h2M14 15h2"/>',
    branch:'<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M6 7v10M18 7a8 8 0 0 1-8 8H6"/>',
    volume:'<path d="m11 4-6 5H2v6h3l6 5ZM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>',
  };
  const notification=item=>{
    const kind=String(item?.kind||'SYSTEM').toUpperCase(),href=String(item?.href||item?.url||'');
    const map={EPISODE:['Novo episódio','play'],NEWS:['Notícia','news'],COMMUNITY:['Comunidade','people'],SYSTEM:['AniNexus','bell'],ACHIEVEMENT:['Conquista','trophy'],SCHEDULE:['Programação','calendar'],DELAY:['Mudança de horário','calendar'],FRANCHISE:['Franquia','branch'],DUBBING:['Dublagem','volume'],AVAILABILITY:['Onde assistir','play']};
    const [label,icon]=kind==='SYSTEM'&&/^\/conquistas(?:[?#]|$)/.test(href)?map.ACHIEVEMENT:(map[kind]||map.SYSTEM);
    return{label,icon,svg:`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${uiPaths[icon]}</svg>`};
  };
  window.AniNexusUI=Object.freeze({notification});
  addEventListener('popstate',renewNavigationId);

  // Production uses shared AniNexus read models (edge cache + Redis + stale fallback)
  // instead of repeating identical AniList GraphQL requests in every browser.
  if(!IS_PAGES){
    const toGraph=m=>{
      if(!m)return m;
      if(m.coverImage&&typeof m.title==='object')return m;
      const internal=m.metricsSource==='aninexus',n=internal?Number(m.score):NaN,mean=internal?Number(m.meanScore):NaN,averageScore=Number.isFinite(n)?Math.round(n*10):null,meanScore=Number.isFinite(mean)?Math.round(mean*10):averageScore;
      return{
        id:m.id,idMal:m.idMal||null,
        title:{english:m.title||'',romaji:m.titleRomaji||m.title||'',native:m.titleNative||'',userPreferred:m.title||m.titleRomaji||''},synonyms:m.synonyms||[],
        coverImage:{extraLarge:m.cover||'',large:m.cover||'',color:m.coverColor||null},bannerImage:m.banner||'',description:m.description||'',genres:m.genres||[],
        tags:(m.tagDetails||m.tags||[]).map(x=>typeof x==='string'?{name:x,rank:0,isMediaSpoiler:false}:x),averageScore,meanScore,popularity:internal?Number(m.popularity||0):0,favourites:internal?Number(m.favourites||0):0,
        episodes:m.episodes||null,chapters:m.chapters||null,volumes:m.volumes||null,duration:m.duration||null,format:m.format||'',status:m.status||'',season:m.season||'',seasonYear:m.seasonYear||null,countryOfOrigin:m.country||'',source:m.source||'',startDate:m.startDate||null,endDate:m.endDate||null,
        ratingCount:Number(m.ratingCount||0),listCount:Number(m.listCount||0),metricsSource:m.metricsSource==='aninexus'?'aninexus':'',contentProvider:m.contentProvider||'',contentProviderUrl:m.contentProviderUrl||'',
        studios:{nodes:m.studios||[]},nextAiringEpisode:m.nextAiringEpisode||null,trailer:m.trailer||null,
        relations:{edges:(m.relationTypes||[]).map(relationType=>({relationType}))},
        externalLinks:(m.streaming||m.externalLinks||[]).map(x=>({site:x.site||'',url:x.url||'',type:x.type||'STREAMING',icon:x.icon||'',color:x.color||''}))
      };
    };
    const person=(x,staff=false)=>({role:x.role||'',node:{id:x.id,name:{full:x.name||'',native:x.native||''},image:{large:x.image||'',medium:x.image||''}},...(staff?{}:{})});
    const toDeep=m=>{const base=toGraph(m);return{...base,characters:{edges:(m.characters||[]).map(x=>person(x))},staff:{edges:(m.staff||[]).map(x=>person(x,true))},relations:{edges:(m.relations||[]).map(x=>({relationType:x.relationType,node:toGraph(x.media)}))},recommendations:{nodes:(m.recommendations||[]).map(x=>({rating:x.rating,mediaRecommendation:toGraph(x.media)})).filter(x=>x.mediaRecommendation)}}};
    const jsonResponse=data=>new Response(JSON.stringify({data}),{status:200,headers:{'content-type':'application/json; charset=utf-8','x-aninexus-bridge':'v38'}});
    const apiJson=async(path,signal)=>{const r=await nativeFetch(path,{signal,credentials:'same-origin',headers:{accept:'application/json',...correlationHeaders()}});if(!r.ok)throw new Error(`AniNexus API ${r.status}`);return r.json()};
    const seasonNow=()=>{const d=new Date(),m=Number(new Intl.DateTimeFormat('en',{timeZone:'America/Sao_Paulo',month:'numeric'}).format(d)),year=Number(new Intl.DateTimeFormat('en',{timeZone:'America/Sao_Paulo',year:'numeric'}).format(d));return{year,season:m<=3?'WINTER':m<=6?'SPRING':m<=9?'SUMMER':'FALL'}};
    const bridgeHome=async(body,signal)=>{
      const vars=body.variables||{},s=seasonNow(),season=vars.season||s.season,year=Number(vars.year||s.year),home=await apiJson(`/api/home?season=${encodeURIComponent(season)}&year=${year}&compact=1`,signal);
      if(!(home.season||[]).length)throw new Error('AniNexus API returned an incomplete Home');
      return jsonResponse({season:{media:(home.season||[]).map(toGraph)},schedule:{airingSchedules:(home.schedule||[]).slice(0,8).map(x=>({airingAt:x.airingAt,episode:x.episode,media:toGraph(x.media)}))},top:{media:(home.top||[]).map(toGraph)},popular:{media:(home.popular||[]).map(toGraph)},soon:{media:(home.soon||[]).map(toGraph)},reading:{media:(home.reading||[]).map(toGraph)},topReading:{media:(home.topReading||[]).map(toGraph)}});
    };
    const mapSort=(q,v={})=>['DISCOVER','POPULAR','SCORE','TRENDING','NEW','TITLE','FAVOURITES','MATCH'].includes(String(v.nxSort||'').toUpperCase())?String(v.nxSort).toUpperCase():q.includes('SEARCH_MATCH')?'MATCH':q.includes('TITLE_ROMAJI')?'TITLE':q.includes('START_DATE_DESC')?'NEW':'POPULAR';
    const bridgePage=async(body,signal,type)=>{
      const q=String(body.query||''),v=body.variables||{},params=new URLSearchParams({page:String(v.page||1),perPage:String(v.perPage||24),sort:mapSort(q,v)});
      for(const k of ['search','genre','format','season','year','status'])if(v[k]!=null&&v[k]!=='')params.set(k,String(v[k]));
      if(q.includes('status:NOT_YET_RELEASED'))params.set('status','NOT_YET_RELEASED');
      if(q.includes('status:RELEASING'))params.set('status','RELEASING');
      const endpoint=type==='MANGA'?'/api/reading':'/api/catalog',data=await apiJson(`${endpoint}?${params}`,signal);
      if(Number(v.page||1)===1&&!(data.items||[]).length)throw new Error('AniNexus API returned an empty catalog');
      return jsonResponse({Page:{pageInfo:data.pageInfo||{},media:(data.items||[]).map(toGraph)}});
    };
    const bridgeDetail=async(body,signal,type)=>{
      const id=Number(body.variables?.id||0);if(!Number.isSafeInteger(id)||id<=0)return null;
      const m=await apiJson(type==='MANGA'?`/api/manga/${id}`:`/api/anime/${id}`,signal);
      if(!m||Number(m.id)!==id||(m.mediaType&&String(m.mediaType).toUpperCase()!==type))throw new Error('AniNexus API returned an invalid detail');
      const deep=toDeep(m);
      // Full queries also request characters. Returning only that subsection loses
      // the ID/title and leaves the shared detail renderer in its loading state.
      return jsonResponse({Media:deep});
    };
    window.fetch=async function(input,init={}){
      const target=typeof input==='string'?input:input?.url||String(input||''),method=String(init.method||input?.method||'GET').toUpperCase();
      if(target===ANILIST&&method==='POST'&&typeof init.body==='string'){
        let body;try{body=JSON.parse(init.body)}catch{return nativeFetch(input,init)}
        const q=String(body?.query||'');
        try{
          if(q.includes('season:Page')&&q.includes('schedule:Page')&&q.includes('reading:Page'))return await bridgeHome(body,init.signal);
          if(q.includes('Media(id:$id,type:ANIME)')){const r=await bridgeDetail(body,init.signal,'ANIME');if(r)return r}
          if(q.includes('Media(id:$id,type:MANGA)')){const r=await bridgeDetail(body,init.signal,'MANGA');if(r)return r}
          if(q.includes('Page(page:$page,perPage:$perPage)')&&q.includes('media(type:ANIME')&&!q.includes('airingSchedules'))return await bridgePage(body,init.signal,'ANIME');
          if(q.includes('Page(page:$page,perPage:$perPage)')&&q.includes('media(type:MANGA'))return await bridgePage(body,init.signal,'MANGA');
        }catch(err){console.warn('[AniNexus bridge] fallback to upstream:',err?.message||err)}
      }
      return nativeFetch(input,init);
    };
  }

  // Media fallback only. List/favorite state is owned exclusively by media-state-v2.js.
  const failedMediaHosts=new WeakMap();
  const avatarRetries=new WeakMap();
  const clearImageFailure=img=>{
    img.classList.remove('nx38-img-error');delete img.dataset.nx38Broken;
    const host=failedMediaHosts.get(img);failedMediaHosts.delete(img);
    if(host&&![...host.querySelectorAll('.nx38-img-error')].some(other=>failedMediaHosts.get(other)===host))host.classList.remove('nx38-media-fallback');
  };
  document.addEventListener('load',e=>{if(e.target instanceof HTMLImageElement)clearImageFailure(e.target)},true);
  document.addEventListener('error',e=>{
    const img=e.target;if(!(img instanceof HTMLImageElement))return;
    const failedSource=img.currentSrc||img.src,requestedSource=img.src;
    // Let component-specific handlers try another source before showing a placeholder.
    setTimeout(()=>{
      if(!img.isConnected||img.src!==requestedSource||img.naturalWidth||img.hidden)return;
      const avatarFallback=img.dataset.nxAvatarFallback;
      if(avatarFallback&&img.src!==new URL(avatarFallback,document.baseURI).href){
        const previous=avatarRetries.get(img),retry=previous?.source===requestedSource?previous:{source:requestedSource,attempts:0};
        avatarRetries.set(img,retry);
        clearImageFailure(img);img.removeAttribute('srcset');img.src=avatarFallback;
        const fallbackSource=img.src;
        // A brief CDN/network failure must not make the default avatar permanent.
        if(retry.attempts<2){retry.attempts+=1;setTimeout(()=>{if(img.isConnected&&img.src===fallbackSource&&avatarRetries.get(img)===retry)img.src=retry.source},retry.attempts===1?1500:4000)}
        return;
      }
      if((img.currentSrc||img.src)!==failedSource)return;
      img.dataset.nx38Broken='1';img.classList.add('nx38-img-error');
      const host=img.closest('.nx35-nmedia,.nx37-gallery-item,.nx24-card-poster,.aqx-media,.nx18-cover,.nx35-community-cover,.media,.poster,.nx21-poster,.nx22-cover,.nx22-hero-bg');
      // A nested avatar/provider logo must never mark its surrounding cover as broken.
      if(host&&(img.parentElement===host||(img.parentElement?.tagName==='A'&&img.parentElement.parentElement===host))){failedMediaHosts.set(img,host);host.classList.add('nx38-media-fallback')}
    },0);
  },true);

  const tune=root=>{
    if(root instanceof HTMLImageElement){if(!root.hasAttribute('decoding'))root.decoding='async';if(!root.hasAttribute('loading')&&!root.closest('.hero,.nx35-article-hero,.nx24-hero,.aqx-hero,.nx22-hero'))root.loading='lazy'}
    root.querySelectorAll?.('img').forEach(img=>{if(!img.hasAttribute('decoding'))img.decoding='async';if(!img.hasAttribute('loading')&&!img.closest('.hero,.nx35-article-hero,.nx24-hero,.aqx-hero,.nx22-hero'))img.loading='lazy'});
    root.querySelectorAll?.('a[target="_blank"]').forEach(a=>{const rel=new Set(String(a.rel||'').split(/\s+/).filter(Boolean));rel.add('noopener');rel.add('noreferrer');a.rel=[...rel].join(' ')})
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>tune(document),{once:true});else tune(document);
  new MutationObserver(rs=>{for(const r of rs)for(const n of r.addedNodes)if(n.nodeType===1)tune(n)}).observe(document.documentElement,{subtree:true,childList:true});

  const setOnline=()=>document.documentElement.classList.toggle('nx38-offline',!navigator.onLine);
  addEventListener('online',setOnline);addEventListener('offline',setOnline);setOnline();
  if(navigator.connection?.saveData)document.documentElement.classList.add('nx38-save-data');
})();
