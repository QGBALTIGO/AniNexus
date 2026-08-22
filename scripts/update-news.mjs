import fs from 'node:fs/promises';
import path from 'node:path';
import { cleanText, canonicalUrl, sourceFingerprint, storyFingerprint, classifyNews, categoryLabel } from '../lib/news-core.mjs';

const UA='AniNexus-NewsBot/3.0 (+https://qgbaltigo.github.io/AniNexus/)';
const OUT=path.resolve('data/news.json');
const RETENTION_DAYS=Math.max(2,Math.min(14,Number(process.env.NEWS_RETENTION_DAYS||5)));
const TRANSLATE='https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=pt&dt=t&q=';
const now=new Date();
const abs=(u,base)=>{try{return new URL(u,base).href}catch{return''}};
const iso=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?'':d.toISOString()};
const id=s=>{let h=2166136261;for(const c of String(s||'')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0).toString(36)};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function get(url,type='text',timeout=14_000){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  try{const r=await fetch(url,{signal:controller.signal,headers:{'user-agent':UA,accept:type==='json'?'application/json':'text/html,application/xml;q=0.9,*/*;q=0.8'}});if(!r.ok)throw new Error(`${url}: ${r.status}`);return type==='json'?r.json():r.text()}finally{clearTimeout(timer)}
}
function imageFrom(v){if(!v)return'';if(typeof v==='string')return v;if(Array.isArray(v))return imageFrom(v[0]);if(typeof v==='object')return imageFrom(v.url||v.contentUrl||v.src||v.image);return''}
function maybeArticle(o,base){
  if(!o||typeof o!=='object')return null;
  const title=cleanText(o.headline||o.title||o.name||'',230);let url=o.url||o.href||o.canonicalUrl||o.link||o.permalink||'';if(typeof url==='object')url=url.url||url.href||'';url=abs(url,base);
  const date=iso(o.datePublished||o.publishedAt||o.publishDate||o.date||o.createdAt||o.releaseDate||''),image=abs(imageFrom(o.image||o.thumbnail||o.images||o.heroImage),base),summary=cleanText(o.description||o.summary||o.excerpt||o.dek||'',1200),author=cleanText(typeof o.author==='string'?o.author:o.author?.name||o.authorName||'',160);
  if(title.length<14||title.length>230||!url||!url.includes('/news/'))return null;
  return{source:'Crunchyroll Notícias',sourceType:'CRUNCHYROLL',sourceLanguage:'pt-BR',title,summary,url,image,publishedAt:date,author};
}
function walk(value,base,out,seen=new WeakSet()){if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);const a=maybeArticle(value,base);if(a)out.push(a);if(Array.isArray(value)){for(const v of value)walk(v,base,out,seen);return}for(const v of Object.values(value))walk(v,base,out,seen)}
function extractScripts(html){const out=[];for(const re of [/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/gi]){let m;while((m=re.exec(html))){try{out.push(JSON.parse(m[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&')))}catch{}}}return out}
async function crunchyroll(){
  const base='https://www.crunchyroll.com',html=await get(`${base}/pt-br/news/latest`),out=[];for(const j of extractScripts(html))walk(j,base,out);
  return out;
}
function rssTag(xml,tag){const m=xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,'i'));return m?cleanText(m[1].replace(/<!\[CDATA\[|\]\]>/g,''),1800):''}
async function ann(){const xml=await get('https://www.animenewsnetwork.com/all/rss.xml?ann-edition=us'),out=[];for(const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)){const x=m[1],title=rssTag(x,'title'),url=rssTag(x,'link'),date=iso(rssTag(x,'pubDate')),summary=rssTag(x,'description'),im=(x.match(/<(?:media:content|enclosure)[^>]+url=["']([^"']+)/i)||[])[1]||'';if(title&&url)out.push({source:'Anime News Network',sourceType:'ANN',sourceLanguage:'en',title,summary:summary.slice(0,1200),url,image:im,publishedAt:date})}return out}
async function mal(){
  const top=await get('https://api.jikan.moe/v4/top/anime?filter=airing&limit=10','json'),out=[];
  for(let i=0;i<Math.min(7,top?.data?.length||0);i++){const a=top.data[i];if(i)await sleep(420);try{const j=await get(`https://api.jikan.moe/v4/anime/${a.mal_id}/news`,'json');for(const n of (j?.data||[]).slice(0,2))out.push({source:'MyAnimeList',sourceType:'MAL',sourceLanguage:'en',title:cleanText(n.title,230),summary:cleanText(n.excerpt||'',1200),url:n.url,image:n.images?.jpg?.image_url||a.images?.jpg?.large_image_url||a.images?.jpg?.image_url||'',publishedAt:iso(n.date),author:n.author_username||''})}catch(e){console.warn('MAL news',a.mal_id,e.message)}}
  return out;
}

const translationCache=new Map();
async function translatePt(text){
  const source=cleanText(text,4200);if(!source)return'';if(translationCache.has(source))return translationCache.get(source);
  try{const r=await fetch(TRANSLATE+encodeURIComponent(source),{headers:{'user-agent':UA}});if(r.ok){const j=await r.json(),value=cleanText((j?.[0]||[]).map(x=>x?.[0]||'').join(''),4200)||source;translationCache.set(source,value);return value}}catch{}
  translationCache.set(source,source);return source;
}
async function localize(item){
  if(String(item.sourceLanguage||'').toLowerCase().startsWith('pt'))return item;
  const marker=' <<<ANINEXUS_SEP>>> ',translated=await translatePt(`${item.title}${marker}${item.summary||''}`),parts=translated.split(/\s*<<<ANINEXUS_SEP>>>\s*/);
  await sleep(80);
  return{...item,title:cleanText(parts[0]||item.title,230),summary:cleanText(parts.slice(1).join(' ')||item.summary,1200),originalTitle:item.title,sourceLanguage:'pt-BR'};
}
function dedupe(items){
  const seenUrl=new Set(),seenStory=new Set(),out=[];
  for(const raw of items){if(!raw?.title||!raw?.url)continue;const canonical=canonicalUrl(raw.url),sourceHash=sourceFingerprint(canonical),storyHash=storyFingerprint(raw.title,raw.summary);if(seenUrl.has(sourceHash)||seenStory.has(storyHash))continue;seenUrl.add(sourceHash);seenStory.add(storyHash);const eventType=classifyNews(raw);out.push({...raw,url:canonical,id:`${String(raw.sourceType||'src').toLowerCase()}-${id(sourceHash)}`,eventType,category:categoryLabel(eventType)})}
  return out.sort((a,b)=>(new Date(b.publishedAt||0))-(new Date(a.publishedAt||0))).slice(0,50);
}
function recent(item){if(!item.publishedAt)return true;const t=new Date(item.publishedAt).getTime();return Number.isFinite(t)&&Date.now()-t<RETENTION_DAYS*86400_000&&Date.now()-t>-48*3600_000}
async function previous(){try{return JSON.parse(await fs.readFile(OUT,'utf8'))?.items||[]}catch{return[]}}

const jobs=await Promise.allSettled([crunchyroll(),mal(),ann()]);let fresh=[];for(const j of jobs)if(j.status==='fulfilled')fresh.push(...j.value);else console.warn(j.reason?.message||j.reason);
const localized=[];for(const item of fresh.filter(recent).slice(0,40))localized.push(await localize(item));
const old=(await previous()).filter(recent).map(x=>({...x,sourceLanguage:'pt-BR'}));
const items=dedupe([...localized,...old]).filter(recent);
await fs.mkdir(path.dirname(OUT),{recursive:true});await fs.writeFile(OUT,JSON.stringify({generatedAt:now.toISOString(),retentionDays:RETENTION_DAYS,language:'pt-BR',sources:['Crunchyroll Notícias','MyAnimeList','Anime News Network'],items},null,2)+'\n');
console.log(`news: ${items.length} items PT-BR (${jobs.filter(x=>x.status==='fulfilled').length}/3 sources, ${RETENTION_DAYS}d retention)`);
