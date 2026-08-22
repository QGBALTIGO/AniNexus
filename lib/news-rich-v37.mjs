import {collectEditorialStories as collectBase,likelyPortuguese,languageScore} from './news-sources-v36-normalized.mjs';
import {cleanText,safeUrl} from './news-core.mjs';

const UA='Mozilla/5.0 (compatible; AniNexus-News/3.7; +https://aninexus.seudominio.com)';
const CACHE=new Map();
const MAX_MEDIA=12;
const MAX_EMBEDS=4;

async function get(url,timeout=14000){
  if(CACHE.has(url))return CACHE.get(url);
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeout);
  try{
    const p=fetch(url,{signal:ctl.signal,redirect:'follow',headers:{'user-agent':UA,'accept-language':'pt-BR,pt;q=.96,en;q=.55',accept:'text/html,application/xhtml+xml;q=.9,*/*;q=.5'}})
      .then(r=>{if(!r.ok)throw new Error(`${url}: ${r.status}`);return r.text()});
    CACHE.set(url,p);return await p;
  }finally{clearTimeout(timer)}
}

function abs(v,base){try{return new URL(String(v||''),base).href}catch{return safeUrl(v)}}
function decode(v=''){return cleanText(String(v).replace(/&#x([0-9a-f]+);/gi,(_,h)=>String.fromCodePoint(parseInt(h,16))).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'"),5000)}
function attr(tag,name){return String(tag||'').match(new RegExp(`\\b${name}=["']([^"']+)["']`,'i'))?.[1]||''}
function srcset(tag){const raw=attr(tag,'srcset')||attr(tag,'data-srcset');if(!raw)return'';const candidates=raw.split(',').map(x=>x.trim().split(/\s+/)[0]).filter(Boolean);return candidates.at(-1)||''}
function bestImg(tag,base){return safeUrl(abs(attr(tag,'data-lazy-src')||attr(tag,'data-src')||attr(tag,'data-original')||srcset(tag)||attr(tag,'src'),base))}
function badImage(url,alt=''){const t=`${url} ${alt}`.toLowerCase();return !url||/avatar|gravatar|logo|emoji|icon|sprite|pixel|tracking|badge|ads?[\/.\-_]|banner-ad|placeholder|loading\.gif|1x1/.test(t)}
function youtubeId(url){try{const u=new URL(url);if(u.hostname.includes('youtu.be'))return u.pathname.split('/').filter(Boolean)[0]||'';if(u.pathname.includes('/embed/'))return u.pathname.split('/embed/')[1]?.split(/[/?#]/)[0]||'';return u.searchParams.get('v')||''}catch{return''}}

function jsonLdImages(html,base){const out=[];for(const m of String(html||'').matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{const root=JSON.parse(m[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&'));const walk=v=>{if(!v)return;if(Array.isArray(v)){v.forEach(walk);return}if(typeof v!=='object')return;const type=String(v['@type']||'').toLowerCase();if(type.includes('article')||type.includes('newsarticle')){const imgs=Array.isArray(v.image)?v.image:[v.image];for(const x of imgs){const raw=typeof x==='string'?x:x?.url||x?.contentUrl||x?.src||'';const url=safeUrl(abs(raw,base));if(url)out.push({type:'image',url,alt:cleanText(v.headline||'',220),caption:'',source:'json-ld'})}}Object.values(v).forEach(walk)};walk(root)}catch{}}return out}

export function extractSourceMedia(html='',baseUrl=''){
  const media=[],embeds=[],seen=new Set(),push=(item)=>{if(!item?.url||seen.has(item.url))return;seen.add(item.url);media.push(item)};
  const og=String(html).match(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)/i)?.[1]||'';
  const ogAlt=decode(String(html).match(/<meta[^>]+property=["']og:image:alt["'][^>]+content=["']([^"']+)/i)?.[1]||'');
  const ogUrl=safeUrl(abs(og,baseUrl));if(ogUrl&&!badImage(ogUrl,ogAlt))push({type:'image',url:ogUrl,alt:ogAlt,caption:'',source:'og'});
  for(const item of jsonLdImages(html,baseUrl))if(!badImage(item.url,item.alt))push(item);

  const article=String(html).match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1]||String(html);
  for(const f of article.matchAll(/<figure\b[^>]*>([\s\S]*?)<\/figure>/gi)){
    const body=f[1],imgTag=body.match(/<img\b[^>]*>/i)?.[0]||'',url=bestImg(imgTag,baseUrl),alt=decode(attr(imgTag,'alt')),caption=decode(body.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1]||'');
    if(url&&!badImage(url,`${alt} ${caption}`))push({type:'image',url,alt,caption,source:'figure'});
  }
  for(const m of article.matchAll(/<img\b[^>]*>/gi)){
    const tag=m[0],url=bestImg(tag,baseUrl),alt=decode(attr(tag,'alt'));
    if(url&&!badImage(url,alt))push({type:'image',url,alt,caption:'',source:'article'});
    if(media.length>=MAX_MEDIA)break;
  }

  const embedSeen=new Set();
  for(const m of article.matchAll(/<(?:iframe|a)\b[^>]*(?:src|href)=["']([^"']+)["'][^>]*>/gi)){
    const raw=abs(m[1],baseUrl),id=youtubeId(raw);if(!id||embedSeen.has(id))continue;embedSeen.add(id);embeds.push({type:'youtube',id,url:`https://www.youtube-nocookie.com/embed/${id}`});if(embeds.length>=MAX_EMBEDS)break;
  }
  return{media:media.slice(0,MAX_MEDIA),embeds:embeds.slice(0,MAX_EMBEDS)};
}

async function enrichArticle(article){
  const urls=(article.sources||[]).map(x=>x?.url).filter(Boolean);if(article.sourceUrl&&!urls.includes(article.sourceUrl))urls.unshift(article.sourceUrl);
  const all=[],embeds=[],seen=new Set(),embedSeen=new Set();
  for(const url of urls.slice(0,3)){
    try{
      const html=await get(url),found=extractSourceMedia(html,url);
      for(const m of found.media){if(seen.has(m.url))continue;seen.add(m.url);all.push({...m,credit:article.sources?.find(s=>s.url===url)?.name||article.sourceName||'Fonte'});if(all.length>=MAX_MEDIA)break}
      for(const e of found.embeds){if(embedSeen.has(e.id))continue;embedSeen.add(e.id);embeds.push(e);if(embeds.length>=MAX_EMBEDS)break}
    }catch{}
    if(all.length>=MAX_MEDIA&&embeds.length>=MAX_EMBEDS)break;
  }
  const hero=safeUrl(article.imageUrl)||all[0]?.url||'';
  return{...article,imageUrl:hero,mediaGallery:all,mediaEmbeds:embeds,coverage:{...(article.coverage||{}),mediaCount:all.length,embedCount:embeds.length,sourcePagesRead:Math.min(3,urls.length)}};
}

export async function collectEditorialStories(options={}){
  const result=await collectBase(options),stories=[];
  for(let i=0;i<(result.stories||[]).length;i+=5){stories.push(...await Promise.all(result.stories.slice(i,i+5).map(enrichArticle)))}
  return{...result,stories,collectorVersion:37};
}

export {likelyPortuguese,languageScore};
