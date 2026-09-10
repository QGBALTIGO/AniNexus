'use strict';
(() => {
  if(window.__NX40_COMMUNITY__)return;window.__NX40_COMMUNITY__=true;
  const app=document.querySelector('#app');if(!app)return;
  const IS_PAGES=location.hostname.endsWith('github.io');
  const REMOTE=window.AniNexusAuth?.enabled===true;
  const BASE=IS_PAGES?'/AniNexus':'';
  const BUILD='44.24.4';
  const API='https://graphql.anilist.co';
  let items=[],topics=[],mounted=false,overview=null,overviewState='loading',selectedReaction='Chorei',reactionChosen=false,memberDays=7,loadEpoch=0,overviewEpoch=0,visibleActivity=6,visibleImpressions=3;

  const STATUS={
    PLANNING:{label:'Quero Ver',verb:'quer ver',emoji:'👀'},
    CURRENT:{label:'Assistindo',verb:'está assistindo',emoji:'▶'},
    COMPLETED:{label:'Terminei',verb:'terminou',emoji:'✓'},
    PAUSED:{label:'Pausei',verb:'pausou',emoji:'⏸'},
    DROPPED:{label:'Desisti',verb:'desistiu de',emoji:'×'}
  };
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slug=s=>String(s||'anime').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,90)||'anime';
  const route=()=>{try{const u=new URL(location.href),raw=u.searchParams.get('p');if(raw)return raw.split('?')[0].replace(/\/+$/,'')||'/';let p=u.pathname;if(IS_PAGES)p=p.replace(/^\/AniNexus(?:\/AniNexus)?/,'')||'/';return p.replace(/\/+$/,'')||'/'}catch{return'/'}};
  const owns=()=>route()==='/comunidade';
  const pageUrl=p=>IS_PAGES?`${BASE}/?build=${BUILD}&p=${encodeURIComponent(p)}`:p;
  const go=p=>{if(!IS_PAGES&&window.AniNexusRadio?.navigate?.(p))return;location.assign(pageUrl(p))};
  const time=v=>{const t=Date.parse(v||'');if(!Number.isFinite(t))return'';const d=Math.max(0,Date.now()-t);if(d<60000)return'agora';if(d<3600000)return`há ${Math.max(1,Math.floor(d/60000))}min`;if(d<86400000)return`há ${Math.floor(d/3600000)}h`;if(d<604800000)return`há ${Math.floor(d/86400000)}d`;return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short'}).format(new Date(t)).replace('.','')};
  const mediaTitle=m=>typeof m?.title==='string'?m.title:(m?.title?.english||m?.title?.userPreferred||m?.title?.romaji||m?.title?.native||'');
  const mediaCover=m=>m?.cover||m?.coverImage?.extraLarge||m?.coverImage?.large||'';
  const mediaBanner=m=>m?.banner||m?.bannerImage||'';

  const usableTitle=value=>{const title=String(value||'').trim();return title&&!/^(?:(?:anime|mang[áa])\s*\d+|título (?:temporariamente )?indisponível|undefined|null|nan)$/i.test(title)?title:''};
  const resolvedTitle=x=>usableTitle(x?.title)||usableTitle(mediaTitle(x?.media))||'Título temporariamente indisponível';
  const actorName=x=>String(x?.display_name||x?.displayName||x?.username||'membro').trim()||'membro';
  const actorHandle=x=>/^(?:voc[eê]|you)$/i.test(String(x?.username||'').trim())?'':String(x?.username||'').trim();
  async function json(path){try{if(REMOTE){const j=await window.AniNexusAuth.publicApi(path);return Array.isArray(j)?j:j?.items||[]}const r=await fetch(path,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});if(!r.ok)throw new Error(`HTTP ${r.status}`);const j=await r.json();return Array.isArray(j)?j:j?.items||[]}catch(error){console.warn('[AniNexus comunidade] fonte indisponível.',{path,error});return[]}}
  async function mediaByIds(ids,type='ANIME'){
    ids=[...new Set(ids.map(Number).filter(Boolean))].slice(0,35);if(!ids.length)return new Map();
    try{
      if(REMOTE&&type==='ANIME'){const data=await window.AniNexusAuth.publicApi(`/api/media/summaries?ids=${encodeURIComponent(ids.join(','))}`);return new Map((data?.items||[]).map(m=>[Number(m.id),m]))}
      const query=`query($ids:[Int]){Page(page:1,perPage:35){media(id_in:$ids,type:${type}){id title{romaji english native userPreferred}coverImage{extraLarge large}}}}`;
      const response=await fetch(API,{method:'POST',signal:AbortSignal.timeout(8000),headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({query,variables:{ids}})});
      if(!response.ok)throw Error(`HTTP ${response.status}`);
      return new Map(((await response.json())?.data?.Page?.media||[]).map(m=>[Number(m.id),m]));
    }catch{return new Map()}
  }

  function localActivity(){return window.AniNexusCommunityActivity?.local?.(50)||[]}
  async function load(){
    const epoch=++loadEpoch;
    const localRows=localActivity(),local=window.AniNexusCommunityActivity?.enrich?await window.AniNexusCommunityActivity.enrich(localRows):localRows;
    let activity=[],impressions=[],communityTopics=[];
    if(!IS_PAGES||REMOTE){[activity,impressions,communityTopics]=await Promise.all([json('/api/community/activity?limit=40&includeManga=1'),json('/api/feed/impressions?limit=24&filter=all&sort=recent&hideSpoilers=true'),json('/api/feed/community?sort=hot&limit=8')])}
    const normalized=[
      ...activity.map(x=>({...x,kind:'state',created_at:x.created_at||x.updated_at})),
      ...local.filter(x=>x.kind!=='thread'),
      ...impressions.map(x=>({...x,kind:'impression'}))
    ];
    const enriched=window.AniNexusCommunityActivity?.enrich?await window.AniNexusCommunityActivity.enrich(normalized):normalized;
    const missing=enriched.filter(x=>x.media_id&&(!usableTitle(x.title)&&!usableTitle(mediaTitle(x.media))||!x.cover&&!mediaCover(x.media)));
    const [anime,manga]=await Promise.all(['ANIME','MANGA'].map(type=>mediaByIds(missing.filter(x=>(x.media_type==='MANGA'?'MANGA':'ANIME')===type).map(x=>x.media_id),type)));
    if(epoch!==loadEpoch||!owns()||!app.querySelector('.nx40-community'))return;
    const merged=window.AniNexusCommunityActivity?.merge?.(enriched)||enriched;topics=communityTopics;items=merged.map(x=>{
      const fetched=(x.media_type==='MANGA'?manga:anime).get(Number(x.media_id)),m=x.media||fetched||null;
      const id=x.id||`${x.kind}:${x.media_type||'ANIME'}:${x.media_id||'none'}:${x.created_at||''}:${x.username||''}:${x.status||''}`;
      return{...x,id,media:m,title:usableTitle(x.title)||usableTitle(mediaTitle(m))||usableTitle(mediaTitle(fetched)),cover:x.cover||mediaCover(m)||mediaCover(fetched),banner:x.banner||mediaBanner(m),created_at:x.created_at||x.updated_at||new Date().toISOString()}
    }).filter(x=>x.media_id&&x.title&&x.cover).sort((a,b)=>Date.parse(b.created_at||0)-Date.parse(a.created_at||0));
    render();
  }

  function reactionText(v){const raw=String(v||'').trim();return({LIKE:'Curtindo',DISLIKE:'Esperava mais',LOVE:'Amei',WOW:'De arrepiar'})[raw]||raw}
  function impressionSegments(x){const supplied=Array.isArray(x?.segments)?x.segments:[];if(supplied.length&&(!x?.spoiler||supplied.some(segment=>segment.type==='spoiler')))return supplied;const body=String(x?.body||''),segments=[];let cursor=0;for(const match of body.matchAll(/\|\|([^|]+?)\|\|/g)){if(match.index>cursor)segments.push({type:'text',content:body.slice(cursor,match.index)});segments.push({type:'spoiler',content:match[1]});cursor=match.index+match[0].length}if(cursor<body.length)segments.push({type:'text',content:body.slice(cursor)});return segments.length?segments:[{type:x?.spoiler||x?.has_spoilers||x?.hasSpoilers?'spoiler':'text',content:body}]}
  function impressionBody(x){return impressionSegments(x).map(segment=>segment.type==='spoiler'?`<button type="button" class="nx40-partial-spoiler" data-nx40-spoiler aria-label="Revelar trecho com spoiler"><span>${esc(segment.content)}</span><b>Toque para revelar</b></button>`:`<span>${esc(segment.content)}</span>`).join('')}
  function avatar(x){const name=actorName(x),handle=actorHandle(x),body=window.AniNexusAvatar?.markup(x,{name})||`<img src="${IS_PAGES?'/AniNexus':''}/assets/avatars/mascot-pink.png" alt="">`;return handle?`<a class="nx40-avatar" href="${pageUrl(`/u/${encodeURIComponent(handle)}`)}" aria-label="Ver perfil de ${esc(name)}">${body}</a>`:`<div class="nx40-avatar">${body}</div>`}
  function actor(x){const name=actorName(x),handle=actorHandle(x);return handle?`<a class="nx40-actor" href="${pageUrl(`/u/${encodeURIComponent(handle)}`)}" aria-label="${esc(name)}"><b>@${esc(handle)}</b></a>`:`<b>${esc(name)}</b>`}
  function stateCard(x){
    const reading=x.media_type==='MANGA',st=reading&&x.status==='CURRENT'?{label:'Lendo',verb:'está lendo'}:reading&&x.status==='PLANNING'?{label:'Quero ler',verb:'quer ler'}:STATUS[x.status]||{label:'Lista',verb:'atualizou'},title=resolvedTitle(x),m={id:x.media_id,title,mediaType:reading?'MANGA':'ANIME',cover:x.cover||mediaCover(x.media)};
    const reactions=[...new Set((x.reactions?.length?x.reactions:[x.reaction]).filter(Boolean).map(reactionText))];
    const progress=[x.progress?`${reading?'Cap.':'Episódio'} ${Number(x.progress)}`:'',reading&&x.volume_progress?`Vol. ${Number(x.volume_progress)}`:''].filter(Boolean).join(' · ');
    return `<article class="nx40-card state" data-open-anime="${Number(x.media_id)}" data-media-type="${m.mediaType}" data-title="${esc(title)}"><div class="nx40-activity-art"><a href="${href(m)}" aria-label="${esc(title)}">${mediaImage(m)}</a>${avatar(x)}</div><div class="nx40-copy"><p>${actor(x)} <span class="nx40-state-label" data-status="${esc(x.status)}">${esc(st.verb)}</span> <a class="nx40-activity-title" href="${href(m)}">${esc(title)}</a></p>${progress?`<div class="nx40-meta">${esc(progress)}</div>`:''}<div class="nx40-activity-bottom">${reactions.length?`<div class="nx40-reaction-marks">${reactions.slice(0,4).map(label=>`<span role="img" title="${esc(reactionText(label))}" aria-label="${esc(reactionText(label))}">${esc(emoji(label)||'…')}</span>`).join('')}${reactions.length>4?`<span role="img" aria-label="Mais ${reactions.length-4} reações" title="${esc(reactions.slice(4).join(', '))}">+${reactions.length-4}</span>`:''}</div>`:''}<time datetime="${esc(x.created_at)}">${esc(time(x.created_at))}</time></div></div></article>`;
  }
  function impressionCard(x){
    const title=resolvedTitle(x),m={id:x.media_id,title,mediaType:x.media_type==='MANGA'?'MANGA':'ANIME',cover:x.cover};
    return `<article class="nx40-impression"><header>${avatar(x)}${actor(x)}<time datetime="${esc(x.created_at)}">${esc(time(x.created_at))}</time></header><p class="nx40-impression-body">${impressionBody(x)}</p><a class="nx40-impression-work" href="${href(m)}">${mediaImage(m)}<div><strong>${esc(title)}</strong><small>${m.mediaType==='MANGA'?'Mangá':'Anime'}${x.progress?` · ${m.mediaType==='MANGA'?'Cap.':'Ep.'} ${Number(x.progress)}`:''}</small></div></a></article>`;
  }
  function topicCard(x){const author=x.authorUser?.displayName||x.authorUser?.username||'Membro',last=x.lastReplyUser?`Última resposta por @${x.lastReplyUser}`:`Criado por ${author}`;return `<article class="nx40-topic"><span>${esc(x.category||'GERAL')}</span><h3>${esc(x.title||'Discussão da comunidade')}</h3><p>${esc(last)}</p><footer><b>${Number(x.repliesCount)||0} ${Number(x.repliesCount)===1?'resposta':'respostas'}</b><time>${esc(time(x.lastReplyAt))}</time></footer></article>`}
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
    app.querySelector('#nx40NewMembers').innerHTML=newcomers.length?`<div class="nx40-new-members">${newcomers.map(avatar).join('')}</div><p class="nx40-new-count">${data.joinedToday?`<strong>+${number(data.joinedToday)}</strong> ${Number(data.joinedToday)===1?'entrou':'entraram'} hoje`:'Membros que chegaram recentemente'}</p>`:empty('Nenhum novo membro por aqui.');
    window.injectIcons?.(app);
  }
  function renderRanking(){
    const ranking=(overview?.rankings||[]).filter(x=>x.label===selectedReaction);
    const questions={'Chorei':'O que fez a comunidade chorar?','Rachei':'O que mais fez a comunidade rir?','Viciante':'Quais obras são difíceis de largar?','Amei':'As obras que ganharam nosso coração','Que trilha!':'Qual trilha ficou na memória?','Joia escondida':'Quais obras merecem mais atenção?','Final incrível':'Quais finais ficaram na memória?','Esperava mais':'De quais obras a comunidade esperava mais?'};
    app.querySelector('#nx40ReactionTitle').textContent=questions[selectedReaction]||`As obras que mais receberam “${selectedReaction}”`;
    app.querySelector('#nx40ReactionRanking').innerHTML=ranking.length?`<div class="nx40-podium">${ranking.slice(0,3).map((m,i)=>poster(m,i,true)).join('')}</div><div class="nx40-ranking-list">${ranking.slice(1).map((m,i)=>`<div class="${i<2?'nx40-mobile-runner':''}">${miniMedia(m,i+1,ranking[0].count)}</div>`).join('')}</div>`:empty(overviewState==='loading'?'Carregando ranking...':'Ainda não há obras com essa reação.');
    window.injectIcons?.(app.querySelector('#nx40ReactionRanking'));
  }
  function renderMembers(){
    if(!app.querySelector('#nx40Members'))return;
    app.querySelectorAll('[data-nx40-days]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.nx40Days)===memberDays)));
    app.querySelector('#nx40Members').innerHTML=(overview?.activeMembers||[]).filter(m=>Number(m.days)===memberDays).map((m,i)=>`<div class="nx40-member"><span>${i+1}º</span>${avatar(m)}<div>${actor(m)}</div><small><b>${number(m.count)}</b> ${Number(m.count)===1?'atividade':'atividades'}</small></div>`).join('')||empty('Nenhuma atividade pública nesse período.');
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
  });

  function shell(){
    app.innerHTML=`<main class="nx40-community">
      <section class="nx40-hero"><div class="nx40-shell"><h1>Comunidade</h1><p>Anime, mangá e tudo o que fica depois da última cena.</p></div></section>
      <div class="nx40-guide" id="nx40Guide"><div class="nx40-shell"><a href="#nx40Overview">Comunidade</a><button type="button" data-nx40-guide aria-expanded="false" aria-controls="nx40GuideLinks" aria-label="Abrir atalhos da comunidade"><span data-icon="arrow"></span></button></div><nav id="nx40GuideLinks" aria-label="Atalhos da comunidade" hidden><a href="#nx40Overview">Visão geral</a><a href="#nx40Ranking">Reações</a><a href="#nx40FeedSection">Atividade</a></nav></div>
      <div class="nx40-shell nx40-overview" id="nx40Overview"><h2 class="nx40-sr">AniNexus em números</h2><div class="nx40-stats" id="nx40Stats" aria-live="polite"></div><div id="nx40OverviewNotice" role="status"></div></div>
      <div class="nx40-shell nx40-body"><div class="nx40-main">
        <section class="nx40-section nx40-tool" id="nx40Ranking"><span class="nx40-kicker">RANKING POR REAÇÃO</span><h2 id="nx40ReactionTitle">O que fez a comunidade chorar?</h2><div class="nx40-reaction-options" id="nx40Reactions"></div><div id="nx40ReactionRanking" aria-live="polite"></div></section>
        <section class="nx40-section"><h2>Que comunidade somos nós?</h2><div id="nx40Distribution"></div></section>
        <div class="nx40-comparisons" id="nx40Comparisons"></div>
        <section class="nx40-section"><h2>Os mais dropados</h2><p class="nx40-section-note">Entre quem terminou e quem desistiu.</p><div id="nx40Dropped"></div></section>
        <section class="nx40-section"><h2>Estúdios na comunidade</h2><div class="nx40-studios" id="nx40Studios"></div></section>
        <section class="nx40-section"><h2>Mais favoritados</h2><div class="nx40-favorite-grid" id="nx40Favorites"></div></section>
      </div><aside class="nx40-side">
        <section class="nx40-section nx40-tool"><header class="nx40-toolbar"><h2>Mais <em>ativos</em></h2><div class="nx40-segment" aria-label="Período"><button type="button" data-nx40-days="7" aria-pressed="true">7 dias</button><button type="button" data-nx40-days="30" aria-pressed="false">30 dias</button></div></header><div id="nx40Members"></div></section>
        <section class="nx40-section"><h2>Novos <em>membros</em></h2><div id="nx40NewMembers"></div></section>
        <section class="nx40-section" id="nx40TopicsSection"><header class="nx40-toolbar"><h2>Discussões <em>recentes</em></h2><span class="nx40-live-dot" aria-hidden="true"></span></header><div class="nx40-topics" id="nx40Topics"></div></section>
        <section class="nx40-section" id="nx40FeedSection"><header class="nx40-toolbar"><h2 id="nx40FeedTitle">Agora na <em>comunidade</em></h2><span class="nx40-live-dot" aria-hidden="true"></span></header>
          <div class="nx40-feed" id="nx40Feed"><p class="nx40-empty">Carregando atividade...</p></div>
          <button type="button" class="nx40-load-more" data-nx40-more-activity hidden>Carregar mais atividade <span data-icon="arrow" aria-hidden="true"></span></button>
        </section>
        <section class="nx40-section" id="nx40ImpressionsSection" hidden><h2>Últimas <em>impressões</em></h2><div id="nx40Impressions"></div><button type="button" class="nx40-load-more" data-nx40-more-impressions hidden>Carregar mais impressões <span data-icon="arrow" aria-hidden="true"></span></button></section>
        <section class="nx40-section"><h2>Obras mais movimentadas</h2><div class="nx40-trending" id="nx40Trending"></div></section>
      </aside></div></main>`;
    document.title='Comunidade | AniNexus';document.body.classList.add('nx40-community-active');document.querySelectorAll('[data-nav]').forEach(a=>a.classList.remove('active'));bind();mounted=true;requestAnimationFrame(()=>{if(!owns())return;document.documentElement.classList.add('nx40-community-ready');document.documentElement.classList.remove('nx40-community-boot')});
  }
  function render(){
    if(!mounted||!owns()||!app.querySelector('#nx40Feed'))return;
    const list=items.filter(x=>x.kind==='state'),impressions=items.filter(x=>x.kind==='impression');
    app.querySelector('#nx40Feed').innerHTML=list.length?list.slice(0,visibleActivity).map(stateCard).join(''):empty('Nenhuma atividade por aqui ainda.');
    app.querySelector('[data-nx40-more-activity]').hidden=list.length<=visibleActivity;
    app.querySelector('#nx40ImpressionsSection').hidden=!impressions.length;
    app.querySelector('#nx40Impressions').innerHTML=impressions.slice(0,visibleImpressions).map(impressionCard).join('');
    app.querySelector('[data-nx40-more-impressions]').hidden=impressions.length<=visibleImpressions;
    app.querySelector('#nx40Topics').innerHTML=topics.length?topics.map(topicCard).join(''):empty('As primeiras discussões vão aparecer aqui.');
    app.querySelector('#nx40Trending').innerHTML=trends().map((x,i)=>miniMedia({...x,mediaType:x.mediaType||'ANIME'},i)).join('')||empty('Ainda não há tendências.');
    bindCards();window.injectIcons?.(app);
  }
  function bindCards(){app.querySelectorAll('[data-open-anime]').forEach(el=>{if(el.dataset.nx40Bound)return;el.dataset.nx40Bound='1';el.onclick=e=>{if(e.target.closest('button,a,input,textarea'))return;const id=Number(el.dataset.openAnime),name=el.dataset.title||'anime';if(id)go(`/${el.dataset.mediaType==='MANGA'?'manga':'anime'}/${slug(name)}-${id}`)}});app.querySelectorAll('[data-nx40-trend]').forEach(el=>{if(el.dataset.nx40Bound)return;el.dataset.nx40Bound='1';el.onclick=()=>go(`/anime/${slug(el.dataset.title)}-${Number(el.dataset.nx40Trend)}`)});app.querySelectorAll('[data-nx40-spoiler]').forEach(button=>button.onclick=()=>{button.classList.toggle('revealed');button.setAttribute('aria-label',button.classList.contains('revealed')?'Ocultar trecho com spoiler':'Revelar trecho com spoiler')})}
  function bind(){
    for(const [selector,kind] of [['[data-nx40-more-activity]','state'],['[data-nx40-more-impressions]','impression']])app.querySelector(selector).onclick=()=>{
      const previous=kind==='state'?visibleActivity:visibleImpressions;
      if(kind==='state')visibleActivity+=6;else visibleImpressions+=3;
      render();
      const root=app.querySelector(kind==='state'?'#nx40Feed':'#nx40Impressions');
      root.children[previous]?.querySelector('a')?.focus({preventScroll:true});
    };
    app.querySelectorAll('[data-nx40-days]').forEach(b=>b.onclick=()=>{memberDays=Number(b.dataset.nx40Days);renderMembers()});
    app.querySelector('[data-nx40-guide]').onclick=e=>{const button=e.currentTarget,expanded=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(expanded));app.querySelector('#nx40GuideLinks').hidden=!expanded};
  }
  async function mount(){
    if(!owns()){++loadEpoch;++overviewEpoch;mounted=false;document.body.classList.remove('nx40-community-active','nx40-scrolled','nx40-scroll-down');document.documentElement.classList.remove('nx40-community-boot','nx40-community-ready');return}
    if(!app.querySelector('.nx40-community')){mounted=false;visibleActivity=6;visibleImpressions=3;lastScroll=scrollY;shell();renderOverview();loadOverview()}
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
