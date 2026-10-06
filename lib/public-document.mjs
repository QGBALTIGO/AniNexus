import fs from 'node:fs/promises';
import path from 'node:path';

const description='Acompanhe animes e mangás, organize suas listas e participe da comunidade brasileira do AniNexus.';
const pages=new Map(Object.entries({
  '/':'AniNexus — seu universo anime','/animes/catalogo':'Catálogo de animes','/mangas':'Catálogo de mangás',
  '/light-novels':'Light novels','/animes/programacao':'Calendário de animes','/animes/temporadas':'Temporadas de anime',
  '/animes/onde-assistir':'Onde assistir animes','/animes/dublados':'Animes dublados','/animes/estudios':'Estúdios de anime',
  '/noticias':'Notícias de anime e mangá','/comunidade':'Comunidade','/previsoes':'Previsões','/conquistas':'Conquistas',
  '/melhores-animes-para-assistir':'Melhores animes para assistir','/animes-mais-assistidos':'Animes mais assistidos',
  '/animes-mais-aguardados':'Animes mais aguardados','/listas-de-animes':'Listas de animes','/animes-em-alta':'Animes em alta',
  '/filmes-de-anime':'Filmes de anime','/animes-curtos':'Animes curtos','/animes-de-acao':'Animes de ação',
  '/animes-de-romance':'Animes de romance','/animes-de-fantasia':'Animes de fantasia','/animes-de-comedia':'Animes de comédia',
  '/animes-de-misterio':'Animes de mistério','/animes-de-esporte':'Animes de esporte','/animes-de-terror':'Animes de terror',
  '/sobre':'Sobre o AniNexus','/contato':'Contato','/termos':'Termos de uso','/privacidade':'Privacidade','/dmca':'Direitos autorais',
  '/termos-de-uso':'Termos de uso','/politica-de-privacidade':'Privacidade',
  '/quem-somos':'Quem somos','/colabore':'Colabore com o AniNexus','/anime-awards':'Premiação de anime',
}));
const aliases=new Map(Object.entries({'/animes':'/animes/catalogo','/catalogo':'/animes/catalogo','/programacao':'/animes/programacao',
  '/temporadas':'/animes/temporadas','/news':'/noticias','/community':'/comunidade','/manga':'/mangas',
  '/entrar':'/login','/cadastro':'/criar-conta','/conta':'/minha-conta','/light-novels':'/mangas','/descubra':'/animes-em-alta'}));
const privatePages=new Map(Object.entries({'/admin':'Administração','/minha-conta':'Minha conta','/minha-biblioteca':'Minha biblioteca',
  '/meus-animes':'Meus animes','/meus-mangas':'Meus mangás','/login':'Entrar','/criar-conta':'Criar conta',
  '/conectar-source':'Conectar conta','/diario':'Diário'}));
const clean=(value,max=180)=>String(value||'').replace(/<[^>]*>/g,' ').replace(/&(?:nbsp|amp|quot|lt|gt);/g,x=>({'&nbsp;':' ','&amp;':'&','&quot;':'"','&lt;':'<','&gt;':'>'}[x])).replace(/\s+/g,' ').replace(/\s+([.,;:!?])/g,'$1').trim().slice(0,max);
const escape=value=>String(value).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const json=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
const date=value=>{if(!value)return undefined;const d=new Date(value);return Number.isNaN(d.getTime())?undefined:d.toISOString()};
function image(value,origin){if(!value)return null;try{const u=new URL(String(value),origin);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null}catch{return null}}

export function publicDocumentRoute(raw){
  try{
    const outer=new URL(raw,'https://aninexus.com.br');
    const restored=outer.searchParams.get('p');
    if(restored&&!restored.startsWith('/'))return null;
    const u=restored?new URL(restored,'https://aninexus.com.br'):outer;
    if(u.origin!=='https://aninexus.com.br')return null;
    const route=decodeURIComponent(u.pathname).replace(/^\/AniNexus(?=\/|$)/,'').replace(/\/+$/,'')||'/';
    return route.length<=300&&!/[\x00-\x1f\\]/.test(route)?aliases.get(route)||route:null;
  }catch{return null}
}

// Resolve current on every request: an atomic frontend swap must not retain old asset URLs.
export function createPublicShellReader({file,fallback,maxBytes=2_000_000}){
  let previous;
  return async()=>{
    let resolved;
    try{resolved=await fs.realpath(file)}catch(error){if(!fallback||error.code!=='ENOENT')throw error;resolved=await fs.realpath(fallback)}
    const stat=await fs.stat(resolved);
    if(stat.size>maxBytes||!stat.isFile())throw new Error('Invalid public shell');
    const key=`${resolved}:${stat.size}:${stat.mtimeMs}`;
    if(previous?.key===key)return previous.html;
    const html=await fs.readFile(resolved,'utf8');
    if(!/<head[\s>]/i.test(html)||!/<\/head>/i.test(html))throw new Error('Invalid public shell');
    previous={key,html};return html;
  };
}

export function createPublicDocumentRenderer({readShell,query,origin='https://aninexus.com.br',timeoutMs=800,now=Date.now,cacheSize=512,ttlMs=120_000,staleGraceDays=14}){
  const base=new URL(origin);if(base.protocol!=='https:'||base.username||base.password||base.pathname!=='/')throw new Error('Invalid public origin');
  const canonicalOrigin=base.origin;
  const cache=new Map(),pending=new Map();
  const defaults=(route,title,extra={})=>({title:route==='/'?title:`${title} | AniNexus`,description,canonical:canonicalOrigin+(route||'/'),image:canonicalOrigin+'/assets/logo.png',status:200,robots:'index,follow,max-image-preview:large',...extra});
  const hidden=(route,title,status=200)=>defaults(route,title,{status,robots:'noindex,nofollow'});
  async function lookup(route){
    if(privatePages.has(route))return hidden(route,privatePages.get(route));
    if(pages.has(route))return defaults(route,pages.get(route));
    if(/^\/animes\/temporadas\/\d{4}\/(?:inverno|primavera|verao|outono)$/.test(route))return defaults(route,'Temporadas de anime');
    const media=route.match(/^\/(anime|manga)\/[^/]+-(\d+)$/);
    if(media){
      const type=media[1]==='manga'?'MANGA':'ANIME',id=Number(media[2]);
      if(!Number.isSafeInteger(id)||id<=0)return hidden(route,'Obra não encontrada',404);
      const {rows}=await query('SELECT payload FROM media_cache WHERE media_type=$1 AND media_id=$2 LIMIT 1',[type,id]);
      const item=rows[0]?.payload;
      const title=clean(typeof item?.title==='string'?item.title:item?.title?.userPreferred||item?.title?.romaji||item?.title?.english);
      if(!title)return defaults(route,type==='MANGA'?'Mangá':'Anime',{robots:'noindex,follow',fallback:true});
      return defaults(route,title,{description:clean(item.description||item.synopsis,300)||description,image:image(item.cover||item.coverImage?.extraLarge||item.coverImage?.large,canonicalOrigin)||canonicalOrigin+'/assets/logo.png'});
    }
    const article=route.match(/^\/noticias\/([a-z0-9-]{1,180})$/);
    if(article){
      const {rows}=await query(`SELECT title,summary,image_url,source_author,published_at,updated_at FROM news_articles
        WHERE slug=$1 AND status='published' AND translation_status='ready' AND language='pt-BR'
        AND (expires_at IS NULL OR expires_at>now()-($2::text||' days')::interval) LIMIT 1`,[article[1],String(staleGraceDays)]);
      const row=rows[0],title=clean(row?.title,220);if(!title)return hidden(route,'Notícia não encontrada',404);
      const result=defaults(route,title,{description:clean(row.summary,300)||description,image:image(row.image_url,canonicalOrigin)||canonicalOrigin+'/assets/logo.png',type:'article'});
      result.schema={'@context':'https://schema.org','@type':'NewsArticle',headline:title,description:result.description,image:[result.image],mainEntityOfPage:result.canonical,
        datePublished:date(row.published_at),dateModified:date(row.updated_at),publisher:{'@type':'Organization',name:'AniNexus',url:canonicalOrigin}};
      const author=clean(row.source_author,160);if(author)result.schema.author={'@type':'Person',name:author};
      return result;
    }
    const profile=route.match(/^\/u\/([\p{L}\p{N}_.-]{3,30})$/u);
    if(profile){
      const {rows}=await query(`SELECT username,display_name FROM users WHERE lower(username)=lower($1)
        AND privacy='public' AND status='active' AND deleted_at IS NULL LIMIT 1`,[profile[1]]);
      if(!rows[0])return hidden(route,'Perfil indisponível',404);
      return defaults(route,`Perfil de ${clean(rows[0].display_name||rows[0].username,100)}`);
    }
    return hidden(route,'Página não encontrada',404);
  }
  async function metadata(route){
    if(!route)return hidden('/','Página não encontrada',404);
    const cached=cache.get(route);if(cached&&cached.expires>now()){cache.delete(route);cache.set(route,cached);return cached.value}
    if(pending.has(route))return pending.get(route);
    const promise=(async()=>{
      let timer;
      try{
        const value=await Promise.race([lookup(route),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Metadata deadline')),timeoutMs)})]);
        cache.set(route,{value,expires:now()+(value.fallback?10_000:ttlMs)});return value;
      }catch{
        const value=defaults(route,'AniNexus',{robots:'noindex,follow',fallback:true});cache.set(route,{value,expires:now()+10_000});return value;
      }finally{clearTimeout(timer);pending.delete(route);while(cache.size>cacheSize)cache.delete(cache.keys().next().value)}
    })();pending.set(route,promise);return promise;
  }
  return async raw=>{
    const route=publicDocumentRoute(raw);
    const [shell,data]=await Promise.all([readShell(),metadata(route)]);
    let html=shell.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi,'').replace(/<meta\b[^>]*(?:name=["'](?:description|robots|twitter:(?:card|title|description|image))["']|property=["']og:(?:type|title|description|url|image)["'])[^>]*>/gi,'').replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi,'').replace(/<script\b[^>]*id=["']aninexus-route-structured-data["'][^>]*>[\s\S]*?<\/script>/gi,'');
    const head=`<title>${escape(data.title)}</title>\n<meta name="description" content="${escape(data.description)}">\n<meta name="robots" content="${data.robots}">\n<link rel="canonical" href="${escape(data.canonical)}">\n<meta property="og:type" content="${data.type||'website'}">\n<meta property="og:title" content="${escape(data.title)}">\n<meta property="og:description" content="${escape(data.description)}">\n<meta property="og:url" content="${escape(data.canonical)}">\n<meta property="og:image" content="${escape(data.image)}">\n<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:title" content="${escape(data.title)}">\n<meta name="twitter:description" content="${escape(data.description)}">\n<meta name="twitter:image" content="${escape(data.image)}">${data.schema?`\n<script type="application/ld+json" id="aninexus-route-structured-data">${json(data.schema)}</script>`:''}\n`;
    html=html.replace(/<\/head>/i,head+'</head>');
    return {html,status:data.status,private:privatePages.has(route),fallback:!!data.fallback};
  };
}
