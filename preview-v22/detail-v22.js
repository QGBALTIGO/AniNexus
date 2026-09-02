'use strict';
(() => {
  const root=document.querySelector('#app');
  if(!root)return;
  const API='https://graphql.anilist.co';
  const JIKAN='https://api.jikan.moe/v4';
  const THEME_API='https://api.animethemes.moe';
  const IS_PAGES=location.hostname.endsWith('github.io');
  const BASE=IS_PAGES?'/AniNexus':'';
  const CACHE_TTL=20*60*1000;
  const THEMES_CACHE_TTL=6*60*60*1000;
  const detailPromises=new Map();
  const themePromises=new Map();
  let claiming=false;
  let lastId=0;
  let observerRaf=0;

  const SVG={
    back:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>',
    plus:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    heart:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 8.8c0 5-8.5 10-8.5 10s-8.5-5-8.5-10A4.6 4.6 0 0 1 12 6.4a4.6 4.6 0 0 1 8.5 2.4Z"/></svg>',
    star:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.5 6.1.9-4.4 4.3 1 6.1-5.5-2.9-5.5 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/></svg>',
    play:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 9 6-9 6V6Z"/></svg>',
    clock:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>',
    calendar:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.2"/><path d="M7.5 3v4M16.5 3v4M3.5 9.2h17"/></svg>',
    info:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 10.5v6M12 7.2h.01"/></svg>',
    external:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 5h6v6M19 5l-8 8"/><path d="M11 7H5v12h12v-6"/></svg>',
    share:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.5-4.4M8.2 13.2l7.5 4.4"/></svg>'
  };

  const GENRE={Action:'Ação',Adventure:'Aventura',Comedy:'Comédia',Drama:'Drama',Fantasy:'Fantasia',Horror:'Terror',Mystery:'Mistério',Romance:'Romance','Sci-Fi':'Ficção Científica','Slice of Life':'Cotidiano',Sports:'Esportes',Supernatural:'Sobrenatural',Thriller:'Suspense',Psychological:'Psicológico',Music:'Música',Mecha:'Mecha',Ecchi:'Ecchi'};
  const FORMAT={TV:'Série',TV_SHORT:'Série curta',MOVIE:'Filme',OVA:'OVA',ONA:'ONA',SPECIAL:'Especial',MUSIC:'Música'};
  const STATUS={RELEASING:'Em exibição',FINISHED:'Finalizado',NOT_YET_RELEASED:'Ainda não lançado',HIATUS:'Em hiato',CANCELLED:'Cancelado'};
  const SOURCE={MANGA:'Mangá',LIGHT_NOVEL:'Light novel',ORIGINAL:'Original',NOVEL:'Novel',GAME:'Jogo',VISUAL_NOVEL:'Visual novel',WEB_NOVEL:'Web novel',OTHER:'Outra mídia',VIDEO_GAME:'Videogame',MULTIMEDIA_PROJECT:'Projeto multimídia',PICTURE_BOOK:'Livro ilustrado'};
  const SEASON={WINTER:'Inverno',SPRING:'Primavera',SUMMER:'Verão',FALL:'Outono'};
  const COUNTRY={JP:'Japão',KR:'Coreia do Sul',CN:'China',TW:'Taiwan',US:'Estados Unidos',GB:'Reino Unido',FR:'França'};
  const REL={ADAPTATION:'Adaptação',PREQUEL:'Prequela',SEQUEL:'Sequência',PARENT:'Obra principal',SIDE_STORY:'História paralela',CHARACTER:'Personagem relacionado',SUMMARY:'Resumo',ALTERNATIVE:'Alternativa',SPIN_OFF:'Spin-off',OTHER:'Relacionado',SOURCE:'Fonte',COMPILATION:'Compilação',CONTAINS:'Contém'};

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const strip=v=>{const d=document.createElement('div');d.innerHTML=String(v||'');return(d.textContent||'').replace(/\s+/g,' ').trim()};
  const title=m=>m?.title?.english||m?.title?.userPreferred||m?.title?.romaji||m?.title?.native||m?.jikan?.title_english||m?.jikan?.title||'Anime';
  const cover=m=>m?.coverImage?.extraLarge||m?.coverImage?.large||m?.jikan?.images?.jpg?.large_image_url||m?.jikan?.images?.jpg?.image_url||'';
  const banner=m=>m?.bannerImage||m?.jikan?.images?.jpg?.large_image_url||cover(m);
  const compact=n=>n?new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(Number(n)): '—';
  const score=m=>m?.metricsSource==='aninexus'&&m?.averageScore?String((m.averageScore/10).toFixed(1)).replace('.0',''):'—';

  function routePath(){
    try{
      const u=new URL(location.href),p=u.searchParams.get('p');
      if(p)return p.split('?')[0].replace(/\/+$/,'')||'/';
      let x=u.pathname;if(IS_PAGES)x=x.replace(/^\/AniNexus/,'')||'/';return x.replace(/\/+$/,'')||'/';
    }catch{return '/'}
  }
  function animeId(){const m=routePath().match(/^\/anime\/.+-(\d+)$/);return m?Number(m[1]):0}
  function isOwned(){const id=animeId();return !!id&&root.firstElementChild?.classList.contains('nx22-detail')&&Number(root.dataset.nx22DetailId)===id}
  function activate(){
    document.body.classList.add('nx22-detail-active');
    document.body.classList.remove('nx22-news-active','nx-season-active','season-v7-active','season-v8-active');
    document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav==='anime'));
  }
  function deactivate(){document.body.classList.remove('nx22-detail-active');delete root.dataset.nx22DetailId}

  function dateParts(d){if(!d)return null;const y=Number(d.year),m=Number(d.month),day=Number(d.day);if(!y)return null;return new Date(Date.UTC(y,(m||1)-1,day||1,12))}
  function fmtDate(d,fallback='—'){const x=dateParts(d);return x?new Intl.DateTimeFormat('pt-BR',{day:d?.day?'2-digit':undefined,month:d?.month?'long':undefined,year:'numeric',timeZone:'UTC'}).format(x):fallback}
  function fmtDateIso(v,fallback='—'){if(!v)return fallback;const x=new Date(v);return Number.isNaN(x.getTime())?fallback:new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'long',year:'numeric'}).format(x)}
  function fmtUntil(ts){if(!ts)return'';const ms=Number(ts)*1000-Date.now();if(ms<=0)return'Em instantes';const d=Math.floor(ms/86400000),h=Math.floor(ms%86400000/3600000),m=Math.floor(ms%3600000/60000);return d?`${d}d ${h}h`:`${h}h ${m}min`}
  function episodeWord(n){return Number(n)===1?'episódio':'episódios'}
  function ratingPT(v){const s=String(v||'');if(!s)return'—';if(/^G\b/.test(s))return'Livre';if(/^PG-13/.test(s))return'PG-13 · 13 anos ou mais';if(/^R\+/.test(s))return'R+ · nudez leve';if(/^R\b/.test(s))return'R · 17 anos ou mais';if(/^PG\b/.test(s))return'PG · crianças';return s}
  function broadcastPT(b){if(!b)return'—';const days={Mondays:'Segundas',Tuesdays:'Terças',Wednesdays:'Quartas',Thursdays:'Quintas',Fridays:'Sextas',Saturdays:'Sábados',Sundays:'Domingos'};if(b.day||b.time)return`${days[b.day]||b.day||'Dia não informado'}${b.time?` às ${b.time}`:''}${b.timezone?` (${b.timezone})`:''}`;return b.string||'—'}
  function sourcePT(v){return SOURCE[v]||String(v||'—').replaceAll('_',' ').toLowerCase().replace(/^./,c=>c.toUpperCase())}
  function countryPT(v){return COUNTRY[v]||v||'—'}

  async function gql(query,variables,signal){
    const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({query,variables}),signal});
    if(!r.ok)throw new Error(`AniList ${r.status}`);const j=await r.json();if(j.errors?.length)throw new Error(j.errors[0]?.message||'Falha AniList');return j.data;
  }
  async function jikan(id,signal){
    if(!id)return null;
    try{const r=await fetch(`${JIKAN}/anime/${id}/full`,{signal,headers:{accept:'application/json'}});if(!r.ok)return null;const x=(await r.json())?.data;if(!x)return null;const names=list=>(list||[]).map(item=>({name:String(item?.name||'').slice(0,180)})).filter(item=>item.name);return{title_english:x.title_english||'',title:x.title||'',images:x.images||null,synopsis:x.synopsis||'',trailer:{youtube_id:x.trailer?.youtube_id||''},streaming:(x.streaming||[]).map(item=>({name:String(item?.name||'').slice(0,80),url:/^https:\/\//i.test(item?.url||'')?item.url:''})).filter(item=>item.url),themes:(x.themes||[]).map(item=>({name:String(item?.name||'').slice(0,120)})).filter(item=>item.name),aired:{from:x.aired?.from||null,to:x.aired?.to||null},producers:names(x.producers),licensors:names(x.licensors),studios:names(x.studios),status:x.status||'',type:x.type||'',episodes:x.episodes||null,duration:x.duration||'',broadcast:x.broadcast||null,season:x.season||'',year:x.year||null,rating:x.rating||''}}catch(e){if(e?.name==='AbortError')throw e;return null}
  }

  const DETAIL_FIELDS=`id idMal siteUrl title{romaji english native userPreferred} synonyms coverImage{extraLarge large color} bannerImage description genres tags{name rank isMediaSpoiler} episodes duration format status season seasonYear countryOfOrigin source hashtag isAdult startDate{year month day} endDate{year month day} studios(isMain:true){nodes{id name}} nextAiringEpisode{airingAt episode timeUntilAiring} trailer{id site thumbnail} externalLinks{site url type icon color}`;
  async function loadAni(id,signal){
    const q=`query($id:Int){Media(id:$id,type:ANIME){${DETAIL_FIELDS} characters(perPage:18,sort:[ROLE,RELEVANCE]){edges{role voiceActors(language:JAPANESE,sort:[RELEVANCE]){id name{full} image{large}} node{id name{full native} image{large medium}}}} staff(perPage:16,sort:[RELEVANCE]){edges{role node{id name{full native} image{large medium}}}} relations{edges{relationType node{${DETAIL_FIELDS}}}}}}`;
    const d=await gql(q,{id:Number(id)},signal);if(!d?.Media)throw new Error('Anime não encontrado');return d.Media;
  }

  function normalizedMedia(m){
    if(!m||!Number(m.id))return null;
    const internal=m.metricsSource==='aninexus';
    const tagDetails=Array.isArray(m.tagDetails)&&m.tagDetails.length?m.tagDetails:(m.tags||[]).map(name=>({name,rank:60,isMediaSpoiler:false}));
    return{
      id:Number(m.id),idMal:m.idMal||null,mediaType:String(m.mediaType||'ANIME').toUpperCase(),siteUrl:`https://anilist.co/anime/${Number(m.id)}`,
      title:{english:m.title||m.titleRomaji||'',romaji:m.titleRomaji||m.title||'',native:m.titleNative||'',userPreferred:m.title||m.titleRomaji||''},
      synonyms:m.synonyms||[],coverImage:{extraLarge:m.cover||'',large:m.cover||'',color:m.coverColor||''},bannerImage:m.banner||'',description:m.description||'',
      genres:m.genres||[],tags:tagDetails,averageScore:internal?(Number(m.score||0)*10||null):null,meanScore:internal?(Number(m.meanScore||0)*10||null):null,popularity:internal?Number(m.popularity||0):0,favourites:internal?Number(m.favourites||0):0,ratingCount:internal?Number(m.ratingCount||0):0,listCount:internal?Number(m.listCount||0):0,metricsSource:internal?'aninexus':'',
      episodes:m.episodes||null,duration:m.duration||null,format:m.format||null,status:m.status||null,season:m.season||null,seasonYear:m.seasonYear||null,
      countryOfOrigin:m.country||null,source:m.source||null,startDate:m.startDate||null,endDate:m.endDate||null,
      studios:{nodes:m.studios||[]},nextAiringEpisode:m.nextAiringEpisode||null,trailer:m.trailer||null,
      externalLinks:(m.streaming||[]).map(x=>({site:x.site,url:x.url,type:x.type||'STREAMING',icon:x.icon||'',color:x.color||''}))
    };
  }
  function normalizeServerAnime(payload){
    if(!payload||String(payload.mediaType||'ANIME').toUpperCase()!=='ANIME')throw new Error('Mídia inválida');
    const base=normalizedMedia(payload);if(!base)throw new Error('Anime não encontrado');
    base.characters={edges:(payload.characters||[]).map(item=>({role:item.role||'SUPPORTING',voiceActors:[],node:{id:item.id,name:{full:item.name||'',native:item.native||''},image:{large:item.image||'',medium:item.image||''}}}))};
    base.staff={edges:(payload.staff||[]).map(item=>({role:item.role||'Equipe',node:{id:item.id,name:{full:item.name||'',native:item.native||''},image:{large:item.image||'',medium:item.image||''}}}))};
    base.relations={edges:(payload.relations||[]).filter(item=>String(item.media?.mediaType||'ANIME').toUpperCase()==='ANIME').map(item=>({relationType:item.relationType||'OTHER',node:normalizedMedia(item.media)})).filter(item=>item.node)};
    base.recommendations={nodes:(payload.recommendations||[]).map(item=>({rating:item.rating||0,mediaRecommendation:normalizedMedia(item.media)})).filter(item=>item.mediaRecommendation)};
    return base;
  }
  async function loadServerAnime(id,signal){
    const response=await fetch(`/api/anime/${Number(id)}`,{signal,headers:{accept:'application/json'}});
    if(!response.ok)throw new Error(`Catálogo ${response.status}`);
    return normalizeServerAnime(await response.json());
  }
  async function timedLoad(loader,timeout){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
    try{return await loader(controller.signal)}finally{clearTimeout(timer)}
  }

  function cacheRead(id){try{const x=JSON.parse(sessionStorage.getItem(`nx22:detail:${id}`)||'null');if(x&&Date.now()-x.t<CACHE_TTL&&x.data?.id)return x.data}catch{}return null}
  function cacheWrite(id,data){try{sessionStorage.setItem(`nx22:detail:${id}`,JSON.stringify({t:Date.now(),data}))}catch{}}
  async function loadDetail(id){
    const cached=cacheRead(id);if(cached)return cached;
    if(detailPromises.has(id))return detailPromises.get(id);
    const p=(async()=>{
      let a=null;
      if(!IS_PAGES){try{a=await timedLoad(signal=>loadServerAnime(id,signal),4500)}catch{}}
      if(!a)a=await timedLoad(signal=>loadAni(id,signal),12000);
      const out={...a,jikan:null};cacheWrite(id,out);
      if(a.idMal){
        timedLoad(signal=>jikan(a.idMal,signal),3500).then(extra=>{if(extra)cacheWrite(id,{...out,jikan:extra})}).catch(()=>{});
      }
      return out;
    })().finally(()=>detailPromises.delete(id));
    detailPromises.set(id,p);return p;
  }

  function safeThemeVideo(value){try{const url=new URL(String(value||''));return url.protocol==='https:'&&url.hostname==='v.animethemes.moe'?url.href:''}catch{return''}}
  function themeResolution(value){const match=String(value?.resolution||'').match(/\d{3,4}/);return match?Number(match[0]):0}
  function themeCacheRead(id){try{const saved=JSON.parse(sessionStorage.getItem(`nx22:themes:${id}`)||'null');if(saved&&Date.now()-saved.t<THEMES_CACHE_TTL&&Array.isArray(saved.data?.items))return saved.data}catch{}return null}
  function themeCacheWrite(id,data){try{sessionStorage.setItem(`nx22:themes:${id}`,JSON.stringify({t:Date.now(),data}))}catch{}}
  function normalizeThemes(anime){
    const items=(anime?.animethemes||[]).map(theme=>{
      const candidates=(theme?.animethemeentries||[]).filter(entry=>entry?.nsfw!==true&&entry?.spoiler!==true).flatMap(entry=>(entry?.videos||[]).map(video=>({entry,video,url:safeThemeVideo(video?.link)}))).filter(item=>item.url);
      candidates.sort((a,b)=>{const rank=item=>(item.video?.nc===true?1e7:0)+(item.video?.subbed===false?1e6:0)+(item.video?.lyrics===false?1e5:0)+themeResolution(item.video);return rank(b)-rank(a)});
      const best=candidates[0];if(!best)return null;const kind=String(theme?.type||'').toUpperCase(),sequence=Math.max(0,Number(theme?.sequence||0));
      return{kind,sequence,title:String(theme?.song?.title||`${kind==='ED'?'Encerramento':'Abertura'} ${sequence||''}`).trim().slice(0,300),artists:(theme?.song?.artists||[]).map(artist=>String(artist?.name||'').trim()).filter(Boolean).join(', ').slice(0,500)||'Artista não informado',group:String(theme?.group?.name||'').slice(0,200),episodes:String(best.entry?.episodes||'').slice(0,120),url:best.url,mime:/^video\/[a-z0-9.+-]+$/i.test(String(best.video?.mimetype||''))?best.video.mimetype:'video/webm',resolution:themeResolution(best.video),creditless:best.video?.nc===true};
    }).filter(Boolean).sort((a,b)=>{const order=item=>item.kind==='OP'?0:item.kind==='ED'?1:2;return order(a)-order(b)||a.sequence-b.sequence||a.title.localeCompare(b.title,'pt-BR')}).slice(0,24);
    return{items};
  }
  async function fetchThemes(id){
    const cached=themeCacheRead(id);if(cached)return cached;if(themePromises.has(id))return themePromises.get(id);
    const request=(async()=>{
      if(!IS_PAGES){try{const response=await fetch(`/api/anime/${id}/themes`,{headers:{accept:'application/json'}});if(response.ok){const remote=await response.json(),data={items:(remote.items||[]).map(item=>({...item,url:safeThemeVideo(item.url)})).filter(item=>item.url).slice(0,24)};themeCacheWrite(id,data);return data}}catch{}}
      const url=new URL(`${THEME_API}/anime`);url.searchParams.set('filter[has]','resources');url.searchParams.set('filter[site]','Anilist');url.searchParams.set('filter[external_id]',String(id));url.searchParams.set('include','animethemes.animethemeentries.videos,animethemes.song.artists');url.searchParams.set('page[size]','1');const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
      try{const response=await fetch(url,{headers:{accept:'application/json'},credentials:'omit',signal:controller.signal});if(!response.ok)throw new Error('Não foi possível consultar o acervo.');const payload=await response.json(),data=normalizeThemes(payload?.anime?.[0]);themeCacheWrite(id,data);return data}catch(error){if(error?.name==='AbortError')throw new Error('A consulta demorou mais que o esperado.');throw error}finally{clearTimeout(timer)}
    })().finally(()=>themePromises.delete(id));themePromises.set(id,request);return request;
  }
  function themeCard(item,m){const type=item.kind==='ED'?'Encerramento':item.kind==='OP'?'Abertura':'Tema',code=`${item.kind||'TEMA'}${item.sequence?` ${item.sequence}`:''}`,meta=[item.resolution?`${item.resolution}p`:'',item.creditless?'Sem créditos':'',item.episodes?`Episódios ${item.episodes}`:''].filter(Boolean);return `<article class="nx22-theme-card"><div class="nx22-theme-media"><video playsinline preload="none" controlslist="nodownload" poster="${esc(cover(m))}" data-theme-src="${esc(item.url)}" data-theme-mime="${esc(item.mime)}" aria-label="${esc(`${type}: ${item.title}`)}"></video><button class="nx22-theme-play" type="button" data-nx22-theme-play aria-label="Reproduzir ${esc(item.title)}">${SVG.play}<span>Reproduzir</span></button><span class="nx22-theme-code">${esc(code)}</span><div class="nx22-theme-error" role="status">Este vídeo não pôde ser carregado.</div></div><div class="nx22-theme-copy"><small>${esc(type)}</small><h3>${esc(item.title)}</h3><p>${esc(item.artists)}</p>${item.group?`<em>${esc(item.group)}</em>`:''}<div>${meta.map(value=>`<span>${esc(value)}</span>`).join('')}</div></div></article>`}
  function bindThemePlayers(scope){const players=[...scope.querySelectorAll('video')],release=video=>{if(!video)return;try{video.pause()}catch{}video.removeAttribute('src');video.load();video.controls=false;video.closest('.nx22-theme-card')?.classList.remove('is-loaded')};scope.querySelectorAll('[data-nx22-theme-play]').forEach(button=>button.onclick=async()=>{const card=button.closest('.nx22-theme-card'),video=card?.querySelector('video');if(!video)return;players.forEach(other=>{if(other!==video&&other.hasAttribute('src'))release(other)});if(!video.hasAttribute('src')){video.preload='metadata';video.src=video.dataset.themeSrc||'';video.controls=true;card.classList.add('is-loaded');video.load()}try{await video.play()}catch{video.controls=true}});players.forEach(video=>{video.onplay=()=>players.forEach(other=>{if(other!==video&&other.hasAttribute('src'))release(other)});video.onerror=()=>video.closest('.nx22-theme-card')?.classList.add('is-error')})}
  async function hydrateThemes(m){const initial=root.querySelector('#nx22Themes');if(!initial||initial.dataset.state==='loading')return;initial.dataset.state='loading';initial.setAttribute('aria-busy','true');try{const data=await fetchThemes(m.id);if(animeId()!==m.id)return;const host=root.querySelector('#nx22Themes');if(!host)return;host.dataset.state='ready';host.removeAttribute('aria-busy');host.innerHTML=data.items.length?`<div class="nx22-theme-grid">${data.items.map(item=>themeCard(item,m)).join('')}</div>`:'<div class="nx22-themes-empty"><strong>Nenhuma abertura ou encerramento disponível</strong><p>Este título ainda não possui vídeos seguros vinculados ao acervo.</p></div>';bindThemePlayers(host)}catch{if(animeId()!==m.id)return;const host=root.querySelector('#nx22Themes');if(!host)return;host.dataset.state='error';host.removeAttribute('aria-busy');host.innerHTML='<div class="nx22-themes-empty is-error"><strong>O acervo está indisponível agora</strong><p>Não foi possível carregar este acervo agora. Tente novamente em instantes.</p><button type="button" data-nx22-themes-retry>Tentar novamente</button></div>';host.querySelector('[data-nx22-themes-retry]')?.addEventListener('click',()=>{host.dataset.state='';hydrateThemes(m)})}}

  function hash(s){let h=2166136261;for(const c of String(s||'')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0).toString(36)}
  function looksPortuguese(s){const t=` ${String(s||'').toLowerCase()} `;return /\b(uma|um|que|para|com|seu|sua|quando|após|anime|mundo|história|vida|jovem|escola|poder)\b/.test(t)&&/[áàâãéêíóôõúç]/i.test(t)}
  function splitText(s,max=430){const sentences=String(s||'').match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[s];const out=[];let cur='';for(const x of sentences){if((cur+' '+x).trim().length>max&&cur){out.push(cur.trim());cur=x}else cur=(cur+' '+x).trim()}if(cur)out.push(cur);return out.slice(0,5)}
  async function translateChunkMyMemory(text){const u=`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|pt-BR`;const r=await fetch(u,{headers:{accept:'application/json'}});if(!r.ok)throw new Error('translate');const j=await r.json();const x=j?.responseData?.translatedText;if(!x||/MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(x))throw new Error('translate');return x}
  async function translateChunkGoogle(text){const u=`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pt&dt=t&q=${encodeURIComponent(text)}`;const r=await fetch(u,{headers:{accept:'application/json'}});if(!r.ok)throw new Error('translate');const j=await r.json();const x=(j?.[0]||[]).map(v=>v?.[0]||'').join('');if(!x)throw new Error('translate');return x}
  async function synopsisPT(m){
    const raw=strip(m.description)||String(m.jikan?.synopsis||'').trim();
    if(!raw)return fallbackSynopsis(m);
    if(looksPortuguese(raw))return raw;
    const key=`nx22:pt:${hash(raw)}`;try{const c=localStorage.getItem(key);if(c)return c}catch{}
    const chunks=splitText(raw);
    for(const engine of [translateChunkMyMemory,translateChunkGoogle]){
      try{const translated=[];for(const ch of chunks)translated.push(await engine(ch));const result=translated.join(' ').replace(/\s+/g,' ').trim();if(result){try{localStorage.setItem(key,result)}catch{}return result}}catch{}
    }
    return fallbackSynopsis(m);
  }
  function fallbackSynopsis(m){const gs=(m.genres||[]).slice(0,3).map(g=>GENRE[g]||g).join(', ');const src=sourcePT(m.source);const st=STATUS[m.status]||'anime';return `Sinopse em português indisponível no momento. ${title(m)} é ${m.format==='MOVIE'?'um filme':'um anime'}${gs?` de ${gs}`:''}, baseado em ${src.toLowerCase()}, atualmente ${st.toLowerCase()}.`}

  function trailerId(m){if(m?.trailer?.id&&String(m.trailer.site||'').toLowerCase()==='youtube')return String(m.trailer.id);const u=String(m?.jikan?.trailer?.youtube_id||'');return u||''}
  function uniqueLinks(m){
    const out=[];const seen=new Set();
    for(const x of m.externalLinks||[]){if(String(x.type||'').toUpperCase()!=='STREAMING'||!x.url)continue;const k=String(x.site||x.url).toLowerCase();if(seen.has(k))continue;seen.add(k);out.push({site:x.site||'Streaming',url:x.url,icon:x.icon||''})}
    for(const x of m.jikan?.streaming||[]){if(!x?.url)continue;const k=String(x.name||x.url).toLowerCase();if(seen.has(k))continue;seen.add(k);out.push({site:x.name||'Streaming',url:x.url,icon:''})}
    return out;
  }
  function tags(m){const xs=(m.tags||[]).filter(t=>!t.isMediaSpoiler&&(t.rank||0)>=55).slice(0,8).map(t=>t.name);const themes=(m.jikan?.themes||[]).map(x=>x.name);return [...new Set([...xs,...themes])].slice(0,10)}
  function altTitles(m){const rows=[];if(m.title?.romaji)rows.push(['Romaji',m.title.romaji]);if(m.title?.native)rows.push(['Original',m.title.native]);if(m.title?.english&&m.title.english!==title(m))rows.push(['Inglês',m.title.english]);for(const s of (m.synonyms||[]).slice(0,3))if(s)rows.push(['Alternativo',s]);return rows}
  function studios(m){return(m.studios?.nodes||[]).map(x=>x.name).filter(Boolean)}
  function names(arr){return(arr||[]).map(x=>x?.name).filter(Boolean)}
  function airedEnd(m){if(m.endDate?.year)return fmtDate(m.endDate);if(m.jikan?.aired?.to)return fmtDateIso(m.jikan.aired.to);return m.status==='RELEASING'?'Em exibição':m.status==='NOT_YET_RELEASED'?'Ainda não terminou':'—'}
  function airedStart(m){if(m.startDate?.year)return fmtDate(m.startDate);if(m.jikan?.aired?.from)return fmtDateIso(m.jikan.aired.from);return'—'}

  function relationCard(edge){const m=edge?.node;if(!m)return'';return `<article class="nx22-related" tabindex="0" data-nx22-open="${m.id}" data-nx-media="${m.id}"><div class="nx22-related-cover">${cover(m)?`<img loading="lazy" src="${esc(cover(m))}" alt="${esc(title(m))}">`:''}</div><div><small>${esc(REL[edge.relationType]||String(edge.relationType||'Relacionado').replaceAll('_',' '))}</small><strong>${esc(title(m))}</strong><span>${esc(FORMAT[m.format]||m.format||'Anime')}${m.seasonYear?` · ${m.seasonYear}`:''}</span></div></article>`}
  function recommendationCard(node){const m=node?.mediaRecommendation;if(!m)return'';return `<article class="nx22-rec" tabindex="0" data-nx22-open="${m.id}" data-nx-media="${m.id}"><div>${cover(m)?`<img loading="lazy" src="${esc(cover(m))}" alt="${esc(title(m))}">`:''}${m.metricsSource==='aninexus'&&m.averageScore?`<span>${SVG.star}${(m.averageScore/10).toFixed(1)}</span>`:''}</div><strong>${esc(title(m))}</strong><small>${esc((m.genres||[]).slice(0,2).map(g=>GENRE[g]||g).join(' · '))}</small></article>`}
  function personCard(e){const n=e?.node;if(!n)return'';const va=e.voiceActors?.[0];return `<article class="nx22-person">${n.image?.large?`<img loading="lazy" src="${esc(n.image.large)}" alt="${esc(n.name?.full||'')}">`:''}<strong>${esc(n.name?.full||'')}</strong><span>${e.role==='MAIN'?'Principal':'Coadjuvante'}</span>${va?`<small>Voz: ${esc(va.name?.full||'')}</small>`:''}</article>`}
  function staffCard(e){const n=e?.node;if(!n)return'';return `<article class="nx22-person">${n.image?.large?`<img loading="lazy" src="${esc(n.image.large)}" alt="${esc(n.name?.full||'')}">`:''}<strong>${esc(n.name?.full||'')}</strong><span>${esc(e.role||'Equipe')}</span></article>`}

  function infoRows(m){
    const j=m.jikan||{},prod=names(j.producers).join(', ')||'—',lic=names(j.licensors).join(', ')||'—',std=studios(m).join(', ')||names(j.studios).join(', ')||'—';
    const rows=[
      ['Status',STATUS[m.status]||j.status||'—'],['Formato',FORMAT[m.format]||j.type||'—'],['Estreia',airedStart(m)],['Término',airedEnd(m)],
      ['Episódios',m.episodes||j.episodes||'—'],['Duração',m.duration?`${m.duration} min por episódio`:(j.duration||'—')],['Exibição',broadcastPT(j.broadcast)],
      ['Temporada',m.season?`${SEASON[m.season]||m.season} ${m.seasonYear||''}`:(j.season&&j.year?`${j.season} ${j.year}`:'—')],['Origem',sourcePT(m.source)],['País',countryPT(m.countryOfOrigin)],
      ['Classificação',ratingPT(j.rating)],['Estúdio',std],['Produtores',prod],['Licenciadores',lic]
    ];
    return rows.map(([k,v])=>`<div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('')
  }

  function paint(m){
    if(animeId()!==m.id)return;
    activate();lastId=m.id;root.dataset.nx22DetailId=String(m.id);
    const chars=m.characters?.edges||[],staff=m.staff?.edges||[],rels=m.relations?.edges||[],recs=(m.recommendations?.nodes||[]).filter(x=>x.mediaRecommendation),streams=uniqueLinks(m),tid=trailerId(m),ts=tags(m),alts=altTitles(m),j=m.jikan||{};
    const current=window.AniNexusMediaState?.get?.(m.id)||{};
    root.innerHTML=`<article class="nx22-detail" data-nx22-id="${m.id}" data-nx-media="${m.id}">
      <header class="nx22-hero">
        <div class="nx22-hero-bg">${banner(m)?`<img src="${esc(banner(m))}" alt="">`:''}</div><div class="nx22-hero-shade"></div>
        <div class="nx22-shell nx22-hero-content">
          <button type="button" class="nx22-back" data-nx22-back>${SVG.back}<span>Voltar</span></button>
          <div class="nx22-hero-grid">
            <div class="nx22-cover">${cover(m)?`<img src="${esc(cover(m))}" alt="Capa de ${esc(title(m))}">`:''}</div>
            <div class="nx22-headcopy"><span class="nx22-eyebrow">${esc(m.title?.romaji||m.title?.native||'Anime')}</span><h1>${esc(title(m))}</h1>
              <div class="nx22-chips"><span>${esc(STATUS[m.status]||'Anime')}</span><span>${esc(FORMAT[m.format]||m.format||'Anime')}</span>${(m.genres||[]).slice(0,4).map(g=>`<span class="genre">${esc(GENRE[g]||g)}</span>`).join('')}</div>
              <div class="nx22-actions"><button type="button" class="nx22-list" data-list="${m.id}" aria-label="Adicionar à lista">${SVG.plus}<span>${current.status?(window.AniNexusMediaState?.statuses?.[current.status]?.label||'Meu status'):'Adicionar à lista'}</span></button><button type="button" class="nx22-fav" data-fav="${m.id}" aria-label="Favoritar">${SVG.heart}</button><button type="button" class="nx22-share" data-nx22-share>${SVG.share}<span>Compartilhar</span></button></div>
              <div class="nx22-stats"><div><strong>${score(m)}</strong><span>nota AniNexus</span></div><div><strong>${compact(m.listCount)}</strong><span>nas listas</span></div><div><strong>${compact(m.favourites)}</strong><span>favoritos</span></div></div>
            </div>
          </div>
        </div>
      </header>
      <nav class="nx22-tabs" aria-label="Seções do anime"><div class="nx22-shell" role="tablist"><button class="active" role="tab" aria-selected="true" data-nx22-tab="geral">Visão geral</button><button role="tab" aria-selected="false" data-nx22-tab="aberturas">Aberturas & encerramentos</button><button role="tab" aria-selected="false" data-nx22-tab="elenco">Personagens & equipe</button><button role="tab" aria-selected="false" data-nx22-tab="franquia">Franquia</button><button role="tab" aria-selected="false" data-nx22-tab="recomendacoes">Recomendações</button></div></nav>
      <div class="nx22-shell nx22-content" id="nx22Panel"></div>
    </article>`;

    const next=m.nextAiringEpisode?`<section class="nx22-next"><div>${SVG.clock}<span><small>PRÓXIMO EPISÓDIO</small><strong>Episódio ${m.nextAiringEpisode.episode}</strong><em>${esc(fmtUntil(m.nextAiringEpisode.airingAt))}</em></span></div><time>${new Intl.DateTimeFormat('pt-BR',{weekday:'short',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'}).format(new Date(m.nextAiringEpisode.airingAt*1000))}</time></section>`:'';
    const trailer=tid?`<section class="nx22-section"><div class="nx22-section-head"><div><small>VÍDEO</small><h2>Trailer oficial</h2></div><span>Reproduza sem sair do AniNexus</span></div><div class="nx22-video"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(tid)}?rel=0&modestbranding=1" title="Trailer de ${esc(title(m))}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div></section>`:'';
    const watch=streams.length?`<section class="nx22-section"><div class="nx22-section-head"><div><small>STREAMING</small><h2>Onde assistir</h2></div></div><div class="nx22-streams">${streams.map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${s.icon?`<img src="${esc(s.icon)}" alt="">`:SVG.play}<span>${esc(s.site)}</span>${SVG.external}</a>`).join('')}</div></section>`:'';
    const themes=ts.length?`<section class="nx22-section"><div class="nx22-section-head"><div><small>TEMAS</small><h2>Gêneros e temas</h2></div></div><div class="nx22-tags">${[...(m.genres||[]).map(g=>GENRE[g]||g),...ts].filter((x,i,a)=>a.indexOf(x)===i).map(x=>`<span>${esc(x)}</span>`).join('')}</div></section>`:'';
    const altsHtml=alts.length?`<div class="nx22-info-card">${alts.map(([k,v])=>`<div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('')}</div>`:'<div class="nx22-info-card"><div><span>Títulos</span><strong>Sem títulos alternativos</strong></div></div>';
    const general=()=>`<div class="nx22-layout"><main>${next}<section class="nx22-section"><div class="nx22-section-head"><div><small>HISTÓRIA</small><h2>Sinopse</h2></div><span class="nx22-translation-note">Em português</span></div><p class="nx22-synopsis" id="nx22Synopsis">Traduzindo sinopse para português…</p></section>${trailer}${watch}${themes}${chars.length?`<section class="nx22-section"><div class="nx22-section-head"><div><small>ELENCO</small><h2>Personagens principais</h2></div><button type="button" data-nx22-jump="elenco">Ver todos</button></div><div class="nx22-people">${chars.slice(0,10).map(personCard).join('')}</div></section>`:''}</main><aside><section><h3>Ficha técnica</h3><div class="nx22-info-card">${infoRows(m)}</div></section><section><h3>Outros títulos</h3>${altsHtml}</section></aside></div>`;
    const cast=()=>`<section class="nx22-full"><div class="nx22-section-head"><div><small>ELENCO</small><h2>Personagens</h2></div></div><div class="nx22-people nx22-people-full">${chars.map(personCard).join('')||'<p>Nenhum personagem disponível.</p>'}</div>${staff.length?`<div class="nx22-section-head nx22-staff-head"><div><small>PRODUÇÃO</small><h2>Equipe</h2></div></div><div class="nx22-people nx22-people-full">${staff.map(staffCard).join('')}</div>`:''}</section>`;
    const openings=()=>`<section class="nx22-full nx22-themes"><div class="nx22-themes-intro"><div><small>TRILHA DA OBRA</small><h2>Aberturas e encerramentos</h2><p>Reproduza um tema por vez sem sair do AniNexus.</p></div></div><div id="nx22Themes" class="nx22-themes-results" data-state=""><div class="nx22-themes-loading" aria-hidden="true"><i></i><i></i><i></i><span>Buscando os temas disponíveis…</span></div></div></section>`;
    const franchise=()=>`<section class="nx22-full"><div class="nx22-section-head"><div><small>UNIVERSO</small><h2>Franquia e relações</h2></div></div><div class="nx22-related-grid">${rels.map(relationCard).join('')||'<p>Nenhuma relação cadastrada.</p>'}</div></section>`;
    const recommendations=()=>`<section class="nx22-full"><div class="nx22-section-head"><div><small>PARA VER DEPOIS</small><h2>Você também pode gostar</h2></div></div><div class="nx22-rec-grid">${recs.map(recommendationCard).join('')||'<p>Sem recomendações disponíveis.</p>'}</div></section>`;
    const panels={geral:general,aberturas:openings,elenco:cast,franquia:franchise,recomendacoes:recommendations};
    function show(k){const panel=root.querySelector('#nx22Panel');if(!panel)return;root.querySelectorAll('[data-nx22-tab]').forEach(b=>{const active=b.dataset.nx22Tab===k;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active))});panel.innerHTML=(panels[k]||general)();wirePanel(k);}
    function wirePanel(k){
      root.querySelector('[data-nx22-jump="elenco"]')?.addEventListener('click',()=>show('elenco'));
      if(k==='geral')synopsisPT(m).then(text=>{if(animeId()===m.id){const el=root.querySelector('#nx22Synopsis');if(el)el.textContent=text}});
      if(k==='aberturas')hydrateThemes(m);
      root.querySelectorAll('[data-nx22-open]').forEach(el=>el.addEventListener('click',e=>{if(e.target.closest('button,a'))return;openAnime(Number(el.dataset.nx22Open),el.querySelector('strong')?.textContent||'anime')}));
    }
    root.querySelectorAll('[data-nx22-tab]').forEach(b=>b.onclick=()=>show(b.dataset.nx22Tab));
    root.querySelector('[data-nx22-back]')?.addEventListener('click',()=>history.length>1?history.back():openPath('/animes/catalogo'));
    root.querySelector('[data-nx22-share]')?.addEventListener('click',async()=>{const data={title:title(m),text:`${title(m)} no AniNexus`,url:location.href};try{if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(location.href);toast('Link copiado')}}catch{}});
    show('geral');
    window.AniNexusMediaState?.sync?.(m.id);
    document.title=`${title(m)} | AniNexus`;
  }

  function toast(msg){const host=document.querySelector('#toastRoot');if(!host)return;const n=document.createElement('div');n.className='toast';n.textContent=msg;host.append(n);setTimeout(()=>n.remove(),2200)}
  function openPath(path){history.pushState({},'',IS_PAGES?`${BASE}${path}`:path);dispatchEvent(new PopStateEvent('popstate'))}
  function openAnime(id,t='anime'){const s=String(t||'anime').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,80)||'anime';openPath(`/anime/${s}-${id}`);scrollTo({top:0,behavior:'instant'})}

  function skeleton(id){activate();root.dataset.nx22DetailId=String(id);root.innerHTML=`<article class="nx22-detail nx22-loading"><div class="nx22-loading-banner"></div><div class="nx22-shell nx22-loading-body"><div class="nx22-loading-cover"></div><div><i></i><i></i><i></i><p>Carregando informações completas…</p></div></div></article>`}
  function fail(id){if(animeId()!==id)return;activate();root.dataset.nx22DetailId=String(id);root.innerHTML=`<article class="nx22-detail nx22-fail"><div><img src="${BASE}/assets/logo.png" alt=""><h1>Não foi possível carregar este anime</h1><p>O catálogo está temporariamente indisponível. Tente novamente em alguns instantes.</p><button type="button" data-nx22-retry>Tentar novamente</button></div></article>`;root.querySelector('[data-nx22-retry]')?.addEventListener('click',()=>{try{sessionStorage.removeItem(`nx22:detail:${id}`)}catch{};claim(true)})}

  async function render(id,force=false){
    if(!id)return;
    if(!force&&isOwned()&&lastId===id)return;
    const cached=cacheRead(id);if(!cached)skeleton(id);else paint(cached);
    try{const m=cached||await loadDetail(id);if(animeId()===id)paint(m)}catch(e){if(animeId()===id&&!cached)fail(id,e)}
  }
  function claim(force=false){
    if(claiming)return;claiming=true;
    try{
      const id=animeId();
      if(!id){if(document.body.classList.contains('nx22-detail-active'))deactivate();lastId=0;return}
      activate();
      if(force||!isOwned()||lastId!==id)render(id,force);
    }finally{claiming=false}
  }

  const mo=new MutationObserver(()=>{if(observerRaf)return;observerRaf=requestAnimationFrame(()=>{observerRaf=0;const id=animeId();if(id&&!isOwned())claim()})});
  mo.observe(root,{childList:true});
  addEventListener('popstate',()=>setTimeout(()=>claim(true),0));
  document.addEventListener('aninexus:routechange',()=>setTimeout(()=>claim(true),0));
  document.addEventListener('click',()=>setTimeout(claim,0),true);
  claim(true);
})();
