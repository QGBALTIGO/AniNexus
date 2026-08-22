'use strict';
(() => {
  const API='https://graphql.anilist.co';
  const IS_PAGES=location.hostname.endsWith('github.io');
  const BASE=IS_PAGES?'/AniNexus':'';
  const TRANSLATE='https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=pt&dt=t&q=';
  const CACHE_NEWS='aninexus:home:v30:news';
  const CACHE_READING='aninexus:home:v30:reading';
  const TTL=10*60*1000;
  let mounted=false;
  let observer=null;

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const strip=s=>{const d=document.createElement('div');d.innerHTML=String(s||'');return(d.textContent||'').replace(/\s+/g,' ').trim()};
  const slug=s=>String(s||'manga').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,90)||'manga';
  const title=m=>m?.title?.english||m?.title?.userPreferred||m?.title?.romaji||m?.title?.native||'Título';
  const image=m=>m?.coverImage?.extraLarge||m?.coverImage?.large||'';
  const score=m=>m?.averageScore?String((Number(m.averageScore)/10).toFixed(1)).replace('.0',''):'';
  const genreMap={Action:'Ação',Adventure:'Aventura',Comedy:'Comédia',Drama:'Drama',Fantasy:'Fantasia',Horror:'Terror',Mystery:'Mistério',Romance:'Romance','Sci-Fi':'Ficção Científica','Slice of Life':'Slice of Life',Sports:'Esportes',Supernatural:'Sobrenatural',Thriller:'Suspense',Music:'Música',Psychological:'Psicológico',Mecha:'Mecha'};
  const typeMap={MANGA:'Mangá',NOVEL:'Light novel',ONE_SHOT:'One-shot'};
  const arrow='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M14 7.5 18.5 12 14 16.5"/></svg>';
  const clock='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

  function route(){
    try{
      const u=new URL(location.href),p=u.searchParams.get('p');
      if(p)return p.split('?')[0].replace(/\/+$/,'')||'/';
      let x=u.pathname;if(IS_PAGES)x=x.replace(/^\/AniNexus/,'')||'/';
      return x.replace(/\/+$/,'')||'/';
    }catch{return'/'}
  }
  function cacheGet(key){try{const x=JSON.parse(localStorage.getItem(key)||'null');return x?.at&&Date.now()-x.at<TTL?x.data:null}catch{return null}}
  function cacheSet(key,data){try{localStorage.setItem(key,JSON.stringify({at:Date.now(),data}))}catch{}}
  function hash(s){let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0).toString(36)}
  function ptCacheGet(s){try{return localStorage.getItem('nx30:pt:'+hash(s))||''}catch{return''}}
  function ptCacheSet(s,v){try{localStorage.setItem('nx30:pt:'+hash(s),v)}catch{}}

  async function translate(text){
    text=strip(text).trim();if(!text)return'';
    const cached=ptCacheGet(text);if(cached)return cached;
    try{
      const r=await fetch(TRANSLATE+encodeURIComponent(text.slice(0,3800)));
      if(!r.ok)return text;
      const j=await r.json();
      const out=(j?.[0]||[]).map(x=>x?.[0]||'').join('').trim()||text;
      ptCacheSet(text,out);return out;
    }catch{return text}
  }

  async function gql(query,variables={}){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8500);
    try{
      const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({query,variables}),signal:controller.signal});
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      const j=await r.json();if(j.errors?.length)throw new Error(j.errors[0]?.message||'GraphQL');return j.data;
    }finally{clearTimeout(timer)}
  }

  function sectionHead(base,accent,sub,href,label){
    return `<div class="aqx-head"><div><h2>${esc(base)}${accent?` <em>${esc(accent)}</em>`:''}</h2>${sub?`<p>${esc(sub)}</p>`:''}</div>${href?`<a href="${href}" data-link>${esc(label)} ${arrow}</a>`:''}</div>`;
  }

  function decorateHero(home){
    const copy=home.querySelector('.aqx-hero-copy');if(!copy)return;
    if(!copy.querySelector('.nx30-kicker'))copy.insertAdjacentHTML('afterbegin','<span class="nx30-kicker"><img src="./assets/logo.png" alt="">AniNexus · seu universo anime</span>');
    if(!copy.querySelector('.nx30-hero-actions')){
      const p=copy.querySelector(':scope>p');
      p?.insertAdjacentHTML('afterend',`<div class="nx30-hero-actions"><a href="/animes/temporadas" data-link>Explorar temporada ${arrow}</a><a href="/animes/programacao" data-link>${clock} Programação de hoje</a></div>`);
    }
  }

  function injectSections(home){
    if(!home.querySelector('.nx30-news-section')){
      const sections=[...home.querySelectorAll(':scope>.aqx-section')];
      const schedule=sections.find(s=>(s.querySelector('h2')?.textContent||'').includes('Próximos Episódios'));
      const news=document.createElement('section');
      news.className='aqx-section nx30-news-section';
      news.innerHTML=`<div class="aqx-shell">${sectionHead('Notícias','em destaque','Anúncios, trailers, novas temporadas, mangás e o que realmente importa agora.','/noticias','Todas as notícias')}<div id="nx30News"><div class="nx30-news-loading"></div></div></div>`;
      (schedule||sections[0])?.insertAdjacentElement('afterend',news);
    }

    if(!home.querySelector('.nx30-reading-section')){
      const sections=[...home.querySelectorAll(':scope>.aqx-section')];
      const popular=sections.find(s=>(s.querySelector('h2')?.textContent||'').includes('Animes mais'));
      const reading=document.createElement('section');
      reading.className='aqx-section aqx-tonal nx30-reading-section';
      reading.innerHTML=`<div class="aqx-shell">${sectionHead('Mangás &','Light Novels','Continue histórias, descubra obras originais e encontre sua próxima leitura.','/mangas','Explorar leitura')}<div class="nx30-reading-shell"><div id="nx30Reading" class="nx30-reading-rail">${Array.from({length:8},()=>'<div class="aqx-skeleton-card"></div>').join('')}</div></div></div>`;
      (popular||sections[Math.floor(sections.length/2)])?.insertAdjacentElement('afterend',reading);
    }
  }

  async function loadReading(){
    const cached=cacheGet(CACHE_READING);if(cached)return cached;
    const fields='id title{romaji english native userPreferred} coverImage{extraLarge large} averageScore genres format status chapters volumes popularity';
    const d=await gql(`query{Page(page:1,perPage:22){media(type:MANGA,isAdult:false,sort:[POPULARITY_DESC]){${fields}}}}`);
    const items=d?.Page?.media||[];cacheSet(CACHE_READING,items);return items;
  }

  function readingCard(m){
    const kind=typeMap[m.format]||'Mangá';
    return `<article class="nx30-reading-card" data-nx30-read="${m.id}" data-title="${esc(title(m))}">
      <div class="nx30-reading-cover">${image(m)?`<img loading="lazy" decoding="async" src="${esc(image(m))}" alt="${esc(title(m))}">`:''}<span class="nx30-reading-type">${esc(kind)}</span>${score(m)?`<span class="nx30-reading-score">★ ${esc(score(m))}</span>`:''}</div>
      <h3>${esc(title(m))}</h3><p>${esc((m.genres||[]).slice(0,2).map(g=>genreMap[g]||g).join(' · '))}</p>
    </article>`;
  }

  async function paintReading(){
    const root=document.querySelector('#nx30Reading');if(!root)return;
    try{
      const items=await loadReading();
      root.innerHTML=items.length?items.map(readingCard).join(''):'<div class="nx30-reading-empty">Nenhuma leitura encontrada agora.</div>';
    }catch{root.innerHTML='<div class="nx30-reading-empty">Não foi possível carregar mangás e novels agora.</div>'}
  }

  async function loadNews(){
    const cached=cacheGet(CACHE_NEWS);if(cached)return cached;
    let items=[];
    if(!IS_PAGES){
      try{
        const r=await fetch('/api/news?limit=8',{headers:{accept:'application/json'}});
        if(r.ok){const j=await r.json();items=(j?.items||[]).map(x=>({source:x.source_kind==='EDITORIAL'?'AniNexus Editorial':x.source_kind||'AniNexus',sourceType:x.source_kind||'',title:x.title,summary:x.summary,url:x.external_url||'/noticias',publishedAt:x.published_at,category:x.event_type||'Notícias',image:''}))}
      }catch{}
    }
    if(!items.length){
      try{
        const r=await fetch(`${BASE}/data/news.json?v=30.0.0`,{headers:{accept:'application/json'}});
        if(r.ok){const j=await r.json();items=Array.isArray(j?.items)?j.items.slice(0,8):[]}
      }catch{}
    }
    cacheSet(CACHE_NEWS,items);return items;
  }

  function dateLabel(value){
    const d=new Date(value);if(Number.isNaN(d.getTime()))return'';
    return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(d).replace('.','');
  }

  async function localizeNews(items){
    const out=[];
    for(const item of items.slice(0,5)){
      const source=String(item.sourceType||item.source||'').toUpperCase();
      const shouldTranslate=source.includes('ANN')||source.includes('MAL')||String(item.source||'').includes('Anime News Network')||String(item.source||'').includes('MyAnimeList');
      if(!shouldTranslate){out.push({...item,title:strip(item.title),summary:strip(item.summary)});continue}
      const marker=' <<<NX30SEP>>> ';
      const translated=await translate(`${strip(item.title)}${marker}${strip(item.summary)}`);
      const parts=translated.split(/\s*<<<NX30SEP>>>\s*/);
      out.push({...item,title:parts[0]||strip(item.title),summary:parts.slice(1).join(' ')||strip(item.summary)});
    }
    return out;
  }

  function newsFeature(item){
    const has=!!item.image;
    return `<article class="nx30-news-feature ${has?'has-image':''}" data-nx30-news="${esc(item.url||'/noticias')}">${has?`<img loading="lazy" decoding="async" src="${esc(item.image)}" alt="">`:'<span class="nx30-news-placeholder">N</span>'}<div class="nx30-news-copy"><div class="nx30-news-meta"><span>${esc(item.category||'Notícias')}</span><span>${esc(item.source||'AniNexus')}</span><time>${esc(dateLabel(item.publishedAt))}</time></div><h3>${esc(item.title)}</h3><p>${esc(item.summary||'')}</p></div></article>`;
  }
  function newsRow(item){
    return `<article class="nx30-news-row" data-nx30-news="${esc(item.url||'/noticias')}"><div class="nx30-news-thumb">${item.image?`<img loading="lazy" decoding="async" src="${esc(item.image)}" alt="">`:'<span>N</span>'}</div><div class="nx30-news-row-copy"><small>${esc(item.category||item.source||'Notícias')}</small><h3>${esc(item.title)}</h3><time>${esc(dateLabel(item.publishedAt))}</time></div></article>`;
  }

  async function paintNews(){
    const root=document.querySelector('#nx30News');if(!root)return;
    try{
      const raw=await loadNews();
      const items=await localizeNews(raw);
      if(!items.length){root.innerHTML='<div class="aqx-empty">As próximas notícias aparecerão aqui.</div>';return}
      root.innerHTML=`<div class="nx30-news-layout">${newsFeature(items[0])}<div class="nx30-news-list">${items.slice(1,5).map(newsRow).join('')}</div></div>`;
    }catch{root.innerHTML='<div class="aqx-empty">Não foi possível carregar as notícias agora.</div>'}
  }

  function wireReveal(home){
    const sections=[...home.querySelectorAll(':scope>.aqx-section')];
    if(!('IntersectionObserver'in window)){sections.forEach(x=>x.classList.add('nx30-in'));return}
    const io=new IntersectionObserver(entries=>{
      for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add('nx30-in');io.unobserve(entry.target)}
    },{rootMargin:'0px 0px -8% 0px',threshold:.08});
    sections.forEach((s,i)=>{if(i===0){s.classList.add('nx30-in');return}s.classList.add('nx30-reveal');io.observe(s)});
  }

  function wireClicks(){
    document.addEventListener('click',e=>{
      const read=e.target.closest('[data-nx30-read]');
      if(read){const id=Number(read.dataset.nx30Read),name=read.dataset.title||'manga';if(id)location.assign(IS_PAGES?`${BASE}/?build=30.0.0&p=${encodeURIComponent(`/manga/${slug(name)}-${id}`)}`:`/manga/${slug(name)}-${id}`);return}
      const n=e.target.closest('[data-nx30-news]');
      if(n){const url=n.dataset.nx30News;if(!url)return;if(/^https?:\/\//i.test(url))window.open(url,'_blank','noopener,noreferrer');else location.assign(IS_PAGES?`${BASE}/?build=30.0.0&p=${encodeURIComponent(url)}`:url)}
    });
  }

  function mount(){
    if(mounted||route()!=='/')return;
    const home=document.querySelector('[data-aqx-home]');if(!home)return;
    mounted=true;
    document.body.classList.add('nx30-home-identity');
    decorateHero(home);
    injectSections(home);
    wireReveal(home);
    paintNews();paintReading();
  }

  wireClicks();
  if(!mount()){
    const app=document.querySelector('#app');
    if(app){observer=new MutationObserver(()=>{if(route()==='/'&&document.querySelector('[data-aqx-home]'))mount()});observer.observe(app,{childList:true,subtree:true})}
  }
  addEventListener('popstate',()=>{if(route()!=='/'){mounted=false;document.body.classList.remove('nx30-home-identity')}else setTimeout(mount,0)});
})();
