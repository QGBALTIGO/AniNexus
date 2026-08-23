'use strict';
(() => {
  if(window.__NX38_LIBRARY__)return;window.__NX38_LIBRARY__=true;
  const app=document.querySelector('#app');if(!app)return;
  const IS_PAGES=location.hostname.endsWith('github.io');
  const BASE=IS_PAGES?'/AniNexus':'';
  const BUILD='38.1.0';
  const API='https://graphql.anilist.co';
  const LIB_ROUTE='/meus-animes';
  const STATE_KEY='aninexus:mediaState:v2';
  const FAV_KEY='aninexus:favorites';
  const DEMO_IMP='aninexus:impressions:v1';
  const STATUS={CURRENT:'Assistindo',PLANNING:'Quero Ver',COMPLETED:'Terminei',PAUSED:'Pausei',DROPPED:'Desisti'};
  const FILTERS=[
    ['AIRING','◫','No ar'],['ALL','▦','Todos'],['FAVORITES','♡','Favoritos'],['CURRENT','▷','Assistindo'],['PLANNING','＋','Quero Ver'],['COMPLETED','✓','Terminei'],['PAUSED','Ⅱ','Pausei'],['DROPPED','×','Desisti'],['IMPRESSIONS','▣','Impressões'],['ACHIEVEMENTS','🏆','Conquistas'],['RANK','♛','Rank']
  ];
  const state={filter:'ALL',search:'',sort:'recent',review:false,data:null,renderToken:0};
  const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||'null')??f}catch{return f}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slug=s=>String(s||'anime').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,90)||'anime';
  const route=()=>{try{const u=new URL(location.href),p=u.searchParams.get('p');if(p)return p.split('?')[0].replace(/\/+$/,'')||'/';let x=u.pathname;if(IS_PAGES)x=x.replace(/^\/AniNexus/,'')||'/';return x.replace(/\/+$/,'')||'/'}catch{return'/'}};
  const pageUrl=path=>IS_PAGES?`${BASE}/?build=${BUILD}&p=${encodeURIComponent(path)}`:path;
  const go=path=>location.assign(pageUrl(path));
  const fmtRel=v=>{const t=Date.parse(v||'');if(!Number.isFinite(t))return'';const d=Math.max(0,Date.now()-t);if(d<60000)return'agora';if(d<3600000)return`há ${Math.max(1,Math.floor(d/60000))}min`;if(d<86400000)return`há ${Math.floor(d/3600000)}h`;if(d<604800000)return`há ${Math.floor(d/86400000)}d`;return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short'}).format(new Date(t)).replace('.','')};
  const format=f=>({TV:'Série',TV_SHORT:'Série curta',MOVIE:'Filme',OVA:'OVA',ONA:'ONA',SPECIAL:'Especial',MUSIC:'Música'})[f]||f||'Anime';

  function mediaOf(raw,id){
    const m=raw&&typeof raw==='object'?raw:{};
    const title=typeof m.title==='string'?m.title:(m.title?.english||m.title?.userPreferred||m.title?.romaji||m.title?.native||`Anime ${id}`);
    const cover=m.cover||m.coverImage?.extraLarge||m.coverImage?.large||'';
    const banner=m.banner||m.bannerImage||cover;
    const score=m.score!=null?Number(m.score):(m.averageScore?Number(m.averageScore)/10:null);
    return {id:Number(m.id||id),title:String(title||`Anime ${id}`),cover,banner,score:Number.isFinite(score)?score:null,episodes:m.episodes==null?null:Number(m.episodes),status:String(m.status||''),format:String(m.format||''),seasonYear:m.seasonYear||null,genres:Array.isArray(m.genres)?m.genres:[],slug:m.slug||`${slug(title)}-${Number(m.id||id)}`};
  }
  function normalizeRow(row){const id=Number(row?.media_id||row?.mediaId||row?.media?.id);return{id,status:String(row?.status||''),score:row?.score==null?null:Number(row.score),reaction:row?.reaction||'',progress:Math.max(0,Number(row?.progress)||0),updatedAt:Date.parse(row?.updated_at||row?.updatedAt||0)||0,media:mediaOf(row?.media,id)}}
  function normalizeFav(row){const id=Number(row?.media_id||row?.mediaId||row?.media?.id);return{id,createdAt:Date.parse(row?.created_at||row?.createdAt||0)||0,media:mediaOf(row?.media,id)}}
  function normalizeImp(row){const id=Number(row?.media_id||row?.mediaId||row?.media?.id);return{id:String(row?.id||crypto?.randomUUID?.()||Date.now()),mediaId:id,body:String(row?.body||''),spoiler:!!row?.spoiler,createdAt:row?.created_at||row?.createdAt||new Date().toISOString(),username:String(row?.username||'você'),avatarUrl:row?.avatar_url||row?.avatarUrl||'',status:String(row?.status||''),score:row?.score==null?null:Number(row.score),progress:Math.max(0,Number(row?.progress)||0),media:mediaOf(row?.media,id)}}

  async function request(path,options={}){
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),12000);
    try{const r=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,signal:ctl.signal,headers:{accept:'application/json',...(options.body?{'content-type':'application/json'}:{}),...(options.headers||{})}});if(r.status===401)return{__unauth:true};if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json().catch(()=>({}))}finally{clearTimeout(timer)}
  }

  async function gqlIds(ids){
    const chunks=[];for(let i=0;i<ids.length;i+=50)chunks.push(ids.slice(i,i+50));const out=[];
    for(const list of chunks){try{const q='query($ids:[Int]){Page(page:1,perPage:50){media(id_in:$ids,type:ANIME){id title{romaji english native userPreferred}coverImage{extraLarge large}bannerImage averageScore episodes status format seasonYear genres}}}',r=await fetch(API,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({query:q,variables:{ids:list}})});if(!r.ok)continue;const j=await r.json();out.push(...(j?.data?.Page?.media||[]))}catch{}}
    return out.map(x=>mediaOf(x,x.id));
  }
  async function fetchMissing(ids){
    ids=[...new Set(ids.map(Number).filter(Boolean))];if(!ids.length)return[];
    if(IS_PAGES)return gqlIds(ids);
    const out=[];for(let i=0;i<ids.length;i+=6){const part=ids.slice(i,i+6),r=await Promise.allSettled(part.map(id=>request(`/api/anime/${id}`)));for(let k=0;k<r.length;k++)if(r[k].status==='fulfilled'&&!r[k].value?.__unauth)out.push(mediaOf(r[k].value,part[k]))}return out;
  }

  async function loadLibrary(){
    if(IS_PAGES){
      const local={...read('aninexus:mediaState:v1',{}),...read(STATE_KEY,{})},favIds=(read(FAV_KEY,[])||[]).map(Number),ids=[...new Set([...Object.keys(local).map(Number),...favIds])].filter(Boolean),media=await gqlIds(ids),map=new Map(media.map(m=>[m.id,m]));
      const list=Object.entries(local).filter(([,s])=>s?.status).map(([id,s])=>({media_id:Number(id),status:s.status,score:s.score??null,reaction:s.reaction||'',progress:s.progress||0,updated_at:s.updatedAt?new Date(s.updatedAt).toISOString():new Date().toISOString(),media:map.get(Number(id))||null}));
      const favorites=favIds.map(id=>({media_id:id,created_at:new Date().toISOString(),media:map.get(id)||null}));
      const impressions=(read(DEMO_IMP,[])||[]).map(x=>({...x,media:x.media||map.get(Number(x.mediaId||x.media_id))||null}));
      return{user:{username:'Preview'},list:list.map(normalizeRow),favorites:favorites.map(normalizeFav),impressions:impressions.map(normalizeImp),impressionCount:impressions.length};
    }
    try{
      const data=await request('/api/me/library');
      if(data?.__unauth)return{user:null,list:[],favorites:[],impressions:[],impressionCount:0};
      if(data?.list&&data?.favorites){return{user:data.user||{},list:data.list.map(normalizeRow),favorites:data.favorites.map(normalizeFav),impressions:(data.impressions||[]).map(normalizeImp),impressionCount:Number(data.impressionCount||0)}}
    }catch{}
    const me=await request('/api/me').catch(()=>({__unauth:true}));if(me?.__unauth||!me?.user)return{user:null,list:[],favorites:[],impressions:[],impressionCount:0};
    const [ls,fs]=await Promise.all([request('/api/me/list').catch(()=>({items:[]})),request('/api/me/favorites').catch(()=>({items:[]}))]);
    const ids=[...(ls.items||[]).map(x=>Number(x.media_id)),...(fs.items||[]).map(x=>Number(x.media_id))],media=await fetchMissing(ids),map=new Map(media.map(m=>[m.id,m]));
    return{user:me.user,list:(ls.items||[]).map(x=>normalizeRow({...x,media:map.get(Number(x.media_id))||null})),favorites:(fs.items||[]).map(x=>normalizeFav({...x,media:map.get(Number(x.media_id))||null})),impressions:[],impressionCount:0};
  }

  function mergedItems(data){
    const map=new Map();
    for(const x of data.list||[])map.set(x.id,{...x,favorite:false});
    for(const f of data.favorites||[]){const current=map.get(f.id);map.set(f.id,current?{...current,favorite:true,media:current.media?.cover?current.media:f.media}:{id:f.id,status:'',score:null,reaction:'',progress:0,updatedAt:f.createdAt,media:f.media,favorite:true})}
    return [...map.values()];
  }
  function stats(data,items){const list=(data.list||[]),completed=list.filter(x=>x.status==='COMPLETED').length;return{favorites:(data.favorites||[]).length,tracking:list.length,completed:Math.round((completed/Math.max(1,list.length))*100),impressions:Number(data.impressionCount||data.impressions?.length||0)}}
  function filterCount(key,data,items){if(key==='ALL')return items.length;if(key==='FAVORITES')return items.filter(x=>x.favorite).length;if(key==='AIRING')return items.filter(x=>x.media.status==='RELEASING').length;if(STATUS[key])return items.filter(x=>x.status===key).length;if(key==='IMPRESSIONS')return Number(data.impressionCount||data.impressions?.length||0);return''}
  function navMarkup(data,items,drawer=false){return `<div class="nx38-library-nav">${FILTERS.map(([key,icon,label])=>`<button class="nx38-library-filter${state.filter===key?' active':''}" type="button" data-lib-filter="${key}"><i>${icon}</i><span>${label}</span>${filterCount(key,data,items)!==''?`<b>${filterCount(key,data,items)}</b>`:''}</button>`).join('')}</div>`}
  function statusLabel(x){return STATUS[x]||'Sem status'}
  function card(item){const m=item.media||mediaOf(null,item.id),avg=m.score!=null?Number(m.score).toFixed(1).replace('.0',''):'',meta=[format(m.format),m.seasonYear,m.episodes?`${m.episodes} eps`:null].filter(Boolean).join(' · ');return `<article class="nx38-library-card" data-lib-open="${item.id}" data-title="${esc(m.title)}"><div class="nx38-library-poster">${m.cover?`<img src="${esc(m.cover)}" alt="${esc(m.title)}" loading="lazy" decoding="async">`:''}<div class="nx38-library-shade"></div>${item.progress?`<span class="nx38-library-progress">${item.progress}${m.episodes?`/${m.episodes}`:''}</span>`:''}${avg?`<span class="nx38-library-score">★ ${avg}</span>`:''}<button class="nx38-library-impression-btn" type="button" data-lib-impression="${item.id}" aria-label="Escrever impressão">✎</button><div class="nx38-library-card-actions"><button type="button" data-list="${item.id}" class="${item.status?'active':''}" aria-label="Alterar status">＋</button><button type="button" data-fav="${item.id}" class="${item.favorite?'active':''}" aria-label="Favoritar">♡</button></div></div><h3>${esc(m.title)}</h3><div class="nx38-library-card-meta"><span class="status">${esc(statusLabel(item.status))}</span>${meta?`<span>${esc(meta)}</span>`:''}${item.score!=null?`<span>· sua nota ${Number(item.score).toFixed(1).replace('.0','')}</span>`:''}</div></article>`}
  function filtered(data,items){
    let out=items.slice();if(state.review)out=out.filter(x=>x.status).sort((a,b)=>(a.updatedAt||0)-(b.updatedAt||0));
    else if(state.filter==='FAVORITES')out=out.filter(x=>x.favorite);else if(state.filter==='AIRING')out=out.filter(x=>x.media.status==='RELEASING');else if(STATUS[state.filter])out=out.filter(x=>x.status===state.filter);
    const q=state.search.trim().toLowerCase();if(q)out=out.filter(x=>`${x.media.title} ${(x.media.genres||[]).join(' ')}`.toLowerCase().includes(q));
    if(state.sort==='title')out.sort((a,b)=>a.media.title.localeCompare(b.media.title,'pt-BR'));else if(state.sort==='score')out.sort((a,b)=>(b.score??b.media.score??-1)-(a.score??a.media.score??-1));else if(state.sort==='progress')out.sort((a,b)=>(b.progress||0)-(a.progress||0));else out.sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));return out;
  }
  function impressionsView(data){const items=(data.impressions||[]);if(!items.length)return empty('Nenhuma impressão ainda','Quando você escrever uma impressão sobre um anime, ela aparece aqui e pode alimentar a área de comunidade da Home.');return `<div class="nx38-library-impressions-list">${items.map(x=>`<article class="nx38-own-impression">${x.media.cover?`<img src="${esc(x.media.cover)}" alt="">`:'<div></div>'}<div><header><h3>${esc(x.media.title)}</h3><time>${esc(fmtRel(x.createdAt))}</time></header><p>${x.spoiler?'<span class="spoiler">Impressão marcada como spoiler.</span>':esc(x.body)}</p><footer>${x.status?esc(statusLabel(x.status)):''}${x.progress?` · ep. ${x.progress}`:''}${x.score!=null?` · ★ ${Number(x.score).toFixed(1).replace('.0','')}`:''}</footer></div></article>`).join('')}</div>`}
  function achievementsView(data){const list=data.list||[],done=list.filter(x=>x.status==='COMPLETED').length,current=list.filter(x=>x.status==='CURRENT').length,favs=data.favorites?.length||0,imps=Number(data.impressionCount||0),ach=[['🎬','Primeiro passo','Adicione 1 anime à sua lista',list.length>=1],['▶','Em andamento','Acompanhe 3 animes ao mesmo tempo',current>=3],['✓','Maratonista','Conclua 10 animes',done>=10],['♡','Colecionador','Favorite 10 títulos',favs>=10],['✎','Crítico de sofá','Publique 5 impressões',imps>=5],['🏆','Veterano AniNexus','Conclua 50 animes',done>=50]];return `<div class="nx38-achievements-grid">${ach.map(([i,t,d,ok])=>`<article class="nx38-achievement${ok?'':' locked'}"><i>${i}</i><strong>${t}</strong><span>${d}${ok?' · desbloqueada':''}</span></article>`).join('')}</div>`}
  function rankView(items){const ranked=items.filter(x=>x.score!=null).sort((a,b)=>b.score-a.score);if(!ranked.length)return empty('Seu rank ainda está vazio','Dê notas aos animes concluídos ou em andamento para criar seu ranking pessoal.');return `<div class="nx38-rank-list">${ranked.map((x,i)=>`<article class="nx38-rank-row" data-lib-open="${x.id}" data-title="${esc(x.media.title)}"><b>${i+1}</b>${x.media.cover?`<img src="${esc(x.media.cover)}" alt="">`:'<div></div>'}<strong>${esc(x.media.title)}</strong><span>★ ${Number(x.score).toFixed(1).replace('.0','')}</span></article>`).join('')}</div>`}
  function empty(title,copy){return `<div class="nx38-library-empty"><strong>${esc(title)}</strong><p>${esc(copy)}</p><a class="nx38-library-primary" href="${pageUrl('/animes/catalogo')}">Explorar catálogo</a></div>`}

  function shell(data){
    const items=mergedItems(data),s=stats(data,items),user=data.user||{};
    document.title='Meus Animes | AniNexus';document.body.classList.add('nx38-library-active');document.body.classList.remove('nx35-home-active');
    app.innerHTML=`<main class="nx38-library"><div class="nx38-library-shell"><header class="nx38-library-head"><div><small>SUA BIBLIOTECA</small><h1>Meus Animes</h1><p>Organize o que quer ver, o que está acompanhando, o que terminou e as impressões que deixou pelo caminho.</p></div><div class="nx38-library-head-actions"><a class="nx38-library-ghost" href="${pageUrl('/minha-conta')}">Minha conta</a><button class="nx38-library-share" type="button" data-lib-share>Compartilhar</button></div></header><div class="nx38-library-stats"><div class="nx38-library-stat"><strong>${s.favorites}</strong><span>Favoritos</span></div><div class="nx38-library-stat"><strong>${s.tracking}</strong><span>Acompanhando</span></div><div class="nx38-library-stat"><strong>${s.completed}%</strong><span>Concluídos</span></div><div class="nx38-library-stat"><strong>${s.impressions}</strong><span>Impressões</span></div></div><button class="nx38-library-review${state.review?' active':''}" type="button" data-lib-review>${state.review?'Sair da revisão':'Revisar meus animes'}</button><div class="nx38-library-layout"><aside class="nx38-library-side"><h3>Biblioteca</h3>${navMarkup(data,items)}</aside><section class="nx38-library-main"><div class="nx38-library-quick">${['ALL','FAVORITES','CURRENT','PLANNING'].map(k=>{const f=FILTERS.find(x=>x[0]===k);return `<button type="button" data-lib-filter="${k}" class="${state.filter===k?'active':''}">${f[2]}</button>`}).join('')}</div><div class="nx38-library-toolbar"><button class="nx38-library-menu-button" type="button" data-lib-menu aria-label="Abrir filtros">☰</button><input class="nx38-library-search" type="search" placeholder="Buscar nos meus animes…" value="${esc(state.search)}" data-lib-search><select class="nx38-library-sort" data-lib-sort><option value="recent"${state.sort==='recent'?' selected':''}>Recentes</option><option value="title"${state.sort==='title'?' selected':''}>Título</option><option value="score"${state.sort==='score'?' selected':''}>Nota</option><option value="progress"${state.sort==='progress'?' selected':''}>Progresso</option></select></div>${state.review?'<div class="nx38-library-review-note"><strong>Modo revisão:</strong> os animes com status aparecem do mais antigo para o mais recente. Abra o botão de status em cada card para atualizar progresso, nota ou categoria.</div>':''}<div id="nx38LibraryContent"></div></section></div></div></main><div class="nx38-library-drawer" id="nx38LibraryDrawer" hidden><button class="nx38-drawer-backdrop" type="button" data-lib-drawer-close aria-label="Fechar"></button><div class="nx38-library-drawer-panel"><div class="nx38-library-drawer-head"><strong>Menu</strong><button type="button" data-lib-drawer-close>×</button></div>${navMarkup(data,items,true)}</div></div><div class="nx38-impression-modal" id="nx38ImpressionModal" hidden></div>`;
    paintContent();wire();window.AniNexusMediaState?.sync?.();document.documentElement.classList.remove('nx38-library-boot');
  }
  function paintContent(){if(!state.data)return;const root=document.querySelector('#nx38LibraryContent');if(!root)return;const items=mergedItems(state.data);if(state.filter==='IMPRESSIONS'){root.innerHTML=impressionsView(state.data);return}if(state.filter==='ACHIEVEMENTS'){root.innerHTML=achievementsView(state.data);return}if(state.filter==='RANK'){root.innerHTML=rankView(items);wireOpen();return}const out=filtered(state.data,items);root.innerHTML=out.length?`<div class="nx38-library-grid">${out.map(card).join('')}</div>`:empty(state.search?'Nenhum resultado':'Nada nesta categoria',state.search?'Tente outro termo ou limpe os filtros.':'Quando você adicionar um anime aqui, ele aparece automaticamente nesta seção.');window.AniNexusMediaState?.sync?.();wireOpen();wireImpressions()}
  function wireOpen(){document.querySelectorAll('[data-lib-open]').forEach(el=>{el.onclick=e=>{if(e.target.closest('button,a,input,select,textarea'))return;go(`/anime/${slug(el.dataset.title||'anime')}-${el.dataset.libOpen}`)}})}
  function wireImpressions(){document.querySelectorAll('[data-lib-impression]').forEach(b=>b.onclick=e=>{e.stopPropagation();openImpression(Number(b.dataset.libImpression))})}
  function setFilter(k){state.filter=k;state.review=false;document.querySelector('#nx38LibraryDrawer')?.setAttribute('hidden','');shell(state.data)}
  function wire(){
    document.querySelectorAll('[data-lib-filter]').forEach(b=>b.onclick=()=>setFilter(b.dataset.libFilter));
    document.querySelector('[data-lib-search]')?.addEventListener('input',e=>{state.search=e.target.value;paintContent()});
    document.querySelector('[data-lib-sort]')?.addEventListener('change',e=>{state.sort=e.target.value;paintContent()});
    document.querySelector('[data-lib-review]')?.addEventListener('click',()=>{state.review=!state.review;state.filter='ALL';shell(state.data)});
    document.querySelector('[data-lib-menu]')?.addEventListener('click',()=>{const d=document.querySelector('#nx38LibraryDrawer');if(d)d.hidden=false});
    document.querySelectorAll('[data-lib-drawer-close]').forEach(b=>b.onclick=()=>{const d=document.querySelector('#nx38LibraryDrawer');if(d)d.hidden=true});
    document.querySelector('[data-lib-share]')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);toast('Link copiado')}catch{toast('Não foi possível copiar')}});
  }
  function toast(text){const root=document.querySelector('#toastRoot');if(root){const d=document.createElement('div');d.className='toast';d.textContent=text;root.append(d);setTimeout(()=>d.remove(),2500)}}

  function openImpression(id){
    const item=mergedItems(state.data).find(x=>x.id===id);if(!item)return;const modal=document.querySelector('#nx38ImpressionModal');if(!modal)return;
    modal.hidden=false;modal.innerHTML=`<button class="nx38-impression-backdrop" type="button" data-imp-close aria-label="Fechar"></button><div class="nx38-impression-card-modal"><header><div><h2>Nova impressão</h2><div class="anime">${esc(item.media.title)}</div></div><button type="button" data-imp-close>×</button></header><form id="nx38ImpressionForm"><textarea name="body" maxlength="1200" required placeholder="O que você está achando? Uma impressão curta, sem precisar escrever uma resenha inteira."></textarea><div class="nx38-impression-meta"><label><input type="checkbox" name="spoiler"> contém spoiler</label><span data-imp-count>0/1200</span></div><div class="nx38-impression-error" data-imp-error></div><div class="nx38-impression-actions"><button class="nx38-impression-cancel" type="button" data-imp-close>Cancelar</button><button class="nx38-impression-submit" type="submit">Publicar impressão</button></div></form></div>`;
    const close=()=>{modal.hidden=true;modal.innerHTML=''};modal.querySelectorAll('[data-imp-close]').forEach(b=>b.onclick=close);const ta=modal.querySelector('textarea'),count=modal.querySelector('[data-imp-count]');ta?.addEventListener('input',()=>count.textContent=`${ta.value.length}/1200`);ta?.focus();
    modal.querySelector('form').onsubmit=async e=>{e.preventDefault();const body=ta.value.trim(),spoiler=!!modal.querySelector('[name="spoiler"]').checked,err=modal.querySelector('[data-imp-error]'),submit=modal.querySelector('.nx38-impression-submit');if(!body){err.textContent='Escreva alguma coisa antes de publicar.';return}submit.disabled=true;submit.textContent='Publicando…';try{let row;if(IS_PAGES){row={id:`local-${Date.now()}`,mediaId:id,body,spoiler,createdAt:new Date().toISOString(),username:'você',status:item.status,score:item.score,progress:item.progress,media:item.media};const all=read(DEMO_IMP,[]);all.unshift(row);write(DEMO_IMP,all.slice(0,100))}else{await request(`/api/anime/${id}/impressions`,{method:'POST',body:JSON.stringify({body,spoiler})});row={id:`new-${Date.now()}`,mediaId:id,body,spoiler,createdAt:new Date().toISOString(),username:state.data.user?.username||'você',status:item.status,score:item.score,progress:item.progress,media:item.media}}
      state.data.impressions=[normalizeImp(row),...(state.data.impressions||[])];state.data.impressionCount=Number(state.data.impressionCount||0)+1;close();toast('Impressão publicada');shell(state.data);if(route()==='/')mountHomeImpressions(true)}catch(ex){err.textContent='Não foi possível publicar agora. Tente novamente.';submit.disabled=false;submit.textContent='Publicar impressão'}};
  }

  function loginRequired(){document.body.classList.add('nx38-library-active');app.innerHTML=`<main class="nx38-library"><div class="nx38-library-shell"><section class="nx38-library-login"><img src="${BASE}/assets/logo.png" alt=""><h1>Seus animes ficam aqui.</h1><p>Entre para sincronizar favoritos, progresso, notas e impressões em todos os seus dispositivos.</p><div class="nx38-library-login-actions"><a class="nx38-library-primary" href="${pageUrl('/login')}">Entrar</a><a class="nx38-library-ghost" href="${pageUrl('/criar-conta')}">Criar conta</a></div></section></div></main>`;document.documentElement.classList.remove('nx38-library-boot')}
  async function mountLibrary(){if(route()!==LIB_ROUTE)return;const token=++state.renderToken;document.documentElement.classList.add('nx38-library-boot');const data=await loadLibrary();if(token!==state.renderToken||route()!==LIB_ROUTE)return;state.data=data;if(!IS_PAGES&&!data.user){loginRequired();return}shell(data)}

  async function loadPublicImpressions(){
    if(IS_PAGES)return(read(DEMO_IMP,[])||[]).slice(0,10).map(normalizeImp);
    try{const d=await request('/api/community/impressions?limit=12');return(d?.items||[]).map(normalizeImp)}catch{return[]}
  }
  function homeImpCard(x){const name=x.username||'membro',m=x.media||mediaOf(null,x.mediaId),context=[x.status?STATUS[x.status]:null,x.progress?`ep. ${x.progress}`:null,x.score!=null?`★ ${Number(x.score).toFixed(1).replace('.0','')}`:null].filter(Boolean).join(' · ');return `<article class="nx38-impression-home-card" ${m.id?`data-lib-home-open="${m.id}" data-title="${esc(m.title)}"`:''}><div class="nx38-impression-user"><span class="nx38-impression-avatar">${x.avatarUrl?`<img src="${esc(x.avatarUrl)}" alt="">`:esc(name.charAt(0).toUpperCase())}</span><strong>@${esc(name)}</strong><time>${esc(fmtRel(x.createdAt))}</time></div><p class="nx38-impression-body${x.spoiler?' spoiler':''}">${x.spoiler?'Impressão marcada como spoiler. Abra o anime para ler com contexto.':esc(x.body)}</p><div class="nx38-impression-context">${m.cover?`<img src="${esc(m.cover)}" alt="">`:'<div></div>'}<div><strong>${esc(m.title)}</strong><small>${esc(context||'Impressão da comunidade')}</small></div></div></article>`}
  async function mountHomeImpressions(force=false){
    if(route()!=='/')return;const home=document.querySelector('.nx35-home');if(!home)return;if(!force&&document.querySelector('#nx38HomeImpressions'))return;document.querySelector('#nx38HomeImpressions')?.remove();
    const news=document.querySelector('#nx35News')?.closest('.nx35-section'),host=document.createElement('section');host.id='nx38HomeImpressions';host.className='nx38-impressions-home tonal';host.innerHTML=`<div class="nx35-shell"><div class="nx38-impressions-head"><div><span class="nx38-impressions-kicker">COMUNIDADE</span><h2>Últimas <em>Impressões</em></h2><p>Opiniões rápidas de quem está assistindo, com anime, progresso e nota no mesmo contexto.</p></div><a href="${pageUrl('/meus-animes')}">Minhas impressões →</a></div><div class="nx38-impressions-empty">Carregando impressões…</div></div>`;if(news)news.insertAdjacentElement('afterend',host);else home.append(host);
    const items=await loadPublicImpressions(),body=host.querySelector('.nx38-impressions-empty');if(!document.body.contains(host))return;if(items.length)body.outerHTML=`<div class="nx38-impressions-rail">${items.map(homeImpCard).join('')}</div>`;else body.innerHTML='Ainda não há impressões públicas. Quando a comunidade começar a publicar, elas aparecem aqui automaticamente.';
    host.querySelectorAll('[data-lib-home-open]').forEach(c=>c.onclick=()=>go(`/anime/${slug(c.dataset.title||'anime')}-${c.dataset.libHomeOpen}`));
  }

  document.addEventListener('aninexus:media-state-changed',e=>{if(route()!==LIB_ROUTE||!state.data)return;const id=Number(e.detail?.id),s=e.detail?.state||{},row=state.data.list.find(x=>x.id===id);if(!s.status)state.data.list=state.data.list.filter(x=>x.id!==id);else if(row)Object.assign(row,{status:s.status,score:s.score??null,reaction:s.reaction||'',progress:Number(s.progress)||0,updatedAt:Date.now()});else{const fav=state.data.favorites.find(x=>x.id===id);state.data.list.unshift({id,status:s.status,score:s.score??null,reaction:s.reaction||'',progress:Number(s.progress)||0,updatedAt:Date.now(),media:fav?.media||mediaOf(null,id)})}paintContent()});
  document.addEventListener('aninexus:favorite-changed',e=>{if(route()!==LIB_ROUTE||!state.data)return;const id=Number(e.detail?.id),on=!!e.detail?.favorite,f=state.data.favorites.find(x=>x.id===id);if(on&&!f){const row=state.data.list.find(x=>x.id===id);state.data.favorites.unshift({id,createdAt:Date.now(),media:row?.media||mediaOf(null,id)})}if(!on&&f)state.data.favorites=state.data.favorites.filter(x=>x.id!==id);paintContent()});
  addEventListener('aninexus:home-v34-ready',()=>mountHomeImpressions());
  addEventListener('popstate',()=>{if(route()===LIB_ROUTE)mountLibrary();else{document.body.classList.remove('nx38-library-active');if(route()==='/')setTimeout(()=>mountHomeImpressions(),30)}});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{mountLibrary();setTimeout(()=>mountHomeImpressions(),80)},{once:true});else{mountLibrary();setTimeout(()=>mountHomeImpressions(),80)}
})();
