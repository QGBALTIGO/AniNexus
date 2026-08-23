import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
const root=process.cwd(),read=p=>fs.readFileSync(path.join(root,p),'utf8'),exists=p=>fs.existsSync(path.join(root,p));let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log(`✓ ${name}`)}catch(err){failed++;console.error(`✗ ${name}\n  ${err.message}`)}}
function ok(v,msg='assertion failed'){if(!v)throw new Error(msg)}function includes(t,n,m){ok(t.includes(n),m||`missing ${n}`)}function notIncludes(t,n,m){ok(!t.includes(n),m||`unexpected ${n}`)}

const index=read('index.html'),guard=read('preview-v24/home-guard-v24.js'),home=read('preview-v35/home-v35.js'),homeCss=read('preview-v35/home-v35.css');
const newsData=read('preview-v35/news-data-v35.js'),newsHot=read('preview-v37/news-hot-v37.js'),newsUi=read('preview-v35/news-ui-v35.js'),newsMediaCss=read('preview-v36/news-v36.css'),source=read('lib/news-sources-v36.mjs'),rich=read('lib/news-rich-v37.mjs'),worker=read('lib/news-worker-v37.mjs'),native=read('lib/native-news.mjs'),updater=read('scripts/update-news-v36.mjs'),workflow=read('.github/workflows/update-news.yml');
const detail=read('preview-v22/detail-stable-v22.js'),detailCss=read('preview-v22/detail-v22.css'),mediaState=read('preview-v19/media-state-v2.js'),actions=read('preview-v39/media-actions-v39.js'),actionsCss=read('preview-v39/media-actions-v39.css'),mediaSync=read('preview-v39/media-sync-v39.js');
const catalog=read('preview-v20/catalog-v20.js'),schedule=read('preview-v18/schedule.js'),season=read('preview-v8/app.js'),auth=read('preview-v38/auth-v38.js'),runtime=read('preview-v38/runtime-v38.js'),library=read('preview-v38/library-v38.js'),libraryCss=read('preview-v38/library-v38.css'),server=read('server.mjs'),docker=read('Dockerfile'),feed=JSON.parse(read('data/news.json')),hot=JSON.parse(read('data/news-v37-hot.json'));

test('index activates V39 controls and keeps current product layers',()=>{
  includes(index,'2026-08-23-v39.0.0');includes(index,'preview-v39/media-actions-v39.css?v=39.0.0');includes(index,'preview-v39/media-actions-v39.js?v=39.0.0');includes(index,'preview-v19/media-state-v2.js?v=39.0.0');includes(index,'preview-v39/media-sync-v39.js?v=39.0.0');
  ok(index.indexOf('media-actions-v39.js')<index.indexOf('media-state-v2.js'));ok(index.indexOf('media-state-v2.js')<index.indexOf('media-sync-v39.js'));notIncludes(index,'preview-v38/media-sync-v38.js');
});
test('V39 card actions are circular, 34px and use the AniNexus palette',()=>{includes(actionsCss,'--nx39-action-size:34px');includes(actionsCss,'border-radius:50%');includes(actionsCss,'rgba(8,6,9,.82)');includes(actionsCss,'#f43a61');includes(actionsCss,'scale(.89)')});
test('rapid favorite/list interaction is guarded',()=>{includes(actions,'favLock');includes(actions,'now()-last<360');includes(actions,"document.addEventListener('dblclick'");includes(actions,'listOpening');includes(actions,'.nx20-media-layer')});
test('server sync coalesces repeated writes',()=>{includes(mediaSync,'favDesired=new Map()');includes(mediaSync,'while(favDesired.has(id))');includes(mediaSync,'stateDesired=new Map()');includes(mediaSync,'while(stateDesired.has(id))')});
test('shared media state still owns status icons and favorite state',()=>{['PLANNING','CURRENT','COMPLETED','PAUSED','DROPPED'].forEach(x=>includes(mediaState,`${x}:`));includes(mediaState,"setButtonIcon(button,SVG.heart,on?'Favoritado':'Favoritar')");includes(catalog,'data-list=');includes(catalog,'data-fav=');ok(/data-nx18-(?:status|fav)/.test(schedule));ok(/data-nx-(?:list|fav)/.test(season))});

test('Home boot prevents old-frame flash and repaint loop',()=>{includes(guard,'__NX35_HOME_BOOT__');includes(homeCss,'html.nx35-home-boot #app');notIncludes(home,'MutationObserver');includes(home,'setInterval(updateCountdowns,1000)')});
test('Home uses exact Programação card classes',()=>['nx18-card','nx18-cover','nx18-info','nx18-air','nx18-countdown','nx18-stream','nx18-provider-logo','nx18-episode'].forEach(x=>includes(home,x)));
test('Home community stays media rich',()=>['mediaByIds','banner(m)','nx35-community-cover',"PAUSED:{verb:'pausou'","COMPLETED:{verb:'terminou'"].forEach(x=>includes(home,x)));
test('Home rails keep directional fades',()=>{includes(home,'scrollWidth-el.clientWidth');includes(homeCss,'.nx35-edge[data-left="1"]:before');includes(homeCss,'.nx35-edge[data-right="1"]:after')});

test('news collector still reads deep JBox pages and source media',()=>{includes(source,'/wp-json/wp/v2/posts?per_page=50');includes(source,'blocks.length>=46');includes(source,'splitFacts(paragraphs,28)');includes(rich,'MAX_MEDIA=12');includes(rich,'og:image');includes(rich,'mediaGallery:all');includes(rich,'youtube-nocookie.com/embed')});
test('news auto-update survives upstream outages',()=>{includes(updater,'NEWS_STALE_GRACE_DAYS');includes(updater,'data/news-v36-seed.json');includes(updater,'preservando data/news.json existente');includes(native,'STALE_GRACE_DAYS');includes(worker,'cleanup({archive:hasHealthyContent})');includes(workflow,"cron: '7,22,37,52 * * * *'");includes(workflow,'cancel-in-progress: false')});
test('news client remains internal, newest-first and media-rich',()=>{includes(newsData,'new Date(b.publishedAt||0)-new Date(a.publishedAt||0)');includes(newsData,'mediaGallery:gallery');includes(newsUi,'liveCategories');includes(newsUi,'Galeria da matéria');includes(newsUi,'Assista sem sair do AniNexus');includes(newsMediaCss,'.nx37-gallery');notIncludes(newsUi,'Ler na fonte');notIncludes(newsUi,'window.open(')});
test('hot recovery feed is deep and Portuguese feed remains populated',()=>{ok(hot.items.length>=5);ok(hot.items.every(x=>Number(x.wordCount||0)>=500));ok(feed.language==='pt-BR');ok(feed.items.length>=6)});

test('account and Meus Animes remain real application routes',()=>{['/login','/criar-conta','/minha-conta'].forEach(x=>includes(auth,x));['/meus-animes','Revisar meus animes','FAVORITES','CURRENT','PLANNING','COMPLETED','PAUSED','DROPPED','IMPRESSIONS','ACHIEVEMENTS','RANK'].forEach(x=>includes(library,x));includes(library,"/api/me/library");includes(library,"/api/community/impressions?limit=12");includes(libraryCss,'.nx38-library-grid');includes(server,"app.get('/api/me/library'")});
test('production Docker builds the complete current frontend',()=>{includes(docker,'node scripts/build-public.mjs');notIncludes(docker,'COPY --chown=node:node preview-v6 ./public/preview-v6')});
test('anime detail contracts remain intact',()=>{includes(detail,'https://www.youtube-nocookie.com/embed/');['LANÇAMENTO','TÉRMINO','Personagens','Franquia e relações','Recomendações'].forEach(x=>includes(detail,x));includes(detailCss,'aspect-ratio:16/9')});
test('runtime still retires stale service-worker shell',()=>{includes(runtime,'getRegistrations()');includes(runtime,'unregister()');includes(runtime,'nx38-media-fallback')});
test('critical V39 files exist',()=>['preview-v39/media-actions-v39.css','preview-v39/media-actions-v39.js','preview-v39/media-sync-v39.js','scripts/update-news-v36.mjs','lib/native-news.mjs','lib/news-worker-v37.mjs','tests/news-system.mjs','tests/core-v38.mjs'].forEach(p=>ok(exists(p),`missing ${p}`)));

console.log(`\nAniNexus V39 smoke: ${passed} passed, ${failed} failed`);if(failed)process.exit(1);
