import crypto from 'node:crypto';
import argon2 from 'argon2';
import { createClerkClient } from '@clerk/backend';
import { q } from './db.mjs';
import { cacheGet, cacheSet, cacheDel } from './cache.mjs';
import { avatarForClerkUser, resolvedAvatar } from './avatar.mjs';

const SESSION_DAYS = Math.max(1, Math.min(90, Number(process.env.SESSION_DAYS || 30)));
const MAX_SESSIONS = Math.max(1, Math.min(30, Number(process.env.MAX_SESSIONS_PER_USER || 10)));
const SESSION_CACHE_SECONDS = Math.max(5, Math.min(120, Number(process.env.SESSION_CACHE_SECONDS || 30)));
const COOKIE_DEV = 'aninexus_session';
const COOKIE_SECURE = '__Host-aninexus_session';
const ARGON_MEMORY = Math.max(19_456, Math.min(65_536, Number(process.env.ARGON2_MEMORY_KIB || 19_456)));
const ARGON_TIME = Math.max(2, Math.min(6, Number(process.env.ARGON2_TIME_COST || 3)));
const CLERK_SECRET_KEY = String(process.env.CLERK_SECRET_KEY || '');
const CLERK_PUBLISHABLE_KEY = String(process.env.CLERK_PUBLISHABLE_KEY || process.env.PUBLIC_CLERK_PUBLISHABLE_KEY || '');
const ADMIN_EMAILS = new Set(String(process.env.ADMIN_EMAILS || '').split(',').map(value=>value.trim().toLowerCase()).filter(value=>/^\S+@\S+\.\S+$/.test(value)));
const RESERVED_USERNAMES = /^(?:admin(?:istrator)?|moderador|moderator|suporte|support|aninexus|equipe|staff|sistema|system)$/i;

export const AUTH_PROVIDER = String(process.env.AUTH_PROVIDER || (CLERK_SECRET_KEY && CLERK_PUBLISHABLE_KEY ? 'clerk' : 'legacy')).toLowerCase();
export const CLERK_ENABLED = AUTH_PROVIDER === 'clerk';

const sha256 = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const sessionKey = hash => `auth:session:${hash}`;
const clerkUserKey = id => `auth:clerk-user:${id}`;
const normalizeOrigin = value => {
  try {
    const url = new URL(String(value || '').trim());
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return '';
    if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') return '';
    return url.origin;
  } catch {
    return '';
  }
};

export const AUTHORIZED_ORIGINS = Object.freeze([
  ...new Set(String(process.env.CLERK_AUTHORIZED_PARTIES || process.env.PUBLIC_ORIGIN || '')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean)),
]);

if (CLERK_ENABLED && process.env.NODE_ENV === 'production') {
  if (!CLERK_SECRET_KEY.startsWith('sk_') || !CLERK_PUBLISHABLE_KEY.startsWith('pk_')) {
    throw new Error('Clerk requires valid CLERK_SECRET_KEY and CLERK_PUBLISHABLE_KEY in production');
  }
  if (!AUTHORIZED_ORIGINS.length) throw new Error('CLERK_AUTHORIZED_PARTIES must contain at least one HTTPS origin in production');
}
if (!CLERK_ENABLED && process.env.NODE_ENV === 'production') {
  throw new Error('Legacy authentication is development-only; configure Clerk in production');
}

const clerk = CLERK_ENABLED
  ? createClerkClient({ secretKey: CLERK_SECRET_KEY, publishableKey: CLERK_PUBLISHABLE_KEY })
  : null;
const requestUsers = new WeakMap();
const lastSeenWrites = new Map();

const salt = () => {
  const value = process.env.IP_HASH_SALT;
  if (value && value.length >= 24) return value;
  if (process.env.NODE_ENV === 'production') throw new Error('IP_HASH_SALT must be configured with at least 24 characters in production');
  return 'development-only-ip-salt-change-before-production';
};
const ipHash = ip => sha256(`${salt()}:${ip || ''}`).slice(0, 32);
const secureRequest = request => process.env.COOKIE_SECURE === 'true' || (process.env.COOKIE_SECURE !== 'false' && request.protocol === 'https');
const publicUser = user => {
  if (!user) return null;
  const avatar = resolvedAvatar(user);
  return {
    id: user.id,
    clerk_user_id: user.clerk_user_id || null,
    email: user.email,
    username: user.username,
    display_name: user.display_name || user.username,
    role: user.role,
    status: user.status || 'active',
    suspended_until: user.suspended_until || null,
    ban_reason: user.ban_reason || null,
    avatar_url: avatar.url,
    avatar_preset: avatar.preset,
    profile_banner_url: user.profile_banner_url || null,
    bio: user.bio,
    location: user.location || null,
    website_url: user.website_url || null,
    instagram_handle: user.instagram_handle || null,
    telegram_handle: user.telegram_handle || null,
    avatar_source: user.avatar_source || 'clerk',
    show_library: user.show_library !== false,
    show_activity: user.show_activity !== false,
    show_stats: user.show_stats !== false,
    theme: user.theme,
    privacy: user.privacy || 'public',
    email_verified: user.email_verified,
    created_at: user.created_at,
  };
};

function webRequestFromFastify(request) {
  const headers = new Headers();
  for (const [name, raw] of Object.entries(request.headers || {})) {
    if (raw == null) continue;
    headers.set(name, Array.isArray(raw) ? raw.join(', ') : String(raw));
  }
  const host = String(request.headers.host || 'localhost');
  const protocol = String(request.protocol || 'http').replace(/:$/, '');
  return new Request(new URL(String(request.raw?.url || request.url || '/'), `${protocol}://${host}`), {
    method: request.method,
    headers,
  });
}

function usernameCandidate(clerkUser) {
  const seed = clerkUser.username || clerkUser.firstName || clerkUser.primaryEmailAddress?.emailAddress?.split('@')[0] || 'usuario';
  let clean = String(seed).normalize('NFKC').replace(/[^\p{L}\p{N}_.-]+/gu, '').slice(0, 22) || 'usuario';
  if(RESERVED_USERNAMES.test(clean))clean='usuario';
  return `${clean}-${String(clerkUser.id).slice(-6)}`.slice(0, 30);
}

function primaryEmail(clerkUser) {
  const addresses = Array.isArray(clerkUser.emailAddresses) ? clerkUser.emailAddresses : [];
  const primary = addresses.find(item => item.id === clerkUser.primaryEmailAddressId);
  const selected = primary || addresses.find(item => item?.emailAddress);
  return {
    address: String(selected?.emailAddress || '').trim().toLowerCase(),
    verified: selected?.verification?.status === 'verified',
  };
}

export async function syncClerkUser(clerkUser) {
  if (!clerkUser?.id || !/^user_[A-Za-z0-9]{8,}$/.test(clerkUser.id)) throw new Error('Invalid Clerk user id');
  const emailState = primaryEmail(clerkUser);
  if (!emailState.address) throw new Error('A Clerk email is required');
  const username = usernameCandidate(clerkUser);
  const displayName = String(clerkUser.fullName || clerkUser.firstName || username).trim().slice(0, 80) || username;
  const avatar = avatarForClerkUser(clerkUser);
  const { rows } = await q(`
    INSERT INTO users(email,username,password_hash,clerk_user_id,display_name,avatar_url,avatar_source,email_verified,last_login_at,last_seen_at,role)
    VALUES($1,$2,NULL,$3,$4,$5,'clerk',$6,now(),now(),$7)
    ON CONFLICT(email) DO UPDATE SET
      clerk_user_id=CASE
        WHEN users.clerk_user_id IS NULL OR users.clerk_user_id=EXCLUDED.clerk_user_id THEN EXCLUDED.clerk_user_id
        ELSE users.clerk_user_id
      END,
      display_name=COALESCE(users.display_name,EXCLUDED.display_name),
      avatar_url=CASE WHEN users.avatar_source='custom' THEN users.avatar_url ELSE EXCLUDED.avatar_url END,
      avatar_source=CASE WHEN users.avatar_source='custom' THEN users.avatar_source ELSE EXCLUDED.avatar_source END,
      email_verified=EXCLUDED.email_verified,
      role=CASE WHEN EXCLUDED.role='admin' THEN 'admin' ELSE users.role END,
      last_login_at=now(),
      last_seen_at=now(),
      updated_at=now()
    RETURNING *
  `, [emailState.address, username, clerkUser.id, displayName, avatar.url, emailState.verified, ADMIN_EMAILS.has(emailState.address)?'admin':'user']);
  const user = rows[0];
  if (!user || user.clerk_user_id !== clerkUser.id) throw new Error('This email is linked to another identity');
  if (user.deleted_at) throw new Error('This account is being deleted');
  await cacheSet(clerkUserKey(clerkUser.id), publicUser(user), SESSION_CACHE_SECONDS);
  return publicUser(user);
}

async function accountAccess(user,request){
  if(!user)return null;
  if(user.status==='suspended'&&user.suspended_until&&Date.parse(user.suspended_until)<=Date.now()){
    const {rows}=await q(`UPDATE users SET status='active',suspended_until=NULL,ban_reason=NULL,updated_at=now() WHERE id=$1 AND status='suspended' AND suspended_until<=now() RETURNING *`,[user.id]);
    if(rows[0])user=publicUser(rows[0]);
  }
  if(user.status&&user.status!=='active'){request.aninexusAccountStatus=user.status;return null}
  const now=Date.now(),previous=lastSeenWrites.get(user.id)||0;
  if(now-previous>300000){lastSeenWrites.set(user.id,now);q('UPDATE users SET last_seen_at=now() WHERE id=$1',[user.id]).catch(error=>console.warn('[auth] last_seen update failed',error?.message||error))}
  return user;
}

async function clerkCurrentUser(request) {
  const state = await clerk.authenticateRequest(webRequestFromFastify(request), {
    authorizedParties: AUTHORIZED_ORIGINS,
    acceptsToken: 'session_token',
  });
  if (!state.isAuthenticated) return null;
  const auth = state.toAuth();
  const clerkUserId = String(auth.userId || '');
  if (!clerkUserId) return null;
  const cached = await cacheGet(clerkUserKey(clerkUserId));
  if (cached) return accountAccess(cached,request);
  const { rows } = await q(`SELECT id,email,username,display_name,role,status,suspended_until,ban_reason,avatar_url,profile_banner_url,bio,location,website_url,instagram_handle,telegram_handle,avatar_source,show_library,show_activity,show_stats,theme,privacy,email_verified,created_at,clerk_user_id
    FROM users WHERE clerk_user_id=$1 AND deleted_at IS NULL`, [clerkUserId]);
  if (rows[0]?.email_verified) {
    const user = publicUser(rows[0]);
    await cacheSet(clerkUserKey(clerkUserId), user, SESSION_CACHE_SECONDS);
    return accountAccess(user,request);
  }
  const user = await syncClerkUser(await clerk.users.getUser(clerkUserId));
  return user?.email_verified ? accountAccess(user,request) : null;
}

export function getClerkClient() {
  return clerk;
}

export async function beginAccountDeletion(user) {
  if (!user?.id) throw new Error('A valid account is required');
  await q('UPDATE users SET deleted_at=COALESCE(deleted_at,now()),updated_at=now() WHERE id=$1', [user.id]);
  if (user.clerk_user_id) await cacheDel(clerkUserKey(user.clerk_user_id));
}

export async function cancelAccountDeletion(user) {
  if (!user?.id) return;
  await q('UPDATE users SET deleted_at=NULL,updated_at=now() WHERE id=$1', [user.id]);
  if (user.clerk_user_id) await cacheDel(clerkUserKey(user.clerk_user_id));
}

export async function invalidateUserIdentityCache(user){
  if(!user?.id)return;
  const keys=[];if(user.clerk_user_id)keys.push(clerkUserKey(user.clerk_user_id));
  const sessions=await q('SELECT token_hash FROM sessions WHERE user_id=$1',[user.id]).catch(()=>({rows:[]}));
  keys.push(...(sessions.rows||[]).map(row=>sessionKey(row.token_hash)));
  await Promise.all(keys.map(cacheDel));
}

export async function bootstrapConfiguredAdmins(){
  if(!ADMIN_EMAILS.size)return{updated:0};
  const {rows}=await q(`UPDATE users SET role='admin',updated_at=now() WHERE lower(email::text)=ANY($1::text[]) AND role<>'admin' RETURNING id,clerk_user_id`,[[...ADMIN_EMAILS]]);
  await Promise.all(rows.map(invalidateUserIdentityCache));
  return{updated:rows.length};
}

export async function hashPassword(password) {
  return argon2.hash(password, { type: argon2.argon2id, memoryCost: ARGON_MEMORY, timeCost: ARGON_TIME, parallelism: 1 });
}
export async function verifyPassword(hash, password) {
  try { return await argon2.verify(hash, password); } catch { return false; }
}

export async function createSession(reply, user, request) {
  if (CLERK_ENABLED) throw new Error('Legacy sessions are disabled while Clerk is active');
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = sha256(token);
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  await q('INSERT INTO sessions(token_hash,user_id,ip_hash,user_agent,expires_at) VALUES($1,$2,$3,$4,$5)', [tokenHash, user.id, ipHash(request.ip), String(request.headers['user-agent'] || '').slice(0, 500), expires]);
  await q('DELETE FROM sessions WHERE user_id=$1 AND token_hash NOT IN (SELECT token_hash FROM sessions WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2)', [user.id, MAX_SESSIONS]).catch(() => {});
  await cacheSet(sessionKey(tokenHash), publicUser(user), SESSION_CACHE_SECONDS);
  const secure = secureRequest(request);
  reply.setCookie(secure ? COOKIE_SECURE : COOKIE_DEV, token, { httpOnly: true, secure, sameSite: 'strict', path: '/', expires, maxAge: SESSION_DAYS * 86400, priority: 'high' });
  if (secure) reply.clearCookie(COOKIE_DEV, { path: '/' });
}

export async function destroySession(request, reply) {
  const token = request.cookies[COOKIE_SECURE] || request.cookies[COOKIE_DEV];
  if (token) {
    const hash = sha256(token);
    await Promise.all([q('DELETE FROM sessions WHERE token_hash=$1', [hash]).catch(() => {}), cacheDel(sessionKey(hash))]);
  }
  reply.clearCookie(COOKIE_SECURE, { path: '/' });
  reply.clearCookie(COOKIE_DEV, { path: '/' });
}

async function legacyCurrentUser(request) {
  const token = request.cookies[COOKIE_SECURE] || request.cookies[COOKIE_DEV];
  if (!token || token.length > 128) return null;
  const tokenHash = sha256(token);
  const key = sessionKey(tokenHash);
  const cached = await cacheGet(key);
  if (cached) return accountAccess(cached,request);
  const { rows } = await q(`SELECT u.id,u.email,u.username,u.display_name,u.role,u.status,u.suspended_until,u.ban_reason,u.avatar_url,u.profile_banner_url,u.bio,u.location,u.website_url,u.instagram_handle,u.telegram_handle,u.avatar_source,u.show_library,u.show_activity,u.show_stats,u.theme,u.privacy,u.email_verified,u.created_at,u.clerk_user_id
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=$1 AND s.expires_at>now() AND u.deleted_at IS NULL`, [tokenHash]);
  const user = publicUser(rows[0] || null);
  if (user) await cacheSet(key, user, SESSION_CACHE_SECONDS);
  return accountAccess(user,request);
}

export async function currentUser(request) {
  if (requestUsers.has(request)) return requestUsers.get(request);
  const pending = CLERK_ENABLED ? clerkCurrentUser(request) : legacyCurrentUser(request);
  requestUsers.set(request, pending);
  try {
    const user = await pending;
    requestUsers.set(request, user);
    return user;
  } catch (error) {
    requestUsers.delete(request);
    throw error;
  }
}

export async function requireUser(request, reply) {
  const user = await currentUser(request);
  if (!user) {
    if(request.aninexusAccountStatus){reply.code(403).send({error:request.aninexusAccountStatus==='banned'?'ACCOUNT_BANNED':'ACCOUNT_SUSPENDED'});return null}
    reply.code(401).send({ error: 'AUTH_REQUIRED' });
    return null;
  }
  return user;
}

export async function requireRole(request, reply, roles = ['admin']) {
  const user = await requireUser(request, reply);
  if (!user) return null;
  if (!roles.includes(user.role)) {
    reply.code(403).send({ error: 'FORBIDDEN' });
    return null;
  }
  return user;
}

export function validateOrigin(request, reply) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return true;
  const requestPath = String(request.raw?.url || request.url || '').split('?')[0];
  if (requestPath === '/api/webhooks/clerk') return true;
  const origin = normalizeOrigin(request.headers.origin);
  const fetchSite = String(request.headers['sec-fetch-site'] || '').toLowerCase();
  const bearer = /^Bearer\s+[A-Za-z0-9._~-]+$/i.test(String(request.headers.authorization || ''));

  if (CLERK_ENABLED) {
    if (!origin || !AUTHORIZED_ORIGINS.includes(origin) || !bearer) {
      reply.code(403).send({ error: 'INVALID_ORIGIN' });
      return false;
    }
    return true;
  }

  if (fetchSite && !['same-origin', 'same-site', 'none'].includes(fetchSite)) {
    reply.code(403).send({ error: 'INVALID_ORIGIN' });
    return false;
  }
  const host = request.headers.host;
  if (!host) {
    reply.code(400).send({ error: 'INVALID_HOST' });
    return false;
  }
  if (!origin) {
    if (process.env.NODE_ENV === 'production') {
      reply.code(403).send({ error: 'ORIGIN_REQUIRED' });
      return false;
    }
    return true;
  }
  const configured = normalizeOrigin(process.env.PUBLIC_ORIGIN);
  const expected = configured || `${String(request.protocol || 'http').replace(/:$/, '')}://${host}`;
  if (origin !== expected) {
    reply.code(403).send({ error: 'INVALID_ORIGIN' });
    return false;
  }
  return true;
}
