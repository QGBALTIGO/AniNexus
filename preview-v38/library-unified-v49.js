'use strict';
(() => {
  if (window.__ANINEXUS_UNIFIED_LIBRARY__) return;
  window.__ANINEXUS_UNIFIED_LIBRARY__ = true;

  const app = document.querySelector('#app');
  if (!app) return;

  const IS_PAGES = location.hostname.endsWith('github.io');
  const BASE = IS_PAGES ? '/AniNexus' : '';
  const BUILD = '44.29.0';
  const ROUTES = new Set(['/minha-biblioteca', '/meus-animes', '/meus-mangas']);
  const STATE_KEY = 'aninexus:mediaState:v2';
  const FAV_KEY = 'aninexus:favorites';
  const DEMO_IMPRESSIONS = 'aninexus:impressions:v1';
  const ANILIST = 'https://graphql.anilist.co';
  const FALLBACK_TITLE = 'Título temporariamente indisponível';

  const ICON = {
    library: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V5H6.5A2.5 2.5 0 0 0 4 7.5v12Z"/><path d="M8 7h8M8 11h7"/></svg>',
    anime: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
    manga: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V5H6.5A2.5 2.5 0 0 0 4 7.5v12Z"/><path d="M8 7.5h8M8 11h6"/></svg>',
    message: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"/><path d="M8 9h8M8 13h5"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
    filter: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>',
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 8.8c0 5-8.5 10-8.5 10s-8.5-5-8.5-10A4.6 4.6 0 0 1 12 6.4a4.6 4.6 0 0 1 8.5 2.4Z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7V5Z"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 7"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>'
  };

  const LABELS = {
    ANIME: {PLANNING: 'Quero ver', CURRENT: 'Assistindo', COMPLETED: 'Terminei', PAUSED: 'Pausei', DROPPED: 'Desisti'},
    MANGA: {PLANNING: 'Quero ler', CURRENT: 'Lendo', COMPLETED: 'Terminei', PAUSED: 'Pausei', DROPPED: 'Desisti'}
  };
  const STATUS_ORDER = ['PLANNING', 'CURRENT', 'COMPLETED', 'PAUSED', 'DROPPED'];
  const state = {
    media: 'ANIME',
    view: 'MEDIA',
    filter: 'ALL',
    search: '',
    sort: 'recent',
    anime: null,
    manga: null,
    token: 0,
    mounted: false,
    lastScrollY: 0,
    scrollFrame: 0
  };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } };
  const slug = value => String(value || 'obra').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 90) || 'obra';
  const usableTitle = value => { const title = String(value || '').trim(); return title && !/^(?:anime|mang[áa])\s*\d+$/i.test(title) ? title : ''; };

  function routeInfo() {
    try {
      const url = new URL(location.href);
      const restored = url.searchParams.get('p');
      if (restored) {
        const restoredUrl = new URL(restored, location.origin);
        return {path: restoredUrl.pathname.replace(/\/+$/, '') || '/', search: restoredUrl.searchParams};
      }
      let path = url.pathname;
      if (IS_PAGES) path = path.replace(/^\/AniNexus/, '') || '/';
      return {path: path.replace(/\/+$/, '') || '/', search: url.searchParams};
    } catch {
      return {path: '/', search: new URLSearchParams()};
    }
  }
  const onLibrary = () => ROUTES.has(routeInfo().path);
  const pageUrl = path => IS_PAGES ? `${BASE}/?build=${BUILD}&p=${encodeURIComponent(path)}` : path;
  function go(path) {
    if (!IS_PAGES && window.AniNexusRadio?.navigate?.(path)) return;
    if (IS_PAGES) location.assign(pageUrl(path));
    else {
      history.pushState({}, '', path);
      dispatchEvent(new PopStateEvent('popstate'));
    }
  }
  function replaceLibraryUrl(media) {
    const destination = `/minha-biblioteca?midia=${media === 'MANGA' ? 'mangas' : 'animes'}`;
    if (IS_PAGES) {
      const url = new URL(location.href);
      url.searchParams.set('p', destination);
      history.replaceState({}, '', url);
    } else history.replaceState({}, '', destination);
  }
  function initialMedia() {
    const {path, search} = routeInfo();
    if (path === '/meus-mangas' || search.get('midia') === 'mangas') return 'MANGA';
    return 'ANIME';
  }

  async function request(path, options = {}) {
    if (window.AniNexusAuth?.enabled === true) {
      try { return await window.AniNexusAuth.api(path, options); }
      catch (error) { if (error?.status === 401) return {__unauth: true}; throw error; }
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(path, {
        credentials: 'same-origin', cache: 'no-store', ...options, signal: controller.signal,
        headers: {accept: 'application/json', ...(options.body ? {'content-type': 'application/json'} : {}), ...(options.headers || {})}
      });
      if (response.status === 401) return {__unauth: true};
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json().catch(() => ({}));
    } finally { clearTimeout(timer); }
  }

  function mediaOf(raw, id, mediaType) {
    const media = raw && typeof raw === 'object' ? raw : {};
    const title = usableTitle(typeof media.title === 'string' ? media.title : (media.title?.english || media.title?.userPreferred || media.title?.romaji || media.title?.native)) || FALLBACK_TITLE;
    const cover = media.cover || media.coverImage?.extraLarge || media.coverImage?.large || '';
    const numericId = Number(media.id || id);
    const titleSlug = slug(title);
    const routeSlug = String(media.slug || '').trim() || (titleSlug.endsWith(`-${numericId}`) ? titleSlug : `${titleSlug}-${numericId}`);
    const internalScore = media.metricsSource === 'aninexus' && media.score != null ? Number(media.score) : null;
    return {
      id: numericId, mediaType, title, cover,
      score: Number.isFinite(internalScore) ? internalScore : null,
      metricsSource: media.metricsSource === 'aninexus' ? 'aninexus' : '',
      episodes: media.episodes == null ? null : Number(media.episodes),
      chapters: media.chapters == null ? null : Number(media.chapters),
      volumes: media.volumes == null ? null : Number(media.volumes),
      status: String(media.status || ''), format: String(media.format || ''),
      seasonYear: media.seasonYear || media.startDate?.year || null,
      genres: Array.isArray(media.genres) ? media.genres : [], slug: routeSlug
    };
  }
  function normalizeRow(row, mediaType) {
    const id = Number(row?.media_id || row?.mediaId || row?.media?.id);
    return {
      id, mediaType, status: String(row?.status || ''), score: row?.score == null ? null : Number(row.score),
      reaction: row?.reactions?.[0] || row?.reaction || '', reactions: row?.reactions || [],
      progress: Math.max(0, Number(row?.progress) || 0), volumeProgress: Math.max(0, Number(row?.volume_progress || row?.volumeProgress) || 0),
      updatedAt: Date.parse(row?.updated_at || row?.updatedAt || 0) || 0,
      media: mediaOf(row?.media, id, mediaType)
    };
  }
  function normalizeFavorite(row, mediaType) {
    const id = Number(row?.media_id || row?.mediaId || row?.media?.id);
    return {id, mediaType, createdAt: Date.parse(row?.created_at || row?.createdAt || 0) || 0, media: mediaOf(row?.media, id, mediaType)};
  }
  function normalizeImpression(row, fallbackType) {
    const id = Number(row?.media_id || row?.mediaId || row?.media?.id);
    const mediaType = String(row?.media_type || row?.mediaType || fallbackType).toUpperCase() === 'MANGA' ? 'MANGA' : 'ANIME';
    return {
      id: String(row?.id || `${mediaType}-${id}-${row?.created_at || Date.now()}`), mediaId: id, mediaType,
      body: String(row?.body || ''), spoiler: Boolean(row?.spoiler), createdAt: row?.created_at || row?.createdAt || new Date().toISOString(),
      status: String(row?.status || ''), score: row?.score == null ? null : Number(row.score), progress: Math.max(0, Number(row?.progress) || 0),
      media: mediaOf(row?.media, id, mediaType)
    };
  }

  async function gqlMedia(ids, mediaType) {
    ids = [...new Set(ids.map(Number).filter(Boolean))];
    if (!ids.length) return [];
    try {
      const query = 'query($ids:[Int],$type:MediaType){Page(page:1,perPage:50){media(id_in:$ids,type:$type){id title{romaji english native userPreferred}coverImage{extraLarge large}episodes chapters volumes status format seasonYear genres}}}';
      const response = await fetch(ANILIST, {method: 'POST', headers: {'content-type': 'application/json', accept: 'application/json'}, body: JSON.stringify({query, variables: {ids: ids.slice(0, 50), type: mediaType}})});
      if (!response.ok) return [];
      const payload = await response.json();
      return (payload?.data?.Page?.media || []).map(item => mediaOf(item, item.id, mediaType));
    } catch { return []; }
  }
  async function localDataset(mediaType) {
    const manga = mediaType === 'MANGA';
    const entries = manga ? (window.AniNexusMangaState?.entries?.() || {}) : {...read('aninexus:mediaState:v1', {}), ...read(STATE_KEY, {})};
    const favoriteIds = manga ? [...(window.AniNexusMangaState?.favorites?.() || new Set())] : (read(FAV_KEY, []) || []);
    const ids = [...new Set([...Object.keys(entries).map(Number), ...favoriteIds.map(Number)])].filter(Boolean);
    const media = await gqlMedia(ids, mediaType);
    const map = new Map(media.map(item => [item.id, item]));
    const list = Object.entries(entries).filter(([, value]) => value?.status).map(([id, value]) => normalizeRow({media_id: Number(id), ...value, updated_at: value.updatedAt ? new Date(value.updatedAt).toISOString() : new Date().toISOString(), media: map.get(Number(id))}, mediaType));
    const favorites = favoriteIds.map(id => normalizeFavorite({media_id: Number(id), created_at: new Date().toISOString(), media: map.get(Number(id))}, mediaType));
    const impressions = manga ? [] : (read(DEMO_IMPRESSIONS, []) || []).filter(item => String(item.mediaType || item.media_type || 'ANIME').toUpperCase() !== 'MANGA').map(item => normalizeImpression(item, mediaType));
    return {user: {username: 'Preview'}, list, favorites, impressions, impressionCount: impressions.length};
  }
  async function loadDataset(mediaType) {
    if (IS_PAGES && window.AniNexusAuth?.enabled !== true) return localDataset(mediaType);
    const endpoint = mediaType === 'MANGA' ? '/api/me/manga-library' : '/api/me/library';
    const payload = await request(endpoint);
    if (payload?.__unauth) return {user: null, list: [], favorites: [], impressions: [], impressionCount: 0, unauth: true};
    return {
      user: payload?.user || {},
      list: (payload?.list || []).map(row => normalizeRow(row, mediaType)),
      favorites: (payload?.favorites || []).map(row => normalizeFavorite(row, mediaType)),
      impressions: (payload?.impressions || []).map(row => normalizeImpression(row, mediaType)),
      impressionCount: Number(payload?.impressionCount ?? payload?.impressions?.length ?? 0)
    };
  }

  function mergedItems(data) {
    const items = new Map();
    for (const row of data?.list || []) items.set(row.id, {...row, favorite: false});
    for (const favorite of data?.favorites || []) {
      const current = items.get(favorite.id);
      items.set(favorite.id, current ? {...current, favorite: true, media: current.media?.cover ? current.media : favorite.media} : {
        id: favorite.id, mediaType: favorite.mediaType, status: '', score: null, reaction: '', progress: 0, volumeProgress: 0,
        updatedAt: favorite.createdAt, media: favorite.media, favorite: true
      });
    }
    return [...items.values()];
  }
  const activeData = () => state.media === 'MANGA' ? state.manga : state.anime;
  const activeItems = () => mergedItems(activeData());
  function combinedImpressions() {
    return [...(state.anime?.impressions || []), ...(state.manga?.impressions || [])].sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
  }
  function counts(mediaType) {
    const data = mediaType === 'MANGA' ? state.manga : state.anime;
    const items = mergedItems(data);
    const list = data?.list || [];
    return {
      total: items.length, list: list.length, favorites: (data?.favorites || []).length,
      current: list.filter(item => item.status === 'CURRENT').length,
      completed: list.filter(item => item.status === 'COMPLETED').length,
      impressions: Number(data?.impressionCount ?? data?.impressions?.length ?? 0)
    };
  }
  function statusCount(key) {
    const items = activeItems();
    if (key === 'FAVORITES') return items.filter(item => item.favorite).length;
    return items.filter(item => item.status === key).length;
  }
  function formatLabel(value, mediaType) {
    if (mediaType === 'MANGA') return ({MANGA: 'Mangá', NOVEL: 'Light novel', ONE_SHOT: 'One-shot'})[value] || 'Mangá';
    return ({TV: 'Série', TV_SHORT: 'Série curta', MOVIE: 'Filme', OVA: 'OVA', ONA: 'ONA', SPECIAL: 'Especial', MUSIC: 'Música'})[value] || value || 'Anime';
  }
  function statusLabel(value, mediaType = state.media) { return LABELS[mediaType][value] || 'Na biblioteca'; }
  function activeLabel() {
    if (state.view === 'IMPRESSIONS') return 'Impressões';
    if (state.filter === 'FAVORITES') return `Favoritos · ${state.media === 'MANGA' ? 'Mangás' : 'Animes'}`;
    if (LABELS[state.media][state.filter]) return `${LABELS[state.media][state.filter]} · ${state.media === 'MANGA' ? 'Mangás' : 'Animes'}`;
    return state.media === 'MANGA' ? 'Meus mangás' : 'Meus animes';
  }

  function primaryTabs(compact = false) {
    const anime = counts('ANIME'), manga = counts('MANGA'), impressions = combinedImpressions().length;
    return `<nav class="nx49-primary-tabs${compact ? ' compact' : ''}" aria-label="Seções da biblioteca">
      <button type="button" class="${state.view === 'MEDIA' && state.media === 'ANIME' ? 'active' : ''}" data-nx49-media="ANIME">${ICON.anime}<span>Meus animes</span><b>${anime.total}</b></button>
      <button type="button" class="${state.view === 'MEDIA' && state.media === 'MANGA' ? 'active' : ''}" data-nx49-media="MANGA">${ICON.manga}<span>Meus mangás</span><b>${manga.total}</b></button>
      <button type="button" class="${state.view === 'IMPRESSIONS' ? 'active' : ''}" data-nx49-view="IMPRESSIONS">${ICON.message}<span>Impressões</span><b>${impressions}</b></button>
      <a href="${pageUrl('/conquistas')}">${ICON.trophy}<span>Conquistas</span></a>
    </nav>`;
  }
  function statusTabs(compact = false) {
    if (state.view !== 'MEDIA') return '';
    return `<div class="nx49-status-row${compact ? ' compact' : ''}" aria-label="Estados de ${state.media === 'MANGA' ? 'leitura' : 'acompanhamento'}">
      <div class="nx49-status-tabs">${STATUS_ORDER.map(key => `<button type="button" class="${state.filter === key ? 'active' : ''}" aria-pressed="${state.filter === key}" data-nx49-status="${key}">${LABELS[state.media][key]}<b>${statusCount(key)}</b></button>`).join('')}</div>
      <button type="button" class="nx49-favorite-filter${state.filter === 'FAVORITES' ? ' active' : ''}" aria-pressed="${state.filter === 'FAVORITES'}" data-nx49-status="FAVORITES">${ICON.heart}<span>Favoritos</span><b>${statusCount('FAVORITES')}</b></button>
    </div>`;
  }
  function activityMarkup() {
    const manga = state.media === 'MANGA';
    const items = activeItems();
    const statuses = [
      ['PLANNING', manga ? 'Quero ler' : 'Quero ver', 'planning', ICON.plus],
      ['CURRENT', manga ? 'Lendo' : 'Assistindo', 'current', ICON.play],
      ['COMPLETED', 'Terminei', 'completed', ICON.check],
      ['PAUSED', 'Pausei', 'paused', ICON.pause],
      ['DROPPED', 'Desisti', 'dropped', ICON.close]
    ];
    const reactionInfo = new Map([...(window.AniNexusMediaState?.reactions?.() || []), ...(window.AniNexusMangaState?.reactions?.() || [])].map(item => [item.label, item]));
    const reactionCounts = new Map();
    for (const item of items) for (const reaction of [...new Set(item.reactions?.length ? item.reactions : [item.reaction].filter(Boolean))]) reactionCounts.set(reaction, (reactionCounts.get(reaction) || 0) + 1);
    const reactions = [...reactionCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const reactionTotal = reactions.reduce((total, [, count]) => total + count, 0);
    return `<section class="nx49-activity" aria-labelledby="nx49ActivityTitle">
      <header><h3 id="nx49ActivityTitle">Atividade</h3></header>
      <div class="nx49-activity-statuses">${statuses.map(([key, label, tone, icon]) => `<div class="nx49-activity-status"><span class="nx49-activity-status-icon tone-${tone}">${icon}</span><span>${label}</span><i></i><b>${items.filter(item => item.status === key).length}</b></div>`).join('')}</div>
      ${reactions.length ? `<div class="nx49-activity-reactions">${reactions.map(([label, count]) => { const meta = reactionInfo.get(label) || {}; const percentage = Math.round((count / reactionTotal) * 100); return `<span title="${esc(label)}"><b>${esc(meta.emoji || '•')}</b>${esc(label)} <small>${percentage}%</small></span>`; }).join('')}</div>` : ''}
    </section>`;
  }
  function profileMarkup() {
    const info = counts(state.media), manga = state.media === 'MANGA';
    const user = state.anime?.user || state.manga?.user || {};
    const displayName = user.display_name || user.displayName || user.name || user.username || 'Minha conta';
    const username = user.username ? `@${String(user.username).replace(/^@/, '')}` : 'Conta AniNexus';
    const avatar = user.avatar_url || user.avatarUrl || user.picture || `${BASE}/assets/avatars/mascot-pink.png`;
    const completed = info.list ? Math.round((info.completed / info.list) * 100) : 0;
    return `<aside class="nx49-profile" aria-label="Resumo da biblioteca">
      <div class="nx49-profile-identity"><img src="${esc(avatar)}" alt=""><span><strong>${esc(displayName)}</strong><small>${esc(username)}</small></span></div>
      <div class="nx49-profile-stats">
        <span><strong>${info.current}</strong><small>${manga ? 'Lendo' : 'Assistindo'}</small></span>
        <span><strong>${info.favorites}</strong><small>Favoritos</small></span>
        <span><strong>${completed}%</strong><small>Concluídos</small></span>
      </div>
      <button type="button" class="nx49-switch-media" data-nx49-switch-media="${manga ? 'ANIME' : 'MANGA'}">Revisar meus ${manga ? 'animes' : 'mangás'}${ICON.arrow}</button>
    </aside>`;
  }
  function toolbarMarkup() {
    const noun = state.media === 'MANGA' ? 'mangás' : 'animes';
    return `<div class="nx49-toolbar">
      <label class="nx49-search">${ICON.search}<span class="sr-only">Buscar nos meus ${noun}</span><input type="search" value="${esc(state.search)}" placeholder="Buscar nos meus ${noun}…" data-nx49-search></label>
      <button type="button" class="nx49-filter-button" data-nx49-filter-open>${ICON.filter}<span>Filtros</span></button>
    </div>`;
  }
  function filterModalMarkup() {
    const labels = {recent: 'Atualizados recentemente', title: 'Título', score: 'Minha nota', progress: 'Progresso'};
    return `<div class="nx49-filter-layer" data-nx49-filter-layer hidden>
      <button type="button" class="nx49-filter-backdrop" data-nx49-filter-close aria-label="Fechar filtros"></button>
      <section class="nx49-filter-dialog" role="dialog" aria-modal="true" aria-labelledby="nx49FilterTitle">
        <header><div><small>MINHA BIBLIOTECA</small><h2 id="nx49FilterTitle">Filtrar e ordenar</h2></div><button type="button" data-nx49-filter-close aria-label="Fechar">${ICON.close}</button></header>
        <fieldset><legend>Ordenar por</legend>${Object.entries(labels).map(([value, label]) => `<label><input type="radio" name="nx49-sort" value="${value}"${state.sort === value ? ' checked' : ''}><span>${label}</span></label>`).join('')}</fieldset>
        <footer><button type="button" class="ghost" data-nx49-filter-reset>Limpar</button><button type="button" class="primary" data-nx49-filter-apply>Aplicar</button></footer>
      </section>
    </div>`;
  }
  function islandMarkup() {
    const manga = state.media === 'MANGA';
    const title = state.view === 'IMPRESSIONS' ? 'Suas <em>impressões</em>' : `Meus <em>${manga ? 'mangás' : 'animes'}</em>`;
    const icon = state.view === 'IMPRESSIONS' ? ICON.message : manga ? ICON.manga : ICON.anime;
    return `<section class="nx49-island" data-nx49-island aria-hidden="true" inert>
      <button type="button" class="nx49-island-head" data-nx49-island-toggle aria-expanded="false">
        <span class="nx49-island-icon">${icon}</span>
        <span class="nx49-island-copy"><strong>${title}</strong><small>${esc(activeLabel())}</small></span>
        <span class="nx49-island-chevron">${ICON.down}</span>
      </button>
      <div class="nx49-island-panel" aria-hidden="true" inert><div><div class="nx49-island-inner">${primaryTabs(true)}${statusTabs(true)}</div></div></div>
    </section>`;
  }

  function mediaCard(item) {
    const media = item.media || mediaOf(null, item.id, state.media);
    const mediaType = media.mediaType || state.media;
    const manga = mediaType === 'MANGA';
    const progress = item.volumeProgress ? `${item.volumeProgress} vol.` : item.progress ? `${manga ? 'cap.' : 'ep.'} ${item.progress}` : '';
    const total = manga ? media.chapters : media.episodes;
    const progressText = progress && total && !item.volumeProgress ? `${item.progress}/${total}` : progress;
    const rating = item.score != null ? Number(item.score).toFixed(1).replace('.0', '') : media.score != null ? Number(media.score).toFixed(1).replace('.0', '') : '';
    const meta = [formatLabel(media.format, mediaType), media.seasonYear, item.status ? statusLabel(item.status, mediaType) : null].filter(Boolean).join(' · ');
    const listAttr = manga ? `data-manga-list="${item.id}"` : `data-list="${item.id}"`;
    const favoriteAttr = manga ? `data-manga-fav="${item.id}"` : `data-fav="${item.id}"`;
    return `<article class="nx38-library-card nx49-media-card" data-nx49-open="${item.id}" data-media-type="${mediaType}" data-title="${esc(media.title)}" tabindex="0">
      <div class="nx38-library-poster">${media.cover ? `<img src="${esc(media.cover)}" alt="${esc(media.title)}" loading="lazy" decoding="async">` : '<span class="nx49-cover-fallback">AN</span>'}<div class="nx38-library-shade"></div>
        ${progressText ? `<span class="nx38-library-progress">${esc(progressText)}</span>` : ''}${rating ? `<span class="nx38-library-score">★ ${rating}</span>` : ''}
        <div class="nx38-library-card-actions"><button type="button" data-nx-action-kind="compact" ${listAttr} class="${item.status ? 'active' : ''}" aria-label="${item.status ? 'Alterar status' : `Adicionar ${esc(media.title)} à lista`}">${item.status ? ICON.check : ICON.plus}</button><button type="button" data-nx-action-kind="compact" ${favoriteAttr} class="${item.favorite ? 'active' : ''}" aria-label="${item.favorite ? 'Remover dos favoritos' : 'Favoritar'}">${ICON.heart}</button></div>
      </div>
      <h3>${esc(media.title)}</h3><div class="nx38-library-card-meta"><span>${esc(meta)}</span>${item.score != null ? `<span>· nota ${Number(item.score).toFixed(1).replace('.0', '')}</span>` : ''}</div>
    </article>`;
  }
  function filteredItems() {
    let items = activeItems();
    if (state.filter === 'FAVORITES') items = items.filter(item => item.favorite);
    else if (LABELS[state.media][state.filter]) items = items.filter(item => item.status === state.filter);
    const query = state.search.trim().toLocaleLowerCase('pt-BR');
    if (query) items = items.filter(item => `${item.media.title} ${(item.media.genres || []).join(' ')}`.toLocaleLowerCase('pt-BR').includes(query));
    if (state.sort === 'title') items.sort((a, b) => a.media.title.localeCompare(b.media.title, 'pt-BR'));
    else if (state.sort === 'score') items.sort((a, b) => (b.score ?? b.media.score ?? -1) - (a.score ?? a.media.score ?? -1));
    else if (state.sort === 'progress') items.sort((a, b) => (b.volumeProgress || b.progress || 0) - (a.volumeProgress || a.progress || 0));
    else items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return items;
  }
  function emptyMarkup() {
    const manga = state.media === 'MANGA';
    const searching = Boolean(state.search.trim());
    return `<div class="nx49-empty"><strong>${searching ? 'Nenhum resultado' : 'Nada por aqui ainda'}</strong><p>${searching ? 'Tente outro título ou limpe a busca.' : `Explore o catálogo e adicione ${manga ? 'sua próxima leitura' : 'o próximo anime da sua jornada'}.`}</p><a href="${pageUrl(manga ? '/mangas' : '/animes/catalogo')}">Explorar ${manga ? 'mangás' : 'animes'}${ICON.arrow}</a></div>`;
  }
  function impressionsMarkup() {
    const impressions = combinedImpressions();
    if (!impressions.length) return `<div class="nx49-empty"><strong>Nenhuma impressão ainda</strong><p>Suas impressões sobre animes e mangás aparecerão juntas aqui.</p><a href="${pageUrl('/animes/catalogo')}">Explorar catálogo${ICON.arrow}</a></div>`;
    return `<div class="nx49-impressions">${impressions.map(item => {
      const manga = item.mediaType === 'MANGA';
      return `<article class="nx49-impression" data-nx49-open="${item.mediaId}" data-media-type="${item.mediaType}" data-title="${esc(item.media.title)}" tabindex="0">${item.media.cover ? `<img src="${esc(item.media.cover)}" alt="">` : ''}<div><small>${manga ? 'MANGÁ' : 'ANIME'}${item.status ? ` · ${esc(statusLabel(item.status, item.mediaType))}` : ''}</small><h3>${esc(item.media.title)}</h3><p>${item.spoiler ? 'Impressão marcada como spoiler.' : esc(item.body)}</p><span>${item.progress ? `${manga ? 'Capítulo' : 'Episódio'} ${item.progress}` : ''}${item.score != null ? ` · ★ ${Number(item.score).toFixed(1).replace('.0', '')}` : ''}</span></div>${ICON.arrow}</article>`;
    }).join('')}</div>`;
  }
  function paintContent() {
    const root = document.querySelector('[data-nx49-content]');
    if (!root) return;
    if (state.view === 'IMPRESSIONS') {
      root.innerHTML = impressionsMarkup();
      const counter = document.querySelector('[data-nx49-result-count]');
      if (counter) counter.textContent = `${combinedImpressions().length} impressões`;
      wireOpenCards();
      return;
    }
    const items = filteredItems();
    root.innerHTML = items.length ? `<div class="nx38-library-grid nx49-media-grid">${items.map(mediaCard).join('')}</div>` : emptyMarkup();
    const counter = document.querySelector('[data-nx49-result-count]');
    if (counter) counter.textContent = `${items.length} ${items.length === 1 ? 'título' : 'títulos'}`;
    syncActions();
    wireOpenCards();
  }
  function syncActions() {
    if (state.media === 'MANGA') window.AniNexusMangaState?.sync?.();
    else window.AniNexusMediaState?.sync?.();
  }
  function wireOpenCards() {
    document.querySelectorAll('[data-nx49-open]').forEach(card => {
      const open = event => {
        if (event?.target?.closest?.('button,a,input,select,textarea')) return;
        const mediaType = card.dataset.mediaType === 'MANGA' ? 'manga' : 'anime';
        go(`/${mediaType}/${slug(card.dataset.title)}-${card.dataset.nx49Open}`);
      };
      card.onclick = open;
      card.onkeydown = event => { if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('button')) { event.preventDefault(); open(event); } };
    });
  }

  function bodyMarkup() {
    const mediaView = state.view === 'MEDIA';
    const label = state.view === 'IMPRESSIONS' ? 'Suas impressões' : state.media === 'MANGA' ? 'Seus mangás' : 'Seus animes';
    return `<section class="nx49-library-body"><div class="nx49-shell nx49-layout">${profileMarkup()}<div class="nx49-workspace"><div class="nx49-library-nav" data-nx49-hero>${primaryTabs()}</div><div class="nx49-content-head"><div><small>${state.view === 'IMPRESSIONS' ? 'IMPRESSÕES' : 'SUA COLEÇÃO'}</small><h2>${label}</h2></div><span data-nx49-result-count></span></div>${mediaView ? `${statusTabs()}${toolbarMarkup()}` : ''}<div data-nx49-content></div>${mediaView ? activityMarkup() : ''}</div></div></section>`;
  }
  function shell() {
    document.title = 'Minha Biblioteca | AniNexus';
    document.body.classList.add('nx38-library-active', 'nx49-library-active');
    document.body.classList.remove('nx42-manga-active', 'nx35-home-active');
    app.innerHTML = `<main class="nx38-library nx49-library">${bodyMarkup()}</main>${islandMarkup()}${filterModalMarkup()}`;
    state.mounted = true;
    wire();
    paintContent();
    scrollUpdate();
    document.documentElement.classList.remove('nx38-library-boot');
  }
  function loadingShell() {
    document.body.classList.add('nx38-library-active', 'nx49-library-active');
    app.innerHTML = `<main class="nx38-library nx49-library"><section class="nx49-library-body"><div class="nx49-shell"><div class="nx49-loading">${Array.from({length: 8}, () => '<span></span>').join('')}</div></div></section></main>`;
    document.documentElement.classList.remove('nx38-library-boot');
  }
  function loginRequired() {
    document.body.classList.add('nx38-library-active', 'nx49-library-active');
    app.innerHTML = `<main class="nx38-library nx49-library"><section class="nx49-library-body"><div class="nx49-shell"><div class="nx49-login"><img src="${BASE}/assets/logo.png" alt=""><h2>Sua biblioteca começa aqui</h2><p>Entre para sincronizar animes, mangás, favoritos, progresso e impressões.</p><div><a class="primary" href="${pageUrl('/login')}">Entrar</a><a href="${pageUrl('/criar-conta')}">Criar conta</a></div></div></div></section></main>`;
    state.mounted = true;
    document.documentElement.classList.remove('nx38-library-boot');
  }
  function errorShell() {
    document.body.classList.add('nx38-library-active', 'nx49-library-active');
    app.innerHTML = `<main class="nx38-library nx49-library"><section class="nx49-library-body"><div class="nx49-shell"><div class="nx49-empty"><strong>A biblioteca não carregou agora</strong><p>Seus dados foram preservados. Tente novamente em alguns instantes.</p><button type="button" data-nx49-retry>Tentar novamente</button></div></div></section></main>`;
    document.querySelector('[data-nx49-retry]')?.addEventListener('click', mountLibrary);
    state.mounted = true;
    document.documentElement.classList.remove('nx38-library-boot');
  }

  function switchMedia(media, updateUrl = true) {
    state.media = media === 'MANGA' ? 'MANGA' : 'ANIME';
    state.view = 'MEDIA';
    state.filter = 'ALL';
    state.search = '';
    if (updateUrl) replaceLibraryUrl(state.media);
    shell();
  }
  function setView(view) {
    state.view = view;
    state.filter = 'ALL';
    state.search = '';
    shell();
  }
  function setStatusFilter(filter) {
    state.filter = state.filter === filter ? 'ALL' : filter;
    shell();
  }
  function openFilters() {
    const layer = document.querySelector('[data-nx49-filter-layer]');
    if (!layer) return;
    layer.hidden = false;
    document.body.classList.add('modal-open');
    layer.querySelector('input:checked')?.focus();
  }
  function closeFilters() {
    const layer = document.querySelector('[data-nx49-filter-layer]');
    if (layer) layer.hidden = true;
    document.body.classList.remove('modal-open');
  }
  function wire() {
    document.querySelectorAll('[data-nx49-media]').forEach(button => button.addEventListener('click', () => switchMedia(button.dataset.nx49Media)));
    document.querySelectorAll('[data-nx49-view="IMPRESSIONS"]').forEach(button => button.addEventListener('click', () => setView('IMPRESSIONS')));
    document.querySelectorAll('[data-nx49-status]').forEach(button => button.addEventListener('click', () => setStatusFilter(button.dataset.nx49Status)));
    document.querySelector('[data-nx49-switch-media]')?.addEventListener('click', buttonEvent => switchMedia(buttonEvent.currentTarget.dataset.nx49SwitchMedia));
    document.querySelector('[data-nx49-search]')?.addEventListener('input', event => { state.search = event.target.value; paintContent(); });
    document.querySelector('[data-nx49-filter-open]')?.addEventListener('click', openFilters);
    document.querySelectorAll('[data-nx49-filter-close]').forEach(button => button.addEventListener('click', closeFilters));
    document.querySelector('[data-nx49-filter-reset]')?.addEventListener('click', () => { state.sort = 'recent'; state.filter = 'ALL'; closeFilters(); shell(); });
    document.querySelector('[data-nx49-filter-apply]')?.addEventListener('click', () => { state.sort = document.querySelector('input[name="nx49-sort"]:checked')?.value || 'recent'; closeFilters(); shell(); });
    document.querySelector('[data-nx49-island-toggle]')?.addEventListener('click', toggleIsland);
  }
  function closeOnEscape(event) {
    if (event.key === 'Escape' && state.mounted) { closeFilters(); setIslandExpanded(false); }
  }
  function setIslandExpanded(expanded) {
    const island = document.querySelector('[data-nx49-island]');
    if (!island) return;
    const panel = island.querySelector('.nx49-island-panel');
    island.classList.toggle('expanded', expanded);
    island.querySelector('[data-nx49-island-toggle]')?.setAttribute('aria-expanded', String(expanded));
    if (panel) { panel.inert = !expanded; panel.setAttribute('aria-hidden', String(!expanded)); }
  }
  function toggleIsland() {
    const island = document.querySelector('[data-nx49-island]');
    setIslandExpanded(!island?.classList.contains('expanded'));
  }
  function scrollUpdate() {
    state.scrollFrame = 0;
    if (!state.mounted || !onLibrary()) return;
    const island = document.querySelector('[data-nx49-island]');
    const hero = document.querySelector('[data-nx49-hero]');
    if (!island || !hero) return;
    const currentY = Math.max(0, scrollY);
    const delta = currentY - state.lastScrollY;
    const headerHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nx43-header-height')) || 66;
    const show = hero.getBoundingClientRect().bottom < headerHeight;
    island.classList.toggle('show', show);
    island.inert = !show;
    island.setAttribute('aria-hidden', String(!show));
    if (!show || currentY < 80) {
      document.body.classList.remove('nx49-scroll-down');
      setIslandExpanded(false);
    } else if (delta > 8) {
      document.body.classList.add('nx49-scroll-down');
      setIslandExpanded(false);
    } else if (delta < -8) document.body.classList.remove('nx49-scroll-down');
    state.lastScrollY = currentY;
  }
  function onScroll() {
    if (state.scrollFrame) return;
    state.scrollFrame = requestAnimationFrame(scrollUpdate);
  }
  function cleanup() {
    state.mounted = false;
    if (state.scrollFrame) cancelAnimationFrame(state.scrollFrame);
    state.scrollFrame = 0;
    document.body.classList.remove('nx38-library-active', 'nx49-library-active', 'nx49-scroll-down', 'modal-open');
    document.querySelector('[data-nx49-island]')?.remove();
    document.querySelector('[data-nx49-filter-layer]')?.remove();
  }

  async function mountLibrary() {
    if (!onLibrary()) { cleanup(); return; }
    const token = ++state.token;
    state.media = initialMedia();
    state.view = 'MEDIA';
    state.filter = 'ALL';
    state.search = '';
    state.lastScrollY = Math.max(0, scrollY);
    loadingShell();
    const settled = await Promise.allSettled([loadDataset('ANIME'), loadDataset('MANGA')]);
    if (token !== state.token || !onLibrary()) return;
    if (settled.every(result => result.status === 'rejected')) { errorShell(); return; }
    state.anime = settled[0].status === 'fulfilled' ? settled[0].value : {user: null, list: [], favorites: [], impressions: [], impressionCount: 0};
    state.manga = settled[1].status === 'fulfilled' ? settled[1].value : {user: null, list: [], favorites: [], impressions: [], impressionCount: 0};
    const authenticatedUser = state.anime.user || state.manga.user;
    if ((state.anime.unauth || state.manga.unauth) && !authenticatedUser) { loginRequired(); return; }
    shell();
  }

  function updateDataset(mediaType, kind, detail) {
    if (!onLibrary()) return;
    const data = mediaType === 'MANGA' ? state.manga : state.anime;
    if (!data) return;
    const id = Number(detail?.id);
    if (!id) return;
    if (kind === 'state') {
      const next = detail.state || {};
      const previous = data.list.find(item => item.id === id);
      data.list = data.list.filter(item => item.id !== id);
      if (next.status) data.list.unshift({
        id, mediaType, status: next.status, score: next.score ?? null, reaction: next.reaction || '', reactions: next.reactions || [],
        progress: Number(next.progress) || 0, volumeProgress: Number(next.volumeProgress || next.volume_progress) || 0,
        updatedAt: Date.now(), media: previous?.media || data.favorites.find(item => item.id === id)?.media || mediaOf(null, id, mediaType)
      });
    } else {
      const previous = data.favorites.find(item => item.id === id);
      data.favorites = data.favorites.filter(item => item.id !== id);
      if (detail.favorite) data.favorites.unshift({id, mediaType, createdAt: Date.now(), media: previous?.media || data.list.find(item => item.id === id)?.media || mediaOf(null, id, mediaType)});
    }
    if (state.view === 'MEDIA' && state.media === mediaType) shell();
  }

  document.addEventListener('aninexus:media-state-changed', event => updateDataset('ANIME', 'state', event.detail));
  document.addEventListener('aninexus:favorite-changed', event => updateDataset('ANIME', 'favorite', event.detail));
  document.addEventListener('aninexus:manga-media-state-changed', event => updateDataset('MANGA', 'state', event.detail));
  document.addEventListener('aninexus:manga-favorite-changed', event => updateDataset('MANGA', 'favorite', event.detail));
  document.addEventListener('keydown', closeOnEscape);
  addEventListener('scroll', onScroll, {passive: true});
  addEventListener('resize', onScroll, {passive: true});
  addEventListener('popstate', () => setTimeout(mountLibrary, 0));
  addEventListener('aninexus:account-identity-changed', () => { state.anime = null; state.manga = null; if (onLibrary()) void mountLibrary(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountLibrary, {once: true});
  else void mountLibrary();
})();
