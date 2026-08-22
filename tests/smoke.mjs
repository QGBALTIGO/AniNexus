import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
const root=process.cwd(),read=p=>fs.readFileSync(path.join(root,p),'utf8'),exists=p=>fs.existsSync(path.join(root,p));let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log(`✓ ${name}`)}catch(err){failed++;console.error(`✗ ${name}\n  ${err.message}`)}}function ok(v,msg='assertion failed'){if(!v)throw new Error(msg)}function includes(t,n,m){ok(t.includes(n),m||`missing ${n}`)}function notIncludes(t,n,m){ok(!t.includes(n),m||`unexpected ${n}`)}
const index=read('index.html'),guard=read('preview-v24/home-guard-v24.js'),home=read('preview-v35/home-v35.js'),homeCss=read('preview-v35/home-v35.css'),newsData=read('preview-v35/news-data-v35.js'),newsUi=read('preview-v35/news-ui-v35.js'),source=read('lib/news-sources-v36.mjs'),sourceShim=read('lib/news-sources-v34.mjs'),worker=read('lib/news-worker-v34.mjs'),native=read('lib/native-news.mjs'),detail=read('preview-v22/detail-stable-v22.js'),detailCss=read('preview-v22/detail-v22.css'),mediaState=read('preview-v19/media-state-v2.js'),catalog=read('preview-v20/catalog-v20.js'),schedule=read('preview-v18/schedule.js'),season=read('preview-v8/app.js'),feed=JSON.parse(read('data/news.json'));

test('index cache-busts deep news V36',()=>{includes(index,'2026-08-22-v36.0.0');includes(index,'preview-v35/news-data-v35.js?v=36.0.0');includes(index,'preview-v35/news-ui-v35.js?v=36.0.0');notIncludes(index,'preview-v28/home-v28.js')});
test('Home boot prevents old-frame flash',()=>{includes(guard,'__NX35_HOME_BOOT__');includes(guard,'__nx35_home_boot__');includes(homeCss,'html.nx35-home-boot #app')});
test('Home has no mutation-observer repaint loop',()=>{notIncludes(home,'MutationObserver');includes(home,'setInterval(updateCountdowns,1000)')});
test('Home uses exact Programação card classes',()=>['nx18-card','nx18-cover','nx18-info','nx18-air','nx18-countdown','nx18-stream','nx18-provider-logo','nx18-episode'].forEach(x=>includes(home,x)));
test('Home community remains media-rich',()=>['mediaByIds','banner(m)','nx35-community-cover',"PAUSED:{verb:'pausou'","COMPLETED:{verb:'terminou'"].forEach(x=>includes(home,x)));
test('Home rails keep gentle directional fades',()=>{includes(home,'scrollWidth-el.clientWidth');includes(homeCss,'.nx35-edge[data-left="1"]:before');includes(homeCss,'.nx35-edge[data-right="1"]:after');includes(homeCss,'scroll-behavior:smooth')});

test('V36 news collector reads JBox WordPress body deeply',()=>{includes(source,'/wp-json/wp/v2/posts?per_page=50');includes(source,'blocks.length>=46');includes(source,'splitFacts(paragraphs,28)');includes(source,'uniqueFacts');includes(source,'coverage:{facts:facts.length')});
test('worker is routed to V36 and persists full detail',()=>{includes(sourceShim,"from './news-sources-v36.mjs'");includes(worker,'splitFacts(a.facts||[],22)');includes(worker,'NEWS_MAX_STORIES||60');includes(worker,'coverage:a.coverage||null');includes(worker,"language='pt-BR'");includes(native,"language='pt-BR'")});
test('news client is newest-first and exposes rich coverage',()=>{includes(newsData,"BUILD='36.0.0'");includes(newsData,'new Date(b.publishedAt||0)-new Date(a.publishedAt||0)');includes(newsData,'/api/news?limit=60');includes(newsUi,'slice(0,10)');includes(newsUi,'fatos reunidos');includes(newsUi,'COBERTURA');notIncludes(newsUi,'Ler na fonte');notIncludes(newsUi,'window.open(')});
test('feed remains internal Portuguese',()=>{ok(feed.language==='pt-BR');ok(feed.items.length>=6);ok(feed.items.every(x=>x.slug&&x.title&&x.summary))});

test('anime detail contracts remain intact',()=>{includes(detail,'https://www.youtube-nocookie.com/embed/');['LANÇAMENTO','TÉRMINO','Personagens','Franquia e relações','Recomendações'].forEach(x=>includes(detail,x));includes(detailCss,'aspect-ratio:16/9')});
test('shared media state remains unified',()=>{['PLANNING','CURRENT','COMPLETED','PAUSED','DROPPED'].forEach(x=>includes(mediaState,`${x}:`));includes(catalog,'data-list=');includes(catalog,'data-fav=');ok(/data-nx18-(?:status|fav)/.test(schedule));ok(/data-nx-(?:list|fav)/.test(season))});
test('critical V36 files exist',()=>['lib/news-sources-v36.mjs','scripts/update-news-v36.mjs','preview-v35/news-data-v35.js','preview-v35/news-ui-v35.js','tests/news-system.mjs'].forEach(p=>ok(exists(p),`missing ${p}`)));
console.log(`\nAniNexus V36 smoke: ${passed} passed, ${failed} failed`);if(failed)process.exit(1);
