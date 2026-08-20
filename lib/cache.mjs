import { createClient } from 'redis';

const url = process.env.REDIS_URL || 'redis://redis:6379';
export const redis = createClient({ url, socket: { reconnectStrategy: retries => Math.min(retries * 100, 3000) } });
redis.on('error', err => console.error('[redis]', err.message));
const inflight = new Map();

export async function initCache() {
  if (!redis.isOpen) await redis.connect();
}
export async function cacheGet(key) {
  try { const v = await redis.get(key); return v ? JSON.parse(v) : null; } catch { return null; }
}
export async function cacheSet(key, value, ttl=120) {
  try { await redis.set(key, JSON.stringify(value), { EX: Math.max(1, Math.floor(ttl)) }); } catch {}
}
export async function cacheRemember(key, ttl, fn) {
  const hit = await cacheGet(key); if (hit !== null) return hit;
  if (inflight.has(key)) return inflight.get(key);
  const work = (async()=>{
    const value = await fn();
    await cacheSet(key, value, ttl);
    return value;
  })();
  inflight.set(key, work);
  try { return await work; } finally { inflight.delete(key); }
}
