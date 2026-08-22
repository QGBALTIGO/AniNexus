import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { initDb, q, pool } from './lib/db.mjs';
import { initCache, redis } from './lib/cache.mjs';
import { hashPassword, verifyPassword, createSession, destroySession, currentUser, requireUser, requireRole, validateOrigin } from './lib/auth.mjs';
import { getCatalog, getReading, getSchedule, getAnime, getManga, getStudios, getDubbed, prewarm } from './lib/provider.mjs';
import { lists } from './lib/content.mjs';
import { getNativeNews, getNativeArticle, articleExpiry } from './lib/native-news.mjs';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const app=Fastify({logger:true,trustProxy:true,bodyLimit:1_000_000,requestTimeout:15_000,connectionTimeout:10_000});
await app.register(cookie);
await app.register(helmet,{global:true,contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'",'https://fonts.googleapis.com'],fontSrc:["'self'",'https://fonts.gstatic.com'],imgSrc:["'self'",'data:','https:'],connectSrc:["'self'"],frameSrc:["'self'",'https://www.youtube.com','https://www.dailymotion.com'],objectSrc:["'none'"],baseUri:["'self'"],frameAncestors:["'none'"],formAction:["'self'"]}}});
await app.register(rateLimit,{global:false,max:120,timeWindow:'1 minute'});
await app.register(fastifyStatic,{root:path.join(__dirname,'public'),prefix:'/',decorateReply:true,maxAge:'1h',immutable:false});
await app.register(fastifyStatic,{root:path.join(__dirname,'assets'),prefix:'/assets/',decorateReply:false,maxAge:'7d',immutable:true});

app.addHook('onRequest',async(req,reply)=>{if(!validateOrigin(req,reply)) return reply;});
app.addHook('onSend',async(req,reply,payload)=>{
  reply.header('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=()');
  reply.header('Referrer-Policy','strict-origin-when-cross-origin');
  reply.header('X-Content-Type-Options','nosniff');
  if(req.url.startsWith('/api/auth/')||req.url.startsWith('/api/me'))reply.header('Cache-Control','no-store');
  if(process.env.PUBLIC_ORIGIN?.startsWith('https://'))reply.header('Strict-Transport-Security','max-age=31536000; includeSubDomains');
  return payload;
});
app.setErrorHandler((error,req,reply)=>{req.log.error({err:error},'request failed');if(reply.sent)return;const status=error.statusCode&&error.statusCode>=400&&error.statusCode<600?error.statusCode:500;reply.code(status).send({error:status>=500?'INTERNAL_ERROR':'REQUEST_FAILED'});});

const authRate={config:{rateLimit:{max:10,timeWindow:'1 minute'}}};
const writeRate={config:{rateLimit:{max:30,timeWindow:'1 minute'}}};
const safeUser=u=>u&&({id:u.id,email:u.email,username:u.username,role:u.role,avatarUrl:u.avatar_url,bio:u.bio,theme:u.theme,emailVerified:u.email_verified,createdAt:u.created_at});
const safeInt=(v,min=1,max=Number.MAX_SAFE_INTEGER)=>{const n=Number(v);return Number.isSafeInteger(n)&&n>=min&&n<=max?n:null};
const safePath=v=>{const s=String(v||'').slice(0,500);return s.startsWith('/')&&!s.startsWith('//')?s:null};
const DUMMY_PASSWORD_HASH=await hashPassword('aninexus-invalid-password-sentinel-do-not-use');

app.get('/health',async()=>({ok:true,time:new Date().toISOString()}));
app.get('/api/me',async req=>({user:safeUser(await currentUser(req))}));
app.post('/api/auth/register',authRate,async(req,reply)=>{
  const parsed=z.object({email:z.string().trim().toLowerCase().email().max(254),username:z.string().trim().min(3).max(30).regex(/^[\p{L}\p{N}_.-]+$/u),password:z.string().min(10).max(128)}).safeParse(req.body);
  if(!parsed.success)return reply.code(400).send({error:'INVALID_INPUT'});
  const {email,username,password}=parsed.data;
  const exists=await q('SELECT 1 FROM users WHERE email=$1 OR username=$2',[email,username]); if(exists.rowCount)return reply.code(409).send({error:'ACCOUNT_UNAVAILABLE'});
  const passwordHash=await hashPassword(password); const {rows}=await q('INSERT INTO users(email,username,password_hash) VALUES($1,$2,$3,$4) RETURNING *',[email,username,passwordHash]);
  await createSession(reply,rows[0],req); return {user:safeUser(rows[0])};
});
app.post('/api/auth/login',authRate,async(req,reply)=>{
  const parsed=z.object({login:z.string().trim().min(3).max(254),password:z.string().min(1).max(128)}).safeParse(req.body); if(!parsed.success)return reply.code(400).send({error:'INVALID_INPUT'});
  const {rows}=await q('SELECT * FROM users WHERE email=$1 OR username=$1',[parsed.data.login]); const u=rows[0];
  const valid=await verifyPassword(u?.password_hash||DUMMY_PASSWORD_HASH,parsed.data.password);if(!u||!valid)return reply.code(401).send({error:'INVALID_CREDENTIALS'});
  await createSession(reply,u,req);return {user:safeUser(u)};
});
app.post('/api/auth/logout',async(req,reply)=>{await destroySession(req,reply);return {ok:true};});

app.get('/api/catalog',{config:{rateLimit:{max:80,timeWindow:'1 minute'}}},async(req)=>getCatalog(req.query||{}));
app.get('/api/reading',{config:{rateLimit:{max:80,timeWindow:'1 minute'}}},async(req)=>getReading(req.query||{}));
app.get('/api/schedule',{config:{rateLimit:{max:80,timeWindow:'1 minute'}}},async(req,reply)=>{const now=Math.floor(Date.now()/1000),start=Number(req.query?.start||now-86400),end=Number(req.query?.end||now+7*86400); if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>10*86400)return reply.code(400).send({error:'INVALID_RANGE'});return getSchedule(start,end);});
app.get('/api/anime/:id',{config:{rateLimit:{max:100,timeWindow:'1 minute'}}},async(req,reply)=>{const id=safeInt(req.params.id);if(!id)return reply.code(400).send({error:'INVALID_ID'});return getAnime(id);});
app.get('/api/manga/:id',{config:{rateLimit:{max:100,timeWindow:'1 minute'}}},async(req,reply)=>{const id=safeInt(req.params.id);if(!id)return reply.code(400).send({error:'INVALID_ID'});return getManga(id);});
app.get('/api/studios',async(req)=>getStudios(Number(req.query?.page||1)));
app.get('/api/dublados',async(req)=>getDubbed(Number(req.query?.page||1)));
app.get('/api/lists',async()=>lists);
app.get('/api/list/:slug',async(req,reply)=>{const l=lists.find(x=>x.slug===req.params.slug);if(!l)return reply.code(404).send({error:'NOT_FOUND'});const data=await getCatalog({page:req.query?.page||1,sort:l.sort});return {...l,...data};});

app.get('/api/news',async(req)=>{const limit=Math.max(1,Math.min(50,Number(req.query?.limit||20))),offset=Math.max(0,Math.min(5000,Number(req.query?.offset||0)));const type=req.query?.type?String(req.query.type).slice(0,40):null;return{items:await getNativeNews({limit,offset,type})};});
app.get('/api/news/:slug',async(req,reply)=>{const slug=String(req.params.slug||'').slice(0,160);const item=await getNativeArticle(slug);if(!item)return reply.code(404).send({error:'NOT_FOUND'});return item;});
const articleSchema=z.object({title:z.string().trim().min(3).max(220),summary:z.string().trim().min(10).max(1200),body:z.string().max(30000).nullable().optional(),eventType:z.enum(['SEASON','TRAILER','EPISODE','MANGA','TRENDING','OTHER']).nullable().optional(),spoiler:z.boolean().optional(),mediaIds:z.array(z.number().int().positive()).max(30).optional(),imageUrl:z.string().url().max(2000).nullable().optional(),imageAlt:z.string().max(240).nullable().optional(),facts:z.array(z.string().max(500)).max(20).optional(),status:z.enum(['draft','review','scheduled','published','archived']).optional(),scheduledAt:z.string().datetime().nullable().optional(),expiresAt:z.string().datetime().nullable().optional()});
app.post('/api/admin/news',writeRate,async(req,reply)=>{const u=await requireRole(req,reply,['moderator','admin']);if(!u)return;const p=articleSchema.safeParse(req.body);if(!p.success)return reply.code(400).send({error:'INVALID_INPUT'});const d=p.data,slug=`${d.title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,100)}-${Date.now().toString(36)}`;const published=d.status==='published'?new Date():null,expires=d.expiresAt?new Date(d.expiresAt):articleExpiry(published||new Date());const {rows}=await q(`INSERT INTO news_articles(slug,source_kind,event_type,title,summary,body,spoiler,status,media_ids,created_by,scheduled_at,published_at,image_url,image_alt,source_name,language,facts,expires_at) VALUES($1,'EDITORIAL',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'AniNexus','pt-BR',$14,$15) RETURNING id,slug,status`,[slug,d.eventType||null,d.title,d.summary,d.body||null,d.spoiler||false,d.status||'draft',JSON.stringify(d.mediaIds||[]),u.id,d.scheduledAt||null,published,d.imageUrl||null,d.imageAlt||null,JSON.stringify(d.facts||[]),expires]);await q('INSERT INTO audit_log(actor_id,action,target_type,target_id) VALUES($1,$2,$3,$4)',[u.id,'NEWS_CREATE','NEWS',rows[0].id]);return reply.code(201).send(rows[0]);});
app.patch('/api/admin/news/:id',writeRate,async(req,reply)=>{const u=await requireRole(req,reply,['moderator','admin']);if(!u)return;const id=String(req.params.id);if(!/^[0-9a-f-]{36}$/i.test(id))return reply.code(400).send({error:'INVALID_ID'});const p=articleSchema.partial().safeParse(req.body);if(!p.success||!Object.keys(p.data).length)return reply.code(400).send({error:'INVALID_INPUT'});const d=p.data;const {rows}=await q(`UPDATE news_articles SET title=COALESCE($2,title),summary=COALESCE($3,summary),body=COALESCE($4,body),event_type=COALESCE($5,event_type),spoiler=COALESCE($6,spoiler),status=COALESCE($7,status),media_ids=COALESCE($8::jsonb,media_ids),scheduled_at=COALESCE($9::timestamptz,scheduled_at),image_url=COALESCE($10,image_url),image_alt=COALESCE($11,image_alt),facts=COALESCE($12::jsonb,facts),expires_at=COALESCE($13::timestamptz,expires_at),published_at=CASE WHEN $7='published' AND published_at IS NULL THEN now() ELSE published_at END,updated_at=now() WHERE id=$1 RETURNING id,slug,status`,[id,d.title??null,d.summary??null,d.body??null,d.eventType??null,d.spoiler??null,d.status??null,d.mediaIds?JSON.stringify(d.mediaIds):null,d.scheduledAt??null,d.imageUrl??null,d.imageAlt??null,d.facts?JSON.stringify(d.facts):null,d.expiresAt??null]);if(!rows[0])return reply.code(404).send({error:'NOT_FOUND'});await q('INSERT INTO audit_log(actor_id,action,target_type,target_id) VALUES($1,$2,$3,$4)',[u.id,'NEWS_UPDATE','NEWS',id]);return rows[0];});

app.get('/api/me/list',async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const {rows}=await q('SELECT media_id,status,score,reaction,progress,updated_at FROM user_anime WHERE user_id=$1 ORDER BY updated_at DESC',[u.id]);return {items:rows};});
app.put('/api/me/list/:mediaId',writeRate,async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const parsed=z.object({status:z.enum(['PLANNING','CURRENT','COMPLETED','PAUSED','DROPPED']),score:z.number().min(0).max(10).nullable().optional(),reaction:z.enum(['LIKE','DISLIKE','LOVE','WOW']).nullable().optional(),progress:z.number().int().min(0).max(100000).optional()}).safeParse(req.body);if(!parsed.success)return reply.code(400).send({error:'INVALID_INPUT'});const mediaId=safeInt(req.params.mediaId);if(!mediaId)return reply.code(400).send({error:'INVALID_ID'});await q(`INSERT INTO user_anime(user_id,media_id,status,score,reaction,progress,updated_at) VALUES($1,$2,$3,$4,$5,$6,now()) ON CONFLICT(user_id,media_id) DO UPDATE SET status=EXCLUDED.status,score=EXCLUDED.score,reaction=EXCLUDED.reaction,progress=EXCLUDED.progress,updated_at=now()`,[u.id,mediaId,parsed.data.status,parsed.data.score??null,parsed.data.reaction??null,parsed.data.progress??0]);return {ok:true};});
app.delete('/api/me/list/:mediaId',async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const mediaId=safeInt(req.params.mediaId);if(!mediaId)return reply.code(400).send({error:'INVALID_ID'});await q('DELETE FROM user_anime WHERE user_id=$1 AND media_id=$2',[u.id,mediaId]);return {ok:true};});
app.get('/api/me/follows',async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const {rows}=await q('SELECT media_id,media_type,notify_episode,notify_news,created_at FROM user_follows WHERE user_id=$1 ORDER BY created_at DESC',[u.id]);return{items:rows};});
app.put('/api/me/follows/:mediaId',writeRate,async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const mediaId=safeInt(req.params.mediaId);if(!mediaId)return reply.code(400).send({error:'INVALID_ID'});const p=z.object({mediaType:z.enum(['ANIME','MANGA']).default('ANIME'),notifyEpisode:z.boolean().default(true),notifyNews:z.boolean().default(true)}).safeParse(req.body||{});if(!p.success)return reply.code(400).send({error:'INVALID_INPUT'});const d=p.data;await q(`INSERT INTO user_follows(user_id,media_id,media_type,notify_episode,notify_news) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,media_id,media_type) DO UPDATE SET notify_episode=EXCLUDED.notify_episode,notify_news=EXCLUDED.notify_news`,[u.id,mediaId,d.mediaType,d.notifyEpisode,d.notifyNews]);return{ok:true};});
app.delete('/api/me/follows/:mediaId',async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const mediaId=safeInt(req.params.mediaId);if(!mediaId)return reply.code(400).send({error:'INVALID_ID'});await q('DELETE FROM user_follows WHERE user_id=$1 AND media_id=$2',[u.id,mediaId]);return{ok:true};});
app.get('/api/me/notifications',async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const {rows}=await q('SELECT id,kind,title,body,media_id,url,read_at,created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100',[u.id]);return{items:rows};});
app.post('/api/me/notifications/:id/read',writeRate,async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;await q('UPDATE notifications SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND user_id=$2',[String(req.params.id),u.id]);return{ok:true};});

app.get('/api/anime/:id/impressions',async(req,reply)=>{const id=safeInt(req.params.id);if(!id)return reply.code(400).send({error:'INVALID_ID'});const {rows}=await q(`SELECT i.id,i.body,i.spoiler,i.created_at,u.username,u.avatar_url FROM impressions i JOIN users u ON u.id=i.user_id WHERE media_id=$1 AND hidden=false ORDER BY i.created_at DESC LIMIT 50`,[id]);return {items:rows};});
app.post('/api/anime/:id/impressions',{config:{rateLimit:{max:8,timeWindow:'1 minute'}}},async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const id=safeInt(req.params.id);if(!id)return reply.code(400).send({error:'INVALID_ID'});const p=z.object({body:z.string().trim().min(1).max(1200),spoiler:z.boolean().optional()}).safeParse(req.body);if(!p.success)return reply.code(400).send({error:'INVALID_INPUT'});await q('INSERT INTO impressions(user_id,media_id,body,spoiler) VALUES($1,$2,$3,$4)',[u.id,id,p.data.body,p.data.spoiler||false]);return {ok:true};});

app.get('/api/community/threads',async(req)=>{const limit=Math.max(1,Math.min(50,Number(req.query?.limit||30))),mediaId=req.query?.mediaId?safeInt(req.query.mediaId):null;const {rows}=await q(`SELECT t.id,t.media_id,t.title,t.body,t.spoiler,t.locked,t.created_at,u.username,u.avatar_url,(SELECT count(*)::int FROM community_posts p WHERE p.thread_id=t.id AND p.hidden=false) replies FROM community_threads t LEFT JOIN users u ON u.id=t.user_id WHERE t.hidden=false AND ($1::bigint IS NULL OR t.media_id=$1) ORDER BY t.created_at DESC LIMIT $2`,[mediaId,limit]);return{items:rows};});
app.post('/api/community/threads',writeRate,async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const p=z.object({mediaId:z.number().int().positive().nullable().optional(),title:z.string().trim().min(3).max(180),body:z.string().trim().min(1).max(6000),spoiler:z.boolean().optional()}).safeParse(req.body);if(!p.success)return reply.code(400).send({error:'INVALID_INPUT'});const {rows}=await q('INSERT INTO community_threads(user_id,media_id,title,body,spoiler) VALUES($1,$2,$3,$4,$5) RETURNING id,created_at',[u.id,p.data.mediaId||null,p.data.title,p.data.body,p.data.spoiler||false]);return reply.code(201).send(rows[0]);});
app.get('/api/community/threads/:id/posts',async(req,reply)=>{const id=String(req.params.id);if(!/^[0-9a-f-]{36}$/i.test(id))return reply.code(400).send({error:'INVALID_ID'});const {rows}=await q(`SELECT p.id,p.parent_id,p.body,p.spoiler,p.created_at,u.username,u.avatar_url FROM community_posts p LEFT JOIN users u ON u.id=p.user_id WHERE p.thread_id=$1 AND p.hidden=false ORDER BY p.created_at ASC LIMIT 500`,[id]);return{items:rows};});
app.post('/api/community/threads/:id/posts',writeRate,async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const id=String(req.params.id);if(!/^[0-9a-f-]{36}$/i.test(id))return reply.code(400).send({error:'INVALID_ID'});const p=z.object({body:z.string().trim().min(1).max(3000),spoiler:z.boolean().optional(),parentId:z.string().uuid().nullable().optional()}).safeParse(req.body);if(!p.success)return reply.code(400).send({error:'INVALID_INPUT'});const thread=await q('SELECT locked FROM community_threads WHERE id=$1 AND hidden=false',[id]);if(!thread.rows[0])return reply.code(404).send({error:'NOT_FOUND'});if(thread.rows[0].locked)return reply.code(423).send({error:'THREAD_LOCKED'});const {rows}=await q('INSERT INTO community_posts(thread_id,user_id,parent_id,body,spoiler) VALUES($1,$2,$3,$4,$5) RETURNING id,created_at',[id,u.id,p.data.parentId||null,p.data.body,p.data.spoiler||false]);return reply.code(201).send(rows[0]);});
app.post('/api/community/report',{config:{rateLimit:{max:10,timeWindow:'10 minutes'}}},async(req,reply)=>{const u=await currentUser(req);const p=z.object({targetType:z.enum(['THREAD','POST','IMPRESSION','USER']),targetId:z.string().min(1).max(100),reason:z.string().trim().min(3).max(1000)}).safeParse(req.body);if(!p.success)return reply.code(400).send({error:'INVALID_INPUT'});await q('INSERT INTO content_reports(reporter_id,target_type,target_id,reason) VALUES($1,$2,$3,$4)',[u?.id||null,p.data.targetType,p.data.targetId,p.data.reason]);return{ok:true};});

app.post('/api/contact',{config:{rateLimit:{max:5,timeWindow:'10 minutes'}}},async(req,reply)=>{const p=z.object({name:z.string().trim().min(2).max(100),email:z.string().trim().toLowerCase().email(),subject:z.string().trim().min(3).max(160),message:z.string().trim().min(10).max(5000)}).safeParse(req.body);if(!p.success)return reply.code(400).send({error:'INVALID_INPUT'});await q('INSERT INTO contact_messages(name,email,subject,message) VALUES($1,$2,$3,$4)',[p.data.name,p.data.email,p.data.subject,p.data.message]);return {ok:true};});
app.post('/api/dmca',{config:{rateLimit:{max:3,timeWindow:'1 hour'}}},async(req,reply)=>{const p=z.object({requesterName:z.string().trim().min(2).max(150),requesterEmail:z.string().trim().toLowerCase().email(),rightsHolder:z.string().trim().min(2).max(200),contentUrl:z.string().url().max(1200),description:z.string().trim().min(30).max(6000),goodFaith:z.literal(true),signature:z.string().trim().min(2).max(200)}).safeParse(req.body);if(!p.success)return reply.code(400).send({error:'INVALID_INPUT'});const d=p.data;await q('INSERT INTO dmca_requests(requester_name,requester_email,rights_holder,content_url,description,good_faith,signature) VALUES($1,$2,$3,$4,$5,$6,$7)',[d.requesterName,d.requesterEmail,d.rightsHolder,d.contentUrl,d.description,d.goodFaith,d.signature]);return {ok:true};});
app.post('/api/events',{config:{rateLimit:{max:60,timeWindow:'1 minute'}}},async(req)=>{const p=z.object({event:z.string().trim().min(1).max(60),path:z.string().max(300),mediaId:z.number().int().positive().optional()}).safeParse(req.body);if(p.success){const path=safePath(p.data.path);if(path)q('INSERT INTO analytics_events(event_name,path,media_id) VALUES($1,$2,$3)',[p.data.event,path,p.data.mediaId||null]).catch(()=>{})}return {ok:true};});

await initDb();
await initCache().catch(()=>{});
prewarm().catch(()=>{});

const port=Number(process.env.PUBLIC_PORT||8080);
await app.listen({port,host:'0.0.0.0'});

const shutdown=async()=>{await app.close().catch(()=>{});await pool.end().catch(()=>{});await redis?.quit?.().catch(()=>{});process.exit(0)};
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
