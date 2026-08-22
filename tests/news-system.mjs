import assert from 'node:assert/strict';
import {
  cleanText,canonicalUrl,sourceFingerprint,storyFingerprint,classifyNews,splitFacts,
  extractHtmlMetadata,mergeSources,buildEditorialArticle,qualityScore
} from '../lib/news-core.mjs';

let passed=0;
function test(name,fn){try{fn();passed++;console.log(`✓ ${name}`)}catch(err){console.error(`✗ ${name}\n  ${err.message}`);process.exitCode=1}}

test('cleanText removes markup and normalizes entities',()=>{assert.equal(cleanText('<b>Anime</b>&nbsp; &amp; manga'),'Anime & manga')});

test('canonicalUrl removes campaign trackers and hash',()=>{assert.equal(canonicalUrl('https://example.com/news/test/?utm_source=x&b=2&a=1#top'),'https://example.com/news/test?a=1&b=2')});

test('source fingerprint is stable after canonicalization',()=>{assert.equal(sourceFingerprint('https://example.com/a?utm_source=x'),sourceFingerprint('https://example.com/a'))});

test('story fingerprint is deterministic',()=>{const a=storyFingerprint('Demon Slayer ganha nova temporada','Nova temporada foi anunciada hoje.'),b=storyFingerprint('Demon Slayer ganha nova temporada','Nova temporada foi anunciada hoje.');assert.equal(a,b);assert.equal(a.length,24)});

test('classifier recognizes editorial categories',()=>{assert.equal(classifyNews({title:'Novo trailer de Chainsaw Man'}),'TRAILER');assert.equal(classifyNews({title:'Editora licencia novo mangá'}),'MANGA');assert.equal(classifyNews({title:'Anime confirma segunda temporada'}),'SEASON');assert.equal(classifyNews({title:'Episódio final ganha data'}),'EPISODE')});

test('facts are split and deduplicated',()=>{const facts=splitFacts('A estreia acontece em outubro. A estreia acontece em outubro. O elenco principal foi confirmado.');assert.equal(facts.length,2)});

test('HTML metadata extractor reads JSON-LD article fields and fact text',()=>{
  const html=`<script type="application/ld+json">${JSON.stringify({'@type':'NewsArticle',headline:'Título da notícia',description:'Descrição editorial longa o suficiente.',image:'https://cdn.example.com/a.jpg',author:{name:'Autor Exemplo'},datePublished:'2026-08-22T10:00:00Z',articleBody:'A produção confirmou a estreia em outubro. O elenco principal também retornará para a continuação.'})}</script>`;
  const meta=extractHtmlMetadata(html,'https://example.com/news/a');
  assert.equal(meta.title,'Título da notícia');assert.equal(meta.imageUrl,'https://cdn.example.com/a.jpg');assert.equal(meta.author,'Autor Exemplo');assert.match(meta.articleText,/estreia em outubro/);
});

test('HTML metadata has an article paragraph fallback when JSON-LD body is missing',()=>{const meta=extractHtmlMetadata('<article><p>A produção anunciou oficialmente uma nova temporada para o próximo ano.</p><p>Mais detalhes serão revelados posteriormente pela equipe responsável.</p></article>','https://example.com/a');assert.match(meta.articleText,/nova temporada/)});

test('source merger removes duplicates while preserving provenance',()=>{const sources=mergeSources([{name:'ANN',url:'https://example.com/a?utm_source=x'}],[{name:'ANN',url:'https://example.com/a'},{name:'Crunchyroll',url:'https://example.org/b'}]);assert.equal(sources.length,2)});

test('editorial article builds structured AniNexus reading content',()=>{const article=buildEditorialArticle({title:'Nova temporada confirmada',summary:'A produção confirmou uma nova temporada com estreia prevista para outubro. O elenco principal retorna.',eventType:'SEASON',facts:['A estreia será em outubro.','O elenco principal retorna.'],sources:[{name:'Fonte A',url:'https://example.com/a'}]});assert.equal(article.version,3);assert.equal(article.category,'Animes');assert.ok(article.sections.length>=2);assert.ok(article.readingMinutes>=1);assert.ok(article.wordCount>0)});

test('quality score rewards richer reporting',()=>{const low=qualityScore({title:'Notícia curta',summary:'Breve.'}),high=qualityScore({title:'Anime confirma uma nova temporada com detalhes',summary:'A produção confirmou oficialmente a continuação e divulgou informações sobre estreia, equipe e elenco para os fãs.',imageUrl:'https://example.com/a.jpg',publishedAt:new Date().toISOString(),sources:[{name:'Fonte A'}],facts:['Fato um confirmado pela produção.','Fato dois com contexto suficiente.']});assert.ok(high>low,`${high} should be > ${low}`)});

if(process.exitCode)throw new Error('News system tests failed');
console.log(`\nAniNexus news system: ${passed} tests passed`);
