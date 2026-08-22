import crypto from 'node:crypto';
import { q } from './db.mjs';
import { cleanText, articleExpiry } from './native-news.mjs';

const TRANSLATE='https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=pt&dt=t&q=';

function slugify(s='noticia'){
  return cleanText(s,180).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,100)||'noticia';
}
function hash(s){return crypto.createHash('sha256').update(String(s)).digest('hex').slice(0,14)}
async function translatePt(text){
  const input=cleanText(text,4200);if(!input)return'';
  try{const r=await fetch(TRANSLATE+encodeURIComponent(input),{headers:{'user-agent':'AniNexusNewsBot/1.0'},signal:AbortSignal.timeout(8000)});if(!r.ok)return input;const j=await r.json();return cleanText((j?.[0]||[]).map(x=>x?.[0]||'').join(''),4200)||input}catch{return input}
}
function sentenceSplit(text){return cleanText(text,8000).split(/(?<=[.!?])\s+/).map(x=>x.trim()).filter(x=>x.length>20)}
function originalRewrite(title,summary){
  const source=sentenceSplit(summary);
  const lead=source.slice(0,2).join(' ');
  const context=source.slice(2,5).join(' ');
  const body=[];
  if(lead)body.push(`A informação mais importante é a seguinte: ${lead}`);
  if(context)body.push(`Segundo os dados divulgados, ${context}`);
  body.push('O AniNexus acompanha novas informações sobre este assunto e atualiza o conteúdo quando há mudanças relevantes.');
  return body.join('\n\n');
}
function pickImage(item){return item.image||item.imageUrl||item.thumbnail||item.ogImage||null}
function classify(item){const c=String(item.category||item.eventType||'').toLowerCase(),t=String(item.title||'').toLowerCase();if(c.includes('mang')||t.includes('manga'))return'MANGA';if(c.includes('trailer')||t.includes('trailer')||t.includes('teaser'))return'TRAILER';if(t.includes('season')||t.includes('temporada'))return'SEASON';return'OTHER'}

export async function ingestNewsItems(items=[]){
  let written=0;
  for(const raw of items){
    const sourceUrl=String(raw.url||raw.sourceUrl||'').slice(0,2000);if(!sourceUrl)continue;
    const sourceTitle=cleanText(raw.title,220);if(!sourceTitle)continue;
    const sourceSummary=cleanText(raw.summary||raw.description,1200);
    const [titlePt,summaryPt]=await Promise.all([translatePt(sourceTitle),translatePt(sourceSummary)]);
    const title=cleanText(titlePt||sourceTitle,220),summary=cleanText(summaryPt||sourceSummary||sourceTitle,1200);
    const body=originalRewrite(title,summary);
    const sourceName=cleanText(raw.source||raw.sourceName||'Fonte acompanhada',120);
    const sourcePublished=raw.publishedAt||raw.published_at||new Date().toISOString();
    const unique=hash(sourceUrl);
    const slug=`${slugify(title)}-${unique}`;
    const facts=sentenceSplit(summary).slice(0,5);
    const expires=articleExpiry(new Date(sourcePublished));
    await q(`INSERT INTO news_articles(slug,source_kind,event_type,title,summary,body,spoiler,status,media_ids,external_url,published_at,image_url,image_alt,source_name,source_url,source_published_at,expires_at,language,facts)
      VALUES($1,'AUTOMATED',$2,$3,$4,$5,false,'published','[]'::jsonb,$6,now(),$7,$8,$9,$6,$10,$11,'pt-BR',$12::jsonb)
      ON CONFLICT(slug) DO UPDATE SET title=EXCLUDED.title,summary=EXCLUDED.summary,body=EXCLUDED.body,image_url=COALESCE(EXCLUDED.image_url,news_articles.image_url),source_name=EXCLUDED.source_name,source_url=EXCLUDED.source_url,source_published_at=EXCLUDED.source_published_at,expires_at=EXCLUDED.expires_at,facts=EXCLUDED.facts,status='published',updated_at=now()`,[
      slug,classify(raw),title,summary,body,sourceUrl,pickImage(raw),title,sourceName,sourcePublished,expires,JSON.stringify(facts)
    ]);
    written++;
  }
  return written;
}
