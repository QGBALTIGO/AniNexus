const DEFAULT_ENDPOINT = 'https://animeschedule.net/api/v3';
const IMAGE_BASE = 'https://img.animeschedule.net/production/assets/public/img/';

function safeHttpsUrl(value, base = undefined) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw)
      ? raw
      : raw.startsWith('//')
        ? `https:${raw}`
        : base
          ? new URL(raw.replace(/^\/+/, ''), base).href
          : `https://${raw.replace(/^\/+/, '')}`;
    const url = new URL(candidate);
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

function categoryNames(value) {
  return (Array.isArray(value) ? value : [])
    .map(item => String(typeof item === 'string' ? item : item?.name || '').trim())
    .filter(Boolean)
    .slice(0, 30);
}

function externalId(value, segment) {
  const direct = Number(value);
  if (Number.isSafeInteger(direct) && direct > 0) return direct;
  const match = String(value || '').match(new RegExp(`/${segment}/(?:[^/]+/)?(\\d+)(?:/|$|[?#])`, 'i'));
  return match ? Number(match[1]) : null;
}

function mediaFormat(value) {
  const values = categoryNames(value).map(item => item.toLowerCase().replace(/\s+/g, '-'));
  if (values.some(item => item === 'movie' || item === 'film')) return 'MOVIE';
  if (values.some(item => item === 'ova')) return 'OVA';
  if (values.some(item => item === 'ona')) return 'ONA';
  if (values.some(item => item === 'special')) return 'SPECIAL';
  if (values.some(item => item === 'tv-short' || item === 'short')) return 'TV_SHORT';
  return 'TV';
}

function mediaStatus(value) {
  const status = String(value || '').toLowerCase();
  if (status.includes('finished')) return 'FINISHED';
  if (status.includes('upcoming')) return 'NOT_YET_RELEASED';
  if (status.includes('cancel')) return 'CANCELLED';
  if (status.includes('hiatus')) return 'HIATUS';
  return 'RELEASING';
}

function streamLinks(value) {
  const entries = Array.isArray(value) ? value : [];
  return entries.map(item => {
    const url = safeHttpsUrl(item?.url);
    if (!url) return null;
    return {
      site: String(item?.name || item?.platform || 'Streaming').slice(0, 80),
      url,
      icon: '',
      color: '',
      type: 'STREAMING'
    };
  }).filter(Boolean).slice(0, 20);
}

export function normalizeAnimeScheduleItem(item) {
  if (!item || typeof item !== 'object') return null;
  const airedAt = Date.parse(String(item.episodeDate || ''));
  if (!Number.isFinite(airedAt) || airedAt <= 0) return null;
  const title = String(item.title || item.english || item.romaji || item.native || '').trim();
  if (!title) return null;
  const websites = item.websites && typeof item.websites === 'object' ? item.websites : {};
  const episode = Number(item.episodeNumber);
  const episodes = Number(item.episodes);
  const duration = Number(item.lengthMin);
  const route = String(item.route || '').trim().slice(0, 180);
  return {
    contentProvider: 'animeschedule',
    contentProviderUrl: 'https://animeschedule.net/',
    providerRoute: route,
    anilistId: externalId(item.anilistId || websites.aniList, 'anime'),
    idMal: externalId(item.malId || websites.mal, 'anime'),
    title: title.slice(0, 300),
    titleRomaji: String(item.romaji || '').trim().slice(0, 300),
    titleEnglish: String(item.english || '').trim().slice(0, 300),
    titleNative: String(item.native || '').trim().slice(0, 300),
    genres: categoryNames(item.genres),
    cover: safeHttpsUrl(item.imageVersionRoute, IMAGE_BASE),
    airingAt: Math.floor(airedAt / 1000),
    episode: Number.isFinite(episode) && episode > 0 ? episode : null,
    episodes: Number.isFinite(episodes) && episodes > 0 ? episodes : null,
    duration: Number.isFinite(duration) && duration > 0 ? duration : null,
    format: mediaFormat(item.mediaTypes),
    status: mediaStatus(item.status),
    streaming: streamLinks(item.streams)
  };
}

function isoWeekParts(date) {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  value.setUTCDate(value.getUTCDate() + 4 - (value.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  return { year: value.getUTCFullYear(), week: Math.ceil((((value - yearStart) / 86400000) + 1) / 7) };
}

function requestedWeeks(start, end) {
  const first = new Date(Number(start) * 1000);
  const last = new Date(Number(end) * 1000);
  const cursor = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), first.getUTCDate()));
  const result = new Map();
  while (cursor <= last && result.size < 7) {
    const value = isoWeekParts(cursor);
    result.set(`${value.year}-${value.week}`, value);
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  const final = isoWeekParts(last);
  result.set(`${final.year}-${final.week}`, final);
  return [...result.values()];
}

function payloadItems(payload) {
  if (Array.isArray(payload)) return payload;
  for (const key of ['data', 'items', 'timetable', 'anime']) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
}

export async function fetchAnimeScheduleTimetable(start, end, options = {}) {
  const token = String(options.token ?? process.env.ANIMESCHEDULE_API_TOKEN ?? '').trim();
  if (!token) return [];
  const safeStart = Math.floor(Number(start));
  const safeEnd = Math.ceil(Number(end));
  if (!Number.isFinite(safeStart) || !Number.isFinite(safeEnd) || safeEnd <= safeStart) return [];
  const timeout = Math.max(2500, Math.min(20_000, Number(options.timeoutMs || process.env.UPSTREAM_TIMEOUT_MS || 9000)));
  const endpoint = String(options.endpoint || process.env.ANIMESCHEDULE_API_ENDPOINT || DEFAULT_ENDPOINT).replace(/\/+$/, '');
  const rows = [];
  for (const { year, week } of requestedWeeks(safeStart, safeEnd)) {
    const url = new URL(`${endpoint}/timetables/sub`);
    url.searchParams.set('year', String(year));
    url.searchParams.set('week', String(week));
    url.searchParams.set('tz', 'America/Sao_Paulo');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${token}`,
          'user-agent': 'AniNexus/3.8'
        },
        credentials: 'omit',
        redirect: 'error',
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`AnimeSchedule upstream ${response.status}`);
      if (!String(response.headers.get('content-type') || '').includes('application/json')) throw new Error('invalid AnimeSchedule content type');
      rows.push(...payloadItems(await response.json()));
    } finally {
      clearTimeout(timer);
    }
  }
  const seen = new Set();
  return rows.map(normalizeAnimeScheduleItem).filter(item => {
    if (!item || item.airingAt < safeStart || item.airingAt > safeEnd) return false;
    const key = `${item.providerRoute || item.title}:${item.airingAt}:${item.episode || 0}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => a.airingAt - b.airingAt);
}
