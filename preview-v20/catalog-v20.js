'use strict';
(() => {
  const app = document.querySelector('#app');
  if (!app) return;

  const IS_PAGES = location.hostname.endsWith('github.io');
  const BASE = IS_PAGES ? '/AniNexus' : '';
  const TARGET = '/animes/catalogo';
  const BUILD = '44.18.1';
  const ENDPOINT = 'https://graphql.anilist.co';
  const PER_PAGE = 25;
  const MAX_PUBLIC_PAGE = 200;
  const CACHE_TTL = 8 * 60 * 1000;
  const CACHE_PREFIX = 'nx:v45:catalog:';
  const STORE_KEY = 'nx:v45:catalog-state';

  const GENRES = [
    ['Action', 'Ação'], ['Adventure', 'Aventura'], ['Comedy', 'Comédia'], ['Drama', 'Drama'],
    ['Fantasy', 'Fantasia'], ['Horror', 'Terror'], ['Mystery', 'Mistério'], ['Romance', 'Romance'],
    ['Sci-Fi', 'Ficção científica'], ['Slice of Life', 'Cotidiano'], ['Sports', 'Esportes'],
    ['Supernatural', 'Sobrenatural'], ['Thriller', 'Suspense'], ['Psychological', 'Psicológico'],
    ['Music', 'Música'], ['Mecha', 'Mecha']
  ];
  const TAGS = [
    ['School', 'Vida escolar'], ['Shounen', 'Shounen'], ['Seinen', 'Seinen'], ['Shoujo', 'Shoujo'],
    ['Isekai', 'Isekai'], ['Magic', 'Magia'], ['Martial Arts', 'Artes marciais'], ['Historical', 'Histórico'],
    ['Military', 'Militar'], ['Super Power', 'Superpoderes'], ['Vampire', 'Vampiros'], ['Time Manipulation', 'Viagem no tempo']
  ];
  const FORMATS = [['TV', 'Série'], ['MOVIE', 'Filme'], ['OVA', 'OVA'], ['SPECIAL', 'Especial'], ['ONA', 'ONA']];
  const STATUSES = [['RELEASING', 'Em andamento'], ['FINISHED', 'Finalizado'], ['NOT_YET_RELEASED', 'Em breve']];
  const SEASONS = [['WINTER', 'Inverno'], ['SPRING', 'Primavera'], ['SUMMER', 'Verão'], ['FALL', 'Outono']];
  const SORTS = [['TITLE', 'Título'], ['POPULAR', 'Popularidade'], ['SCORE', 'Avaliação'], ['NEW', 'Estreia']];
  const MODES = [
    ['ALL', 'Todos', 'grid'], ['SOON', 'Em breve', 'clock'], ['SEASON', 'Temporada', 'leaf'],
    ['TOP', 'Ranking', 'trophy'], ['POPULAR', 'Mais populares', 'fire'],
    ['MEMBERS', 'Mais membros', 'members'], ['SEARCH', 'Busca', 'search']
  ];
  const ICON = {
    grid: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5l3.2 2"/></svg>',
    leaf: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 4C11 4 5 8 5 15c0 3 2 5 5 5 7 0 10-8 10-16Z"/><path d="M4 21c4-6 8-9 13-12"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v4c0 4-2 7-4 7s-4-3-4-7V4Z"/><path d="M8 6H4v2c0 2 2 4 4 4M16 6h4v2c0 2-2 4-4 4M12 15v4M8 21h8"/></svg>',
    fire: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2c1 4-2 5-1 8 1-2 3-3 4-5 3 3 5 6 5 10a9 9 0 1 1-18 0c0-4 2-7 5-10 0 3 1 4 2 5 0-3 1-5 3-8Z"/></svg>',
    members: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.3"/><path d="M3.5 19c.4-4 2.2-6 5.5-6s5.1 2 5.5 6M14 14c3.8-.8 6 1 6.5 4.5"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.7" cy="10.7" r="6.6"/><path d="m15.7 15.7 4.5 4.5"/></svg>',
    menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14"/></svg>',
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.5 6.1.9-4.4 4.3 1 6.1-5.5-2.9-5.5 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 8.8c0 5-8.5 10-8.5 10s-8.5-5-8.5-10A4.6 4.6 0 0 1 12 6.4a4.6 4.6 0 0 1 8.5 2.4Z"/></svg>',
    filters: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16l-6.2 7v5l-3.6 2v-7L4 6Z"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
    left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
    right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>',
    asc: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 17V5m0 0-4 4m4-4 4 4M15 7h5M15 12h4M15 17h3"/></svg>',
    desc: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7v12m0 0-4-4m4 4 4-4M15 7h3M15 12h4M15 17h5"/></svg>',
    retry: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 0-2 5"/></svg>'
  };

  const emptyFilters = () => ({ format: '', status: '', season: '', year: '', genre: '', tag: '', sort: 'NEW', direction: 'DESC' });
  const state = {
    mode: 'ALL', page: 1, search: '', filters: emptyFilters(), draft: emptyFilters(),
    controller: null, token: 0, mounted: false, filtersOpen: false, menuOpen: false, items: new Map(),
    searchTimer: 0, previousFocus: null, menuFocus: null, revealObserver: null
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const slug = value => String(value || 'anime').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 90);
  const titleOf = media => media?.title?.english || media?.title?.userPreferred || media?.title?.romaji || media?.title?.native || 'Anime';
  const imageOf = media => media?.coverImage?.extraLarge || media?.coverImage?.large || `${BASE}/assets/logo.png`;
  const scoreOf = media => media?.metricsSource === 'aninexus' && Number(media?.ratingCount || 0) > 0 && Number.isFinite(Number(media?.averageScore)) ? (Number(media.averageScore) / 10).toFixed(1).replace('.0', '') : '';
  const formatLabel = value => ({ TV: 'Série', TV_SHORT: 'Série curta', MOVIE: 'Filme', OVA: 'OVA', ONA: 'ONA', SPECIAL: 'Especial', MUSIC: 'Música' })[value] || value || 'Anime';
  const genreLabel = value => GENRES.find(item => item[0] === value)?.[1] || value;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function route() {
    const url = new URL(location.href);
    const restored = url.searchParams.get('p');
    if (restored) return restored.split('?')[0].replace(/\/+$/, '') || '/';
    let path = url.pathname;
    if (IS_PAGES) path = path.replace(/^\/AniNexus/, '') || '/';
    return path.replace(/\/+$/, '') || '/';
  }
  function onCatalog() { return route() === TARGET || Boolean(window.__NX_CATALOG_BOOT__); }
  function currentSeason() {
    const now = new Date();
    const month = Number(new Intl.DateTimeFormat('en', { timeZone: 'America/Sao_Paulo', month: 'numeric' }).format(now));
    const year = Number(new Intl.DateTimeFormat('en', { timeZone: 'America/Sao_Paulo', year: 'numeric' }).format(now));
    return { year, season: month <= 3 ? 'WINTER' : month <= 6 ? 'SPRING' : month <= 9 ? 'SUMMER' : 'FALL' };
  }
  function years() {
    const newest = new Date().getFullYear() + 2;
    return Array.from({ length: newest - 1939 }, (_, index) => newest - index);
  }
  function restore() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORE_KEY) || 'null');
      if (!saved || !MODES.some(item => item[0] === saved.mode)) return;
      state.mode = saved.mode;
      state.search = String(saved.search || '').slice(0, 120);
      state.filters = { ...emptyFilters(), ...(saved.filters || {}) };
    } catch {}
  }
  function persist() {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify({ mode: state.mode, search: state.search, filters: state.filters })); } catch {}
  }
  function cacheRead(key) {
    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE_PREFIX + key) || 'null');
      if (cached && Date.now() - cached.time < CACHE_TTL && Array.isArray(cached.value?.items)) return cached.value;
    } catch {}
    return null;
  }
  function cacheWrite(key, value) {
    try { sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ time: Date.now(), value })); } catch {}
  }
  function normalizeMedia(media) {
    if (!media || typeof media !== 'object') return null;
    if (media.coverImage && typeof media.title === 'object') return media;
    const score = Number(media.score);
    return {
      ...media,
      title: { english: media.title || '', romaji: media.titleRomaji || media.title || '', native: media.titleNative || '', userPreferred: media.title || media.titleRomaji || '' },
      coverImage: { extraLarge: media.cover || '', large: media.cover || '' },
      genres: Array.isArray(media.genres) ? media.genres : [],
      averageScore: media.metricsSource === 'aninexus' && Number.isFinite(score) ? Math.round(score * 10) : null,
      ratingCount: Number(media.ratingCount || 0),
      metricsSource: media.metricsSource === 'aninexus' ? 'aninexus' : ''
    };
  }

  function requestOptions() {
    const options = { page: state.page, perPage: PER_PAGE, sort: 'NEW', direction: 'DESC' };
    if (state.mode === 'SOON') Object.assign(options, { status: 'NOT_YET_RELEASED', sort: 'POPULAR' });
    if (state.mode === 'SEASON') Object.assign(options, currentSeason(), { sort: 'POPULAR' });
    if (state.mode === 'TOP') Object.assign(options, { sort: 'SCORE' });
    if (state.mode === 'POPULAR') Object.assign(options, { sort: 'POPULAR', communityOnly: 1 });
    if (state.mode === 'MEMBERS') Object.assign(options, { sort: 'MEMBERS', communityOnly: 1 });
    if (state.mode === 'SEARCH') {
      Object.assign(options, state.filters);
      if (state.search.trim()) options.search = state.search.trim();
    }
    return options;
  }

  async function apiJson(path, signal) {
    if (IS_PAGES && window.AniNexusAuth?.enabled) return window.AniNexusAuth.publicApi(path, { signal, timeout: 12000 });
    if (IS_PAGES) throw new Error('API_NOT_CONFIGURED');
    const response = await fetch(path, { signal, credentials: 'same-origin', headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async function serverCatalog(options, signal) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(options)) if (value !== '' && value != null) params.set(key, String(value));
    const data = await apiJson(`/api/catalog?${params}`, signal);
    if (!Array.isArray(data?.items)) throw new Error('INVALID_CATALOG');
    return { pageInfo: data.pageInfo || {}, items: data.items.map(normalizeMedia).filter(Boolean), source: 'aninexus' };
  }

  function directQuery(options) {
    const defs = ['$page:Int!', '$perPage:Int!'];
    const args = ['type:ANIME', 'isAdult:false'];
    const variables = { page: options.page, perPage: options.perPage };
    const add = (name, type, value, argument = name) => {
      if (value === '' || value == null) return;
      defs.push(`$${name}:${type}`); variables[name] = value; args.push(`${argument}:$${name}`);
    };
    add('search', 'String!', options.search);
    add('genre', 'String!', options.genre);
    add('tag', 'String!', options.tag);
    add('format', 'MediaFormat!', options.format);
    add('season', 'MediaSeason!', options.season);
    add('year', 'Int!', options.year ? Number(options.year) : null, 'seasonYear');
    add('status', 'MediaStatus!', options.status);
    let sort = options.sort === 'MATCH' || options.search ? 'SEARCH_MATCH' : options.sort === 'TITLE' ? (options.direction === 'DESC' ? 'TITLE_ROMAJI_DESC' : 'TITLE_ROMAJI') : options.sort === 'SCORE' ? 'SCORE_DESC' : options.sort === 'FAVOURITES' ? 'FAVOURITES_DESC' : options.sort === 'POPULAR' || options.sort === 'MEMBERS' ? 'POPULARITY_DESC' : options.direction === 'ASC' ? 'START_DATE' : 'START_DATE_DESC';
    args.push(`sort:[${sort}]`);
    const fields = 'id title{romaji english native userPreferred} coverImage{extraLarge large} episodes format status seasonYear genres startDate{year month day}';
    return { query: `query(${defs.join(',')}){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(${args.join(',')}){${fields}}}}`, variables };
  }

  async function directCatalog(options, signal) {
    const request = directQuery(options);
    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(ENDPOINT, { method: 'POST', signal, headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(request) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = await response.json();
        if (json.errors?.length) throw new Error(json.errors[0]?.message || 'Falha no catálogo');
        if (!Array.isArray(json.data?.Page?.media)) throw new Error('INVALID_CATALOG');
        return { pageInfo: json.data.Page.pageInfo || {}, items: json.data.Page.media.map(normalizeMedia).filter(Boolean), source: 'anilist' };
      } catch (error) {
        lastError = error;
        if (error?.name === 'AbortError') throw error;
        if (attempt < 2) await sleep(350 * (attempt + 1));
      }
    }
    throw lastError || new Error('Falha de conexão');
  }

  async function fetchCatalogPage(options, signal) {
    const key = JSON.stringify(options);
    const cached = cacheRead(key);
    if (cached) return cached;
    let result;
    try {
      result = await serverCatalog(options, signal);
      const current = Number(result.pageInfo?.currentPage || options.page);
      const last = Number(result.pageInfo?.lastPage || current);
      if (!result.items.length && current <= last && !options.communityOnly) result = await directCatalog(options, signal);
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      result = await directCatalog(options, signal);
    }
    if (result.items.length) cacheWrite(key, result);
    return result;
  }

  async function fetchCatalog(signal) {
    const options = requestOptions();
    if (state.mode !== 'TOP') return fetchCatalogPage(options, signal);
    const batches = await Promise.all(Array.from({ length: 4 }, (_, index) => fetchCatalogPage({ ...options, page: index + 1 }, signal)));
    const seen = new Set();
    const items = batches.flatMap(batch => batch.items).filter(media => {
      const id = Number(media?.id);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    }).slice(0, 100);
    return { items, pageInfo: { total: items.length, currentPage: 1, lastPage: 1, hasNextPage: false }, source: batches[0]?.source || 'aninexus' };
  }

  function activeFilterCount(filters = state.filters) {
    return ['format', 'status', 'season', 'year', 'genre', 'tag'].filter(key => Boolean(filters[key])).length;
  }
  function modeLabel() {
    return ({ ALL: 'Todos os animes', SOON: 'Animes em breve', SEASON: 'Animes da temporada', TOP: 'Top 100 animes', POPULAR: 'Mais populares', MEMBERS: 'Mais membros', SEARCH: 'Resultados da busca' })[state.mode] || 'Todos os animes';
  }
  function introCopy() {
    if (state.mode === 'SEARCH') return { title: 'Buscar <em>Animes</em>', subtitle: '' };
    if (state.mode === 'TOP') return { title: 'Top 100 <em>Animes</em>', subtitle: 'Do 1º ao 100º, ordenados pelas avaliações da comunidade AniNexus.' };
    if (state.mode === 'POPULAR') return { title: 'Animes <em>Populares</em>', subtitle: 'As obras que mais movimentam as listas da comunidade.' };
    if (state.mode === 'MEMBERS') return { title: 'Mais <em>Membros</em>', subtitle: 'Os animes presentes em mais listas dos membros do AniNexus.' };
    if (state.mode === 'SOON') return { title: 'Animes em <em>Breve</em>', subtitle: 'Próximas estreias anunciadas e títulos a caminho.' };
    if (state.mode === 'SEASON') return { title: 'Animes da <em>Temporada</em>', subtitle: 'A temporada atual reunida em um catálogo fácil de acompanhar.' };
    return { title: 'Catálogo de <em>Animes</em>', subtitle: 'Todos os animes do catálogo, dos clássicos aos lançamentos da temporada.' };
  }
  function tabsMarkup() {
    return MODES.map(([key, label, icon]) => `<button type="button" class="nx21-tab${state.mode === key ? ' active' : ''}" data-nx21-mode="${key}" aria-pressed="${state.mode === key}"><i>${ICON[icon]}</i><span>${label}</span></button>`).join('');
  }
  function mobileMenuMarkup() {
    const options = MODES.map(([key, label, icon]) => `<button type="button" class="nx21-mobile-option${state.mode === key ? ' active' : ''}" data-nx21-mode="${key}" aria-pressed="${state.mode === key}"><i>${ICON[icon]}</i><span>${label}</span></button>`).join('');
    return `<div class="nx21-mobile-menu-layer" role="presentation"><button type="button" class="nx21-mobile-menu-backdrop" data-nx21-menu-close aria-label="Fechar menu do catálogo"></button><section class="nx21-mobile-menu" role="dialog" aria-modal="true" aria-labelledby="nx21MobileMenuTitle" tabindex="-1"><header><h2 id="nx21MobileMenuTitle">Menu</h2><button type="button" data-nx21-menu-close aria-label="Fechar menu do catálogo">${ICON.close}</button></header><div class="nx21-mobile-options">${options}</div></section></div>`;
  }
  function searchMarkup() {
    if (state.mode !== 'SEARCH') return '';
    const count = activeFilterCount();
    return `<div class="nx21-search-tools"><label class="nx21-search-field">${ICON.search}<span class="sr-only">Buscar animes</span><input id="nx21Search" type="search" autocomplete="off" maxlength="120" placeholder="Buscar animes..." value="${esc(state.search)}"><button type="button" data-nx21-search-clear aria-label="Limpar busca"${state.search ? '' : ' hidden'}>${ICON.close}</button></label><button type="button" class="nx21-open-filters${count ? ' has-filters' : ''}" data-nx21-filters aria-haspopup="dialog">${ICON.filters}<span>Filtros</span>${count ? `<b>${count}</b>` : ''}</button></div>`;
  }
  function skeletons() {
    return `<div class="nx21-grid nx21-grid-loading">${Array.from({ length: 15 }, () => '<div class="nx21-skeleton"><i></i><span></span><small></small></div>').join('')}</div>`;
  }
  function choiceButtons(name, options) {
    return options.map(([value, label]) => `<button type="button" data-nx21-filter-key="${name}" data-nx21-filter-value="${value}" aria-pressed="${state.draft[name] === value}">${esc(label)}</button>`).join('');
  }
  function selectOptions(items, value, placeholder) {
    return `<option value="">${esc(placeholder)}</option>${items.map(([itemValue, label]) => `<option value="${esc(itemValue)}"${String(value) === String(itemValue) ? ' selected' : ''}>${esc(label)}</option>`).join('')}`;
  }
  function filterMarkup() {
    const changed = activeFilterCount(state.draft) || state.draft.sort !== 'NEW' || state.draft.direction !== 'DESC';
    return `<div class="nx21-filter-layer" role="presentation"><button type="button" class="nx21-filter-backdrop" data-nx21-filter-close aria-label="Fechar filtros"></button><section class="nx21-filter-dialog" role="dialog" aria-modal="true" aria-labelledby="nx21FilterTitle" tabindex="-1"><header><h2 id="nx21FilterTitle">Filtros</h2><button type="button" class="nx21-filter-close" data-nx21-filter-close aria-label="Fechar filtros">${ICON.close}</button></header><div class="nx21-filter-scroll"><fieldset><legend>Tipo</legend><div class="nx21-filter-choices">${choiceButtons('format', FORMATS)}</div></fieldset><fieldset><legend>Status</legend><div class="nx21-filter-choices">${choiceButtons('status', STATUSES)}</div></fieldset><fieldset><legend>Temporada</legend><div class="nx21-filter-choices">${choiceButtons('season', SEASONS)}</div></fieldset><div class="nx21-filter-selects"><label><span>Ano</span><select id="nx21Year">${selectOptions(years().map(year => [year, year]), state.draft.year, 'Todos os anos')}</select></label><label><span>Gênero</span><select id="nx21Genre">${selectOptions(GENRES, state.draft.genre, 'Todos os gêneros')}</select></label><label><span>Tag</span><select id="nx21Tag">${selectOptions(TAGS, state.draft.tag, 'Todas as tags')}</select></label></div><fieldset><legend>Ordenar por</legend><div class="nx21-filter-choices nx21-sort-choices">${choiceButtons('sort', SORTS)}</div></fieldset><fieldset><legend>Direção</legend><div class="nx21-direction"><button type="button" data-nx21-direction="ASC" aria-pressed="${state.draft.direction === 'ASC'}" title="Ordem crescente">${ICON.asc}<span>Crescente</span></button><button type="button" data-nx21-direction="DESC" aria-pressed="${state.draft.direction === 'DESC'}" title="Ordem decrescente">${ICON.desc}<span>Decrescente</span></button></div></fieldset></div><footer><button type="button" class="nx21-clear-filters" data-nx21-filter-clear${changed ? '' : ' disabled'}>Limpar</button><button type="button" class="nx21-apply-filters" data-nx21-filter-apply>Aplicar${activeFilterCount(state.draft) ? ` <b>${activeFilterCount(state.draft)}</b>` : ''}</button></footer></section></div>`;
  }

  function cardMarkup(media, index) {
    const title = titleOf(media);
    const score = scoreOf(media);
    const year = media.seasonYear || media.startDate?.year || '';
    const rankMode = ['TOP', 'POPULAR', 'MEMBERS'].includes(state.mode);
    const rank = (state.page - 1) * PER_PAGE + index + 1;
    const favourites = Number(media.favourites || 0);
    const meta = state.mode === 'MEMBERS' && favourites > 0
      ? `${favourites.toLocaleString('pt-BR')} favorito${favourites === 1 ? '' : 's'}`
      : [formatLabel(media.format), year, media.episodes ? `${media.episodes} ep.` : ''].filter(Boolean).join(' · ');
    state.items.set(Number(media.id), media);
    return `<article class="nx21-card nx21-reveal${rankMode ? ' nx21-ranked' : ''}" data-nx21-open="${media.id}" data-nx-media="${media.id}" tabindex="0" aria-label="Abrir ${esc(title)}"><div class="nx21-poster"><img src="${esc(imageOf(media))}" loading="lazy" decoding="async" alt="${esc(title)}"><div class="nx21-shade"></div>${score ? `<span class="nx21-score">${ICON.star}<b>${score}</b></span>` : ''}<div class="nx21-actions"><button type="button" data-list="${media.id}" aria-label="Adicionar à lista">${ICON.plus}</button><button type="button" data-fav="${media.id}" aria-label="Adicionar aos favoritos">${ICON.heart}</button></div></div>${rankMode ? `<span class="nx21-rank" aria-hidden="true">${rank}</span><small class="nx21-rank-label">${rank}º NO ANINEXUS</small>` : ''}<h3>${esc(title)}</h3>${meta ? `<p>${esc(meta)}</p>` : ''}${!rankMode && media.genres?.length ? `<small class="nx21-genres">${esc(media.genres.slice(0, 2).map(genreLabel).join(' · '))}</small>` : ''}</article>`;
  }

  function paginationMarkup(info) {
    const current = Math.max(1, Number(info.currentPage || state.page));
    const last = Math.max(1, Math.min(Number(info.lastPage || current), state.mode === 'TOP' ? 4 : MAX_PUBLIC_PAGE));
    if (last <= 1) return '';
    const pages = [...new Set([1, current - 1, current, current + 1, last].filter(page => page >= 1 && page <= last))].sort((a, b) => a - b);
    let previous = 0;
    const numbers = pages.map(page => {
      const gap = previous && page - previous > 1 ? '<span class="nx21-page-gap" aria-hidden="true">...</span>' : '';
      previous = page;
      return `${gap}<button type="button" data-nx21-page="${page}"${page === current ? ' class="active" aria-current="page"' : ''}>${page.toLocaleString('pt-BR')}</button>`;
    }).join('');
    return `<nav class="nx21-pages" aria-label="Paginação do catálogo"><button type="button" class="nx21-page-arrow" data-nx21-page="${Math.max(1, current - 1)}"${current === 1 ? ' disabled' : ''} aria-label="Página anterior">${ICON.left}</button>${numbers}<button type="button" class="nx21-page-arrow" data-nx21-page="${Math.min(last, current + 1)}"${current === last || info.hasNextPage === false ? ' disabled' : ''} aria-label="Próxima página">${ICON.right}</button></nav>`;
  }

  function renderShell() {
    const copy = introCopy();
    document.documentElement.classList.remove('nx21-catalog-boot');
    document.body.classList.add('nx21-catalog');
    document.querySelectorAll('[data-nav]').forEach(link => link.classList.toggle('active', link.dataset.nav === 'anime'));
    app.innerHTML = `<main class="nx21-catalog-page"><header class="nx21-chrome"><div class="shell nx21-intro"><h1 id="nx21IntroTitle">${copy.title}</h1><p id="nx21IntroSubtitle">${esc(copy.subtitle)}</p><div id="nx21SearchTools">${searchMarkup()}</div></div><nav class="nx21-tabbar" aria-label="Seções do catálogo"><div class="shell nx21-tab-row"><button type="button" class="nx21-mobile-menu-trigger" data-nx21-menu aria-label="Abrir menu do catálogo" aria-haspopup="dialog" aria-expanded="false">${ICON.menu}</button><div class="nx21-tabs">${tabsMarkup()}</div></div></nav></header><section class="nx21-body"><div class="shell"><p class="sr-only" id="nx21Count" aria-live="polite"></p><div class="nx21-load-line" aria-hidden="true"><i></i></div><div id="nx21Results" aria-live="polite">${skeletons()}</div><div id="nx21Pagination"></div></div></section></main>`;
  }

  function updateChrome() {
    const copy = introCopy();
    const title = document.querySelector('#nx21IntroTitle');
    const subtitle = document.querySelector('#nx21IntroSubtitle');
    const tools = document.querySelector('#nx21SearchTools');
    if (title) title.innerHTML = copy.title;
    if (subtitle) subtitle.textContent = copy.subtitle;
    if (tools) tools.innerHTML = searchMarkup();
    document.querySelectorAll('[data-nx21-mode]').forEach(button => {
      const active = button.dataset.nx21Mode === state.mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
      if (active && button.classList.contains('nx21-tab')) button.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
    const modeTitle = document.querySelector('#nx21ModeTitle');
    if (modeTitle) modeTitle.textContent = modeLabel();
    document.body.classList.toggle('nx21-search-mode', state.mode === 'SEARCH');
    document.title = `${modeLabel()} | AniNexus`;
  }

  function revealCards() {
    state.revealObserver?.disconnect();
    const cards = [...document.querySelectorAll('.nx21-reveal')];
    if (!cards.length) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      cards.forEach(card => card.classList.add('visible'));
      return;
    }
    state.revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('visible');
        state.revealObserver?.unobserve(entry.target);
      });
    }, { rootMargin: '80px 0px', threshold: 0.06 });
    cards.forEach((card, index) => {
      card.style.setProperty('--nx21-delay', `${Math.min(index % 5, 4) * 45}ms`);
      state.revealObserver.observe(card);
    });
  }

  async function load() {
    const results = document.querySelector('#nx21Results');
    const pagination = document.querySelector('#nx21Pagination');
    const progress = document.querySelector('.nx21-load-line');
    if (!results || !pagination) return;
    state.controller?.abort();
    state.controller = new AbortController();
    const token = ++state.token;
    results.setAttribute('aria-busy', 'true');
    results.innerHTML = skeletons();
    pagination.innerHTML = '';
    progress?.classList.add('loading');
    try {
      const data = await fetchCatalog(state.controller.signal);
      if (token !== state.token) return;
      state.items.clear();
      const total = Number(data.pageInfo?.total || 0);
      const count = document.querySelector('#nx21Count');
      if (count) count.textContent = total ? state.mode === 'TOP' ? `${Math.min(total, 100).toLocaleString('pt-BR')} posições` : `${total >= 5000 ? '5.000+' : total.toLocaleString('pt-BR')} títulos` : '';
      results.innerHTML = data.items.length
        ? `<div class="nx21-grid">${data.items.map(cardMarkup).join('')}</div>`
        : '<div class="nx21-empty"><strong>Nenhum anime encontrado</strong><span>Altere os filtros para ampliar os resultados.</span></div>';
      pagination.innerHTML = paginationMarkup(data.pageInfo || {});
      revealCards();
      window.dispatchEvent(new CustomEvent('aninexus:media-state-refresh'));
    } catch (error) {
      if (error?.name === 'AbortError' || token !== state.token) return;
      results.innerHTML = `<div class="nx21-error">${ICON.retry}<strong>O catálogo não carregou agora</strong><span>Sua busca foi preservada. Tente novamente em instantes.</span><button type="button" data-nx21-retry>${ICON.retry}<span>Tentar novamente</span></button></div>`;
    } finally {
      if (token === state.token) {
        results.removeAttribute('aria-busy');
        progress?.classList.remove('loading');
      }
    }
  }

  function refreshFilterDialog() {
    const layer = document.querySelector('.nx21-filter-layer');
    if (!layer) return;
    layer.querySelectorAll('[data-nx21-filter-key]').forEach(button => {
      const active = state.draft[button.dataset.nx21FilterKey] === button.dataset.nx21FilterValue;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    layer.querySelectorAll('[data-nx21-direction]').forEach(button => {
      const active = state.draft.direction === button.dataset.nx21Direction;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    const year = layer.querySelector('#nx21Year');
    const genre = layer.querySelector('#nx21Genre');
    const tag = layer.querySelector('#nx21Tag');
    if (year) year.value = String(state.draft.year || '');
    if (genre) genre.value = state.draft.genre || '';
    if (tag) tag.value = state.draft.tag || '';
    const count = activeFilterCount(state.draft);
    const changed = count || state.draft.sort !== 'NEW' || state.draft.direction !== 'DESC';
    const clear = layer.querySelector('[data-nx21-filter-clear]');
    if (clear) clear.disabled = !changed;
    const apply = layer.querySelector('[data-nx21-filter-apply]');
    if (apply) apply.innerHTML = `Aplicar${count ? ` <b>${count}</b>` : ''}`;
  }

  function openFilters() {
    closeMobileMenu(false);
    closeFilters(false);
    state.filtersOpen = true;
    state.draft = { ...state.filters };
    state.previousFocus = document.activeElement;
    document.body.insertAdjacentHTML('beforeend', filterMarkup());
    document.body.classList.add('nx21-filters-open', 'modal-open');
    requestAnimationFrame(() => document.querySelector('.nx21-filter-dialog')?.focus());
  }

  function closeFilters(restoreFocus = true) {
    document.querySelector('.nx21-filter-layer')?.remove();
    state.filtersOpen = false;
    document.body.classList.remove('nx21-filters-open');
    if (!document.querySelector('.nx21-mobile-menu-layer,.nx20-media-layer,.search-overlay:not([hidden]),.auth-overlay:not([hidden])')) document.body.classList.remove('modal-open');
    if (restoreFocus && state.previousFocus instanceof HTMLElement && state.previousFocus.isConnected) state.previousFocus.focus();
    state.previousFocus = null;
  }

  function openMobileMenu() {
    if (!matchMedia('(max-width: 640px)').matches) return;
    closeFilters(false);
    closeMobileMenu(false);
    state.menuOpen = true;
    state.menuFocus = document.activeElement;
    document.body.insertAdjacentHTML('beforeend', mobileMenuMarkup());
    document.body.classList.add('nx21-menu-open', 'modal-open');
    document.querySelector('[data-nx21-menu]')?.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => document.querySelector('.nx21-mobile-menu')?.focus());
  }

  function closeMobileMenu(restoreFocus = true) {
    document.querySelector('.nx21-mobile-menu-layer')?.remove();
    state.menuOpen = false;
    document.body.classList.remove('nx21-menu-open');
    document.querySelector('[data-nx21-menu]')?.setAttribute('aria-expanded', 'false');
    if (!document.querySelector('.nx21-filter-layer,.nx20-media-layer,.search-overlay:not([hidden]),.auth-overlay:not([hidden])')) document.body.classList.remove('modal-open');
    if (restoreFocus && state.menuFocus instanceof HTMLElement && state.menuFocus.isConnected) state.menuFocus.focus();
    state.menuFocus = null;
  }

  function applyFilters() {
    state.filters = { ...state.draft };
    state.mode = 'SEARCH';
    state.page = 1;
    persist();
    closeFilters();
    updateChrome();
    load();
  }

  function setMode(mode) {
    if (!MODES.some(item => item[0] === mode)) return;
    const changed = state.mode !== mode;
    closeMobileMenu(false);
    if (!changed) return;
    state.mode = mode;
    state.page = 1;
    persist();
    closeFilters(false);
    updateChrome();
    load();
    if (mode === 'SEARCH') requestAnimationFrame(() => document.querySelector('#nx21Search')?.focus());
  }

  function openAnime(id) {
    const media = state.items.get(Number(id));
    if (!media) return;
    const path = `/anime/${slug(titleOf(media))}-${media.id}`;
    cleanup();
    if (IS_PAGES) location.href = `${BASE}/?build=${BUILD}&p=${encodeURIComponent(path)}`;
    else {
      history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }

  function normalizeUrl() {
    if (!onCatalog()) return;
    if (IS_PAGES) {
      const url = new URL(location.href);
      url.pathname = `${BASE}/`;
      url.search = '';
      url.searchParams.set('build', BUILD);
      url.searchParams.set('p', TARGET);
      history.replaceState({}, '', url.pathname + url.search);
    } else history.replaceState({}, '', TARGET);
    window.__NX_CATALOG_BOOT__ = false;
  }

  function scrollCatalogTop() {
    const body = document.querySelector('.nx21-body');
    if (!body) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    body.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }

  function handleScroll() {
    if (!state.mounted) return;
    document.body.classList.toggle('nx21-catalog-scrolled', scrollY > 54);
  }

  function handleResize() {
    if (state.menuOpen && !matchMedia('(max-width: 640px)').matches) closeMobileMenu(false);
  }

  function applyIncoming(filters = {}) {
    const allowed = ['format', 'status', 'season', 'year', 'genre', 'tag', 'sort', 'direction'];
    const next = { ...state.filters };
    allowed.forEach(key => {
      if (filters[key] != null && String(filters[key]) !== '') next[key] = String(filters[key]);
    });
    if (filters.search != null) state.search = String(filters.search).slice(0, 120);
    state.filters = next;
    state.mode = 'SEARCH';
    state.page = 1;
    persist();
    if (state.mounted) {
      updateChrome();
      load();
    }
  }

  function cleanup() {
    state.controller?.abort();
    state.controller = null;
    state.revealObserver?.disconnect();
    state.revealObserver = null;
    state.mounted = false;
    closeFilters(false);
    closeMobileMenu(false);
    document.documentElement.classList.remove('nx21-catalog-boot');
    document.body.classList.remove('nx21-catalog', 'nx21-catalog-scrolled', 'nx21-search-mode');
  }

  function mount() {
    if (!onCatalog()) return;
    normalizeUrl();
    cleanup();
    restore();
    state.page = 1;
    state.mounted = true;
    renderShell();
    updateChrome();
    handleScroll();
    load();
  }

  document.addEventListener('click', event => {
    if (event.target.closest('[data-nx21-menu-close]')) { closeMobileMenu(); return; }
    const filterButton = event.target.closest('[data-nx21-filter-key]');
    if (filterButton) {
      const key = filterButton.dataset.nx21FilterKey;
      const value = filterButton.dataset.nx21FilterValue;
      state.draft[key] = key === 'sort' ? value : state.draft[key] === value ? '' : value;
      if (key === 'sort' && value === 'TITLE') state.draft.direction = 'ASC';
      refreshFilterDialog();
      return;
    }
    const direction = event.target.closest('[data-nx21-direction]');
    if (direction) {
      state.draft.direction = direction.dataset.nx21Direction;
      refreshFilterDialog();
      return;
    }
    if (event.target.closest('[data-nx21-filter-close]')) { closeFilters(); return; }
    if (event.target.closest('[data-nx21-filter-clear]')) {
      state.draft = emptyFilters();
      refreshFilterDialog();
      return;
    }
    if (event.target.closest('[data-nx21-filter-apply]')) { applyFilters(); return; }
    if (!document.body.classList.contains('nx21-catalog')) return;
    if (event.target.closest('[data-nx21-menu]')) { event.preventDefault(); openMobileMenu(); return; }
    const mode = event.target.closest('[data-nx21-mode]');
    if (mode) { event.preventDefault(); setMode(mode.dataset.nx21Mode); return; }
    if (event.target.closest('[data-nx21-filters]')) { event.preventDefault(); openFilters(); return; }
    if (event.target.closest('[data-nx21-search-clear]')) {
      state.search = '';
      state.page = 1;
      persist();
      updateChrome();
      load();
      requestAnimationFrame(() => document.querySelector('#nx21Search')?.focus());
      return;
    }
    const pageButton = event.target.closest('[data-nx21-page]');
    if (pageButton && !pageButton.disabled) {
      state.page = Number(pageButton.dataset.nx21Page) || 1;
      load();
      scrollCatalogTop();
      return;
    }
    if (event.target.closest('[data-nx21-retry]')) { load(); return; }
    if (event.target.closest('[data-list],[data-fav]')) return;
    const card = event.target.closest('[data-nx21-open]');
    if (card) openAnime(card.dataset.nx21Open);
  }, true);

  document.addEventListener('input', event => {
    if (event.target.id !== 'nx21Search') return;
    state.search = event.target.value;
    state.page = 1;
    persist();
    const clear = event.target.closest('.nx21-search-field')?.querySelector('[data-nx21-search-clear]');
    if (clear) clear.hidden = !state.search;
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(load, 320);
  });

  document.addEventListener('change', event => {
    if (!state.filtersOpen) return;
    const map = { nx21Year: 'year', nx21Genre: 'genre', nx21Tag: 'tag' };
    const key = map[event.target.id];
    if (!key) return;
    state.draft[key] = event.target.value;
    refreshFilterDialog();
  });

  document.addEventListener('keydown', event => {
    if (state.menuOpen && event.key === 'Escape') {
      event.preventDefault();
      closeMobileMenu();
      return;
    }
    if (state.filtersOpen && event.key === 'Escape') {
      event.preventDefault();
      closeFilters();
      return;
    }
    if ((state.filtersOpen || state.menuOpen) && event.key === 'Tab') {
      const layer = document.querySelector(state.filtersOpen ? '.nx21-filter-layer' : '.nx21-mobile-menu-layer');
      const focusable = [...(layer?.querySelectorAll('button:not(:disabled),select,input,[tabindex]:not([tabindex="-1"])') || [])].filter(node => !node.hidden);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      return;
    }
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const card = event.target.closest('[data-nx21-open]');
    if (!card || event.target.closest('button')) return;
    event.preventDefault();
    openAnime(card.dataset.nx21Open);
  });

  addEventListener('scroll', handleScroll, { passive: true });
  addEventListener('resize', handleResize, { passive: true });
  addEventListener('popstate', () => { if (onCatalog()) mount(); else cleanup(); });
  addEventListener('aninexus:catalog-filter', event => applyIncoming(event.detail || {}));
  window.AniNexusCatalog = Object.freeze({ applyFilters: applyIncoming, reload: load });
  if (onCatalog()) mount();
})();
