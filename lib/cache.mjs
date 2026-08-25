import { createClient } from 'redis';
import crypto from 'node:crypto';

const url = process.env.REDIS_URL || 'redis://redis:6379';
const password = String(process.env.REDIS_PASSWORD || '');
if (process.env.NODE_ENV === 'production' && password.length < 24) {
  throw new Error('REDIS_PASSWORD must contain at least 24 characters in production');
}
export const redis = createClient({ url, password: password || undefined, socket: { reconnectStrategy: retries => Math.min(retries * 100, 3000), connectTimeout: 5000 } });
redis.on('error', err => console.error('[redis]', err.message));
const inflight = new Map();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

export async function initCache() {
  if (!redis.isOpen) await redis.connect();
}
export async function cacheGet(key) {
  try { const v = await redis.get(key); return v ? JSON.parse(v) : null; } catch { return null; }
}
export async function cacheSet(key, value, ttl=120) {
  try { await redis.set(key, JSON.stringify(value), { EX: Math.max(1, Math.floor(ttl)) }); return true; } catch { return false; }
}
export async function cacheDel(key) {
  try { await redis.del(key); return true; } catch { return false; }
}
async function releaseLock(key,token){
  try{await redis.eval("if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end",{keys:[key],arguments:[token]})}catch{}
}

// Cache-aside with local request coalescing, Redis cross-process lock and stale-if-error.
export async function cacheRemember(key, ttl, fn, options={}) {
  const hit = await cacheGet(key); if (hit !== null) return hit;
  if (inflight.has(key)) return inflight.get(key);
  const staleKey=`stale:${key}`,staleTtl=Math.max(ttl+30,Number(options.staleTtl||ttl*8||600));
  const work = (async()=>{
    let lockToken=null,locked=false;
    if(redis.isOpen){
      lockToken=crypto.randomBytes(12).toString('hex');
      try{locked=!!(await redis.set(`lock:${key}`,lockToken,{NX:true,PX:Math.max(5000,Math.min(30000,ttl*1000))}))}catch{}
      if(!locked){
        for(let i=0;i<5;i++){
          await sleep(60+i*40);
          const shared=await cacheGet(key);if(shared!==null)return shared;
        }
        const stale=await cacheGet(staleKey);if(stale!==null)return stale;
      }
    }
    try{
      const value = await fn();
      await Promise.all([cacheSet(key,value,ttl),cacheSet(staleKey,value,staleTtl)]);
      return value;
    }catch(err){
      const stale=await cacheGet(staleKey);if(stale!==null)return stale;
      throw err;
    }finally{
      if(locked&&lockToken)await releaseLock(`lock:${key}`,lockToken);
    }
  })();
  inflight.set(key, work);
  try { return await work; } finally { inflight.delete(key); }
}
