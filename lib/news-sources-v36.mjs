import { load } from 'cheerio';
import { cleanText, canonicalUrl, sourceFingerprint, storyFingerprint, classifyNews, categoryLabel, qualityScore, slugify, sha, safeUrl } from './news-core.mjs';
import { parseSourceContent, sourceExcerpt } from './news-source-content.mjs';

const UA = 'Mozilla/5.0 (compatible; AniNexus-News/4.0; +https://aninexus.com.br)';
const RELEVANT_RE = /anime|anim[eê]|mang[aá]|manhwa|manhua|light novel|dublagem|crunchyroll|otaku|cultura japonesa|jap[aã]o|pok[eé]mon|digimon|dragon ball/i;
const SOURCE_PRIORITY = { JBOX: 5, ANIMENEW: 4, ANMTV: 3, GNEWS: 1 };

const iso = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
};

function absoluteUrl(value, baseUrl) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    return safeUrl(new URL(raw, baseUrl || undefined).href);
  } catch {
    return safeUrl(raw);
  }
}

async function get(url, type = 'text', timeout = 18_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'user-agent': UA,
        'accept-language': 'pt-BR,pt;q=.98',
        accept: type === 'json' ? 'application/json' : 'application/rss+xml,application/xml,text/html;q=.9,*/*;q=.5'
      }
    });
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    return type === 'json' ? response.json() : response.text();
  } finally {
    clearTimeout(timer);
  }
}

function sourceText(value = '', max = 30_000) {
  const $ = load(`<body>${String(value || '')}</body>`, { decodeEntities: true });
  return cleanText($('body').text(), max);
}

function wpTerms(post) {
  const values = [];
  for (const group of post?._embedded?.['wp:term'] || []) {
    for (const term of Array.isArray(group) ? group : []) {
      const name = sourceText(term?.name || '', 100);
      if (name) values.push(name);
    }
  }
  return [...new Set(values)];
}

function wpImage(post) {
  const media = post?._embedded?.['wp:featuredmedia']?.[0];
  return safeUrl(media?.media_details?.sizes?.full?.source_url || media?.source_url || '');
}

function wpAuthor(post) {
  return sourceText(post?._embedded?.author?.[0]?.name || '', 180);
}

function relevant(post) {
  return RELEVANT_RE.test(`${sourceText(post?.title?.rendered || '', 600)} ${wpTerms(post).join(' ')}`);
}

async function wordpressSource({ name, key, endpoint, max = 45, filter = relevant }) {
  const items = [];
  const errors = [];
  const perPage = Math.max(10, Math.min(50, max));
  const pages = Math.max(1, Math.min(2, Math.ceil(max / perPage)));
  for (let page = 1; page <= pages; page++) {
    try {
      const query = new URLSearchParams({ per_page: String(perPage), page: String(page), orderby: 'date', order: 'desc', _embed: '1' });
      const posts = await get(`${endpoint}?${query}`, 'json');
      if (!Array.isArray(posts) || !posts.length) break;
      for (const post of posts) {
        if (filter && !filter(post)) continue;
        const url = canonicalUrl(post?.link || '');
        const title = sourceText(post?.title?.rendered || '', 500);
        if (!url || !title) continue;
        const articleHtml = String(post?.content?.rendered || '');
        items.push({
          sourceName: name,
          sourceKey: key,
          sourceLanguage: 'pt-BR',
          title,
          summary: sourceText(post?.excerpt?.rendered || '', 1200),
          url,
          imageUrl: wpImage(post),
          publishedAt: iso(post?.date_gmt ? `${post.date_gmt}Z` : post?.date),
          modifiedAt: iso(post?.modified_gmt ? `${post.modified_gmt}Z` : post?.modified),
          author: wpAuthor(post),
          terms: wpTerms(post),
          articleHtml,
          fullContentProvided: articleHtml.length >= 240,
          ingestMode: 'wp-rest'
        });
      }
      if (posts.length < perPage) break;
    } catch (error) {
      errors.push(error.message);
      break;
    }
  }
  return { items: items.slice(0, max), mode: items.length ? 'wp-rest' : 'failed', errors };
}

function xmlChild($, item, name) {
  const node = $(item).children().toArray().find(child => String(child?.name || '').toLowerCase() === name.toLowerCase());
  return node ? $(node).text() : '';
}

function xmlAttribute($, item, names = []) {
  for (const node of $(item).find('*').toArray()) {
    const tag = String(node?.name || '').toLowerCase();
    if (!names.includes(tag)) continue;
    const value = $(node).attr('url') || $(node).attr('href') || $(node).attr('src');
    if (value) return value;
  }
  return '';
}

async function animeNewRss(max = 45) {
  const url = 'https://animenew.com.br/feed/';
  try {
    const xml = await get(url);
    const $ = load(xml, { xmlMode: true, decodeEntities: true });
    const items = [];
    $('item').each((_, item) => {
      if (items.length >= max) return;
      const articleUrl = canonicalUrl(xmlChild($, item, 'link') || xmlChild($, item, 'guid'));
      const title = sourceText(xmlChild($, item, 'title'), 500);
      if (!articleUrl || !title) return;
      const articleHtml = xmlChild($, item, 'content:encoded');
      const description = xmlChild($, item, 'description');
      const parsed = parseSourceContent(articleHtml || description, articleUrl);
      const image = xmlAttribute($, item, ['media:content', 'media:thumbnail', 'enclosure']) || parsed.mediaGallery[0]?.url || '';
      const category = $(item).children('category').toArray().map(node => sourceText($(node).text(), 100)).filter(Boolean);
      items.push({
        sourceName: 'AnimeNew',
        sourceKey: 'ANIMENEW',
        sourceLanguage: 'pt-BR',
        title,
        summary: sourceText(description, 1200),
        url: articleUrl,
        imageUrl: absoluteUrl(image, articleUrl),
        publishedAt: iso(xmlChild($, item, 'pubDate') || xmlChild($, item, 'dc:date')),
        modifiedAt: '',
        author: sourceText(xmlChild($, item, 'dc:creator'), 180),
        terms: [...new Set(category)],
        articleHtml,
        parsed,
        fullContentProvided: articleHtml.length >= 240,
        ingestMode: 'rss-full'
      });
    });
    return { items, mode: items.length ? 'rss-full' : 'failed', errors: [] };
  } catch (error) {
    return { items: [], mode: 'failed', errors: [error.message] };
  }
}

async function gnews(max = 20) {
  const key = String(process.env.GNEWS_API_KEY || '').trim();
  if (!key) return { items: [], mode: 'disabled:no-key', errors: [] };
  try {
    const query = new URLSearchParams({
      q: '(anime OR manga OR "light novel" OR trailer)',
      lang: 'pt',
      country: 'br',
      max: String(Math.max(1, Math.min(100, max))),
      sortby: 'publishedAt',
      apikey: key
    });
    const data = await get(`https://gnews.io/api/v4/search?${query}`, 'json');
    const items = (Array.isArray(data?.articles) ? data.articles : []).map(article => ({
      sourceName: sourceText(article?.source?.name || 'GNews', 160),
      sourceKey: 'GNEWS',
      sourceLanguage: 'pt-BR',
      title: sourceText(article?.title || '', 500),
      summary: sourceText(article?.description || article?.content || '', 1200),
      url: canonicalUrl(article?.url || ''),
      imageUrl: safeUrl(article?.image || ''),
      publishedAt: iso(article?.publishedAt),
      modifiedAt: '',
      author: '',
      terms: [],
      articleHtml: '',
      fullContentProvided: false,
      ingestMode: 'gnews-preview'
    })).filter(item => item.title && item.url && RELEVANT_RE.test(`${item.title} ${item.summary}`));
    return { items, mode: 'api-preview', errors: [] };
  } catch (error) {
    return { items: [], mode: 'failed', errors: [error.message] };
  }
}

export function languageScore(value) {
  const words = cleanText(value, 12_000).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().match(/[a-z]+/g) || [];
  const pt = new Set('de da do das dos e que para com uma um foi sera novo nova temporada estreia elenco episodio manga filme noticia noticias confirmou anunciou revela ganha divulga chega brasil brasileiro pela pelo mais tambem ainda segundo durante entre sobre apos antes producao diretor estudio dublagem lancamento data trailer visual obra editora'.split(' '));
  const en = new Set('the and of to for with from new will season reveals announces announced release cast episode movie news reviews review worldwide debut interest licenses launches adds gets confirms more director studio staff premiere streaming'.split(' '));
  let portuguese = 0;
  let english = 0;
  for (const word of words) {
    portuguese += Number(pt.has(word));
    english += Number(en.has(word));
  }
  return { pt: portuguese, en: english };
}

export function likelyPortuguese(value) {
  const score = languageScore(value);
  return score.pt >= 2 && score.pt >= score.en;
}

function recent(item, maxAgeHours) {
  const timestamp = Date.parse(item.publishedAt || item.modifiedAt || '');
  return Number.isFinite(timestamp) && Date.now() - timestamp >= -36 * 3_600_000 && Date.now() - timestamp <= maxAgeHours * 3_600_000;
}

function contentParagraph(summary) {
  const text = cleanText(summary, 1200);
  return text ? [{ type: 'paragraph', text, runs: [{ text }] }] : [];
}

function editorialStory(item, minQuality) {
  const url = canonicalUrl(item.url);
  const title = sourceText(item.title, 500);
  if (!url || !title) return null;
  const parsed = item.parsed || parseSourceContent(item.articleHtml || '', url);
  const hasFullContent = Boolean(item.fullContentProvided && parsed.wordCount >= 45 && parsed.blocks.length >= 2);
  const summary = sourceExcerpt(parsed, item.summary, 520);
  if (summary.length < 25 || !likelyPortuguese(`${title} ${summary}`)) return null;
  const sourceContent = hasFullContent ? parsed.blocks : contentParagraph(summary);
  const wordCount = hasFullContent ? parsed.wordCount : summary.split(/\s+/).filter(Boolean).length;
  const imageUrl = safeUrl(item.imageUrl) || parsed.mediaGallery[0]?.url || '';
  const eventType = classifyNews({ title, summary, category: item.terms?.join(' ') });
  const publishedAt = item.publishedAt || item.modifiedAt;
  const sources = [{ name: item.sourceName, url, publishedAt, author: item.author || null }];
  const baseQuality = qualityScore({ title, summary, imageUrl, publishedAt, sources, facts: [] });
  const fidelityBonus = hasFullContent ? Math.min(.18, .08 + sourceContent.length / 800 + Math.min(wordCount, 900) / 9000) : 0;
  const score = Math.min(1, Number((baseQuality + fidelityBonus).toFixed(3)));
  if (score < minQuality) return null;
  const sourceHash = sourceFingerprint(url);
  const storyHash = storyFingerprint(title, summary);
  const id = `${item.sourceKey.toLowerCase()}-${sha(sourceHash, 8)}`;
  return {
    id,
    slug: `${slugify(title)}-${id}`,
    sourceName: item.sourceName,
    sourceKey: item.sourceKey,
    sourceLanguage: 'pt-BR',
    title,
    originalTitle: title,
    summary,
    sourceUrl: url,
    imageUrl,
    publishedAt,
    updatedAt: item.modifiedAt || publishedAt,
    author: item.author || '',
    tags: item.terms || [],
    category: categoryLabel(eventType),
    eventType,
    facts: [],
    contentSections: [],
    sourceContent,
    contentMode: hasFullContent ? 'full' : 'excerpt',
    sources,
    sourceCount: 1,
    mediaGallery: parsed.mediaGallery,
    mediaEmbeds: parsed.mediaEmbeds,
    readingMinutes: Math.max(1, Math.ceil(wordCount / 210)),
    wordCount,
    qualityScore: score,
    sourceHash,
    storyHash,
    coverage: {
      facts: 0,
      sections: 0,
      blocks: sourceContent.length,
      sourceCount: 1,
      ingestMode: item.ingestMode,
      contentMode: hasFullContent ? 'full' : 'excerpt',
      mediaCount: parsed.imageCount,
      embedCount: parsed.videoCount,
      sourcePagesRead: 0
    }
  };
}

function sourceRank(story) {
  return (story.contentMode === 'full' ? 10_000 : 0) + (SOURCE_PRIORITY[story.sourceKey] || 0) * 1_000 + Math.min(story.wordCount || 0, 999);
}

function titleTokens(title) {
  const ignored = new Set(['anime', 'animê', 'manga', 'mangá', 'novo', 'nova', 'ganha', 'anuncia', 'anunciado', 'anunciada', 'divulga', 'revela', 'temporada', 'filme', 'série', 'serie']);
  return new Set(cleanText(title, 600).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().match(/[a-z0-9]+/g)?.filter(token => token.length > 2 && !ignored.has(token)) || []);
}

function sameAnnouncement(a, b) {
  const timeA = Date.parse(a.publishedAt || '');
  const timeB = Date.parse(b.publishedAt || '');
  if (!Number.isFinite(timeA) || !Number.isFinite(timeB) || Math.abs(timeA - timeB) > 72 * 3_600_000) return false;
  const left = titleTokens(a.title);
  const right = titleTokens(b.title);
  if (!left.size || !right.size) return false;
  let shared = 0;
  for (const token of left) shared += Number(right.has(token));
  return shared >= 2 && shared / Math.min(left.size, right.size) >= .5;
}

export async function collectEditorialStories(options = {}) {
  const maxPerSource = Math.max(10, Math.min(60, Number(options.maxPerSource || 40)));
  const maxAgeHours = Math.max(48, Math.min(240, Number(options.maxAgeHours || 168)));
  const maxStories = Math.max(12, Math.min(80, Number(options.maxStories || 60)));
  const minQuality = Math.max(.35, Math.min(.9, Number(options.minQuality || .5)));
  const definitions = [
    ['JBOX', 'JBox', () => wordpressSource({ name: 'JBox', key: 'JBOX', endpoint: 'https://www.jbox.com.br/wp-json/wp/v2/posts', max: maxPerSource })],
    ['ANMTV', 'ANMTV', () => wordpressSource({ name: 'ANMTV', key: 'ANMTV', endpoint: 'https://anmtv.com.br/wp-json/wp/v2/posts', max: maxPerSource })],
    ['ANIMENEW', 'AnimeNew', () => animeNewRss(maxPerSource)],
    ['GNEWS', 'GNews API', () => gnews(Math.min(30, maxPerSource))]
  ];
  const settled = await Promise.allSettled(definitions.map(([, , loadSource]) => loadSource()));
  const sourceResults = [];
  const raw = [];
  settled.forEach((result, index) => {
    const [key, name] = definitions[index];
    const value = result.status === 'fulfilled' ? result.value : { items: [], mode: 'failed', errors: [String(result.reason?.message || result.reason)] };
    const items = (value.items || []).slice(0, maxPerSource);
    const disabled = String(value.mode || '').startsWith('disabled:');
    sourceResults.push({ key, name, ok: !disabled && items.length > 0, enabled: !disabled, count: items.length, mode: value.mode, errors: value.errors || [] });
    raw.push(...items);
  });

  const uniqueByUrl = [...new Map(raw.filter(item => item.url).map(item => [sourceFingerprint(item.url), item])).values()];
  const candidates = uniqueByUrl.filter(item => recent(item, maxAgeHours)).map(item => editorialStory(item, minQuality)).filter(Boolean);
  const groups = [];
  for (const story of candidates.sort((a, b) => sourceRank(b) - sourceRank(a))) {
    const index = groups.findIndex(previous => previous.storyHash === story.storyHash || sameAnnouncement(previous, story));
    if (index < 0) groups.push(story);
    else if (sourceRank(story) > sourceRank(groups[index])) groups[index] = story;
  }
  const stories = groups.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt) || sourceRank(b) - sourceRank(a)).slice(0, maxStories);
  return {
    stories,
    sourceResults,
    collected: raw.length,
    grouped: groups.length,
    skippedTranslation: 0,
    skippedQuality: Math.max(0, uniqueByUrl.length - candidates.length),
    collectorVersion: 40
  };
}
