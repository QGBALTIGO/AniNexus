'use strict';
(() => {
  const root=document.querySelector('#app');
  if(!root)return;
  const API='https://graphql.anilist.co';
  const JIKAN='https://api.jikan.moe/v4';
  const THEME_API='https://api.animethemes.moe';
  const IS_PAGES=location.hostname.endsWith('github.io');
  const BASE=IS_PAGES?'/AniNexus':'';
  const CACHE_VERSION='44.45.0';
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
    share:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.5-4.4M8.2 13.2l7.5 4.4"/></svg>',
    menu:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14"/></svg>'
  };

  const GENRE={Action:'Ação',Adventure:'Aventura',Comedy:'Comédia',Drama:'Drama',Fantasy:'Fantasia',Horror:'Terror',Mystery:'Mistério',Romance:'Romance','Sci-Fi':'Ficção Científica','Slice of Life':'Cotidiano',Sports:'Esportes',Supernatural:'Sobrenatural',Thriller:'Suspense',Psychological:'Psicológico',Music:'Música',Mecha:'Mecha',Ecchi:'Ecchi','Mahou Shoujo':'Garotas mágicas'};
  const TAG_PT={
    Magic:'Magia',School:'Escola',Swordplay:'Espadas',Psychological:'Psicológico',Superpowers:'Superpoderes','Super Power':'Superpoderes',Historical:'Histórico',Military:'Militar',Vampire:'Vampiros','Time Manipulation':'Viagem no tempo',
    Polyamorous:'Poliamor','Coming of Age':'Amadurecimento','Family Life':'Vida em família',Espionage:'Espionagem',Isekai:'Outro mundo',Reincarnation:'Reencarnação','Male Protagonist':'Protagonista masculino','Female Protagonist':'Protagonista feminina',
    Shounen:'Shounen',Shoujo:'Shoujo',Seinen:'Seinen',Josei:'Josei','Found Family':'Família escolhida','Urban Fantasy':'Fantasia urbana',Tragedy:'Tragédia','Time Skip':'Salto temporal',Demons:'Demônios','Martial Arts':'Artes marciais',Survival:'Sobrevivência',Crime:'Crime',War:'Guerra',Politics:'Política',Revenge:'Vingança',
    'Memory Manipulation':'Manipulação de memória','Body Horror':'Horror corporal',Gore:'Violência gráfica',Nudity:'Nudez','Primarily Adult Cast':'Elenco majoritariamente adulto','Primarily Teen Cast':'Elenco majoritariamente adolescente','Ensemble Cast':'Elenco conjunto','Cute Girls Doing Cute Things':'Garotas fofas fazendo coisas fofas','School Club':'Clube escolar',Delinquents:'Delinquentes',Dungeon:'Masmorra',Cultivation:'Cultivação','Monster Girl':'Garota monstro',
    Heterosexual:'Heterossexual','LGBTQ+ Themes':'Temas LGBTQIA+','Boys\' Love':'Amor entre garotos','Girls\' Love':'Amor entre garotas','Love Triangle':'Triângulo amoroso','Age Gap':'Diferença de idade',Work:'Trabalho',Office:'Escritório','Otaku Culture':'Cultura otaku',Food:'Culinária',Travel:'Viagem',Medicine:'Medicina',Detective:'Detetive',Police:'Polícia',Assassins:'Assassinos',Samurai:'Samurais',Ninja:'Ninjas',Pirates:'Piratas',Robots:'Robôs',Aliens:'Alienígenas',Space:'Espaço',
    Mythology:'Mitologia',Religion:'Religião',Philosophy:'Filosofia',Educational:'Educativo',Environmental:'Ambiental',Pandemic:'Pandemia','Post-Apocalyptic':'Pós-apocalíptico',Dystopian:'Distopia','Virtual World':'Mundo virtual','Video Games':'Videogames','Artificial Intelligence':'Inteligência artificial',Henshin:'Transformação',Kaiju:'Kaiju',Idol:'Ídolos',Band:'Banda',Dancing:'Dança',Acting:'Atuação',Photography:'Fotografia',Drawing:'Desenho',Writing:'Escrita',Athletics:'Atletismo',Football:'Futebol',Basketball:'Basquete',Volleyball:'Vôlei',Boxing:'Boxe',Racing:'Corrida'
  };
  const FORMAT={TV:'Série',TV_SHORT:'Série curta',MOVIE:'Filme',OVA:'OVA',ONA:'ONA',SPECIAL:'Especial',MUSIC:'Música',MANGA:'Mangá',NOVEL:'Light novel',ONE_SHOT:'One-shot'};
  const STATUS={RELEASING:'Em exibição',FINISHED:'Finalizado',NOT_YET_RELEASED:'Ainda não lançado',HIATUS:'Em hiato',CANCELLED:'Cancelado'};
  const SOURCE={MANGA:'Mangá',LIGHT_NOVEL:'Light novel',ORIGINAL:'Original',NOVEL:'Novel',GAME:'Jogo',VISUAL_NOVEL:'Visual novel',WEB_NOVEL:'Web novel',OTHER:'Outra mídia',VIDEO_GAME:'Videogame',MULTIMEDIA_PROJECT:'Projeto multimídia',PICTURE_BOOK:'Livro ilustrado'};
  const SEASON={WINTER:'Inverno',SPRING:'Primavera',SUMMER:'Verão',FALL:'Outono'};
  const COUNTRY={JP:'Japão',KR:'Coreia do Sul',CN:'China',TW:'Taiwan',US:'Estados Unidos',GB:'Reino Unido',FR:'França'};
  const REL={ADAPTATION:'Adaptação',PREQUEL:'Prequela',SEQUEL:'Sequência',PARENT:'Obra principal',SIDE_STORY:'História paralela',CHARACTER:'Personagem relacionado',SUMMARY:'Resumo',ALTERNATIVE:'Alternativa',SPIN_OFF:'Spin-off',OTHER:'Relacionado',SOURCE:'Fonte',COMPILATION:'Compilação',CONTAINS:'Contém'};
  const LEGACY_COMPANY_ROLES=new Set(['estúdio','produção','licenciamento']);
  const STAFF_ROLE_PT={Director:'Direção','Assistant Director':'Assistência de direção','Series Director':'Direção da série','Episode Director':'Direção de episódio','Sound Director':'Direção de som','Art Director':'Direção de arte','Animation Director':'Direção de animação','Chief Animation Director':'Direção-chefe de animação','Director of Photography':'Direção de fotografia','Original Creator':'Criação original','Original Character Design':'Design original de personagens','Character Design':'Design de personagens','Series Composition':'Composição da série',Script:'Roteiro',Screenplay:'Roteiro',Story:'História',Art:'Arte',Author:'Autoria',Music:'Música',Editing:'Edição',Producer:'Produção','Executive Producer':'Produção executiva',Planning:'Planejamento','Key Animation':'Animação-chave','2nd Key Animation':'Segunda animação-chave','Second Key Animation':'Segunda animação-chave','Mechanical Design':'Design mecânico','Color Design':'Design de cores'};

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const strip=v=>{const d=document.createElement('div');d.innerHTML=String(v||'');return(d.textContent||'').replace(/\s+/g,' ').trim()};
  const title=m=>m?.title?.english||m?.title?.userPreferred||m?.title?.romaji||m?.title?.native||m?.jikan?.title_english||m?.jikan?.title||(String(m?.mediaType).toUpperCase()==='MANGA'?'Mangá':'Anime');
  const cover=m=>m?.coverImage?.extraLarge||m?.coverImage?.large||m?.jikan?.images?.jpg?.large_image_url||m?.jikan?.images?.jpg?.image_url||'';
  const banner=m=>m?.bannerImage||'';
  const compact=n=>n?new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(Number(n)): '—';
  const score=m=>m?.metricsSource==='aninexus'&&m?.averageScore?String((m.averageScore/10).toFixed(1)).replace('.0',''):'—';
  const scoreFixed=m=>m?.metricsSource==='aninexus'&&m?.averageScore?(Number(m.averageScore)/10).toFixed(2):'—';
  const tagPT=value=>TAG_PT[String(value||'').trim()]||'';

  function routePath(){
    try{
      const u=new URL(location.href),p=u.searchParams.get('p');
      if(p)return p.split('?')[0].replace(/\/+$/,'')||'/';
      let x=u.pathname;if(IS_PAGES)x=x.replace(/^\/AniNexus/,'')||'/';return x.replace(/\/+$/,'')||'/';
    }catch{return '/'}
  }
  function mediaRoute(){const m=routePath().match(/^\/(anime|manga)\/.+-(\d+)$/);return m?{kind:m[1],type:m[1]==='manga'?'MANGA':'ANIME',id:Number(m[2])}:null}
  function mediaId(){return mediaRoute()?.id||0}
  function isOwned(){const media=mediaRoute();return !!media&&root.firstElementChild?.classList.contains('nx22-detail')&&Number(root.dataset.nx22DetailId)===media.id&&root.dataset.nx22DetailType===media.type}
  function activate(){
    document.body.classList.add('nx22-detail-active');
    document.body.classList.remove('nx22-news-active','nx-season-active','season-v7-active','season-v8-active');
    const type=mediaRoute()?.type||'ANIME';
    root.dataset.nx22DetailType=type;
    document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav===(type==='MANGA'?'manga':'anime')));
  }
  function deactivate(){document.body.classList.remove('nx22-detail-active');delete root.dataset.nx22DetailId;delete root.dataset.nx22DetailType}

  function dateParts(d){if(!d)return null;const y=Number(d.year),m=Number(d.month),day=Number(d.day);if(!y)return null;return new Date(Date.UTC(y,(m||1)-1,day||1,12))}
  function fmtDate(d,fallback='—'){const x=dateParts(d);return x?new Intl.DateTimeFormat('pt-BR',{day:d?.day?'2-digit':undefined,month:d?.month?'long':undefined,year:'numeric',timeZone:'UTC'}).format(x):fallback}
  function fmtDateIso(v,fallback='—'){if(!v)return fallback;const x=new Date(v);return Number.isNaN(x.getTime())?fallback:new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'long',year:'numeric'}).format(x)}
  function fmtUntil(ts){if(!ts)return'';const ms=Number(ts)*1000-Date.now();if(ms<=0)return'Em instantes';const d=Math.floor(ms/86400000),h=Math.floor(ms%86400000/3600000),m=Math.floor(ms%3600000/60000);return d?`${d}d ${h}h`:`${h}h ${m}min`}
  function episodeWord(n){return Number(n)===1?'episódio':'episódios'}
  function ratingPT(v){const s=String(v||'');if(!s)return'—';if(/^G\b/.test(s))return'Livre';if(/^PG-13/.test(s))return'PG-13 · 13 anos ou mais';if(/^R\+/.test(s))return'R+ · nudez leve';if(/^R\b/.test(s))return'R · 17 anos ou mais';if(/^PG\b/.test(s))return'PG · crianças';return s}
  function broadcastPT(b){if(!b)return'—';const days={Mondays:'Segundas',Tuesdays:'Terças',Wednesdays:'Quartas',Thursdays:'Quintas',Fridays:'Sextas',Saturdays:'Sábados',Sundays:'Domingos'};if(b.day||b.time)return`${days[b.day]||b.day||'Dia não informado'}${b.time?` às ${b.time}`:''}${b.timezone?` (${b.timezone})`:''}`;return b.string||'—'}
  function sourcePT(v){return SOURCE[v]||String(v||'—').replaceAll('_',' ').toLowerCase().replace(/^./,c=>c.toUpperCase())}
  function countryPT(v){return COUNTRY[v]||v||'—'}
  function mediaFormatPT(m){
    const type=String(m?.mediaType||m?.type||'ANIME').toUpperCase();
    if(type==='MANGA'&&m?.format==='MANGA'&&m?.countryOfOrigin==='KR')return'Manhwa';
    if(type==='MANGA'&&m?.format==='MANGA'&&m?.countryOfOrigin==='CN')return'Manhua';
    return FORMAT[m?.format]||m?.format||(type==='MANGA'?'Mangá':'Anime');
  }

  async function gql(query,variables,signal){
    const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({query,variables}),signal});
    if(!r.ok)throw new Error(`AniList ${r.status}`);const j=await r.json();if(j.errors?.length)throw new Error(j.errors[0]?.message||'Falha AniList');return j.data;
  }
  async function jikan(id,signal){
    if(!id)return null;
    try{const r=await fetch(`${JIKAN}/anime/${id}/full`,{signal,headers:{accept:'application/json'}});if(!r.ok)return null;const x=(await r.json())?.data;if(!x)return null;const names=list=>(list||[]).map(item=>({name:String(item?.name||'').slice(0,180)})).filter(item=>item.name);return{title_english:x.title_english||'',title:x.title||'',images:x.images||null,synopsis:x.synopsis||'',trailer:{youtube_id:x.trailer?.youtube_id||''},streaming:(x.streaming||[]).map(item=>({name:String(item?.name||'').slice(0,80),url:/^https:\/\//i.test(item?.url||'')?item.url:''})).filter(item=>item.url),themes:(x.themes||[]).map(item=>({name:String(item?.name||'').slice(0,120)})).filter(item=>item.name),aired:{from:x.aired?.from||null,to:x.aired?.to||null},producers:names(x.producers),licensors:names(x.licensors),studios:names(x.studios),status:x.status||'',type:x.type||'',episodes:x.episodes||null,duration:x.duration||'',broadcast:x.broadcast||null,season:x.season||'',year:x.year||null,rating:x.rating||''}}catch(e){if(e?.name==='AbortError')throw e;return null}
  }

  const DETAIL_FIELDS=`id idMal siteUrl type title{romaji english native userPreferred} synonyms coverImage{extraLarge large color} bannerImage description genres tags{name rank isMediaSpoiler} averageScore meanScore popularity favourites stats{scoreDistribution{score amount} statusDistribution{status amount}} episodes chapters volumes duration format status season seasonYear countryOfOrigin source hashtag isAdult startDate{year month day} endDate{year month day} studios(isMain:true){nodes{id name}} nextAiringEpisode{airingAt episode timeUntilAiring} trailer{id site thumbnail} externalLinks{site url type icon color}`;
  async function loadAni(id,type,signal){
    const q=`query($id:Int){Media(id:$id,type:${type}){${DETAIL_FIELDS} characters(perPage:18,sort:[ROLE,RELEVANCE]){edges{role voiceActors(language:JAPANESE,sort:[RELEVANCE]){id name{full} image{large}} node{id name{full native} image{large medium}}}} staff(perPage:16,sort:[RELEVANCE]){edges{role node{id name{full native} image{large medium}}}} relations{edges{relationType node{${DETAIL_FIELDS}}}} recommendations(perPage:12,sort:RATING_DESC){nodes{rating mediaRecommendation{${DETAIL_FIELDS}}}}}}}`;
    const d=await gql(q,{id:Number(id)},signal);if(!d?.Media)throw new Error(type==='MANGA'?'Mangá não encontrado':'Anime não encontrado');
    const ratingCount=(d.Media.stats?.scoreDistribution||[]).reduce((sum,item)=>sum+(Number(item?.amount)||0),0),listCount=(d.Media.stats?.statusDistribution||[]).reduce((sum,item)=>sum+(Number(item?.amount)||0),0);
    Object.assign(d.Media,{mediaType:type,metricsSource:'aninexus',ratingCount,listCount});
    return d.Media;
  }

  function normalizedMedia(m){
    if(!m||!Number(m.id))return null;
    const internal=m.metricsSource==='aninexus';
    const tagDetails=Array.isArray(m.tagDetails)&&m.tagDetails.length?m.tagDetails:(m.tags||[]).map(name=>({name,rank:60,isMediaSpoiler:false}));
    return{
      id:Number(m.id),idMal:m.idMal||null,mediaType:String(m.mediaType||m.type||'ANIME').toUpperCase(),siteUrl:m.siteUrl||`https://anilist.co/${String(m.mediaType||m.type).toUpperCase()==='MANGA'?'manga':'anime'}/${Number(m.id)}`,
      title:{english:m.title||m.titleRomaji||'',romaji:m.titleRomaji||m.title||'',native:m.titleNative||'',userPreferred:m.title||m.titleRomaji||''},
      synonyms:m.synonyms||[],coverImage:{extraLarge:m.cover||'',large:m.cover||'',color:m.coverColor||''},bannerImage:m.banner||'',description:m.description||'',
      genres:m.genres||[],tags:tagDetails,averageScore:internal?(Number(m.score||0)*10||null):null,meanScore:internal?(Number(m.meanScore||0)*10||null):null,popularity:internal?Number(m.popularity||0):0,favourites:internal?Number(m.favourites||0):0,ratingCount:internal?Number(m.ratingCount||0):0,listCount:internal?Number(m.listCount||0):0,metricsSource:internal?'aninexus':'',
      episodes:m.episodes||null,chapters:m.chapters||null,volumes:m.volumes||null,duration:m.duration||null,format:m.format||null,status:m.status||null,season:m.season||null,seasonYear:m.seasonYear||null,
      countryOfOrigin:m.country||null,source:m.source||null,startDate:m.startDate||null,endDate:m.endDate||null,
      studios:{nodes:m.studios||[]},nextAiringEpisode:m.nextAiringEpisode||null,trailer:m.trailer||null,
      externalLinks:(m.streaming||[]).map(x=>({site:x.site,url:x.url,type:x.type||'STREAMING',icon:x.icon||'',color:x.color||''}))
    };
  }
  function normalizeServerMedia(payload,type){
    if(!payload||String(payload.mediaType||type).toUpperCase()!==type)throw new Error('Mídia inválida');
    const base=normalizedMedia({...payload,mediaType:type});if(!base)throw new Error(type==='MANGA'?'Mangá não encontrado':'Anime não encontrado');
    base.characters={edges:(payload.characters||[]).map(item=>({role:item.role||'SUPPORTING',voiceActors:item.voiceActor?[{id:item.voiceActor?.person?.mal_id||item.voiceActor?.mal_id||0,name:{full:item.voiceActor?.person?.name||item.voiceActor?.name||''},image:{large:item.voiceActor?.person?.images?.jpg?.image_url||item.voiceActor?.images?.jpg?.image_url||''}}]:[],node:{id:item.id,name:{full:item.name||'',native:item.native||''},image:{large:item.image||'',medium:item.image||''}}}))};
    base.staff={edges:(payload.staff||[]).filter(item=>item?.name&&!LEGACY_COMPANY_ROLES.has(String(item.role||'').trim().toLowerCase())).map(item=>({role:item.role||'Equipe',node:{id:item.id,name:{full:item.name||'',native:item.native||''},image:{large:item.image||'',medium:item.image||''}}}))};
    base.relations={edges:(payload.relations||[]).map(item=>{const relatedType=String(item.media?.mediaType||item.media?.type||type).toUpperCase()==='MANGA'?'MANGA':'ANIME';return{relationType:item.relationType||'OTHER',node:normalizedMedia({...item.media,mediaType:relatedType})}}).filter(item=>item.node)};
    base.recommendations={nodes:(payload.recommendations||[]).map(item=>({rating:item.rating||0,mediaRecommendation:normalizedMedia(item.media)})).filter(item=>item.mediaRecommendation)};
    return base;
  }
  async function loadServerMedia(id,type,signal){
    const response=await fetch(`/api/${type==='MANGA'?'manga':'anime'}/${Number(id)}`,{signal,headers:{accept:'application/json'}});
    if(!response.ok)throw new Error(`Catálogo ${response.status}`);
    return normalizeServerMedia(await response.json(),type);
  }
  async function timedLoad(loader,timeout){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
    try{return await loader(controller.signal)}finally{clearTimeout(timer)}
  }

  function cacheKey(id,type){return `nx22:detail:${CACHE_VERSION}:${type.toLowerCase()}:${id}`}
  function cacheRead(id,type){try{const x=JSON.parse(sessionStorage.getItem(cacheKey(id,type))||'null');if(x&&Date.now()-x.t<CACHE_TTL&&x.data?.id)return x.data}catch{}return null}
  function cacheWrite(id,type,data){try{sessionStorage.setItem(cacheKey(id,type),JSON.stringify({t:Date.now(),data}))}catch{}}
  async function loadDetail(id,type){
    const cached=cacheRead(id,type);if(cached)return cached;
    const promiseKey=`${type}:${id}`;if(detailPromises.has(promiseKey))return detailPromises.get(promiseKey);
    const p=(async()=>{
      let a=null;
      if(!IS_PAGES){try{a=await timedLoad(signal=>loadServerMedia(id,type,signal),4500)}catch{}}
      if(!a)a=await timedLoad(signal=>loadAni(id,type,signal),12000);
      const out={...a,mediaType:type,jikan:null};cacheWrite(id,type,out);
      if(type==='ANIME'&&a.idMal){
        timedLoad(signal=>jikan(a.idMal,signal),3500).then(extra=>{if(extra)cacheWrite(id,type,{...out,jikan:extra})}).catch(()=>{});
      }
      return out;
    })().finally(()=>detailPromises.delete(promiseKey));
    detailPromises.set(promiseKey,p);return p;
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
  async function hydrateThemes(m){const initial=root.querySelector('#nx22Themes');if(!initial||initial.dataset.state==='loading')return;initial.dataset.state='loading';initial.setAttribute('aria-busy','true');try{const data=await fetchThemes(m.id);if(mediaId()!==m.id)return;const host=root.querySelector('#nx22Themes');if(!host)return;host.dataset.state='ready';host.removeAttribute('aria-busy');host.innerHTML=data.items.length?`<div class="nx22-theme-grid">${data.items.map(item=>themeCard(item,m)).join('')}</div>`:'<div class="nx22-themes-empty"><strong>Nenhuma abertura ou encerramento disponível</strong><p>Este título ainda não possui vídeos seguros vinculados ao acervo.</p></div>';bindThemePlayers(host)}catch{if(mediaId()!==m.id)return;const host=root.querySelector('#nx22Themes');if(!host)return;host.dataset.state='error';host.removeAttribute('aria-busy');host.innerHTML='<div class="nx22-themes-empty is-error"><strong>O acervo está indisponível agora</strong><p>Não foi possível carregar este acervo agora. Tente novamente em instantes.</p><button type="button" data-nx22-themes-retry>Tentar novamente</button></div>';host.querySelector('[data-nx22-themes-retry]')?.addEventListener('click',()=>{host.dataset.state='';hydrateThemes(m)})}}

  function hash(s){let h=2166136261;for(const c of String(s||'')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0).toString(36)}
  function languageHits(s,words){const t=` ${String(s||'').toLowerCase()} `;return words.reduce((total,word)=>total+(t.match(new RegExp(`\\b${word}\\b`,'g'))||[]).length,0)}
  function looksPortuguese(s){const text=String(s||''),pt=languageHits(text,['uma','que','para','com','seu','sua','quando','após','mundo','história','vida','jovem','escola','poder','dos','das','não','como','mas','por','em','de','do','da','temporada','aventura']),en=languageHits(text,['the','and','with','his','her','when','after','world','story','life','young','school','power','from','into','but']);return(/[áàâãéêíóôõúç]/i.test(text)&&pt>=1)||(pt>=2&&pt>en*1.35)}
  function cleanSynopsisText(value){return String(value||'').replace(/\s*(?:\((?:source|fonte)\s*:[^)]+\)|\[(?:source|fonte|written by)[^\]]*\])\s*/gi,' ').replace(/(?:^|\n)\s*(?:source|fonte)\s*:\s*[^\n]+\s*$/gim,'').replace(/\s+(?:source|fonte)\s*:\s*[^.!?]+\.?\s*$/i,'').replace(/\s+/g,' ').trim()}
  function splitText(s,max=430){const sentences=String(s||'').match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[s];const out=[];let cur='';for(const x of sentences){if((cur+' '+x).trim().length>max&&cur){out.push(cur.trim());cur=x}else cur=(cur+' '+x).trim()}if(cur)out.push(cur);return out.slice(0,5)}
  async function translationFetch(url,read){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4500);try{const response=await fetch(url,{headers:{accept:'application/json'},credentials:'omit',signal:controller.signal});if(!response.ok)throw new Error('translate');return read(await response.json())}finally{clearTimeout(timer)}}
  async function translateChunkMyMemory(text){const u=`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|pt-BR`;const x=await translationFetch(u,j=>j?.responseData?.translatedText);if(!x||/MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(x))throw new Error('translate');return x}
  async function translateChunkGoogle(text){const u=`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pt&dt=t&q=${encodeURIComponent(text)}`;const x=await translationFetch(u,j=>(j?.[0]||[]).map(v=>v?.[0]||'').join(''));if(!x)throw new Error('translate');return x}
  function synopsisSource(m){const description=cleanSynopsisText(strip(m.description)).slice(0,2400),jikan=cleanSynopsisText(String(m.jikan?.synopsis||'')).slice(0,2400);if(looksPortuguese(description))return description;if(looksPortuguese(jikan))return jikan;if(!description)return jikan;if(!jikan)return description;return jikan.length>description.length*1.2?jikan:description}
  function synopsisCached(raw){if(!raw)return'';try{return localStorage.getItem(`nx22:pt:${hash(raw)}`)||''}catch{return''}}
  function synopsisPreview(m){const raw=synopsisSource(m);if(!raw)return{text:fallbackSynopsis(m),pending:false};if(looksPortuguese(raw))return{text:raw,pending:false};const cached=synopsisCached(raw);return{text:cached||raw,pending:!cached}}
  function validTranslation(source,result){const text=cleanSynopsisText(result);return text.length>=Math.min(80,source.length*.48)&&looksPortuguese(text)&&text.toLowerCase()!==source.toLowerCase()?text:''}
  async function translateAll(engine,chunks){return(await Promise.all(chunks.map(chunk=>engine(chunk)))).join(' ').replace(/\s+/g,' ').trim()}
  async function translateSynopsisServer(m,raw){if(IS_PAGES)return'';const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000),kind=String(m.mediaType).toUpperCase()==='MANGA'?'manga':'anime';try{const response=await fetch(`/api/synopsis/${kind}/${Number(m.id)}`,{headers:{accept:'application/json'},credentials:'same-origin',signal:controller.signal});if(!response.ok)return'';return validTranslation(raw,(await response.json())?.text)}catch{return''}finally{clearTimeout(timer)}}
  async function synopsisPT(m){
    const raw=synopsisSource(m);
    if(!raw)return fallbackSynopsis(m);
    if(looksPortuguese(raw))return raw;
    const key=`nx22:pt:${hash(raw)}`,cached=synopsisCached(raw);if(cached)return cached;
    const server=await translateSynopsisServer(m,raw);if(server){try{localStorage.setItem(key,server)}catch{}return server}
    const chunks=splitText(raw);
    const backup=translateAll(translateChunkMyMemory,chunks).then(result=>validTranslation(raw,result),()=>''),google=translateAll(translateChunkGoogle,chunks).then(result=>validTranslation(raw,result),()=>'');
    let result=await google;if(!result)result=await backup;
    if(result){try{localStorage.setItem(key,result)}catch{}return result}
    return fallbackSynopsis(m);
  }
  function fallbackSynopsis(m){const reading=String(m.mediaType).toUpperCase()==='MANGA',gs=(m.genres||[]).slice(0,3).map(g=>GENRE[g]||g).join(', '),st=STATUS[m.status]||(reading?'Em publicação':'Em exibição'),kind=reading?'mangá':m.format==='MOVIE'?'filme':'anime';return `${title(m)} é um ${kind}${gs?` de ${gs}`:''}, atualmente ${st.toLowerCase()}. A obra reúne os elementos centrais dessa proposta em uma história para acompanhar sem spoilers.`}

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

  function relationCard(edge){const m=edge?.node;if(!m)return'';const relatedType=String(m.mediaType||m.type||'ANIME').toUpperCase()==='MANGA'?'MANGA':'ANIME';return `<article class="nx22-related" tabindex="0" data-nx22-open="${m.id}" data-nx22-media-type="${relatedType}" data-kind="${relatedType.toLowerCase()}"><div class="nx22-related-cover">${cover(m)?`<img loading="lazy" src="${esc(cover(m))}" alt="${esc(title(m))}">`:''}</div><div><small>${esc(REL[edge.relationType]||String(edge.relationType||'Relacionado').replaceAll('_',' '))}</small><strong>${esc(title(m))}</strong><span>${esc(mediaFormatPT(m))}${m.seasonYear?` · ${m.seasonYear}`:''}</span></div></article>`}
  function recommendationCard(node){const m=node?.mediaRecommendation;if(!m)return'';const relatedType=String(m.mediaType||m.type||'ANIME').toUpperCase()==='MANGA'?'MANGA':'ANIME';return `<article class="nx22-rec" tabindex="0" data-nx22-open="${m.id}" data-nx22-media-type="${relatedType}" data-kind="${relatedType.toLowerCase()}"><div>${cover(m)?`<img loading="lazy" src="${esc(cover(m))}" alt="${esc(title(m))}">`:''}${m.metricsSource==='aninexus'&&m.averageScore?`<span>${SVG.star}${(m.averageScore/10).toFixed(1)}</span>`:''}</div><strong>${esc(title(m))}</strong><small>${esc((m.genres||[]).slice(0,2).map(g=>GENRE[g]||g).join(' · ')||(relatedType==='MANGA'?'Mangá':'Anime'))}</small></article>`}
  function initials(value){return String(value||'?').trim().split(/\s+/).slice(0,2).map(part=>part.charAt(0)).join('').toUpperCase()||'?'}
  function staffRolePT(value){return String(value||'Equipe').split(',').map(role=>{const clean=role.trim();return STAFF_ROLE_PT[clean]||clean}).filter(Boolean).join(' · ')}
  function portrait(n){const name=n?.name?.full||'';return n?.image?.large?`<img loading="lazy" src="${esc(n.image.large)}" alt="${esc(name)}">`:`<i class="nx22-person-fallback" aria-hidden="true">${esc(initials(name))}</i>`}
  function personCard(e){const n=e?.node;if(!n)return'';const va=e.voiceActors?.[0];return `<article class="nx22-person">${portrait(n)}<strong>${esc(n.name?.full||'')}</strong><span>${e.role==='MAIN'?'Principal':'Coadjuvante'}</span>${va?`<small>Voz: ${esc(va.name?.full||'')}</small>`:''}</article>`}
  function staffCard(e){const n=e?.node;if(!n)return'';return `<article class="nx22-person">${portrait(n)}<strong>${esc(n.name?.full||'')}</strong><span>${esc(staffRolePT(e.role))}</span></article>`}

  function infoRows(m){
    const j=m.jikan||{},prod=names(j.producers).join(', ')||'—',lic=names(j.licensors).join(', ')||'—',std=studios(m).join(', ')||names(j.studios).join(', ')||'—';
    const reading=String(m.mediaType).toUpperCase()==='MANGA';
    const rows=reading?[
      ['Status',STATUS[m.status]||'—'],['Formato',FORMAT[m.format]||m.format||'Mangá'],['Publicação',airedStart(m)],['Término',airedEnd(m)],
      ['Capítulos',m.chapters||'—'],['Volumes',m.volumes||'—'],['Origem',sourcePT(m.source)],['País',countryPT(m.countryOfOrigin)]
    ]:[
      ['Status',STATUS[m.status]||j.status||'—'],['Formato',FORMAT[m.format]||j.type||'—'],['Estreia',airedStart(m)],['Término',airedEnd(m)],
      ['Episódios',m.episodes||j.episodes||'—'],['Duração',m.duration?`${m.duration} min por episódio`:(j.duration||'—')],['Exibição',broadcastPT(j.broadcast)],
      ['Temporada',m.season?`${SEASON[m.season]||m.season} ${m.seasonYear||''}`:(j.season&&j.year?`${j.season} ${j.year}`:'—')],['Origem',sourcePT(m.source)],['País',countryPT(m.countryOfOrigin)],
      ['Classificação',ratingPT(j.rating)],['Estúdio',std],['Produtores',prod],['Licenciadores',lic]
    ];
    return rows.map(([k,v])=>`<div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('')
  }

  function averageStars(value){
    const scoreValue=Number.isFinite(Number(value))?Math.max(0,Math.min(10,Number(value))):0;
    return Array.from({length:5},(_,index)=>`<span class="nx22-average-star" style="--nx22-star-fill:${Math.max(0,Math.min(100,(scoreValue-index*2)*50))}%"><i>${SVG.star}</i><b>${SVG.star}</b></span>`).join('');
  }

  const AKIRA_TONES={
    Action:['entra na pasta das histórias que vivem de impulso, risco e decisões no limite','parece guardar ação suficiente para deixar cada nova etapa com gosto de perigo'],
    Adventure:['abre caminho para uma jornada que promete crescer a cada descoberta','tem aquele espírito de aventura que transforma cada parada em uma nova pista'],
    Comedy:['parece saber transformar confusão em parte da diversão','vai para a gaveta dos casos em que o caos também sabe contar uma boa história'],
    Drama:['parece viver daqueles conflitos que continuam ecoando depois da cena','entra no arquivo das histórias que tratam sentimento como parte central do mistério'],
    Fantasy:['abre a porta para um mundo cujas regras merecem ser descobertas aos poucos','tem fantasia suficiente para fazer o impossível parecer apenas a primeira pista'],
    Horror:['vai direto para a gaveta dos casos que incomodam do jeito certo','parece preparado para transformar tensão em uma pista que não sai da cabeça'],
    Mystery:['entra na pasta dos mistérios em que cada detalhe pode virar pista','tem cara de caso para observar com atenção e desconfiar até do silêncio'],
    Romance:['coloca relações e timing emocional bem no centro do arquivo','parece tratar cada aproximação como uma pista sobre quem essas pessoas realmente são'],
    'Sci-Fi':['mistura hipótese, consequência e possibilidades que pedem investigação cuidadosa','abre um caso em que tecnologia, futuro e escolhas pedem investigação cuidadosa'],
    'Slice of Life':['faz o cotidiano parecer um caso digno de atenção','lembra que os pequenos momentos também escondem pistas importantes'],
    Sports:['entra em campo com esforço, rivalidade e espaço para boas viradas','parece guardar tanta história nos bastidores quanto na competição'],
    Supernatural:['abre um arquivo em que o estranho não costuma respeitar explicações fáceis','parece esconder suas melhores pistas justamente onde o normal deixa de funcionar'],
    Thriller:['tem ritmo de caso que pede atenção até o último movimento','entra na pasta das histórias que sabem apertar a tensão sem avisar']
  };
  const AKIRA_FALLBACK=['tem uma combinação curiosa de ideias que merece uma investigação sem spoilers','abre um caso com personalidade suficiente para despertar a curiosidade da Akira'];
  function stablePick(m,values,salt=''){return values[parseInt(hash(`${m.id}:${title(m)}:${salt}`),36)%values.length]}
  function akiraComment(m){
    const reading=String(m.mediaType).toUpperCase()==='MANGA',rawGenres=m.genres||[],localized=rawGenres.map(value=>GENRE[value]||value),primary=rawGenres[0],secondary=localized[1];
    const tone=stablePick(m,AKIRA_TONES[primary]||AKIRA_FALLBACK,'tom'),translatedTag=tags(m).map(tagPT).find(label=>label&&!localized.includes(label)&&!/^(?:protagonista|elenco|shounen|shoujo|seinen|josei|heterossexual|temas lgbtqia)/i.test(label));
    const clue=translatedTag?` A presença de ${translatedTag.toLocaleLowerCase('pt-BR')} é uma das pistas que mais chama atenção.`:secondary?` A mistura com ${secondary.toLocaleLowerCase('pt-BR')} deixa o caso ainda mais curioso.`:'';
    const endings=m.status==='NOT_YET_RELEASED'
      ?['Como ainda não estreou, este é um arquivo para acompanhar de perto antes de tirar conclusões.','Ainda não chegou a hora da estreia, então a Akira deixou esta pasta marcada para novas pistas.']
      :m.status==='RELEASING'
        ?[reading?'A leitura está em andamento, então novas páginas ainda podem mudar toda a investigação.':'A exibição está em andamento, então novos episódios ainda podem mudar toda a investigação.','O caso continua aberto — melhor entrar sabendo que ainda há pistas por revelar.']
        :[reading?'Como a obra já está concluída, dá para investigar cada página no próprio ritmo.':'Como a obra já está concluída, dá para investigar tudo no próprio ritmo.','Arquivo completo: uma boa escolha para quem prefere chegar até a última pista.'];
    return `${title(m)} ${tone}.${clue} ${stablePick(m,endings,'fecho')}`.replace(/\.\s*\./g,'.').replace(/\s+/g,' ').trim();
  }

  function wireHeroBanner(){
    const image=root.querySelector('[data-nx22-banner]');if(!image)return;
    const host=image.closest('.nx22-hero-bg');
    const validate=()=>{const ratio=image.naturalHeight?image.naturalWidth/image.naturalHeight:0,invalid=!Number.isFinite(ratio)||ratio<=0;host?.classList.toggle('is-invalid',invalid);host?.classList.toggle('is-portrait',!invalid&&ratio<1.35);host?.classList.toggle('is-loaded',!invalid)};
    const recover=()=>{const fallback=image.dataset.nx22Fallback;if(fallback&&image.dataset.nx22FallbackUsed!=='1'){image.dataset.nx22FallbackUsed='1';host?.classList.add('is-cover-fallback');image.src=fallback;return}host?.classList.add('is-invalid')};
    image.addEventListener('load',validate);image.addEventListener('error',recover);
    if(image.complete)validate();
  }

  async function hydrateMediaActivity(type,id){
    const host=root.querySelector('#nx22Activity');if(!host)return;
    const reading=type==='MANGA',labels={PLANNING:reading?'Quero ler':'Quero ver',CURRENT:reading?'Lendo':'Assistindo',COMPLETED:'Terminei',PAUSED:'Pausei',DROPPED:'Desisti'},icons={PLANNING:'＋',CURRENT:'▶',COMPLETED:'✓',PAUSED:'Ⅱ',DROPPED:'×'};
    try{
      const response=await fetch(`/api/${reading?'manga':'anime'}/${Number(id)}/activity`,{headers:{accept:'application/json'}}),data=response.ok?await response.json():null;
      if(!data)throw new Error('activity unavailable');if(mediaId()!==Number(id)||!host.isConnected)return;
      const statuses=data.statuses||{},reactions=Array.isArray(data.reactions)?data.reactions:[];
      host.dataset.state='ready';host.innerHTML=`<div class="nx22-activity-rows">${Object.entries(labels).map(([key,label])=>`<div class="nx22-activity-row"><i data-status="${key}" aria-hidden="true">${icons[key]}</i><strong>${esc(label)}</strong><span></span><b>${Number(statuses[key])||0}</b></div>`).join('')}</div>${reactions.length?`<div class="nx22-activity-reactions">${reactions.map(item=>`<span data-reaction="${esc(item.key)}"><i aria-hidden="true">${item.key==='LOVE'?'♥':item.key==='LIKE'?'●':item.key==='WOW'?'✦':'—'}</i>${esc(item.label)} <b>${Number(item.percentage)||0}%</b></span>`).join('')}</div>`:`<p class="nx22-activity-empty">As reações da comunidade aparecerão aqui.</p>`}<small class="nx22-activity-total">${Number(data.total)||0} ${Number(data.total)===1?'membro acompanha':'membros acompanham'} esta obra</small>`;
    }catch{if(host.isConnected){host.dataset.state='error';host.innerHTML='<div class="nx22-activity-error"><p class="nx22-activity-empty">A atividade não pôde ser carregada agora.</p><button type="button" data-nx22-activity-retry>Tentar novamente</button></div>';host.querySelector('[data-nx22-activity-retry]')?.addEventListener('click',()=>hydrateMediaActivity(type,id),{once:true})}}
  }

  function paint(m){
    const media=mediaRoute();if(media?.id!==m.id)return;
    activate();lastId=m.id;root.dataset.nx22DetailId=String(m.id);
    const reading=media.type==='MANGA',stateApi=reading?window.AniNexusMangaState:window.AniNexusMediaState;
    const chars=m.characters?.edges||[],staff=m.staff?.edges||[],rels=m.relations?.edges||[],recs=(m.recommendations?.nodes||[]).filter(x=>x.mediaRecommendation),streams=uniqueLinks(m),tid=trailerId(m),ts=tags(m),alts=altTitles(m),j=m.jikan||{};
    const current=stateApi?.get?.(m.id)||{},listAttr=reading?'data-manga-list':'data-list',favAttr=reading?'data-manga-fav':'data-fav',catalogPath=reading?'/mangas':'/animes/catalogo';
    const internal=m.metricsSource==='aninexus',listCount=internal?Number(m.listCount)||0:0,popularity=internal?Number(m.popularity)||0:0;
    const heroTags=ts.map(value=>({value,label:tagPT(value)})).filter(item=>item.label&&!(m.genres||[]).some(genre=>(GENRE[genre]||genre)===item.label)).slice(0,8),meta=[m.title?.native,m.seasonYear,FORMAT[m.format]||m.format].filter(Boolean),heroBanner=banner(m),heroCover=cover(m),heroArt=heroBanner||heroCover;
    const nextDate=m.nextAiringEpisode?new Date(m.nextAiringEpisode.airingAt*1000):null,nextIso=nextDate?.toISOString()||'',nextDay=nextDate?new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',timeZone:'America/Sao_Paulo'}).format(nextDate):'',nextTime=nextDate?new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'}).format(nextDate):'';
    const overviewSchedule=reading?(m.chapters||m.volumes?`<section class="nx22-overview-schedule" aria-label="Publicação"><div class="nx22-airing nx22-publication"><span class="nx22-airing-icon">${SVG.calendar}</span><div class="nx22-airing-copy"><small>PUBLICAÇÃO</small><strong>Detalhes da leitura</strong></div><div class="nx22-airing-fact"><small>CAPÍTULOS</small><strong>${esc(m.chapters||'—')}</strong></div><div class="nx22-airing-fact"><small>VOLUMES</small><strong>${esc(m.volumes||'—')}</strong></div><em>${esc(STATUS[m.status]||'Publicação')}</em></div></section>`:''):(m.nextAiringEpisode?`<section class="nx22-overview-schedule" aria-label="Próximo episódio"><div class="nx22-airing"><span class="nx22-airing-icon">${SVG.calendar}</span><div class="nx22-airing-copy"><small>PRÓXIMO EPISÓDIO</small><strong>Episódio ${m.nextAiringEpisode.episode}</strong></div><time datetime="${nextIso}"><small>${esc(nextDay)}</small><strong>${esc(nextTime)}</strong></time><div class="nx22-airing-countdown"><small>ESTREIA EM</small><strong>${esc(fmtUntil(m.nextAiringEpisode.airingAt))}</strong></div></div></section>`:'');
    root.innerHTML=`<article class="nx22-detail" data-nx22-id="${m.id}" data-nx22-type="${media.type}">
      <header class="nx22-hero">
        <div class="nx22-hero-bg${heroBanner?'':' is-cover-fallback'}">${heroArt?`<img src="${esc(heroArt)}" alt="" data-nx22-banner data-nx22-fallback="${heroBanner&&heroCover&&heroCover!==heroBanner?esc(heroCover):''}" decoding="async" fetchpriority="high">`:''}</div><div class="nx22-hero-shade"></div>
        <div class="nx22-shell nx22-hero-content">
          <button type="button" class="nx22-back" data-nx22-back aria-label="Voltar">${SVG.back}<span>Voltar</span></button>
          <div class="nx22-hero-grid">
            <div class="nx22-cover">${cover(m)?`<img src="${esc(cover(m))}" alt="Capa de ${esc(title(m))}">`:''}</div>
            <div class="nx22-headcopy"><span class="nx22-eyebrow">${esc(m.title?.romaji||m.title?.native||(reading?'Mangá':'Anime'))}</span><h1>${esc(title(m))}</h1>
              ${meta.length?`<div class="nx22-meta">${meta.map(value=>`<span>${esc(value)}</span>`).join('')}</div>`:''}
              <div class="nx22-chips"><span class="nx22-status">${esc(STATUS[m.status]||(reading?'Mangá':'Anime'))}</span>${(m.genres||[]).slice(0,5).map(g=>`<a class="genre" href="${catalogPath}" data-nx22-genre="${esc(g)}">${esc(GENRE[g]||g)}</a>`).join('')}${heroTags.map(tag=>`<a href="${catalogPath}" data-nx22-tag="${esc(tag.value)}">${esc(tag.label)}</a>`).join('')}</div>
              <div class="nx22-actions detail-actions"><button type="button" class="nx22-fav" ${favAttr}="${m.id}" aria-label="Favoritar">${SVG.heart}</button><button type="button" class="nx22-list" ${listAttr}="${m.id}" aria-label="Adicionar à lista">${SVG.plus}<span>${current.status?(stateApi?.statuses?.[current.status]?.label||'Meu status'):'Adicionar à lista'}</span></button><button type="button" class="nx22-share" data-nx22-share aria-label="Compartilhar">${SVG.share}<span>Compartilhar</span></button></div>
              <div class="nx22-community-summary"><div class="nx22-stats"><div class="nx22-average-stat"><div class="nx22-average-value"><strong>${scoreFixed(m)}</strong><i class="nx22-average-stars" aria-hidden="true">${averageStars(internal?Number(m.averageScore||0)/10:0)}</i></div><span>NOTA MÉDIA</span></div><div><strong>${compact(popularity)}</strong><span>POPULARIDADE</span></div><div><strong>${compact(listCount)}</strong><span>MEMBROS</span></div></div></div>
            </div>
          </div>
        </div>
      </header>
      <nav class="nx22-tabs" aria-label="Seções da obra">
        <div class="nx22-shell nx22-tabs-row"><button type="button" class="nx22-tabs-toggle" data-nx22-tabs-toggle aria-expanded="false" aria-label="Abrir menu de seções">${SVG.menu}</button><div class="nx22-tab-list" role="tablist"><button class="active" role="tab" aria-selected="true" data-nx22-tab="geral">Geral</button>${reading?'':`<button role="tab" aria-selected="false" data-nx22-tab="aberturas">Aberturas & encerramentos</button>`}<button role="tab" aria-selected="false" data-nx22-tab="elenco">Personagens & equipe</button><button role="tab" aria-selected="false" data-nx22-tab="franquia">Franquia</button><button role="tab" aria-selected="false" data-nx22-tab="recomendacoes">Recomendações</button></div></div>
        <button type="button" class="nx22-tabs-backdrop" data-nx22-tabs-close aria-label="Fechar menu de seções"></button>
        <section class="nx22-tabs-sheet" aria-label="Menu de seções"><header><strong>Menu</strong><button type="button" data-nx22-tabs-close aria-label="Fechar menu">×</button></header><div class="nx22-tabs-sheet-list"><button class="active" type="button" data-nx22-sheet-tab="geral">Geral</button>${reading?'':`<button type="button" data-nx22-sheet-tab="aberturas">Aberturas & encerramentos</button>`}<button type="button" data-nx22-sheet-tab="elenco">Personagens & equipe</button><button type="button" data-nx22-sheet-tab="franquia">Franquia</button><button type="button" data-nx22-sheet-tab="recomendacoes">Recomendações</button></div></section>
      </nav>
      <div class="nx22-shell nx22-content" id="nx22Panel"></div>
    </article>`;

    wireHeroBanner();
    const trailer=tid?`<section class="nx22-section"><div class="nx22-section-head"><div><small>VÍDEO</small><h2>Trailer oficial</h2></div><span>Reproduza sem sair do AniNexus</span></div><div class="nx22-video"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(tid)}?rel=0&modestbranding=1" title="Trailer de ${esc(title(m))}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div></section>`:'';
    const watch=streams.length?`<section class="nx22-section"><div class="nx22-section-head"><div><small>${reading?'LEITURA':'STREAMING'}</small><h2>${reading?'Onde ler':'Onde assistir'}</h2></div></div><div class="nx22-streams">${streams.map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${s.icon?`<img src="${esc(s.icon)}" alt="">`:SVG.play}<span>${esc(s.site)}</span>${SVG.external}</a>`).join('')}</div></section>`:'';
    const altsHtml=alts.length?`<div class="nx22-info-card">${alts.map(([k,v])=>`<div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('')}</div>`:'<div class="nx22-info-card"><div><span>Títulos</span><strong>Sem títulos alternativos</strong></div></div>';
    const akira=`<section class="nx22-akira-file" aria-labelledby="nx22AkiraTitle"><div class="nx22-akira-head"><small>ARQUIVO X</small><h2 id="nx22AkiraTitle">Arquivo X da Akira</h2></div><div class="nx22-akira-body"><img src="${BASE}/assets/akira-arquivo-x-v1.png" alt="Akira analisando a obra" loading="lazy" decoding="async"><p>${esc(akiraComment(m))}</p></div></section>`;
    const cast=()=>`<section class="nx22-full"><div class="nx22-section-head"><div><small>ELENCO</small><h2>Personagens</h2></div></div><div class="nx22-people nx22-people-full">${chars.map(personCard).join('')||'<p class="nx22-roster-empty">O elenco desta obra ainda não foi publicado pelas fontes do catálogo.</p>'}</div>${staff.length?`<div class="nx22-section-head nx22-staff-head"><div><small>PRODUÇÃO</small><h2>Equipe</h2></div></div><div class="nx22-people nx22-people-full">${staff.map(staffCard).join('')}</div>`:''}</section>`;
    const openings=()=>`<section class="nx22-full nx22-themes"><div class="nx22-themes-intro"><div><small>TRILHA DA OBRA</small><h2>Aberturas e encerramentos</h2><p>Reproduza um tema por vez sem sair do AniNexus.</p></div></div><div id="nx22Themes" class="nx22-themes-results" data-state=""><div class="nx22-themes-loading" aria-hidden="true"><i></i><i></i><i></i><span>Buscando os temas disponíveis…</span></div></div></section>`;
    const franchise=()=>`<section class="nx22-full"><div class="nx22-section-head"><div><small>UNIVERSO</small><h2>Franquia e relações</h2></div></div><div class="nx22-related-grid">${rels.map(relationCard).join('')||'<p>Nenhuma relação cadastrada.</p>'}</div></section>`;
    const recommendations=()=>`<section class="nx22-full"><div class="nx22-section-head"><div><small>PARA VER DEPOIS</small><h2>Você também pode gostar</h2></div></div><div class="nx22-rec-grid">${recs.map(recommendationCard).join('')||'<p>Sem recomendações disponíveis.</p>'}</div></section>`;
    const impressions=()=>'<section class="nx22-full" id="nx22Impressions"><div class="nx22-panel-loading"><i></i><i></i><span>Carregando impressões…</span></div></section>';
    const activity=()=>'<section class="nx22-full nx22-activity-card"><div class="nx22-activity-head"><div><small>COMUNIDADE</small><h2>Atividade</h2></div><span>Como os membros estão acompanhando</span></div><div id="nx22Activity" class="nx22-activity-body" data-state="loading"><div class="nx22-panel-loading"><i></i><i></i><span>Carregando atividade…</span></div></div></section>';
    const general=()=>{const preview=synopsisPreview(m);return `${overviewSchedule}<div class="nx22-layout"><main><section class="nx22-section"><div class="nx22-section-head"><div><small>HISTÓRIA</small><h2>Sinopse</h2></div>${preview.pending?'<span class="nx22-translation-note" id="nx22SynopsisNote">Traduzindo…</span>':''}</div><p class="nx22-synopsis" id="nx22Synopsis">${esc(preview.text)}</p></section>${akira}${trailer}${watch}${chars.length?`<section class="nx22-section"><div class="nx22-section-head"><div><small>ELENCO</small><h2>Personagens principais</h2></div><button type="button" data-nx22-jump="elenco">Ver todos</button></div><div class="nx22-people">${chars.slice(0,10).map(personCard).join('')}</div></section>`:''}</main><aside><section><h3>Ficha técnica</h3><div class="nx22-info-card">${infoRows(m)}</div></section><section><h3>Outros títulos</h3>${altsHtml}</section></aside></div>${activity()}${impressions()}`};
    const panels={geral:general,aberturas:openings,elenco:cast,franquia:franchise,recomendacoes:recommendations};
    let panelReady=false;
    function closeTabs(){const nav=root.querySelector('.nx22-tabs'),toggle=root.querySelector('[data-nx22-tabs-toggle]');nav?.classList.remove('is-open');document.body.classList.remove('nx22-tabs-open');toggle?.setAttribute('aria-expanded','false')}
    function show(k){const panel=root.querySelector('#nx22Panel');if(!panel)return;let activeButton=null;root.querySelectorAll('[data-nx22-tab]').forEach(b=>{const active=b.dataset.nx22Tab===k;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));if(active)activeButton=b});root.querySelectorAll('[data-nx22-sheet-tab]').forEach(b=>b.classList.toggle('active',b.dataset.nx22SheetTab===k));panel.innerHTML=(panels[k]||general)();panel.classList.remove('is-entering');if(panelReady)requestAnimationFrame(()=>panel.classList.add('is-entering'));else panelReady=true;wirePanel(k);closeTabs();activeButton?.scrollIntoView?.({behavior:'smooth',block:'nearest',inline:'center'});dispatchEvent(new CustomEvent('aninexus:detail-panel',{detail:{key:k,type:media.type,id:m.id,host:k==='geral'?root.querySelector('#nx22Impressions'):panel}}));}
    function wirePanel(k){
      root.querySelector('[data-nx22-jump="elenco"]')?.addEventListener('click',()=>show('elenco'));
      if(k==='geral'){synopsisPT(m).then(text=>{if(mediaId()===m.id){const el=root.querySelector('#nx22Synopsis'),note=root.querySelector('#nx22SynopsisNote');if(el)el.textContent=text;note?.remove()}});hydrateMediaActivity(media.type,m.id)}
      if(k==='aberturas'&&!reading)hydrateThemes(m);
      root.querySelectorAll('[data-nx22-open]').forEach(el=>{const open=()=>openMedia(Number(el.dataset.nx22Open),el.querySelector('strong')?.textContent||(reading?'manga':'anime'),el.dataset.nx22MediaType||media.type);el.addEventListener('click',e=>{if(e.target.closest('button,a'))return;open()});el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}})});
    }
    root.querySelectorAll('[data-nx22-tab]').forEach(b=>b.onclick=()=>show(b.dataset.nx22Tab));
    root.querySelectorAll('[data-nx22-sheet-tab]').forEach(b=>b.onclick=()=>show(b.dataset.nx22SheetTab));
    const tabList=root.querySelector('.nx22-tab-list'),tabRow=root.querySelector('.nx22-tabs-row');
    const updateTabEdges=()=>{if(!tabList||!tabRow)return;const max=Math.max(0,tabList.scrollWidth-tabList.clientWidth);tabRow.dataset.nx22Left=tabList.scrollLeft>2?'1':'0';tabRow.dataset.nx22Right=tabList.scrollLeft<max-2?'1':'0'};
    tabList?.addEventListener('scroll',updateTabEdges,{passive:true});
    if(tabList&&typeof ResizeObserver==='function')new ResizeObserver(updateTabEdges).observe(tabList);
    requestAnimationFrame(updateTabEdges);
    root.querySelector('[data-nx22-tabs-toggle]')?.addEventListener('click',()=>{const nav=root.querySelector('.nx22-tabs'),open=!nav?.classList.contains('is-open');nav?.classList.toggle('is-open',open);document.body.classList.toggle('nx22-tabs-open',open);root.querySelector('[data-nx22-tabs-toggle]')?.setAttribute('aria-expanded',String(open))});
    root.querySelectorAll('[data-nx22-tabs-close]').forEach(button=>button.addEventListener('click',closeTabs));
    root.querySelector('.nx22-tabs')?.addEventListener('keydown',event=>{if(event.key==='Escape')closeTabs()});
    root.querySelector('[data-nx22-back]')?.addEventListener('click',()=>{let previous='',sameDocument=false;try{const raw=sessionStorage.getItem('nx22:previous-path')||'',saved=JSON.parse(raw);previous=String(saved?.path||'');sameDocument=Math.abs(Number(saved?.document)-performance.timeOrigin)<1}catch{}if(previous&&previous!==routePath()&&sameDocument&&history.length>1){history.back();return}openPath(previous&&previous!==routePath()?previous:catalogPath)});
    const shareMedia=async()=>{const data={title:title(m),text:`${title(m)} no AniNexus`,url:location.href};try{if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(location.href);toast('Link copiado')}}catch{}};
    root.querySelector('[data-nx22-share]')?.addEventListener('click',shareMedia);
    show('geral');
    stateApi?.sync?.(m.id);
    document.title=`${title(m)} | AniNexus`;
  }

  function toast(msg){const host=document.querySelector('#toastRoot');if(!host)return;const n=document.createElement('div');n.className='toast';n.textContent=msg;host.append(n);setTimeout(()=>n.remove(),2200)}
  function openPath(path){try{sessionStorage.setItem('nx22:previous-path',JSON.stringify({path:routePath(),document:performance.timeOrigin}))}catch{}history.pushState({},'',IS_PAGES?`${BASE}${path}`:path);dispatchEvent(new PopStateEvent('popstate'))}
  function openCatalogFilter(path,filters){
    const key='nx23:catalog:incoming';
    try{sessionStorage.setItem(key,JSON.stringify(filters))}catch{}
    openPath(path);
    let attempts=0;
    const deliver=()=>{
      let pending=false;
      try{pending=Boolean(sessionStorage.getItem(key))}catch{}
      if(!pending)return;
      if(document.querySelector('.nx21-catalog-page')&&window.AniNexusCatalog?.applyFilters){
        window.AniNexusCatalog.applyFilters(filters);
        try{sessionStorage.removeItem(key)}catch{}
        return;
      }
      if(attempts++<20)setTimeout(deliver,50);
    };
    setTimeout(deliver,0);
  }
  function openMedia(id,t='obra',type='ANIME'){const fallback=type==='MANGA'?'manga':'anime',s=String(t||fallback).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,80)||fallback;openPath(`/${fallback}/${s}-${id}`);scrollTo({top:0,behavior:'instant'})}

  function skeleton(id){activate();root.dataset.nx22DetailId=String(id);root.innerHTML=`<article class="nx22-detail nx22-loading"><div class="nx22-loading-banner"></div><div class="nx22-shell nx22-loading-body"><div class="nx22-loading-cover"></div><div><i></i><i></i><i></i><p>Carregando informações completas…</p></div></div></article>`}
  function fail(id,type){if(mediaId()!==id)return;activate();root.dataset.nx22DetailId=String(id);root.innerHTML=`<article class="nx22-detail nx22-fail"><div><img src="${BASE}/assets/logo.png" alt=""><h1>Não foi possível carregar ${type==='MANGA'?'este mangá':'este anime'}</h1><p>O catálogo está temporariamente indisponível. Tente novamente em alguns instantes.</p><button type="button" data-nx22-retry>Tentar novamente</button></div></article>`;root.querySelector('[data-nx22-retry]')?.addEventListener('click',()=>{try{sessionStorage.removeItem(cacheKey(id,type))}catch{};claim(true)})}

  async function render(id,type,force=false){
    if(!id)return;
    if(!force&&isOwned()&&lastId===id)return;
    const cached=cacheRead(id,type);if(!cached)skeleton(id);else paint(cached);
    try{const m=cached||await loadDetail(id,type);if(mediaId()===id)paint(m)}catch(e){if(mediaId()===id&&!cached)fail(id,type)}
  }
  function claim(force=false){
    if(claiming)return;claiming=true;
    try{
      const media=mediaRoute(),id=media?.id||0;
      if(!id){if(document.body.classList.contains('nx22-detail-active'))deactivate();lastId=0;return}
      activate();
      if(force||!isOwned()||lastId!==id)render(id,media.type,force);
    }finally{claiming=false}
  }

  root.addEventListener('click',event=>{
    const link=event.target.closest('[data-nx22-genre],[data-nx22-tag]');
    if(!link||!root.contains(link))return;
    event.preventDefault();
    const reading=mediaRoute()?.type==='MANGA',path=reading?'/mangas':'/animes/catalogo';
    openCatalogFilter(path,link.dataset.nx22Genre?{genre:link.dataset.nx22Genre}:{tag:link.dataset.nx22Tag});
  });
  const mo=new MutationObserver(()=>{if(observerRaf)return;observerRaf=requestAnimationFrame(()=>{observerRaf=0;const id=mediaId();if(id&&!isOwned())claim()})});
  mo.observe(root,{childList:true});
  addEventListener('popstate',()=>setTimeout(claim,0));
  document.addEventListener('aninexus:routechange',()=>setTimeout(claim,0));
  window.__NX_V22_DETAIL_READY__=true;
  dispatchEvent(new CustomEvent('aninexus:detail-runtime-ready'));
  claim(true);
})();
