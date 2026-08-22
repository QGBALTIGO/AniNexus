import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
const root=process.cwd(),read=p=>fs.readFileSync(path.join(root,p),'utf8'),exists=p=>fs.existsSync(path.join(root,p));let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log(`✓ ${name}`)}catch(err){failed++;console.error(`✗ ${name}\n  ${err.message}`)}}function ok(v,msg='assertion failed'){if(!v)throw new Error(msg)}function includes(t,n,m){ok(t.includes(n),m||`missing ${n}`)}function notIncludes(t,n,m){ok(!t.includes(n),m||`unexpected ${n}`)}
const index=read('index.html'),router=read('preview-v23/router-v23.js'),nav=read('preview-v27/navigation-v27.js'),newsGuard=read('preview-v32/news-route-guard-v32.js'),home=read('preview-v28/home-v28.js'),home33=read('preview-v33/home-v33.js'),home33Css=read('preview-v33/home-v33.css'),news=read('preview-v33/news-v33.js'),news33=read('preview-v33/news-v33.js'),news33Css=read('preview-v33/news-v33.css'),worker=read('lib/news-worker-v33.mjs'),native=read('lib/native-news.mjs'),migration=read('sql/005_news_quality_and_revisions.sql'),env=read('.env.example'),compose=read('docker-compose.yml'),detail=read('preview-v22/detail-stable-v22.js'),detailCss=read('preview-v22/detail-v22.css'),mediaState=read('preview-v19/media-state-v2.js'),catalog=read('preview-v20/catalog-v20.js'),schedule=read('preview-v18/schedule.js'),season=read('preview-v8/app.js'),notFound=read('404.html'),pkg=JSON.parse(read('package.json'));
function resolveRoute(s){const u=new URL(s),p=u.searchParams.get('p');if(p)return p.split('?')[0].replace(/\/+$/,'')||'/';let x=u.pathname.replace(/^\/AniNexus/,'')||'/';return x.replace(/\/+$/,'')||'/'}

test('GitHub Pages resolves V33 internal news routes',()=>ok(resolveRoute('https://qgbaltigo.github.io/AniNexus/?build=33.0.0&p=%2Fnoticias%2Fteste-abc')==='/noticias/teste-abc'));
test('router recognizes news list and article routes',()=>{includes(router,"'/noticias'");includes(router,"/^\\/noticias\\/[a-z0-9-]+$/.test(p)")});
test('routing assets use V33 build',()=>{includes(router,"BUILD='33.0.0'");includes(nav,"BUILD='33.0.0'");includes(notFound,'build=33.0.0')});
test('news guard still owns news before legacy boot',()=>includes(newsGuard,'window.__NX_NEWS_V32_ROUTE__'));
test('index activates V33 without the duplicate V29-V32 home enhancers',()=>{includes(index,'2026-08-22-v33.0.0');includes(index,'preview-v33/home-v33.js');includes(index,'preview-v33/news-v33.css');notIncludes(index,'preview-v29/home-fidelity-v29.js');notIncludes(index,'preview-v30/home-content-v30.js');notIncludes(index,'preview-v31/home-runtime-v31.js');notIncludes(index,'preview-v32/home-news-v32.js');notIncludes(index,'preview-v32/news-v32.js')});

test('base home keeps all discovery data sections',()=>['aqxSeason','aqxSchedule','aqxTop','aqxAwards','aqxPopular','aqxCommunity'].forEach(x=>includes(home,x)));
test('V33 home has one branded hero and removes Tags',()=>{includes(home33,'nx33-brand-lockup');includes(home33,'nx33-hero-actions');includes(home33,"t==='Tags'");includes(home33,'cleanLegacy')});
test('V33 home adds internal news and manga sections',()=>{includes(home33,'nx33-news-section');includes(home33,'nx33-reading-section');includes(home33,'/noticias/${x.slug}');includes(home33,'/manga/${slug(t)}-${m.id}')});
test('V33 home has dynamic edge shading',()=>{includes(home33,'scrollWidth-el.clientWidth');includes(home33,'data-nx33-right');includes(home33Css,'.nx33-edge-host[data-nx33-right="1"]:after')});
test('AniNexus red identity dominates Home',()=>{includes(home33Css,'#e3264f');includes(home33Css,'.nx33-orbit');includes(home33Css,'.nx33-live-head')});

test('V33 worker is the active package worker',()=>ok(pkg.scripts['worker:news']==='node lib/news-worker-v33.mjs'));
test('V33 worker monitors three external source families',()=>['Crunchyroll Notícias','Anime News Network','MyAnimeList'].forEach(x=>includes(worker,x)));
test('V33 worker translation and quality gates prevent low-quality English publication',()=>{includes(worker,'pair.ready');includes(worker,'skippedTranslation');includes(worker,'NEWS_MIN_QUALITY');includes(worker,'skippedQuality')});
test('V33 worker enriches images and source pages',()=>{includes(worker,'extractHtmlMetadata');includes(worker,'fallbackImage');includes(worker,'getCatalog');includes(worker,'getReading')});
test('V33 worker deduplicates and revisions stories',()=>{includes(worker,'groupStories');includes(worker,'storyFingerprint');includes(worker,'news_article_revisions');includes(worker,'content_signature')});
test('V33 worker persists health and ingest telemetry',()=>{includes(worker,'news_source_health');includes(worker,'news_ingest_runs')});
test('native feed exposes only live Portuguese-ready articles',()=>{includes(native,"translation_status='ready'");includes(native,"language='pt-BR'");includes(native,'expires_at>now()')});
test('news schema has revisions and ingest observability',()=>['news_article_revisions','news_ingest_runs','content_version','translation_status','source_count'].forEach(x=>includes(migration,x)));
test('short retention and quality threshold are configurable in deployment',()=>{includes(env,'NEWS_RETENTION_DAYS=5');includes(env,'NEWS_MIN_QUALITY=0.54');includes(compose,'NEWS_MIN_QUALITY: ${NEWS_MIN_QUALITY:-0.54}')});

test('news hub and reader stay internal',()=>{includes(news,'Ler no AniNexus');includes(news,"p==='/noticias'");includes(news,'nx32-reading-progress');notIncludes(news,'Ler na fonte');notIncludes(news,'window.open(')});
test('V33 news visual polish fixes oversized fallbacks and supports scroll fades',()=>{includes(news33Css,'aspect-ratio:16/9');includes(news33Css,'.nx32-image-fallback img');includes(news33Css,'.nx33-news-edge');includes(news33,'scrollWidth-scroller.clientWidth')});
test('anime detail contracts remain intact',()=>{includes(detail,'https://www.youtube-nocookie.com/embed/');['LANÇAMENTO','TÉRMINO','Personagens','Franquia e relações','Recomendações'].forEach(x=>includes(detail,x));includes(detailCss,'aspect-ratio:16/9')});
test('shared media state remains unified',()=>{['PLANNING','CURRENT','COMPLETED','PAUSED','DROPPED'].forEach(x=>includes(mediaState,`${x}:`));includes(catalog,'data-list=');includes(catalog,'data-fav=');ok(/data-nx18-(?:status|fav)/.test(schedule));ok(/data-nx-(?:list|fav)/.test(season))});
test('critical V33 files exist',()=>['lib/news-worker-v33.mjs','sql/005_news_quality_and_revisions.sql','preview-v33/home-v33.js','preview-v33/home-v33.css','preview-v33/news-v33.js','preview-v33/news-v33.css','tests/news-system.mjs'].forEach(p=>ok(exists(p),`missing ${p}`)));
test('route guard loads before legacy app',()=>ok(index.indexOf('route-guard-v23.js')<index.indexOf('preview-v6/app.js')));
console.log(`\nAniNexus V33 smoke: ${passed} passed, ${failed} failed`);if(failed)process.exit(1);
