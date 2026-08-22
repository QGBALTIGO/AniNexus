import crypto from 'node:crypto';
import { initDb, q, pool } from './db.mjs';
import { initCache, redis } from './cache.mjs';
import { getCatalog, getSchedule } from './provider.mjs';

const INTERVAL_MS=Math.max(60_000,Number(process.env.NEWS_WORKER_INTERVAL_MS||300_000));
const RETENTION_DAYS=Math.max(2,Math.min(30,Number(process.env.NEWS_RETENTION_DAYS||7)));
const MAX_PER_SOURCE=Math.max(4,Math.min(30,Number(process.env.NEWS_MAX_PER_SOURCE||14)));
const UA='AniNexus-NewsBot/2.0 (+https://aninexus.seudominio.com)';
const TRANSLATE='https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=pt&dt=t&q=';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const slug=s=>String(s||'noticia').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,112)||'noticia';
const hash=s=>crypto.createHash('sha256').update(String(s||'')).digest('hex').slice(0,18);
const clean=s=>String(s??'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim();
const abs=(u,base)=>{try{return new URL(u,base).href}catch{return''}};
const iso=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?'':d.toISOString()};
const safeUrl=u=>{try{const x=new URL(String(u||''));return x.protocol==='https:'?x.href:''}catch{return''}};

async function get(url,type='text',timeout=12_000){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const r=await fetch(url,{signal:controller.signal,headers:{'user-agent':UA,accept:type==='json'?'application/json':'text/html,application/xml;q=0.9,*/*;q=0.8'}});
    if(!r.ok)throw new Error(`${url}: ${r.status}`);
    return type==='json'?r.json():r.text();
  }finally{clearTimeout(timer)}
}

async function translate(text){
  const value=clean(text).slice(0,4200);if(!value)return'';
  try{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6500);
    const r=await fetch(TRANSLATE+encodeURIComponent(value),{signal:controller.signal,headers:{'user-agent':UA}}).finally(()=>clearTimeout(timer));
    if(!r.ok)return value;
    const j=await r.json();return clean((j?.[0]||[]).map(x=>x?.[0]||'').join(''))||value;
  }catch{return value}
}

function category(item){
  const t=`${item.title||''} ${item.summary||''}`.toLowerCase();
  if(/trailer|teaser|promo|music video|vídeo|video|pv\b/.test(t))return'TRAILER';
  if(/manga|mangá|manhwa|volume|chapter|capítulo|novel/.test(t))return'MANGA';
  if(/season|temporada|anime adaptation|adapta[cç][aã]o|anime/.test(t))return'SEASON';
  return'OTHER';
}
function categoryLabel(type){return({TRAILER:'Trailers',MANGA:'Mangás & novels',SEASON:'Animes',EPISODE:'Episódios',TRENDING:'Em alta',OTHER:'Notícias'})[type]||'Notícias'}
function imageFrom(v){if(!v)return'';if(typeof v==='string')return v;if(Array.isArray(v))return imageFrom(v[0]);if(typeof v==='object')return imageFrom(v.url||v.contentUrl||v.src||v.image);return''}
function rssTag(xml,tag){const m=xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,'i'));return m?clean(m[1].replace(/<!\[CDATA\[|\]\]>/g,'')):''}

function articlePayload({sourceName,sourceUrl,sourcePublishedAt,imageUrl,originalTitle,title,summary,eventType,extra=''}){
  const lead=clean(summary).slice(0,1150);
  const context=extra||(
    eventType==='TRAILER'?'O AniNexus registrou o anúncio como material promocional recente. Datas, elenco e disponibilidade podem receber novas atualizações conforme os responsáveis pela obra divulgarem mais informações.':
    eventType==='MANGA'?'A atualização envolve publicação, licenciamento ou novidades editoriais ligadas a mangás e light novels. O AniNexus mantém esta nota por alguns dias para concentrar as novidades mais recentes.':
    eventType==='SEASON'?'A novidade está relacionada a anime, temporada, adaptação ou anúncio de produção. Novos detalhes podem ser incorporados enquanto a notícia permanecer no feed recente.':
    'Esta nota faz parte do feed recente do AniNexus e resume o anúncio em português, preservando a origem editorial nos metadados internos.'
  );
  return JSON.stringify({version:2,sourceName,sourceUrl:safeUrl(sourceUrl),sourcePublishedAt:sourcePublishedAt||'',imageUrl:safeUrl(imageUrl),originalTitle:clean(originalTitle).slice(0,260),title:clean(title).slice(0,260),lead,details:[context],category:categoryLabel(eventType),retentionDays:RETENTION_DAYS});
}

async function notifyFollowers({dedupeKey,eventType,title,summary,mediaIds=[]}){
  const kind=eventType==='EPISODE'?'EPISODE':'NEWS';
  for(const mediaId of mediaIds){
    const url='/noticias';
    await q(`INSERT INTO notifications(user_id,kind,title,body,media_id,url,dedupe_key)
      SELECT user_id,$1,$2,$3,$4,$5,$6 FROM user_follows
      WHERE media_id=$4 AND media_type='ANIME' AND (($1='EPISODE' AND notify_episode=true) OR ($1='NEWS' AND notify_news=true))
      ON CONFLICT(user_id,dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING`,[kind,title,summary,mediaId,url,dedupeKey]).catch(()=>{});
  }
}

async function publishNative({key,eventType='OTHER',title,summary='',mediaIds=[],sourceName='AniNexus',sourceUrl='',publishedAt='',imageUrl='',originalTitle='',extra=''}){
  const dedupeKey=`${eventType}:${key}`;
  const inserted=await q(`INSERT INTO news_events(dedupe_key,event_type,payload) VALUES($1,$2,$3)
    ON CONFLICT(dedupe_key) DO NOTHING RETURNING id`,[dedupeKey,eventType,{title,summary,mediaIds,sourceName,sourceUrl,imageUrl}]);
  if(!inserted.rowCount)return false;

  const titlePt=clean(await translate(title)).slice(0,220)||clean(title).slice(0,220)||'Notícia AniNexus';
  const summaryPt=clean(await translate(summary)).slice(0,1200)||clean(summary).slice(0,1200)||`O AniNexus registrou uma nova atualização sobre ${titlePt}.`;
  const articleSlug=`${slug(titlePt)}-${hash(dedupeKey)}`;
  const body=articlePayload({sourceName,sourceUrl,sourcePublishedAt:publishedAt,imageUrl,originalTitle:originalTitle||title,title:titlePt,summary:summaryPt,eventType,extra});
  const pub=publishedAt&&iso(publishedAt)?iso(publishedAt):new Date().toISOString();

  await q(`INSERT INTO news_articles(slug,source_kind,event_type,title,summary,body,status,media_ids,external_url,published_at)
    VALUES($1,'AUTOMATED',$2,$3,$4,$5,'published',$6,$7,$8)
    ON CONFLICT(slug) DO UPDATE SET title=EXCLUDED.title,summary=EXCLUDED.summary,body=EXCLUDED.body,external_url=EXCLUDED.external_url,published_at=EXCLUDED.published_at,updated_at=now()`,
    [articleSlug,eventType,titlePt,summaryPt,body,JSON.stringify(mediaIds),safeUrl(sourceUrl)||null,pub]);
  await notifyFollowers({dedupeKey,eventType,title:titlePt,summary:summaryPt,mediaIds});
  await q('UPDATE news_events SET processed_at=now() WHERE dedupe_key=$1',[dedupeKey]);
  return true;
}

function extractScripts(html){
  const out=[];
  for(const re of [/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/gi]){
    let m;while((m=re.exec(html))){try{out.push(JSON.parse(m[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&')))}catch{}}
  }
  return out;
}
function maybeCrunchy(o,base){
  if(!o||typeof o!=='object')return null;
  const title=clean(o.headline||o.title||o.name||'');let url=o.url||o.href||o.canonicalUrl||o.link||o.permalink||'';
  if(typeof url==='object')url=url.url||url.href||'';url=abs(url,base);
  const publishedAt=iso(o.datePublished||o.publishedAt||o.publishDate||o.date||o.createdAt||o.releaseDate||'');
  const imageUrl=abs(imageFrom(o.image||o.thumbnail||o.images||o.heroImage),base);
  const summary=clean(o.description||o.summary||o.excerpt||o.dek||'');
  if(title.length<14||title.length>230||!url||!url.includes('/news/'))return null;
  return{sourceName:'Crunchyroll Notícias',title,summary,url,imageUrl,publishedAt};
}
function walkCrunchy(value,base,out,seen=new WeakSet()){
  if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);
  const item=maybeCrunchy(value,base);if(item)out.push(item);
  if(Array.isArray(value)){for(const v of value)walkCrunchy(v,base,out,seen);return}
  for(const v of Object.values(value))walkCrunchy(v,base,out,seen);
}
async function crunchyroll(){
  const base='https://www.crunchyroll.com',html=await get(`${base}/pt-br/news/latest`),out=[];
  for(const j of extractScripts(html))walkCrunchy(j,base,out);
  return dedupeExternal(out).slice(0,MAX_PER_SOURCE);
}
async function ann(){
  const xml=await get('https://www.animenewsnetwork.com/all/rss.xml?ann-edition=us'),out=[];
  for(const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)){
    const x=m[1],title=rssTag(x,'title'),url=rssTag(x,'link'),publishedAt=iso(rssTag(x,'pubDate')),summary=rssTag(x,'description');
    const imageUrl=(x.match(/<(?:media:content|enclosure)[^>]+url=["']([^"']+)/i)||[])[1]||'';
    if(title&&url)out.push({sourceName:'Anime News Network',title,summary:summary.slice(0,900),url,imageUrl,publishedAt});
  }
  return dedupeExternal(out).slice(0,MAX_PER_SOURCE);
}
async function mal(){
  const top=await get('https://api.jikan.moe/v4/top/anime?filter=airing&limit=10','json'),out=[];
  for(let i=0;i<Math.min(7,top?.data?.length||0);i++){
    const anime=top.data[i];if(i)await sleep(360);
    try{
      const j=await get(`https://api.jikan.moe/v4/anime/${anime.mal_id}/news`,'json');
      for(const n of (j?.data||[]).slice(0,2))out.push({sourceName:'MyAnimeList',title:clean(n.title),summary:clean(n.excerpt||'').slice(0,900),url:n.url,imageUrl:n.images?.jpg?.image_url||anime.images?.jpg?.large_image_url||anime.images?.jpg?.image_url||'',publishedAt:iso(n.date)});
    }catch{}
  }
  return dedupeExternal(out).slice(0,MAX_PER_SOURCE);
}
function dedupeExternal(items){
  const seen=new Set(),out=[];
  for(const item of items){const url=safeUrl(item?.url);if(!item?.title||!url)continue;const key=url.toLowerCase().replace(/[?#].*$/,'');if(seen.has(key))continue;seen.add(key);out.push({...item,url})}
  return out.sort((a,b)=>new Date(b.publishedAt||0)-new Date(a.publishedAt||0));
}
async function syncEditorialSources(){
  const jobs=await Promise.allSettled([crunchyroll(),ann(),mal()]);
  for(const job of jobs){
    if(job.status!=='fulfilled'){console.warn('[news-source]',job.reason?.message||job.reason);continue}
    for(const item of job.value){
      const age=item.publishedAt?Date.now()-new Date(item.publishedAt).getTime():0;
      if(age>RETENTION_DAYS*864e5)continue;
      const eventType=category(item);
      await publishNative({key:`source:${hash(item.url)}`,eventType,title:item.title,summary:item.summary,sourceName:item.sourceName,sourceUrl:item.url,publishedAt:item.publishedAt,imageUrl:item.imageUrl,originalTitle:item.title});
    }
  }
}

async function syncSchedule(){
  const now=Math.floor(Date.now()/1000),end=now+8*86400,items=await getSchedule(now-3600,end);
  for(const x of items){
    const m=x.media,id=m?.id;if(!id)continue;
    const name=m.title||m.titleRomaji||'Anime';
    const when=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(x.airingAt*1000));
    if(x.episode===1)await publishNative({key:`${id}:${x.airingAt}:premiere`,eventType:'SEASON',title:`${name} entra em estreia`,summary:`O primeiro episódio está previsto para ${when}, no horário de Brasília.`,mediaIds:[id],sourceName:'AniNexus',extra:'O calendário do AniNexus detectou a estreia e mantém esta publicação ligada à programação do anime.'});
    if(m.episodes&&x.episode===m.episodes)await publishNative({key:`${id}:${x.airingAt}:finale`,eventType:'EPISODE',title:`${name} chega ao episódio final`,summary:`O episódio ${x.episode} está programado para ${when}, encerrando a temporada atual.`,mediaIds:[id],sourceName:'AniNexus'});
  }
}
async function syncCatalog(){
  const data=await getCatalog({page:1,perPage:30,sort:'NEW'});
  for(const m of data.items||[]){
    if(!m?.id||!m.trailer?.id)continue;
    await publishNative({key:`${m.id}:trailer:${m.trailer.id}`,eventType:'TRAILER',title:`Novo material em vídeo de ${m.title}`,summary:`Foi detectado novo material promocional em vídeo para ${m.title}.`,mediaIds:[m.id],sourceName:'AniNexus',imageUrl:m.cover||m.coverImage||''});
  }
}
async function cleanupOld(){
  await q(`DELETE FROM news_articles WHERE source_kind='AUTOMATED' AND COALESCE(published_at,created_at) < now() - ($1::text || ' days')::interval`,[String(RETENTION_DAYS)]);
  await q(`DELETE FROM news_events WHERE created_at < now() - (($1::int + 2) * interval '1 day')`,[RETENTION_DAYS]);
}
async function runCycle(){
  const lockValue=`${process.pid}:${Date.now()}`;
  const locked=await redis.set('worker:news:lock',lockValue,{NX:true,EX:Math.max(60,Math.floor(INTERVAL_MS/1000)-5)}).catch(()=>null);
  if(!locked)return;
  try{await Promise.allSettled([syncEditorialSources(),syncSchedule(),syncCatalog()]);await cleanupOld()}finally{
    const current=await redis.get('worker:news:lock').catch(()=>null);if(current===lockValue)await redis.del('worker:news:lock').catch(()=>{});
  }
}

let stopping=false;
async function shutdown(){if(stopping)return;stopping=true;await Promise.allSettled([redis.quit(),pool.end()]);process.exit(0)}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);

await initDb();await initCache();
while(!stopping){try{await runCycle()}catch(e){console.error('[news-worker]',e?.stack||e?.message||e)}await sleep(INTERVAL_MS)}
