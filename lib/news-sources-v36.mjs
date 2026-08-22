import {cleanText,canonicalUrl,sourceFingerprint,storyFingerprint,classifyNews,categoryLabel,splitFacts,mergeSources,qualityScore,slugify,sha,safeUrl} from './news-core.mjs';

const UA='Mozilla/5.0 (compatible; AniNexus-News/3.6; +https://aninexus.seudominio.com)';
const TR=process.env.NEWS_TRANSLATE_ENDPOINT||'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=pt&dt=t&q=';
const iso=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?'':d.toISOString()};
const abs=(u,b)=>{try{return new URL(u,b).href}catch{return safeUrl(u)}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const htmlDecode=v=>String(v||'').replace(/<!\[CDATA\[|\]\]>/g,'').replace(/&#x([0-9a-f]+);/gi,(_,h)=>String.fromCodePoint(parseInt(h,16))).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>');

async function get(url,type='text',timeout=15000){
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeout);
  try{
    const r=await fetch(url,{signal:ctl.signal,redirect:'follow',headers:{'user-agent':UA,'accept-language':'pt-BR,pt;q=.97,en;q=.55',accept:type==='json'?'application/json':'application/rss+xml,application/xml,text/html;q=.95,*/*;q=.6'}});
    if(!r.ok)throw new Error(`${url}: ${r.status}`);
    return type==='json'?r.json():r.text();
  }finally{clearTimeout(timer)}
}

function tag(block,name){const x=name.replace(':','\\:');return cleanText(htmlDecode(String(block||'').match(new RegExp(`<${x}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${x}>`,'i'))?.[1]||''),9000)}
function attr(block,name){const x=name.replace(':','\\:');return String(block||'').match(new RegExp(`<${x}[^>]*\\b(?:url|href|src)=["']([^"']+)`,'i'))?.[1]||''}
function rss(xml,meta){const out=[];for(const m of String(xml||'').matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)){const b=m[1],title=tag(b,'title'),url=canonicalUrl(tag(b,'link')||tag(b,'guid'));if(!title||!url)continue;const desc=tag(b,'description'),enc=tag(b,'content:encoded'),img=attr(b,'media:content')||attr(b,'media:thumbnail')||attr(b,'enclosure')||String(enc||desc).match(/<img[^>]+(?:src|data-src)=["']([^"']+)/i)?.[1]||'';out.push({...meta,title,summary:cleanText(desc||enc,2600),url,imageUrl:safeUrl(abs(img,url)),publishedAt:iso(tag(b,'pubDate')||tag(b,'dc:date')),author:tag(b,'dc:creator')||tag(b,'author'),articleHtml:enc||'',terms:[]})}return out}

function richBlocks(html=''){
  const cleaned=String(html||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<aside[\s\S]*?<\/aside>/gi,' ').replace(/<nav[\s\S]*?<\/nav>/gi,' ').replace(/<figure[^>]*class=["'][^"']*(?:ads?|advert|social|share)[^"']*["'][\s\S]*?<\/figure>/gi,' ');
  const blocks=[];
  for(const m of cleaned.matchAll(/<(h2|h3|p|li|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi)){
    const type=m[1].toLowerCase(),text=cleanText(htmlDecode(m[2]),1600);
    if(text.length<24)continue;
    if(/publicidade|assine|newsletter|siga o jbox|leia tamb[eé]m|veja tamb[eé]m|fonte:|via:/i.test(text)&&text.length<180)continue;
    blocks.push({type,text});
    if(blocks.length>=46)break;
  }
  const paragraphs=blocks.filter(x=>['p','li','blockquote'].includes(x.type)).map(x=>x.text),headings=blocks.filter(x=>/^h[23]$/.test(x.type)).map(x=>x.text),articleText=cleanText(paragraphs.join(' '),22000),facts=splitFacts(paragraphs,28);
  return{blocks,paragraphs,headings,articleText,facts};
}

function metaFromHtml(html='',url=''){
  const find=re=>cleanText(htmlDecode(String(html).match(re)?.[1]||''),2600),image=find(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)/i)||find(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)/i),title=find(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i),description=find(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)/i)||find(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i),publishedAt=find(/<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)/i),author=find(/<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)/i),rich=richBlocks(String(html).match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1]||html);
  return{title,description,imageUrl:safeUrl(abs(image,url)),publishedAt:iso(publishedAt),author,...rich};
}

function wpTerms(post){const groups=post?._embedded?.['wp:term']||[],out=[];for(const g of groups)for(const t of Array.isArray(g)?g:[])if(t?.name)out.push(cleanText(t.name,90));return [...new Set(out)]}
function wpImage(post){return safeUrl(post?._embedded?.['wp:featuredmedia']?.[0]?.source_url||post?._embedded?.['wp:featuredmedia']?.[0]?.media_details?.sizes?.full?.source_url||'')}
function wpAuthor(post){return cleanText(post?._embedded?.author?.[0]?.name||'',160)}
function relevantJbox(post){const terms=wpTerms(post).join(' ').toLowerCase(),title=cleanText(post?.title?.rendered,260).toLowerCase();return /anime|anim[eê]|mang[aá]|light novel|dublagem|streaming|cinema|live action|eventos/.test(`${terms} ${title}`)}

async function jboxWordpress(){
  const errors=[],out=[];
  for(let page=1;page<=2;page++){
    try{
      const url=`https://www.jbox.com.br/wp-json/wp/v2/posts?per_page=50&page=${page}&orderby=date&order=desc&_embed=1`;
      const posts=await get(url,'json',16000);
      if(!Array.isArray(posts)||!posts.length)break;
      for(const p of posts){
        if(!relevantJbox(p))continue;
        const content=String(p?.content?.rendered||''),rich=richBlocks(content),title=cleanText(htmlDecode(p?.title?.rendered||''),260),summary=cleanText(htmlDecode(p?.excerpt?.rendered||''),2400),url=canonicalUrl(p?.link||'');if(!title||!url)continue;
        out.push({sourceName:'JBox',sourceKey:/mang[aá]/i.test(wpTerms(p).join(' '))?'JBOX_MANGA':'JBOX_ANIME',sourceLanguage:'pt-BR',title,summary,url,imageUrl:wpImage(p),publishedAt:iso(p?.date_gmt?`${p.date_gmt}Z`:p?.date),modifiedAt:iso(p?.modified_gmt?`${p.modified_gmt}Z`:p?.modified),author:wpAuthor(p),terms:wpTerms(p),articleHtml:content,articleText:rich.articleText,articleFacts:rich.facts,headings:rich.headings,ingestMode:'wp-rest'});
      }
      if(posts.length<50)break;
    }catch(e){errors.push(e.message);break}
  }
  return{items:out,mode:out.length?'wp-rest':'failed',errors};
}

async function jboxCategory(path,key){
  const base='https://www.jbox.com.br',errors=[];
  for(const url of [`${base}${path}feed/`,`${base}${path}?feed=rss2`]){
    try{const items=rss(await get(url),{sourceName:'JBox',sourceKey:key,sourceLanguage:'pt-BR'});if(items.length)return{items,mode:'rss',errors}}catch(e){errors.push(e.message)}
  }
  try{
    const html=await get(base+path),items=[],seen=new Set();
    for(const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
      const url=canonicalUrl(abs(m[1],base)),title=cleanText(m[2],260);if(!url?.startsWith(base)||title.length<18||/\/categoria\/|\/tag\/|\/author\/|\/page\/|\/feed\/?$/.test(url)||seen.has(url))continue;seen.add(url);items.push({sourceName:'JBox',sourceKey:key,sourceLanguage:'pt-BR',title,summary:'',url,imageUrl:'',publishedAt:'',author:'',terms:[],articleHtml:''})
    }
    return{items:items.slice(0,40),mode:'html',errors};
  }catch(e){errors.push(e.message);return{items:[],mode:'failed',errors}}
}

async function crunchy(){
  const meta={sourceName:'Crunchyroll Notícias',sourceKey:'CRUNCHYROLL',sourceLanguage:'pt-BR'},errors=[];
  for(const loc of ['pt-BR','pt-PT']){
    try{const items=rss(await get(`https://cr-news-api-service.prd.crunchyrollsvc.com/v1/${loc}/rss`),{...meta,sourceLanguage:loc});if(items.length)return{items,mode:`rss:${loc}`,errors}}catch(e){errors.push(e.message)}
  }
  return{items:[],mode:'failed',errors};
}
async function mal(){try{return{items:rss(await get('https://myanimelist.net/rss/news.xml'),{sourceName:'MyAnimeList',sourceKey:'MAL',sourceLanguage:'en'}),mode:'rss',errors:[]}}catch(e){return{items:[],mode:'failed',errors:[e.message]}}}
async function ann(){try{return{items:rss(await get('https://www.animenewsnetwork.com/all/rss.xml?ann-edition=us'),{sourceName:'Anime News Network',sourceKey:'ANN',sourceLanguage:'en'}),mode:'rss',errors:[]}}catch(e){return{items:[],mode:'failed',errors:[e.message]}}}

export function languageScore(v){const w=cleanText(v,12000).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().match(/[a-z]+/g)||[],pt=new Set('de da do das dos e que para com uma um foi sera novo nova temporada estreia elenco episodio manga filme noticia noticias confirmou anunciou revela ganha divulga chega brasil brasileiro pela pelo mais tambem ainda segundo durante entre sobre apos antes producao diretor estudio dublagem lancamento data trailer visual obra editora'.split(' ')),en=new Set('the and of to for with from new will season reveals announces announced release cast episode movie news reviews review worldwide debut interest licenses launches adds gets confirms more director studio staff premiere streaming'.split(' '));let p=0,n=0;for(const x of w){p+=pt.has(x);n+=en.has(x)}return{pt:p,en:n}}
export function likelyPortuguese(v){const x=languageScore(v);return x.pt>=2&&x.pt>=x.en}

const trCache=new Map();
async function translate(v,max=9000){const text=cleanText(v,max);if(!text)return'';if(trCache.has(text))return trCache.get(text);for(let i=0;i<2;i++){try{const r=await fetch(TR+encodeURIComponent(text),{headers:{'user-agent':UA}});if(r.ok){const j=await r.json(),out=cleanText((j?.[0]||[]).map(x=>x?.[0]||'').join(''),max);if(out){trCache.set(text,out);return out}}}catch{}await wait(180)}return''}

async function localize(x){
  if(String(x.sourceLanguage).startsWith('pt')&&likelyPortuguese(`${x.title} ${x.summary} ${(x.articleFacts||[]).slice(0,3).join(' ')}`))return x;
  const markers=['<<<NX0>>>','<<<NX1>>>','<<<NX2>>>'];
  const factText=(x.articleFacts||[]).slice(0,12).join(' || '),raw=await translate(`${x.title} ${markers[0]} ${x.summary||''} ${markers[1]} ${factText} ${markers[2]}`,11000);
  if(!raw)return null;const a=raw.split(markers[0]),b=(a[1]||'').split(markers[1]),c=(b[1]||'').split(markers[2]),title=cleanText(a[0],260),summary=cleanText(b[0],2600),facts=splitFacts(c[0]||'',16);if(!title||!summary||!likelyPortuguese(`${title} ${summary}`))return null;
  return{...x,originalTitle:x.title,title,summary,articleFacts:facts,sourceLanguage:'pt-BR'};
}

function junk(x){return /all the news and reviews|news and interest|weekly roundup|this week in anime|interest fool night|convention coverage|live blog|lista(?:o|ão):/i.test(`${x.title} ${x.summary}`)||cleanText(x.title).length>220}
function recent(x,h){const t=Date.parse(x.publishedAt||x.modifiedAt||'');return Number.isFinite(t)&&Date.now()-t>=-36*3600000&&Date.now()-t<=h*3600000}
function priority(x){return x.sourceKey?.startsWith('JBOX')?8:x.sourceKey==='CRUNCHYROLL'?6:x.sourceKey==='MAL'?2:1}

async function enrich(x){
  if(x.articleText&&x.articleFacts?.length)return x;
  try{
    const html=await get(x.url,'text',12000),m=metaFromHtml(html,x.url),facts=m.facts||[];
    return{...x,title:x.title||m.title,summary:cleanText([x.summary,m.description].filter(Boolean).join(' '),2800),imageUrl:safeUrl(x.imageUrl||m.imageUrl),publishedAt:x.publishedAt||m.publishedAt,author:x.author||m.author,articleText:m.articleText,articleFacts:facts,headings:m.headings||[]};
  }catch{return{...x,articleFacts:x.articleFacts||[],articleText:x.articleText||''}}
}

async function fallbackImage(x,type){
  if(x.imageUrl)return x.imageUrl;
  let q=cleanText(x.title,170).replace(/[“”"'‘’]/g,' ').split(/\b(?:ganha|revela|confirma|anuncia|estreia|temporada|trailer|anime|manga|mangá|season|reveals|announces|confirms|gets|licenses|tera|terá)\b/i)[0].trim();if(q.length<3)return'';
  for(const kind of type==='MANGA'?['manga','anime']:['anime','manga']){try{const j=await get(`https://api.jikan.moe/v4/${kind}?q=${encodeURIComponent(q.slice(0,90))}&limit=1`,'json',8500),m=j?.data?.[0],img=safeUrl(m?.images?.jpg?.large_image_url||m?.images?.jpg?.image_url||'');if(img)return img}catch{}}
  return'';
}

function uniqueFacts(values,max=22){const out=[],seen=new Set();for(const v of values.flatMap(x=>splitFacts(x,30))){const key=v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();if(!key||seen.has(key))continue;seen.add(key);out.push(v);if(out.length>=max)break}return out}
function selectFacts(facts,re,max=7){return facts.filter(x=>re.test(x)).slice(0,max)}
function remainingFacts(facts,used,max=8){const keys=new Set(used.map(x=>x.toLowerCase()));return facts.filter(x=>!keys.has(x.toLowerCase())).slice(0,max)}
function makeSections(best,facts,type,sources){
  const release=selectFacts(facts,/estreia|lan[cç]amento|data|dia \d|m[eê]s|202[5-9]|streaming|crunchyroll|netflix|cinema|brasil|jap[aã]o|exibi[cç][aã]o|dispon[ií]vel/i,7),production=selectFacts(facts,/est[uú]dio|diretor|dire[cç][aã]o|roteiro|elenco|voz|dubl|staff|produ[cç][aã]o|anima[cç][aã]o|compositor|m[uú]sica|autor|mangak[aá]|editora/i,7),media=selectFacts(facts,/trailer|teaser|p[oô]ster|visual|imagem|v[ií]deo|clipe|pr[eé]via|abertura|encerramento/i,6),story=selectFacts(facts,/hist[oó]ria|trama|acompanha|protagonista|personagem|sinopse|arco|adapta/i,6),used=[...release,...production,...media,...story],other=remainingFacts(facts,used,8),sections=[];
  const intro=facts.slice(0,Math.min(3,facts.length));
  sections.push({heading:'O que aconteceu',paragraphs:[cleanText(best.summary,2200)],bullets:intro.length>1?intro:[]});
  if(release.length)sections.push({heading:'Estreia, lançamento e disponibilidade',bullets:release});
  if(production.length)sections.push({heading:'Produção, equipe e elenco',bullets:production});
  if(media.length)sections.push({heading:'Materiais divulgados',bullets:media});
  if(story.length)sections.push({heading:'História e contexto da obra',bullets:story});
  if(other.length)sections.push({heading:'Outros detalhes confirmados',bullets:other});
  if(sources.length>1)sections.push({heading:'Informações cruzadas',paragraphs:[`O AniNexus reuniu e comparou informações de ${sources.length} fontes monitoradas para manter esta matéria mais completa e reduzir duplicações.`]});
  sections.push({heading:'Acompanhamento AniNexus',paragraphs:[type==='MANGA'?'A matéria permanece no feed recente para receber atualizações sobre publicação, volumes, licenciamento e disponibilidade no Brasil.':type==='TRAILER'?'Novos trailers, datas, elenco e plataformas confirmadas podem ser incorporados nesta mesma página enquanto a notícia estiver ativa.':type==='SEASON'?'Quando houver data definitiva ou mudança no calendário, a mesma matéria é atualizada e a informação pode aparecer também nas áreas de temporada e programação.':'A mesma URL é atualizada quando surgem fatos relevantes adicionais, evitando várias matérias rasas sobre o mesmo assunto.']});
  return sections;
}

async function build(group,min){
  const localized=[];for(const x of group){const y=await localize(x);if(y)localized.push(y)}if(!localized.length)return{reason:'translation'};
  localized.sort((a,b)=>(!!b.imageUrl-!!a.imageUrl)||priority(b)-priority(a)||(b.articleFacts?.length||0)-(a.articleFacts?.length||0)||cleanText(b.summary).length-cleanText(a.summary).length);
  const best=localized[0],type=classifyNews(best),sources=mergeSources([],localized.map(x=>({name:x.sourceName,url:x.url,publishedAt:x.publishedAt,author:x.author}))),facts=uniqueFacts(localized.flatMap(x=>[x.summary,...(x.articleFacts||[])]),22),summary=cleanText(best.summary||facts.slice(0,2).join(' '),2200);
  if(summary.length<60||facts.length<2||!likelyPortuguese(`${best.title} ${summary}`))return{reason:'quality'};
  const imageUrl=await fallbackImage(best,type);if(!imageUrl)return{reason:'quality'};
  const sections=makeSections(best,facts,type,sources),wordCount=cleanText([summary,...sections.flatMap(s=>[...(s.paragraphs||[]),...(s.bullets||[])])].join(' '),50000).split(/\s+/).filter(Boolean).length,publishedAt=new Date(Math.max(...localized.map(x=>Date.parse(x.publishedAt||x.modifiedAt||'')).filter(Number.isFinite),Date.now()-1)).toISOString(),baseQuality=qualityScore({title:best.title,summary,imageUrl,publishedAt,sources,facts}),richness=Math.min(.16,(facts.length>=8?.05:0)+(facts.length>=14?.05:0)+(sections.length>=5?.04:0)+(wordCount>=350?.02:0)),quality=Math.min(1,Number((baseQuality+richness).toFixed(3)));
  if(quality<min)return{reason:'quality'};
  const sourceHash=sourceFingerprint(best.url),storyHash=best.storyHash||storyFingerprint(best.title,best.summary),id=`${String(best.sourceKey).toLowerCase()}-${sha(sourceHash,8)}`;
  return{article:{id,slug:`${slugify(best.title)}-${id}`,sourceName:best.sourceName,sourceKey:best.sourceKey,sourceLanguage:'pt-BR',title:best.title,originalTitle:best.originalTitle||null,summary,sourceUrl:best.url,imageUrl,publishedAt,updatedAt:best.modifiedAt||publishedAt,category:categoryLabel(type),eventType:type,facts,contentSections:sections,sources,sourceCount:sources.length,readingMinutes:Math.max(2,Math.ceil(wordCount/210)),wordCount,qualityScore:quality,sourceHash,storyHash,coverage:{facts:facts.length,sections:sections.length,sourceCount:sources.length,ingestMode:best.ingestMode||'html'}}};
}

export async function collectEditorialStories(o={}){
  const max=Math.max(10,Math.min(60,Number(o.maxPerSource||40))),age=Math.max(48,Math.min(240,Number(o.maxAgeHours||168))),limit=Math.max(12,Math.min(80,Number(o.maxStories||60))),min=Math.max(.38,Math.min(.9,Number(o.minQuality||.5)));
  const wp=await jboxWordpress(),defs=wp.items.length?[['JBOX_WP','JBox WordPress',async()=>wp],['CRUNCHYROLL','Crunchyroll Notícias',crunchy],['MAL','MyAnimeList',mal],['ANN','Anime News Network',ann]]:[['JBOX_ANIME','JBox Anime',()=>jboxCategory('/categoria/anime/','JBOX_ANIME')],['JBOX_MANGA','JBox Mangá',()=>jboxCategory('/categoria/manga/','JBOX_MANGA')],['CRUNCHYROLL','Crunchyroll Notícias',crunchy],['MAL','MyAnimeList',mal],['ANN','Anime News Network',ann]],settled=await Promise.allSettled(defs.map(x=>x[2]())),sourceResults=[],raw=[];
  settled.forEach((r,i)=>{const [key,name]=defs[i],v=r.status==='fulfilled'?r.value:{items:[],mode:'failed',errors:[String(r.reason?.message||r.reason)]},items=(v.items||[]).slice(0,max);sourceResults.push({key,name,ok:items.length>0,count:items.length,mode:v.mode,errors:v.errors||[]});raw.push(...items)});
  const uniq=[...new Map(raw.filter(x=>x.url&&!junk(x)).map(x=>[sourceFingerprint(x.url),x])).values()],enriched=[];
  for(let i=0;i<uniq.length;i+=6)enriched.push(...await Promise.all(uniq.slice(i,i+6).map(enrich)));
  const groups=new Map();for(const x of enriched.filter(x=>recent(x,age)&&!junk(x))){const k=storyFingerprint(x.title,x.summary||x.articleText?.slice(0,900)),g=groups.get(k)||[];g.push({...x,storyHash:k});groups.set(k,g)}
  const ordered=[...groups.values()].sort((a,b)=>priority(b[0])-priority(a[0])||new Date(b[0]?.publishedAt||0)-new Date(a[0]?.publishedAt||0)),stories=[];let skippedTranslation=0,skippedQuality=0;
  for(const g of ordered){const b=await build(g,min);if(b.article)stories.push(b.article);else if(b.reason==='translation')skippedTranslation++;else skippedQuality++;if(stories.length>=limit)break}
  stories.sort((a,b)=>new Date(b.publishedAt)-new Date(a.publishedAt)||b.qualityScore-a.qualityScore||b.sourceCount-a.sourceCount);
  return{stories,sourceResults,collected:raw.length,grouped:groups.size,skippedTranslation,skippedQuality,collectorVersion:36};
}
