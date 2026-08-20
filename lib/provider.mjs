import { cacheRemember, cacheSet } from './cache.mjs';
import { q } from './db.mjs';

const ENDPOINT = process.env.CATALOG_GRAPHQL_ENDPOINT || 'https://graphql.anilist.co';
const timeoutMs = Number(process.env.UPSTREAM_TIMEOUT_MS || 9000);

async function gql(query, variables={}) {
  const ctl = new AbortController(); const timer = setTimeout(()=>ctl.abort(), timeoutMs);
  try {
    const res = await fetch(ENDPOINT,{method:'POST',headers:{'content-type':'application/json','accept':'application/json','user-agent':'AniNexus/1.0'},body:JSON.stringify({query,variables}),signal:ctl.signal});
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const json = await res.json(); if (json.errors?.length) throw new Error(json.errors[0].message);
    return json.data;
  } finally { clearTimeout(timer); }
}

const strip = s => String(s||'').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#039;/g,"'").trim();
export const slugify = s => String(s||'anime').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,90);

function normalizeMedia(m) {
  if (!m) return null;
  const title = m.title?.english || m.title?.romaji || m.title?.native || 'Anime';
  const streaming = (m.externalLinks||[]).filter(x=>String(x.type||'').toUpperCase()==='STREAMING').map(x=>({site:x.site,url:x.url,icon:x.icon,color:x.color}));
  const base = {
    id:m.id, slug:`${slugify(title)}-${m.id}`, title, titleRomaji:m.title?.romaji||'', titleNative:m.title?.native||'',
    cover:m.coverImage?.extraLarge||m.coverImage?.large||'', coverColor:m.coverImage?.color||'#a61b38', banner:m.bannerImage||'',
    description:strip(m.description), genres:m.genres||[], tags:(m.tags||[]).slice(0,12).map(t=>t.name), score:m.averageScore ? +(m.averageScore/10).toFixed(1) : null,
    popularity:m.popularity||0, favourites:m.favourites||0, episodes:m.episodes||null, duration:m.duration||null,
    format:m.format||'', status:m.status||'', season:m.season||'', seasonYear:m.seasonYear||null, country:m.countryOfOrigin||'', source:m.source||'',
    startDate:m.startDate||null, endDate:m.endDate||null, studios:(m.studios?.nodes||[]).map(s=>({id:s.id,name:s.name})), streaming,
    nextAiringEpisode:m.nextAiringEpisode ? {airingAt:m.nextAiringEpisode.airingAt,episode:m.nextAiringEpisode.episode,timeUntilAiring:m.nextAiringEpisode.timeUntilAiring} : null,
    trailer:m.trailer||null,
  };
  q(`INSERT INTO media_cache(media_id,slug,payload,updated_at) VALUES($1,$2,$3,now()) ON CONFLICT(media_id) DO UPDATE SET slug=EXCLUDED.slug,payload=EXCLUDED.payload,updated_at=now()`,[m.id,base.slug,base]).catch(()=>{});
  return base;
}

const MEDIA_FIELDS = `id title{romaji english native} coverImage{extraLarge large color} bannerImage description genres tags{name} averageScore popularity favourites episodes duration format status season seasonYear countryOfOrigin source startDate{year month day} endDate{year month day} studios(isMain:true){nodes{id name}} nextAiringEpisode{airingAt episode timeUntilAiring} trailer{id site thumbnail} externalLinks{site url type icon color}`;

export async function getCatalog(opts={}) {
  const page = Math.max(1,Math.min(200,Number(opts.page||1))), perPage=Math.max(1,Math.min(30,Number(opts.perPage||24)));
  const key='catalog:'+JSON.stringify({...opts,page,perPage});
  return cacheRemember(key, opts.search?60:300, async()=>{
    const query=`query($page:Int,$perPage:Int,$search:String,$genre:String,$format:MediaFormat,$season:MediaSeason,$year:Int,$sort:[MediaSort]){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage} media(type:ANIME,isAdult:false,search:$search,genre:$genre,format:$format,season:$season,seasonYear:$year,sort:$sort){${MEDIA_FIELDS}}}}`;
    const sortMap={POPULAR:['POPULARITY_DESC'],SCORE:['SCORE_DESC'],TRENDING:['TRENDING_DESC'],NEW:['START_DATE_DESC'],TITLE:['TITLE_ROMAJI']};
    const data=await gql(query,{page,perPage,search:opts.search||null,genre:opts.genre||null,format:opts.format||null,season:opts.season||null,year:opts.year?Number(opts.year):null,sort:sortMap[opts.sort]||['POPULARITY_DESC']});
    return {pageInfo:data.Page.pageInfo,items:data.Page.media.map(normalizeMedia)};
  });
}

export async function getSchedule(start,end) {
  const key=`schedule:${start}:${end}`;
  return cacheRemember(key, 45, async()=>{
    const query=`query($page:Int,$start:Int,$end:Int){Page(page:$page,perPage:50){pageInfo{hasNextPage} airingSchedules(airingAt_greater:$start,airingAt_lesser:$end,sort:TIME){airingAt episode media{${MEDIA_FIELDS}}}}}`;
    let page=1, all=[];
    while(page<=5){const d=await gql(query,{page,start,end}); all.push(...d.Page.airingSchedules.map(a=>({airingAt:a.airingAt,episode:a.episode,media:normalizeMedia(a.media)}))); if(!d.Page.pageInfo.hasNextPage) break; page++;}
    return all;
  });
}

export async function getAnime(id) {
  return cacheRemember(`anime:${id}`, 600, async()=>{
    const query=`query($id:Int){Media(id:$id,type:ANIME){${MEDIA_FIELDS} characters(perPage:12,sort:[ROLE,RELEVANCE,ID]){edges{role node{id name{full native} image{large medium}}}} staff(perPage:10,sort:[RELEVANCE,ID]){edges{role node{id name{full native} image{large medium}}}} relations{edges{relationType node{${MEDIA_FIELDS}}} } recommendations(perPage:8,sort:RATING_DESC){nodes{rating mediaRecommendation{${MEDIA_FIELDS}}}}}}`;
    const d=await gql(query,{id:Number(id)}), m=d.Media, base=normalizeMedia(m);
    const {rows}=await q('SELECT dubbed_pt_br,subtitle_pt_br,streaming,synopsis_pt_br,title_pt_br,editorial FROM media_annotations WHERE media_id=$1',[id]).catch(()=>({rows:[]}));
    const a=rows[0]||{};
    return {...base,title:a.title_pt_br||base.title,description:a.synopsis_pt_br||base.description,dubbed:!!a.dubbed_pt_br,subtitled:!!a.subtitle_pt_br,streaming:Array.isArray(a.streaming)&&a.streaming.length?a.streaming:base.streaming,
      characters:(m.characters?.edges||[]).map(e=>({role:e.role,id:e.node.id,name:e.node.name?.full||'',native:e.node.name?.native||'',image:e.node.image?.large||e.node.image?.medium||''})),
      staff:(m.staff?.edges||[]).map(e=>({role:e.role,id:e.node.id,name:e.node.name?.full||'',image:e.node.image?.large||e.node.image?.medium||''})),
      relations:(m.relations?.edges||[]).map(e=>({relationType:e.relationType,media:normalizeMedia(e.node)})),
      recommendations:(m.recommendations?.nodes||[]).map(n=>({rating:n.rating,media:normalizeMedia(n.mediaRecommendation)})).filter(x=>x.media), editorial:a.editorial||{}};
  });
}

export async function getStudios(page=1){
  return cacheRemember(`studios:${page}`,3600,async()=>{const query=`query($page:Int){Page(page:$page,perPage:30){pageInfo{total currentPage lastPage hasNextPage} studios(sort:FAVOURITES_DESC){id name isAnimationStudio favourites media(perPage:6,sort:POPULARITY_DESC){nodes{${MEDIA_FIELDS}}}}}}`;const d=await gql(query,{page:Number(page)});return {pageInfo:d.Page.pageInfo,items:d.Page.studios.filter(s=>s.isAnimationStudio).map(s=>({...s,media:(s.media?.nodes||[]).map(normalizeMedia)}))};});
}

export async function getDubbed(page=1){
  const {rows}=await q(`SELECT m.payload,a.dubbed_pt_br,a.subtitle_pt_br,a.streaming FROM media_annotations a JOIN media_cache m ON m.media_id=a.media_id WHERE a.dubbed_pt_br=true ORDER BY m.updated_at DESC LIMIT 24 OFFSET $1`,[(Math.max(1,page)-1)*24]);
  return {items:rows.map(r=>({...r.payload,dubbed:r.dubbed_pt_br,subtitled:r.subtitle_pt_br,streaming:r.streaming||r.payload.streaming})),pageInfo:{currentPage:Number(page),hasNextPage:rows.length===24}};
}

export async function prewarm() {
  const now=Math.floor(Date.now()/1000), end=now+7*86400;
  await Promise.allSettled([getSchedule(now-3600,end),getCatalog({page:1,sort:'TRENDING'}),getCatalog({page:1,sort:'POPULAR'}),getCatalog({page:1,sort:'SCORE'})]);
  await cacheSet('prewarm:last',Date.now(),600);
}
