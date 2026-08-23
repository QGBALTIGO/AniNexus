import { q } from './db.mjs';
import { cleanText } from './news-core.mjs';

const DEFAULT_TTL_DAYS=Math.max(2,Math.min(14,Number(process.env.NEWS_RETENTION_DAYS||7)));
const STALE_GRACE_DAYS=Math.max(DEFAULT_TTL_DAYS,Math.min(21,Number(process.env.NEWS_STALE_GRACE_DAYS||14)));
const FEED_FIELDS=`id,slug,source_kind,event_type,title,summary,spoiler,media_ids,image_url,image_alt,source_name,source_published_at,language,translation_status,facts,published_at,expires_at,original_title,source_author,source_language,sources,source_count,reading_minutes,word_count,quality_score,content_version,first_seen_at,last_seen_at,last_source_update_at,updated_at,view_count`;
const ARTICLE_FIELDS=`${FEED_FIELDS},body,source_url,image_source_url,content_sections,content_signature`;

export function articleExpiry(from=new Date(),days=DEFAULT_TTL_DAYS){
  const d=new Date(from);
  if(Number.isNaN(d.getTime()))return articleExpiry(new Date(),days);
  d.setUTCDate(d.getUTCDate()+Math.max(1,days));
  return d;
}

/* Archiving is intentionally NOT executed on a read request. The news worker owns lifecycle
   decisions after a healthy ingest cycle; a temporary source outage must never make GET /api/news
   erase or hide the last good feed. */
export async function expireOldNews(){
  await q(`UPDATE news_articles SET status='archived',updated_at=now()
    WHERE status='published' AND source_kind='AUTOMATED' AND expires_at IS NOT NULL AND expires_at<=now()`);
  await q(`DELETE FROM news_articles
    WHERE source_kind='AUTOMATED' AND status='archived' AND COALESCE(expires_at,updated_at)<now()-interval '21 days'`);
}

export async function getNativeNews({limit=20,offset=0,type=null,search=null}={}){
  const safeLimit=Math.max(1,Math.min(60,Number(limit)||20));
  const safeOffset=Math.max(0,Math.min(5000,Number(offset)||0));
  const safeType=type?cleanText(type,40).toUpperCase():null;
  const safeSearch=search?cleanText(search,120):null;
  const {rows}=await q(`SELECT ${FEED_FIELDS} FROM news_articles
    WHERE status='published' AND translation_status='ready' AND language='pt-BR'
      AND (expires_at IS NULL OR expires_at>now()-($5::text||' days')::interval)
      AND ($1::text IS NULL OR event_type=$1)
      AND ($2::text IS NULL OR title ILIKE '%'||$2||'%' OR summary ILIKE '%'||$2||'%' OR source_name ILIKE '%'||$2||'%')
    ORDER BY CASE WHEN expires_at IS NULL OR expires_at>now() THEN 1 ELSE 0 END DESC,
      COALESCE(last_source_update_at,source_published_at,published_at) DESC NULLS LAST,
      CASE WHEN image_url IS NULL OR image_url='' THEN 0 ELSE 1 END DESC,
      quality_score DESC,created_at DESC
    LIMIT $3 OFFSET $4`,[safeType,safeSearch,safeLimit,safeOffset,String(STALE_GRACE_DAYS)]);
  return rows;
}

export async function getNativeArticle(slug,{incrementView=true}={}){
  const safeSlug=cleanText(slug,180);
  const {rows}=await q(`SELECT ${ARTICLE_FIELDS} FROM news_articles
    WHERE slug=$1 AND status='published' AND translation_status='ready' AND language='pt-BR'
      AND (expires_at IS NULL OR expires_at>now()-($2::text||' days')::interval) LIMIT 1`,[safeSlug,String(STALE_GRACE_DAYS)]);
  const item=rows[0]||null;
  if(item&&incrementView){q(`UPDATE news_articles SET view_count=view_count+1 WHERE id=$1`,[item.id]).catch(()=>{});item.view_count=Number(item.view_count||0)+1}
  return item;
}

export async function getRelatedNews(article,{limit=4}={}){
  if(!article)return[];
  const safeLimit=Math.max(1,Math.min(8,Number(limit)||4));
  const {rows}=await q(`SELECT ${FEED_FIELDS} FROM news_articles
    WHERE id<>$1 AND status='published' AND translation_status='ready' AND language='pt-BR'
      AND (expires_at IS NULL OR expires_at>now()-($4::text||' days')::interval) AND event_type=$2
    ORDER BY CASE WHEN expires_at IS NULL OR expires_at>now() THEN 1 ELSE 0 END DESC,
      COALESCE(last_source_update_at,source_published_at,published_at) DESC NULLS LAST,
      CASE WHEN image_url IS NULL OR image_url='' THEN 0 ELSE 1 END DESC,
      quality_score DESC LIMIT $3`,[article.id,article.event_type||'OTHER',safeLimit,String(STALE_GRACE_DAYS)]);
  return rows;
}

export { DEFAULT_TTL_DAYS, STALE_GRACE_DAYS };
