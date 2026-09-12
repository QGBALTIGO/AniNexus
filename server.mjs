import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import rawBody from 'fastify-raw-body';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { z } from 'zod';
import sharp from 'sharp';
import { mediaListEntry } from './lib/media-list.mjs';
import { getCommunityOverview } from './lib/community-overview.mjs';
import { initDb, q, pool, dbReady } from './lib/db.mjs';
import { initCache, redis, cacheRemember, cacheReady, cacheRunOnce, cacheMetricsSnapshot } from './lib/cache.mjs';
import { SharedRateLimitStore } from './lib/rate-limit-store.mjs';
import { AUTHORIZED_ORIGINS, CLERK_ENABLED, hashPassword, verifyPassword, createSession, destroySession, currentUser, requireUser, requireRole, validateOrigin, getClerkClient, syncClerkUser, beginAccountDeletion, cancelAccountDeletion, bootstrapConfiguredAdmins, invalidateUserIdentityCache } from './lib/auth.mjs';
import { AVATAR_PRESETS, avatarForClerkUser, avatarPresetUrl, resolvedAvatar } from './lib/avatar.mjs';
import { processClerkWebhook } from './lib/clerk-webhook.mjs';
import { getCatalog, getReading, getSchedule, getAnime, getAnimeThemes, getMediaSummaries, getManga, getStudios, getDubbed, prewarm, slugify } from './lib/provider.mjs';
import { cleanSynopsisText, getPortugueseSynopsis } from './lib/synopsis.mjs';
import { lists } from './lib/content.mjs';
import { getNativeNews, getNativeTrailerArticles, getNativeArticle, articleExpiry } from './lib/native-news.mjs';
import { buildLatestTrailers } from './lib/trailers.mjs';
import { enqueueAnalytics, flushAnalytics, analyticsStats } from './lib/analytics.mjs';
import { getCharacterRanking, getUserCharacterFavorites, hydrateCharacterFavorites, setCharacterFavorite } from './lib/character-ranking.mjs';
import { achievementCatalog, getAchievementFeed, publicAchievementProfile, recordAnimeHistory, recordContributionHistory, setAchievementPins, setContributionHistoryValidity, syncAllUsersAchievements, syncUserAchievements, updateAchievementPreferences } from './lib/achievements.mjs';
import { registerSocialRoutes } from './lib/social-routes.mjs';
import { socialBodyPayload } from './lib/social.mjs';
import { buildAniListImportXml, fetchAniListEntries, usernameModerationReason } from './lib/profile-settings.mjs';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const PROFILE_MEDIA_DIR=path.resolve(process.env.PROFILE_MEDIA_DIR||path.join(__dirname,'profile-media'));
const PUBLIC_ORIGIN=/^https:\/\//.test(String(process.env.PUBLIC_ORIGIN||''))?String(process.env.PUBLIC_ORIGIN).replace(/\/+$/,''):'https://aninexus.com.br';
const trustProxy=['127.0.0.1','::1','10.0.0.0/8','172.16.0.0/12','192.168.0.0/16'];
const app=Fastify({logger:true,trustProxy,bodyLimit:1_000_000,requestTimeout:15_000,connectionTimeout:10_000,keepAliveTimeout:72_000,genReqId:()=>crypto.randomUUID()});
app.addContentTypeParser(/^image\/(?:jpeg|png|webp)$/i,{parseAs:'buffer'},(_request,body,done)=>done(null,body));
const eventLoopDelay=monitorEventLoopDelay({resolution:20});
let operationalMetricsTimer=null;
app.addHook('onClose',async()=>{if(operationalMetricsTimer)clearInterval(operationalMetricsTimer);eventLoopDelay.disable()});
await app.register(cookie);
await app.register(cors,{origin:(origin,callback)=>{if(!origin||AUTHORIZED_ORIGINS.includes(origin))return callback(null,true);return callback(null,false)},methods:['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'],allowedHeaders:['accept','authorization','content-type','x-aninexus-navigation-id','x-aninexus-client-release'],exposedHeaders:['retry-after','x-request-id','server-timing'],credentials:false,maxAge:600,strictPreflight:true});
await app.register(rawBody,{field:'rawBody',global:false,encoding:false,runFirst:true,routes:['/api/webhooks/clerk']});
await app.register(helmet,{global:true,crossOriginEmbedderPolicy:false,contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'",'https://*.clerk.accounts.dev','https://*.clerk.com','https://challenges.cloudflare.com','https://*.protect.clerk.com'],styleSrc:["'self'","'unsafe-inline'",'https://fonts.googleapis.com'],fontSrc:["'self'",'https://fonts.gstatic.com'],imgSrc:["'self'",'data:','https:','https://img.clerk.com'],connectSrc:["'self'",'https://graphql.anilist.co','https://api.jikan.moe','https://api.mymemory.translated.net','https://translate.googleapis.com','https://api.animethemes.moe','https://listen.moe','wss://listen.moe','https://*.clerk.accounts.dev','https://api.clerk.com','https://*.protect.clerk.com:*'],mediaSrc:["'self'",'https://v.animethemes.moe','https://listen.moe'],frameSrc:["'self'",'https://www.youtube-nocookie.com','https://www.youtube.com','https://www.dailymotion.com','https://*.clerk.accounts.dev','https://challenges.cloudflare.com','https://*.protect.clerk.com'],workerSrc:["'self'",'blob:'],objectSrc:["'none'"],baseUri:["'self'"],frameAncestors:["'none'"],formAction:["'self'",'https://*.clerk.accounts.dev']}}});
await app.register(rateLimit,{global:false,max:120,timeWindow:'1 minute',ban:2,hook:'preHandler',store:SharedRateLimitStore,skipOnError:false});
app.decorateRequest('aninexusUser',null);
app.decorateRequest('aninexusStartedAt',0);
app.decorateRequest('aninexusNavigationId','');
app.decorateRequest('aninexusClientRelease','');
await app.register(fastifyStatic,{root:path.join(__dirname,'public'),prefix:'/',decorateReply:true,maxAge:'1h',immutable:false,wildcard:false});
await app.register(fastifyStatic,{root:path.join(__dirname,'assets'),prefix:'/assets/',decorateReply:false,maxAge:'7d',immutable:true});

app.addHook('onRequest',async(req,reply)=>{
  req.aninexusStartedAt=performance.now();
  const navigationId=String(req.headers['x-aninexus-navigation-id']||'');
  req.aninexusNavigationId=/^[A-Za-z0-9_-]{1,80}$/.test(navigationId)?navigationId:'';
  const clientRelease=String(req.headers['x-aninexus-client-release']||'');
  req.aninexusClientRelease=/^[A-Za-z0-9._-]{1,80}$/.test(clientRelease)?clientRelease:'';
  reply.header('X-Request-Id',req.id);
  if(!validateOrigin(req,reply))return reply;
});
app.addHook('onSend',async(req,reply,payload)=>{
  reply.header('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=()');
  reply.header('Referrer-Policy','strict-origin-when-cross-origin');
  reply.header('X-Content-Type-Options','nosniff');
  reply.header('X-Permitted-Cross-Domain-Policies','none');
  const url=String(req.url||'').split('?')[0];
  if(url.startsWith('/api/auth/')||url.startsWith('/api/me')||url==='/api/achievements/feed'||url.endsWith('/comments/spoiler-check'))reply.header('Cache-Control','private, no-store');
  else if(req.method==='GET'&&/^\/api\/(home|catalog|reading|trailers|characters\/ranking|achievements\/catalog|schedule|anime\/\d+|manga\/\d+|impressions\/|feed\/|synopsis\/(?:anime|manga)\/\d+|media\/summaries|studios|dublados|lists|list\/|users\/|news(?:\/|$)|community\/(?:impressions|activity|threads))/.test(url))reply.header('Cache-Control','public, max-age=20, stale-while-revalidate=180, stale-if-error=600');
  else if(req.method==='GET'&&(url==='/'||reply.getHeader('content-type')?.toString().includes('text/html')))reply.header('Cache-Control','no-cache, max-age=0, must-revalidate');
  if(process.env.PUBLIC_ORIGIN?.startsWith('https://'))reply.header('Strict-Transport-Security','max-age=31536000; includeSubDomains; preload');
  reply.header('Server-Timing',`app;dur=${Math.max(0,performance.now()-req.aninexusStartedAt).toFixed(1)}`);
  return payload;
});
app.addHook('onResponse',async req=>{
  const durationMs=Math.max(0,performance.now()-req.aninexusStartedAt);
  if(durationMs>=1000)req.log.warn({requestId:req.id,navigationId:req.aninexusNavigationId||undefined,clientRelease:req.aninexusClientRelease||undefined,route:req.routeOptions?.url||req.url.split('?')[0],phase:'api',durationMs:Number(durationMs.toFixed(1))},'slow request');
});
app.setErrorHandler((error,req,reply)=>{req.log.error({err:error},'request failed');if(reply.sent)return;const infrastructure=['CACHE_DEADLINE','CACHE_BUSY','RATE_LIMIT_UNAVAILABLE'].includes(error?.code),status=infrastructure?503:error.statusCode&&error.statusCode>=400&&error.statusCode<600?error.statusCode:500;if(status===503)reply.header('Retry-After','1');reply.code(status).send({error:status===503?'TEMPORARILY_UNAVAILABLE':status>=500?'INTERNAL_ERROR':'REQUEST_FAILED'});});

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
app.get('/api/community/overview',publicRate,async()=>{
  const overview=await getCommunityOverview(q),groups=['rankings','favorites','dropped'];
  const works=groups.flatMap(key=>overview[key]).map(m=>({media_id:m.id,media_type:m.mediaType,media:m.title&&m.cover?m:null}));
  const hydrated=await hydrateCommunityMedia(works),metadata=new Map(hydrated.filter(m=>m.media).map(m=>[`${m.media_type}:${m.media_id}`,m.media]));
  for(const key of groups)overview[key]=overview[key].map(m=>{const found=metadata.get(`${m.mediaType}:${m.id}`);return found?{...m,title:found.title,cover:found.cover}:m}).filter(m=>m.title&&m.cover);
  overview.activeMembers=withActorAvatars(overview.activeMembers);
  overview.newMembers=withActorAvatars(overview.newMembers);
  return overview;
});
const currentSeason=()=>{const now=new Date(),month=Number(new Intl.DateTimeFormat('en',{timeZone:'America/Sao_Paulo',month:'numeric'}).format(now)),year=Number(new Intl.DateTimeFormat('en',{timeZone:'America/Sao_Paulo',year:'numeric'}).format(now));return{season:month<=3?'WINTER':month<=6?'SPRING':month<=9?'SUMMER':'FALL',year}};
const PROFILE_MEDIA_PATH=/^\/media\/profile\/([0-9a-f-]{36})\/(avatar|banner)-([a-f0-9]{16})\.webp$/;
const publicProfileMedia=value=>{const raw=String(value||'').trim();if(/^https:\/\//i.test(raw))return raw.slice(0,2000);const pathOnly=raw.split('?')[0];return PROFILE_MEDIA_PATH.test(pathOnly)?`${PUBLIC_ORIGIN}${raw}`:null};
const safeUser=u=>{if(!u)return null;const avatar=resolvedAvatar(u);return{id:u.id,email:u.email,username:u.username,displayName:u.display_name||u.username,role:u.role,status:u.status||'active',avatarUrl:avatar.url,avatarPreset:avatar.preset,avatarSource:u.avatar_source||'clerk',bannerUrl:publicProfileMedia(u.profile_banner_url),instagramHandle:u.instagram_handle||null,telegramHandle:u.telegram_handle||null,showLibrary:u.show_library!==false,showActivity:u.show_activity!==false,showStats:u.show_stats!==false,theme:u.theme,privacy:u.privacy==='followers'?'semi_public':u.privacy||'public',emailVerified:u.email_verified,createdAt:u.created_at}};
const safeInt=(v,min=1,max=Number.MAX_SAFE_INTEGER)=>{const n=Number(v);return Number.isSafeInteger(n)&&n>=min&&n<=max?n:null};
const safePath=v=>{const s=String(v||'').slice(0,500);return s.startsWith('/')&&!s.startsWith('//')?s:null};
const strongPassword=z.string().min(10).max(128).refine(v=>/[A-Za-zÀ-ÿ]/.test(v)&&/\d/.test(v),{message:'WEAK_PASSWORD'});
const usernameSchema=z.string().trim().min(3).max(30).regex(/^[\p{L}\p{N}_.-]+$/u).refine(value=>!/^(?:admin(?:istrator)?|moderador|moderator|suporte|support|aninexus|equipe|staff|sistema|system)$/i.test(value),{message:'RESERVED_USERNAME'}).refine(value=>!usernameModerationReason(value),{message:'OFFENSIVE_USERNAME'});
const nullableText=(max,min=0)=>z.union([z.string().trim().min(min).max(max),z.literal(''),z.null()]).transform(value=>value||null);
const nullableHttpsUrl=z.union([z.string().trim().url().max(2000).refine(value=>value.startsWith('https://')),z.literal(''),z.null()]).transform(value=>value||null);
const characterFavoriteSchema=z.object({name:z.string().trim().min(1).max(180).optional(),nativeName:z.string().trim().max(180).optional(),image:nullableHttpsUrl.optional(),work:z.string().trim().max(240).optional(),mediaId:z.number().int().positive().optional(),mediaType:z.enum(['ANIME','MANGA']).optional()}).strict();
const nullableHandle=max=>z.preprocess(value=>typeof value==='string'?value.trim().replace(/^@+/, ''):value,z.union([z.string().regex(/^[A-Za-z0-9_.]+$/).max(max),z.literal(''),z.null()])).transform(value=>value||null);
const profileMediaStoredPath=(value,userId)=>{try{const pathname=new URL(String(value||''),PUBLIC_ORIGIN).pathname,match=pathname.match(PROFILE_MEDIA_PATH);return match&&match[1]===String(userId)?path.join(PROFILE_MEDIA_DIR,match[1],`${match[2]}-${match[3]}.webp`):null}catch{return null}};
const removeStoredProfileMedia=async(value,userId)=>{const file=profileMediaStoredPath(value,userId);if(file)await fs.unlink(file).catch(error=>{if(error?.code!=='ENOENT')throw error})};
const processProfileMedia=async(buffer,kind,userId)=>{
  const limits=kind==='avatar'?{input:3_000_000,width:512,height:512,quality:84}:{input:6_000_000,width:1800,height:500,quality:82};
  if(!Buffer.isBuffer(buffer)||buffer.length<128||buffer.length>limits.input)throw Object.assign(new Error('INVALID_IMAGE'),{code:'INVALID_IMAGE'});
  try{
    const image=sharp(buffer,{limitInputPixels:40_000_000,failOn:'warning',sequentialRead:true}),metadata=await image.metadata();
    if(!['jpeg','png','webp'].includes(String(metadata.format))||Number(metadata.pages||1)!==1||!metadata.width||!metadata.height)throw new Error('unsupported image');
    const output=await image.rotate().resize(limits.width,limits.height,{fit:'cover',position:'attention',withoutEnlargement:false}).webp({quality:limits.quality,effort:4,smartSubsample:true}).toBuffer();
    if(output.length>1_500_000)throw new Error('processed image too large');
    const hash=crypto.createHash('sha256').update(output).digest('hex').slice(0,16),directory=path.join(PROFILE_MEDIA_DIR,String(userId)),filename=`${kind}-${hash}.webp`,target=path.join(directory,filename);
    await fs.mkdir(directory,{recursive:true});
    await fs.writeFile(target,output,{flag:'wx'}).catch(error=>{if(error?.code!=='EEXIST')throw error});
    return{storedUrl:`/media/profile/${userId}/${filename}`,width:limits.width,height:limits.height,bytes:output.length};
  }catch(error){if(error?.code==='INVALID_IMAGE')throw error;throw Object.assign(new Error('INVALID_IMAGE'),{code:'INVALID_IMAGE',cause:error})}
};
const DUMMY_PASSWORD_HASH=CLERK_ENABLED?'':await hashPassword('aninexus-invalid-password-sentinel-do-not-use-8401');
const mediaProjection=`CASE WHEN mc.media_id IS NULL THEN NULL ELSE jsonb_build_object(
  'id',mc.media_id,'title',mc.payload->>'title','cover',mc.payload->>'cover','banner',mc.payload->>'banner',
  'score',mc.payload->'score','episodes',mc.payload->'episodes','status',mc.payload->>'status','format',mc.payload->>'format',
  'seasonYear',mc.payload->'seasonYear','genres',COALESCE(mc.payload->'genres','[]'::jsonb),'slug',mc.payload->>'slug'
) END`;
const persistImportedMedia=async(runQuery,entries)=>{
  const rows=entries.map(entry=>{
    const mediaType=entry.mediaType==='MANGA'?'MANGA':'ANIME',media={...(entry.media||{}),id:entry.mediaId,idMal:entry.idMal||entry.media?.idMal||null,mediaType,title:entry.title||entry.media?.title||''};
    const payload=Object.fromEntries(Object.entries(media).filter(([,value])=>value!==''&&value!==null&&value!==undefined));
    const slug=`${slugify(payload.title||mediaType.toLowerCase())}-${entry.mediaId}`;payload.slug=slug;
    return{media_type:mediaType,media_id:entry.mediaId,slug,payload};
  }).filter(row=>row.payload.title);
  for(let index=0;index<rows.length;index+=500){const chunk=rows.slice(index,index+500);await runQuery(`INSERT INTO media_cache(media_type,media_id,slug,payload,updated_at) SELECT media_type,media_id,slug,payload,now() FROM jsonb_to_recordset($1::jsonb) AS x(media_type text,media_id bigint,slug text,payload jsonb) ON CONFLICT(media_type,media_id) DO UPDATE SET slug=COALESCE(NULLIF(EXCLUDED.slug,''),media_cache.slug),payload=media_cache.payload || EXCLUDED.payload,updated_at=now()`,[JSON.stringify(chunk)])}
};
const withActorAvatars=rows=>rows.map(row=>row?.username||row?.display_name?{...row,avatar_url:resolvedAvatar(row).url}:row);
const withSocialBodies=(rows,hideSpoilers=true)=>withActorAvatars(rows).map(row=>socialBodyPayload(row,{hideSpoilers}));
const mediaHasTitle=media=>Boolean(String(media?.title||'').trim());
const usableMediaSummary=media=>Boolean(String(media?.title||'').trim()&&String(media?.cover||'').trim());
const resolveMediaSummaryBatches=async(ids,type)=>{
  const chunks=[];for(let index=0;index<ids.length;index+=60)chunks.push(ids.slice(index,index+60));
  const resolved=new Map();
  for(let index=0;index<chunks.length;index+=4){
    const batch=await Promise.all(chunks.slice(index,index+4).map(chunk=>getMediaSummaries(chunk,type)));
    for(const media of batch.flat())resolved.set(Number(media.id),media);
  }
  return resolved;
};
const repairAniListTransferMedia=async(userId,type,ids)=>{
  if(!userId||!ids.length)return{items:new Map(),source:null};
  const transfer=await q(`SELECT source_username FROM list_transfers WHERE user_id=$1 AND direction='IMPORT' AND service='ANILIST' AND status='COMPLETED' AND source_username IS NOT NULL AND media_type IN ('ALL',$2) ORDER BY completed_at DESC NULLS LAST,created_at DESC LIMIT 1`,[userId,type]).catch(()=>({rows:[]}));
  const username=String(transfer.rows?.[0]?.source_username||'');if(!username)return{items:new Map(),source:null};
  try{
    const wanted=new Set(ids),imported=await fetchAniListEntries({username,types:[type],timeoutMs:Number(process.env.UPSTREAM_TIMEOUT_MS||9000)}),source=imported.source||'GRAPHQL',entries=imported.filter(entry=>wanted.has(entry.mediaId));
    if(entries.length)await persistImportedMedia(q,entries);
    return{source,items:new Map(entries.map(entry=>[entry.mediaId,{...(entry.media||{}),id:entry.mediaId,mediaType:type,title:entry.title||entry.media?.title||''}]).filter(([,media])=>mediaHasTitle(media)))};
  }catch(error){app.log.warn({err:error,userId,mediaType:type},'AniList transfer metadata repair failed');return{items:new Map(),source:null}}
};
const hydrateCommunityMedia=async(rows,defaultType='ANIME',ownerId=null)=>{
  const normalized=withActorAvatars(rows),missingByType=new Map(),existingByType=new Map();
  for(const row of normalized){if(!row?.media_id||usableMediaSummary(row.media))continue;const type=String(row.media_type||defaultType).toUpperCase()==='MANGA'?'MANGA':'ANIME',ids=missingByType.get(type)||new Set(),existing=existingByType.get(type)||new Map();ids.add(Number(row.media_id));existing.set(Number(row.media_id),row.media||null);missingByType.set(type,ids);existingByType.set(type,existing)}
  if(!missingByType.size)return normalized;
  try{
    const resolvedByType=new Map();
    await Promise.all([...missingByType].map(async([type,ids])=>{
      const requested=[...ids].filter(Number.isSafeInteger),resolved=new Map(),repaired=await repairAniListTransferMedia(ownerId,type,requested),existing=existingByType.get(type)||new Map();
      for(const [id,media] of repaired.items)resolved.set(id,{...(existing.get(id)||{}),...media});
      const unresolved=requested.filter(id=>{const media=resolved.get(id)||existing.get(id);return repaired.source==='PUBLIC_PAGE'?!mediaHasTitle(media):!usableMediaSummary(media)});
      if(unresolved.length){const providerMedia=await resolveMediaSummaryBatches(unresolved,type);for(const [id,media] of providerMedia)resolved.set(id,{...(existing.get(id)||{}),...(resolved.get(id)||{}),...media})}
      resolvedByType.set(type,resolved);
    }));
    return normalized.map(row=>{if(usableMediaSummary(row.media))return row;const type=String(row.media_type||defaultType).toUpperCase()==='MANGA'?'MANGA':'ANIME',resolved=resolvedByType.get(type)?.get(Number(row.media_id));return resolved?{...row,media:{...(row.media||{}),...resolved}}:row});
  }catch(error){app.log.warn({err:error,mediaIds:[...missingByType.values()].flatMap(ids=>[...ids])},'community media hydration failed');return normalized}
};
const hydrateMediaCollections=async(collections,defaultType='ANIME',ownerId=null)=>{
  const sizes=collections.map(rows=>rows.length),hydrated=await hydrateCommunityMedia(collections.flat(),defaultType,ownerId),result=[];let offset=0;
  for(const size of sizes){result.push(hydrated.slice(offset,offset+size));offset+=size}
  return result;
};
const transaction=async fn=>{const client=await pool.connect();try{await client.query('BEGIN');const result=await fn(client);await client.query('COMMIT');return result}catch(error){await client.query('ROLLBACK').catch(()=>{});throw error}finally{client.release()}};
const MODERATED_CONTENT_TARGETS=Object.freeze({IMPRESSION:'impressions',IMPRESSION_REPLY:'impression_replies',ANIME_COMMENT:'media_comments',THREAD:'community_threads',POST:'community_posts',NEWS_COMMENT:'news_comments'});
const updateModeratedContent=async(client,type,id,hidden)=>{const table=MODERATED_CONTENT_TARGETS[type];if(!table||!z.string().uuid().safeParse(id).success)return null;const {rows}=await client.query(`UPDATE ${table} SET hidden=$2 WHERE id=$1 RETURNING user_id`,[id,hidden]);return rows[0]||null};
const roleNotification=role=>role==='moderator'?{title:'Você agora é moderador',body:'Sua conta recebeu acesso às ferramentas de moderação do AniNexus.',url:'/admin'}:role==='admin'?{title:'Você agora é administrador',body:'Sua conta recebeu acesso completo à administração do AniNexus.',url:'/admin'}:{title:'Sua função foi atualizada',body:'Seu acesso às ferramentas de moderação foi encerrado.',url:'/minha-conta'};
const refreshAchievements=async(userId,source='ACTION')=>{try{return await syncUserAchievements(userId,{source,notify:true})}catch(error){app.log.warn({err:error,userId},'achievement sync failed');return null}};
const recordContributionAchievement=async(userId,type,row,body)=>{if(String(body||'').trim().length<20)return null;try{await recordContributionHistory(userId,type,row?.id,body,row?.created_at);return await refreshAchievements(userId)}catch(error){app.log.warn({err:error,userId,type,contentId:row?.id},'achievement contribution failed');return null}};

app.get('/health',async()=>({ok:true,uptime:Math.round(process.uptime()),time:new Date().toISOString()}));
app.get('/health/ready',async(req,reply)=>{const [db,cache]=await Promise.all([dbReady(),cacheReady()]);const ok=db&&cache;return reply.code(ok?200:503).send({ok,db,cache});});
app.get('/media/profile/:userId/:file',publicRate,async(req,reply)=>{
  const userId=z.string().uuid().safeParse(req.params.userId),file=String(req.params.file||'');
  if(!userId.success||!/^(?:avatar|banner)-[a-f0-9]{16}\.webp$/.test(file))return reply.code(404).send({error:'NOT_FOUND'});
  try{
    const content=await fs.readFile(path.join(PROFILE_MEDIA_DIR,userId.data,file));
    return reply.type('image/webp').header('Cache-Control','public, max-age=31536000, immutable').send(content);
  }catch(error){if(error?.code==='ENOENT')return reply.code(404).send({error:'NOT_FOUND'});throw error}
});
app.get('/api/me',privateReadRate,async(req,reply)=>{let user=await requireUser(req,reply);if(!user)return;if(CLERK_ENABLED&&user.clerk_user_id&&user.avatar_source==='clerk'){const fingerprint=crypto.createHash('sha256').update(String(user.avatar_url||'')).digest('hex').slice(0,12);try{user=await cacheRemember(`auth:profile-avatar-v44:${user.clerk_user_id}:${fingerprint}`,900,async()=>syncClerkUser(await getClerkClient().users.getUser(user.clerk_user_id)))}catch(error){req.log.warn({err:error,userId:user.id},'clerk avatar refresh failed')}}return{user:safeUser(user)}});
app.get('/api/member/telegram',privateReadRate,async(req,reply)=>{const user=await requireUser(req,reply);if(!user)return;reply.header('Cache-Control','no-store');return{url:'https://t.me/BaltigoWorld',label:'BaltigoWorld no Telegram'};});
app.get('/api/me/username-availability',privateReadRate,async(req,reply)=>{
  const user=await requireUser(req,reply);if(!user)return;
  const candidate=String(req.query?.username||'').trim(),parsed=usernameSchema.safeParse(candidate);
  if(!parsed.success){const reason=usernameModerationReason(candidate)||parsed.error?.issues?.[0]?.message||'INVALID_USERNAME';return{available:false,reason}}
  const {rows}=await q(`SELECT 1 FROM users WHERE username=$1 AND id<>$2 AND deleted_at IS NULL UNION ALL SELECT 1 FROM user_profile_aliases WHERE alias=$1 AND user_id<>$2 LIMIT 1`,[parsed.data,user.id]);
  return{available:!rows[0],reason:rows[0]?'USERNAME_UNAVAILABLE':null};
});
app.patch('/api/me/profile',writeRate,async(req,reply)=>{
  const user=await requireUser(req,reply);if(!user)return;
  const parsed=z.object({
    username:usernameSchema,
    displayName:z.string().trim().min(1).max(80),
    avatarMode:z.enum(['keep','preset','custom','clerk']).optional(),
    avatarPreset:z.enum(AVATAR_PRESETS).optional(),
    avatarUrl:nullableHttpsUrl.optional(),
    bannerUrl:nullableHttpsUrl.optional(),
    bio:nullableText(500).optional(),
    location:nullableText(80).optional(),
    websiteUrl:nullableHttpsUrl.optional(),
    instagramHandle:nullableHandle(30).optional(),
    telegramHandle:nullableHandle(32).optional(),
    privacy:z.enum(['public','semi_public','followers','private']).transform(value=>value==='followers'?'semi_public':value),
    showLibrary:z.boolean().optional(),showActivity:z.boolean().optional(),showStats:z.boolean().optional(),
  }).strict().safeParse(req.body);
  if(!parsed.success){const offensive=parsed.error?.issues?.some(issue=>issue.message==='OFFENSIVE_USERNAME');return reply.code(422).send({error:offensive?'OFFENSIVE_USERNAME':'INVALID_INPUT'})}
  const data=parsed.data;
  let avatarUrl=user.avatar_url,avatarSource=user.avatar_source||'clerk';
  if(data.avatarMode==='preset'){
    if(!data.avatarPreset)return reply.code(422).send({error:'INVALID_AVATAR_PRESET'});
    avatarUrl=avatarPresetUrl(data.avatarPreset);avatarSource='custom';
  }else if(data.avatarMode==='custom'||(!data.avatarMode&&data.avatarUrl)){
    if(!data.avatarUrl)return reply.code(422).send({error:'INVALID_AVATAR_URL'});
    avatarUrl=data.avatarUrl;avatarSource='custom';
  }else if(data.avatarMode==='clerk'){
    if(!CLERK_ENABLED||!user.clerk_user_id)return reply.code(409).send({error:'PERSONAL_AVATAR_UNAVAILABLE'});
    const clerkAvatar=avatarForClerkUser(await getClerkClient().users.getUser(user.clerk_user_id));
    if(!clerkAvatar.personal)return reply.code(409).send({error:'PERSONAL_AVATAR_MISSING'});
    avatarUrl=clerkAvatar.url;avatarSource='clerk';
  }
  let updated;
  try{
    updated=await transaction(async client=>{
      const current=(await client.query('SELECT username FROM users WHERE id=$1 AND deleted_at IS NULL FOR UPDATE',[user.id])).rows[0];
      if(!current)throw Object.assign(new Error('NOT_FOUND'),{statusCode:404});
      const usernameChanged=String(current.username).toLocaleLowerCase('pt-BR')!==String(data.username).toLocaleLowerCase('pt-BR');
      if(usernameChanged){
        const conflict=await client.query(`SELECT 1 FROM users WHERE username=$1 AND id<>$2 AND deleted_at IS NULL UNION ALL SELECT 1 FROM user_profile_aliases WHERE alias=$1 AND user_id<>$2 LIMIT 1`,[data.username,user.id]);
        if(conflict.rows[0])throw Object.assign(new Error('USERNAME_UNAVAILABLE'),{code:'USERNAME_UNAVAILABLE'});
        await client.query('DELETE FROM user_profile_aliases WHERE alias=$1 AND user_id=$2',[data.username,user.id]);
        await client.query('INSERT INTO user_profile_aliases(alias,user_id) VALUES($1,$2) ON CONFLICT(alias) DO NOTHING',[current.username,user.id]);
      }
      const publiclyVisible=data.privacy!=='private';
      const result=await client.query(`UPDATE users SET username=$2,display_name=$3,avatar_url=$4,avatar_source=$5,profile_banner_url=$6,bio=$7,location=$8,website_url=$9,instagram_handle=$10,telegram_handle=$11,privacy=$12,show_library=$13,show_activity=$14,show_stats=$15,username_changed_at=CASE WHEN $16 THEN now() ELSE username_changed_at END,updated_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING *`,[user.id,data.username,data.displayName,avatarUrl,avatarSource,data.bannerUrl===undefined?user.profile_banner_url:data.bannerUrl,data.bio===undefined?user.bio:data.bio,data.location===undefined?user.location:data.location,data.websiteUrl===undefined?user.website_url:data.websiteUrl,data.instagramHandle===undefined?user.instagram_handle:data.instagramHandle,data.telegramHandle===undefined?user.telegram_handle:data.telegramHandle,data.privacy,publiclyVisible,publiclyVisible,publiclyVisible,usernameChanged]);
      return result.rows[0];
    });
  }catch(error){if(error?.code==='USERNAME_UNAVAILABLE'||error?.code==='23505')return reply.code(409).send({error:'USERNAME_UNAVAILABLE'});throw error}
  await invalidateUserIdentityCache(updated).catch(()=>{});
  await refreshAchievements(user.id);
  return{user:safeUser(updated)};
});
app.put('/api/me/profile-media/:kind',{...rateForUser(8,'10 minutes','profile-media'),bodyLimit:6_100_000},async(req,reply)=>{
  const user=await requireUser(req,reply);if(!user)return;
  const kind=z.enum(['avatar','banner']).safeParse(req.params.kind);if(!kind.success)return reply.code(404).send({error:'NOT_FOUND'});
  const contentType=String(req.headers['content-type']||'').split(';')[0].toLowerCase();if(!['image/jpeg','image/png','image/webp'].includes(contentType))return reply.code(415).send({error:'UNSUPPORTED_IMAGE'});
  let media;try{media=await processProfileMedia(req.body,kind.data,user.id)}catch(error){if(error?.code==='INVALID_IMAGE')return reply.code(422).send({error:'INVALID_IMAGE'});throw error}
  const previous=kind.data==='avatar'?user.avatar_url:user.profile_banner_url,column=kind.data==='avatar'?'avatar_url':'profile_banner_url';
  const {rows}=await q(`UPDATE users SET ${column}=$2${kind.data==='avatar'?',avatar_source=\'custom\'':''},updated_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING *`,[user.id,media.storedUrl]);
  await removeStoredProfileMedia(previous,user.id).catch(error=>req.log.warn({err:error,userId:user.id},'old profile media cleanup failed'));
  await invalidateUserIdentityCache(rows[0]).catch(()=>{});
  return{user:safeUser(rows[0]),media:{kind:kind.data,url:kind.data==='avatar'?resolvedAvatar(rows[0]).url:publicProfileMedia(media.storedUrl),width:media.width,height:media.height,bytes:media.bytes}};
});
app.delete('/api/me/profile-media/:kind',writeRate,async(req,reply)=>{
  const user=await requireUser(req,reply);if(!user)return;
  const kind=z.enum(['avatar','banner']).safeParse(req.params.kind);if(!kind.success)return reply.code(404).send({error:'NOT_FOUND'});
  const previous=kind.data==='avatar'?user.avatar_url:user.profile_banner_url,preset=avatarPresetUrl(avatarForClerkUser({id:user.id,username:user.username}).preset);
  const {rows}=kind.data==='avatar'?await q("UPDATE users SET avatar_url=$2,avatar_source='custom',updated_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING *",[user.id,preset]):await q('UPDATE users SET profile_banner_url=NULL,updated_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING *',[user.id]);
  await removeStoredProfileMedia(previous,user.id).catch(error=>req.log.warn({err:error,userId:user.id},'profile media cleanup failed'));
  await invalidateUserIdentityCache(rows[0]).catch(()=>{});
  return{user:safeUser(rows[0])};
});
app.get('/api/users/search',publicRate,async(req,reply)=>{
  const parsed=z.string().trim().min(1).max(40).safeParse(String(req.query?.q||'').replace(/^@+/,''));
  if(!parsed.success)return reply.code(400).send({error:'INVALID_QUERY'});
  const term=parsed.data,escaped=term.replace(/[!%_]/g,'!$&'),contains=`%${escaped}%`,prefix=`${escaped}%`;
  const {rows}=await q(`SELECT username,display_name,avatar_url,avatar_source
    FROM users
    WHERE deleted_at IS NULL AND status='active' AND privacy IN ('public','semi_public')
      AND (username ILIKE $1 ESCAPE '!' OR display_name ILIKE $1 ESCAPE '!')
    ORDER BY CASE WHEN lower(username)=lower($2) THEN 0 WHEN username ILIKE $3 ESCAPE '!' THEN 1 ELSE 2 END,lower(username)
    LIMIT 12`,[contains,term,prefix]);
  return{items:rows.map(user=>{const avatar=resolvedAvatar(user);return{username:user.username,displayName:user.display_name||user.username,avatarUrl:avatar.url,avatarPreset:avatar.preset}})};
});
app.get('/api/users/:username',publicRate,async(req,reply)=>{
  const parsed=usernameSchema.safeParse(String(req.params.username||''));if(!parsed.success)return reply.code(404).send({error:'NOT_FOUND'});
  const requested=parsed.data;
  let result=await q('SELECT * FROM users WHERE username=$1 AND deleted_at IS NULL AND status=\'active\'',[requested]);
  let aliased=false;
  if(!result.rows[0]){result=await q(`SELECT u.* FROM user_profile_aliases a JOIN users u ON u.id=a.user_id WHERE a.alias=$1 AND u.deleted_at IS NULL AND u.status='active'`,[requested]);aliased=!!result.rows[0]}
  const user=result.rows[0];if(!user)return reply.code(404).send({error:'NOT_FOUND'});
  const isPrivate=user.privacy==='private';
  const avatar=resolvedAvatar(user),profile={username:user.username,displayName:user.display_name||user.username,avatarUrl:avatar.url,avatarPreset:avatar.preset,bannerUrl:isPrivate?null:publicProfileMedia(user.profile_banner_url),instagramHandle:isPrivate?null:user.instagram_handle,telegramHandle:isPrivate?null:user.telegram_handle,role:user.role,privacy:user.privacy==='followers'?'semi_public':user.privacy,isPrivate,showLibrary:user.show_library!==false,showActivity:user.show_activity!==false,showStats:user.show_stats!==false,createdAt:user.created_at};
  if(isPrivate)return{profile,canonicalUsername:user.username,aliased,stats:null,library:[],mangaLibrary:[],favoriteCharacters:[],activity:[],impressions:[],achievements:[]};
  const [statsResult,libraryResult,mangaResult,characterFavorites,activityResult,impressionsResult,achievementResult]=await Promise.all([
    user.show_stats===false?Promise.resolve({rows:[]}):q(`SELECT count(*)::int list_total,count(*) FILTER(WHERE status='CURRENT')::int watching,count(*) FILTER(WHERE status='COMPLETED')::int completed,count(*) FILTER(WHERE status='PLANNING')::int planning,COALESCE(sum(progress),0)::int episodes_watched,round(avg(score)::numeric,1) average_score,(SELECT count(*)::int FROM user_favorites WHERE user_id=$1) favorites FROM user_anime WHERE user_id=$1`,[user.id]),
    user.show_library===false?Promise.resolve({rows:[]}):q(`SELECT ua.media_id,ua.status,ua.score,ua.reaction,ua.reactions,ua.volume_progress,ua.progress,ua.updated_at,${mediaProjection} AS media FROM user_anime ua LEFT JOIN media_cache mc ON mc.media_id=ua.media_id AND mc.media_type='ANIME' WHERE ua.user_id=$1 ORDER BY ua.updated_at DESC LIMIT 36`,[user.id]),
    user.show_library===false?Promise.resolve({rows:[]}):q(`SELECT um.media_id,um.status,um.score,um.reaction,um.reactions,um.volume_progress,um.progress,um.updated_at,${mediaProjection} AS media FROM user_manga um LEFT JOIN media_cache mc ON mc.media_id=um.media_id AND mc.media_type='MANGA' WHERE um.user_id=$1 ORDER BY um.updated_at DESC LIMIT 36`,[user.id]),
    user.show_library===false?Promise.resolve([]):getUserCharacterFavorites(user.id),
    user.show_activity===false?Promise.resolve({rows:[]}):q(`SELECT ua.media_id,ua.status,ua.score,ua.reaction,ua.reactions,ua.volume_progress,ua.progress,ua.updated_at AS created_at,${mediaProjection} AS media FROM user_anime ua LEFT JOIN media_cache mc ON mc.media_id=ua.media_id AND mc.media_type='ANIME' WHERE ua.user_id=$1 ORDER BY ua.updated_at DESC LIMIT 12`,[user.id]),
    user.show_activity===false?Promise.resolve({rows:[]}):q(`SELECT i.id,i.media_id,i.media_type,i.body,i.spoiler,i.has_spoilers,i.status_snapshot,i.progress_snapshot,i.score_snapshot,i.impression_stage,i.created_at,i.edited_at,${mediaProjection} AS media FROM impressions i LEFT JOIN media_cache mc ON mc.media_id=i.media_id AND mc.media_type=i.media_type WHERE i.user_id=$1 AND i.hidden=false ORDER BY i.created_at DESC LIMIT 12`,[user.id]),
    publicAchievementProfile(user.id).catch(()=>({achievements:[],pinnedAchievements:[],equippedTitle:null,rank:{name:'Nível Nexus 1',xp:0,nextXp:30}})),
  ]);
  const [library,mangaLibrary,activity,impressions]=await Promise.all([hydrateCommunityMedia(libraryResult.rows,'ANIME',user.id),hydrateCommunityMedia(mangaResult.rows,'MANGA',user.id),hydrateCommunityMedia(activityResult.rows,'ANIME',user.id),hydrateCommunityMedia(impressionsResult.rows,'ANIME',user.id)]);
  const stats=statsResult.rows[0]||null;
  return{profile:{...profile,equippedTitle:achievementResult.equippedTitle},canonicalUsername:user.username,aliased,stats,rank:achievementResult.rank,achievements:achievementResult.achievements,pinnedAchievements:achievementResult.pinnedAchievements,library,mangaLibrary,favoriteCharacters:hydrateCharacterFavorites(characterFavorites),activity,impressions:withSocialBodies(impressions)};
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

const getHomePayload=async(query={})=>{
  const fallback=currentSeason(),season=['WINTER','SPRING','SUMMER','FALL'].includes(String(query?.season||''))?String(query.season):fallback.season,year=safeInt(query?.year,1960,2100)||fallback.year;
  const now=Math.floor(Date.now()/1000),bucket=Math.floor(now/300),end=now+7*86400;
  return cacheRemember(`home:v5:${season}:${year}:${bucket}`,60,async()=>{
    const [seasonData,schedule,top,popular,reading,topReading,soon]=await Promise.all([
      getCatalog({page:1,perPage:22,season,year,sort:'POPULAR'}).catch(()=>({items:[]})),getSchedule(now,end).catch(()=>[]),getCatalog({page:1,perPage:10,sort:'SCORE'}).catch(()=>({items:[]})),getCatalog({page:1,perPage:22,sort:'POPULAR'}).catch(()=>({items:[]})),getReading({page:1,perPage:18,sort:'POPULAR'}).catch(()=>({items:[]})),getReading({page:1,perPage:10,format:'MANGA',sort:'SCORE'}).catch(()=>({items:[]})),getCatalog({page:1,perPage:22,status:'NOT_YET_RELEASED',sort:'POPULAR'}).catch(()=>({items:[]}))
    ]);
    return{season:seasonData.items||[],schedule:(schedule||[]).slice(0,8),top:top.items||[],popular:popular.items||[],reading:reading.items||[],topReading:topReading.items||[],soon:soon.items||[]};
  },{staleTtl:1800});
};
const miniappEnvelope=data=>({ok:true,apiVersion:'1',source:'aninexus',generatedAt:new Date().toISOString(),data});
const miniappPublicRate={config:{rateLimit:{max:180,timeWindow:'1 minute',groupId:'miniapp-public'}}};

app.get('/api/catalog',{...publicRate,config:{rateLimit:{max:100,timeWindow:'1 minute'}}},async req=>getCatalog(req.query||{}));
app.get('/api/home',publicRate,async req=>getHomePayload(req.query||{}));
app.get('/api/reading',{...publicRate,config:{rateLimit:{max:100,timeWindow:'1 minute'}}},async req=>getReading(req.query||{}));
app.get('/api/characters/ranking',publicRate,async()=>getCharacterRanking(10));
app.get('/api/achievements/catalog',publicRate,async()=>{const items=achievementCatalog();return{total:items.length,items}});
app.get('/api/achievements/feed',publicRate,async req=>({items:await getAchievementFeed(req.query?.limit)}));
app.get('/api/me/achievements',privateHeavyRate,async(req,reply)=>{const user=await requireUser(req,reply);if(!user)return;return syncUserAchievements(user.id,{source:'RETROACTIVE',notify:true})});
app.put('/api/me/achievements/pins',writeRate,async(req,reply)=>{const user=await requireUser(req,reply);if(!user)return;const parsed=z.object({ids:z.array(z.string().trim().min(3).max(80)).max(3)}).strict().safeParse(req.body);if(!parsed.success)return reply.code(422).send({error:'INVALID_PINS'});try{await setAchievementPins(user.id,parsed.data.ids);return syncUserAchievements(user.id,{source:'ACTION',notify:false})}catch(error){if(['INVALID_PINS','ACHIEVEMENT_LOCKED'].includes(error?.code))return reply.code(422).send({error:error.code});throw error}});
app.patch('/api/me/achievements/preferences',writeRate,async(req,reply)=>{const user=await requireUser(req,reply);if(!user)return;const parsed=z.object({shareFeed:z.boolean().optional(),timezone:z.string().trim().min(3).max(80).optional(),equippedTitle:z.string().trim().min(1).max(80).nullable().optional()}).strict().refine(value=>Object.keys(value).length>0).safeParse(req.body);if(!parsed.success)return reply.code(422).send({error:'INVALID_INPUT'});try{await updateAchievementPreferences(user.id,parsed.data);return syncUserAchievements(user.id,{source:'ACTION',notify:false})}catch(error){if(['TITLE_LOCKED','INVALID_TIMEZONE'].includes(error?.code))return reply.code(422).send({error:error.code});throw error}});

app.get('/api/miniapp/v1/health',miniappPublicRate,async()=>miniappEnvelope({status:'ready',uptime:Math.round(process.uptime())}));
app.get('/api/miniapp/v1/home',miniappPublicRate,async req=>miniappEnvelope(await getHomePayload(req.query||{})));
app.get('/api/miniapp/v1/catalog',miniappPublicRate,async req=>miniappEnvelope(await getCatalog(req.query||{})));
app.get('/api/miniapp/v1/reading',miniappPublicRate,async req=>miniappEnvelope(await getReading(req.query||{})));
app.get('/api/miniapp/v1/anime/:id',miniappPublicRate,async(req,reply)=>{const id=safeInt(req.params.id);if(!id)return reply.code(400).send({ok:false,apiVersion:'1',error:'INVALID_ID'});return miniappEnvelope(await getAnime(id));});
app.get('/api/schedule',{config:{rateLimit:{max:100,timeWindow:'1 minute'}}},async(req,reply)=>{const now=Math.floor(Date.now()/1000),start=Number(req.query?.start||now-86400),end=Number(req.query?.end||now+7*86400);if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>10*86400)return reply.code(400).send({error:'INVALID_RANGE'});return getSchedule(start,end);});
app.get('/api/anime/:id',{config:{rateLimit:{max:120,timeWindow:'1 minute'}}},async(req,reply)=>{const id=safeInt(req.params.id);if(!id)return reply.code(400).send({error:'INVALID_ID'});return getAnime(id);});
async function mediaActivitySummary(id,mediaType){
  const table=mediaType==='MANGA'?'user_manga':'user_anime';
  const visible=`u.deleted_at IS NULL AND u.status='active' AND u.privacy='public' AND u.show_library IS DISTINCT FROM false AND u.show_stats IS DISTINCT FROM false`;
  const [statusResult,reactionResult]=await Promise.all([
    q(`SELECT l.status,count(*)::int count FROM ${table} l JOIN users u ON u.id=l.user_id WHERE l.media_id=$1 AND ${visible} AND l.status IN ('PLANNING','CURRENT','COMPLETED','PAUSED','DROPPED') GROUP BY l.status`,[id]),
    q(`SELECT r.reaction,count(*)::int count FROM ${table} l JOIN users u ON u.id=l.user_id CROSS JOIN LATERAL (SELECT DISTINCT value reaction FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(l.reactions)='array' AND jsonb_array_length(l.reactions)>0 THEN l.reactions WHEN l.reaction IS NOT NULL THEN jsonb_build_array(l.reaction) ELSE '[]'::jsonb END)) r WHERE l.media_id=$1 AND ${visible} AND r.reaction IN ('LOVE','LIKE','WOW','DISLIKE') GROUP BY r.reaction ORDER BY count DESC,r.reaction`,[id])
  ]);
  const statuses={PLANNING:0,CURRENT:0,COMPLETED:0,PAUSED:0,DROPPED:0};
  for(const row of statusResult.rows||[])if(Object.hasOwn(statuses,row.status))statuses[row.status]=Number(row.count)||0;
  const reactionLabels={LOVE:'Amei',LIKE:'Curtindo',WOW:'De arrepiar',DISLIKE:'Esperava mais'},reactionTotal=(reactionResult.rows||[]).reduce((sum,row)=>sum+(Number(row.count)||0),0);
  return{mediaId:id,mediaType,total:Object.values(statuses).reduce((sum,count)=>sum+count,0),statuses,reactionTotal,reactions:(reactionResult.rows||[]).map(row=>({key:row.reaction,label:reactionLabels[row.reaction]||row.reaction,count:Number(row.count)||0,percentage:reactionTotal?Math.round(Number(row.count)*100/reactionTotal):0}))};
}
app.get('/api/anime/:id/activity',publicRate,async(req,reply)=>{const id=safeInt(req.params.id);if(!id)return reply.code(400).send({error:'INVALID_ID'});return mediaActivitySummary(id,'ANIME');});
app.get('/api/anime/:id/rating',publicRate,async(req,reply)=>{const id=safeInt(req.params.id);if(!id)return reply.code(400).send({error:'INVALID_ID'});const {rows}=await q(`SELECT round(avg(score)::numeric,1) score,count(score)::int votes FROM user_anime WHERE media_id=$1 AND score IS NOT NULL`,[id]);return{score:rows[0]?.score==null?null:Number(rows[0].score),votes:Number(rows[0]?.votes||0)};});
app.get('/api/manga/:id/rating',publicRate,async(req,reply)=>{const id=safeInt(req.params.id);if(!id)return reply.code(400).send({error:'INVALID_ID'});const {rows}=await q(`SELECT round(avg(score)::numeric,1) score,count(score)::int votes FROM user_manga WHERE media_id=$1 AND score IS NOT NULL`,[id]);return{score:rows[0]?.score==null?null:Number(rows[0].score),votes:Number(rows[0]?.votes||0)};});
app.get('/api/anime/:id/themes',{config:{rateLimit:{max:120,timeWindow:'1 minute'}}},async(req,reply)=>{const id=safeInt(req.params.id);if(!id)return reply.code(400).send({error:'INVALID_ID'});return getAnimeThemes(id);});
app.get('/api/media/summaries',{config:{rateLimit:{max:120,timeWindow:'1 minute'}}},async(req,reply)=>{const raw=String(req.query?.ids||'').split(',').slice(0,60),ids=raw.map(value=>safeInt(value)).filter(Boolean),mediaType=String(req.query?.mediaType||'ANIME').toUpperCase()==='MANGA'?'MANGA':'ANIME';if(!ids.length)return reply.code(400).send({error:'INVALID_IDS'});return{items:await getMediaSummaries(ids,mediaType)}});
app.get('/api/manga/:id',{config:{rateLimit:{max:120,timeWindow:'1 minute'}}},async(req,reply)=>{const id=safeInt(req.params.id);if(!id)return reply.code(400).send({error:'INVALID_ID'});return getManga(id);});
app.get('/api/manga/:id/activity',publicRate,async(req,reply)=>{const id=safeInt(req.params.id);if(!id)return reply.code(400).send({error:'INVALID_ID'});return mediaActivitySummary(id,'MANGA');});
app.get('/api/synopsis/:type/:id',{config:{rateLimit:{max:90,timeWindow:'1 minute'}}},async(req,reply)=>{
  const id=safeInt(req.params.id),type=String(req.params.type||'').toLowerCase();
  if(!id||!['anime','manga'].includes(type))return reply.code(400).send({error:'INVALID_MEDIA'});
  const media=type==='manga'?await getManga(id):await getAnime(id),source=cleanSynopsisText(media?.description||'');
  if(!source)return{text:'',language:'pt-BR',translated:false};
  const text=await getPortugueseSynopsis(source).catch(()=> '');
  return{text:cleanSynopsisText(text),language:'pt-BR',translated:!!text};
});
app.get('/api/studios',publicRate,async req=>getStudios(Number(req.query?.page||1)));
app.get('/api/dublados',publicRate,async req=>getDubbed(Number(req.query?.page||1)));
app.get('/api/lists',publicRate,async()=>lists);
app.get('/api/list/:slug',publicRate,async(req,reply)=>{const l=lists.find(x=>x.slug===req.params.slug);if(!l)return reply.code(404).send({error:'NOT_FOUND'});const data=await getCatalog({page:req.query?.page||1,perPage:24,sort:l.sort,genre:l.genre,format:l.format,status:l.status,season:l.season,year:l.year});return {...l,...data};});

app.get('/api/trailers',publicRate,async req=>{const limit=safeInt(req.query?.limit,1,12)||9;return cacheRemember(`trailers:v1:${limit}`,120,async()=>{const articles=await getNativeTrailerArticles({limit:48});const items=buildLatestTrailers(articles,{limit,maxAgeDays:21});return{generatedAt:new Date().toISOString(),freshnessWindowDays:21,total:items.length,items}})});
app.get('/api/news',publicRate,async(req)=>{const limit=Math.max(1,Math.min(60,Number(req.query?.limit||20))),offset=Math.max(0,Math.min(5000,Number(req.query?.offset||0)));const type=req.query?.type?String(req.query.type).slice(0,40):null;return{items:await getNativeNews({limit,offset,type})};});
app.get('/api/news/:slug',publicRate,async(req,reply)=>{const slug=String(req.params.slug||'').slice(0,180);const item=await getNativeArticle(slug);if(!item)return reply.code(404).send({error:'NOT_FOUND'});return item;});
app.post('/api/news/comments/:id/report',rateForUser(8,'10 minutes','news-comments-report'),async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const id=z.string().uuid().safeParse(req.params.id),parsed=z.object({reason:z.string().trim().min(3).max(1000)}).safeParse(req.body);if(!id.success||!parsed.success)return reply.code(422).send({error:'INVALID_INPUT'});await q(`INSERT INTO content_reports(reporter_id,target_type,target_id,reason) VALUES($1,'NEWS_COMMENT',$2,$3)`,[u.id,id.data,parsed.data.reason]);return reply.code(201).send({ok:true});});
const articleSchema=z.object({title:z.string().trim().min(3).max(220),summary:z.string().trim().min(10).max(1200),body:z.string().max(30000).nullable().optional(),eventType:z.enum(['SEASON','TRAILER','EPISODE','MANGA','TRENDING','OTHER']).nullable().optional(),spoiler:z.boolean().optional(),mediaIds:z.array(z.number().int().positive()).max(30).optional(),imageUrl:z.string().url().max(2000).nullable().optional(),imageAlt:z.string().max(240).nullable().optional(),facts:z.array(z.string().max(500)).max(32).optional(),status:z.enum(['draft','review','scheduled','published','archived']).optional(),scheduledAt:z.string().datetime().nullable().optional(),expiresAt:z.string().datetime().nullable().optional()});
app.post('/api/admin/news',writeRate,async(req,reply)=>{const u=await requireRole(req,reply,['moderator','admin']);if(!u)return;const p=articleSchema.safeParse(req.body);if(!p.success)return reply.code(400).send({error:'INVALID_INPUT'});const d=p.data,slug=`${d.title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,100)}-${Date.now().toString(36)}`;const published=d.status==='published'?new Date():null,expires=d.expiresAt?new Date(d.expiresAt):articleExpiry(published||new Date());const {rows}=await q(`INSERT INTO news_articles(slug,source_kind,event_type,title,summary,body,spoiler,status,media_ids,created_by,scheduled_at,published_at,image_url,image_alt,source_name,language,facts,expires_at) VALUES($1,'EDITORIAL',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'AniNexus','pt-BR',$14,$15) RETURNING id,slug,status`,[slug,d.eventType||null,d.title,d.summary,d.body||null,d.spoiler||false,d.status||'draft',JSON.stringify(d.mediaIds||[]),u.id,d.scheduledAt||null,published,d.imageUrl||null,d.imageAlt||null,JSON.stringify(d.facts||[]),expires]);await q('INSERT INTO audit_log(actor_id,action,target_type,target_id) VALUES($1,$2,$3,$4)',[u.id,'NEWS_CREATE','NEWS',rows[0].id]);return reply.code(201).send(rows[0]);});
app.patch('/api/admin/news/:id',writeRate,async(req,reply)=>{const u=await requireRole(req,reply,['moderator','admin']);if(!u)return;const id=String(req.params.id);if(!/^[0-9a-f-]{36}$/i.test(id))return reply.code(400).send({error:'INVALID_ID'});const p=articleSchema.partial().safeParse(req.body);if(!p.success||!Object.keys(p.data).length)return reply.code(400).send({error:'INVALID_INPUT'});const d=p.data;const {rows}=await q(`UPDATE news_articles SET title=COALESCE($2,title),summary=COALESCE($3,summary),body=COALESCE($4,body),event_type=COALESCE($5,event_type),spoiler=COALESCE($6,spoiler),status=COALESCE($7,status),media_ids=COALESCE($8::jsonb,media_ids),scheduled_at=COALESCE($9::timestamptz,scheduled_at),image_url=COALESCE($10,image_url),image_alt=COALESCE($11,image_alt),facts=COALESCE($12::jsonb,facts),expires_at=COALESCE($13::timestamptz,expires_at),published_at=CASE WHEN $7='published' AND published_at IS NULL THEN now() ELSE published_at END,updated_at=now() WHERE id=$1 RETURNING id,slug,status`,[id,d.title??null,d.summary??null,d.body??null,d.eventType??null,d.spoiler??null,d.status??null,d.mediaIds?JSON.stringify(d.mediaIds):null,d.scheduledAt??null,d.imageUrl??null,d.imageAlt??null,d.facts?JSON.stringify(d.facts):null,d.expiresAt??null]);if(!rows[0])return reply.code(404).send({error:'NOT_FOUND'});await q('INSERT INTO audit_log(actor_id,action,target_type,target_id) VALUES($1,$2,$3,$4)',[u.id,'NEWS_UPDATE','NEWS',id]);return rows[0];});

app.get('/api/admin/overview',privateHeavyRate,async(req,reply)=>{
  const actor=await requireRole(req,reply,['moderator','admin']);if(!actor)return;
  const [users,reports,content]=await Promise.all([
    q(`SELECT count(*)::int total,count(*) FILTER(WHERE status='active')::int active,count(*) FILTER(WHERE status='suspended')::int suspended,count(*) FILTER(WHERE status='banned')::int banned,count(*) FILTER(WHERE created_at>=now()-interval '7 days')::int new_week,count(*) FILTER(WHERE role='moderator')::int moderators,count(*) FILTER(WHERE role='admin')::int admins FROM users WHERE deleted_at IS NULL`),
    q(`SELECT count(*)::int total,count(*) FILTER(WHERE status='open')::int open,count(*) FILTER(WHERE status='reviewing')::int reviewing,count(*) FILTER(WHERE status='resolved')::int resolved,count(*) FILTER(WHERE status='dismissed')::int dismissed,count(*) FILTER(WHERE created_at>=now()-interval '7 days')::int new_week FROM content_reports`),
    q(`SELECT (SELECT count(*) FROM impressions WHERE hidden=false)::int impressions,(SELECT count(*) FROM community_threads WHERE hidden=false)::int threads,(SELECT count(*) FROM community_posts WHERE hidden=false)::int posts,((SELECT count(*) FROM media_comments WHERE hidden=false)+(SELECT count(*) FROM news_comments WHERE hidden=false)+(SELECT count(*) FROM impression_replies WHERE hidden=false))::int comments`),
  ]);
  return{users:users.rows[0],reports:reports.rows[0],content:content.rows[0]};
});
app.get('/api/admin/v2/users',privateHeavyRate,async(req,reply)=>{
  const actor=await requireRole(req,reply,['moderator','admin']);if(!actor)return;
  const search=String(req.query?.search||'').trim().slice(0,120);
  const status=['active','suspended','banned'].includes(String(req.query?.status||''))?String(req.query.status):null;
  const requestedRole=String(req.query?.role||'');
  const role=['user','moderator','admin'].includes(requestedRole)?requestedRole:requestedRole==='team'?'team':null;
  const limit=Math.max(1,Math.min(100,Number(req.query?.limit||40))),offset=Math.max(0,Math.min(10000,Number(req.query?.offset||0)));
  const pattern=search?`%${search.replace(/[%_]/g,'\\$&')}%`:null;
  const {rows}=await q(`SELECT u.id,CASE WHEN $3='admin' THEN u.email::text ELSE NULL END email,u.username,u.display_name,u.avatar_url,u.avatar_source,u.role,u.status,u.suspended_until,u.ban_reason,u.moderation_note,u.email_verified,u.created_at,u.last_seen_at,(SELECT count(*)::int FROM user_anime ua WHERE ua.user_id=u.id) list_count,(SELECT count(*)::int FROM impressions i WHERE i.user_id=u.id AND i.hidden=false) impression_count FROM users u WHERE u.deleted_at IS NULL AND ($1::text IS NULL OR u.email::text ILIKE $1 ESCAPE '\\' OR u.username::text ILIKE $1 ESCAPE '\\' OR COALESCE(u.display_name,'') ILIKE $1 ESCAPE '\\') AND ($2::text IS NULL OR u.status=$2) AND ($4::text IS NULL OR ($4='team' AND u.role IN ('moderator','admin')) OR u.role=$4) ORDER BY CASE u.role WHEN 'admin' THEN 0 WHEN 'moderator' THEN 1 ELSE 2 END,u.created_at DESC LIMIT $5 OFFSET $6`,[pattern,status,actor.role,role,limit,offset]);
  return{items:withActorAvatars(rows),hasMore:rows.length===limit};
});
app.patch('/api/admin/v2/users/:id/moderation',rateForUser(20,'1 minute','admin-moderation-v2'),async(req,reply)=>{
  const actor=await requireRole(req,reply,['moderator','admin']);if(!actor)return;
  const id=z.string().uuid().safeParse(req.params.id);if(!id.success)return reply.code(400).send({error:'INVALID_ID'});
  const parsed=z.object({status:z.enum(['active','suspended','banned']).optional(),suspendUntil:z.string().datetime().nullable().optional(),reason:z.string().trim().min(3).max(1000),role:z.enum(['user','moderator','admin']).optional(),note:z.string().trim().max(4000).nullable().optional()}).refine(value=>value.status||value.role||value.note!==undefined,{message:'NO_CHANGES'}).safeParse(req.body);
  if(!parsed.success)return reply.code(422).send({error:'INVALID_INPUT'});
  const d=parsed.data;if(id.data===actor.id&&(d.status&&d.status!=='active'||d.role&&d.role!==actor.role))return reply.code(409).send({error:'CANNOT_MODERATE_SELF'});
  const result=await transaction(async client=>{
    const target=(await client.query('SELECT * FROM users WHERE id=$1 AND deleted_at IS NULL FOR UPDATE',[id.data])).rows[0];
    if(!target)return null;
    if(actor.role!=='admin'&&(target.role!=='user'||d.role))return{forbidden:true};
    if(d.role==='admin'&&actor.role!=='admin')return{forbidden:true};
    const suspendUntil=d.status==='suspended'?new Date(d.suspendUntil||Date.now()+24*3600*1000):null;
    if(suspendUntil&&suspendUntil<=new Date())return{invalidSuspend:true};
    const roleChanged=Boolean(d.role&&d.role!==target.role);
    const updated=(await client.query(`UPDATE users SET status=COALESCE($2,status),suspended_until=CASE WHEN $2='suspended' THEN $3::timestamptz WHEN $2 IS NOT NULL THEN NULL ELSE suspended_until END,ban_reason=CASE WHEN $2 IN ('suspended','banned') THEN $4 WHEN $2='active' THEN NULL ELSE ban_reason END,role=COALESCE($5,role),moderation_note=CASE WHEN $6::text IS NULL THEN moderation_note ELSE $6 END,session_version=CASE WHEN $2 IS NOT NULL OR $5 IS NOT NULL THEN session_version+1 ELSE session_version END,updated_at=now() WHERE id=$1 RETURNING *`,[id.data,d.status||null,suspendUntil?.toISOString()||null,d.reason,d.role||null,d.note===undefined?null:d.note])).rows[0];
    if(roleChanged){const notice=roleNotification(updated.role);await client.query(`INSERT INTO notifications(user_id,kind,title,body,url) VALUES($1,'SYSTEM',$2,$3,$4)`,[updated.id,notice.title,notice.body,notice.url])}
    await client.query(`INSERT INTO audit_log(actor_id,action,target_type,target_id,metadata) VALUES($1,'USER_MODERATION','USER',$2,$3::jsonb)`,[actor.id,id.data,JSON.stringify({status:d.status||null,previousRole:target.role,role:d.role||null,reason:d.reason,suspendUntil:suspendUntil?.toISOString()||null,notificationSent:roleChanged})]);
    return{user:updated,roleChanged};
  });
  if(!result)return reply.code(404).send({error:'NOT_FOUND'});if(result.forbidden)return reply.code(403).send({error:'FORBIDDEN'});if(result.invalidSuspend)return reply.code(422).send({error:'INVALID_SUSPENSION'});
  await invalidateUserIdentityCache(result.user);
  return{user:safeUser(result.user),notificationSent:result.roleChanged};
});
app.get('/api/admin/v2/reports',privateHeavyRate,async(req,reply)=>{
  const actor=await requireRole(req,reply,['moderator','admin']);if(!actor)return;
  const rawStatus=String(req.query?.status||'active'),status=['active','open','reviewing','resolved','dismissed'].includes(rawStatus)?rawStatus:null;
  const rawType=String(req.query?.type||'').toUpperCase(),type=[...Object.keys(MODERATED_CONTENT_TARGETS),'USER'].includes(rawType)?rawType:null;
  const rawAssignment=String(req.query?.assignment||''),assignment=['mine','unassigned'].includes(rawAssignment)?rawAssignment:null;
  const limit=Math.max(1,Math.min(100,Number(req.query?.limit||50))),offset=Math.max(0,Math.min(10000,Number(req.query?.offset||0)));
  const {rows}=await q(`SELECT r.*,reporter.username reporter_username,reporter.display_name reporter_display_name,assignee.username assignee_username,assignee.display_name assignee_display_name,target_user.username target_username,target_user.display_name target_display_name,target_user.avatar_url target_avatar_url,COALESCE(i.body,ir.body,mc.body,CASE WHEN r.target_type='THREAD' THEN concat_ws(E'\\n',ct.title,ct.body) END,cp.body,nc.body) target_excerpt,CASE r.target_type WHEN 'IMPRESSION' THEN i.id IS NOT NULL WHEN 'IMPRESSION_REPLY' THEN ir.id IS NOT NULL WHEN 'ANIME_COMMENT' THEN mc.id IS NOT NULL WHEN 'THREAD' THEN ct.id IS NOT NULL WHEN 'POST' THEN cp.id IS NOT NULL WHEN 'NEWS_COMMENT' THEN nc.id IS NOT NULL WHEN 'USER' THEN reported_user.id IS NOT NULL ELSE false END target_exists,COALESCE(i.hidden,ir.hidden,mc.hidden,ct.hidden,cp.hidden,nc.hidden,false) target_hidden,nc.article_slug target_article_slug,na.title target_context_title FROM content_reports r LEFT JOIN users reporter ON reporter.id=r.reporter_id LEFT JOIN users assignee ON assignee.id=r.assigned_to LEFT JOIN impressions i ON r.target_type='IMPRESSION' AND i.id::text=r.target_id LEFT JOIN impression_replies ir ON r.target_type='IMPRESSION_REPLY' AND ir.id::text=r.target_id LEFT JOIN media_comments mc ON r.target_type='ANIME_COMMENT' AND mc.id::text=r.target_id LEFT JOIN community_threads ct ON r.target_type='THREAD' AND ct.id::text=r.target_id LEFT JOIN community_posts cp ON r.target_type='POST' AND cp.id::text=r.target_id LEFT JOIN news_comments nc ON r.target_type='NEWS_COMMENT' AND nc.id::text=r.target_id LEFT JOIN news_articles na ON na.slug=nc.article_slug LEFT JOIN users reported_user ON r.target_type='USER' AND reported_user.id::text=r.target_id LEFT JOIN users target_user ON target_user.id=COALESCE(i.user_id,ir.user_id,mc.user_id,ct.user_id,cp.user_id,nc.user_id,reported_user.id) WHERE ($1::text IS NULL OR ($1='active' AND r.status IN ('open','reviewing')) OR r.status=$1) AND ($2::text IS NULL OR r.target_type=$2) AND ($3::text IS NULL OR ($3='mine' AND r.assigned_to=$4) OR ($3='unassigned' AND r.assigned_to IS NULL)) ORDER BY CASE r.status WHEN 'open' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END,r.created_at DESC LIMIT $5 OFFSET $6`,[status,type,assignment,actor.id,limit,offset]);
  return{items:rows,hasMore:rows.length===limit};
});
app.patch('/api/admin/v2/reports/:id',writeRate,async(req,reply)=>{
  const actor=await requireRole(req,reply,['moderator','admin']);if(!actor)return;
  const id=z.string().uuid().safeParse(req.params.id),parsed=z.object({status:z.enum(['open','reviewing','resolved','dismissed']).optional(),resolution:nullableText(4000).optional(),assignedTo:z.string().uuid().nullable().optional()}).refine(value=>Object.keys(value).length>0).safeParse(req.body);
  if(!id.success||!parsed.success)return reply.code(400).send({error:'INVALID_INPUT'});
  const d=parsed.data;
  if(d.assignedTo){const assignee=(await q(`SELECT 1 FROM users WHERE id=$1 AND role IN ('moderator','admin') AND status='active' AND deleted_at IS NULL`,[d.assignedTo])).rows[0];if(!assignee)return reply.code(422).send({error:'INVALID_ASSIGNEE'})}
  const hasResolution=Object.hasOwn(d,'resolution'),hasAssignee=Object.hasOwn(d,'assignedTo');
  const {rows}=await q(`UPDATE content_reports SET status=COALESCE($2,status),resolution=CASE WHEN $3 THEN $4 ELSE resolution END,assigned_to=CASE WHEN $5 THEN $6::uuid ELSE assigned_to END,resolved_at=CASE WHEN $2 IN ('resolved','dismissed') THEN now() WHEN $2 IN ('open','reviewing') THEN NULL ELSE resolved_at END,updated_at=now() WHERE id=$1 RETURNING *`,[id.data,d.status??null,hasResolution,d.resolution??null,hasAssignee,d.assignedTo??null]);
  if(!rows[0])return reply.code(404).send({error:'NOT_FOUND'});
  await q('INSERT INTO audit_log(actor_id,action,target_type,target_id,metadata) VALUES($1,$2,$3,$4,$5)',[actor.id,'REPORT_UPDATE','REPORT',id.data,JSON.stringify(d)]);
  return{ok:true,report:rows[0]};
});
app.patch('/api/admin/v2/reports/:id/decision',writeRate,async(req,reply)=>{
  const actor=await requireRole(req,reply,['moderator','admin']);if(!actor)return;
  const id=z.string().uuid().safeParse(req.params.id),parsed=z.object({decision:z.enum(['hide','dismiss']),reason:z.string().trim().min(3).max(1000)}).safeParse(req.body);
  if(!id.success||!parsed.success)return reply.code(400).send({error:'INVALID_INPUT'});
  const result=await transaction(async client=>{
    const report=(await client.query('SELECT * FROM content_reports WHERE id=$1 FOR UPDATE',[id.data])).rows[0];if(!report)return null;
    let target=null;
    if(parsed.data.decision==='hide'){
      if(report.target_type==='USER')return{unsupported:true};
      target=await updateModeratedContent(client,report.target_type,report.target_id,true);
      if(!target)return{missing:true};
    }
    const status=parsed.data.decision==='hide'?'resolved':'dismissed';
    const updated=(await client.query('UPDATE content_reports SET status=$2,resolution=$3,assigned_to=$4,resolved_at=now(),updated_at=now() WHERE id=$1 RETURNING *',[id.data,status,parsed.data.reason,actor.id])).rows[0];
    await client.query('INSERT INTO audit_log(actor_id,action,target_type,target_id,metadata) VALUES($1,$2,$3,$4,$5)',[actor.id,parsed.data.decision==='hide'?'REPORT_CONTENT_HIDE':'REPORT_DISMISS','REPORT',id.data,JSON.stringify({reason:parsed.data.reason,targetType:report.target_type,targetId:report.target_id})]);
    return{report:updated,owner:target?.user_id||null,targetType:report.target_type,targetId:report.target_id};
  });
  if(!result)return reply.code(404).send({error:'NOT_FOUND'});if(result.unsupported)return reply.code(422).send({error:'UNSUPPORTED_TARGET'});if(result.missing)return reply.code(404).send({error:'TARGET_NOT_FOUND'});
  if(result.owner){await setContributionHistoryValidity(result.owner,result.targetType,result.targetId,false);await refreshAchievements(result.owner)}
  return{ok:true,report:result.report};
});
app.get('/api/admin/users',privateHeavyRate,async(req,reply)=>{const actor=await requireRole(req,reply,['moderator','admin']);if(!actor)return;const search=String(req.query?.search||'').trim().slice(0,120),status=['active','suspended','banned'].includes(String(req.query?.status||''))?String(req.query.status):null,limit=Math.max(1,Math.min(100,Number(req.query?.limit||40))),offset=Math.max(0,Math.min(10000,Number(req.query?.offset||0)));const pattern=search?`%${search.replace(/[%_]/g,'\\$&')}%`:null;const {rows}=await q(`SELECT u.id,u.email,u.username,u.display_name,u.avatar_url,u.role,u.status,u.suspended_until,u.ban_reason,u.moderation_note,u.email_verified,u.created_at,u.last_seen_at,(SELECT count(*)::int FROM user_anime ua WHERE ua.user_id=u.id) list_count,(SELECT count(*)::int FROM impressions i WHERE i.user_id=u.id AND i.hidden=false) impression_count FROM users u WHERE u.deleted_at IS NULL AND ($1::text IS NULL OR u.email::text ILIKE $1 ESCAPE '\\' OR u.username::text ILIKE $1 ESCAPE '\\' OR COALESCE(u.display_name,'') ILIKE $1 ESCAPE '\\') AND ($2::text IS NULL OR u.status=$2) ORDER BY u.created_at DESC LIMIT $3 OFFSET $4`,[pattern,status,limit,offset]);return{items:withActorAvatars(rows),hasMore:rows.length===limit}});
app.patch('/api/admin/users/:id/moderation',rateForUser(20,'1 minute','admin-moderation'),async(req,reply)=>{const actor=await requireRole(req,reply,['moderator','admin']);if(!actor)return;const id=z.string().uuid().safeParse(req.params.id);if(!id.success)return reply.code(400).send({error:'INVALID_ID'});const parsed=z.object({status:z.enum(['active','suspended','banned']).optional(),suspendUntil:z.string().datetime().nullable().optional(),reason:z.string().trim().min(3).max(1000),role:z.enum(['user','moderator','admin']).optional(),note:z.string().trim().max(4000).nullable().optional()}).refine(value=>value.status||value.role||value.note!==undefined,{message:'NO_CHANGES'}).safeParse(req.body);if(!parsed.success)return reply.code(422).send({error:'INVALID_INPUT'});const d=parsed.data;if(id.data===actor.id&&(d.status&&d.status!=='active'||d.role&&d.role!==actor.role))return reply.code(409).send({error:'CANNOT_MODERATE_SELF'});const result=await transaction(async client=>{const targetResult=await client.query('SELECT * FROM users WHERE id=$1 AND deleted_at IS NULL FOR UPDATE',[id.data]),target=targetResult.rows[0];if(!target)return null;if(actor.role!=='admin'&&(target.role!=='user'||d.role))return{forbidden:true};if(d.role==='admin'&&actor.role!=='admin')return{forbidden:true};const suspendUntil=d.status==='suspended'?new Date(d.suspendUntil||Date.now()+24*3600*1000):null;if(suspendUntil&&suspendUntil<=new Date())return{invalidSuspend:true};const updated=await client.query(`UPDATE users SET status=COALESCE($2,status),suspended_until=CASE WHEN $2='suspended' THEN $3::timestamptz WHEN $2 IS NOT NULL THEN NULL ELSE suspended_until END,ban_reason=CASE WHEN $2 IN ('suspended','banned') THEN $4 WHEN $2='active' THEN NULL ELSE ban_reason END,role=COALESCE($5,role),moderation_note=CASE WHEN $6::text IS NULL THEN moderation_note ELSE $6 END,session_version=CASE WHEN $2 IS NOT NULL OR $5 IS NOT NULL THEN session_version+1 ELSE session_version END,updated_at=now() WHERE id=$1 RETURNING *`,[id.data,d.status||null,suspendUntil?.toISOString()||null,d.reason,d.role||null,d.note===undefined?null:d.note]);await client.query(`INSERT INTO audit_log(actor_id,action,target_type,target_id,metadata) VALUES($1,'USER_MODERATION','USER',$2,$3::jsonb)`,[actor.id,id.data,JSON.stringify({status:d.status||null,role:d.role||null,reason:d.reason,suspendUntil:suspendUntil?.toISOString()||null})]);return{user:updated.rows[0]}});if(!result)return reply.code(404).send({error:'NOT_FOUND'});if(result.forbidden)return reply.code(403).send({error:'FORBIDDEN'});if(result.invalidSuspend)return reply.code(422).send({error:'INVALID_SUSPENSION'});await invalidateUserIdentityCache(result.user);return{user:safeUser(result.user)}});
app.patch('/api/admin/users/:id',writeRate,async(req,reply)=>{const actor=await requireRole(req,reply,['moderator','admin']);if(!actor)return;const id=z.string().uuid().safeParse(req.params.id);if(!id.success)return reply.code(400).send({error:'INVALID_ID'});const p=z.object({role:z.enum(['user','moderator','admin']).optional(),status:z.enum(['active','suspended','banned']).optional(),suspendedUntil:z.string().datetime().nullable().optional(),banReason:nullableText(1000),moderationNote:nullableText(4000)}).safeParse(req.body);if(!p.success||!Object.keys(p.data).length)return reply.code(400).send({error:'INVALID_INPUT'});if(id.data===actor.id&&((p.data.status&&p.data.status!=='active')||(p.data.role&&p.data.role!=='admin')))return reply.code(400).send({error:'CANNOT_RESTRICT_SELF'});const {rows}=await q(`UPDATE users SET role=COALESCE($2,role),status=COALESCE($3,status),suspended_until=CASE WHEN $3='suspended' THEN $4::timestamptz WHEN $3 IS NOT NULL THEN NULL ELSE suspended_until END,ban_reason=CASE WHEN $3='banned' THEN $5 WHEN $3 IS NOT NULL THEN NULL ELSE COALESCE($5,ban_reason) END,moderation_note=COALESCE($6,moderation_note),session_version=CASE WHEN $3 IS NOT NULL OR $2 IS NOT NULL THEN session_version+1 ELSE session_version END,updated_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING id,email,username,display_name,role,status,suspended_until,ban_reason,moderation_note,session_version`,[id.data,p.data.role??null,p.data.status??null,p.data.suspendedUntil??null,p.data.banReason??null,p.data.moderationNote??null]);if(!rows[0])return reply.code(404).send({error:'NOT_FOUND'});await invalidateUserIdentityCache(id.data).catch(()=>{});await q('INSERT INTO audit_log(actor_id,action,target_type,target_id,metadata) VALUES($1,$2,$3,$4,$5)',[actor.id,'USER_MODERATION','USER',id.data,JSON.stringify({role:p.data.role,status:p.data.status})]);return{ok:true,user:rows[0]}});
app.delete('/api/admin/users/:id',writeRate,async(req,reply)=>{const actor=await requireRole(req,reply,['admin']);if(!actor)return;const id=z.string().uuid().safeParse(req.params.id);if(!id.success)return reply.code(400).send({error:'INVALID_ID'});if(id.data===actor.id)return reply.code(400).send({error:'CANNOT_DELETE_SELF'});const {rows}=await q(`UPDATE users SET deleted_at=now(),status='banned',session_version=session_version+1,updated_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING id,clerk_user_id`,[id.data]);if(!rows[0])return reply.code(404).send({error:'NOT_FOUND'});await invalidateUserIdentityCache(id.data).catch(()=>{});if(CLERK_ENABLED&&rows[0].clerk_user_id){try{await getClerkClient().users.deleteUser(rows[0].clerk_user_id)}catch(error){req.log.warn({err:error,userId:id.data},'admin clerk delete failed')}}await q('INSERT INTO audit_log(actor_id,action,target_type,target_id) VALUES($1,$2,$3,$4)',[actor.id,'USER_DELETE','USER',id.data]);return reply.code(204).send();});
app.get('/api/admin/reports',privateHeavyRate,async(req,reply)=>{const actor=await requireRole(req,reply,['moderator','admin']);if(!actor)return;const status=['open','reviewing','resolved','dismissed'].includes(String(req.query?.status||''))?String(req.query.status):null,limit=Math.max(1,Math.min(100,Number(req.query?.limit||50))),offset=Math.max(0,Math.min(10000,Number(req.query?.offset||0)));const {rows}=await q(`SELECT r.*,u.username reporter_username,u.display_name reporter_display_name,a.username assignee_username FROM content_reports r JOIN users u ON u.id=r.reporter_id LEFT JOIN users a ON a.id=r.assigned_to WHERE ($1::text IS NULL OR r.status=$1) ORDER BY CASE r.status WHEN 'open' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END,r.created_at DESC LIMIT $2 OFFSET $3`,[status,limit,offset]);return{items:rows,hasMore:rows.length===limit}});
app.patch('/api/admin/reports/:id',writeRate,async(req,reply)=>{const actor=await requireRole(req,reply,['moderator','admin']);if(!actor)return;const id=z.string().uuid().safeParse(req.params.id),p=z.object({status:z.enum(['open','reviewing','resolved','dismissed']).optional(),resolution:nullableText(4000),assignedTo:z.string().uuid().nullable().optional()}).safeParse(req.body);if(!id.success||!p.success)return reply.code(400).send({error:'INVALID_INPUT'});const {rows}=await q(`UPDATE content_reports SET status=COALESCE($2,status),resolution=COALESCE($3,resolution),assigned_to=COALESCE($4::uuid,assigned_to),resolved_at=CASE WHEN $2 IN ('resolved','dismissed') THEN now() ELSE resolved_at END,updated_at=now() WHERE id=$1 RETURNING *`,[id.data,p.data.status??null,p.data.resolution??null,p.data.assignedTo??null]);if(!rows[0])return reply.code(404).send({error:'NOT_FOUND'});await q('INSERT INTO audit_log(actor_id,action,target_type,target_id,metadata) VALUES($1,$2,$3,$4,$5)',[actor.id,'REPORT_UPDATE','REPORT',id.data,JSON.stringify(p.data)]);return{ok:true,report:rows[0]}});
app.patch('/api/admin/content/:type/:id',writeRate,async(req,reply)=>{const actor=await requireRole(req,reply,['moderator','admin']);if(!actor)return;const type=String(req.params.type||'').toUpperCase(),id=String(req.params.id);const p=z.object({hidden:z.boolean()}).safeParse(req.body);if(!p.success||!['IMPRESSION','IMPRESSION_REPLY','ANIME_COMMENT','THREAD','POST','NEWS_COMMENT'].includes(type))return reply.code(400).send({error:'INVALID_INPUT'});const map={IMPRESSION:['impressions','id'],IMPRESSION_REPLY:['impression_replies','id'],ANIME_COMMENT:['media_comments','id'],THREAD:['community_threads','id'],POST:['community_posts','id'],NEWS_COMMENT:['news_comments','id']},[table,column]=map[type];if(!/^[0-9a-f-]{36}$/i.test(id))return reply.code(400).send({error:'INVALID_ID'});const owner=(await q(`SELECT user_id FROM ${table} WHERE ${column}=$1`,[id])).rows[0]?.user_id;await q(`UPDATE ${table} SET hidden=$2 WHERE ${column}=$1`,[id,p.data.hidden]);await q('INSERT INTO audit_log(actor_id,action,target_type,target_id,metadata) VALUES($1,$2,$3,$4,$5)',[actor.id,p.data.hidden?'CONTENT_HIDE':'CONTENT_RESTORE',type,id,JSON.stringify({hidden:p.data.hidden})]);if(owner){await setContributionHistoryValidity(owner,type,id,!p.data.hidden);await refreshAchievements(owner)}return{ok:true}});
app.get('/api/admin/audit-log',privateHeavyRate,async(req,reply)=>{const actor=await requireRole(req,reply,['admin']);if(!actor)return;const limit=Math.max(1,Math.min(100,Number(req.query?.limit||50))),offset=Math.max(0,Math.min(10000,Number(req.query?.offset||0)));const {rows}=await q(`SELECT a.id,a.action,a.target_type,a.target_id,a.metadata,a.created_at,u.username actor_username,u.display_name actor_display_name FROM audit_log a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT $1 OFFSET $2`,[limit,offset]);return{items:rows,hasMore:rows.length===limit}});
app.get('/api/admin/analytics',privateHeavyRate,async(req,reply)=>{const actor=await requireRole(req,reply,['admin']);if(!actor)return;return analyticsStats()});

app.get('/api/me/list',privateReadRate,async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const {rows}=await q('SELECT media_id,status,score,reaction,reactions,progress,volume_progress,updated_at FROM user_anime WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 2000',[u.id]);return{items:rows};});
app.put('/api/me/list/:mediaId',writeRate,async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const parsed=mediaListEntry.safeParse(req.body);if(!parsed.success)return reply.code(400).send({error:'INVALID_INPUT'});const mediaId=safeInt(req.params.mediaId);if(!mediaId)return reply.code(400).send({error:'INVALID_ID'});const previous=(await q('SELECT status,score,progress FROM user_anime WHERE user_id=$1 AND media_id=$2',[u.id,mediaId])).rows[0]||null;const entry={status:parsed.data.status,score:parsed.data.score??null,reaction:parsed.data.reaction??null,progress:parsed.data.progress??0};await q(`INSERT INTO user_anime(user_id,media_id,status,score,reaction,progress,reactions,volume_progress,updated_at) VALUES($1,$2,$3,$4,$5,$6,COALESCE($7::jsonb,'[]'::jsonb),$8,now()) ON CONFLICT(user_id,media_id) DO UPDATE SET status=EXCLUDED.status,score=EXCLUDED.score,reaction=EXCLUDED.reaction,progress=EXCLUDED.progress,reactions=COALESCE($7::jsonb,user_anime.reactions),volume_progress=EXCLUDED.volume_progress,updated_at=now()`,[u.id,mediaId,entry.status,entry.score,entry.reaction,entry.progress,parsed.data.reactions?JSON.stringify(parsed.data.reactions):null,parsed.data.volumeProgress]);try{await recordAnimeHistory(u.id,mediaId,entry,previous);await refreshAchievements(u.id)}catch(error){req.log.warn({err:error,userId:u.id,mediaId},'anime achievement update failed')}return{ok:true};});
app.delete('/api/me/list/:mediaId',writeRate,async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const mediaId=safeInt(req.params.mediaId);if(!mediaId)return reply.code(400).send({error:'INVALID_ID'});await q('DELETE FROM user_anime WHERE user_id=$1 AND media_id=$2',[u.id,mediaId]);return{ok:true};});

app.get('/api/me/manga-list',privateReadRate,async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const {rows}=await q('SELECT media_id,status,score,reaction,reactions,progress,volume_progress,updated_at FROM user_manga WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 2000',[u.id]);return{items:rows};});
app.put('/api/me/manga-list/:mediaId',writeRate,async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const parsed=mediaListEntry.safeParse(req.body);if(!parsed.success)return reply.code(400).send({error:'INVALID_INPUT'});const mediaId=safeInt(req.params.mediaId);if(!mediaId)return reply.code(400).send({error:'INVALID_ID'});await q(`INSERT INTO user_manga(user_id,media_id,status,score,reaction,progress,reactions,volume_progress,updated_at) VALUES($1,$2,$3,$4,$5,$6,COALESCE($7::jsonb,'[]'::jsonb),$8,now()) ON CONFLICT(user_id,media_id) DO UPDATE SET status=EXCLUDED.status,score=EXCLUDED.score,reaction=EXCLUDED.reaction,progress=EXCLUDED.progress,reactions=COALESCE($7::jsonb,user_manga.reactions),volume_progress=EXCLUDED.volume_progress,updated_at=now()`,[u.id,mediaId,parsed.data.status,parsed.data.score??null,parsed.data.reaction??null,parsed.data.progress??0,parsed.data.reactions?JSON.stringify(parsed.data.reactions):null,parsed.data.volumeProgress]);return{ok:true};});
app.delete('/api/me/manga-list/:mediaId',writeRate,async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const mediaId=safeInt(req.params.mediaId);if(!mediaId)return reply.code(400).send({error:'INVALID_ID'});await q('DELETE FROM user_manga WHERE user_id=$1 AND media_id=$2',[u.id,mediaId]);return{ok:true};});

app.get('/api/me/favorites',privateReadRate,async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const {rows}=await q('SELECT media_id,media_type,created_at FROM user_favorites WHERE user_id=$1 ORDER BY created_at DESC LIMIT 5000',[u.id]);return{items:rows};});
app.put('/api/me/favorites/:mediaId',writeRate,async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const mediaId=safeInt(req.params.mediaId);if(!mediaId)return reply.code(400).send({error:'INVALID_ID'});const parsed=z.object({mediaType:z.enum(['ANIME','MANGA']).default('ANIME')}).safeParse(req.body||{});if(!parsed.success)return reply.code(400).send({error:'INVALID_INPUT'});await q('INSERT INTO user_favorites(user_id,media_id,media_type) VALUES($1,$2,$3) ON CONFLICT(user_id,media_id,media_type) DO NOTHING',[u.id,mediaId,parsed.data.mediaType]);return{ok:true,favorite:true};});
app.delete('/api/me/favorites/:mediaId',writeRate,async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const mediaId=safeInt(req.params.mediaId);if(!mediaId)return reply.code(400).send({error:'INVALID_ID'});const mediaType=String(req.query?.mediaType||'ANIME').toUpperCase()==='MANGA'?'MANGA':'ANIME';await q('DELETE FROM user_favorites WHERE user_id=$1 AND media_id=$2 AND media_type=$3',[u.id,mediaId,mediaType]);return{ok:true,favorite:false};});

app.get('/api/me/character-favorites',privateReadRate,async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;return{items:await getUserCharacterFavorites(u.id)};});
app.put('/api/me/character-favorites/:characterId',writeRate,async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const characterId=safeInt(req.params.characterId);if(!characterId)return reply.code(400).send({error:'INVALID_ID'});const parsed=characterFavoriteSchema.safeParse(req.body||{});if(!parsed.success)return reply.code(400).send({error:'INVALID_INPUT'});const result=await setCharacterFavorite(u.id,characterId,true,parsed.data);if(!result)return reply.code(404).send({error:'CHARACTER_NOT_FOUND'});return{ok:true,...result};});
app.delete('/api/me/character-favorites/:characterId',writeRate,async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const characterId=safeInt(req.params.characterId);if(!characterId)return reply.code(400).send({error:'INVALID_ID'});const result=await setCharacterFavorite(u.id,characterId,false);if(!result)return reply.code(404).send({error:'CHARACTER_NOT_FOUND'});return{ok:true,...result};});

app.get('/api/me/follows',privateReadRate,async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const {rows}=await q('SELECT media_id,media_type,notify_episode,notify_news,created_at FROM user_follows WHERE user_id=$1 ORDER BY created_at DESC LIMIT 2000',[u.id]);return{items:rows};});
app.put('/api/me/follows/:mediaId',writeRate,async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const mediaId=safeInt(req.params.mediaId);if(!mediaId)return reply.code(400).send({error:'INVALID_ID'});const parsed=z.object({mediaType:z.enum(['ANIME','MANGA']).default('ANIME'),notifyEpisode:z.boolean().default(true),notifyNews:z.boolean().default(true)}).safeParse(req.body||{});if(!parsed.success)return reply.code(400).send({error:'INVALID_INPUT'});const data=parsed.data;await q(`INSERT INTO user_follows(user_id,media_id,media_type,notify_episode,notify_news) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,media_id,media_type) DO UPDATE SET notify_episode=EXCLUDED.notify_episode,notify_news=EXCLUDED.notify_news`,[u.id,mediaId,data.mediaType,data.notifyEpisode,data.notifyNews]);return{ok:true};});
app.delete('/api/me/follows/:mediaId',writeRate,async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const mediaId=safeInt(req.params.mediaId);if(!mediaId)return reply.code(400).send({error:'INVALID_ID'});const mediaType=String(req.query?.mediaType||'ANIME').toUpperCase()==='MANGA'?'MANGA':'ANIME';await q('DELETE FROM user_follows WHERE user_id=$1 AND media_id=$2 AND media_type=$3',[u.id,mediaId,mediaType]);return{ok:true};});

app.get('/api/me/notifications',privateReadRate,async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const limit=safeInt(req.query?.limit,1,50)||20;const {rows}=await q('SELECT id,kind,title,body,media_id,url,url AS href,read_at,created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2',[u.id,limit]);return{items:rows};});
app.patch('/api/me/notifications/:id',writeRate,async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const id=z.string().uuid().safeParse(req.params.id);if(!id.success)return reply.code(400).send({error:'INVALID_ID'});await q('UPDATE notifications SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND user_id=$2',[id.data,u.id]);return reply.code(204).send();});
app.post('/api/me/notifications/:id/read',writeRate,async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const id=z.string().uuid().safeParse(req.params.id);if(!id.success)return reply.code(400).send({error:'INVALID_ID'});await q('UPDATE notifications SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND user_id=$2',[id.data,u.id]);return{ok:true};});

app.get('/api/me/library',privateHeavyRate,async(req,reply)=>{
  const user=await requireUser(req,reply);if(!user)return;
  const [list,favorites,impressions,count]=await Promise.all([
    q(`SELECT ua.media_id,ua.status,ua.score,ua.reaction,ua.reactions,ua.volume_progress,ua.progress,ua.updated_at,${mediaProjection} AS media FROM user_anime ua LEFT JOIN media_cache mc ON mc.media_id=ua.media_id AND mc.media_type='ANIME' WHERE ua.user_id=$1 ORDER BY ua.updated_at DESC LIMIT 2000`,[user.id]),
    q(`SELECT uf.media_id,uf.media_type,uf.created_at,${mediaProjection} AS media FROM user_favorites uf LEFT JOIN media_cache mc ON mc.media_id=uf.media_id AND mc.media_type=uf.media_type WHERE uf.user_id=$1 AND uf.media_type='ANIME' ORDER BY uf.created_at DESC LIMIT 5000`,[user.id]),
    q(`SELECT i.id,i.media_id,i.media_type,i.body,i.spoiler,i.has_spoilers,i.status_snapshot,i.progress_snapshot,i.score_snapshot,i.impression_stage,i.created_at,i.edited_at,u.username,u.display_name,u.avatar_url,${mediaProjection} AS media FROM impressions i JOIN users u ON u.id=i.user_id LEFT JOIN media_cache mc ON mc.media_id=i.media_id AND mc.media_type='ANIME' WHERE i.user_id=$1 AND i.media_type='ANIME' AND i.hidden=false ORDER BY i.created_at DESC LIMIT 200`,[user.id]),
    q("SELECT count(*)::int AS count FROM impressions WHERE user_id=$1 AND media_type='ANIME' AND hidden=false",[user.id]),
  ]);
  const [hydratedList,hydratedFavorites,hydratedImpressions]=await hydrateMediaCollections([list.rows,favorites.rows,impressions.rows],'ANIME',user.id);
  return{user:safeUser(user),list:hydratedList,favorites:hydratedFavorites,impressions:withSocialBodies(hydratedImpressions),impressionCount:Number(count.rows[0]?.count||0)};
});
app.get('/api/me/manga-library',privateHeavyRate,async(req,reply)=>{const user=await requireUser(req,reply);if(!user)return;const [list,favorites,impressions]=await Promise.all([q(`SELECT um.media_id,um.status,um.score,um.reaction,um.reactions,um.volume_progress,um.progress,um.updated_at,${mediaProjection} AS media FROM user_manga um LEFT JOIN media_cache mc ON mc.media_id=um.media_id AND mc.media_type='MANGA' WHERE um.user_id=$1 ORDER BY um.updated_at DESC LIMIT 2000`,[user.id]),q(`SELECT uf.media_id,uf.media_type,uf.created_at,${mediaProjection} AS media FROM user_favorites uf LEFT JOIN media_cache mc ON mc.media_id=uf.media_id AND mc.media_type=uf.media_type WHERE uf.user_id=$1 AND uf.media_type='MANGA' ORDER BY uf.created_at DESC LIMIT 5000`,[user.id]),q(`SELECT i.id,i.media_id,i.media_type,i.body,i.spoiler,i.has_spoilers,i.status_snapshot,i.progress_snapshot,i.score_snapshot,i.impression_stage,i.created_at,i.edited_at,u.username,u.display_name,u.avatar_url,${mediaProjection} AS media FROM impressions i JOIN users u ON u.id=i.user_id LEFT JOIN media_cache mc ON mc.media_id=i.media_id AND mc.media_type='MANGA' WHERE i.user_id=$1 AND i.media_type='MANGA' AND i.hidden=false ORDER BY i.created_at DESC LIMIT 200`,[user.id])]);const [hydratedList,hydratedFavorites,hydratedImpressions]=await hydrateMediaCollections([list.rows,favorites.rows,impressions.rows],'MANGA',user.id);return{user:safeUser(user),list:hydratedList,favorites:hydratedFavorites,impressions:withSocialBodies(hydratedImpressions)};});

app.get('/api/me/import-status',privateReadRate,async(req,reply)=>{const user=await requireUser(req,reply);if(!user)return;const {rows}=await q('SELECT imported_at,source_version,item_count FROM local_imports WHERE user_id=$1',[user.id]);return{imported:!!rows[0],import:rows[0]||null};});
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
    if(normalized.favorites.length)await client.query(`INSERT INTO user_favorites(user_id,media_id,media_type) SELECT $1,value::bigint,'ANIME' FROM jsonb_array_elements_text($2::jsonb) ON CONFLICT DO NOTHING`,[user.id,JSON.stringify(normalized.favorites)]);
    if(normalized.states.length)await client.query(`INSERT INTO user_anime(user_id,media_id,status,score,progress,updated_at) SELECT $1,x.media_id,x.status,x.score,x.progress,to_timestamp(x.updated_at/1000.0) FROM jsonb_to_recordset($2::jsonb) AS x(media_id bigint,status text,score numeric,progress integer,updated_at bigint) ON CONFLICT(user_id,media_id) DO UPDATE SET status=EXCLUDED.status,score=EXCLUDED.score,progress=EXCLUDED.progress,updated_at=EXCLUDED.updated_at WHERE EXCLUDED.updated_at>=user_anime.updated_at`,[user.id,JSON.stringify(normalized.states.map(item=>({media_id:item.mediaId,status:item.status,score:item.score??null,progress:item.progress,updated_at:item.updatedAt})))]);
    if(normalized.watched.length)await client.query(`INSERT INTO watched_episodes(user_id,media_id,episode,watched_at) SELECT $1,x.media_id,x.episode,to_timestamp(x.watched_at/1000.0) FROM jsonb_to_recordset($2::jsonb) AS x(media_id bigint,episode integer,watched_at bigint) ON CONFLICT(user_id,media_id,episode) DO UPDATE SET watched_at=GREATEST(watched_episodes.watched_at,EXCLUDED.watched_at)`,[user.id,JSON.stringify(normalized.watched.map(item=>({media_id:item.mediaId,episode:item.episode,watched_at:item.watchedAt||Date.now()})))]);
    const count=normalized.favorites.length+normalized.states.length+normalized.watched.length;
    await client.query('INSERT INTO local_imports(user_id,source_version,item_count,checksum) VALUES($1,$2,$3,$4)',[user.id,normalized.sourceVersion,count,checksum]);
    return{alreadyImported:false,itemCount:count};
  });
  if(!result.alreadyImported)await refreshAchievements(user.id,'RETROACTIVE');
  return reply.code(result.alreadyImported?409:200).send(result.alreadyImported?{error:'IMPORT_ALREADY_COMPLETED',import:result}:{ok:true,...result});
});

const transferSummary=row=>({id:row.id,direction:row.direction,service:row.service,mediaType:row.media_type,sourceUsername:row.source_username,strategy:row.strategy,status:row.status,itemCount:Number(row.item_count||0),skippedCount:Number(row.skipped_count||0),details:row.details||{},errorCode:row.error_code,createdAt:row.created_at,completedAt:row.completed_at});
const importAniListRows=async(client,userId,entries,strategy)=>{
  let changed=0;
  for(const mediaType of ['ANIME','MANGA']){
    const rows=entries.filter(entry=>entry.mediaType===mediaType);if(!rows.length)continue;
    const table=mediaType==='MANGA'?'user_manga':'user_anime',overwrite=strategy==='OVERWRITE';
    const conflict=overwrite?`DO UPDATE SET status=EXCLUDED.status,score=EXCLUDED.score,progress=EXCLUDED.progress,volume_progress=EXCLUDED.volume_progress,updated_at=EXCLUDED.updated_at`:'DO NOTHING';
    const payload=JSON.stringify(rows.map(entry=>({media_id:entry.mediaId,status:entry.status,score:entry.score,progress:entry.progress,volume_progress:entry.volumeProgress,updated_at:entry.updatedAt})));
    const result=await client.query(`INSERT INTO ${table}(user_id,media_id,status,score,progress,volume_progress,updated_at) SELECT $1,x.media_id,x.status,x.score,x.progress,x.volume_progress,to_timestamp(x.updated_at) FROM jsonb_to_recordset($2::jsonb) AS x(media_id bigint,status text,score numeric,progress integer,volume_progress integer,updated_at bigint) ON CONFLICT(user_id,media_id) ${conflict}`,[userId,payload]);
    changed+=result.rowCount;
  }
  return changed;
};
app.get('/api/me/list-transfers',privateReadRate,async(req,reply)=>{
  const user=await requireUser(req,reply);if(!user)return;
  const {rows}=await q('SELECT * FROM list_transfers WHERE user_id=$1 ORDER BY created_at DESC LIMIT 12',[user.id]);return{items:rows.map(transferSummary)};
});
app.post('/api/me/import-anilist',rateForUser(2,'10 minutes','anilist-import'),async(req,reply)=>{
  const user=await requireUser(req,reply);if(!user)return;
  const parsed=z.object({username:z.string().trim().min(2).max(30).regex(/^[A-Za-z0-9_-]+$/),types:z.array(z.enum(['ANIME','MANGA'])).min(1).max(2).transform(values=>[...new Set(values)]),strategy:z.enum(['KEEP','OVERWRITE'])}).strict().safeParse(req.body);
  if(!parsed.success)return reply.code(422).send({error:'INVALID_IMPORT'});
  const mediaType=parsed.data.types.length===2?'ALL':parsed.data.types[0],started=(await q(`INSERT INTO list_transfers(user_id,direction,service,media_type,source_username,strategy) VALUES($1,'IMPORT','ANILIST',$2,$3,$4) RETURNING id`,[user.id,mediaType,parsed.data.username,parsed.data.strategy])).rows[0];
  try{
    const entries=await fetchAniListEntries({username:parsed.data.username,types:parsed.data.types,timeoutMs:Number(process.env.UPSTREAM_TIMEOUT_MS||9000)});
    const result=await transaction(async client=>{
      const changed=await importAniListRows(client,user.id,entries,parsed.data.strategy),skipped=Math.max(0,entries.length-changed),counts={anime:entries.filter(entry=>entry.mediaType==='ANIME').length,manga:entries.filter(entry=>entry.mediaType==='MANGA').length};
      await persistImportedMedia((sql,params)=>client.query(sql,params),entries);
      const {rows}=await client.query(`UPDATE list_transfers SET status='COMPLETED',item_count=$2,skipped_count=$3,details=$4::jsonb,completed_at=now() WHERE id=$1 RETURNING *`,[started.id,changed,skipped,JSON.stringify({found:entries.length,...counts,source:entries.source||'GRAPHQL'})]);return rows[0];
    });
    await refreshAchievements(user.id,'RETROACTIVE');return{ok:true,transfer:transferSummary(result)};
  }catch(error){
    const code=['ANILIST_USER_NOT_FOUND','ANILIST_UNAVAILABLE'].includes(error?.code)?error.code:'IMPORT_FAILED';
    await q(`UPDATE list_transfers SET status='FAILED',error_code=$2,completed_at=now() WHERE id=$1`,[started.id,code]).catch(()=>{});
    return reply.code(code==='ANILIST_USER_NOT_FOUND'?404:502).send({error:code});
  }
});
const hydrateExportRows=async(rows,mediaType)=>{
  const entries=rows.map(row=>({mediaId:Number(row.media_id),mediaType,status:row.status,score:row.score==null?null:Number(row.score),progress:Number(row.progress||0),volumeProgress:Number(row.volume_progress||0),idMal:Number(row.id_mal)||null,title:String(row.title||'')}));
  const missing=entries.filter(entry=>!entry.idMal||!entry.title),byId=new Map();
  for(let index=0;index<missing.length;index+=240){const batch=missing.slice(index,index+240),chunks=[];for(let offset=0;offset<batch.length;offset+=60)chunks.push(batch.slice(offset,offset+60));const resolved=await Promise.all(chunks.map(chunk=>getMediaSummaries(chunk.map(entry=>entry.mediaId),mediaType)));for(const media of resolved.flat())byId.set(Number(media.id),media)}
  return entries.map(entry=>{const media=byId.get(entry.mediaId);return{...entry,idMal:entry.idMal||Number(media?.idMal)||null,title:entry.title||String(media?.title||'')}});
};
app.post('/api/me/export-list',privateHeavyRate,async(req,reply)=>{
  const user=await requireUser(req,reply);if(!user)return;
  const parsed=z.object({mediaType:z.enum(['ANIME','MANGA'])}).strict().safeParse(req.body);if(!parsed.success)return reply.code(422).send({error:'INVALID_EXPORT'});
  const mediaType=parsed.data.mediaType,table=mediaType==='MANGA'?'user_manga':'user_anime';
  const {rows}=await q(`SELECT l.media_id,l.status,l.score,l.progress,l.volume_progress,CASE WHEN (mc.payload->>'idMal')~'^[0-9]+$' THEN (mc.payload->>'idMal')::bigint END id_mal,mc.payload->>'title' title FROM ${table} l LEFT JOIN media_cache mc ON mc.media_type=$2 AND mc.media_id=l.media_id WHERE l.user_id=$1 ORDER BY l.media_id LIMIT 5000`,[user.id,mediaType]);
  const entries=await hydrateExportRows(rows,mediaType),built=buildAniListImportXml({username:user.username,mediaType,entries}),filename=`aninexus-${mediaType==='MANGA'?'mangas':'animes'}-${new Date().toISOString().slice(0,10)}.xml`;
  const {rows:transferRows}=await q(`INSERT INTO list_transfers(user_id,direction,service,media_type,status,item_count,skipped_count,details,completed_at) VALUES($1,'EXPORT','ANILIST',$2,'COMPLETED',$3,$4,$5::jsonb,now()) RETURNING *`,[user.id,mediaType,built.exported,built.skipped,JSON.stringify({format:'MAL_XML',filename})]);
  return{filename,mimeType:'application/xml;charset=utf-8',content:built.content,transfer:transferSummary(transferRows[0])};
});

app.get('/api/me/export',privateHeavyRate,async(req,reply)=>{
  const user=await requireUser(req,reply);if(!user)return;
  const [profile,preferences,list,mangaList,favorites,characterFavorites,watched,follows,impressions,newsComments,threads,posts]=await Promise.all([
    q('SELECT email,username,display_name,avatar_url,profile_banner_url,bio,location,website_url,instagram_handle,telegram_handle,avatar_source,theme,privacy,show_library,show_activity,show_stats,username_changed_at,email_verified,created_at,updated_at FROM users WHERE id=$1',[user.id]),q('SELECT * FROM user_preferences WHERE user_id=$1',[user.id]),q('SELECT media_id,status,score,reaction,reactions,progress,volume_progress,updated_at FROM user_anime WHERE user_id=$1 ORDER BY media_id',[user.id]),q('SELECT media_id,status,score,reaction,reactions,progress,volume_progress,updated_at FROM user_manga WHERE user_id=$1 ORDER BY media_id',[user.id]),q('SELECT media_id,media_type,created_at FROM user_favorites WHERE user_id=$1 ORDER BY media_type,media_id',[user.id]),q('SELECT character_id,created_at FROM character_favorites WHERE user_id=$1 ORDER BY character_id',[user.id]),q('SELECT media_id,episode,watched_at FROM watched_episodes WHERE user_id=$1 ORDER BY media_id,episode',[user.id]),q('SELECT media_id,media_type,notify_episode,notify_news,created_at FROM user_follows WHERE user_id=$1 ORDER BY media_type,media_id',[user.id]),q('SELECT media_id,media_type,body,spoiler,has_spoilers,status_snapshot,progress_snapshot,score_snapshot,impression_stage,created_at,updated_at,edited_at FROM impressions WHERE user_id=$1 ORDER BY created_at',[user.id]),q('SELECT article_slug,parent_id,body,spoiler,has_spoilers,created_at,updated_at,edited_at FROM news_comments WHERE user_id=$1 ORDER BY created_at',[user.id]),q('SELECT id,media_id,title,body,spoiler,created_at,updated_at FROM community_threads WHERE user_id=$1 ORDER BY created_at',[user.id]),q('SELECT thread_id,parent_id,body,spoiler,created_at,updated_at FROM community_posts WHERE user_id=$1 ORDER BY created_at',[user.id]),
  ]);
  const [achievementProfile,achievementAnimeHistory,achievementActivityDays,achievementContributionHistory,achievementUnlocks,achievementPins]=await Promise.all([
    q('SELECT share_feed,timezone,equipped_title,first_evaluated_at,last_evaluated_at,updated_at FROM achievement_profiles WHERE user_id=$1',[user.id]),
    q('SELECT media_id,ever_added,ever_completed,ever_rated,trusted_import,max_progress,first_seen_at,last_activity_at FROM achievement_anime_history WHERE user_id=$1 ORDER BY media_id',[user.id]),
    q('SELECT activity_date,source,created_at FROM achievement_activity_days WHERE user_id=$1 ORDER BY activity_date',[user.id]),
    q('SELECT contribution_type,contribution_id,counted,contributed_at,moderated_at FROM achievement_contribution_history WHERE user_id=$1 ORDER BY contributed_at',[user.id]),
    q('SELECT achievement_id,tier,xp,source,batch_id,unlocked_at FROM achievement_unlocks WHERE user_id=$1 ORDER BY unlocked_at',[user.id]),
    q('SELECT slot,achievement_id,pinned_at FROM achievement_pins WHERE user_id=$1 ORDER BY slot',[user.id]),
  ]);
  reply.header('Cache-Control','no-store').header('Content-Disposition',`attachment; filename="aninexus-${new Date().toISOString().slice(0,10)}.json"`);
  return{exportedAt:new Date().toISOString(),profile:profile.rows[0],preferences:preferences.rows[0]||null,list:list.rows,animeList:list.rows,mangaList:mangaList.rows,favorites:favorites.rows,characterFavorites:characterFavorites.rows,watchedEpisodes:watched.rows,follows:follows.rows,impressions:impressions.rows,newsComments:newsComments.rows,threads:threads.rows,posts:posts.rows,achievements:{profile:achievementProfile.rows[0]||null,animeHistory:achievementAnimeHistory.rows,activityDays:achievementActivityDays.rows,contributionHistory:achievementContributionHistory.rows,unlocks:achievementUnlocks.rows,pins:achievementPins.rows}};
});
app.delete('/api/me/account',rateForUser(2,'1 hour','account-delete'),async(req,reply)=>{
  const user=await requireUser(req,reply);if(!user)return;
  const parsed=z.object({confirmation:z.literal('EXCLUIR')}).safeParse(req.body);if(!parsed.success)return reply.code(422).send({error:'CONFIRMATION_REQUIRED'});
  if(!CLERK_ENABLED||!user.clerk_user_id)return reply.code(409).send({error:'CLERK_ACCOUNT_REQUIRED'});
  await beginAccountDeletion(user);
  try{await getClerkClient().users.deleteUser(user.clerk_user_id);await q('DELETE FROM users WHERE id=$1',[user.id])}catch(error){await cancelAccountDeletion(user).catch(()=>{});throw error}
  return reply.code(204).send();
});
app.post('/api/me/account/deletion',writeRate,async(req,reply)=>{const user=await requireUser(req,reply);if(!user)return;const parsed=z.object({password:z.string().max(128).optional()}).safeParse(req.body||{});if(!parsed.success)return reply.code(400).send({error:'INVALID_INPUT'});if(!CLERK_ENABLED){if(!parsed.data.password)return reply.code(400).send({error:'PASSWORD_REQUIRED'});const {rows}=await q('SELECT password_hash FROM users WHERE id=$1',[user.id]);if(!await verifyPassword(rows[0]?.password_hash||'',parsed.data.password))return reply.code(401).send({error:'INVALID_CREDENTIALS'})}await beginAccountDeletion(user);try{if(CLERK_ENABLED&&user.clerk_user_id)await getClerkClient().users.deleteUser(user.clerk_user_id);await q('DELETE FROM users WHERE id=$1',[user.id]);return reply.code(204).send()}catch(error){await cancelAccountDeletion(user).catch(()=>{});throw error}});

registerSocialRoutes(app,{q,currentUser,requireUser,rateForUser,publicRate,safeInt,withActorAvatars,hydrateCommunityMedia,mediaProjection,recordContributionAchievement,getNativeArticle});

app.get('/api/community/activity',publicRate,async(req)=>{
  const limit=Math.max(1,Math.min(60,Number(req.query?.limit||30))),includeManga=req.query?.includeManga==='1';
  const {rows}=await q(`WITH activity AS (
    SELECT user_id,media_id,'ANIME'::text media_type,status,score,reaction,reactions,volume_progress,progress,updated_at FROM user_anime
    UNION ALL
    SELECT user_id,media_id,'MANGA',status,score,reaction,reactions,volume_progress,progress,updated_at FROM user_manga WHERE $2::boolean
  ) SELECT ua.media_id,ua.media_type,ua.status,ua.score,COALESCE(ua.reactions->>0,ua.reaction) AS reaction,ua.reactions,
    ua.volume_progress,ua.progress,ua.updated_at AS created_at,u.username,u.display_name,u.avatar_url,${mediaProjection} AS media
    FROM activity ua JOIN users u ON u.id=ua.user_id
    LEFT JOIN media_cache mc ON mc.media_id=ua.media_id AND mc.media_type=ua.media_type
    WHERE u.deleted_at IS NULL AND u.status='active' AND u.privacy='public'
      AND u.show_activity IS DISTINCT FROM false AND u.show_library IS DISTINCT FROM false
      AND ua.status IN ('PLANNING','CURRENT','COMPLETED','PAUSED','DROPPED')
    ORDER BY ua.updated_at DESC,ua.media_type,ua.media_id LIMIT $1`,[limit,includeManga]);
  return{items:await hydrateCommunityMedia(rows)}
});
app.get('/api/community/threads',publicRate,async(req)=>{const limit=Math.max(1,Math.min(50,Number(req.query?.limit||30))),mediaId=req.query?.mediaId?safeInt(req.query.mediaId):null;const {rows}=await q(`SELECT t.id,t.media_id,t.media_type,t.category,t.title,t.body,t.spoiler,t.locked,t.created_at,u.username,u.display_name,u.avatar_url,(SELECT count(*)::int FROM community_posts p LEFT JOIN users pu ON pu.id=p.user_id WHERE p.thread_id=t.id AND p.hidden=false AND (p.user_id IS NULL OR (pu.deleted_at IS NULL AND pu.status='active' AND pu.privacy='public'))) replies FROM community_threads t LEFT JOIN users u ON u.id=t.user_id WHERE t.hidden=false AND (u.id IS NULL OR (u.deleted_at IS NULL AND u.status='active' AND u.privacy='public')) AND ($1::bigint IS NULL OR t.media_id=$1) ORDER BY t.created_at DESC LIMIT $2`,[mediaId,limit]);return{items:await hydrateCommunityMedia(rows)}});
app.get('/api/community/threads/:id',publicRate,async(req,reply)=>{const id=z.string().uuid().safeParse(req.params.id);if(!id.success)return reply.code(400).send({error:'INVALID_ID'});const [threadResult,postResult]=await Promise.all([q(`SELECT t.id,t.media_id,t.media_type,t.category,t.title,t.body,t.spoiler,t.locked,t.created_at,u.username,u.display_name,u.avatar_url FROM community_threads t LEFT JOIN users u ON u.id=t.user_id WHERE t.id=$1 AND t.hidden=false AND (u.id IS NULL OR (u.deleted_at IS NULL AND u.status='active' AND u.privacy='public'))`,[id.data]),q(`SELECT p.id,p.parent_id,p.root_id,p.depth,p.body,p.spoiler,p.created_at,u.username,u.display_name,u.avatar_url,(SELECT count(*)::int FROM likes l WHERE l.likeable_type='POST' AND l.likeable_id=p.id::text) likes_count FROM community_posts p LEFT JOIN users u ON u.id=p.user_id WHERE p.thread_id=$1 AND p.hidden=false AND (u.id IS NULL OR (u.deleted_at IS NULL AND u.status='active' AND u.privacy='public')) ORDER BY COALESCE((SELECT root_post.created_at FROM community_posts root_post WHERE root_post.id=COALESCE(p.root_id,p.id)),p.created_at) DESC,CASE WHEN p.depth=0 THEN 0 ELSE 1 END,p.created_at ASC LIMIT 500`,[id.data])]);if(!threadResult.rows[0])return reply.code(404).send({error:'NOT_FOUND'});const [thread]=await hydrateCommunityMedia([threadResult.rows[0]]);return{thread,posts:withActorAvatars(postResult.rows)}});
const createCommunityTopic=async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const p=z.object({mediaId:z.number().int().positive().nullable().optional(),mediaType:z.enum(['ANIME','MANGA']).optional(),category:z.string().trim().regex(/^[A-Za-z0-9_-]+$/).max(40).optional(),title:z.string().trim().min(3).max(180),body:z.string().trim().min(3).max(5000),spoiler:z.boolean().optional()}).safeParse(req.body);if(!p.success)return reply.code(400).send({error:'INVALID_INPUT'});const {rows}=await q('INSERT INTO community_threads(user_id,media_id,media_type,category,title,body,spoiler) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,created_at',[u.id,p.data.mediaId||null,p.data.mediaType||'ANIME',(p.data.category||'GERAL').toUpperCase(),p.data.title,p.data.body,p.data.spoiler||false]);await recordContributionAchievement(u.id,'THREAD',rows[0],p.data.body);return reply.code(201).send({ok:true,...rows[0]})};
const createCommunityPost=async(req,reply)=>{const u=await requireUser(req,reply);if(!u)return;const id=z.string().uuid().safeParse(req.params.id),p=z.object({parentId:z.string().uuid().nullable().optional(),body:z.string().trim().min(1).max(3000),spoiler:z.boolean().optional()}).safeParse(req.body);if(!id.success||!p.success)return reply.code(400).send({error:'INVALID_INPUT'});const {rows:threadRows}=await q('SELECT locked FROM community_threads WHERE id=$1 AND hidden=false',[id.data]);if(!threadRows[0])return reply.code(404).send({error:'NOT_FOUND'});if(threadRows[0].locked)return reply.code(423).send({error:'THREAD_LOCKED'});const parentId=p.data.parentId||null,{rows}=await q(`WITH new_id AS (SELECT gen_random_uuid() id),parent AS (SELECT id,root_id,depth FROM community_posts WHERE id=$3::uuid AND thread_id=$1 AND hidden=false) INSERT INTO community_posts(id,thread_id,user_id,parent_id,root_id,depth,body,spoiler) SELECT new_id.id,$1,$2,$3::uuid,CASE WHEN $3::uuid IS NULL THEN new_id.id ELSE COALESCE(parent.root_id,parent.id) END,CASE WHEN $3::uuid IS NULL THEN 0 ELSE parent.depth+1 END,$4,$5 FROM new_id LEFT JOIN parent ON true WHERE $3::uuid IS NULL OR parent.id IS NOT NULL RETURNING id,created_at,root_id,depth`,[id.data,u.id,parentId,p.data.body,p.data.spoiler||false]);if(!rows[0])return reply.code(422).send({error:'INVALID_PARENT'});await recordContributionAchievement(u.id,'POST',rows[0],p.data.body);return reply.code(201).send({ok:true,...rows[0]})};
app.post('/api/community/threads',rateForUser(4,'10 minutes','threads-write'),createCommunityTopic);
app.post('/api/community/topics',rateForUser(4,'10 minutes','topics-write'),createCommunityTopic);
app.post('/api/community/threads/:id/posts',rateForUser(10,'5 minutes','posts-write'),createCommunityPost);
app.post('/api/community/topics/:id/posts',rateForUser(10,'5 minutes','topic-posts-write'),createCommunityPost);

app.post('/api/events',{config:{rateLimit:{max:60,timeWindow:'1 minute'}}},async(req,reply)=>{const event=String(req.body?.event||'').slice(0,50),pagePath=String(req.body?.path||'').slice(0,200),mediaId=req.body?.mediaId?safeInt(req.body.mediaId):null;if(!/^(page_view|search|media_open|list_update|favorite|login|register)$/.test(event)||!safePath(pagePath))return reply.code(400).send({error:'INVALID_EVENT'});const user=await currentUser(req).catch(()=>null);enqueueAnalytics({event,userId:user?.id,sessionHash:crypto.createHash('sha256').update(`${req.cookies?.anx_session||''}:${process.env.SESSION_SECRET||''}`).digest('hex').slice(0,32),path:pagePath,mediaId,referrer:String(req.headers.referer||'').slice(0,500),userAgent:String(req.headers['user-agent']||'').slice(0,500),ipHash:crypto.createHash('sha256').update(`${req.ip}:${process.env.SESSION_SECRET||''}`).digest('hex').slice(0,32)});return reply.code(202).send({ok:true})});

app.get('/*',async(req,reply)=>{if(req.url.startsWith('/api/')||req.url.startsWith('/health'))return reply.code(404).send({error:'NOT_FOUND'});return reply.sendFile('index.html')});

let shuttingDown=false;
const shutdown=async signal=>{if(shuttingDown)return;shuttingDown=true;app.log.info({signal},'shutdown started');const force=setTimeout(()=>process.exit(1),15_000);force.unref();try{await app.close();await flushAnalytics();await Promise.allSettled([redis.quit(),pool.end()]);clearTimeout(force);process.exit(0)}catch(error){app.log.error({err:error},'shutdown failed');process.exit(1)}};
process.on('SIGTERM',()=>shutdown('SIGTERM'));process.on('SIGINT',()=>shutdown('SIGINT'));
process.on('unhandledRejection',reason=>{app.log.error({err:reason},'unhandled rejection')});
process.on('uncaughtException',error=>{app.log.fatal({err:error},'uncaught exception');shutdown('uncaughtException')});

await initDb();
await initCache();
await bootstrapConfiguredAdmins();
await app.listen({port:Number(process.env.PORT||3000),host:'0.0.0.0'});
app.log.info({port:Number(process.env.PORT||3000),clerk:CLERK_ENABLED},'AniNexus ready');
eventLoopDelay.enable();
operationalMetricsTimer=setInterval(()=>{
  const memory=process.memoryUsage();
  app.log.info({phase:'runtime',eventLoopMs:{p95:Number((eventLoopDelay.percentile(95)/1e6).toFixed(2)),max:Number((eventLoopDelay.max/1e6).toFixed(2))},memoryMiB:{rss:Number((memory.rss/1048576).toFixed(1)),heapUsed:Number((memory.heapUsed/1048576).toFixed(1))},postgres:{total:pool.totalCount,idle:pool.idleCount,waiting:pool.waitingCount},redis:{ready:redis.isReady},cache:cacheMetricsSnapshot()},'operational metrics');
  eventLoopDelay.reset();
},60_000);
operationalMetricsTimer.unref?.();
cacheRunOnce('startup:prewarm:v1',300,prewarm).then(result=>app.log.info({ran:result.ran,reason:result.reason},'prewarm startup task')).catch(e=>app.log.warn({err:e},'prewarm failed'));
cacheRunOnce('startup:achievements:v1',3600,()=>syncAllUsersAchievements({onError:(error,userId)=>app.log.warn({err:error,userId},'retroactive achievement sync failed')})).then(result=>app.log.info({ran:result.ran,reason:result.reason,result:result.value},'retroactive achievement startup task')).catch(error=>app.log.warn({err:error},'retroactive achievement scan failed'));
