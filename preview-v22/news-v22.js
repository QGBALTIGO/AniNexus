'use strict';
(() => {
  const root=document.querySelector('#app');if(!root)return;
  const IS_PAGES=location.hostname.endsWith('github.io');
  const BASE=IS_PAGES?'/AniNexus':'';
  const JIKAN='https://api.jikan.moe/v4';
  const CACHE_TTL=15*60*1000;
  let itemsCache=null;
  let itemsPromise=null;
  let observerRaf=0;
  let searchText='';
  let activeSource='ALL';

  const SVG={
    news:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h12.5v14H4z"/><path d="M7 8h6.5M7 11.5h6.5M7 15h4.5"/><path d="M16.5 8H20v11h-3.5"/></svg>',
    external:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 5h6v6M19 5l-8 8"/><path d="M11 7H5v12h12v-6"/></svg>',
    search:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.7" cy="10.7" r="6.6"/><path d="m15.7 15.7 4.5 4.5"/></svg>',
    refresh:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 0-2 5"/></svg>',
    arrow:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M14 7.5 18.5 12 14 16.5"/></svg>'
  };
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const strip=v=>{const d=document.createElement('div');d.innerHTML=String(v||'');return(d.textContent||'').replace(/\s+/g,' ').trim()};

  function routePath(){try{const u=new URL(location.href),p=u.searchParams.get('p');if(p)return p.split('?')[0].replace(/\/+$/,'')||'/';let x=u.pathname;if(IS_PAGES)x=x.replace(/^\/AniNexus/,'')||'/';return x.replace(/\/+$/,'')||'/'}catch{return'/'}}
  function isNews(){return routePath()==='/noticias'}
  function isOwned(){return isNews()&&root.firstElementChild?.classList.contains('nx22-news')}
  function activate(){document.body.classList.add('nx22-news-active');document.body.classList.remove('nx22-detail-active','nx-detail-active','nx-season-active');document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav==='news'));root.dataset.nx22News='1'}
  function deactivate(){document.body.classList.remove('nx22-news-active');delete root.dataset.nx22News}

  function sourceKey(x){const s=String(x?.sourceType||x?.source||'').toLowerCase();if(s.includes('crunch'))return'CRUNCHYROLL';if(s.includes('myanimelist')||s==='mal')return'MAL';if(s.includes('anime news network')||s==='ann')return'ANN';return'OTHER'}
  function sourceLabel(k){return({CRUNCHYROLL:'Crunchyroll Notícias',MAL:'MyAnimeList',ANN:'Anime News Network',OTHER:'Outras fontes'})[k]||k}
  function category(x){if(x.category)return x.category;const t=`${x.title||''} ${x.summary||''}`.toLowerCase();if(/trailer|teaser|vídeo|video|pv\b|promo/.test(t))return'Trailers';if(/mang[aá]|volume|chapter|capítulo/.test(t))return'Mangás';if(/film|movie|filme|cinema/.test(t))return'Filmes';if(/season|temporada|anime adaptation|adapta[cç][aã]o/.test(t))return'Animes';if(/cast|elenco|voice|dublador|dublagem/.test(t))return'Elenco';return'Notícias'}
  function fmtDate(v){if(!v)return'Data não informada';const d=new Date(v);if(Number.isNaN(d.getTime()))return'Data não informada';return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',year:'numeric'}).format(d).replace('.','')}
  function relative(v){if(!v)return'';const d=new Date(v);if(Number.isNaN(d.getTime()))return'';const ms=Date.now()-d.getTime(),h=Math.floor(ms/36e5),days=Math.floor(ms/864e5);if(ms<0)return fmtDate(v);if(h<1)return'Agora há pouco';if(h<24)return`Há ${h}h`;if(days===1)return'Ontem';if(days<7)return`Há ${days} dias`;return fmtDate(v)}
  function validItem(x){return x&&x.title&&x.url&&/^https:\/\//i.test(x.url)}
  function normalize(x){const k=sourceKey(x);return{id:String(x.id||x.url||x.title),source:x.source||sourceLabel(k),sourceType:k,title:strip(x.title),summary:strip(x.summary||x.excerpt||''),url:x.url,image:x.image||'',publishedAt:x.publishedAt||x.date||'',category:category(x),author:x.author||''}}
  function dedupe(arr){const out=[],seen=new Set();for(const raw of arr){const x=normalize(raw);if(!validItem(x))continue;const key=(x.url||x.title).toLowerCase().replace(/[?#].*$/,'');if(seen.has(key))continue;seen.add(key);out.push(x)}return out.sort((a,b)=>(new Date(b.publishedAt)||0)-(new Date(a.publishedAt)||0))}

  function cacheRead(){try{const x=JSON.parse(sessionStorage.getItem('nx22:news')||'null');if(x&&Date.now()-x.t<CACHE_TTL&&Array.isArray(x.items))return x.items}catch{}return null}
  function cacheWrite(items){try{sessionStorage.setItem('nx22:news',JSON.stringify({t:Date.now(),items}))}catch{}}
  async function localFeed(){try{const r=await fetch(`${BASE}/data/news.json?v=22.0.0`,{cache:'no-store',headers:{accept:'application/json'}});if(!r.ok)return[];const j=await r.json();return Array.isArray(j?.items)?j.items:[]}catch{return[]}}
  async function jikanJson(url,retries=2){let last;for(let i=0;i<retries;i++){try{const r=await fetch(url,{headers:{accept:'application/json'}});if(r.status===429){await new Promise(res=>setTimeout(res,900));continue}if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json()}catch(e){last=e;if(i<retries-1)await new Promise(res=>setTimeout(res,450))}}throw last||new Error('Falha Jikan')}
  async function malFallback(){
    try{
      const top=await jikanJson(`${JIKAN}/top/anime?filter=airing&limit=7`);const animes=top?.data||[],out=[];
      for(let i=0;i<Math.min(6,animes.length);i++){
        const a=animes[i];if(i)await new Promise(r=>setTimeout(r,360));
        try{const j=await jikanJson(`${JIKAN}/anime/${a.mal_id}/news`,1);for(const n of (j?.data||[]).slice(0,2))out.push({id:`mal-${n.mal_id}`,source:'MyAnimeList',sourceType:'MAL',title:n.title,summary:n.excerpt||'',url:n.url,image:n.images?.jpg?.image_url||a.images?.jpg?.large_image_url||a.images?.jpg?.image_url||'',publishedAt:n.date,author:n.author_username||'',category:category(n)})}catch{}
      }
      return out;
    }catch{return[]}
  }
  async function loadNews(force=false){
    if(!force&&itemsCache?.length)return itemsCache;
    if(!force){const c=cacheRead();if(c?.length){itemsCache=c;return c}}
    if(itemsPromise)return itemsPromise;
    itemsPromise=(async()=>{const local=await localFeed();let all=[...local];if(local.length<12)all.push(...await malFallback());const clean=dedupe(all).slice(0,60);itemsCache=clean;cacheWrite(clean);return clean})().finally(()=>itemsPromise=null);
    return itemsPromise;
  }

  function filtered(items){const q=searchText.trim().toLowerCase();return items.filter(x=>(activeSource==='ALL'||sourceKey(x)===activeSource)&&(!q||`${x.title} ${x.summary} ${x.source} ${x.category}`.toLowerCase().includes(q)))}
  function articleCard(x,hero=false){return `<article class="nx22-news-card ${hero?'featured':''}"><a class="nx22-news-image" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${x.image?`<img loading="lazy" src="${esc(x.image)}" alt="">`:'<span class="nx22-news-placeholder">AniNexus</span>'}<i>${esc(x.category)}</i></a><div class="nx22-news-copy"><div class="nx22-news-meta"><strong data-source="${sourceKey(x)}">${esc(x.source)}</strong><span>${esc(relative(x.publishedAt))}</span>${x.author?`<span>${esc(x.author)}</span>`:''}</div><h2><a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.title)}</a></h2>${x.summary?`<p>${esc(x.summary)}</p>`:''}<a class="nx22-read" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">Ler na fonte ${SVG.external}</a></div></article>`}

  function draw(items){
    const list=filtered(items),hero=list[0],rest=list.slice(1);
    const count=root.querySelector('#nx22NewsCount');if(count)count.textContent=`${list.length} ${list.length===1?'matéria':'matérias'}`;
    const host=root.querySelector('#nx22NewsResults');if(!host)return;
    if(!list.length){host.innerHTML=`<div class="nx22-news-empty">${SVG.news}<h2>Nenhuma matéria encontrada</h2><p>Tente outra fonte ou remova a busca.</p></div>`;return}
    host.innerHTML=`${hero?`<section class="nx22-news-feature">${articleCard(hero,true)}${rest.slice(0,2).map(x=>articleCard(x)).join('')}</section>`:''}${rest.length>2?`<section class="nx22-news-list">${rest.slice(2).map(x=>articleCard(x)).join('')}</section>`:''}`;
  }
  function shell(){
    activate();root.innerHTML=`<main class="nx22-news"><header class="nx22-news-hero"><div class="nx22-news-shell"><div><small>${SVG.news} NOTÍCIAS REAIS, FONTES IDENTIFICADAS</small><h1>Notícias de anime,<br><em>sem cards inventados.</em></h1><p>Matérias recentes de fontes editoriais como Crunchyroll Notícias e MyAnimeList, com data, autoria e link direto para a publicação original.</p></div><aside><strong>Como funciona</strong><p>O AniNexus organiza manchetes e resumos. O artigo completo continua no site que publicou a notícia.</p></aside></div></header><section class="nx22-news-toolbar"><div class="nx22-news-shell"><div class="nx22-news-sources">${[['ALL','Tudo'],['CRUNCHYROLL','Crunchyroll'],['MAL','MyAnimeList'],['ANN','ANN']].map(([k,n])=>`<button class="${activeSource===k?'active':''}" data-nx22-source="${k}">${n}</button>`).join('')}</div><label>${SVG.search}<input type="search" id="nx22NewsSearch" placeholder="Buscar notícia, anime ou assunto…" value="${esc(searchText)}"><button type="button" data-nx22-clear aria-label="Limpar busca">×</button></label><button type="button" class="nx22-news-refresh" data-nx22-refresh title="Atualizar">${SVG.refresh}</button></div></section><section class="nx22-news-body"><div class="nx22-news-shell"><div class="nx22-news-head"><div><small>ÚLTIMAS PUBLICAÇÕES</small><h2>O que está acontecendo agora</h2></div><span id="nx22NewsCount">Carregando…</span></div><div id="nx22NewsResults"><div class="nx22-news-skeleton"><i></i><i></i><i></i></div></div><footer class="nx22-news-note"><strong>Sobre as fontes</strong><p>Manchetes, imagens e resumos pertencem aos respectivos veículos. O AniNexus não republica matérias completas e sempre direciona para a fonte original.</p></footer></div></section></main>`;
    root.querySelectorAll('[data-nx22-source]').forEach(b=>b.onclick=()=>{activeSource=b.dataset.nx22Source;root.querySelectorAll('[data-nx22-source]').forEach(x=>x.classList.toggle('active',x===b));draw(itemsCache||[])});
    const input=root.querySelector('#nx22NewsSearch');if(input)input.oninput=()=>{searchText=input.value;draw(itemsCache||[])};
    root.querySelector('[data-nx22-clear]')?.addEventListener('click',()=>{searchText='';if(input)input.value='';draw(itemsCache||[])});
    root.querySelector('[data-nx22-refresh]')?.addEventListener('click',async e=>{e.currentTarget.classList.add('spin');itemsCache=null;try{sessionStorage.removeItem('nx22:news')}catch{};const x=await loadNews(true);if(isNews())draw(x);e.currentTarget.classList.remove('spin')});
    document.title='Notícias | AniNexus';
  }

  async function render(force=false){if(!isNews())return;if(!force&&isOwned()&&itemsCache)return;shell();const items=await loadNews();if(isNews()&&isOwned())draw(items)}
  function claim(force=false){if(!isNews()){if(document.body.classList.contains('nx22-news-active'))deactivate();return}activate();if(force||!isOwned())render(force)}
  const mo=new MutationObserver(()=>{if(observerRaf)return;observerRaf=requestAnimationFrame(()=>{observerRaf=0;if(isNews()&&!isOwned())claim()})});mo.observe(root,{childList:true});
  addEventListener('popstate',()=>setTimeout(()=>claim(true),0));document.addEventListener('aninexus:routechange',()=>setTimeout(()=>claim(true),0));document.addEventListener('click',()=>setTimeout(claim,0),true);claim(true);
})();
