'use strict';
(() => {
  const IS_PAGES=location.hostname.endsWith('github.io'),BASE=IS_PAGES?'/AniNexus':'';
  const BUILD='31.2.0';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const strip=s=>{const d=document.createElement('div');d.innerHTML=String(s||'');return(d.textContent||'').replace(/\s+/g,' ').trim()};
  const slug=s=>String(s||'noticia').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,95)||'noticia';
  const hash=s=>{let h=2166136261;for(const c of String(s||'')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0).toString(36)};
  const go=path=>location.assign(IS_PAGES?`${BASE}/?build=${BUILD}&p=${encodeURIComponent(path)}`:path);
  const parseBody=s=>{try{return JSON.parse(s||'{}')||{}}catch{return{}}};
  const eventLabel=v=>({TRAILER:'Trailers',MANGA:'Mangás & novels',SEASON:'Animes',EPISODE:'Episódios',TRENDING:'Em alta',OTHER:'Notícias'})[String(v||'').toUpperCase()]||v||'Notícias';
  const fmt=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?'':new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(d).replace('.','')};

  async function server(){
    if(IS_PAGES)return[];
    try{
      const r=await fetch('/api/news?limit=5',{headers:{accept:'application/json'}});if(!r.ok)return[];const j=await r.json(),out=[];
      for(const x of (j?.items||[])){
        let meta={};try{const d=await fetch(`/api/news/${encodeURIComponent(x.slug)}`,{headers:{accept:'application/json'}});if(d.ok){const detail=await d.json();meta=parseBody(detail.body)}}catch{}
        out.push({slug:x.slug,title:strip(x.title),summary:strip(x.summary),category:meta.category||eventLabel(x.event_type),source:meta.sourceName||'AniNexus Notícias',image:meta.imageUrl||'',published:x.published_at});
      }
      return out;
    }catch{return[]}
  }
  async function fallback(){
    try{const r=await fetch(`${BASE}/data/news.json?v=${BUILD}`,{cache:'no-store'});if(!r.ok)return[];const j=await r.json();return(j?.items||[]).slice(0,5).map(x=>({slug:`${slug(x.title)}-${String(x.id||hash(x.url||x.title)).replace(/[^a-z0-9-]/gi,'')}`,title:strip(x.title),summary:strip(x.summary),category:x.category||'Notícias',source:x.source||'AniNexus Notícias',image:x.image||'',published:x.publishedAt}))}catch{return[]}
  }
  function feature(x){const p=`/noticias/${x.slug}`;return `<a class="nx30-news-feature ${x.image?'has-image':''}" href="${p}" data-nx31-home-news="${p}">${x.image?`<img loading="lazy" decoding="async" src="${esc(x.image)}" alt="">`:'<span class="nx30-news-placeholder">N</span>'}<div class="nx30-news-copy"><div class="nx30-news-meta"><span>${esc(x.category)}</span><span>${esc(x.source)}</span><time>${esc(fmt(x.published))}</time></div><h3>${esc(x.title)}</h3><p>${esc(x.summary)}</p><b class="nx31-home-read">Ler no AniNexus →</b></div></a>`}
  function row(x){const p=`/noticias/${x.slug}`;return `<a class="nx30-news-row" href="${p}" data-nx31-home-news="${p}"><div class="nx30-news-thumb">${x.image?`<img loading="lazy" decoding="async" src="${esc(x.image)}" alt="">`:'<span>N</span>'}</div><div class="nx30-news-row-copy"><small>${esc(x.category)}</small><h3>${esc(x.title)}</h3><time>${esc(fmt(x.published))}</time></div></a>`}
  async function paint(){const root=document.querySelector('#nx30News');if(!root)return;let list=await server();if(!list.length)list=await fallback();if(!root.isConnected||!list.length)return;root.innerHTML=`<div class="nx30-news-layout">${feature(list[0])}<div class="nx30-news-list">${list.slice(1).map(row).join('')}</div></div>`}
  document.addEventListener('click',e=>{const card=e.target.closest('[data-nx31-home-news]');if(!card)return;e.preventDefault();e.stopImmediatePropagation();go(card.dataset.nx31HomeNews)},true);
  const app=document.querySelector('#app');if(app)new MutationObserver(()=>{if(document.querySelector('#nx30News'))setTimeout(paint,0)}).observe(app,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(paint,40),{once:true});else setTimeout(paint,40);
})();
