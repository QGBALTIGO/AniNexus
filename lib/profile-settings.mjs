import { load } from 'cheerio';

const ANILIST_ENDPOINT = 'https://graphql.anilist.co';
const ANILIST_SITE = 'https://anilist.co';
const IMPORTABLE_STATUSES = new Set(['PLANNING', 'CURRENT', 'COMPLETED', 'PAUSED', 'DROPPED']);

const MODERATION_EXACT = new Set([
  'arrombado', 'buceta', 'caralho', 'cuzao', 'fdp', 'foda-se', 'fodase', 'merda',
  'piranha', 'porra', 'pqp', 'puta', 'puto', 'vadia', 'viado',
  'bitch', 'cunt', 'faggot', 'nigger', 'nigga', 'whore',
]);
const MODERATION_SEVERE = ['faggot', 'nigger', 'nigga'];

export function normalizedUsernameKey(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[013457@$]/g, character => ({ '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' })[character])
    .replace(/[_.-]+/g, '');
}

export function usernameModerationReason(value) {
  const normalized = normalizedUsernameKey(value);
  if (!normalized) return null;
  if (MODERATION_EXACT.has(normalized) || MODERATION_SEVERE.some(term => normalized.includes(term))) return 'OFFENSIVE_USERNAME';
  return null;
}

function importStatus(value) {
  const status = String(value || '').toUpperCase();
  if (status === 'REPEATING') return 'CURRENT';
  return IMPORTABLE_STATUSES.has(status) ? status : 'PLANNING';
}

function normalizeAniListCollection(collection, mediaType) {
  const entries = (collection?.lists || []).flatMap(list => list?.entries || []);
  const unique = new Map();
  for (const entry of entries) {
    const mediaId = Number(entry?.mediaId || entry?.media?.id);
    if (!Number.isSafeInteger(mediaId) || mediaId <= 0) continue;
    unique.set(mediaId, {
      mediaId,
      mediaType,
      status: importStatus(entry.status),
      score: Number(entry.score) > 0 ? Math.min(10, Math.max(0, Number(entry.score))) : null,
      progress: Math.min(100_000, Math.max(0, Number(entry.progress) || 0)),
      volumeProgress: mediaType === 'MANGA' ? Math.min(100_000, Math.max(0, Number(entry.progressVolumes) || 0)) : 0,
      updatedAt: Number(entry.updatedAt) > 0 ? Number(entry.updatedAt) : Math.floor(Date.now() / 1000),
      idMal: Number(entry?.media?.idMal) || null,
      title: String(entry?.media?.title?.english || entry?.media?.title?.romaji || entry?.media?.title?.native || '').slice(0, 300),
    });
  }
  return [...unique.values()].slice(0, 5000);
}

function importStatusFromPage(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return importStatus({ REWATCHING: 'REPEATING', REREADING: 'REPEATING', WATCHING: 'CURRENT', READING: 'CURRENT', 'PLAN TO WATCH': 'PLANNING', 'PLAN TO READ': 'PLANNING', 'ON-HOLD': 'PAUSED' }[normalized] || normalized);
}

function visibleProgress(value) {
  const match = String(value || '').replace(/\s+/g, ' ').trim().match(/^(\d[\d,._ ]*)/);
  if (!match) return 0;
  return Math.min(100_000, Math.max(0, Number(match[1].replace(/[,._ ]/g, '')) || 0));
}

function pageScore(row, scoreScale) {
  const scoreNode = row.find('.score').first();
  const raw = Number(scoreNode.attr('score'));
  if (!Number.isFinite(raw) || raw <= 0) return null;
  if (scoreNode.find('[data-icon="star"],.fa-star').length) return Math.min(10, raw * 2);
  if (scoreNode.find('[data-icon="frown"],.fa-frown').length) return 3;
  if (scoreNode.find('[data-icon="meh"],.fa-meh').length) return 6;
  if (scoreNode.find('[data-icon="smile"],.fa-smile').length) return 10;
  return Math.min(10, Math.max(0, scoreScale === 'POINT_100' ? raw / 10 : raw));
}

export function parseAniListListPage(html, mediaType, requestedUsername) {
  const $ = load(String(html || ''));
  const expectedType = mediaType === 'MANGA' ? 'MANGA' : 'ANIME';
  const title = String($('meta[property="og:title"]').first().attr('content') || $('title').text() || '');
  const canonicalUser = String($('.user .name').first().text() || '').trim();
  const requested = String(requestedUsername || '').trim();
  const identifiesUser = [title, canonicalUser].some(value => value.toLocaleLowerCase('en-US').includes(requested.toLocaleLowerCase('en-US')));
  const listRoot = $('.lists').first();
  if (!identifiesUser || !listRoot.length) return { valid: false, entries: [] };
  const maxNumericScore = Math.max(0, ...listRoot.find('.entry.row .score').map((_index, element) => Number($(element).attr('score')) || 0).get());
  const scoreScale = maxNumericScore > 10 ? 'POINT_100' : 'POINT_10';
  const unique = new Map();
  listRoot.find('.entry.row').each((_index, element) => {
    const row = $(element);
    const link = String(row.find('.title a').first().attr('href') || '');
    const match = link.match(new RegExp(`^/${expectedType.toLowerCase()}/(\\d+)(?:/|$)`, 'i'));
    if (!match) return;
    const mediaId = Number(match[1]);
    if (!Number.isSafeInteger(mediaId) || mediaId <= 0) return;
    const progressNodes = row.find('.progress');
    const textWithoutChildren = node => node.clone().children().remove().end().text().trim();
    unique.set(mediaId, {
      mediaId,
      mediaType: expectedType,
      status: importStatusFromPage(row.find('.status').first().text()),
      score: pageScore(row, scoreScale),
      progress: visibleProgress(textWithoutChildren(progressNodes.eq(0))),
      volumeProgress: expectedType === 'MANGA' ? visibleProgress(textWithoutChildren(progressNodes.eq(1))) : 0,
      updatedAt: Math.floor(Date.now() / 1000),
      idMal: null,
      title: String(row.find('.title a').first().text() || '').replace(/\s+/g, ' ').trim().slice(0, 300),
    });
  });
  return { valid: true, entries: [...unique.values()].slice(0, 5000) };
}

async function fetchAniListPublicPages({ username, selected, fetchImpl, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(8_000, Math.min(25_000, Number(timeoutMs) * 2 || 18_000)));
  try {
    const results = await Promise.all(selected.map(async mediaType => {
      const suffix = mediaType === 'MANGA' ? 'mangalist' : 'animelist';
      const response = await fetchImpl(`${ANILIST_SITE}/user/${encodeURIComponent(username)}/${suffix}`, {
        method: 'GET',
        // AniList's SSR endpoint currently returns only a JavaScript shell to
        // application/browser user agents during API incidents. Its plain HTTP
        // representation contains the same public list rendered for no-script
        // clients, which is exactly what this contingency parser consumes.
        headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': 'curl/8.10.1' },
        credentials: 'omit',
        redirect: 'follow',
        signal: controller.signal,
      });
      const contentType = String(response.headers.get('content-type') || '');
      if (response.status === 404) return { valid: false, notFound: true, entries: [] };
      if (!response.ok || !contentType.includes('text/html')) throw Object.assign(new Error('AniList unavailable'), { code: 'ANILIST_UNAVAILABLE' });
      const declaredSize = Number(response.headers.get('content-length') || 0);
      if (declaredSize > 12 * 1024 * 1024) throw Object.assign(new Error('AniList page too large'), { code: 'ANILIST_UNAVAILABLE' });
      const html = await response.text();
      if (html.length > 12 * 1024 * 1024) throw Object.assign(new Error('AniList page too large'), { code: 'ANILIST_UNAVAILABLE' });
      return parseAniListListPage(html, mediaType, username);
    }));
    if (results.some(result => result.notFound)) throw Object.assign(new Error('AniList user not found'), { code: 'ANILIST_USER_NOT_FOUND' });
    if (!results.every(result => result.valid)) throw Object.assign(new Error('AniList public list unavailable or private'), { code: 'ANILIST_UNAVAILABLE' });
    const entries = results.flatMap(result => result.entries).slice(0, 5000);
    Object.defineProperty(entries, 'source', { value: 'PUBLIC_PAGE', enumerable: false });
    return entries;
  } catch (error) {
    if (error?.code) throw error;
    throw Object.assign(new Error('AniList unavailable'), { code: 'ANILIST_UNAVAILABLE', cause: error });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchAniListEntries({ username, types = ['ANIME', 'MANGA'], fetchImpl = fetch, timeoutMs = 12_000 }) {
  const selected = [...new Set(types)].filter(type => type === 'ANIME' || type === 'MANGA');
  if (!selected.length) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(2500, Math.min(20_000, Number(timeoutMs) || 12_000)));
  const query = `query($name:String!,$anime:Boolean!,$manga:Boolean!){
    anime:MediaListCollection(userName:$name,type:ANIME) @include(if:$anime){lists{entries{mediaId status score(format:POINT_10_DECIMAL) progress progressVolumes updatedAt media{id idMal type title{romaji english native}}}}}
    manga:MediaListCollection(userName:$name,type:MANGA) @include(if:$manga){lists{entries{mediaId status score(format:POINT_10_DECIMAL) progress progressVolumes updatedAt media{id idMal type title{romaji english native}}}}}
  }`;
  try {
    const response = await fetchImpl(ANILIST_ENDPOINT, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json', 'user-agent': 'AniNexus/3.8' },
      body: JSON.stringify({ query, variables: { name: username, anime: selected.includes('ANIME'), manga: selected.includes('MANGA') } }),
      credentials: 'omit',
      redirect: 'error',
      signal: controller.signal,
    });
    const contentType = String(response.headers.get('content-type') || '');
    if (!contentType.includes('application/json')) throw Object.assign(new Error('Invalid AniList response'), { code: 'ANILIST_UNAVAILABLE' });
    const payload = await response.json();
    if (!response.ok || payload?.errors?.length) {
      const notFound = response.status === 404 || payload?.errors?.some(error => /not found|invalid user/i.test(String(error?.message || '')));
      throw Object.assign(new Error(notFound ? 'AniList user not found' : 'AniList unavailable'), { code: notFound ? 'ANILIST_USER_NOT_FOUND' : 'ANILIST_UNAVAILABLE' });
    }
    const entries = [
      ...(selected.includes('ANIME') ? normalizeAniListCollection(payload?.data?.anime, 'ANIME') : []),
      ...(selected.includes('MANGA') ? normalizeAniListCollection(payload?.data?.manga, 'MANGA') : []),
    ];
    Object.defineProperty(entries, 'source', { value: 'GRAPHQL', enumerable: false });
    return entries;
  } catch (error) {
    if (error?.code === 'ANILIST_USER_NOT_FOUND') throw error;
    return fetchAniListPublicPages({ username, selected, fetchImpl, timeoutMs });
  } finally {
    clearTimeout(timer);
  }
}

function xml(value) {
  return String(value ?? '').replace(/[<>&"']/g, character => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[character]);
}

function cdata(value) {
  return `<![CDATA[${String(value ?? '').replaceAll(']]>', ']]]]><![CDATA[>')}]]>`;
}

function malStatus(status, mediaType) {
  const manga = mediaType === 'MANGA';
  return ({
    PLANNING: manga ? 'Plan to Read' : 'Plan to Watch',
    CURRENT: manga ? 'Reading' : 'Watching',
    COMPLETED: 'Completed',
    PAUSED: 'On-Hold',
    DROPPED: 'Dropped',
  })[status] || (manga ? 'Plan to Read' : 'Plan to Watch');
}

export function buildAniListImportXml({ username, mediaType, entries }) {
  const type = mediaType === 'MANGA' ? 'MANGA' : 'ANIME';
  const usable = (Array.isArray(entries) ? entries : []).filter(entry => Number(entry.idMal) > 0);
  const rows = usable.map(entry => {
    const score = Math.max(0, Math.min(10, Math.round(Number(entry.score) || 0)));
    if (type === 'MANGA') return `<manga><manga_mangadb_id>${Number(entry.idMal)}</manga_mangadb_id><manga_title>${cdata(entry.title || `Mangá ${entry.mediaId}`)}</manga_title><manga_num_chapters>0</manga_num_chapters><manga_num_volumes>0</manga_num_volumes><my_start_date>0000-00-00</my_start_date><my_finish_date>0000-00-00</my_finish_date><my_scanalation_group></my_scanalation_group><my_read_chapters>${Number(entry.progress) || 0}</my_read_chapters><my_read_volumes>${Number(entry.volumeProgress) || 0}</my_read_volumes><my_score>${score}</my_score><my_storage_value>0.00</my_storage_value><my_status>${xml(malStatus(entry.status, type))}</my_status><my_comments>${cdata('Exportado do AniNexus')}</my_comments><my_times_read>0</my_times_read><my_tags>${cdata('AniNexus')}</my_tags><my_rereading>0</my_rereading><my_reread_value></my_reread_value><update_on_import>1</update_on_import></manga>`;
    return `<anime><series_animedb_id>${Number(entry.idMal)}</series_animedb_id><series_title>${cdata(entry.title || `Anime ${entry.mediaId}`)}</series_title><series_type>TV</series_type><series_episodes>0</series_episodes><my_id>0</my_id><my_watched_episodes>${Number(entry.progress) || 0}</my_watched_episodes><my_start_date>0000-00-00</my_start_date><my_finish_date>0000-00-00</my_finish_date><my_rated></my_rated><my_score>${score}</my_score><my_dvd></my_dvd><my_storage></my_storage><my_status>${xml(malStatus(entry.status, type))}</my_status><my_comments>${cdata('Exportado do AniNexus')}</my_comments><my_times_watched>0</my_times_watched><my_rewatch_value></my_rewatch_value><my_tags>${cdata('AniNexus')}</my_tags><my_rewatching>0</my_rewatching><my_rewatching_ep>0</my_rewatching_ep><update_on_import>1</update_on_import></anime>`;
  });
  const myInfo = type === 'MANGA'
    ? `<myinfo><user_id>0</user_id><user_name>${xml(username)}</user_name><user_export_type>2</user_export_type><user_total_manga>${usable.length}</user_total_manga><user_total_reading>${usable.filter(entry => entry.status === 'CURRENT').length}</user_total_reading><user_total_completed>${usable.filter(entry => entry.status === 'COMPLETED').length}</user_total_completed><user_total_onhold>${usable.filter(entry => entry.status === 'PAUSED').length}</user_total_onhold><user_total_dropped>${usable.filter(entry => entry.status === 'DROPPED').length}</user_total_dropped><user_total_plantoread>${usable.filter(entry => entry.status === 'PLANNING').length}</user_total_plantoread></myinfo>`
    : `<myinfo><user_id>0</user_id><user_name>${xml(username)}</user_name><user_export_type>1</user_export_type><user_total_anime>${usable.length}</user_total_anime><user_total_watching>${usable.filter(entry => entry.status === 'CURRENT').length}</user_total_watching><user_total_completed>${usable.filter(entry => entry.status === 'COMPLETED').length}</user_total_completed><user_total_onhold>${usable.filter(entry => entry.status === 'PAUSED').length}</user_total_onhold><user_total_dropped>${usable.filter(entry => entry.status === 'DROPPED').length}</user_total_dropped><user_total_plantowatch>${usable.filter(entry => entry.status === 'PLANNING').length}</user_total_plantowatch></myinfo>`;
  return { content: `<?xml version="1.0" encoding="UTF-8"?>\n<myanimelist>${myInfo}${rows.join('')}</myanimelist>\n`, exported: usable.length, skipped: Math.max(0, (entries?.length || 0) - usable.length) };
}
