'use strict';
(() => {
  const ROOT = document.querySelector('#app');
  if (!ROOT) return;
  const IS_PAGES_V8 = location.hostname.endsWith('github.io');
  const BASE_V8 = IS_PAGES_V8 ? '/AniNexus' : '';
  const ENDPOINT = 'https://graphql.anilist.co';
  const REFRESH_MS = 10 * 60 * 1000;
  const CACHE_TTL = 24 * 60 * 60 * 1000;
  const SEASONS = [
    {key:'WINTER',slug:'inverno',name:'Inverno',icon:'snow'},
    {key:'SPRING',slug:'primavera',name:'Primavera',icon:'flower'},
    {key:'SUMMER',slug:'verao',name:'Verão',icon:'sun'},
    {key:'FALL',slug:'outono',name:'Outono',icon:'leaf'},
  ];
  const MONTH_START={WINTER:1,SPRING:4,SUMMER:7,FALL:10};
  const GENRE_PT={Action:'Ação',Adventure:'Aventura',Comedy:'Comédia',Drama:'Drama',Fantasy:'Fantasia',Horror:'Terror',Mystery:'Mistério',Romance:'Romance','Sci-Fi':'Ficção Científica','Slice of Life':'Cotidiano',Sports:'Esportes',Supernatural:'Sobrenatural',Thriller:'Suspense',Psychological:'Psicológico',Music:'Música'};
  const TAG_PT={Shounen:'Shounen',Isekai:'Isekai',School:'Escola',Magic:'Magia',Seinen:'Seinen',Josei:'Josei',Shoujo:'Shoujo',Demons:'Demônios',Historical:'Histórico','Urban Fantasy':'Fantasia Urbana'};
  const TAG_PRIORITY=['Fantasy','Action','Romance','Comedy','Adventure','Drama','Shounen','Isekai','School','Sci-Fi','Slice of Life','Supernatural','Mystery','Magic','Psychological','Sports','Horror','Seinen','Shoujo','Historical'];
  const TYPES=[{key:'SERIE',label:'Série',formats:['TV','TV_SHORT']},{key:'MOVIE',label:'Filme',formats:['MOVIE']},{key:'SPECIAL',label:'Especial',formats:['SPECIAL','OVA']},{key:'ONA',label:'ONA',formats:['ONA']}];
  const ICON={
    snow:`<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M32 6v52M9 19l46 26M55 19 9 45M23 10l9 8 9-8M23 54l9-8 9 8M10 29l11 3-11 3M54 29l-11 3 11 3"/></g></svg>`,
    flower:`<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="32" r="5.5"/><path d="M32 26c-7-5-9-13-3-17 6-4 11 2 8 12 7-7 15-6 17 1 2 7-6 11-14 9 9 3 13 10 9 16-4 6-12 2-15-6 1 10-5 16-12 13-6-3-6-11 1-18-10 3-16-2-14-9 2-7 10-8 17-1"/></g></svg>`,
    sun:`<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 35c5-15 18-23 31-19 8 2 14 9 16 18-8-3-15-2-21 3-4-6-10-7-16-3-4-2-7-2-10 1Z"/><path d="m34 33-9 22M13 54h38M10 59h44"/></g></svg>`,
    leaf:`<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M48 9c-2 9 3 13 9 19-8 1-11 5-13 11-6-3-10-2-14 3-4-5-9-6-15-4 2-7-1-12-8-15 7-4 9-8 9-15 7 3 12 1 16-5 4 6 9 8 16 6Z"/><path d="M11 54c11-15 24-26 39-35"/></g></svg>`,
    tag:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 12.5 12 4h7.5v7.5L11 20l-7.5-7.5Z"/><circle cx="16.1" cy="7.9" r="1.3"/></svg>`,
    type:`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M7 4v4M17 4v4M3.5 9h17"/><path d="m10 12 5 3-5 3v-6Z"/></svg>`,
    star:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/></svg>`,
    plus:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`,
    heart:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.6 8.8c0 5-8.6 10-8.6 10s-8.6-5-8.6-10A4.6 4.6 0 0 1 12 6.4a4.6 4.6 0 0 1 8.6 2.4Z"/></svg>`,
    chevron:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9 5 5 5-5"/></svg>`
  };

  let filter={tag:null,type:null};
  let currentPayload=null;
  let controller=null;
  let token=0;
  let refreshTimer=null;

  function pathNowV8(){try{if(typeof pathNow==='function')return pathNow()}catch{}let p=location.pathname;if(IS_PAGES_V8)p=p.replace(/^\/AniNexus/,'')||'/';return p.replace(/\/+$/,'')||'/'}
  function isSeasonPath(p=pathNowV8()){return /^\/animes\/temporadas(?:\/\d{4}\/(?:inverno|primavera|verao|outono))?$/.test(p)}
  function nowSeason(){const d=new Date(),month=+new Intl.DateTimeFormat('en',{timeZone:'America/Sao_Paulo',month:'numeric'}).format(d),year=+new Intl.DateTimeFormat('en',{timeZone:'America/Sao_Paulo',year:'numeric'}).format(d);return{year,season:month<=3?'WINTER':month<=6?'SPRING':month<=9?'SUMMER':'FALL'}}
  function selectionFromPath(){const m=pathNowV8().match(/^\/animes\/temporadas\/(\d{4})\/(inverno|primavera|verao|outono)$/);if(m)return{year:+m[1],season:SEASONS.find(s=>s.slug===m[2])?.key||'SUMMER'};return nowSeason()}
  function routeFor(year,season){return`/animes/temporadas/${year}/${SEASONS.find(s=>s.key===season)?.slug||'verao'}`}
  function setRoute(path,replace=false){history[replace?'replaceState':'pushState']({},'',BASE_V8+path)}
  function seasonMeta(k){return SEASONS.find(s=>s.key===k)||SEASONS[2]}
  function esc8(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function slug8(v='anime'){return String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,90)}
  function title8(m){return m?.title?.english||m?.title?.userPreferred||m?.title?.romaji||m?.title?.native||'Anime'}
  function image8(m){return m?.coverImage?.extraLarge||m?.coverImage?.large||''}
  function score8(m){return m?.averageScore?String((m.averageScore/10).toFixed(1)).replace('.0',''):''}
  function continuation(m){return(m.relations?.edges||[]).some(e=>e.relationType==='PREQUEL')||/\b(?:season|part|2nd|3rd|4th|5th|6th|II|III|IV)\b/i.test(m.title?.romaji||'')}
  function sameSelection(a,b){return a.year===b.year&&a.season===b.season}
  function cacheKey(s){return`aninexus:season:v8:${s.year}:${s.season}`}
  function getCache(s){try{const v=JSON.parse(localStorage.getItem(cacheKey(s))||'null');if(!v||!Array.isArray(v.items))return null;return v}catch{return null}}
  function setCache(s,payload){try{const k=cacheKey(s),idx=JSON.parse(localStorage.getItem('aninexus:season:v8:index')||'[]').filter(x=>x.k!==k);idx.unshift({k,t:Date.now()});while(idx.length>8){const old=idx.pop();localStorage.removeItem(old.k)}localStorage.setItem(k,JSON.stringify({...payload,cachedAt:Date.now()}));localStorage.setItem('aninexus:season:v8:index',JSON.stringify(idx))}catch{}}
  function readSet(k){try{return new Set((JSON.parse(localStorage.getItem(k)||'[]')||[]).map(v=>typeof v==='object'?v.id:v))}catch{return new Set()}}
  function writeSet(k,s){try{localStorage.setItem(k,JSON.stringify([...s]))}catch{}}
  function sleep(ms,signal){return new Promise((resolve,reject)=>{const t=setTimeout(resolve,ms);signal?.addEventListener('abort',()=>{clearTimeout(t);reject(new DOMException('Aborted','AbortError'))},{once:true})})}

  async function requestGraphQL(query,variables,signal,retries=2){
    let last;
    for(let attempt=0;attempt<=retries;attempt++){
      const local=new AbortController();
      const timer=setTimeout(()=>local.abort(),12000);
      const abort=()=>local.abort(); signal?.addEventListener('abort',abort,{once:true});
      try{
        const r=await fetch(ENDPOINT,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({query,variables}),signal:local.signal});
        if(r.status===429||r.status>=500){last=new Error('HTTP '+r.status);const wait=Math.min(1800,500*(attempt+1));if(attempt<retries){clearTimeout(timer);signal?.removeEventListener('abort',abort);await sleep(wait,signal);continue}}
        if(!r.ok)throw new Error('HTTP '+r.status);
        const j=await r.json();if(j.errors?.length)throw new Error(j.errors[0]?.message||'Falha na consulta');return j.data;
      }catch(e){last=e;if(e?.name==='AbortError'&&signal?.aborted)throw e;if(attempt>=retries)throw e;await sleep(450*(attempt+1),signal)}
      finally{clearTimeout(timer);signal?.removeEventListener('abort',abort)}
    }
    throw last||new Error('Falha');
  }

  const SEASON_FIELDS=`id title{romaji english native userPreferred} coverImage{extraLarge large color} averageScore popularity favourites format status genres tags{name rank} startDate{year month day} relations{edges{relationType}} nextAiringEpisode{airingAt episode}`;
  async function fetchSeasonPage(sel,page,signal){const q=`query($page:Int,$year:Int,$season:MediaSeason){Page(page:$page,perPage:50){pageInfo{total currentPage lastPage hasNextPage}media(type:ANIME,isAdult:false,seasonYear:$year,season:$season,sort:[POPULARITY_DESC]){${SEASON_FIELDS}}}}`;return(await requestGraphQL(q,{page,year:sel.year,season:sel.season},signal)).Page}
  async function fetchStill(signal){const q=`query{Page(page:1,perPage:30){media(type:ANIME,isAdult:false,status:RELEASING,sort:[POPULARITY_DESC]){${SEASON_FIELDS}}}}`;return(await requestGraphQL(q,{},signal,1)).Page?.media||[]}
  function uniq(items){return[...new Map(items.map(m=>[m.id,m])).values()]}

  function tagRows(items){const c=new Map();for(const m of items){const seen=new Set([...(m.genres||[]),...(m.tags||[]).filter(t=>(t.rank||0)>=40).map(t=>t.name)]);for(const x of seen)if(TAG_PRIORITY.includes(x))c.set(x,(c.get(x)||0)+1)}return[...c.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12).map(([key,count])=>({key,label:GENRE_PT[key]||TAG_PT[key]||key,count}))}
  function typeRows(items){return TYPES.map(x=>({...x,count:items.filter(m=>x.formats.includes(m.format)).length})).filter(x=>x.count)}
  function matches(m){if(filter.tag){const all=[...(m.genres||[]),...(m.tags||[]).map(t=>t.name)];if(!all.includes(filter.tag))return false}if(filter.type){const g=TYPES.find(x=>x.key===filter.type);if(g&&!g.formats.includes(m.format))return false}return true}

  function controls(sel,tags,types){const years=Array.from({length:new Date().getFullYear()+2-1960},(_,i)=>new Date().getFullYear()+1-i),tag=tags.find(x=>x.key===filter.tag),type=types.find(x=>x.key===filter.type);return`<div class="season-v8-controls"><div class="season-v8-control-row"><div class="season-v8-segment">${SEASONS.map(s=>`<button type="button" class="${s.key===sel.season?'active':''}" data-v8-season="${s.key}">${s.name}</button>`).join('')}</div><div class="season-v8-dropwrap year"><button class="season-v8-pill" type="button" data-v8-toggle="year" aria-expanded="false"><b>${sel.year}</b>${ICON.chevron}</button><div class="season-v8-dropdown year-menu" data-v8-menu="year" hidden>${years.map(y=>`<button type="button" class="${y===sel.year?'active':''}" data-v8-year="${y}">${y}</button>`).join('')}</div></div></div><div class="season-v8-filter-row"><div class="season-v8-dropwrap"><button class="season-v8-pill ${filter.tag?'selected':''}" type="button" data-v8-toggle="tag" aria-expanded="false">${ICON.tag}<b>${esc8(tag?.label||'Tags')}</b>${ICON.chevron}</button><div class="season-v8-dropdown tag-menu" data-v8-menu="tag" hidden>${tags.map(x=>`<button type="button" class="${x.key===filter.tag?'active':''}" data-v8-tag="${esc8(x.key)}"><span>${esc8(x.label)}</span><small>${x.count}</small></button>`).join('')}</div></div><div class="season-v8-dropwrap"><button class="season-v8-pill ${filter.type?'selected':''}" type="button" data-v8-toggle="type" aria-expanded="false">${ICON.type}<b>${esc8(type?.label||'Tipo')}</b>${ICON.chevron}</button><div class="season-v8-dropdown type-menu" data-v8-menu="type" hidden>${types.map(x=>`<button type="button" class="${x.key===filter.type?'active':''}" data-v8-type="${x.key}"><span>${x.label}</span><small>${x.count}</small></button>`).join('')}</div></div></div></div>`}
  function card(m,i){const liked=readSet('aninexus:favorites').has(m.id),listed=readSet('aninexus:list').has(m.id),sc=score8(m);return`<article class="season-v8-card" data-v8-media="${m.id}" tabindex="0" style="--delay:${Math.min(i,16)*18}ms"><div class="season-v8-poster"><img loading="lazy" decoding="async" src="${esc8(image8(m))}" alt="${esc8(title8(m))}"><div class="season-v8-fade"></div>${sc?`<span class="season-v8-score">${ICON.star}<b>${sc}</b></span>`:''}<div class="season-v8-actions"><button type="button" class="${listed?'active':''}" data-v8-list="${m.id}" aria-label="Adicionar à lista">${ICON.plus}</button><button type="button" class="${liked?'active':''}" data-v8-fav="${m.id}" aria-label="Favoritar">${ICON.heart}</button></div></div><h3>${esc8(title8(m))}</h3></article>`}
  function stillSection(items){if(!items?.length)return'';return`<section class="season-v8-still"><div class="season-v8-section-head"><h2>Ainda no ar</h2><p>Começaram antes e seguem em exibição.</p></div><div class="season-v8-rail">${items.slice(0,16).map(m=>`<article data-v8-media="${m.id}" tabindex="0"><div><img loading="lazy" decoding="async" src="${esc8(image8(m))}" alt="${esc8(title8(m))}">${score8(m)?`<span>${ICON.star}${score8(m)}</span>`:''}</div><strong>${esc8(title8(m))}</strong></article>`).join('')}</div></section>`}

  function hero(sel,payload){const meta=seasonMeta(sel.season),items=payload?.items||[],total=payload?.total??items.length,seq=payload?.complete?items.filter(continuation).length:null,first=seq==null?null:Math.max(0,total-seq),tags=tagRows(items),types=typeRows(items);return`<div class="season-v8-hero"><div class="season-v8-shell"><div class="season-v8-title"><span class="season-v8-season-icon">${ICON[meta.icon]}</span><div><h1>${meta.name} <em>${sel.year}</em></h1><p>TEMPORADA DE ANIMES</p></div></div><div class="season-v8-stats"><div><strong>${total||'—'}</strong><span>ANIMES</span></div><div><strong>${first==null?'…':first}</strong><span>ESTREIAS</span></div><div><strong>${seq==null?'…':seq}</strong><span>SEQUÊNCIAS</span></div></div>${controls(sel,tags,types)}</div></div>`}
  function skeleton(sel){ROOT.innerHTML=`<section class="season-v8" data-season="${sel.season}">${hero(sel,{items:[],total:null,complete:false})}<div class="season-v8-shell season-v8-body"><div class="season-v8-grid season-v8-skeleton">${Array.from({length:8},()=>'<div><span></span><i></i></div>').join('')}</div></div></section>`;activate();wireControls(sel,[],[])}
  function paint(sel,payload,{preserve=false}={}){if(!isSeasonPath())return;const y=scrollY;currentPayload=payload;const items=payload.items||[],tags=tagRows(items),types=typeRows(items),filtered=items.filter(matches),current=nowSeason(),still=sameSelection(sel,current)?(payload.still||[]).filter(m=>{const sy=m.startDate?.year||9999;if(sy<sel.year)return true;if(sy>sel.year)return false;return(m.startDate?.month||12)<MONTH_START[sel.season]}):[];ROOT.innerHTML=`<section class="season-v8" data-season="${sel.season}">${hero(sel,payload)}<div class="season-v8-shell season-v8-body"><div class="season-v8-grid">${filtered.length?filtered.map(card).join(''):'<div class="season-v8-empty">Nenhum anime encontrado para este filtro.</div>'}</div>${stillSection(still)}</div></section>`;document.title=`${seasonMeta(sel.season).name} ${sel.year} | AniNexus`;activate();wireControls(sel,tags,types);wireCards();if(preserve)requestAnimationFrame(()=>scrollTo(0,y));else requestAnimationFrame(()=>document.querySelector('.season-v8')?.classList.add('ready'))}

  function closeMenus(except=null){document.querySelectorAll('.season-v8-dropdown').forEach(m=>{if(m!==except){m.hidden=true;const w=m.closest('.season-v8-dropwrap');w?.classList.remove('open');w?.querySelector('[data-v8-toggle]')?.setAttribute('aria-expanded','false')}})}
  function wireControls(sel,tags,types){
    document.querySelectorAll('[data-v8-season]').forEach(b=>b.onclick=()=>{filter={tag:null,type:null};const next={year:sel.year,season:b.dataset.v8Season};setRoute(routeFor(next.year,next.season));renderSeason({selection:next})});
    document.querySelectorAll('[data-v8-year]').forEach(b=>b.onclick=()=>{filter={tag:null,type:null};const next={year:+b.dataset.v8Year,season:sel.season};closeMenus();setRoute(routeFor(next.year,next.season));renderSeason({selection:next})});
    document.querySelectorAll('[data-v8-toggle]').forEach(b=>b.onclick=e=>{e.stopPropagation();const menu=document.querySelector(`[data-v8-menu="${b.dataset.v8Toggle}"]`),will=menu?.hidden;closeMenus(menu);if(menu){menu.hidden=!will;b.closest('.season-v8-dropwrap')?.classList.toggle('open',will);b.setAttribute('aria-expanded',String(will));if(will&&b.dataset.v8Toggle==='year')requestAnimationFrame(()=>menu.querySelector('.active')?.scrollIntoView({block:'center'}))}});
    document.querySelectorAll('[data-v8-tag]').forEach(b=>b.onclick=()=>{filter.tag=filter.tag===b.dataset.v8Tag?null:b.dataset.v8Tag;paint(sel,currentPayload,{preserve:true})});
    document.querySelectorAll('[data-v8-type]').forEach(b=>b.onclick=()=>{filter.type=filter.type===b.dataset.v8Type?null:b.dataset.v8Type;paint(sel,currentPayload,{preserve:true})});
  }
  function toggleStore(k,id,b){const s=readSet(k);s.has(id)?s.delete(id):s.add(id);writeSet(k,s);b.classList.toggle('active',s.has(id));try{toast(s.has(id)?'Adicionado':'Removido')}catch{}}
  function openAnime(m){deactivate();const p=`/anime/${slug8(title8(m))}-${m.id}`;try{if(typeof go==='function')go(p);else{setRoute(p);render()}}catch{location.href=BASE_V8+p}}
  function wireCards(){const map=new Map((currentPayload?.items||[]).map(m=>[m.id,m]));for(const m of currentPayload?.still||[])if(!map.has(m.id))map.set(m.id,m);document.querySelectorAll('[data-v8-media]').forEach(el=>{const open=()=>{const m=map.get(+el.dataset.v8Media);if(m)openAnime(m)};el.onclick=e=>{if(e.target.closest('button'))return;open()};el.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();open()}}});document.querySelectorAll('[data-v8-fav]').forEach(b=>b.onclick=e=>{e.stopPropagation();toggleStore('aninexus:favorites',+b.dataset.v8Fav,b)});document.querySelectorAll('[data-v8-list]').forEach(b=>b.onclick=e=>{e.stopPropagation();toggleStore('aninexus:list',+b.dataset.v8List,b)});document.querySelectorAll('.season-v8-poster img,.season-v8-rail img').forEach(img=>img.onerror=()=>{img.onerror=null;img.removeAttribute('src');img.classList.add('broken')})}
  function activate(){document.body.classList.add('season-v8-active');document.body.classList.remove('season-v7-active');document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav==='season'))}
  function deactivate(){document.body.classList.remove('season-v8-active');closeMenus();clearInterval(refreshTimer);if(controller){controller.abort();controller=null}}

  async function loadSeason(sel,{force=false}={}){
    const run=++token;if(controller)controller.abort();controller=new AbortController();const signal=controller.signal,cached=getCache(sel);
    if(cached&&!force)paint(sel,cached);else if(!cached)skeleton(sel);
    try{
      const first=await fetchSeasonPage(sel,1,signal);if(run!==token||!isSeasonPath())return;
      let items=uniq(first.media||[]),payload={items,total:first.pageInfo?.total||items.length,lastPage:first.pageInfo?.lastPage||1,complete:!(first.pageInfo?.hasNextPage),still:cached?.still||[]};
      if(!cached)paint(sel,payload);
      if(first.pageInfo?.hasNextPage){const pages=[];for(let p=2;p<=Math.min(first.pageInfo.lastPage||2,4);p++)pages.push(fetchSeasonPage(sel,p,signal));const rest=await Promise.allSettled(pages);for(const r of rest)if(r.status==='fulfilled')items.push(...(r.value.media||[]));items=uniq(items);payload={...payload,items,complete:rest.every(r=>r.status==='fulfilled')}}
      if(sameSelection(sel,nowSeason())){try{payload.still=await fetchStill(signal)}catch{payload.still=cached?.still||[]}}
      if(run!==token||!isSeasonPath())return;setCache(sel,payload);paint(sel,payload,{preserve:!!cached});scheduleAdjacentPrefetch(sel);
    }catch(err){if(err?.name==='AbortError')return;if(cached){currentPayload=cached;return}if(run===token){const grid=document.querySelector('.season-v8-grid');if(grid)grid.innerHTML='<div class="season-v8-empty"><strong>Não foi possível atualizar agora.</strong><span>Toque novamente na temporada ou tente em alguns instantes.</span></div>'}}
  }
  function adjacent(sel,dir){let i=SEASONS.findIndex(s=>s.key===sel.season)+dir,y=sel.year;if(i<0){i=3;y--}if(i>3){i=0;y++}return{year:y,season:SEASONS[i].key}}
  function scheduleAdjacentPrefetch(sel){const idle=window.requestIdleCallback||((fn)=>setTimeout(fn,1800));idle(async()=>{for(const n of [adjacent(sel,-1),adjacent(sel,1)]){if(getCache(n))continue;try{const c=new AbortController(),p=await fetchSeasonPage(n,1,c.signal);setCache(n,{items:p.media||[],total:p.pageInfo?.total||0,lastPage:p.pageInfo?.lastPage||1,complete:!p.pageInfo?.hasNextPage,still:[],partialPrefetch:!!p.pageInfo?.hasNextPage})}catch{}}},{timeout:3500})}
  function renderSeason({selection=null,force=false}={}){if(!isSeasonPath())return;const sel=selection||selectionFromPath();activate();if(pathNowV8()==='/animes/temporadas')setRoute(routeFor(sel.year,sel.season),true);loadSeason(sel,{force});clearInterval(refreshTimer);refreshTimer=setInterval(()=>{if(!document.hidden&&isSeasonPath())loadSeason(selectionFromPath(),{force:true})},REFRESH_MS)}

  const DETAIL_BASE_ANIME=`id title{romaji english native userPreferred} coverImage{extraLarge large color} bannerImage description genres tags{name rank} averageScore popularity favourites episodes duration format status season seasonYear countryOfOrigin source startDate{year month day} endDate{year month day} studios(isMain:true){nodes{id name}} nextAiringEpisode{airingAt episode timeUntilAiring} trailer{id site thumbnail} externalLinks{site url type icon color}`;
  const DETAIL_BASE_MANGA=`id title{romaji english native userPreferred} coverImage{extraLarge large color} bannerImage description genres tags{name rank} averageScore popularity favourites chapters volumes format status countryOfOrigin source startDate{year month day} endDate{year month day} externalLinks{site url type icon color}`;
  const DETAIL_CARD=`id title{romaji english native userPreferred} coverImage{extraLarge large color} averageScore format genres`;
  async function robustGetMedia(id,type='ANIME'){
    if(!IS_PAGES_V8&&typeof fetch==='function'){try{const r=await fetch(`/api/${type==='ANIME'?'anime':'manga'}/${id}`,{credentials:'same-origin'});if(r.ok)return await r.json()}catch{}}
    const key=`aninexus:detail:v8:${type}:${id}`;try{const v=JSON.parse(sessionStorage.getItem(key)||'null');if(v&&Date.now()-v.t<30*60*1000)return v.d}catch{}
    const extra=type==='ANIME'?`characters(perPage:14,sort:[ROLE,RELEVANCE,ID]){edges{role node{id name{full native} image{large medium}}}} staff(perPage:12,sort:[RELEVANCE,ID]){edges{role node{id name{full native} image{large medium}}}} relations{edges{relationType node{${DETAIL_CARD}}}} recommendations(perPage:10,sort:RATING_DESC){nodes{rating mediaRecommendation{${DETAIL_CARD}}}}`:`relations{edges{relationType node{${DETAIL_CARD}}}} recommendations(perPage:10,sort:RATING_DESC){nodes{rating mediaRecommendation{${DETAIL_CARD}}}}`;
    const base=type==='ANIME'?DETAIL_BASE_ANIME:DETAIL_BASE_MANGA;
    try{const d=await requestGraphQL(`query($id:Int){Media(id:$id,type:${type}){${base} ${extra}}}`,{id:+id},null,1);if(!d?.Media)throw new Error('Título não encontrado');try{sessionStorage.setItem(key,JSON.stringify({t:Date.now(),d:d.Media}))}catch{}return d.Media}catch(firstError){const d=await requestGraphQL(`query($id:Int){Media(id:$id,type:${type}){${base}}}`,{id:+id},null,2);if(!d?.Media)throw firstError;return d.Media}
  }
  try{getMedia=robustGetMedia}catch{window.getMedia=robustGetMedia}

  document.addEventListener('click',e=>{if(!e.target.closest('.season-v8-dropwrap'))closeMenus()});
  document.addEventListener('click',e=>{const a=e.target.closest('a');if(!a)return;let href=a.getAttribute('href')||'';if(href.startsWith(BASE_V8))href=href.slice(BASE_V8.length)||'/';if(/^\/animes\/temporadas(?:\/|$)/.test(href)){e.preventDefault();e.stopImmediatePropagation();setRoute(href);filter={tag:null,type:null};renderSeason();return}if(document.body.classList.contains('season-v8-active'))deactivate()},true);
  window.addEventListener('popstate',()=>setTimeout(()=>{if(isSeasonPath())renderSeason();else deactivate()},0));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&isSeasonPath()){const s=selectionFromPath(),c=getCache(s);if(!c||Date.now()-(c.cachedAt||0)>5*60*1000)loadSeason(s,{force:true})}});
  window.addEventListener('resize',()=>closeMenus());
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{if(isSeasonPath())renderSeason()},0));else setTimeout(()=>{if(isSeasonPath())renderSeason()},0);
})();