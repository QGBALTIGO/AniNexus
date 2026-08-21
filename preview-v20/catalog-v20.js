'use strict';
(() => {
  const app=document.querySelector('#app');
  if(!app)return;

  const IS_PAGES=location.hostname.endsWith('github.io');
  const BASE=IS_PAGES?'/AniNexus':'';
  const TARGET='/animes/catalogo';
  const BUILD='20.3.0';
  const ENDPOINT='https://graphql.anilist.co';
  const PER_PAGE=24;
  const CACHE_TTL=8*60*1000;
  const CACHE_PREFIX='nx:v203:catalog:';

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
    retry:'<svg viewBox="0 0 24 24"><path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 0-2 5"/></svg>',
    chevron:'<svg viewBox="0 0 24 24"><path d="m7 9 5 5 5-5"/></svg>'
  };

  const state={mode:'ALL',page:1,search:'',genre:'',format:'',year:'',controller:null,token:0,mounted:false,filtersOpen:false,lastY:Math.max(0,scrollY),scrollRaf:0};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const titleOf=m=>m?.title?.english||m?.title?.userPreferred||m?.title?.romaji||m?.title?.native||'Anime';
  const imageOf=m=>m?.coverImage?.extraLarge||m?.coverImage?.large||`${BASE}/assets/logo.png`;
  const scoreOf=m=>m?.averageScore?(m.averageScore/10).toFixed(1).replace('.0',''):'';
  const fmtNum=n=>new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(Number(n)||0);
  const slug=s=>String(s||'anime').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,90);
  const formatLabel=f=>({TV:'Série',TV_SHORT:'Série curta',MOVIE:'Filme',OVA:'OVA',ONA:'ONA',SPECIAL:'Especial',MUSIC:'Música'})[f]||f||'Anime';
  const statusLabel=s=>({RELEASING:'Em exibição',FINISHED:'Finalizado',NOT_YET_RELEASED:'Em breve',HIATUS:'Em hiato',CANCELLED:'Cancelado'})[s]||'';
  const genreLabel=g=>GENRES.find(x=>x[0]===g)?.[1]||g;

  function route(){const u=new URL(location.href),p=u.searchParams.get('p');if(p)return p.split('?')[0].replace(/\/+$/,'')||'/';let path=u.pathname;if(IS_PAGES)path=path.replace(/^\/AniNexus/,'')||'/';return path.replace(/\/+$/,'')||'/'}
  function onCatalog(){return route()===TARGET||!!window.__NX_CATALOG_BOOT__}
  function currentSeason(){const now=new Date(),month=Number(new Intl.DateTimeFormat('en',{timeZone:'America/Sao_Paulo',month:'numeric'}).format(now)),year=Number(new Intl.DateTimeFormat('en',{timeZone:'America/Sao_Paulo',year:'numeric'}).format(now));return{year,season:month<=3?'WINTER':month<=6?'SPRING':month<=9?'SUMMER':'FALL'}}
  function hardGo(path){location.href=IS_PAGES?`${BASE}/?build=${BUILD}&p=${encodeURIComponent(path)}`:path}
  function openAnime(m){cleanup();history.pushState({},'',`${BASE}/anime/${slug(titleOf(m))}-${m.id}`);window.dispatchEvent(new PopStateEvent('popstate'))}

  function cacheRead(key){try{const x=JSON.parse(sessionStorage.getItem(CACHE_PREFIX+key)||'null');if(x&&Date.now()-x.t<CACHE_TTL&&Array.isArray(x.d?.items))return x.d}catch{}return null}
  function cacheWrite(key,data){try{sessionStorage.setItem(CACHE_PREFIX+key,JSON.stringify({t:Date.now(),d:data}))}catch{}}
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  const FULL_FIELDS=`id title{romaji english native userPreferred} coverImage{extraLarge large color} averageScore popularity favourites episodes format status season seasonYear genres startDate{year month day} studios(isMain:true){nodes{name}}`;
  const SAFE_FIELDS=`id title{romaji english native userPreferred} coverImage{extraLarge large} averageScore popularity favourites episodes format status seasonYear genres startDate{year month day}`;

  async function gql(query,variables,signal,retries=2){
    let last;
    for(let attempt=0;attempt<retries;attempt++){
      try{
        const res=await fetch(ENDPOINT,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({query,variables}),signal});
        if(res.status===429||res.status>=500)throw new Error(`HTTP ${res.status}`);
        if(!res.ok)throw new Error(`HTTP ${res.status}`);
        const json=await res.json();
        if(json.errors?.length)throw new Error(json.errors[0]?.message||'Consulta inválida');
        if(!json.data)throw new Error('Resposta vazia');
        return json.data;
      }catch(err){
        last=err;
        if(err?.name==='AbortError')throw err;
        if(attempt<retries-1)await sleep(340+Math.floor(Math.random()*180));
      }
    }
    throw last||new Error('Falha de rede');
  }

  function options(){
    const o={page:state.page,perPage:PER_PAGE,search:state.search||null,genre:state.genre||null,format:state.format||null,season:null,year:state.year?Number(state.year):null,status:null,sort:['POPULARITY_DESC']};
    if(state.mode==='SOON'){o.status='NOT_YET_RELEASED';o.sort=['POPULARITY_DESC']}
    else if(state.mode==='SEASON'){const s=currentSeason();o.season=s.season;o.year=state.year?Number(state.year):s.year;o.sort=['POPULARITY_DESC']}
    else if(state.mode==='TOP')o.sort=['SCORE_DESC','POPULARITY_DESC'];
    else if(state.mode==='POPULAR')o.sort=['POPULARITY_DESC'];
    else if(state.mode==='MEMBERS')o.sort=['FAVOURITES_DESC','POPULARITY_DESC'];
    if(state.search)o.sort=['SEARCH_MATCH','POPULARITY_DESC'];
    return o;
  }

  async function directQuery(o,fields,signal){
    const q=`query($page:Int,$perPage:Int,$search:String,$genre:String,$format:MediaFormat,$season:MediaSeason,$year:Int,$status:MediaStatus,$sort:[MediaSort]){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(type:ANIME,isAdult:false,search:$search,genre:$genre,format:$format,season:$season,seasonYear:$year,status:$status,sort:$sort){${fields}}}}`;
    const d=await gql(q,o,signal,2);
    const page=d?.Page;
    if(!page||!Array.isArray(page.media))throw new Error('Catálogo inválido');
    return{pageInfo:page.pageInfo||{},items:page.media};
  }

  async function fetchCatalog(){
    const o=options();
    const key=JSON.stringify(o);
    const cached=cacheRead(key);
    if(cached)return cached;
    let result;
    try{result=await directQuery(o,FULL_FIELDS,state.controller?.signal)}catch(err){
      if(err?.name==='AbortError')throw err;
      result=await directQuery(o,SAFE_FIELDS,state.controller?.signal);
    }
    cacheWrite(key,result);
    return result;
  }

  function modeLabel(){return({ALL:'Todos os animes',SOON:'Em breve',SEASON:'Animes da temporada',TOP:'Top Animes',POPULAR:'Mais populares',MEMBERS:'Mais membros'})[state.mode]||'Todos os animes'}
  function modeButtons(){return MODES.map(([k,n,ic,color])=>`<button type="button" class="nx23-mode nx23-mode-${color} ${state.mode===k?'active':''}" data-nx23-mode="${k}"><i>${ICON[ic]}</i><span>${n}</span></button>`).join('')}
  function years(){const y=new Date().getFullYear()+1;return Array.from({length:34},(_,i)=>y-i)}
  function skeletons(n=PER_PAGE){return `<div class="nx23-cat-grid">${Array.from({length:n},()=>'<div class="nx23-skeleton"></div>').join('')}</div>`}

  function filterMarkup(){
    return `<label class="nx23-search">${ICON.search}<input id="nx23Search" type="search" autocomplete="off" placeholder="Buscar anime pelo título..." value="${esc(state.search)}"><button type="button" data-nx23-clear aria-label="Limpar busca">${ICON.close}</button></label><select id="nx23Genre"><option value="">Todos os gêneros</option>${GENRES.map(([v,n])=>`<option value="${v}" ${state.genre===v?'selected':''}>${n}</option>`).join('')}</select><select id="nx23Format">${FORMATS.map(([v,n])=>`<option value="${v}" ${state.format===v?'selected':''}>${n}</option>`).join('')}</select><select id="nx23Year"><option value="">Todos os anos</option>${years().map(y=>`<option value="${y}" ${String(state.year)===String(y)?'selected':''}>${y}</option>`).join('')}</select><button type="button" class="nx23-reset" data-nx23-reset>${ICON.sliders}<span>Limpar</span></button>`;
  }

  function card(m){
    const score=scoreOf(m),year=m.seasonYear||m.startDate?.year||'',studio=m.studios?.nodes?.[0]?.name||'',st=statusLabel(m.status);
    return `<article class="nx23-card" tabindex="0" data-nx23-open="${m.id}"><div class="nx23-poster"><img loading="lazy" decoding="async" src="${esc(imageOf(m))}" alt="${esc(titleOf(m))}"><div class="nx23-shade"></div>${score?`<span class="nx23-score">${ICON.star}<b>${score}</b></span>`:''}${st?`<span class="nx23-status ${m.status==='NOT_YET_RELEASED'?'soon':''}">${esc(st)}</span>`:''}<div class="nx23-card-actions"><button type="button" data-list="${m.id}" aria-label="Adicionar à lista">${ICON.plus}</button><button type="button" data-fav="${m.id}" aria-label="Favoritar">${ICON.heart}</button></div></div><div class="nx23-copy"><h3>${esc(titleOf(m))}</h3><div class="nx23-meta"><span>${esc(formatLabel(m.format))}</span>${year?`<i></i><span>${year}</span>`:''}${m.episodes?`<i></i><span>${m.episodes} eps</span>`:''}</div><p>${esc((m.genres||[]).slice(0,2).map(genreLabel).join(' · ')||studio||'Anime')}</p></div></article>`;
  }

  function renderShell(){
    document.body.classList.add('nx23-catalog-active');
    document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav==='anime'));
    app.innerHTML=`<section class="nx23-cat-hero" id="nx23CatHero"><div class="shell"><div class="nx23-cat-title"><h1>Catálogo de <em>Animes</em></h1><p>Todos os animes do catálogo, dos clássicos aos lançamentos da temporada.</p></div></div></section><section class="nx23-cat-dock" id="nx23CatDock"><div class="shell"><button type="button" class="nx23-dock-head" data-nx23-expand aria-expanded="false"><span class="nx23-dock-icon">${ICON.grid}</span><span class="nx23-dock-copy"><strong>Catálogo de <em>Animes</em></strong><small>CATÁLOGO DE ANIMES</small></span><span class="nx23-dock-toggle">${ICON.chevron}</span></button><div class="nx23-cat-nav"><button type="button" class="nx23-filter-icon" data-nx23-filters aria-label="Abrir filtros" aria-expanded="false">${ICON.sliders}</button><div class="nx23-cat-tabs">${modeButtons()}</div></div><div class="nx23-filter-panel" id="nx23FilterPanel"><div class="nx23-tools">${filterMarkup()}</div><div class="nx23-chips" id="nx23Chips"></div></div></div></section><section class="nx23-body"><div class="shell"><div class="nx23-line"><div><small>EXPLORAR</small><h2 id="nx23Title">${modeLabel()}</h2></div><span id="nx23PageLabel">Carregando…</span></div><div id="nx23Grid">${skeletons()}</div><nav class="nx23-pages" id="nx23Pages" aria-label="Paginação"></nav></div></section>`;
    bindControls();
    renderChips();
    load();
    setupScroll();
  }

  function renderChips(){
    const el=document.querySelector('#nx23Chips');if(!el)return;
    const chips=[];
    if(state.search)chips.push(['search',`Busca: ${state.search}`]);
    if(state.genre)chips.push(['genre',genreLabel(state.genre)]);
    if(state.format)chips.push(['format',formatLabel(state.format)]);
    if(state.year)chips.push(['year',String(state.year)]);
    el.innerHTML=chips.map(([k,v])=>`<button type="button" data-nx23-chip="${k}">${esc(v)} ${ICON.close}</button>`).join('');
    el.querySelectorAll('[data-nx23-chip]').forEach(b=>b.onclick=()=>{state[b.dataset.nx23Chip]='';state.page=1;syncInputs();renderChips();load()});
  }

  function syncInputs(){const s=document.querySelector('#nx23Search'),g=document.querySelector('#nx23Genre'),f=document.querySelector('#nx23Format'),y=document.querySelector('#nx23Year');if(s)s.value=state.search;if(g)g.value=state.genre;if(f)f.value=state.format;if(y)y.value=state.year}
  function syncModes(){document.querySelectorAll('[data-nx23-mode]').forEach(b=>b.classList.toggle('active',b.dataset.nx23Mode===state.mode));const t=document.querySelector('#nx23Title');if(t)t.textContent=modeLabel()}

  function setFilters(open){
    state.filtersOpen=!!open;
    const dock=document.querySelector('#nx23CatDock');
    dock?.classList.toggle('filters-open',state.filtersOpen);
    document.querySelectorAll('[data-nx23-filters],[data-nx23-expand]').forEach(b=>b.setAttribute('aria-expanded',state.filtersOpen?'true':'false'));
    if(state.filtersOpen){document.body.classList.add('nx23-scroll-up');document.body.classList.remove('nx23-scroll-down');dock?.classList.add('expanded')}
  }

  function bindControls(){
    document.querySelectorAll('[data-nx23-mode]').forEach(b=>b.onclick=()=>{state.mode=b.dataset.nx23Mode;state.page=1;syncModes();if(innerWidth<720)setFilters(false);load()});
    document.querySelector('[data-nx23-filters]').onclick=()=>setFilters(!state.filtersOpen);
    document.querySelector('[data-nx23-expand]').onclick=()=>setFilters(!state.filtersOpen);
    let timer;
    const search=document.querySelector('#nx23Search');
    search.oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>{state.search=search.value.trim();state.page=1;renderChips();load()},300)};
    document.querySelector('[data-nx23-clear]').onclick=()=>{state.search='';state.page=1;search.value='';renderChips();load();search.focus()};
    document.querySelector('#nx23Genre').onchange=e=>{state.genre=e.target.value;state.page=1;renderChips();load()};
    document.querySelector('#nx23Format').onchange=e=>{state.format=e.target.value;state.page=1;renderChips();load()};
    document.querySelector('#nx23Year').onchange=e=>{state.year=e.target.value;state.page=1;renderChips();load()};
    document.querySelector('[data-nx23-reset]').onclick=()=>{state.search=state.genre=state.format=state.year='';state.page=1;syncInputs();renderChips();load()};
  }

  function renderPages(info){
    const root=document.querySelector('#nx23Pages');if(!root)return;
    const cur=Number(info.currentPage||state.page||1),last=Math.min(Number(info.lastPage||1),999);
    if(last<=1){root.innerHTML='';return}
    const nums=[1,cur-1,cur,cur+1,last].filter((n,i,a)=>n>=1&&n<=last&&a.indexOf(n)===i).sort((a,b)=>a-b);
    let prev=0,out='';
    for(const n of nums){if(prev&&n-prev>1)out+='<span>…</span>';out+=`<button type="button" class="${n===cur?'active':''}" data-nx23-page="${n}">${n}</button>`;prev=n}
    root.innerHTML=`<button type="button" class="nav" data-nx23-page="${Math.max(1,cur-1)}" ${cur===1?'disabled':''}>‹</button>${out}<button type="button" class="nav" data-nx23-page="${Math.min(last,cur+1)}" ${cur===last?'disabled':''}>›</button>`;
    root.querySelectorAll('[data-nx23-page]').forEach(b=>b.onclick=()=>{const p=Number(b.dataset.nx23Page);if(!p||p===cur)return;state.page=p;load();document.querySelector('.nx23-body')?.scrollIntoView({behavior:'smooth',block:'start'})});
  }

  function bindCards(items){
    const byId=new Map(items.map(m=>[String(m.id),m]));
    document.querySelectorAll('[data-nx23-open]').forEach(el=>{
      const open=()=>{const m=byId.get(el.dataset.nx23Open);if(m)openAnime(m)};
      el.onclick=e=>{if(e.target.closest('button,a'))return;open()};
      el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}};
    });
    document.querySelectorAll('.nx23-poster>img').forEach(img=>img.addEventListener('error',()=>{img.src=`${BASE}/assets/logo.png`;img.classList.add('fallback')},{once:true}));
    window.AniNexusMediaState?.sync?.();
  }

  async function load(){
    const grid=document.querySelector('#nx23Grid');if(!grid)return;
    state.controller?.abort();state.controller=new AbortController();
    const token=++state.token;
    grid.innerHTML=skeletons();
    const label=document.querySelector('#nx23PageLabel');if(label)label.textContent='Carregando…';
    document.querySelector('#nx23Pages').innerHTML='';
    try{
      const result=await fetchCatalog();
      if(token!==state.token||route()!==TARGET)return;
      const items=result.items||[],info=result.pageInfo||{},total=Number(info.total||items.length);
      if(label)label.textContent=`${total.toLocaleString('pt-BR')} títulos · Página ${info.currentPage||state.page} de ${Math.min(info.lastPage||1,999)}`;
      const title=document.querySelector('#nx23Title');if(title)title.textContent=modeLabel();
      grid.innerHTML=items.length?`<div class="nx23-cat-grid">${items.map(card).join('')}</div>`:`<div class="nx23-empty"><img src="${BASE}/assets/logo.png" alt=""><h3>Nenhum anime encontrado</h3><p>Tente remover um filtro ou pesquisar outro título.</p><button type="button" data-nx23-empty-reset>Limpar filtros</button></div>`;
      grid.querySelector('[data-nx23-empty-reset]')?.addEventListener('click',()=>{state.search=state.genre=state.format=state.year='';state.page=1;syncInputs();renderChips();load()});
      renderPages(info);bindCards(items);
    }catch(err){
      if(err?.name==='AbortError'||token!==state.token)return;
      grid.innerHTML=`<div class="nx23-error">${ICON.retry}<h3>Não foi possível carregar o catálogo</h3><p>A consulta falhou. Tente novamente; seus filtros foram mantidos.</p><button type="button" data-nx23-retry>${ICON.retry} Tentar novamente</button></div>`;
      if(label)label.textContent='Falha ao carregar';
      grid.querySelector('[data-nx23-retry]')?.addEventListener('click',load);
    }
  }

  function setupScroll(){
    state.lastY=Math.max(0,scrollY);
    const update=()=>{
      state.scrollRaf=0;
      if(route()!==TARGET)return;
      const hero=document.querySelector('#nx23CatHero'),dock=document.querySelector('#nx23CatDock'),top=document.querySelector('#topbar');
      if(!hero||!dock)return;
      const y=Math.max(0,scrollY),headerH=top?.offsetHeight||54,stuck=hero.getBoundingClientRect().bottom<=headerH+1;
      dock.classList.toggle('is-stuck',stuck);
      if(!stuck){document.body.classList.remove('nx23-scroll-down','nx23-scroll-up');dock.classList.remove('expanded');state.lastY=y;return}
      const delta=y-state.lastY;
      if(!state.filtersOpen){
        if(delta>8){document.body.classList.add('nx23-scroll-down');document.body.classList.remove('nx23-scroll-up');dock.classList.remove('expanded')}
        else if(delta<-8){document.body.classList.add('nx23-scroll-up');document.body.classList.remove('nx23-scroll-down');dock.classList.add('expanded')}
      }
      state.lastY=y;
    };
    const onScroll=()=>{if(!state.scrollRaf)state.scrollRaf=requestAnimationFrame(update)};
    if(window.__NX23_CAT_SCROLL__)removeEventListener('scroll',window.__NX23_CAT_SCROLL__);
    window.__NX23_CAT_SCROLL__=onScroll;
    addEventListener('scroll',onScroll,{passive:true});
    update();
  }

  function cleanup(){
    state.controller?.abort();state.mounted=false;state.filtersOpen=false;
    document.body.classList.remove('nx23-catalog-active','nx23-scroll-down','nx23-scroll-up','nx20-catalog-active','nx21-catalog-active','nx21-cat-scroll-down','nx21-cat-scroll-up');
    const top=document.querySelector('#topbar');if(top)top.style.transform='';
    if(window.__NX23_CAT_SCROLL__){removeEventListener('scroll',window.__NX23_CAT_SCROLL__);window.__NX23_CAT_SCROLL__=null}
  }

  function mount(force=false){
    if(!onCatalog()&&!force)return;
    if(window.__NX_CATALOG_BOOT__){history.replaceState({},'',`${BASE}${TARGET}`);window.__NX_CATALOG_BOOT__=false}
    if(route()!==TARGET)return;
    if(state.mounted&&document.querySelector('.nx23-cat-hero'))return;
    state.mounted=true;renderShell();
  }

  document.addEventListener('click',e=>{
    if(route()===TARGET&&!e.target.closest('#nx23CatDock')&&state.filtersOpen)setFilters(false);
    const a=e.target.closest('a[href]');if(!a)return;
    try{
      const u=new URL(a.href,location.href);let p=u.pathname;if(IS_PAGES)p=p.replace(/^\/AniNexus/,'')||'/';p=p.replace(/\/+$/,'')||'/';
      if(p!==TARGET)return;
      if((e.button&&e.button!==0)||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();hardGo(TARGET);
    }catch{}
  },true);

  addEventListener('popstate',()=>setTimeout(()=>{route()===TARGET?mount(true):cleanup()},0));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>mount(),{once:true});else mount();
})();