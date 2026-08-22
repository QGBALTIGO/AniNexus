import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const exists=p=>fs.existsSync(path.join(root,p));
let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log(`✓ ${name}`)}catch(err){failed++;console.error(`✗ ${name}\n  ${err.message}`)}}
function ok(v,msg='assertion failed'){if(!v)throw new Error(msg)}
function includes(text,needle,msg){ok(text.includes(needle),msg||`missing ${needle}`)}
function notIncludes(text,needle,msg){ok(!text.includes(needle),msg||`unexpected ${needle}`)}

const index=read('index.html');
const router=read('preview-v23/router-v23.js');
const nav=read('preview-v27/navigation-v27.js');
const guard=read('preview-v23/route-guard-v23.js');
const detail=read('preview-v22/detail-stable-v22.js');
const detailCss=read('preview-v22/detail-v22.css');
const mediaState=read('preview-v19/media-state-v2.js');
const catalog=read('preview-v20/catalog-v20.js');
const schedule=read('preview-v18/schedule.js');
const season=read('preview-v8/app.js');
const home=read('preview-v28/home-v28.js');
const homeRuntime=read('preview-v31/home-runtime-v31.js');
const homeBridge=read('preview-v31/news-home-bridge-v31.js');
const nativeNews=read('preview-v31/native-news-v31.js');
const nativeNewsCss=read('preview-v31/native-news-v31.css');
const worker=read('lib/news-worker.mjs');
const env=read('.env.example');
const notFound=read('404.html');
const newsData=JSON.parse(read('data/news.json'));

function resolveRoute(urlString){const u=new URL(urlString),p=u.searchParams.get('p');if(p)return p.split('?')[0].replace(/\/+$/,'')||'/';let x=u.pathname.replace(/^\/AniNexus/,'')||'/';return x.replace(/\/+$/,'')||'/'}

// Routing
test('GitHub Pages query route resolves native news article',()=>ok(resolveRoute('https://qgbaltigo.github.io/AniNexus/?build=31.2.0&p=%2Fnoticias%2Fteste-abc')==='/noticias/teste-abc'));
test('Router recognizes native news article routes',()=>includes(router,"/^\\/noticias\\/[a-z0-9-]+$/.test(p)"));
test('News boot guard owns list and article routes',()=>{includes(guard,"path==='/noticias'");includes(guard,"/^\\/noticias\\/[a-z0-9-]+$/.test(path)")});
test('Router, navigation and 404 use current Pages routing build',()=>{includes(router,"BUILD='31.2.0'");includes(nav,"BUILD='31.2.0'");includes(notFound,'build=31.2.0')});
test('Index is on V31 generation',()=>includes(index,'2026-08-22-v31.'));
test('Navigation rewrites internal Pages links',()=>{includes(nav,'data.nx27Path');includes(nav,'pagesUrl(path)')});

// Home identity
test('Home keeps functional season schedule ranking and community data',()=>{['aqxSeason','aqxSchedule','aqxTop','aqxAwards','aqxPopular','aqxCommunity'].forEach(x=>includes(home,x));includes(home,'/api/community/threads?limit=10');includes(home,'/impressions')});
test('Home runtime removes tag section instead of displaying the old tag cloud',()=>{includes(homeRuntime,"if(title==='Tags')section.remove()");includes(homeRuntime,'nx31-hero-sigil');includes(homeRuntime,'nx31-universe-strip');includes(homeRuntime,'SINAL ANINEXUS')});
test('AniNexus hero has branded animated signature',()=>{includes(homeRuntime,'ANINEXUS · SEU UNIVERSO ANIME');includes(homeRuntime,'nx31Ring');includes(homeRuntime,'A comunidade está viva')});
test('Home news bridge uses database slugs and internal AniNexus news routes',()=>{includes(homeBridge,"fetch('/api/news?limit=5'");includes(homeBridge,'/api/news/${encodeURIComponent(x.slug)}');includes(homeBridge,'/noticias/${x.slug}');notIncludes(homeBridge,'window.open(')});

// Native news
test('Native news hub and article reader live inside AniNexus',()=>{includes(nativeNews,"path==='/noticias'");includes(nativeNews,'/api/news?limit=36');includes(nativeNews,'Ler no AniNexus');includes(nativeNews,'nx31-article-body');notIncludes(nativeNews,"window.open(")});
test('Native news keeps source as credit, not outbound reading CTA',()=>{includes(nativeNews,'FONTE MONITORADA');includes(nativeNews,'metadados internos');notIncludes(nativeNews,'Ler na fonte')});
test('Native news has filters and search',()=>{['Tudo','Animes','Mangás & novels','Trailers','Episódios','Notícias'].forEach(x=>includes(nativeNews,x));includes(nativeNews,'nx31Search')});
test('Native news CSS has dedicated responsive hub and article layouts',()=>{includes(nativeNewsCss,'.nx31-feature-grid');includes(nativeNewsCss,'.nx31-article-layout');includes(nativeNewsCss,'@media(max-width:720px)')});

test('News worker ingests monitored editorial sources',()=>{includes(worker,'Crunchyroll Notícias');includes(worker,'Anime News Network');includes(worker,'MyAnimeList');includes(worker,'syncEditorialSources()')});
test('News worker translates and publishes native automated rows',()=>{includes(worker,'translate.googleapis.com');includes(worker,"source_kind,event_type,title,summary,body");includes(worker,"'AUTOMATED'");includes(worker,'articlePayload')});
test('Automated news has short retention and automatic cleanup',()=>{includes(worker,'NEWS_RETENTION_DAYS');includes(worker,'cleanupOld()');includes(env,'NEWS_RETENTION_DAYS=5');includes(env,'NEWS_MAX_PER_SOURCE=14')});
test('Worker stores image and source metadata for native article rendering',()=>{includes(worker,'imageUrl');includes(worker,'sourceName');includes(worker,'sourceUrl');includes(worker,'originalTitle')});

test('Bundled fallback news has a valid structure',()=>{ok(Array.isArray(newsData.items),'items missing');ok(newsData.items.length>=3,'not enough news items');ok(Array.isArray(newsData.sources)&&newsData.sources.length>=2,'sources missing');ok(!Number.isNaN(new Date(newsData.generatedAt).getTime()),'invalid generatedAt')});
test('Every bundled fallback item has traceable source and date',()=>newsData.items.forEach((x,i)=>{ok(x.title,`item ${i} missing title`);ok(x.source,`item ${i} missing source`);ok(/^https:\/\//.test(x.url||''),`item ${i} invalid source URL`);ok(!Number.isNaN(new Date(x.publishedAt).getTime()),`item ${i} invalid date`)}));

// Existing product contracts
test('Anime detail embeds trailer and complete metadata',()=>{includes(detail,'https://www.youtube-nocookie.com/embed/');['LANÇAMENTO','TÉRMINO','Personagens','Franquia e relações','Recomendações'].forEach(x=>includes(detail,x))});
test('Anime detail remains mobile-first and trailer stays 16:9',()=>{includes(detailCss,'@media(max-width:720px)');includes(detailCss,'aspect-ratio:16/9')});
test('Shared media state keeps five user statuses',()=>['PLANNING','CURRENT','COMPLETED','PAUSED','DROPPED'].forEach(x=>includes(mediaState,`${x}:`)));
test('Quero Ver cannot carry a score',()=>includes(mediaState,"if(s.status==='PLANNING'){s.progress=0;s.score=null}"));
test('Catalog, schedule and season still participate in unified media state',()=>{includes(catalog,'data-list=');includes(catalog,'data-fav=');ok(/data-nx18-(?:status|fav)/.test(schedule),'schedule hooks missing');ok(/data-nx-(?:list|fav)/.test(season),'season hooks missing')});

// Critical assets
test('Critical V31 assets exist',()=>[
  'preview-v31/home-runtime-v31.js','preview-v31/news-home-bridge-v31.js','preview-v31/native-news-v31.js','preview-v31/native-news-v31.css',
  'preview-v23/router-v23.js','preview-v23/route-guard-v23.js','lib/news-worker.mjs','data/news.json','404.html'
].forEach(p=>ok(exists(p),`missing ${p}`)));
test('Index still loads route guard before legacy app renderer',()=>ok(index.indexOf('route-guard-v23.js')<index.indexOf('preview-v6/app.js'),'route guard must load first'));
test('Superseded V24/V26 home runtimes stay unloaded',()=>{notIncludes(index,'preview-v24/home-v24.js');notIncludes(index,'preview-v26/home-v26.js')});

console.log(`\nAniNexus smoke: ${passed} passed, ${failed} failed`);
if(failed)process.exit(1);
