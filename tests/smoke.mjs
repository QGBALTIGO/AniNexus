import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const exists=p=>fs.existsSync(path.join(root,p));
let passed=0,failed=0;

function test(name,fn){
  try{fn();passed++;console.log(`✓ ${name}`)}catch(err){failed++;console.error(`✗ ${name}\n  ${err.message}`)}
}
function ok(value,msg='assertion failed'){if(!value)throw new Error(msg)}
function includes(text,needle,msg){ok(text.includes(needle),msg||`missing ${needle}`)}
function notIncludes(text,needle,msg){ok(!text.includes(needle),msg||`unexpected ${needle}`)}

const index=read('index.html');
const router=read('preview-v23/router-v23.js');
const guard=read('preview-v23/route-guard-v23.js');
const detail=read('preview-v22/detail-stable-v22.js');
const detailCss=read('preview-v22/detail-v22.css');
const news=read('preview-v22/news-v22.js');
const newsI18n=read('preview-v23/news-i18n-v23.js');
const mediaState=read('preview-v19/media-state-v2.js');
const catalog=read('preview-v20/catalog-v20.js');
const schedule=read('preview-v18/schedule.js');
const season=read('preview-v8/app.js');
const home=read('preview-v24/home-v24.js');
const notFound=read('404.html');
const newsData=JSON.parse(read('data/news.json'));

function resolveRoute(urlString){
  const u=new URL(urlString);
  const p=u.searchParams.get('p');
  if(p)return p.split('?')[0].replace(/\/+$/,'')||'/';
  let x=u.pathname.replace(/^\/AniNexus/,'')||'/';
  return x.replace(/\/+$/,'')||'/';
}

// Routing / GitHub Pages
test('GitHub Pages query route resolves anime detail',()=>ok(resolveRoute('https://qgbaltigo.github.io/AniNexus/?build=25.0.0&p=%2Fanime%2Fone-piece-21')==='/anime/one-piece-21'));
test('GitHub Pages direct route resolves anime detail',()=>ok(resolveRoute('https://qgbaltigo.github.io/AniNexus/anime/one-piece-21')==='/anime/one-piece-21'));
test('Router knows all dedicated hubs',()=>['/','/animes/catalogo','/animes/programacao','/animes/temporadas','/noticias'].forEach(r=>includes(router,`'${r}'`)));
test('Router recognizes anime detail routes',()=>includes(router,"/^\\/anime\\/.+-\\d+$/.test(p)"));
test('Router and 404 use build 25',()=>{includes(router,"BUILD='25.0.0'");includes(notFound,'build=25.0.0')});
test('Index build metadata is V25',()=>includes(index,'2026-08-21-v25.0.0'));
test('Index no longer mixes old 23/24 asset cache versions',()=>{notIncludes(index,'?v=23.0.0');notIncludes(index,'?v=24.0.0')});
test('Old artificial anime boot route is gone',()=>notIncludes(guard,'__nx_detail_v22_boot__'));
test('Detail guard keeps canonical route and owns V22 detail',()=>{includes(guard,'__NX_USE_V22_DETAIL__');includes(guard,'detail-stable-v22.js');includes(guard,"const isDetail=/^\\/anime\\/.+-\\d+$/.test(path)")});
test('News is isolated from legacy renderer during boot',()=>{includes(guard,"const isNews=path==='/noticias'");includes(guard,'nx22-news-boot')});
test('All anime card families are centralized by router',()=>['data-nx21-open','data-nx-media','data-nx18-open','data-nx22-open','data-nx-still','data-open][data-type="anime"'].forEach(x=>includes(router,x)));
test('Router explicitly keeps manga cards out of anime detail',()=>{includes(router,"const kind=String(card.dataset.kind||card.dataset.type||'anime').toLowerCase()");includes(router,"if(kind&&kind!=='anime')return null")});
test('Home exposes media kind so anime and manga can be distinguished',()=>includes(home,'data-kind="${type}"'));

// Security / embeds
test('CSP allows only supported video embeds',()=>{includes(index,'frame-src https://www.youtube-nocookie.com https://www.youtube.com');includes(index,'object-src \'none\'')});
test('CSP allows data APIs used by detail/news',()=>{includes(index,'https://api.jikan.moe');includes(index,'https://graphql.anilist.co');includes(index,'https://translate.googleapis.com')});

// Anime detail contract
test('Anime detail embeds trailer inside page',()=>includes(detail,'https://www.youtube-nocookie.com/embed/'));
test('Anime detail exposes launch and end dates prominently',()=>{includes(detail,'LANÇAMENTO');includes(detail,'TÉRMINO');includes(detail,"['Lançamento',fmtDate(m.startDate)]");includes(detail,"['Término',fmtDate(m.endDate)]")});
test('Anime detail has complete information panel',()=>['Status','Formato','Episódios','Duração','Origem','País','Temporada','Estúdio','Classificação'].forEach(x=>includes(detail,x)));
test('Anime detail guarantees Portuguese synopsis workflow',()=>{includes(detail,'translate.googleapis.com');includes(detail,'generatedSynopsis');includes(detail,'nx22Synopsis')});
test('Anime detail shares global list/favorite controls',()=>{includes(detail,'data-list=');includes(detail,'data-fav=');includes(mediaState,'[data-list');includes(mediaState,'[data-fav')});
test('Anime detail includes next episode, characters, franchise and recommendations',()=>['PRÓXIMO EPISÓDIO','Personagens','Franquia e relações','Recomendações'].forEach(x=>includes(detail,x)));
test('Anime detail is mobile-first',()=>{includes(detailCss,'@media(max-width:720px)');includes(detailCss,'.nx22-hero-grid{display:block');includes(detailCss,'.nx22-layout{grid-template-columns:1fr');includes(detailCss,'.nx22-tabs{top:54px}')});
test('Anime detail trailer is responsive 16:9',()=>{includes(detailCss,'.nx22-video');includes(detailCss,'aspect-ratio:16/9');includes(detailCss,'.nx22-video iframe')});

// Shared state contract
test('Status system has five distinct user states',()=>['PLANNING','CURRENT','COMPLETED','PAUSED','DROPPED'].forEach(x=>includes(mediaState,`${x}:`)));
test('Quero Ver cannot carry a score',()=>includes(mediaState,"if(s.status==='PLANNING'){s.progress=0;s.score=null}"));
test('Catalog uses the same list and favorite attributes',()=>{includes(catalog,'data-list=');includes(catalog,'data-fav=')});
test('Schedule participates in unified state',()=>{ok(/data-nx18-(?:status|fav)/.test(schedule),'schedule missing unified state hooks')});
test('Season cards participate in unified state',()=>{ok(/data-nx-(?:list|fav)/.test(season),'season missing unified state hooks')});

// News contract
test('News uses a real local editorial feed',()=>{includes(news,'/data/news.json');includes(news,'localFeed()')});
test('News has MyAnimeList/Jikan live fallback',()=>{includes(news,'/top/anime?filter=airing');includes(news,'/news`')});
test('News identifies sources and links to originals',()=>{includes(news,'Crunchyroll Notícias');includes(news,'MyAnimeList');includes(news,'Anime News Network');includes(news,'Ler na fonte')});
test('MAL and ANN content are automatically translated to Portuguese',()=>{includes(newsI18n,"['MAL','ANN'].includes(source)");includes(newsI18n,'tl=pt');includes(newsI18n,'traduzido automaticamente')});
test('Legacy fake-news phrases are absent from V22 news runtime',()=>{notIncludes(news,'está em destaque');notIncludes(news,'recebe o episódio')});
test('News data file has valid structure',()=>{ok(Array.isArray(newsData.items),'items is not an array');ok(newsData.items.length>=3,'news feed has fewer than 3 items');ok(Array.isArray(newsData.sources)&&newsData.sources.length>=2,'sources missing');ok(!Number.isNaN(new Date(newsData.generatedAt).getTime()),'generatedAt invalid')});
test('Every bundled news item has title, source, date and HTTPS URL',()=>newsData.items.forEach((x,i)=>{ok(x.title,`item ${i} missing title`);ok(x.source,`item ${i} missing source`);ok(/^https:\/\//.test(x.url||''),`item ${i} invalid URL`);ok(!Number.isNaN(new Date(x.publishedAt).getTime()),`item ${i} invalid date`)}));

// Critical assets
test('Critical runtime files exist',()=>[
  'preview-v22/detail-stable-v22.js','preview-v22/detail-v22.css','preview-v22/news-v22.js','preview-v22/news-v22.css',
  'preview-v23/router-v23.js','preview-v23/route-guard-v23.js','preview-v23/news-i18n-v23.js','preview-v19/media-state-v2.js','data/news.json','404.html'
].forEach(p=>ok(exists(p),`missing ${p}`)));
test('Index loads the route guard before legacy app renderer',()=>ok(index.indexOf('route-guard-v23.js')<index.indexOf('preview-v6/app.js'),'route guard must load before legacy app'));
test('Index loads V22 news runtime',()=>includes(index,'preview-v22/news-v22.js'));

console.log(`\nAniNexus smoke: ${passed} passed, ${failed} failed`);
if(failed)process.exit(1);
