import { initDb, q, pool } from './db.mjs';
import { initCache, redis } from './cache.mjs';
import { getCatalog, getReading, getSchedule } from './provider.mjs';
import { articleExpiry } from './native-news.mjs';
import {
  cleanText,slugify,sha,safeUrl,canonicalUrl,sourceFingerprint,storyFingerprint,
  classifyNews,splitFacts,extractHtmlMetadata,mergeSources,qualityScore,categoryLabel
} from './news-core.mjs';

const INTERVAL_MS=Math.max(60_000,Number(process.env.NEWS_WORKER_INTERVAL_MS||300_000));
const RETENTION_DAYS=Math.max(2,Math.min(14,Number(process.env.NEWS_RETENTION_DAYS||5)));
const MAX_PER_SOURCE=Math.max(4,Math.min(30,Number(process.env.NEWS_MAX_PER_SOURCE||14)));
const ENRICH_LIMIT=Math.max(2,Math.min(16,Number(process.env.NEWS_ENRICH_PER_SOURCE||8)));
const MAX_SOURCE_AGE_HOURS=Math.max(24,Math.min(168,Number(process.env.NEWS_MAX_SOURCE_AGE_HOURS||120)));
const MIN_QUALITY=Math.max(.35,Math.min(.9,Number(process.env.NEWS_MIN_QUALITY||.54)));
const TRANSLATE=process.env.NEWS_TRANSLATE_ENDPOINT||'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=pt&dt=t&q=';
const UA='AniNexus-NewsBot/3.3 (+https://aninexus.seudominio.com)';
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

function languageScore(value){
  const words=cleanText(value,6000).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().match(/[a-z]+/g)||[];
  if(!words.length)return{pt:0,en:0};
  const ptSet=new Set(['de','da','do','das','dos','e','que','para','com','uma','um','foi','sera','será','novo','nova','temporada','estreia','elenco','episodio','episódio','manga','mangá','filme','noticia','notícia','tambem','também','confirmou','anunciou','divulgou']);
  const enSet=new Set(['the','and','of','to','for','with','from','new','will','has','have','was','were','season','reveals','announces','announced','confirms','launches','release','cast','episode','movie','news','details']);
  let pt=0,en=0;for(const w of words){if(ptSet.has(w))pt++;if(enSet.has(w))en++}return{pt,en};
}
function likelyPortuguese(value){const {pt,en}=languageScore(value);return pt>=2||pt>=en||en<=1}

async function translateRaw(value){
  const text=cleanText(value,4200);if(!text)return'';
  const key=`news:v33:pt:${sha(text,28)}`;
  try{const cached=await redis?.get?.(key);if(cached)return cached}catch{}
  let out='';
  for(let attempt=0;attempt<2&&!out;attempt++){
    try{
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
      const r=await fetch(TRANSLATE+encodeURIComponent(text),{signal:controller.signal,headers:{'user-agent':UA}}).finally(()=>clearTimeout(timer));
      if(r.ok){const j=await r.json();out=cleanText((j?.[0]||[]).map(x=>x?.[0]||'').join(''),4200)}
    }catch{}
    if(!out&&attempt===0)await sleep(260);
  }
  if(out){try{await redis?.set?.(key,out,{EX:60*60*24*14})}catch{}}
  return out;
}

async function translatePair(title,summary,sourceLanguage='auto'){
  const t=cleanText(title,800),s=cleanText(summary,3400);
  if(String(sourceLanguage||'').toLowerCase().startsWith('pt')||likelyPortuguese(`${t} ${s}`))return{title:cleanText(t,220),summary:cleanText(s,1200),ready:true};
  const marker=' <<<ANINEXUS_SEP>>> ';
  const translated=await translateRaw(`${t}${marker}${s}`),parts=translated.split(/\s*<<<ANINEXUS_SEP>>>\s*/);
  const outTitle=cleanText(parts[0]||'',220),outSummary=cleanText(parts.slice(1).join(' '),1200);
  const ready=!!outTitle&&!!outSummary&&likelyPortuguese(`${outTitle} ${outSummary}`);
  return{title:ready?outTitle:'',summary:ready?outSummary:'',ready};
}

async function translateFacts(facts=[],sourceLanguage='auto'){
  const source=splitFacts(facts,8);if(!source.length)return[];
  if(String(sourceLanguage||'').toLowerCase().startsWith('pt')||likelyPortuguese(source.join(' ')))return source;
  const marker=' <<<ANINEXUS_FACT>>> ',translated=await translateRaw(source.join(marker));
  if(!translated)return[];
  return translated.split(/\s*<<<ANINEXUS_FACT>>>\s*/).map(x=>cleanText(x,480)).filter(x=>x.length>=18&&likelyPortuguese(x)).slice(0,8);
}

function rssTag(xml,tag){const m=String(xml||'').match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,'i'));return m?cleanText(m[1].replace(/<!\[CDATA\[|\]\]>/g,''),1800):''}
function imageFrom(v){if(!v)return'';if(typeof v==='string')return safeUrl(v);if(Array.isArray(v))return imageFrom(v[0]);if(typeof v==='object')return imageFrom(v.url||v.contentUrl||v.src||v.image);return''}
function extractScripts(html){const out=[];for(const re of [/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/gi]){let m;while((m=re.exec(html))){try{out.push(JSON.parse(m[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&')))}catch{}}}return out}
function maybeCrunchy(value,base){
  if(!value||typeof value!=='object')return null;
  const title=cleanText(value.headline||value.title||value.name||'',230);let url=value.url||value.href||value.canonicalUrl||value.link||value.permalink||'';
  if(typeof url==='object')url=url.url||url.href||'';url=abs(url,base);
  if(title.length<14||!url||!url.includes('/news/'))return null;
  return{sourceName:'Crunchyroll Notícias',sourceKey:'CRUNCHYROLL',sourceLanguage:'pt-BR',title,summary:cleanText(value.description||value.summary||value.excerpt||value.dek||'',1200),url,imageUrl:abs(imageFrom(value.image||value.thumbnail||value.images||value.heroImage),base),publishedAt:iso(value.datePublished||value.publishedAt||value.publishDate||value.date||value.createdAt||value.releaseDate||''),author:cleanText(typeof value.author==='string'?value.author:value.author?.name||'',160)};
}
function walkCrunchy(value,base,out,seen=new WeakSet()){if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);const item=maybeCrunchy(value,base);if(item)out.push(item);if(Array.isArray(value)){for(const x of value)walkCrunchy(x,base,out,seen);return}for(const x of Object.values(value))walkCrunchy(x,base,out,seen)}
async function crunchyroll(){const base='https://www.crunchyroll.com',html=await get(`${base}/pt-br/news/latest`),out=[];for(const json of extractScripts(html))walkCrunchy(json,base,out);return dedupeSource(out).slice(0,MAX_PER_SOURCE)}
async function ann(){
  const xml=await get('https://www.animenewsnetwork.com/all/rss.xml?ann-edition=us'),out=[];
  for(const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)){const x=match[1],title=rssTag(x,'title'),url=rssTag(x,'link');if(!title||!url)continue;const image=(x.match(/<(?:media:content|enclosure)[^>]+url=["']([^"']+)/i)||[])[1]||'';out.push({sourceName:'Anime News Network',sourceKey:'ANN',sourceLanguage:'en',title,summary:rssTag(x,'description'),url,imageUrl:safeUrl(image),publishedAt:iso(rssTag(x,'pubDate')),author:''})}
  return dedupeSource(out).slice(0,MAX_PER_SOURCE);
}
async function mal(){
  const top=await get('https://api.jikan.moe/v4/top/anime?filter=airing&limit=10','json'),out=[];
  for(let i=0;i<Math.min(7,top?.data?.length||0);i++){
    const anime=top.data[i];if(i)await sleep(360);
    try{const j=await get(`https://api.jikan.moe/v4/anime/${anime.mal_id}/news`,'json');for(const n of (j?.data||[]).slice(0,2))out.push({sourceName:'MyAnimeList',sourceKey:'MAL',sourceLanguage:'en',title:cleanText(n.title,230),summary:cleanText(n.excerpt||'',1200),url:safeUrl(n.url),imageUrl:safeUrl(n.images?.jpg?.image_url||anime.images?.jpg?.large_image_url||anime.images?.jpg?.image_url||''),publishedAt:iso(n.date),author:cleanText(n.author_username||'',160)})}catch{}
  }
  return dedupeSource(out).slice(0,MAX_PER_SOURCE);
}
function dedupeSource(items=[]){const seen=new Set(),out=[];for(const raw of items){const url=canonicalUrl(raw?.url);if(!url||!raw?.title)continue;const key=sourceFingerprint(url);if(seen.has(key))continue;seen.add(key);out.push({...raw,url})}return out.sort((a,b)=>new Date(b.publishedAt||0)-new Date(a.publishedAt||0))}
function recentEnough(item){if(!item.publishedAt)return true;const t=new Date(item.publishedAt).getTime();if(!Number.isFinite(t))return true;const age=Date.now()-t;return age>=-48*3600_000&&age<=MAX_SOURCE_AGE_HOURS*3600_000}

async function enrich(item,index){
  if(index>=ENRICH_LIMIT||!item.url)return item;
  try{
    const html=await get(item.url,'text',9500),meta=extractHtmlMetadata(html,item.url);
    const details=cleanText([item.summary,meta.description,...splitFacts(meta.articleText,5)].filter(Boolean).join(' '),3600);
    return{...item,title:item.title||meta.title,summary:details||item.summary,imageUrl:item.imageUrl||meta.imageUrl,author:item.author||meta.author,publishedAt:item.publishedAt||iso(meta.publishedAt),keywords:meta.keywords||''};
  }catch{return item}
}

function mediaQueryFromTitle(title){
  let s=cleanText(title,220).replace(/[“”"'‘’]/g,' ');
  s=s.split(/\b(?:anime|manga|manhwa|light novel|novel)?\s*(?:confirms?|announces?|reveals?|unveils?|gets?|launches?|premieres?|licenses?|adds?|returns?|streams?|debut|release|season)\b/i)[0]||s;
  s=s.replace(/\b(?:tv|anime|manga|movie|film|season|trailer|teaser|visual|new|novo|nova)\b/gi,' ').replace(/\s+/g,' ').trim();
  return s.length>=3?s.slice(0,100):'';
}
async function fallbackImage(item,eventType){
  if(safeUrl(item.imageUrl))return safeUrl(item.imageUrl);
  const search=mediaQueryFromTitle(item.title);if(!search)return'';
  try{const r=eventType==='MANGA'?await getReading({page:1,perPage:1,search,sort:'POPULAR'}):await getCatalog({page:1,perPage:1,search,sort:'POPULAR'});return safeUrl(r?.items?.[0]?.cover||r?.items?.[0]?.banner||'')}catch{return''}
}

function groupStories(items=[]){const groups=new Map();for(const item of items.filter(recentEnough)){const story=storyFingerprint(item.title,item.summary),list=groups.get(story)||[];list.push({...item,storyHash:story});groups.set(story,list)}return [...groups.values()]}
function latestDate(items=[]){const times=items.map(x=>new Date(x.publishedAt||0).getTime()).filter(Number.isFinite);return times.length?new Date(Math.max(...times)):new Date()}
function uniqueFacts(items=[]){return splitFacts(items.flatMap(x=>splitFacts(x.summary,5)),10)}

function editorialSections({summary,eventType,facts=[],sourceCount=1}){
  const cleanFacts=splitFacts(facts,8),sections=[{heading:'O que aconteceu',paragraphs:[cleanText(summary,1200)]}];
  if(cleanFacts.length>1)sections.push({heading:'Detalhes confirmados',bullets:cleanFacts.slice(1,7)});
  const context=eventType==='TRAILER'?'O novo material promocional ajuda a esclarecer o momento da produção. O AniNexus atualiza esta matéria se surgirem data, elenco, equipe, plataforma ou janela de estreia confirmados.':eventType==='MANGA'?'A atualização envolve publicação ou licenciamento. Quando houver datas, formatos e territórios confirmados, esses dados são incorporados à matéria enquanto ela estiver ativa.':eventType==='SEASON'?'A informação afeta o acompanhamento da obra no AniNexus. Datas e janelas de estreia confirmadas podem refletir depois no calendário e nas páginas da temporada.':eventType==='EPISODE'?'A notícia está ligada à exibição de episódios. O horário de Brasília e a programação do AniNexus continuam sendo a referência para acompanhar a transmissão.':eventType==='TRENDING'?'O destaque reflete repercussão recente, audiência ou desempenho da obra. O AniNexus mantém apenas informações verificáveis e evita transformar tendência em confirmação de novos projetos.':'A matéria reúne somente informações presentes nas fontes monitoradas e pode receber atualizações se novos detalhes forem publicados.';
  sections.push({heading:'O que isso significa',paragraphs:[context]});
  sections.push({heading:'Acompanhe no AniNexus',paragraphs:[`Esta matéria foi consolidada a partir de ${sourceCount} ${sourceCount===1?'fonte monitorada':'fontes monitoradas'}. Ela permanece no feed por alguns dias e recebe novas versões quando surgem informações relevantes.`]});
  return sections;
}
function wordStats(summary,sections){const words=cleanText([summary,...sections.flatMap(s=>[...(s.paragraphs||[]),...(s.bullets||[])])].join(' '),30_000).split(/\s+/).filter(Boolean).length;return{wordCount:words,readingMinutes:Math.max(1,Math.ceil(words/210))}}
function contentSignature({title,summary,facts,sections,sources,imageUrl}){return sha(JSON.stringify({title,summary,facts,sections,sources:sources.map(x=>({name:x.name,url:x.url,publishedAt:x.publishedAt})),imageUrl}),40)}

async function writeRevision(articleId,version,data){
  await q(`INSERT INTO news_article_revisions(article_id,version,title,summary,facts,content_sections,sources,image_url,quality_score,content_signature)
    VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9,$10) ON CONFLICT(article_id,version) DO NOTHING`,[
    articleId,version,data.title,data.summary,JSON.stringify(data.facts),JSON.stringify(data.sections),JSON.stringify(data.sources),data.imageUrl||null,data.quality,data.signature
  ]).catch(()=>{});
}

async function persistStory(group=[],stats){
  if(!group.length)return false;
  const raw=group.map(x=>({...x,rawQuality:qualityScore({title:x.title,summary:x.summary,imageUrl:x.imageUrl,publishedAt:x.publishedAt,sources:[x],facts:splitFacts(x.summary,4)})})).sort((a,b)=>b.rawQuality-a.rawQuality||(b.summary?.length||0)-(a.summary?.length||0));
  const primary=raw[0],eventType=classifyNews(primary),pair=await translatePair(primary.title,primary.summary,primary.sourceLanguage);
  if(!pair.ready){stats.skippedTranslation++;return false}
  const rawFacts=uniqueFacts(raw),facts=await translateFacts(rawFacts,primary.sourceLanguage),safeFacts=facts.length?facts:splitFacts(pair.summary,6);
  const sources=mergeSources([],raw.map(x=>({name:x.sourceName,url:x.url,publishedAt:x.publishedAt,author:x.author}))),imageUrl=await fallbackImage(primary,eventType);
  const sections=editorialSections({summary:pair.summary,eventType,facts:safeFacts,sourceCount:sources.length}),words=wordStats(pair.summary,sections);
  const sourcePublished=latestDate(raw).toISOString(),expires=articleExpiry(new Date(sourcePublished),RETENTION_DAYS),quality=qualityScore({title:pair.title,summary:pair.summary,imageUrl,publishedAt:sourcePublished,sources,facts:safeFacts});
  if(quality<MIN_QUALITY){stats.skippedQuality++;return false}
  const storyHash=primary.storyHash||storyFingerprint(primary.title,primary.summary),sourceHash=sourceFingerprint(primary.url),signature=contentSignature({title:pair.title,summary:pair.summary,facts:safeFacts,sections,sources,imageUrl}),articleSlug=`${slugify(pair.title)}-${storyHash.slice(0,10)}`;
  const body=JSON.stringify({version:4,title:pair.title,originalTitle:cleanText(primary.title,260),lead:pair.summary,category:categoryLabel(eventType),sourceLanguage:primary.sourceLanguage||'auto',imageUrl,facts:safeFacts,sections,sources,readingMinutes:words.readingMinutes,wordCount:words.wordCount});
  const existing=await q(`SELECT id,slug,sources,facts,content_version,content_signature FROM news_articles WHERE source_kind='AUTOMATED' AND story_hash=$1 AND COALESCE(source_published_at,published_at,created_at)>now()-interval '96 hours' ORDER BY last_seen_at DESC LIMIT 1`,[storyHash]);
  const row=existing.rows[0];
  if(row){
    const changed=row.content_signature!==signature,version=changed?Number(row.content_version||1)+1:Number(row.content_version||1);
    await q(`UPDATE news_articles SET event_type=$2,title=$3,summary=$4,body=$5,status='published',image_url=COALESCE($6,image_url),image_source_url=COALESCE($7,image_source_url),image_alt=$8,source_name=$9,source_url=$10,source_published_at=$11,expires_at=$12,language='pt-BR',translation_status='ready',facts=$13::jsonb,source_hash=COALESCE(source_hash,$14),original_title=$15,source_author=$16,source_language=$17,sources=$18::jsonb,source_count=$19,content_sections=$20::jsonb,reading_minutes=$21,word_count=$22,quality_score=GREATEST(quality_score,$23),content_version=$24,content_signature=$25,last_seen_at=now(),last_source_update_at=$11,updated_at=CASE WHEN $26 THEN now() ELSE updated_at END WHERE id=$1`,[
      row.id,eventType,pair.title,pair.summary,body,imageUrl||null,safeUrl(primary.imageUrl)||null,pair.title,primary.sourceName||'Fonte monitorada',canonicalUrl(primary.url)||null,sourcePublished,expires,JSON.stringify(safeFacts),sourceHash,cleanText(primary.title,260),cleanText(primary.author,160)||null,primary.sourceLanguage||'auto',JSON.stringify(sources),sources.length,JSON.stringify(sections),words.readingMinutes,words.wordCount,quality,version,signature,changed
    ]);
    if(changed)await writeRevision(row.id,version,{title:pair.title,summary:pair.summary,facts:safeFacts,sections,sources,imageUrl,quality,signature});
    stats.published++;return true;
  }
  const inserted=await q(`INSERT INTO news_articles(slug,source_kind,event_type,title,summary,body,spoiler,status,media_ids,external_url,published_at,image_url,image_source_url,image_alt,source_name,source_url,source_published_at,expires_at,language,translation_status,facts,source_hash,story_hash,original_title,source_author,source_language,sources,source_count,content_sections,reading_minutes,word_count,quality_score,content_version,content_signature,first_seen_at,last_seen_at,last_source_update_at)
    VALUES($1,'AUTOMATED',$2,$3,$4,$5,false,'published','[]'::jsonb,$6,$7,$8,$9,$3,$10,$6,$7,$11,'pt-BR','ready',$12::jsonb,$13,$14,$15,$16,$17,$18::jsonb,$19,$20::jsonb,$21,$22,$23,1,$24,now(),now(),$7)
    ON CONFLICT(source_hash) WHERE source_kind='AUTOMATED' AND source_hash IS NOT NULL DO UPDATE SET last_seen_at=now(),expires_at=EXCLUDED.expires_at RETURNING id,content_version`,[
    articleSlug,eventType,pair.title,pair.summary,body,canonicalUrl(primary.url)||null,sourcePublished,imageUrl||null,safeUrl(primary.imageUrl)||null,primary.sourceName||'Fonte monitorada',expires,JSON.stringify(safeFacts),sourceHash,storyHash,cleanText(primary.title,260),cleanText(primary.author,160)||null,primary.sourceLanguage||'auto',JSON.stringify(sources),sources.length,JSON.stringify(sections),words.readingMinutes,words.wordCount,quality,signature
  ]);
  const insertedRow=inserted.rows[0];if(insertedRow)await writeRevision(insertedRow.id,Number(insertedRow.content_version||1),{title:pair.title,summary:pair.summary,facts:safeFacts,sections,sources,imageUrl,quality,signature});
  stats.published++;return true;
}

async function recordSource(key,name,fn){
  const started=Date.now();
  try{
    const items=await fn(),latency=Date.now()-started;
    await q(`INSERT INTO news_source_health(source_key,source_name,last_attempt_at,last_success_at,last_item_count,consecutive_failures,total_successes,average_latency_ms,updated_at)
      VALUES($1,$2,now(),now(),$3,0,1,$4,now())
      ON CONFLICT(source_key) DO UPDATE SET source_name=EXCLUDED.source_name,last_attempt_at=now(),last_success_at=now(),last_item_count=EXCLUDED.last_item_count,consecutive_failures=0,total_successes=news_source_health.total_successes+1,average_latency_ms=ROUND((news_source_health.average_latency_ms*3+EXCLUDED.average_latency_ms)/4.0),last_error=NULL,updated_at=now()`,[key,name,items.length,latency]).catch(()=>{});
    return{ok:true,key,name,items};
  }catch(error){
    const latency=Date.now()-started,msg=cleanText(error?.message||error,700);
    await q(`INSERT INTO news_source_health(source_key,source_name,last_attempt_at,last_error_at,last_error,last_item_count,consecutive_failures,total_failures,average_latency_ms,updated_at)
      VALUES($1,$2,now(),now(),$3,0,1,1,$4,now())
      ON CONFLICT(source_key) DO UPDATE SET source_name=EXCLUDED.source_name,last_attempt_at=now(),last_error_at=now(),last_error=EXCLUDED.last_error,last_item_count=0,consecutive_failures=news_source_health.consecutive_failures+1,total_failures=news_source_health.total_failures+1,average_latency_ms=ROUND((news_source_health.average_latency_ms*3+EXCLUDED.average_latency_ms)/4.0),updated_at=now()`,[key,name,msg,latency]).catch(()=>{});
    return{ok:false,key,name,items:[],error:msg};
  }
}

async function syncEditorialSources(stats){
  const results=await Promise.all([
    recordSource('CRUNCHYROLL','Crunchyroll Notícias',crunchyroll),
    recordSource('ANN','Anime News Network',ann),
    recordSource('MAL','MyAnimeList',mal)
  ]);
  stats.sourcesOk=results.filter(x=>x.ok).length;stats.sourcesFailed=results.length-stats.sourcesOk;
  const collected=results.flatMap(x=>x.items),bySource=new Map();for(const item of collected){const list=bySource.get(item.sourceName)||[];list.push(item);bySource.set(item.sourceName,list)}
  const enriched=[];for(const list of bySource.values()){for(let i=0;i<list.length;i++)enriched.push(await enrich(list[i],i))}
  const groups=groupStories(enriched);stats.collected=enriched.length;stats.grouped=groups.length;
  for(const group of groups.slice(0,40)){try{await persistStory(group,stats)}catch(err){console.error('[news-persist]',err?.message||err)}}
}

async function notifyFollowers({dedupeKey,eventType,title,summary,mediaIds=[]}){
  const kind=eventType==='EPISODE'?'EPISODE':'NEWS';
  for(const mediaId of mediaIds)await q(`INSERT INTO notifications(user_id,kind,title,body,media_id,url,dedupe_key)
    SELECT user_id,$1,$2,$3,$4,$5,$6 FROM user_follows WHERE media_id=$4 AND media_type='ANIME' AND (($1='EPISODE' AND notify_episode=true) OR ($1='NEWS' AND notify_news=true))
    ON CONFLICT(user_id,dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING`,[kind,title,summary,mediaId,'/noticias',dedupeKey]).catch(()=>{});
}
async function persistInternal({key,eventType='OTHER',title,summary,mediaIds=[],imageUrl=''}){
  const safeTitle=cleanText(title,220),safeSummary=cleanText(summary,1200),facts=splitFacts(safeSummary,5),sources=[{name:'AniNexus'}],sections=editorialSections({summary:safeSummary,eventType,facts,sourceCount:1}),words=wordStats(safeSummary,sections),storyHash=storyFingerprint(safeTitle,safeSummary),sourceHash=sha(`aninexus:${key}`,24),signature=contentSignature({title:safeTitle,summary:safeSummary,facts,sections,sources,imageUrl});
  const slug=`${slugify(safeTitle)}-${storyHash.slice(0,10)}`,expires=articleExpiry(new Date(),RETENTION_DAYS),quality=qualityScore({title:safeTitle,summary:safeSummary,imageUrl,sources,facts});
  await q(`INSERT INTO news_articles(slug,source_kind,event_type,title,summary,body,status,media_ids,published_at,image_url,image_alt,source_name,source_published_at,expires_at,language,translation_status,facts,source_hash,story_hash,original_title,source_language,sources,source_count,content_sections,reading_minutes,word_count,quality_score,content_version,content_signature,last_seen_at,last_source_update_at)
    VALUES($1,'AUTOMATED',$2,$3,$4,$5,'published',$6,now(),$7,$3,'AniNexus',now(),$8,'pt-BR','ready',$9::jsonb,$10,$11,$3,'pt-BR',$12::jsonb,1,$13::jsonb,$14,$15,$16,1,$17,now(),now())
    ON CONFLICT(source_hash) WHERE source_kind='AUTOMATED' AND source_hash IS NOT NULL DO UPDATE SET last_seen_at=now(),expires_at=EXCLUDED.expires_at,updated_at=now()`,[
    slug,eventType,safeTitle,safeSummary,JSON.stringify({version:4,title:safeTitle,lead:safeSummary,category:categoryLabel(eventType),facts,sections,sources,readingMinutes:words.readingMinutes,wordCount:words.wordCount}),JSON.stringify(mediaIds),safeUrl(imageUrl)||null,expires,JSON.stringify(facts),sourceHash,storyHash,JSON.stringify(sources),JSON.stringify(sections),words.readingMinutes,words.wordCount,quality,signature
  ]);
  await notifyFollowers({dedupeKey:`${eventType}:${key}`,eventType,title:safeTitle,summary:safeSummary,mediaIds});
}
async function syncSchedule(){const now=Math.floor(Date.now()/1000),items=await getSchedule(now-3600,now+8*86400);for(const x of items){const m=x.media,id=m?.id;if(!id)continue;const name=m.title||m.titleRomaji||'Anime',when=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(x.airingAt*1000));if(x.episode===1)await persistInternal({key:`${id}:${x.airingAt}:premiere`,eventType:'SEASON',title:`${name} entra em estreia`,summary:`O primeiro episódio está previsto para ${when}, no horário de Brasília.`,mediaIds:[id],imageUrl:m.cover||m.banner||''});if(m.episodes&&x.episode===m.episodes)await persistInternal({key:`${id}:${x.airingAt}:finale`,eventType:'EPISODE',title:`${name} chega ao episódio final`,summary:`O episódio ${x.episode} está programado para ${when}, encerrando a temporada atual.`,mediaIds:[id],imageUrl:m.cover||m.banner||''})}}
async function syncCatalog(){const data=await getCatalog({page:1,perPage:30,sort:'NEW'});for(const m of data.items||[]){if(!m?.id||!m.trailer?.id)continue;await persistInternal({key:`${m.id}:trailer:${m.trailer.id}`,eventType:'TRAILER',title:`Novo material em vídeo de ${m.title}`,summary:`O AniNexus detectou novo material promocional em vídeo para ${m.title}.`,mediaIds:[m.id],imageUrl:m.cover||m.banner||''})}}
async function cleanup(){await q(`UPDATE news_articles SET status='archived',updated_at=now() WHERE source_kind='AUTOMATED' AND status='published' AND expires_at IS NOT NULL AND expires_at<=now()`);await q(`DELETE FROM news_articles WHERE source_kind='AUTOMATED' AND status='archived' AND COALESCE(expires_at,updated_at)<now()-interval '14 days'`);await q(`DELETE FROM news_events WHERE created_at<now()-interval '30 days'`);await q(`DELETE FROM news_ingest_runs WHERE started_at<now()-interval '90 days'`).catch(()=>{})}

let running=false;
async function cycle(){
  if(running)return;running=true;const started=Date.now(),stats={sourcesOk:0,sourcesFailed:0,collected:0,grouped:0,published:0,skippedTranslation:0,skippedQuality:0},run=await q(`INSERT INTO news_ingest_runs(status) VALUES('running') RETURNING id`).catch(()=>({rows:[]})),runId=run.rows[0]?.id;
  try{
    await syncEditorialSources(stats);await Promise.allSettled([syncSchedule(),syncCatalog()]);await cleanup();
    const status=stats.sourcesFailed===0?'success':stats.sourcesOk>0?'partial':'failed',duration=Date.now()-started;
    if(runId)await q(`UPDATE news_ingest_runs SET finished_at=now(),status=$2,sources_ok=$3,sources_failed=$4,collected_items=$5,grouped_stories=$6,published_stories=$7,skipped_translation=$8,skipped_quality=$9,duration_ms=$10,details=$11::jsonb WHERE id=$1`,[runId,status,stats.sourcesOk,stats.sourcesFailed,stats.collected,stats.grouped,stats.published,stats.skippedTranslation,stats.skippedQuality,duration,JSON.stringify({retentionDays:RETENTION_DAYS,minQuality:MIN_QUALITY})]).catch(()=>{});
    console.log('[news-worker-v33]',{...stats,status,ms:duration,retentionDays:RETENTION_DAYS,minQuality:MIN_QUALITY});
  }catch(err){const duration=Date.now()-started;if(runId)await q(`UPDATE news_ingest_runs SET finished_at=now(),status='failed',duration_ms=$2,details=$3::jsonb WHERE id=$1`,[runId,duration,JSON.stringify({error:cleanText(err?.message||err,1000)})]).catch(()=>{});console.error('[news-worker-v33]',err?.stack||err?.message||err)}finally{running=false}
}

await initDb();await initCache().catch(()=>{});await cycle();const timer=setInterval(cycle,INTERVAL_MS);timer.unref?.();
async function shutdown(){clearInterval(timer);await Promise.allSettled([pool.end(),redis?.quit?.()]);process.exit(0)}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
