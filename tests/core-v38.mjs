import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const exists=p=>fs.existsSync(path.join(root,p));
let passed=0;
function test(name,fn){try{fn();passed++;console.log(`✓ ${name}`)}catch(err){console.error(`✗ ${name}\n  ${err.message}`);process.exitCode=1}}

const index=read('index.html');
const server=read('server.mjs');
const docker=read('Dockerfile');
const compose=read('docker-compose.yml');
const nginx=read('nginx.conf');
const pkg=JSON.parse(read('package.json'));
const cache=read('lib/cache.mjs');
const auth=read('lib/auth.mjs');
const db=read('lib/db.mjs');
const analytics=read('lib/analytics.mjs');
const build=read('scripts/build-public.mjs');
const migration=read('sql/006_scale_indexes.sql');
const favoriteMigration=read('sql/007_user_favorites.sql');
const runtime=read('preview-v38/runtime-v38.js');
const mediaSync=read('preview-v38/media-sync-v38.js');
const coreCss=read('preview-v38/core-v38.css');
const mediaState=read('preview-v19/media-state-v2.js');
const authUi=read('preview-v38/auth-v38.js');
const authCss=read('preview-v38/auth-v38.css');
const authGuard=read('preview-v38/auth-guard-v38.js');
const router=read('preview-v23/router-v23.js');
const nav=read('preview-v27/navigation-v27.js');
const page404=read('404.html');

function includes(text,needle){assert.ok(text.includes(needle),`missing: ${needle}`)}
function notIncludes(text,needle){assert.ok(!text.includes(needle),`unexpected: ${needle}`)}

test('V38 shell is active and local runtime references exist',()=>{
  includes(index,'2026-08-22-v38.0.0');
  ['preview-v38/core-v38.css','preview-v38/auth-v38.css','preview-v38/runtime-v38.js','preview-v38/auth-guard-v38.js','preview-v38/auth-v38.js','preview-v38/media-sync-v38.js'].forEach(p=>{includes(index,p);assert.ok(exists(p),`missing ${p}`)});
  includes(index,'preview-v19/media-state-v2.js?v=38.0.2');
  assert.ok(index.indexOf('preview-v19/media-state-v2.js')<index.indexOf('preview-v38/media-sync-v38.js'),'account sync must load after local state controller');
});

test('all Pages route helpers use one V38 build marker',()=>{
  includes(router,"BUILD='38.0.0'");includes(nav,"BUILD='38.0.0'");includes(page404,'build=38.0.0');
  notIncludes(router,"BUILD='35.0.0'");notIncludes(nav,"BUILD='35.0.0'");notIncludes(page404,'build=35.0.0');
});

test('production image is built from the current repository shell',()=>{
  includes(docker,'COPY --chown=node:node . .');includes(docker,'node scripts/build-public.mjs');
  notIncludes(docker,'COPY --chown=node:node preview-v6 ./public/preview-v6');
  includes(build,"/^preview-v\\d+$/");includes(build,"fs.copyFile(path.join(root,'index.html')");includes(build,"Production shell references missing files");
});

test('server has SPA deep-link fallback while API stays JSON 404',()=>{
  includes(server,"app.setNotFoundHandler");includes(server,"!req.url.startsWith('/api/')");includes(server,"accept.includes('text/html')");includes(server,"sendFile('index.html')");includes(server,"{error:'NOT_FOUND'}");
});

test('server CSP matches real AniNexus upstreams and embeds',()=>{
  ['https://graphql.anilist.co','https://api.jikan.moe','https://translate.googleapis.com','https://www.youtube-nocookie.com'].forEach(x=>includes(server,x));
});

test('server listens to container PORT before public host port',()=>{includes(server,"process.env.PORT||process.env.PUBLIC_PORT||8080")});

test('readiness checks database and redis',()=>{includes(server,"'/health/ready'");includes(server,'dbReady()');includes(server,'redis.ping()');includes(docker,'/health/ready')});

test('Redis cache supports cross-process lock and stale-if-error',()=>{
  includes(cache,'lock:${key}');includes(cache,'NX:true');includes(cache,'stale:${key}');includes(cache,'redis.eval');includes(cache,'if(stale!==null)return stale');
});

test('authentication caches sessions and invalidates them on logout',()=>{
  includes(auth,'SESSION_CACHE_SECONDS');includes(auth,'auth:session:');includes(auth,'cacheGet(key)');includes(auth,'cacheSet(key');includes(auth,'cacheDel(sessionKey(hash))');includes(auth,"priority:'high'");
});

test('registration avoids select-then-insert race and catches uniqueness',()=>{
  notIncludes(server,"SELECT 1 FROM users WHERE email=$1 OR username=$2");includes(server,"err?.code==='23505'");includes(server,'strongPassword');
});

test('analytics writes are batched instead of one insert per event request',()=>{
  includes(server,'enqueueAnalytics');notIncludes(server,"q('INSERT INTO analytics_events(event_name,path,media_id)");includes(analytics,'jsonb_to_recordset');includes(analytics,'BATCH');includes(analytics,'flushAnalytics');
});

test('database migrations are serialized across horizontally-scaled processes',()=>{includes(db,'pg_advisory_lock');includes(db,'pg_advisory_unlock')});

test('hot database access paths have V38 indexes',()=>{
  ['sessions_user_created_idx','user_anime_user_updated_idx','notifications_user_unread_idx','impressions_media_visible_idx','community_posts_visible_thread_idx','news_articles_live_idx'].forEach(x=>includes(migration,x));
});

test('Nginx caches only public GET models and locks cache stampedes',()=>{
  includes(nginx,'proxy_cache_path');includes(nginx,'proxy_cache_lock on');includes(nginx,'proxy_cache_use_stale');includes(nginx,'X-AniNexus-Cache');includes(nginx,'location ^~ /api/auth/');includes(nginx,'location /api/');
  notIncludes(nginx,'/api/me');
});

test('container configuration exposes graceful-shutdown and scale tuning',()=>{
  includes(compose,'SESSION_CACHE_SECONDS');includes(compose,'ANALYTICS_BATCH_SIZE');includes(compose,'UPSTREAM_TIMEOUT_MS');includes(compose,'stop_grace_period');includes(compose,'/var/cache/nginx:size=512m');
});

test('legacy service-worker shell is actively retired',()=>{includes(runtime,'getRegistrations()');includes(runtime,'unregister()');includes(runtime,"/^aninexus-shell-/i")});

test('global runtime handles broken images without replacing everything with a giant logo',()=>{includes(runtime,'nx38-img-error');includes(runtime,'nx38-media-fallback');includes(runtime,"document.addEventListener('error'");includes(coreCss,'.nx38-media-fallback')});

test('runtime never rewrites list or favorite state artwork',()=>{
  notIncludes(runtime,'standardizeAction');notIncludes(runtime,'ACTION_SELECTOR');notIncludes(runtime,'HEART_ICON');notIncludes(runtime,'PLUS_ICON');
  includes(runtime,'List/favorite state is owned exclusively by media-state-v2.js');
});

test('media controller keeps favorite independent and fully toggleable',()=>{
  includes(mediaState,"const FAV_KEY='aninexus:favorites'");
  includes(mediaState,"on=typeof value==='boolean'?value:!set.has(n)");
  includes(mediaState,'if(on)set.add(n);else set.delete(n)');
  includes(mediaState,"setButtonIcon(button,SVG.heart,on?'Favoritado':'Favoritar')");
  includes(mediaState,"event.target.closest?.('[data-fav]");
});

test('media controller uses distinct icons for no status and Quero Ver',()=>{
  includes(mediaState,"plus:'<svg class=\"nx-media-icon\"");
  includes(mediaState,"eye:'<svg class=\"nx-media-icon\"");
  includes(mediaState,"PLANNING:{label:'Quero Ver',icon:SVG.eye");
  notIncludes(mediaState,"PLANNING:{label:'Quero Ver',icon:SVG.plus");
});

test('list state is mutually exclusive, changeable and removable',()=>{
  includes(mediaState,"d.status=status");
  includes(mediaState,"button.classList.toggle(`status-${key.toLowerCase()}`,state.status===key)");
  includes(mediaState,"persistState(n,{},total);close()");
  includes(mediaState,"persistState(n,d,total);close()");
  includes(mediaState,"button.setAttribute('aria-label',has?`${label}. Clique para alterar`:'Adicionar à lista')");
});

test('list and favorite controls use compact geometry without owning state in CSS',()=>{
  includes(coreCss,'--nx38-action-size:36px');
  includes(coreCss,':not(:has(>span))');
  includes(coreCss,'status-planning');includes(coreCss,'status-current');includes(coreCss,'status-completed');includes(coreCss,'status-paused');includes(coreCss,'status-dropped');
  includes(coreCss,'.nx-media-heart');
});

test('favorites have their own database collection and API, separate from follows',()=>{
  includes(favoriteMigration,'CREATE TABLE IF NOT EXISTS user_favorites');
  includes(favoriteMigration,'PRIMARY KEY(user_id, media_id, media_type)');
  includes(server,"app.get('/api/me/favorites'");includes(server,"app.put('/api/me/favorites/:mediaId'");includes(server,"app.delete('/api/me/favorites/:mediaId'");
  includes(server,'INSERT INTO user_favorites');includes(server,'DELETE FROM user_favorites');
  notIncludes(favoriteMigration,'user_follows');
});

test('account sync is offline-first and preserves pending unfavorites/removals',()=>{
  includes(mediaSync,"const FAV_PENDING='aninexus:favorites:pending:v1'");
  includes(mediaSync,"const STATE_PENDING='aninexus:mediaState:pending:v1'");
  includes(mediaSync,"value?desired.add(id):desired.delete(id)");
  includes(mediaSync,"document.addEventListener('aninexus:favorite-changed'");
  includes(mediaSync,"document.addEventListener('aninexus:media-state-changed'");
  includes(mediaSync,"/api/me/favorites/");includes(mediaSync,"/api/me/list/");
});

test('login, registration and account are real routes with a guarded first frame',()=>{
  ['/login','/criar-conta','/minha-conta'].forEach(x=>{includes(authUi,x);includes(authGuard,x);includes(router,x)});
  includes(authUi,'Confirmar senha');includes(authUi,'Pelo menos um número');includes(authUi,'reportValidity()');includes(authUi,'Processando…');includes(authUi,'INVALID_CREDENTIALS');includes(authUi,'ACCOUNT_UNAVAILABLE');includes(authUi,"'/api/me/list'");includes(authUi,"'/api/me/follows'");includes(authUi,"'/api/me/notifications?limit=100'");
  includes(authCss,'.nx38-auth-page');includes(authCss,'.nx38-account-page');
});

test('community replies are paginated instead of returning 500 rows forever',()=>{includes(server,"Math.min(200,Number(req.query?.limit||100))");includes(server,"offset=Math.max(0,Math.min(10000");includes(server,'hasMore:rows.length===limit')});

test('package check includes media state, sync and core regression suite',()=>{
  assert.equal(pkg.scripts['test:core'],'node tests/core-v38.mjs');
  ['lib/analytics.mjs','scripts/build-public.mjs','preview-v19/media-state-v2.js','preview-v38/media-sync-v38.js','preview-v38/auth-v38.js','tests/core-v38.mjs'].forEach(x=>includes(pkg.scripts.check,x));
});

if(process.exitCode)throw new Error('AniNexus core V38 tests failed');
console.log(`\nAniNexus Core V38: ${passed} tests passed`);
