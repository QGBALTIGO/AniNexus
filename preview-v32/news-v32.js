'use strict';
(() => {
  const app=document.querySelector('#app');if(!app)return;
  const IS_PAGES=location.hostname.endsWith('github.io');
  const BASE=IS_PAGES?'/AniNexus':'';
  const BUILD='32.0.0';
  const CACHE_KEY='aninexus:news:v32';
  const READ_KEY='aninexus:news:read:v1';
  const CACHE_TTL=5*60*1000;
  let feed=[];
  let active='ALL';
  let query='';
  let progressBound=false;

  const ICON={
    arrow:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M14 7.5 18.5 12 14 16.5"/></svg>',
    back:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 5-7 7 7 7"/></svg>',
    search:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.3 15.3 5 5"/></svg>',
    clock:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    check:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>',
    copy:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>',
    spark:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z"/><path d="m19 15 .8 2.2 2.2.8-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/></svg>'
  };

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const strip=s=>String(s??'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  const slugify=s=>String(s||'noticia').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,105)||'noticia';
  const hash=s=>{let h=2166136261;for(const c of String(s||'')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0).toString(36)};
  const categoryLabel=v=>({SEASON:'Animes',TRAILER:'Trailers',EPISODE:'Episódios',MANGA:'Mangás & novels',TRENDING:'Em alta',OTHER:'Notícias'})[String(v||'OTHER').toUpperCase()]||'Notícias';

  function route(){try{const u=new URL(location.href),p=u.searchParams.get('p');if(p)return p.split('?')[0].replace(/\/+$/,'')||'/';let x=u.pathname;if(IS_PAGES)x=x.replace(/^\/AniNexus/,'')||'/';return x.replace(/\/+$/,'')||'/'}catch{return'/'}}
  function owns(){return route()==='/noticias'||/^\/noticias\/[a-z0-9-]+$/.test(route())}
  function go(path){location.assign(IS_PAGES?`${BASE}/?build=${BUILD}&p=${encodeURIComponent(path)}`:path)}
  function date(value,long=false){const d=new Date(value);if(Number.isNaN(d.getTime()))return'';return new Intl.DateTimeFormat('pt-BR',long?{day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}:{day:'2-digit',month:'short',year:'numeric'}).format(d).replace('.','')}
  function relative(value){const t=new Date(value).getTime();if(!Number.isFinite(t))return'';const ms=Math.max(0,Date.now()-t),h=Math.floor(ms/36e5),d=Math.floor(ms/864e5);if(h<1)return'Agora há pouco';if(h<24)return`Há ${h}h`;if(d===1)return'Ontem';if(d<7)return`Há ${d} dias`;return date(value)}
  function readSet(){try{return new Set(JSON.parse(localStorage.getItem(READ_KEY)||'[]'))}catch{return new Set()}}
  function markRead(slug){const set=readSet();set.add(slug);try{localStorage.setItem(READ_KEY,JSON.stringify([...set].slice(-500)))}catch{}}
  function cacheGet(){try{const x=JSON.parse(sessionStorage.getItem(CACHE_KEY)||'null');return x?.at&&Date.now()-x.at<CACHE_TTL?x.items:null}catch{return null}}
  function cacheSet(items){try{sessionStorage.setItem(CACHE_KEY,JSON.stringify({at:Date.now(),items}))}catch{}}

  function parseBody(body){if(!body)return{};if(typeof body==='object')return body;try{const x=JSON.parse(body);return x&&typeof x==='object'?x:{}}catch{return{lead:strip(body),sections:[]}}}
  function normalize(x){
    const meta=parseBody(x.body),sources=Array.isArray(x.sources)?x.sources:Array.isArray(meta.sources)?meta.sources:[];
    return{
      id:String(x.id||x.slug||hash(x.title)),slug:x.slug||`${slugify(x.title)}-${hash(x.source_url||x.url||x.title)}`,
      title:strip(x.title),summary:strip(x.summary||meta.lead),category:categoryLabel(x.event_type||x.category),eventType:String(x.event_type||'OTHER').toUpperCase(),
      image:x.image_url||x.image||meta.imageUrl||'',imageAlt:x.image_alt||x.title||'',source:x.source_name||x.source||sources[0]?.name||'AniNexus Notícias',
      publishedAt:x.source_published_at||x.published_at||x.publishedAt,expiresAt:x.expires_at||null,facts:Array.isArray(x.facts)?x.facts:Array.isArray(meta.facts)?meta.facts:[],
      sections:Array.isArray(x.content_sections)&&x.content_sections.length?x.content_sections:Array.isArray(meta.sections)?meta.sections:[],sources,
      readingMinutes:Number(x.reading_minutes||meta.readingMinutes||1),wordCount:Number(x.word_count||meta.wordCount||0),quality:Number(x.quality_score||0),
      originalTitle:x.original_title||meta.originalTitle||'',viewCount:Number(x.view_count||0),sourceKind:x.source_kind||'AUTOMATED'
    };
  }

  async function serverFeed(){if(IS_PAGES)return[];try{const r=await fetch('/api/news?limit=50',{headers:{accept:'application/json'}});if(!r.ok)return[];const j=await r.json();return (j?.items||[]).map(normalize)}catch{return[]}}
  async function staticFeed(){try{const r=await fetch(`${BASE}/data/news.json?v=${BUILD}`,{headers:{accept:'application/json'}});if(!r.ok)return[];const j=await r.json();return (j?.items||[]).slice(0,40).map(x=>normalize({id:x.id,slug:`${slugify(x.title)}-${String(x.id||hash(x.url||x.title)).replace(/[^a-z0-9-]/gi,'')}`,title:x.title,summary:x.summary,event_type:x.category?.includes('Mang')?'MANGA':x.category?.includes('Trailer')?'TRAILER':'OTHER',image_url:x.image,source_name:x.source,source_published_at:x.publishedAt,facts:[x.summary],body:{lead:x.summary,sections:[{heading:'O que aconteceu',paragraphs:[x.summary]},{heading:'Contexto AniNexus',paragraphs:['Esta publicação faz parte do feed de demonstração do AniNexus. No servidor, as matérias são consolidadas e armazenadas no banco de dados.']}],readingMinutes:1}}))}catch{return[]}}
  async function loadFeed(force=false){if(!force){const cached=cacheGet();if(cached?.length){feed=cached;return feed}}let items=await serverFeed();if(!items.length)items=await staticFeed();feed=items.filter(x=>x.title&&x.slug).sort((a,b)=>b.quality-a.quality||new Date(b.publishedAt||0)-new Date(a.publishedAt||0));cacheSet(feed);return feed}
  async function loadArticle(slug){if(!IS_PAGES){try{const r=await fetch(`/api/news/${encodeURIComponent(slug)}`,{headers:{accept:'application/json'}});if(r.ok)return normalize(await r.json())}catch{}}if(!feed.length)await loadFeed();return feed.find(x=>x.slug===slug)||null}

  function activate(){document.body.classList.remove('aqx-home-active','nx30-home-identity','nx31-news-active','nx22-news-active','nx22-detail-active','nx-season-active');document.body.classList.add('nx32-news-active');document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav==='news'))}
  function imageMarkup(item,hero=false){return item.image?`<img loading="${hero?'eager':'lazy'}" decoding="async" src="${esc(item.image)}" alt="${esc(item.imageAlt||item.title)}" onerror="this.remove();this.parentElement.classList.add('is-fallback')">`:`<span class="nx32-image-fallback"><img src="${BASE}/assets/logo.png" alt=""></span>`}
  function readBadge(item){return readSet().has(item.slug)?`<span class="nx32-read-badge">${ICON.check} lida</span>`:''}
  function internalPath(item){return`/noticias/${item.slug}`}
  function card(item,kind='grid'){
    return `<a class="nx32-card ${kind}" href="${internalPath(item)}" data-nx32-route="${internalPath(item)}">
      <div class="nx32-card-media">${imageMarkup(item,kind==='feature')}<span class="nx32-category">${esc(item.category)}</span>${readBadge(item)}</div>
      <div class="nx32-card-copy"><div class="nx32-meta"><span>${esc(item.source)}</span><time>${esc(relative(item.publishedAt))}</time></div><h3>${esc(item.title)}</h3>${kind==='feature'&&item.summary?`<p>${esc(item.summary)}</p>`:''}<div class="nx32-card-foot"><span>${ICON.clock}${item.readingMinutes} min</span><b>Ler no AniNexus ${ICON.arrow}</b></div></div>
    </a>`;
  }

  function categories(){return[['ALL','Tudo'],['SEASON','Animes'],['MANGA','Mangás & novels'],['TRAILER','Trailers'],['EPISODE','Episódios'],['TRENDING','Em alta'],['OTHER','Notícias']]}
  function filtered(){const q=query.trim().toLowerCase();return feed.filter(x=>(active==='ALL'||x.eventType===active)&&(!q||`${x.title} ${x.summary} ${x.source} ${x.category}`.toLowerCase().includes(q)))}
  function renderResults(){const root=app.querySelector('#nx32NewsResults');if(!root)return;const items=filtered(),counter=app.querySelector('#nx32Count');if(counter)counter.textContent=`${items.length} ${items.length===1?'matéria':'matérias'}`;if(!items.length){root.innerHTML='<div class="nx32-empty"><img src="'+BASE+'/assets/logo.png" alt=""><h3>Nenhuma notícia encontrada</h3><p>Tente outro assunto ou categoria.</p></div>';return}const hero=items[0],side=items.slice(1,5),rest=items.slice(5);root.innerHTML=`<div class="nx32-lead-grid">${card(hero,'feature')}<div class="nx32-lead-side">${side.map(x=>card(x,'compact')).join('')}</div></div>${rest.length?`<div class="nx32-section-title"><div><small>MAIS RECENTES</small><h2>Continue atualizado</h2></div></div><div class="nx32-news-grid">${rest.map(x=>card(x,'grid')).join('')}</div>`:''}`}

  function renderListShell(){activate();document.title='Notícias | AniNexus';app.innerHTML=`<main class="nx32-news-page">
    <section class="nx32-news-hero"><div class="nx32-shell"><div class="nx32-news-brand"><span><img src="${BASE}/assets/logo.png" alt=""></span><div><small>ANINEXUS NOTÍCIAS</small><strong>Feed vivo · em português</strong></div></div><div class="nx32-hero-grid"><div><h1>Notícia de anime<br><em>sem sair do AniNexus.</em></h1><p>Estreias, temporadas, trailers, mangás e anúncios organizados em matérias próprias, consolidados de fontes monitoradas e mantidos por poucos dias para o feed ficar sempre atual.</p><div class="nx32-hero-signals"><span><i></i> atualização automática</span><span>${ICON.spark} síntese editorial</span><span>${ICON.clock} leitura rápida</span></div></div><aside><div class="nx32-pulse"><i></i><span>AGORA</span></div><strong>O sistema acompanha várias fontes e agrupa notícias sobre o mesmo assunto.</strong><p>Menos repetição. Mais contexto. Tudo dentro do AniNexus.</p></aside></div></div></section>
    <section class="nx32-news-toolbar"><div class="nx32-shell"><div class="nx32-categories">${categories().map(([key,label])=>`<button class="${key===active?'active':''}" data-nx32-category="${key}">${esc(label)}</button>`).join('')}</div><label class="nx32-search">${ICON.search}<input id="nx32Search" type="search" placeholder="Buscar anime, mangá, estúdio ou assunto…" value="${esc(query)}"></label></div></section>
    <section class="nx32-news-body"><div class="nx32-shell"><div class="nx32-section-title"><div><small>EM DESTAQUE</small><h2>O que está acontecendo agora</h2></div><span id="nx32Count">Carregando…</span></div><div id="nx32NewsResults"><div class="nx32-loading"></div></div><div class="nx32-feed-note"><span>${ICON.spark}</span><div><strong>Feed recente por design</strong><p>Notícias automáticas permanecem por alguns dias. Matérias editoriais próprias do AniNexus podem ficar disponíveis por mais tempo.</p></div></div></div></section>
  </main>`;
    app.querySelectorAll('[data-nx32-category]').forEach(b=>b.onclick=()=>{active=b.dataset.nx32Category;app.querySelectorAll('[data-nx32-category]').forEach(x=>x.classList.toggle('active',x===b));renderResults()});
    const search=app.querySelector('#nx32Search');if(search)search.oninput=()=>{query=search.value;renderResults()};
  }

  function sectionMarkup(section){if(!section)return'';const paragraphs=(section.paragraphs||[]).map(x=>`<p>${esc(strip(x))}</p>`).join(''),bullets=(section.bullets||[]).length?`<ul>${section.bullets.map(x=>`<li>${esc(strip(x))}</li>`).join('')}</ul>`:'';return `<section class="nx32-article-section"><h2>${esc(section.heading||'Detalhes')}</h2>${paragraphs}${bullets}</section>`}
  function sourceNames(item){const names=(item.sources||[]).map(x=>x.name).filter(Boolean);if(!names.length&&item.source)names.push(item.source);return [...new Set(names)].slice(0,4)}
  function renderArticle(item){
    activate();markRead(item.slug);document.title=`${item.title} | AniNexus`;
    const facts=(item.facts||[]).filter(Boolean).slice(0,6),sections=item.sections?.length?item.sections:[{heading:'O que aconteceu',paragraphs:[item.summary]},{heading:'Contexto AniNexus',paragraphs:['O AniNexus mantém esta publicação como uma síntese editorial em português e atualiza os dados enquanto a notícia estiver no feed recente.']}];
    const sources=sourceNames(item),related=feed.filter(x=>x.slug!==item.slug&&(x.eventType===item.eventType||x.category===item.category)).slice(0,4);
    app.innerHTML=`<main class="nx32-news-page nx32-reader"><div class="nx32-reading-progress"><i id="nx32Progress"></i></div>
      <article class="nx32-article"><header class="nx32-article-hero ${item.image?'has-image':''}">${item.image?imageMarkup(item,true):'<span class="nx32-image-fallback"><img src="'+BASE+'/assets/logo.png" alt=""></span>'}<div class="nx32-article-overlay"></div><div class="nx32-shell nx32-article-head"><button type="button" class="nx32-back" data-nx32-back>${ICON.back} Notícias</button><div class="nx32-article-kicker"><span>${esc(item.category)}</span><b>${esc(item.source)}</b><time>${esc(date(item.publishedAt,true))}</time></div><h1>${esc(item.title)}</h1><p>${esc(item.summary)}</p><div class="nx32-article-stats"><span>${ICON.clock}${item.readingMinutes} min de leitura</span>${item.sourceKind==='EDITORIAL'?'<span>Editorial AniNexus</span>':'<span>Atualização automática</span>'}</div></div></header>
      <div class="nx32-shell nx32-article-layout"><div class="nx32-article-main">${facts.length?`<aside class="nx32-summary-box"><small>EM RESUMO</small><ul>${facts.map(x=>`<li>${esc(strip(x))}</li>`).join('')}</ul></aside>`:''}${sections.map(sectionMarkup).join('')}<div class="nx32-editorial-note"><img src="${BASE}/assets/logo.png" alt=""><div><strong>Como esta matéria foi criada</strong><p>O AniNexus cruza metadados e fatos de fontes monitoradas, elimina duplicações, traduz quando necessário e publica uma síntese própria em português. O texto integral de terceiros não é reproduzido.</p></div></div></div>
      <aside class="nx32-article-sidebar"><div class="nx32-side-card"><small>PUBLICADO NO</small><strong>AniNexus Notícias</strong><p>${item.readingMinutes} min · ${item.wordCount||'leitura curta'} ${item.wordCount?'palavras':''}</p></div><div class="nx32-side-card"><small>FONTES MONITORADAS</small>${sources.map(x=>`<strong>${esc(x)}</strong>`).join('')}<p>As URLs de origem ficam registradas internamente para rastreabilidade e moderação.</p></div><button class="nx32-copy" data-nx32-copy>${ICON.copy}<span>Copiar link</span></button></aside></div>
      ${related.length?`<section class="nx32-related"><div class="nx32-shell"><div class="nx32-section-title"><div><small>CONTINUE LENDO</small><h2>Mais sobre o universo anime</h2></div></div><div class="nx32-related-grid">${related.map(x=>card(x,'grid')).join('')}</div></div></section>`:''}
      </article></main>`;
    app.querySelector('[data-nx32-back]')?.addEventListener('click',()=>go('/noticias'));
    app.querySelector('[data-nx32-copy]')?.addEventListener('click',async e=>{try{await navigator.clipboard.writeText(location.href);const span=e.currentTarget.querySelector('span');if(span){span.textContent='Link copiado';setTimeout(()=>span.textContent='Copiar link',1600)}}catch{}});
    bindProgress();
  }

  function bindProgress(){if(progressBound)return;progressBound=true;const update=()=>{const bar=document.querySelector('#nx32Progress');if(!bar)return;const root=document.documentElement,max=Math.max(1,root.scrollHeight-innerHeight),pct=Math.max(0,Math.min(1,scrollY/max));bar.style.transform=`scaleX(${pct})`};addEventListener('scroll',update,{passive:true});update()}

  async function render(){if(!owns())return false;const path=route();if(path==='/noticias'){renderListShell();await loadFeed();if(route()==='/noticias')renderResults();return true}const slug=decodeURIComponent(path.slice('/noticias/'.length));if(!feed.length)await loadFeed();const item=await loadArticle(slug);if(!item){activate();app.innerHTML=`<main class="nx32-news-page"><div class="nx32-shell nx32-not-found"><img src="${BASE}/assets/logo.png" alt=""><h1>Essa notícia não está mais no feed.</h1><p>As publicações automáticas expiram depois de alguns dias para manter a área sempre atual.</p><button data-nx32-back>Voltar às notícias</button></div></main>`;app.querySelector('[data-nx32-back]')?.addEventListener('click',()=>go('/noticias'));return true}if(!feed.some(x=>x.slug===item.slug))feed.unshift(item);renderArticle(item);return true}

  document.addEventListener('click',e=>{const link=e.target.closest('[data-nx32-route]');if(!link)return;e.preventDefault();go(link.dataset.nx32Route)},true);
  addEventListener('popstate',()=>setTimeout(render,0));
  new MutationObserver(()=>{if(owns()&&!app.querySelector('.nx32-news-page'))render()}).observe(app,{childList:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render,{once:true});else render();
})();
