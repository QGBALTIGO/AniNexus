import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { cleanText, canonicalUrl, sourceFingerprint, storyFingerprint, classifyNews, normalizeNewsImageUrl } from '../lib/news-core.mjs';
import { parseSourceContent, sourceExcerpt } from '../lib/news-source-content.mjs';
import { languageScore, likelyPortuguese } from '../lib/news-sources-v36.mjs';
import { extractSourceMedia } from '../lib/news-rich-v37.mjs';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
let passed = 0;

function test(name, run) {
  try {
    run();
    passed++;
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}\n  ${error.message}`);
    process.exitCode = 1;
  }
}

test('core normalization and classification remain stable', () => {
  assert.equal(cleanText('<b>Anime</b>&nbsp; &amp; mangá'), 'Anime & mangá');
  assert.equal(canonicalUrl('https://example.com/a/?utm_source=x#x'), 'https://example.com/a');
  assert.equal(sourceFingerprint('https://example.com/a?utm_source=x'), sourceFingerprint('https://example.com/a'));
  assert.equal(storyFingerprint('Anime ganha temporada', 'Nova temporada confirmada'), storyFingerprint('Anime ganha temporada', 'Nova temporada confirmada'));
  assert.equal(classifyNews({ title: 'Novo trailer de Chainsaw Man' }), 'TRAILER');
  assert.equal(normalizeNewsImageUrl('https://animenew.com.br/wp-content/uploads/capa.webp'), 'https://wp.animenew.com.br/wp-content/uploads/capa.webp');
  assert.equal(normalizeNewsImageUrl('', 'https://animenew.com.br/noticia'), '');
});

test('AnimeNew media host is repaired without changing the source page URL', () => {
  const parsed = parseSourceContent('<p>Texto original da notícia.</p><img src="https://animenew.com.br/wp-content/uploads/2026/09/capa.webp" alt="Capa">', 'https://animenew.com.br/noticia');
  assert.equal(parsed.mediaGallery[0]?.url, 'https://wp.animenew.com.br/wp-content/uploads/2026/09/capa.webp');
  assert.equal(canonicalUrl('https://animenew.com.br/noticia'), 'https://animenew.com.br/noticia');
});

test('source parser preserves text and media in document order', () => {
  const html = '<p>Primeiro <strong>parágrafo</strong>.</p><figure><img src="/visual.jpg" alt="Visual"><figcaption>Visual oficial</figcaption></figure><h2>Novo trailer</h2><ul><li>Item um</li><li>Item dois</li></ul><blockquote>Citação original da produção.</blockquote><iframe src="https://www.youtube.com/embed/abc123XYZ"></iframe>';
  const parsed = parseSourceContent(html, 'https://fonte.example/noticia');
  assert.deepEqual(parsed.blocks.map(block => block.type), ['paragraph', 'image', 'heading', 'list', 'blockquote', 'video']);
  assert.equal(parsed.blocks[0].text, 'Primeiro parágrafo.');
  assert.ok(parsed.blocks[0].runs.some(run => run.marks?.includes('strong')));
  assert.equal(parsed.blocks[1].url, 'https://fonte.example/visual.jpg');
  assert.equal(parsed.blocks[1].caption, 'Visual oficial');
  assert.equal(parsed.blocks.at(-1).embedUrl, 'https://www.youtube-nocookie.com/embed/abc123XYZ');
});

test('source parser selects the highest quality image supplied by WordPress', () => {
  const html = '<figure><img src="https://cdn.example.com/image-290.jpg" data-orig-file="https://cdn.example.com/image-original.jpg" srcset="https://cdn.example.com/image-800.jpg 800w, https://cdn.example.com/image-290.jpg 290w"></figure><img src="https://cdn.example.com/fallback.jpg" srcset="https://cdn.example.com/fallback-900.jpg 900w, https://cdn.example.com/fallback-320.jpg 320w">';
  const parsed = parseSourceContent(html, 'https://fonte.example/post');
  assert.equal(parsed.blocks[0].url, 'https://cdn.example.com/image-original.jpg');
  assert.equal(parsed.blocks[1].url, 'https://cdn.example.com/fallback-900.jpg');
});

test('source parser keeps safe emphasis and links while removing page noise', () => {
  const html = '<script>alert(1)</script><div class="newsletter"><p>Assine agora</p></div><p>Leia <em>com calma</em> no <a href="https://fonte.example/contexto">contexto original</a>.</p><p><a href="javascript:alert(1)">link inseguro</a> e <a>link vazio</a></p><img src="https://fonte.example/tracking/pixel.gif"><img alt="sem endereço">';
  const parsed = parseSourceContent(html, 'https://fonte.example/post');
  assert.equal(parsed.blocks.length, 2);
  assert.ok(parsed.blocks[0].runs.some(run => run.marks?.includes('em')));
  assert.ok(parsed.blocks[0].runs.some(run => run.href === 'https://fonte.example/contexto'));
  assert.equal(parsed.blocks[1].runs.some(run => run.href), false);
  assert.equal(parsed.blocks.some(block => block.type === 'image'), false);
  assert.doesNotMatch(JSON.stringify(parsed), /newsletter|alert\(1\)|pixel\.gif/);
});

test('source excerpts are copied from the first paragraph without rewriting', () => {
  const parsed = parseSourceContent('<p>Este é o primeiro parágrafo original, com informação suficiente para o cartão da notícia.</p><p>Este é o segundo.</p>', 'https://fonte.example/post');
  assert.equal(sourceExcerpt(parsed, ''), parsed.firstParagraph);
});

test('Portuguese gate rejects English material', () => {
  assert.equal(likelyPortuguese('O anime ganhou uma nova temporada e a estreia foi confirmada para outubro.'), true);
  assert.equal(likelyPortuguese('The publisher licenses a new manga volume for worldwide release and adds more staff details.'), false);
  const portuguese = languageScore('Nova temporada foi anunciada com estreia no Brasil');
  const english = languageScore('The new season was announced with worldwide release');
  assert.ok(portuguese.pt > portuguese.en);
  assert.ok(english.en > english.pt);
});

test('media compatibility layer derives gallery data from the ordered parser', () => {
  const media = extractSourceMedia('<p>Texto original suficiente.</p><img src="https://cdn.example.com/a.jpg" alt="Arte"><iframe src="https://youtu.be/abc123XYZ"></iframe>', 'https://fonte.example/post');
  assert.equal(media.media[0].url, 'https://cdn.example.com/a.jpg');
  assert.equal(media.embeds[0].url, 'https://www.youtube-nocookie.com/embed/abc123XYZ');
});

const source = read('lib/news-sources-v36.mjs');
const rich = read('lib/news-rich-v37.mjs');
const worker = read('lib/news-worker-v37.mjs');
const updater = read('scripts/update-news-v36.mjs');
const workflow = read('.github/workflows/update-news.yml');
const home = read('preview-v35/home-v35.js');
const newsData = read('preview-v35/news-data-v35.js');
const newsUi = read('preview-v35/news-ui-v35.js');
const newsCss = read('preview-v36/news-v36.css');
const experienceCss = read('preview-v44/experience-v44.css');
const product = read('preview-v42/product-v42.js');
const migration = read('sql/018_news_source_fidelity.sql');
const feed = JSON.parse(read('data/news.json'));

test('collector uses direct Brazilian source feeds and optional GNews previews', () => {
  assert.ok(source.includes('https://www.jbox.com.br/wp-json/wp/v2/posts'));
  assert.ok(source.includes('https://anmtv.com.br/wp-json/wp/v2/posts'));
  assert.ok(source.includes('https://animenew.com.br/feed/'));
  assert.ok(source.includes('GNEWS_API_KEY'));
  assert.ok(source.includes("contentMode: hasFullContent ? 'full' : 'excerpt'"));
  assert.ok(source.includes('sameAnnouncement'));
  assert.equal(source.includes('translate('), false);
  assert.equal(source.includes('NEWS_TRANSLATE_ENDPOINT'), false);
  assert.equal(source.includes('MyAnimeList'), false);
  assert.equal(source.includes('Anime News Network'), false);
});

test('collector no longer scrapes pages into a detached gallery', () => {
  assert.ok(rich.includes('parseSourceContent'));
  assert.equal(rich.includes('fetch('), false);
  assert.equal(rich.includes('jsonLdImages'), false);
});

test('worker persists ordered source content, original author and content mode', () => {
  assert.ok(worker.includes('source_content=$18::jsonb'));
  assert.ok(worker.includes('content_mode=$19'));
  assert.ok(worker.includes('(source_hash=$1 OR story_hash=$2)'));
  assert.ok(worker.includes('source_hash=$27,story_hash=$28'));
  assert.ok(worker.includes("version: 6"));
  assert.ok(worker.includes('article.title'));
  assert.ok(worker.includes('article.author'));
  assert.ok(worker.includes("content_mode='legacy'"));
  assert.ok(worker.includes('retireLegacy: hasFidelityFeed'));
  assert.equal(worker.includes('splitFacts'), false);
});

test('database migration adds the source-fidelity contract', () => {
  assert.ok(migration.includes('source_content jsonb'));
  assert.ok(migration.includes('content_mode text'));
  assert.ok(migration.includes("content_mode IN ('full','excerpt','editorial','legacy')"));
  assert.ok(migration.includes('char_length(title) BETWEEN 3 AND 500'));
});

test('static updater publishes only fresh fidelity items during healthy runs', () => {
  assert.ok(updater.includes("editorialMode: 'source-fidelity'"));
  assert.ok(updater.includes('sourceContent'));
  assert.ok(updater.includes('contentMode'));
  assert.ok(updater.includes('fidelityOk'));
  assert.ok(updater.includes('preservando data/news.json existente'));
  assert.ok(updater.includes('GNews API (opcional, prévias)'));
});

test('scheduled workflow validates the parser and accepts an optional GNews secret', () => {
  assert.ok(workflow.includes("cron: '7,22,37,52 * * * *'"));
  assert.ok(workflow.includes('node --check lib/news-source-content.mjs'));
  assert.ok(workflow.includes('GNEWS_API_KEY: ${{ secrets.GNEWS_API_KEY }}'));
  assert.ok(workflow.includes('aninexus-news-v40'));
});

test('browser model normalizes source blocks and does not invent fallback artwork', () => {
  assert.ok(newsData.includes("BUILD='44.14.2'"));
  assert.ok(newsData.includes('normalizeSourceContent'));
  assert.ok(newsData.includes('sourceContent'));
  assert.ok(newsData.includes('sourceAuthor'));
  assert.ok(newsData.includes("if(!raw)return''"));
  assert.ok(newsData.includes('newsImageUrl'));
  assert.ok(newsData.includes('bindImageFallbacks'));
  assert.ok(newsData.includes("url.hostname.toLowerCase()==='animenew.com.br'"));
  assert.equal(newsData.includes('graphql.anilist.co'), false);
});

test('reader renders the preserved block sequence without source callouts', () => {
  assert.ok(newsUi.includes('nx40-source-flow'));
  assert.ok(newsUi.includes('sourceBlock'));
  assert.ok(newsUi.includes('nx40-reader-actions'));
  assert.ok(newsUi.includes('data-copy'));
  assert.equal(newsUi.includes('PUBLICADO ORIGINALMENTE POR'), false);
  assert.equal(newsUi.includes('Ver matéria original'), false);
  assert.equal(newsUi.includes('sourceLink('), false);
  assert.equal(newsUi.includes('<small>${esc(item.source)}'), false);
  assert.equal(home.includes('x.source||x.sourceName'), false);
  assert.equal(newsUi.includes('blocks.shift()'), false);
  assert.equal(newsUi.includes('O que aconteceu'), false);
  assert.equal(newsUi.includes('Acompanhamento AniNexus'), false);
  assert.ok(newsCss.includes('.nx40-source-flow'));
  assert.ok(newsCss.includes('.nx40-source-image'));
  assert.ok(newsCss.includes('.nx40-source-video'));
  assert.ok(product.includes('script,style,textarea,input,.nx40-source-flow'));
  assert.ok(product.includes("function enhanceNews(){const match=route().match(/^\\/noticias\\/(.+)$/);if(!match||!document.querySelector('.nx35-reader'))return;mountNewsComments"));
  assert.equal(product.includes("document.querySelectorAll('.nx35-article-stats span')"), false);
});

test('desktop home uses six balanced cards without changing mobile breakpoints', () => {
  assert.ok(experienceCss.includes('@media(min-width:1001px)'));
  assert.ok(experienceCss.includes('grid-template-columns:repeat(3,minmax(0,1fr))'));
  assert.ok(experienceCss.includes('.nx35-news-layout .nx35-news-rail{display:contents}'));
  assert.ok(experienceCss.includes('.nx35-news-layout .nx35-news.feature p{display:none}'));
});

test('generated feed contains source-fidelity records', () => {
  assert.equal(feed.language, 'pt-BR');
  assert.equal(feed.editorialMode, 'source-fidelity');
  assert.ok(Number(feed.collectorVersion) >= 40);
  assert.ok(feed.items.length >= 6);
  assert.ok(feed.items.every(item => item.slug && item.title && item.summary && item.language === 'pt-BR'));
  assert.ok(feed.items.every(item => ['full', 'excerpt'].includes(item.contentMode)));
  assert.ok(feed.items.every(item => Array.isArray(item.sourceContent) && item.sourceContent.length > 0));
  assert.ok(feed.items.some(item => item.sourceContent.some(block => block.type === 'image' || block.type === 'video')));
});

if (process.exitCode) throw new Error('AniNexus news tests failed');
console.log(`\nAniNexus Notícias: ${passed} tests passed`);
