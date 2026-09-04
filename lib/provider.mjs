import { cacheRemember, cacheSet } from './cache.mjs';
import { q } from './db.mjs';
import { fetchAnimeScheduleTimetable } from './anime-schedule.mjs';

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
  const rows = [...mediaQueue.values()].slice(0,200); rows.forEach(x=>mediaQueue.delete(`${x.media_type}:${x.media_id}`));
  if (!rows.length) return;
  await q(`INSERT INTO media_cache(media_type,media_id,slug,payload,updated_at)
    SELECT media_type,media_id,slug,payload,now() FROM jsonb_to_recordset($1::jsonb) AS x(media_type text,media_id bigint,slug text,payload jsonb)
    ON CONFLICT(media_type,media_id) DO UPDATE SET slug=EXCLUDED.slug,payload=EXCLUDED.payload,updated_at=now()`,[JSON.stringify(rows)]).catch(()=>{});
  if (mediaQueue.size) mediaFlushTimer=setTimeout(flushMediaQueue,250).unref();
}
function queueMediaCache(base) {
  if (!base?.id || process.env.PERSIST_MEDIA_CACHE === 'false') return;
  const mediaType=base.mediaType==='MANGA'?'MANGA':'ANIME';
  const payload={...base};
  for(const field of ['score','meanScore','averageScore','ratingCount','listCount','popularity','favourites','metricsSource'])delete payload[field];
  mediaQueue.set(`${mediaType}:${base.id}`,{media_type:mediaType,media_id:base.id,slug:base.slug,payload});
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

function normalizeMedia(m, mediaType='ANIME') {
  if (!m) return null;
  const declaredType=String(m.type||'').toUpperCase();
  const resolvedMediaType=declaredType==='MANGA'?'MANGA':declaredType==='ANIME'?'ANIME':['MANGA','NOVEL','ONE_SHOT'].includes(String(m.format||'').toUpperCase())?'MANGA':mediaType==='MANGA'?'MANGA':'ANIME';
  const title = m.title?.english || m.title?.romaji || m.title?.native || 'Anime';
  const streaming = (m.externalLinks||[]).filter(x=>String(x.type||'').toUpperCase()==='STREAMING').map(x=>({site:String(x.site||'').slice(0,80),url:safeHttpsUrl(x.url),icon:safeHttpsUrl(x.icon),color:String(x.color||'').slice(0,24),type:'STREAMING'})).filter(x=>x.url);
  const tagDetails=(m.tags||[]).slice(0,24).map(t=>({name:String(t?.name||'').slice(0,120),rank:Number(t?.rank||0),isMediaSpoiler:!!t?.isMediaSpoiler})).filter(t=>t.name);
  const base = {
    id:m.id,idMal:m.idMal||null,mediaType:resolvedMediaType,slug:`${slugify(title)}-${m.id}`,title:String(title).slice(0,300),titleRomaji:String(m.title?.romaji||'').slice(0,300),titleNative:String(m.title?.native||'').slice(0,300),synonyms:(m.synonyms||[]).slice(0,30).map(x=>String(x).slice(0,300)),
    cover:safeHttpsUrl(m.coverImage?.extraLarge||m.coverImage?.large),coverColor:String(m.coverImage?.color||'#a61b38').slice(0,24),banner:safeHttpsUrl(m.bannerImage),
    description:strip(m.description),genres:(m.genres||[]).slice(0,30).map(x=>String(x).slice(0,80)),tags:tagDetails.slice(0,12).map(t=>t.name),tagDetails,
    score:null,meanScore:null,ratingCount:0,listCount:0,popularity:0,favourites:0,metricsSource:'aninexus',episodes:m.episodes||null,duration:m.duration||null,
    format:m.format||'',status:m.status||'',season:m.season||'',seasonYear:m.seasonYear||null,country:m.countryOfOrigin||'',source:m.source||'',
    startDate:m.startDate||null,endDate:m.endDate||null,studios:(m.studios?.nodes||[]).slice(0,30).map(s=>({id:s.id,name:String(s.name||'').slice(0,180)})),streaming,
    nextAiringEpisode:m.nextAiringEpisode ? {airingAt:m.nextAiringEpisode.airingAt,episode:m.nextAiringEpisode.episode,timeUntilAiring:m.nextAiringEpisode.timeUntilAiring} : null,
    trailer:m.trailer?.id ? {id:String(m.trailer.id).slice(0,120),site:String(m.trailer.site||'').slice(0,40),thumbnail:safeHttpsUrl(m.trailer.thumbnail)} : null,
  };
  queueMediaCache(base);
  return base;
}

async function annotateMedia(items=[],mediaType='ANIME') {
  const valid=(Array.isArray(items)?items:[]).filter(Boolean),ids=[...new Set(valid.map(item=>Number(item.id)).filter(Number.isSafeInteger))];
  if(!ids.length)return valid;
  const type=mediaType==='MANGA'?'MANGA':'ANIME',listTable=type==='MANGA'?'user_manga':'user_anime';
  const [metricResult,annotationResult]=await Promise.all([
    q(`WITH selected AS (SELECT unnest($1::bigint[]) media_id),
      list_stats AS (SELECT media_id,round(avg(score)::numeric,1) score,count(score)::int rating_count,count(*)::int list_count FROM ${listTable} WHERE media_id=ANY($1::bigint[]) GROUP BY media_id),
      favorite_stats AS (SELECT media_id,count(*)::int favorite_count FROM user_favorites WHERE media_type=$2 AND media_id=ANY($1::bigint[]) GROUP BY media_id),
      impression_stats AS (SELECT media_id,count(*)::int impression_count FROM impressions WHERE media_type=$2 AND hidden=false AND media_id=ANY($1::bigint[]) GROUP BY media_id)
      SELECT selected.media_id,list_stats.score,COALESCE(list_stats.rating_count,0)::int rating_count,COALESCE(list_stats.list_count,0)::int list_count,COALESCE(favorite_stats.favorite_count,0)::int favorite_count,COALESCE(impression_stats.impression_count,0)::int impression_count
      FROM selected LEFT JOIN list_stats USING(media_id) LEFT JOIN favorite_stats USING(media_id) LEFT JOIN impression_stats USING(media_id)`,[ids,type]).catch(()=>({rows:[]})),
    type==='ANIME'?q('SELECT media_id,dubbed_pt_br,subtitle_pt_br,streaming,synopsis_pt_br,title_pt_br,editorial FROM media_annotations WHERE media_id=ANY($1::bigint[])',[ids]).catch(()=>({rows:[]})):Promise.resolve({rows:[]})
  ]);
  const metrics=new Map(metricResult.rows.map(row=>{const listCount=Number(row.list_count||0),favourites=Number(row.favorite_count||0),impressions=Number(row.impression_count||0);return[Number(row.media_id),{score:row.score==null?null:Number(row.score),meanScore:row.score==null?null:Number(row.score),ratingCount:Number(row.rating_count||0),listCount,popularity:listCount+favourites*3+impressions*2,favourites,metricsSource:'aninexus'}]}));
  const annotations=new Map(annotationResult.rows.map(row=>[Number(row.media_id),row]));
  return valid.map(item=>{
    const metric=metrics.get(Number(item.id))||{score:null,meanScore:null,ratingCount:0,listCount:0,popularity:0,favourites:0,metricsSource:'aninexus'};
    const annotation=annotations.get(Number(item.id));if(!annotation)return{...item,...metric};
    const curatedStreaming=Array.isArray(annotation.streaming)?annotation.streaming.map(link=>({site:String(link?.site||'').slice(0,80),url:safeHttpsUrl(link?.url),icon:safeHttpsUrl(link?.icon),color:String(link?.color||'').slice(0,24),type:'STREAMING'})).filter(link=>link.url):[];
    return{...item,...metric,title:annotation.title_pt_br?String(annotation.title_pt_br).slice(0,300):item.title,description:annotation.synopsis_pt_br?String(annotation.synopsis_pt_br).slice(0,30_000):item.description,dubbed:!!annotation.dubbed_pt_br,subtitled:!!annotation.subtitle_pt_br,streaming:curatedStreaming.length?curatedStreaming:item.streaming,editorial:annotation.editorial&&typeof annotation.editorial==='object'?annotation.editorial:item.editorial||{}};
  });
}

function sortByInternalMetrics(items=[],sort='POPULAR'){
  const mode=String(sort||'POPULAR').toUpperCase();
  if(!['POPULAR','SCORE','TRENDING','FAVOURITES','MEMBERS'].includes(mode))return items;
  const rows=items.map((item,index)=>({item,index}));
  rows.sort((a,b)=>{
    const av=mode==='SCORE'?Number(a.item.score??-1):mode==='FAVOURITES'?Number(a.item.favourites||0):mode==='MEMBERS'?Number(a.item.listCount||0):Number(a.item.popularity||0);
    const bv=mode==='SCORE'?Number(b.item.score??-1):mode==='FAVOURITES'?Number(b.item.favourites||0):mode==='MEMBERS'?Number(b.item.listCount||0):Number(b.item.popularity||0);
    return bv-av||Number(b.item.ratingCount||0)-Number(a.item.ratingCount||0)||a.index-b.index;
  });
  return rows.map(row=>row.item);
}

const CATALOG_FALLBACK_SORT={
  POPULAR:dir=>`(COALESCE(stats.list_count,0)+COALESCE(fav.favorite_count,0)*3+COALESCE(imp.impression_count,0)*2) ${dir},mc.updated_at DESC,mc.media_id DESC`,
  SCORE:dir=>`COALESCE(stats.score,0) ${dir},COALESCE(stats.rating_count,0) ${dir},mc.updated_at DESC,mc.media_id DESC`,
  TRENDING:dir=>`GREATEST(stats.last_activity,fav.last_activity,imp.last_activity) ${dir} NULLS LAST,mc.updated_at DESC,mc.media_id DESC`,
  NEW:dir=>`mc.updated_at ${dir},mc.media_id DESC`,
  TITLE:dir=>`lower(COALESCE(mc.payload->>'title','')) ${dir},mc.updated_at DESC,mc.media_id DESC`,
  FAVOURITES:dir=>`COALESCE(fav.favorite_count,0) ${dir},COALESCE(stats.list_count,0) ${dir},mc.updated_at DESC,mc.media_id DESC`,
  MEMBERS:dir=>`COALESCE(stats.list_count,0) ${dir},COALESCE(fav.favorite_count,0) ${dir},mc.updated_at DESC,mc.media_id DESC`,
  MATCH:dir=>`(COALESCE(stats.list_count,0)+COALESCE(fav.favorite_count,0)*3+COALESCE(imp.impression_count,0)*2) ${dir},mc.updated_at DESC,mc.media_id DESC`,
};

const requestedDirection=value=>String(value||'DESC').toUpperCase()==='ASC'?'ASC':'DESC';

function catalogFallbackOrder(sort,direction){
  const mode=requestedSort(sort),dir=requestedDirection(direction);
  return (CATALOG_FALLBACK_SORT[mode]||CATALOG_FALLBACK_SORT.POPULAR)(dir);
}

async function cachedCatalog(opts,page,perPage,status){
  const search=String(opts.search||'').trim().slice(0,120)||null;
  const genre=String(opts.genre||'').trim().slice(0,80)||null;
  const format=String(opts.format||'').trim().slice(0,40)||null;
  const season=String(opts.season||'').trim().slice(0,20)||null;
  const year=Number.isSafeInteger(Number(opts.year))?Number(opts.year):null;
  const tag=String(opts.tag||'').trim().slice(0,120)||null;
  const sort=requestedSort(opts.sort),order=catalogFallbackOrder(sort,opts.direction);
  const communityOnly=opts.communityOnly===true||String(opts.communityOnly||'')==='1';
  const communityClause=communityOnly?(sort==='SCORE'?'AND COALESCE(stats.rating_count,0)>0':sort==='FAVOURITES'?'AND COALESCE(fav.favorite_count,0)>0':sort==='MEMBERS'?'AND COALESCE(stats.list_count,0)>0':'AND (COALESCE(stats.list_count,0)+COALESCE(fav.favorite_count,0)+COALESCE(imp.impression_count,0))>0'):'';
  const offset=(page-1)*perPage;
  const {rows}=await q(`SELECT mc.payload,count(*) OVER()::int AS total
    FROM media_cache mc
    LEFT JOIN (SELECT media_id,count(*)::int list_count,count(score)::int rating_count,avg(score) score,max(updated_at) last_activity FROM user_anime GROUP BY media_id) stats ON stats.media_id=mc.media_id
    LEFT JOIN (SELECT media_id,count(*)::int favorite_count,max(created_at) last_activity FROM user_favorites WHERE media_type='ANIME' GROUP BY media_id) fav ON fav.media_id=mc.media_id
    LEFT JOIN (SELECT media_id,count(*)::int impression_count,max(created_at) last_activity FROM impressions WHERE media_type='ANIME' AND hidden=false GROUP BY media_id) imp ON imp.media_id=mc.media_id
    WHERE mc.media_type='ANIME'
      AND COALESCE(mc.payload->>'mediaType','ANIME')='ANIME'
      AND COALESCE(mc.payload->>'format','') NOT IN ('MANGA','NOVEL','ONE_SHOT')
      AND ($1::text IS NULL OR mc.payload->>'status'=$1)
      AND ($2::text IS NULL OR mc.payload->>'format'=$2)
      AND ($3::text IS NULL OR mc.payload->>'season'=$3)
      AND ($4::int IS NULL OR CASE WHEN mc.payload->>'seasonYear' ~ '^[0-9]{4}$' THEN (mc.payload->>'seasonYear')::int END=$4)
      AND ($5::text IS NULL OR mc.payload->'genres' @> to_jsonb(ARRAY[$5]::text[]))
      AND ($6::text IS NULL OR lower(COALESCE(mc.payload->>'title','')||' '||COALESCE(mc.payload->>'titleRomaji','')||' '||COALESCE(mc.payload->>'titleNative','')) LIKE '%'||lower($6)||'%')
      AND ($7::text IS NULL OR mc.payload->'tags' @> to_jsonb(ARRAY[$7]::text[]))
      ${communityClause}
    ORDER BY ${order}
    LIMIT $8 OFFSET $9`,[status,format,season,year,genre,search,tag,perPage,offset]).catch(()=>({rows:[]}));
  const total=Number(rows[0]?.total||0);
  return{pageInfo:{total,currentPage:page,lastPage:Math.max(1,Math.ceil(total/perPage)),hasNextPage:offset+rows.length<total},items:await annotateMedia(rows.map(row=>row.payload).filter(Boolean))};
}

async function cachedReading(opts,page,perPage,format){
  const search=String(opts.search||'').trim().slice(0,120)||null;
  const order=catalogFallbackOrder(opts.sort,opts.direction);
  const offset=(page-1)*perPage;
  const {rows}=await q(`SELECT mc.payload,count(*) OVER()::int AS total
    FROM media_cache mc
    LEFT JOIN (SELECT media_id,count(*)::int list_count,count(score)::int rating_count,avg(score) score,max(updated_at) last_activity FROM user_manga GROUP BY media_id) stats ON stats.media_id=mc.media_id
    LEFT JOIN (SELECT media_id,count(*)::int favorite_count,max(created_at) last_activity FROM user_favorites WHERE media_type='MANGA' GROUP BY media_id) fav ON fav.media_id=mc.media_id
    LEFT JOIN (SELECT media_id,count(*)::int impression_count,max(created_at) last_activity FROM impressions WHERE media_type='MANGA' AND hidden=false GROUP BY media_id) imp ON imp.media_id=mc.media_id
    WHERE mc.media_type='MANGA'
      AND COALESCE(mc.payload->>'mediaType','MANGA')='MANGA'
      AND COALESCE(mc.payload->>'format','') IN ('MANGA','NOVEL','ONE_SHOT')
      AND ($1::text IS NULL OR mc.payload->>'format'=$1)
      AND ($2::text IS NULL OR lower(COALESCE(mc.payload->>'title','')||' '||COALESCE(mc.payload->>'titleRomaji','')||' '||COALESCE(mc.payload->>'titleNative','')) LIKE '%'||lower($2)||'%')
    ORDER BY ${order}
    LIMIT $3 OFFSET $4`,[format,search,perPage,offset]).catch(()=>({rows:[]}));
  const total=Number(rows[0]?.total||0),items=await annotateMedia(rows.map(row=>row.payload).filter(Boolean),'MANGA');
  return{pageInfo:{total,currentPage:page,lastPage:Math.max(1,Math.ceil(total/perPage)),hasNextPage:offset+items.length<total},items};
}

async function cachedSchedule(start,end){
  const safeStart=Math.floor(Number(start)),safeEnd=Math.ceil(Number(end));
  const {rows}=await q(`SELECT payload
    FROM media_cache
    WHERE media_type='ANIME'
      AND COALESCE(payload->>'mediaType','ANIME')='ANIME'
      AND payload->'nextAiringEpisode'->>'airingAt' ~ '^[0-9]+$'
      AND (payload->'nextAiringEpisode'->>'airingAt')::bigint BETWEEN $1 AND $2
    ORDER BY (payload->'nextAiringEpisode'->>'airingAt')::bigint ASC
    LIMIT 100`,[safeStart,safeEnd]).catch(()=>({rows:[]}));
  const items=rows.map(row=>{
    const media=row.payload,next=media?.nextAiringEpisode||{},airingAt=Number(next.airingAt),episode=Number(next.episode)||null;
    return Number.isFinite(airingAt)&&media?.id?{airingAt,episode,media}:null;
  }).filter(Boolean);
  const annotated=await annotateMedia(items.map(item=>item.media)),byId=new Map(annotated.map(media=>[Number(media.id),media]));
  return items.map(item=>({...item,media:byId.get(Number(item.media.id))||item.media}));
}

const scheduleTitleKey=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

async function reserveSchedule(start,end){
  const reserve=await fetchAnimeScheduleTimetable(start,end,{timeoutMs});
  if(!reserve.length)return[];
  const ids=[...new Set(reserve.map(item=>Number(item.anilistId)).filter(Number.isSafeInteger))];
  const aliases=[...new Set(reserve.flatMap(item=>[item.title,item.titleRomaji,item.titleEnglish,item.titleNative]).map(value=>String(value||'').trim().toLowerCase()).filter(Boolean))].slice(0,500);
  const {rows}=await q(`SELECT payload FROM media_cache
    WHERE media_type='ANIME' AND (
      media_id=ANY($1::bigint[])
      OR lower(COALESCE(payload->>'title',''))=ANY($2::text[])
      OR lower(COALESCE(payload->>'titleRomaji',''))=ANY($2::text[])
      OR lower(COALESCE(payload->>'titleNative',''))=ANY($2::text[])
    )
    ORDER BY updated_at DESC LIMIT 600`,[ids,aliases]).catch(()=>({rows:[]}));
  const byId=new Map(),byTitle=new Map();
  for(const row of rows){
    const media=row.payload;if(!media?.id)continue;
    byId.set(Number(media.id),media);
    const synonyms=Array.isArray(media.synonyms)?media.synonyms:[];
    for(const value of [media.title,media.titleRomaji,media.titleNative,...synonyms]){const key=scheduleTitleKey(value);if(key&&!byTitle.has(key))byTitle.set(key,media)}
  }
  const result=[];
  for(const item of reserve){
    const media=byId.get(Number(item.anilistId))||[item.title,item.titleRomaji,item.titleEnglish,item.titleNative].map(scheduleTitleKey).map(key=>byTitle.get(key)).find(Boolean);
    if(!media)continue;
    const merged={...media,
      idMal:media.idMal||item.idMal||null,
      title:media.title||item.titleEnglish||item.title,
      titleRomaji:media.titleRomaji||item.titleRomaji||item.title,
      titleNative:media.titleNative||item.titleNative||'',
      cover:media.cover||item.cover,
      genres:Array.isArray(media.genres)&&media.genres.length?media.genres:item.genres,
      episodes:media.episodes||item.episodes,
      duration:media.duration||item.duration,
      format:media.format||item.format,
      status:media.status||item.status,
      streaming:Array.isArray(media.streaming)&&media.streaming.length?media.streaming:item.streaming,
      nextAiringEpisode:{airingAt:item.airingAt,episode:item.episode,timeUntilAiring:Math.max(0,item.airingAt-Math.floor(Date.now()/1000))},
      contentProvider:item.contentProvider,
      contentProviderUrl:item.contentProviderUrl
    };
    queueMediaCache(merged);
    result.push({airingAt:item.airingAt,episode:item.episode,media:merged,contentProvider:item.contentProvider,contentProviderUrl:item.contentProviderUrl});
  }
  const decorated=await annotateMedia(result.map(item=>item.media)),decoratedById=new Map(decorated.map(media=>[Number(media.id),media]));
  return result.map(item=>({...item,media:decoratedById.get(Number(item.media.id))||item.media})).sort((a,b)=>a.airingAt-b.airingAt);
}

async function fallbackSchedule(start,end){
  const cached=await cachedSchedule(start,end);
  if(cached.length>=6||!process.env.ANIMESCHEDULE_API_TOKEN)return cached;
  const reserve=await reserveSchedule(start,end).catch(()=>[]);
  const merged=new Map();
  for(const item of [...cached,...reserve])merged.set(`${item.media?.id||0}:${item.airingAt}:${item.episode||0}`,item);
  return[...merged.values()].sort((a,b)=>a.airingAt-b.airingAt);
}

async function cachedMedia(id,mediaType='ANIME'){
  const type=mediaType==='MANGA'?'MANGA':'ANIME';
  const {rows}=await q('SELECT payload FROM media_cache WHERE media_type=$1 AND media_id=$2 LIMIT 1',[type,id]).catch(()=>({rows:[]}));
  const payload=rows[0]?.payload;if(!payload)return null;
  const [decorated]=await annotateMedia([payload],type);
  return decorated||null;
}

export async function getMediaSummaries(values=[], mediaType='ANIME') {
  const ids=[...new Set((Array.isArray(values)?values:[]).map(Number).filter(id=>Number.isSafeInteger(id)&&id>0))].slice(0,60);
  if(!ids.length)return[];
  const type=mediaType==='MANGA'?'MANGA':'ANIME';
  const cached=await q('SELECT media_id,payload FROM media_cache WHERE media_type=$2 AND media_id=ANY($1::bigint[])',[ids,type]).catch(()=>({rows:[]}));
  const found=new Map((cached.rows||[]).map(row=>[Number(row.media_id),row.payload]));
  const missing=ids.filter(id=>!found.has(id));
  if(missing.length){
    const query=`query($ids:[Int]){Page(page:1,perPage:60){media(id_in:$ids,type:${type},isAdult:false){${type==='MANGA'?MANGA_FIELDS:MEDIA_FIELDS}}}}`;
    const data=await gql(query,{ids:missing});
    for(const item of data?.Page?.media||[]){const normalized=normalizeMedia(item,type);if(normalized)found.set(Number(normalized.id),normalized)}
  }
  const items=ids.map(id=>found.get(id)).filter(Boolean);
  return annotateMedia(items,type);
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

const MEDIA_FIELDS = `id idMal type title{romaji english native} synonyms coverImage{extraLarge large color} bannerImage description genres tags{name rank isMediaSpoiler} episodes duration format status season seasonYear countryOfOrigin source startDate{year month day} endDate{year month day} studios(isMain:true){nodes{id name}} nextAiringEpisode{airingAt episode timeUntilAiring} trailer{id site thumbnail} externalLinks{site url type icon color}`;
const MANGA_FIELDS = `id idMal type title{romaji english native} synonyms coverImage{extraLarge large color} bannerImage description genres tags{name rank isMediaSpoiler} chapters volumes format status countryOfOrigin source startDate{year month day} endDate{year month day} externalLinks{site url type icon color}`;
// External providers supply discovery metadata only. Community metrics are always
// calculated from AniNexus activity and never imported from their rankings.
const SORT_MAP={POPULAR:['START_DATE_DESC'],SCORE:['START_DATE_DESC'],TRENDING:['START_DATE_DESC'],NEW:['START_DATE_DESC'],TITLE:['TITLE_ROMAJI'],FAVOURITES:['START_DATE_DESC'],MEMBERS:['START_DATE_DESC'],MATCH:['SEARCH_MATCH']};
const SORT_ALIASES={POPULARITY_DESC:'POPULAR',SCORE_DESC:'SCORE',TRENDING_DESC:'TRENDING',START_DATE_DESC:'NEW',TITLE_ROMAJI:'TITLE',FAVOURITES_DESC:'FAVOURITES',SEARCH_MATCH:'MATCH'};
const requestedSort=value=>{const sort=String(value||'POPULAR').toUpperCase();return SORT_MAP[sort]?sort:SORT_ALIASES[sort]||'POPULAR'};
const STATUSES=new Set(['RELEASING','FINISHED','NOT_YET_RELEASED','HIATUS','CANCELLED']);

function providerSort(sort,direction){
  const dir=requestedDirection(direction);
  if(sort==='MATCH')return['SEARCH_MATCH'];
  if(sort==='TITLE')return[dir==='ASC'?'TITLE_ROMAJI':'TITLE_ROMAJI_DESC'];
  if(sort==='NEW')return[dir==='ASC'?'START_DATE':'START_DATE_DESC'];
  return SORT_MAP[sort]||SORT_MAP.POPULAR;
}

function catalogVariables(opts,{page,perPage,status,sort}){
  const variables={page,perPage,sort:providerSort(sort,opts.direction)};
  const optional={
    search:opts.search?String(opts.search).slice(0,120):'',
    genre:opts.genre?String(opts.genre).slice(0,80):'',
    tag:opts.tag?String(opts.tag).slice(0,120):'',
    format:opts.format||'',season:opts.season||'',year:opts.year?Number(opts.year):null,status
  };
  for(const [key,value] of Object.entries(optional))if(value!==null&&value!=='')variables[key]=value;
  return variables;
}

export async function getCatalog(opts={}) {
  const page = Math.max(1,Math.min(500,Number(opts.page||1))), perPage=Math.max(1,Math.min(30,Number(opts.perPage||24)));
  const status=STATUSES.has(String(opts.status||''))?String(opts.status):null;
  const sort=requestedSort(opts.sort),metricSort=['POPULAR','SCORE','TRENDING','FAVOURITES','MEMBERS'].includes(sort);
  const communityOnly=opts.communityOnly===true||String(opts.communityOnly||'')==='1';
  const key='catalog:v5:'+JSON.stringify({...opts,page,perPage,status,sort,communityOnly});
  return cacheRemember(key, opts.search?60:300, async()=>{
    if(communityOnly)return cachedCatalog({...opts,communityOnly:true},page,perPage,status);
    if(metricSort&&!opts.search){const internal=await cachedCatalog(opts,page,perPage,status);if(internal.items.length>=Math.min(perPage,8))return internal;}
    try{
      const query=`query($page:Int,$perPage:Int,$search:String,$genre:String,$tag:String,$format:MediaFormat,$season:MediaSeason,$year:Int,$status:MediaStatus,$sort:[MediaSort]){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage} media(type:ANIME,isAdult:false,search:$search,genre:$genre,tag:$tag,format:$format,season:$season,seasonYear:$year,status:$status,sort:$sort){${MEDIA_FIELDS}}}}`;
      const data=await gql(query,catalogVariables(opts,{page,perPage,status,sort}));
      const result={pageInfo:data.Page.pageInfo,items:sortByInternalMetrics(await annotateMedia(data.Page.media.map(item=>normalizeMedia(item)),'ANIME'),sort)};
      if(result.items.length||page>Number(result.pageInfo?.lastPage||1)||Number(result.pageInfo?.total||0)===0)return result;
      const fallback=await cachedCatalog(opts,page,perPage,status);
      if(fallback.items.length)return fallback;
      return result;
    }catch(error){
      const fallback=await cachedCatalog(opts,page,perPage,status);
      if(fallback.items.length)return fallback;
      throw error;
    }
    return cachedCatalog(opts,page,perPage,status);
  },{staleTtl:1800});
}

export async function getReading(opts={}) {
  const page=Math.max(1,Math.min(500,Number(opts.page||1))),perPage=Math.max(1,Math.min(30,Number(opts.perPage||24)));
  const format=['MANGA','NOVEL','ONE_SHOT'].includes(String(opts.format||''))?String(opts.format):null;
  const sort=requestedSort(opts.sort),metricSort=['POPULAR','SCORE','TRENDING','FAVOURITES','MEMBERS'].includes(sort);
  const key='reading:v4:'+JSON.stringify({...opts,page,perPage,format,sort});
  return cacheRemember(key,opts.search?90:600,async()=>{
    if(metricSort&&!opts.search){const internal=await cachedReading(opts,page,perPage,format);if(internal.items.length>=Math.min(perPage,8))return internal;}
    try{
      const query=`query($page:Int,$perPage:Int,$search:String,$format:MediaFormat,$sort:[MediaSort]){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(type:MANGA,isAdult:false,search:$search,format:$format,sort:$sort){${MANGA_FIELDS}}}}`;
      const variables={page,perPage,sort:providerSort(sort,opts.direction)};
      if(opts.search)variables.search=String(opts.search).slice(0,120);
      if(format)variables.format=format;
      const data=await gql(query,variables);
      const normalized=data.Page.media.map(m=>{const b=normalizeMedia(m,'MANGA');return {...b,chapters:m.chapters||null,volumes:m.volumes||null}});
      const result={pageInfo:data.Page.pageInfo,items:sortByInternalMetrics(await annotateMedia(normalized,'MANGA'),sort)};
      if(result.items.length||page>1)return result;
    }catch(error){
      const fallback=await cachedReading(opts,page,perPage,format);
      if(fallback.items.length)return fallback;
      throw error;
    }
    return cachedReading(opts,page,perPage,format);
  },{staleTtl:3600});
}

export async function getManga(id) {
  const mediaId=Number(id);if(!Number.isSafeInteger(mediaId)||mediaId<=0)throw new Error('invalid media id');
  return cacheRemember(`manga:${mediaId}`,900,async()=>{
    try{
      const query=`query($id:Int){Media(id:$id,type:MANGA){${MANGA_FIELDS} relations{edges{relationType node{${MANGA_FIELDS}}}}}}`;
      const d=await gql(query,{id:mediaId}),m=d.Media,b=normalizeMedia(m,'MANGA'),[decorated]=await annotateMedia([{...b,chapters:m.chapters||null,volumes:m.volumes||null}],'MANGA');
      return {...decorated,relations:(m.relations?.edges||[]).slice(0,30).map(e=>({relationType:e.relationType,media:{...normalizeMedia(e.node,'MANGA'),chapters:e.node.chapters||null,volumes:e.node.volumes||null}})),recommendations:[]};
    }catch(error){
      const fallback=await cachedMedia(mediaId,'MANGA');
      if(fallback)return{...fallback,chapters:fallback.chapters||null,volumes:fallback.volumes||null,relations:[],recommendations:[]};
      throw error;
    }
  },{staleTtl:86400});
}

export async function getSchedule(start,end) {
  const now=Math.floor(Date.now()/1000),safeStart=Math.max(now-14*86400,Number(start||now-3600)),safeEnd=Math.min(now+30*86400,Number(end||now+7*86400));
  if(!Number.isFinite(safeStart)||!Number.isFinite(safeEnd)||safeEnd<=safeStart||safeEnd-safeStart>31*86400)throw new Error('invalid schedule range');
  // Five-minute buckets keep thousands of near-identical Home requests on one
  // upstream query while the final filter preserves each caller's exact range.
  const bucketStart=Math.floor(safeStart/300)*300,bucketEnd=Math.ceil(safeEnd/300)*300;
  const key=`schedule:v3:${bucketStart}:${bucketEnd}`;
  return cacheRemember(key,45,async()=>{
    try{
      const query=`query($page:Int,$start:Int,$end:Int){Page(page:$page,perPage:50){pageInfo{hasNextPage} airingSchedules(airingAt_greater:$start,airingAt_lesser:$end,sort:TIME){airingAt episode media{${MEDIA_FIELDS}}}}}`;
      let page=1,all=[];
      while(page<=5){const d=await gql(query,{page,start:bucketStart,end:bucketEnd});all.push(...d.Page.airingSchedules.map(a=>({airingAt:a.airingAt,episode:a.episode,media:normalizeMedia(a.media)})));if(!d.Page.pageInfo.hasNextPage)break;page++;}
      if(all.length){const annotated=await annotateMedia(all.map(item=>item.media)),byId=new Map(annotated.map(media=>[Number(media.id),media]));return all.map(item=>({...item,media:byId.get(Number(item.media?.id))||item.media}));}
    }catch(error){
      const fallback=await fallbackSchedule(bucketStart,bucketEnd);
      if(fallback.length)return fallback;
      throw error;
    }
    return fallbackSchedule(bucketStart,bucketEnd);
  },{staleTtl:12*3600}).then(items=>items.filter(item=>item.airingAt>=safeStart&&item.airingAt<=safeEnd));
}

export async function getAnime(id) {
  const mediaId=Number(id);if(!Number.isSafeInteger(mediaId)||mediaId<=0)throw new Error('invalid media id');
  return cacheRemember(`anime:${mediaId}`,600,async()=>{
    try{
      const query=`query($id:Int){Media(id:$id,type:ANIME){${MEDIA_FIELDS} characters(perPage:14,sort:[ROLE,RELEVANCE,ID]){edges{role node{id name{full native} image{large medium}}}} staff(perPage:12,sort:[RELEVANCE,ID]){edges{role node{id name{full native} image{large medium}}}} relations{edges{relationType node{${MEDIA_FIELDS}}}}}}`;
      const d=await gql(query,{id:mediaId}),m=d.Media,[base]=await annotateMedia([normalizeMedia(m)],'ANIME');
      return {...base,
        characters:(m.characters?.edges||[]).slice(0,20).map(e=>({role:e.role,id:e.node.id,name:String(e.node.name?.full||'').slice(0,180),native:String(e.node.name?.native||'').slice(0,180),image:safeHttpsUrl(e.node.image?.large||e.node.image?.medium)})),
        staff:(m.staff?.edges||[]).slice(0,20).map(e=>({role:String(e.role||'').slice(0,180),id:e.node.id,name:String(e.node.name?.full||'').slice(0,180),native:String(e.node.name?.native||'').slice(0,180),image:safeHttpsUrl(e.node.image?.large||e.node.image?.medium)})),
        relations:(m.relations?.edges||[]).slice(0,30).map(e=>({relationType:e.relationType,media:normalizeMedia(e.node)})),recommendations:[],editorial:base.editorial||{}};
    }catch(error){
      const fallback=await cachedMedia(mediaId,'ANIME');
      if(fallback)return{...fallback,characters:[],staff:[],relations:[],recommendations:[],editorial:fallback.editorial||{}};
      throw error;
    }
  },{staleTtl:86400});
}

export async function getStudios(page=1){
  const p=Math.max(1,Math.min(100,Number(page)||1));
  return cacheRemember(`studios:v2:${p}`,3600,async()=>{const query=`query($page:Int){Page(page:$page,perPage:30){pageInfo{total currentPage lastPage hasNextPage} studios(sort:ID_DESC){id name isAnimationStudio media(perPage:6,sort:START_DATE_DESC){nodes{${MEDIA_FIELDS}}}}}}`;const d=await gql(query,{page:p}),studios=d.Page.studios.filter(s=>s.isAnimationStudio).map(s=>({id:s.id,name:String(s.name||'').slice(0,180),media:(s.media?.nodes||[]).map(normalizeMedia)})),annotated=await annotateMedia(studios.flatMap(studio=>studio.media)),byId=new Map(annotated.map(media=>[Number(media.id),media]));return{pageInfo:d.Page.pageInfo,items:studios.map(studio=>({...studio,media:studio.media.map(media=>byId.get(Number(media.id))||media)}))};},{staleTtl:86400});
}

export async function getDubbed(page=1){
  const p=Math.max(1,Math.min(1000,Number(page)||1));
  const {rows}=await q(`SELECT m.payload FROM media_annotations a JOIN media_cache m ON m.media_id=a.media_id AND m.media_type='ANIME' WHERE a.dubbed_pt_br=true ORDER BY m.updated_at DESC LIMIT 24 OFFSET $1`,[(p-1)*24]);
  return{items:await annotateMedia(rows.map(row=>row.payload)),pageInfo:{currentPage:p,hasNextPage:rows.length===24}};
}

export async function prewarm() {
  const now=Math.floor(Date.now()/1000),end=now+7*86400;
  await Promise.allSettled([getSchedule(now-3600,end),getCatalog({page:1,sort:'TRENDING'}),getCatalog({page:1,sort:'POPULAR'}),getCatalog({page:1,sort:'SCORE'}),getCatalog({page:1,sort:'NEW'}),getReading({page:1,format:'MANGA'}),getReading({page:1,format:'NOVEL'}),getReading({page:1,sort:'NEW'})]);
  await cacheSet('prewarm:last',Date.now(),600);
}
