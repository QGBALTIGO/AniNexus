import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const exists=p=>fs.existsSync(path.join(root,p));
let passed=0;
function test(name,fn){try{fn();passed++;console.log(`✓ ${name}`)}catch(err){console.error(`✗ ${name}\n  ${err.message}`);process.exitCode=1}}
const includes=(text,needle)=>assert.ok(text.includes(needle),`missing: ${needle}`);
const notIncludes=(text,needle)=>assert.ok(!text.includes(needle),`unexpected: ${needle}`);

const index=read('index.html'),server=read('server.mjs'),docker=read('Dockerfile'),compose=read('docker-compose.yml'),nginx=read('nginx.conf'),pkg=JSON.parse(read('package.json'));
const cache=read('lib/cache.mjs'),auth=read('lib/auth.mjs'),db=read('lib/db.mjs'),analytics=read('lib/analytics.mjs'),nativeNews=read('lib/native-news.mjs'),newsWorker=read('lib/news-worker-v37.mjs'),newsUpdater=read('scripts/update-news-v36.mjs'),newsWorkflow=read('.github/workflows/update-news.yml'),build=read('scripts/build-public.mjs');
const migration=read('sql/006_scale_indexes.sql'),favoriteMigration=read('sql/007_user_favorites.sql'),libraryMigration=read('sql/008_library_impressions.sql');
const runtime=read('preview-v38/runtime-v38.js'),coreCss=read('preview-v38/core-v38.css'),mediaState=read('preview-v19/media-state-v2.js'),actionsJs=read('preview-v39/media-actions-v39.js'),actionsCss=read('preview-v39/media-actions-v39.css'),mediaSync=read('preview-v39/media-sync-v39.js');
const authUi=read('preview-v38/auth-v38.js'),authCss=read('preview-v38/auth-v38.css'),authGuard=read('preview-v38/auth-guard-v38.js'),library=read('preview-v38/library-v38.js'),libraryCss=read('preview-v38/library-v38.css'),libraryGuard=read('preview-v38/library-guard-v38.js'),router=read('preview-v23/router-v23.js'),nav=read('preview-v27/navigation-v27.js'),page404=read('404.html');

test('V39 shell loads one global media action stack in the right order',()=>{
  includes(index,'2026-08-23-v39.0.0');
  ['preview-v39/media-actions-v39.css','preview-v39/media-actions-v39.js','preview-v39/media-sync-v39.js'].forEach(p=>{includes(index,p);assert.ok(exists(p),`missing ${p}`)});
  notIncludes(index,'preview-v38/media-sync-v38.js');
  const guard=index.indexOf('preview-v39/media-actions-v39.js'),state=index.indexOf('preview-v19/media-state-v2.js'),sync=index.indexOf('preview-v39/media-sync-v39.js');
  assert.ok(guard>0&&guard<state&&state<sync,'rapid-action guard -> state controller -> account sync order is required');
});

test('all Pages route helpers use one V39 build marker',()=>{includes(router,"BUILD='39.0.0'");includes(nav,"BUILD='39.0.0'");includes(page404,'build=39.0.0')});

test('V39 compact controls match the intended circular translucent geometry',()=>{
  includes(actionsCss,'--nx39-action-size:34px');includes(actionsCss,'border-radius:50%');includes(actionsCss,'rgba(8,6,9,.82)');includes(actionsCss,'width:17px!important');includes(actionsCss,'touch-action:manipulation');
  includes(actionsCss,'right:7px!important');includes(actionsCss,'bottom:7px!important');includes(actionsCss,'--nx39-action-gap:7px');
  notIncludes(actionsCss,'pointer-events:none}\n\n/* Normalize');
});

test('favorite and list remain independent with one AniNexus active palette',()=>{
  includes(mediaState,"const FAV_KEY='aninexus:favorites'");includes(mediaState,"on=typeof value==='boolean'?value:!set.has(n)");includes(mediaState,'if(on)set.add(n);else set.delete(n)');
  includes(actionsCss,'button[data-fav]');includes(actionsCss,'button[data-list]');includes(actionsCss,'linear-gradient(145deg,#f43a61');includes(actionsCss,'background:rgba(189,24,59,.93)');
  ['PLANNING','CURRENT','COMPLETED','PAUSED','DROPPED'].forEach(x=>includes(mediaState,`${x}:`));
});

test('rapid clicks cannot double-toggle or open several list modals',()=>{
  includes(actionsJs,'favLock');includes(actionsJs,'now()-last<360');includes(actionsJs,"document.addEventListener('dblclick'");includes(actionsJs,'listOpening');includes(actionsJs,".nx20-media-layer");includes(actionsJs,'stopImmediatePropagation');
  includes(actionsCss,'nx39ActionPop');includes(actionsCss,'scale(.89)');
});

test('account writes are coalesced so latest rapid intent wins',()=>{
  includes(mediaSync,'favDesired=new Map()');includes(mediaSync,'favRunning=new Set()');includes(mediaSync,'stateDesired=new Map()');includes(mediaSync,'stateRunning=new Set()');
  includes(mediaSync,'while(favDesired.has(id))');includes(mediaSync,'while(stateDesired.has(id))');includes(mediaSync,"document.addEventListener('aninexus:favorite-changed'");includes(mediaSync,"document.addEventListener('aninexus:media-state-changed'");
  includes(mediaSync,"const FAV_PENDING='aninexus:favorites:pending:v1'");includes(mediaSync,"const STATE_PENDING='aninexus:mediaState:pending:v1'");
});

test('production image is built from the current repository shell',()=>{includes(docker,'COPY --chown=node:node . .');includes(docker,'node scripts/build-public.mjs');includes(build,"/^preview-v\\d+$/");includes(build,'Production shell references missing files')});
test('server keeps SPA deep links while API stays JSON 404',()=>{includes(server,'app.setNotFoundHandler');includes(server,"!req.url.startsWith('/api/')");includes(server,"sendFile('index.html')");includes(server,"{error:'NOT_FOUND'}")});
test('Redis cache supports cross-process lock and stale-if-error',()=>{includes(cache,'lock:${key}');includes(cache,'stale:${key}');includes(cache,'redis.eval');includes(cache,'if(stale!==null)return stale')});
test('authentication caches sessions and avoids registration races',()=>{includes(auth,'SESSION_CACHE_SECONDS');includes(auth,'auth:session:');includes(server,"err?.code==='23505'");notIncludes(server,'SELECT 1 FROM users WHERE email=$1 OR username=$2')});
test('analytics writes are batched',()=>{includes(server,'enqueueAnalytics');includes(analytics,'jsonb_to_recordset');includes(analytics,'BATCH');includes(analytics,'flushAnalytics')});
test('database boot serializes migrations and runs schema first',()=>{includes(db,'pg_advisory_lock');includes(db,"filter(x=>x!=='schema.sql')");includes(db,"['schema.sql',...migrations]")});
test('hot database paths have scale indexes',()=>{['sessions_user_created_idx','user_anime_user_updated_idx','notifications_user_unread_idx','impressions_media_visible_idx','community_posts_visible_thread_idx','news_articles_live_idx'].forEach(x=>includes(migration,x));includes(libraryMigration,'impressions_user_visible_idx')});
test('Nginx caches public reads but never /api/me',()=>{includes(nginx,'proxy_cache_lock on');includes(nginx,'proxy_cache_use_stale');includes(nginx,'X-AniNexus-Cache');notIncludes(nginx,'location ~ ^/api/me')});

test('news static updater degrades instead of deleting a good feed',()=>{
  includes(newsUpdater,'NEWS_STALE_GRACE_DAYS');includes(newsUpdater,"readDoc('data/news-v37-hot.json')");includes(newsUpdater,"readDoc('data/news-v36-seed.json')");includes(newsUpdater,"feedStatus:mode==='fresh'");includes(newsUpdater,'preservando data/news.json existente');
});
test('native news reads never expire the database feed',()=>{
  const getBlock=nativeNews.slice(nativeNews.indexOf('export async function getNativeNews'),nativeNews.indexOf('export async function getNativeArticle'));
  notIncludes(getBlock,'expireOldNews()');includes(nativeNews,'STALE_GRACE_DAYS');includes(nativeNews,"expires_at>now()-($5::text||' days')::interval");
});
test('worker archives expired news only after a healthy ingest with stories',()=>{includes(newsWorker,'hasHealthyContent=ok>0&&result.stories.length>0');includes(newsWorker,'cleanup({archive:hasHealthyContent})');includes(newsWorker,'archiveExpired:hasHealthyContent')});
test('scheduled news runs every 15 minutes without cancelling an active ingest',()=>{includes(newsWorkflow,"cron: '7,22,37,52 * * * *'");includes(newsWorkflow,'cancel-in-progress: false');includes(newsWorkflow,"NEWS_STALE_GRACE_DAYS: '14'");includes(newsWorkflow,'node tests/news-system.mjs')});
test('app and worker share the same stale grace configuration',()=>{const hits=compose.match(/NEWS_STALE_GRACE_DAYS/g)||[];assert.ok(hits.length>=2);includes(compose,'NEWS_WORKER_INTERVAL_MS')});

test('favorites remain a database collection separate from follows',()=>{includes(favoriteMigration,'CREATE TABLE IF NOT EXISTS user_favorites');includes(server,"app.get('/api/me/favorites'");includes(server,"app.put('/api/me/favorites/:mediaId'");includes(server,"app.delete('/api/me/favorites/:mediaId'")});
test('login and registration remain dedicated routes',()=>{['/login','/criar-conta','/minha-conta'].forEach(x=>{includes(authUi,x);includes(authGuard,x);includes(router,x)});includes(authUi,'Confirmar senha');includes(authCss,'.nx38-auth-page')});
test('Meus Animes remains a guarded synchronized library',()=>{includes(libraryGuard,"p!=='/meus-animes'");includes(library,"const LIB_ROUTE='/meus-animes'");['FAVORITES','CURRENT','PLANNING','COMPLETED','PAUSED','DROPPED','IMPRESSIONS','ACHIEVEMENTS','RANK'].forEach(x=>includes(library,x));includes(server,"app.get('/api/me/library'");includes(server,"app.get('/api/community/impressions'");includes(libraryCss,'.nx38-library-grid')});
test('legacy service worker is retired and broken images are handled',()=>{includes(runtime,'getRegistrations()');includes(runtime,'unregister()');includes(runtime,'nx38-media-fallback');includes(coreCss,'.nx38-media-fallback')});

test('package check validates V39 action guard, sync and regression suites',()=>{
  assert.equal(pkg.scripts['test:core'],'node tests/core-v38.mjs');
  ['preview-v19/media-state-v2.js','preview-v39/media-actions-v39.js','preview-v39/media-sync-v39.js','tests/news-system.mjs','tests/core-v38.mjs','tests/smoke.mjs'].forEach(x=>includes(pkg.scripts.check,x));
  notIncludes(pkg.scripts.check,'preview-v38/media-sync-v38.js');
});

if(process.exitCode)throw new Error('AniNexus core V39 tests failed');
console.log(`\nAniNexus Core V39: ${passed} tests passed`);
