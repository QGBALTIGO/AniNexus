import fs from 'node:fs/promises';
import path from 'node:path';
import {collectEditorialStories,likelyPortuguese} from '../lib/news-sources-v36-normalized.mjs';

const OUT=path.resolve('data/news.json');
const RETENTION_DAYS=Math.max(3,Math.min(10,Number(process.env.NEWS_RETENTION_DAYS||7)));
const MAX_ITEMS=Math.max(20,Math.min(80,Number(process.env.NEWS_STATIC_MAX_ITEMS||60)));
const MIN_QUALITY=Math.max(.38,Math.min(.9,Number(process.env.NEWS_MIN_QUALITY||.50)));
const MIN_SAFE_FEED=Math.max(6,Math.min(20,Number(process.env.NEWS_MIN_SAFE_FEED||10)));
const now=Date.now();

async function previous(){try{return JSON.parse(await fs.readFile(OUT,'utf8'))?.items||[]}catch{return[]}}
function dateOk(x){const t=new Date(x.publishedAt||x.source_published_at||0).getTime();return Number.isFinite(t)&&now-t<RETENTION_DAYS*86400_000&&now-t>-36*3600_000}
function valid(x){const text=`${x?.title||''} ${x?.summary||''}`;return x?.title&&x?.summary&&dateOk(x)&&likelyPortuguese(text)&&!/all the news and reviews|interest fool night|news and interest|weekly roundup|live blog/i.test(text)}
function staticItem(a){const published=new Date(a.publishedAt||Date.now()),expires=new Date(published.getTime()+RETENTION_DAYS*86400_000),coverage=a.coverage||{};return{id:a.id,slug:a.slug,source:a.sourceName,sourceType:a.sourceKey,sourceLanguage:'pt-BR',language:'pt-BR',title:a.title,originalTitle:a.originalTitle||null,summary:a.summary,url:a.sourceUrl,sourceUrl:a.sourceUrl,image:a.imageUrl||'',mediaQuery:a.mediaQuery||a.title||'',mediaType:a.eventType==='MANGA'?'manga':'anime',publishedAt:published.toISOString(),updatedAt:a.updatedAt||published.toISOString(),expiresAt:expires.toISOString(),category:a.category,eventType:a.eventType,facts:a.facts||[],contentSections:a.contentSections||[],sources:a.sources||[],sourceCount:a.sourceCount||a.sources?.length||1,readingMinutes:Math.max(2,a.readingMinutes||2),wordCount:a.wordCount||0,qualityScore:Number(a.qualityScore||0),contentVersion:1,coverage:{facts:Number(coverage.facts||a.facts?.length||0),sections:Number(coverage.sections||a.contentSections?.length||0),sourceCount:Number(coverage.sourceCount||a.sourceCount||a.sources?.length||1),ingestMode:coverage.ingestMode||''}}}

const started=Date.now(),previousItems=(await previous()).filter(valid);
let result={stories:[],sourceResults:[],collected:0,grouped:0,skippedTranslation:0,skippedQuality:0};
try{result=await collectEditorialStories({maxPerSource:Number(process.env.NEWS_MAX_PER_SOURCE||45),maxAgeHours:Number(process.env.NEWS_MAX_SOURCE_AGE_HOURS||168),maxStories:Number(process.env.NEWS_MAX_STORIES||60),minQuality:MIN_QUALITY})}catch(err){console.error('[news-static-v36] coleta falhou; preservando feed anterior:',err?.message||err)}
const fresh=(result.stories||[]).map(staticItem).filter(valid),map=new Map();
for(const x of [...fresh,...previousItems]){const key=x.slug||x.id,prev=map.get(key);if(!prev||Number(x.qualityScore||0)>Number(prev.qualityScore||0)||Number(x.wordCount||0)>Number(prev.wordCount||0)||new Date(x.updatedAt||x.publishedAt)>new Date(prev.updatedAt||prev.publishedAt))map.set(key,x)}
let items=[...map.values()].filter(valid).sort((a,b)=>new Date(b.publishedAt)-new Date(a.publishedAt)||Number(b.qualityScore||0)-Number(a.qualityScore||0)||Number(b.wordCount||0)-Number(a.wordCount||0)).slice(0,MAX_ITEMS);
if(items.length<MIN_SAFE_FEED&&previousItems.length>=items.length){const fallback=new Map();for(const x of [...items,...previousItems])fallback.set(x.slug||x.id,x);items=[...fallback.values()].filter(valid).sort((a,b)=>new Date(b.publishedAt)-new Date(a.publishedAt)).slice(0,MAX_ITEMS);console.warn(`[news-static-v36] somente ${fresh.length} matérias novas válidas; preservando ${items.length} itens para evitar feed raso/vazio`)}
if(!items.length)throw new Error('Proteção do feed V36: nenhuma matéria PT-BR válida; o arquivo anterior não será substituído.');
const stats={collected:result.collected,grouped:result.grouped,published:items.length,deepArticles:items.filter(x=>Number(x.coverage?.facts||0)>=6&&Number(x.coverage?.sections||0)>=4).length,avgWords:Math.round(items.reduce((s,x)=>s+Number(x.wordCount||0),0)/Math.max(1,items.length)),withImage:items.filter(x=>x.image).length,skippedTranslation:result.skippedTranslation,skippedQuality:result.skippedQuality,durationMs:Date.now()-started};
const doc={generatedAt:new Date().toISOString(),retentionDays:RETENTION_DAYS,language:'pt-BR',editorialMode:'internal-deep',collectorVersion:36,sources:['JBox WordPress/Anime/Mangá','Crunchyroll Notícias PT-BR','MyAnimeList (complementar)','Anime News Network (complementar)'],sourceHealth:result.sourceResults,stats,items};
await fs.mkdir(path.dirname(OUT),{recursive:true});await fs.writeFile(OUT,JSON.stringify(doc,null,2)+'\n');
console.log(`[news-static-v36] ${items.length} matérias; ${stats.deepArticles} profundas; média ${stats.avgWords} palavras; ${(result.sourceResults||[]).filter(x=>x.ok).length}/${(result.sourceResults||[]).length} fontes`);
