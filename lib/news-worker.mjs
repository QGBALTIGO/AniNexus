import crypto from 'node:crypto';
import { initDb, q, pool } from './db.mjs';
import { initCache, redis } from './cache.mjs';
import { getCatalog, getSchedule } from './provider.mjs';

const INTERVAL_MS = Math.max(60_000, Number(process.env.NEWS_WORKER_INTERVAL_MS || 300_000));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const slug = s => String(s||'noticia').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,120);
const hash = s => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0,18);

async function publishEvent({key,eventType,title,summary,mediaIds=[]}) {
  const dedupeKey = `${eventType}:${key}`;
  const event = await q(`INSERT INTO news_events(dedupe_key,event_type,payload) VALUES($1,$2,$3)
    ON CONFLICT(dedupe_key) DO NOTHING RETURNING id`,[dedupeKey,eventType,{title,summary,mediaIds}]);
  if (!event.rowCount) return false;
  const articleSlug = `${slug(title)}-${hash(dedupeKey)}`;
  await q(`INSERT INTO news_articles(slug,source_kind,event_type,title,summary,status,media_ids,published_at)
    VALUES($1,'AUTOMATED',$2,$3,$4,'published',$5,now()) ON CONFLICT(slug) DO NOTHING`,[articleSlug,eventType,title,summary,JSON.stringify(mediaIds)]);
  await q('UPDATE news_events SET processed_at=now() WHERE dedupe_key=$1',[dedupeKey]);
  return true;
}

async function syncSchedule() {
  const now = Math.floor(Date.now()/1000), end = now + 8*86400;
  const items = await getSchedule(now-3600,end);
  for (const x of items) {
    const m=x.media, id=m?.id; if(!id) continue;
    const title=m.title || m.titleRomaji || 'Anime';
    const when=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(x.airingAt*1000));
    if(x.episode===1) await publishEvent({key:`${id}:${x.airingAt}:premiere`,eventType:'SEASON',title:`${title} entra em estreia`,summary:`O primeiro episódio está previsto para ${when}, no horário de Brasília.`,mediaIds:[id]});
    if(m.episodes && x.episode===m.episodes) await publishEvent({key:`${id}:${x.airingAt}:finale`,eventType:'EPISODE',title:`${title} chega ao episódio final`,summary:`O episódio ${x.episode} está programado para ${when}, encerrando a temporada atual.`,mediaIds:[id]});
  }
}

async function syncCatalog() {
  const data=await getCatalog({page:1,perPage:30,sort:'NEW'});
  for(const m of data.items||[]){
    if(!m?.id||!m.trailer?.id)continue;
    await publishEvent({key:`${m.id}:trailer:${m.trailer.id}`,eventType:'TRAILER',title:`Novo material em vídeo de ${m.title}`,summary:`O catálogo detectou material promocional em vídeo disponível para ${m.title}.`,mediaIds:[m.id]});
  }
}

async function runCycle() {
  const lockValue=`${process.pid}:${Date.now()}`;
  const locked=await redis.set('worker:news:lock',lockValue,{NX:true,EX:Math.max(60,Math.floor(INTERVAL_MS/1000)-5)}).catch(()=>null);
  if(!locked)return;
  try{await Promise.allSettled([syncSchedule(),syncCatalog()])}finally{
    const current=await redis.get('worker:news:lock').catch(()=>null);if(current===lockValue)await redis.del('worker:news:lock').catch(()=>{});
  }
}

let stopping=false;
async function shutdown(){if(stopping)return;stopping=true;await Promise.allSettled([redis.quit(),pool.end()]);process.exit(0)}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);

await initDb();await initCache();
while(!stopping){try{await runCycle()}catch(e){console.error('[news-worker]',e?.message||e)}await sleep(INTERVAL_MS)}
