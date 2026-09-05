'use strict';
(() => {
  if(window.__NX40_COMMUNITY__)return;window.__NX40_COMMUNITY__=true;
  const app=document.querySelector('#app');if(!app)return;
  const IS_PAGES=location.hostname.endsWith('github.io');
  const REMOTE=window.AniNexusAuth?.enabled===true;
  const BASE=IS_PAGES?'/AniNexus':'';
  const BUILD='44.24.2';
  const API='https://graphql.anilist.co';
  const LOCAL_THREADS='aninexus:community:threads:v40';
  let active='ALL',items=[],mounted=false,overview=null,overviewState='loading',selectedReaction='Chorei',reactionChosen=false,memberDays=7,loadEpoch=0,overviewEpoch=0,returnFocus=null;

  const STATUS={
    PLANNING:{label:'Quero Ver',verb:'quer ver',emoji:'👀'},
    CURRENT:{label:'Assistindo',verb:'está assistindo',emoji:'▶'},
    COMPLETED:{label:'Terminei',verb:'terminou',emoji:'✓'},
    PAUSED:{label:'Pausei',verb:'pausou',emoji:'⏸'},
    DROPPED:{label:'Desisti',verb:'desistiu de',emoji:'×'}
  };
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||'null')??f}catch{return f}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
  const slug=s=>String(s||'anime').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,90)||'anime';
  const route=()=>{try{const u=new URL(location.href),raw=u.searchParams.get('p');if(raw)return raw.split('?')[0].replace(/\/+$/,'')||'/';let p=u.pathname;if(IS_PAGES)p=p.replace(/^\/AniNexus(?:\/AniNexus)?/,'')||'/';return p.replace(/\/+$/,'')||'/'}catch{return'/'}};
  const owns=()=>route()==='/comunidade';
  const pageUrl=p=>IS_PAGES?`${BASE}/?build=${BUILD}&p=${encodeURIComponent(p)}`:p;
  const go=p=>{if(!IS_PAGES&&window.AniNexusRadio?.navigate?.(p))return;location.assign(pageUrl(p))};
  const time=v=>{const t=Date.parse(v||'');if(!Number.isFinite(t))return'';const d=Math.max(0,Date.now()-t);if(d<60000)return'agora';if(d<3600000)return`há ${Math.max(1,Math.floor(d/60000))}min`;if(d<86400000)return`há ${Math.floor(d/3600000)}h`;if(d<604800000)return`há ${Math.floor(d/86400000)}d`;return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short'}).format(new Date(t)).replace('.','')};
  const mediaTitle=m=>typeof m?.title==='string'?m.title:(m?.title?.english||m?.title?.userPreferred||m?.title?.romaji||m?.title?.native||'');
  const mediaCover=m=>m?.cover||m?.coverImage?.extraLarge||m?.coverImage?.large||'';
  const mediaBanner=m=>m?.banner||m?.bannerImage||'';

  const usableTitle=value=>{const title=String(value||'').trim();return title&&!/^(?:anime|mang[áa])\s*\d+$/i.test(title)&&!['undefined','null','nan'].includes(title.toLowerCase())?title:''};
  const resolvedTitle=x=>usableTitle(x?.title)||usableTitle(mediaTitle(x?.media))||'Título temporariamente indisponível';
  const actorName=x=>String(x?.display_name||x?.displayName||x?.username||'membro').trim()||'membro';
  const actorHandle=x=>/^(?:voc[eê]|you)$/i.test(String(x?.username||'').trim())?'':String(x?.username||'').trim();
  async function json(path){try{if(REMOTE){const j=await window.AniNexusAuth.publicApi(path);return Array.isArray(j)?j:j?.items||[]}const r=await fetch(path,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});if(!r.ok)throw new Error(`HTTP ${r.status}`);const j=await r.json();return Array.isArray(j)?j:j?.items||[]}catch(error){console.warn('[AniNexus comunidade] fonte indisponível.',{path,error});return[]}}
  async function mediaByIds(ids){ids=[...new Set(ids.map(Number).filter(Boolean))].slice(0,35);if(!ids.length)return new Map();try{if(REMOTE){const data=await window.AniNexusAuth.publicApi(`/api/media/summaries?ids=${encodeURIComponent(ids.join(','))}`);return new Map((data?.items||[]).map(m=>[Number(m.id),m]))}const query='query($ids:[Int]){Page(page:1,perPage:35){media(id_in:$ids,type:ANIME){id title{romaji english native userPreferred}coverImage{extraLarge large}bannerImage}}}',r=await fetch(API,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({query,variables:{ids}})});if(!r.ok)throw new Error(`HTTP ${r.status}`);const j=await r.json();return new Map((j?.data?.Page?.media||[]).map(m=>[Number(m.id),m]))}catch(error){console.warn('[AniNexus comunidade] não foi possível resolver metadados das obras.',{ids,error});return new Map()}}

  function localActivity(){return window.AniNexusCommunityActivity?.local?.(50)||[]}
  function localThreads(){const v=read(LOCAL_THREADS,[]);return(Array.isArray(v)?v:[]).map(x=>({...x,kind:'thread',local:true}))}
  async function load(){
    const epoch=++loadEpoch;
    const localRows=[...localActivity(),...localThreads()],local=window.AniNexusCommunityActivity?.enrich?await window.AniNexusCommunityActivity.enrich(localRows):localRows;
    let activity=[],impressions=[],threads=[];
    if(!IS_PAGES||REMOTE){[activity,impressions,threads]=await Promise.all([json('/api/community/activity?limit=40&includeManga=1'),json('/api/community/impressions?limit=24'),json('/api/community/threads?limit=30')])}
    const normalized=[
      ...activity.map(x=>({...x,kind:'state',created_at:x.created_at||x.updated_at})),
      ...local.filter(x=>x.kind!=='thread'),
      ...impressions.map(x=>({...x,kind:'impression'})),
      ...threads.map(x=>({...x,kind:'thread'})),
      ...local.filter(x=>x.kind==='thread')
    ];
    const enriched=window.AniNexusCommunityActivity?.enrich?await window.AniNexusCommunityActivity.enrich(normalized):normalized;
    const missing=enriched.filter(x=>x.media_type!=='MANGA'&&x.media_id&&!x.media&&!x.title).map(x=>x.media_id),map=await mediaByIds(missing);
    if(epoch!==loadEpoch||!owns()||!app.querySelector('.nx40-community'))return;
    const merged=window.AniNexusCommunityActivity?.merge?.(enriched)||enriched;items=merged.map(x=>{
      const m=x.media||(x.media_type!=='MANGA'?map.get(Number(x.media_id)):null)||null;
      const id=x.id||`${x.kind}:${x.media_type||'ANIME'}:${x.media_id||'none'}:${x.created_at||''}:${x.username||''}:${x.status||''}`;
      return{...x,id,media:m,title:x.title||mediaTitle(m),cover:x.cover||mediaCover(m),banner:x.banner||mediaBanner(m),created_at:x.created_at||x.updated_at||new Date().toISOString()}
    }).sort((a,b)=>Date.parse(b.created_at||0)-Date.parse(a.created_at||0));
    render();
  }

  function reactionText(v){const raw=String(v||'').trim();if(!raw)return'';return({LIKE:'👍 Curtindo',DISLIKE:'🫤 Não curti',LOVE:'😍 Amei',WOW:'😮 Uau'})[raw]||raw}
  function avatar(x){const name=actorName(x),handle=actorHandle(x),body=window.AniNexusAvatar?.markup(x,{name})||`<img src="${IS_PAGES?'/AniNexus':''}/assets/avatars/mascot-pink.png" alt="">`;return handle?`<a class="nx40-avatar" href="${pageUrl(`/u/${encodeURIComponent(handle)}`)}" aria-label="Ver perfil de ${esc(name)}">${body}</a>`:`<div class="nx40-avatar">${body}</div>`}
  function actor(x){const name=actorName(x),handle=actorHandle(x),label=`<b>${esc(name)}</b>${handle&&handle.toLocaleLowerCase('pt-BR')!==name.toLocaleLowerCase('pt-BR')?` <span class="nx40-handle">@${esc(handle)}</span>`:''}`;return handle?`<a class="nx40-actor" href="${pageUrl(`/u/${encodeURIComponent(handle)}`)}">${label}</a>`:label}
  function mediaBlock(x){if(!x.media_id&&!x.title)return'';const title=resolvedTitle(x),meta=[x.progress?`${x.media_type==='MANGA'?'capítulo':'episódio'} ${x.progress}`:'',x.score!=null?`★ ${Number(x.score).toFixed(1).replace('.0','')}`:''].filter(Boolean).join(' · ');return `<div class="nx40-media">${x.cover?`<img src="${esc(x.cover)}" alt="${esc(title)}" loading="lazy" decoding="async">`:'<div class="nx40-media-placeholder" aria-hidden="true">◫</div>'}<div><small>${x.media_type==='MANGA'?'MANGÁ':'ANIME'}</small><h3>${esc(title)}</h3>${meta?`<span>${esc(meta)}</span>`:''}</div></div>`}
  function stateCard(x){
    const reading=x.media_type==='MANGA',st=reading&&x.status==='CURRENT'?{label:'Lendo',verb:'está lendo'}:reading&&x.status==='PLANNING'?{label:'Quero ler',verb:'quer ler'}:STATUS[x.status]||{label:'Lista',verb:'atualizou'},title=resolvedTitle(x),m={id:x.media_id,title,mediaType:reading?'MANGA':'ANIME',cover:x.cover||mediaCover(x.media)};
    const reactions=(x.reactions?.length?x.reactions:[x.reaction]).filter(Boolean);
    return `<article class="nx40-card state" data-open-anime="${Number(x.media_id)}" data-media-type="${m.mediaType}" data-title="${esc(title)}"><div class="nx40-activity-art"><a href="${href(m)}" aria-label="${esc(title)}">${mediaImage(m)}</a>${avatar(x)}</div><div class="nx40-copy"><p>${actor(x)} ${esc(st.verb)} <a class="nx40-activity-title" href="${href(m)}">${esc(title)}</a></p><div class="nx40-meta"><span class="nx40-state-label" data-status="${esc(x.status)}">${esc(st.label)}</span>${x.progress?`<span>${reading?'Cap.':'Episódio'} ${Number(x.progress)}</span>`:''}</div><div class="nx40-activity-bottom"><div class="nx40-reaction-marks">${reactions.slice(0,4).map(label=>`<span title="${esc(reactionText(label))}" aria-label="${esc(reactionText(label))}">${esc(emoji(label)||reactionText(label))}</span>`).join('')}${reactions.length>4?`<span title="${esc(reactions.slice(4).join(', '))}">+${reactions.length-4}</span>`:''}</div><time datetime="${esc(x.created_at)}">${esc(time(x.created_at))}</time></div></div></article>`;
  }
  function impressionCard(x){const title=resolvedTitle(x);return `<article class="nx40-card impression" ${x.media_id?`data-open-anime="${x.media_id}" data-media-type="${x.media_type==='MANGA'?'MANGA':'ANIME'}" data-title="${esc(title)}"`:''}>${avatar(x)}<div class="nx40-copy"><p>${actor(x)} publicou uma impressão${x.media_id?` sobre <strong>${esc(title)}</strong>`:''}</p><div class="nx40-meta"><span>✎ Impressão</span><i></i><span>${esc(time(x.created_at))}</span>${x.status&&STATUS[x.status]?`<span>${esc(STATUS[x.status].label)}</span>`:''}${x.score!=null?`<span>★ ${Number(x.score).toFixed(1).replace('.0','')}</span>`:''}</div>${x.spoiler?'<p class="nx40-thread-body"><span class="nx40-spoiler">Spoiler oculto · abra o anime para ver com contexto</span></p>':`<p class="nx40-thread-body">${esc(x.body||'')}</p>`}${mediaBlock({...x,title,cover:x.cover||mediaCover(x.media)})}</div></article>`}
  function threadCard(x){return `<article class="nx40-card thread">${avatar(x)}<div class="nx40-copy"><p>${actor(x)} abriu uma discussão</p><h3 class="nx40-thread-title">${esc(x.title||'Discussão')}</h3>${x.spoiler?'<p class="nx40-thread-body"><span class="nx40-spoiler">Discussão marcada como spoiler</span></p>':`<p class="nx40-thread-body">${esc(x.body||'')}</p>`}<div class="nx40-meta"><span>💬 ${Number(x.replies||0)} respostas</span><i></i><span>${esc(time(x.created_at))}</span></div></div></article>`}
  const card=x=>x.kind==='impression'?impressionCard(x):x.kind==='thread'?threadCard(x):stateCard(x);
  function filtered(){if(active==='ACTIVITY')return items.filter(x=>x.kind==='state');if(active==='IMPRESSIONS')return items.filter(x=>x.kind==='impression');if(active==='THREADS')return items.filter(x=>x.kind==='thread');return items}
  function stats(){const stateItems=items.filter(x=>x.kind==='state'),unique=new Set(items.map(x=>x.username).filter(Boolean));return{activity:stateItems.length,members:unique.size,watching:stateItems.filter(x=>x.status==='CURRENT').length,done:stateItems.filter(x=>x.status==='COMPLETED').length}}
  function trends(){const map=new Map();for(const x of items){if(!x.media_id)continue;const id=Number(x.media_id),mediaType=x.media_type==='MANGA'?'MANGA':'ANIME',key=mediaType+':'+id,cur=map.get(key)||{id,mediaType,count:0,title:resolvedTitle(x),cover:x.cover||mediaCover(x.media)||''};cur.count++;if(!cur.cover)cur.cover=x.cover||mediaCover(x.media)||'';map.set(key,cur)}return[...map.values()].sort((a,b)=>b.count-a.count).slice(0,6)}


  const empty=text=>`<p class="nx40-empty">${esc(text)}</p>`;
  const number=value=>new Intl.NumberFormat('pt-BR',{notation:Number(value)>=10000?'compact':'standard',maximumFractionDigits:1}).format(Number(value)||0);
  const imageUrl=value=>/^(https?:\/\/|\/[^/]|data:image\/)/i.test(String(value||''))?esc(value):'';
  const href=m=>pageUrl(`/${m.mediaType==='MANGA'?'manga':'anime'}/${slug(m.title)}-${Number(m.id)}`);
  const reactionChoices=()=>[...new Map([...(window.AniNexusMediaState?.reactions?.()||[]),...(window.AniNexusMangaState?.reactions?.()||[])].map(r=>[r.label,r])).values()];
  const emoji=label=>reactionChoices().find(x=>x.label===label)?.emoji||'';
  const reactionButton=label=>`<button type="button" data-nx40-reaction="${esc(label)}" aria-pressed="${selectedReaction===label}"><span aria-hidden="true">${esc(emoji(label))}</span>${esc(label)}</button>`;
  const mediaImage=m=>imageUrl(m.cover)?`<img src="${imageUrl(m.cover)}" alt="" loading="lazy" decoding="async">`:'<span class="nx40-cover-empty" aria-hidden="true"></span>';
  function poster(m,index,ranked=false){return `<article class="nx40-poster-card${ranked?' nx40-ranked':''}"><div class="nx40-poster"><a href="${href(m)}" aria-label="${esc(m.title||'Ver obra')}">${mediaImage(m)}</a>${ranked?`<span class="nx40-place">${index+1}</span>`:''}<div class="nx40-poster-actions"><button type="button" ${m.mediaType==='MANGA'?'data-manga-list':'data-nx-list'}="${Number(m.id)}" aria-label="Adicionar à lista"></button><button type="button" ${m.mediaType==='MANGA'?'data-manga-fav':'data-nx-fav'}="${Number(m.id)}" aria-label="Favoritar"></button></div></div><a class="nx40-poster-title" href="${href(m)}">${esc(m.title||'Título indisponível')}</a>${ranked?`<span class="nx40-place-label">${index+1}º lugar</span>`:''}</article>`}
  function miniMedia(m,index,max=0){return `<a class="nx40-mini-media" href="${href(m)}"><span class="nx40-mini-rank">${index+1}</span>${mediaImage(m)}<div><strong>${esc(m.title||'Título indisponível')}</strong>${max?`<span class="nx40-meter"><i style="width:${Math.min(100,100*Number(m.count)/max)}%"></i></span>`:''}</div><small>${number(m.count)}</small></a>`}
  async function loadOverview(){
    const epoch=++overviewEpoch;
    try{
      let data;
      if(REMOTE)data=await window.AniNexusAuth.publicApi('/api/community/overview');
      else{const response=await fetch('/api/community/overview',{headers:{accept:'application/json'}});if(!response.ok)throw Error('overview unavailable');data=await response.json()}
      if(!data?.totals||!Array.isArray(data.rankings))throw Error('invalid overview');
      if(epoch!==overviewEpoch||!owns())return;
      overview=data;overviewState='ready';
      if(!reactionChosen&&!data.rankings.some(r=>r.label===selectedReaction))selectedReaction=data.distribution?.find(r=>data.rankings.some(m=>m.label===r.label))?.label||selectedReaction;
    }catch{if(epoch!==overviewEpoch||!owns())return;overviewState='error'}
    renderOverview();
  }
  function renderOverview(){
    if(!owns()||!app.querySelector('#nx40Stats'))return;
    const data=overview;
    app.querySelector('#nx40Stats').innerHTML=[['works','OBRAS'],['reactions','REAÇÕES'],['completed','CONCLUÍDOS'],['impressions','IMPRESSÕES'],['ratings','NOTAS DADAS']].map(([key,label])=>`<div class="nx40-stat"><b>${data?number(data.totals[key]):'—'}</b><span>${label}</span></div>`).join('');
    app.querySelector('#nx40OverviewNotice').innerHTML=overviewState==='error'?'<p>Os números da comunidade estão indisponíveis no momento. <button type="button" data-nx40-retry>Tentar novamente</button></p>':'';
    app.querySelector('[data-nx40-retry]')?.addEventListener('click',()=>{overviewState='loading';renderOverview();loadOverview()});
    const primary=['Chorei','Rachei','Viciante','Amei','Que trilha!','Joia escondida','Final incrível','Esperava mais'];
    const rest=reactionChoices().map(x=>x.label).filter(label=>!primary.includes(label));
    app.querySelector('#nx40Reactions').innerHTML=primary.map(reactionButton).join('')+`<details class="nx40-more-reactions"><summary aria-label="Todas as reações" title="Todas as reações">···</summary><div>${rest.map(reactionButton).join('')}</div></details>`;
    app.querySelectorAll('[data-nx40-reaction]').forEach(button=>button.onclick=()=>{reactionChosen=true;selectedReaction=button.dataset.nx40Reaction;renderRanking();app.querySelectorAll('[data-nx40-reaction]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.nx40Reaction===selectedReaction)));const more=button.closest('details');if(more){more.removeAttribute('open');more.querySelector('summary').focus()}});
    renderRanking();renderMembers();
    const dist=data?.distribution||[],total=dist.reduce((sum,r)=>sum+Number(r.count),0);
    app.querySelector('#nx40Distribution').innerHTML=dist.length?`<div class="nx40-distribution">${dist.slice(0,6).map((r,i)=>`<div><span>${esc(emoji(r.label))} ${esc(r.label)}</span><span class="nx40-meter tone-${i}"><i style="width:${100*r.count/Math.max(1,dist[0].count)}%"></i></span><b>${Math.round(100*r.count/total)}%</b></div>`).join('')}</div><p class="nx40-insight">A reação mais compartilhada é <strong>${esc(dist[0].label)}</strong>.</p>`:empty(overviewState==='loading'?'Carregando reações...':'As primeiras reações vão aparecer aqui.');
    app.querySelector('#nx40Comparisons').innerHTML=[['Amei','Esperava mais'],['Final incrível','Pesado demais']].filter(pair=>pair.every(label=>data?.rankings?.some(r=>r.label===label))).map(pair=>`<section class="nx40-section nx40-comparison"><h2 class="nx40-sr">${pair.map(esc).join(' vs ')}</h2>${pair.map((label,i)=>`<div class="nx40-contrast tone-${i}"><h3>${esc(emoji(label))} ${esc(label)}</h3>${(data?.rankings||[]).filter(x=>x.label===label).slice(0,4).map((x,i)=>miniMedia(x,i)).join('')||empty('Sem reações ainda.')}</div>`).join('<span class="nx40-vs" aria-hidden="true">VS</span>')}</section>`).join('');
    app.querySelector('#nx40Dropped').innerHTML=(data?.dropped||[]).map((m,i)=>{const percent=Math.round(100*m.dropped/Math.max(1,m.dropped+m.completed));return `<div class="nx40-drop">${miniMedia({...m,count:m.dropped},i)}<div class="nx40-drop-meter"><i style="width:${percent}%"></i></div><small>${percent}% desistiram · ${number(m.completed)} concluíram</small></div>`}).join('')||empty('Nenhum abandono registrado.');
    app.querySelector('#nx40Studios').innerHTML=(data?.studios||[]).map((s,i)=>`<div><span>${i+1}</span><strong>${esc(s.name)}</strong><small>${number(s.count)}</small></div>`).join('')||empty('Os estúdios aparecerão com as obras da comunidade.');
    app.querySelector('#nx40Favorites').innerHTML=(data?.favorites||[]).map((m,i)=>poster(m,i)).join('')||empty('Ainda não há favoritos públicos.');
    const newcomers=data?.newMembers||[];
    app.querySelector('#nx40Comparisons').hidden=!app.querySelector('#nx40Comparisons').children.length;
    for(const [id,key] of [['nx40Dropped','dropped'],['nx40Studios','studios'],['nx40Favorites','favorites']])app.querySelector('#'+id).closest('section').hidden=!!data&&!data[key]?.length;
    app.querySelector('#nx40NewMembers').innerHTML=newcomers.length?`<div class="nx40-new-members">${newcomers.map(avatar).join('')}</div><p class="nx40-section-note">${number(data.joinedToday)} entraram hoje</p>`:empty('Nenhum novo membro por aqui.');
    window.injectIcons?.(app);
  }
  function renderRanking(){
    const ranking=(overview?.rankings||[]).filter(x=>x.label===selectedReaction);
    app.querySelector('#nx40ReactionTitle').textContent=selectedReaction==='Chorei'?'O que fez a comunidade chorar?':`As obras que mais receberam “${selectedReaction}”`;
    app.querySelector('#nx40ReactionRanking').innerHTML=ranking.length?`<div class="nx40-podium">${ranking.slice(0,3).map((m,i)=>poster(m,i,true)).join('')}</div><div class="nx40-ranking-list">${ranking.slice(1).map((m,i)=>`<div class="${i<2?'nx40-mobile-runner':''}">${miniMedia(m,i+1,ranking[0].count)}</div>`).join('')}</div>`:empty(overviewState==='loading'?'Carregando ranking...':'Ainda não há obras com essa reação.');
    window.injectIcons?.(app.querySelector('#nx40ReactionRanking'));
  }
  function renderMembers(){
    if(!app.querySelector('#nx40Members'))return;
    app.querySelectorAll('[data-nx40-days]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.nx40Days)===memberDays)));
    app.querySelector('#nx40Members').innerHTML=(overview?.activeMembers||[]).filter(m=>Number(m.days)===memberDays).map((m,i)=>`<div class="nx40-member"><span>${i+1}º</span>${avatar(m)}<div>${actor(m)}</div><small>${number(m.count)} atividades</small></div>`).join('')||empty('Nenhuma atividade pública nesse período.');
  }
  let scrollFrame=0,lastScroll=scrollY;
  addEventListener('scroll',()=>{
    if(scrollFrame||!owns())return;
    scrollFrame=requestAnimationFrame(()=>{scrollFrame=0;const top=scrollY,hero=app.querySelector('.nx40-hero');if(!hero)return;const scrolled=top>hero.offsetHeight-60;
      document.body.classList.toggle('nx40-scrolled',scrolled);
      if(Math.abs(top-lastScroll)>4)document.body.classList.toggle('nx40-scroll-down',scrolled&&top>lastScroll);
      lastScroll=top;
    });
  },{passive:true});
  document.addEventListener('keydown',e=>{
    const more=app.querySelector('.nx40-more-reactions[open]');
    if(e.key==='Escape'&&more){more.removeAttribute('open');more.querySelector('summary').focus()}
    const modal=document.querySelector('#nx40ThreadModal');
    if(!modal||modal.hidden)return;
    if(e.key==='Escape'){e.preventDefault();closeModal()}
    if(e.key==='Tab'){const focusable=[...modal.querySelectorAll('form button,form input,form textarea')].filter(el=>!el.disabled),first=focusable[0],last=focusable.at(-1);
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}
  });

  function shell(){
    app.innerHTML=`<main class="nx40-community">
      <section class="nx40-hero"><div class="nx40-shell"><h1>Comunidade</h1><p>Anime, mangá e tudo o que fica depois da última cena.</p></div></section>
      <div class="nx40-guide" id="nx40Guide"><div class="nx40-shell"><a href="#nx40Overview">Comunidade</a><button type="button" data-nx40-guide aria-expanded="false" aria-controls="nx40GuideLinks" aria-label="Abrir atalhos da comunidade"><span data-icon="arrow"></span></button></div><nav id="nx40GuideLinks" aria-label="Atalhos da comunidade" hidden><a href="#nx40Overview">Visão geral</a><a href="#nx40Ranking">Reações</a><a href="#nx40FeedSection">Atividade</a></nav></div>
      <div class="nx40-shell nx40-overview" id="nx40Overview"><h2 class="nx40-sr">AniNexus em números</h2><div class="nx40-stats" id="nx40Stats" aria-live="polite"></div><div id="nx40OverviewNotice" role="status"></div></div>
      <div class="nx40-shell nx40-body"><div class="nx40-main">
        <section class="nx40-section" id="nx40Ranking"><span class="nx40-kicker">RANKING POR REAÇÃO</span><h2 id="nx40ReactionTitle">O que fez a comunidade chorar?</h2><div class="nx40-reaction-options" id="nx40Reactions"></div><div id="nx40ReactionRanking" aria-live="polite"></div></section>
        <section class="nx40-section"><h2>Que comunidade somos nós?</h2><div id="nx40Distribution"></div></section>
        <div class="nx40-comparisons" id="nx40Comparisons"></div>
        <section class="nx40-section"><h2>Os mais dropados</h2><p class="nx40-section-note">Entre quem terminou e quem desistiu.</p><div id="nx40Dropped"></div></section>
        <section class="nx40-section"><h2>Estúdios na comunidade</h2><div class="nx40-studios" id="nx40Studios"></div></section>
        <section class="nx40-section"><h2>Mais favoritados</h2><div class="nx40-favorite-grid" id="nx40Favorites"></div></section>
      </div><aside class="nx40-side">
        <section class="nx40-section"><header class="nx40-toolbar"><h2>Mais <em>ativos</em></h2><div class="nx40-segment" aria-label="Período"><button type="button" data-nx40-days="7" aria-pressed="true">7 dias</button><button type="button" data-nx40-days="30" aria-pressed="false">30 dias</button></div></header><div id="nx40Members"></div></section>
        <section class="nx40-section"><h2>Novos <em>membros</em></h2><div id="nx40NewMembers"></div></section>
        <section class="nx40-section" id="nx40FeedSection"><header class="nx40-toolbar"><h2 id="nx40FeedTitle">Agora na comunidade</h2><button type="button" class="nx40-new-thread" data-nx40-new title="Nova discussão"><span data-icon="plus"></span><span>Nova discussão</span></button></header>
          <nav class="nx40-tabs" aria-label="Filtros da comunidade"><button class="nx40-tab active" data-nx40-tab="ALL">Tudo</button><button class="nx40-tab" data-nx40-tab="ACTIVITY">Atividade</button><button class="nx40-tab" data-nx40-tab="IMPRESSIONS">Impressões</button><button class="nx40-tab" data-nx40-tab="THREADS">Discussões</button></nav>
          <div class="nx40-feed" id="nx40Feed"><p class="nx40-empty">Carregando atividade...</p></div>
        </section>
        <section class="nx40-section"><h2>Obras mais movimentadas</h2><div class="nx40-trending" id="nx40Trending"></div></section>
      </aside></div></main><div class="nx40-modal" id="nx40ThreadModal" hidden><button class="nx40-modal-backdrop" data-nx40-close aria-label="Fechar"></button><form class="nx40-modal-card" id="nx40ThreadForm" role="dialog" aria-modal="true" aria-label="Nova discussão"><header><div><span class="nx40-kicker">NOVA DISCUSSÃO</span><h2>Converse com a comunidade</h2></div><button type="button" data-nx40-close aria-label="Fechar">×</button></header><label>TÍTULO<input name="title" maxlength="180" minlength="3" required placeholder="Sobre o que você quer conversar?"></label><label>MENSAGEM<textarea name="body" maxlength="5000" minlength="3" required placeholder="Escreva sua discussão…"></textarea></label><label style="display:flex;align-items:center;gap:8px;letter-spacing:0"><input name="spoiler" type="checkbox" style="width:auto;margin:0"> contém spoiler</label><div class="nx40-form-error" id="nx40FormError"></div><div class="nx40-modal-actions"><button type="button" data-nx40-close>Cancelar</button><button class="primary" type="submit">Publicar</button></div></form></div>`;
    document.title='Comunidade | AniNexus';document.body.classList.add('nx40-community-active');document.querySelectorAll('[data-nav]').forEach(a=>a.classList.remove('active'));bind();mounted=true;requestAnimationFrame(()=>{if(!owns())return;document.documentElement.classList.add('nx40-community-ready');document.documentElement.classList.remove('nx40-community-boot')});
  }
  function render(){
    if(!mounted||!owns()||!app.querySelector('#nx40Feed'))return;
    const list=filtered();
    app.querySelector('#nx40FeedTitle').textContent={ALL:'Agora na comunidade',ACTIVITY:'Lista e acompanhamento',IMPRESSIONS:'Impressões da comunidade',THREADS:'Discussões recentes'}[active];
    app.querySelectorAll('[data-nx40-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.nx40Tab===active);b.setAttribute('aria-pressed',String(b.dataset.nx40Tab===active))});
    app.querySelector('#nx40Feed').innerHTML=list.length?list.slice(0,30).map(card).join(''):empty('Nenhuma atividade por aqui ainda.');
    app.querySelector('#nx40Trending').innerHTML=trends().map((x,i)=>miniMedia({...x,mediaType:x.mediaType||'ANIME'},i)).join('')||empty('Ainda não há tendências.');
    bindCards();window.injectIcons?.(app);
  }
  function bindCards(){app.querySelectorAll('[data-open-anime]').forEach(el=>{if(el.dataset.nx40Bound)return;el.dataset.nx40Bound='1';el.onclick=e=>{if(e.target.closest('button,a,input,textarea'))return;const id=Number(el.dataset.openAnime),name=el.dataset.title||'anime';if(id)go(`/${el.dataset.mediaType==='MANGA'?'manga':'anime'}/${slug(name)}-${id}`)}});app.querySelectorAll('[data-nx40-trend]').forEach(el=>{if(el.dataset.nx40Bound)return;el.dataset.nx40Bound='1';el.onclick=()=>go(`/anime/${slug(el.dataset.title)}-${Number(el.dataset.nx40Trend)}`)})}
  function openModal(event){returnFocus=event?.currentTarget||document.activeElement;const modal=document.querySelector('#nx40ThreadModal');modal.hidden=false;document.body.classList.add('modal-open');requestAnimationFrame(()=>modal.querySelector('input[name="title"]')?.focus())}
  function closeModal(){const m=document.querySelector('#nx40ThreadModal');if(!m||m.hidden)return;m.hidden=true;document.body.classList.remove('modal-open');if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true})}
  async function submitThread(e){e.preventDefault();const form=e.currentTarget,error=document.querySelector('#nx40FormError'),fd=new FormData(form),data={title:String(fd.get('title')||'').trim(),body:String(fd.get('body')||'').trim(),spoiler:fd.get('spoiler')==='on'};if(data.title.length<3||!data.body){error.textContent='Preencha título e mensagem.';return}const submit=form.querySelector('button[type="submit"]');submit.disabled=true;submit.textContent='Publicando…';try{if(IS_PAGES&&!REMOTE){const list=read(LOCAL_THREADS,[]);list.unshift({id:`local-${Date.now()}`,kind:'thread',username:'',display_name:'Sua lista',avatar_url:'',...data,replies:0,created_at:new Date().toISOString(),local:true});write(LOCAL_THREADS,list.slice(0,30))}else if(REMOTE){await window.AniNexusAuth.api('/api/community/threads',{method:'POST',body:JSON.stringify(data)})}else{const r=await fetch('/api/community/threads',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify(data)});if(r.status===401)throw new Error('Entre na sua conta para publicar.');if(!r.ok)throw new Error('Não foi possível publicar agora.')}form.reset();closeModal();await load()}catch(err){error.textContent=err?.status===401?'Entre na sua conta para publicar.':'Não foi possível publicar agora. Tente novamente.'}finally{submit.disabled=false;submit.textContent='Publicar'}}
  function bind(){
    app.querySelectorAll('[data-nx40-tab]').forEach(b=>b.onclick=()=>{active=b.dataset.nx40Tab;render()});
    app.querySelector('[data-nx40-new]')?.addEventListener('click',openModal);
    app.querySelectorAll('[data-nx40-close]').forEach(b=>b.onclick=closeModal);
    app.querySelector('#nx40ThreadForm')?.addEventListener('submit',submitThread);
    app.querySelectorAll('[data-nx40-days]').forEach(b=>b.onclick=()=>{memberDays=Number(b.dataset.nx40Days);renderMembers()});
    app.querySelector('[data-nx40-guide]').onclick=e=>{const button=e.currentTarget,expanded=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(expanded));app.querySelector('#nx40GuideLinks').hidden=!expanded};
  }
  async function mount(){
    if(!owns()){++loadEpoch;++overviewEpoch;mounted=false;closeModal();document.body.classList.remove('modal-open','nx40-community-active','nx40-scrolled','nx40-scroll-down');document.documentElement.classList.remove('nx40-community-boot','nx40-community-ready');return}
    if(!app.querySelector('.nx40-community')){mounted=false;shell();renderOverview();loadOverview()}
    await load();
  }
  let refreshTimer;
  const refresh=()=>{if(!owns())return;clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>{load();loadOverview()},350)};
  addEventListener('aninexus:community-activity-changed',refresh);
  addEventListener('aninexus:account-identity-changed',refresh);
  addEventListener('aninexus:manga-media-state-changed',refresh);
  addEventListener('popstate',mount);addEventListener('aninexus:navigate',mount);addEventListener('aninexus:route-changed',mount);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
