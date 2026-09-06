'use strict';
(() => {
  if (window.__ANINEXUS_DISCOVERY_V47__) return;
  window.__ANINEXUS_DISCOVERY_V47__ = true;

  const app = document.querySelector('#app');
  if (!app) return;

  const BUILD = '44.27.0';
  const IS_PAGES = location.hostname.endsWith('github.io');
  const BASE = IS_PAGES ? '/AniNexus' : '';
  const ROUTES = new Set(['/animes/onde-assistir', '/animes/dublados', '/animes/estudios']);
  const DUBBED_FALLBACK_IDS = new Set([
    154587, 101922, 21, 171018, 16498, 151807, 813, 5114, 20, 127230,
    21459, 1535, 269, 11061, 21519, 21087, 1254, 199, 113415, 161645
  ]);
  const ICON = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="m10 8 6 4-6 4V8Z"/></svg>',
    voice: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="3" width="8" height="12" rx="4"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>',
    studio: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21h18M5 21V9l7-4v16M12 10l7-3v14M8 13h1M8 17h1M15 12h1M15 16h1"/></svg>',
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
    { key: 'apple', name: 'Apple TV+', label: 'Animes na Apple TV+', logo: 'apple-tv.svg', compactLogo: 'apple.svg', color: '#f5f5f7', official: 'https://tv.apple.com/br', match: /apple\s*tv|itunes|tv\.apple/i },
    { key: 'claro', name: 'Claro tv+', label: 'Animes na Claro tv+', logo: 'claro-tv-plus.svg', color: '#e9424a', official: 'https://www.clarotvmais.com.br/', match: /claro/i },
    { key: 'crunchyroll', name: 'Crunchyroll', label: 'Animes na Crunchyroll', logo: 'crunchyroll.svg', color: '#f47521', official: 'https://www.crunchyroll.com/pt-br/', match: /crunchyroll/i },
    { key: 'disney', name: 'Disney+', label: 'Animes na Disney+', logo: 'disney-plus.svg', color: '#75a8ff', official: 'https://www.disneyplus.com/pt-br', match: /disney/i },
    { key: 'globoplay', name: 'Globoplay', label: 'Animes no Globoplay', logo: 'globoplay.svg', color: '#ff405e', official: 'https://globoplay.globo.com/', match: /globoplay|globo\s*play/i },
    { key: 'max', name: 'HBO Max', label: 'Animes na HBO Max', logo: 'hbo-max.svg', color: '#8e78ff', official: 'https://www.hbomax.com/br/pt', match: /hbo|max\.com|\bmax\b/i },
    { key: 'netflix', name: 'Netflix', label: 'Animes na Netflix', logo: 'netflix-wordmark.svg', compactLogo: 'netflix.svg', color: '#e50914', official: 'https://www.netflix.com/br/', match: /netflix/i },
    { key: 'pluto', name: 'Pluto TV', label: 'Animes na Pluto TV', logo: 'pluto-tv.png', color: '#f4d55c', official: 'https://pluto.tv/br/', match: /pluto/i },
    { key: 'prime', name: 'Prime Video', label: 'Animes no Prime Video', logo: 'prime-video.svg', color: '#24b8ef', official: 'https://www.primevideo.com/', match: /prime\s*video|amazon\s*(?:video|prime)|primevideo/i }
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
    studioItems: [],
    studioInfo: {},
    studioPage: 1,
    studioSearch: '',
    studioRailObservers: [],
    scrollFrame: 0,
    lastScrollY: 0,
    scrollDirection: 0,
    scrollTravel: 0,
    scrollLockUntil: 0,
    manualIslandUntil: 0
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

  async function directStudios(page, signal) {
    const query = `query($page:Int){Page(page:$page,perPage:12){pageInfo{total currentPage lastPage hasNextPage} studios(sort:FAVOURITES_DESC){id name isAnimationStudio media(perPage:12,sort:START_DATE_DESC){pageInfo{total} nodes{id title{romaji english native userPreferred} coverImage{extraLarge large} episodes format status seasonYear startDate{year month day}}}}}}`;
    const response = await fetch('https://graphql.anilist.co/', {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ query, variables: { page } })
    });
    if (!response.ok) throw new Error(`AniList HTTP ${response.status}`);
    const json = await response.json();
    if (json.errors?.length) throw new Error(json.errors[0].message || 'AniList error');
    const source = json.data?.Page;
    return {
      pageInfo: source?.pageInfo || {},
      items: (source?.studios || []).filter(studio => studio.isAnimationStudio).map(studio => ({
        id: studio.id,
        name: studio.name,
        mediaTotal: Number(studio.media?.pageInfo?.total || studio.media?.nodes?.length || 0),
        media: (studio.media?.nodes || []).map(normalizeMedia).filter(Boolean)
      }))
    };
  }

  function providerMark(provider, compact = false) {
    const logo = compact && provider.compactLogo ? provider.compactLogo : provider.logo;
    return `<img src="${BASE}/assets/streaming/${logo}" alt="" loading="eager" decoding="async">`;
  }

  function kindCopy(kind) {
    if (kind === 'watch') return { icon: ICON.play, title: '<em>Onde assistir</em> animes', kicker: 'STREAMING OFICIAL NO BRASIL', description: 'Escolha uma plataforma oficial e encontre os animes disponíveis nela.', context: 'ESCOLHA UMA PLATAFORMA' };
    if (kind === 'dubbed') return { icon: ICON.voice, title: 'Animes <em>dublados</em>', kicker: 'ÁUDIO EM PORTUGUÊS', description: 'Explore séries e filmes com dublagem em português.', context: 'CATÁLOGO EM PORTUGUÊS' };
    return { icon: ICON.studio, title: '<em>Estúdios</em> de anime', kicker: 'POR TRÁS DAS OBRAS', description: 'Conheça as casas de animação e explore as produções de cada estúdio.', context: 'EXPLORE POR ESTÚDIO' };
  }

  function heroMarkup(kind) {
    const copy = kindCopy(kind);
    return `<header class="nx47-chrome" id="nx47Hero">
      <div class="nx47-intro">
        <div class="nx47-title-row"><span class="nx47-title-icon">${copy.icon}</span><div><h1>${copy.title}</h1><small>${copy.kicker}</small></div></div>
        <p>${copy.description}</p>
      </div>
    </header>`;
  }

  function islandMarkup(kind) {
    const copy = kindCopy(kind);
    const controls = kind === 'watch'
      ? `<div class="nx47-island-provider-rail" data-nx47-provider-rail role="group" aria-label="Plataformas de streaming"></div>`
      : kind === 'dubbed'
        ? '<div data-nx47-dub-controls-host></div>'
        : '<div data-nx47-studio-controls-host></div>';
    return `<section class="nx47-island" aria-label="Opções da página" aria-hidden="true" inert>
      <button type="button" class="nx47-island-head" data-nx47-island-toggle aria-label="Abrir opções da página" aria-expanded="false">
        <span class="nx47-island-icon">${copy.icon}</span>
        <span class="nx47-island-copy"><strong>${copy.title}</strong><small data-nx47-context>${copy.context}</small></span>
        <span class="nx47-island-arrow">${ICON.down}</span>
      </button>
      <div class="nx47-island-panel" aria-hidden="true" inert><div><div class="nx47-island-inner">${controls}</div></div></div>
    </section>`;
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

  function setIslandState(shown, expanded) {
    const island = document.querySelector('.nx47-island');
    if (!island) return;
    const open = Boolean(shown && expanded);
    const panel = island.querySelector('.nx47-island-panel');
    island.classList.toggle('show', Boolean(shown));
    island.classList.toggle('expanded', open);
    island.inert = !shown;
    island.setAttribute('aria-hidden', String(!shown));
    if (panel) {
      panel.inert = !open;
      panel.setAttribute('aria-hidden', String(!open));
    }
    island.querySelector('[data-nx47-island-toggle]')?.setAttribute('aria-expanded', String(open));
  }

  function syncScroll() {
    if (!ROUTES.has(route())) return cleanup();
    if (state.scrollFrame) return;
    state.scrollFrame = requestAnimationFrame(() => {
      state.scrollFrame = 0;
      const y = Math.max(0, scrollY);
      const delta = y - state.lastScrollY;
      const headerHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nx43-header-height')) || 66;
      const shown = (document.querySelector('#nx47Hero')?.getBoundingClientRect().bottom || Infinity) < headerHeight;
      const wasShown = document.body.classList.contains('nx47-discovery-scrolled');
      document.body.classList.toggle('nx47-discovery-scrolled', shown);
      const island = document.querySelector('.nx47-island');
      if (!shown) {
        document.body.classList.remove('nx47-discovery-scroll-down', 'nx47-discovery-scroll-up');
        setIslandState(false, false);
        state.lastScrollY = y;
        state.scrollDirection = 0;
        state.scrollTravel = 0;
        return;
      }
      island?.classList.add('show');
      if (island) island.inert = false;
      island?.setAttribute('aria-hidden', 'false');
      if (!wasShown && y > 118) {
        document.body.classList.add('nx47-discovery-scroll-down');
        document.body.classList.remove('nx47-discovery-scroll-up');
        setIslandState(true, false);
        state.lastScrollY = y;
        state.scrollDirection = 1;
        state.scrollTravel = 0;
        return;
      }
      if (performance.now() < state.manualIslandUntil) {
        state.lastScrollY = y;
        state.scrollTravel = 0;
        return;
      }
      if (Math.abs(delta) < 2) { state.lastScrollY = y; return; }
      const direction = delta > 0 ? 1 : -1;
      const visibleDirection = document.body.classList.contains('nx47-discovery-scroll-down') ? 1 : document.body.classList.contains('nx47-discovery-scroll-up') ? -1 : 0;
      if (visibleDirection && direction !== visibleDirection && performance.now() < state.scrollLockUntil) {
        state.lastScrollY = y;
        state.scrollDirection = visibleDirection;
        state.scrollTravel = 0;
        return;
      }
      if (direction !== state.scrollDirection) {
        state.scrollDirection = direction;
        state.scrollTravel = 0;
      }
      state.scrollTravel += Math.abs(delta);
      state.lastScrollY = y;
      if (direction > 0 && y > 118 && state.scrollTravel >= 20) {
        document.body.classList.add('nx47-discovery-scroll-down');
        document.body.classList.remove('nx47-discovery-scroll-up');
        setIslandState(true, false);
        state.scrollLockUntil = performance.now() + (matchMedia('(prefers-reduced-motion: reduce)').matches ? 40 : 380);
      } else if (direction < 0 && state.scrollTravel >= 12) {
        document.body.classList.add('nx47-discovery-scroll-up');
        document.body.classList.remove('nx47-discovery-scroll-down');
        setIslandState(true, true);
        state.scrollLockUntil = performance.now() + (matchMedia('(prefers-reduced-motion: reduce)').matches ? 40 : 380);
      }
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

  function providerTabsMarkup() {
    return PROVIDERS.map(provider => {
      const selected = state.provider === provider.key;
      return `<button type="button" class="nx47-provider-tab${selected ? ' active' : ''}" data-nx47-provider="${provider.key}" data-nx47-provider-compact aria-pressed="${selected}" style="--nx47-provider:${provider.color}">
        <span data-provider="${provider.key}">${providerMark(provider, true)}</span><strong>${esc(provider.name)}</strong>
      </button>`;
    }).join('');
  }

  function bindProviderControls() {
    document.querySelectorAll('[data-nx47-provider]').forEach(button => button.addEventListener('click', () => {
      const compact = button.hasAttribute('data-nx47-provider-compact');
      selectProvider(button.dataset.nx47Provider, !compact);
      if (compact) setIslandState(true, false);
    }));
  }

  function renderProviderCards() {
    const root = document.querySelector('#nx47Providers');
    if (root) root.innerHTML = providerCardsMarkup();
    document.querySelectorAll('[data-nx47-provider-rail]').forEach(rail => { rail.innerHTML = providerTabsMarkup(); });
    bindProviderControls();
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

  function dubbedControlsMarkup(compact = false) {
    return `<div class="nx47-dubbed-controls${compact ? ' is-compact' : ''}">
      <div class="nx47-segmented" role="group" aria-label="Filtrar animes dublados por formato">
        ${[['ALL', 'Todos'], ['TV', 'Séries'], ['MOVIE', 'Filmes']].map(([key, label]) => `<button type="button" data-nx47-dub-mode="${key}" class="${state.dubbedMode === key ? 'active' : ''}" aria-pressed="${state.dubbedMode === key}">${label}</button>`).join('')}
      </div>
      <label class="nx47-search">${ICON.search}<span class="sr-only">Buscar nos animes dublados desta página</span><input type="search" maxlength="90" data-nx47-dub-search placeholder="Buscar nesta página..." value="${esc(state.dubbedSearch)}"><button type="button" data-nx47-search-clear aria-label="Limpar busca"${state.dubbedSearch ? '' : ' hidden'}>${ICON.close}</button></label>
    </div>`;
  }

  function renderDubbedControls() {
    document.querySelectorAll('[data-nx47-dub-controls-host]').forEach(host => {
      host.innerHTML = dubbedControlsMarkup(Boolean(host.closest('.nx47-island')));
    });
    bindDubbedControls();
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
    const pagination = document.querySelector('#nx47DubbedPagination');
    const count = document.querySelector('#nx47DubbedCount');
    if (!root || !pagination || !count) return;
    const items = visibleDubbedItems();
    const total = Number(state.dubbedInfo.total || state.dubbedItems.length);
    count.textContent = total ? `${total.toLocaleString('pt-BR')} ${total === 1 ? 'título confirmado' : 'títulos confirmados'}` : '';
    root.removeAttribute('aria-busy');
    root.innerHTML = items.length
      ? `<div class="nx47-media-grid">${items.map(media => mediaCard(media, 'Dublado')).join('')}</div>`
      : emptyMarkup('Nenhum título encontrado', state.dubbedSearch || state.dubbedMode !== 'ALL' ? 'Limpe a busca ou altere o formato.' : 'A curadoria está atualizando esta página.');
    pagination.innerHTML = dubbedPaginationMarkup();
    renderDubbedControls();
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
      <section class="nx47-catalog-section nx47-dubbed-section" aria-label="Catálogo de animes dublados">
        <div id="nx47DubbedControls" data-nx47-dub-controls-host>${dubbedControlsMarkup()}</div>
        <div class="nx47-dubbed-meta"><span id="nx47DubbedCount">Consultando catálogo</span></div>
        <div id="nx47DubbedResults" aria-live="polite" aria-busy="true">${skeletons(12)}</div>
        <div id="nx47DubbedPagination"></div>
      </section>
    </div></div>`;
  }

  function studioControlsMarkup(compact = false) {
    return `<div class="nx47-studio-controls${compact ? ' is-compact' : ''}">
      <label class="nx47-search nx47-studio-search">${ICON.search}<span class="sr-only">Buscar estúdio</span><input type="search" maxlength="90" data-nx47-studio-search placeholder="Buscar estúdio..." value="${esc(state.studioSearch)}"><button type="button" data-nx47-studio-clear aria-label="Limpar busca de estúdios"${state.studioSearch ? '' : ' hidden'}>${ICON.close}</button></label>
    </div>`;
  }

  function renderStudioControls() {
    document.querySelectorAll('[data-nx47-studio-controls-host]').forEach(host => {
      host.innerHTML = studioControlsMarkup(Boolean(host.closest('.nx47-island')));
    });
    bindStudioControls();
  }

  function studioSkeletons() {
    return `<div class="nx47-studio-loading">${Array.from({ length: 3 }, () => `<section><header><i></i><span></span></header>${skeletons(6)}</section>`).join('')}</div>`;
  }

  function studioBlockMarkup(studio) {
    const media = (studio.media || []).map(normalizeMedia).filter(Boolean);
    const total = Math.max(media.length, Number(studio.mediaTotal || 0));
    const label = total > media.length ? `${media.length} de ${total.toLocaleString('pt-BR')} produções` : `${media.length} ${media.length === 1 ? 'produção' : 'produções'}`;
    return `<section class="nx47-studio-block" aria-labelledby="nx47Studio${Number(studio.id)}">
      <header class="nx47-studio-head">
        <div><small>ESTÚDIO</small><h2 id="nx47Studio${Number(studio.id)}">${esc(studio.name)}</h2><p>${esc(label)} em destaque</p></div>
        <div class="nx47-rail-actions" aria-label="Navegar pelas produções de ${esc(studio.name)}">
          <button type="button" data-nx47-studio-dir="prev" aria-label="Produções anteriores">${ICON.left}</button>
          <button type="button" data-nx47-studio-dir="next" aria-label="Próximas produções">${ICON.right}</button>
        </div>
      </header>
      <div class="nx47-studio-rail-wrap"><div class="nx47-studio-rail" data-nx47-studio-rail-list tabindex="0" aria-label="Produções de ${esc(studio.name)}">${media.map(item => mediaCard(item)).join('')}</div></div>
    </section>`;
  }

  function visibleStudios() {
    const query = state.studioSearch.trim().toLocaleLowerCase('pt-BR');
    return state.studioItems.filter(studio => !query || String(studio.name || '').toLocaleLowerCase('pt-BR').includes(query));
  }

  function setupStudioRails() {
    state.studioRailObservers.forEach(observer => observer.disconnect());
    state.studioRailObservers = [];
    document.querySelectorAll('[data-nx47-studio-rail-list]').forEach(rail => {
      const block = rail.closest('.nx47-studio-block');
      const previous = block?.querySelector('[data-nx47-studio-dir="prev"]');
      const next = block?.querySelector('[data-nx47-studio-dir="next"]');
      const update = () => {
        const overflow = rail.scrollWidth > rail.clientWidth + 3;
        block?.classList.toggle('has-overflow', overflow);
        if (previous) previous.disabled = !overflow || rail.scrollLeft <= 2;
        if (next) next.disabled = !overflow || rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 2;
      };
      const move = direction => rail.scrollBy({ left: direction * Math.max(260, rail.clientWidth * .82), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      previous?.addEventListener('click', () => move(-1));
      next?.addEventListener('click', () => move(1));
      rail.addEventListener('scroll', update, { passive: true });
      if ('ResizeObserver' in window) {
        const observer = new ResizeObserver(update);
        observer.observe(rail);
        state.studioRailObservers.push(observer);
      }
      requestAnimationFrame(update);
    });
  }

  function renderStudioRows() {
    const root = document.querySelector('#nx47StudioResults');
    const count = document.querySelector('#nx47StudioCount');
    const more = document.querySelector('#nx47StudioMore');
    if (!root || !count || !more) return;
    const items = visibleStudios();
    count.textContent = `${state.studioItems.length.toLocaleString('pt-BR')} ${state.studioItems.length === 1 ? 'estúdio carregado' : 'estúdios carregados'}`;
    root.removeAttribute('aria-busy');
    root.innerHTML = items.length
      ? items.map(studioBlockMarkup).join('')
      : emptyMarkup('Nenhum estúdio encontrado', 'Tente outro nome ou limpe a busca.');
    more.innerHTML = !state.studioSearch && state.studioInfo.hasNextPage
      ? `<button type="button" data-nx47-studio-more>${ICON.plus}<span>Carregar mais estúdios</span></button>`
      : '';
    more.querySelector('[data-nx47-studio-more]')?.addEventListener('click', () => loadStudios(state.studioPage + 1, true));
    bindMediaCards(root);
    setupStudioRails();
    window.AniNexusMediaActions?.neutralize?.(root);
    updateContext(`${state.studioItems.length} ESTÚDIOS CARREGADOS`);
  }

  function renderStudioResults() {
    renderStudioControls();
    renderStudioRows();
  }

  async function fetchStudios(page, signal) {
    try {
      return await apiJson(`/api/studios?page=${page}`, signal);
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      return directStudios(page, signal);
    }
  }

  async function loadStudios(page = 1, append = false) {
    const token = ++state.token;
    state.controller?.abort();
    state.controller = new AbortController();
    const root = document.querySelector('#nx47StudioResults');
    const moreButton = document.querySelector('[data-nx47-studio-more]');
    if (!append && root) {
      root.setAttribute('aria-busy', 'true');
      root.innerHTML = studioSkeletons();
    }
    if (moreButton) {
      moreButton.disabled = true;
      moreButton.querySelector('span').textContent = 'Carregando estúdios...';
    }
    try {
      const data = await fetchStudios(page, state.controller.signal);
      if (token !== state.token) return;
      const incoming = (data?.items || []).map(studio => ({
        ...studio,
        id: Number(studio.id),
        mediaTotal: Number(studio.mediaTotal || studio.media?.length || 0),
        media: (studio.media || []).map(normalizeMedia).filter(Boolean)
      })).filter(studio => studio.id && studio.name && studio.media.length);
      const merged = new Map((append ? state.studioItems : []).map(studio => [studio.id, studio]));
      incoming.forEach(studio => merged.set(studio.id, studio));
      state.studioItems = [...merged.values()];
      state.studioInfo = data?.pageInfo || {};
      state.studioPage = Math.max(1, Number(data?.pageInfo?.currentPage || page));
      renderStudioResults();
    } catch (error) {
      if (error?.name === 'AbortError' || token !== state.token) return;
      if (root && !state.studioItems.length) {
        root.removeAttribute('aria-busy');
        root.innerHTML = emptyMarkup('Os estúdios não carregaram agora', 'Tente novamente em instantes.', `<button type="button" data-nx47-studio-retry>${ICON.retry} Tentar novamente</button>`);
      } else {
        renderStudioRows();
      }
    }
  }

  function studiosMarkup() {
    return `${heroMarkup('studios')}${islandMarkup('studios')}<div class="nx47-content nx47-studios-content"><div class="shell">
      <section class="nx47-studios-section" aria-labelledby="nx47StudiosTitle">
        <header class="nx47-section-head nx47-studios-directory-head"><div><small>CASAS DE ANIMAÇÃO</small><h2 id="nx47StudiosTitle">Explore por estúdio</h2><p>Deslize cada fileira para descobrir mais produções da mesma casa.</p></div><span id="nx47StudioCount">Consultando estúdios</span></header>
        <div id="nx47StudioControls" data-nx47-studio-controls-host>${studioControlsMarkup()}</div>
        <div id="nx47StudioResults" aria-live="polite" aria-busy="true">${studioSkeletons()}</div>
        <div class="nx47-studio-more" id="nx47StudioMore"></div>
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
    document.querySelectorAll('[data-nx47-dub-search]').forEach(input => input.addEventListener('input', () => {
      state.dubbedSearch = input.value.slice(0, 90);
      document.querySelectorAll('[data-nx47-dub-search]').forEach(peer => { if (peer !== input) peer.value = state.dubbedSearch; });
      document.querySelectorAll('[data-nx47-search-clear]').forEach(clear => { clear.hidden = !state.dubbedSearch; });
      const items = visibleDubbedItems();
      const root = document.querySelector('#nx47DubbedResults');
      if (root) {
        root.innerHTML = items.length ? `<div class="nx47-media-grid">${items.map(media => mediaCard(media, 'Dublado')).join('')}</div>` : emptyMarkup('Nenhum título encontrado', 'Limpe a busca ou altere o formato.');
        bindMediaCards(root);
        window.AniNexusMediaActions?.neutralize?.(root);
      }
    }));
    document.querySelectorAll('[data-nx47-search-clear]').forEach(clear => clear.addEventListener('click', () => {
      state.dubbedSearch = '';
      renderDubbedResults();
      document.querySelector('[data-nx47-dub-search]')?.focus();
    }));
    document.querySelectorAll('[data-nx47-dub-page]').forEach(button => button.addEventListener('click', () => {
      if (button.disabled) return;
      state.dubbedSearch = '';
      loadDubbed(Number(button.dataset.nx47DubPage));
      document.querySelector('.nx47-dubbed-section')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }));
  }

  function bindStudioControls() {
    document.querySelectorAll('[data-nx47-studio-search]').forEach(input => input.addEventListener('input', () => {
      state.studioSearch = input.value.slice(0, 90);
      document.querySelectorAll('[data-nx47-studio-search]').forEach(peer => { if (peer !== input) peer.value = state.studioSearch; });
      document.querySelectorAll('[data-nx47-studio-clear]').forEach(clear => { clear.hidden = !state.studioSearch; });
      renderStudioRows();
    }));
    document.querySelectorAll('[data-nx47-studio-clear]').forEach(clear => clear.addEventListener('click', () => {
      state.studioSearch = '';
      renderStudioResults();
      document.querySelector('[data-nx47-studio-search]')?.focus();
    }));
  }

  function navigate(path) {
    cleanup();
    if (IS_PAGES) location.assign(`${BASE}/?build=${BUILD}&p=${encodeURIComponent(path)}`);
    else location.assign(path);
  }

  function bindCommon() {
    document.querySelector('[data-nx47-island-toggle]')?.addEventListener('click', () => {
      const island = document.querySelector('.nx47-island');
      const y = scrollY;
      state.manualIslandUntil = performance.now() + 520;
      setIslandState(true, !island?.classList.contains('expanded'));
      requestAnimationFrame(() => { if (Math.abs(scrollY - y) > 1) scrollTo(0, y); });
    });
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
    state.studioItems = [];
    state.studioInfo = {};
    state.studioPage = 1;
    state.studioSearch = '';
    state.studioRailObservers.forEach(observer => observer.disconnect());
    state.studioRailObservers = [];
    state.lastScrollY = 0;
    state.scrollDirection = 0;
    state.scrollTravel = 0;
    state.scrollLockUntil = 0;
    state.manualIslandUntil = 0;
    document.body.classList.remove('nx21-catalog', 'nx21-reading-catalog', 'nx-section-page', 'nx-scroll-down', 'nx-scroll-up');
    document.body.classList.add('nx47-discovery-active');
    document.body.classList.toggle('nx47-watch-active', path.endsWith('onde-assistir'));
    document.body.classList.toggle('nx47-dubbed-active', path.endsWith('dublados'));
    document.body.classList.toggle('nx47-studios-active', path.endsWith('estudios'));
    document.body.classList.remove('nx47-discovery-scrolled', 'nx47-discovery-scroll-down', 'nx47-discovery-scroll-up');
    scrollTo(0, 0);
    const kind = path.endsWith('onde-assistir') ? 'watch' : path.endsWith('dublados') ? 'dubbed' : 'studios';
    document.title = `${kind === 'watch' ? 'Onde assistir animes' : kind === 'dubbed' ? 'Animes dublados' : 'Estúdios de anime'} | AniNexus`;
    app.innerHTML = `<main class="nx47-discovery-page nx47-${kind}-page">${kind === 'watch' ? watchMarkup() : kind === 'dubbed' ? dubbedMarkup() : studiosMarkup()}</main>`;
    bindCommon();
    if (kind === 'watch') {
      renderProviderCards();
      loadWatch();
    } else if (kind === 'dubbed') {
      renderDubbedControls();
      loadDubbed(1);
    } else {
      renderStudioControls();
      loadStudios(1);
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
    state.studioRailObservers.forEach(observer => observer.disconnect());
    state.studioRailObservers = [];
    document.body.classList.remove('nx47-discovery-active', 'nx47-watch-active', 'nx47-dubbed-active', 'nx47-studios-active', 'nx47-discovery-scrolled', 'nx47-discovery-scroll-down', 'nx47-discovery-scroll-up');
  }

  addEventListener('scroll', syncScroll, { passive: true });
  addEventListener('popstate', () => queueMicrotask(() => ROUTES.has(route()) ? mount(route()) : cleanup()));
  document.addEventListener('click', event => {
    if (event.target.closest('[data-nx47-watch-retry]')) loadWatch();
    if (event.target.closest('[data-nx47-dub-retry]')) loadDubbed(state.dubbedPage);
    if (event.target.closest('[data-nx47-studio-retry]')) loadStudios(1);
  });

  window.AniNexusDiscovery = Object.freeze({ mount, cleanup, build: BUILD });
  if (ROUTES.has(route())) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => mount(route()), { once: true });
    else mount(route());
  }
})();
