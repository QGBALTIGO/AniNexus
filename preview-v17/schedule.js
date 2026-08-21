'use strict';
(() => {
  const app=document.querySelector('#app');
  if(!app)return;
  const IS_PAGES=location.hostname.endsWith('github.io');
  const BASE=IS_PAGES?'/AniNexus':'';
  const ROUTE='/animes/programacao';
  const TZ='America/Sao_Paulo';
  const API='https://graphql.anilist.co';
  const FRESH=4*60*1000;
  const STALE=10*60*60*1000;
  const MAX_PAGES=4;
  let items=[];
  let days=[];
  let timer=null;
  let controller=null;
  let island=null;
  let sectionObserver=null;
  let activeDay='';
  let favOnly=false;
  let selectedProviders=new Set();
  let lastScrollY=Math.max(0,scrollY);
  let scrollRaf=0;
  let mounted=false;

  const SVG={
    heart:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.7 8.7c0 5-8.7 10.1-8.7 10.1S3.3 13.7 3.3 8.7A4.6 4.6 0 0 1 12 6.2a4.6 4.6 0 0 1 8.7 2.5Z"/></svg>',
    plus:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    check:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.2 4.2L19 7"/></svg>',
    star:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.5 6.1.9-4.4 4.3 1 6.1-5.5-2.9-5.5 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/></svg>',
    calendar:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.2" width="17" height="15.3" rx="2.2"/><path d="M7.5 3v4.2M16.5 3v4.2M3.5 9.3h17"/></svg>',
    tv:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="2.2"/><path d="m10 9 5 3-5 3V9Z"/></svg>',
    down:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9 5 5 5-5"/></svg>',
    close:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
    bookmark:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.5h12v16l-6-4-6 4v-16Z"/></svg>',
    crunchy:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 13.2A8.7 8.7 0 1 1 12 3.3c2.4 0 4.6 1 6.2 2.5a6.6 6.6 0 1 0 2 7.4Z"/><path d="M14.7 8.2a4.2 4.2 0 1 0 4.1 5.1 3.2 3.2 0 1 1-4.1-5.1Z"/></svg>',
    netflix:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h4l6 18h-4L7 3Z"/><path d="M7 3h4v18H7V3ZM13 3h4v18h-4"/></svg>',
    prime:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8.5h2.6c2 0 3.2 1 3.2 2.8S9.6 14 7.6 14H6v2H5V8.5Z"/><path d="M12.2 12h1v4h-1zM15 12h1l1.1 2.8L18.2 12h1l.8 4h-1l-.4-2.5-1 2.5h-1l-1-2.5-.3 2.5h-1L15 12Z"/><path d="M5 18c4.7 2.2 9.5 2.2 14 0"/></svg>',
    disney:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16.5h16M6 14c2.3-6.5 8.5-9 13-6.3"/><path d="M9 12h2.2c1.9 0 3.3 1 3.3 2.4s-1.4 2.4-3.3 2.4H9V12Z"/></svg>',
    apple:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.7 7.2c-1 .1-2-.6-2.6-1.3-.6-.8-1-1.9-.8-3 1.1 0 2.1.6 2.7 1.4.6.8 1 1.9.7 2.9Z"/><path d="M19.2 17.4c-.6 1.4-1.4 2.7-2.5 2.7-1 0-1.4-.6-2.7-.6s-1.8.6-2.8.6c-1.1 0-1.9-1.2-2.5-2.6-1.3-2.8-1.4-6.1-.6-7.5.7-1.1 1.8-1.8 3-1.8 1.1 0 2.1.7 2.7.7.6 0 1.8-.8 3-.7.5 0 2 .2 3 1.6-2.7 1.6-2.2 5.3.4 6.3-.2.5-.6 1.1-1 1.3Z"/></svg>'
  };

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const title=m=>m?.title?.english||m?.title?.userPreferred||m?.title?.romaji||m?.title?.native||'Anime';
  const cover=m=>m?.coverImage?.extraLarge||m?.coverImage?.large||'';
  const score=m=>m?.averageScore?String((Number(m.averageScore)/10).toFixed(1)).replace('.0',''):'';
  const slug=s=>String(s||'anime').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,90);
  const genreMap={Action:'Ação',Adventure:'Aventura',Comedy:'Comédia',Drama:'Drama',Fantasy:'Fantasia',Horror:'Terror',Mystery:'Mistério',Romance:'Romance','Sci-Fi':'Ficção Científica','Slice of Life':'Slice of Life',Sports:'Esportes',Supernatural:'Sobrenatural',Thriller:'Suspense',Music:'Música',Psychological:'Psicológico',Mecha:'Mecha'};
  const genre=g=>genreMap[g]||g;

  function requestedRoute(){
    if(window.__ANINEXUS_SCHEDULE_V17__)return ROUTE;
    const u=new URL(location.href);const p=u.searchParams.get('p');
    if(p)return p.split('?')[0].replace(/\/+$/,'')||'/';
    let path=location.pathname;if(IS_PAGES)path=path.replace(/^\/AniNexus/,'')||'/';return path.replace(/\/+$/,'')||'/';
  }
  function restoreRoute(){
    if(!window.__ANINEXUS_SCHEDULE_V17__)return;
    history.replaceState({},'',`${BASE}${ROUTE}`);
    delete window.__ANINEXUS_SCHEDULE_V17__;
  }
  function dateKey(d){return new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(d)}
  function dayStart(){const k=dateKey(new Date());return new Date(`${k}T12:00:00-03:00`)}
  function buildDays(){
    const base=dayStart();
    return Array.from({length:7},(_,i)=>{
      const d=new Date(base.getTime()+i*864e5);
      const dow=new Intl.DateTimeFormat('pt-BR',{timeZone:TZ,weekday:'short'}).format(d).replace('.','').toUpperCase();
      const fullRaw=new Intl.DateTimeFormat('pt-BR',{timeZone:TZ,weekday:'long'}).format(d);
      return {key:dateKey(d),day:new Intl.DateTimeFormat('pt-BR',{timeZone:TZ,day:'2-digit'}).format(d),dow,full:fullRaw.charAt(0).toUpperCase()+fullRaw.slice(1)};
    });
  }
  function range(){const k=dateKey(new Date());const s=new Date(`${k}T00:00:00-03:00`);return{key:k,start:Math.floor(s.getTime()/1000),end:Math.floor((s.getTime()+7*864e5)/1000)}}
  function fmtTime(ts){return new Intl.DateTimeFormat('pt-BR',{timeZone:TZ,hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(ts*1000))}
  function airLabel(ts){const k=dateKey(new Date(ts*1000));if(k===days[0]?.key)return'HOJE';if(k===days[1]?.key)return'AMANHÃ';return new Intl.DateTimeFormat('pt-BR',{timeZone:TZ,day:'2-digit',month:'short'}).format(new Date(ts*1000)).replace('.','').toUpperCase()}

  function cacheKey(){return`nx:v17:schedule:${range().key}`}
  function readCache(){try{const v=JSON.parse(localStorage.getItem(cacheKey())||'null');if(!v||!Array.isArray(v.items)||Date.now()-v.savedAt>STALE)return null;return v}catch{return null}}
  function writeCache(data){try{localStorage.setItem(cacheKey(),JSON.stringify({savedAt:Date.now(),items:data}))}catch{}}
  function merge(a,b){return[...new Map([...a,...b].filter(x=>x?.media?.id&&x?.airingAt).map(x=>[`${x.media.id}:${x.episode}:${x.airingAt}`,x])).values()].sort((x,y)=>x.airingAt-y.airingAt)}
  function readSet(k){try{return new Set((JSON.parse(localStorage.getItem(k)||'[]')||[]).map(Number))}catch{return new Set()}}
  function writeSet(k,s){try{localStorage.setItem(k,JSON.stringify([...s]))}catch{}}
  function readStatuses(){try{const v=JSON.parse(localStorage.getItem('aninexus:listStatus')||'{}');return v&&typeof v==='object'?v:{}}catch{return{}}}
  function writeStatuses(v){try{localStorage.setItem('aninexus:listStatus',JSON.stringify(v))}catch{}}
  function myAnimeIds(){const a=readSet('aninexus:favorites'),b=readSet('aninexus:list'),s=readStatuses();Object.keys(s).forEach(id=>b.add(Number(id)));return new Set([...a,...b])}

  const FIELDS=`id title{romaji english native userPreferred} coverImage{extraLarge large} averageScore genres episodes externalLinks{site url type icon color}`;
  async function fetchPage(page,start,end,signal){
    const query=`query($page:Int,$start:Int,$end:Int){Page(page:$page,perPage:50){pageInfo{hasNextPage}airingSchedules(airingAt_greater:$start,airingAt_lesser:$end,sort:TIME){airingAt episode media{${FIELDS}}}}}`;
    const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({query,variables:{page,start,end}}),signal});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);const j=await r.json();if(j.errors?.length)throw new Error(j.errors[0]?.message||'Falha ao carregar');
    return{items:j?.data?.Page?.airingSchedules||[],next:!!j?.data?.Page?.pageInfo?.hasNextPage};
  }
  async function fetchServer(start,end,signal){if(IS_PAGES)return null;try{const r=await fetch(`/api/schedule?start=${start}&end=${end}`,{signal,headers:{accept:'application/json'}});if(!r.ok)return null;const d=await r.json();return Array.isArray(d)?d:null}catch{return null}}

  function providerKey(link){
    const s=`${link?.site||''} ${link?.url||''}`.toLowerCase();
    if(s.includes('crunchyroll'))return'crunchyroll';if(s.includes('netflix'))return'netflix';if(s.includes('primevideo')||s.includes('prime video')||s.includes('amazon'))return'prime';if(s.includes('disney'))return'disney';if(s.includes('apple'))return'apple';if(s.includes('hidive'))return'hidive';if(s.includes('hulu'))return'hulu';return slug(link?.site||'stream');
  }
  function providerLabel(k,site=''){return({crunchyroll:'Crunchyroll',netflix:'Netflix',prime:'Prime Video',disney:'Disney+',apple:'Apple TV',hidive:'HIDIVE',hulu:'Hulu'})[k]||site||k}
  function streamLinks(m){return(m?.externalLinks||[]).filter(x=>String(x?.type||'').toUpperCase()==='STREAMING'&&/^https:\/\//i.test(x?.url||''))}
  function providerIcon(link,compact=false){
    const k=providerKey(link),src=/^https:\/\//i.test(link?.icon||'')?link.icon:'';
    if(src)return`<img src="${esc(src)}" alt="" loading="lazy" decoding="async">`;
    const fallback=k==='crunchyroll'?SVG.crunchy:k==='netflix'?SVG.netflix:k==='prime'?SVG.prime:k==='disney'?SVG.disney:k==='apple'?SVG.apple:`<span>${esc(providerLabel(k,link?.site).slice(0,2))}</span>`;
    return`<span class="nx17-brand-fallback ${compact?'compact':''}" data-provider="${esc(k)}">${fallback}</span>`;
  }
  function primaryStream(m){const links=streamLinks(m);if(!links.length)return null;const pref=['crunchyroll','netflix','prime','disney','apple','hidive','hulu'];return links.sort((a,b)=>pref.indexOf(providerKey(a))-pref.indexOf(providerKey(b)))[0]}
  function providers(){
    const map=new Map();for(const x of items)for(const l of streamLinks(x.media)){const k=providerKey(l);if(!map.has(k))map.set(k,{key:k,label:providerLabel(k,l.site),link:l,count:0});map.get(k).count++}
    const pref=['apple','crunchyroll','disney','netflix','prime','hidive','hulu'];return[...map.values()].sort((a,b)=>{const ai=pref.indexOf(a.key),bi=pref.indexOf(b.key);return(ai<0?99:ai)-(bi<0?99:bi)||a.label.localeCompare(b.label)})
  }

  function dayButtons(attr='data-nx17-day'){return days.map((d,i)=>`<button type="button" class="nx17-day ${i===0?'active':''}" ${attr}="${d.key}"><small>${d.dow}</small><b>${d.day}</b></button>`).join('')}
  function controls(){return`<div class="nx17-actions"><button type="button" class="nx17-pill ${favOnly?'active':''}" data-nx17-my>${SVG.heart}<span>Meus animes</span></button><button type="button" class="nx17-pill ${selectedProviders.size?'active':''}" data-nx17-stream>${SVG.tv}<span>Onde assistir</span></button></div>`}
  function shell(){return`<div class="nx17-schedule"><section class="nx17-hero" id="nx17Hero"><div class="nx17-shell"><h1><em>Calendário</em> de Animes da Semana</h1><p>Acompanhe os dias e horários de lançamento dos episódios, no horário de Brasília.</p><div class="nx17-days">${dayButtons()}</div>${controls()}</div></section><section class="nx17-body"><div class="nx17-shell" id="nx17Root"><div class="nx17-loading">${Array.from({length:5},()=>'<div class="nx17-skeleton"></div>').join('')}</div></div></section></div>`}
  function islandMarkup(){return`<aside class="nx17-island" id="nx17Island" aria-label="Navegação rápida da programação"><div class="nx17-island-inner"><button class="nx17-island-head" type="button" data-nx17-island-toggle>${SVG.calendar}<span><strong>Programação</strong><small>Troque o dia sem voltar ao topo</small></span><i>${SVG.down}</i></button><div class="nx17-island-panel"><div><div class="nx17-days">${dayButtons('data-nx17-idday')}</div>${controls()}</div></div></div></aside>`}

  function countdownMarkup(ts){return`<div class="nx17-countdown" data-airing="${Number(ts)}"></div>`}
  function card(x){
    const m=x.media||{},sc=score(m),stream=primaryStream(m),final=m.episodes&&Number(x.episode)===Number(m.episodes),statuses=readStatuses(),favs=readSet('aninexus:favorites'),listed=!!statuses[m.id]||readSet('aninexus:list').has(Number(m.id));
    return`<article class="nx17-card" data-nx17-open="${m.id}" data-title="${esc(title(m))}"><div class="nx17-cover"><img src="${esc(cover(m))}" alt="${esc(title(m))}" loading="lazy" decoding="async">${sc?`<span class="nx17-score">${SVG.star}<b>${sc}</b></span>`:''}<div class="nx17-cover-actions"><button type="button" class="nx17-circle ${listed?'active':''}" data-nx17-list="${m.id}" aria-label="Adicionar ${esc(title(m))} à lista">${listed?SVG.check:SVG.plus}</button><button type="button" class="nx17-circle heart ${favs.has(Number(m.id))?'active':''}" data-nx17-fav="${m.id}" aria-label="Favoritar ${esc(title(m))}">${SVG.heart}</button></div></div><div class="nx17-info"><div class="nx17-air"><span>${airLabel(x.airingAt)}</span><b>${fmtTime(x.airingAt)}</b></div>${countdownMarkup(x.airingAt)}<h3>${esc(title(m))}</h3><p>${esc((m.genres||[]).slice(0,3).map(genre).join(', '))}</p>${x.episode===1||final?`<span class="nx17-state">${x.episode===1?'Estreia':'Episódio final'}</span>`:''}${stream?`<a class="nx17-stream-icon" href="${esc(stream.url)}" target="_blank" rel="noopener noreferrer" title="${esc(providerLabel(providerKey(stream),stream.site))}">${providerIcon(stream,true)}</a>`:''}<div class="nx17-episode"><small>EP</small><strong>${Number(x.episode)||'—'}</strong></div></div></article>`
  }
  function grouped(){
    const map=new Map(days.map(d=>[d.key,{...d,items:[]}]))
    for(const x of items){const k=dateKey(new Date(x.airingAt*1000));if(map.has(k))map.get(k).items.push(x)}
    const mine=myAnimeIds();
    return[...map.values()].map(g=>({...g,items:g.items.filter(x=>{if(favOnly&&!mine.has(Number(x.media?.id)))return false;if(selectedProviders.size){const ks=new Set(streamLinks(x.media).map(providerKey));if(![...selectedProviders].some(k=>ks.has(k)))return false}return true})}))
  }
  function renderData(){
    const root=document.querySelector('#nx17Root');if(!root)return;const gs=grouped();
    root.innerHTML=gs.map(g=>g.items.length?`<section class="nx17-day-section" id="nx17-day-${g.key}" data-nx17-section="${g.key}"><div class="nx17-day-title"><h2>${g.full}</h2></div><div class="nx17-grid">${g.items.map(card).join('')}</div></section>`:'').join('')||`<div class="nx17-empty">Nenhum episódio corresponde aos filtros selecionados.</div>`;
    bindCards();observeSections();updateCountdowns();syncControls();
  }

  function timerText(node){
    const ts=Number(node.dataset.airing),diff=ts-Math.floor(Date.now()/1000);if(!Number.isFinite(ts)||diff<=0){node.hidden=true;return}node.hidden=false;
    if(diff<3600){const min=Math.max(1,Math.ceil(diff/60));node.innerHTML=`<span class="nx17-soon"><b>${min}min</b> para o episódio</span>`;return}
    let s=diff;const d=Math.floor(s/86400);s%=86400;const h=Math.floor(s/3600);s%=3600;const m=Math.floor(s/60),sec=s%60;
    const two=n=>String(n).padStart(2,'0');
    node.innerHTML=d>0?`<span>${d}d</span><i>:</i><span>${two(h)}</span><i>:</i><span>${two(m)}</span><i>:</i><span>${two(sec)}</span>`:`<span>${two(h)}</span><i>:</i><span>${two(m)}</span><i>:</i><span>${two(sec)}</span>`;
  }
  function updateCountdowns(){document.querySelectorAll('.nx17-countdown').forEach(timerText)}
  function startTimer(){clearInterval(timer);updateCountdowns();timer=setInterval(updateCountdowns,1000)}

  function syncControls(){
    document.querySelectorAll('[data-nx17-my]').forEach(b=>b.classList.toggle('active',favOnly));
    document.querySelectorAll('[data-nx17-stream]').forEach(b=>b.classList.toggle('active',selectedProviders.size>0));
    document.querySelectorAll('.nx17-day').forEach(b=>{const k=b.dataset.nx17Day||b.dataset.nx17Idday;b.classList.toggle('active',k===activeDay)})
  }
  function setActiveDay(k){if(!k)return;activeDay=k;syncControls()}
  function goDay(k){setActiveDay(k);const el=document.querySelector(`#nx17-day-${CSS.escape(k)}`);if(el)el.scrollIntoView({behavior:'smooth',block:'start'})}

  function openListMenu(button,id){
    document.querySelector('.nx17-list-pop')?.remove();const statuses=readStatuses();
    const pop=document.createElement('div');pop.className='nx17-list-pop';pop.innerHTML=`<strong>Minha lista</strong><button data-status="PLANNING">Quero ver</button><button data-status="CURRENT">Assistindo</button><button data-status="COMPLETED">Terminei</button><button data-status="PAUSED">Pausado</button><button data-status="DROPPED">Desisti</button>${statuses[id]?'<button class="remove" data-status="REMOVE">Remover da lista</button>':''}`;document.body.append(pop);
    const r=button.getBoundingClientRect(),w=190;let left=Math.max(10,Math.min(innerWidth-w-10,r.right-w)),top=r.bottom+7;if(top+pop.offsetHeight>innerHeight-10)top=Math.max(60,r.top-pop.offsetHeight-7);pop.style.left=`${left}px`;pop.style.top=`${top}px`;
    pop.addEventListener('click',e=>{const b=e.target.closest('[data-status]');if(!b)return;const st=readStatuses(),list=readSet('aninexus:list');if(b.dataset.status==='REMOVE'){delete st[id];list.delete(Number(id))}else{st[id]=b.dataset.status;list.add(Number(id))}writeStatuses(st);writeSet('aninexus:list',list);pop.remove();renderData()});
    setTimeout(()=>document.addEventListener('pointerdown',e=>{if(!pop.contains(e.target)&&e.target!==button)pop.remove()},{once:true}),0)
  }
  function toggleFav(id){const s=readSet('aninexus:favorites');s.has(id)?s.delete(id):s.add(id);writeSet('aninexus:favorites',s);renderData()}

  function providerModal(){
    document.querySelector('.nx17-modal')?.remove();const ps=providers();const modal=document.createElement('div');modal.className='nx17-modal';modal.innerHTML=`<button class="nx17-modal-backdrop" data-close aria-label="Fechar"></button><div class="nx17-modal-card"><button class="nx17-modal-x" data-close aria-label="Fechar">${SVG.close}</button><h2>Onde assistir</h2><p>Filtre a programação pelas plataformas disponíveis para os animes desta semana.</p><div class="nx17-provider-list">${ps.map(p=>`<button type="button" class="nx17-provider ${selectedProviders.has(p.key)?'active':''}" data-provider="${esc(p.key)}">${providerIcon(p.link)}<span>${esc(p.label)}</span></button>`).join('')||'<span class="nx17-no-providers">Nenhuma plataforma identificada nesta programação.</span>'}</div><div class="nx17-modal-actions"><button type="button" class="clear" data-clear>Limpar</button><button type="button" class="apply" data-apply>Aplicar</button></div></div>`;document.body.append(modal);document.body.classList.add('modal-open');
    const draft=new Set(selectedProviders);modal.querySelectorAll('[data-provider]').forEach(b=>b.onclick=()=>{const k=b.dataset.provider;draft.has(k)?draft.delete(k):draft.add(k);b.classList.toggle('active',draft.has(k))});
    const close=()=>{modal.remove();document.body.classList.remove('modal-open')};modal.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);modal.querySelector('[data-clear]').onclick=()=>{draft.clear();modal.querySelectorAll('[data-provider]').forEach(b=>b.classList.remove('active'))};modal.querySelector('[data-apply]').onclick=()=>{selectedProviders=draft;close();renderData()};
  }

  function bindCards(){
    document.querySelectorAll('[data-nx17-open]').forEach(el=>el.onclick=e=>{if(e.target.closest('button,a'))return;const path=`/anime/${slug(el.dataset.title)}-${el.dataset.nx17Open}`;if(typeof window.go==='function')window.go(path);else location.href=BASE+path});
    document.querySelectorAll('[data-nx17-list]').forEach(b=>b.onclick=e=>{e.stopPropagation();openListMenu(b,Number(b.dataset.nx17List))});
    document.querySelectorAll('[data-nx17-fav]').forEach(b=>b.onclick=e=>{e.stopPropagation();toggleFav(Number(b.dataset.nx17Fav))});
  }
  function bindControls(root=document){
    root.querySelectorAll('[data-nx17-day]').forEach(b=>b.onclick=()=>goDay(b.dataset.nx17Day));root.querySelectorAll('[data-nx17-idday]').forEach(b=>b.onclick=()=>goDay(b.dataset.nx17Idday));
    root.querySelectorAll('[data-nx17-my]').forEach(b=>b.onclick=()=>{favOnly=!favOnly;renderData()});root.querySelectorAll('[data-nx17-stream]').forEach(b=>b.onclick=providerModal);
  }

  function observeSections(){sectionObserver?.disconnect();const els=[...document.querySelectorAll('[data-nx17-section]')];if(!els.length)return;sectionObserver=new IntersectionObserver(es=>{const visible=es.filter(e=>e.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top);if(visible[0])setActiveDay(visible[0].target.dataset.nx17Section)},{rootMargin:'-28% 0px -58% 0px',threshold:[0,.05]});els.forEach(e=>sectionObserver.observe(e))}
  function ensureIsland(){if(island||!matchMedia('(max-width:720px)').matches)return;island=document.createElement('div');island.innerHTML=islandMarkup();island=island.firstElementChild;document.body.append(island);bindControls(island);island.querySelector('[data-nx17-island-toggle]').onclick=()=>island.classList.toggle('expanded')}
  function scrollUpdate(){
    scrollRaf=0;if(!mounted)return;ensureIsland();const y=Math.max(0,scrollY),hero=document.querySelector('#nx17Hero');if(!hero||!island){lastScrollY=y;return}const show=hero.getBoundingClientRect().bottom<58;island.classList.toggle('show',show);document.body.classList.toggle('nx17-island-visible',show);
    const delta=y-lastScrollY;if(!show||y<80){island.classList.remove('expanded');document.body.classList.remove('nx17-header-hidden')}else if(delta>8){island.classList.remove('expanded');document.body.classList.add('nx17-header-hidden')}else if(delta<-8){island.classList.add('expanded');document.body.classList.remove('nx17-header-hidden')}lastScrollY=y;
  }
  function onScroll(){if(!scrollRaf)scrollRaf=requestAnimationFrame(scrollUpdate)}

  async function load(){
    controller?.abort();controller=new AbortController();const token=Date.now(),r=range(),cached=readCache();
    if(cached){items=cached.items;renderData();startTimer();if(Date.now()-cached.savedAt<FRESH)return}
    try{
      const server=await fetchServer(r.start,r.end,controller.signal);if(server?.length){items=merge([],server);writeCache(items);renderData();startTimer();return}
      const first=await fetchPage(1,r.start,r.end,controller.signal);items=merge(cached?.items||[],first.items);writeCache(items);renderData();startTimer();let page=2,next=first.next;
      while(next&&page<=MAX_PAGES){const d=await fetchPage(page,r.start,r.end,controller.signal);items=merge(items,d.items);writeCache(items);renderData();next=d.next;page++}
    }catch(err){if(err?.name==='AbortError')return;if(!items.length){const root=document.querySelector('#nx17Root');if(root)root.innerHTML='<div class="nx17-empty">Não foi possível carregar a programação agora. Tente novamente em instantes.</div>'}}
  }

  function cleanup(){mounted=false;clearInterval(timer);controller?.abort();sectionObserver?.disconnect();island?.remove();island=null;document.body.classList.remove('nx17-schedule-active','nx17-header-hidden','nx17-island-visible','modal-open');document.querySelector('.nx17-modal')?.remove();document.querySelector('.nx17-list-pop')?.remove();removeEventListener('scroll',onScroll)}
  function mount(){
    if(requestedRoute()!==ROUTE)return;restoreRoute();mounted=true;days=buildDays();activeDay=days[0]?.key||'';document.body.classList.remove('nx-season-active','nx-detail-active','nx-legal-active','nx-inst-active');document.body.classList.add('nx17-schedule-active');document.title='Calendário de Animes | AniNexus';
    document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav==='schedule'));app.innerHTML=shell();bindControls(app);ensureIsland();addEventListener('scroll',onScroll,{passive:true});scrollUpdate();load();
  }

  document.addEventListener('click',e=>{const a=e.target.closest('a[data-link],a[data-nx-inst],a[data-nx-legal]');if(a&&mounted&&!String(a.getAttribute('href')||'').includes('/animes/programacao'))cleanup()},true);
  addEventListener('popstate',()=>setTimeout(()=>{if(requestedRoute()===ROUTE){cleanup();mount()}else cleanup()},0));
  mount();
})();
