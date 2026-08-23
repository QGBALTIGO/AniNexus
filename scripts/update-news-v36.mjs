import fs from 'node:fs/promises';
import path from 'node:path';
import {collectEditorialStories,likelyPortuguese} from '../lib/news-rich-v37.mjs';

const OUT=path.resolve('data/news.json');
const RETENTION_DAYS=Math.max(3,Math.min(10,Number(process.env.NEWS_RETENTION_DAYS||7)));
const STALE_GRACE_DAYS=Math.max(RETENTION_DAYS,Math.min(21,Number(process.env.NEWS_STALE_GRACE_DAYS||14)));
const MAX_ITEMS=Math.max(20,Math.min(80,Number(process.env.NEWS_STATIC_MAX_ITEMS||60)));
const MIN_QUALITY=Math.max(.38,Math.min(.9,Number(process.env.NEWS_MIN_QUALITY||.50)));
const MIN_SAFE_FEED=Math.max(6,Math.min(20,Number(process.env.NEWS_MIN_SAFE_FEED||10)));
const now=Date.now();

async function readDoc(file){try{return JSON.parse(await fs.readFile(path.resolve(file),'utf8'))||{}}catch{return{}}}
function ageOk(x,days=RETENTION_DAYS){const t=new Date(x.publishedAt||x.source_published_at||0).getTime();return Number.isFinite(t)&&now-t<days*86400_000&&now-t>-36*3600_000}
function contentOk(x){const text=`${x?.title||''} ${x?.summary||''}`;return!!(x?.title&&x?.summary&&likelyPortuguese(text)&&!/all the news and reviews|interest fool night|news and interest|weekly roundup|live blog/i.test(text))}
function valid(x,days=RETENTION_DAYS){return contentOk(x)&&ageOk(x,days)}
function staticItem(a){
  const published=new Date(a.publishedAt||Date.now()),expires=new Date(published.getTime()+RETENTION_DAYS*86400_000),coverage=a.coverage||{};
  const gallery=(Array.isArray(a.mediaGallery)?a.mediaGallery:[]).filter(x=>x?.url).slice(0,12),embeds=(Array.isArray(a.mediaEmbeds)?a.mediaEmbeds:[]).filter(x=>x?.url).slice(0,4);
  return{id:a.id,slug:a.slug,source:a.sourceName,sourceType:a.sourceKey,sourceLanguage:'pt-BR',language:'pt-BR',title:a.title,originalTitle:a.originalTitle||null,summary:a.summary,url:a.sourceUrl,sourceUrl:a.sourceUrl,image:a.imageUrl||gallery[0]?.url||'',mediaQuery:a.mediaQuery||a.title||'',mediaType:a.eventType==='MANGA'?'manga':'anime',mediaGallery:gallery,mediaEmbeds:embeds,publishedAt:published.toISOString(),updatedAt:a.updatedAt||published.toISOString(),expiresAt:expires.toISOString(),category:a.category,eventType:a.eventType,facts:a.facts||[],contentSections:a.contentSections||[],sources:a.sources||[],sourceCount:a.sourceCount||a.sources?.length||1,readingMinutes:Math.max(2,a.readingMinutes||2),wordCount:a.wordCount||0,qualityScore:Number(a.qualityScore||0),contentVersion:1,coverage:{facts:Number(coverage.facts||a.facts?.length||0),sections:Number(coverage.sections||a.contentSections?.length||0),sourceCount:Number(coverage.sourceCount||a.sourceCount||a.sources?.length||1),ingestMode:coverage.ingestMode||'',mediaCount:Number(coverage.mediaCount||gallery.length),embedCount:Number(coverage.embedCount||embeds.length),sourcePagesRead:Number(coverage.sourcePagesRead||0)}};
}
function richer(a,b){if(!a)return b;if(!b)return a;const wa=Number(a.wordCount||0)+Number(a.coverage?.mediaCount||0)*120+Number(a.coverage?.sections||0)*80+Number(a.qualityScore||0)*500,wb=Number(b.wordCount||0)+Number(b.coverage?.mediaCount||0)*120+Number(b.coverage?.sections||0)*80+Number(b.qualityScore||0)*500;return wb>wa?b:a}
function merge(items){const map=new Map();for(const x of items){if(!contentOk(x))continue;const key=x.sourceUrl||x.url||x.slug||x.id;if(!key)continue;map.set(key,richer(map.get(key),x))}return[...map.values()]}

const started=Date.now();
const [previousDoc,hotDoc,seedDoc]=await Promise.all([readDoc(OUT),readDoc('data/news-v37-hot.json'),readDoc('data/news-v36-seed.json')]);
const previousAll=(previousDoc.items||[]).filter(contentOk),previousFresh=previousAll.filter(x=>valid(x)),previousGrace=previousAll.filter(x=>valid(x,STALE_GRACE_DAYS));
const emergency=[...(hotDoc.items||[]),...(seedDoc.items||[])].filter(contentOk).filter(x=>ageOk(x,STALE_GRACE_DAYS));
let result={stories:[],sourceResults:[],collected:0,grouped:0,skippedTranslation:0,skippedQuality:0},collectorError='';
try{result=await collectEditorialStories({maxPerSource:Number(process.env.NEWS_MAX_PER_SOURCE||45),maxAgeHours:Number(process.env.NEWS_MAX_SOURCE_AGE_HOURS||168),maxStories:Number(process.env.NEWS_MAX_STORIES||60),minQuality:MIN_QUALITY})}catch(err){collectorError=String(err?.message||err);console.error('[news-static-v39] coleta falhou; entrando em modo degradado:',collectorError)}

const fresh=(result.stories||[]).map(staticItem).filter(x=>valid(x));
let mode='fresh';
let candidates=merge([...fresh,...previousFresh]);
if(candidates.length<MIN_SAFE_FEED){mode='grace';candidates=merge([...candidates,...previousGrace,...emergency]);console.warn(`[news-static-v39] feed novo insuficiente (${fresh.length}); usando janela segura para manter ${candidates.length} matérias`)}
let items=candidates.sort((a,b)=>new Date(b.publishedAt)-new Date(a.publishedAt)||Number(b.qualityScore||0)-Number(a.qualityScore||0)||Number(b.wordCount||0)-Number(a.wordCount||0)).slice(0,MAX_ITEMS);

/* Last line of defence: never destroy a readable feed because every upstream happened to fail.
   If even the emergency pool is empty, preserve the existing file byte-for-byte and exit cleanly. */
if(!items.length){
  if(previousAll.length){console.warn('[news-static-v39] nenhum item novo utilizável; preservando data/news.json existente sem sobrescrever');process.exit(0)}
  throw new Error('AniNexus Notícias: não existe feed anterior nem seed PT-BR para recuperação.');
}

const stats={collected:result.collected,grouped:result.grouped,published:items.length,newStories:fresh.length,deepArticles:items.filter(x=>Number(x.coverage?.facts||0)>=6&&Number(x.coverage?.sections||0)>=4).length,avgWords:Math.round(items.reduce((s,x)=>s+Number(x.wordCount||0),0)/Math.max(1,items.length)),withHeroImage:items.filter(x=>x.image).length,withGallery:items.filter(x=>x.mediaGallery?.length).length,withEmbeds:items.filter(x=>x.mediaEmbeds?.length).length,skippedTranslation:result.skippedTranslation,skippedQuality:result.skippedQuality,durationMs:Date.now()-started};
const sourceHealth=result.sourceResults||[];
const doc={generatedAt:new Date().toISOString(),retentionDays:RETENTION_DAYS,staleGraceDays:STALE_GRACE_DAYS,language:'pt-BR',editorialMode:'internal-deep-media',collectorVersion:39,feedStatus:mode==='fresh'&&!collectorError?'fresh':'degraded',collectorError:collectorError||null,sources:['JBox WordPress/Anime/Mangá','Crunchyroll Notícias PT-BR','MyAnimeList (complementar)','Anime News Network (complementar)'],sourceHealth,stats,items};
await fs.mkdir(path.dirname(OUT),{recursive:true});await fs.writeFile(OUT,JSON.stringify(doc,null,2)+'\n');
console.log(`[news-static-v39] ${items.length} matérias (${fresh.length} novas); modo=${doc.feedStatus}; ${stats.deepArticles} profundas; ${stats.withGallery} com galeria; média ${stats.avgWords} palavras`);
