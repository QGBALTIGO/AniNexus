import fs from 'node:fs/promises';
import path from 'node:path';
import { collectEditorialStories, likelyPortuguese } from '../lib/news-sources-v35.mjs';

const OUT=path.resolve('data/news.json');
const RETENTION_DAYS=Math.max(2,Math.min(10,Number(process.env.NEWS_RETENTION_DAYS||5)));
const MAX_ITEMS=Math.max(12,Math.min(40,Number(process.env.NEWS_STATIC_MAX_ITEMS||30)));
const MIN_QUALITY=Math.max(.35,Math.min(.9,Number(process.env.NEWS_MIN_QUALITY||.52)));
const now=Date.now();
async function previous(){try{return JSON.parse(await fs.readFile(OUT,'utf8'))?.items||[]}catch{return[]}}
function dateOk(x){const t=new Date(x.publishedAt||x.source_published_at||0).getTime();return Number.isFinite(t)&&now-t<RETENTION_DAYS*86400_000&&now-t>-36*3600_000}
function valid(x){const text=`${x?.title||''} ${x?.summary||''}`;return x?.title&&x?.summary&&x?.image&&dateOk(x)&&likelyPortuguese(text)&&!/all the news and reviews|interest fool night|news and interest|weekly roundup|live blog/i.test(text)}
function staticItem(a){const published=new Date(a.publishedAt||Date.now()),expires=new Date(published.getTime()+RETENTION_DAYS*86400_000);return{id:a.id,slug:a.slug,source:a.sourceName,sourceType:a.sourceKey,sourceLanguage:'pt-BR',language:'pt-BR',title:a.title,originalTitle:a.originalTitle||null,summary:a.summary,url:a.sourceUrl,sourceUrl:a.sourceUrl,image:a.imageUrl||'',publishedAt:published.toISOString(),expiresAt:expires.toISOString(),category:a.category,eventType:a.eventType,facts:a.facts||[],contentSections:a.contentSections||[],sources:a.sources||[],sourceCount:a.sourceCount||a.sources?.length||1,readingMinutes:a.readingMinutes||1,wordCount:a.wordCount||0,qualityScore:Number(a.qualityScore||0),contentVersion:1}}
const started=Date.now();
const result=await collectEditorialStories({maxPerSource:18,maxAgeHours:Number(process.env.NEWS_MAX_SOURCE_AGE_HOURS||120),maxStories:38,minQuality:MIN_QUALITY});
const fresh=result.stories.map(staticItem).filter(valid),old=(await previous()).filter(valid),map=new Map();
for(const x of [...fresh,...old]){const key=x.slug||x.id,prev=map.get(key);if(!prev||Number(x.qualityScore||0)>Number(prev.qualityScore||0)||new Date(x.publishedAt)>new Date(prev.publishedAt))map.set(key,x)}
const items=[...map.values()].filter(valid).sort((a,b)=>{const p=x=>String(x.sourceType||'').startsWith('JBOX')?3:x.sourceType==='CRUNCHYROLL'?2:1;return p(b)-p(a)||Number(b.qualityScore||0)-Number(a.qualityScore||0)||new Date(b.publishedAt)-new Date(a.publishedAt)}).slice(0,MAX_ITEMS);
const doc={generatedAt:new Date().toISOString(),retentionDays:RETENTION_DAYS,language:'pt-BR',editorialMode:'internal',collectorVersion:35,sources:['JBox Anime','JBox Mangá','Crunchyroll Notícias','MyAnimeList','Anime News Network'],sourceHealth:result.sourceResults,stats:{collected:result.collected,grouped:result.grouped,published:items.length,withImage:items.filter(x=>x.image).length,skippedTranslation:result.skippedTranslation,skippedQuality:result.skippedQuality,durationMs:Date.now()-started},items};
await fs.mkdir(path.dirname(OUT),{recursive:true});await fs.writeFile(OUT,JSON.stringify(doc,null,2)+'\n');
console.log(`[news-static-v35] ${items.length} matérias PT-BR com imagem; ${result.sourceResults.filter(x=>x.ok).length}/${result.sourceResults.length} fontes`);
