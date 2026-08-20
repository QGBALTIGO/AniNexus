import crypto from 'node:crypto';
import argon2 from 'argon2';
import { q } from './db.mjs';

const SESSION_DAYS = Number(process.env.SESSION_DAYS || 30);
const COOKIE = 'aninexus_session';

const sha256 = v => crypto.createHash('sha256').update(v).digest('hex');
const ipHash = ip => sha256(`${process.env.IP_HASH_SALT || 'change-me'}:${ip || ''}`).slice(0,32);

export async function hashPassword(password) {
  return argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 3, parallelism: 1 });
}
export async function verifyPassword(hash, password) { try { return await argon2.verify(hash, password); } catch { return false; } }

export async function createSession(reply, user, request) {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = sha256(token);
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  await q(`INSERT INTO sessions(token_hash,user_id,ip_hash,user_agent,expires_at) VALUES($1,$2,$3,$4,$5)`, [tokenHash,user.id,ipHash(request.ip),String(request.headers['user-agent']||'').slice(0,500),expires]);
  const secure = process.env.COOKIE_SECURE === 'true' || (process.env.COOKIE_SECURE !== 'false' && request.protocol === 'https');
  reply.setCookie(COOKIE, token, { httpOnly:true, secure, sameSite:'lax', path:'/', expires, maxAge:SESSION_DAYS*86400 });
}

export async function destroySession(request, reply) {
  const token = request.cookies[COOKIE];
  if (token) await q('DELETE FROM sessions WHERE token_hash=$1',[sha256(token)]).catch(()=>{});
  reply.clearCookie(COOKIE,{path:'/'});
}

export async function currentUser(request) {
  const token = request.cookies[COOKIE]; if (!token) return null;
  const { rows } = await q(`SELECT u.id,u.email,u.username,u.role,u.avatar_url,u.bio,u.theme,u.email_verified,u.created_at
    FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()`, [sha256(token)]);
  return rows[0] || null;
}

export async function requireUser(request, reply) {
  const user = await currentUser(request);
  if (!user) { reply.code(401).send({error:'AUTH_REQUIRED'}); return null; }
  return user;
}

export function validateOrigin(request, reply) {
  if (!['POST','PUT','PATCH','DELETE'].includes(request.method)) return true;
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (!origin || !host) return true;
  try { if (new URL(origin).host !== host) { reply.code(403).send({error:'INVALID_ORIGIN'}); return false; } } catch { return false; }
  return true;
}
