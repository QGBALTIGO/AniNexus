import crypto from 'node:crypto';
import argon2 from 'argon2';
import { q } from './db.mjs';

const SESSION_DAYS = Math.max(1, Math.min(90, Number(process.env.SESSION_DAYS || 30)));
const MAX_SESSIONS = Math.max(1, Math.min(30, Number(process.env.MAX_SESSIONS_PER_USER || 10)));
const COOKIE_DEV = 'aninexus_session';
const COOKIE_SECURE = '__Host-aninexus_session';

const sha256 = v => crypto.createHash('sha256').update(v).digest('hex');
const salt = () => {
  const value = process.env.IP_HASH_SALT;
  if (value && value.length >= 24) return value;
  if (process.env.NODE_ENV === 'production') throw new Error('IP_HASH_SALT must be configured with at least 24 characters in production');
  return 'development-only-ip-salt-change-before-production';
};
const ipHash = ip => sha256(`${salt()}:${ip || ''}`).slice(0,32);
const secureRequest = request => process.env.COOKIE_SECURE === 'true' || (process.env.COOKIE_SECURE !== 'false' && request.protocol === 'https');

export async function hashPassword(password) {
  return argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 3, parallelism: 1 });
}
export async function verifyPassword(hash, password) { try { return await argon2.verify(hash, password); } catch { return false; } }

export async function createSession(reply, user, request) {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = sha256(token);
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  await q(`INSERT INTO sessions(token_hash,user_id,ip_hash,user_agent,expires_at) VALUES($1,$2,$3,$4,$5)`, [tokenHash,user.id,ipHash(request.ip),String(request.headers['user-agent']||'').slice(0,500),expires]);
  await q(`DELETE FROM sessions WHERE user_id=$1 AND token_hash NOT IN (SELECT token_hash FROM sessions WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2)`,[user.id,MAX_SESSIONS]).catch(()=>{});
  const secure = secureRequest(request);
  reply.setCookie(secure ? COOKIE_SECURE : COOKIE_DEV, token, { httpOnly:true, secure, sameSite:'strict', path:'/', expires, maxAge:SESSION_DAYS*86400 });
  if (secure) reply.clearCookie(COOKIE_DEV,{path:'/'});
}

export async function destroySession(request, reply) {
  const token = request.cookies[COOKIE_SECURE] || request.cookies[COOKIE_DEV];
  if (token) await q('DELETE FROM sessions WHERE token_hash=$1',[sha256(token)]).catch(()=>{});
  reply.clearCookie(COOKIE_SECURE,{path:'/'});
  reply.clearCookie(COOKIE_DEV,{path:'/'});
}

export async function currentUser(request) {
  const token = request.cookies[COOKIE_SECURE] || request.cookies[COOKIE_DEV]; if (!token || token.length > 128) return null;
  const { rows } = await q(`SELECT u.id,u.email,u.username,u.role,u.avatar_url,u.bio,u.theme,u.email_verified,u.created_at
    FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()`, [sha256(token)]);
  return rows[0] || null;
}

export async function requireUser(request, reply) {
  const user = await currentUser(request);
  if (!user) { reply.code(401).send({error:'AUTH_REQUIRED'}); return null; }
  return user;
}

export async function requireRole(request, reply, roles=['admin']) {
  const user = await requireUser(request,reply); if(!user) return null;
  if(!roles.includes(user.role)){reply.code(403).send({error:'FORBIDDEN'});return null;}
  return user;
}

export function validateOrigin(request, reply) {
  if (!['POST','PUT','PATCH','DELETE'].includes(request.method)) return true;
  const fetchSite = String(request.headers['sec-fetch-site'] || '').toLowerCase();
  if (fetchSite && !['same-origin','same-site','none'].includes(fetchSite)) {
    reply.code(403).send({error:'INVALID_ORIGIN'}); return false;
  }
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (!host) { reply.code(400).send({error:'INVALID_HOST'}); return false; }
  if (!origin) {
    if (process.env.NODE_ENV === 'production') { reply.code(403).send({error:'ORIGIN_REQUIRED'}); return false; }
    return true;
  }
  try {
    const received = new URL(origin);
    const configured = process.env.PUBLIC_ORIGIN ? new URL(process.env.PUBLIC_ORIGIN) : null;
    const expectedHost = configured?.host || host;
    const expectedProtocol = configured?.protocol || `${request.protocol}:`;
    if (received.host !== expectedHost || received.protocol !== expectedProtocol) {
      reply.code(403).send({error:'INVALID_ORIGIN'}); return false;
    }
  } catch {
    reply.code(403).send({error:'INVALID_ORIGIN'}); return false;
  }
  return true;
}
