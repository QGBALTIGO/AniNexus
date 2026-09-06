'use strict';
(() => {
  if (window.__ANINEXUS_DISCOVERY_V47__) return;
  window.__ANINEXUS_DISCOVERY_V47__ = true;

  const app = document.querySelector('#app');
  if (!app) return;

  const BUILD = '44.26.0';
  const IS_PAGES = location.hostname.endsWith('github.io');
  const BASE = IS_PAGES ? '/AniNexus' : '';
  const ROUTES = new Set(['/animes/onde-assistir', '/animes/dublados']);
  const DUBBED_FALLBACK_IDS = new Set([
    154587, 101922, 21, 171018, 16498, 151807, 813, 5114, 20, 127230,
    21459, 1535, 269, 11061, 21519, 21087, 1254, 199, 113415, 161645
  ]);
  const ICON = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="m10 8 6 4-6 4V8Z"/></svg>',
    voice: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="3" width="8" height="12" rx="4"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/></svg>',
    up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 14 5-5 5 5"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M14 7.5 18.5 12 14 16.5"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.7" cy="10.7" r="6.6"/><path d="m15.7 15.7 4.5 4.5"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 8.8c0 5-8.5 10-8.5 10s-8.5-5-8.5-10A4.6 4.6 0 0 1 12 6.4a4.6 4.6 0 0 1 8.5 2.4Z"/></svg>',
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.5 6.1.9-4.4 4.3 1 6.1-5.5-2.9-5.5 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/></svg>',
    left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
    right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>',
    retry: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 0-2 5"/></svg>'
  };
  const PROVIDERS = [
    { key: 'apple', name: 'Apple TV', label: 'Animes na Apple TV', logo: 'apple.svg', color: '#f5f5f7', official: 'https://tv.apple.com/br', match: /apple\s*tv|itunes|tv\.apple/i },
    { key: 'claro', name: 'Claro TV', label: 'Animes na Claro TV', mark: 'claro', color: '#e9424a', official: 'https://www.clarotvmais.com.br/', match: /claro/i },
    { key: 'crunchyroll', name: 'Crunchyroll', label: 'Animes na Crunchyroll', logo: 'crunchyroll.svg', color: '#f47521', official: 'https://www.crunchyroll.com/pt-br/', match: /crunchyroll/i },
    { key: 'disney', name: 'Disney+', label: 'Animes na Disney+', mark: 'Disney+', color: '#75a8ff', official: 'https://www.disneyplus.com/pt-br', match: /disney/i },
    { key: 'globoplay', name: 'Globoplay', label: 'Animes no Globoplay', mark: 'G', color: '#ff405e', official: 'https://globoplay.globo.com/', match: /globoplay|globo\s*play/i },
    { key: 'max', name: 'Max', label: 'Animes na Max', mark: 'max', color: '#8e78ff', official: 'https://www.max.com/br/pt', match: /hbo|max\.com|\bmax\b/i },
    { key: 'netflix', name: 'Netflix', label: 'Animes na Netflix', logo: 'netflix.svg', color: '#e50914', official: 'https://www.netflix.com/br/', match: /netflix/i },
    { key: 'pluto', name: 'Pluto TV', label: 'Animes na Pluto TV', mark: 'pluto', color: '#f4d55c', official: 'https://pluto.tv/br/', match: /pluto/i },
    { key: 'prime', name: 'Prime Video', label: 'Animes no Prime Video', logo: 'amazon.svg', color: '#24b8ef', official: 'https://www.primevideo.com/', match: /prime\s*video|amazon\s*(?:video|prime)|primevideo/i }
  ];

  const state = {
    token: 0,
    controller: null,
    path: '',
    provider: 'crunchyroll',
    watchItems: [],
    dubbedItems: [],
    dubbedInfo: {},
    dubbedPage: 1,
    dubbedMode: 'ALL',
    dubbedSearch: '',
    scrollFrame: 0
  };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const slug = value => String(value || 'anime').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 90) || 'anime';
  const titleOf = media => media?.title?.english || media?.title?.userPreferred || media?.title?.romaji || media?.title?.native || media?.title || media?.titleRomaji || 'Anime';
  const imageOf = media => media?.coverImage?.extraLarge || media?.coverImage?.large || media?.cover || `${BASE}/assets/logo.png`;
  const formatOf = media => ({ TV: 'Série', TV_SHORT: 'Série curta', MOVIE: 'Filme', OVA: 'OVA', ONA: 'ONA', SPECIAL: 'Especial' })[String(media?.format || '').toUpperCase()] || 'Anime';
  const yearOf = media => Number(media?.seasonYear || media?.startDate?.year) || null;
  const scoreOf = media => {
    if (media?.metricsSource !== 'aninexus' || Number(media?.ratingCount || 0) <= 0) return '';
    const score = Number(media?.averageScore) ? Number(media.averageScore) / 10 : Number(media?.score);
    return Number.isFinite(score) && score > 0 ? score.toFixed(1).replace('.0', '') : '';
  };

  function route() {
    const url = new URL(location.href);
    const restored = url.searchParams.get('p');
    if (restored) return restored.split('?')[0].replace(/\/+$/, '') || '/';
    let path = url.pathname;
    if (IS_PAGES) path = path.replace(/^\/AniNexus/, '') || '/';
    return path.replace(/\/+$/, '') || '/';
  }

  function normalizeMedia(media) {
    if (!media || typeof media !== 'object' || !Number(media.id)) return null;
    if (media.coverImage && typeof media.title === 'object') return media;
    return {
      ...media,
      title: { english: media.title || '', romaji: media.titleRomaji || media.title || '', native: media.titleNative || '' },
      coverImage: { extraLarge: media.cover || '', large: media.cover || '' },
      seasonYear: media.seasonYear || media.startDate?.year || null
    };
  }

  async function apiJson(path, signal) {
    if (IS_PAGES && window.AniNexusAuth?.enabled) return window.AniNexusAuth.publicApi(path, { signal, timeout: 15000 });
    if (IS_PAGES) throw new Error('API_NOT_CONFIGURED');
    const response = await fetch(path, { signal, credentials: 'same-origin', headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  function providerMark(provider) {
    if (provider.logo) return `<img src="${BASE}/assets/streaming/${provider.logo}" alt="" loading="eager" decoding="async">`;
    return `<span class="nx47-provider-wordmark" data-provider="${provider.key}">${esc(provider.mark)}</span>`;
  }

  function heroMarkup(kind) {
    const watch = kind === 'watch';
    return `<header class="nx47-chrome" id="nx47Hero">
      <div class="nx47-intro">
        <div class="nx47-title-row"><span class="nx47-title-icon">${watch ? ICON.play : ICON.voice}</span><div><h1>${watch ? '<em>Onde assistir</em> animes' : 'Animes <em>dublados</em>'}</h1><small>${watch ? 'STREAMING OFICIAL NO BRASIL' : 'ÁUDIO EM PORTUGUÊS'}</small></div></div>
        <p>${watch ? 'Escolha uma plataforma oficial e encontre os animes disponíveis nela.' : 'Títulos com dublagem em português para descobrir, acompanhar e guardar na sua lista.'}</p>
      </div>
    </header>`;
  }

  function islandMarkup(kind) {
    const watch = kind === 'watch';
    return `<div class="nx47-island" aria-hidden="true" inert>
      <button type="button" class="nx47-island-head" data-nx47-top aria-label="Voltar ao início da página">
        <span class="nx47-island-icon">${watch ? ICON.play : ICON.voice}</span>
        <span class="nx47-island-copy"><strong>${watch ? '<em>Onde assistir</em> animes' : 'Animes <em>dublados</em>'}</strong><small data-nx47-context>${watch ? 'ESCOLHA UMA PLATAFORMA' : 'CATÁLOGO EM PORTUGUÊS'}</small></span>
        <span class="nx47-island-arrow">${ICON.up}</span>
      </button>
    </div>`;
  }

  function skeletons(count = 10) {
    return `<div class="nx47-media-grid nx47-loading-grid">${Array.from({ length: count }, () => '<div class="nx47-skeleton"><i></i><span></span><small></small></div>').join('')}</div>`;
  }

  function mediaCard(media, badge = '') {
    const title = titleOf(media);
    const score = scoreOf(media);
    const year = yearOf(media);
    return `<article class="nx21-card nx47-media-card visible" data-nx21-open="${Number(media.id)}" data-nx-media="${Number(media.id)}" data-kind="anime" data-title="${esc(title)}" tabindex="0" aria-label="Abrir ${esc(title)}">
      <div class="nx21-poster">
        <img src="${esc(imageOf(media))}" loading="lazy" decoding="async" alt="${esc(title)}">
        <div class="nx21-shade"></div>
        ${badge ? `<span class="nx47-media-badge">${esc(badge)}</span>` : ''}
        ${score ? `<span class="nx21-score">${ICON.star}<b>${score}</b></span>` : ''}
        <div class="nx21-actions"><button type="button" data-list="${Number(media.id)}" aria-label="Adicionar ${esc(title)} à lista">${ICON.plus}</button><button type="button" data-fav="${Number(media.id)}" aria-label="Favoritar ${esc(title)}">${ICON.heart}</button></div>
      </div>
      <h3>${esc(title)}</h3>
      <p>${esc([formatOf(media), year].filter(Boolean).join(' · '))}</p>
    </article>`;
  }

  function emptyMarkup(title, text, action = '') {
    return `<div class="nx47-empty"><span>${ICON.play}</span><strong>${esc(title)}</strong><p>${esc(text)}</p>${action}</div>`;
  }

  function updateContext(value) {
    const context = document.querySelector('[data-nx47-context]');
    if (context) context.textContent = value;
  }

  function syncScroll() {
    if (!ROUTES.has(route())) return cleanup();
    if (state.scrollFrame) return;
    state.scrollFrame = requestAnimationFrame(() => {
      state.scrollFrame = 0;
      const shown = scrollY > 72;
      document.body.classList.toggle('nx47-discovery-scrolled', shown);
      const island = document.querySelector('.nx47-island');
      island?.classList.toggle('show', shown);
      island?.setAttribute('aria-hidden', String(!shown));
      island?.toggleAttribute('inert', !shown);
    });
  }

  function providerLinks(media, provider) {
    const links = Array.isArray(media?.streaming) ? media.streaming : Array.isArray(media?.externalLinks) ? media.externalLinks : [];
    return links.filter(link => {
      const url = String(link?.url || '');
      return /^https:\/\//i.test(url) && provider.match.test(`${link?.site || ''} ${url}`);
    });
  }

  function providerCardsMarkup() {
    return PROVIDERS.map(provider => {
      const count = state.watchItems.filter(media => providerLinks(media, provider).length).length;
      const selected = state.provider === provider.key;
      const detail = state.watchItems.length ? (count ? `${count} ${count === 1 ? 'título identificado' : 'títulos identificados'}` : 'Catálogo em atualização') : 'Consultando catálogo';
      return `<button type="button" class="nx47-provider-card${selected ? ' active' : ''}" data-nx47-provider="${provider.key}" aria-pressed="${selected}" style="--nx47-provider:${provider.color}">
        <span class="nx47-provider-logo">${providerMark(provider)}</span>
        <span class="nx47-provider-copy"><strong>${esc(provider.label)}</strong><small>${esc(detail)}</small></span>
        <span class="nx47-provider-arrow">${ICON.arrow}</span>
      </button>`;
    }).join('');
  }

  function renderProviderCards() {
    const root = document.querySelector('#nx47Providers');
    if (!root) return;
    root.innerHTML = providerCardsMarkup();
    root.querySelectorAll('[data-nx47-provider]').forEach(button => button.addEventListener('click', () => selectProvider(button.dataset.nx47Provider, true)));
  }

  function renderWatchResults() {
    const provider = PROVIDERS.find(item => item.key === state.provider) || PROVIDERS[2];
    const root = document.querySelector('#nx47WatchResults');
    const title = document.querySelector('#nx47WatchTitle');
    const count = document.querySelector('#nx47WatchCount');
    const official = document.querySelector('#nx47WatchOfficial');
    if (!root || !title || !count || !official) return;
    const items = state.watchItems.filter(media => providerLinks(media, provider).length);
    title.textContent = provider.label;
    count.textContent = items.length ? `${items.length} ${items.length === 1 ? 'título' : 'títulos'}` : 'Disponibilidade em atualização';
    official.href = provider.official;
    official.innerHTML = `Abrir ${esc(provider.name)} ${ICON.arrow}`;
    root.removeAttribute('aria-busy');
    root.innerHTML = items.length
      ? `<div class="nx47-media-grid">${items.slice(0, 24).map(media => mediaCard(media, provider.name)).join('')}</div>`
      : emptyMarkup(`Ainda não há títulos da ${provider.name} identificados`, 'A plataforma permanece disponível pelo site oficial enquanto atualizamos os dados do catálogo.', `<a href="${esc(provider.official)}" target="_blank" rel="nofollow noopener noreferrer">Abrir site oficial ${ICON.arrow}</a>`);
    bindMediaCards(root);
    window.AniNexusMediaActions?.neutralize?.(root);
  }

  function selectProvider(key, shouldScroll = false) {
    if (!PROVIDERS.some(provider => provider.key === key)) return;
    state.provider = key;
    renderProviderCards();
    renderWatchResults();
    const provider = PROVIDERS.find(item => item.key === key);
    updateContext(provider?.label.toUpperCase() || 'ONDE ASSISTIR');
    if (!IS_PAGES) {
      const url = new URL(location.href);
      url.searchParams.set('servico', key);
      history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
    if (shouldScroll) document.querySelector('#nx47WatchCatalog')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }

  async function loadWatch() {
    const token = ++state.token;
    state.controller?.abort();
    state.controller = new AbortController();
    try {
      const calls = Array.from({ length: 4 }, (_, index) => apiJson(`/api/catalog?page=${index + 1}&perPage=30&sort=DISCOVER&discover=500`, state.controller.signal));
      const settled = await Promise.allSettled(calls);
      if (token !== state.token) return;
      if (!settled.some(result => result.status === 'fulfilled')) throw settled[0]?.reason || new Error('Catalog unavailable');
      const map = new Map();
      for (const result of settled) {
        if (result.status !== 'fulfilled') continue;
        for (const raw of result.value?.items || []) {
          const media = normalizeMedia(raw);
          if (media) map.set(Number(media.id), media);
        }
      }
      state.watchItems = [...map.values()];
      renderProviderCards();
      renderWatchResults();
    } catch (error) {
      if (error?.name === 'AbortError' || token !== state.token) return;
      const root = document.querySelector('#nx47WatchResults');
      if (root) {
        root.removeAttribute('aria-busy');
        root.innerHTML = emptyMarkup('O catálogo não carregou agora', 'Tente novamente em instantes.', `<button type="button" data-nx47-watch-retry>${ICON.retry} Tentar novamente</button>`);
      }
    }
  }

  function watchMarkup() {
    return `${heroMarkup('watch')}${islandMarkup('watch')}<div class="nx47-content"><div class="shell">
      <section class="nx47-provider-section" aria-labelledby="nx47ProviderTitle">
        <header class="nx47-section-head"><div><small>PLATAFORMAS OFICIAIS</small><h2 id="nx47ProviderTitle">Escolha onde assistir</h2><p>Selecione um serviço para ver os títulos encontrados no catálogo AniNexus.</p></div><span>${PROVIDERS.length} serviços</span></header>
        <div class="nx47-provider-grid" id="nx47Providers">${providerCardsMarkup()}</div>
      </section>
      <section class="nx47-catalog-section" id="nx47WatchCatalog" aria-labelledby="nx47WatchTitle">
        <header class="nx47-results-head"><div><small>CATÁLOGO POR SERVIÇO</small><h2 id="nx47WatchTitle">Animes na Crunchyroll</h2><p id="nx47WatchCount">Consultando disponibilidade</p></div><a id="nx47WatchOfficial" href="https://www.crunchyroll.com/pt-br/" target="_blank" rel="nofollow noopener noreferrer">Abrir Crunchyroll ${ICON.arrow}</a></header>
        <div id="nx47WatchResults" aria-live="polite" aria-busy="true">${skeletons(10)}</div>
      </section>
    </div></div>`;
  }

  function dubbedControlsMarkup() {
    return `<div class="nx47-dubbed-controls">
      <div class="nx47-segmented" role="group" aria-label="Filtrar animes dublados por formato">
        ${[['ALL', 'Todos'], ['TV', 'Séries'], ['MOVIE', 'Filmes']].map(([key, label]) => `<button type="button" data-nx47-dub-mode="${key}" class="${state.dubbedMode === key ? 'active' : ''}" aria-pressed="${state.dubbedMode === key}">${label}</button>`).join('')}
      </div>
      <label class="nx47-search">${ICON.search}<span class="sr-only">Buscar nos animes dublados desta página</span><input type="search" maxlength="90" data-nx47-dub-search placeholder="Buscar nesta página..." value="${esc(state.dubbedSearch)}"><button type="button" data-nx47-search-clear aria-label="Limpar busca"${state.dubbedSearch ? '' : ' hidden'}>${ICON.close}</button></label>
    </div>`;
  }

  function dubbedPaginationMarkup() {
    const current = Math.max(1, Number(state.dubbedInfo.currentPage || state.dubbedPage));
    const last = Math.max(1, Number(state.dubbedInfo.lastPage || current));
    if (last <= 1) return '';
    return `<nav class="nx47-pagination" aria-label="Paginação dos animes dublados">
      <button type="button" data-nx47-dub-page="${current - 1}"${current <= 1 ? ' disabled' : ''} aria-label="Página anterior">${ICON.left}</button>
      <span>Página <strong>${current}</strong> de ${last}</span>
      <button type="button" data-nx47-dub-page="${current + 1}"${current >= last ? ' disabled' : ''} aria-label="Próxima página">${ICON.right}</button>
    </nav>`;
  }

  function visibleDubbedItems() {
    const query = state.dubbedSearch.trim().toLocaleLowerCase('pt-BR');
    return state.dubbedItems.filter(media => {
      if (state.dubbedMode === 'TV' && !['TV', 'TV_SHORT', 'ONA', 'OVA', 'SPECIAL'].includes(String(media.format || '').toUpperCase())) return false;
      if (state.dubbedMode === 'MOVIE' && String(media.format || '').toUpperCase() !== 'MOVIE') return false;
      return !query || titleOf(media).toLocaleLowerCase('pt-BR').includes(query);
    });
  }

  function renderDubbedResults() {
    const root = document.querySelector('#nx47DubbedResults');
    const controls = document.querySelector('#nx47DubbedControls');
    const pagination = document.querySelector('#nx47DubbedPagination');
    const count = document.querySelector('#nx47DubbedCount');
    if (!root || !controls || !pagination || !count) return;
    const items = visibleDubbedItems();
    const total = Number(state.dubbedInfo.total || state.dubbedItems.length);
    count.textContent = total ? `${total.toLocaleString('pt-BR')} ${total === 1 ? 'título confirmado' : 'títulos confirmados'}` : '';
    controls.innerHTML = dubbedControlsMarkup();
    root.removeAttribute('aria-busy');
    root.innerHTML = items.length
      ? `<div class="nx47-media-grid">${items.map(media => mediaCard(media, 'Dublado')).join('')}</div>`
      : emptyMarkup('Nenhum título encontrado', state.dubbedSearch || state.dubbedMode !== 'ALL' ? 'Limpe a busca ou altere o formato.' : 'A curadoria está atualizando esta página.');
    pagination.innerHTML = dubbedPaginationMarkup();
    bindDubbedControls();
    bindMediaCards(root);
    window.AniNexusMediaActions?.neutralize?.(root);
    updateContext(`PÁGINA ${state.dubbedPage}${total ? ` · ${total} TÍTULOS` : ''}`);
  }

  async function fallbackDubbed(signal) {
    const settled = await Promise.allSettled(Array.from({ length: 3 }, (_, index) => apiJson(`/api/catalog?page=${index + 1}&perPage=30&sort=DISCOVER`, signal)));
    const map = new Map();
    for (const result of settled) {
      if (result.status !== 'fulfilled') continue;
      for (const raw of result.value?.items || []) {
        const media = normalizeMedia(raw);
        if (media && DUBBED_FALLBACK_IDS.has(Number(media.id))) map.set(Number(media.id), { ...media, dubbed: true });
      }
    }
    return [...map.values()];
  }

  async function loadDubbed(page = 1) {
    const token = ++state.token;
    state.controller?.abort();
    state.controller = new AbortController();
    state.dubbedPage = Math.max(1, Number(page) || 1);
    const root = document.querySelector('#nx47DubbedResults');
    const pagination = document.querySelector('#nx47DubbedPagination');
    if (root) root.innerHTML = skeletons(12);
    if (pagination) pagination.innerHTML = '';
    try {
      const data = await apiJson(`/api/dublados?page=${state.dubbedPage}`, state.controller.signal);
      if (token !== state.token) return;
      let items = (data?.items || []).map(normalizeMedia).filter(Boolean);
      let info = data?.pageInfo || {};
      if (!items.length && state.dubbedPage === 1) {
        items = await fallbackDubbed(state.controller.signal);
        info = { currentPage: 1, lastPage: 1, hasNextPage: false, total: items.length };
      }
      if (token !== state.token) return;
      state.dubbedItems = items;
      state.dubbedInfo = info;
      renderDubbedResults();
    } catch (error) {
      if (error?.name === 'AbortError' || token !== state.token) return;
      if (root) {
        root.removeAttribute('aria-busy');
        root.innerHTML = emptyMarkup('Os animes dublados não carregaram agora', 'Sua página foi preservada. Tente novamente.', `<button type="button" data-nx47-dub-retry>${ICON.retry} Tentar novamente</button>`);
      }
    }
  }

  function dubbedMarkup() {
    return `${heroMarkup('dubbed')}${islandMarkup('dubbed')}<div class="nx47-content"><div class="shell">
      <section class="nx47-catalog-section nx47-dubbed-section" aria-labelledby="nx47DubbedTitle">
        <header class="nx47-section-head nx47-dubbed-head"><div><small>CATÁLOGO DUBLADO</small><h2 id="nx47DubbedTitle">Vozes em português</h2><p>Novos títulos entram conforme a disponibilidade de dublagem é confirmada.</p></div><span id="nx47DubbedCount">Consultando catálogo</span></header>
        <div id="nx47DubbedControls">${dubbedControlsMarkup()}</div>
        <div id="nx47DubbedResults" aria-live="polite" aria-busy="true">${skeletons(12)}</div>
        <div id="nx47DubbedPagination"></div>
      </section>
    </div></div>`;
  }

  function bindMediaCards(root) {
    root.querySelectorAll('.nx47-media-card').forEach(card => {
      const open = () => {
        const id = Number(card.dataset.nx21Open || 0);
        if (!id) return;
        navigate(`/anime/${slug(card.dataset.title)}-${id}`);
      };
      card.addEventListener('click', event => { if (!event.target.closest('button,a')) open(); });
      card.addEventListener('keydown', event => {
        if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('button,a')) {
          event.preventDefault();
          open();
        }
      });
      const image = card.querySelector('img');
      image?.addEventListener('error', () => {
        image.src = `${BASE}/assets/logo.png`;
        image.classList.add('nx47-image-fallback');
      }, { once: true });
    });
  }

  function bindDubbedControls() {
    document.querySelectorAll('[data-nx47-dub-mode]').forEach(button => button.addEventListener('click', () => {
      state.dubbedMode = button.dataset.nx47DubMode;
      renderDubbedResults();
    }));
    const input = document.querySelector('[data-nx47-dub-search]');
    const clear = document.querySelector('[data-nx47-search-clear]');
    input?.addEventListener('input', () => {
      state.dubbedSearch = input.value.slice(0, 90);
      if (clear) clear.hidden = !state.dubbedSearch;
      const items = visibleDubbedItems();
      const root = document.querySelector('#nx47DubbedResults');
      if (root) {
        root.innerHTML = items.length ? `<div class="nx47-media-grid">${items.map(media => mediaCard(media, 'Dublado')).join('')}</div>` : emptyMarkup('Nenhum título encontrado', 'Limpe a busca ou altere o formato.');
        bindMediaCards(root);
        window.AniNexusMediaActions?.neutralize?.(root);
      }
    });
    clear?.addEventListener('click', () => {
      state.dubbedSearch = '';
      renderDubbedResults();
      document.querySelector('[data-nx47-dub-search]')?.focus();
    });
    document.querySelectorAll('[data-nx47-dub-page]').forEach(button => button.addEventListener('click', () => {
      if (button.disabled) return;
      state.dubbedSearch = '';
      loadDubbed(Number(button.dataset.nx47DubPage));
      document.querySelector('.nx47-dubbed-section')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }));
  }

  function navigate(path) {
    cleanup();
    if (IS_PAGES) location.assign(`${BASE}/?build=${BUILD}&p=${encodeURIComponent(path)}`);
    else location.assign(path);
  }

  function bindCommon() {
    document.querySelector('[data-nx47-top]')?.addEventListener('click', () => scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
  }

  function mount(path = route()) {
    if (!ROUTES.has(path)) return cleanup();
    state.token += 1;
    state.controller?.abort();
    state.path = path;
    state.provider = new URL(location.href).searchParams.get('servico') || 'crunchyroll';
    state.watchItems = [];
    state.dubbedItems = [];
    state.dubbedPage = 1;
    state.dubbedMode = 'ALL';
    state.dubbedSearch = '';
    document.body.classList.remove('nx21-catalog', 'nx21-reading-catalog', 'nx-section-page', 'nx-scroll-down', 'nx-scroll-up');
    document.body.classList.add('nx47-discovery-active');
    document.body.classList.toggle('nx47-watch-active', path.endsWith('onde-assistir'));
    document.body.classList.toggle('nx47-dubbed-active', path.endsWith('dublados'));
    document.body.classList.remove('nx47-discovery-scrolled');
    scrollTo(0, 0);
    const watch = path.endsWith('onde-assistir');
    document.title = `${watch ? 'Onde assistir animes' : 'Animes dublados'} | AniNexus`;
    app.innerHTML = `<main class="nx47-discovery-page ${watch ? 'nx47-watch-page' : 'nx47-dubbed-page'}">${watch ? watchMarkup() : dubbedMarkup()}</main>`;
    bindCommon();
    if (watch) {
      renderProviderCards();
      loadWatch();
    } else {
      bindDubbedControls();
      loadDubbed(1);
    }
    document.documentElement.classList.remove('nx-dedicated-route-boot');
    window.dispatchEvent(new CustomEvent('aninexus:route-ready', { detail: { owner: 'discovery', path } }));
    syncScroll();
  }

  function cleanup() {
    if (!state.path && !document.body.classList.contains('nx47-discovery-active')) return;
    state.token += 1;
    state.controller?.abort();
    state.controller = null;
    state.path = '';
    document.body.classList.remove('nx47-discovery-active', 'nx47-watch-active', 'nx47-dubbed-active', 'nx47-discovery-scrolled');
  }

  addEventListener('scroll', syncScroll, { passive: true });
  addEventListener('popstate', () => queueMicrotask(() => ROUTES.has(route()) ? mount(route()) : cleanup()));
  document.addEventListener('click', event => {
    if (event.target.closest('[data-nx47-watch-retry]')) loadWatch();
    if (event.target.closest('[data-nx47-dub-retry]')) loadDubbed(state.dubbedPage);
  });

  window.AniNexusDiscovery = Object.freeze({ mount, cleanup, build: BUILD });
  if (ROUTES.has(route())) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => mount(route()), { once: true });
    else mount(route());
  }
})();
