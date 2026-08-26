import { cacheRemember, cacheSet } from './cache.mjs';
import { q } from './db.mjs';

const ENDPOINT = process.env.CATALOG_GRAPHQL_ENDPOINT || 'https://graphql.anilist.co';
const ANIMETHEMES_ENDPOINT = process.env.ANIMETHEMES_API_ENDPOINT || 'https://api.animethemes.moe';
const timeoutMs = Math.max(2500, Math.min(20_000, Number(process.env.UPSTREAM_TIMEOUT_MS || 9000)));
const mediaQueue = new Map();
let mediaFlushTimer = null;

function safeHttpsUrl(value) {
  try { const u = new URL(String(value||'')); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; }
}
async function flushMediaQueue() {
  mediaFlushTimer = null;
  const rows = [...mediaQueue.values()].slice(0,200); rows.forEach(x=>mediaQueue.delete(x.media_id));
  if (!rows.length) return;
  await q(`INSERT INTO media_cache(media_id,slug,payload,updated_at)
    SELECT media_id,slug,payload,now() FROM jsonb_to_recordset($1::jsonb) AS x(media_id bigint,slug text,payload jsonb)
    ON CONFLICT(media_id) DO UPDATE SET slug=EXCLUDED.slug,payload=EXCLUDED.payload,updated_at=now()`,[JSON.stringify(rows)]).catch(()=>{});
  if (mediaQueue.size) mediaFlushTimer=setTimeout(flushMediaQueue,250).unref();
}
function queueMediaCache(base) {
  if (!base?.id || process.env.PERSIST_MEDIA_CACHE === 'false') return;
  mediaQueue.set(base.id,{media_id:base.id,slug:base.slug,payload:base});
  if (!mediaFlushTimer) mediaFlushTimer=setTimeout(flushMediaQueue,500).unref();
}

async function gql(query, variables={}) {
  const ctl = new AbortController(); const timer = setTimeout(()=>ctl.abort(), timeoutMs);
  try {
    const res = await fetch(ENDPOINT,{method:'POST',headers:{'content-type':'application/json','accept':'application/json','user-agent':'AniNexus/3.8'},body:JSON.stringify({query,variables}),signal:ctl.signal,redirect:'error'});
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const type=String(res.headers.get('content-type')||''); if(!type.includes('application/json')) throw new Error('invalid upstream content type');
    const json = await res.json(); if (json.errors?.length) throw new Error(json.errors[0].message);
    return json.data;
  } finally { clearTimeout(timer); }
}

const strip = s => String(s||'').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#039;/g,"'").trim().slice(0,30_000);
export const slugify = s => String(s||'anime').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,90);

function normalizeMedia(m) {
  if (!m) return null;
  const title = m.title?.english || m.title?.romaji || m.title?.native || 'Anime';
  const streaming = (m.externalLinks||[]).filter(x=>String(x.type||'').toUpperCase()==='STREAMING').map(x=>({site:String(x.site||'').slice(0,80),url:safeHttpsUrl(x.url),icon:safeHttpsUrl(x.icon),color:String(x.color||'').slice(0,24),type:'STREAMING'})).filter(x=>x.url);
  const tagDetails=(m.tags||[]).slice(0,24).map(t=>({name:String(t?.name||'').slice(0,120),rank:Number(t?.rank||0),isMediaSpoiler:!!t?.isMediaSpoiler})).filter(t=>t.name);
  const base = {
    id:m.id,idMal:m.idMal||null,slug:`${slugify(title)}-${m.id}`,title:String(title).slice(0,300),titleRomaji:String(m.title?.romaji||'').slice(0,300),titleNative:String(m.title?.native||'').slice(0,300),synonyms:(m.synonyms||[]).slice(0,30).map(x=>String(x).slice(0,300)),
    cover:safeHttpsUrl(m.coverImage?.extraLarge||m.coverImage?.large),coverColor:String(m.coverImage?.color||'#a61b38').slice(0,24),banner:safeHttpsUrl(m.bannerImage),
    description:strip(m.description),genres:(m.genres||[]).slice(0,30).map(x=>String(x).slice(0,80)),tags:tagDetails.slice(0,12).map(t=>t.name),tagDetails,
    score:m.averageScore ? +(m.averageScore/10).toFixed(1) : null,meanScore:m.meanScore?+(m.meanScore/10).toFixed(1):null,
    popularity:Math.max(0,Number(m.popularity||0)),favourites:Math.max(0,Number(m.favourites||0)),episodes:m.episodes||null,duration:m.duration||null,
    format:m.format||'',status:m.status||'',season:m.season||'',seasonYear:m.seasonYear||null,country:m.countryOfOrigin||'',source:m.source||'',
    startDate:m.startDate||null,endDate:m.endDate||null,studios:(m.studios?.nodes||[]).slice(0,30).map(s=>({id:s.id,name:String(s.name||'').slice(0,180)})),streaming,
    nextAiringEpisode:m.nextAiringEpisode ? {airingAt:m.nextAiringEpisode.airingAt,episode:m.nextAiringEpisode.episode,timeUntilAiring:m.nextAiringEpisode.timeUntilAiring} : null,
    trailer:m.trailer?.id ? {id:String(m.trailer.id).slice(0,120),site:String(m.trailer.site||'').slice(0,40),thumbnail:safeHttpsUrl(m.trailer.thumbnail)} : null,
  };
  queueMediaCache(base);
  return base;
}

async function annotateMedia(items=[]) {
  const valid=(Array.isArray(items)?items:[]).filter(Boolean),ids=[...new Set(valid.map(item=>Number(item.id)).filter(Number.isSafeInteger))];
  if(!ids.length)return valid;
  const {rows}=await q('SELECT media_id,dubbed_pt_br,subtitle_pt_br,streaming,synopsis_pt_br,title_pt_br,editorial FROM media_annotations WHERE media_id=ANY($1::bigint[])',[ids]).catch(()=>({rows:[]}));
  const annotations=new Map(rows.map(row=>[Number(row.media_id),row]));
  return valid.map(item=>{
    const annotation=annotations.get(Number(item.id));if(!annotation)return item;
    const curatedStreaming=Array.isArray(annotation.streaming)?annotation.streaming.map(link=>({site:String(link?.site||'').slice(0,80),url:safeHttpsUrl(link?.url),icon:safeHttpsUrl(link?.icon),color:String(link?.color||'').slice(0,24),type:'STREAMING'})).filter(link=>link.url):[];
    return{...item,title:annotation.title_pt_br?String(annotation.title_pt_br).slice(0,300):item.title,description:annotation.synopsis_pt_br?String(annotation.synopsis_pt_br).slice(0,30_000):item.description,dubbed:!!annotation.dubbed_pt_br,subtitled:!!annotation.subtitle_pt_br,streaming:curatedStreaming.length?curatedStreaming:item.streaming,editorial:annotation.editorial&&typeof annotation.editorial==='object'?annotation.editorial:item.editorial||{}};
  });
}

export async function getMediaSummaries(values=[]) {
  const ids=[...new Set((Array.isArray(values)?values:[]).map(Number).filter(id=>Number.isSafeInteger(id)&&id>0))].slice(0,60);
  if(!ids.length)return[];
  const cached=await q('SELECT media_id,payload FROM media_cache WHERE media_id=ANY($1::bigint[])',[ids]).catch(()=>({rows:[]}));
  const found=new Map((cached.rows||[]).map(row=>[Number(row.media_id),row.payload]));
  const missing=ids.filter(id=>!found.has(id));
  if(missing.length){
    const query=`query($ids:[Int]){Page(page:1,perPage:60){media(id_in:$ids,type:ANIME,isAdult:false){${MEDIA_FIELDS}}}}`;
    const data=await gql(query,{ids:missing});
    for(const item of data?.Page?.media||[]){const normalized=normalizeMedia(item);if(normalized)found.set(Number(normalized.id),normalized)}
  }
  return annotateMedia(ids.map(id=>found.get(id)).filter(Boolean));
}

const safeThemeVideo=value=>{try{const url=new URL(String(value||''));return url.protocol==='https:'&&url.hostname==='v.animethemes.moe'?url.href:''}catch{return''}};
const themeResolution=value=>{const match=String(value?.resolution||'').match(/\d{3,4}/);return match?Number(match[0]):0};
function normalizeAnimeThemes(anime){
  const items=(anime?.animethemes||[]).map(theme=>{
    const candidates=(theme?.animethemeentries||[]).filter(entry=>entry?.nsfw!==true&&entry?.spoiler!==true).flatMap(entry=>(entry?.videos||[]).map(video=>({entry,video,url:safeThemeVideo(video?.link)}))).filter(item=>item.url);
    candidates.sort((a,b)=>{const rank=item=>(item.video?.nc===true?1e7:0)+(item.video?.subbed===false?1e6:0)+(item.video?.lyrics===false?1e5:0)+themeResolution(item.video);return rank(b)-rank(a)});
    const best=candidates[0];if(!best)return null;
    const kind=String(theme?.type||'').toUpperCase(),sequence=Math.max(0,Number(theme?.sequence||0));
    return{kind,sequence,slug:String(theme?.slug||'').slice(0,180),title:String(theme?.song?.title||`${kind==='ED'?'Encerramento':'Abertura'} ${sequence||''}`).trim().slice(0,300),artists:(theme?.song?.artists||[]).map(artist=>String(artist?.name||'').trim()).filter(Boolean).join(', ').slice(0,500)||'Artista não informado',group:String(theme?.group?.name||'').slice(0,200),episodes:String(best.entry?.episodes||'').slice(0,120),url:best.url,mime:/^video\/[a-z0-9.+-]+$/i.test(String(best.video?.mimetype||''))?best.video.mimetype:'video/webm',resolution:themeResolution(best.video),source:String(best.video?.source||'').slice(0,120),creditless:best.video?.nc===true};
  }).filter(Boolean).sort((a,b)=>{const order=item=>item.kind==='OP'?0:item.kind==='ED'?1:2;return order(a)-order(b)||a.sequence-b.sequence||a.title.localeCompare(b.title,'pt-BR')}).slice(0,24);
  return{slug:String(anime?.slug||'').slice(0,180),items};
}
export async function getAnimeThemes(id){
  const mediaId=Number(id);if(!Number.isSafeInteger(mediaId)||mediaId<=0)throw new Error('invalid media id');
  return cacheRemember(`anime-themes:${mediaId}`,6*3600,async()=>{
    const url=new URL(`${ANIMETHEMES_ENDPOINT}/anime`);
    url.searchParams.set('filter[has]','resources');url.searchParams.set('filter[site]','Anilist');url.searchParams.set('filter[external_id]',String(mediaId));
    url.searchParams.set('include','animethemes.animethemeentries.videos,animethemes.song.artists');url.searchParams.set('page[size]','1');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{const response=await fetch(url,{headers:{accept:'application/json','user-agent':'AniNexus/3.8'},credentials:'omit',redirect:'error',signal:controller.signal});if(!response.ok)throw new Error(`animethemes upstream ${response.status}`);const type=String(response.headers.get('content-type')||'');if(!type.includes('application/json'))throw new Error('invalid animethemes content type');const json=await response.json();return normalizeAnimeThemes(json?.anime?.[0])}finally{clearTimeout(timer)}
  },{staleTtl:3*86400});
}

const MEDIA_FIELDS = `id idMal title{romaji english native} synonyms coverImage{extraLarge large color} bannerImage description genres tags{name rank isMediaSpoiler} averageScore meanScore popularity favourites episodes duration format status season seasonYear countryOfOrigin source startDate{year month day} endDate{year month day} studios(isMain:true){nodes{id name}} nextAiringEpisode{airingAt episode timeUntilAiring} trailer{id site thumbnail} externalLinks{site url type icon color}`;
const MANGA_FIELDS = `id idMal title{romaji english native} synonyms coverImage{extraLarge large color} bannerImage description genres tags{name rank isMediaSpoiler} averageScore meanScore popularity favourites chapters volumes format status countryOfOrigin source startDate{year month day} endDate{year month day} externalLinks{site url type icon color}`;
const SORT_MAP={POPULAR:['POPULARITY_DESC'],SCORE:['SCORE_DESC'],TRENDING:['TRENDING_DESC'],NEW:['START_DATE_DESC'],TITLE:['TITLE_ROMAJI'],FAVOURITES:['FAVOURITES_DESC'],MATCH:['SEARCH_MATCH']};
const STATUSES=new Set(['RELEASING','FINISHED','NOT_YET_RELEASED','HIATUS','CANCELLED']);

export async function getCatalog(opts={}) {
  const page = Math.max(1,Math.min(200,Number(opts.page||1))), perPage=Math.max(1,Math.min(30,Number(opts.perPage||24)));
  const status=STATUSES.has(String(opts.status||''))?String(opts.status):null;
  const key='catalog:'+JSON.stringify({...opts,page,perPage,status});
  return cacheRemember(key, opts.search?60:300, async()=>{
    const query=`query($page:Int,$perPage:Int,$search:String,$genre:String,$format:MediaFormat,$season:MediaSeason,$year:Int,$status:MediaStatus,$sort:[MediaSort]){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage} media(type:ANIME,isAdult:false,search:$search,genre:$genre,format:$format,season:$season,seasonYear:$year,status:$status,sort:$sort){${MEDIA_FIELDS}}}}`;
    const data=await gql(query,{page,perPage,search:opts.search?String(opts.search).slice(0,120):null,genre:opts.genre?String(opts.genre).slice(0,80):null,format:opts.format||null,season:opts.season||null,year:opts.year?Number(opts.year):null,status,sort:SORT_MAP[opts.sort]||['POPULARITY_DESC']});
    return {pageInfo:data.Page.pageInfo,items:await annotateMedia(data.Page.media.map(normalizeMedia))};
  },{staleTtl:1800});
}

export async function getReading(opts={}) {
  const page=Math.max(1,Math.min(200,Number(opts.page||1))),perPage=Math.max(1,Math.min(30,Number(opts.perPage||24)));
  const format=['MANGA','NOVEL','ONE_SHOT'].includes(String(opts.format||''))?String(opts.format):null;
  const key='reading:'+JSON.stringify({...opts,page,perPage,format});
  return cacheRemember(key,opts.search?90:600,async()=>{
    const query=`query($page:Int,$perPage:Int,$search:String,$format:MediaFormat,$sort:[MediaSort]){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(type:MANGA,isAdult:false,search:$search,format:$format,sort:$sort){${MANGA_FIELDS}}}}`;
    const data=await gql(query,{page,perPage,search:opts.search?String(opts.search).slice(0,120):null,format,sort:SORT_MAP[opts.sort]||['POPULARITY_DESC']});
    return {pageInfo:data.Page.pageInfo,items:data.Page.media.map(m=>{const b=normalizeMedia(m);return {...b,chapters:m.chapters||null,volumes:m.volumes||null}})};
  },{staleTtl:3600});
}

export async function getManga(id) {
  const mediaId=Number(id);if(!Number.isSafeInteger(mediaId)||mediaId<=0)throw new Error('invalid media id');
  return cacheRemember(`manga:${mediaId}`,900,async()=>{
    const query=`query($id:Int){Media(id:$id,type:MANGA){${MANGA_FIELDS} relations{edges{relationType node{${MANGA_FIELDS}}}} recommendations(perPage:8,sort:RATING_DESC){nodes{rating mediaRecommendation{${MANGA_FIELDS}}}}}}`;
    const d=await gql(query,{id:mediaId}),m=d.Media,b=normalizeMedia(m);
    return {...b,chapters:m.chapters||null,volumes:m.volumes||null,relations:(m.relations?.edges||[]).slice(0,30).map(e=>({relationType:e.relationType,media:{...normalizeMedia(e.node),chapters:e.node.chapters||null,volumes:e.node.volumes||null}})),recommendations:(m.recommendations?.nodes||[]).slice(0,20).map(n=>({rating:n.rating,media:n.mediaRecommendation?{...normalizeMedia(n.mediaRecommendation),chapters:n.mediaRecommendation.chapters||null,volumes:n.mediaRecommendation.volumes||null}:null})).filter(x=>x.media)};
  },{staleTtl:86400});
}

export async function getSchedule(start,end) {
  const now=Math.floor(Date.now()/1000),safeStart=Math.max(now-14*86400,Number(start||now-3600)),safeEnd=Math.min(now+30*86400,Number(end||now+7*86400));
  if(!Number.isFinite(safeStart)||!Number.isFinite(safeEnd)||safeEnd<=safeStart||safeEnd-safeStart>31*86400)throw new Error('invalid schedule range');
  const key=`schedule:${safeStart}:${safeEnd}`;
  return cacheRemember(key,45,async()=>{
    const query=`query($page:Int,$start:Int,$end:Int){Page(page:$page,perPage:50){pageInfo{hasNextPage} airingSchedules(airingAt_greater:$start,airingAt_lesser:$end,sort:TIME){airingAt episode media{${MEDIA_FIELDS}}}}}`;
    let page=1,all=[];
    while(page<=5){const d=await gql(query,{page,start:safeStart,end:safeEnd});all.push(...d.Page.airingSchedules.map(a=>({airingAt:a.airingAt,episode:a.episode,media:normalizeMedia(a.media)})));if(!d.Page.pageInfo.hasNextPage)break;page++;}
    const annotated=await annotateMedia(all.map(item=>item.media)),byId=new Map(annotated.map(media=>[Number(media.id),media]));return all.map(item=>({...item,media:byId.get(Number(item.media?.id))||item.media}));
  },{staleTtl:12*3600});
}

export async function getAnime(id) {
  const mediaId=Number(id);if(!Number.isSafeInteger(mediaId)||mediaId<=0)throw new Error('invalid media id');
  return cacheRemember(`anime:${mediaId}`,600,async()=>{
    const query=`query($id:Int){Media(id:$id,type:ANIME){${MEDIA_FIELDS} characters(perPage:14,sort:[ROLE,RELEVANCE,ID]){edges{role node{id name{full native} image{large medium}}}} staff(perPage:12,sort:[RELEVANCE,ID]){edges{role node{id name{full native} image{large medium}}}} relations{edges{relationType node{${MEDIA_FIELDS}}} } recommendations(perPage:8,sort:RATING_DESC){nodes{rating mediaRecommendation{${MEDIA_FIELDS}}}}}}`;
    const d=await gql(query,{id:mediaId}),m=d.Media,base=normalizeMedia(m);
    const {rows}=await q('SELECT dubbed_pt_br,subtitle_pt_br,streaming,synopsis_pt_br,title_pt_br,editorial FROM media_annotations WHERE media_id=$1',[mediaId]).catch(()=>({rows:[]}));
    const a=rows[0]||{};
    const curatedStreaming=Array.isArray(a.streaming)?a.streaming.map(x=>({site:String(x?.site||'').slice(0,80),url:safeHttpsUrl(x?.url),icon:safeHttpsUrl(x?.icon),color:String(x?.color||'').slice(0,24),type:'STREAMING'})).filter(x=>x.url):[];
    return {...base,title:a.title_pt_br?String(a.title_pt_br).slice(0,300):base.title,description:a.synopsis_pt_br?String(a.synopsis_pt_br).slice(0,30_000):base.description,dubbed:!!a.dubbed_pt_br,subtitled:!!a.subtitle_pt_br,streaming:curatedStreaming.length?curatedStreaming:base.streaming,
      characters:(m.characters?.edges||[]).slice(0,20).map(e=>({role:e.role,id:e.node.id,name:String(e.node.name?.full||'').slice(0,180),native:String(e.node.name?.native||'').slice(0,180),image:safeHttpsUrl(e.node.image?.large||e.node.image?.medium)})),
      staff:(m.staff?.edges||[]).slice(0,20).map(e=>({role:String(e.role||'').slice(0,180),id:e.node.id,name:String(e.node.name?.full||'').slice(0,180),native:String(e.node.name?.native||'').slice(0,180),image:safeHttpsUrl(e.node.image?.large||e.node.image?.medium)})),
      relations:(m.relations?.edges||[]).slice(0,30).map(e=>({relationType:e.relationType,media:normalizeMedia(e.node)})),
      recommendations:(m.recommendations?.nodes||[]).slice(0,20).map(n=>({rating:n.rating,media:normalizeMedia(n.mediaRecommendation)})).filter(x=>x.media),editorial:(a.editorial&&typeof a.editorial==='object')?a.editorial:{}};
  },{staleTtl:86400});
}

export async function getStudios(page=1){
  const p=Math.max(1,Math.min(100,Number(page)||1));
  return cacheRemember(`studios:${p}`,3600,async()=>{const query=`query($page:Int){Page(page:$page,perPage:30){pageInfo{total currentPage lastPage hasNextPage} studios(sort:FAVOURITES_DESC){id name isAnimationStudio favourites media(perPage:6,sort:POPULARITY_DESC){nodes{${MEDIA_FIELDS}}}}}}`;const d=await gql(query,{page:p}),studios=d.Page.studios.filter(s=>s.isAnimationStudio).map(s=>({...s,name:String(s.name||'').slice(0,180),media:(s.media?.nodes||[]).map(normalizeMedia)})),annotated=await annotateMedia(studios.flatMap(studio=>studio.media)),byId=new Map(annotated.map(media=>[Number(media.id),media]));return{pageInfo:d.Page.pageInfo,items:studios.map(studio=>({...studio,media:studio.media.map(media=>byId.get(Number(media.id))||media)}))};},{staleTtl:86400});
}

export async function getDubbed(page=1){
  const p=Math.max(1,Math.min(1000,Number(page)||1));
  const {rows}=await q(`SELECT m.payload FROM media_annotations a JOIN media_cache m ON m.media_id=a.media_id WHERE a.dubbed_pt_br=true ORDER BY m.updated_at DESC LIMIT 24 OFFSET $1`,[(p-1)*24]);
  return{items:await annotateMedia(rows.map(row=>row.payload)),pageInfo:{currentPage:p,hasNextPage:rows.length===24}};
}

export async function prewarm() {
  const now=Math.floor(Date.now()/1000),end=now+7*86400;
  await Promise.allSettled([getSchedule(now-3600,end),getCatalog({page:1,sort:'TRENDING'}),getCatalog({page:1,sort:'POPULAR'}),getCatalog({page:1,sort:'SCORE'}),getReading({page:1,format:'MANGA'}),getReading({page:1,format:'NOVEL'})]);
  await cacheSet('prewarm:last',Date.now(),600);
}
