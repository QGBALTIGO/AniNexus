'use strict';
(() => {
  const app=document.querySelector('#app');
  if(!app)return;

  const IS_PAGES=location.hostname.endsWith('github.io');
  const BASE=IS_PAGES?'/AniNexus':'';
  const TARGET='/animes/catalogo';
  const BUILD='21.0.0';
  const ENDPOINT='https://graphql.anilist.co';
  const PER_PAGE=24;
  const CACHE_TTL=8*60*1000;
  const CACHE_PREFIX='nx:v21:catalog:';

  const GENRES=[['Action','Ação'],['Adventure','Aventura'],['Comedy','Comédia'],['Drama','Drama'],['Fantasy','Fantasia'],['Horror','Terror'],['Mystery','Mistério'],['Romance','Romance'],['Sci-Fi','Ficção Científica'],['Slice of Life','Cotidiano'],['Sports','Esportes'],['Supernatural','Sobrenatural'],['Thriller','Suspense'],['Psychological','Psicológico'],['Music','Música'],['Mecha','Mecha']];
  const FORMATS=[['','Todos os formatos'],['TV','Séries'],['MOVIE','Filmes'],['OVA','OVA'],['ONA','ONA'],['SPECIAL','Especiais']];
  const MODES=[
    ['ALL','Todos','grid','red'],
    ['SOON','Em Breve','clock','blue'],
    ['SEASON','Temporada','leaf','green'],
    ['TOP','Top Animes','trophy','gold'],
    ['POPULAR','Mais Populares','fire','orange'],
    ['MEMBERS','Mais Membros','heart','pink']
  ];
  const ICON={
    grid:'<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="7" height="7" rx="1.7"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.7"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.7"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.7"/></svg>',
    clock:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.7"/><path d="M12 7.4v5l3.4 2"/></svg>',
    leaf:'<svg viewBox="0 0 24 24"><path d="M20 4C11 4 5 8 5 15c0 3 2 5 5 5 7 0 10-8 10-16Z"/><path d="M4 21c4-6 8-9 13-12"/></svg>',
    trophy:'<svg viewBox="0 0 24 24"><path d="M8 4h8v4c0 4-2 7-4 7s-4-3-4-7V4Z"/><path d="M8 6H4v2c0 2 2 4 4 4M16 6h4v2c0 2-2 4-4 4M12 15v4M8 21h8"/></svg>',
    fire:'<svg viewBox="0 0 24 24"><path d="M13 2c1 4-2 5-1 8 1-2 3-3 4-5 3 3 5 6 5 10a9 9 0 1 1-18 0c0-4 2-7 5-10 0 3 1 4 2 5 0-3 1-5 3-8Z"/></svg>',
    heart:'<svg viewBox="0 0 24 24"><path d="M20.5 8.8c0 5-8.5 10-8.5 10s-8.5-5-8.5-10A4.6 4.6 0 0 1 12 6.4a4.6 4.6 0 0 1 8.5 2.4Z"/></svg>',
    search:'<svg viewBox="0 0 24 24"><circle cx="10.7" cy="10.7" r="6.6"/><path d="m15.7 15.7 4.5 4.5"/></svg>',
    star:'<svg viewBox="0 0 24 24"><path d="m12 3 2.8 5.5 6.1.9-4.4 4.3 1 6.1-5.5-2.9-5.5 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/></svg>',
    plus:'<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    sliders:'<svg viewBox="0 0 24 24"><path d="M4 7h8M16 7h4M4 17h4M12 17h8M12 4v6M8 14v6"/></svg>',
    close:'<svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>',
    retry:'<svg viewBox="0 0 24 24"><path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 0-2 5"/></svg>'
  };

  const state={mode:'ALL',page:1,search:'',genre:'',format:'',year:'',controller:null,token:0,mounted:false,filtersOpen:false,items:new Map(),searchTimer:0};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const titleOf=m=>m?.title?.english||m?.title?.userPreferred||m?.title?.romaji||m?.title?.native||'Anime';
  const imageOf=m=>m?.coverImage?.extraLarge||m?.coverImage?.large||`${BASE}/assets/logo.png`;
  const scoreOf=m=>m?.averageScore?(m.averageScore/10).toFixed(1).replace('.0',''):'';
  const slug=s=>String(s||'anime').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,90);
  const formatLabel=f=>({TV:'Série',TV_SHORT:'Série curta',MOVIE:'Filme',OVA:'OVA',ONA:'ONA',SPECIAL:'Especial',MUSIC:'Música'})[f]||f||'Anime';
  const statusLabel=s=>({RELEASING:'Em exibição',FINISHED:'Finalizado',NOT_YET_RELEASED:'Em breve',HIATUS:'Em hiato',CANCELLED:'Cancelado'})[s]||'';
  const genreLabel=g=>GENRES.find(x=>x[0]===g)?.[1]||g;

  function route(){
    const u=new URL(location.href),p=u.searchParams.get('p');
    if(p)return p.split('?')[0].replace(/\/+$/,'')||'/';
    let path=u.pathname;
    if(IS_PAGES)path=path.replace(/^\/AniNexus/,'')||'/';
    return path.replace(/\/+$/,'')||'/';
  }
  function onCatalog(){return route()===TARGET||!!window.__NX_CATALOG_BOOT__}
  function normalizeUrl(){
    if(!onCatalog())return;
    if(IS_PAGES){
      const u=new URL(location.href);u.pathname=`${BASE}/`;u.search='';u.searchParams.set('build',BUILD);u.searchParams.set('p',TARGET);history.replaceState({},'',u.pathname+u.search);
    }else history.replaceState({},'',TARGET);
    window.__NX_CATALOG_BOOT__=false;
  }
  function currentSeason(){
    const now=new Date();
    const month=Number(new Intl.DateTimeFormat('en',{timeZone:'America/Sao_Paulo',month:'numeric'}).format(now));
    const year=Number(new Intl.DateTimeFormat('en',{timeZone:'America/Sao_Paulo',year:'numeric'}).format(now));
    return{year,season:month<=3?'WINTER':month<=6?'SPRING':month<=9?'SUMMER':'FALL'};
  }
  function cacheRead(key){try{const x=JSON.parse(sessionStorage.getItem(CACHE_PREFIX+key)||'null');if(x&&Date.now()-x.t<CACHE_TTL&&Array.isArray(x.data?.items))return x.data}catch{}return null}
  function cacheWrite(key,data){try{sessionStorage.setItem(CACHE_PREFIX+key,JSON.stringify({t:Date.now(),data}))}catch{}}
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const FIELDS=`id title{romaji english native userPreferred} coverImage{extraLarge large} averageScore popularity favourites episodes format status seasonYear genres startDate{year month day}`;

  async function gql(query,variables,signal){
    let last;
    for(let attempt=0;attempt<3;attempt++){
      try{
        const res=await fetch(ENDPOINT,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({query,variables}),signal});
        if(res.status===429||res.status>=500)throw new Error(`HTTP ${res.status}`);
        if(!res.ok)throw new Error(`HTTP ${res.status}`);
        const json=await res.json();
        if(json.errors?.length)throw new Error(json.errors[0]?.message||'Falha ao consultar catálogo');
        if(!json.data?.Page||!Array.isArray(json.data.Page.media))throw new Error('Resposta inválida');
        return json.data.Page;
      }catch(err){
        last=err;
        if(err?.name==='AbortError')throw err;
        if(attempt<2)await sleep(420*(attempt+1)+Math.floor(Math.random()*140));
      }
    }
    throw last||new Error('Falha de rede');
  }

  function buildRequest(){
    const defs=['$page:Int!','$perPage:Int!'];
    const vars={page:state.page,perPage:PER_PAGE};
    const args=['type:ANIME','isAdult:false'];
    let sort='POPULARITY_DESC';

    if(state.search.trim()){
      defs.push('$search:String!');vars.search=state.search.trim();args.push('search:$search');sort='SEARCH_MATCH';
    }
    if(state.genre){defs.push('$genre:String!');vars.genre=state.genre;args.push('genre:$genre')}
    if(state.format){defs.push('$format:MediaFormat!');vars.format=state.format;args.push('format:$format')}
    if(state.year&&state.mode!=='SEASON'){defs.push('$year:Int!');vars.year=Number(state.year);args.push('seasonYear:$year')}

    if(state.mode==='SOON'){args.push('status:NOT_YET_RELEASED');sort='POPULARITY_DESC'}
    else if(state.mode==='SEASON'){
      const cur=currentSeason();
      defs.push('$season:MediaSeason!','$year:Int!');vars.season=cur.season;vars.year=state.year?Number(state.year):cur.year;args.push('season:$season','seasonYear:$year');sort='POPULARITY_DESC';
    }else if(state.mode==='TOP')sort='SCORE_DESC';
    else if(state.mode==='POPULAR')sort='POPULARITY_DESC';
    else if(state.mode==='MEMBERS')sort='FAVOURITES_DESC';

    args.push(`sort:[${sort}]`);
    const query=`query(${defs.join(',')}){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(${args.join(',')}){${FIELDS}}}}`;
    return{query,vars,key:JSON.stringify({mode:state.mode,page:state.page,search:state.search,genre:state.genre,format:state.format,year:state.year})};
  }

  async function fetchCatalog(){
    const req=buildRequest();
    const cached=cacheRead(req.key);if(cached)return cached;
    const page=await gql(req.query,req.vars,state.controller?.signal);
    const result={pageInfo:page.pageInfo||{},items:page.media||[]};
    if(result.items.length)cacheWrite(req.key,result);
    return result;
  }

  function years(){const y=new Date().getFullYear()+1;return Array.from({length:36},(_,i)=>y-i)}
  function modeLabel(){return({ALL:'Todos os animes',SOON:'Em breve',SEASON:'Animes da temporada',TOP:'Top Animes',POPULAR:'Mais populares',MEMBERS:'Mais membros'})[state.mode]||'Todos os animes'}
  function tabs(){return MODES.map(([key,label,icon,color])=>`<button type="button" class="nx21-tab nx21-tab-${color}${state.mode===key?' active':''}" data-nx21-mode="${key}"><i>${ICON[icon]}</i><span>${label}</span></button>`).join('')}
  function filterMarkup(){return `<label class="nx21-search">${ICON.search}<input id="nx21Search" type="search" autocomplete="off" placeholder="Buscar anime pelo título…" value="${esc(state.search)}"><button type="button" data-nx21-clear aria-label="Limpar">${ICON.close}</button></label><select id="nx21Genre"><option value="">Todos os gêneros</option>${GENRES.map(([v,n])=>`<option value="${v}"${state.genre===v?' selected':''}>${n}</option>`).join('')}</select><select id="nx21Format">${FORMATS.map(([v,n])=>`<option value="${v}"${state.format===v?' selected':''}>${n}</option>`).join('')}</select><select id="nx21Year"><option value="">Todos os anos</option>${years().map(y=>`<option value="${y}"${String(state.year)===String(y)?' selected':''}>${y}</option>`).join('')}</select><button type="button" class="nx21-reset" data-nx21-reset>${ICON.close}<span>Limpar filtros</span></button>`}
  function skeletons(){return `<div class="nx21-grid">${Array.from({length:18},()=>'<div class="nx21-skeleton"></div>').join('')}</div>`}

  function card(m){
    const title=titleOf(m),score=scoreOf(m),year=m.seasonYear||m.startDate?.year||'',status=statusLabel(m.status);
    state.items.set(Number(m.id),m);
    return `<article class="nx21-card" data-nx21-open="${m.id}" tabindex="0"><div class="nx21-poster"><img src="${esc(imageOf(m))}" loading="lazy" decoding="async" alt="${esc(title)}"><div class="nx21-shade"></div>${score?`<span class="nx21-score">${ICON.star}<b>${score}</b></span>`:''}${status?`<span class="nx21-status${m.status==='NOT_YET_RELEASED'?' soon':''}">${esc(status)}</span>`:''}<div class="nx21-actions"><button type="button" data-list="${m.id}" aria-label="Adicionar à lista">${ICON.plus}</button><button type="button" data-fav="${m.id}" aria-label="Favoritar">${ICON.heart}</button></div></div><h3>${esc(title)}</h3><p>${esc([formatLabel(m.format),year,m.episodes?`${m.episodes} eps`:null].filter(Boolean).join(' · '))}</p><small>${esc((m.genres||[]).slice(0,2).map(genreLabel).join(' · '))}</small></article>`;
  }

  function pagination(info){
    const cur=Number(info.currentPage||state.page),last=Math.min(Number(info.lastPage||cur),500);
    if(last<=1)return'';
    const nums=[1,cur-1,cur,cur+1,last].filter(n=>n>=1&&n<=last).filter((n,i,a)=>a.indexOf(n)===i).sort((a,b)=>a-b);
    let prev=0,html='';
    for(const n of nums){if(prev&&n-prev>1)html+='<span>…</span>';html+=`<button type="button" data-nx21-page="${n}"${n===cur?' class="active"':''}>${n}</button>`;prev=n}
    return `<nav class="nx21-pages" aria-label="Paginação"><button type="button" data-nx21-page="${Math.max(1,cur-1)}"${cur<=1?' disabled':''}>‹</button>${html}<button type="button" data-nx21-page="${Math.min(last,cur+1)}"${!info.hasNextPage?' disabled':''}>›</button></nav>`;
  }

  function renderShell(){
    document.body.classList.add('nx21-catalog');
    document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav==='anime'));
    app.innerHTML=`<section class="nx21-hero"><div class="shell"><h1>Catálogo de <em>Animes</em></h1><p>Todos os animes do catálogo, dos clássicos aos lançamentos da temporada.</p></div></section><section class="nx21-strip" id="nx21Strip"><div class="shell nx21-strip-inner"><button type="button" class="nx21-filter-button" data-nx21-filters aria-label="Busca e filtros">${ICON.sliders}</button><div class="nx21-tabs">${tabs()}</div></div><div class="nx21-filter-panel${state.filtersOpen?' open':''}" id="nx21FilterPanel"><div class="shell nx21-filter-grid">${filterMarkup()}</div></div></section><section class="nx21-body"><div class="shell"><div class="nx21-section-head"><div><small>EXPLORAR</small><h2 id="nx21ModeTitle">${modeLabel()}</h2></div><span id="nx21Count"></span></div><div id="nx21Results">${skeletons()}</div><div id="nx21Pagination"></div></div></section>`;
  }

  async function load(){
    const box=document.querySelector('#nx21Results');if(!box)return;
    state.controller?.abort();state.controller=new AbortController();const token=++state.token;
    box.innerHTML=skeletons();
    document.querySelector('#nx21Pagination').innerHTML='';
    document.querySelector('#nx21ModeTitle').textContent=modeLabel();
    try{
      const result=await fetchCatalog();if(token!==state.token)return;
      state.items.clear();
      document.querySelector('#nx21Count').textContent=result.pageInfo?.total?`${Number(result.pageInfo.total).toLocaleString('pt-BR')} títulos`:'';
      box.innerHTML=result.items.length?`<div class="nx21-grid">${result.items.map(card).join('')}</div>`:`<div class="nx21-empty"><strong>Nenhum anime encontrado</strong><span>Tente remover algum filtro ou pesquisar outro título.</span></div>`;
      document.querySelector('#nx21Pagination').innerHTML=pagination(result.pageInfo||{});
      window.dispatchEvent(new CustomEvent('aninexus:media-state-refresh'));
    }catch(err){
      if(err?.name==='AbortError'||token!==state.token)return;
      box.innerHTML=`<div class="nx21-error">${ICON.retry}<strong>Não foi possível carregar o catálogo</strong><p>${esc(err?.message||'Falha de conexão')}. A página pode tentar novamente sem perder seus filtros.</p><button type="button" data-nx21-retry>${ICON.retry} Tentar novamente</button></div>`;
    }
  }

  function setMode(mode){
    if(!MODES.some(x=>x[0]===mode))return;
    state.mode=mode;state.page=1;
    document.querySelectorAll('[data-nx21-mode]').forEach(b=>b.classList.toggle('active',b.dataset.nx21Mode===mode));
    if(matchMedia('(max-width:720px)').matches)closeFilters();
    load();
  }
  function closeFilters(){state.filtersOpen=false;document.querySelector('#nx21FilterPanel')?.classList.remove('open');document.querySelector('[data-nx21-filters]')?.classList.remove('active')}
  function toggleFilters(){state.filtersOpen=!state.filtersOpen;document.querySelector('#nx21FilterPanel')?.classList.toggle('open',state.filtersOpen);document.querySelector('[data-nx21-filters]')?.classList.toggle('active',state.filtersOpen)}
  function openAnime(id){
    const m=state.items.get(Number(id));if(!m)return;
    cleanup();
    const path=`/anime/${slug(titleOf(m))}-${m.id}`;
    if(IS_PAGES)location.href=`${BASE}/?build=${BUILD}&p=${encodeURIComponent(path)}`;
    else{history.pushState({},'',path);window.dispatchEvent(new PopStateEvent('popstate'))}
  }

  function cleanup(){
    state.controller?.abort();state.controller=null;state.mounted=false;
    document.body.classList.remove('nx21-catalog');
  }
  function mount(){
    if(!onCatalog())return;
    normalizeUrl();cleanup();state.mounted=true;renderShell();load();
  }

  document.addEventListener('click',e=>{
    if(!document.body.classList.contains('nx21-catalog'))return;
    const mode=e.target.closest('[data-nx21-mode]');if(mode){e.preventDefault();setMode(mode.dataset.nx21Mode);return}
    if(e.target.closest('[data-nx21-filters]')){e.preventDefault();toggleFilters();return}
    if(e.target.closest('[data-nx21-clear]')){e.preventDefault();state.search='';const i=document.querySelector('#nx21Search');if(i)i.value='';state.page=1;load();return}
    if(e.target.closest('[data-nx21-reset]')){state.search=state.genre=state.format=state.year='';state.page=1;renderShell();load();return}
    const pg=e.target.closest('[data-nx21-page]');if(pg&&!pg.disabled){state.page=Number(pg.dataset.nx21Page)||1;load();document.querySelector('.nx21-body')?.scrollIntoView({behavior:'smooth',block:'start'});return}
    if(e.target.closest('[data-nx21-retry]')){load();return}
    if(e.target.closest('[data-list],[data-fav]'))return;
    const open=e.target.closest('[data-nx21-open]');if(open){openAnime(open.dataset.nx21Open);return}
  },true);

  document.addEventListener('change',e=>{
    if(!document.body.classList.contains('nx21-catalog'))return;
    if(e.target.id==='nx21Genre'){state.genre=e.target.value;state.page=1;load();if(innerWidth<=720)closeFilters()}
    if(e.target.id==='nx21Format'){state.format=e.target.value;state.page=1;load();if(innerWidth<=720)closeFilters()}
    if(e.target.id==='nx21Year'){state.year=e.target.value;state.page=1;load();if(innerWidth<=720)closeFilters()}
  });
  document.addEventListener('input',e=>{
    if(e.target.id!=='nx21Search')return;
    clearTimeout(state.searchTimer);state.search=e.target.value;state.page=1;
    state.searchTimer=setTimeout(load,360);
  });
  addEventListener('popstate',()=>{if(onCatalog())mount();else cleanup()});
  if(onCatalog())mount();
})();
