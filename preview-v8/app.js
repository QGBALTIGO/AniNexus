'use strict';
(() => {
  const root = document.querySelector('#app');
  if (!root) return;

  const IS_PAGES = location.hostname.endsWith('github.io');
  const BASE = IS_PAGES ? '/AniNexus' : '';
  const ENDPOINT = 'https://graphql.anilist.co';
  const CACHE_TTL = 6 * 60 * 60 * 1000;
  const REFRESH_TTL = 10 * 60 * 1000;
  const SEASONS = [
    {key:'WINTER',slug:'inverno',name:'Inverno',icon:'snow'},
    {key:'SPRING',slug:'primavera',name:'Primavera',icon:'flower'},
    {key:'SUMMER',slug:'verao',name:'Verão',icon:'sun'},
    {key:'FALL',slug:'outono',name:'Outono',icon:'leaf'}
  ];
  const GENRE_PT = {Action:'Ação',Adventure:'Aventura',Comedy:'Comédia',Drama:'Drama',Fantasy:'Fantasia',Horror:'Terror',Mystery:'Mistério',Romance:'Romance','Sci-Fi':'Ficção Científica','Slice of Life':'Cotidiano',Sports:'Esportes',Supernatural:'Sobrenatural',Thriller:'Suspense',Psychological:'Psicológico',Music:'Música'};
  const TAG_PT = {Shounen:'Shounen',Isekai:'Isekai',School:'Escola',Magic:'Magia',Seinen:'Seinen',Josei:'Josei',Shoujo:'Shoujo',Demons:'Demônios',Historical:'Histórico','Urban Fantasy':'Fantasia Urbana'};
  const TYPE_GROUPS = [
    {key:'SERIES',label:'Série',formats:['TV','TV_SHORT']},
    {key:'MOVIE',label:'Filme',formats:['MOVIE']},
    {key:'SPECIAL',label:'Especial',formats:['SPECIAL','OVA']},
    {key:'ONA',label:'ONA',formats:['ONA']}
  ];
  const ICON = {
    snow:`<svg viewBox="0 0 64 64"><g fill="none" stroke="currentColor" stroke-width="3.1" stroke-linecap="round"><path d="M32 6v52M9 19l46 26M55 19 9 45M22 10l10 7 10-7M22 54l10-7 10 7M10 29l11 3-11 3M54 29l-11 3 11 3"/></g></svg>`,
    flower:`<svg viewBox="0 0 64 64"><g fill="none" stroke="currentColor" stroke-width="3.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="32" r="5"/><path d="M32 27c-9-4-12-12-6-17 6-5 13 1 11 12 6-8 15-8 18-1 2 7-5 12-15 11 9 3 14 10 9 16-5 6-13 2-16-7 1 10-5 16-12 13-7-3-6-12 1-18-9 3-16-2-14-9 2-7 11-8 18-2"/></g></svg>`,
    sun:`<svg viewBox="0 0 64 64"><g fill="none" stroke="currentColor" stroke-width="3.1" stroke-linecap="round"><circle cx="32" cy="32" r="12"/><path d="M32 5v9M32 50v9M5 32h9M50 32h9M13 13l7 7M44 44l7 7M51 13l-7 7M20 44l-7 7"/></g></svg>`,
    leaf:`<svg viewBox="0 0 64 64"><g fill="none" stroke="currentColor" stroke-width="3.1" stroke-linecap="round" stroke-linejoin="round"><path d="M50 9c-1 10 4 14 9 19-8 1-11 5-12 12-7-3-11-2-15 3-4-5-9-7-15-4 1-7-2-12-9-15 7-4 10-9 9-16 8 3 13 1 17-5 4 7 9 9 16 6Z"/><path d="M11 54c11-15 24-26 39-35"/></g></svg>`,
    star:`<svg viewBox="0 0 24 24"><path d="m12 3 2.8 5.6 6.2.9-4.5 4.4 1.1 6.1-5.6-2.9L6.4 20l1.1-6.1L3 9.5l6.2-.9L12 3Z"/></svg>`,
    plus:`<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>`,
    heart:`<svg viewBox="0 0 24 24"><path d="M20.5 8.8c0 5-8.5 10-8.5 10s-8.5-5-8.5-10A4.6 4.6 0 0 1 12 6.4a4.6 4.6 0 0 1 8.5 2.4Z"/></svg>`,
    tag:`<svg viewBox="0 0 24 24"><path d="M3.5 12.5 12 4h7.5v7.5L11 20l-7.5-7.5Z"/><circle cx="16.2" cy="7.8" r="1.2"/></svg>`,
    type:`<svg viewBox="0 0 24 24"><rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M7 4v4M17 4v4M3.5 9h17"/><path d="m10 12 5 3-5 3v-6Z"/></svg>`,
    chevron:`<svg viewBox="0 0 24 24"><path d="m7 9 5 5 5-5"/></svg>`,
    play:`<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4Z"/></svg>`,
    clock:`<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>`,
    back:`<svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg>`
  };

  let activeController = null;
  let loadToken = 0;
  let currentSeasonData = null;
  let activeFilters = {tag:null,type:null};
  let refreshTimer = null;
  let popover = null;
  let lastRequestAt = 0;

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const strip = html => { const d=document.createElement('div'); d.innerHTML=String(html||''); return (d.textContent||'').trim(); };
  const titleOf = m => m?.title?.english || m?.title?.userPreferred || m?.title?.romaji || m?.title?.native || 'Anime';
  const slug = s => String(s||'anime').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,90);
  const scoreOf = m => m?.averageScore ? (m.averageScore/10).toFixed(1).replace('.0','') : '';
  const imageOf = m => m?.coverImage?.extraLarge || m?.coverImage?.large || '';
  const bannerOf = m => m?.bannerImage || imageOf(m);
  const fmtNum = n => new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(Number(n)||0);

  function routePath(){
    const params = new URLSearchParams(location.search);
    const restored = params.get('p');
    if (restored) return restored.split('?')[0].replace(/\/+$/,'') || '/';
    let p = location.pathname;
    if (IS_PAGES) p = p.replace(/^\/AniNexus/,'') || '/';
    return p.replace(/\/+$/,'') || '/';
  }
  function isSeasonRoute(p=routePath()){ return /^\/animes\/temporadas(?:\/\d{4}\/(?:inverno|primavera|verao|outono))?$/.test(p); }
  function animeIdFromPath(p=routePath()){ const m=p.match(/^\/anime\/.+-(\d+)$/); return m ? Number(m[1]) : null; }
  function currentSeason(){
    const now = new Date();
    const month = Number(new Intl.DateTimeFormat('en',{timeZone:'America/Sao_Paulo',month:'numeric'}).format(now));
    const year = Number(new Intl.DateTimeFormat('en',{timeZone:'America/Sao_Paulo',year:'numeric'}).format(now));
    return {year,season:month<=3?'WINTER':month<=6?'SPRING':month<=9?'SUMMER':'FALL'};
  }
  function selectionFromPath(){
    const m = routePath().match(/^\/animes\/temporadas\/(\d{4})\/(inverno|primavera|verao|outono)$/);
    if (!m) return currentSeason();
    return {year:Number(m[1]),season:SEASONS.find(s=>s.slug===m[2])?.key || 'SUMMER'};
  }
  function seasonMeta(key){ return SEASONS.find(s=>s.key===key) || SEASONS[2]; }
  function seasonRoute(year,key){ return `/animes/temporadas/${year}/${seasonMeta(key).slug}`; }
  function setRoute(path,replace=false){
    history[replace?'replaceState':'pushState']({},'',`${BASE}${path}`);
  }
  function clearOldClasses(){
    document.body.classList.remove('season-v7-active','season-v8-active');
  }
  function activateSeasonChrome(){
    clearOldClasses();
    document.body.classList.remove('nx-detail-active');
    document.body.classList.add('nx-season-active');
    document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav==='season'));
  }
  function activateDetailChrome(){
    clearOldClasses();
    document.body.classList.remove('nx-season-active');
    document.body.classList.add('nx-detail-active');
  }
  function deactivateV8(){
    document.body.classList.remove('nx-season-active','nx-detail-active');
    closePopover();
  }

  async function gql(query,variables,signal,retries=3){
    let lastErr;
    for(let attempt=0;attempt<retries;attempt++){
      try{
        const wait = Math.max(0, 230 - (Date.now()-lastRequestAt));
        if(wait) await sleep(wait);
        lastRequestAt = Date.now();
        const res = await fetch(ENDPOINT,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({query,variables}),signal});
        if(res.status===429 || res.status>=500){ throw Object.assign(new Error(`HTTP ${res.status}`),{retryable:true}); }
        if(!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if(json.errors?.length) throw new Error(json.errors[0]?.message || 'Falha ao consultar catálogo');
        return json.data;
      }catch(err){
        lastErr = err;
        if(err?.name==='AbortError') throw err;
        if(attempt<retries-1) await sleep(550*(2**attempt)+Math.floor(Math.random()*180));
      }
    }
    throw lastErr || new Error('Falha de rede');
  }

  const SEASON_FIELDS = `id title{romaji english native userPreferred} coverImage{extraLarge large color} averageScore format status genres tags{name rank} startDate{year month day} relations{edges{relationType}}`;
  const DETAIL_FIELDS = `id title{romaji english native userPreferred} coverImage{extraLarge large color} bannerImage description genres tags{name rank} averageScore popularity favourites episodes duration format status season seasonYear countryOfOrigin source startDate{year month day} endDate{year month day} studios(isMain:true){nodes{id name}} nextAiringEpisode{airingAt episode timeUntilAiring} trailer{id site thumbnail} externalLinks{site url type icon color}`;

  function seasonCacheKey(sel){ return `nx:v8:season:${sel.year}:${sel.season}`; }
  function readCache(key){
    try{ const v=JSON.parse(localStorage.getItem(key)||'null'); return v&&v.data ? v : null; }catch{return null;}
  }
  function writeCache(key,data){
    try{ localStorage.setItem(key,JSON.stringify({savedAt:Date.now(),data})); }catch{}
  }

  async function fetchSeason(sel,signal){
    const query = `query($page:Int,$year:Int,$season:MediaSeason){Page(page:$page,perPage:50){pageInfo{hasNextPage total}media(type:ANIME,isAdult:false,seasonYear:$year,season:$season,sort:[POPULARITY_DESC]){${SEASON_FIELDS}}}}`;
    let page=1, all=[], apiTotal=0;
    while(page<=5){
      const d = await gql(query,{page,year:sel.year,season:sel.season},signal,3);
      const items = d?.Page?.media || [];
      apiTotal = Number(d?.Page?.pageInfo?.total || apiTotal || 0);
      all.push(...items);
      if(!d?.Page?.pageInfo?.hasNextPage || !items.length) break;
      page++;
    }
    const unique = [...new Map(all.filter(x=>x?.id).map(x=>[x.id,x])).values()];
    if(unique.length > 400) throw new Error('Resposta de temporada inválida');
    return {items:unique,apiTotal,hash:unique.map(x=>`${x.id}:${x.averageScore||0}:${x.status||''}`).join('|')};
  }

  async function fetchStillAiring(signal){
    const q=`query{Page(page:1,perPage:24){media(type:ANIME,isAdult:false,status:RELEASING,sort:[POPULARITY_DESC]){${SEASON_FIELDS}}}}`;
    const d=await gql(q,{},signal,2);
    return d?.Page?.media || [];
  }

  function isContinuation(m){ return (m?.relations?.edges||[]).some(e=>e?.relationType==='PREQUEL'); }
  function tagRows(items){
    const map=new Map();
    for(const m of items){
      const seen=new Set([...(m.genres||[])]);
      for(const t of m.tags||[]) if((t.rank||0)>=45) seen.add(t.name);
      for(const x of seen) if(x) map.set(x,(map.get(x)||0)+1);
    }
    return [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,18).map(([key,count])=>({key,label:GENRE_PT[key]||TAG_PT[key]||key,count}));
  }
  function typeRows(items){ return TYPE_GROUPS.map(g=>({...g,count:items.filter(x=>g.formats.includes(x.format)).length})).filter(x=>x.count); }
  function filteredItems(items){
    return items.filter(m=>{
      if(activeFilters.tag){ const all=[...(m.genres||[]),...(m.tags||[]).map(t=>t.name)]; if(!all.includes(activeFilters.tag)) return false; }
      if(activeFilters.type){ const g=TYPE_GROUPS.find(x=>x.key===activeFilters.type); if(g && !g.formats.includes(m.format)) return false; }
      return true;
    });
  }

  function controls(sel,tags,types){
    const years=Array.from({length:68},(_,i)=>new Date().getFullYear()+2-i);
    const tag=tags.find(x=>x.key===activeFilters.tag);
    const type=types.find(x=>x.key===activeFilters.type);
    return `<div class="nx-season-controls">
      <div class="nx-season-control-line">
        <div class="nx-season-tabs" role="tablist" aria-label="Temporadas">${SEASONS.map(s=>`<button type="button" role="tab" aria-selected="${s.key===sel.season}" class="${s.key===sel.season?'active':''}" data-nx-season="${s.key}">${s.name}</button>`).join('')}</div>
        <button type="button" class="nx-filter-pill nx-year-pill" data-nx-menu="year"><strong>${sel.year}</strong>${ICON.chevron}</button>
      </div>
      <div class="nx-season-filter-line">
        <button type="button" class="nx-filter-pill ${activeFilters.tag?'selected':''}" data-nx-menu="tag">${ICON.tag}<strong>${esc(tag?.label||'Tags')}</strong>${ICON.chevron}</button>
        <button type="button" class="nx-filter-pill ${activeFilters.type?'selected':''}" data-nx-menu="type">${ICON.type}<strong>${esc(type?.label||'Tipo')}</strong>${ICON.chevron}</button>
      </div>
      <template id="nx-year-options">${years.map(y=>`<button data-nx-year="${y}" class="${y===sel.year?'active':''}">${y}</button>`).join('')}</template>
      <template id="nx-tag-options"><button data-nx-tag="" class="${!activeFilters.tag?'active':''}"><span>Todos</span><small>${currentSeasonData?.items?.length||0}</small></button>${tags.map(x=>`<button data-nx-tag="${esc(x.key)}" class="${x.key===activeFilters.tag?'active':''}"><span>${esc(x.label)}</span><small>${x.count}</small></button>`).join('')}</template>
      <template id="nx-type-options"><button data-nx-type="" class="${!activeFilters.type?'active':''}"><span>Todos</span><small>${currentSeasonData?.items?.length||0}</small></button>${types.map(x=>`<button data-nx-type="${x.key}" class="${x.key===activeFilters.type?'active':''}"><span>${esc(x.label)}</span><small>${x.count}</small></button>`).join('')}</template>
    </div>`;
  }

  function card(m,index){
    const favs=readIdSet('aninexus:favorites'), list=readIdSet('aninexus:list');
    const score=scoreOf(m), image=imageOf(m);
    return `<article class="nx-season-card" data-nx-media="${m.id}" tabindex="0" style="--delay:${Math.min(index,18)*24}ms">
      <div class="nx-season-poster">${image?`<img ${index<4?'fetchpriority="high"':'loading="lazy"'} decoding="async" src="${esc(image)}" alt="${esc(titleOf(m))}">`:''}<span class="nx-season-cover-fallback"></span><span class="nx-season-fade"></span>
        ${score?`<span class="nx-season-score">${ICON.star}<b>${score}</b></span>`:''}
        <div class="nx-season-actions"><button type="button" data-nx-list="${m.id}" class="${list.has(m.id)?'active':''}" aria-label="Adicionar à lista">${ICON.plus}</button><button type="button" data-nx-fav="${m.id}" class="${favs.has(m.id)?'active':''}" aria-label="Favoritar">${ICON.heart}</button></div>
      </div><h3>${esc(titleOf(m))}</h3>
    </article>`;
  }

  function renderSeasonShell(sel,data,{loading=false,error=''}={}){
    activateSeasonChrome();
    const meta=seasonMeta(sel.season);
    const all=data?.items||[];
    currentSeasonData=data||{items:[]};
    const sequels=all.filter(isContinuation).length;
    const premieres=Math.max(0,all.length-sequels);
    const tags=tagRows(all), types=typeRows(all), shown=filteredItems(all);
    root.innerHTML=`<section class="nx-season" data-season="${sel.season}">
      <div class="nx-season-hero"><div class="nx-season-shell">
        <div class="nx-season-title"><span class="nx-season-icon">${ICON[meta.icon]}</span><div><h1>${meta.name} <em>${sel.year}</em></h1><p>TEMPORADA DE ANIMES</p></div></div>
        <div class="nx-season-stats"><div><strong>${loading?'—':all.length}</strong><span>ANIMES</span></div><div><strong>${loading?'—':premieres}</strong><span>ESTREIAS</span></div><div><strong>${loading?'—':sequels}</strong><span>SEQUÊNCIAS</span></div></div>
        ${controls(sel,tags,types)}
      </div></div>
      <div class="nx-season-shell nx-season-content">
        ${loading?`<div class="nx-season-grid nx-skeleton">${Array.from({length:8},()=>'<article><span></span><i></i></article>').join('')}</div>`:error?`<div class="nx-season-error"><strong>Não foi possível atualizar esta temporada.</strong><span>${esc(error)}</span><button type="button" data-nx-retry>Tentar novamente</button></div>`:`<div class="nx-season-grid">${shown.map(card).join('')||'<div class="nx-season-empty">Nenhum título encontrado neste filtro.</div>'}</div><div id="nxStillAiring"></div>`}
      </div>
    </section>`;
    document.title=`${meta.name} ${sel.year} | AniNexus`;
    bindSeason(sel,tags,types);
    bindBrokenImages();
  }

  function readIdSet(key){
    try{ const a=JSON.parse(localStorage.getItem(key)||'[]'); return new Set((Array.isArray(a)?a:[]).map(x=>typeof x==='object'?Number(x.id):Number(x)).filter(Number.isFinite)); }catch{return new Set();}
  }
  function writeIdSet(key,set){ try{ localStorage.setItem(key,JSON.stringify([...set])); }catch{} }
  function toggleStored(key,id,button){ const s=readIdSet(key); s.has(id)?s.delete(id):s.add(id); writeIdSet(key,s); button?.classList.toggle('active',s.has(id)); }

  function closePopover(){
    if(popover){ popover.remove(); popover=null; }
    document.body.classList.remove('nx-popover-open');
    document.querySelectorAll('.nx-filter-pill.open').forEach(b=>b.classList.remove('open'));
  }
  function openPopover(button,kind,sel){
    closePopover();
    const tpl=document.querySelector(`#nx-${kind}-options`);
    if(!tpl) return;
    button.classList.add('open');
    const layer=document.createElement('div');
    layer.className='nx-popover-layer';
    layer.innerHTML=`<button class="nx-popover-backdrop" aria-label="Fechar"></button><div class="nx-popover nx-${kind}-menu"><div class="nx-popover-mobile-head"><strong>${kind==='year'?'Escolher ano':kind==='tag'?'Tags':'Tipo'}</strong><button type="button" data-nx-popover-close>×</button></div><div class="nx-popover-list">${tpl.innerHTML}</div></div>`;
    document.body.append(layer); popover=layer; document.body.classList.add('nx-popover-open');
    const menu=layer.querySelector('.nx-popover');
    if(matchMedia('(min-width:721px)').matches){
      const r=button.getBoundingClientRect();
      const width=kind==='year'?180:kind==='tag'?340:280;
      let left=Math.min(innerWidth-width-16,Math.max(16,r.left+r.width/2-width/2));
      let top=Math.min(innerHeight-420,Math.max(12,r.bottom+10));
      menu.style.setProperty('--menu-left',`${left}px`); menu.style.setProperty('--menu-top',`${top}px`); menu.style.setProperty('--menu-width',`${width}px`);
    }
    layer.querySelector('.nx-popover-backdrop').onclick=closePopover;
    layer.querySelector('[data-nx-popover-close]')?.addEventListener('click',closePopover);
    layer.querySelectorAll('[data-nx-year]').forEach(b=>b.onclick=()=>{ closePopover(); activeFilters={tag:null,type:null}; const next={year:Number(b.dataset.nxYear),season:sel.season}; setRoute(seasonRoute(next.year,next.season)); loadSeason(next); });
    layer.querySelectorAll('[data-nx-tag]').forEach(b=>b.onclick=()=>{ activeFilters.tag=b.dataset.nxTag||null; closePopover(); renderSeasonShell(sel,currentSeasonData); });
    layer.querySelectorAll('[data-nx-type]').forEach(b=>b.onclick=()=>{ activeFilters.type=b.dataset.nxType||null; closePopover(); renderSeasonShell(sel,currentSeasonData); });
  }

  function bindSeason(sel){
    root.querySelectorAll('[data-nx-season]').forEach(b=>b.addEventListener('click',()=>{
      if(b.dataset.nxSeason===sel.season) return;
      activeFilters={tag:null,type:null}; closePopover();
      const next={year:sel.year,season:b.dataset.nxSeason};
      setRoute(seasonRoute(next.year,next.season));
      loadSeason(next);
    }));
    root.querySelectorAll('[data-nx-menu]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();openPopover(b,b.dataset.nxMenu,sel);}));
    root.querySelector('[data-nx-retry]')?.addEventListener('click',()=>loadSeason(sel,{force:true}));
    root.querySelectorAll('[data-nx-media]').forEach(el=>{
      const open=()=>{ const m=(currentSeasonData?.items||[]).find(x=>x.id===Number(el.dataset.nxMedia)); if(m) openAnime(m); };
      el.addEventListener('click',e=>{ if(e.target.closest('button')) return; open(); });
      el.addEventListener('keydown',e=>{ if(e.key==='Enter') open(); });
    });
    root.querySelectorAll('[data-nx-fav]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();toggleStored('aninexus:favorites',Number(b.dataset.nxFav),b);}));
    root.querySelectorAll('[data-nx-list]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();toggleStored('aninexus:list',Number(b.dataset.nxList),b);}));
  }

  function bindBrokenImages(scope=root){
    scope.querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{img.style.opacity='0';img.closest('.nx-season-poster,.nx-detail-cover,.nx-person,.nx-related-poster')?.classList.add('image-error');},{once:true}));
  }

  function renderStillAiring(items,sel){
    const host=document.querySelector('#nxStillAiring'); if(!host || !items?.length) return;
    const startMonth={WINTER:1,SPRING:4,SUMMER:7,FALL:10}[sel.season];
    const filtered=items.filter(m=>{const y=m.startDate?.year||9999,mo=m.startDate?.month||12;return y<sel.year||(y===sel.year&&mo<startMonth);}).slice(0,16);
    if(!filtered.length)return;
    host.innerHTML=`<section class="nx-still"><div class="nx-section-title"><h2>Ainda no ar</h2><p>Começaram antes e seguem em exibição.</p></div><div class="nx-still-rail">${filtered.map(m=>`<article data-nx-still="${m.id}" tabindex="0"><div class="nx-related-poster">${imageOf(m)?`<img loading="lazy" src="${esc(imageOf(m))}" alt="${esc(titleOf(m))}">`:''}${scoreOf(m)?`<span>${ICON.star}${scoreOf(m)}</span>`:''}</div><strong>${esc(titleOf(m))}</strong></article>`).join('')}</div></section>`;
    host.querySelectorAll('[data-nx-still]').forEach(el=>el.onclick=()=>{const m=filtered.find(x=>x.id===Number(el.dataset.nxStill));if(m)openAnime(m);});
    bindBrokenImages(host);
  }

  async function loadSeason(sel,{force=false}={}){
    const canonical=seasonRoute(sel.year,sel.season);
    if(routePath()==='/animes/temporadas') setRoute(canonical,true);
    activateSeasonChrome(); closePopover();
    const token=++loadToken;
    activeController?.abort(); activeController=new AbortController();
    const cache=readCache(seasonCacheKey(sel));
    const cachedData=cache?.data;
    if(cachedData&&!force) renderSeasonShell(sel,cachedData); else renderSeasonShell(sel,null,{loading:true});
    try{
      const fresh=await fetchSeason(sel,activeController.signal);
      if(token!==loadToken||!isSeasonRoute())return;
      writeCache(seasonCacheKey(sel),fresh);
      renderSeasonShell(sel,fresh);
      const now=currentSeason();
      if(sel.year===now.year&&sel.season===now.season){
        fetchStillAiring(activeController.signal).then(items=>{if(token===loadToken&&isSeasonRoute())renderStillAiring(items,sel);}).catch(()=>{});
      }
    }catch(err){
      if(err?.name==='AbortError')return;
      if(cachedData){ renderSeasonShell(sel,cachedData); }
      else renderSeasonShell(sel,null,{error:'Verifique sua conexão e tente de novo. O AniNexus fará uma nova tentativa sem apagar a página.'});
    }
    clearInterval(refreshTimer);
    refreshTimer=setInterval(()=>{
      if(document.hidden||!isSeasonRoute())return;
      const c=readCache(seasonCacheKey(selectionFromPath()));
      if(!c||Date.now()-c.savedAt>REFRESH_TTL) loadSeason(selectionFromPath(),{force:true});
    },60_000);
  }

  function openAnime(m){
    try{sessionStorage.setItem(`nx:v8:media:${m.id}`,JSON.stringify({savedAt:Date.now(),data:m}));}catch{}
    const p=`/anime/${slug(titleOf(m))}-${m.id}`;
    setRoute(p);
    renderAnimeDetail(m.id,m);
    scrollTo({top:0,behavior:'instant'});
  }

  async function fetchAnime(id,signal){
    const query=`query($id:Int){Media(id:$id,type:ANIME){${DETAIL_FIELDS} characters(perPage:16,sort:[ROLE,RELEVANCE]){edges{role node{id name{full native} image{large medium}}}} staff(perPage:12,sort:[RELEVANCE]){edges{role node{id name{full native} image{large medium}}}} relations{edges{relationType node{${DETAIL_FIELDS}}} } recommendations(perPage:8,sort:RATING_DESC){nodes{rating mediaRecommendation{${DETAIL_FIELDS}}}}}}`;
    const d=await gql(query,{id:Number(id)},signal,3);
    if(!d?.Media)throw new Error('Título não encontrado');
    return d.Media;
  }
  function mediaCache(id){
    try{const x=JSON.parse(sessionStorage.getItem(`nx:v8:media:${id}`)||'null');return x?.data||null;}catch{return null;}
  }
  function saveMedia(m){try{sessionStorage.setItem(`nx:v8:media:${m.id}`,JSON.stringify({savedAt:Date.now(),data:m}));}catch{}}
  function fmtDate(d){return d?.year?[d.day,d.month,d.year].filter(Boolean).join('/'):'—';}
  function fmtStatus(s){return({FINISHED:'Finalizado',RELEASING:'Em exibição',NOT_YET_RELEASED:'Em breve',CANCELLED:'Cancelado',HIATUS:'Em hiato'})[s]||s||'—';}
  function fmtFormat(f){return({TV:'Série',TV_SHORT:'Série curta',MOVIE:'Filme',SPECIAL:'Especial',OVA:'OVA',ONA:'ONA'})[f]||f||'—';}
  function fmtSource(s){return({MANGA:'Mangá',LIGHT_NOVEL:'Light novel',ORIGINAL:'Original',NOVEL:'Novel',GAME:'Jogo',VISUAL_NOVEL:'Visual novel',WEB_NOVEL:'Web novel'})[s]||s||'—';}
  function country(c){return({JP:'Japão',KR:'Coreia do Sul',CN:'China',TW:'Taiwan'})[c]||c||'—';}
  function timeUntil(ts){const ms=ts*1000-Date.now();if(ms<=0)return'Em instantes';const d=Math.floor(ms/86400000),h=Math.floor(ms%86400000/3600000),m=Math.floor(ms%3600000/60000);return d?`${d}d ${h}h ${m}m`:`${h}h ${m}m`;}

  function renderAnimeDetail(id,seed=null){
    activateDetailChrome(); closePopover();
    const fallback=seed||mediaCache(id);
    root.innerHTML=`<section class="nx-detail-loading"><div class="nx-detail-spinner"></div><span>Carregando informações do anime…</span></section>`;
    const controller=new AbortController();
    fetchAnime(id,controller.signal).then(m=>{saveMedia(m);paintAnime(m);}).catch(()=>{
      if(fallback)paintAnime(fallback,{partial:true});
      else root.innerHTML=`<section class="nx-detail-fail"><img src="${BASE}/assets/logo.png" alt=""><h1>Não foi possível atualizar este título agora</h1><p>A página não foi perdida. Tente novamente em alguns instantes.</p><button class="nx-detail-retry">Tentar novamente</button></section>`;
      root.querySelector('.nx-detail-retry')?.addEventListener('click',()=>renderAnimeDetail(id,fallback));
    });
  }

  function detailInfo(m){
    const studios=(m.studios?.nodes||[]).map(x=>x.name).filter(Boolean).join(', ')||'—';
    return [['Status',fmtStatus(m.status)],['Formato',fmtFormat(m.format)],['Episódios',m.episodes||'—'],['Duração',m.duration?`${m.duration} min`:'—'],['Origem',fmtSource(m.source)],['País',country(m.countryOfOrigin)],['Temporada',m.season?`${seasonMeta(m.season).name} ${m.seasonYear||''}`:'—'],['Início',fmtDate(m.startDate)],['Fim',fmtDate(m.endDate)],['Estúdio',studios]].map(([k,v])=>`<div><span>${k}</span><strong>${esc(v)}</strong></div>`).join('');
  }

  function paintAnime(m,{partial=false}={}){
    activateDetailChrome();
    const fav=readIdSet('aninexus:favorites').has(m.id),listed=readIdSet('aninexus:list').has(m.id);
    const chars=m.characters?.edges||[],staff=m.staff?.edges||[],rels=m.relations?.edges||[],recs=(m.recommendations?.nodes||[]).filter(x=>x.mediaRecommendation);
    const streams=(m.externalLinks||[]).filter(x=>String(x.type||'').toUpperCase()==='STREAMING'&&x.url);
    root.innerHTML=`<article class="nx-detail">
      <section class="nx-detail-hero"><div class="nx-detail-bg">${bannerOf(m)?`<img src="${esc(bannerOf(m))}" alt="">`:''}</div><div class="nx-detail-shade"></div><div class="nx-detail-shell nx-detail-hero-inner">
        <button type="button" class="nx-detail-back" data-nx-back>${ICON.back}<span>Voltar</span></button>
        <div class="nx-detail-cover">${imageOf(m)?`<img src="${esc(imageOf(m))}" alt="${esc(titleOf(m))}">`:''}</div>
        <div class="nx-detail-copy"><span class="nx-detail-kicker">${esc(m.title?.romaji||'')}</span><h1>${esc(titleOf(m))}</h1><div class="nx-detail-badges"><span>${m.seasonYear||m.startDate?.year||'—'}</span><span>${esc(fmtFormat(m.format))}</span>${(m.genres||[]).slice(0,4).map(g=>`<span class="genre">${esc(GENRE_PT[g]||g)}</span>`).join('')}</div>
          <div class="nx-detail-actions"><button class="primary ${listed?'active':''}" data-nx-detail-list="${m.id}">${ICON.plus}<span>${listed?'Na minha lista':'Adicionar à lista'}</span></button><button class="round ${fav?'active':''}" data-nx-detail-fav="${m.id}">${ICON.heart}</button>${m.trailer?.id&&String(m.trailer.site).toLowerCase()==='youtube'?`<a class="trailer" target="_blank" rel="noopener" href="https://www.youtube.com/watch?v=${encodeURIComponent(m.trailer.id)}">${ICON.play}<span>Trailer</span></a>`:''}</div>
          <div class="nx-detail-numbers">${scoreOf(m)?`<div><strong>${scoreOf(m)}</strong><span>nota</span></div>`:''}<div><strong>${fmtNum(m.popularity)}</strong><span>popularidade</span></div><div><strong>${fmtNum(m.favourites)}</strong><span>favoritos</span></div></div>
        </div>
      </div></section>
      <nav class="nx-detail-tabs"><div class="nx-detail-shell"><button class="active" data-nx-tab="geral">Geral</button><button data-nx-tab="impressoes">Impressões</button><button data-nx-tab="franquia">Franquia</button><button data-nx-tab="recomendacoes">Recomendações</button><button data-nx-tab="compartilhar">Compartilhar</button></div></nav>
      <div class="nx-detail-shell nx-detail-panel" id="nxDetailPanel"></div>
    </article>`;

    const general=()=>`<div class="nx-detail-layout"><main>
      ${partial?'<div class="nx-partial-note">Mostrando informações já carregadas enquanto a atualização é refeita.</div>':''}
      ${m.nextAiringEpisode?`<section class="nx-next-episode"><div><small>PRÓXIMO EPISÓDIO</small><strong>Episódio ${m.nextAiringEpisode.episode}</strong><span>${timeUntil(m.nextAiringEpisode.airingAt)}</span></div><div class="nx-next-clock">${ICON.clock}</div></section>`:''}
      <section><h2>Sinopse</h2><p class="nx-synopsis">${esc(strip(m.description)||'Sinopse ainda não disponível.')}</p></section>
      ${streams.length?`<section><h2>Onde assistir</h2><div class="nx-streams">${streams.map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener">${s.icon?`<img src="${esc(s.icon)}" alt="">`:ICON.play}<span>${esc(s.site||'Streaming')}</span></a>`).join('')}</div></section>`:''}
      ${chars.length?`<section><h2>Personagens</h2><div class="nx-people-rail">${chars.slice(0,12).map(c=>`<article class="nx-person">${c.node?.image?.large?`<img loading="lazy" src="${esc(c.node.image.large)}" alt="">`:''}<strong>${esc(c.node?.name?.full||'')}</strong><span>${c.role==='MAIN'?'Principal':'Coadjuvante'}</span></article>`).join('')}</div></section>`:''}
      ${staff.length?`<section><h2>Equipe</h2><div class="nx-people-rail">${staff.slice(0,10).map(c=>`<article class="nx-person">${c.node?.image?.large?`<img loading="lazy" src="${esc(c.node.image.large)}" alt="">`:''}<strong>${esc(c.node?.name?.full||'')}</strong><span>${esc(c.role||'')}</span></article>`).join('')}</div></section>`:''}
    </main><aside><h3>Informações</h3><div class="nx-info-card">${detailInfo(m)}</div><h3>Outros títulos</h3><div class="nx-info-card"><div><span>Romaji</span><strong>${esc(m.title?.romaji||'—')}</strong></div><div><span>Original</span><strong>${esc(m.title?.native||'—')}</strong></div></div></aside></div>`;
    const impressions=()=>`<section class="nx-detail-single"><h2>Impressões</h2><p>Comentários e discussões deste anime ficam aqui. No preview do GitHub, as suas impressões ficam somente neste aparelho.</p><textarea id="nxImpression" maxlength="1000" placeholder="O que você achou?"></textarea><button class="nx-post-impression">Publicar impressão</button><div id="nxImpressions"></div></section>`;
    const franchise=()=>`<section class="nx-detail-single"><h2>Franquia</h2><div class="nx-related-grid">${rels.map(r=>relatedCard(r.node,r.relationType)).join('')||'<p>Nenhuma relação disponível.</p>'}</div></section>`;
    const recommendations=()=>`<section class="nx-detail-single"><h2>Recomendações</h2><div class="nx-related-grid">${recs.map(r=>relatedCard(r.mediaRecommendation,'Recomendado')).join('')||'<p>Sem recomendações disponíveis.</p>'}</div></section>`;
    const share=()=>`<section class="nx-detail-single"><h2>Compartilhar</h2><p>Copie o link deste anime ou use o compartilhamento do seu aparelho.</p><div class="nx-share-actions"><button data-nx-share>Compartilhar</button><button data-nx-copy>Copiar link</button></div></section>`;
    const panels={geral:general,impressoes:impressions,franquia:franchise,recomendacoes:recommendations,compartilhar:share};
    const show=key=>{root.querySelectorAll('[data-nx-tab]').forEach(b=>b.classList.toggle('active',b.dataset.nxTab===key));const p=root.querySelector('#nxDetailPanel');p.innerHTML=(panels[key]||general)();bindDetailPanel(m,key);bindBrokenImages(p);};
    root.querySelectorAll('[data-nx-tab]').forEach(b=>b.onclick=()=>show(b.dataset.nxTab));
    root.querySelector('[data-nx-back]').onclick=()=>{history.back();};
    root.querySelector('[data-nx-detail-fav]')?.addEventListener('click',e=>toggleStored('aninexus:favorites',m.id,e.currentTarget));
    root.querySelector('[data-nx-detail-list]')?.addEventListener('click',e=>{toggleStored('aninexus:list',m.id,e.currentTarget);e.currentTarget.querySelector('span').textContent=e.currentTarget.classList.contains('active')?'Na minha lista':'Adicionar à lista';});
    show('geral'); bindBrokenImages(); document.title=`${titleOf(m)} | AniNexus`;
  }

  function relatedCard(m,label=''){
    if(!m)return'';
    return `<article class="nx-related" data-nx-related="${m.id}"><div class="nx-related-poster">${imageOf(m)?`<img loading="lazy" src="${esc(imageOf(m))}" alt="">`:''}</div><div><small>${esc(label)}</small><strong>${esc(titleOf(m))}</strong>${scoreOf(m)?`<span>${ICON.star}${scoreOf(m)}</span>`:''}</div></article>`;
  }
  function bindDetailPanel(m,key){
    if(key==='impressoes'){
      const storage=`nx:v8:impressions:${m.id}`;
      let items=[];try{items=JSON.parse(localStorage.getItem(storage)||'[]');if(!Array.isArray(items))items=[];}catch{}
      const draw=()=>{const h=root.querySelector('#nxImpressions');if(h)h.innerHTML=items.map(x=>`<article class="nx-impression"><strong>Você</strong><p>${esc(x)}</p></article>`).join('');};draw();
      root.querySelector('.nx-post-impression')?.addEventListener('click',()=>{const t=root.querySelector('#nxImpression'),v=t?.value.trim();if(!v)return;items.unshift(v.slice(0,1000));items=items.slice(0,30);try{localStorage.setItem(storage,JSON.stringify(items));}catch{}t.value='';draw();});
    }
    root.querySelectorAll('[data-nx-related]').forEach(el=>el.onclick=()=>{const id=Number(el.dataset.nxRelated);const rel=(m.relations?.edges||[]).map(x=>x.node).find(x=>x?.id===id)||(m.recommendations?.nodes||[]).map(x=>x.mediaRecommendation).find(x=>x?.id===id);if(rel)openAnime(rel);});
    root.querySelector('[data-nx-share]')?.addEventListener('click',async()=>{try{if(navigator.share)await navigator.share({title:titleOf(m),url:location.href});else await navigator.clipboard.writeText(location.href);}catch{}});
    root.querySelector('[data-nx-copy]')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);}catch{}});
  }

  function handleRoute(){
    const p=routePath();
    if(isSeasonRoute(p)){loadSeason(selectionFromPath());return true;}
    if(window.__NX_ROUTE_OWNER__==='detail'){deactivateV8();return false;}
    const id=animeIdFromPath(p);
    if(id){renderAnimeDetail(id,mediaCache(id));return true;}
    deactivateV8();return false;
  }

  document.addEventListener('click',e=>{
    const seasonLink=e.target.closest('a[href*="/animes/temporadas"]');
    if(seasonLink){
      let href=seasonLink.getAttribute('href')||'/animes/temporadas';
      if(href.startsWith(BASE))href=href.slice(BASE.length)||'/';
      if(/^\/animes\/temporadas(?:\/|$)/.test(href)){
        e.preventDefault();e.stopImmediatePropagation();
        setRoute(href);activeFilters={tag:null,type:null};handleRoute();return;
      }
    }
    const generic=e.target.closest('[data-open]');
    if(generic&&!e.target.closest('[data-list],[data-fav],button,a')){
      const id=Number(generic.dataset.open);if(Number.isFinite(id)){e.preventDefault();e.stopImmediatePropagation();setRoute(`/anime/titulo-${id}`);renderAnimeDetail(id);}
    }
  },true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closePopover();});
  window.addEventListener('resize',closePopover);
  window.addEventListener('popstate',()=>setTimeout(handleRoute,0));
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden||!isSeasonRoute())return;
    const sel=selectionFromPath(),cache=readCache(seasonCacheKey(sel));
    if(!cache||Date.now()-cache.savedAt>REFRESH_TTL)loadSeason(sel,{force:true});
  });

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(handleRoute,0));
  else setTimeout(handleRoute,0);
})();
