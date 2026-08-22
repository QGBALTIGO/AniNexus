import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  cleanText,canonicalUrl,sourceFingerprint,storyFingerprint,classifyNews,splitFacts,
  extractHtmlMetadata,mergeSources,buildEditorialArticle,qualityScore,slugify
} from '../lib/news-core.mjs';
import { languageScore, likelyPortuguese } from '../lib/news-sources-v34.mjs';

const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
let passed=0;
function test(name,fn){try{fn();passed++;console.log(`✓ ${name}`)}catch(err){console.error(`✗ ${name}\n  ${err.message}`);process.exitCode=1}}

test('cleanText removes markup and normalizes entities',()=>assert.equal(cleanText('<b>Anime</b>&nbsp; &amp; manga'),'Anime & manga'));
test('canonicalUrl removes trackers and hash',()=>assert.equal(canonicalUrl('https://example.com/news/test/?utm_source=x&b=2&a=1#top'),'https://example.com/news/test?a=1&b=2'));
test('source fingerprint is stable after canonicalization',()=>assert.equal(sourceFingerprint('https://example.com/a?utm_source=x'),sourceFingerprint('https://example.com/a')));
test('story fingerprint is deterministic',()=>{const a=storyFingerprint('Demon Slayer ganha nova temporada','Nova temporada foi anunciada hoje.'),b=storyFingerprint('Demon Slayer ganha nova temporada','Nova temporada foi anunciada hoje.');assert.equal(a,b);assert.equal(a.length,24)});
test('slugify creates route-safe slugs',()=>assert.equal(slugify('Notícia: 2ª Temporada!'),'noticia-2-temporada'));
test('classifier recognizes editorial categories',()=>{assert.equal(classifyNews({title:'Novo trailer de Chainsaw Man'}),'TRAILER');assert.equal(classifyNews({title:'Editora licencia novo mangá'}),'MANGA');assert.equal(classifyNews({title:'Anime confirma segunda temporada'}),'SEASON');assert.equal(classifyNews({title:'Episódio final ganha data'}),'EPISODE')});
test('facts are split and deduplicated',()=>assert.equal(splitFacts('A estreia acontece em outubro. A estreia acontece em outubro. O elenco principal foi confirmado.').length,2));
test('HTML metadata extracts JSON-LD image and article facts',()=>{const html=`<script type="application/ld+json">${JSON.stringify({'@type':'NewsArticle',headline:'Título da notícia',description:'Descrição editorial longa o suficiente.',image:'https://cdn.example.com/a.jpg',author:{name:'Autor Exemplo'},datePublished:'2026-08-22T10:00:00Z',articleBody:'A produção confirmou a estreia em outubro. O elenco principal também retornará para a continuação.'})}</script>`;const meta=extractHtmlMetadata(html,'https://example.com/news/a');assert.equal(meta.title,'Título da notícia');assert.equal(meta.imageUrl,'https://cdn.example.com/a.jpg');assert.match(meta.articleText,/estreia em outubro/)});
test('HTML metadata has article paragraph fallback',()=>assert.match(extractHtmlMetadata('<article><p>A produção anunciou oficialmente uma nova temporada para o próximo ano.</p><p>Mais detalhes serão revelados posteriormente pela equipe responsável.</p></article>','https://example.com/a').articleText,/nova temporada/));
test('source merger removes duplicate provenance',()=>assert.equal(mergeSources([{name:'ANN',url:'https://example.com/a?utm_source=x'}],[{name:'ANN',url:'https://example.com/a'},{name:'Crunchyroll',url:'https://example.org/b'}]).length,2));
test('editorial article creates structured reading content',()=>{const a=buildEditorialArticle({title:'Nova temporada confirmada',summary:'A produção confirmou uma nova temporada com estreia prevista para outubro. O elenco principal retorna.',eventType:'SEASON',facts:['A estreia será em outubro.','O elenco principal retorna.'],sources:[{name:'Fonte A',url:'https://example.com/a'}]});assert.ok(a.sections.length>=2);assert.ok(a.readingMinutes>=1);assert.ok(a.wordCount>0)});
test('quality rewards richer reporting with image',()=>{const low=qualityScore({title:'Notícia curta',summary:'Breve.'}),high=qualityScore({title:'Anime confirma uma nova temporada com detalhes',summary:'A produção confirmou oficialmente a continuação e divulgou informações sobre estreia, equipe e elenco para os fãs.',imageUrl:'https://example.com/a.jpg',publishedAt:new Date().toISOString(),sources:[{name:'Fonte A'}],facts:['Fato um confirmado pela produção.','Fato dois com contexto suficiente.']});assert.ok(high>low)});
test('Portuguese gate accepts real Portuguese and rejects obvious English',()=>{assert.equal(likelyPortuguese('O anime ganhou uma nova temporada e a estreia foi confirmada para outubro.'),true);assert.equal(likelyPortuguese('The anime reveals new cast and worldwide release date for the new season.'),false);const pt=languageScore('Nova temporada foi anunciada com estreia em outubro');const en=languageScore('The new season was announced with a worldwide release');assert.ok(pt.pt>pt.en);assert.ok(en.en>en.pt)});

const sources=read('lib/news-sources-v34.mjs');
const worker=read('lib/news-worker-v34.mjs');
const native=read('lib/native-news.mjs');
const migration=read('sql/005_news_quality_and_revisions.sql');
const updater=read('scripts/update-news-v34.mjs');
const homeEntry=read('preview-v33/home-v33.js');
const homeCore=read('preview-v34/home-core-v34.js');
const homeData=read('preview-v34/home-data-v34.js');
const homeCss=read('preview-v34/home-core-v34.css');
const newsData=read('preview-v34/news-data-v34.js');
const newsUi=read('preview-v34/news-ui-v34.js');
const newsCss=read('preview-v34/news-hub-v34.css');
const readerCss=read('preview-v34/news-reader-v34.css');
const index=read('index.html');
const workflow=read('.github/workflows/update-news.yml');

test('V34 collector prioritizes Crunchyroll PT-BR and keeps MAL/ANN fallbacks',()=>{assert.ok(sources.includes("v1/${locale}/rss"));assert.ok(sources.includes("['pt-BR','pt-PT']"));assert.ok(sources.includes('myanimelist.net/rss/news.xml'));assert.ok(sources.includes('animenewsnetwork.com/all/rss.xml'))});
test('V34 collector enriches pages, images and groups duplicate stories',()=>{['extractHtmlMetadata','fallbackImage','storyFingerprint','groupStories','mergeSources'].forEach(x=>assert.ok(sources.includes(x),x))});
test('V34 collector fail-closes English and junk roundup stories',()=>{assert.ok(sources.includes('likelyPortuguese'));assert.ok(sources.includes('if(!raw)return null'));assert.ok(sources.includes('all the news and reviews'));assert.ok(sources.includes("reason:'translation'"))});
test('V34 worker persists only internal Portuguese editorial records with versions',()=>{["language='pt-BR'","translation_status='ready'",'news_article_revisions','content_signature','content_version','news_source_health','news_ingest_runs'].forEach(x=>assert.ok(worker.includes(x),x))});
test('native feed exposes only ready PT-BR articles and prioritizes images',()=>{assert.ok(native.includes("translation_status='ready'"));assert.ok(native.includes("language='pt-BR'"));assert.ok(native.includes("CASE WHEN image_url IS NULL OR image_url='' THEN 0 ELSE 1 END DESC"))});
test('migration supports revisions translation and ingest observability',()=>['news_article_revisions','news_ingest_runs','translation_status','content_signature','source_count'].forEach(x=>assert.ok(migration.includes(x),x)));
test('V34 static updater uses the exact shared collector and refuses English',()=>{assert.ok(updater.includes('collectEditorialStories'));assert.ok(updater.includes('likelyPortuguese'));assert.ok(updater.includes("editorialMode:'internal'"));assert.ok(updater.includes('contentSections'))});
test('hourly workflow runs the V34 collector',()=>{assert.ok(workflow.includes("cron: '17 * * * *'"));assert.ok(workflow.includes('scripts/update-news-v34.mjs'));assert.ok(workflow.includes('lib/news-sources-v34.mjs'))});
test('V34 Home entrypoint is modular instead of stacking legacy renderers',()=>{assert.ok(homeEntry.includes('home-core-v34.js'));assert.ok(homeEntry.includes('home-data-v34.js'));assert.ok(homeCore.includes("t==='Tags'"));assert.ok(homeCore.includes('.nx33-orbit'));assert.ok(homeCore.includes('nx34-hero-actions'))});
test('V34 Home community enriches local states with media and banner context',()=>{assert.ok(homeData.includes("PLANNING:{verb:'quer ver'"));assert.ok(homeData.includes("PAUSED:{verb:'pausou'"));assert.ok(homeData.includes('mediaByIds'));assert.ok(homeData.includes('banner(m)'));assert.ok(homeData.includes('nx34-community-card'))});
test('V34 Home schedule mirrors Programação with provider countdown and actions',()=>{['nx34-episode','nx34-countdown','nx34-provider','data-list=','data-fav=','nx34-ep'].forEach(x=>assert.ok(homeData.includes(x),x))});
test('all Home rails receive smooth dynamic left and right fades',()=>{assert.ok(homeCore.includes('scrollWidth-el.clientWidth'));assert.ok(homeCore.includes("host.dataset.left"));assert.ok(homeCore.includes("host.dataset.right"));assert.ok(homeCss.includes('.nx34-edge[data-left="1"]:before'));assert.ok(homeCss.includes('.nx34-edge[data-right="1"]:after'));assert.ok(homeCore.includes("el.style.scrollBehavior='smooth'"))});
test('Home and News share the same static slug formula',()=>{assert.ok(homeData.includes('const staticSlug=x=>x.slug||'));assert.ok(newsData.includes('const staticSlug=x=>x.slug||'));assert.ok(homeData.includes("String(x.id||hash(x.url||x.title))"));assert.ok(newsData.includes("String(x.id||hash(x.url||x.title))"))});
test('V34 news UI stays internal with proportional reader and no outbound reading CTA',()=>{assert.ok(newsUi.includes('Ler no AniNexus'));assert.ok(newsUi.includes('nx34-reader'));assert.ok(newsUi.includes('EM RESUMO'));assert.equal(newsUi.includes('Ler na fonte'),false);assert.equal(newsUi.includes('window.open('),false);assert.ok(newsCss.includes('.nx34-news-card.feature h3'));assert.ok(readerCss.includes('.nx34-article-section p'))});
test('Index activates V34 cache-busted entrypoints and no legacy V32 news CSS',()=>{assert.ok(index.includes('2026-08-22-v34.0.0'));assert.ok(index.includes('preview-v33/home-v33.js?v=34.0.0'));assert.ok(index.includes('preview-v33/news-v33.js?v=34.0.0'));assert.equal(index.includes('preview-v32/news-v32.css'),false)});

if(process.exitCode)throw new Error('News system tests failed');
console.log(`\nAniNexus V34 news system: ${passed} tests passed`);
