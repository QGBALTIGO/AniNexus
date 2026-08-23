'use strict';
(() => {
  const IS_PAGES=location.hostname.endsWith('github.io');
  const BASE=IS_PAGES?'/AniNexus':'';
  const BUILD='31.0.0';
  let mounted=false,newsObserver=null;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const strip=s=>{const d=document.createElement('div');d.innerHTML=String(s||'');return(d.textContent||'').replace(/\s+/g,' ').trim()};
  const slug=s=>String(s||'noticia').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,95)||'noticia';
  const hash=s=>{let h=2166136261;for(const c of String(s||'')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0).toString(36)};
  function pathNow(){try{const u=new URL(location.href),p=u.searchParams.get('p');if(p)return p.split('?')[0].replace(/\/+$/,'')||'/';let x=u.pathname;if(IS_PAGES)x=x.replace(/^\/AniNexus/,'')||'/';return x.replace(/\/+$/,'')||'/'}catch{return'/'}}
  function parseBody(v){try{return JSON.parse(v||'{}')||{}}catch{return{}}}
  function dateLabel(v){const d=new Date(v);return Number.isNaN(d.getTime())?'':new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(d).replace('.','')}

  function removeTags(home){
    [...home.querySelectorAll(':scope>.aqx-section')].forEach(section=>{const t=(section.querySelector('h2')?.textContent||'').replace(/\s+/g,' ').trim();if(/^Tags\b/i.test(t))section.remove()});
  }
  function hero(home){
    const section=home.querySelector('.aqx-hero'),grid=section?.querySelector('.aqx-hero-grid'),copy=section?.querySelector('.aqx-hero-copy'),live=section?.querySelector('.aqx-live');if(!section||!grid||!copy||!live)return;
    section.classList.add('nx31-hero');
    if(!section.querySelector('.nx31-hero-sigil'))section.insertAdjacentHTML('beforeend',`<div class="nx31-hero-sigil" aria-hidden="true"><i class="r1"></i><i class="r2"></i><i class="r3"></i><div><img src="${BASE}/assets/logo.png" alt=""><span>ANINEXUS</span></div></div>`);
    if(!copy.querySelector('.nx31-universe-strip'))copy.insertAdjacentHTML('beforeend','<div class="nx31-universe-strip"><span>ANIME</span><i></i><span>MANGÁ</span><i></i><span>LIGHT NOVEL</span><i></i><span>NOTÍCIAS</span><i></i><span>COMUNIDADE</span></div>');
    if(!live.querySelector('.nx31-live-brand'))live.insertAdjacentHTML('afterbegin',`<div class="nx31-live-brand"><img src="${BASE}/assets/logo.png" alt=""><div><small>SINAL ANINEXUS</small><strong>A comunidade está viva</strong></div><span></span></div>`);
  }

  async function nativeNews(){
    let rows=[];
    if(!IS_PAGES){
      try{
        const r=await fetch('/api/news?limit=5',{headers:{accept:'application/json'}});if(r.ok){const j=await r.json();for(const x of (j?.items||[])){let meta={};try{const d=await fetch(`/api/news/${encodeURIComponent(x.slug)}`,{headers:{accept:'application/json'}});if(d.ok){const detail=await d.json();meta=parseBody(detail.body)}}catch{}rows.push({slug:x.slug,title:strip(x.title),summary:strip(x.summary),category:meta.category||x.event_type||'Notícias',source:meta.sourceName||'AniNexus Notícias',image:meta.imageUrl||'',publishedAt:x.published_at})}}
      }catch{}
    }
    if(!rows.length){
      try{const r=await fetch(`${BASE}/data/news.json?v=${BUILD}`);if(r.ok){const j=await r.json();rows=(j?.items||[]).slice(0,5).map(x=>({slug:`${slug(x.title)}-${String(x.id||hash(x.url||x.title)).replace(/[^a-z0-9-]/gi,'')}`,title:strip(x.title),summary:strip(x.summary),category:x.category||'Notícias',source:x.source||'AniNexus Notícias',image:x.image||'',publishedAt:x.publishedAt}))}}catch{}
    }
    return rows;
  }
  function newsCard(x,hero=false){const path=`/noticias/${x.slug}`;return `<a href="${path}" class="${hero?'nx30-news-feature':'nx30-news-row'} ${hero&&x.image?'has-image':''}" data-nx31-home-news="${path}">${hero?(x.image?`<img loading="lazy" decoding="async" src="${esc(x.image)}" alt="">`:'<span class="nx30-news-placeholder">N</span>'):`<div class="nx30-news-thumb">${x.image?`<img loading="lazy" decoding="async" src="${esc(x.image)}" alt="">`:'<span>N</span>'}</div>`}${hero?`<div class="nx30-news-copy"><div class="nx30-news-meta"><span>${esc(x.category)}</span><span>${esc(x.source)}</span><time>${esc(dateLabel(x.publishedAt))}</time></div><h3>${esc(x.title)}</h3><p>${esc(x.summary)}</p><b class="nx31-read-here">Ler no AniNexus →</b></div>`:`<div class="nx30-news-row-copy"><small>${esc(x.category)}</small><h3>${esc(x.title)}</h3><time>${esc(dateLabel(x.publishedAt))}</time></div>`}</a>`}
  async function repaintNews(){const root=document.querySelector('#nx30News');if(!root)return;const rows=await nativeNews();if(!root.isConnected)return;if(!rows.length)return;root.innerHTML=`<div class="nx30-news-layout">${newsCard(rows[0],true)}<div class="nx30-news-list">${rows.slice(1).map(x=>newsCard(x)).join('')}</div></div>`}

  function mount(){
    if(pathNow()!=='/')return false;const home=document.querySelector('[data-aqx-home]');if(!home)return false;
    removeTags(home);hero(home);repaintNews();
    if(!newsObserver){newsObserver=new MutationObserver(()=>{const root=document.querySelector('#nx30News');if(root?.querySelector('[data-nx30-news]'))repaintNews();const h=document.querySelector('[data-aqx-home]');if(h)removeTags(h)});newsObserver.observe(document.querySelector('#app'),{childList:true,subtree:true})}
    mounted=true;document.body.classList.add('nx31-home');return true;
  }
  document.addEventListener('click',e=>{const a=e.target.closest('[data-nx31-home-news]');if(!a)return;e.preventDefault();const p=a.dataset.nx31HomeNews;location.assign(IS_PAGES?`${BASE}/?build=${BUILD}&p=${encodeURIComponent(p)}`:p)},true);
  if(!mount())new MutationObserver((_,o)=>{if(mount())o.disconnect()}).observe(document.querySelector('#app'),{childList:true,subtree:true});
  addEventListener('popstate',()=>{if(pathNow()!=='/'){mounted=false;document.body.classList.remove('nx31-home')}else setTimeout(mount,0)});
})();
