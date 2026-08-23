'use strict';
(() => {
  const app=document.querySelector('#app');
  if(!app)return;

  const API='https://graphql.anilist.co';
  const IS_PAGES=location.hostname.endsWith('github.io');
  const BASE=IS_PAGES?'/AniNexus':'';
  const BUILD='28.0.0';
  const TZ='America/Sao_Paulo';
  const CACHE_KEY='aninexus:home:v28';
  const CACHE_TTL=8*60*1000;
  let mounted=false;
  let paintToken=0;
  let countdownTimer=null;
  let remountTimer=null;

  const ICON={
    arrow:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M14 7.5 18.5 12 14 16.5"/></svg>',
    chevron:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>',
    back:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>',
    star:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.5 6.1.9-4.4 4.3 1 6.1-5.5-2.9-5.5 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/></svg>',
    plus:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    heart:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.7 8.7c0 5-8.7 10.1-8.7 10.1S3.3 13.7 3.3 8.7A4.6 4.6 0 0 1 12 6.2a4.6 4.6 0 0 1 8.7 2.5Z"/></svg>',
    clock:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    chat:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v11H9l-5 3v-14Z"/><path d="M8 9h8M8 12.5h5"/></svg>',
    trophy:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v4c0 4-1.7 7-4 7s-4-3-4-7V4Z"/><path d="M8 6H4v2c0 2.4 1.7 4 4.2 4M16 6h4v2c0 2.4-1.7 4-4.2 4M12 15v4M8 21h8"/></svg>'
  };

  const GENRE={Action:'Ação',Adventure:'Aventura',Comedy:'Comédia',Drama:'Drama',Fantasy:'Fantasia',Horror:'Terror',Mystery:'Mistério',Romance:'Romance','Sci-Fi':'Ficção Científica','Slice of Life':'Slice of Life',Sports:'Esportes',Supernatural:'Sobrenatural',Thriller:'Suspense',Music:'Música',Psychological:'Psicológico',Mecha:'Mecha'};
  const STATUS={PLANNING:'quer ver',CURRENT:'está assistindo',COMPLETED:'terminou',PAUSED:'pausou',DROPPED:'desistiu'};
  const TAGS=['Ação','Artes Marciais','Aventura','Comédia','Demônios','Drama','Ecchi','Escola','Esportes','Fantasia','Ficção Científica','Garota Mágica','Gore','Harém','Histórico','Infantil','Isekai','Josei','LGBTQIA+','Magia','Mecha','Militar','Mistério','Monstros','Música','Paródia','Psicológico','Romance','Seinen','Shoujo','Shounen','Slice of Life','Sobrenatural','Superpoderes','Suspense','Terror','Torneio'];
  const AWARDS=[
    ['Anime do Ano','My Hero Academia Final Season'],
    ['Filme do Ano','Demon Slayer Infinity Castle'],
    ['Melhor Continuação','One Piece'],
    ['Melhor Série Estreante','Gachiakuta'],
    ['Melhor Anime Original','Lazarus'],
    ['Melhor Animação','Solo Leveling Season 2'],
    ['Melhor Romance','The Fragrant Flower Blooms With Dignity']
  ];
  const FIELDS='id title{romaji english native userPreferred} coverImage{extraLarge large} bannerImage averageScore popularity genres episodes format status seasonYear nextAiringEpisode{airingAt episode}';

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const title=m=>m?.title?.english||m?.title?.userPreferred||m?.title?.romaji||m?.title?.native||'Anime';
  const image=m=>m?.coverImage?.extraLarge||m?.coverImage?.large||'';
  const score=m=>m?.averageScore?String((Number(m.averageScore)/10).toFixed(1)).replace('.0',''):'';
  const slug=s=>String(s||'anime').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,90)||'anime';
  const read=(k,f)=>{try{const x=JSON.parse(localStorage.getItem(k)||'null');return x??f}catch{return f}};
  const setOf=k=>new Set((read(k,[])||[]).map(Number));

  function route(){
    try{
      const u=new URL(location.href),restored=u.searchParams.get('p');
      if(restored)return restored.split('?')[0].replace(/\/+$/,'')||'/';
      let p=u.pathname;
      if(IS_PAGES)p=p.replace(/^\/AniNexus/,'')||'/';
      return p.replace(/\/+$/,'')||'/';
    }catch{return'/'}
  }
  function wantsHome(){const p=route();return !!window.__NX_HOME_DEDICATED__||p==='/'||p==='/__nx_home_boot__'}
  function restoreHomeUrl(){
    if(!window.__NX_HOME_DEDICATED__)return;
    history.replaceState({},'',IS_PAGES?`${BASE}/?build=${BUILD}&p=%2F`:'/');
    delete window.__NX_HOME_DEDICATED__;
    delete window.__NX_HOME_V24_BOOT__;
    document.documentElement.classList.remove('nx24-home-boot');
  }
  function navigate(path){location.assign(IS_PAGES?`${BASE}/?build=${BUILD}&p=${encodeURIComponent(path)}`:path)}
  function seasonNow(){
    const d=new Date();
    const month=Number(new Intl.DateTimeFormat('en',{timeZone:TZ,month:'numeric'}).format(d));
    const year=Number(new Intl.DateTimeFormat('en',{timeZone:TZ,year:'numeric'}).format(d));
    return{year,season:month<=3?'WINTER':month<=6?'SPRING':month<=9?'SUMMER':'FALL',label:month<=3?'Inverno':month<=6?'Primavera':month<=9?'Verão':'Outono'};
  }
  function relative(value){
    const ts=typeof value==='string'?Date.parse(value):Number(value||0);
    if(!ts)return'';
    const d=Math.max(0,Date.now()-ts);
    if(d<60000)return'agora';
    if(d<3600000)return`há ${Math.floor(d/60000)}min`;
    if(d<86400000)return`há ${Math.floor(d/3600000)}h`;
    const days=Math.floor(d/86400000);return`há ${days}d`;
  }
  function countdown(ts){
    const d=Number(ts)*1000-Date.now();
    if(d<=0)return'Em instantes';
    const days=Math.floor(d/86400000),hours=Math.floor(d%86400000/3600000),minutes=Math.floor(d%3600000/60000),seconds=Math.floor(d%60000/1000);
    return days?`${days}d ${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}`:`${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
  }
  function cacheRead(){try{const x=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');if(!x?.savedAt||!x.data||Date.now()-x.savedAt>CACHE_TTL)return null;return x.data}catch{return null}}
  function cacheWrite(data){try{localStorage.setItem(CACHE_KEY,JSON.stringify({savedAt:Date.now(),data}))}catch{}}

  async function gql(query,variables={},timeout=9000){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
    try{
      const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({query,variables}),signal:controller.signal});
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      const j=await r.json();
      if(j.errors?.length)throw new Error(j.errors[0]?.message||'GraphQL error');
      return j.data;
    }finally{clearTimeout(timer)}
  }

  async function loadPublic(){
    const s=seasonNow(),now=Math.floor(Date.now()/1000);
    const q=`query($season:MediaSeason,$year:Int,$now:Int){
      season:Page(page:1,perPage:24){media(type:ANIME,isAdult:false,season:$season,seasonYear:$year,sort:[POPULARITY_DESC]){${FIELDS}}}
      schedule:Page(page:1,perPage:10){airingSchedules(airingAt_greater:$now,sort:TIME){airingAt episode media{${FIELDS}}}}
      top:Page(page:1,perPage:10){media(type:ANIME,isAdult:false,sort:[SCORE_DESC]){${FIELDS}}}
      popular:Page(page:1,perPage:24){media(type:ANIME,isAdult:false,sort:[POPULARITY_DESC]){${FIELDS}}}
      soon:Page(page:1,perPage:24){media(type:ANIME,isAdult:false,status:NOT_YET_RELEASED,sort:[POPULARITY_DESC]){${FIELDS}}}
    }`;
    const d=await gql(q,{season:s.season,year:s.year,now});
    return{season:d?.season?.media||[],schedule:d?.schedule?.airingSchedules||[],top:d?.top?.media||[],popular:d?.popular?.media||[],soon:d?.soon?.media||[]};
  }

  async function loadAwards(){
    const f='id title{romaji english native userPreferred} coverImage{extraLarge large} averageScore genres';
    const aliases=AWARDS.map(([,term],i)=>`a${i}:Media(search:${JSON.stringify(term)},type:ANIME){${f}}`).join(' ');
    const d=await gql(`query{${aliases}}`,{},7000);
    return AWARDS.map(([category],i)=>({category,media:d?.[`a${i}`]})).filter(x=>x.media);
  }

  async function loadThreads(){
    if(IS_PAGES)return[];
    try{
      const r=await fetch('/api/community/threads?limit=10',{headers:{accept:'application/json'}});
      if(!r.ok)return[];
      const j=await r.json();return Array.isArray(j?.items)?j.items:[];
    }catch{return[]}
  }

  async function loadImpressions(media){
    if(IS_PAGES)return[];
    const targets=(media||[]).slice(0,8);
    const rows=await Promise.all(targets.map(async m=>{
      try{
        const r=await fetch(`/api/anime/${m.id}/impressions`,{headers:{accept:'application/json'}});
        if(!r.ok)return[];
        const j=await r.json();return (j?.items||[]).slice(0,3).map(x=>({...x,media:m}));
      }catch{return[]}
    }));
    return rows.flat().sort((a,b)=>Date.parse(b.created_at||0)-Date.parse(a.created_at||0)).slice(0,10);
  }

  function localActivities(){
    const states=read('aninexus:mediaState:v2',{});
    return Object.entries(states).map(([id,s])=>({kind:'state',media_id:Number(id),username:'você',status:s.status,progress:s.progress,score:s.score,reaction:s.reaction,created_at:s.updatedAt?new Date(s.updatedAt).toISOString():null})).filter(x=>x.status).sort((a,b)=>Date.parse(b.created_at||0)-Date.parse(a.created_at||0)).slice(0,10);
  }

  function sectionTitle(base,accent=''){return `<h2>${esc(base)}${accent?` <em>${esc(accent)}</em>`:''}</h2>`}
  function sectionHead(base,accent,sub,href,label){return `<div class="aqx-head"><div>${sectionTitle(base,accent)}${sub?`<p>${esc(sub)}</p>`:''}</div>${href?`<a href="${href}" data-link>${esc(label||'Ver mais')} ${ICON.arrow}</a>`:''}</div>`}
  function rail(id,content){return `<div class="aqx-rail-shell"><button type="button" class="aqx-rail-arrow prev" data-aqx-rail="${id}" data-dir="-1" aria-label="Anterior">${ICON.back}</button><div class="aqx-rail" id="${id}">${content}</div><button type="button" class="aqx-rail-arrow next" data-aqx-rail="${id}" data-dir="1" aria-label="Próximo">${ICON.chevron}</button></div>`}
  function skeleton(count=8,klass='aqx-skeleton-card'){return Array.from({length:count},()=>`<div class="${klass}"></div>`).join('')}

  function animeCard(m){
    const fav=setOf('aninexus:favorites').has(Number(m.id));
    const current=read('aninexus:mediaState:v2',{})?.[m.id]?.status;
    return `<article class="aqx-anime" data-aqx-open="${m.id}">
      <div class="aqx-cover">${image(m)?`<img loading="lazy" decoding="async" src="${esc(image(m))}" alt="${esc(title(m))}">`:''}
        <div class="aqx-cover-fade"></div>
        ${score(m)?`<span class="aqx-score">${ICON.star}<b>${score(m)}</b></span>`:''}
        <div class="aqx-card-actions"><button type="button" data-list="${m.id}" class="${current?'active':''}" aria-label="Adicionar à lista">${ICON.plus}</button><button type="button" data-fav="${m.id}" class="${fav?'active':''}" aria-label="Favoritar">${ICON.heart}</button></div>
      </div>
      <h3>${esc(title(m))}</h3>
    </article>`;
  }

  function scheduleCard(x){
    const m=x.media,date=new Date(Number(x.airingAt)*1000);
    const day=new Intl.DateTimeFormat('pt-BR',{timeZone:TZ,weekday:'short'}).format(date).replace('.','');
    const hour=new Intl.DateTimeFormat('pt-BR',{timeZone:TZ,hour:'2-digit',minute:'2-digit'}).format(date);
    const today=new Intl.DateTimeFormat('yyyy-MM-dd',{timeZone:TZ}).format(new Date())===new Intl.DateTimeFormat('yyyy-MM-dd',{timeZone:TZ}).format(date);
    return `<article class="aqx-episode" data-aqx-open="${m.id}">
      <div class="aqx-episode-cover">${image(m)?`<img loading="lazy" decoding="async" src="${esc(image(m))}" alt="${esc(title(m))}">`:''}<span>EP <b>${esc(x.episode)}</b></span></div>
      <div class="aqx-episode-body">
        <div class="aqx-episode-meta"><strong>${today?'Hoje':day} ${hour}</strong>${score(m)?`<span>${ICON.star}${score(m)}</span>`:''}</div>
        <h3>${esc(title(m))}</h3>
        <p>${esc((m.genres||[]).slice(0,3).map(g=>GENRE[g]||g).join(', '))}</p>
        <small>${ICON.clock}<span data-aqx-countdown="${x.airingAt}">${countdown(x.airingAt)}</span></small>
      </div>
    </article>`;
  }

  function topCard(m,i){
    return `<article class="aqx-rank" data-aqx-open="${m.id}"><span class="aqx-rank-num">${i+1}</span><div class="aqx-rank-cover">${image(m)?`<img loading="lazy" decoding="async" src="${esc(image(m))}" alt="${esc(title(m))}">`:''}<span>${score(m)?`${ICON.star}${score(m)}`:''}</span></div><div class="aqx-rank-copy"><small>${i+1}º lugar</small><h3>${esc(title(m))}</h3></div></article>`;
  }

  function awardCard(item){
    const m=item.media;
    return `<article class="aqx-award" data-aqx-open="${m.id}"><div class="aqx-award-cover">${image(m)?`<img loading="lazy" decoding="async" src="${esc(image(m))}" alt="${esc(title(m))}">`:''}<div></div><span>${esc(item.category)}</span></div><h3>${esc(title(m))}</h3>${score(m)?`<p>${ICON.star}${score(m)}</p>`:''}</article>`;
  }

  function avatar(username,avatar){
    if(avatar)return `<img src="${esc(avatar)}" alt="" loading="lazy">`;
    const initial=String(username||'?').trim().charAt(0).toUpperCase()||'?';
    return `<span>${esc(initial)}</span>`;
  }

  function communityItem(x){
    if(x.kind==='state'){
      const verb=STATUS[x.status]||'atualizou sua lista';
      return `<article class="aqx-feed-item"><div class="aqx-avatar"><span>V</span></div><div><p><b>@você</b> ${esc(verb)}${x.progress?` <strong>no ep. ${esc(x.progress)}</strong>`:''}</p><small>${relative(x.created_at)}</small></div></article>`;
    }
    return `<article class="aqx-feed-item"><div class="aqx-avatar">${avatar(x.username,x.avatar_url)}</div><div><p><b>@${esc(x.username||'membro')}</b> publicou <strong>${esc(x.title||'uma discussão')}</strong></p><small>${relative(x.created_at)}${x.replies!=null?` · ${esc(x.replies)} respostas`:''}</small></div></article>`;
  }

  function impressionCard(x){
    const m=x.media;
    return `<article class="aqx-impression"><div class="aqx-impression-user"><div class="aqx-avatar">${avatar(x.username,x.avatar_url)}</div><div><b>@${esc(x.username||'membro')}</b><small>${relative(x.created_at)}</small></div></div><p>${esc(x.spoiler?'Impressão marcada como spoiler.':x.body||'')}</p><div class="aqx-impression-anime" data-aqx-open="${m.id}">${image(m)?`<img loading="lazy" src="${esc(image(m))}" alt="">`:''}<strong>${esc(title(m))}</strong></div></article>`;
  }

  function achievements(){
    const states=read('aninexus:mediaState:v2',{}),favorites=setOf('aninexus:favorites');
    const entries=Object.values(states).filter(Boolean),completed=entries.filter(x=>x.status==='COMPLETED').length,current=entries.filter(x=>x.status==='CURRENT').length,scored=entries.filter(x=>x.score!=null).length;
    const list=[
      ['Primeiro passo','Adicionou o primeiro anime',entries.length>=1,entries.length],
      ['Maratonista','Terminou 5 animes',completed>=5,completed],
      ['Colecionador','Favoritou 10 títulos',favorites.size>=10,favorites.size],
      ['Crítico Nato','Avaliou 5 animes',scored>=5,scored],
      ['Em dia','Está acompanhando 3 animes',current>=3,current]
    ];
    const unlocked=list.filter(x=>x[2]);
    if(!unlocked.length)return `<div class="aqx-achievement-empty"><span>${ICON.trophy}</span><div><strong>Suas conquistas aparecem aqui</strong><p>Adicione, avalie e acompanhe animes para começar a desbloquear marcos.</p></div></div>`;
    return unlocked.map(([name,desc,,value])=>`<article class="aqx-achievement"><span>${ICON.trophy}</span><div><strong>${esc(name)}</strong><p>${esc(desc)}</p><small>${esc(value)} ações registradas</small></div></article>`).join('');
  }

  function tags(){return TAGS.map(t=>`<a href="/animes/catalogo?genero=${encodeURIComponent(t)}" data-link>${esc(t)}</a>`).join('')}

  function shell(){
    const s=seasonNow();
    app.innerHTML=`<div class="aqx-home" data-aqx-home>
      <section class="aqx-hero"><div class="aqx-shell aqx-hero-grid">
        <div class="aqx-hero-copy"><span class="aqx-eyebrow">ANINEXUS · DE FÃ PARA FÃ</span><h1>Avalie. Descubra.<br><em>Compartilhe.</em></h1><p>Temporadas, calendário de episódios, lançamentos e rankings.<br>Sua lista de animes finalmente tem uma casa brasileira.<br><strong>Tudo em português.</strong></p><div class="aqx-hero-actions"><a class="primary" href="/animes/temporadas" data-link>Explorar ${esc(s.label)} ${s.year}${ICON.arrow}</a><a href="/animes/programacao" data-link>${ICON.clock}Programação de hoje</a></div></div>
        <aside class="aqx-live"><div class="aqx-live-title"><i></i><span>AGORA NA COMUNIDADE</span></div><div id="aqxHeroCommunity">${skeleton(4,'aqx-feed-skeleton')}</div><a class="aqx-live-more" href="/comunidade" data-link>Ver comunidade ${ICON.arrow}</a></aside>
      </div></section>

      <section class="aqx-section"><div class="aqx-shell">${sectionHead('Animes da Temporada',`${s.label} ${s.year}`,'','/animes/temporadas','ver temporada completa')}<div id="aqxSeason">${rail('aqxSeasonRail',skeleton(9))}</div></div></section>

      <section class="aqx-section aqx-tonal"><div class="aqx-shell">${sectionHead('Próximos Episódios','e Lançamentos','Veja a programação dos animes que estão sendo transmitidos hoje no Brasil.','/animes/programacao','Programação')}<div class="aqx-episode-grid" id="aqxSchedule">${skeleton(6,'aqx-episode-skeleton')}</div></div></section>

      <section class="aqx-section"><div class="aqx-shell">${sectionHead('Top 10','Animes','O rank dos animes mais bem avaliados.','/melhores-animes-para-assistir','Ver o rank completo')}<div id="aqxTop">${rail('aqxTopRail',skeleton(6,'aqx-rank-skeleton'))}</div></div></section>

      <section class="aqx-section aqx-tonal"><div class="aqx-shell">${sectionHead('Crunchyroll Anime Awards','2026','','/anime-awards','Todas as categorias')}<div id="aqxAwards">${rail('aqxAwardsRail',skeleton(6))}</div></div></section>

      <section class="aqx-section compact"><div class="aqx-shell">${sectionHead('Conquistas','desbloqueadas','','','')}<div class="aqx-achievement-rail" id="aqxAchievements">${achievements()}</div></div></section>

      <section class="aqx-section"><div class="aqx-shell">${sectionHead('Animes mais','Populares','Veja os animes que concentram mais atenção no momento.','/animes-mais-assistidos','Ver o rank completo')}<div id="aqxPopular">${rail('aqxPopularRail',skeleton(9))}</div></div></section>

      <section class="aqx-section aqx-tonal"><div class="aqx-shell">${sectionHead('Animes Chegando','em Breve','','/animes-mais-aguardados','Ver todos')}<div id="aqxSoon">${rail('aqxSoonRail',skeleton(9))}</div></div></section>

      <section class="aqx-section"><div class="aqx-shell">${sectionHead('Últimas','Impressões','','/comunidade','Ver comunidade')}<div class="aqx-impressions" id="aqxImpressions">${skeleton(3,'aqx-impression-skeleton')}</div></div></section>

      <section class="aqx-section compact aqx-tonal"><div class="aqx-shell">${sectionHead('Agora na','Comunidade','','/comunidade','Ver tudo')}<div class="aqx-community-grid" id="aqxCommunity">${skeleton(6,'aqx-feed-skeleton')}</div></div></section>

      <section class="aqx-section compact"><div class="aqx-shell">${sectionHead('Tags','','Explore seus animes por categoria.','','')}<div class="aqx-tags">${tags()}</div></div></section>
    </div>`;
    document.title='Início | AniNexus';
    document.body.classList.remove('nx24-home-active');
    document.body.classList.add('aqx-home-active');
    document.documentElement.classList.remove('nx24-home-boot');
    document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav==='home'));
  }

  function paintPublic(data){
    const season=document.querySelector('#aqxSeason'),schedule=document.querySelector('#aqxSchedule'),top=document.querySelector('#aqxTop'),popular=document.querySelector('#aqxPopular'),soon=document.querySelector('#aqxSoon');
    if(season)season.innerHTML=data.season?.length?rail('aqxSeasonRail',data.season.map(animeCard).join('')):'<div class="aqx-empty">A temporada ainda não carregou.</div>';
    if(schedule)schedule.innerHTML=data.schedule?.length?data.schedule.slice(0,6).map(scheduleCard).join(''):'<div class="aqx-empty wide">Nenhum episódio próximo encontrado.</div>';
    if(top)top.innerHTML=data.top?.length?rail('aqxTopRail',data.top.slice(0,10).map(topCard).join('')):'<div class="aqx-empty">Ranking indisponível.</div>';
    if(popular)popular.innerHTML=data.popular?.length?rail('aqxPopularRail',data.popular.map(animeCard).join('')):'<div class="aqx-empty">Populares indisponíveis.</div>';
    if(soon)soon.innerHTML=data.soon?.length?rail('aqxSoonRail',data.soon.map(animeCard).join('')):'<div class="aqx-empty">Próximas estreias indisponíveis.</div>';
    startCountdown();
  }

  function paintAwards(items){
    const el=document.querySelector('#aqxAwards');
    if(el)el.innerHTML=items.length?rail('aqxAwardsRail',items.map(awardCard).join('')):'<div class="aqx-empty">Premiação indisponível agora.</div>';
  }

  function paintCommunity(threads){
    const locals=localActivities();
    const feed=(threads?.length?threads:locals).slice(0,10);
    const hero=document.querySelector('#aqxHeroCommunity'),all=document.querySelector('#aqxCommunity');
    const empty='<div class="aqx-feed-empty"><span>'+ICON.chat+'</span><div><strong>A comunidade do AniNexus está começando</strong><p>Quando houver novas discussões e atividades, elas aparecem aqui.</p></div></div>';
    if(hero)hero.innerHTML=feed.length?feed.slice(0,4).map(communityItem).join(''):empty;
    if(all)all.innerHTML=feed.length?feed.slice(0,8).map(communityItem).join(''):empty;
  }

  function paintImpressions(items){
    const el=document.querySelector('#aqxImpressions');if(!el)return;
    el.innerHTML=items.length?items.slice(0,6).map(impressionCard).join(''):'<div class="aqx-empty wide">As últimas impressões da comunidade aparecerão aqui.</div>';
  }

  async function refresh(force=false){
    const token=++paintToken;
    const cached=!force&&cacheRead();
    let publicData=cached;
    if(cached)paintPublic(cached);
    try{
      if(!cached||force){publicData=await loadPublic();if(token!==paintToken||!mounted)return;cacheWrite(publicData);paintPublic(publicData)}
    }catch{if(!cached)paintPublic({season:[],schedule:[],top:[],popular:[],soon:[]})}

    const [awards,threads]=await Promise.all([loadAwards().catch(()=>[]),loadThreads().catch(()=>[])]);
    if(token!==paintToken||!mounted)return;
    paintAwards(awards);paintCommunity(threads);

    if(publicData?.popular?.length){
      const impressions=await loadImpressions(publicData.popular).catch(()=>[]);
      if(token!==paintToken||!mounted)return;
      paintImpressions(impressions);
    }else paintImpressions([]);
  }

  function startCountdown(){
    clearInterval(countdownTimer);
    countdownTimer=setInterval(()=>{if(!mounted)return;document.querySelectorAll('[data-aqx-countdown]').forEach(el=>{el.textContent=countdown(Number(el.dataset.aqxCountdown))})},1000);
  }
  function cleanup(){
    mounted=false;paintToken++;clearInterval(countdownTimer);clearTimeout(remountTimer);
    document.body.classList.remove('aqx-home-active');
  }
  function mount(force=false){
    if(mounted&&!force&&app.querySelector('[data-aqx-home]'))return;
    mounted=true;restoreHomeUrl();shell();paintCommunity([]);refresh(false);
  }

  document.addEventListener('click',e=>{
    if(!mounted)return;
    const railBtn=e.target.closest('[data-aqx-rail]');
    if(railBtn){const el=document.getElementById(railBtn.dataset.aqxRail);el?.scrollBy({left:Number(railBtn.dataset.dir)*Math.max(360,el.clientWidth*.75),behavior:'smooth'});return}
    const card=e.target.closest('[data-aqx-open]');
    if(!card||e.target.closest('[data-list],[data-fav]'))return;
    const id=Number(card.dataset.aqxOpen);if(!id)return;
    const name=card.querySelector('h3,strong')?.textContent?.trim()||'anime';
    navigate(`/anime/${slug(name)}-${id}`);
  },false);

  document.addEventListener('aninexus:media-state-changed',()=>{if(mounted){const el=document.querySelector('#aqxAchievements');if(el)el.innerHTML=achievements();paintCommunity([])}});
  document.addEventListener('aninexus:favorite-changed',()=>{if(mounted){const el=document.querySelector('#aqxAchievements');if(el)el.innerHTML=achievements()}});
  addEventListener('popstate',()=>{if(route()==='/'){cleanup();mount()}else cleanup()});

  const guard=new MutationObserver(()=>{
    if(!mounted||route()!=='/'||app.querySelector('[data-aqx-home]'))return;
    clearTimeout(remountTimer);
    remountTimer=setTimeout(()=>{if(route()==='/'&&!app.querySelector('[data-aqx-home]'))mount(true)},0);
  });
  guard.observe(app,{childList:true});

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{if(wantsHome())mount()},{once:true});
  else if(wantsHome())mount();
})();
