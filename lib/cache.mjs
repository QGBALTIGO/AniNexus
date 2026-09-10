import { createClient } from 'redis';
import crypto from 'node:crypto';

const url = process.env.REDIS_URL || 'redis://redis:6379';
const password = String(process.env.REDIS_PASSWORD || '');
const operationTimeoutMs = Math.max(100, Math.min(10_000, Number(process.env.REDIS_OPERATION_TIMEOUT_MS || 1500)));
const connectTimeoutMs = Math.max(1000, Math.min(30_000, Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 6000)));
if (process.env.NODE_ENV === 'production' && password.length < 24) {
  throw new Error('REDIS_PASSWORD must contain at least 24 characters in production');
}

export const redis = createClient({
  url,
  password: password || undefined,
  disableOfflineQueue: true,
  commandsQueueMaxLength: Math.max(100, Math.min(20_000, Number(process.env.REDIS_COMMAND_QUEUE_MAX || 2000))),
  socket: {reconnectStrategy: retries => Math.min(retries * 100, 3000), connectTimeout: 5000}
});
redis.on('error', err => console.error('[redis]', err.message));

const inflight = new Map();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const metrics = {getHit: 0, getMiss: 0, getError: 0, setError: 0, deadline: 0, staleHit: 0, lockContention: 0, busy: 0};

export function cacheMetricsSnapshot() { return {...metrics, inflight: inflight.size}; }

export class CacheDeadlineError extends Error {
  constructor(label, timeoutMs) {
    super(`${label} exceeded ${timeoutMs}ms`);
    this.name = 'CacheDeadlineError';
    this.code = 'CACHE_DEADLINE';
  }
}

export function cacheDeadline(promise, label = 'Redis operation', timeoutMs = operationTimeoutMs) {
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new CacheDeadlineError(label, timeoutMs)), timeoutMs);
  });
  return Promise.race([Promise.resolve(promise), deadline]).catch(error => { if(error instanceof CacheDeadlineError)metrics.deadline++; throw error; }).finally(() => clearTimeout(timer));
}

export async function initCache() {
  if (!redis.isOpen) {
    try { await cacheDeadline(redis.connect(), 'Redis startup connect', connectTimeoutMs); }
    catch (error) { try { redis.destroy(); } catch {} throw error; }
  }
  await cacheDeadline(redis.ping(), 'Redis startup ping', Math.max(operationTimeoutMs, 2500));
}

export async function cacheReady() {
  if (!redis.isReady) return false;
  try { return await cacheDeadline(redis.ping(), 'Redis readiness ping') === 'PONG'; }
  catch { return false; }
}

export async function cacheGet(key) {
  try {
    const value = await cacheDeadline(redis.get(key), 'Redis GET');
    metrics[value ? 'getHit' : 'getMiss']++;
    return value ? JSON.parse(value) : null;
  } catch { metrics.getError++; return null; }
}

export async function cacheSet(key, value, ttl = 120) {
  try {
    await cacheDeadline(redis.set(key, JSON.stringify(value), {EX: Math.max(1, Math.floor(ttl))}), 'Redis SET');
    return true;
  } catch { metrics.setError++; return false; }
}

export async function cacheDel(key) {
  try { await cacheDeadline(redis.del(key), 'Redis DEL'); return true; }
  catch { return false; }
}

async function acquireLock(key, token, ttlMs) {
  try { return Boolean(await cacheDeadline(redis.set(key, token, {NX: true, PX: ttlMs}), 'Redis lock acquire')); }
  catch { return false; }
}

async function releaseLock(key, token) {
  try {
    await cacheDeadline(redis.eval("if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end", {keys: [key], arguments: [token]}), 'Redis lock release');
  } catch {}
}

function keepLockAlive(key, token, ttlMs) {
  const interval = setInterval(() => {
    void cacheDeadline(redis.eval("if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('pexpire',KEYS[1],ARGV[2]) else return 0 end", {keys: [key], arguments: [token, String(ttlMs)]}), 'Redis lock renewal').catch(() => {});
  }, Math.max(1000, Math.floor(ttlMs / 3)));
  interval.unref?.();
  return () => clearInterval(interval);
}

// Cache-aside with local coalescing, a renewable cross-process lock and stale-if-error.
// A follower never becomes a second producer while another replica still owns the lock.
export async function cacheRemember(key, ttl, fn, options = {}) {
  const hit = await cacheGet(key);
  if (hit !== null) return hit;
  if (inflight.has(key)) return inflight.get(key);
  const staleKey = `stale:${key}`;
  const staleTtl = Math.max(ttl + 30, Number(options.staleTtl || ttl * 8 || 600));
  const lockKey = `lock:${key}`;
  const lockTtlMs = Math.max(5000, Math.min(120_000, Number(options.lockTtlMs || 30_000)));
  const work = (async () => {
    let token = null;
    let locked = false;
    let stopRenewal = () => {};
    if (redis.isReady) {
      token = crypto.randomBytes(12).toString('hex');
      locked = await acquireLock(lockKey, token, lockTtlMs);
      if (!locked) {
        metrics.lockContention++;
        const waitMs = Math.max(200, Math.min(5000, Number(options.followerWaitMs || 1800)));
        const deadline = Date.now() + waitMs;
        while (Date.now() < deadline) {
          await sleep(Math.min(180, Math.max(40, deadline - Date.now())));
          const shared = await cacheGet(key);
          if (shared !== null) return shared;
        }
        const stale = await cacheGet(staleKey);
        if (stale !== null) { metrics.staleHit++; return stale; }
        locked = await acquireLock(lockKey, token, lockTtlMs);
        if (!locked) { metrics.busy++; throw Object.assign(new Error('Cache producer is already running'), {code: 'CACHE_BUSY'}); }
      }
      stopRenewal = keepLockAlive(lockKey, token, lockTtlMs);
    }
    try {
      const value = await fn();
      await Promise.all([cacheSet(key, value, ttl), cacheSet(staleKey, value, staleTtl)]);
      return value;
    } catch (error) {
      const stale = await cacheGet(staleKey);
      if (stale !== null) { metrics.staleHit++; return stale; }
      throw error;
    } finally {
      stopRenewal();
      if (locked && token) await releaseLock(lockKey, token);
    }
  })();
  inflight.set(key, work);
  try { return await work; }
  finally { inflight.delete(key); }
}

export async function cacheRunOnce(key, ttlSeconds, fn) {
  if (!redis.isReady) return {ran: false, reason: 'cache-unavailable'};
  const lockKey = `once:${key}`;
  const token = crypto.randomBytes(12).toString('hex');
  const ttlMs = Math.max(5000, Math.min(3_600_000, Math.floor(Number(ttlSeconds || 60) * 1000)));
  const locked = await acquireLock(lockKey, token, ttlMs);
  if (!locked) return {ran: false, reason: 'already-running'};
  const stopRenewal = keepLockAlive(lockKey, token, ttlMs);
  let completed = false;
  try {
    const value = await fn();
    completed = true;
    return {ran: true, value};
  } finally {
    stopRenewal();
    // A successful marker remains until its TTL expires, so a later replica
    // does not repeat the same startup task. Failures release it for retry.
    if (!completed) await releaseLock(lockKey, token);
  }
}
