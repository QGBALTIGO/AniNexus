import { cacheGet, cacheRemember, cacheSet } from './cache.mjs';
import { q } from './db.mjs';
import { fetchAnimeScheduleTimetable } from './anime-schedule.mjs';
import { load as loadHtml } from 'cheerio';

const ENDPOINT = process.env.CATALOG_GRAPHQL_ENDPOINT || 'https://graphql.anilist.co';
const ANIMETHEMES_ENDPOINT = process.env.ANIMETHEMES_API_ENDPOINT || 'https://api.animethemes.moe';
const JIKAN_ENDPOINT = process.env.JIKAN_API_ENDPOINT || 'https://api.jikan.moe/v4';
const KITSU_ENDPOINT = process.env.KITSU_API_ENDPOINT || 'https://kitsu.io/api/edge';
const MAL_ENDPOINT = 'https://myanimelist.net';
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
    ON CONFLICT(media_type,media_id) DO UPDATE SET slug=EXCLUDED.slug,payload=media_cache.payload || EXCLUDED.payload,updated_at=now()`,[JSON.stringify(rows)]).catch(()=>{});
  if (mediaQueue.size) mediaFlushTimer=setTimeout(flushMediaQueue,250).unref();
}
function queueMediaCache(base) {
  if (!base?.id || process.env.PERSIST_MEDIA_CACHE === 'false') return;
  const mediaType=base.mediaType==='MANGA'?'MANGA':'ANIME';
  const payload={...base};
  for(const field of ['score','meanScore','averageScore','ratingCount','listCount','popularity','favourites','metricsSource'])delete payload[field];
  // Catalog refreshes only contain the media summary. Do not let one of those
  // refreshes erase a richer roster previously obtained by a detail request.
  if(!payload.rosterVersion){
    if(!Array.isArray(payload.characters)||!payload.characters.length)delete payload.characters;
    if(!Array.isArray(payload.staff)||!payload.staff.length)delete payload.staff;
  }
  const key=`${mediaType}:${base.id}`,queued=mediaQueue.get(key);
  mediaQueue.set(key,{media_type:mediaType,media_id:base.id,slug:base.slug||queued?.slug,payload:{...(queued?.payload||{}),...payload}});
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

async function jikanJson(path) {
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),Math.min(timeoutMs,7000));
  try{
    const res=await fetch(`${JIKAN_ENDPOINT}${path}`,{headers:{accept:'application/json','user-agent':'AniNexus/3.8'},credentials:'omit',redirect:'error',signal:ctl.signal});
    if(!res.ok)throw new Error(`jikan upstream ${res.status}`);
    const type=String(res.headers.get('content-type')||'');if(!type.includes('application/json'))throw new Error('invalid jikan content type');
    return await res.json();
  }finally{clearTimeout(timer)}
}

async function kitsuJson(path) {
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),Math.min(timeoutMs,7000));
  try{
    const res=await fetch(`${KITSU_ENDPOINT}${path}`,{headers:{accept:'application/vnd.api+json','user-agent':'AniNexus/3.8'},credentials:'omit',redirect:'error',signal:ctl.signal});
    if(!res.ok)throw new Error(`kitsu upstream ${res.status}`);
    const type=String(res.headers.get('content-type')||'');if(!type.includes('application/vnd.api+json')&&!type.includes('application/json'))throw new Error('invalid kitsu content type');
    return await res.json();
  }finally{clearTimeout(timer)}
}

async function malCharactersPage(malId,mediaType='ANIME'){
  const id=Number(malId);if(!Number.isSafeInteger(id)||id<=0)throw new Error('invalid MAL id');
  const prefix=mediaType==='MANGA'?'manga':'anime',ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),Math.min(timeoutMs,7000));
  try{
    const res=await fetch(`${MAL_ENDPOINT}/${prefix}/${id}/_/characters`,{headers:{accept:'text/html','user-agent':'Mozilla/5.0 (compatible; AniNexus/3.8; +https://aninexus.com.br)'},credentials:'omit',redirect:'error',signal:ctl.signal});
    if(!res.ok)throw new Error(`MAL upstream ${res.status}`);
    const type=String(res.headers.get('content-type')||'');if(!type.includes('text/html'))throw new Error('invalid MAL content type');
    const length=Number(res.headers.get('content-length')||0);if(length>2_000_000)throw new Error('MAL response too large');
    const html=await res.text();if(html.length>2_000_000)throw new Error('MAL response too large');return html;
  }finally{clearTimeout(timer)}
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
    ...(m.relations ? {relationTypes:[...new Set((m.relations.edges||[]).map(edge=>edge.relationType).filter(Boolean))]} : {}),
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
  const metrics=new Map(metricResult.rows.map(row=>{const listCount=Number(row.list_count||0),favourites=Number(row.favorite_count||0),impressionCount=Number(row.impression_count||0);return[Number(row.media_id),{score:row.score==null?null:Number(row.score),meanScore:row.score==null?null:Number(row.score),ratingCount:Number(row.rating_count||0),listCount,impressionCount,popularity:listCount*4+favourites*3+impressionCount*2,favourites,metricsSource:'aninexus'}]}));
  const annotations=new Map(annotationResult.rows.map(row=>[Number(row.media_id),row]));
  return valid.map(item=>{
    const metric=metrics.get(Number(item.id))||{score:null,meanScore:null,ratingCount:0,listCount:0,impressionCount:0,popularity:0,favourites:0,metricsSource:'aninexus'};
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
    return bv-av
      ||(mode==='MEMBERS'?Number(b.item.impressionCount||0)-Number(a.item.impressionCount||0):0)
      ||Number(b.item.ratingCount||0)-Number(a.item.ratingCount||0)
      ||Number(b.item.score||0)-Number(a.item.score||0)
      ||Number(b.item.favourites||0)-Number(a.item.favourites||0)
      ||a.index-b.index;
  });
  return rows.map(row=>row.item);
}

const CATALOG_FALLBACK_SORT={
  DISCOVER:dir=>`(COALESCE(stats.list_count,0)*4+COALESCE(fav.favorite_count,0)*3+COALESCE(imp.impression_count,0)*2) ${dir},mc.updated_at DESC,mc.media_id DESC`,
  POPULAR:dir=>`(COALESCE(stats.list_count,0)*4+COALESCE(fav.favorite_count,0)*3+COALESCE(imp.impression_count,0)*2) ${dir},GREATEST(stats.last_activity,fav.last_activity,imp.last_activity) ${dir} NULLS LAST,COALESCE(imp.impression_count,0) ${dir},COALESCE(stats.rating_count,0) ${dir},mc.updated_at DESC,mc.media_id DESC`,
  SCORE:dir=>`COALESCE(stats.score,0) ${dir},COALESCE(stats.rating_count,0) ${dir},COALESCE(stats.list_count,0) ${dir},COALESCE(imp.impression_count,0) ${dir},COALESCE(fav.favorite_count,0) ${dir},mc.updated_at DESC,mc.media_id DESC`,
  TRENDING:dir=>`GREATEST(stats.last_activity,fav.last_activity,imp.last_activity) ${dir} NULLS LAST,mc.updated_at DESC,mc.media_id DESC`,
  NEW:dir=>`mc.updated_at ${dir},mc.media_id DESC`,
  TITLE:dir=>`lower(COALESCE(mc.payload->>'title','')) ${dir},mc.updated_at DESC,mc.media_id DESC`,
  FAVOURITES:dir=>`COALESCE(fav.favorite_count,0) ${dir},COALESCE(stats.list_count,0) ${dir},mc.updated_at DESC,mc.media_id DESC`,
  MEMBERS:dir=>`COALESCE(stats.list_count,0) ${dir},COALESCE(imp.impression_count,0) ${dir},COALESCE(stats.rating_count,0) ${dir},COALESCE(stats.score,0) ${dir},COALESCE(fav.favorite_count,0) ${dir},mc.updated_at DESC,mc.media_id DESC`,
  MATCH:dir=>`(COALESCE(stats.list_count,0)*4+COALESCE(fav.favorite_count,0)*3+COALESCE(imp.impression_count,0)*2) ${dir},mc.updated_at DESC,mc.media_id DESC`,
};

const requestedDirection=value=>String(value||'DESC').toUpperCase()==='ASC'?'ASC':'DESC';
const requestedDiscoveryMinimum=value=>Math.max(0,Math.min(100_000,Number(value)||0));
const isPresentableDiscoveryMedia=media=>{
  const cover=String(media?.cover||'');
  const title=String(media?.title||'').trim();
  return Boolean(cover)
    && !/\/(?:medium|large)\/default\.(?:jpe?g|png|webp)(?:$|\?)/i.test(cover)
    && !/^\(?title to be announced\)?$/i.test(title)
    && !/\b(?:provisional title|untitled project)\b/i.test(title);
};

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
  const discover=requestedDiscoveryMinimum(opts.discover)>0;
  const communityOnly=opts.communityOnly===true||String(opts.communityOnly||'')==='1';
  const communityClause=communityOnly?(sort==='SCORE'?'AND COALESCE(stats.rating_count,0)>0':sort==='FAVOURITES'?'AND COALESCE(fav.favorite_count,0)>0':sort==='MEMBERS'?'AND COALESCE(stats.list_count,0)>0':'AND (COALESCE(stats.list_count,0)+COALESCE(fav.favorite_count,0)+COALESCE(imp.impression_count,0))>0'):'';
  const discoveryClause=discover?`AND COALESCE(mc.payload->>'cover','')<>''
      AND COALESCE(mc.payload->>'cover','') NOT LIKE '%/default.%'
      AND lower(COALESCE(mc.payload->>'title','')) !~ '(title to be announced|provisional title|untitled project)'`:'';
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
      ${discoveryClause}
    ORDER BY ${order}
    LIMIT $8 OFFSET $9`,[status,format,season,year,genre,search,tag,perPage,offset]).catch(()=>({rows:[]}));
  const total=Number(rows[0]?.total||0);
  return{pageInfo:{total,currentPage:page,lastPage:Math.max(1,Math.ceil(total/perPage)),hasNextPage:offset+rows.length<total},items:await annotateMedia(rows.map(row=>row.payload).filter(Boolean))};
}

async function cachedReading(opts,page,perPage,format){
  const search=String(opts.search||'').trim().slice(0,120)||null;
  const status=STATUSES.has(String(opts.status||''))?String(opts.status):null;
  const year=Number.isSafeInteger(Number(opts.year))?Number(opts.year):null;
  const genre=String(opts.genre||'').trim().slice(0,80)||null;
  const tag=String(opts.tag||'').trim().slice(0,120)||null;
  const sort=requestedSort(opts.sort),order=catalogFallbackOrder(sort,opts.direction);
  const communityOnly=opts.communityOnly===true||String(opts.communityOnly||'')==='1';
  const discover=requestedDiscoveryMinimum(opts.discover)>0;
  const communityClause=communityOnly?(sort==='SCORE'?'AND COALESCE(stats.rating_count,0)>0':sort==='FAVOURITES'?'AND COALESCE(fav.favorite_count,0)>0':sort==='MEMBERS'?'AND COALESCE(stats.list_count,0)>0':'AND (COALESCE(stats.list_count,0)+COALESCE(fav.favorite_count,0)+COALESCE(imp.impression_count,0))>0'):'';
  const discoveryClause=discover?`AND COALESCE(mc.payload->>'cover','')<>''
      AND COALESCE(mc.payload->>'cover','') NOT LIKE '%/default.%'
      AND lower(COALESCE(mc.payload->>'title','')) !~ '(title to be announced|provisional title|untitled project)'`:'';
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
      AND ($2::text IS NULL OR mc.payload->>'status'=$2)
      AND ($3::int IS NULL OR CASE WHEN mc.payload->'startDate'->>'year' ~ '^[0-9]{4}$' THEN (mc.payload->'startDate'->>'year')::int END=$3)
      AND ($4::text IS NULL OR mc.payload->'genres' @> to_jsonb(ARRAY[$4]::text[]))
      AND ($5::text IS NULL OR lower(COALESCE(mc.payload->>'title','')||' '||COALESCE(mc.payload->>'titleRomaji','')||' '||COALESCE(mc.payload->>'titleNative','')) LIKE '%'||lower($5)||'%')
      AND ($6::text IS NULL OR mc.payload->'tags' @> to_jsonb(ARRAY[$6]::text[]))
      ${communityClause}
      ${discoveryClause}
    ORDER BY ${order}
    LIMIT $7 OFFSET $8`,[format,status,year,genre,search,tag,perPage,offset]).catch(()=>({rows:[]}));
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

async function detailFallbackBase(id,mediaType='ANIME'){
  const type=mediaType==='MANGA'?'MANGA':'ANIME',[persisted,legacy]=await Promise.all([cachedMedia(id,type),cacheGet(`${type.toLowerCase()}:v2:${id}`)]);
  if(!persisted)return legacy&&String(legacy.mediaType||type).toUpperCase()===type?legacy:null;
  if(!legacy)return persisted;
  const richer=(field,valid=value=>Array.isArray(value)&&value.length)=>valid(persisted[field])?persisted[field]:valid(legacy[field])?legacy[field]:persisted[field];
  return{...persisted,characters:richer('characters'),staff:richer('staff'),relations:richer('relations'),recommendations:richer('recommendations')};
}

const jikanMediaType=value=>String(value||'').toLowerCase()==='anime'?'ANIME':'MANGA';
const jikanRelationType=value=>({
  sequel:'SEQUEL',prequel:'PREQUEL',adaptation:'ADAPTATION','alternative version':'ALTERNATIVE',
  'side story':'SIDE_STORY','parent story':'PARENT',summary:'SUMMARY','spin-off':'SPIN_OFF',character:'CHARACTER'
}[String(value||'').toLowerCase()]||'OTHER');

async function resolveJikanMedia(entries=[]){
  const refs=(Array.isArray(entries)?entries:[]).map(entry=>({type:jikanMediaType(entry?.type),malId:Number(entry?.mal_id)})).filter(ref=>Number.isSafeInteger(ref.malId)&&ref.malId>0);
  const resolved=new Map();
  for(const type of ['ANIME','MANGA']){
    const ids=[...new Set(refs.filter(ref=>ref.type===type).map(ref=>String(ref.malId)))];if(!ids.length)continue;
    const {rows}=await q("SELECT payload FROM media_cache WHERE media_type=$1 AND payload->>'idMal'=ANY($2::text[]) ORDER BY updated_at DESC",[type,ids]).catch(()=>({rows:[]}));
    const decorated=await annotateMedia((rows||[]).map(row=>row.payload).filter(Boolean),type);
    for(const media of decorated)if(media?.idMal)resolved.set(`${type}:${Number(media.idMal)}`,media);
  }
  return resolved;
}

async function similarCachedMedia(base,mediaType='ANIME',limit=12){
  const genres=(base?.genres||[]).filter(Boolean).slice(0,4);if(!genres.length)return[];
  const type=mediaType==='MANGA'?'MANGA':'ANIME';
  const {rows}=await q(`SELECT payload FROM media_cache
    WHERE media_type=$1 AND media_id<>$2 AND payload->'genres' ?| $3::text[]
    ORDER BY (SELECT count(*) FROM jsonb_array_elements_text(COALESCE(payload->'genres','[]'::jsonb)) genre WHERE genre=ANY($3::text[])) DESC,updated_at DESC
    LIMIT $4`,[type,Number(base.id),genres,Math.max(1,Math.min(20,Number(limit)||12))]).catch(()=>({rows:[]}));
  return annotateMedia((rows||[]).map(row=>row.payload).filter(Boolean),type);
}

const LEGACY_COMPANY_ROLES=new Set(['estúdio','produção','licenciamento']);
const usableCachedStaff=rows=>(Array.isArray(rows)?rows:[]).filter(row=>row?.name&&!LEGACY_COMPANY_ROLES.has(String(row.role||'').trim().toLowerCase()));
const mergeRoster=(primary=[],secondary=[],limit=20)=>{
  const merged=[],seen=new Set();
  for(const row of [...(Array.isArray(primary)?primary:[]),...(Array.isArray(secondary)?secondary:[])]){
    const name=String(row?.name||'').trim(),key=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    if(!name||seen.has(key))continue;seen.add(key);merged.push(row);if(merged.length>=limit)break;
  }
  return merged;
};

export function normalizeJikanStaff(rows=[]){
  return(Array.isArray(rows)?rows:[]).slice(0,30).map(row=>({
    role:(Array.isArray(row?.positions)?row.positions:[]).map(position=>String(position||'').trim()).filter(Boolean).join(', ').slice(0,180)||'Equipe',
    id:Number(row?.person?.mal_id)||0,name:String(row?.person?.name||'').slice(0,180),native:'',
    image:safeHttpsUrl(row?.person?.images?.webp?.image_url||row?.person?.images?.jpg?.image_url)
  })).filter(row=>row.name).slice(0,20);
}

export function normalizeJikanAuthors(rows=[]){
  return(Array.isArray(rows)?rows:[]).map(row=>({
    role:String(row?.type||'Autoria').slice(0,180),id:Number(row?.mal_id)||0,name:String(row?.name||'').slice(0,180),native:'',image:''
  })).filter(row=>row.name).slice(0,20);
}

export function normalizeKitsuRoster(payload={},kind='characters'){
  const relation=kind==='staff'?'person':'character',included=new Map((Array.isArray(payload?.included)?payload.included:[]).map(item=>[`${item?.type}:${item?.id}`,item]));
  return(Array.isArray(payload?.data)?payload.data:[]).map(link=>{
    const ref=link?.relationships?.[relation]?.data,node=included.get(`${ref?.type}:${ref?.id}`),attributes=node?.attributes||{};
    const name=String(attributes.canonicalName||attributes.name||attributes.names?.en||attributes.names?.en_jp||'').slice(0,180);
    return kind==='staff'?{
      role:String(link?.attributes?.role||'Equipe').slice(0,180),id:Number(attributes.malId)||Number(ref?.id)||0,name,native:'',image:safeHttpsUrl(attributes.image?.large||attributes.image?.original)
    }:{
      role:String(link?.attributes?.role||'supporting').toUpperCase()==='MAIN'?'MAIN':'SUPPORTING',id:Number(attributes.malId)||Number(ref?.id)||0,name,
      native:String(attributes.names?.ja_jp||'').slice(0,180),image:safeHttpsUrl(attributes.image?.large||attributes.image?.original),voiceActor:null
    };
  }).filter(row=>row.name).slice(0,20);
}

const malPersonName=value=>{
  const clean=String(value||'').replace(/\s+/g,' ').trim(),parts=clean.split(',').map(part=>part.trim()).filter(Boolean);
  return(parts.length===2?`${parts[1]} ${parts[0]}`:clean).slice(0,180);
};
const malEntityId=(value,kind)=>Number(String(value||'').match(new RegExp(`/${kind}/(\\d+)`))?.[1])||0;
const malImage=value=>{
  const raw=String(value||'');if(!raw||/questionmark/i.test(raw))return'';
  return safeHttpsUrl(raw.replace(/\/r\/\d+x\d+\//,'/').replace(/\?.*$/,''));
};
const malStaffPriority=role=>/Director|Composition|Script|Screenplay|Storyboard/i.test(role)?0:/Design|Animation|Music|Sound/i.test(role)?1:/Creator|Original|Art/i.test(role)?2:/Producer/i.test(role)?5:3;

export function normalizeMalRoster(html='',mediaType='ANIME'){
  const $=loadHtml(String(html||'')),type=mediaType==='MANGA'?'MANGA':'ANIME',characters=[];
  $(`table.${type==='MANGA'?'js-manga-character-table':'js-anime-character-table'}`).each((_,table)=>{
    const link=$(table).find('a[href*="/character/"]').first(),href=link.attr('href')||'',name=malPersonName($(table).find('.h3_character_name').first().text()||link.attr('title')||link.find('img').attr('alt'));
    if(!name||!href)return;const info=$(table).children('tbody').children('tr').first().children('td').eq(1),role=info.find('.spaceit_pad').map((__,row)=>$(row).text().replace(/\s+/g,' ').trim()).get().find(value=>/^(?:Main|Supporting)$/i.test(value))||'';
    const japanese=$(table).find('table tr').filter((__,row)=>/\bJapanese\b/i.test($(row).text())).first(),voiceLink=japanese.find('a[href*="/people/"]').first(),voiceName=malPersonName(voiceLink.text().trim()||voiceLink.find('img').attr('alt'));
    characters.push({role:/\bMain\b/i.test(role)?'MAIN':'SUPPORTING',id:malEntityId(href,'character'),name,native:'',image:malImage(link.find('img').attr('data-src')||link.find('img').attr('src')),voiceActor:voiceName?{language:'Japanese',person:{mal_id:malEntityId(voiceLink.attr('href'),'people'),name:voiceName,images:{jpg:{image_url:malImage(voiceLink.find('img').attr('data-src')||voiceLink.find('img').attr('src'))}}}}:null});
  });
  characters.sort((a,b)=>(a.role==='MAIN'?0:1)-(b.role==='MAIN'?0:1));
  const staff=[];
  if(type==='ANIME'){
    const staffHeading=$('h2').filter((_,heading)=>$(heading).text().trim()==='Staff').first();
    staffHeading.parent().nextAll('table').each((_,table)=>{const link=$(table).find('a[href*="/people/"]').first(),href=link.attr('href')||'',name=malPersonName(link.text().trim()||link.find('img').attr('alt')),role=$(table).find('.spaceit_pad small').first().text().replace(/\s+/g,' ').trim();if(name&&href)staff.push({role:role||'Equipe',id:malEntityId(href,'people'),name,native:'',image:malImage(link.find('img').attr('data-src')||link.find('img').attr('src'))})});
  }else{
    $('span.dark_text').filter((_,label)=>/^Authors?:/i.test($(label).text().trim())).each((_,label)=>{const row=$(label).parent(),text=row.text().replace(/\s+/g,' ').trim(),role=text.match(/\(([^)]+)\)/)?.[1]||'Autoria';row.find('a[href*="/people/"]').each((__,link)=>{const href=$(link).attr('href')||'',name=malPersonName($(link).text());if(name)staff.push({role,id:malEntityId(href,'people'),name,native:'',image:''})})});
  }
  staff.sort((a,b)=>malStaffPriority(a.role)-malStaffPriority(b.role));
  return{characters:mergeRoster(characters,[]),staff:mergeRoster(staff,[])};
}

const upstreamRemember=(key,fn,ttl=21600)=>cacheRemember(key,ttl,fn,{staleTtl:604800});
async function enrichFromKitsu(base,mediaType='ANIME'){
  const type=mediaType==='MANGA'?'MANGA':'ANIME',prefix=type.toLowerCase(),malId=Number(base?.idMal);
  if(!Number.isSafeInteger(malId)||malId<=0)return{characters:[],staff:[]};
  const params=new URLSearchParams({'filter[externalSite]':`myanimelist/${prefix}`,'filter[externalId]':String(malId),include:'item'});
  const mapping=await upstreamRemember(`kitsu-map:v1:${type}:${malId}`,()=>kitsuJson(`/mappings?${params}`),86400).catch(()=>null);
  const ref=(mapping?.data||[]).map(row=>row?.relationships?.item?.data).find(item=>item?.type===prefix&&Number(item.id)>0);
  if(!ref)return{characters:[],staff:[]};
  const [charactersResult,staffResult]=await Promise.allSettled([
    upstreamRemember(`kitsu-characters:v1:${type}:${ref.id}`,()=>kitsuJson(`/${prefix}/${ref.id}/${prefix}-characters?include=character&page%5Blimit%5D=20`)),
    upstreamRemember(`kitsu-staff:v1:${type}:${ref.id}`,()=>kitsuJson(`/${prefix}/${ref.id}/${prefix}-staff?include=person&page%5Blimit%5D=20`))
  ]);
  return{
    characters:charactersResult.status==='fulfilled'?normalizeKitsuRoster(charactersResult.value,'characters'):[],
    staff:staffResult.status==='fulfilled'?normalizeKitsuRoster(staffResult.value,'staff'):[]
  };
}

async function enrichFromMal(base,mediaType='ANIME'){
  const type=mediaType==='MANGA'?'MANGA':'ANIME',malId=Number(base?.idMal);if(!Number.isSafeInteger(malId)||malId<=0)return{characters:[],staff:[]};
  const html=await upstreamRemember(`mal-roster:v1:${type}:${malId}`,()=>malCharactersPage(malId,type));return normalizeMalRoster(html,type);
}

async function enrichFromJikan(base,mediaType='ANIME'){
  const type=mediaType==='MANGA'?'MANGA':'ANIME',malId=Number(base?.idMal);
  if(!Number.isSafeInteger(malId)||malId<=0){
    const similar=await similarCachedMedia(base,type),out={...base,rosterVersion:2,staff:usableCachedStaff(base.staff),recommendations:similar.map(media=>({rating:0,media}))};queueMediaCache(out);return out;
  }
  const prefix=type==='MANGA'?'manga':'anime',sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const kitsuPromise=enrichFromKitsu(base,type).catch(()=>({characters:[],staff:[]}));
  const malPromise=enrichFromMal(base,type).catch(()=>({characters:[],staff:[]}));
  const [fullResult,charactersResult,staffResult,recommendationsResult]=await Promise.allSettled([
      upstreamRemember(`jikan-full:v3:${type}:${malId}`,()=>jikanJson(`/${prefix}/${malId}/full`)),
      upstreamRemember(`jikan-characters:v3:${type}:${malId}`,()=>jikanJson(`/${prefix}/${malId}/characters`)),
      type==='ANIME'?upstreamRemember(`jikan-staff:v3:${type}:${malId}`,()=>jikanJson(`/${prefix}/${malId}/staff`)):Promise.resolve({data:[]}),
      sleep(1050).then(()=>upstreamRemember(`jikan-recommendations:v3:${type}:${malId}`,()=>jikanJson(`/${prefix}/${malId}/recommendations`)))
    ]);
    const full=fullResult.status==='fulfilled'?fullResult.value?.data:null;
    const characterRows=charactersResult.status==='fulfilled'&&Array.isArray(charactersResult.value?.data)?charactersResult.value.data:[];
    const staffRows=staffResult.status==='fulfilled'&&Array.isArray(staffResult.value?.data)?staffResult.value.data:[];
    const recommendationRows=recommendationsResult.status==='fulfilled'&&Array.isArray(recommendationsResult.value?.data)?recommendationsResult.value.data:[];
    const relationRows=(full?.relations||[]).flatMap(group=>(group?.entry||[]).map(entry=>({relationType:jikanRelationType(group?.relation),entry})));
    const referenced=await resolveJikanMedia([...relationRows.map(row=>row.entry),...recommendationRows.map(row=>row.entry)]);
    const characters=characterRows.slice(0,20).map(row=>({
      role:String(row?.role||'Supporting').toUpperCase()==='MAIN'?'MAIN':'SUPPORTING',id:Number(row?.character?.mal_id)||0,
      name:String(row?.character?.name||'').slice(0,180),native:'',image:safeHttpsUrl(row?.character?.images?.webp?.image_url||row?.character?.images?.jpg?.image_url),
      voiceActor:type==='ANIME'?(row?.voice_actors||[]).find(actor=>String(actor?.language||'').toLowerCase()==='japanese')||row?.voice_actors?.[0]||null:null
    })).filter(row=>row.name);
    const staff=type==='ANIME'?normalizeJikanStaff(staffRows):normalizeJikanAuthors(full?.authors||[]);
    const relations=relationRows.map(row=>{const refType=jikanMediaType(row.entry?.type),media=referenced.get(`${refType}:${Number(row.entry?.mal_id)}`);return media?{relationType:row.relationType,media}:null}).filter(Boolean).slice(0,30);
    let recommendations=recommendationRows.map(row=>{const refType=jikanMediaType(row.entry?.type),media=referenced.get(`${refType}:${Number(row.entry?.mal_id)}`);return media?{rating:Number(row.votes)||0,media}:null}).filter(Boolean).slice(0,12);
    if(!recommendations.length)recommendations=(await similarCachedMedia(base,type)).map(media=>({rating:0,media}));
    const [kitsu,mal]=await Promise.all([kitsuPromise,malPromise]),baseStaff=usableCachedStaff(base.staff);
    const out={...base,rosterVersion:2,
      characters:mergeRoster(characters,mergeRoster(base.characters,mergeRoster(kitsu.characters,mal.characters))),
      staff:mergeRoster(staff,mergeRoster(baseStaff,mergeRoster(kitsu.staff,mal.staff))),
      relations:relations.length?relations:(base.relations||[]),
      recommendations:recommendations.length?recommendations:(base.recommendations||[])
    };
    queueMediaCache(out);return out;
}

export async function getMediaSummaries(values=[], mediaType='ANIME') {
  const ids=[...new Set((Array.isArray(values)?values:[]).map(Number).filter(id=>Number.isSafeInteger(id)&&id>0))].slice(0,60);
  if(!ids.length)return[];
  const type=mediaType==='MANGA'?'MANGA':'ANIME';
  const cached=await q('SELECT media_id,payload FROM media_cache WHERE media_type=$2 AND media_id=ANY($1::bigint[])',[ids,type]).catch(()=>({rows:[]}));
  const found=new Map((cached.rows||[]).map(row=>[Number(row.media_id),row.payload]));
  const missing=ids.filter(id=>!found.has(id));
  if(missing.length){
    try{
      const query=`query($ids:[Int]){Page(page:1,perPage:60){media(id_in:$ids,type:${type},isAdult:false){${type==='MANGA'?MANGA_FIELDS:MEDIA_FIELDS}}}}`;
      const data=await gql(query,{ids:missing});
      for(const item of data?.Page?.media||[]){const normalized=normalizeMedia(item,type);if(normalized)found.set(Number(normalized.id),normalized)}
    }catch{}
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
const SORT_MAP={DISCOVER:['POPULARITY_DESC'],POPULAR:['START_DATE_DESC'],SCORE:['START_DATE_DESC'],TRENDING:['START_DATE_DESC'],NEW:['START_DATE_DESC'],TITLE:['TITLE_ROMAJI'],FAVOURITES:['START_DATE_DESC'],MEMBERS:['START_DATE_DESC'],MATCH:['SEARCH_MATCH']};
const SORT_ALIASES={POPULARITY_DESC:'DISCOVER',SCORE_DESC:'SCORE',TRENDING_DESC:'TRENDING',START_DATE_DESC:'NEW',TITLE_ROMAJI:'TITLE',FAVOURITES_DESC:'FAVOURITES',SEARCH_MATCH:'MATCH'};
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
  if(opts.season)variables.sort=[...variables.sort,'ID'];
  const optional={
    search:opts.search?String(opts.search).slice(0,120):'',
    genre:opts.genre?String(opts.genre).slice(0,80):'',
    tag:opts.tag?String(opts.tag).slice(0,120):'',
    format:opts.format||'',season:opts.season||'',year:opts.year?Number(opts.year):null,status,
    minimumPopularity:requestedDiscoveryMinimum(opts.discover)||null
  };
  for(const [key,value] of Object.entries(optional))if(value!==null&&value!=='')variables[key]=value;
  return variables;
}

export async function getCatalog(opts={}) {
  const page = Math.max(1,Math.min(500,Number(opts.page||1))), perPage=Math.max(1,Math.min(30,Number(opts.perPage||24)));
  const status=STATUSES.has(String(opts.status||''))?String(opts.status):null;
  const sort=requestedSort(opts.sort),metricSort=['POPULAR','SCORE','TRENDING','FAVOURITES','MEMBERS'].includes(sort);
  const communityOnly=opts.communityOnly===true||String(opts.communityOnly||'')==='1';
  const key='catalog:v7:'+JSON.stringify({...opts,page,perPage,status,sort,communityOnly});
  return cacheRemember(key, opts.search?60:300, async()=>{
    if(communityOnly)return cachedCatalog({...opts,communityOnly:true},page,perPage,status);
    if(metricSort&&!opts.search){const internal=await cachedCatalog(opts,page,perPage,status);if(internal.items.length>=Math.min(perPage,8))return internal;}
    try{
      const query=`query($page:Int,$perPage:Int,$search:String,$genre:String,$tag:String,$format:MediaFormat,$season:MediaSeason,$year:Int,$status:MediaStatus,$sort:[MediaSort],$minimumPopularity:Int){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage} media(type:ANIME,isAdult:false,search:$search,genre:$genre,tag:$tag,format:$format,season:$season,seasonYear:$year,status:$status,popularity_greater:$minimumPopularity,sort:$sort){${MEDIA_FIELDS} ${opts.season?'relations{edges{relationType}}':''}}}}`;
      const data=await gql(query,catalogVariables(opts,{page,perPage,status,sort}));
      const normalized=data.Page.media.map(item=>normalizeMedia(item));
      const visible=requestedDiscoveryMinimum(opts.discover)>0?normalized.filter(isPresentableDiscoveryMedia):normalized;
      const result={pageInfo:data.Page.pageInfo,items:sortByInternalMetrics(await annotateMedia(visible,'ANIME'),sort)};
      if(result.items.length||page>Number(result.pageInfo?.lastPage||1)||Number(result.pageInfo?.total||0)===0)return result;
      const fallback=await cachedCatalog(opts,page,perPage,status);
      if(fallback.items.length)return opts.season?{...fallback,pageInfo:{...fallback.pageInfo,isFallback:true}}:fallback;
      return result;
    }catch(error){
      const fallback=await cachedCatalog(opts,page,perPage,status);
      if(fallback.items.length)return opts.season?{...fallback,pageInfo:{...fallback.pageInfo,isFallback:true}}:fallback;
      throw error;
    }
    return cachedCatalog(opts,page,perPage,status);
  },{staleTtl:1800});
}

export async function getReading(opts={}) {
  const page=Math.max(1,Math.min(500,Number(opts.page||1))),perPage=Math.max(1,Math.min(30,Number(opts.perPage||24)));
  const format=['MANGA','NOVEL','ONE_SHOT'].includes(String(opts.format||''))?String(opts.format):null;
  const status=STATUSES.has(String(opts.status||''))?String(opts.status):null;
  const sort=requestedSort(opts.sort),metricSort=['POPULAR','SCORE','TRENDING','FAVOURITES','MEMBERS'].includes(sort);
  const communityOnly=opts.communityOnly===true||String(opts.communityOnly||'')==='1';
  const key='reading:v5:'+JSON.stringify({...opts,page,perPage,format,status,sort,communityOnly});
  return cacheRemember(key,opts.search?90:600,async()=>{
    if(communityOnly)return cachedReading({...opts,communityOnly:true},page,perPage,format);
    if(metricSort&&!opts.search){const internal=await cachedReading(opts,page,perPage,format);if(internal.items.length>=Math.min(perPage,8))return internal;}
    try{
      const query=`query($page:Int,$perPage:Int,$search:String,$genre:String,$tag:String,$format:MediaFormat,$status:MediaStatus,$startDateGreater:FuzzyDateInt,$startDateLesser:FuzzyDateInt,$minimumPopularity:Int,$sort:[MediaSort]){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(type:MANGA,isAdult:false,search:$search,genre:$genre,tag:$tag,format:$format,status:$status,startDate_greater:$startDateGreater,startDate_lesser:$startDateLesser,popularity_greater:$minimumPopularity,sort:$sort){${MANGA_FIELDS}}}}`;
      const variables={page,perPage,sort:providerSort(sort,opts.direction)};
      if(opts.search)variables.search=String(opts.search).slice(0,120);
      if(opts.genre)variables.genre=String(opts.genre).slice(0,80);
      if(opts.tag)variables.tag=String(opts.tag).slice(0,120);
      if(format)variables.format=format;
      if(status)variables.status=status;
      if(Number.isSafeInteger(Number(opts.year))){variables.startDateGreater=Number(opts.year)*10000;variables.startDateLesser=Number(opts.year)*10000+1231;}
      if(requestedDiscoveryMinimum(opts.discover))variables.minimumPopularity=requestedDiscoveryMinimum(opts.discover);
      const data=await gql(query,variables);
      const normalized=data.Page.media.map(m=>{const b=normalizeMedia(m,'MANGA');return {...b,chapters:m.chapters||null,volumes:m.volumes||null}});
      const visible=requestedDiscoveryMinimum(opts.discover)>0?normalized.filter(isPresentableDiscoveryMedia):normalized;
      const result={pageInfo:data.Page.pageInfo,items:sortByInternalMetrics(await annotateMedia(visible,'MANGA'),sort)};
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
  return cacheRemember(`manga:v3:${mediaId}`,900,async()=>{
    try{
      const query=`query($id:Int){Media(id:$id,type:MANGA){${MANGA_FIELDS} characters(perPage:20,sort:[ROLE,RELEVANCE,ID]){edges{role node{id name{full native} image{large medium}}}} staff(perPage:20,sort:[RELEVANCE,ID]){edges{role node{id name{full native} image{large medium}}}} relations{edges{relationType node{${MANGA_FIELDS}}}} recommendations(perPage:12,sort:RATING_DESC){nodes{rating mediaRecommendation{${MANGA_FIELDS}}}}}}`;
      const d=await gql(query,{id:mediaId}),m=d.Media,b=normalizeMedia(m,'MANGA'),[decorated]=await annotateMedia([{...b,chapters:m.chapters||null,volumes:m.volumes||null}],'MANGA');
      const result={...decorated,rosterVersion:2,
        characters:(m.characters?.edges||[]).slice(0,20).map(e=>({role:e.role,id:e.node.id,name:String(e.node.name?.full||'').slice(0,180),native:String(e.node.name?.native||'').slice(0,180),image:safeHttpsUrl(e.node.image?.large||e.node.image?.medium)})),
        staff:(m.staff?.edges||[]).slice(0,20).map(e=>({role:String(e.role||'').slice(0,180),id:e.node.id,name:String(e.node.name?.full||'').slice(0,180),native:String(e.node.name?.native||'').slice(0,180),image:safeHttpsUrl(e.node.image?.large||e.node.image?.medium)})),
        relations:(m.relations?.edges||[]).slice(0,30).map(e=>({relationType:e.relationType,media:{...normalizeMedia(e.node,e.node?.type==='ANIME'?'ANIME':'MANGA'),chapters:e.node.chapters||null,volumes:e.node.volumes||null}})),
        recommendations:(m.recommendations?.nodes||[]).filter(node=>node?.mediaRecommendation).slice(0,12).map(node=>({rating:Number(node.rating)||0,media:normalizeMedia(node.mediaRecommendation,node.mediaRecommendation?.type==='ANIME'?'ANIME':'MANGA')}))};
      queueMediaCache(result);return result;
    }catch(error){
      const fallback=await detailFallbackBase(mediaId,'MANGA');
      if(fallback)return enrichFromJikan({...fallback,chapters:fallback.chapters||null,volumes:fallback.volumes||null,characters:fallback.characters||[],staff:fallback.staff||[],relations:fallback.relations||[],recommendations:fallback.recommendations||[]},'MANGA');
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
  return cacheRemember(`anime:v3:${mediaId}`,600,async()=>{
    try{
      const query=`query($id:Int){Media(id:$id,type:ANIME){${MEDIA_FIELDS} characters(perPage:20,sort:[ROLE,RELEVANCE,ID]){edges{role node{id name{full native} image{large medium}}}} staff(perPage:20,sort:[RELEVANCE,ID]){edges{role node{id name{full native} image{large medium}}}} relations{edges{relationType node{${MEDIA_FIELDS}}}} recommendations(perPage:12,sort:RATING_DESC){nodes{rating mediaRecommendation{${MEDIA_FIELDS}}}}}}`;
      const d=await gql(query,{id:mediaId}),m=d.Media,[base]=await annotateMedia([normalizeMedia(m)],'ANIME');
      const result={...base,rosterVersion:2,
        characters:(m.characters?.edges||[]).slice(0,20).map(e=>({role:e.role,id:e.node.id,name:String(e.node.name?.full||'').slice(0,180),native:String(e.node.name?.native||'').slice(0,180),image:safeHttpsUrl(e.node.image?.large||e.node.image?.medium)})),
        staff:(m.staff?.edges||[]).slice(0,20).map(e=>({role:String(e.role||'').slice(0,180),id:e.node.id,name:String(e.node.name?.full||'').slice(0,180),native:String(e.node.name?.native||'').slice(0,180),image:safeHttpsUrl(e.node.image?.large||e.node.image?.medium)})),
        relations:(m.relations?.edges||[]).slice(0,30).map(e=>({relationType:e.relationType,media:normalizeMedia(e.node,e.node?.type==='MANGA'?'MANGA':'ANIME')})),
        recommendations:(m.recommendations?.nodes||[]).filter(node=>node?.mediaRecommendation).slice(0,12).map(node=>({rating:Number(node.rating)||0,media:normalizeMedia(node.mediaRecommendation,node.mediaRecommendation?.type==='MANGA'?'MANGA':'ANIME')})),editorial:base.editorial||{}};
      queueMediaCache(result);return result;
    }catch(error){
      const fallback=await detailFallbackBase(mediaId,'ANIME');
      if(fallback)return enrichFromJikan({...fallback,characters:fallback.characters||[],staff:fallback.staff||[],relations:fallback.relations||[],recommendations:fallback.recommendations||[],editorial:fallback.editorial||{}},'ANIME');
      throw error;
    }
  },{staleTtl:86400});
}

const mediaRecency=media=>Number(media?.seasonYear||media?.startDate?.year||0)*10_000+Number(media?.startDate?.month||0)*100+Number(media?.startDate?.day||0);

export function studiosFromCachedMedia(rows=[],page=1,perPage=12){
  const p=Math.max(1,Math.min(100,Number(page)||1)),size=Math.max(1,Math.min(30,Number(perPage)||12)),grouped=new Map();
  for(const row of Array.isArray(rows)?rows:[]){
    const media=row?.payload&&typeof row.payload==='object'?row.payload:row;
    if(!media?.id||!Array.isArray(media.studios))continue;
    const seen=new Set();
    for(const source of media.studios){
      const id=Number(source?.id),name=String(source?.name||'').trim().slice(0,180);
      if(!Number.isSafeInteger(id)||id<=0||!name||seen.has(id))continue;
      seen.add(id);
      if(!grouped.has(id))grouped.set(id,{id,name,media:new Map()});
      grouped.get(id).media.set(Number(media.id),media);
    }
  }
  const all=[...grouped.values()].map(studio=>{
    const media=[...studio.media.values()].sort((a,b)=>mediaRecency(b)-mediaRecency(a)||Number(b.id||0)-Number(a.id||0));
    return{id:studio.id,name:studio.name,mediaTotal:media.length,media:media.slice(0,12)};
  }).filter(studio=>studio.media.length).sort((a,b)=>b.mediaTotal-a.mediaTotal||a.name.localeCompare(b.name,'pt-BR'));
  const total=all.length,offset=(p-1)*size,lastPage=Math.max(1,Math.ceil(total/size));
  return{items:all.slice(offset,offset+size),pageInfo:{total,currentPage:p,lastPage,hasNextPage:offset+size<total}};
}

async function cachedStudios(page){
  const {rows}=await q(`SELECT payload FROM media_cache WHERE media_type='ANIME' AND jsonb_typeof(payload->'studios')='array' ORDER BY updated_at DESC LIMIT 5000`).catch(()=>({rows:[]}));
  return studiosFromCachedMedia(rows,page,12);
}

export async function getStudios(page=1){
  const p=Math.max(1,Math.min(100,Number(page)||1));
  return cacheRemember(`studios:v4:${p}`,3600,async()=>{
    try{
      const query=`query($page:Int){Page(page:$page,perPage:12){pageInfo{total currentPage lastPage hasNextPage} studios(sort:FAVOURITES_DESC){id name isAnimationStudio media(perPage:12,sort:START_DATE_DESC){pageInfo{total} nodes{${MEDIA_FIELDS}}}}}}`;
      const d=await gql(query,{page:p});
      const studios=d.Page.studios.filter(s=>s.isAnimationStudio).map(s=>({
        id:s.id,
        name:String(s.name||'').slice(0,180),
        mediaTotal:Number(s.media?.pageInfo?.total||s.media?.nodes?.length||0),
        media:(s.media?.nodes||[]).map(normalizeMedia)
      }));
      const annotated=await annotateMedia(studios.flatMap(studio=>studio.media));
      const byId=new Map(annotated.map(media=>[Number(media.id),media]));
      return{pageInfo:d.Page.pageInfo,items:studios.map(studio=>({...studio,media:studio.media.map(media=>byId.get(Number(media.id))||media)}))};
    }catch(error){
      const fallback=await cachedStudios(p);
      if(fallback.items.length)return fallback;
      throw error;
    }
  },{staleTtl:86400});
}

const DUBBED_FALLBACK_IDS=[154587,101922,21,171018,16498,151807,813,5114,20,127230,21459,1535,269,11061,21519,21087,1254,199,113415,161645];
export async function getDubbed(page=1){
  const p=Math.max(1,Math.min(1000,Number(page)||1)),perPage=24;
  const {rows}=await q(`SELECT m.payload FROM media_annotations a JOIN media_cache m ON m.media_id=a.media_id AND m.media_type='ANIME' WHERE a.dubbed_pt_br=true ORDER BY m.updated_at DESC LIMIT 2000`).catch(()=>({rows:[]}));
  const curated=await annotateMedia(rows.map(row=>row.payload));
  const merged=new Map(curated.map(item=>[Number(item.id),item]));
  const fallback=await getMediaSummaries(DUBBED_FALLBACK_IDS,'ANIME').catch(()=>[]);
  for(const item of fallback)if(!merged.has(Number(item.id)))merged.set(Number(item.id),{...item,dubbed:true});
  const all=[...merged.values()],offset=(p-1)*perPage,total=all.length;
  return{items:all.slice(offset,offset+perPage),pageInfo:{total,currentPage:p,lastPage:Math.max(1,Math.ceil(total/perPage)),hasNextPage:offset+perPage<total}};
}

export async function prewarm() {
  const now=Math.floor(Date.now()/1000),end=now+7*86400;
  await Promise.allSettled([getSchedule(now-3600,end),getCatalog({page:1,sort:'TRENDING'}),getCatalog({page:1,sort:'POPULAR'}),getCatalog({page:1,sort:'SCORE'}),getCatalog({page:1,sort:'NEW'}),getReading({page:1,format:'MANGA'}),getReading({page:1,format:'NOVEL'}),getReading({page:1,sort:'NEW'})]);
  await cacheSet('prewarm:last',Date.now(),600);
}
