import { initDb, q, pool } from './db.mjs';
import { initCache, redis } from './cache.mjs';
import { articleExpiry } from './native-news.mjs';
import { cleanText, sha, safeUrl, mergeSources } from './news-core.mjs';
import { collectEditorialStories } from './news-rich-v37.mjs';

const INTERVAL_MS = Math.max(60_000, Number(process.env.NEWS_WORKER_INTERVAL_MS || 300_000));
const RETENTION_DAYS = Math.max(3, Math.min(10, Number(process.env.NEWS_RETENTION_DAYS || 7)));
const MIN_QUALITY = Math.max(.35, Math.min(.9, Number(process.env.NEWS_MIN_QUALITY || .50)));
const MAX_PER_SOURCE = Math.max(10, Math.min(60, Number(process.env.NEWS_MAX_PER_SOURCE || 45)));
const MAX_STORIES = Math.max(20, Math.min(80, Number(process.env.NEWS_MAX_STORIES || 60)));
const MAX_AGE = Math.max(48, Math.min(240, Number(process.env.NEWS_MAX_SOURCE_AGE_HOURS || 168)));
let running = false;

function signature(article) {
  return sha(JSON.stringify({
    title: article.title,
    summary: article.summary,
    image: article.imageUrl,
    author: article.author,
    tags: article.tags,
    sourceContent: article.sourceContent,
    contentMode: article.contentMode,
    sources: article.sources,
    coverage: article.coverage
  }), 32);
}

function body(article) {
  return JSON.stringify({
    version: 6,
    title: article.title,
    originalTitle: article.title,
    lead: article.summary,
    category: article.category,
    sourceLanguage: 'pt-BR',
    contentMode: article.contentMode,
    imageUrl: article.imageUrl || '',
    tags: article.tags || [],
    sources: article.sources || [],
    coverage: article.coverage || {},
    readingMinutes: article.readingMinutes || 1,
    wordCount: article.wordCount || 0
  });
}

async function saveRevision(row) {
  await q(`INSERT INTO news_article_revisions(article_id,version,title,summary,facts,content_sections,source_content,content_mode,sources,image_url,quality_score,content_signature)
    VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9::jsonb,$10,$11,$12)
    ON CONFLICT(article_id,version) DO NOTHING`, [
      row.id,
      Number(row.content_version || 1),
      row.title,
      row.summary,
      JSON.stringify(row.facts || []),
      JSON.stringify(row.content_sections || []),
      JSON.stringify(row.source_content || []),
      row.content_mode || 'legacy',
      JSON.stringify(row.sources || []),
      row.image_url || null,
      Number(row.quality_score || 0),
      row.content_signature || null
    ]).catch(() => {});
}

async function persist(article) {
  const sig = signature(article);
  const published = new Date(article.publishedAt || Date.now());
  const expires = articleExpiry(published, RETENTION_DAYS);
  const sources = mergeSources([], article.sources || []);
  const facts = [];
  const sections = [];
  const sourceContent = Array.isArray(article.sourceContent) ? article.sourceContent : [];
  const contentMode = article.contentMode === 'full' ? 'full' : 'excerpt';
  const hero = safeUrl(article.imageUrl) || safeUrl(article.mediaGallery?.[0]?.url) || null;
  const existing = await q(`SELECT id,slug,title,summary,facts,content_sections,source_content,content_mode,sources,image_url,quality_score,content_signature,content_version,source_hash
    FROM news_articles WHERE source_kind='AUTOMATED' AND (source_hash=$1 OR story_hash=$2)
      AND COALESCE(last_seen_at,source_published_at,published_at,created_at)>now()-interval '12 days'
    ORDER BY (source_hash=$1) DESC,last_seen_at DESC NULLS LAST LIMIT 1`, [article.sourceHash, article.storyHash]);
  const row = existing.rows[0];

  if (row) {
    if (row.content_signature && row.content_signature !== sig) await saveRevision(row);
    const version = row.content_signature && row.content_signature !== sig ? Number(row.content_version || 1) + 1 : Number(row.content_version || 1);
    await q(`UPDATE news_articles SET event_type=$2,title=$3,summary=$4,body=$5,status='published',image_url=COALESCE($6,image_url),image_alt=$7,source_name=$8,source_url=$9,external_url=$9,source_published_at=$10,expires_at=$11,language='pt-BR',translation_status='ready',facts=$12::jsonb,original_title=$13,source_author=$14,source_language='pt-BR',sources=$15::jsonb,source_count=$16,content_sections=$17::jsonb,source_content=$18::jsonb,content_mode=$19,reading_minutes=$20,word_count=$21,quality_score=GREATEST(quality_score,$22),content_signature=$23,content_version=$24,image_source_url=COALESCE($25,image_source_url),last_source_update_at=$26,source_hash=$27,story_hash=$28,last_seen_at=now(),updated_at=now() WHERE id=$1`, [
      row.id,
      article.eventType,
      article.title,
      article.summary,
      body(article),
      hero,
      article.title,
      article.sourceName,
      article.sourceUrl,
      published,
      expires,
      JSON.stringify(facts),
      article.title,
      cleanText(article.author || '', 180) || null,
      JSON.stringify(sources),
      sources.length,
      JSON.stringify(sections),
      JSON.stringify(sourceContent),
      contentMode,
      article.readingMinutes || 1,
      article.wordCount || 0,
      article.qualityScore || 0,
      sig,
      version,
      hero ? article.sourceUrl : null,
      new Date(article.updatedAt || published),
      article.sourceHash,
      article.storyHash
    ]);
    return { created: false, updated: row.content_signature !== sig };
  }

  await q(`INSERT INTO news_articles(slug,source_kind,event_type,title,summary,body,spoiler,status,media_ids,external_url,published_at,image_url,image_alt,source_name,source_url,source_published_at,expires_at,language,translation_status,facts,source_hash,story_hash,original_title,source_author,source_language,sources,source_count,content_sections,source_content,content_mode,reading_minutes,word_count,quality_score,content_signature,content_version,image_source_url,first_seen_at,last_seen_at,last_source_update_at)
    VALUES($1,'AUTOMATED',$2,$3,$4,$5,false,'published','[]'::jsonb,$6,$7,$8,$3,$9,$6,$7,$10,'pt-BR','ready',$11::jsonb,$12,$13,$3,$14,'pt-BR',$15::jsonb,$16,$17::jsonb,$18::jsonb,$19,$20,$21,$22,$23,1,$24,now(),now(),$25)
    ON CONFLICT(source_hash) WHERE source_kind='AUTOMATED' AND source_hash IS NOT NULL DO UPDATE SET last_seen_at=now(),expires_at=EXCLUDED.expires_at,status='published',updated_at=now()`, [
      article.slug,
      article.eventType,
      article.title,
      article.summary,
      body(article),
      article.sourceUrl,
      published,
      hero,
      article.sourceName,
      expires,
      JSON.stringify(facts),
      article.sourceHash,
      article.storyHash,
      cleanText(article.author || '', 180) || null,
      JSON.stringify(sources),
      sources.length,
      JSON.stringify(sections),
      JSON.stringify(sourceContent),
      contentMode,
      article.readingMinutes || 1,
      article.wordCount || 0,
      article.qualityScore || 0,
      sig,
      hero ? article.sourceUrl : null,
      new Date(article.updatedAt || published)
    ]);
  return { created: true, updated: false };
}

async function health(result) {
  const now = new Date();
  for (const source of result.sourceResults || []) {
    if (source.enabled === false) continue;
    const key = source.key && source.key !== 'UNKNOWN' ? source.key : String(source.name || 'SOURCE').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
    await q(`INSERT INTO news_source_health(source_key,source_name,last_attempt_at,last_success_at,last_error_at,last_error,last_item_count,consecutive_failures,total_successes,total_failures,updated_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
      ON CONFLICT(source_key) DO UPDATE SET source_name=EXCLUDED.source_name,last_attempt_at=EXCLUDED.last_attempt_at,last_success_at=CASE WHEN $11 THEN EXCLUDED.last_success_at ELSE news_source_health.last_success_at END,last_error_at=CASE WHEN $11 THEN news_source_health.last_error_at ELSE EXCLUDED.last_error_at END,last_error=CASE WHEN $11 THEN NULL ELSE EXCLUDED.last_error END,last_item_count=EXCLUDED.last_item_count,consecutive_failures=CASE WHEN $11 THEN 0 ELSE news_source_health.consecutive_failures+1 END,total_successes=news_source_health.total_successes+CASE WHEN $11 THEN 1 ELSE 0 END,total_failures=news_source_health.total_failures+CASE WHEN $11 THEN 0 ELSE 1 END,updated_at=now()`, [
      key,
      source.name || key,
      now,
      source.ok ? now : null,
      source.ok ? null : now,
      source.ok ? null : cleanText((source.errors || []).join(' | '), 1200),
      Number(source.count || 0),
      source.ok ? 0 : 1,
      source.ok ? 1 : 0,
      source.ok ? 0 : 1,
      Boolean(source.ok)
    ]).catch(() => {});
  }
}

async function cleanup({ archive = true, retireLegacy = false } = {}) {
  if (archive) await q(`UPDATE news_articles SET status='archived',updated_at=now() WHERE source_kind='AUTOMATED' AND status='published' AND expires_at IS NOT NULL AND expires_at<=now()`);
  if (retireLegacy) await q(`UPDATE news_articles SET status='archived',updated_at=now() WHERE source_kind='AUTOMATED' AND status='published' AND content_mode='legacy'`);
  await q(`DELETE FROM news_articles WHERE source_kind='AUTOMATED' AND status='archived' AND COALESCE(expires_at,updated_at)<now()-interval '21 days'`);
  await q(`DELETE FROM news_ingest_runs WHERE started_at<now()-interval '60 days'`).catch(() => {});
}

async function cycle() {
  if (running) return;
  running = true;
  const started = Date.now();
  let runId = null;
  try {
    const run = await q(`INSERT INTO news_ingest_runs(status) VALUES('running') RETURNING id`).catch(() => ({ rows: [] }));
    runId = run.rows[0]?.id || null;
    const result = await collectEditorialStories({ maxPerSource: MAX_PER_SOURCE, maxAgeHours: MAX_AGE, maxStories: MAX_STORIES, minQuality: MIN_QUALITY });
    let published = 0;
    let updated = 0;
    let withMedia = 0;
    for (const article of result.stories) {
      try {
        const saved = await persist(article);
        if (saved.created) published++;
        if (saved.updated) updated++;
        if (article.mediaGallery?.length || article.imageUrl) withMedia++;
      } catch (error) {
        console.error('[news-v40-persist]', article.slug, error?.message || error);
      }
    }
    await health(result);
    const enabled = (result.sourceResults || []).filter(source => source.enabled !== false);
    const ok = enabled.filter(source => source.ok).length;
    const failed = enabled.length - ok;
    const hasHealthyContent = ok > 0 && result.stories.length > 0;
    const hasFidelityFeed = hasHealthyContent && result.stories.length >= 6 && result.stories.every(article => article.sourceContent?.length);
    await cleanup({ archive: hasHealthyContent, retireLegacy: hasFidelityFeed });
    const status = ok === 0 ? 'failed' : !hasHealthyContent || failed ? 'partial' : 'success';
    const duration = Date.now() - started;
    if (runId) await q(`UPDATE news_ingest_runs SET finished_at=now(),status=$2,sources_ok=$3,sources_failed=$4,collected_items=$5,grouped_stories=$6,published_stories=$7,skipped_translation=$8,skipped_quality=$9,duration_ms=$10,details=$11::jsonb WHERE id=$1`, [
      runId,
      status,
      ok,
      failed,
      result.collected,
      result.grouped,
      published,
      0,
      result.skippedQuality,
      duration,
      JSON.stringify({ updated, withMedia, collectorVersion: result.collectorVersion || 40, archiveExpired: hasHealthyContent, retireLegacy: hasFidelityFeed, sourceResults: result.sourceResults })
    ]).catch(() => {});
    console.log('[news-worker-v40]', { status, ok, failed, collected: result.collected, stories: result.stories.length, published, updated, withMedia, retireLegacy: hasFidelityFeed, skippedQuality: result.skippedQuality, ms: duration });
  } catch (error) {
    console.error('[news-worker-v40]', error?.stack || error?.message || error);
    if (runId) await q(`UPDATE news_ingest_runs SET finished_at=now(),status='failed',duration_ms=$2,details=$3::jsonb WHERE id=$1`, [runId, Date.now() - started, JSON.stringify({ error: cleanText(error?.message || error, 1200) })]).catch(() => {});
  } finally {
    running = false;
  }
}

await initDb();
await initCache().catch(() => {});
await cycle();
const timer = setInterval(cycle, INTERVAL_MS);
timer.unref?.();

async function shutdown() {
  clearInterval(timer);
  await Promise.allSettled([pool.end(), redis?.quit?.()]);
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
