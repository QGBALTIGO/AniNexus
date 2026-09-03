import { load } from 'cheerio';
import { cleanText, normalizeNewsImageUrl, safeUrl } from './news-core.mjs';

const MAX_BLOCKS = 160;
const MAX_IMAGES = 18;
const MAX_VIDEOS = 6;
const MAX_TEXT = 120_000;
const NOISE_RE = /(?:^|[\s_-])(ad|ads|advert|advertisement|banner|newsletter|outbrain|related|share|sharedaddy|social|sponsor|tracking|widget)(?:$|[\s_-])/i;
const NOISE_TEXT_RE = /^(?:publicidade|continua depois da publicidade|assine(?: nossa)? newsletter|siga (?:o|a) .+|leia tamb[eé]m|veja tamb[eé]m|conte[uú]do patrocinado)\b/i;
const BAD_IMAGE_RE = /avatar|gravatar|logo|emoji|icon|sprite|pixel|tracking|badge|banner-ad|placeholder|loading\.gif|(?:^|[\/_-])ads?(?:[\/_\-.]|$)|1x1/i;

function absoluteUrl(value, baseUrl) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    return safeUrl(new URL(raw, baseUrl || undefined).href);
  } catch {
    return safeUrl(raw);
  }
}

function nodeName(node) {
  return String(node?.tagName || node?.name || '').toLowerCase();
}

function marksEqual(a = [], b = []) {
  return a.length === b.length && a.every((mark, index) => mark === b[index]);
}

function normalizeRuns(runs = [], trim = true) {
  const normalized = [];
  for (const run of runs) {
    let text = String(run?.text || '').replace(/\s+/g, ' ');
    if (!text) continue;
    const marks = [...new Set((run.marks || []).filter(mark => ['strong', 'em', 'code'].includes(mark)))];
    const href = safeUrl(run.href || '') || undefined;
    const previous = normalized.at(-1);
    if (previous && previous.href === href && marksEqual(previous.marks || [], marks)) previous.text += text;
    else normalized.push({ text, ...(marks.length ? { marks } : {}), ...(href ? { href } : {}) });
  }
  if (trim && normalized.length) {
    normalized[0].text = normalized[0].text.trimStart();
    normalized.at(-1).text = normalized.at(-1).text.trimEnd();
  }
  return normalized.filter(run => run.text);
}

function runsText(runs = []) {
  return cleanText(runs.map(run => run.text).join(''), MAX_TEXT);
}

function imageUrl($, node, baseUrl) {
  const el = $(node);
  const srcset = el.attr('srcset') || el.attr('data-srcset') || '';
  const srcsetUrl = srcset
    .split(',')
    .map(item => {
      const [url = '', descriptor = '0'] = item.trim().split(/\s+/);
      return { url, size: Number.parseFloat(descriptor) || 0 };
    })
    .filter(item => item.url)
    .sort((a, b) => b.size - a.size)[0]?.url || '';
  return normalizeNewsImageUrl(absoluteUrl(
    el.attr('data-orig-file')
      || el.attr('data-large-file')
      || el.attr('data-lazy-src')
      || el.attr('data-src')
      || el.attr('data-original')
      || srcsetUrl
      || el.attr('src'),
    baseUrl
  ));
}

function isBadImage(url, alt = '') {
  return !url || BAD_IMAGE_RE.test(`${url} ${alt}`.toLowerCase());
}

function videoBlock($, node, baseUrl) {
  const el = $(node);
  const raw = absoluteUrl(el.attr('src') || el.attr('data-src') || el.attr('href') || el.find('source').first().attr('src'), baseUrl);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.hostname.includes('youtu.be') || url.hostname.includes('youtube.com') || url.hostname.includes('youtube-nocookie.com')) {
      const id = url.hostname.includes('youtu.be')
        ? url.pathname.split('/').filter(Boolean)[0]
        : url.pathname.includes('/embed/')
          ? url.pathname.split('/embed/')[1]?.split(/[/?#]/)[0]
          : url.searchParams.get('v');
      if (!id || !/^[\w-]{6,20}$/.test(id)) return null;
      return { type: 'video', provider: 'youtube', url: `https://www.youtube.com/watch?v=${id}`, embedUrl: `https://www.youtube-nocookie.com/embed/${id}` };
    }
    if (url.hostname.includes('vimeo.com')) {
      const id = url.pathname.split('/').filter(Boolean).findLast(part => /^\d+$/.test(part));
      if (!id) return null;
      return { type: 'video', provider: 'vimeo', url: `https://vimeo.com/${id}`, embedUrl: `https://player.vimeo.com/video/${id}` };
    }
    if (nodeName(node) === 'video' && /\.(?:mp4|webm|ogg)(?:$|\?)/i.test(raw)) return { type: 'video', provider: 'html5', url: raw };
  } catch {}
  return null;
}

function inlineRuns($, nodes, baseUrl, onMedia) {
  const runs = [];
  const visit = (node, marks = [], href = '') => {
    if (!node) return;
    if (node.type === 'text') {
      runs.push({ text: node.data || '', ...(marks.length ? { marks } : {}), ...(href ? { href } : {}) });
      return;
    }
    const tag = nodeName(node);
    if (['script', 'style', 'noscript'].includes(tag)) return;
    if (tag === 'br') {
      runs.push({ text: '\n', ...(marks.length ? { marks } : {}), ...(href ? { href } : {}) });
      return;
    }
    if (tag === 'img') {
      onMedia?.(node);
      return;
    }
    if (['iframe', 'video'].includes(tag)) {
      onMedia?.(node);
      return;
    }
    const nextMarks = [...marks];
    if (['strong', 'b'].includes(tag)) nextMarks.push('strong');
    if (['em', 'i'].includes(tag)) nextMarks.push('em');
    if (tag === 'code') nextMarks.push('code');
    const nextHref = tag === 'a' ? absoluteUrl($(node).attr('href'), baseUrl) : href;
    for (const child of node.children || []) visit(child, nextMarks, nextHref);
  };
  for (const node of nodes || []) visit(node);
  return normalizeRuns(runs, false);
}

function meaningfulText(text) {
  const value = cleanText(text, MAX_TEXT);
  return value.length >= 2 && !(value.length < 240 && NOISE_TEXT_RE.test(value));
}

function blockKey(block) {
  if (block.type === 'image') return `image:${block.url}`;
  if (block.type === 'video') return `video:${block.embedUrl || block.url}`;
  if (block.type === 'list') return `list:${block.items.map(item => item.text).join('|').toLowerCase()}`;
  return `${block.type}:${String(block.text || '').toLowerCase()}`;
}

export function parseSourceContent(html = '', baseUrl = '') {
  const $ = load(String(html || ''), { decodeEntities: true });
  $('script,style,noscript,form,button,nav,aside,template,canvas').remove();
  $('[class],[id]').each((_, element) => {
    const marker = `${$(element).attr('class') || ''} ${$(element).attr('id') || ''}`;
    if (NOISE_RE.test(marker)) $(element).remove();
  });

  const blocks = [];
  const keys = new Set();
  let imageCount = 0;
  let videoCount = 0;
  let textSize = 0;

  const push = block => {
    if (!block || blocks.length >= MAX_BLOCKS) return;
    if (block.text) {
      block.text = cleanText(block.text, 12_000);
      if (!meaningfulText(block.text)) return;
      textSize += block.text.length;
      if (textSize > MAX_TEXT) return;
    }
    const key = blockKey(block);
    if (keys.has(key)) return;
    keys.add(key);
    blocks.push(block);
  };

  const pushImage = (node, caption = '') => {
    if (imageCount >= MAX_IMAGES) return;
    const url = imageUrl($, node, baseUrl);
    const alt = cleanText($(node).attr('alt') || '', 500);
    if (isBadImage(url, `${alt} ${caption}`)) return;
    imageCount++;
    push({ type: 'image', url, ...(alt ? { alt } : {}), ...(caption ? { caption: cleanText(caption, 1000) } : {}) });
  };

  const pushVideo = node => {
    if (videoCount >= MAX_VIDEOS) return;
    const block = videoBlock($, node, baseUrl);
    if (!block) return;
    videoCount++;
    push(block);
  };

  const pushInline = (type, node, extra = {}) => {
    let pending = [];
    const flush = () => {
      const runs = normalizeRuns(pending);
      const text = runsText(runs);
      if (meaningfulText(text)) push({ type, text, runs, ...extra });
      pending = [];
    };
    const media = mediaNode => {
      flush();
      if (nodeName(mediaNode) === 'img') pushImage(mediaNode);
      else pushVideo(mediaNode);
    };
    for (const child of node.children || []) pending.push(...inlineRuns($, [child], baseUrl, media));
    flush();
  };

  const walk = node => {
    if (!node || blocks.length >= MAX_BLOCKS || node.type === 'text') return;
    const tag = nodeName(node);
    if (['script', 'style', 'noscript', 'form', 'button', 'nav', 'aside', 'template', 'canvas'].includes(tag)) return;
    if (tag === 'figure') {
      const caption = cleanText($(node).find('figcaption').first().text(), 1000);
      const media = $(node).find('img,iframe,video').toArray();
      for (const item of media) nodeName(item) === 'img' ? pushImage(item, caption) : pushVideo(item);
      return;
    }
    if (/^h[1-6]$/.test(tag)) {
      pushInline('heading', node, { level: Math.max(2, Math.min(4, Number(tag.slice(1)) || 2)) });
      return;
    }
    if (tag === 'p') {
      pushInline('paragraph', node);
      return;
    }
    if (tag === 'blockquote') {
      pushInline('blockquote', node);
      return;
    }
    if (tag === 'ul' || tag === 'ol') {
      const items = [];
      $(node).children('li').each((_, item) => {
        const runs = inlineRuns($, item.children || [], baseUrl);
        const text = runsText(runs);
        if (meaningfulText(text)) items.push({ text, runs });
      });
      if (items.length) push({ type: 'list', ordered: tag === 'ol', items: items.slice(0, 40) });
      return;
    }
    if (tag === 'table') {
      const rows = [];
      $(node).find('tr').each((_, row) => {
        const cells = $(row).children('th,td').toArray().map(cell => cleanText($(cell).text(), 1200)).filter(Boolean);
        if (cells.length) rows.push(cells);
      });
      if (rows.length) push({ type: 'table', rows: rows.slice(0, 30) });
      return;
    }
    if (tag === 'img') {
      pushImage(node);
      return;
    }
    if (tag === 'iframe' || tag === 'video') {
      pushVideo(node);
      return;
    }
    if (tag === 'hr') {
      push({ type: 'divider' });
      return;
    }
    for (const child of node.children || []) walk(child);
  };

  const root = $('article').first().length ? $('article').first()[0] : $('body').first()[0] || $.root()[0];
  for (const child of root?.children || []) walk(child);

  const text = cleanText(blocks.flatMap(block => {
    if (block.text) return [block.text];
    if (block.type === 'list') return block.items.map(item => item.text);
    if (block.type === 'table') return block.rows.flat();
    return block.caption ? [block.caption] : [];
  }).join(' '), MAX_TEXT);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const firstParagraph = blocks.find(block => block.type === 'paragraph')?.text || '';
  const mediaGallery = blocks.filter(block => block.type === 'image').map(block => ({ type: 'image', url: block.url, alt: block.alt || '', caption: block.caption || '' }));
  const mediaEmbeds = blocks.filter(block => block.type === 'video' && block.embedUrl).map(block => ({ type: block.provider, url: block.embedUrl }));

  return { blocks, text, firstParagraph, wordCount, imageCount: mediaGallery.length, videoCount: blocks.filter(block => block.type === 'video').length, mediaGallery, mediaEmbeds };
}

export function sourceExcerpt(parsed, fallback = '', max = 520) {
  const text = cleanText(parsed?.firstParagraph || fallback || '', MAX_TEXT);
  if (text.length <= max) return text;
  const clipped = text.slice(0, max + 1);
  const stop = Math.max(clipped.lastIndexOf('. '), clipped.lastIndexOf('! '), clipped.lastIndexOf('? '));
  if (stop >= Math.floor(max * .55)) return clipped.slice(0, stop + 1).trim();
  const word = clipped.slice(0, max).replace(/\s+\S*$/, '').trim();
  return `${word || clipped.slice(0, max).trim()}…`;
}

export { MAX_BLOCKS, MAX_IMAGES, MAX_VIDEOS };
