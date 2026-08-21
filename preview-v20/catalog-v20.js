'use strict';
(() => {
  const app = document.querySelector('#app');
  if (!app) return;

  const IS_PAGES = location.hostname.endsWith('github.io');
  const BASE = IS_PAGES ? '/AniNexus' : '';
  const TARGET = '/animes/catalogo';
  const BUILD = '20.1.0';
  const ENDPOINT = 'https://graphql.anilist.co';
  const CACHE_TTL = 5 * 60 * 1000;
  const PER_PAGE = 30;
  const GENRES = [
    ['Action','Ação'],['Adventure','Aventura'],['Comedy','Comédia'],['Drama','Drama'],['Fantasy','Fantasia'],
    ['Horror','Terror'],['Mystery','Mistério'],['Romance','Romance'],['Sci-Fi','Ficção Científica'],['Slice of Life','Slice of Life'],
    ['Sports','Esportes'],['Supernatural','Sobrenatural'],['Thriller','Suspense'],['Psychological','Psicológico'],['Music','Música'],['Mecha','Mecha']
  ];
  const FORMATS = [['','Todos os formatos'],['TV','Séries'],['MOVIE','Filmes'],['OVA','OVA'],['ONA','ONA'],['SPECIAL','Especiais']];
  const MODES = [
    ['ALL','Todos','grid'],['SOON','Em Breve','clock'],['SEASON','Temporada','season'],['TOP','Top Animes','trophy'],
    ['POPULAR','Mais Populares','fire'],['MEMBERS','Mais Membros','heart'],['SEARCH','Busca','search']
  ];
  const ICON = {
    grid:'<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="7" height="7" rx="1.7"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.7"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.7"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.7"/></svg>',
    clock:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    season:'<svg viewBox="0 0 24 24"><path d="M4 19c5-1 7-4 7-8-3 .3-6-1-7-3 4-2 7-1 9 3 1-4 4-6 7-7 0 6-2 9-7 10-1 3-2 5-5 7"/></svg>',
    trophy:'<svg viewBox="0 0 24 24"><path d="M8 4h8v4c0 4-2 7-4 7s-4-3-4-7V4Z"/><path d="M8 6H4v2c0 2 2 4 4 4M16 6h4v2c0 2-2 4-4 4M12 15v4M8 21h8"/></svg>',
    fire:'<svg viewBox="0 0 24 24"><path d="M13 2c1 4-2 5-1 8 1-2 3-3 4-5 3 3 5 6 5 10a9 9 0 1 1-18 0c0-4 2-7 5-10 0 3 1 4 2 5 0-3 1-5 3-8Z"/></svg>',
    heart:'<svg viewBox="0 0 24 24"><path d="M20.5 8.8c0 5-8.5 10-8.5 10s-8.5-5-8.5-10A4.6 4.6 0 0 1 12 6.4a4.6 4.6 0 0 1 8.5 2.4Z"/></svg>',
    search:'<svg viewBox="0 0 24 24"><circle cx="10.7" cy="10.7" r="6.6"/><path d="m15.7 15.7 4.5 4.5"/></svg>',
    star:'<svg viewBox="0 0 24 24"><path d="m12 3 2.8 5.5 6.1.9-4.4 4.3 1 6.1-5.5-2.9-5.5 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/></svg>',
    chevron:'<svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg>',
    tune:'<svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6"/></svg>',
    retry:'<svg viewBox="0 0 24 24"><path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 0-2 5"/></svg>',
    close:'<svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>'
  };

  const state = {
    mode:'ALL', page:1, search:'', genre:'', format:'', year:'',
    controller:null, token:0, loading:false, lastResult:null, mounted:false
  };

  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const titleOf = m => m?.title?.english || m?.title?.userPreferred || m?.title?.romaji || m?.title?.native || 'Anime';
  const imageOf = m => m?.coverImage?.extraLarge || m?.coverImage?.large || `${BASE}/assets/logo.png`;
  const scoreOf = m => m?.averageScore ? (m.averageScore/10).toFixed(1).replace('.0','') : '';
  const fmtNum = n => new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(Number(n)||0);
  const slug = s => String(s||'anime').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,90);
  const formatLabel = f => ({TV:'Série',TV_SHORT:'Série curta',MOVIE:'Filme',OVA:'OVA',ONA:'ONA',SPECIAL:'Especial',MUSIC:'Música'})[f] || f || 'Anime';
  const statusLabel = s => ({RELEASING:'Em exibição',FINISHED:'Finalizado',NOT_YET_RELEASED:'Em breve',HIATUS:'Em hiato',CANCELLED:'Cancelado'})[s] || '';
  const genreLabel = g => GENRES.find(x=>x[0]===g)?.[1] || g;

  function route(){
    const u=new URL(location.href);const p=u.searchParams.get('p');
    if(p) return p.split('?')[0].replace(/\/+$/,'')||'/';
    let path=u.pathname;if(IS_PAGES)path=path.replace(/^\/AniNexus/,'')||'/';
    return path.replace(/\/+$/,'')||'/';
  }
  function onCatalog(){ return route()===TARGET || !!window.__NX_CATALOG_BOOT__; }
  function currentSeason(){
    const now=new Date();
    const month=Number(new Intl.DateTimeFormat('en',{timeZone:'America/Sao_Paulo',month:'numeric'}).format(now));
    const year=Number(new Intl.DateTimeFormat('en',{timeZone:'America/Sao_Paulo',year:'numeric'}).format(now));
    return {year,season:month<=3?'WINTER':month<=6?'SPRING':month<=9?'SUMMER':'FALL'};
  }
  function hardGo(path){ location.href=IS_PAGES?`${BASE}/?build=${BUILD}&p=${encodeURIComponent(path)}`:path; }
  function openAnime(m){
    const path=`/anime/${slug(titleOf(m))}-${m.id}`;
    history.pushState({},'',`${BASE}${path}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  function readCache(key){
    try{const x=JSON.parse(sessionStorage.getItem(`nx:v20:catalog:${key}`)||'null');if(x&&Date.now()-x.t<CACHE_TTL)return x.d}catch{}
    return null;
  }
  function writeCache(key,data){try{sessionStorage.setItem(`nx:v20:catalog:${key}`,JSON.stringify({t:Date.now(),d:data}))}catch{}}
  const sleep = ms => new Promise(r=>setTimeout(r,ms));

  const FIELDS=`id title{romaji english native userPreferred} coverImage{extraLarge large color} averageScore popularity favourites episodes format status season seasonYear genres startDate{year month day} studios(isMain:true){nodes{name}}`;
  async function gql(query,variables,signal){
    let err;
    for(let attempt=0;attempt<3;attempt++){
      try{
        const res=await fetch(ENDPOINT,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({query,variables}),signal});
        if(res.status===429||res.status>=500) throw new Error(`HTTP ${res.status}`);
        if(!res.ok) throw new Error(`HTTP ${res.status}`);
        const json=await res.json();if(json.errors?.length)throw new Error(json.errors[0]?.message||'Falha na API');
        return json.data;
      }catch(e){err=e;if(e?.name==='AbortError')throw e;if(attempt<2)await sleep(500*(attempt+1)+Math.floor(Math.random()*180));}
    }
    throw err||new Error('Falha de rede');
  }

  function queryOptions(){
    const o={page:state.page,perPage:PER_PAGE,search:state.search||null,genre:state.genre||null,format:state.format||null,year:state.year?Number(state.year):null,status:null,season:null,seasonYear:null,sort:['START_DATE_DESC']};
    if(state.mode==='SOON'){o.status='NOT_YET_RELEASED';o.sort=['POPULARITY_DESC'];}
    else if(state.mode==='SEASON'){const s=currentSeason();o.season=s.season;o.seasonYear=state.year?Number(state.year):s.year;o.year=null;o.sort=['POPULARITY_DESC'];}
    else if(state.mode==='TOP')o.sort=['SCORE_DESC','POPULARITY_DESC'];
    else if(state.mode==='POPULAR')o.sort=['POPULARITY_DESC'];
    else if(state.mode==='MEMBERS')o.sort=['FAVOURITES_DESC'];
    else if(state.mode==='SEARCH')o.sort=state.search?['SEARCH_MATCH','POPULARITY_DESC']:['POPULARITY_DESC'];
    if(state.search&&state.mode!=='SEARCH')o.sort=['SEARCH_MATCH','POPULARITY_DESC'];
    return o;
  }

  async function fetchCatalog(){
    const o=queryOptions();
    const key=btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/=+$/,'').slice(0,180);
    const cached=readCache(key);if(cached)return cached;
    const q=`query($page:Int,$perPage:Int,$search:String,$genre:String,$format:MediaFormat,$year:String,$status:MediaStatus,$season:MediaSeason,$seasonYear:Int,$sort:[MediaSort]){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(type:ANIME,isAdult:false,search:$search,genre:$genre,format:$format,startDate_like:$year,status:$status,season:$season,seasonYear:$seasonYear,sort:$sort){${FIELDS}}}}`;
    const vars={...o,year:o.year?`${o.year}%`:null};
    const data=await gql(q,vars,state.controller?.signal);
    const result={pageInfo:data?.Page?.pageInfo||{},items:data?.Page?.media||[]};writeCache(key,result);return result;
  }

  function skeletons(n=PER_PAGE){return `<div class="nx20-cat-grid">${Array.from({length:n},()=>'<div class="nx20-cat-skeleton"></div>').join('')}</div>`;}
  function modeLabel(){return ({ALL:'Todos os animes',SOON:'Chegando em breve',SEASON:'Temporada atual',TOP:'Top Animes',POPULAR:'Mais populares',MEMBERS:'Mais membros',SEARCH:'Resultados da busca'})[state.mode]||'Catálogo';}
  function card(m){
    const year=m.seasonYear||m.startDate?.year||'';const score=scoreOf(m);const studio=m.studios?.nodes?.[0]?.name||'';const st=statusLabel(m.status);
    return `<article class="nx20-cat-card" tabindex="0" data-nx20-open="${m.id}">
      <div class="nx20-cat-poster"><img loading="lazy" decoding="async" src="${esc(imageOf(m))}" alt="${esc(titleOf(m))}">
        <div class="nx20-cat-shade"></div>
        ${score?`<span class="nx20-cat-score">${ICON.star}<b>${score}</b></span>`:''}
        ${st?`<span class="nx20-cat-status ${m.status==='NOT_YET_RELEASED'?'soon':''}">${esc(st)}</span>`:''}
      </div>
      <div class="nx20-cat-copy"><h3>${esc(titleOf(m))}</h3><div class="nx20-cat-meta"><span>${esc(formatLabel(m.format))}</span>${year?`<i></i><span>${year}</span>`:''}${m.episodes?`<i></i><span>${m.episodes} eps</span>`:''}</div>
      <p>${esc((m.genres||[]).slice(0,2).map(genreLabel).join(' · ')||studio||'Anime')}</p>
      <div class="nx20-cat-pop"><span>${fmtNum(m.popularity)} em popularidade</span>${studio?`<span>${esc(studio)}</span>`:''}</div></div>
    </article>`;
  }

  function years(){const y=new Date().getFullYear()+1;return Array.from({length:32},(_,i)=>y-i);}
  function renderShell(){
    document.body.classList.add('nx20-catalog-active');
    document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav==='anime'));
    app.innerHTML=`<section class="nx20-cat-hero"><div class="shell">
      <div class="nx20-cat-kicker">${ICON.grid}<span>CATÁLOGO</span></div>
      <div class="nx20-cat-heading"><div><h1>Catálogo de <em>Animes</em></h1><p>Todos os animes do catálogo, dos clássicos aos lançamentos da temporada.</p></div><div class="nx20-cat-stat"><strong id="nx20CatTotal">—</strong><span>títulos encontrados</span></div></div>
      <nav class="nx20-cat-tabs" aria-label="Modos do catálogo">${MODES.map(([k,n,ic])=>`<button type="button" class="${state.mode===k?'active':''}" data-nx20-mode="${k}">${ICON[ic]}<span>${n}</span></button>`).join('')}</nav>
      <div class="nx20-cat-tools">
        <label class="nx20-cat-search">${ICON.search}<input id="nx20CatSearch" type="search" autocomplete="off" placeholder="Buscar anime pelo título..." value="${esc(state.search)}"><button type="button" data-nx20-clear aria-label="Limpar busca">${ICON.close}</button></label>
        <select id="nx20CatGenre"><option value="">Todos os gêneros</option>${GENRES.map(([v,n])=>`<option value="${v}" ${state.genre===v?'selected':''}>${n}</option>`).join('')}</select>
        <select id="nx20CatFormat">${FORMATS.map(([v,n])=>`<option value="${v}" ${state.format===v?'selected':''}>${n}</option>`).join('')}</select>
        <select id="nx20CatYear"><option value="">Todos os anos</option>${years().map(y=>`<option value="${y}" ${String(state.year)===String(y)?'selected':''}>${y}</option>`).join('')}</select>
        <button type="button" class="nx20-cat-filter-reset" data-nx20-reset>${ICON.tune}<span>Limpar</span></button>
      </div>
      <div class="nx20-cat-chips" id="nx20CatChips"></div>
    </div></section>
    <section class="nx20-cat-body"><div class="shell">
      <div class="nx20-cat-line"><div><small>EXPLORAR</small><h2 id="nx20CatTitle">${modeLabel()}</h2></div><span id="nx20CatPageLabel"></span></div>
      <div id="nx20CatGrid">${skeletons()}</div>
      <nav class="nx20-cat-pages" id="nx20CatPages" aria-label="Paginação"></nav>
    </div></section>`;
    bindControls();renderChips();load();
  }

  function renderChips(){
    const el=document.querySelector('#nx20CatChips');if(!el)return;const chips=[];
    if(state.search)chips.push(['search',`Busca: ${state.search}`]);if(state.genre)chips.push(['genre',genreLabel(state.genre)]);
    if(state.format)chips.push(['format',formatLabel(state.format)]);if(state.year)chips.push(['year',String(state.year)]);
    el.innerHTML=chips.map(([k,v])=>`<button type="button" data-nx20-chip="${k}">${esc(v)} ${ICON.close}</button>`).join('');
    el.querySelectorAll('[data-nx20-chip]').forEach(b=>b.onclick=()=>{state[b.dataset.nx20Chip]='';state.page=1;syncInputs();renderChips();load();});
  }

  function syncInputs(){
    const s=document.querySelector('#nx20CatSearch'),g=document.querySelector('#nx20CatGenre'),f=document.querySelector('#nx20CatFormat'),y=document.querySelector('#nx20CatYear');
    if(s)s.value=state.search;if(g)g.value=state.genre;if(f)f.value=state.format;if(y)y.value=state.year;
  }

  function bindControls(){
    document.querySelectorAll('[data-nx20-mode]').forEach(b=>b.onclick=()=>{
      state.mode=b.dataset.nx20Mode;state.page=1;
      document.querySelectorAll('[data-nx20-mode]').forEach(x=>x.classList.toggle('active',x===b));
      document.querySelector('#nx20CatTitle').textContent=modeLabel();
      if(state.mode==='SEARCH')document.querySelector('#nx20CatSearch')?.focus();load();
    });
    let timer;
    const search=document.querySelector('#nx20CatSearch');
    search.oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>{state.search=search.value.trim();state.page=1;if(state.search)state.mode='SEARCH';syncModeButtons();renderChips();load();},320);};
    document.querySelector('[data-nx20-clear]').onclick=()=>{state.search='';state.page=1;search.value='';renderChips();load();search.focus();};
    document.querySelector('#nx20CatGenre').onchange=e=>{state.genre=e.target.value;state.page=1;renderChips();load();};
    document.querySelector('#nx20CatFormat').onchange=e=>{state.format=e.target.value;state.page=1;renderChips();load();};
    document.querySelector('#nx20CatYear').onchange=e=>{state.year=e.target.value;state.page=1;renderChips();load();};
    document.querySelector('[data-nx20-reset]').onclick=()=>{state.search=state.genre=state.format=state.year='';state.page=1;syncInputs();renderChips();load();};
  }
  function syncModeButtons(){document.querySelectorAll('[data-nx20-mode]').forEach(x=>x.classList.toggle('active',x.dataset.nx20Mode===state.mode));document.querySelector('#nx20CatTitle').textContent=modeLabel();}

  function pages(info){
    const root=document.querySelector('#nx20CatPages');if(!root)return;
    const cur=Number(info.currentPage||state.page||1),last=Math.min(Number(info.lastPage||1),999);
    if(last<=1){root.innerHTML='';return;}
    const set=new Set([1,last,cur-2,cur-1,cur,cur+1,cur+2].filter(x=>x>=1&&x<=last));const nums=[...set].sort((a,b)=>a-b);let prev=0,out='';
    for(const n of nums){if(prev&&n-prev>1)out+='<span>…</span>';out+=`<button type="button" class="${n===cur?'active':''}" data-nx20-page="${n}">${n}</button>`;prev=n;}
    root.innerHTML=`<button type="button" class="nav" data-nx20-page="${Math.max(1,cur-1)}" ${cur===1?'disabled':''}>‹</button>${out}<button type="button" class="nav" data-nx20-page="${Math.min(last,cur+1)}" ${cur===last?'disabled':''}>›</button>`;
    root.querySelectorAll('[data-nx20-page]').forEach(b=>b.onclick=()=>{const p=Number(b.dataset.nx20Page);if(!p||p===cur)return;state.page=p;load();document.querySelector('.nx20-cat-body')?.scrollIntoView({behavior:'smooth',block:'start'});});
  }

  function bindCards(items){
    const byId=new Map(items.map(m=>[String(m.id),m]));
    document.querySelectorAll('[data-nx20-open]').forEach(el=>{
      const open=()=>{const m=byId.get(el.dataset.nx20Open);if(m)openAnime(m);};
      el.onclick=e=>{if(e.target.closest('a,button'))return;open();};
      el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}};
    });
    document.querySelectorAll('.nx20-cat-poster img').forEach(img=>img.addEventListener('error',()=>{img.src=`${BASE}/assets/logo.png`;img.classList.add('fallback');},{once:true}));
  }

  async function load(){
    const grid=document.querySelector('#nx20CatGrid');if(!grid)return;
    state.controller?.abort();state.controller=new AbortController();const token=++state.token;state.loading=true;
    grid.innerHTML=skeletons();document.querySelector('#nx20CatPages').innerHTML='';document.querySelector('#nx20CatPageLabel').textContent='Carregando…';
    try{
      const result=await fetchCatalog();if(token!==state.token||!document.querySelector('#nx20CatGrid'))return;
      state.lastResult=result;state.loading=false;
      const items=result.items||[],info=result.pageInfo||{};const total=Number(info.total||items.length);
      document.querySelector('#nx20CatTotal').textContent=total.toLocaleString('pt-BR');
      document.querySelector('#nx20CatPageLabel').textContent=`Página ${info.currentPage||state.page} de ${Math.min(info.lastPage||1,999)}`;
      document.querySelector('#nx20CatTitle').textContent=modeLabel();
      grid.innerHTML=items.length?`<div class="nx20-cat-grid">${items.map(card).join('')}</div>`:`<div class="nx20-cat-empty"><img src="${BASE}/assets/logo.png" alt=""><h3>Nenhum anime encontrado</h3><p>Tente remover algum filtro ou pesquisar por outro título.</p><button type="button" data-nx20-reset-empty>Limpar filtros</button></div>`;
      grid.querySelector('[data-nx20-reset-empty]')?.addEventListener('click',()=>{state.search=state.genre=state.format=state.year='';state.page=1;syncInputs();renderChips();load();});
      pages(info);bindCards(items);
    }catch(err){
      if(err?.name==='AbortError'||token!==state.token)return;state.loading=false;
      grid.innerHTML=`<div class="nx20-cat-error">${ICON.retry}<h3>Não foi possível carregar o catálogo</h3><p>A conexão com a base de animes falhou. O AniNexus vai tentar novamente sem perder seus filtros.</p><button type="button" data-nx20-retry>${ICON.retry} Tentar novamente</button></div>`;
      document.querySelector('#nx20CatPageLabel').textContent='Falha ao carregar';
      grid.querySelector('[data-nx20-retry]').onclick=load;
    }
  }

  function mount(force=false){
    if(!onCatalog()&&!force)return;
    if(window.__NX_CATALOG_BOOT__){history.replaceState({},'',`${BASE}${TARGET}`);window.__NX_CATALOG_BOOT__=false;}
    if(route()!==TARGET)return;
    if(state.mounted&&document.querySelector('.nx20-cat-hero'))return;
    state.mounted=true;renderShell();
  }
  function unmount(){if(route()===TARGET)return;state.controller?.abort();state.mounted=false;document.body.classList.remove('nx20-catalog-active');}

  document.addEventListener('click',e=>{
    const a=e.target.closest('a[href]');if(!a)return;
    try{const u=new URL(a.href,location.href);let p=u.pathname;if(IS_PAGES)p=p.replace(/^\/AniNexus/,'')||'/';p=p.replace(/\/+$/,'')||'/';if(p!==TARGET)return;
      if(e.button&&e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();hardGo(TARGET);
    }catch{}
  },true);
  window.addEventListener('popstate',()=>setTimeout(()=>{route()===TARGET?mount(true):unmount();},0));
  new MutationObserver(()=>{if(route()===TARGET&&!document.querySelector('.nx20-cat-hero'))mount(true);}).observe(app,{childList:true,subtree:false});
  mount();
})();
