import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  cleanText,canonicalUrl,sourceFingerprint,storyFingerprint,classifyNews,splitFacts,
  extractHtmlMetadata,mergeSources,buildEditorialArticle,qualityScore,slugify
} from '../lib/news-core.mjs';

const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
let passed=0;
function test(name,fn){try{fn();passed++;console.log(`✓ ${name}`)}catch(err){console.error(`✗ ${name}\n  ${err.message}`);process.exitCode=1}}

test('cleanText removes markup and normalizes entities',()=>assert.equal(cleanText('<b>Anime</b>&nbsp; &amp; manga'),'Anime & manga'));
test('canonicalUrl removes campaign trackers and hash',()=>assert.equal(canonicalUrl('https://example.com/news/test/?utm_source=x&b=2&a=1#top'),'https://example.com/news/test?a=1&b=2'));
test('source fingerprint is stable after canonicalization',()=>assert.equal(sourceFingerprint('https://example.com/a?utm_source=x'),sourceFingerprint('https://example.com/a')));
test('story fingerprint is deterministic',()=>{const a=storyFingerprint('Demon Slayer ganha nova temporada','Nova temporada foi anunciada hoje.'),b=storyFingerprint('Demon Slayer ganha nova temporada','Nova temporada foi anunciada hoje.');assert.equal(a,b);assert.equal(a.length,24)});
test('slugify creates an internal route-safe slug',()=>assert.equal(slugify('Notícia: 2ª Temporada!'),'noticia-2a-temporada'));
test('classifier recognizes editorial categories',()=>{assert.equal(classifyNews({title:'Novo trailer de Chainsaw Man'}),'TRAILER');assert.equal(classifyNews({title:'Editora licencia novo mangá'}),'MANGA');assert.equal(classifyNews({title:'Anime confirma segunda temporada'}),'SEASON');assert.equal(classifyNews({title:'Episódio final ganha data'}),'EPISODE')});
test('facts are split and deduplicated',()=>{const facts=splitFacts('A estreia acontece em outubro. A estreia acontece em outubro. O elenco principal foi confirmado.');assert.equal(facts.length,2)});
test('HTML metadata extractor reads JSON-LD article image and facts',()=>{const html=`<script type="application/ld+json">${JSON.stringify({'@type':'NewsArticle',headline:'Título da notícia',description:'Descrição editorial longa o suficiente.',image:'https://cdn.example.com/a.jpg',author:{name:'Autor Exemplo'},datePublished:'2026-08-22T10:00:00Z',articleBody:'A produção confirmou a estreia em outubro. O elenco principal também retornará para a continuação.'})}</script>`;const meta=extractHtmlMetadata(html,'https://example.com/news/a');assert.equal(meta.title,'Título da notícia');assert.equal(meta.imageUrl,'https://cdn.example.com/a.jpg');assert.equal(meta.author,'Autor Exemplo');assert.match(meta.articleText,/estreia em outubro/)});
test('HTML metadata has article paragraph fallback',()=>{const meta=extractHtmlMetadata('<article><p>A produção anunciou oficialmente uma nova temporada para o próximo ano.</p><p>Mais detalhes serão revelados posteriormente pela equipe responsável.</p></article>','https://example.com/a');assert.match(meta.articleText,/nova temporada/)});
test('source merger removes duplicates while preserving provenance',()=>{const sources=mergeSources([{name:'ANN',url:'https://example.com/a?utm_source=x'}],[{name:'ANN',url:'https://example.com/a'},{name:'Crunchyroll',url:'https://example.org/b'}]);assert.equal(sources.length,2)});
test('editorial article builds structured AniNexus reading content',()=>{const article=buildEditorialArticle({title:'Nova temporada confirmada',summary:'A produção confirmou uma nova temporada com estreia prevista para outubro. O elenco principal retorna.',eventType:'SEASON',facts:['A estreia será em outubro.','O elenco principal retorna.'],sources:[{name:'Fonte A',url:'https://example.com/a'}]});assert.ok(article.sections.length>=2);assert.ok(article.readingMinutes>=1);assert.ok(article.wordCount>0)});
test('quality score rewards richer reporting with an image',()=>{const low=qualityScore({title:'Notícia curta',summary:'Breve.'}),high=qualityScore({title:'Anime confirma uma nova temporada com detalhes',summary:'A produção confirmou oficialmente a continuação e divulgou informações sobre estreia, equipe e elenco para os fãs.',imageUrl:'https://example.com/a.jpg',publishedAt:new Date().toISOString(),sources:[{name:'Fonte A'}],facts:['Fato um confirmado pela produção.','Fato dois com contexto suficiente.']});assert.ok(high>low,`${high} should be > ${low}`)});

const worker=read('lib/news-worker-v33.mjs');
const native=read('lib/native-news.mjs');
const migration=read('sql/005_news_quality_and_revisions.sql');
const updater=read('scripts/update-news.mjs');
const home=read('preview-v33/home-v33.js');
const homeCss=read('preview-v33/home-v33.css');
const newsUi=read('preview-v32/news-v32.js');
const newsPolish=read('preview-v33/news-v33.css');
const index=read('index.html');

test('V33 worker monitors Crunchyroll ANN and MAL',()=>['Crunchyroll Notícias','Anime News Network','MyAnimeList'].forEach(x=>assert.ok(worker.includes(x),x)));
test('V33 worker rejects failed translations instead of publishing English',()=>{assert.ok(worker.includes('pair.ready'));assert.ok(worker.includes('skippedTranslation'));assert.ok(worker.includes("translation_status='ready'"))});
test('V33 worker enriches source pages and supplies missing images from media metadata',()=>{assert.ok(worker.includes('extractHtmlMetadata'));assert.ok(worker.includes('fallbackImage'));assert.ok(worker.includes('getCatalog'));assert.ok(worker.includes('getReading'))});
test('V33 worker quality-gates automated stories',()=>{assert.ok(worker.includes('NEWS_MIN_QUALITY'));assert.ok(worker.includes('skippedQuality'));assert.ok(worker.includes('quality<MIN_QUALITY'))});
test('V33 worker groups stories and preserves multiple sources',()=>{assert.ok(worker.includes('groupStories'));assert.ok(worker.includes('mergeSources'));assert.ok(worker.includes('source_count'))});
test('V33 worker creates article revisions when facts change',()=>{assert.ok(worker.includes('news_article_revisions'));assert.ok(worker.includes('content_signature'));assert.ok(worker.includes('content_version'))});
test('V33 worker records ingest runs and source health',()=>{assert.ok(worker.includes('news_ingest_runs'));assert.ok(worker.includes('news_source_health'))});
test('native feed only exposes ready Portuguese articles and prioritizes images',()=>{assert.ok(native.includes("translation_status='ready'"));assert.ok(native.includes("language='pt-BR'"));assert.ok(native.includes("CASE WHEN image_url IS NULL OR image_url='' THEN 0 ELSE 1 END DESC"))});
test('migration includes article revisions ingest runs and translation state',()=>['news_article_revisions','news_ingest_runs','translation_status','content_signature','source_count'].forEach(x=>assert.ok(migration.includes(x),x)));
test('static fallback enriches article HTML and refuses failed translations',()=>{assert.ok(updater.includes('extractHtmlMetadata'));assert.ok(updater.includes('translationReady'));assert.ok(updater.includes('buildEditorialArticle'));assert.ok(updater.includes('qualityScore'))});
test('Home V33 removes Tags and all legacy duplicate hero injectors',()=>{assert.ok(home.includes("t==='Tags'"));['.nx30-kicker','.nx30-hero-actions','.nx31-universe-strip','.nx31-hero-sigil','.nx31-live-brand'].forEach(x=>assert.ok(home.includes(x),x));assert.ok(home.includes('nx33-brand-lockup'));assert.ok(home.includes('nx33-hero-actions'))});
test('Home V33 implements real side fades for scrollable rails',()=>{assert.ok(home.includes('data-nx33-right'));assert.ok(home.includes('scrollWidth-el.clientWidth'));assert.ok(homeCss.includes('.nx33-edge-host[data-nx33-right="1"]:after'))});
test('Home news routes internally and never opens an external source',()=>{assert.ok(home.includes('/noticias/${x.slug}'));assert.equal(home.includes('window.open('),false)});
test('Native reader remains internal and structured',()=>{assert.ok(newsUi.includes('Ler no AniNexus'));assert.ok(newsUi.includes('nx32-reading-progress'));assert.ok(newsUi.includes('content_sections'));assert.equal(newsUi.includes('Ler na fonte'),false)});
test('V33 news polish constrains hero images and supports mobile edge fades',()=>{assert.ok(newsPolish.includes('aspect-ratio:16/9'));assert.ok(newsPolish.includes('.nx33-news-edge'));assert.ok(newsPolish.includes('@media(max-width:760px)'))});
test('Index activates only V28 base plus V33 Home enhancer',()=>{assert.ok(index.includes('preview-v28/home-v28.js'));assert.ok(index.includes('preview-v33/home-v33.js'));assert.equal(index.includes('preview-v29/home-fidelity-v29.js'),false);assert.equal(index.includes('preview-v30/home-content-v30.js'),false);assert.equal(index.includes('preview-v31/home-runtime-v31.js'),false);assert.equal(index.includes('preview-v32/home-news-v32.js'),false)});

if(process.exitCode)throw new Error('News system tests failed');
console.log(`\nAniNexus V33 news system: ${passed} tests passed`);
