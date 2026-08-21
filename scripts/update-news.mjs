import fs from 'node:fs/promises';
import path from 'node:path';

const UA='AniNexus-NewsBot/1.0 (+https://qgbaltigo.github.io/AniNexus/)';
const OUT=path.resolve('data/news.json');
const now=new Date();

const clean=s=>String(s??'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim();
const abs=(u,base)=>{try{return new URL(u,base).href}catch{return''}};
const iso=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?'':d.toISOString()};
const id=s=>{let h=2166136261;for(const c of String(s||'')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0).toString(36)};

async function get(url,type='text'){
  const r=await fetch(url,{headers:{'user-agent':UA,accept:type==='json'?'application/json':'text/html,application/xml;q=0.9,*/*;q=0.8'}});
  if(!r.ok)throw new Error(`${url}: ${r.status}`);return type==='json'?r.json():r.text();
}
function imageFrom(v){if(!v)return'';if(typeof v==='string')return v;if(Array.isArray(v))return imageFrom(v[0]);if(typeof v==='object')return imageFrom(v.url||v.contentUrl||v.src||v.image);return''}
function maybeArticle(o,source,base){
  if(!o||typeof o!=='object')return null;
  const title=clean(o.headline||o.title||o.name||'');
  let url=o.url||o.href||o.canonicalUrl||o.link||o.permalink||'';if(typeof url==='object')url=url.url||url.href||'';url=abs(url,base);
  const date=iso(o.datePublished||o.publishedAt||o.publishDate||o.date||o.createdAt||o.releaseDate||'');
  const image=abs(imageFrom(o.image||o.thumbnail||o.images||o.heroImage),base);
  const summary=clean(o.description||o.summary||o.excerpt||o.dek||'');
  const author=clean(typeof o.author==='string'?o.author:o.author?.name||o.authorName||'');
  if(title.length<14||title.length>230||!url||!url.includes('/news/'))return null;
  return{source:'Crunchyroll Notícias',sourceType:'CRUNCHYROLL',title,summary:summary.slice(0,520),url,image,publishedAt:date,author};
}
function walk(value,source,base,out,seen=new WeakSet()){
  if(!value||typeof value!=='object')return;if(seen.has(value))return;seen.add(value);
  const a=maybeArticle(value,source,base);if(a)out.push(a);
  if(Array.isArray(value)){for(const v of value)walk(v,source,base,out,seen);return}
  for(const v of Object.values(value))walk(v,source,base,out,seen);
}
function extractScripts(html){const out=[];for(const re of [/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/gi]){let m;while((m=re.exec(html))){try{out.push(JSON.parse(m[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&')))}catch{}}}return out}
async function crunchyroll(){
  const base='https://www.crunchyroll.com';const url=`${base}/pt-br/news/latest`;const html=await get(url);const out=[];
  for(const j of extractScripts(html))walk(j,'Crunchyroll Notícias',base,out);
  const re=/<a[^>]+href=["']([^"']*\/pt-br\/news\/[^"']*?\/20\d{2}\/\d{1,2}\/\d{1,2}\/[^"'#?]+)["'][^>]*>([\s\S]{0,1800}?)<\/a>/gi;let m;
  while((m=re.exec(html))){const u=abs(m[1],base),inner=m[2],t=clean(inner),im=(inner.match(/<img[^>]+(?:src|data-src)=["']([^"']+)/i)||[])[1]||'';const dm=u.match(/\/((?:20)\d{2})\/(\d{1,2})\/(\d{1,2})\//);if(t.length>=14&&t.length<=230)out.push({source:'Crunchyroll Notícias',sourceType:'CRUNCHYROLL',title:t,summary:'',url:u,image:abs(im,base),publishedAt:dm?new Date(Date.UTC(+dm[1],+dm[2]-1,+dm[3],12)).toISOString():''})}
  return out;
}
function rssTag(xml,tag){const m=xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,'i'));return m?clean(m[1].replace(/<!\[CDATA\[|\]\]>/g,'')):''}
async function ann(){
  const xml=await get('https://www.animenewsnetwork.com/all/rss.xml?ann-edition=us');const out=[];for(const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)){const x=m[1],title=rssTag(x,'title'),url=rssTag(x,'link'),date=iso(rssTag(x,'pubDate')),summary=rssTag(x,'description');const im=(x.match(/<(?:media:content|enclosure)[^>]+url=["']([^"']+)/i)||[])[1]||'';if(title&&url)out.push({source:'Anime News Network',sourceType:'ANN',title,summary:summary.slice(0,520),url,image:im,publishedAt:date})}return out;
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function mal(){
  const top=await get('https://api.jikan.moe/v4/top/anime?filter=airing&limit=10','json');const out=[];
  for(let i=0;i<Math.min(8,top?.data?.length||0);i++){
    const a=top.data[i];if(i)await sleep(380);
    try{const j=await get(`https://api.jikan.moe/v4/anime/${a.mal_id}/news`,'json');for(const n of (j?.data||[]).slice(0,2))out.push({source:'MyAnimeList',sourceType:'MAL',title:clean(n.title),summary:clean(n.excerpt||'').slice(0,520),url:n.url,image:n.images?.jpg?.image_url||a.images?.jpg?.large_image_url||a.images?.jpg?.image_url||'',publishedAt:iso(n.date),author:n.author_username||''})}catch(e){console.warn('MAL news',a.mal_id,e.message)}
  }
  return out;
}
function category(x){const t=`${x.title||''} ${x.summary||''}`.toLowerCase();if(/trailer|teaser|promo|music video|vídeo|video|pv\b/.test(t))return'Trailers';if(/manga|mangá|volume|chapter|capítulo/.test(t))return'Mangás';if(/film|movie|filme|theatrical/.test(t))return'Filmes';if(/cast|voice|elenco|dublador|dublagem/.test(t))return'Elenco';if(/season|temporada|anime|adaptation|adaptação/.test(t))return'Animes';return'Notícias'}
function dedupe(items){const seen=new Set(),out=[];for(const raw of items){if(!raw?.title||!raw?.url)continue;const key=raw.url.toLowerCase().replace(/[?#].*$/,'')||raw.title.toLowerCase();if(seen.has(key))continue;seen.add(key);out.push({...raw,id:`${String(raw.sourceType||'src').toLowerCase()}-${id(key)}`,category:category(raw)})}return out.sort((a,b)=>(new Date(b.publishedAt||0))-(new Date(a.publishedAt||0))).slice(0,60)}

async function previous(){try{return JSON.parse(await fs.readFile(OUT,'utf8'))?.items||[]}catch{return[]}}
const jobs=await Promise.allSettled([crunchyroll(),mal(),ann()]);let fresh=[];for(const j of jobs)if(j.status==='fulfilled')fresh.push(...j.value);else console.warn(j.reason?.message||j.reason);
const old=await previous();const items=dedupe([...fresh,...old]).filter(x=>!x.publishedAt||Date.now()-new Date(x.publishedAt).getTime()<1000*60*60*24*45);
await fs.mkdir(path.dirname(OUT),{recursive:true});await fs.writeFile(OUT,JSON.stringify({generatedAt:now.toISOString(),sources:['Crunchyroll Notícias','MyAnimeList','Anime News Network'],items},null,2)+'\n');
console.log(`news: ${items.length} items (${jobs.filter(x=>x.status==='fulfilled').length}/3 sources)`);
