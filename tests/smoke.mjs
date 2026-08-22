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
const newsGuard=read('preview-v32/news-route-guard-v32.js');
const news=read('preview-v32/news-v32.js');
const newsCss=read('preview-v32/news-v32.css');
const home=read('preview-v28/home-v28.js');
const homeRuntime=read('preview-v31/home-runtime-v31.js');
const homeNews=read('preview-v32/home-news-v32.js');
const homeCss=read('preview-v32/home-v32.css');
const core=read('lib/news-core.mjs');
const worker=read('lib/news-worker.mjs');
const native=read('lib/native-news.mjs');
const migration=read('sql/004_news_editorial_pipeline.sql');
const env=read('.env.example');
const compose=read('docker-compose.yml');
const detail=read('preview-v22/detail-stable-v22.js');
const detailCss=read('preview-v22/detail-v22.css');
const mediaState=read('preview-v19/media-state-v2.js');
const catalog=read('preview-v20/catalog-v20.js');
const schedule=read('preview-v18/schedule.js');
const season=read('preview-v8/app.js');
const notFound=read('404.html');
const newsData=JSON.parse(read('data/news.json'));

function resolveRoute(urlString){const u=new URL(urlString),p=u.searchParams.get('p');if(p)return p.split('?')[0].replace(/\/+$/,'')||'/';let x=u.pathname.replace(/^\/AniNexus/,'')||'/';return x.replace(/\/+$/,'')||'/'}

// Routing and activation
test('GitHub Pages resolves V32 native article routes',()=>ok(resolveRoute('https://qgbaltigo.github.io/AniNexus/?build=32.0.0&p=%2Fnoticias%2Fteste-abc')==='/noticias/teste-abc'));
test('Router recognizes news list and article routes',()=>{includes(router,"'/noticias'");includes(router,"/^\\/noticias\\/[a-z0-9-]+$/.test(p)")});
test('V32 guard owns news before legacy V23 news boot',()=>{includes(newsGuard,"window.__NX_NEWS_V32_ROUTE__");includes(guard,'!window.__NX_NEWS_V32_ROUTE__')});
test('Pages routing components use V32 build',()=>{includes(router,"BUILD='32.0.0'");includes(nav,"BUILD='32.0.0'");includes(notFound,'build=32.0.0')});
test('Index activates V32 and unloads V31 news UI',()=>{includes(index,'2026-08-22-v32.0.0');includes(index,'preview-v32/news-v32.js');includes(index,'preview-v32/home-news-v32.js');notIncludes(index,'preview-v31/native-news-v31.js');notIncludes(index,'preview-v31/news-home-bridge-v31.js')});

// Home
test('Home keeps core discovery sections and real community activity',()=>{['aqxSeason','aqxSchedule','aqxTop','aqxAwards','aqxPopular','aqxCommunity'].forEach(x=>includes(home,x));includes(home,'/api/community/threads?limit=10')});
test('Home removes old Tags section',()=>{includes(homeRuntime,"if(title==='Tags')section.remove()");includes(homeNews,"if(title==='Tags')section.remove()")});
test('Home hero keeps distinct AniNexus identity',()=>{includes(homeRuntime,'ANINEXUS · SEU UNIVERSO ANIME');includes(homeRuntime,'nx31-hero-sigil');includes(homeCss,'#e3264f');includes(homeCss,'nx32-home-news-layout')});
test('Home news is database-first and routes internally',()=>{includes(homeNews,"fetch('/api/news?limit=7'");includes(homeNews,'/noticias/${x.slug}');notIncludes(homeNews,'window.open(')});

// Pipeline
test('News core canonicalizes sources and fingerprints stories',()=>{includes(core,'canonicalUrl');includes(core,'sourceFingerprint');includes(core,'storyFingerprint')});
test('News core extracts article metadata and creates structured editorial copy',()=>{includes(core,'extractHtmlMetadata');includes(core,'buildEditorialArticle');includes(core,"heading:'O que aconteceu'");includes(core,'readingMinutes')});
test('Worker monitors three source families',()=>{includes(worker,'Crunchyroll Notícias');includes(worker,'Anime News Network');includes(worker,'MyAnimeList');includes(worker,'syncEditorialSources')});
test('Worker enriches upstream pages before publishing',()=>{includes(worker,'extractHtmlMetadata');includes(worker,'async function enrich');includes(worker,'ENRICH_LIMIT')});
test('Worker translates to Portuguese with Redis cache',()=>{includes(worker,'translatePt');includes(worker,'news:pt:');includes(worker,'redis?.set')});
test('Worker consolidates same-story sources instead of URL-only cards',()=>{includes(worker,'groupStories');includes(worker,'storyFingerprint');includes(worker,'mergeSources');includes(worker,'story_hash')});
test('Worker persists reading metadata, quality and structured sections',()=>{['content_sections','reading_minutes','word_count','quality_score','sources'].forEach(x=>includes(worker,x))});
test('Automated news expires in a short retention window',()=>{includes(worker,'NEWS_RETENTION_DAYS');includes(worker,"status='archived'");includes(env,'NEWS_RETENTION_DAYS=5');includes(compose,'NEWS_RETENTION_DAYS: ${NEWS_RETENTION_DAYS:-5}')});
test('DB migration supports dedupe, provenance and reader metadata',()=>{['source_hash','story_hash','sources jsonb','content_sections jsonb','reading_minutes','quality_score','view_count'].forEach(x=>includes(migration,x))});
test('Native DB reader filters expired articles',()=>{includes(native,"status='published'");includes(native,'expires_at>now()');includes(native,'quality_score')});

// V32 UI
test('News hub stays entirely inside AniNexus',()=>{includes(news,"path==='/noticias'");includes(news,"fetch('/api/news?limit=50'");includes(news,'Ler no AniNexus');notIncludes(news,'Ler na fonte');notIncludes(news,'window.open(')});
test('Reader includes progress, summary, structured sections and related stories',()=>{includes(news,'nx32-reading-progress');includes(news,'EM RESUMO');includes(news,'content_sections');includes(news,'CONTINUE LENDO')});
test('Reader explains AniNexus editorial synthesis instead of copying source articles',()=>{includes(news,'O texto integral de terceiros não é reproduzido');includes(news,'URLs de origem ficam registradas internamente')});
test('Reader remembers already-read stories',()=>{includes(news,'aninexus:news:read:v1');includes(news,'markRead');includes(news,'nx32-read-badge')});
test('News visual system is responsive and branded',()=>{includes(newsCss,'.nx32-news-hero');includes(newsCss,'.nx32-article-layout');includes(newsCss,'#e3264f');includes(newsCss,'@media(max-width:760px)')});

// Fallback feed
test('Bundled news fallback remains structurally valid for GitHub Pages',()=>{ok(Array.isArray(newsData.items));ok(newsData.items.length>=3);ok(Array.isArray(newsData.sources)&&newsData.sources.length>=2);ok(!Number.isNaN(new Date(newsData.generatedAt).getTime()))});
test('Fallback items keep source provenance and timestamp',()=>newsData.items.forEach((x,i)=>{ok(x.title,`item ${i} title`);ok(x.source,`item ${i} source`);ok(/^https:\/\//.test(x.url||''),`item ${i} url`);ok(!Number.isNaN(new Date(x.publishedAt).getTime()),`item ${i} date`)}));

// Existing product contracts
test('Anime detail still embeds trailer and full sections',()=>{includes(detail,'https://www.youtube-nocookie.com/embed/');['LANÇAMENTO','TÉRMINO','Personagens','Franquia e relações','Recomendações'].forEach(x=>includes(detail,x))});
test('Anime detail remains mobile-first with 16:9 trailer',()=>{includes(detailCss,'@media(max-width:720px)');includes(detailCss,'aspect-ratio:16/9')});
test('Shared media state keeps five statuses',()=>['PLANNING','CURRENT','COMPLETED','PAUSED','DROPPED'].forEach(x=>includes(mediaState,`${x}:`)));
test('Catalog schedule and season still expose unified state hooks',()=>{includes(catalog,'data-list=');includes(catalog,'data-fav=');ok(/data-nx18-(?:status|fav)/.test(schedule));ok(/data-nx-(?:list|fav)/.test(season))});

// Files
test('Critical V32 files exist',()=>['lib/news-core.mjs','lib/native-news.mjs','lib/news-worker.mjs','sql/004_news_editorial_pipeline.sql','preview-v32/news-route-guard-v32.js','preview-v32/news-v32.js','preview-v32/news-v32.css','preview-v32/home-news-v32.js','preview-v32/home-v32.css','tests/news-system.mjs'].forEach(p=>ok(exists(p),`missing ${p}`)));
test('Route guard still loads before legacy app',()=>ok(index.indexOf('route-guard-v23.js')<index.indexOf('preview-v6/app.js')));

console.log(`\nAniNexus smoke: ${passed} passed, ${failed} failed`);
if(failed)process.exit(1);
