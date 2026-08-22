import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
const root=process.cwd(),read=p=>fs.readFileSync(path.join(root,p),'utf8'),exists=p=>fs.existsSync(path.join(root,p));let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log(`✓ ${name}`)}catch(err){failed++;console.error(`✗ ${name}\n  ${err.message}`)}}function ok(v,msg='assertion failed'){if(!v)throw new Error(msg)}function includes(t,n,m){ok(t.includes(n),m||`missing ${n}`)}function notIncludes(t,n,m){ok(!t.includes(n),m||`unexpected ${n}`)}
const index=read('index.html'),router=read('preview-v23/router-v23.js'),nav=read('preview-v27/navigation-v27.js'),guard=read('preview-v24/home-guard-v24.js'),home=read('preview-v35/home-v35.js'),homeCss=read('preview-v35/home-v35.css'),newsData=read('preview-v35/news-data-v35.js'),newsUi=read('preview-v35/news-ui-v35.js'),newsCss=read('preview-v35/news-v35.css'),source=read('lib/news-sources-v35.mjs'),sourceShim=read('lib/news-sources-v34.mjs'),worker=read('lib/news-worker-v34.mjs'),native=read('lib/native-news.mjs'),notFound=read('404.html'),detail=read('preview-v22/detail-stable-v22.js'),detailCss=read('preview-v22/detail-v22.css'),mediaState=read('preview-v19/media-state-v2.js'),catalog=read('preview-v20/catalog-v20.js'),schedule=read('preview-v18/schedule.js'),season=read('preview-v8/app.js');
function resolveRoute(s){const u=new URL(s),p=u.searchParams.get('p');if(p)return p.split('?')[0].replace(/\/+$/,'')||'/';let x=u.pathname.replace(/^\/AniNexus/,'')||'/';return x.replace(/\/+$/,'')||'/'}

test('GitHub Pages resolves V35 internal news routes',()=>ok(resolveRoute('https://qgbaltigo.github.io/AniNexus/?build=35.0.0&p=%2Fnoticias%2Fteste-abc')==='/noticias/teste-abc'));
test('routing assets are all V35',()=>{includes(router,"BUILD='35.0.0'");includes(nav,"BUILD='35.0.0'");includes(notFound,'build=35.0.0')});
test('index activates V35 and never mounts legacy V28 Home',()=>{includes(index,'2026-08-22-v35.0.0');includes(index,'preview-v33/home-v33.js?v=35.0.0');includes(index,'preview-v33/news-v33.js?v=35.0.0');notIncludes(index,'preview-v28/home-v28.js')});
test('Home boot prevents old-frame flash',()=>{includes(guard,'__NX35_HOME_BOOT__');includes(guard,'__nx35_home_boot__');includes(homeCss,'html.nx35-home-boot #app');notIncludes(guard,'__NX_HOME_DEDICATED__')});
test('Home V35 has no mutation-observer repaint loop',()=>{notIncludes(home,'MutationObserver');includes(home,'setInterval(updateCountdowns,1000)')});
test('Home V35 uses exact Programação card class system',()=>['nx18-card','nx18-cover','nx18-info','nx18-air','nx18-countdown','nx18-stream','nx18-provider-logo','nx18-episode'].forEach(x=>includes(home,x)));
test('Home community is media-rich',()=>['mediaByIds','banner(m)','nx35-community-cover',"PAUSED:{verb:'pausou'","COMPLETED:{verb:'terminou'"].forEach(x=>includes(home,x)));
test('Home rails use gentle directional fades',()=>{includes(home,'scrollWidth-el.clientWidth');includes(homeCss,'.nx35-edge[data-left="1"]:before');includes(homeCss,'.nx35-edge[data-right="1"]:after');includes(homeCss,'opacity:.55');includes(homeCss,'scroll-behavior:smooth')});
test('Top 10 is AniNexus red and achievements are centered',()=>{includes(homeCss,'.nx35-rank-copy small{color:#e24967');includes(homeCss,'.nx35-achievement-section .nx35-head{justify-content:center;text-align:center}')});

test('news collector starts with JBox and Crunchyroll PT sources',()=>{['JBOX_ANIME','JBOX_MANGA','JBox Anime','JBox Mangá','Crunchyroll Notícias'].forEach(x=>includes(source,x));ok(source.indexOf("['JBOX_ANIME'")<source.indexOf("['MAL'"))});
test('legacy worker imports are redirected to V35 collector',()=>includes(sourceShim,"from './news-sources-v35.mjs'"));
test('news collector rejects bad English roundups and no-image stories',()=>{includes(source,'all the news and reviews');includes(source,"reason:'translation'");includes(source,"if(!imageUrl)return{reason:'quality'}")});
test('server feed remains PT-BR only and short-lived',()=>{includes(worker,"language='pt-BR'");includes(worker,"translation_status='ready'");includes(native,"language='pt-BR'");includes(native,"translation_status='ready'")});
test('news client validates copy instead of trusting language metadata blindly',()=>{includes(newsData,'languageScore');includes(newsData,'x.pt>=2&&x.pt>=x.en*1.15');includes(newsData,'weekly roundup')});
test('news reader stays entirely inside AniNexus',()=>{includes(newsUi,'Ler no AniNexus');includes(newsUi,'EM RESUMO');notIncludes(newsUi,'Ler na fonte');notIncludes(newsUi,'window.open(');includes(newsCss,'clamp(34px,4vw,52px)')});

test('anime detail contracts remain intact',()=>{includes(detail,'https://www.youtube-nocookie.com/embed/');['LANÇAMENTO','TÉRMINO','Personagens','Franquia e relações','Recomendações'].forEach(x=>includes(detail,x));includes(detailCss,'aspect-ratio:16/9')});
test('shared media state remains unified',()=>{['PLANNING','CURRENT','COMPLETED','PAUSED','DROPPED'].forEach(x=>includes(mediaState,`${x}:`));includes(catalog,'data-list=');includes(catalog,'data-fav=');ok(/data-nx18-(?:status|fav)/.test(schedule));ok(/data-nx-(?:list|fav)/.test(season))});
test('critical V35 files exist',()=>['preview-v35/home-v35.js','preview-v35/home-v35.css','preview-v35/news-data-v35.js','preview-v35/news-ui-v35.js','preview-v35/news-v35.css','lib/news-sources-v35.mjs','scripts/update-news-v35.mjs'].forEach(p=>ok(exists(p),`missing ${p}`)));
test('route guard still loads before legacy app',()=>ok(index.indexOf('route-guard-v23.js')<index.indexOf('preview-v6/app.js')));
console.log(`\nAniNexus V35 smoke: ${passed} passed, ${failed} failed`);if(failed)process.exit(1);
