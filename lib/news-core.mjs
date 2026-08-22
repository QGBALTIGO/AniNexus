import crypto from 'node:crypto';

const STOPWORDS=new Set([
  'a','o','os','as','de','da','do','das','dos','e','em','no','na','nos','nas','para','por','com','um','uma','uns','umas','que','se','ao','aos','the','a','an','and','or','of','to','in','on','for','with','new','novo','nova','anime','manga','mangá','season','temporada','trailer','teaser','reveals','revela','announces','anuncia'
]);

export const NEWS_CATEGORIES=['SEASON','TRAILER','EPISODE','MANGA','TRENDING','OTHER'];

export function cleanText(value='',max=30_000){
  return String(value??'')
    .replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;|&#160;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'")
    .replace(/&lt;/gi,'<')
    .replace(/&gt;/gi,'>')
    .replace(/\s+/g,' ')
    .trim()
    .slice(0,max);
}

export function slugify(value='noticia'){
  return cleanText(value,180).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,108)||'noticia';
}

export function sha(value='',size=20){return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0,size)}

export function safeUrl(value){
  try{const u=new URL(String(value||''));if(!['https:','http:'].includes(u.protocol))return'';if(u.protocol==='http:')u.protocol='https:';return u.href}catch{return''}
}

export function canonicalUrl(value){
  try{
    const u=new URL(safeUrl(value));if(!u.hostname)return'';u.hash='';
    const removable=['utm_source','utm_medium','utm_campaign','utm_term','utm_content','utm_id','fbclid','gclid','mc_cid','mc_eid','ref','referrer','source'];
    for(const key of [...u.searchParams.keys()])if(removable.includes(key.toLowerCase())||key.toLowerCase().startsWith('utm_'))u.searchParams.delete(key);
    [...u.searchParams.keys()].sort().forEach(key=>{const vals=u.searchParams.getAll(key);u.searchParams.delete(key);vals.sort().forEach(v=>u.searchParams.append(key,v))});
    u.pathname=u.pathname.replace(/\/{2,}/g,'/').replace(/\/$/,'')||'/';return u.href;
  }catch{return''}
}

export function sourceFingerprint(url){return sha(canonicalUrl(url)||url,24)}

function normalizedTokens(value){return cleanText(value,500).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(x=>x.length>2&&!STOPWORDS.has(x))}

export function storyFingerprint(title,summary=''){
  const titleTokens=normalizedTokens(title),summaryTokens=normalizedTokens(summary).slice(0,18),counts=new Map();
  for(const token of [...titleTokens,...titleTokens,...summaryTokens])counts.set(token,(counts.get(token)||0)+1);
  const signature=[...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,10).map(([x])=>x).sort().join('|');
  return sha(signature||cleanText(title,160).toLowerCase(),24);
}

export function classifyNews(item={}){
  const t=`${cleanText(item.category||item.eventType,80)} ${cleanText(item.title,260)} ${cleanText(item.summary,900)}`.toLowerCase();
  if(/\b(trailer|teaser|promo|promotional|pv|music video|vídeo|video)\b/.test(t))return'TRAILER';
  if(/\b(manga|mangá|manhwa|manhua|light novel|novel|volume|chapter|capítulo|licen[cs]e|licenciamento)\b/.test(t))return'MANGA';
  if(/\b(episode|episódio|episodio|finale|final episode)\b/.test(t))return'EPISODE';
  if(/\b(season|temporada|anime adaptation|anime adaption|adapta[cç][aã]o|renewed|renovada|estreia|premiere)\b/.test(t))return'SEASON';
  if(/\b(ranking|record|milh[oõ]es|box office|popular|trend|em alta)\b/.test(t))return'TRENDING';
  return'OTHER';
}

export function categoryLabel(type){return({SEASON:'Animes',TRAILER:'Trailers',EPISODE:'Episódios',MANGA:'Mangás & novels',TRENDING:'Em alta',OTHER:'Notícias'})[String(type||'OTHER').toUpperCase()]||'Notícias'}

export function splitFacts(value,max=8){
  const text=cleanText(Array.isArray(value)?value.join('. '):value,12_000);if(!text)return[];
  const chunks=text.split(/(?<=[.!?])\s+|\s+[•·]\s+/).map(x=>cleanText(x,480)).filter(x=>x.length>=24&&x.length<=480),seen=new Set();
  return chunks.filter(x=>{const k=x.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();if(seen.has(k))return false;seen.add(k);return true}).slice(0,max);
}

function firstMeta(html,patterns=[]){for(const re of patterns){const m=String(html||'').match(re);if(m?.[1])return cleanText(m[1],2000)}return''}
function imageValue(v){if(!v)return'';if(typeof v==='string')return safeUrl(v);if(Array.isArray(v))return imageValue(v[0]);if(typeof v==='object')return imageValue(v.url||v.contentUrl||v.src||v.image);return''}
function findJsonLd(value,out=[]){if(!value)return out;if(Array.isArray(value)){for(const x of value)findJsonLd(x,out);return out}if(typeof value!=='object')return out;const type=String(value['@type']||'').toLowerCase();if(type.includes('article')||type.includes('newsarticle'))out.push(value);for(const x of Object.values(value))if(x&&typeof x==='object')findJsonLd(x,out);return out}
function articleParagraphs(html){
  const article=String(html||'').match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1]||'';if(!article)return'';
  const paragraphs=[...article.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(x=>cleanText(x[1],900)).filter(x=>x.length>=40);
  return cleanText(paragraphs.slice(0,12).join(' '),6000);
}
function authorName(author){if(!author)return'';if(typeof author==='string')return cleanText(author,160);if(Array.isArray(author))return authorName(author[0]);if(typeof author==='object')return cleanText(author.name||author.alternateName||'',160);return''}
function keywordText(value){if(Array.isArray(value))return value.map(x=>cleanText(x,80)).filter(Boolean).join(', ');return cleanText(value,500)}

export function extractHtmlMetadata(html='',baseUrl=''){
  const text=String(html||''),json=[];
  for(const m of text.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{findJsonLd(JSON.parse(m[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&')),json)}catch{}}
  const ld=json[0]||{},resolve=v=>{try{return new URL(v,baseUrl||undefined).href}catch{return safeUrl(v)}};
  const title=cleanText(ld.headline||firstMeta(text,[/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i,/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)/i]),260);
  const description=cleanText(ld.description||firstMeta(text,[/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)/i,/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i]),1800);
  const rawImage=imageValue(ld.image)||firstMeta(text,[/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)/i,/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)/i]);
  const author=authorName(ld.author)||firstMeta(text,[/<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)/i]);
  const publishedAt=cleanText(ld.datePublished||firstMeta(text,[/<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)/i]),80);
  const articleText=cleanText(ld.articleBody||ld.text||articleParagraphs(text),6000);
  const keywords=keywordText(ld.keywords||firstMeta(text,[/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)/i]));
  return{title,description,imageUrl:rawImage?resolve(rawImage):'',author,publishedAt,articleText,keywords};
}

export function mergeSources(existing=[],incoming=[]){
  const map=new Map();
  for(const src of [...(Array.isArray(existing)?existing:[]),...(Array.isArray(incoming)?incoming:[])]){
    const url=canonicalUrl(src?.url||src?.sourceUrl||''),name=cleanText(src?.name||src?.sourceName||'Fonte',120),key=url||`${name}:${cleanText(src?.publishedAt,80)}`;if(!key)continue;
    const prev=map.get(key)||{};map.set(key,{name,url,publishedAt:src?.publishedAt||prev.publishedAt||null,author:cleanText(src?.author||prev.author||'',160)||null});
  }
  return [...map.values()].slice(0,8);
}

export function buildEditorialArticle({title,summary,eventType='OTHER',facts=[],sources=[],imageUrl='',originalTitle='',sourceLanguage='auto'}={}){
  const safeTitle=cleanText(title,220)||'Notícia AniNexus',safeSummary=cleanText(summary,1200)||`O AniNexus registrou uma nova atualização sobre ${safeTitle}.`,factual=splitFacts([...facts,safeSummary],8),category=categoryLabel(eventType),sections=[];
  sections.push({heading:'O que aconteceu',paragraphs:[safeSummary]});
  if(factual.length>1)sections.push({heading:'Detalhes confirmados',bullets:factual.slice(1,7)});
  const context=eventType==='TRAILER'?'O material divulgado amplia o que já se sabe sobre a produção. Novos vídeos, datas e informações de elenco podem ser incorporados enquanto a notícia permanecer ativa.':eventType==='MANGA'?'A atualização envolve publicação, licenciamento, capítulos, volumes ou outras novidades editoriais de mangás e light novels.':eventType==='SEASON'?'A notícia está ligada a estreia, renovação, adaptação ou nova temporada. O calendário do AniNexus é atualizado separadamente quando houver data confirmada.':eventType==='EPISODE'?'A informação está ligada à exibição de episódios. Horários podem variar conforme a plataforma e o território.':eventType==='TRENDING'?'O destaque reflete um movimento recente de audiência, repercussão ou desempenho da obra.':'O AniNexus mantém esta publicação no feed recente e atualiza os dados quando surgem mudanças relevantes.';
  sections.push({heading:'Contexto AniNexus',paragraphs:[context]});
  const words=cleanText([safeSummary,...sections.flatMap(s=>[...(s.paragraphs||[]),...(s.bullets||[])])].join(' '),30_000).split(/\s+/).filter(Boolean).length,readingMinutes=Math.max(1,Math.ceil(words/210));
  return{version:3,title:safeTitle,originalTitle:cleanText(originalTitle,260)||null,lead:safeSummary,category,sourceLanguage:cleanText(sourceLanguage,24)||'auto',imageUrl:safeUrl(imageUrl),facts:factual,sections,sources:mergeSources([],sources),readingMinutes,wordCount:words};
}

export function qualityScore({title,summary,imageUrl,publishedAt,sources=[],facts=[]}={}){
  let score=.28;if(cleanText(title).length>=24)score+=.14;if(cleanText(summary).length>=120)score+=.18;if(safeUrl(imageUrl))score+=.14;if(Array.isArray(sources)&&sources.length)score+=Math.min(.12,sources.length*.05);if(Array.isArray(facts)&&facts.length>=2)score+=.08;const t=new Date(publishedAt||0).getTime();if(Number.isFinite(t)&&Date.now()-t<72*3600_000)score+=.06;return Math.max(0,Math.min(1,Number(score.toFixed(3))));
}
