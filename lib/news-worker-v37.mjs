import { initDb, q, pool } from './db.mjs';
import { initCache, redis } from './cache.mjs';
import { articleExpiry } from './native-news.mjs';
import { cleanText,sha,safeUrl,mergeSources,splitFacts } from './news-core.mjs';
import { collectEditorialStories } from './news-rich-v37.mjs';

const INTERVAL_MS=Math.max(60_000,Number(process.env.NEWS_WORKER_INTERVAL_MS||300_000));
const RETENTION_DAYS=Math.max(3,Math.min(10,Number(process.env.NEWS_RETENTION_DAYS||7)));
const MIN_QUALITY=Math.max(.35,Math.min(.9,Number(process.env.NEWS_MIN_QUALITY||.50)));
const MAX_PER_SOURCE=Math.max(10,Math.min(60,Number(process.env.NEWS_MAX_PER_SOURCE||45)));
const MAX_STORIES=Math.max(20,Math.min(80,Number(process.env.NEWS_MAX_STORIES||60)));
const MAX_AGE=Math.max(48,Math.min(240,Number(process.env.NEWS_MAX_SOURCE_AGE_HOURS||168)));
let running=false;

function signature(a){return sha(JSON.stringify({title:a.title,summary:a.summary,image:a.imageUrl,facts:a.facts,sections:a.contentSections,sources:a.sources,mediaGallery:a.mediaGallery,mediaEmbeds:a.mediaEmbeds,coverage:a.coverage}),32)}
function body(a){return JSON.stringify({version:5,title:a.title,originalTitle:a.originalTitle||null,lead:a.summary,category:a.category,sourceLanguage:'pt-BR',imageUrl:a.imageUrl||'',facts:a.facts||[],sections:a.contentSections||[],sources:a.sources||[],mediaGallery:a.mediaGallery||[],mediaEmbeds:a.mediaEmbeds||[],coverage:a.coverage||{},readingMinutes:a.readingMinutes||1,wordCount:a.wordCount||0})}

async function saveRevision(row){
  await q(`INSERT INTO news_article_revisions(article_id,version,title,summary,facts,content_sections,sources,image_url,quality_score,content_signature)
    VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9,$10)
    ON CONFLICT(article_id,version) DO NOTHING`,[row.id,Number(row.content_version||1),row.title,row.summary,JSON.stringify(row.facts||[]),JSON.stringify(row.content_sections||[]),JSON.stringify(row.sources||[]),row.image_url||null,Number(row.quality_score||0),row.content_signature||null]).catch(()=>{});
}

async function persist(a){
  const sig=signature(a),published=new Date(a.publishedAt||Date.now()),expires=articleExpiry(published,RETENTION_DAYS),sources=mergeSources([],a.sources||[]),facts=splitFacts(a.facts||[],32),sections=Array.isArray(a.contentSections)?a.contentSections:[],hero=safeUrl(a.imageUrl)||safeUrl(a.mediaGallery?.[0]?.url)||null;
  const existing=await q(`SELECT id,slug,title,summary,facts,content_sections,sources,image_url,quality_score,content_signature,content_version,source_hash
    FROM news_articles WHERE source_kind='AUTOMATED' AND story_hash=$1
      AND COALESCE(last_seen_at,source_published_at,published_at,created_at)>now()-interval '12 days'
    ORDER BY last_seen_at DESC NULLS LAST LIMIT 1`,[a.storyHash]);
  const row=existing.rows[0];
  if(row){
    if(row.content_signature&&row.content_signature!==sig)await saveRevision(row);
    const version=row.content_signature&&row.content_signature!==sig?Number(row.content_version||1)+1:Number(row.content_version||1);
    await q(`UPDATE news_articles SET event_type=$2,title=$3,summary=$4,body=$5,status='published',image_url=COALESCE($6,image_url),image_alt=$7,source_name=$8,source_url=$9,external_url=$9,source_published_at=$10,expires_at=$11,language='pt-BR',translation_status='ready',facts=$12::jsonb,original_title=$13,source_author=$14,source_language='pt-BR',sources=$15::jsonb,source_count=$16,content_sections=$17::jsonb,reading_minutes=$18,word_count=$19,quality_score=GREATEST(quality_score,$20),content_signature=$21,content_version=$22,image_source_url=COALESCE($23,image_source_url),last_source_update_at=$24,last_seen_at=now(),updated_at=now() WHERE id=$1`,[
      row.id,a.eventType,a.title,a.summary,body(a),hero,a.title,a.sourceName,a.sourceUrl,published,expires,JSON.stringify(facts),cleanText(a.originalTitle||'',260)||null,null,JSON.stringify(sources),sources.length,JSON.stringify(sections),a.readingMinutes||1,a.wordCount||0,a.qualityScore||0,sig,version,hero?a.sourceUrl:null,new Date(a.updatedAt||published)
    ]);
    return{created:false,updated:row.content_signature!==sig};
  }
  await q(`INSERT INTO news_articles(slug,source_kind,event_type,title,summary,body,spoiler,status,media_ids,external_url,published_at,image_url,image_alt,source_name,source_url,source_published_at,expires_at,language,translation_status,facts,source_hash,story_hash,original_title,source_author,source_language,sources,source_count,content_sections,reading_minutes,word_count,quality_score,content_signature,content_version,image_source_url,first_seen_at,last_seen_at,last_source_update_at)
    VALUES($1,'AUTOMATED',$2,$3,$4,$5,false,'published','[]'::jsonb,$6,$7,$8,$3,$9,$6,$7,$10,'pt-BR','ready',$11::jsonb,$12,$13,$14,null,'pt-BR',$15::jsonb,$16,$17::jsonb,$18,$19,$20,$21,1,$22,now(),now(),$23)
    ON CONFLICT(source_hash) WHERE source_kind='AUTOMATED' AND source_hash IS NOT NULL DO UPDATE SET last_seen_at=now(),expires_at=EXCLUDED.expires_at,updated_at=now()`,[
      a.slug,a.eventType,a.title,a.summary,body(a),a.sourceUrl,published,hero,a.sourceName,expires,JSON.stringify(facts),a.sourceHash,a.storyHash,cleanText(a.originalTitle||'',260)||null,JSON.stringify(sources),sources.length,JSON.stringify(sections),a.readingMinutes||1,a.wordCount||0,a.qualityScore||0,sig,hero?a.sourceUrl:null,new Date(a.updatedAt||published)
    ]);
  return{created:true,updated:false};
}

async function health(result){
  const now=new Date();
  for(const s of result.sourceResults||[]){
    const key=s.key&&s.key!=='UNKNOWN'?s.key:String(s.name||'SOURCE').toUpperCase().replace(/[^A-Z0-9]+/g,'_');
    await q(`INSERT INTO news_source_health(source_key,source_name,last_attempt_at,last_success_at,last_error_at,last_error,last_item_count,consecutive_failures,total_successes,total_failures,updated_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
      ON CONFLICT(source_key) DO UPDATE SET source_name=EXCLUDED.source_name,last_attempt_at=EXCLUDED.last_attempt_at,last_success_at=CASE WHEN $11 THEN EXCLUDED.last_success_at ELSE news_source_health.last_success_at END,last_error_at=CASE WHEN $11 THEN news_source_health.last_error_at ELSE EXCLUDED.last_error_at END,last_error=CASE WHEN $11 THEN NULL ELSE EXCLUDED.last_error END,last_item_count=EXCLUDED.last_item_count,consecutive_failures=CASE WHEN $11 THEN 0 ELSE news_source_health.consecutive_failures+1 END,total_successes=news_source_health.total_successes+CASE WHEN $11 THEN 1 ELSE 0 END,total_failures=news_source_health.total_failures+CASE WHEN $11 THEN 0 ELSE 1 END,updated_at=now()`,[
        key,s.name||key,now,s.ok?now:null,s.ok?null:now,s.ok?null:cleanText((s.errors||[]).join(' | '),1200),Number(s.count||0),s.ok?0:1,s.ok?1:0,s.ok?0:1,!!s.ok
      ]).catch(()=>{});
  }
}

async function cleanup(){
  await q(`UPDATE news_articles SET status='archived',updated_at=now() WHERE source_kind='AUTOMATED' AND status='published' AND expires_at IS NOT NULL AND expires_at<=now()`);
  await q(`DELETE FROM news_articles WHERE source_kind='AUTOMATED' AND status='archived' AND COALESCE(expires_at,updated_at)<now()-interval '21 days'`);
  await q(`DELETE FROM news_ingest_runs WHERE started_at<now()-interval '60 days'`).catch(()=>{});
}

async function cycle(){
  if(running)return;running=true;const started=Date.now();let runId=null;
  try{
    const r=await q(`INSERT INTO news_ingest_runs(status) VALUES('running') RETURNING id`).catch(()=>({rows:[]}));runId=r.rows[0]?.id||null;
    const result=await collectEditorialStories({maxPerSource:MAX_PER_SOURCE,maxAgeHours:MAX_AGE,maxStories:MAX_STORIES,minQuality:MIN_QUALITY});
    let published=0,updated=0,withMedia=0;
    for(const a of result.stories){try{const saved=await persist(a);if(saved.created)published++;if(saved.updated)updated++;if(a.mediaGallery?.length||a.imageUrl)withMedia++}catch(err){console.error('[news-v37-persist]',a.slug,err?.message||err)}}
    await health(result);await cleanup();
    const ok=(result.sourceResults||[]).filter(x=>x.ok).length,failed=(result.sourceResults||[]).length-ok,status=ok===0?'failed':failed?'partial':'success',duration=Date.now()-started;
    if(runId)await q(`UPDATE news_ingest_runs SET finished_at=now(),status=$2,sources_ok=$3,sources_failed=$4,collected_items=$5,grouped_stories=$6,published_stories=$7,skipped_translation=$8,skipped_quality=$9,duration_ms=$10,details=$11::jsonb WHERE id=$1`,[runId,status,ok,failed,result.collected,result.grouped,published,result.skippedTranslation,result.skippedQuality,duration,JSON.stringify({updated,withMedia,collectorVersion:37,sourceResults:result.sourceResults})]).catch(()=>{});
    console.log('[news-worker-v37]',{status,ok,failed,collected:result.collected,stories:result.stories.length,published,updated,withMedia,skippedTranslation:result.skippedTranslation,skippedQuality:result.skippedQuality,ms:duration});
  }catch(err){console.error('[news-worker-v37]',err?.stack||err?.message||err);if(runId)await q(`UPDATE news_ingest_runs SET finished_at=now(),status='failed',duration_ms=$2,details=$3::jsonb WHERE id=$1`,[runId,Date.now()-started,JSON.stringify({error:cleanText(err?.message||err,1200)})]).catch(()=>{})}finally{running=false}
}

await initDb();await initCache().catch(()=>{});await cycle();const timer=setInterval(cycle,INTERVAL_MS);timer.unref?.();
async function shutdown(){clearInterval(timer);await Promise.allSettled([pool.end(),redis?.quit?.()]);process.exit(0)}process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
