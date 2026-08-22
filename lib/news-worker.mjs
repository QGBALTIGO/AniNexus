import { initDb, q, pool } from './db.mjs';
import { initCache, redis } from './cache.mjs';
import { getCatalog, getSchedule } from './provider.mjs';
import { articleExpiry } from './native-news.mjs';
import {
  cleanText,slugify,sha,safeUrl,canonicalUrl,sourceFingerprint,storyFingerprint,
  classifyNews,splitFacts,extractHtmlMetadata,mergeSources,buildEditorialArticle,qualityScore
} from './news-core.mjs';

const INTERVAL_MS=Math.max(60_000,Number(process.env.NEWS_WORKER_INTERVAL_MS||300_000));
const RETENTION_DAYS=Math.max(2,Math.min(14,Number(process.env.NEWS_RETENTION_DAYS||5)));
const MAX_PER_SOURCE=Math.max(4,Math.min(24,Number(process.env.NEWS_MAX_PER_SOURCE||12)));
const ENRICH_LIMIT=Math.max(2,Math.min(12,Number(process.env.NEWS_ENRICH_PER_SOURCE||6)));
const MAX_SOURCE_AGE_HOURS=Math.max(24,Math.min(168,Number(process.env.NEWS_MAX_SOURCE_AGE_HOURS||120)));
const UA='AniNexus-NewsBot/3.0 (+https://aninexus.seudominio.com)';
const TRANSLATE=process.env.NEWS_TRANSLATE_ENDPOINT||'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=pt&dt=t&q=';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const iso=value=>{const d=new Date(value);return Number.isNaN(d.getTime())?'':d.toISOString()};
const abs=(value,base)=>{try{return new URL(value,base).href}catch{return safeUrl(value)}};

async function get(url,type='text',timeout=12_000){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const r=await fetch(url,{signal:controller.signal,headers:{'user-agent':UA,accept:type==='json'?'application/json':'text/html,application/xml;q=0.9,*/*;q=0.8'}});
    if(!r.ok)throw new Error(`${url}: ${r.status}`);
    return type==='json'?r.json():r.text();
  }finally{clearTimeout(timer)}
}

async function translatePt(value){
  const text=cleanText(value,4200);if(!text)return'';
  const key=`news:pt:${sha(text,28)}`;
  try{const cached=await redis?.get?.(key);if(cached)return cached}catch{}
  let out=text;
  try{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7500);
    const r=await fetch(TRANSLATE+encodeURIComponent(text),{signal:controller.signal,headers:{'user-agent':UA}}).finally(()=>clearTimeout(timer));
    if(r.ok){const j=await r.json();out=cleanText((j?.[0]||[]).map(x=>x?.[0]||'').join(''),4200)||text}
  }catch{}
  try{await redis?.set?.(key,out,{EX:60*60*24*14})}catch{}
  return out;
}

async function translatePair(title,summary){
  const marker=' <<<ANINEXUS_SEP>>> ';
  const translated=await translatePt(`${cleanText(title,800)}${marker}${cleanText(summary,3000)}`);
  const parts=translated.split(/\s*<<<ANINEXUS_SEP>>>\s*/);
  return{title:cleanText(parts[0]||title,220),summary:cleanText(parts.slice(1).join(' ')||summary,1200)};
}

async function translateFacts(facts=[]){
  const source=splitFacts(facts,6);if(!source.length)return[];
  const marker=' <<<ANINEXUS_FACT>>> ';
  const translated=await translatePt(source.join(marker));
  return translated.split(/\s*<<<ANINEXUS_FACT>>>\s*/).map(x=>cleanText(x,480)).filter(x=>x.length>=18).slice(0,6);
}

function rssTag(xml,tag){
  const m=String(xml||'').match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,'i'));
  return m?cleanText(m[1].replace(/<!\[CDATA\[|\]\]>/g,''),1800):'';
}

function imageFrom(v){
  if(!v)return'';if(typeof v==='string')return safeUrl(v);if(Array.isArray(v))return imageFrom(v[0]);
  if(typeof v==='object')return imageFrom(v.url||v.contentUrl||v.src||v.image);return'';
}

function extractScripts(html){
  const out=[];
  for(const re of [/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/gi]){
    let m;while((m=re.exec(html))){try{out.push(JSON.parse(m[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&')))}catch{}}
  }
  return out;
}

function maybeCrunchy(value,base){
  if(!value||typeof value!=='object')return null;
  const title=cleanText(value.headline||value.title||value.name||'',230);
  let url=value.url||value.href||value.canonicalUrl||value.link||value.permalink||'';
  if(typeof url==='object')url=url.url||url.href||'';url=abs(url,base);
  if(title.length<14||!url||!url.includes('/news/'))return null;
  return{
    sourceName:'Crunchyroll Notícias',sourceLanguage:'pt-BR',title,
    summary:cleanText(value.description||value.summary||value.excerpt||value.dek||'',1200),
    url,imageUrl:abs(imageFrom(value.image||value.thumbnail||value.images||value.heroImage),base),
    publishedAt:iso(value.datePublished||value.publishedAt||value.publishDate||value.date||value.createdAt||value.releaseDate||''),
    author:cleanText(typeof value.author==='string'?value.author:value.author?.name||'',160)
  };
}
function walkCrunchy(value,base,out,seen=new WeakSet()){
  if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);
  const item=maybeCrunchy(value,base);if(item)out.push(item);
  if(Array.isArray(value)){for(const x of value)walkCrunchy(x,base,out,seen);return}
  for(const x of Object.values(value))walkCrunchy(x,base,out,seen);
}
async function crunchyroll(){
  const base='https://www.crunchyroll.com',html=await get(`${base}/pt-br/news/latest`),out=[];
  for(const json of extractScripts(html))walkCrunchy(json,base,out);
  return dedupeSource(out).slice(0,MAX_PER_SOURCE);
}

async function ann(){
  const xml=await get('https://www.animenewsnetwork.com/all/rss.xml?ann-edition=us'),out=[];
  for(const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)){
    const x=match[1],title=rssTag(x,'title'),url=rssTag(x,'link');if(!title||!url)continue;
    const image=(x.match(/<(?:media:content|enclosure)[^>]+url=["']([^"']+)/i)||[])[1]||'';
    out.push({sourceName:'Anime News Network',sourceLanguage:'en',title,summary:rssTag(x,'description'),url,imageUrl:safeUrl(image),publishedAt:iso(rssTag(x,'pubDate')),author:''});
  }
  return dedupeSource(out).slice(0,MAX_PER_SOURCE);
}

async function mal(){
  const top=await get('https://api.jikan.moe/v4/top/anime?filter=airing&limit=10','json'),out=[];
  for(let i=0;i<Math.min(7,top?.data?.length||0);i++){
    const anime=top.data[i];if(i)await sleep(360);
    try{
      const j=await get(`https://api.jikan.moe/v4/anime/${anime.mal_id}/news`,'json');
      for(const n of (j?.data||[]).slice(0,2))out.push({
        sourceName:'MyAnimeList',sourceLanguage:'en',title:cleanText(n.title,230),summary:cleanText(n.excerpt||'',1200),
        url:safeUrl(n.url),imageUrl:safeUrl(n.images?.jpg?.image_url||anime.images?.jpg?.large_image_url||anime.images?.jpg?.image_url||''),
        publishedAt:iso(n.date),author:cleanText(n.author_username||'',160)
      });
    }catch{}
  }
  return dedupeSource(out).slice(0,MAX_PER_SOURCE);
}

function dedupeSource(items=[]){
  const seen=new Set(),out=[];
  for(const raw of items){
    const url=canonicalUrl(raw?.url);if(!url||!raw?.title)continue;
    const key=sourceFingerprint(url);if(seen.has(key))continue;seen.add(key);out.push({...raw,url});
  }
  return out.sort((a,b)=>new Date(b.publishedAt||0)-new Date(a.publishedAt||0));
}

async function enrich(item,index){
  if(index>=ENRICH_LIMIT||!item.url)return item;
  try{
    const html=await get(item.url,'text',9000),meta=extractHtmlMetadata(html,item.url);
    return{
      ...item,
      title:item.title||meta.title,
      summary:(meta.description?.length||0)>(item.summary?.length||0)?meta.description:item.summary,
      imageUrl:item.imageUrl||meta.imageUrl,
      author:item.author||meta.author,
      publishedAt:item.publishedAt||iso(meta.publishedAt)
    };
  }catch{return item}
}

function recentEnough(item){
  if(!item.publishedAt)return true;
  const t=new Date(item.publishedAt).getTime();if(!Number.isFinite(t))return true;
  const age=Date.now()-t;return age>=-48*3600_000&&age<=MAX_SOURCE_AGE_HOURS*3600_000;
}

function groupStories(items=[]){
  const groups=new Map();
  for(const item of items.filter(recentEnough)){
    const story=storyFingerprint(item.title,item.summary),list=groups.get(story)||[];list.push({...item,storyHash:story});groups.set(story,list);
  }
  return [...groups.values()];
}

async function persistStory(group=[]){
  if(!group.length)return false;
  const scored=group.map(x=>({...x,rawQuality:qualityScore({title:x.title,summary:x.summary,imageUrl:x.imageUrl,publishedAt:x.publishedAt,sources:[x],facts:splitFacts(x.summary,4)})})).sort((a,b)=>b.rawQuality-a.rawQuality||(b.summary?.length||0)-(a.summary?.length||0));
  const primary=scored[0],eventType=classifyNews(primary),pair=await translatePair(primary.title,primary.summary);
  const facts=await translateFacts(scored.flatMap(x=>splitFacts(x.summary,3)));
  const sources=mergeSources([],scored.map(x=>({name:x.sourceName,url:x.url,publishedAt:x.publishedAt,author:x.author})));
  const article=buildEditorialArticle({title:pair.title,summary:pair.summary,eventType,facts,sources,imageUrl:primary.imageUrl,originalTitle:primary.title,sourceLanguage:primary.sourceLanguage||'auto'});
  const sourceHash=sourceFingerprint(primary.url),storyHash=primary.storyHash||storyFingerprint(primary.title,primary.summary);
  const sourcePublished=iso(primary.publishedAt)||new Date().toISOString(),expires=articleExpiry(new Date(sourcePublished),RETENTION_DAYS);
  const quality=qualityScore({title:pair.title,summary:pair.summary,imageUrl:primary.imageUrl,publishedAt:sourcePublished,sources,facts:article.facts});
  const articleSlug=`${slugify(pair.title)}-${storyHash.slice(0,10)}`;
  const existing=await q(`SELECT id,slug,sources,facts FROM news_articles WHERE source_kind='AUTOMATED' AND story_hash=$1 AND COALESCE(source_published_at,published_at,created_at)>now()-interval '72 hours' ORDER BY last_seen_at DESC LIMIT 1`,[storyHash]);
  const mergedSources=mergeSources(existing.rows[0]?.sources||[],sources),mergedFacts=splitFacts([...(existing.rows[0]?.facts||[]),...article.facts],8);
  const body=JSON.stringify({...article,sources:mergedSources,facts:mergedFacts});
  if(existing.rows[0]){
    await q(`UPDATE news_articles SET event_type=$2,title=$3,summary=$4,body=$5,status='published',image_url=COALESCE($6,image_url),image_alt=$7,source_name=$8,source_url=$9,source_published_at=$10,expires_at=$11,language='pt-BR',facts=$12::jsonb,source_hash=COALESCE(source_hash,$13),original_title=$14,source_author=$15,source_language=$16,sources=$17::jsonb,content_sections=$18::jsonb,reading_minutes=$19,word_count=$20,quality_score=GREATEST(quality_score,$21),last_seen_at=now(),updated_at=now() WHERE id=$1`,[
      existing.rows[0].id,eventType,pair.title,pair.summary,body,safeUrl(primary.imageUrl)||null,pair.title,primary.sourceName||'Fonte monitorada',canonicalUrl(primary.url)||null,sourcePublished,expires,JSON.stringify(mergedFacts),sourceHash,cleanText(primary.title,260),cleanText(primary.author,160)||null,primary.sourceLanguage||'auto',JSON.stringify(mergedSources),JSON.stringify(article.sections),article.readingMinutes,article.wordCount,quality
    ]);
    return true;
  }
  await q(`INSERT INTO news_articles(slug,source_kind,event_type,title,summary,body,spoiler,status,media_ids,external_url,published_at,image_url,image_alt,source_name,source_url,source_published_at,expires_at,language,facts,source_hash,story_hash,original_title,source_author,source_language,sources,content_sections,reading_minutes,word_count,quality_score,first_seen_at,last_seen_at)
    VALUES($1,'AUTOMATED',$2,$3,$4,$5,false,'published','[]'::jsonb,$6,$7,$8,$9,$10,$11,$7,$12,'pt-BR',$13::jsonb,$14,$15,$16,$17,$18,$19::jsonb,$20::jsonb,$21,$22,$23,now(),now())
    ON CONFLICT(source_hash) WHERE source_kind='AUTOMATED' AND source_hash IS NOT NULL DO UPDATE SET title=EXCLUDED.title,summary=EXCLUDED.summary,body=EXCLUDED.body,event_type=EXCLUDED.event_type,image_url=COALESCE(EXCLUDED.image_url,news_articles.image_url),sources=EXCLUDED.sources,content_sections=EXCLUDED.content_sections,facts=EXCLUDED.facts,quality_score=GREATEST(news_articles.quality_score,EXCLUDED.quality_score),expires_at=EXCLUDED.expires_at,last_seen_at=now(),updated_at=now()`,[
    articleSlug,eventType,pair.title,pair.summary,body,canonicalUrl(primary.url)||null,sourcePublished,safeUrl(primary.imageUrl)||null,pair.title,primary.sourceName||'Fonte monitorada',canonicalUrl(primary.url)||null,expires,JSON.stringify(article.facts),sourceHash,storyHash,cleanText(primary.title,260),cleanText(primary.author,160)||null,primary.sourceLanguage||'auto',JSON.stringify(sources),JSON.stringify(article.sections),article.readingMinutes,article.wordCount,quality
  ]);
  return true;
}

async function notifyFollowers({dedupeKey,eventType,title,summary,mediaIds=[]}){
  const kind=eventType==='EPISODE'?'EPISODE':'NEWS';
  for(const mediaId of mediaIds){
    await q(`INSERT INTO notifications(user_id,kind,title,body,media_id,url,dedupe_key)
      SELECT user_id,$1,$2,$3,$4,$5,$6 FROM user_follows WHERE media_id=$4 AND media_type='ANIME'
      AND (($1='EPISODE' AND notify_episode=true) OR ($1='NEWS' AND notify_news=true))
      ON CONFLICT(user_id,dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING`,[kind,title,summary,mediaId,'/noticias',dedupeKey]).catch(()=>{});
  }
}

async function persistInternal({key,eventType='OTHER',title,summary,mediaIds=[],imageUrl=''}){
  const pair={title:cleanText(title,220),summary:cleanText(summary,1200)},storyHash=storyFingerprint(pair.title,pair.summary),sourceHash=sha(`aninexus:${key}`,24);
  const article=buildEditorialArticle({title:pair.title,summary:pair.summary,eventType,facts:splitFacts(pair.summary,5),sources:[{name:'AniNexus'}],imageUrl,originalTitle:pair.title,sourceLanguage:'pt-BR'});
  const slug=`${slugify(pair.title)}-${storyHash.slice(0,10)}`,expires=articleExpiry(new Date(),RETENTION_DAYS),quality=qualityScore({title:pair.title,summary:pair.summary,imageUrl,sources:[{name:'AniNexus'}],facts:article.facts});
  await q(`INSERT INTO news_articles(slug,source_kind,event_type,title,summary,body,status,media_ids,published_at,image_url,image_alt,source_name,source_published_at,expires_at,language,facts,source_hash,story_hash,original_title,source_language,sources,content_sections,reading_minutes,word_count,quality_score,last_seen_at)
    VALUES($1,'AUTOMATED',$2,$3,$4,$5,'published',$6,now(),$7,$3,'AniNexus',now(),$8,'pt-BR',$9::jsonb,$10,$11,$3,'pt-BR',$12::jsonb,$13::jsonb,$14,$15,$16,now())
    ON CONFLICT(source_hash) WHERE source_kind='AUTOMATED' AND source_hash IS NOT NULL DO UPDATE SET last_seen_at=now(),expires_at=EXCLUDED.expires_at,updated_at=now()`,[
    slug,eventType,pair.title,pair.summary,JSON.stringify(article),JSON.stringify(mediaIds),safeUrl(imageUrl)||null,expires,JSON.stringify(article.facts),sourceHash,storyHash,JSON.stringify(article.sources),JSON.stringify(article.sections),article.readingMinutes,article.wordCount,quality
  ]);
  await notifyFollowers({dedupeKey:`${eventType}:${key}`,eventType,title:pair.title,summary:pair.summary,mediaIds});
}

async function syncEditorialSources(){
  const jobs=await Promise.allSettled([crunchyroll(),ann(),mal()]),collected=[];
  for(const job of jobs){if(job.status==='fulfilled')collected.push(...job.value);else console.warn('[news-source]',job.reason?.message||job.reason)}
  const bySource=new Map();for(const item of collected){const list=bySource.get(item.sourceName)||[];list.push(item);bySource.set(item.sourceName,list)}
  const enriched=[];for(const list of bySource.values()){for(let i=0;i<list.length;i++)enriched.push(await enrich(list[i],i))}
  const groups=groupStories(enriched);
  for(const group of groups.slice(0,36)){try{await persistStory(group)}catch(err){console.error('[news-persist]',err?.message||err)}}
  return{sources:jobs.filter(x=>x.status==='fulfilled').length,items:enriched.length,stories:groups.length};
}

async function syncSchedule(){
  const now=Math.floor(Date.now()/1000),end=now+8*86400,items=await getSchedule(now-3600,end);
  for(const x of items){
    const m=x.media,id=m?.id;if(!id)continue;const name=m.title||m.titleRomaji||'Anime';
    const when=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(x.airingAt*1000));
    if(x.episode===1)await persistInternal({key:`${id}:${x.airingAt}:premiere`,eventType:'SEASON',title:`${name} entra em estreia`,summary:`O primeiro episódio está previsto para ${when}, no horário de Brasília.`,mediaIds:[id],imageUrl:m.cover||m.coverImage||''});
    if(m.episodes&&x.episode===m.episodes)await persistInternal({key:`${id}:${x.airingAt}:finale`,eventType:'EPISODE',title:`${name} chega ao episódio final`,summary:`O episódio ${x.episode} está programado para ${when}, encerrando a temporada atual.`,mediaIds:[id],imageUrl:m.cover||m.coverImage||''});
  }
}

async function syncCatalog(){
  const data=await getCatalog({page:1,perPage:30,sort:'NEW'});
  for(const m of data.items||[]){if(!m?.id||!m.trailer?.id)continue;await persistInternal({key:`${m.id}:trailer:${m.trailer.id}`,eventType:'TRAILER',title:`Novo material em vídeo de ${m.title}`,summary:`O AniNexus detectou novo material promocional em vídeo para ${m.title}.`,mediaIds:[m.id],imageUrl:m.cover||m.coverImage||''})}
}

async function cleanup(){
  await q(`UPDATE news_articles SET status='archived',updated_at=now() WHERE source_kind='AUTOMATED' AND status='published' AND expires_at IS NOT NULL AND expires_at<=now()`);
  await q(`DELETE FROM news_articles WHERE source_kind='AUTOMATED' AND status='archived' AND COALESCE(expires_at,updated_at)<now()-interval '14 days'`);
  await q(`DELETE FROM news_events WHERE created_at<now()-interval '30 days'`);
}

let running=false;
async function cycle(){
  if(running)return;running=true;const started=Date.now();
  try{
    const editorial=await syncEditorialSources();
    await Promise.allSettled([syncSchedule(),syncCatalog()]);
    await cleanup();
    console.log('[news-worker]',{...editorial,ms:Date.now()-started,retentionDays:RETENTION_DAYS});
  }catch(err){console.error('[news-worker]',err?.stack||err?.message||err)}finally{running=false}
}

await initDb();
await initCache().catch(()=>{});
await cycle();
const timer=setInterval(cycle,INTERVAL_MS);timer.unref?.();

async function shutdown(){clearInterval(timer);await Promise.allSettled([pool.end(),redis?.quit?.()]);process.exit(0)}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
