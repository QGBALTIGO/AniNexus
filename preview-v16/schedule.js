'use strict';
(() => {
  const app=document.querySelector('#app'); if(!app)return;
  const IS_PAGES=location.hostname.endsWith('github.io');
  const BASE=IS_PAGES?'/AniNexus':'';
  const TZ='America/Sao_Paulo';
  const API='https://graphql.anilist.co';
  const ROUTE='/animes/programacao';
  const CACHE_FRESH=5*60*1000;
  const CACHE_STALE=6*60*60*1000;
  let schedule=[];
  let days=[];
  let favOnly=false;
  let mounted=false;
  let loadingToken=0;
  let island=null;
  let heroObserver=null;
  let sectionObserver=null;
  let timer=null;
  let lastY=scrollY;
  let remountQueued=false;

  const star='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.5 6.1.9-4.4 4.3 1 6.1-5.5-2.9-5.5 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/></svg>';
  const plus='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  const heart='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.7 8.7c0 5-8.7 10.1-8.7 10.1S3.3 13.7 3.3 8.7A4.6 4.6 0 0 1 12 6.2a4.6 4.6 0 0 1 8.7 2.5Z"/></svg>';
  const calendar='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="15" rx="2"/><path d="M8 3.5v4M16 3.5v4M3.5 9.5h17"/></svg>';
  const chevron='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9 5 5 5-5"/></svg>';

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  const title=m=>m?.title?.english||m?.title?.userPreferred||m?.title?.romaji||m?.title?.native||'Anime';
  const cover=m=>m?.coverImage?.extraLarge||m?.coverImage?.large||'';
  const score=m=>m?.averageScore?String((m.averageScore/10).toFixed(1)).replace('.0',''):'';
  const genreMap={Action:'Ação',Adventure:'Aventura',Comedy:'Comédia',Drama:'Drama',Fantasy:'Fantasia',Horror:'Terror',Mystery:'Mistério',Romance:'Romance','Sci-Fi':'Ficção Científica','Slice of Life':'Slice of Life',Sports:'Esportes',Supernatural:'Sobrenatural',Thriller:'Suspense',Music:'Música',Psychological:'Psicológico',Mecha:'Mecha'};
  const genre=g=>genreMap[g]||g;
  const slug=s=>String(s||'anime').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,90);

  function route(){
    const u=new URL(location.href);const restored=u.searchParams.get('p');
    if(restored)return restored.split('?')[0].replace(/\/+$/,'')||'/';
    let p=location.pathname;if(IS_PAGES)p=p.replace(/^\/AniNexus/,'')||'/';return p.replace(/\/+$/,'')||'/';
  }
  function dateKey(d){return new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(d)}
  function baseDay(){const k=dateKey(new Date());return new Date(`${k}T12:00:00-03:00`)}
  function makeDays(){
    const base=baseDay();
    return Array.from({length:7},(_,i)=>{
      const d=new Date(base.getTime()+i*864e5);
      const key=dateKey(d);
      const dow=new Intl.DateTimeFormat('pt-BR',{timeZone:TZ,weekday:'short'}).format(d).replace('.','').toUpperCase();
      const fullRaw=new Intl.DateTimeFormat('pt-BR',{timeZone:TZ,weekday:'long'}).format(d);
      const full=fullRaw.charAt(0).toUpperCase()+fullRaw.slice(1);
      const day=new Intl.DateTimeFormat('pt-BR',{timeZone:TZ,day:'2-digit'}).format(d);
      return {key,dow,full,day};
    });
  }
  function windowRange(){
    const key=dateKey(new Date());
    const start=new Date(`${key}T00:00:00-03:00`);
    return {start:Math.floor(start.getTime()/1000),end:Math.floor((start.getTime()+7*864e5)/1000),key};
  }
  function fmtTime(ts){return new Intl.DateTimeFormat('pt-BR',{timeZone:TZ,hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(ts*1000))}
  function airLabel(ts){
    const k=dateKey(new Date(ts*1000));
    if(k===days[0]?.key)return 'HOJE';
    if(k===days[1]?.key)return 'AMANHÃ';
    return new Intl.DateTimeFormat('pt-BR',{timeZone:TZ,day:'2-digit',month:'short'}).format(new Date(ts*1000)).replace('.','').toUpperCase();
  }
  function relative(ts){
    let sec=Math.max(0,ts-Math.floor(Date.now()/1000));
    if(sec<=0)return '';
    const d=Math.floor(sec/86400);sec%=86400;const h=Math.floor(sec/3600);const m=Math.floor((sec%3600)/60);
    if(d)return `<strong>${d}d ${h}h</strong> para o episódio`;
    if(h)return `<strong>${h}h ${m}min</strong> para o episódio`;
    return `<strong>${Math.max(1,m)}min</strong> para o episódio`;
  }
  function readSet(key){try{return new Set(JSON.parse(localStorage.getItem(key)||'[]').map(Number))}catch{return new Set()}}
  function saveSet(key,set){try{localStorage.setItem(key,JSON.stringify([...set]))}catch{}}
  function cacheKey(){return `nx:v16:schedule:${windowRange().key}`}
  function readCache(){try{const v=JSON.parse(localStorage.getItem(cacheKey())||'null');if(!v||!Array.isArray(v.items)||Date.now()-v.savedAt>CACHE_STALE)return null;return v}catch{return null}}
  function writeCache(items){try{localStorage.setItem(cacheKey(),JSON.stringify({savedAt:Date.now(),items}))}catch{}}
  function mergeItems(a,b){return [...new Map([...a,...b].filter(x=>x?.media?.id&&x?.airingAt).map(x=>[`${x.media.id}:${x.episode}:${x.airingAt}`,x])).values()].sort((x,y)=>x.airingAt-y.airingAt)}

  const FIELDS=`id title{romaji english native userPreferred} coverImage{extraLarge large} averageScore genres episodes externalLinks{site url type}`;
  async function fetchPage(page,start,end,signal){
    const q=`query($page:Int,$start:Int,$end:Int){Page(page:$page,perPage:50){pageInfo{hasNextPage}airingSchedules(airingAt_greater:$start,airingAt_lesser:$end,sort:TIME){airingAt episode media{${FIELDS}}}}}`;
    const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({query:q,variables:{page,start,end}}),signal});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    const j=await r.json();if(j.errors?.length)throw new Error(j.errors[0]?.message||'Falha ao carregar');
    return {items:j?.data?.Page?.airingSchedules||[],hasNext:!!j?.data?.Page?.pageInfo?.hasNextPage};
  }
  async function fetchServer(start,end,signal){
    if(IS_PAGES)return null;
    try{const r=await fetch(`/api/schedule?start=${start}&end=${end}`,{signal,headers:{accept:'application/json'}});if(!r.ok)return null;const d=await r.json();return Array.isArray(d)?d:null}catch{return null}
  }

  function dayButtons(attr='data-sch-day'){
    return days.map((d,i)=>`<button class="nx-sch-day ${i===0?'active':''}" ${attr}="${d.key}" type="button"><small>${d.dow}</small><b>${d.day}</b></button>`).join('');
  }
  function filterButton(){return `<button class="nx-sch-filter ${favOnly?'active':''}" type="button" data-sch-fav>${heart}<span>Meus animes</span></button>`}
  function pageShell(){
    return `<div class="nx-schedule-v16"><section class="nx-sch-hero" id="nxSchHero"><div class="nx-sch-shell nx-sch-hero-inner"><h1 class="nx-sch-title"><em>Calendário</em> de Animes da Semana</h1><p class="nx-sch-subtitle">Acompanhe os dias e horários de lançamento dos episódios, no horário de Brasília.</p><div class="nx-sch-days">${dayButtons()}</div><div class="nx-sch-actions">${filterButton()}</div></div></section><section class="nx-sch-body"><div class="nx-sch-shell" id="nxSchRoot"><div class="nx-sch-loading">${Array.from({length:6},()=>'<div class="nx-sch-skeleton"></div>').join('')}</div></div></section></div>`;
  }
  function islandShell(){
    return `<div class="nx-sch-island" id="nxSchIsland"><div class="nx-sch-island-box"><button class="nx-sch-island-head" type="button" data-sch-island-toggle><span class="nx-sch-island-cal">${calendar}</span><span class="nx-sch-island-copy"><strong>Programação da semana</strong><span>Troque o dia sem voltar ao topo</span></span><span class="nx-sch-island-chevron">${chevron}</span></button><div class="nx-sch-island-panel"><div><div class="nx-sch-island-controls"><div class="nx-sch-days">${dayButtons('data-sch-mday')}</div><div class="nx-sch-actions">${filterButton()}</div></div></div></div></div></div>`;
  }
  function streamInfo(m){
    const links=(m?.externalLinks||[]).filter(x=>String(x?.type||'').toUpperCase()==='STREAMING'&&/^https:\/\//.test(x?.url||''));
    const x=links[0];if(!x)return null;
    const site=String(x.site||'').toLowerCase();
    if(site.includes('crunchyroll'))return {cls:'crunchyroll',html:'',site:x.site,url:x.url};
    if(site.includes('netflix'))return {cls:'netflix',html:'N',site:x.site,url:x.url};
    if(site.includes('prime'))return {cls:'prime',html:'prime',site:x.site,url:x.url};
    if(site.includes('disney'))return {cls:'disney',html:'D+',site:x.site,url:x.url};
    if(site.includes('hidive'))return {cls:'hidive',html:'H',site:x.site,url:x.url};
    return {cls:'brand',html:'▶',site:x.site||'Streaming',url:x.url};
  }
  function card(x){
    const m=x.media||{},sc=score(m),stream=streamInfo(m),final=m.episodes&&Number(x.episode)===Number(m.episodes),rel=relative(x.airingAt);
    const list=readSet('aninexus:list'),favs=readSet('aninexus:favorites');
    return `<article class="nx-sch-card" data-sch-open="${m.id}" data-sch-title="${esc(title(m))}"><div class="nx-sch-cover"><img loading="lazy" decoding="async" src="${esc(cover(m))}" alt="${esc(title(m))}">${sc?`<span class="nx-sch-score">${star}${sc}</span>`:''}<div class="nx-sch-cover-actions"><button type="button" class="${list.has(Number(m.id))?'active':''}" data-sch-list="${m.id}" aria-label="Adicionar à lista">${plus}</button><button type="button" class="${favs.has(Number(m.id))?'active':''}" data-sch-heart="${m.id}" aria-label="Favoritar">${heart}</button></div></div><div class="nx-sch-info"><div class="nx-sch-air"><span>${airLabel(x.airingAt)}</span><b>${fmtTime(x.airingAt)}</b></div>${rel?`<div class="nx-sch-countdown">${rel}</div>`:''}<h3>${esc(title(m))}</h3><div class="nx-sch-genres">${esc((m.genres||[]).slice(0,3).map(genre).join(', '))}</div>${x.episode===1||final?`<span class="nx-sch-state">${x.episode===1?'Estreia':'Episódio final'}</span>`:''}${stream?`<a class="nx-sch-stream ${stream.cls}" href="${esc(stream.url)}" target="_blank" rel="noopener noreferrer" title="${esc(stream.site)}">${stream.html}</a>`:''}<div class="nx-sch-episode"><small>EP</small><strong>${Number(x.episode)||'—'}</strong></div></div></article>`;
  }
  function groups(){
    const map=new Map(days.map(d=>[d.key,{...d,items:[]}]))
    for(const x of schedule){const k=dateKey(new Date(x.airingAt*1000));if(map.has(k))map.get(k).items.push(x)}
    const favs=readSet('aninexus:favorites');
    return [...map.values()].map(g=>({...g,items:favOnly?g.items.filter(x=>favs.has(Number(x.media?.id))):g.items}));
  }
  function renderData(){
    const root=document.querySelector('#nxSchRoot');if(!root)return;
    const gs=groups();
    root.innerHTML=gs.map(g=>g.items.length?`<section class="nx-sch-day-section" id="nx-sch-day-${g.key}" data-sch-section="${g.key}"><div class="nx-sch-day-heading"><h2>${g.full}</h2><span class="nx-sch-count">${g.items.length} ${g.items.length===1?'episódio':'episódios'}</span></div><div class="nx-sch-grid">${g.items.map(card).join('')}</div></section>`:'').join('')||`<div class="nx-sch-empty">${favOnly?'Nenhum anime favoritado aparece nesta semana.':'Nenhum episódio encontrado para esta semana.'}</div>`;
    bindCards();observeSections();updateActive(days[0]?.key);
  }
  function bindCards(){
    document.querySelectorAll('[data-sch-open]').forEach(el=>el.addEventListener('click',e=>{if(e.target.closest('button,a'))return;const id=Number(el.dataset.schOpen),path=`/anime/${slug(el.dataset.schTitle)}-${id}`;try{if(typeof go==='function'){go(path);return}}catch{}location.href=BASE+path}));
    document.querySelectorAll('[data-sch-list]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const id=Number(b.dataset.schList),s=readSet('aninexus:list');s.has(id)?s.delete(id):s.add(id);saveSet('aninexus:list',s);b.classList.toggle('active',s.has(id))}));
    document.querySelectorAll('[data-sch-heart]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const id=Number(b.dataset.schHeart),s=readSet('aninexus:favorites');s.has(id)?s.delete(id):s.add(id);saveSet('aninexus:favorites',s);b.classList.toggle('active',s.has(id));if(favOnly)renderData()}));
  }
  function bindControls(){
    document.querySelectorAll('[data-sch-day],[data-sch-mday]').forEach(b=>b.addEventListener('click',()=>scrollDay(b.getAttribute('data-sch-day')||b.getAttribute('data-sch-mday'))));
    document.querySelectorAll('[data-sch-fav]').forEach(b=>b.addEventListener('click',()=>{favOnly=!favOnly;document.querySelectorAll('[data-sch-fav]').forEach(x=>x.classList.toggle('active',favOnly));renderData()}));
    document.querySelector('[data-sch-island-toggle]')?.addEventListener('click',()=>island?.classList.toggle('expanded'));
  }
  function scrollDay(k){
    const el=document.querySelector(`#nx-sch-day-${CSS.escape(k)}`);if(!el)return;
    updateActive(k);el.scrollIntoView({behavior:'smooth',block:'start'});if(island)island.classList.remove('expanded');
  }
  function updateActive(k){document.querySelectorAll('[data-sch-day],[data-sch-mday]').forEach(b=>b.classList.toggle('active',(b.getAttribute('data-sch-day')||b.getAttribute('data-sch-mday'))===k))}
  function observeSections(){
    sectionObserver?.disconnect();
    const ss=[...document.querySelectorAll('[data-sch-section]')];if(!ss.length)return;
    sectionObserver=new IntersectionObserver(entries=>{const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top)[0];if(visible)updateActive(visible.target.dataset.schSection)},{rootMargin:'-24% 0px -62% 0px',threshold:[0,.1]});
    ss.forEach(s=>sectionObserver.observe(s));
  }
  function setupIsland(){
    document.querySelector('#nxSchIsland')?.remove();document.body.insertAdjacentHTML('beforeend',islandShell());island=document.querySelector('#nxSchIsland');bindControls();
    heroObserver?.disconnect();const hero=document.querySelector('#nxSchHero');if(hero){heroObserver=new IntersectionObserver(([e])=>{if(!island)return;const show=!e.isIntersecting;island.classList.toggle('show',show);if(!show)island.classList.remove('expanded')},{threshold:.05});heroObserver.observe(hero)}
    lastY=scrollY;
  }
  function onScroll(){
    if(!island?.classList.contains('show')){lastY=scrollY;return}
    const y=scrollY,d=y-lastY;
    if(d>7)island.classList.remove('expanded');
    else if(d<-7)island.classList.add('expanded');
    lastY=y;
  }
  function refreshCountdowns(){if(route()!==ROUTE)return;renderData()}

  async function loadData(){
    const token=++loadingToken;
    const c=readCache();
    if(c){schedule=c.items;renderData()}
    const range=windowRange();
    if(c&&Date.now()-c.savedAt<CACHE_FRESH)return;
    const ctl=new AbortController();
    try{
      const server=await fetchServer(range.start,range.end,ctl.signal);
      if(token!==loadingToken)return;
      if(server){schedule=server;writeCache(schedule);renderData();return}
      let page=1,merged=[];
      while(page<=3){
        const r=await fetchPage(page,range.start,range.end,ctl.signal);
        if(token!==loadingToken)return;
        merged=mergeItems(merged,r.items);
        schedule=merged;
        writeCache(schedule);
        renderData();
        if(!r.hasNext)break;
        page++;
        await new Promise(resolve=>(window.requestIdleCallback?requestIdleCallback(()=>resolve(),{timeout:450}):setTimeout(resolve,80)));
      }
    }catch(err){if(!c&&token===loadingToken){const root=document.querySelector('#nxSchRoot');if(root)root.innerHTML='<div class="nx-sch-empty">Não foi possível carregar a programação agora. Tente novamente em alguns instantes.</div>'}}
  }
  function cleanup(){
    mounted=false;loadingToken++;document.body.classList.remove('nx-schedule-active');island?.remove();island=null;heroObserver?.disconnect();sectionObserver?.disconnect();heroObserver=sectionObserver=null;clearInterval(timer);timer=null;removeEventListener('scroll',onScroll,{passive:true});
  }
  function mount(force=false){
    if(route()!==ROUTE){if(mounted)cleanup();return}
    if(mounted&&!force&&document.querySelector('.nx-schedule-v16'))return;
    mounted=true;document.body.classList.remove('nx-season-active','nx-legal-active','nx-inst-active');document.body.classList.add('nx-schedule-active');
    try{if(typeof stopTimers==='function')stopTimers()}catch{}
    days=makeDays();document.title='Calendário de Animes | AniNexus';app.innerHTML=pageShell();setupIsland();bindControls();addEventListener('scroll',onScroll,{passive:true});clearInterval(timer);timer=setInterval(refreshCountdowns,60000);loadData();setTimeout(()=>{try{if(typeof stopTimers==='function')stopTimers()}catch{}},2200);
  }

  const mo=new MutationObserver(()=>{if(route()===ROUTE&&!document.querySelector('.nx-schedule-v16')&&!remountQueued){remountQueued=true;queueMicrotask(()=>{remountQueued=false;mount(true)})}});mo.observe(app,{childList:true});
  const oldPush=history.pushState.bind(history),oldReplace=history.replaceState.bind(history);
  history.pushState=function(...args){const r=oldPush(...args);queueMicrotask(()=>mount());return r};
  history.replaceState=function(...args){const r=oldReplace(...args);queueMicrotask(()=>mount());return r};
  addEventListener('popstate',()=>setTimeout(()=>mount(),0));
  setTimeout(()=>mount(),0);
})();
