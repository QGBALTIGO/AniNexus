'use strict';
(() => {
  const root=document.querySelector('#app');
  if(!root)return;
  const API='https://graphql.anilist.co';
  const JIKAN='https://api.jikan.moe/v4';
  const IS_PAGES=location.hostname.endsWith('github.io');
  const BASE=IS_PAGES?'/AniNexus':'';
  const CACHE_TTL=20*60*1000;
  let activeId=0,painting=false,observerRaf=0;

  const SVG={
    back:'<svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg>',
    plus:'<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    heart:'<svg viewBox="0 0 24 24"><path d="M20.5 8.8c0 5-8.5 10-8.5 10s-8.5-5-8.5-10A4.6 4.6 0 0 1 12 6.4a4.6 4.6 0 0 1 8.5 2.4Z"/></svg>',
    star:'<svg viewBox="0 0 24 24"><path d="m12 3 2.8 5.5 6.1.9-4.4 4.3 1 6.1-5.5-2.9-5.5 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/></svg>',
    play:'<svg viewBox="0 0 24 24"><path d="m9 6 9 6-9 6V6Z"/></svg>',
    clock:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>',
    external:'<svg viewBox="0 0 24 24"><path d="M13 5h6v6M19 5l-8 8"/><path d="M11 7H5v12h12v-6"/></svg>',
    share:'<svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.5-4.4M8.2 13.2l7.5 4.4"/></svg>'
  };
  const FORMAT={TV:'Série',TV_SHORT:'Série curta',MOVIE:'Filme',OVA:'OVA',ONA:'ONA',SPECIAL:'Especial',MUSIC:'Música'};
  const STATUS={RELEASING:'Em exibição',FINISHED:'Finalizado',NOT_YET_RELEASED:'Ainda não lançado',HIATUS:'Em hiato',CANCELLED:'Cancelado'};
  const SOURCE={MANGA:'Mangá',LIGHT_NOVEL:'Light novel',ORIGINAL:'Original',NOVEL:'Novel',GAME:'Jogo',VISUAL_NOVEL:'Visual novel',WEB_NOVEL:'Web novel',OTHER:'Outra mídia'};
  const SEASON={WINTER:'Inverno',SPRING:'Primavera',SUMMER:'Verão',FALL:'Outono'};
  const COUNTRY={JP:'Japão',KR:'Coreia do Sul',CN:'China',TW:'Taiwan',US:'Estados Unidos',FR:'França'};
  const GENRE={Action:'Ação',Adventure:'Aventura',Comedy:'Comédia',Drama:'Drama',Fantasy:'Fantasia',Horror:'Terror',Mystery:'Mistério',Romance:'Romance','Sci-Fi':'Ficção Científica','Slice of Life':'Cotidiano',Sports:'Esportes',Supernatural:'Sobrenatural',Thriller:'Suspense',Psychological:'Psicológico',Music:'Música',Mecha:'Mecha'};
  const REL={ADAPTATION:'Adaptação',PREQUEL:'Prequela',SEQUEL:'Sequência',PARENT:'Obra principal',SIDE_STORY:'História paralela',SUMMARY:'Resumo',ALTERNATIVE:'Alternativa',SPIN_OFF:'Spin-off',SOURCE:'Fonte',COMPILATION:'Compilação',CONTAINS:'Contém',OTHER:'Relacionado'};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const strip=v=>{const d=document.createElement('div');d.innerHTML=String(v||'');return(d.textContent||'').replace(/\s+/g,' ').trim()};
  const title=m=>m?.title?.english||m?.title?.userPreferred||m?.title?.romaji||m?.title?.native||'Anime';
  const image=m=>m?.coverImage?.extraLarge||m?.coverImage?.large||`${BASE}/assets/logo.png`;
  const banner=m=>m?.bannerImage||image(m);
  const score=m=>m?.averageScore?String((m.averageScore/10).toFixed(1)).replace('.0',''):'—';
  const compact=n=>n?new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(Number(n)):'—';

  function routePath(){try{const u=new URL(location.href),p=u.searchParams.get('p');if(p)return p.split('?')[0].replace(/\/+$/,'')||'/';let x=u.pathname;if(IS_PAGES)x=x.replace(/^\/AniNexus/,'')||'/';return x.replace(/\/+$/,'')||'/'}catch{return'/'}}
  function animeId(){const m=routePath().match(/^\/anime\/.+-(\d+)$/);return m?Number(m[1]):0}
  function activate(id){activeId=id;document.body.classList.add('nx22-detail-active');document.body.classList.remove('nx22-news-active','nx-detail-active','nx-season-active','season-v7-active','season-v8-active');root.dataset.nx22DetailId=String(id);document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav==='anime'))}
  function deactivate(){document.body.classList.remove('nx22-detail-active');delete root.dataset.nx22DetailId;activeId=0}
  function fmtDate(d){if(!d?.year)return'—';const x=new Date(Date.UTC(Number(d.year),Math.max(0,Number(d.month||1)-1),Number(d.day||1),12));return new Intl.DateTimeFormat('pt-BR',{day:d.day?'2-digit':undefined,month:d.month?'long':undefined,year:'numeric',timeZone:'UTC'}).format(x)}
  function fmtUntil(ts){const ms=Number(ts||0)*1000-Date.now();if(ms<=0)return'Em instantes';const d=Math.floor(ms/864e5),h=Math.floor(ms%864e5/36e5),m=Math.floor(ms%36e5/6e4);return d?`${d}d ${h}h ${m}min`:`${h}h ${m}min`}
  function slug(s='anime'){return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,80)||'anime'}
  function pathTo(m){return `/anime/${slug(title(m))}-${m.id}`}
  function openAnime(m){const p=pathTo(m);if(IS_PAGES)location.href=`${BASE}/?build=22.1.0&p=${encodeURIComponent(p)}`;else{history.pushState({},'',p);window.dispatchEvent(new PopStateEvent('popstate'))}}

  async function gql(q,v){const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({query:q,variables:v})});if(!r.ok)throw new Error(`Falha ao consultar o catálogo (${r.status})`);const j=await r.json();if(j.errors?.length)throw new Error(j.errors[0]?.message||'Falha ao consultar o anime');return j.data}
  const CORE=`id idMal title{romaji english native userPreferred} synonyms coverImage{extraLarge large color} bannerImage description genres tags{name rank isMediaSpoiler} averageScore meanScore popularity favourites episodes duration format status season seasonYear countryOfOrigin source startDate{year month day} endDate{year month day} studios(isMain:true){nodes{id name}} nextAiringEpisode{airingAt episode timeUntilAiring} trailer{id site thumbnail} externalLinks{site url type icon color}`;
  async function fetchCore(id){const q=`query($id:Int){Media(id:$id,type:ANIME){${CORE}}}`;const d=await gql(q,{id});if(!d?.Media)throw new Error('Anime não encontrado');return d.Media}
  async function fetchExtras(id){const q=`query($id:Int){Media(id:$id,type:ANIME){characters(perPage:14){edges{role node{id name{full native} image{large medium}}}} staff(perPage:12){edges{role node{id name{full native} image{large medium}}}} relations{edges{relationType node{id type format status seasonYear averageScore title{romaji english native userPreferred} coverImage{extraLarge large}}}} recommendations(perPage:8){nodes{rating mediaRecommendation{id type format status seasonYear averageScore title{romaji english native userPreferred} coverImage{extraLarge large}}}}}}`;try{return(await gql(q,{id}))?.Media||{}}catch{return{}}}
  async function fetchJikan(id){if(!id)return null;try{const r=await fetch(`${JIKAN}/anime/${id}/full`,{headers:{accept:'application/json'}});if(!r.ok)return null;return(await r.json())?.data||null}catch{return null}}
  function cacheRead(id){try{const x=JSON.parse(sessionStorage.getItem(`nx22s:detail:${id}`)||'null');if(x&&Date.now()-x.t<CACHE_TTL&&x.data?.id)return x.data}catch{}return null}
  function cacheWrite(id,data){try{sessionStorage.setItem(`nx22s:detail:${id}`,JSON.stringify({t:Date.now(),data}))}catch{}}

  function generatedSynopsis(m){const gs=(m.genres||[]).slice(0,3).map(g=>GENRE[g]||g).join(', ');return `${title(m)} é ${m.format==='MOVIE'?'um filme':'um anime'}${gs?` de ${gs}`:''}${m.source?`, baseado em ${SOURCE[m.source]||String(m.source).toLowerCase()}`:''}. A sinopse editorial em português está sendo preparada.`}
  async function translatePT(raw){raw=strip(raw);if(!raw)return'';const key='nx22s:pt:'+btoa(unescape(encodeURIComponent(raw.slice(0,120)))).replace(/=/g,'').slice(0,80);try{const c=localStorage.getItem(key);if(c)return c}catch{};try{const u=`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=pt&dt=t&q=${encodeURIComponent(raw.slice(0,3600))}`;const r=await fetch(u);if(!r.ok)throw 0;const j=await r.json(),x=(j?.[0]||[]).map(v=>v?.[0]||'').join('').trim();if(x){try{localStorage.setItem(key,x)}catch{};return x}}catch{}return''}

  function infoRows(m,j){const studios=(m.studios?.nodes||[]).map(x=>x.name).filter(Boolean).join(', ')||'—';const rows=[['Status',STATUS[m.status]||'—'],['Formato',FORMAT[m.format]||m.format||'—'],['Episódios',m.episodes||j?.episodes||'—'],['Duração',m.duration?`${m.duration} min`:j?.duration||'—'],['Origem',SOURCE[m.source]||m.source||'—'],['País',COUNTRY[m.countryOfOrigin]||m.countryOfOrigin||'—'],['Temporada',m.season?`${SEASON[m.season]||m.season} ${m.seasonYear||''}`:'—'],['Lançamento',fmtDate(m.startDate)],['Término',fmtDate(m.endDate)],['Estúdio',studios],['Classificação',j?.rating||'—']];return rows.map(([k,v])=>`<div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('')}
  function people(edges,staff=false){return (edges||[]).map(e=>{const n=e.node||{};return `<article class="nx22-person"><img loading="lazy" src="${esc(n.image?.large||n.image?.medium||BASE+'/assets/logo.png')}" alt=""><strong>${esc(n.name?.full||'')}</strong><span>${esc(staff?(e.role||'Equipe'):(e.role==='MAIN'?'Principal':'Coadjuvante'))}</span></article>`}).join('')}
  function related(edges){return (edges||[]).filter(e=>e.node).map(e=>{const m=e.node;return `<article class="nx22-related" data-nx22-open="${m.id}"><div class="nx22-related-cover"><img loading="lazy" src="${esc(image(m))}" alt=""></div><div><small>${esc(REL[e.relationType]||'Relacionado')}</small><strong>${esc(title(m))}</strong><span>${esc([FORMAT[m.format]||m.format,m.seasonYear].filter(Boolean).join(' · '))}</span></div></article>`}).join('')}
  function recs(nodes){return (nodes||[]).filter(x=>x.mediaRecommendation).map(x=>{const m=x.mediaRecommendation;return `<article class="nx22-rec" data-nx22-open="${m.id}"><div><img loading="lazy" src="${esc(image(m))}" alt="">${m.averageScore?`<span>${SVG.star}${score(m)}</span>`:''}</div><strong>${esc(title(m))}</strong><small>${esc([FORMAT[m.format]||m.format,m.seasonYear].filter(Boolean).join(' · '))}</small></article>`}).join('')}

  function shell(m,j,extras){
    const stream=(m.externalLinks||[]).filter(x=>String(x.type||'').toUpperCase()==='STREAMING'&&x.url);
    const trailer=m.trailer?.id&&String(m.trailer.site||'').toLowerCase()==='youtube'?m.trailer.id:'';
    const start=fmtDate(m.startDate),end=fmtDate(m.endDate);
    activate(m.id);
    root.innerHTML=`<article class="nx22-detail">
      <section class="nx22-hero"><div class="nx22-hero-bg"><img src="${esc(banner(m))}" alt=""></div><div class="nx22-hero-shade"></div><div class="nx22-shell nx22-hero-content"><button class="nx22-back" data-nx22-back>${SVG.back}<span>Voltar</span></button><div class="nx22-hero-grid"><div class="nx22-cover"><img src="${esc(image(m))}" alt="${esc(title(m))}"></div><div class="nx22-headcopy"><span class="nx22-eyebrow">${esc(m.title?.romaji||m.title?.native||'')}</span><h1>${esc(title(m))}</h1><div class="nx22-chips"><span>${esc(STATUS[m.status]||'Anime')}</span><span>${esc(FORMAT[m.format]||m.format||'Anime')}</span>${(m.genres||[]).slice(0,4).map(g=>`<span class="genre">${esc(GENRE[g]||g)}</span>`).join('')}</div><div class="nx22-actions"><button class="nx22-list" data-list="${m.id}">${SVG.plus}<span>Adicionar à lista</span></button><button class="nx22-fav" data-fav="${m.id}" aria-label="Favoritar">${SVG.heart}</button><button class="nx22-share" data-nx22-share>${SVG.share}<span>Compartilhar</span></button></div><div class="nx22-stats"><div><strong>${score(m)}</strong><span>nota média</span></div><div><strong>${compact(m.popularity)}</strong><span>popularidade</span></div><div><strong>${compact(m.favourites)}</strong><span>favoritos</span></div></div></div></div></div></section>
      <nav class="nx22-tabs"><div class="nx22-shell"><button class="active" data-nx22-tab="geral">Geral</button><button data-nx22-tab="personagens">Personagens</button><button data-nx22-tab="franquia">Franquia</button><button data-nx22-tab="recomendacoes">Recomendações</button></div></nav>
      <div class="nx22-shell nx22-content"><div class="nx22-quick"><article><small>LANÇAMENTO</small><strong>${esc(start)}</strong></article><article><small>TÉRMINO</small><strong>${esc(end)}</strong></article><article><small>EPISÓDIOS</small><strong>${esc(m.episodes||j?.episodes||'—')}</strong></article><article><small>STATUS</small><strong>${esc(STATUS[m.status]||'—')}</strong></article></div><div id="nx22StablePanel"></div></div>
    </article>`;

    const general=()=>`<div class="nx22-layout"><main>${m.nextAiringEpisode?`<section class="nx22-next"><div>${SVG.clock}<span><small>PRÓXIMO EPISÓDIO</small><strong>Episódio ${m.nextAiringEpisode.episode}</strong><em>${fmtUntil(m.nextAiringEpisode.airingAt)}</em></span></div></section>`:''}<section class="nx22-section"><div class="nx22-section-head"><div><small>HISTÓRIA</small><h2>Sinopse</h2></div><span class="nx22-translation-note">em português</span></div><p class="nx22-synopsis" id="nx22Synopsis">${esc(generatedSynopsis(m))}</p></section>${trailer?`<section class="nx22-section"><div class="nx22-section-head"><div><small>VÍDEO</small><h2>Trailer oficial</h2></div></div><div class="nx22-video"><iframe loading="lazy" src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(trailer)}?rel=0&modestbranding=1" title="Trailer de ${esc(title(m))}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div></section>`:''}${stream.length?`<section class="nx22-section"><div class="nx22-section-head"><div><small>STREAMING</small><h2>Onde assistir</h2></div></div><div class="nx22-streams">${stream.map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener">${s.icon?`<img src="${esc(s.icon)}" alt="">`:SVG.play}<span>${esc(s.site||'Streaming')}</span>${SVG.external}</a>`).join('')}</div></section>`:''}${extras.characters?.edges?.length?`<section class="nx22-section"><div class="nx22-section-head"><div><small>ELENCO</small><h2>Personagens</h2></div></div><div class="nx22-people">${people(extras.characters.edges)}</div></section>`:''}</main><aside><div><h3>Informações</h3><div class="nx22-info-card">${infoRows(m,j)}</div></div><div><h3>Outros títulos</h3><div class="nx22-info-card"><div><span>Romaji</span><strong>${esc(m.title?.romaji||'—')}</strong></div><div><span>Original</span><strong>${esc(m.title?.native||'—')}</strong></div>${(m.synonyms||[]).slice(0,2).map(s=>`<div><span>Alternativo</span><strong>${esc(s)}</strong></div>`).join('')}</div></div></aside></div>`;
    const chars=()=>`<section class="nx22-full"><div class="nx22-section-head"><div><small>PERSONAGENS</small><h2>Elenco e equipe</h2></div></div><div class="nx22-people nx22-people-full">${people(extras.characters?.edges||[])}</div>${extras.staff?.edges?.length?`<div class="nx22-section-head nx22-staff-head"><div><small>PRODUÇÃO</small><h2>Equipe</h2></div></div><div class="nx22-people nx22-people-full">${people(extras.staff.edges,true)}</div>`:''}</section>`;
    const franchise=()=>`<section class="nx22-full"><div class="nx22-section-head"><div><small>UNIVERSO</small><h2>Franquia e relações</h2></div></div><div class="nx22-related-grid">${related(extras.relations?.edges||[])||'<p class="nx22-synopsis">Nenhuma relação disponível.</p>'}</div></section>`;
    const recommendations=()=>`<section class="nx22-full"><div class="nx22-section-head"><div><small>PARA ASSISTIR DEPOIS</small><h2>Recomendações</h2></div></div><div class="nx22-rec-grid">${recs(extras.recommendations?.nodes||[])||'<p class="nx22-synopsis">Sem recomendações disponíveis agora.</p>'}</div></section>`;
    const panels={geral:general,personagens:chars,franquia:franchise,recomendacoes:recommendations};
    function show(k){root.querySelectorAll('[data-nx22-tab]').forEach(b=>b.classList.toggle('active',b.dataset.nx22Tab===k));const p=root.querySelector('#nx22StablePanel');if(p)p.innerHTML=(panels[k]||general)();if(k==='geral')hydrateSynopsis(m)}
    root.querySelectorAll('[data-nx22-tab]').forEach(b=>b.onclick=()=>show(b.dataset.nx22Tab));
    root.querySelector('[data-nx22-back]')?.addEventListener('click',()=>history.back());
    root.querySelector('[data-nx22-share]')?.addEventListener('click',async()=>{try{if(navigator.share)await navigator.share({title:title(m),url:location.href});else{await navigator.clipboard.writeText(location.href)}}catch{}});
    root.querySelectorAll('[data-nx22-open]').forEach(el=>el.onclick=()=>{const id=Number(el.dataset.nx22Open),node=(extras.relations?.edges||[]).map(x=>x.node).concat((extras.recommendations?.nodes||[]).map(x=>x.mediaRecommendation)).find(x=>x?.id===id);if(node)openAnime(node)});
    show('geral');
    window.AniNexusMediaState?.sync?.(m.id);
    document.title=`${title(m)} | AniNexus`;
  }

  async function hydrateSynopsis(m){const el=root.querySelector('#nx22Synopsis');if(!el)return;const raw=strip(m.description)||strip(m.jikan?.synopsis||'');const pt=await translatePT(raw);if(el&&animeId()===m.id)el.textContent=pt||generatedSynopsis(m)}
  function loading(id){activate(id);root.innerHTML=`<article class="nx22-detail nx22-loading"><div class="nx22-loading-banner"></div><div class="nx22-shell nx22-loading-body"><div class="nx22-loading-cover"></div><div><i></i><i></i><i></i><p>Carregando informações do anime…</p></div></div></article>`}
  function fail(id,e){activate(id);root.innerHTML=`<article class="nx22-detail nx22-fail"><div><img src="${BASE}/assets/logo.png" alt=""><h1>Não foi possível carregar este anime</h1><p>${esc(e?.message||'Falha de conexão.')}</p><button type="button" data-nx22-retry>Tentar novamente</button></div></article>`;root.querySelector('[data-nx22-retry]')?.addEventListener('click',()=>render(id,true))}

  async function render(id,force=false){if(!id||painting)return;if(!force&&activeId===id&&root.firstElementChild?.classList.contains('nx22-detail'))return;painting=true;try{let cached=!force?cacheRead(id):null;if(cached){shell(cached,cached.jikan||null,cached.extras||{});return}loading(id);const core=await fetchCore(id);if(animeId()!==id)return;const [extras,j]=await Promise.all([fetchExtras(id),fetchJikan(core.idMal)]);const m={...core,jikan:j,extras};cacheWrite(id,m);if(animeId()===id)shell(m,j,extras)}catch(e){if(animeId()===id)fail(id,e)}finally{painting=false}}
  function claim(force=false){const id=animeId();if(!id){if(activeId)deactivate();return}render(id,force)}
  const mo=new MutationObserver(()=>{if(observerRaf)return;observerRaf=requestAnimationFrame(()=>{observerRaf=0;const id=animeId();if(id&&!root.firstElementChild?.classList.contains('nx22-detail'))render(id,true)})});mo.observe(root,{childList:true});
  addEventListener('popstate',()=>setTimeout(()=>claim(true),0));document.addEventListener('aninexus:routechange',()=>setTimeout(()=>claim(true),0));claim(true);
})();