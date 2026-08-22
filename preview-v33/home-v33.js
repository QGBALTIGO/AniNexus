'use strict';
(() => {
  const app=document.querySelector('#app');if(!app)return;
  const IS_PAGES=location.hostname.endsWith('github.io'),BASE=IS_PAGES?'/AniNexus':'',BUILD='33.0.0';
  const API='https://graphql.anilist.co';
  const TRANSLATE='https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=pt&dt=t&q=';
  const TTL=8*60*1000;
  let mounted=false,observer=null,scrollObservers=[];
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const strip=s=>String(s??'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  const slug=s=>String(s||'item').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,96)||'item';
  const hash=s=>{let h=2166136261;for(const c of String(s||'')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0).toString(36)};
  const ICON={arrow:'<svg viewBox="0 0 24 24"><path d="M5 12h13M14 7.5 18.5 12 14 16.5"/></svg>',clock:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',news:'<svg viewBox="0 0 24 24"><path d="M5 4h11v16H5z"/><path d="M8 8h5M8 12h5M8 16h3M16 8h3v12h-3"/></svg>',book:'<svg viewBox="0 0 24 24"><path d="M4 5.5c3-1 5-.6 8 1v13c-3-1.6-5-2-8-1v-13Z"/><path d="M20 5.5c-3-1-5-.6-8 1v13c3-1.6 5-2 8-1v-13Z"/></svg>',pulse:'<svg viewBox="0 0 24 24"><path d="M3 12h4l2-5 4 10 2-5h6"/></svg>'};
  const genreMap={Action:'Ação',Adventure:'Aventura',Comedy:'Comédia',Drama:'Drama',Fantasy:'Fantasia',Horror:'Terror',Mystery:'Mistério',Romance:'Romance','Sci-Fi':'Ficção Científica','Slice of Life':'Slice of Life',Sports:'Esportes',Supernatural:'Sobrenatural',Thriller:'Suspense',Music:'Música',Psychological:'Psicológico',Mecha:'Mecha'};
  const typeMap={MANGA:'Mangá',NOVEL:'Light novel',ONE_SHOT:'One-shot'};
  function route(){try{const u=new URL(location.href),p=u.searchParams.get('p');if(p)return p.split('?')[0].replace(/\/+$/,'')||'/';let x=u.pathname;if(IS_PAGES)x=x.replace(/^\/AniNexus/,'')||'/';return x.replace(/\/+$/,'')||'/'}catch{return'/'}}
  function go(path){location.assign(IS_PAGES?`${BASE}/?build=${BUILD}&p=${encodeURIComponent(path)}`:path)}
  function cacheGet(k){try{const x=JSON.parse(sessionStorage.getItem(k)||'null');return x?.at&&Date.now()-x.at<TTL?x.data:null}catch{return null}}
  function cacheSet(k,data){try{sessionStorage.setItem(k,JSON.stringify({at:Date.now(),data}))}catch{}}
  async function gql(query,variables={}){const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),8500);try{const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({query,variables}),signal:ctl.signal});if(!r.ok)throw new Error(`HTTP ${r.status}`);const j=await r.json();if(j.errors?.length)throw new Error(j.errors[0].message);return j.data}finally{clearTimeout(timer)}}
  async function translatePt(text){text=strip(text).slice(0,3600);if(!text)return'';const key='nx33:pt:'+hash(text);try{const c=localStorage.getItem(key);if(c)return c}catch{};try{const r=await fetch(TRANSLATE+encodeURIComponent(text));if(!r.ok)return text;const j=await r.json(),out=strip((j?.[0]||[]).map(x=>x?.[0]||'').join(''))||text;try{localStorage.setItem(key,out)}catch{}return out}catch{return text}}
  function sectionHead(kicker,title,accent,sub,href,label){return `<div class="aqx-head nx33-head"><div>${kicker?`<span class="nx33-kicker"><i></i>${esc(kicker)}</span>`:''}<h2>${esc(title)}${accent?` <em>${esc(accent)}</em>`:''}</h2>${sub?`<p>${esc(sub)}</p>`:''}</div>${href?`<a href="${href}" data-link>${esc(label||'Ver mais')} ${ICON.arrow}</a>`:''}</div>`}

  function cleanLegacy(home){
    home.querySelectorAll('.nx30-kicker,.nx30-hero-actions,.nx31-universe-strip,.nx31-hero-sigil,.nx31-live-brand').forEach(x=>x.remove());
    home.querySelectorAll(':scope>.aqx-section').forEach(section=>{const t=strip(section.querySelector('.aqx-head h2')?.textContent);if(t==='Tags'||section.classList.contains('nx30-news-section')||section.classList.contains('nx30-reading-section'))section.remove()});
  }
  function brandHero(home){
    const hero=home.querySelector('.aqx-hero'),copy=home.querySelector('.aqx-hero-copy'),live=home.querySelector('.aqx-live');if(!hero||!copy)return;
    copy.innerHTML=`<div class="nx33-brand-lockup"><span><img src="${BASE}/assets/logo.png" alt=""></span><div><small>ANINEXUS</small><strong>SEU UNIVERSO ANIME</strong></div><i></i></div>
      <h1>Seu universo anime.<br><em>Conectado.</em></h1>
      <p>Temporadas, episódios, mangás, notícias, listas e comunidade deixam de ser partes soltas. No AniNexus, tudo conversa para acompanhar o que você ama.</p>
      <div class="nx33-hero-actions"><a class="primary" href="/animes/temporadas" data-link>Explorar a temporada ${ICON.arrow}</a><a href="/animes/programacao" data-link>${ICON.clock} Programação de hoje</a></div>
      <div class="nx33-hero-signals"><span><i></i> horário de Brasília</span><span>${ICON.news} notícias em português</span><span>${ICON.pulse} comunidade ao vivo</span></div>`;
    if(!hero.querySelector('.nx33-orbit'))hero.insertAdjacentHTML('beforeend',`<div class="nx33-orbit" aria-hidden="true"><i></i><i></i><i></i><span><img src="${BASE}/assets/logo.png" alt=""></span></div>`);
    if(live){const title=live.querySelector('.aqx-live-title');if(title)title.innerHTML='<i></i><span>SINAL DA COMUNIDADE</span>';if(!live.querySelector('.nx33-live-head'))live.insertAdjacentHTML('afterbegin',`<div class="nx33-live-head"><img src="${BASE}/assets/logo.png" alt=""><div><small>AGORA NO ANINEXUS</small><strong>O que a comunidade está fazendo</strong></div><span></span></div>`)}
  }

  function injectSections(home){
    const sections=[...home.querySelectorAll(':scope>.aqx-section')],schedule=sections.find(s=>strip(s.querySelector('h2')?.textContent).startsWith('Próximos Episódios'));
    if(!home.querySelector('.nx33-news-section')){const news=document.createElement('section');news.className='aqx-section nx33-news-section';news.innerHTML=`<div class="aqx-shell">${sectionHead('ANINEXUS NOTÍCIAS','Notícias','em destaque','Atualizações recentes transformadas em matérias próprias, em português e para ler sem sair do AniNexus.','/noticias','Todas as notícias')}<div id="nx33HomeNews"><div class="nx33-news-loading"></div></div></div>`;(schedule||sections[0])?.insertAdjacentElement('afterend',news)}
    const popular=[...home.querySelectorAll(':scope>.aqx-section')].find(s=>strip(s.querySelector('h2')?.textContent).startsWith('Animes mais'));
    if(!home.querySelector('.nx33-reading-section')){const reading=document.createElement('section');reading.className='aqx-section aqx-tonal nx33-reading-section';reading.innerHTML=`<div class="aqx-shell">${sectionHead('LEITURA ANINEXUS','Mangás &','Light Novels','Continue além do anime, descubra obras originais e encontre sua próxima leitura.','/mangas','Explorar leitura')}<div class="nx33-edge-host nx33-reading-shell"><div id="nx33Reading" class="nx33-reading-rail">${Array.from({length:9},()=>'<div class="nx33-reading-skeleton"></div>').join('')}</div></div></div>`;(popular||sections[Math.floor(sections.length/2)])?.insertAdjacentElement('afterend',reading)}
  }

  function newsNormalize(x){return{slug:x.slug||`${slug(x.title)}-${String(x.id||hash(x.url||x.title)).replace(/[^a-z0-9-]/gi,'')}`,title:strip(x.title),summary:strip(x.summary),category:({SEASON:'Animes',TRAILER:'Trailers',EPISODE:'Episódios',MANGA:'Mangás & novels',TRENDING:'Em alta',OTHER:'Notícias'})[String(x.event_type||'OTHER').toUpperCase()]||x.category||'Notícias',eventType:String(x.event_type||'OTHER').toUpperCase(),source:x.source_name||x.source||'AniNexus Notícias',sourceType:x.sourceType||'',image:x.image_url||x.image||'',published:x.last_source_update_at||x.source_published_at||x.published_at||x.publishedAt,reading:Number(x.reading_minutes||1),quality:Number(x.quality_score||0)}}
  function newsScore(x){return(x.image?4:0)+(x.quality*3)+(x.summary.length>100?1:0)+(x.category!=='Notícias'?1:0)-(x.title.toLowerCase().includes('all the news and reviews')?3:0)}
  async function loadNews(){
    const cached=cacheGet('nx33:home:news');if(cached)return cached;let list=[];
    if(!IS_PAGES){try{const r=await fetch('/api/news?limit=12',{headers:{accept:'application/json'}});if(r.ok){const j=await r.json();list=(j?.items||[]).map(newsNormalize)}}catch{}}
    if(!list.length){try{const r=await fetch(`${BASE}/data/news.json?v=${BUILD}`,{cache:'no-store'});if(r.ok){const j=await r.json();list=(j?.items||[]).slice(0,16).map(newsNormalize)}}catch{}}
    for(const item of list.slice(0,8)){const english=/\b(the|and|of|to|for|with|new|reveals|announces|confirms|release|season)\b/i.test(`${item.title} ${item.summary}`);if(IS_PAGES&&english){const marker=' <<<NX33SEP>>> ',tr=await translatePt(`${item.title}${marker}${item.summary}`),parts=tr.split(/\s*<<<NX33SEP>>>\s*/);item.title=strip(parts[0]||item.title);item.summary=strip(parts.slice(1).join(' ')||item.summary)}}
    list=list.filter(x=>x.title&&x.slug).sort((a,b)=>newsScore(b)-newsScore(a)||new Date(b.published||0)-new Date(a.published||0));cacheSet('nx33:home:news',list);return list
  }
  function fmt(v){const d=new Date(v);return Number.isNaN(d.getTime())?'':new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(d).replace('.','')}
  function newsMedia(x){return `<div class="nx33-news-media ${x.image?'has-image':'fallback'}">${x.image?`<img loading="lazy" decoding="async" src="${esc(x.image)}" alt="${esc(x.title)}" onerror="this.remove();this.parentElement.classList.remove('has-image');this.parentElement.classList.add('fallback')">`:`<span><img src="${BASE}/assets/logo.png" alt=""></span>`}<b>${esc(x.category)}</b></div>`}
  function newsFeature(x){const p=`/noticias/${x.slug}`;return `<a class="nx33-news-feature" href="${p}" data-nx33-route="${p}">${newsMedia(x)}<div class="nx33-news-feature-copy"><div><span>${esc(x.source)}</span><time>${esc(fmt(x.published))}</time><small>${x.reading} min</small></div><h3>${esc(x.title)}</h3><p>${esc(x.summary)}</p><strong>Ler no AniNexus ${ICON.arrow}</strong></div></a>`}
  function newsCard(x){const p=`/noticias/${x.slug}`;return `<a class="nx33-news-card" href="${p}" data-nx33-route="${p}">${newsMedia(x)}<div><small>${esc(x.category)} · ${esc(fmt(x.published))}</small><h3>${esc(x.title)}</h3><span>${x.reading} min de leitura</span></div></a>`}
  async function paintNews(){const root=document.querySelector('#nx33HomeNews');if(!root)return;try{const list=await loadNews();if(!list.length){root.innerHTML='<div class="aqx-empty">As próximas notícias aparecerão aqui.</div>';return}root.innerHTML=`<div class="nx33-news-layout">${newsFeature(list[0])}<div class="nx33-edge-host nx33-news-stack-host"><div class="nx33-news-stack">${list.slice(1,5).map(newsCard).join('')}</div></div></div>`;setupEdges(root)}catch{root.innerHTML='<div class="aqx-empty">Não foi possível carregar as notícias agora.</div>'}}

  async function loadReading(){const cached=cacheGet('nx33:home:reading');if(cached)return cached;const f='id title{romaji english native userPreferred} coverImage{extraLarge large} averageScore genres format status chapters volumes popularity';const d=await gql(`query{Page(page:1,perPage:22){media(type:MANGA,isAdult:false,sort:[POPULARITY_DESC]){${f}}}}`),items=d?.Page?.media||[];cacheSet('nx33:home:reading',items);return items}
  function mediaTitle(m){return m?.title?.english||m?.title?.userPreferred||m?.title?.romaji||m?.title?.native||'Título'}
  function readingCard(m){const t=mediaTitle(m),cover=m.coverImage?.extraLarge||m.coverImage?.large||'',score=m.averageScore?(m.averageScore/10).toFixed(1).replace('.0',''):'',p=`/manga/${slug(t)}-${m.id}`;return `<a class="nx33-reading-card" href="${p}" data-nx33-route="${p}"><div class="nx33-book"><i></i>${cover?`<img loading="lazy" decoding="async" src="${esc(cover)}" alt="${esc(t)}">`:''}<span>${esc(typeMap[m.format]||'Mangá')}</span>${score?`<b>★ ${score}</b>`:''}</div><h3>${esc(t)}</h3><p>${esc((m.genres||[]).slice(0,2).map(g=>genreMap[g]||g).join(' · '))}</p></a>`}
  async function paintReading(){const root=document.querySelector('#nx33Reading');if(!root)return;try{const items=await loadReading();root.innerHTML=items.length?items.map(readingCard).join(''):'<div class="aqx-empty">Nenhuma leitura encontrada agora.</div>';setupEdges(root.parentElement)}catch{root.innerHTML='<div class="aqx-empty">Não foi possível carregar mangás agora.</div>'}}

  function setupEdge(el,host){if(!el||el.dataset.nx33Edge)return;host=host||el.parentElement;if(!host)return;el.dataset.nx33Edge='1';host.classList.add('nx33-edge-host');const update=()=>{const max=Math.max(0,el.scrollWidth-el.clientWidth);host.dataset.nx33Left=el.scrollLeft>6?'1':'0';host.dataset.nx33Right=el.scrollLeft<max-6?'1':'0'};el.addEventListener('scroll',update,{passive:true});const ro=new ResizeObserver(update);ro.observe(el);scrollObservers.push(ro);requestAnimationFrame(update)}
  function setupEdges(root=document){root.querySelectorAll?.('.aqx-rail').forEach(el=>setupEdge(el,el.closest('.aqx-rail-shell')));root.querySelectorAll?.('.nx33-reading-rail,.nx33-news-stack').forEach(el=>setupEdge(el,el.parentElement))}
  function reveal(home){if(!('IntersectionObserver'in window)){home.querySelectorAll('.aqx-section').forEach(x=>x.classList.add('nx33-in'));return}const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('nx33-in');io.unobserve(e.target)}}),{rootMargin:'0px 0px -6% 0px',threshold:.06});home.querySelectorAll('.aqx-section').forEach((s,i)=>{s.classList.add('nx33-reveal');s.style.setProperty('--nx33-delay',`${Math.min(i,3)*45}ms`);io.observe(s)})}
  function mount(force=false){if(route()!=='/')return false;const home=document.querySelector('[data-aqx-home]');if(!home)return false;if(mounted&&!force)return true;mounted=true;cleanLegacy(home);brandHero(home);injectSections(home);reveal(home);setupEdges(home);paintNews();paintReading();document.body.classList.add('nx33-home');return true}
  function cleanup(){mounted=false;document.body.classList.remove('nx33-home');scrollObservers.forEach(x=>x.disconnect());scrollObservers=[]}
  document.addEventListener('click',e=>{const a=e.target.closest('[data-nx33-route]');if(!a)return;e.preventDefault();e.stopImmediatePropagation();go(a.dataset.nx33Route)},true);
  addEventListener('popstate',()=>{if(route()==='/'){cleanup();setTimeout(()=>mount(true),0)}else cleanup()});
  if(!mount()){observer=new MutationObserver(()=>{if(route()==='/'&&document.querySelector('[data-aqx-home]')){mount(true);observer?.disconnect()}});observer.observe(app,{childList:true,subtree:true})}
})();
