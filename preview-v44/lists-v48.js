'use strict';
(() => {
  if (window.__ANINEXUS_LISTS_V48__) return;
  window.__ANINEXUS_LISTS_V48__ = true;

  const app = document.querySelector('#app');
  if (!app) return;

  const BUILD = '44.28.4';
  const IS_PAGES = location.hostname.endsWith('github.io');
  const BASE = IS_PAGES ? '/AniNexus' : '';
  const HUB_PATH = '/listas-de-animes';
  const ICON = {
    trophy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v4a4 4 0 0 1-8 0V4Z"/><path d="M8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 12v5M8 21h8M9 17h6"/></svg>',
    fire: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 3.5c.8 3.8-2.2 4.6-2.2 7.2 0 1.3.8 2.2 1.9 2.2 1.8 0 2.8-1.8 2.3-4 2.4 1.7 3.8 4 3.5 6.4-.4 3.5-3.2 5.7-7 5.7-4 0-7-2.6-7-6.3 0-3 1.8-5.5 4.8-7.8-.1 2.2.7 3.5 1.8 3.7-.3-2.9.4-5.3 1.9-7.1Z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>',
    collection: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="6" height="6" rx="1"/><rect x="14" y="5" width="6" height="6" rx="1"/><rect x="4" y="15" width="6" height="4" rx="1"/><rect x="14" y="15" width="6" height="4" rx="1"/></svg>',
    sparkle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3ZM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M14 7.5 18.5 12 14 16.5"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>',
    left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
    right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 8.8c0 5-8.5 10-8.5 10s-8.5-5-8.5-10A4.6 4.6 0 0 1 12 6.4a4.6 4.6 0 0 1 8.5 2.4Z"/></svg>',
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.5 6.1.9-4.4 4.3 1 6.1-5.5-2.9-5.5 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/></svg>',
    retry: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 0-2 5"/></svg>'
  };

  const LISTS = {
    '/melhores-animes-para-assistir': { slug: 'melhores-animes-para-assistir', title: '<em>Melhores animes</em> para assistir', plainTitle: 'Melhores animes para assistir', shortTitle: 'Melhores animes', kicker: 'RANKING DA COMUNIDADE', description: 'Os títulos mais bem avaliados pelos membros do AniNexus.', context: 'MELHORES AVALIAÇÕES', icon: 'trophy', sort: 'SCORE_DESC' },
    '/animes-mais-assistidos': { slug: 'animes-mais-assistidos', title: 'Animes <em>mais assistidos</em>', plainTitle: 'Animes mais assistidos', shortTitle: 'Mais assistidos', kicker: 'MAIS ACOMPANHADOS', description: 'As obras com maior atividade entre os membros do AniNexus.', context: 'MAIOR ATIVIDADE', icon: 'fire', sort: 'POPULARITY_DESC' },
    '/animes-mais-aguardados': { slug: 'animes-mais-aguardados', title: 'Animes <em>mais aguardados</em>', plainTitle: 'Animes mais aguardados', shortTitle: 'Mais aguardados', kicker: 'PRÓXIMAS ESTREIAS', description: 'Lançamentos e retornos que já estão no radar da comunidade.', context: 'EM BREVE', icon: 'clock', sort: 'POPULARITY_DESC', status: 'NOT_YET_RELEASED' },
    '/animes-em-alta': { slug: 'animes-em-alta', title: 'Animes <em>em alta</em>', plainTitle: 'Animes em alta agora', shortTitle: 'Em alta', kicker: 'AGORA NO ANINEXUS', description: 'Obras que estão ganhando atenção e conversa neste momento.', context: 'EM ALTA AGORA', icon: 'fire', sort: 'TRENDING_DESC' },
    '/filmes-de-anime': { slug: 'filmes-de-anime', title: '<em>Filmes</em> de anime', plainTitle: 'Filmes de anime', shortTitle: 'Filmes', kicker: 'SELEÇÃO DE LONGAS', description: 'Histórias completas para assistir em uma sessão.', context: 'FILMES', icon: 'collection', sort: 'SCORE_DESC', format: 'MOVIE' },
    '/animes-curtos': { slug: 'animes-curtos', title: '<em>Animes curtos</em> para começar', plainTitle: 'Animes curtos para começar', shortTitle: 'Animes curtos', kicker: 'BOAS PORTAS DE ENTRADA', description: 'Temporadas compactas para descobrir novas histórias.', context: 'SÉRIES CURTAS', icon: 'collection', sort: 'POPULARITY_DESC', format: 'TV_SHORT' },
    '/animes-de-acao': { slug: 'animes-de-acao', title: 'Animes de <em>ação</em>', plainTitle: 'Animes de ação', shortTitle: 'Ação', kicker: 'LISTA POR GÊNERO', description: 'Combates, aventura e histórias de alta energia.', context: 'GÊNERO AÇÃO', icon: 'sparkle', sort: 'SCORE_DESC', genre: 'Action' },
    '/animes-de-romance': { slug: 'animes-de-romance', title: 'Animes de <em>romance</em>', plainTitle: 'Animes de romance', shortTitle: 'Romance', kicker: 'LISTA POR GÊNERO', description: 'Relações marcantes e histórias emocionais.', context: 'GÊNERO ROMANCE', icon: 'sparkle', sort: 'SCORE_DESC', genre: 'Romance' },
    '/animes-de-fantasia': { slug: 'animes-de-fantasia', title: 'Animes de <em>fantasia</em>', plainTitle: 'Animes de fantasia', shortTitle: 'Fantasia', kicker: 'LISTA POR GÊNERO', description: 'Mundos imaginários, magia e grandes jornadas.', context: 'GÊNERO FANTASIA', icon: 'sparkle', sort: 'SCORE_DESC', genre: 'Fantasy' },
    '/animes-de-comedia': { slug: 'animes-de-comedia', title: 'Animes de <em>comédia</em>', plainTitle: 'Animes de comédia', shortTitle: 'Comédia', kicker: 'LISTA POR GÊNERO', description: 'Títulos leves, excêntricos e feitos para rir.', context: 'GÊNERO COMÉDIA', icon: 'sparkle', sort: 'SCORE_DESC', genre: 'Comedy' },
    '/animes-de-misterio': { slug: 'animes-de-misterio', title: 'Animes de <em>mistério</em>', plainTitle: 'Animes de mistério', shortTitle: 'Mistério', kicker: 'LISTA POR GÊNERO', description: 'Segredos, investigação e histórias que pedem atenção.', context: 'GÊNERO MISTÉRIO', icon: 'sparkle', sort: 'SCORE_DESC', genre: 'Mystery' },
    '/animes-de-esporte': { slug: 'animes-de-esporte', title: 'Animes de <em>esporte</em>', plainTitle: 'Animes de esporte', shortTitle: 'Esporte', kicker: 'LISTA POR GÊNERO', description: 'Competição, evolução pessoal e espírito de equipe.', context: 'GÊNERO ESPORTE', icon: 'sparkle', sort: 'SCORE_DESC', genre: 'Sports' },
    '/animes-de-terror': { slug: 'animes-de-terror', title: 'Animes de <em>terror</em>', plainTitle: 'Animes de terror', shortTitle: 'Terror', kicker: 'LISTA POR GÊNERO', description: 'Suspense, horror psicológico e histórias sombrias.', context: 'GÊNERO TERROR', icon: 'sparkle', sort: 'SCORE_DESC', genre: 'Horror' }
  };
  const PRIMARY_TABS = [
    ['/melhores-animes-para-assistir', 'Melhores'],
    ['/animes-mais-assistidos', 'Mais assistidos'],
    ['/animes-mais-aguardados', 'Mais aguardados'],
    [HUB_PATH, 'Todas as listas']
  ];
  const ROUTES = new Set([HUB_PATH, ...Object.keys(LISTS)]);
  const HUB_COPY = { title: '<em>Listas</em> de animes', plainTitle: 'Listas de animes', kicker: 'DESCUBRA SUA PRÓXIMA OBRA', description: 'Rankings e seleções organizados para encontrar o próximo anime.', context: 'TODAS AS LISTAS', icon: 'collection' };
  const state = { path: '', page: 1, pageInfo: {}, token: 0, controller: null, frame: 0, lastY: 0, direction: 0, travel: 0, lockUntil: 0, manualUntil: 0, toggleY: null, scrollHold: 0 };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const slug = value => String(value || 'anime').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 90) || 'anime';
  const titleOf = media => media?.title?.english || media?.title?.userPreferred || media?.title?.romaji || media?.title?.native || media?.title || media?.titleRomaji || 'Anime';
  const imageOf = media => media?.coverImage?.extraLarge || media?.coverImage?.large || media?.cover || `${BASE}/assets/logo.png`;
  const yearOf = media => Number(media?.seasonYear || media?.startDate?.year) || null;
  const formatOf = media => ({ TV: 'Série', TV_SHORT: 'Série curta', MOVIE: 'Filme', OVA: 'OVA', ONA: 'ONA', SPECIAL: 'Especial' })[String(media?.format || '').toUpperCase()] || 'Anime';
  const scoreOf = media => {
    if (media?.metricsSource !== 'aninexus' || Number(media?.ratingCount || 0) <= 0) return '';
    const score = Number(media?.averageScore) ? Number(media.averageScore) / 10 : Number(media?.score);
    return Number.isFinite(score) && score > 0 ? score.toFixed(1).replace('.0', '') : '';
  };

  function route() {
    const url = new URL(location.href), restored = url.searchParams.get('p');
    if (restored) return restored.split('?')[0].replace(/\/+$/, '') || '/';
    let path = url.pathname;
    if (IS_PAGES) path = path.replace(/^\/AniNexus/, '') || '/';
    return path.replace(/\/+$/, '') || '/';
  }

  function href(path) {
    return IS_PAGES ? `${BASE}/?build=${BUILD}&p=${encodeURIComponent(path)}` : path;
  }

  function normalizeMedia(media) {
    if (!media || typeof media !== 'object' || !Number(media.id)) return null;
    if (media.coverImage && typeof media.title === 'object') return media;
    return { ...media, title: { english: media.title || '', romaji: media.titleRomaji || media.title || '', native: media.titleNative || '' }, coverImage: { extraLarge: media.cover || '', large: media.cover || '' }, seasonYear: media.seasonYear || media.startDate?.year || null };
  }

  async function apiJson(path, signal) {
    if (IS_PAGES && window.AniNexusAuth?.enabled) return window.AniNexusAuth.publicApi(path, { signal, timeout: 15000 });
    if (IS_PAGES) throw new Error('API_NOT_CONFIGURED');
    const response = await fetch(path, { signal, credentials: 'same-origin', headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async function directList(config, page, signal) {
    const query = `query($page:Int,$sort:[MediaSort],$status:MediaStatus,$format:MediaFormat,$genre:String){Page(page:$page,perPage:24){pageInfo{total currentPage lastPage hasNextPage} media(type:ANIME,isAdult:false,status:$status,format:$format,genre:$genre,sort:$sort){id title{romaji english native userPreferred} coverImage{extraLarge large} episodes format status seasonYear startDate{year month day}}}}`;
    const variables = { page, sort: [config.sort] };
    if (config.status) variables.status = config.status;
    if (config.format) variables.format = config.format;
    if (config.genre) variables.genre = config.genre;
    const response = await fetch('https://graphql.anilist.co/', { method: 'POST', signal, headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ query, variables }) });
    if (!response.ok) throw new Error(`AniList HTTP ${response.status}`);
    const json = await response.json();
    if (json.errors?.length) throw new Error(json.errors[0].message || 'AniList error');
    return { items: json.data?.Page?.media || [], pageInfo: json.data?.Page?.pageInfo || {} };
  }

  function currentCopy() {
    return state.path === HUB_PATH ? HUB_COPY : LISTS[state.path] || HUB_COPY;
  }

  function navMarkup(compact = false) {
    const active = PRIMARY_TABS.some(([path]) => path === state.path) ? state.path : HUB_PATH;
    return `<nav class="nx48-list-tabs${compact ? ' is-compact' : ''}" aria-label="Listas de anime">${PRIMARY_TABS.map(([path, label]) => `<a href="${href(path)}" data-nx48-nav="${path}" class="${active === path ? 'active' : ''}"${active === path ? ' aria-current="page"' : ''}>${esc(label)}</a>`).join('')}</nav>`;
  }

  function heroMarkup() {
    const copy = currentCopy();
    return `<header class="nx48-list-chrome" id="nx48ListHero"><div class="nx48-list-intro"><div class="nx48-list-title-row"><span>${ICON[copy.icon]}</span><div><h1>${copy.title}</h1><small>${copy.kicker}</small></div></div><p>${copy.description}</p></div><div class="nx48-list-nav-band">${navMarkup()}</div></header>`;
  }

  function islandMarkup() {
    const copy = currentCopy();
    return `<section class="nx48-list-island" aria-label="Opções da lista" aria-hidden="true" inert><button type="button" class="nx48-list-island-head" data-nx48-island-toggle aria-label="Abrir opções da lista" aria-expanded="false"><span class="nx48-list-island-icon">${ICON[copy.icon]}</span><span class="nx48-list-island-copy"><strong>${copy.plainTitle}</strong><small data-nx48-context>${copy.context}</small></span><span class="nx48-list-island-arrow">${ICON.down}</span></button><div class="nx48-list-island-panel" aria-hidden="true" inert><div><div class="nx48-list-island-inner">${navMarkup(true)}</div></div></div></section>`;
  }

  function skeletons(count = 10) {
    return `<div class="nx48-list-grid nx48-list-loading">${Array.from({ length: count }, () => '<div class="nx48-list-skeleton"><i></i><span></span><small></small></div>').join('')}</div>`;
  }

  function mediaCard(media, index) {
    const title = titleOf(media), score = scoreOf(media), year = yearOf(media);
    return `<article class="nx21-card nx48-list-media visible" data-nx21-open="${Number(media.id)}" data-nx-media="${Number(media.id)}" data-kind="anime" data-title="${esc(title)}" tabindex="0" aria-label="Abrir ${esc(title)}"><div class="nx21-poster"><img src="${esc(imageOf(media))}" loading="lazy" decoding="async" alt="${esc(title)}"><div class="nx21-shade"></div><span class="nx48-list-rank">${String(index).padStart(2, '0')}</span>${score ? `<span class="nx21-score">${ICON.star}<b>${score}</b></span>` : ''}<div class="nx21-actions"><button type="button" data-list="${Number(media.id)}" aria-label="Adicionar ${esc(title)} à lista">${ICON.plus}</button><button type="button" data-fav="${Number(media.id)}" aria-label="Favoritar ${esc(title)}">${ICON.heart}</button></div></div><h3>${esc(title)}</h3><p>${esc([formatOf(media), year].filter(Boolean).join(' · '))}</p></article>`;
  }

  function emptyMarkup(title, text, action = '') {
    return `<div class="nx48-list-empty"><span>${ICON.collection}</span><strong>${esc(title)}</strong><p>${esc(text)}</p>${action}</div>`;
  }

  function resultsMarkup() {
    return `<div class="nx48-list-content" id="nx48ListContent"><div class="shell"><div class="nx48-list-status"><span id="nx48ListCount">Consultando seleção</span></div><div id="nx48ListResults" aria-live="polite" aria-busy="true">${skeletons(10)}</div><div id="nx48ListPagination"></div></div></div>`;
  }

  function hubMarkup() {
    return `<div class="nx48-list-content nx48-list-hub-content" id="nx48ListContent"><div class="shell"><div id="nx48ListHub" aria-live="polite" aria-busy="true"><div class="nx48-list-hub-skeleton"></div></div></div></div>`;
  }

  function bindCards(root) {
    root.querySelectorAll('.nx48-list-media').forEach(card => {
      const open = () => {
        const id = Number(card.dataset.nx21Open || 0);
        if (id) navigate(`/anime/${slug(card.dataset.title)}-${id}`);
      };
      card.addEventListener('click', event => { if (!event.target.closest('button,a')) open(); });
      card.addEventListener('keydown', event => { if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('button,a')) { event.preventDefault(); open(); } });
      const image = card.querySelector('img');
      image?.addEventListener('error', () => { image.src = `${BASE}/assets/logo.png`; image.classList.add('nx48-list-image-fallback'); }, { once: true });
    });
    window.AniNexusMediaActions?.neutralize?.(root);
  }

  function paginationMarkup() {
    const current = Math.max(1, Number(state.pageInfo.currentPage || state.page)), last = Math.max(1, Number(state.pageInfo.lastPage || current));
    if (last <= 1) return '';
    return `<nav class="nx48-list-pagination" aria-label="Paginação da lista"><button type="button" data-nx48-page="${current - 1}"${current <= 1 ? ' disabled' : ''} aria-label="Página anterior">${ICON.left}</button><span>Página <strong>${current}</strong> de ${last}</span><button type="button" data-nx48-page="${current + 1}"${current >= last ? ' disabled' : ''} aria-label="Próxima página">${ICON.right}</button></nav>`;
  }

  function bindPagination() {
    document.querySelectorAll('[data-nx48-page]').forEach(button => button.addEventListener('click', () => {
      if (button.disabled) return;
      loadList(Number(button.dataset.nx48Page));
      document.querySelector('#nx48ListContent')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }));
  }

  async function loadList(page = 1) {
    const config = LISTS[state.path], root = document.querySelector('#nx48ListResults'), count = document.querySelector('#nx48ListCount'), pagination = document.querySelector('#nx48ListPagination');
    if (!config || !root || !count || !pagination) return;
    const token = ++state.token;
    state.controller?.abort();
    state.controller = new AbortController();
    state.page = Math.max(1, page);
    root.setAttribute('aria-busy', 'true');
    root.innerHTML = skeletons(10);
    count.textContent = 'Consultando seleção';
    pagination.innerHTML = '';
    try {
      let data;
      try { data = await apiJson(`/api/list/${encodeURIComponent(config.slug)}?page=${state.page}`, state.controller.signal); }
      catch (error) { if (error?.name === 'AbortError') throw error; data = await directList(config, state.page, state.controller.signal); }
      if (token !== state.token) return;
      const items = (data?.items || []).map(normalizeMedia).filter(Boolean);
      state.pageInfo = data?.pageInfo || {};
      const total = Number(state.pageInfo.total || items.length), start = (state.page - 1) * 24;
      count.textContent = `${total.toLocaleString('pt-BR')} ${total === 1 ? 'título' : 'títulos'}`;
      document.querySelector('[data-nx48-context]').textContent = `PÁGINA ${state.page} · ${total.toLocaleString('pt-BR')} TÍTULOS`;
      root.removeAttribute('aria-busy');
      root.innerHTML = items.length ? `<div class="nx48-list-grid">${items.map((media, index) => mediaCard(media, start + index + 1)).join('')}</div>` : emptyMarkup('Nenhum título nesta página', 'Tente outra página ou volte para todas as listas.');
      pagination.innerHTML = paginationMarkup();
      bindCards(root);
      bindPagination();
    } catch (error) {
      if (error?.name === 'AbortError' || token !== state.token) return;
      root.removeAttribute('aria-busy');
      count.textContent = 'Seleção indisponível';
      root.innerHTML = emptyMarkup('A lista não carregou agora', 'Tente novamente em instantes.', `<button type="button" data-nx48-retry>${ICON.retry} Tentar novamente</button>`);
    }
  }

  function groupLists(items) {
    return items.reduce((groups, item) => {
      const category = String(item.category || 'Coleções');
      (groups[category] ||= []).push(item);
      return groups;
    }, {});
  }

  function listCard(item) {
    const path = `/${String(item.slug || '').replace(/^\/+/, '')}`, config = LISTS[path], icon = config?.icon || 'sparkle';
    return `<a class="nx48-list-card" href="${href(path)}" data-nx48-nav="${path}"><span>${ICON[icon]}</span><div><small>${esc(item.category || 'COLEÇÃO')}</small><strong>${esc(item.title || config?.plainTitle || 'Lista de anime')}</strong><p>${esc(item.subtitle || config?.description || 'Uma seleção AniNexus para descobrir novas obras.')}</p></div><i>${ICON.arrow}</i></a>`;
  }

  function renderHub(items) {
    const root = document.querySelector('#nx48ListHub');
    if (!root) return;
    const groups = groupLists(items);
    root.removeAttribute('aria-busy');
    root.innerHTML = Object.entries(groups).map(([category, entries]) => `<section class="nx48-list-group" aria-labelledby="nx48Group${slug(category)}"><header><small>${esc(category)}</small><h2 id="nx48Group${slug(category)}">${category === 'Destaques' ? 'Comece pelos essenciais' : category === 'Formatos' ? 'Escolha pelo formato' : 'Explore por gênero'}</h2></header><div>${entries.map(listCard).join('')}</div></section>`).join('');
    bindNavigation(root);
  }

  async function loadHub() {
    const token = ++state.token;
    state.controller?.abort();
    state.controller = new AbortController();
    let items;
    try {
      const response = await apiJson('/api/lists', state.controller.signal);
      items = Array.isArray(response) ? response : response?.items;
    }
    catch (error) { if (error?.name === 'AbortError') return; }
    if (token !== state.token) return;
    const fallback = Object.values(LISTS).map(item => ({ slug: item.slug, title: item.plainTitle, subtitle: item.description, category: item.genre ? 'Gêneros' : item.format ? 'Formatos' : 'Destaques' }));
    renderHub(Array.isArray(items) && items.length ? items : fallback);
  }

  function setIsland(shown, expanded) {
    const island = document.querySelector('.nx48-list-island');
    if (!island) return;
    const open = Boolean(shown && expanded), panel = island.querySelector('.nx48-list-island-panel');
    island.classList.toggle('show', Boolean(shown));
    island.classList.toggle('expanded', open);
    island.inert = !shown;
    island.setAttribute('aria-hidden', String(!shown));
    panel.inert = !open;
    panel.setAttribute('aria-hidden', String(!open));
    island.querySelector('[data-nx48-island-toggle]')?.setAttribute('aria-expanded', String(open));
  }

  function holdScrollPosition(y) {
    const token = ++state.scrollHold, started = performance.now();
    const restore = () => {
      if (token !== state.scrollHold || !ROUTES.has(route())) return;
      if (Math.abs(scrollY - y) > 1) scrollTo({ top: y, left: 0, behavior: 'instant' });
      if (performance.now() - started < 360) requestAnimationFrame(restore);
      else state.lastY = y;
    };
    restore();
  }

  function syncScroll() {
    if (!ROUTES.has(route())) return cleanup();
    if (state.frame) return;
    state.frame = requestAnimationFrame(() => {
      state.frame = 0;
      const y = Math.max(0, scrollY), delta = y - state.lastY, headerHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nx43-header-height')) || 66;
      const shown = (document.querySelector('#nx48ListHero')?.getBoundingClientRect().bottom || Infinity) < headerHeight;
      document.body.classList.toggle('nx48-list-scrolled', shown);
      if (!shown) {
        document.body.classList.remove('nx48-list-scroll-down', 'nx48-list-scroll-up');
        setIsland(false, false);
        state.lastY = y; state.direction = 0; state.travel = 0;
        return;
      }
      const island = document.querySelector('.nx48-list-island');
      island?.classList.add('show'); island?.removeAttribute('inert'); island?.setAttribute('aria-hidden', 'false');
      if (performance.now() < state.manualUntil) { state.lastY = y; state.travel = 0; return; }
      if (Math.abs(delta) < 2) { state.lastY = y; return; }
      const direction = delta > 0 ? 1 : -1;
      if (direction !== state.direction) { state.direction = direction; state.travel = 0; }
      state.travel += Math.abs(delta); state.lastY = y;
      if (direction > 0 && state.travel >= 20) {
        document.body.classList.add('nx48-list-scroll-down'); document.body.classList.remove('nx48-list-scroll-up'); setIsland(true, false); state.lockUntil = performance.now() + 320;
      } else if (direction < 0 && state.travel >= 12 && performance.now() >= state.lockUntil) {
        document.body.classList.add('nx48-list-scroll-up'); document.body.classList.remove('nx48-list-scroll-down'); setIsland(true, true); state.lockUntil = performance.now() + 320;
      }
    });
  }

  function navigate(path) {
    cleanup();
    location.assign(href(path));
  }

  function bindNavigation(root = document) {
    root.querySelectorAll('[data-nx48-nav]').forEach(link => link.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      navigate(link.dataset.nx48Nav);
    }));
  }

  function bindCommon() {
    bindNavigation();
    const toggle = document.querySelector('[data-nx48-island-toggle]');
    toggle?.addEventListener('pointerdown', () => { state.toggleY = scrollY; }, { passive: true });
    toggle?.addEventListener('click', () => {
      const island = document.querySelector('.nx48-list-island'), y = Number.isFinite(state.toggleY) ? state.toggleY : scrollY;
      state.toggleY = null;
      state.manualUntil = performance.now() + 520;
      setIsland(true, !island?.classList.contains('expanded'));
      holdScrollPosition(y);
    });
    requestAnimationFrame(() => document.querySelector('.nx48-list-tabs:not(.is-compact) .active')?.scrollIntoView({ block: 'nearest', inline: 'center' }));
  }

  function mount(path = route()) {
    if (!ROUTES.has(path)) return cleanup();
    state.token += 1;
    state.controller?.abort();
    state.path = path; state.page = 1; state.pageInfo = {}; state.lastY = 0; state.direction = 0; state.travel = 0; state.lockUntil = 0; state.manualUntil = 0; state.toggleY = null; state.scrollHold += 1;
    document.body.classList.remove('nx21-catalog', 'nx21-reading-catalog', 'nx-section-page', 'nx-scroll-down', 'nx-scroll-up');
    document.body.classList.add('nx48-lists-active');
    document.body.classList.remove('nx48-list-scrolled', 'nx48-list-scroll-down', 'nx48-list-scroll-up');
    scrollTo(0, 0);
    const copy = currentCopy();
    document.title = `${copy.plainTitle} | AniNexus`;
    app.innerHTML = `<main class="nx48-lists-page">${heroMarkup()}${islandMarkup()}${path === HUB_PATH ? hubMarkup() : resultsMarkup()}</main>`;
    bindCommon();
    if (path === HUB_PATH) loadHub(); else loadList(1);
    document.documentElement.classList.remove('nx-dedicated-route-boot');
    window.dispatchEvent(new CustomEvent('aninexus:route-ready', { detail: { owner: 'lists', path } }));
    syncScroll();
  }

  function cleanup() {
    if (!state.path && !document.body.classList.contains('nx48-lists-active')) return;
    state.token += 1;
    state.controller?.abort();
    state.controller = null;
    state.scrollHold += 1;
    state.path = '';
    document.body.classList.remove('nx48-lists-active', 'nx48-list-scrolled', 'nx48-list-scroll-down', 'nx48-list-scroll-up');
  }

  addEventListener('scroll', syncScroll, { passive: true });
  addEventListener('popstate', () => queueMicrotask(() => ROUTES.has(route()) ? mount(route()) : cleanup()));
  document.addEventListener('click', event => { if (event.target.closest('[data-nx48-retry]')) loadList(state.page); });
  window.AniNexusLists = Object.freeze({ mount, cleanup, build: BUILD });
  if (ROUTES.has(route())) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => mount(route()), { once: true });
    else mount(route());
  }
})();
