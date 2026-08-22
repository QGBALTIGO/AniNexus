import { q } from './db.mjs';

const DEFAULT_TTL_DAYS=Math.max(2,Math.min(14,Number(process.env.NEWS_RETENTION_DAYS||5)));

export function cleanText(value='',max=30000){
  return String(value||'')
    .replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&quot;/gi,'"')
    .replace(/&#39;/gi,"'")
    .replace(/\s+/g,' ')
    .trim()
    .slice(0,max);
}

export function articleExpiry(from=new Date(),days=DEFAULT_TTL_DAYS){
  const d=new Date(from);
  d.setUTCDate(d.getUTCDate()+days);
  return d;
}

export async function expireOldNews(){
  await q(`UPDATE news_articles SET status='archived',updated_at=now() WHERE status='published' AND expires_at IS NOT NULL AND expires_at<=now()`);
  await q(`DELETE FROM news_articles WHERE status='archived' AND COALESCE(expires_at,updated_at)<now()-interval '14 days'`);
}

export async function getNativeNews({limit=20,offset=0,type=null}={}){
  await expireOldNews().catch(()=>{});
  const {rows}=await q(`SELECT id,slug,source_kind,event_type,title,summary,body,spoiler,media_ids,image_url,image_alt,source_name,source_url,source_published_at,language,facts,published_at,expires_at
    FROM news_articles
    WHERE status='published' AND (expires_at IS NULL OR expires_at>now()) AND ($1::text IS NULL OR event_type=$1)
    ORDER BY COALESCE(source_published_at,published_at) DESC NULLS LAST,created_at DESC LIMIT $2 OFFSET $3`,[type,limit,offset]);
  return rows;
}

export async function getNativeArticle(slug){
  await expireOldNews().catch(()=>{});
  const {rows}=await q(`SELECT id,slug,source_kind,event_type,title,summary,body,spoiler,media_ids,image_url,image_alt,source_name,source_url,source_published_at,language,facts,published_at,expires_at
    FROM news_articles WHERE slug=$1 AND status='published' AND (expires_at IS NULL OR expires_at>now()) LIMIT 1`,[slug]);
  return rows[0]||null;
}

export { DEFAULT_TTL_DAYS };
