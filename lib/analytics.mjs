import { q } from './db.mjs';

const MAX_QUEUE=Math.max(500,Math.min(50_000,Number(process.env.ANALYTICS_MAX_QUEUE||10_000)));
const FLUSH_MS=Math.max(250,Math.min(10_000,Number(process.env.ANALYTICS_FLUSH_MS||1000)));
const BATCH=Math.max(50,Math.min(2000,Number(process.env.ANALYTICS_BATCH_SIZE||500)));
const SAMPLE=Math.max(0,Math.min(1,Number(process.env.ANALYTICS_SAMPLE_RATE||1)));
let queue=[];
let timer=null;
let flushing=false;
let dropped=0;

export function enqueueAnalytics(event){
  if(!event||Math.random()>SAMPLE)return true;
  if(queue.length>=MAX_QUEUE){dropped++;return false;}
  queue.push({event_name:String(event.event||'').slice(0,60),path:String(event.path||'').slice(0,300),media_id:event.mediaId||null,created_at:new Date().toISOString()});
  if(!timer)timer=setTimeout(flushAnalytics,FLUSH_MS).unref();
  return true;
}

export async function flushAnalytics(){
  if(flushing)return;
  if(timer){clearTimeout(timer);timer=null;}
  if(!queue.length)return;
  flushing=true;
  try{
    while(queue.length){
      const batch=queue.splice(0,BATCH);
      try{
        await q(`INSERT INTO analytics_events(event_name,path,media_id,created_at)
          SELECT event_name,path,media_id,created_at
          FROM jsonb_to_recordset($1::jsonb) AS x(event_name text,path text,media_id bigint,created_at timestamptz)`,[JSON.stringify(batch)]);
      }catch(err){
        dropped+=batch.length;
        console.error('[analytics] batch dropped:',err?.message||err);
        break;
      }
    }
  }finally{
    flushing=false;
    if(queue.length&&!timer)timer=setTimeout(flushAnalytics,FLUSH_MS).unref();
  }
}

export function analyticsStats(){return{queued:queue.length,dropped,flushing}}
