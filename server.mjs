import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import rawBody from 'fastify-raw-body';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { initDb, q, pool, dbReady } from './lib/db.mjs';
import { initCache, redis, cacheRemember } from './lib/cache.mjs';
import { AUTHORIZED_ORIGINS, CLERK_ENABLED, hashPassword, verifyPassword, createSession, destroySession, currentUser, requireUser, requireRole, validateOrigin, getClerkClient, beginAccountDeletion, cancelAccountDeletion, bootstrapConfiguredAdmins, invalidateUserIdentityCache } from './lib/auth.mjs';
import { processClerkWebhook } from './lib/clerk-webhook.mjs';
import { getCatalog, getReading, getSchedule, getAnime, getAnimeThemes, getMediaSummaries, getManga, getStudios, getDubbed, prewarm } from './lib/provider.mjs';
import { lists } from './lib/content.mjs';
import { getNativeNews, getNativeArticle, articleExpiry } from './lib/native-news.mjs';
import { enqueueAnalytics, flushAnalytics, analyticsStats } from './lib/analytics.mjs';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const trustProxy=['127.0.0.1','::1','10.0.0.0/8','172.16.0.0/12','192.168.0.0/16'];
const app=Fastify({logger:true,trustProxy,bodyLimit:1_000_000,requestTimeout:15_000,connectionTimeout:10_000,keepAliveTimeout:72_000});
await app.register(cookie);
await app.register(cors,{origin:(origin,callback)=>{if(!origin||AUTHORIZED_ORIGINS.includes(origin))return callback(null,true);return callback(null,false)},methods:['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'],allowedHeaders:['accept','authorization','content-type'],exposedHeaders:['retry-after'],credentials:false,maxAge:600,strictPreflight:true});
await app.register(rawBody,{field:'rawBody',global:false,encoding:false,runFirst:true,routes:['/api/webhooks/clerk']});
await app.register(helmet,{global:true,crossOriginEmbedderPolicy:false,contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'",'https://*.clerk.accounts.dev','https://*.clerk.com','https://challenges.cloudflare.com','https://*.protect.clerk.com'],styleSrc:["'self'","'unsafe-inline'",'https://fonts.googleapis.com'],fontSrc:["'self'",'https://fonts.gstatic.com'],imgSrc:["'self'",'data:','https:','https://img.clerk.com'],connectSrc:["'self'",'https://graphql.anilist.co','https://api.jikan.moe','https://api.mymemory.translated.net','https://translate.googleapis.com','https://api.animethemes.moe','https://*.clerk.accounts.dev','https://api.clerk.com','https://*.protect.clerk.com:*'],mediaSrc:["'self'",'https://v.animethemes.moe'],frameSrc:["'self'",'https://www.youtube-nocookie.com','https://www.youtube.com','https://www.dailymotion.com','https://*.clerk.accounts.dev','https://challenges.cloudflare.com','https://*.protect.clerk.com'],workerSrc:["'self'",'blob:'],objectSrc:["'none'"],baseUri:["'self'"],frameAncestors:["'none'"],formAction:["'self'",'https://*.clerk.accounts.dev']}}});
await app.register(rateLimit,{global:false,max:120,timeWindow:'1 minute',ban:2,hook:'preHandler'});
app.decorateRequest('aninexusUser',null);
await app.register(fastifyStatic,{root:path.join(__dirname,'public'),prefix:'/',decorateReply:true,maxAge:'1h',immutable:false});
await app.register(fastifyStatic,{root:path.join(__dirname,'assets'),prefix:'/assets/',decorateReply:false,maxAge:'7d',immutable:true});

app.addHook('onRequest',async(req,reply)=>{if(!validateOrigin(req,reply))return reply;});
app.addHook('onSend',async(req,reply,payload)=>{
  reply.header('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=()');
  reply.header('Referrer-Policy','strict-origin-when-cross-origin');
  reply.header('X-Content-Type-Options','nosniff');
  reply.header('X-Permitted-Cross-Domain-Policies','none');
  const url=String(req.url||'').split('?')[0];
  if(url.startsWith('/api/auth/')||url.startsWith('/api/me'))reply.header('Cache-Control','no-store');
  else if(req.method==='GET'&&/^\/api\/(home|catalog|reading|schedule|anime\/\d+|manga\/\d+|media\/summaries|studios|dublados|lists|list\/|users\/|news(?:\/|$)|community\/(?:impressions|activity|threads))/.test(url))reply.header('Cache-Control','public, max-age=20, stale-while-revalidate=180, stale-if-error=600');
  else if(req.method==='GET'&&(url==='/'||reply.getHeader('content-type')?.toString().includes('text/html')))reply.header('Cache-Control','no-cache, max-age=0, must-revalidate');
  if(process.env.PUBLIC_ORIGIN?.startsWith('https://'))reply.header('Strict-Transport-Security','max-age=31536000; includeSubDomains; preload');
  return payload;
});
app.setErrorHandler((error,req,reply)=>{req.log.error({err:error},'request failed');if(reply.sent)return;const status=error.statusCode&&error.statusCode>=400&&error.statusCode<600?error.statusCode:500;reply.code(status).send({error:status>=500?'INTERNAL_ERROR':'REQUEST_FAILED'});});

const authenticateForRate=async(request,reply)=>{
  const user=await requireUser(request,reply);
  if(user)request.aninexusUser=user;
};
const authenticatedRateKey=request=>request.aninexusUser?.id?`user:${request.aninexusUser.id}`:`ip:${request.ip}`;
const rateForUser=(max,timeWindow,groupId)=>({preValidation:authenticateForRate,config:{rateLimit:{max,timeWindow,groupId,keyGenerator:authenticatedRateKey}}});
const authRate={config:{rateLimit:{max:8,timeWindow:'1 minute',groupId:'auth',keyGenerator:request=>request.ip}}};
const privateReadRate=rateForUser(120,'1 minute','private-read');
const privateHeavyRate=rateForUser(20,'1 minute','private-heavy');
const writeRate=rateForUser(30,'1 minute','private-write');
const publicRate={config:{rateLimit:{max:240,timeWindow:'1 minute'}}};
const currentSeason=()=>{const now=new Date(),month=Number(new Intl.DateTimeFormat('en',{timeZone:'America/Sao_Paulo',month:'numeric'}).format(now)),year=Number(new Intl.DateTimeFormat('en',{timeZone:'America/Sao_Paulo',year:'numeric'}).format(now));return{season:month<=3?'WINTER':month<=6?'SPRING':month<=9?'SUMMER':'FALL',year}};
const safeUser=u=>u&&({id:u.id,email:u.email,username:u.username,displayName:u.display_name||u.username,role:u.role,status:u.status||'active',avatarUrl:u.avatar_url,bannerUrl:u.profile_banner_url||null,bio:u.bio,location:u.location||null,websiteUrl:u.website_url||null,instagramHandle:u.instagram_handle||null,telegramHandle:u.telegram_handle||null,showLibrary:u.show_library!==false,showActivity:u.show_activity!==false,showStats:u.show_stats!==false,theme:u.theme,privacy:u.privacy||'public',emailVerified:u.email_verified,createdAt:u.created_at});
const safeInt=(v,min=1,max=Number.MAX_SAFE_INTEGER)=>{const n=Number(v);return Number.isSafeInteger(n)&&n>=min&&n<=max?n:null};
const safePath=v=>{const s=String(v||'').slice(0,500);return s.startsWith('/')&&!s.startsWith('//')?s:null};
const strongPassword=z.string().min(10).max(128).refine(v=>/[A-Za-zÀ-ÿ]/.test(v)&&/\d/.test(v),{message:'WEAK_PASSWORD'});
const usernameSchema=z.string().trim().min(3).max(30).regex(/^[\p{L}\p{N}_.-]+$/u).refine(value=>!/^(?:admin(?:istrator)?|moderador|moderator|suporte|support|aninexus|equipe|staff|sistema|system)$/i.test(value),{message:'RESERVED_USERNAME'});
const nullableText=(max,min=0)=>z.union([z.string().trim().min(min).max(max),z.literal(''),z.null()]).transform(value=>value||null);
const nullableHttpsUrl=z.union([z.string().trim().url().max(2000).refine(value=>value.startsWith('https://')),z.literal(''),z.null()]).transform(value=>value||null);
const nullableHandle=max=>z.preprocess(value=>typeof value==='string'?value.trim().replace(/^@+/,''):value,z.union([z.string().regex(/^[A-Za-z0-9_.]+$/).max(max),z.literal(''),z.null()])).transform(value=>value||null);
const DUMMY_PASSWORD_HASH=CLERK_ENABLED?'':await hashPassword('aninexus-invalid-password-sentinel-do-not-use-8401');
const mediaProjection=`CASE WHEN mc.media_id IS NULL THEN NULL ELSE jsonb_build_object(
  'id',mc.media_id,'title',mc.payload->>'title','cover',mc.payload->>'cover','banner',mc.payload->>'banner',
  'score',mc.payload->'score','episodes',mc.payload->'episodes','status',mc.payload->>'status','format',mc.payload->>'format',
  'seasonYear',mc.payload->'seasonYear','genres',COALESCE(mc.payload->'genres','[]'::jsonb),'slug',mc.payload->>'slug','mediaType',mc.media_type
) END`;
const hydrateCommunityMedia=async (rows,mediaTypeHint='ANIME')=>{
  const missingRows=rows.filter(row=>row.media_id&&!row.media);
  if(!missingRows.length)return rows;
  try{
    const groups={ANIME:[],MANGA:[]};
    for(const row of missingRows){const type=row.media_type==='MANGA'||mediaTypeHint==='MANGA'?'MANGA':'ANIME';groups[type].push(Number(row.media_id))}
    const [anime,manga]=await Promise.all([
      getMediaSummaries([...new Set(groups.ANIME)],'ANIME'),
      getMediaSummaries([...new Set(groups.MANGA)],'MANGA')
    ]);
    const byKey=new Map([...anime,...manga].map(media=>[`${media.mediaType||'ANIME'}:${Number(media.id)}`,media]));
    return rows.map(row=>{if(row.media)return row;const type=row.media_type==='MANGA'||mediaTypeHint==='MANGA'?'MANGA':'ANIME';return{...row,media:byKey.get(`${type}:${Number(row.media_id)}`)||null}})
  }catch(error){app.log.warn({err:error},'community media hydration failed');return rows}
};
const transaction=async fn=>{const client=await pool.connect();try{await client.query('BEGIN');const result=await fn(client);await client.query('COMMIT');return result}catch(error){await client.query('ROLLBACK').catch(()=>{});throw error}finally{client.release()}};

app.get('/health',async()=>({ok:true,uptime:Math.round(process.uptime()),time:new Date().toISOString()}));
app.get('/health/ready',async(req,reply)=>{const [db,cache]=await Promise.all([dbReady(),(async()=>{try{return redis.isReady&&(await redis.ping())==='PONG'}catch{return false}})()]);const ok=db&&cache;return reply.code(ok?200:503).send({ok,db,cache});});
app.get('/api/me',privateReadRate,async(req,reply)=>{const user=await requireUser(req,reply);if(!user)return;return{user:safeUser(user)}});
app.get('/api/member/telegram',privateReadRate,async(req,reply)=>{const user=await requireUser(req,reply);if(!user)return;reply.header('Cache-Control','no-store');return{url:'https://t.me/BaltigoWorld',label:'BaltigoWorld no Telegram'};});
app.get('/api/users/:username',publicRate,async(req,reply)=>{
  const parsed=usernameSchema.safeParse(String(req.params.username||''));if(!parsed.success)return reply.code(404).send({error:'NOT_FOUND'});
  const requested=parsed.data;
  let result=await q('SELECT * FROM users WHERE username=$1 AND deleted_at IS NULL AND status=\'active\'',[requested]);
  let aliased=false;
  if(!result.rows[0]){result=await q(`SELECT u.* FROM user_profile_aliases a JOIN users u ON u.id=a.user_id WHERE a.alias=$1 AND u.deleted_at IS NULL AND u.status='active'`,[requested]);aliased=!!result.rows[0]}
  const user=result.rows[0];if(!user)return reply.code(404).send({error:'NOT_FOUND'});
  const isPrivate=user.privacy!=='public';
  const profile={username:user.username,displayName:user.display_name||user.username,avatarUrl:user.avatar_url,bannerUrl:user.profile_banner_url||null,bio:isPrivate?null:user.bio,location:isPrivate?null:user.location,websiteUrl:isPrivate?null:user.website_url,instagramHandle:isPrivate?null:user.instagram_handle,telegramHandle:isPrivate?null:user.telegram_handle,role:user.role,privacy:user.privacy,isPrivate,showLibrary:user.show_library!==false,showActivity:user.show_activity!==false,showStats:user.show_stats!==false,createdAt:user.created_at};
  if(isPrivate)return{profile,canonicalUsername:user.username,aliased,stats:null,library:[],mangaLibrary:[],activity:[],impressions:[],achievements:[]};
  const [statsResult,libraryResult,mangaResult,activityResult,impressionsResult]=await Promise.all([
    user.show_stats===false?Promise.resolve({rows:[]}):q(`SELECT count(*)::int list_total,count(*) FILTER(WHERE status='CURRENT')::int watching,count(*) FILTER(WHERE status='COMPLETED')::int completed,count(*) FILTER(WHERE status='PLANNING')::int planning,COALESCE(sum(progress),0)::int episodes_watched,round(avg(score)::numeric,1) average_score,(SELECT count(*)::int FROM user_favorites WHERE user_id=$1) favorites FROM user_anime WHERE user_id=$1`,[user.id]),
    user.show_library===false?Promise.resolve({rows:[]}):q(`SELECT ua.media_id,ua.status,ua.score,ua.reaction,ua.progress,ua.updated_at,${mediaProjection} AS media FROM user_anime ua LEFT JOIN media_cache mc ON mc.media_id=ua.media_id AND mc.media_type='ANIME' WHERE ua.user_id=$1 ORDER BY ua.updated_at DESC LIMIT 36`,[user.id]),
    user.show_library===false?Promise.resolve({rows:[]}):q(`SELECT um.media_id,um.status,um.score,um.reaction,um.progress,um.updated_at,${mediaProjection} AS media FROM user_manga um LEFT JOIN media_cache mc ON mc.media_id=um.media_id AND mc.media_type='MANGA' WHERE um.user_id=$1 ORDER BY um.updated_at DESC LIMIT 36`,[user.id]),
    user.show_activity===false?Promise.resolve({rows:[]}):q(`SELECT ua.media_id,ua.status,ua.score,ua.reaction,ua.progress,ua.updated_at AS created_at,${mediaProjection} AS media FROM user_anime ua LEFT JOIN media_cache mc ON mc.media_id=ua.media_id AND mc.media_type='ANIME' WHERE ua.user_id=$1 ORDER BY ua.updated_at DESC LIMIT 12`,[user.id]),
    user.show_activity===false?Promise.resolve({rows:[]}):q(`SELECT i.id,i.media_id,i.media_type,i.body,i.spoiler,i.created_at,${mediaProjection} AS media FROM impressions i LEFT JOIN media_cache mc ON mc.media_id=i.media_id AND mc.media_type=i.media_type WHERE i.user_id=$1 AND i.hidden=false ORDER BY i.created_at DESC LIMIT 12`,[user.id]),
  ]);
  const [library,mangaLibrary,activity,impressions]=await Promise.all([hydrateCommunityMedia(libraryResult.rows),hydrateCommunityMedia(mangaResult.rows,'MANGA'),hydrateCommunityMedia(activityResult.rows),hydrateCommunityMedia(impressionsResult.rows)]);
  const stats=statsResult.rows[0]||null,total=Number(stats?.list_total||0),completed=Number(stats?.completed||0),episodes=Number(stats?.episodes_watched||0),xp=completed*120+episodes*4+impressions.length*35+mangaLibrary.filter(item=>item.status==='COMPLETED').length*90;
  const rank=xp>=10000?'Lenda':xp>=5000?'Mestre Otaku':xp>=2200?'Veterano':xp>=700?'Otaku':'Novato';
  const achievements=[
    completed>=1&&{id:'first-finish',title:'Primeira jornada',description:'Concluiu o primeiro anime.'},
    completed>=10&&{id:'ten-finish',title:'Maratonista',description:'Concluiu 10 animes.'},
    episodes>=100&&{id:'hundred-episodes',title:'Cem episódios',description:'Registrou 100 episódios assistidos.'},
    impressions.length>=1&&{id:'first-impression',title:'Primeira impressão',description:'Compartilhou uma impressão com a comunidade.'},
    mangaLibrary.length>=5&&{id:'manga-reader',title:'Leitor em formação',description:'Adicionou cinco mangás à biblioteca.'}
  ].filter(Boolean);
  return{profile,canonicalUsername:user.username,aliased,stats,rank:{name:rank,xp,nextXp:xp>=10000?null:xp<700?700:xp<2200?2200:xp<5000?5000:10000},achievements,library,mangaLibrary,activity,impressions};
});
app.post('/api/auth/register',authRate,async(req,reply)=>{
  if(CLERK_ENABLED)return reply.code(410).send({error:'AUTH_MANAGED_BY_CLERK'});
  const parsed=z.object({email:z.string().trim().toLowerCase().email().max(254),username:usernameSchema,password:strongPassword}).safeParse(req.body);
  if(!parsed.success)return reply.code(400).send({error:'INVALID_INPUT'});
  const {email,username,password}=parsed.data,passwordHash=await hashPassword(password);
  try{
    const {rows}=await q('INSERT INTO users(email,username,password_hash) VALUES($1,$2,$3) RETURNING *',[email,username,passwordHash]);
    await createSession(reply,rows[0],req);return reply.code(201).send({user:safeUser(rows[0])});
  }catch(err){if(err?.code==='23505')return reply.code(409).send({error:'ACCOUNT_UNAVAILABLE'});throw err;}
});
app.post('/api/auth/login',authRate,async(req,reply)=>{
  if(CLERK_ENABLED)return reply.code(410).send({error:'AUTH_MANAGED_BY_CLERK'});
  const parsed=z.object({login:z.string().trim().min(3).max(254),password:z.string().min(1).max(128)}).safeParse(req.body);if(!parsed.success)return reply.code(400).send({error:'INVALID_INPUT'});
  const {rows}=await q('SELECT * FROM users WHERE (email=$1 OR username=$1) AND deleted_at IS NULL',[parsed.data.login]);const u=rows[0];
  const valid=await verifyPassword(u?.password_hash||DUMMY_PASSWORD_HASH,parsed.data.password);if(!u||!valid)return reply.code(401).send({error:'INVALID_CREDENTIALS'});
  if(u.status&&u.status!=='active')return reply.code(403).send({error:u.status==='banned'?'ACCOUNT_BANNED':'ACCOUNT_SUSPENDED'});
  await createSession(reply,u,req);return {user:safeUser(u)};
});
app.post('/api/auth/logout',writeRate,async(req,reply)=>{if(CLERK_ENABLED)return reply.code(204).send();await destroySession(req,reply);return {ok:true};});
app.post('/api/webhooks/clerk',{config:{rawBody:true,rateLimit:{max:120,timeWindow:'1 minute'}}},async(req,reply)=>{
  if(!CLERK_ENABLED)return reply.code(404).send({error:'NOT_FOUND'});
  try{return await processClerkWebhook(req)}catch(error){req.log.warn({err:error},'clerk webhook rejected');return reply.code(400).send({error:'INVALID_WEBHOOK'})}
});

app.get('/api/catalog',{...publicRate,config:{rateLimit:{max:100,timeWindow:'1 minute'}}},async req=>getCatalog(req.query||{}));
app.get('/api/home',publicRate,async req=>{
  const fallback=currentSeason(),season=['WINTER','SPRING','SUMMER','FALL'].includes(String(req.query?.season||''))?String(req.query.season):fallback.season,year=safeInt(req.query?.year,1960,2100)||fallback.year;
  const now=Math.floor(Date.now()/1000),bucket=Math.floor(now/300),end=now+7*86400;
  return cacheRemember(`home:v2:${season}:${year}:${bucket}`,60,async()=>{
    const [seasonData,schedule,top,popular,reading,topReading,soon]=await Promise.all([
      getCatalog({page:1,perPage:22,season,year,sort:'POPULAR'}).catch(()=>({items:[]})),getSchedule(now,end).catch(()=>[]),getCatalog({page:1,perPage:10,sort:'SCORE'}).catch(()=>({items:[]})),getCatalog({page:1,perPage:22,sort:'POPULAR'}).catch(()=>({items:[]})),getReading({page:1,perPage:18,sort:'POPULAR'}).catch(()=>({items:[]})),getReading({page:1,perPage:10,format:'MANGA',sort:'SCORE'}).catch(()=>({items:[]})),getCatalog({page:1,perPage:22,status:'NOT_YET_RELEASED',sort:'POPULAR'}).catch(()=>({items:[]}))
    ]);
    return{season:seasonData.items||[],schedule:(schedule||[]).slice(0,8),top:top.items||[],popular:popular.items||[],reading:reading.items||[],topReading:topReading.items||[],soon:soon.items||[]};
  },{staleTtl:1800});
});
app.get('/api/reading',{...publicRate,config:{rateLimit:{max:100,timeWindow:'1 minute'}}},async req=>getReading(req.query||{}));
app.get('/api/schedule',{config:{rateLimit:{max:100,timeWindow:'1 minute'}}},async(req,reply)=>{const now=Math.floor(Date.now()/1000),start=Number(req.query?.start||now-86400),end=Number(req.query?.end||now+7*86400);if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>10*86400)return reply.code(400).send({error:'INVALID_RANGE'});return getSchedule(start,end);});
app.get('/api/anime/:id',{config:{rateLimit:{max:120,timeWindow:'1 minute'}}},async(req,reply)=>{const id=safeInt(req.params.id);if(!id)return reply.code(400).send({error:'INVALID_ID'});return getAnime(id);});
app.get('/api/anime/:id/rating',publicRate,async(req,reply)=>{const id=safeInt(req.params.id);if(!id)return reply.code(400).send({error:'INVALID_ID'});const {rows}=await q(`SELECT round(avg(score)::numeric,1) score,count(score)::int votes FROM user_anime WHERE media_id=$1 AND score IS NOT NULL`,[id]);return{score:rows[0]?.score==null?null:Number(rows[0].score),votes:Number(rows[0]?.votes||0)};});
app.get('/api/anime/:id/themes',{config:{rateLimit:{max:120,timeWindow:'1 minute'}}},async(req,reply)=>{const id=safeInt(req.params.id);if(!id)return reply.code(400).send({error:'INVALID_ID'});return getAnimeThemes(id);});
app.get('/api/media/summaries',{config:{rateLimit:{max:120,timeWindow:'1 minute'}}},async(req,reply)=>{const raw=String(req.query?.ids||'').split(',').slice(0,60),ids=raw.map(value=>safeInt(value)).filter(Boolean);if(!ids.length)return reply.code(400).send({error:'INVALID_IDS'});return{items:await getMediaSummaries(ids)}});
app.get('/api/manga/:id',{config:{rateLimit:{max:120,timeWindow:'1 minute'}}},async(req,reply)=>{const id=safeInt(req.params.id);if(!id)return reply.code(400).send({error:'INVALID_ID'});return getManga(id);});
app.get('/api/studios',publicRate,async req=>getStudios(Number(req.query?.page||1)));
app.get('/api/dublados',publicRate,async req=>getDubbed(Number(req.query?.page||1)));
app.get('/api/lists',publicRate,async()=>lists);
app.get('/api/list/:slug',publicRate,async(req,reply)=>{const l=lists.find(x=>x.slug===req.params.slug);if(!l)return reply.code(404).send({error:'NOT_FOUND'});const data=await getCatalog({page:req.query?.page||1,perPage:24,sort:l.sort,genre:l.genre,format:l.format,status:l.status,season:l.season,year:l.year});return {...l,...data};});

app.get('/api/news',publicRate,async(req)=>{const limit=Math.max(1,Math.min(60,Number(req.query?.limit||20))),offset=Math.max(0,Math.min(5000,Number(req.query?.offset||0)));const type=req.query?.type?String(req.query.type).slice(0,40):null;return{items:await getNativeNews({limit,offset,type})};});
app.get('/api/news/:slug',publicRate,async(req,reply)=>{const slug=String(req.params.slug||'').slice(0,180);const item=await getNativeArticle(slug);if(!item)return reply.code(404).send({error:'NOT_FOUND'});return item;});
app.get('/api/news/:slug/comments',publicRate,async(req,reply)=>{const slug=String(req.params.slug||'').slice(0,180),limit=Math.max(1,Math.min(100,Number(req.query?.limit||40)));const {rows}=await q(`SELECT c.id,c.parent_id,c.body,c.spoiler,c.created_at,u.username,u.display_name,u.avatar_url FROM news_comments c JOIN users u ON u.id=c.user_id WHERE c.article_slug=$1 AND c.hidden=false AND u.deleted_at IS NULL AND u.status='active' AND u.privacy='public' ORDER BY c.created_at ASC LIMIT $2`,[slug,limit]);return{items:rows};});
app.post('/api/news/:slug/comments',rateForUser(5,'1 minute','news-comments-write'),async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const slug=String(req.params.slug||'').slice(0,180),parsed=z.object({body:z.string().trim().min(2).max(1800),spoiler:z.boolean().optional(),parentId:z.string().uuid().nullable().optional()}).safeParse(req.body);if(!parsed.success)return reply.code(400).send({error:'INVALID_INPUT'});const article=await getNativeArticle(slug);if(!article)return reply.code(404).send({error:'NOT_FOUND'});const normalized=parsed.data.body.normalize('NFKC');if(/https?:\/\/\S+/gi.test(normalized)&&((normalized.match(/https?:\/\/\S+/gi)||[]).length>2))return reply.code(422).send({error:'TOO_MANY_LINKS'});const {rows}=await q(`INSERT INTO news_comments(article_slug,user_id,parent_id,body,spoiler) VALUES($1,$2,$3,$4,$5) RETURNING id,created_at`,[slug,u.id,parsed.data.parentId||null,normalized,parsed.data.spoiler||false]);return reply.code(201).send({ok:true,...rows[0]});});
app.post('/api/news/comments/:id/report',rateForUser(8,'10 minutes','news-comments-report'),async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const id=z.string().uuid().safeParse(req.params.id),parsed=z.object({reason:z.string().trim().min(3).max(1000)}).safeParse(req.body);if(!id.success||!parsed.success)return reply.code(422).send({error:'INVALID_INPUT'});await q(`INSERT INTO content_reports(reporter_id,target_type,target_id,reason) VALUES($1,'NEWS_COMMENT',$2,$3)`,[u.id,id.data,parsed.data.reason]);return reply.code(201).send({ok:true});});
const articleSchema=z.object({title:z.string().trim().min(3).max(220),summary:z.string().trim().min(10).max(1200),body:z.string().max(30000).nullable().optional(),eventType:z.enum(['SEASON','TRAILER','EPISODE','MANGA','TRENDING','OTHER']).nullable().optional(),spoiler:z.boolean().optional(),mediaIds:z.array(z.number().int().positive()).max(30).optional(),imageUrl:z.string().url().max(2000).nullable().optional(),imageAlt:z.string().max(240).nullable().optional(),facts:z.array(z.string().max(500)).max(32).optional(),status:z.enum(['draft','review','scheduled','published','archived']).optional(),scheduledAt:z.string().datetime().nullable().optional(),expiresAt:z.string().datetime().nullable().optional()});
app.post('/api/admin/news',writeRate,async(req,reply)=>{const u=await requireRole(req,reply,['moderator','admin']);if(!u)return;const p=articleSchema.safeParse(req.body);if(!p.success)return reply.code(400).send({error:'INVALID_INPUT'});const d=p.data,slug=`${d.title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,100)}-${Date.now().toString(36)}`;const published=d.status==='published'?new Date():null,expires=d.expiresAt?new Date(d.expiresAt):articleExpiry(published||new Date());const {rows}=await q(`INSERT INTO news_articles(slug,source_kind,event_type,title,summary,body,spoiler,status,media_ids,created_by,scheduled_at,published_at,image_url,image_alt,source_name,language,facts,expires_at) VALUES($1,'EDITORIAL',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'AniNexus','pt-BR',$14,$15) RETURNING id,slug,status`,[slug,d.eventType||null,d.title,d.summary,d.body||null,d.spoiler||false,d.status||'draft',JSON.stringify(d.mediaIds||[]),u.id,d.scheduledAt||null,published,d.imageUrl||null,d.imageAlt||null,JSON.stringify(d.facts||[]),expires]);await q('INSERT INTO audit_log(actor_id,action,target_type,target_id) VALUES($1,$2,$3,$4)',[u.id,'NEWS_CREATE','NEWS',rows[0].id]);return reply.code(201).send(rows[0]);});
app.patch('/api/admin/news/:id',writeRate,async(req,reply)=>{const u=await requireRole(req,reply,['moderator','admin']);if(!u)return;const id=String(req.params.id);if(!/^[0-9a-f-]{36}$/i.test(id))return reply.code(400).send({error:'INVALID_ID'});const p=articleSchema.partial().safeParse(req.body);if(!p.success||!Object.keys(p.data).length)return reply.code(400).send({error:'INVALID_INPUT'});const d=p.data;const {rows}=await q(`UPDATE news_articles SET title=COALESCE($2,title),summary=COALESCE($3,summary),body=COALESCE($4,body),event_type=COALESCE($5,event_type),spoiler=COALESCE($6,spoiler),status=COALESCE($7,status),media_ids=COALESCE($8::jsonb,media_ids),scheduled_at=COALESCE($9::timestamptz,scheduled_at),image_url=COALESCE($10,image_url),image_alt=COALESCE($11,image_alt),facts=COALESCE($12::jsonb,facts),expires_at=COALESCE($13::timestamptz,expires_at),published_at=CASE WHEN $7='published' AND published_at IS NULL THEN now() ELSE published_at END,updated_at=now() WHERE id=$1 RETURNING id,slug,status`,[id,d.title??null,d.summary??null,d.body??null,d.eventType??null,d.spoiler??null,d.status??null,d.mediaIds?JSON.stringify(d.mediaIds):null,d.scheduledAt??null,d.imageUrl??null,d.imageAlt??null,d.facts?JSON.stringify(d.facts):null,d.expiresAt??null]);if(!rows[0])return reply.code(404).send({error:'NOT_FOUND'});await q('INSERT INTO audit_log(actor_id,action,target_type,target_id) VALUES($1,$2,$3,$4)',[u.id,'NEWS_UPDATE','NEWS',id]);return rows[0];});

app.get('/api/admin/overview',privateHeavyRate,async(req,reply)=>{const actor=await requireRole(req,reply,['moderator','admin']);if(!actor)return;const [users,reports,content]=await Promise.all([q(`SELECT count(*)::int total,count(*) FILTER(WHERE status='active')::int active,count(*) FILTER(WHERE status='suspended')::int suspended,count(*) FILTER(WHERE status='banned')::int banned,count(*) FILTER(WHERE created_at>=now()-interval '7 days')::int new_week FROM users WHERE deleted_at IS NULL`),q(`SELECT count(*) FILTER(WHERE status='open')::int open,count(*) FILTER(WHERE status='reviewing')::int reviewing FROM content_reports`),q(`SELECT (SELECT count(*) FROM impressions WHERE hidden=false)::int impressions,(SELECT count(*) FROM community_threads WHERE hidden=false)::int threads,(SELECT count(*) FROM community_posts WHERE hidden=false)::int posts`)]);return{users:users.rows[0],reports:reports.rows[0],content:content.rows[0]}});
app.get('/api/admin/users',privateHeavyRate,async(req,reply)=>{const actor=await requireRole(req,reply,['moderator','admin']);if(!actor)return;const search=String(req.query?.search||'').trim().slice(0,120),status=['active','suspended','banned'].includes(String(req.query?.status||''))?String(req.query.status):null,limit=Math.max(1,Math.min(100,Number(req.query?.limit||40))),offset=Math.max(0,Math.min(10000,Number(req.query?.offset||0)));const pattern=search?`%${search.replace(/[%_]/g,'\\$&')}%`:null;const {rows}=await q(`SELECT u.id,u.email,u.username,u.display_name,u.avatar_url,u.role,u.status,u.suspended_until,u.ban_reason,u.moderation_note,u.email_verified,u.created_at,u.last_seen_at,(SELECT count(*)::int FROM user_anime ua WHERE ua.user_id=u.id) list_count,(SELECT count(*)::int FROM impressions i WHERE i.user_id=u.id AND i.hidden=false) impression_count FROM users u WHERE u.deleted_at IS NULL AND ($1::text IS NULL OR u.email::text ILIKE $1 ESCAPE '\\' OR u.username::text ILIKE $1 ESCAPE '\\' OR COALESCE(u.display_name,'') ILIKE $1 ESCAPE '\\') AND ($2::text IS NULL OR u.status=$2) ORDER BY u.created_at DESC LIMIT $3 OFFSET $4`,[pattern,status,limit,offset]);return{items:rows,hasMore:rows.length===limit}});
app.get('/api/admin/reports',privateHeavyRate,async(req,reply)=>{const actor=await requireRole(req,reply,['moderator','admin']);if(!actor)return;const status=['open','reviewing','resolved','dismissed'].includes(String(req.query?.status||''))?String(req.query.status):null,limit=Math.max(1,Math.min(100,Number(req.query?.limit||50)));const {rows}=await q(`SELECT r.id,r.target_type,r.target_id,r.reason,r.status,r.created_at,u.username reporter_username,u.display_name reporter_name FROM content_reports r LEFT JOIN users u ON u.id=r.reporter_id WHERE ($1::text IS NULL OR r.status=$1) ORDER BY CASE r.status WHEN 'open' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END,r.created_at ASC LIMIT $2`,[status,limit]);return{items:rows}});
app.get('/api/admin/audit-log',privateHeavyRate,async(req,reply)=>{const actor=await requireRole(req,reply,['admin']);if(!actor)return;const limit=Math.max(1,Math.min(200,Number(req.query?.limit||80)));const {rows}=await q(`SELECT a.id,a.action,a.target_type,a.target_id,a.metadata,a.created_at,u.username actor_username,u.display_name actor_name FROM audit_log a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT $1`,[limit]);return{items:rows}});
app.patch('/api/admin/users/:id/moderation',rateForUser(20,'1 minute','admin-moderation'),async(req,reply)=>{const actor=await requireRole(req,reply,['moderator','admin']);if(!actor)return;const id=z.string().uuid().safeParse(req.params.id);if(!id.success)return reply.code(400).send({error:'INVALID_ID'});const parsed=z.object({status:z.enum(['active','suspended','banned']).optional(),suspendUntil:z.string().datetime().nullable().optional(),reason:z.string().trim().min(3).max(1000),role:z.enum(['user','moderator','admin']).optional(),note:z.string().trim().max(4000).nullable().optional()}).refine(value=>value.status||value.role||value.note!==undefined,{message:'NO_CHANGES'}).safeParse(req.body);if(!parsed.success)return reply.code(422).send({error:'INVALID_INPUT'});const d=parsed.data;if(id.data===actor.id&&(d.status&&d.status!=='active'||d.role&&d.role!==actor.role))return reply.code(409).send({error:'CANNOT_MODERATE_SELF'});const result=await transaction(async client=>{const targetResult=await client.query('SELECT * FROM users WHERE id=$1 AND deleted_at IS NULL FOR UPDATE',[id.data]),target=targetResult.rows[0];if(!target)return null;if(actor.role!=='admin'&&(target.role!=='user'||d.role))return{forbidden:true};if(d.role==='admin'&&actor.role!=='admin')return{forbidden:true};const suspendUntil=d.status==='suspended'?new Date(d.suspendUntil||Date.now()+24*3600*1000):null;if(suspendUntil&&suspendUntil<=new Date())return{invalidSuspend:true};const updated=await client.query(`UPDATE users SET status=COALESCE($2,status),suspended_until=CASE WHEN $2='suspended' THEN $3::timestamptz WHEN $2 IS NOT NULL THEN NULL ELSE suspended_until END,ban_reason=CASE WHEN $2 IN ('suspended','banned') THEN $4 WHEN $2='active' THEN NULL ELSE ban_reason END,role=COALESCE($5,role),moderation_note=CASE WHEN $6::text IS NULL THEN moderation_note ELSE $6 END,updated_at=now() WHERE id=$1 RETURNING *`,[id.data,d.status||null,suspendUntil?.toISOString()||null,d.reason,d.role||null,d.note===undefined?null:d.note]);await client.query(`INSERT INTO audit_log(actor_id,action,target_type,target_id,metadata) VALUES($1,'USER_MODERATION','USER',$2,$3::jsonb)`,[actor.id,id.data,JSON.stringify({status:d.status||null,role:d.role||null,reason:d.reason,suspendUntil:suspendUntil?.toISOString()||null})]);return{user:updated.rows[0]}});if(!result)return reply.code(404).send({error:'NOT_FOUND'});if(result.forbidden)return reply.code(403).send({error:'FORBIDDEN'});if(result.invalidSuspend)return reply.code(422).send({error:'INVALID_SUSPENSION'});await invalidateUserIdentityCache(result.user);return{user:safeUser(result.user)}});
app.patch('/api/admin/reports/:id',rateForUser(30,'1 minute','admin-reports'),async(req,reply)=>{const actor=await requireRole(req,reply,['moderator','admin']);if(!actor)return;const id=z.string().uuid().safeParse(req.params.id),parsed=z.object({status:z.enum(['open','reviewing','resolved','dismissed'])}).safeParse(req.body);if(!id.success||!parsed.success)return reply.code(422).send({error:'INVALID_INPUT'});const {rows}=await q('UPDATE content_reports SET status=$2 WHERE id=$1 RETURNING id,status,target_type,target_id',[id.data,parsed.data.status]);if(!rows[0])return reply.code(404).send({error:'NOT_FOUND'});await q(`INSERT INTO audit_log(actor_id,action,target_type,target_id,metadata) VALUES($1,'REPORT_UPDATE','REPORT',$2,$3::jsonb)`,[actor.id,id.data,JSON.stringify({status:parsed.data.status,targetType:rows[0].target_type,targetId:rows[0].target_id})]);return rows[0]});
app.patch('/api/admin/content/:type/:id',rateForUser(30,'1 minute','admin-content'),async(req,reply)=>{const actor=await requireRole(req,reply,['moderator','admin']);if(!actor)return;const type=String(req.params.type||'').toUpperCase(),table={IMPRESSION:'impressions',THREAD:'community_threads',POST:'community_posts',NEWS_COMMENT:'news_comments'}[type],id=z.string().uuid().safeParse(req.params.id),parsed=z.object({hidden:z.boolean(),reason:z.string().trim().min(3).max(1000)}).safeParse(req.body);if(!table||!id.success||!parsed.success)return reply.code(422).send({error:'INVALID_INPUT'});const {rows}=await q(`UPDATE ${table} SET hidden=$2,updated_at=now() WHERE id=$1 RETURNING id,hidden`,[id.data,parsed.data.hidden]);if(!rows[0])return reply.code(404).send({error:'NOT_FOUND'});await q(`INSERT INTO audit_log(actor_id,action,target_type,target_id,metadata) VALUES($1,'CONTENT_VISIBILITY',$2,$3,$4::jsonb)`,[actor.id,type,id.data,JSON.stringify({hidden:parsed.data.hidden,reason:parsed.data.reason})]);return rows[0]});

app.get('/api/me/list',privateReadRate,async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const {rows}=await q('SELECT media_id,status,score,reaction,progress,updated_at FROM user_anime WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 2000',[u.id]);return{items:rows};});
app.put('/api/me/list/:mediaId',writeRate,async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const parsed=z.object({status:z.enum(['PLANNING','CURRENT','COMPLETED','PAUSED','DROPPED']),score:z.number().min(0).max(10).nullable().optional(),reaction:z.enum(['LIKE','DISLIKE','LOVE','WOW']).nullable().optional(),progress:z.number().int().min(0).max(100000).optional()}).safeParse(req.body);if(!parsed.success)return reply.code(400).send({error:'INVALID_INPUT'});const mediaId=safeInt(req.params.mediaId);if(!mediaId)return reply.code(400).send({error:'INVALID_ID'});await q(`INSERT INTO user_anime(user_id,media_id,status,score,reaction,progress,updated_at) VALUES($1,$2,$3,$4,$5,$6,now()) ON CONFLICT(user_id,media_id) DO UPDATE SET status=EXCLUDED.status,score=EXCLUDED.score,reaction=EXCLUDED.reaction,progress=EXCLUDED.progress,updated_at=now()`,[u.id,mediaId,parsed.data.status,parsed.data.score??null,parsed.data.reaction??null,parsed.data.progress??0]);return{ok:true};});
app.delete('/api/me/list/:mediaId',writeRate,async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const mediaId=safeInt(req.params.mediaId);if(!mediaId)return reply.code(400).send({error:'INVALID_ID'});await q('DELETE FROM user_anime WHERE user_id=$1 AND media_id=$2',[u.id,mediaId]);return{ok:true};});
app.get('/api/me/manga-list',privateReadRate,async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const {rows}=await q('SELECT media_id,status,score,reaction,progress,updated_at FROM user_manga WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 2000',[u.id]);return{items:rows};});
app.put('/api/me/manga-list/:mediaId',writeRate,async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const parsed=z.object({status:z.enum(['PLANNING','CURRENT','COMPLETED','PAUSED','DROPPED']),score:z.number().min(0).max(10).nullable().optional(),reaction:z.enum(['LIKE','DISLIKE','LOVE','WOW']).nullable().optional(),progress:z.number().int().min(0).max(100000).optional()}).safeParse(req.body);if(!parsed.success)return reply.code(400).send({error:'INVALID_INPUT'});const mediaId=safeInt(req.params.mediaId);if(!mediaId)return reply.code(400).send({error:'INVALID_ID'});await q(`INSERT INTO user_manga(user_id,media_id,status,score,reaction,progress,updated_at) VALUES($1,$2,$3,$4,$5,$6,now()) ON CONFLICT(user_id,media_id) DO UPDATE SET status=EXCLUDED.status,score=EXCLUDED.score,reaction=EXCLUDED.reaction,progress=EXCLUDED.progress,updated_at=now()`,[u.id,mediaId,parsed.data.status,parsed.data.score??null,parsed.data.reaction??null,parsed.data.progress??0]);return{ok:true};});
app.delete('/api/me/manga-list/:mediaId',writeRate,async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const mediaId=safeInt(req.params.mediaId);if(!mediaId)return reply.code(400).send({error:'INVALID_ID'});await q('DELETE FROM user_manga WHERE user_id=$1 AND media_id=$2',[u.id,mediaId]);return{ok:true};});

app.get('/api/me/favorites',privateReadRate,async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const {rows}=await q('SELECT media_id,media_type,created_at FROM user_favorites WHERE user_id=$1 ORDER BY created_at DESC LIMIT 5000',[u.id]);return{items:rows};});
app.put('/api/me/favorites/:mediaId',writeRate,async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const mediaId=safeInt(req.params.mediaId);if(!mediaId)return reply.code(400).send({error:'INVALID_ID'});const p=z.object({mediaType:z.enum(['ANIME','MANGA']).default('ANIME')}).safeParse(req.body||{});if(!p.success)return reply.code(400).send({error:'INVALID_INPUT'});await q('INSERT INTO user_favorites(user_id,media_id,media_type) VALUES($1,$2,$3) ON CONFLICT(user_id,media_id,media_type) DO NOTHING',[u.id,mediaId,p.data.mediaType]);return{ok:true,favorite:true};});
app.delete('/api/me/favorites/:mediaId',writeRate,async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const mediaId=safeInt(req.params.mediaId);if(!mediaId)return reply.code(400).send({error:'INVALID_ID'});const mediaType=String(req.query?.mediaType||'ANIME').toUpperCase()==='MANGA'?'MANGA':'ANIME';await q('DELETE FROM user_favorites WHERE user_id=$1 AND media_id=$2 AND media_type=$3',[u.id,mediaId,mediaType]);return{ok:true,favorite:false};});

app.get('/api/me/follows',privateReadRate,async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const {rows}=await q('SELECT media_id,media_type,notify_episode,notify_news,created_at FROM user_follows WHERE user_id=$1 ORDER BY created_at DESC LIMIT 2000',[u.id]);return{items:rows};});
app.put('/api/me/follows/:mediaId',writeRate,async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const mediaId=safeInt(req.params.mediaId);if(!mediaId)return reply.code(400).send({error:'INVALID_ID'});const p=z.object({mediaType:z.enum(['ANIME','MANGA']).default('ANIME'),notifyEpisode:z.boolean().default(true),notifyNews:z.boolean().default(true)}).safeParse(req.body||{});if(!p.success)return reply.code(400).send({error:'INVALID_INPUT'});const d=p.data;await q(`INSERT INTO user_follows(user_id,media_id,media_type,notify_episode,notify_news) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,media_id,media_type) DO UPDATE SET notify_episode=EXCLUDED.notify_episode,notify_news=EXCLUDED.notify_news`,[u.id,mediaId,d.mediaType,d.notifyEpisode,d.notifyNews]);return{ok:true};});
app.delete('/api/me/follows/:mediaId',writeRate,async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const mediaId=safeInt(req.params.mediaId);if(!mediaId)return reply.code(400).send({error:'INVALID_ID'});await q('DELETE FROM user_follows WHERE user_id=$1 AND media_id=$2',[u.id,mediaId]);return{ok:true};});
app.get('/api/me/notifications',privateReadRate,async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const limit=Math.max(1,Math.min(200,Number(req.query?.limit||100)));const {rows}=await q('SELECT id,kind,title,body,media_id,url,read_at,created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2',[u.id,limit]);return{items:rows};});
app.post('/api/me/notifications/:id/read',writeRate,async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const id=String(req.params.id||'');if(!/^[0-9a-f-]{36}$/i.test(id))return reply.code(400).send({error:'INVALID_ID'});await q('UPDATE notifications SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND user_id=$2',[id,u.id]);return{ok:true};});

app.get('/api/me/library',privateHeavyRate,async(req,reply)=>{
  const user=await requireUser(req,reply);if(!user)return;
  const [list,favorites,impressions,count]=await Promise.all([
    q(`SELECT ua.media_id,ua.status,ua.score,ua.reaction,ua.progress,ua.updated_at,${mediaProjection} AS media FROM user_anime ua LEFT JOIN media_cache mc ON mc.media_id=ua.media_id AND mc.media_type='ANIME' WHERE ua.user_id=$1 ORDER BY ua.updated_at DESC LIMIT 2000`,[user.id]),
    q(`SELECT uf.media_id,uf.media_type,uf.created_at,${mediaProjection} AS media FROM user_favorites uf LEFT JOIN media_cache mc ON mc.media_id=uf.media_id AND mc.media_type=uf.media_type WHERE uf.user_id=$1 AND uf.media_type='ANIME' ORDER BY uf.created_at DESC LIMIT 5000`,[user.id]),
    q(`SELECT i.id,i.media_id,i.media_type,i.body,i.spoiler,i.created_at,u.username,u.avatar_url,ua.status,ua.score,ua.progress,${mediaProjection} AS media FROM impressions i JOIN users u ON u.id=i.user_id LEFT JOIN user_anime ua ON ua.user_id=i.user_id AND ua.media_id=i.media_id LEFT JOIN media_cache mc ON mc.media_id=i.media_id AND mc.media_type='ANIME' WHERE i.user_id=$1 AND i.media_type='ANIME' AND i.hidden=false ORDER BY i.created_at DESC LIMIT 200`,[user.id]),
    q("SELECT count(*)::int AS count FROM impressions WHERE user_id=$1 AND media_type='ANIME' AND hidden=false",[user.id])
  ]);
  return{user:safeUser(user),list:list.rows,favorites:favorites.rows,impressions:impressions.rows,impressionCount:Number(count.rows[0]?.count||0)};
});
app.get('/api/me/manga-library',privateHeavyRate,async(req,reply)=>{const user=await requireUser(req,reply);if(!user)return;const [list,favorites,impressions]=await Promise.all([q(`SELECT um.media_id,um.status,um.score,um.reaction,um.progress,um.updated_at,${mediaProjection} AS media FROM user_manga um LEFT JOIN media_cache mc ON mc.media_id=um.media_id AND mc.media_type='MANGA' WHERE um.user_id=$1 ORDER BY um.updated_at DESC LIMIT 2000`,[user.id]),q(`SELECT uf.media_id,uf.media_type,uf.created_at,${mediaProjection} AS media FROM user_favorites uf LEFT JOIN media_cache mc ON mc.media_id=uf.media_id AND mc.media_type=uf.media_type WHERE uf.user_id=$1 AND uf.media_type='MANGA' ORDER BY uf.created_at DESC LIMIT 5000`,[user.id]),q(`SELECT i.id,i.media_id,i.media_type,i.body,i.spoiler,i.created_at,u.username,u.avatar_url,um.status,um.score,um.progress,${mediaProjection} AS media FROM impressions i JOIN users u ON u.id=i.user_id LEFT JOIN user_manga um ON um.user_id=i.user_id AND um.media_id=i.media_id LEFT JOIN media_cache mc ON mc.media_id=i.media_id AND mc.media_type='MANGA' WHERE i.user_id=$1 AND i.media_type='MANGA' AND i.hidden=false ORDER BY i.created_at DESC LIMIT 200`,[user.id])]);return{user:safeUser(user),list:list.rows,favorites:favorites.rows,impressions:impressions.rows};});

app.get('/api/me/preferences',privateReadRate,async(req,reply)=>{
  const user=await requireUser(req,reply);if(!user)return;
  const {rows}=await q(`SELECT theme,locale,timezone,email_episode_notifications,email_news_notifications,reduce_motion,updated_at
    FROM user_preferences WHERE user_id=$1`,[user.id]);
  return{preferences:rows[0]||{theme:user.theme||'system',locale:'pt-BR',timezone:'America/Sao_Paulo',email_episode_notifications:true,email_news_notifications:false,reduce_motion:null}};
});
app.put('/api/me/preferences',writeRate,async(req,reply)=>{
  const user=await requireUser(req,reply);if(!user)return;
  const parsed=z.object({theme:z.enum(['system','dark','light']),timezone:z.string().trim().min(3).max(80).regex(/^[A-Za-z_]+\/[A-Za-z_+-]+$/),emailEpisodeNotifications:z.boolean(),emailNewsNotifications:z.boolean(),reduceMotion:z.boolean().nullable()}).safeParse(req.body);
  if(!parsed.success)return reply.code(422).send({error:'INVALID_INPUT'});
  const d=parsed.data;
  await transaction(async client=>{await client.query(`INSERT INTO user_preferences(user_id,theme,timezone,email_episode_notifications,email_news_notifications,reduce_motion,updated_at)
    VALUES($1,$2,$3,$4,$5,$6,now()) ON CONFLICT(user_id) DO UPDATE SET theme=EXCLUDED.theme,timezone=EXCLUDED.timezone,email_episode_notifications=EXCLUDED.email_episode_notifications,email_news_notifications=EXCLUDED.email_news_notifications,reduce_motion=EXCLUDED.reduce_motion,updated_at=now()`,[user.id,d.theme,d.timezone,d.emailEpisodeNotifications,d.emailNewsNotifications,d.reduceMotion]);await client.query('UPDATE users SET theme=$2,updated_at=now() WHERE id=$1',[user.id,d.theme])});
  return{ok:true};
});

app.patch('/api/me/profile',writeRate,async(req,reply)=>{
  const user=await requireUser(req,reply);if(!user)return;
  const parsed=z.object({username:usernameSchema,displayName:z.string().trim().min(1).max(80),avatarUrl:nullableHttpsUrl,bannerUrl:nullableHttpsUrl,bio:nullableText(500),location:nullableText(80),websiteUrl:nullableHttpsUrl,instagramHandle:nullableHandle(30),telegramHandle:nullableHandle(32),privacy:z.enum(['public','followers','private']),showLibrary:z.boolean(),showActivity:z.boolean(),showStats:z.boolean()}).safeParse(req.body);
  if(!parsed.success)return reply.code(422).send({error:'INVALID_INPUT'});
  const d=parsed.data;
  try{
    const updated=await transaction(async client=>{
      const current=(await client.query('SELECT * FROM users WHERE id=$1 AND deleted_at IS NULL FOR UPDATE',[user.id])).rows[0];if(!current)return null;
      if(String(current.username).toLocaleLowerCase('pt-BR')!==d.username.toLocaleLowerCase('pt-BR')){
        const conflict=(await client.query(`SELECT 1 FROM users WHERE username=$1 AND id<>$2 UNION ALL SELECT 1 FROM user_profile_aliases WHERE alias=$1 AND user_id<>$2 LIMIT 1`,[d.username,user.id])).rows[0];
        if(conflict)return{conflict:true};
        await client.query('INSERT INTO user_profile_aliases(alias,user_id) VALUES($1,$2) ON CONFLICT(alias) DO NOTHING',[current.username,user.id]);
      }
      const {rows}=await client.query(`UPDATE users SET username=$2,display_name=$3,avatar_url=$4,avatar_source='custom',profile_banner_url=$5,bio=$6,location=$7,website_url=$8,instagram_handle=$9,telegram_handle=$10,privacy=$11,show_library=$12,show_activity=$13,show_stats=$14,username_changed_at=CASE WHEN username<>$2 THEN now() ELSE username_changed_at END,updated_at=now() WHERE id=$1 RETURNING *`,[user.id,d.username,d.displayName,d.avatarUrl,d.bannerUrl,d.bio,d.location,d.websiteUrl,d.instagramHandle,d.telegramHandle,d.privacy,d.showLibrary,d.showActivity,d.showStats]);
      return{user:rows[0]};
    });
    if(!updated)return reply.code(404).send({error:'NOT_FOUND'});if(updated.conflict)return reply.code(409).send({error:'USERNAME_UNAVAILABLE'});
    await invalidateUserIdentityCache(updated.user);return{user:safeUser(updated.user)};
  }catch(error){if(error?.code==='23505')return reply.code(409).send({error:'USERNAME_UNAVAILABLE'});throw error}
});

app.get('/api/me/import-status',privateReadRate,async(req,reply)=>{
  const user=await requireUser(req,reply);if(!user)return;
  const {rows}=await q('SELECT imported_at,source_version,item_count FROM local_imports WHERE user_id=$1',[user.id]);
  return{imported:!!rows[0],import:rows[0]||null};
});

const localImportSchema=z.object({
  sourceVersion:z.string().trim().min(1).max(40).default('browser-v2'),
  favorites:z.array(z.number().int().positive()).max(5000).default([]),
  states:z.array(z.object({mediaId:z.number().int().positive(),status:z.enum(['PLANNING','CURRENT','COMPLETED','PAUSED','DROPPED']),score:z.number().min(0).max(10).nullable().optional(),progress:z.number().int().min(0).max(100000).default(0),updatedAt:z.number().int().positive()})).max(2000).default([]),
  watched:z.array(z.object({mediaId:z.number().int().positive(),episode:z.number().int().positive().max(100000),watchedAt:z.number().int().positive().optional()})).max(10000).default([]),
});
app.post('/api/me/import-local',rateForUser(3,'10 minutes','initial-import'),async(req,reply)=>{
  const user=await requireUser(req,reply);if(!user)return;
  const parsed=localImportSchema.safeParse(req.body);if(!parsed.success)return reply.code(422).send({error:'INVALID_IMPORT'});
  const data=parsed.data,stateMap=new Map(),watchedMap=new Map();
  for(const item of data.states){const previous=stateMap.get(item.mediaId);if(!previous||item.updatedAt>=previous.updatedAt)stateMap.set(item.mediaId,item)}
  for(const item of data.watched){const key=`${item.mediaId}:${item.episode}`,previous=watchedMap.get(key);if(!previous||(item.watchedAt||0)>=(previous.watchedAt||0))watchedMap.set(key,item)}
  const normalized={...data,favorites:[...new Set(data.favorites)],states:[...stateMap.values()],watched:[...watchedMap.values()]};
  const checksum=crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  const result=await transaction(async client=>{
    const existing=await client.query('SELECT imported_at,item_count FROM local_imports WHERE user_id=$1 FOR UPDATE',[user.id]);
    if(existing.rows[0])return{alreadyImported:true,...existing.rows[0]};
    if(normalized.favorites.length)await client.query(`INSERT INTO user_favorites(user_id,media_id,media_type)
      SELECT $1,value::bigint,'ANIME' FROM jsonb_array_elements_text($2::jsonb) ON CONFLICT DO NOTHING`,[user.id,JSON.stringify(normalized.favorites)]);
    if(normalized.states.length)await client.query(`INSERT INTO user_anime(user_id,media_id,status,score,progress,updated_at)
      SELECT $1,x.media_id,x.status,x.score,x.progress,to_timestamp(x.updated_at/1000.0)
      FROM jsonb_to_recordset($2::jsonb) AS x(media_id bigint,status text,score numeric,progress integer,updated_at bigint)
      ON CONFLICT(user_id,media_id) DO UPDATE SET status=EXCLUDED.status,score=EXCLUDED.score,progress=EXCLUDED.progress,updated_at=EXCLUDED.updated_at
      WHERE EXCLUDED.updated_at>=user_anime.updated_at`,[user.id,JSON.stringify(normalized.states.map(x=>({media_id:x.mediaId,status:x.status,score:x.score??null,progress:x.progress,updated_at:x.updatedAt})))]);
    if(normalized.watched.length)await client.query(`INSERT INTO watched_episodes(user_id,media_id,episode,watched_at)
      SELECT $1,x.media_id,x.episode,to_timestamp(x.watched_at/1000.0)
      FROM jsonb_to_recordset($2::jsonb) AS x(media_id bigint,episode integer,watched_at bigint)
      ON CONFLICT(user_id,media_id,episode) DO UPDATE SET watched_at=GREATEST(watched_episodes.watched_at,EXCLUDED.watched_at)`,[user.id,JSON.stringify(normalized.watched.map(x=>({media_id:x.mediaId,episode:x.episode,watched_at:x.watchedAt||Date.now()})))]);
    const count=normalized.favorites.length+normalized.states.length+normalized.watched.length;
    await client.query('INSERT INTO local_imports(user_id,source_version,item_count,checksum) VALUES($1,$2,$3,$4)',[user.id,normalized.sourceVersion,count,checksum]);
    return{alreadyImported:false,itemCount:count};
  });
  return reply.code(result.alreadyImported?409:200).send(result.alreadyImported?{error:'IMPORT_ALREADY_COMPLETED',import:result}:{ok:true,...result});
});

app.get('/api/me/episodes/:mediaId',privateReadRate,async(req,reply)=>{
  const user=await requireUser(req,reply);if(!user)return;const mediaId=safeInt(req.params.mediaId);if(!mediaId)return reply.code(400).send({error:'INVALID_ID'});
  const {rows}=await q('SELECT episode,watched_at FROM watched_episodes WHERE user_id=$1 AND media_id=$2 ORDER BY episode',[user.id,mediaId]);return{items:rows};
});
app.put('/api/me/episodes/:mediaId/:episode',writeRate,async(req,reply)=>{
  const user=await requireUser(req,reply);if(!user)return;const mediaId=safeInt(req.params.mediaId),episode=safeInt(req.params.episode,1,100000);if(!mediaId||!episode)return reply.code(400).send({error:'INVALID_ID'});
  await q('INSERT INTO watched_episodes(user_id,media_id,episode) VALUES($1,$2,$3) ON CONFLICT(user_id,media_id,episode) DO UPDATE SET watched_at=now()',[user.id,mediaId,episode]);return{ok:true};
});
app.delete('/api/me/episodes/:mediaId/:episode',writeRate,async(req,reply)=>{
  const user=await requireUser(req,reply);if(!user)return;const mediaId=safeInt(req.params.mediaId),episode=safeInt(req.params.episode,1,100000);if(!mediaId||!episode)return reply.code(400).send({error:'INVALID_ID'});
  await q('DELETE FROM watched_episodes WHERE user_id=$1 AND media_id=$2 AND episode=$3',[user.id,mediaId,episode]);return{ok:true};
});

app.get('/api/me/export',privateHeavyRate,async(req,reply)=>{
  const user=await requireUser(req,reply);if(!user)return;
  const [profile,preferences,list,mangaList,favorites,watched,follows,impressions,newsComments,threads,posts]=await Promise.all([
    q('SELECT email,username,display_name,avatar_url,profile_banner_url,bio,location,website_url,instagram_handle,telegram_handle,avatar_source,theme,privacy,show_library,show_activity,show_stats,username_changed_at,email_verified,created_at,updated_at FROM users WHERE id=$1',[user.id]),q('SELECT * FROM user_preferences WHERE user_id=$1',[user.id]),q('SELECT media_id,status,score,reaction,progress,updated_at FROM user_anime WHERE user_id=$1 ORDER BY media_id',[user.id]),q('SELECT media_id,status,score,reaction,progress,updated_at FROM user_manga WHERE user_id=$1 ORDER BY media_id',[user.id]),q('SELECT media_id,media_type,created_at FROM user_favorites WHERE user_id=$1 ORDER BY media_type,media_id',[user.id]),q('SELECT media_id,episode,watched_at FROM watched_episodes WHERE user_id=$1 ORDER BY media_id,episode',[user.id]),q('SELECT media_id,media_type,notify_episode,notify_news,created_at FROM user_follows WHERE user_id=$1 ORDER BY media_type,media_id',[user.id]),q('SELECT media_id,media_type,body,spoiler,created_at,updated_at FROM impressions WHERE user_id=$1 ORDER BY created_at',[user.id]),q('SELECT article_slug,parent_id,body,spoiler,created_at,updated_at FROM news_comments WHERE user_id=$1 ORDER BY created_at',[user.id]),q('SELECT id,media_id,title,body,spoiler,created_at,updated_at FROM community_threads WHERE user_id=$1 ORDER BY created_at',[user.id]),q('SELECT thread_id,parent_id,body,spoiler,created_at,updated_at FROM community_posts WHERE user_id=$1 ORDER BY created_at',[user.id])
  ]);
  reply.header('Cache-Control','no-store').header('Content-Disposition',`attachment; filename="aninexus-${new Date().toISOString().slice(0,10)}.json"`);
  return{exportedAt:new Date().toISOString(),profile:profile.rows[0],preferences:preferences.rows[0]||null,list:list.rows,animeList:list.rows,mangaList:mangaList.rows,favorites:favorites.rows,watchedEpisodes:watched.rows,follows:follows.rows,impressions:impressions.rows,newsComments:newsComments.rows,threads:threads.rows,posts:posts.rows};
});
app.delete('/api/me/account',rateForUser(2,'1 hour','account-delete'),async(req,reply)=>{
  const user=await requireUser(req,reply);if(!user)return;
  const parsed=z.object({confirmation:z.literal('EXCLUIR')}).safeParse(req.body);if(!parsed.success)return reply.code(422).send({error:'CONFIRMATION_REQUIRED'});
  if(!CLERK_ENABLED||!user.clerk_user_id)return reply.code(409).send({error:'CLERK_ACCOUNT_REQUIRED'});
  await beginAccountDeletion(user);
  try{await getClerkClient().users.deleteUser(user.clerk_user_id)}catch(error){await cancelAccountDeletion(user).catch(()=>{});throw error}
  await q('DELETE FROM users WHERE id=$1',[user.id]);
  return reply.code(204).send();
});

app.get('/api/anime/:id/impressions',publicRate,async(req,reply)=>{const id=safeInt(req.params.id);if(!id)return reply.code(400).send({error:'INVALID_ID'});const limit=Math.max(1,Math.min(100,Number(req.query?.limit||50)));const {rows}=await q(`SELECT i.id,i.body,i.spoiler,i.created_at,u.username,u.display_name,u.avatar_url FROM impressions i JOIN users u ON u.id=i.user_id WHERE i.media_id=$1 AND i.media_type='ANIME' AND i.hidden=false AND u.deleted_at IS NULL AND u.status='active' AND u.privacy='public' ORDER BY i.created_at DESC LIMIT $2`,[id,limit]);return{items:rows};});
app.post('/api/anime/:id/impressions',rateForUser(8,'1 minute','impressions-write'),async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const id=safeInt(req.params.id);if(!id)return reply.code(400).send({error:'INVALID_ID'});const p=z.object({body:z.string().trim().min(1).max(1200),spoiler:z.boolean().optional()}).safeParse(req.body);if(!p.success)return reply.code(400).send({error:'INVALID_INPUT'});const {rows}=await q("INSERT INTO impressions(user_id,media_id,media_type,body,spoiler) VALUES($1,$2,'ANIME',$3,$4) RETURNING id,created_at",[u.id,id,p.data.body,p.data.spoiler||false]);return reply.code(201).send({ok:true,...rows[0]});});
app.get('/api/manga/:id/impressions',publicRate,async(req,reply)=>{const id=safeInt(req.params.id);if(!id)return reply.code(400).send({error:'INVALID_ID'});const limit=Math.max(1,Math.min(100,Number(req.query?.limit||50)));const {rows}=await q(`SELECT i.id,i.body,i.spoiler,i.created_at,u.username,u.display_name,u.avatar_url FROM impressions i JOIN users u ON u.id=i.user_id WHERE i.media_id=$1 AND i.media_type='MANGA' AND i.hidden=false AND u.deleted_at IS NULL AND u.status='active' AND u.privacy='public' ORDER BY i.created_at DESC LIMIT $2`,[id,limit]);return{items:rows};});
app.post('/api/manga/:id/impressions',rateForUser(8,'1 minute','manga-impressions-write'),async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const id=safeInt(req.params.id);if(!id)return reply.code(400).send({error:'INVALID_ID'});const p=z.object({body:z.string().trim().min(1).max(1200),spoiler:z.boolean().optional()}).safeParse(req.body);if(!p.success)return reply.code(400).send({error:'INVALID_INPUT'});const {rows}=await q("INSERT INTO impressions(user_id,media_id,media_type,body,spoiler) VALUES($1,$2,'MANGA',$3,$4) RETURNING id,created_at",[u.id,id,p.data.body,p.data.spoiler||false]);return reply.code(201).send({ok:true,...rows[0]});});

app.get('/api/community/activity',publicRate,async(req)=>{const limit=Math.max(1,Math.min(60,Number(req.query?.limit||30)));const {rows}=await q(`SELECT ua.media_id,ua.status,ua.score,ua.reaction,ua.progress,ua.updated_at AS created_at,u.username,u.display_name,u.avatar_url,${mediaProjection} AS media FROM user_anime ua JOIN users u ON u.id=ua.user_id LEFT JOIN media_cache mc ON mc.media_id=ua.media_id AND mc.media_type='ANIME' WHERE u.deleted_at IS NULL AND u.status='active' AND u.privacy='public' AND ua.status IN ('PLANNING','CURRENT','COMPLETED','PAUSED','DROPPED') ORDER BY ua.updated_at DESC LIMIT $1`,[limit]);return{items:await hydrateCommunityMedia(rows)};});
app.get('/api/community/impressions',publicRate,async(req)=>{const limit=Math.max(1,Math.min(30,Number(req.query?.limit||12)));const {rows}=await q(`SELECT i.id,i.media_id,i.media_type,i.body,i.spoiler,i.created_at,u.username,u.display_name,u.avatar_url,COALESCE(ua.status,um.status) status,COALESCE(ua.score,um.score) score,COALESCE(ua.progress,um.progress) progress,${mediaProjection} AS media FROM impressions i JOIN users u ON u.id=i.user_id LEFT JOIN user_anime ua ON i.media_type='ANIME' AND ua.user_id=i.user_id AND ua.media_id=i.media_id LEFT JOIN user_manga um ON i.media_type='MANGA' AND um.user_id=i.user_id AND um.media_id=i.media_id LEFT JOIN media_cache mc ON mc.media_id=i.media_id AND mc.media_type=i.media_type WHERE i.hidden=false AND u.deleted_at IS NULL AND u.status='active' AND u.privacy='public' ORDER BY i.created_at DESC LIMIT $1`,[limit]);return{items:await hydrateCommunityMedia(rows)};});
app.get('/api/community/threads',publicRate,async(req)=>{const limit=Math.max(1,Math.min(50,Number(req.query?.limit||30))),mediaId=req.query?.mediaId?safeInt(req.query.mediaId):null;const {rows}=await q(`SELECT t.id,t.media_id,t.title,t.body,t.spoiler,t.locked,t.created_at,u.username,u.display_name,u.avatar_url,(SELECT count(*)::int FROM community_posts p LEFT JOIN users pu ON pu.id=p.user_id WHERE p.thread_id=t.id AND p.hidden=false AND (p.user_id IS NULL OR (pu.deleted_at IS NULL AND pu.status='active' AND pu.privacy='public'))) replies FROM community_threads t LEFT JOIN users u ON u.id=t.user_id WHERE t.hidden=false AND (u.id IS NULL OR (u.deleted_at IS NULL AND u.status='active' AND u.privacy='public')) AND ($1::bigint IS NULL OR t.media_id=$1) ORDER BY t.created_at DESC LIMIT $2`,[mediaId,limit]);return{items:await hydrateCommunityMedia(rows)};});
app.post('/api/community/threads',writeRate,async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const p=z.object({mediaId:z.number().int().positive().nullable().optional(),title:z.string().trim().min(3).max(180),body:z.string().trim().min(1).max(6000),spoiler:z.boolean().optional()}).safeParse(req.body);if(!p.success)return reply.code(400).send({error:'INVALID_INPUT'});const {rows}=await q('INSERT INTO community_threads(user_id,media_id,title,body,spoiler) VALUES($1,$2,$3,$4,$5) RETURNING id,created_at',[u.id,p.data.mediaId||null,p.data.title,p.data.body,p.data.spoiler||false]);return reply.code(201).send(rows[0]);});
app.get('/api/community/threads/:id/posts',publicRate,async(req,reply)=>{const id=String(req.params.id);if(!/^[0-9a-f-]{36}$/i.test(id))return reply.code(400).send({error:'INVALID_ID'});const limit=Math.max(1,Math.min(200,Number(req.query?.limit||100))),offset=Math.max(0,Math.min(10000,Number(req.query?.offset||0)));const {rows}=await q(`SELECT p.id,p.parent_id,p.body,p.spoiler,p.created_at,u.username,u.display_name,u.avatar_url FROM community_posts p LEFT JOIN users u ON u.id=p.user_id WHERE p.thread_id=$1 AND p.hidden=false AND (u.id IS NULL OR (u.deleted_at IS NULL AND u.status='active' AND u.privacy='public')) ORDER BY p.created_at ASC LIMIT $2 OFFSET $3`,[id,limit,offset]);return{items:rows,hasMore:rows.length===limit};});
app.post('/api/community/threads/:id/posts',writeRate,async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const id=String(req.params.id);if(!/^[0-9a-f-]{36}$/i.test(id))return reply.code(400).send({error:'INVALID_ID'});const p=z.object({body:z.string().trim().min(1).max(3000),spoiler:z.boolean().optional(),parentId:z.string().uuid().nullable().optional()}).safeParse(req.body);if(!p.success)return reply.code(400).send({error:'INVALID_INPUT'});const thread=await q('SELECT locked FROM community_threads WHERE id=$1 AND hidden=false',[id]);if(!thread.rows[0])return reply.code(404).send({error:'NOT_FOUND'});if(thread.rows[0].locked)return reply.code(423).send({error:'THREAD_LOCKED'});const {rows}=await q('INSERT INTO community_posts(thread_id,user_id,parent_id,body,spoiler) VALUES($1,$2,$3,$4,$5) RETURNING id,created_at',[id,u.id,p.data.parentId||null,p.data.body,p.data.spoiler||false]);return reply.code(201).send(rows[0]);});
app.post('/api/community/report',{config:{rateLimit:{max:10,timeWindow:'10 minutes'}}},async(req,reply)=>{const u=await currentUser(req);const p=z.object({targetType:z.enum(['THREAD','POST','IMPRESSION','USER']),targetId:z.string().min(1).max(100),reason:z.string().trim().min(3).max(1000)}).safeParse(req.body);if(!p.success)return reply.code(400).send({error:'INVALID_INPUT'});await q('INSERT INTO content_reports(reporter_id,target_type,target_id,reason) VALUES($1,$2,$3,$4)',[u?.id||null,p.data.targetType,p.data.targetId,p.data.reason]);return{ok:true};});

app.post('/api/contact',{config:{rateLimit:{max:5,timeWindow:'10 minutes'}}},async(req,reply)=>{const p=z.object({name:z.string().trim().min(2).max(100),email:z.string().trim().toLowerCase().email(),subject:z.string().trim().min(3).max(160),message:z.string().trim().min(10).max(5000)}).safeParse(req.body);if(!p.success)return reply.code(400).send({error:'INVALID_INPUT'});await q('INSERT INTO contact_messages(name,email,subject,message) VALUES($1,$2,$3,$4)',[p.data.name,p.data.email,p.data.subject,p.data.message]);return{ok:true};});
app.post('/api/dmca',{config:{rateLimit:{max:3,timeWindow:'1 hour'}}},async(req,reply)=>{const p=z.object({requesterName:z.string().trim().min(2).max(150),requesterEmail:z.string().trim().toLowerCase().email(),rightsHolder:z.string().trim().min(2).max(200),contentUrl:z.string().url().max(1200),description:z.string().trim().min(30).max(6000),goodFaith:z.literal(true),signature:z.string().trim().min(2).max(200)}).safeParse(req.body);if(!p.success)return reply.code(400).send({error:'INVALID_INPUT'});const d=p.data;await q('INSERT INTO dmca_requests(requester_name,requester_email,rights_holder,content_url,description,good_faith,signature) VALUES($1,$2,$3,$4,$5,$6,$7)',[d.requesterName,d.requesterEmail,d.rightsHolder,d.contentUrl,d.description,d.goodFaith,d.signature]);return{ok:true};});
app.post('/api/events',{config:{rateLimit:{max:90,timeWindow:'1 minute'}}},async(req)=>{const p=z.object({event:z.string().trim().min(1).max(60),path:z.string().max(300),mediaId:z.number().int().positive().optional()}).safeParse(req.body);if(p.success){const eventPath=safePath(p.data.path);if(eventPath)enqueueAnalytics({event:p.data.event,path:eventPath,mediaId:p.data.mediaId||null})}return{ok:true};});

app.setNotFoundHandler(async(req,reply)=>{
  const accept=String(req.headers.accept||'');
  if(req.method==='GET'&&!req.url.startsWith('/api/')&&accept.includes('text/html'))return reply.type('text/html; charset=utf-8').sendFile('index.html');
  return reply.code(404).send({error:'NOT_FOUND'});
});

await initDb();
await initCache().catch(err=>app.log.warn({err},'redis unavailable; degraded cache mode'));
bootstrapConfiguredAdmins().then(result=>{if(result.updated)app.log.info({updated:result.updated},'configured administrators promoted')}).catch(err=>app.log.error({err},'configured administrator bootstrap failed'));
prewarm().catch(err=>app.log.warn({err},'prewarm failed'));

const port=Number(process.env.PORT||process.env.PUBLIC_PORT||8080);
await app.listen({port,host:'0.0.0.0'});

const shutdown=async()=>{await flushAnalytics().catch(()=>{});app.log.info({analytics:analyticsStats()},'shutdown');await app.close().catch(()=>{});await pool.end().catch(()=>{});await redis?.quit?.().catch(()=>{});process.exit(0)};
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
