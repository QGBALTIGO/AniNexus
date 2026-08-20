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
import { hashPassword, verifyPassword, createSession, destroySession, currentUser, requireUser, validateOrigin } from './lib/auth.mjs';
import { getCatalog, getSchedule, getAnime, getStudios, getDubbed, prewarm } from './lib/provider.mjs';
import { lists } from './lib/content.mjs';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const app=Fastify({logger:true,trustProxy:true,bodyLimit:1_000_000,requestTimeout:15_000});
await app.register(cookie);
await app.register(helmet,{global:true,contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'",'https://fonts.googleapis.com'],fontSrc:["'self'",'https://fonts.gstatic.com'],imgSrc:["'self'",'data:','https:'],connectSrc:["'self'"],frameSrc:["'self'",'https://www.youtube.com','https://www.dailymotion.com'],objectSrc:["'none'"],baseUri:["'self'"],frameAncestors:["'none'"]}}});
await app.register(rateLimit,{global:false,max:120,timeWindow:'1 minute'});
await app.register(fastifyStatic,{root:path.join(__dirname,'public'),prefix:'/',decorateReply:true,maxAge:'1h',immutable:false});
await app.register(fastifyStatic,{root:path.join(__dirname,'assets'),prefix:'/assets/',decorateReply:false,maxAge:'7d',immutable:true});

app.addHook('onRequest',async(req,reply)=>{if(!validateOrigin(req,reply)) return reply;});
app.addHook('onSend',async(req,reply,payload)=>{reply.header('Permissions-Policy','camera=(), microphone=(), geolocation=()');reply.header('Referrer-Policy','strict-origin-when-cross-origin');return payload;});

const authRate={config:{rateLimit:{max:10,timeWindow:'1 minute'}}};
const safeUser=u=>u&&({id:u.id,email:u.email,username:u.username,role:u.role,avatarUrl:u.avatar_url,bio:u.bio,theme:u.theme,emailVerified:u.email_verified,createdAt:u.created_at});

app.get('/health',async()=>({ok:true,time:new Date().toISOString()}));
app.get('/api/me',async req=>({user:safeUser(await currentUser(req))}));
app.post('/api/auth/register',authRate,async(req,reply)=>{
  const parsed=z.object({email:z.string().email().max(254),username:z.string().min(3).max(30).regex(/^[\p{L}\p{N}_.-]+$/u),password:z.string().min(10).max(128)}).safeParse(req.body);
  if(!parsed.success)return reply.code(400).send({error:'INVALID_INPUT'});
  const {email,username,password}=parsed.data;
  const exists=await q('SELECT 1 FROM users WHERE email=$1 OR username=$2',[email,username]); if(exists.rowCount)return reply.code(409).send({error:'ACCOUNT_EXISTS'});
  const passwordHash=await hashPassword(password); const {rows}=await q('INSERT INTO users(email,username,password_hash) VALUES($1,$2,$3) RETURNING *',[email.toLowerCase(),username,passwordHash]);
  await createSession(reply,rows[0],req); return {user:safeUser(rows[0])};
});
app.post('/api/auth/login',authRate,async(req,reply)=>{
  const parsed=z.object({login:z.string().min(3).max(254),password:z.string().min(1).max(128)}).safeParse(req.body); if(!parsed.success)return reply.code(400).send({error:'INVALID_INPUT'});
  const {rows}=await q('SELECT * FROM users WHERE email=$1 OR username=$1',[parsed.data.login]); const u=rows[0]; if(!u||!(await verifyPassword(u.password_hash,parsed.data.password)))return reply.code(401).send({error:'INVALID_CREDENTIALS'});
  await createSession(reply,u,req);return {user:safeUser(u)};
});
app.post('/api/auth/logout',async(req,reply)=>{await destroySession(req,reply);return {ok:true};});

app.get('/api/catalog',{config:{rateLimit:{max:80,timeWindow:'1 minute'}}},async(req)=>getCatalog(req.query||{}));
app.get('/api/schedule',{config:{rateLimit:{max:80,timeWindow:'1 minute'}}},async(req,reply)=>{const now=Math.floor(Date.now()/1000),start=Number(req.query?.start||now-86400),end=Number(req.query?.end||now+7*86400); if(end-start>10*86400)return reply.code(400).send({error:'RANGE_TOO_LARGE'});return getSchedule(start,end);});
app.get('/api/anime/:id',{config:{rateLimit:{max:100,timeWindow:'1 minute'}}},async(req,reply)=>{const id=Number(req.params.id);if(!Number.isInteger(id))return reply.code(400).send({error:'INVALID_ID'});return getAnime(id);});
app.get('/api/studios',async(req)=>getStudios(Number(req.query?.page||1)));
app.get('/api/dublados',async(req)=>getDubbed(Number(req.query?.page||1)));
app.get('/api/lists',async()=>lists);
app.get('/api/list/:slug',async(req,reply)=>{const l=lists.find(x=>x.slug===req.params.slug);if(!l)return reply.code(404).send({error:'NOT_FOUND'});const data=await getCatalog({page:req.query?.page||1,sort:l.sort});return {...l,...data};});

app.get('/api/me/list',async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const {rows}=await q('SELECT media_id,status,score,reaction,progress,updated_at FROM user_anime WHERE user_id=$1 ORDER BY updated_at DESC',[u.id]);return {items:rows};});
app.put('/api/me/list/:mediaId',{config:{rateLimit:{max:60,timeWindow:'1 minute'}}},async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const parsed=z.object({status:z.enum(['PLANNING','CURRENT','COMPLETED','PAUSED','DROPPED']),score:z.number().min(0).max(10).nullable().optional(),reaction:z.enum(['LIKE','DISLIKE','LOVE','WOW']).nullable().optional(),progress:z.number().int().min(0).max(100000).optional()}).safeParse(req.body);if(!parsed.success)return reply.code(400).send({error:'INVALID_INPUT'});const mediaId=Number(req.params.mediaId);await q(`INSERT INTO user_anime(user_id,media_id,status,score,reaction,progress,updated_at) VALUES($1,$2,$3,$4,$5,$6,now()) ON CONFLICT(user_id,media_id) DO UPDATE SET status=EXCLUDED.status,score=EXCLUDED.score,reaction=EXCLUDED.reaction,progress=EXCLUDED.progress,updated_at=now()`,[u.id,mediaId,parsed.data.status,parsed.data.score??null,parsed.data.reaction??null,parsed.data.progress??0]);return {ok:true};});
app.delete('/api/me/list/:mediaId',async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;await q('DELETE FROM user_anime WHERE user_id=$1 AND media_id=$2',[u.id,Number(req.params.mediaId)]);return {ok:true};});

app.get('/api/anime/:id/impressions',async req=>{const {rows}=await q(`SELECT i.id,i.body,i.spoiler,i.created_at,u.username,u.avatar_url FROM impressions i JOIN users u ON u.id=i.user_id WHERE media_id=$1 AND hidden=false ORDER BY i.created_at DESC LIMIT 50`,[Number(req.params.id)]);return {items:rows};});
app.post('/api/anime/:id/impressions',{config:{rateLimit:{max:8,timeWindow:'1 minute'}}},async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const p=z.object({body:z.string().min(1).max(1200),spoiler:z.boolean().optional()}).safeParse(req.body);if(!p.success)return reply.code(400).send({error:'INVALID_INPUT'});await q('INSERT INTO impressions(user_id,media_id,body,spoiler) VALUES($1,$2,$3,$4)',[u.id,Number(req.params.id),p.data.body,p.data.spoiler||false]);return {ok:true};});

app.post('/api/contact',{config:{rateLimit:{max:5,timeWindow:'10 minutes'}}},async(req,reply)=>{const p=z.object({name:z.string().min(2).max(100),email:z.string().email(),subject:z.string().min(3).max(160),message:z.string().min(10).max(5000)}).safeParse(req.body);if(!p.success)return reply.code(400).send({error:'INVALID_INPUT'});await q('INSERT INTO contact_messages(name,email,subject,message) VALUES($1,$2,$3,$4)',[p.data.name,p.data.email,p.data.subject,p.data.message]);return {ok:true};});
app.post('/api/dmca',{config:{rateLimit:{max:3,timeWindow:'1 hour'}}},async(req,reply)=>{const p=z.object({requesterName:z.string().min(2).max(150),requesterEmail:z.string().email(),rightsHolder:z.string().min(2).max(200),contentUrl:z.string().url().max(1200),description:z.string().min(30).max(6000),goodFaith:z.literal(true),signature:z.string().min(2).max(200)}).safeParse(req.body);if(!p.success)return reply.code(400).send({error:'INVALID_INPUT'});const d=p.data;await q('INSERT INTO dmca_requests(requester_name,requester_email,rights_holder,content_url,description,good_faith,signature) VALUES($1,$2,$3,$4,$5,$6,$7)',[d.requesterName,d.requesterEmail,d.rightsHolder,d.contentUrl,d.description,d.goodFaith,d.signature]);return {ok:true};});
app.post('/api/events',{config:{rateLimit:{max:60,timeWindow:'1 minute'}}},async(req)=>{const p=z.object({event:z.string().max(60),path:z.string().max(300),mediaId:z.number().int().optional()}).safeParse(req.body);if(p.success)q('INSERT INTO analytics_events(event_name,path,media_id) VALUES($1,$2,$3)',[p.data.event,p.data.path,p.data.mediaId||null]).catch(()=>{});return {ok:true};});

app.setNotFoundHandler(async(req,reply)=>{if(req.url.startsWith('/api/'))return reply.code(404).send({error:'NOT_FOUND'});return reply.type('text/html').sendFile('index.html');});
app.addHook('onClose',async()=>{await Promise.allSettled([pool.end(),redis.quit()]);});

for(let i=0;i<30;i++){try{await initDb();await initCache();break}catch(e){if(i===29)throw e;app.log.warn('Dependências ainda iniciando; nova tentativa em 2s');await new Promise(r=>setTimeout(r,2000));}}
prewarm().catch(e=>app.log.warn(e)); setInterval(()=>prewarm().catch(e=>app.log.warn(e)),120_000).unref();
const port=Number(process.env.PORT||3000),host=process.env.HOST||'0.0.0.0'; await app.listen({port,host});
