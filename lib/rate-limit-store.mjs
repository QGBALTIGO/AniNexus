import crypto from 'node:crypto';
import {cacheDeadline, redis} from './cache.mjs';

export const RATE_LIMIT_LUA = `
local current = redis.call('INCR', KEYS[1])
local timeWindow = tonumber(ARGV[1])
local max = tonumber(ARGV[2])
if current == 1 or (ARGV[3] == 'true' and current > max) then
  redis.call('PEXPIRE', KEYS[1], timeWindow)
elseif ARGV[4] == 'true' and current > max then
  local exponent = math.min(current - max - 1, 30)
  timeWindow = math.min(timeWindow * (2 ^ exponent), 9007199254740991)
  redis.call('PEXPIRE', KEYS[1], timeWindow)
else
  timeWindow = redis.call('PTTL', KEYS[1])
end
return {current, timeWindow}`;

export class SharedRateLimitStore {
  constructor(options = {}, prefix = 'aninexus:rate:global:', client = redis) {
    this.continueExceeding = Boolean(options.continueExceeding);
    this.exponentialBackoff = Boolean(options.exponentialBackoff);
    this.prefix = prefix;
    this.client = client;
  }

  incr(key, callback, timeWindow, max) {
    const digest = crypto.createHash('sha256').update(String(key)).digest('hex').slice(0, 32);
    cacheDeadline(Promise.resolve().then(() => this.client.eval(RATE_LIMIT_LUA, {
      keys: [`${this.prefix}${digest}`],
      arguments: [String(timeWindow), String(max), String(this.continueExceeding), String(this.exponentialBackoff)]
    })), 'Redis rate limit', 1000).then(result => {
      callback(null, {current: Number(result?.[0] || 0), ttl: Math.max(0, Number(result?.[1] || 0))});
    }, error => callback(Object.assign(error, {statusCode: 503, code: 'RATE_LIMIT_UNAVAILABLE'})));
  }

  child(options = {}) {
    const route = options.routeInfo || {};
    const scope = crypto.createHash('sha256').update(`${route.method || 'ANY'}:${route.url || route.path || 'dynamic'}`).digest('hex').slice(0, 16);
    return new SharedRateLimitStore(options, `aninexus:rate:${scope}:`, this.client);
  }
}
