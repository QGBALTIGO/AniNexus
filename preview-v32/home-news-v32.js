'use strict';
(() => {
  const IS_PAGES=location.hostname.endsWith('github.io'),BASE=IS_PAGES?'/AniNexus':'';
  const BUILD='32.0.0';
  let painting=false,lastPaint=0;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const strip=s=>String(s??'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  const slug=s=>String(s||'noticia').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,100)||'noticia';
  const hash=s=>{let h=2166136261;for(const c of String(s||'')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0).toString(36)};
  const label=v=>({SEASON:'Animes',TRAILER:'Trailers',EPISODE:'Episódios',MANGA:'Mangás & novels',TRENDING:'Em alta',OTHER:'Notícias'})[String(v||'OTHER').toUpperCase()]||'Notícias';
  const arrow='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M14 7.5 18.5 12 14 16.5"/></svg>';
  function route(){try{const u=new URL(location.href),p=u.searchParams.get('p');if(p)return p.split('?')[0].replace(/\/+$/,'')||'/';let x=u.pathname;if(IS_PAGES)x=x.replace(/^\/AniNexus/,'')||'/';return x.replace(/\/+$/,'')||'/'}catch{return'/'}}
  function go(path){location.assign(IS_PAGES?`${BASE}/?build=${BUILD}&p=${encodeURIComponent(path)}`:path)}
  function fmt(v){const d=new Date(v);return Number.isNaN(d.getTime())?'':new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(d).replace('.','')}
  function normalize(x){return{slug:x.slug,title:strip(x.title),summary:strip(x.summary),category:label(x.event_type),source:x.source_name||'AniNexus Notícias',image:x.image_url||'',published:x.source_published_at||x.published_at,reading:Number(x.reading_minutes||1),quality:Number(x.quality_score||0)}}
  async function server(){if(IS_PAGES)return[];try{const r=await fetch('/api/news?limit=7',{headers:{accept:'application/json'}});if(!r.ok)return[];const j=await r.json();return(j?.items||[]).map(normalize).filter(x=>x.slug&&x.title).sort((a,b)=>b.quality-a.quality||new Date(b.published||0)-new Date(a.published||0))}catch{return[]}}
  async function fallback(){try{const r=await fetch(`${BASE}/data/news.json?v=${BUILD}`,{cache:'no-store'});if(!r.ok)return[];const j=await r.json();return(j?.items||[]).slice(0,7).map(x=>({slug:`${slug(x.title)}-${String(x.id||hash(x.url||x.title)).replace(/[^a-z0-9-]/gi,'')}`,title:strip(x.title),summary:strip(x.summary),category:x.category||'Notícias',source:x.source||'AniNexus Notícias',image:x.image||'',published:x.publishedAt,reading:1,quality:0}))}catch{return[]}}
  function media(x,feature=false){return `<div class="nx32-home-news-media ${x.image?'':'fallback'}">${x.image?`<img loading="lazy" decoding="async" src="${esc(x.image)}" alt="" onerror="this.remove();this.parentElement.classList.add('fallback')">`:`<img class="nx32-home-logo" src="${BASE}/assets/logo.png" alt="">`}<span>${esc(x.category)}</span></div>`}
  function feature(x){const p=`/noticias/${x.slug}`;return `<a class="nx32-home-news-feature" href="${p}" data-nx32-home-route="${p}">${media(x,true)}<div class="nx32-home-news-copy"><div><b>${esc(x.source)}</b><time>${esc(fmt(x.published))}</time><span>${x.reading} min</span></div><h3>${esc(x.title)}</h3><p>${esc(x.summary)}</p><strong>Ler no AniNexus ${arrow}</strong></div></a>`}
  function row(x){const p=`/noticias/${x.slug}`;return `<a class="nx32-home-news-row" href="${p}" data-nx32-home-route="${p}">${media(x)}<div><small>${esc(x.category)} · ${esc(fmt(x.published))}</small><h3>${esc(x.title)}</h3><span>${x.reading} min de leitura</span></div></a>`}
  function removeTags(){document.querySelectorAll('[data-aqx-home]>.aqx-section').forEach(section=>{const title=(section.querySelector('.aqx-head h2')?.textContent||'').replace(/\s+/g,' ').trim();if(title==='Tags')section.remove()})}
  async function paint(){
    if(painting||route()!=='/')return;const root=document.querySelector('#nx30News');if(!root)return;painting=true;
    try{let list=await server();if(!list.length)list=await fallback();if(!root.isConnected||!list.length)return;root.innerHTML=`<div class="nx32-home-news-layout">${feature(list[0])}<div class="nx32-home-news-stack">${list.slice(1,5).map(row).join('')}</div></div>`;lastPaint=Date.now()}finally{painting=false}
  }
  function enhanceHeading(){const section=document.querySelector('.nx30-news-section');if(!section||section.dataset.nx32NewsHead)return;section.dataset.nx32NewsHead='1';const head=section.querySelector('.aqx-head>div');if(head)head.insertAdjacentHTML('afterbegin','<span class="nx32-home-section-kicker"><i></i> ANINEXUS NOTÍCIAS</span>')}
  function boot(){if(route()!=='/')return;removeTags();enhanceHeading();if(Date.now()-lastPaint>3000)paint()}
  document.addEventListener('click',e=>{const a=e.target.closest('[data-nx32-home-route]');if(!a)return;e.preventDefault();e.stopImmediatePropagation();go(a.dataset.nx32HomeRoute)},true);
  const observer=new MutationObserver(()=>{if(route()==='/')setTimeout(boot,0)});observer.observe(document.querySelector('#app')||document.body,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,50),{once:true});else setTimeout(boot,50);
})();
