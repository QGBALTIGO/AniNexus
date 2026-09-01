'use strict';
(() => {
  const app=document.querySelector('#app');
  if(!app)return;

  const IS_PAGES=location.hostname.endsWith('github.io');
  const BASE=IS_PAGES?'/AniNexus':'';
  const ROUTE='/animes/programacao';
  const TZ='America/Sao_Paulo';
  const API='https://graphql.anilist.co';
  const CACHE_FRESH=4*60*1000;
  const CACHE_STALE=12*60*60*1000;
  const MAX_PAGES=4;
  const STATUS_KEY='aninexus:mediaState:v1';

  let items=[];
  let days=[];
  let timer=null;
  let controller=null;
  let island=null;
  let sectionObserver=null;
  let activeDay='';
  let myOnly=false;
  let selectedProviders=new Set();
  let mounted=false;
  let lastScrollY=Math.max(0,scrollY);
  let scrollRaf=0;
  let openModal=null;

  const SVG={
    heart:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.7 8.7c0 5-8.7 10.1-8.7 10.1S3.3 13.7 3.3 8.7A4.6 4.6 0 0 1 12 6.2a4.6 4.6 0 0 1 8.7 2.5Z"/></svg>',
    plus:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    check:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.2 4.2L19 7"/></svg>',
    play:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 9 6-9 6V6Z"/></svg>',
    pause:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6v12M16 6v12"/></svg>',
    x:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
    star:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.5 6.1.9-4.4 4.3 1 6.1-5.5-2.9-5.5 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/></svg>',
    calendar:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.2" width="17" height="15.3" rx="2.2"/><path d="M7.5 3v4.2M16.5 3v4.2M3.5 9.3h17"/></svg>',
    tv:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="2.2"/><path d="m10 9 5 3-5 3V9Z"/></svg>',
    down:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9 5 5 5-5"/></svg>',
    close:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
    info:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 10.5v6M12 7.3h.01"/></svg>',
    minus:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>'
  };

  const STATUS={
    PLANNING:{label:'Quero Ver',icon:SVG.plus,short:'Quero ver'},
    CURRENT:{label:'Assistindo',icon:SVG.play,short:'Assistindo'},
    COMPLETED:{label:'Terminei',icon:SVG.check,short:'Terminei'},
    PAUSED:{label:'Pausei',icon:SVG.pause,short:'Pausei'},
    DROPPED:{label:'Desisti',icon:SVG.x,short:'Desisti'}
  };

  const REACTIONS=[
    ['🎣','Viciante'],['👍','Curtindo'],['😍','Amei'],['🤣','Rachei'],['☕','Relaxante'],['🐢','Lento'],['🫤','Fraco'],['🥰','Fofo'],['🤞','Dando uma chance'],['✨','Que animação!'],
    ['💎','Joia escondida'],['😭','Chorei'],['👻','De arrepiar'],['😮‍💨','Pesado demais'],['🔥','Bombando'],['🎵','Que trilha!'],['😵‍💫','Perdido'],['⚔️','Continuando a saga'],['🤓','Li o mangá'],['🛋️','Vendo junto']
  ];

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const title=m=>typeof m?.title==='string'&&m.title.trim()?m.title.trim():(m?.title?.english||m?.title?.userPreferred||m?.title?.romaji||m?.title?.native||m?.titleRomaji||'Anime');
  const altTitle=m=>{const value=typeof m?.title==='string'?m?.titleRomaji:m?.title?.romaji;return value&&value!==title(m)?value:''};
  const cover=m=>m?.coverImage?.extraLarge||m?.coverImage?.large||m?.cover||'';
  const score=m=>{const value=m?.averageScore!=null?Number(m.averageScore)/10:Number(m?.score);return Number.isFinite(value)&&value>0?String(value.toFixed(1)).replace('.0',''):''};
  const slug=s=>String(s||'anime').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,90);
  const genreMap={Action:'Ação',Adventure:'Aventura',Comedy:'Comédia',Drama:'Drama',Fantasy:'Fantasia',Horror:'Terror',Mystery:'Mistério',Romance:'Romance','Sci-Fi':'Ficção Científica','Slice of Life':'Slice of Life',Sports:'Esportes',Supernatural:'Sobrenatural',Thriller:'Suspense',Music:'Música',Psychological:'Psicológico',Mecha:'Mecha'};
  const formatMap={TV:'Série',TV_SHORT:'Série curta',MOVIE:'Filme',SPECIAL:'Especial',OVA:'OVA',ONA:'ONA'};
  const genre=g=>genreMap[g]||g;
  const format=f=>formatMap[f]||f||'Anime';

  function requestedRoute(){
    if(window.__ANINEXUS_SCHEDULE_V18__)return ROUTE;
    const u=new URL(location.href);const p=u.searchParams.get('p');
    if(p)return p.split('?')[0].replace(/\/+$/,'')||'/';
    let path=location.pathname;if(IS_PAGES)path=path.replace(/^\/AniNexus/,'')||'/';return path.replace(/\/+$/,'')||'/';
  }
  function restoreRoute(){
    if(!window.__ANINEXUS_SCHEDULE_V18__)return;
    history.replaceState({},'',`${BASE}${ROUTE}`);
    delete window.__ANINEXUS_SCHEDULE_V18__;
  }

  function dateKey(d){return new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(d)}
  function todayNoon(){const k=dateKey(new Date());return new Date(`${k}T12:00:00-03:00`)}
  function buildDays(){
    const base=todayNoon();
    return Array.from({length:7},(_,i)=>{
      const d=new Date(base.getTime()+i*864e5);
      const dow=new Intl.DateTimeFormat('pt-BR',{timeZone:TZ,weekday:'short'}).format(d).replace('.','').toUpperCase();
      const fullRaw=new Intl.DateTimeFormat('pt-BR',{timeZone:TZ,weekday:'long'}).format(d);
      return {key:dateKey(d),day:new Intl.DateTimeFormat('pt-BR',{timeZone:TZ,day:'2-digit'}).format(d),dow,full:fullRaw.charAt(0).toUpperCase()+fullRaw.slice(1)};
    });
  }
  function range(){const k=dateKey(new Date());const s=new Date(`${k}T00:00:00-03:00`);return{key:k,start:Math.floor(s.getTime()/1000),end:Math.floor((s.getTime()+7*864e5)/1000)}}
  function fmtTime(ts){return new Intl.DateTimeFormat('pt-BR',{timeZone:TZ,hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(ts*1000))}
  function airLabel(ts){
    const k=dateKey(new Date(ts*1000));
    if(k===days[0]?.key)return'HOJE';
    if(k===days[1]?.key)return'AMANHÃ';
    return new Intl.DateTimeFormat('pt-BR',{timeZone:TZ,day:'2-digit',month:'short'}).format(new Date(ts*1000)).replace('.','').toUpperCase();
  }

  function readJSON(k,f){try{const v=JSON.parse(localStorage.getItem(k)||'null');return v??f}catch{return f}}
  function writeJSON(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}
  function readSet(k){return new Set((readJSON(k,[])||[]).map(Number))}
  function writeSet(k,s){writeJSON(k,[...s])}
  function allStates(){const v=readJSON(STATUS_KEY,{});return v&&typeof v==='object'?v:{}}
  function stateFor(id){
    const all=allStates();if(all[id])return all[id];
    const legacy=readJSON('aninexus:listStatus',{}),listed=readSet('aninexus:list');
    if(legacy[id]||listed.has(Number(id)))return{status:legacy[id]||'PLANNING',progress:0,reaction:'',score:null,updatedAt:0};
    return{status:'',progress:0,reaction:'',score:null,updatedAt:0};
  }
  function saveMediaState(id,next){
    const all=allStates();
    if(!next.status&&!next.reaction&&next.score==null&&!next.progress)delete all[id];else all[id]={...next,updatedAt:Date.now()};
    writeJSON(STATUS_KEY,all);
    const legacy=readJSON('aninexus:listStatus',{}),listed=readSet('aninexus:list');
    if(next.status){legacy[id]=next.status;listed.add(Number(id))}else{delete legacy[id];listed.delete(Number(id))}
    writeJSON('aninexus:listStatus',legacy);writeSet('aninexus:list',listed);
  }
  function myAnimeIds(){
    const out=new Set([...readSet('aninexus:favorites'),...readSet('aninexus:list')]);
    Object.entries(allStates()).forEach(([id,s])=>{if(s?.status)out.add(Number(id))});
    return out;
  }

  function cacheKey(){return`nx:v18:schedule:${range().key}`}
  function readCache(){const v=readJSON(cacheKey(),null);if(!v||!Array.isArray(v.items)||Date.now()-v.savedAt>CACHE_STALE)return null;return v}
  function writeCache(data){writeJSON(cacheKey(),{savedAt:Date.now(),items:data})}
  function merge(a,b){return[...new Map([...a,...b].filter(x=>x?.media?.id&&x?.airingAt).map(x=>[`${x.media.id}:${x.episode}:${x.airingAt}`,x])).values()].sort((x,y)=>x.airingAt-y.airingAt)}

  const FIELDS=`id title{romaji english native userPreferred} coverImage{extraLarge large} averageScore genres episodes format seasonYear externalLinks{site url type icon color}`;
  async function fetchPage(page,start,end,signal){
    const query=`query($page:Int,$start:Int,$end:Int){Page(page:$page,perPage:50){pageInfo{hasNextPage}airingSchedules(airingAt_greater:$start,airingAt_lesser:$end,sort:TIME){airingAt episode media{${FIELDS}}}}}`;
    const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({query,variables:{page,start,end}}),signal});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);const j=await r.json();if(j.errors?.length)throw new Error(j.errors[0]?.message||'Falha ao carregar');
    return{items:j?.data?.Page?.airingSchedules||[],next:!!j?.data?.Page?.pageInfo?.hasNextPage};
  }
  async function fetchServer(start,end,signal){
    if(IS_PAGES)return null;
    try{const r=await fetch(`/api/schedule?start=${start}&end=${end}`,{signal,headers:{accept:'application/json'}});if(!r.ok)return null;const d=await r.json();return Array.isArray(d)?d:null}catch{return null}
  }

  function providerKey(link){
    const s=`${link?.site||''} ${link?.url||''}`.toLowerCase();
    if(s.includes('crunchyroll'))return'crunchyroll';
    if(s.includes('netflix'))return'netflix';
    if(s.includes('primevideo')||s.includes('prime video')||s.includes('amazon'))return'prime';
    if(s.includes('disney'))return'disney';
    if(s.includes('apple'))return'apple';
    if(s.includes('hidive'))return'hidive';
    if(s.includes('hulu'))return'hulu';
    return slug(link?.site||'stream');
  }
  function providerLabel(k,site=''){return({crunchyroll:'Crunchyroll',netflix:'Netflix',prime:'Prime Video',disney:'Disney+',apple:'Apple TV',hidive:'HIDIVE',hulu:'Hulu'})[k]||site||k}
  function streamLinks(m){return(m?.externalLinks||m?.streaming||[]).filter(x=>String(x?.type||'STREAMING').toUpperCase()==='STREAMING'&&/^https:\/\//i.test(x?.url||''))}
  function fallbackLogo(k){
    if(k==='crunchyroll')return'<span class="nx18-crunchy" aria-hidden="true"><i></i></span>';
    if(k==='netflix')return'<span class="nx18-netflix" aria-hidden="true">N</span>';
    if(k==='prime')return'<span class="nx18-prime" aria-hidden="true">prime</span>';
    if(k==='disney')return'<span class="nx18-disney" aria-hidden="true">Disney+</span>';
    if(k==='apple')return'<span class="nx18-apple" aria-hidden="true">●TV</span>';
    if(k==='hidive')return'<span class="nx18-hidive" aria-hidden="true">H</span>';
    return'<span class="nx18-generic-stream" aria-hidden="true">▶</span>';
  }
  function providerIcon(link,mode='card'){
    const k=providerKey(link),src=/^https:\/\//i.test(link?.icon||'')?link.icon:'';
    return `<span class="nx18-provider-logo ${mode}" data-provider="${esc(k)}">${src?`<img src="${esc(src)}" alt="" loading="lazy" decoding="async" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span class="nx18-provider-fallback" hidden>${fallbackLogo(k)}</span>`:`<span class="nx18-provider-fallback">${fallbackLogo(k)}</span>`}</span>`;
  }
  function primaryStream(m){
    const links=streamLinks(m);if(!links.length)return null;
    const pref=['crunchyroll','netflix','prime','disney','apple','hidive','hulu'];
    return links.sort((a,b)=>{const ai=pref.indexOf(providerKey(a)),bi=pref.indexOf(providerKey(b));return(ai<0?99:ai)-(bi<0?99:bi)})[0];
  }
  function providers(){
    const map=new Map();
    for(const x of items)for(const l of streamLinks(x.media)){const k=providerKey(l);if(!map.has(k))map.set(k,{key:k,label:providerLabel(k,l.site),link:l,count:0});map.get(k).count++}
    const pref=['apple','crunchyroll','disney','netflix','prime','hidive','hulu'];
    return[...map.values()].sort((a,b)=>{const ai=pref.indexOf(a.key),bi=pref.indexOf(b.key);return(ai<0?99:ai)-(bi<0?99:bi)||a.label.localeCompare(b.label)})
  }

  function statusIcon(id){const s=stateFor(id).status;return STATUS[s]?.icon||SVG.plus}
  function dayButtons(attr='data-nx18-day'){
    return days.map((d,i)=>`<button type="button" class="nx18-day ${i===0?'active':''}" ${attr}="${d.key}"><small>${d.dow}</small><b>${d.day}</b></button>`).join('');
  }
  function actionButtons(){
    return `<button class="nx18-pill ${myOnly?'active':''}" type="button" data-nx18-my>${SVG.heart}<span>Meus animes</span></button><button class="nx18-pill ${selectedProviders.size?'active':''}" type="button" data-nx18-stream>${SVG.tv}<span>Onde assistir</span></button>`;
  }
  function shell(){
    return `<main class="nx18-schedule"><section class="nx18-hero" id="nx18Hero"><div class="nx18-shell"><h1><em>Calendário</em> de Animes da Semana</h1><p>Acompanhe os dias e horários de lançamento dos episódios, no horário de Brasília.</p><div class="nx18-days">${dayButtons()}</div><div class="nx18-actions">${actionButtons()}</div></div></section><section class="nx18-body"><div class="nx18-shell" id="nx18Root"><div class="nx18-loading">${Array.from({length:6},()=>'<div class="nx18-skeleton"></div>').join('')}</div></div></section></main>`;
  }
  function islandMarkup(){
    return `<section class="nx18-island" id="nx18Island" aria-label="Atalhos da programação"><button type="button" class="nx18-island-head" data-nx18-island-toggle aria-expanded="false"><span class="nx18-island-icon">${SVG.calendar}</span><span class="nx18-island-copy"><strong>Calendário de Animes</strong><small>${days.find(d=>d.key===activeDay)?.full||'Programação da semana'}</small></span><span class="nx18-island-chevron">${SVG.down}</span></button><div class="nx18-island-panel"><div><div class="nx18-island-inner"><div class="nx18-days">${dayButtons('data-nx18-idday')}</div><div class="nx18-actions">${actionButtons()}</div></div></div></div></section>`;
  }

  function countdownMarkup(ts){return `<div class="nx18-countdown" data-airing="${Number(ts)}" aria-label="Tempo até o episódio"></div>`}
  function card(x){
    const m=x.media||{},name=title(m),poster=cover(m),sc=score(m),stream=primaryStream(m),final=m.episodes&&Number(x.episode)===Number(m.episodes),favs=readSet('aninexus:favorites'),s=stateFor(m.id);
    return `<article class="nx18-card" data-nx18-open="${m.id}" data-title="${esc(name)}"><div class="nx18-cover${poster?'':' nx18-cover-missing'}">${poster?`<img src="${esc(poster)}" alt="${esc(name)}" loading="lazy" decoding="async">`:''}${sc?`<span class="nx18-score">${SVG.star}<b>${sc}</b></span>`:''}<div class="nx18-cover-actions"><button type="button" class="nx18-circle status ${s.status?'active':''}" data-nx18-status="${m.id}" aria-label="Minha lista: ${esc(STATUS[s.status]?.label||'Adicionar')}">${statusIcon(m.id)}</button><button type="button" class="nx18-circle heart ${favs.has(Number(m.id))?'active':''}" data-nx18-fav="${m.id}" aria-label="Favoritar ${esc(name)}">${SVG.heart}</button></div></div><div class="nx18-info"><div class="nx18-air"><span>${airLabel(x.airingAt)}</span><b>${fmtTime(x.airingAt)}</b></div>${countdownMarkup(x.airingAt)}<h3>${esc(name)}</h3><p>${esc((m.genres||[]).slice(0,3).map(genre).join(', '))}</p>${x.episode===1||final?`<span class="nx18-state">${x.episode===1?'Estreia':'Episódio final'}</span>`:''}${stream?`<a class="nx18-stream" href="${esc(stream.url)}" target="_blank" rel="noopener noreferrer" title="${esc(providerLabel(providerKey(stream),stream.site))}">${providerIcon(stream,'card')}</a>`:''}<div class="nx18-episode"><small>EP</small><strong>${Number(x.episode)||'—'}</strong></div></div></article>`;
  }
  function grouped(){
    const map=new Map(days.map(d=>[d.key,{...d,items:[]}]))
    for(const x of items){const k=dateKey(new Date(x.airingAt*1000));if(map.has(k))map.get(k).items.push(x)}
    const mine=myAnimeIds();
    return[...map.values()].map(g=>({...g,items:g.items.filter(x=>{
      if(myOnly&&!mine.has(Number(x.media?.id)))return false;
      if(selectedProviders.size){const ks=new Set(streamLinks(x.media).map(providerKey));if(![...selectedProviders].some(k=>ks.has(k)))return false}
      return true;
    })}));
  }
  function renderData(){
    const root=document.querySelector('#nx18Root');if(!root)return;
    const gs=grouped();
    root.innerHTML=gs.map(g=>g.items.length?`<section class="nx18-day-section" id="nx18-day-${g.key}" data-nx18-section="${g.key}"><div class="nx18-day-title"><h2>${g.full}</h2></div><div class="nx18-grid">${g.items.map(card).join('')}</div></section>`:'').join('')||`<div class="nx18-empty">Nenhum episódio corresponde aos filtros selecionados.</div>`;
    bindCards();observeSections();updateCountdowns();syncControls();
  }

  function timerText(node){
    const ts=Number(node.dataset.airing),diff=ts-Math.floor(Date.now()/1000);
    if(!Number.isFinite(ts)||diff<=0){node.hidden=true;return}
    node.hidden=false;
    const two=n=>String(n).padStart(2,'0');
    let s=diff,d=Math.floor(s/86400);s%=86400;const h=Math.floor(s/3600);s%=3600;const m=Math.floor(s/60),sec=s%60;
    if(diff<3600){node.innerHTML=`<span>${two(m)}</span><i>:</i><span>${two(sec)}</span><small>para o episódio</small>`;return}
    node.innerHTML=d?`<span class="days">${d}d</span><i>:</i><span>${two(h)}</span><i>:</i><span>${two(m)}</span><i>:</i><span>${two(sec)}</span>`:`<span>${two(h)}</span><i>:</i><span>${two(m)}</span><i>:</i><span>${two(sec)}</span>`;
  }
  function updateCountdowns(){document.querySelectorAll('.nx18-countdown').forEach(timerText)}
  function startTimer(){clearInterval(timer);updateCountdowns();timer=setInterval(updateCountdowns,1000)}

  function syncControls(){
    document.querySelectorAll('[data-nx18-my]').forEach(b=>b.classList.toggle('active',myOnly));
    document.querySelectorAll('[data-nx18-stream]').forEach(b=>b.classList.toggle('active',selectedProviders.size>0));
    document.querySelectorAll('.nx18-day').forEach(b=>{const k=b.dataset.nx18Day||b.dataset.nx18Idday;b.classList.toggle('active',k===activeDay)})
    const sub=document.querySelector('.nx18-island-copy small'),d=days.find(x=>x.key===activeDay);if(sub&&d)sub.textContent=d.full;
  }
  function setActiveDay(k){if(!k)return;activeDay=k;syncControls()}
  function goDay(k){
    setActiveDay(k);const el=document.querySelector(`#nx18-day-${CSS.escape(k)}`);if(el)el.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function closeAnyModal(){
    openModal?.remove();openModal=null;document.body.classList.remove('modal-open');
  }
  function providerModal(){
    closeAnyModal();const ps=providers();const modal=document.createElement('div');modal.className='nx18-modal';
    modal.innerHTML=`<button class="nx18-modal-backdrop" data-close aria-label="Fechar"></button><div class="nx18-provider-modal"><button class="nx18-modal-x" data-close aria-label="Fechar">${SVG.close}</button><h2>Onde assistir</h2><p>Pesquise os animes da semana pelas plataformas de streaming. Selecione uma ou mais para filtrar a programação.</p><div class="nx18-provider-list">${ps.map(p=>`<button type="button" class="nx18-provider ${selectedProviders.has(p.key)?'active':''}" data-provider="${esc(p.key)}">${providerIcon(p.link,'filter')}<span>${esc(p.label)}</span></button>`).join('')||'<span class="nx18-no-providers">Nenhuma plataforma identificada nesta programação.</span>'}</div><div class="nx18-modal-actions"><button type="button" class="clear" data-clear>Limpar</button><button type="button" class="apply" data-apply>Aplicar</button></div></div>`;
    document.body.append(modal);document.body.classList.add('modal-open');openModal=modal;
    const draft=new Set(selectedProviders);
    modal.querySelectorAll('[data-provider]').forEach(b=>b.onclick=()=>{const k=b.dataset.provider;draft.has(k)?draft.delete(k):draft.add(k);b.classList.toggle('active',draft.has(k))});
    const close=()=>closeAnyModal();modal.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);
    modal.querySelector('[data-clear]').onclick=()=>{draft.clear();modal.querySelectorAll('[data-provider]').forEach(b=>b.classList.remove('active'))};
    modal.querySelector('[data-apply]').onclick=()=>{selectedProviders=draft;close();renderData()};
  }

  function statusModal(id){
    closeAnyModal();const entry=items.find(x=>Number(x.media?.id)===Number(id)),m=entry?.media;if(!m)return;
    const existing=stateFor(id),draft={...existing};let showAllReactions=false;
    const modal=document.createElement('div');modal.className='nx18-modal nx18-tracker-layer';
    const guide=!existing.status&&!existing.reaction&&existing.score==null;
    function reactionsHtml(){return REACTIONS.map(([emoji,label],i)=>`<button type="button" class="nx18-reaction ${draft.reaction===label?'active':''} ${i>=10&&!showAllReactions?'extra':''}" data-reaction="${esc(label)}"><span>${emoji}</span>${esc(label)}</button>`).join('')}
    function modalHtml(){
      const total=Number(m.episodes)||0,progress=Math.min(Math.max(0,Number(draft.progress)||0),total||9999),scoreValue=draft.score==null?'':Number(draft.score);
      return `<button class="nx18-modal-backdrop" data-close aria-label="Fechar"></button><div class="nx18-tracker"><button class="nx18-modal-x" data-close aria-label="Fechar">${SVG.close}</button><header class="nx18-tracker-head"><img src="${esc(cover(m))}" alt=""><div>${altTitle(m)?`<small>${esc(altTitle(m))}</small>`:''}<h2>${esc(title(m))}</h2><p>${m.seasonYear?`${m.seasonYear} · `:''}${esc(format(m.format))}${m.genres?.length?` · ${esc(m.genres.slice(0,3).map(genre).join(', '))}`:''}</p></div></header>${guide?`<section class="nx18-guide"><div class="nx18-guide-title"><span>SEU STATUS</span><button type="button" data-hide-guide>primeira vez aqui?</button></div><ol><li><b>Escolha o status.</b> Organize sua lista: quero ver, assistindo, terminei, pausei ou desisti.</li><li><b>Marque uma reação (opcional).</b> Registre a experiência: “chorei”, “maratonei”, “melhor do ano”…</li><li><b>Dê sua nota (opcional).</b> Registre sua impressão geral. Enquanto você assiste ou está com ele pausado, a nota vale como parcial.</li></ol><button type="button" class="nx18-guide-close" data-hide-guide>fechar</button></section>`:''}<section class="nx18-statuses">${Object.entries(STATUS).map(([k,v])=>`<button type="button" class="${draft.status===k?'active':''}" data-status="${k}"><i>${v.icon}</i><span>${v.label}</span></button>`).join('')}</section>${draft.status&&total?`<section class="nx18-progress"><div><span>Episódios</span><strong>ep. ${progress} de ${total}</strong></div><div class="nx18-progress-stepper"><button type="button" data-progress-step="-1">${SVG.minus}</button><input type="number" min="0" max="${total}" value="${progress}" data-progress><button type="button" data-progress-step="1">${SVG.plus}</button></div></section>`:''}<section class="nx18-reactions"><div class="nx18-tracker-label"><span>SUA REAÇÃO</span><small>opcional</small></div><div class="nx18-reaction-grid">${reactionsHtml()}</div><button type="button" class="nx18-more-reactions" data-more>${showAllReactions?'ver menos':'veja mais reações'}</button></section><section class="nx18-score-panel"><div class="nx18-tracker-label"><span>${draft.status==='CURRENT'||draft.status==='PAUSED'?'SUA NOTA PARCIAL':'SUA NOTA'}</span><small>opcional</small></div><div class="nx18-score-value">${scoreValue===''?'–':String(scoreValue).replace('.0','')}</div><input type="range" min="0" max="10" step="0.5" value="${scoreValue===''?0:scoreValue}" data-score><div class="nx18-score-scale"><span>0</span><span>10</span></div></section><footer class="nx18-tracker-footer"><button type="button" class="remove" data-remove ${!draft.status&&!draft.reaction&&draft.score==null?'disabled':''}>Limpar registro</button><button type="button" class="save" data-save>Salvar</button></footer></div>`;
    }
    function render(){modal.innerHTML=modalHtml();bind()}
    function bind(){
      modal.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeAnyModal);
      modal.querySelectorAll('[data-hide-guide]').forEach(b=>b.onclick=()=>{modal.querySelector('.nx18-guide')?.remove()});
      modal.querySelectorAll('[data-status]').forEach(b=>b.onclick=()=>{draft.status=draft.status===b.dataset.status?'':b.dataset.status;if(draft.status==='COMPLETED'&&m.episodes)draft.progress=Number(m.episodes);render()});
      modal.querySelectorAll('[data-reaction]').forEach(b=>b.onclick=()=>{draft.reaction=draft.reaction===b.dataset.reaction?'':b.dataset.reaction;render()});
      modal.querySelector('[data-more]')?.addEventListener('click',()=>{showAllReactions=!showAllReactions;render()});
      const progress=modal.querySelector('[data-progress]');if(progress){progress.oninput=()=>draft.progress=Math.max(0,Math.min(Number(m.episodes)||9999,Number(progress.value)||0));modal.querySelectorAll('[data-progress-step]').forEach(b=>b.onclick=()=>{draft.progress=Math.max(0,Math.min(Number(m.episodes)||9999,(Number(draft.progress)||0)+Number(b.dataset.progressStep)));render()})}
      const slider=modal.querySelector('[data-score]');if(slider)slider.oninput=()=>{draft.score=Number(slider.value);const v=modal.querySelector('.nx18-score-value');if(v)v.textContent=String(draft.score).replace('.0','')};
      modal.querySelector('[data-remove]')?.addEventListener('click',()=>{draft.status='';draft.progress=0;draft.reaction='';draft.score=null;saveMediaState(id,draft);closeAnyModal();renderData()});
      modal.querySelector('[data-save]')?.addEventListener('click',()=>{saveMediaState(id,draft);closeAnyModal();renderData()});
    }
    document.body.append(modal);document.body.classList.add('modal-open');openModal=modal;render();
  }

  function toggleFav(id){const s=readSet('aninexus:favorites');s.has(id)?s.delete(id):s.add(id);writeSet('aninexus:favorites',s);renderData()}
  function bindCards(){
    document.querySelectorAll('[data-nx18-open]').forEach(el=>el.onclick=e=>{if(e.target.closest('button,a'))return;const path=`/anime/${slug(el.dataset.title)}-${el.dataset.nx18Open}`;location.href=BASE+path});
    document.querySelectorAll('[data-nx18-status]').forEach(b=>b.onclick=e=>{e.stopPropagation();statusModal(Number(b.dataset.nx18Status))});
    document.querySelectorAll('[data-nx18-fav]').forEach(b=>b.onclick=e=>{e.stopPropagation();toggleFav(Number(b.dataset.nx18Fav))});
  }
  function bindControls(root=document){
    root.querySelectorAll('[data-nx18-day]').forEach(b=>b.onclick=()=>goDay(b.dataset.nx18Day));
    root.querySelectorAll('[data-nx18-idday]').forEach(b=>b.onclick=()=>goDay(b.dataset.nx18Idday));
    root.querySelectorAll('[data-nx18-my]').forEach(b=>b.onclick=()=>{myOnly=!myOnly;renderData()});
    root.querySelectorAll('[data-nx18-stream]').forEach(b=>b.onclick=providerModal);
  }

  function observeSections(){
    sectionObserver?.disconnect();const els=[...document.querySelectorAll('[data-nx18-section]')];if(!els.length)return;
    sectionObserver=new IntersectionObserver(entries=>{const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top);if(visible[0])setActiveDay(visible[0].target.dataset.nx18Section)},{rootMargin:'-25% 0px -60% 0px',threshold:[0,.03]});
    els.forEach(e=>sectionObserver.observe(e));
  }
  function ensureIsland(){
    if(island||!matchMedia('(max-width:720px)').matches)return;
    const wrap=document.createElement('div');wrap.innerHTML=islandMarkup();island=wrap.firstElementChild;document.body.append(island);bindControls(island);
    island.querySelector('[data-nx18-island-toggle]').onclick=()=>{const expanded=island.classList.toggle('expanded');island.querySelector('[data-nx18-island-toggle]').setAttribute('aria-expanded',String(expanded))};
  }
  function rebuildIsland(){if(!island)return;const wasShow=island.classList.contains('show'),wasExpanded=island.classList.contains('expanded');island.remove();island=null;ensureIsland();if(island){island.classList.toggle('show',wasShow);island.classList.toggle('expanded',wasExpanded);syncControls()}}
  function scrollUpdate(){
    scrollRaf=0;if(!mounted)return;ensureIsland();const y=Math.max(0,scrollY),hero=document.querySelector('#nx18Hero');if(!hero||!island){lastScrollY=y;return}
    const show=hero.getBoundingClientRect().bottom<58;island.classList.toggle('show',show);document.body.classList.toggle('nx18-island-visible',show);
    const delta=y-lastScrollY;
    if(!show||y<80){island.classList.remove('expanded');document.body.classList.remove('nx18-header-hidden')}
    else if(delta>9){island.classList.remove('expanded');document.body.classList.add('nx18-header-hidden')}
    else if(delta<-9){island.classList.add('expanded');document.body.classList.remove('nx18-header-hidden')}
    lastScrollY=y;
  }
  function onScroll(){if(!scrollRaf)scrollRaf=requestAnimationFrame(scrollUpdate)}

  async function load(){
    controller?.abort();controller=new AbortController();const r=range(),cached=readCache();
    if(cached){items=cached.items;renderData();startTimer();if(Date.now()-cached.savedAt<CACHE_FRESH)return}
    try{
      const server=await fetchServer(r.start,r.end,controller.signal);
      if(server?.length){items=merge([],server);writeCache(items);renderData();startTimer();rebuildIsland();return}
      const first=await fetchPage(1,r.start,r.end,controller.signal);items=merge(cached?.items||[],first.items);writeCache(items);renderData();startTimer();rebuildIsland();
      let page=2,next=first.next;
      while(next&&page<=MAX_PAGES){const d=await fetchPage(page,r.start,r.end,controller.signal);items=merge(items,d.items);writeCache(items);renderData();next=d.next;page++}
    }catch(err){if(err?.name==='AbortError')return;if(!items.length){const root=document.querySelector('#nx18Root');if(root)root.innerHTML='<div class="nx18-empty">Não foi possível carregar a programação agora. Tente novamente em instantes.</div>'}}
  }

  function cleanup(){
    mounted=false;clearInterval(timer);controller?.abort();sectionObserver?.disconnect();closeAnyModal();island?.remove();island=null;document.body.classList.remove('nx18-schedule-active','nx18-header-hidden','nx18-island-visible','modal-open');removeEventListener('scroll',onScroll);
  }
  function mount(){
    if(requestedRoute()!==ROUTE)return;restoreRoute();mounted=true;days=buildDays();activeDay=days[0]?.key||'';
    document.body.classList.remove('nx-season-active','nx-detail-active','nx-legal-active','nx-inst-active','nx17-schedule-active','nx17-header-hidden','nx17-island-visible');
    document.body.classList.add('nx18-schedule-active');document.title='Calendário de Animes | AniNexus';
    document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav==='schedule'));
    app.innerHTML=shell();bindControls(app);ensureIsland();addEventListener('scroll',onScroll,{passive:true});scrollUpdate();load();
  }

  document.addEventListener('click',e=>{const a=e.target.closest('a[data-link],a[data-nx-inst],a[data-nx-legal]');if(a&&mounted&&!String(a.getAttribute('href')||'').includes('/animes/programacao'))cleanup()},true);
  addEventListener('popstate',()=>setTimeout(()=>{if(requestedRoute()===ROUTE){cleanup();mount()}else cleanup()},0));
  addEventListener('resize',()=>{if(mounted&&matchMedia('(max-width:720px)').matches)ensureIsland();else if(island&&innerWidth>720){island.remove();island=null}}, {passive:true});
  mount();
})();
