const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const DAY = 86_400_000;

function text(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function safeHttpsUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

export function youtubeVideoId(value) {
  const raw = text(value);
  if (VIDEO_ID.test(raw)) return raw;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    let id = '';
    if (host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] || '';
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      id = url.searchParams.get('v') || '';
      if (!id) {
        const parts = url.pathname.split('/').filter(Boolean);
        const marker = parts.findIndex(part => ['embed', 'shorts', 'live'].includes(part));
        if (marker >= 0) id = parts[marker + 1] || '';
      }
    }
    return VIDEO_ID.test(id) ? id : '';
  } catch {
    return '';
  }
}

function videoIds(article) {
  const candidates = [];
  for (const embed of article?.mediaEmbeds || article?.media_embeds || []) {
    candidates.push(embed?.id, embed?.embedUrl, embed?.embed_url, embed?.url);
  }
  for (const block of article?.sourceContent || article?.source_content || []) {
    if (String(block?.type || '').toLowerCase() !== 'video') continue;
    candidates.push(block?.id, block?.embedUrl, block?.embed_url, block?.url);
  }
  return [...new Set(candidates.map(youtubeVideoId).filter(Boolean))];
}

function publishedAt(article) {
  return article?.source_published_at || article?.sourcePublishedAt || article?.published_at || article?.publishedAt || article?.updated_at || article?.updatedAt || '';
}

function isAnimeTrailer(article) {
  const eventType = String(article?.event_type || article?.eventType || article?.category || '').toUpperCase();
  if (!eventType.includes('TRAILER')) return false;
  const copy = text([
    article?.title,
    article?.summary,
    ...(article?.tags || []),
  ].filter(Boolean).join(' ')).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (!/\b(trailer|teaser|pv(?:\s*\d+)?|promotional video|video promocional|previa|preview)\b/.test(copy)) return false;
  if (/\b(game|games|jogo|jogos|dlc|videogame|playstation|xbox|steam|colaboracao|collab|campanha|comercial|brinquedos?|aniversario)\b|nintendo switch|live[ -]?action|dorama|mcdonald|mclanche|video (?:do |de )?anuncio|video celebrando|celebracao de/.test(copy)) return false;
  return /\b(anime|animes|animacao|temporada|serie|filme|movie)\b|アニメ/.test(copy);
}

function trailerKind(article) {
  const copy = text(`${article?.title || ''} ${article?.summary || ''}`).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/\bteaser\b/.test(copy)) return 'TEASER';
  if (/\bpv(?:\s*\d+)?\b|promotional video|video promocional/.test(copy)) return 'PV';
  return 'TRAILER';
}

function displayTitle(article) {
  const original = text(article?.title) || 'Novo trailer de anime';
  const cleaned = original.replace(/\s+(?:ganha|recebe|apresenta|divulga|revela)\s+(?:(?:o|um|seu|novo|primeiro|segundo|final)\s+)*(?:trailer|teaser|pv)\b.*$/i, '').trim();
  return cleaned.length >= 3 ? cleaned : original;
}

export function buildLatestTrailers(articles, options = {}) {
  const now = new Date(options.now || Date.now()).getTime();
  const maxAgeDays = Math.max(1, Math.min(45, Number(options.maxAgeDays || 21)));
  const limit = Math.max(1, Math.min(12, Number(options.limit || 9)));
  const seen = new Set();
  const result = [];
  const ordered = [...(Array.isArray(articles) ? articles : [])].sort((a, b) => Date.parse(publishedAt(b) || 0) - Date.parse(publishedAt(a) || 0));

  for (const article of ordered) {
    if (!isAnimeTrailer(article)) continue;
    const timestamp = Date.parse(publishedAt(article));
    const age = now - timestamp;
    if (!Number.isFinite(timestamp) || age < -36 * 3_600_000 || age > maxAgeDays * DAY) continue;
    const videoId = videoIds(article)[0];
    if (!videoId || seen.has(videoId)) continue;
    seen.add(videoId);
    const slug = text(article?.slug).replace(/[^a-z0-9_-]/gi, '').slice(0, 180);
    result.push({
      id: videoId,
      videoId,
      title: displayTitle(article),
      articleTitle: text(article?.title),
      kind: trailerKind(article),
      publishedAt: new Date(timestamp).toISOString(),
      source: text(article?.source_name || article?.sourceName || article?.source),
      articlePath: slug ? `/noticias/${slug}` : '',
      thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
      fallbackImage: safeHttpsUrl(article?.image_url || article?.imageUrl || article?.image),
    });
    if (result.length >= limit) break;
  }
  return result;
}

export function buildTrailerDocument(articles, options = {}) {
  const generatedAt = new Date(options.now || Date.now()).toISOString();
  const items = buildLatestTrailers(articles, options);
  return {
    generatedAt,
    source: 'AniNexus Noticias',
    freshnessWindowDays: Math.max(1, Math.min(45, Number(options.maxAgeDays || 21))),
    total: items.length,
    items,
  };
}
