(() => {
  'use strict';

  const CONFIG = Object.freeze({
    appName: 'AniNexus',
    timeZone: 'America/Sao_Paulo',
    locale: 'pt-BR',
    days: 7,
    refreshMs: 45_000,
    refreshOnFocusAfterMs: 25_000,
    anilistEndpoint: 'https://graphql.anilist.co',
    jikanEndpoint: 'https://api.jikan.moe/v4',
    cacheKey: 'aninexus.schedule.v1',
    favoritesKey: 'aninexus.favorites.v1',
    cacheMaxAgeMs: 12 * 60 * 60 * 1000,
  });

  const ANILIST_QUERY = `
    query AniNexusWeeklySchedule($page: Int!, $start: Int!, $end: Int!) {
      Page(page: $page, perPage: 50) {
        pageInfo { currentPage hasNextPage }
        airingSchedules(
          airingAt_greater: $start,
          airingAt_lesser: $end,
          sort: TIME
        ) {
          airingAt
          episode
          media {
            id
            idMal
            status
            format
            episodes
            duration
            averageScore
            popularity
            siteUrl
            title { romaji english native userPreferred }
            coverImage { extraLarge large medium color }
            genres
            externalLinks { id site url type icon color }
          }
        }
      }
    }
  `;

  const GENRES_PT = Object.freeze({
    Action: 'Ação', Adventure: 'Aventura', Comedy: 'Comédia', Drama: 'Drama', Ecchi: 'Ecchi', Fantasy: 'Fantasia',
    Horror: 'Terror', MahouShoujo: 'Garota Mágica', Mecha: 'Mecha', Music: 'Música', Mystery: 'Mistério',
    Psychological: 'Psicológico', Romance: 'Romance', 'Sci-Fi': 'Ficção Científica', 'Slice of Life': 'Slice of Life',
    Sports: 'Esportes', Supernatural: 'Sobrenatural', Thriller: 'Suspense',
  });

  const DAY_TO_JIKAN = Object.freeze({
    0: 'sundays', 1: 'mondays', 2: 'tuesdays', 3: 'wednesdays', 4: 'thursdays', 5: 'fridays', 6: 'saturdays',
  });

  const state = {
    week: [],
    entries: [],
    source: 'AniList',
    loadedAt: 0,
    favorites: new Set(readJSON(CONFIG.favoritesKey, [])),
    favoritesOnly: false,
    streamingMode: false,
    query: '',
    lastFetchStartedAt: 0,
    activeDayKey: null,
    currentModalId: null,
    observer: null,
    visibilityObserver: null,
  };

  const el = {
    daysStrip: document.getElementById('daysStrip'),
    scheduleRoot: document.getElementById('scheduleRoot'),
    skeletonRoot: document.getElementById('skeletonRoot'),
    emptyState: document.getElementById('emptyState'),
    emptyTitle: document.getElementById('emptyTitle'),
    emptyText: document.getElementById('emptyText'),
    emptyAction: document.getElementById('emptyAction'),
    favoritesFilter: document.getElementById('favoritesFilter'),
    streamingFilter: document.getElementById('streamingFilter'),
    syncPill: document.getElementById('syncPill'),
    syncText: document.getElementById('syncText'),
    searchButton: document.getElementById('searchButton'),
    searchOverlay: document.getElementById('searchOverlay'),
    searchInput: document.getElementById('searchInput'),
    searchResults: document.getElementById('searchResults'),
    searchCount: document.getElementById('searchCount'),
    animeModal: document.getElementById('animeModal'),
    modalContent: document.getElementById('modalContent'),
    toastRegion: document.getElementById('toastRegion'),
    profileButton: document.getElementById('profileButton'),
  };

  document.getElementById('year').textContent = String(new Date().getFullYear());

  init();

  function init() {
    state.week = makeWeek();
    state.activeDayKey = state.week[0]?.key || null;
    renderDayTabs();
    bindEvents();
    updateFilterButtons();
    fetchSchedule({ initial: true });
    window.setInterval(() => fetchSchedule({ silent: true }), CONFIG.refreshMs);
    registerServiceWorker();
  }

  function bindEvents() {
    el.daysStrip.addEventListener('click', (event) => {
      const button = event.target.closest('[data-day-key]');
      if (!button) return;
      const key = button.dataset.dayKey;
      const section = document.getElementById(`day-${key}`);
      if (section) section.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      setActiveDay(key, true);
    });

    el.favoritesFilter.addEventListener('click', () => {
      state.favoritesOnly = !state.favoritesOnly;
      updateFilterButtons();
      renderSchedule();
      showToast(state.favoritesOnly ? 'Mostrando apenas seus animes.' : 'Mostrando toda a programação.');
    });

    el.streamingFilter.addEventListener('click', () => toggleStreamingMode());
    el.profileButton.addEventListener('click', () => {
      state.favoritesOnly = true;
      updateFilterButtons();
      renderSchedule();
      document.getElementById('programacao')?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    });

    document.addEventListener('click', (event) => {
      const actionButton = event.target.closest('[data-action]');
      if (actionButton) {
        const action = actionButton.dataset.action;
        if (action === 'streaming') toggleStreamingMode(true);
        if (action === 'all-anime') {
          state.favoritesOnly = false;
          updateFilterButtons();
          renderSchedule();
          document.getElementById('programacao')?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
        }
      }

      const closeTarget = event.target.closest('[data-close]');
      if (closeTarget?.dataset.close === 'search') closeSearch();
      if (closeTarget?.dataset.close === 'modal') closeModal();
    });

    el.scheduleRoot.addEventListener('click', (event) => {
      const bookmark = event.target.closest('[data-bookmark-id]');
      if (bookmark) {
        event.preventDefault();
        event.stopPropagation();
        toggleFavorite(bookmark.dataset.bookmarkId);
        return;
      }

      const streamLink = event.target.closest('.stream-link');
      if (streamLink) return;

      const card = event.target.closest('[data-entry-id]');
      if (card) openModal(card.dataset.entryId);
    });

    el.searchButton.addEventListener('click', openSearch);
    el.searchInput.addEventListener('input', () => {
      state.query = el.searchInput.value.trim();
      renderSearchResults();
    });

    el.searchResults.addEventListener('click', (event) => {
      const result = event.target.closest('[data-search-id]');
      if (!result) return;
      closeSearch();
      openModal(result.dataset.searchId);
    });

    el.emptyAction.addEventListener('click', () => {
      state.favoritesOnly = false;
      state.query = '';
      el.searchInput.value = '';
      updateFilterButtons();
      renderSchedule();
    });

    document.addEventListener('keydown', (event) => {
      const isShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
      if (isShortcut) {
        event.preventDefault();
        openSearch();
      }
      if (event.key === 'Escape') {
        if (!el.searchOverlay.hidden) closeSearch();
        if (!el.animeModal.hidden) closeModal();
      }
    });

    window.addEventListener('online', () => fetchSchedule({ silent: true }));
    window.addEventListener('offline', () => setSyncStatus('offline'));

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      const age = Date.now() - state.lastFetchStartedAt;
      if (age > CONFIG.refreshOnFocusAfterMs) fetchSchedule({ silent: true });
    });
  }

  async function fetchSchedule({ initial = false, silent = false } = {}) {
    if (state.lastFetchStartedAt && Date.now() - state.lastFetchStartedAt < 12_000 && !initial) return;
    state.lastFetchStartedAt = Date.now();
    if (!silent || initial) setSyncStatus('loading');

    const startMs = zonedLocalDateToUtc(state.week[0].key, '00:00');
    const endKey = addDaysToKey(state.week[state.week.length - 1].key, 1);
    const endMs = zonedLocalDateToUtc(endKey, '00:00');

    try {
      const data = await fetchAniListSchedule(Math.floor(startMs / 1000), Math.floor(endMs / 1000));
      if (!data.length) throw new Error('AniList não retornou episódios para a janela solicitada.');
      state.entries = normalizeAniList(data);
      state.source = 'AniList';
      state.loadedAt = Date.now();
      writeJSON(CONFIG.cacheKey, { savedAt: Date.now(), source: state.source, entries: state.entries });
      setSyncStatus('ok');
      renderSchedule();
      renderSearchResults();
      return;
    } catch (aniError) {
      console.warn('[AniNexus] AniList indisponível:', aniError);
    }

    try {
      const fallback = await fetchJikanSchedule();
      if (!fallback.length) throw new Error('Jikan não retornou programação.');
      state.entries = fallback;
      state.source = 'Jikan / MAL';
      state.loadedAt = Date.now();
      writeJSON(CONFIG.cacheKey, { savedAt: Date.now(), source: state.source, entries: state.entries });
      setSyncStatus('fallback');
      renderSchedule();
      renderSearchResults();
      return;
    } catch (fallbackError) {
      console.warn('[AniNexus] Fallback Jikan indisponível:', fallbackError);
    }

    const cache = readJSON(CONFIG.cacheKey, null);
    if (cache?.entries?.length && Date.now() - Number(cache.savedAt || 0) <= CONFIG.cacheMaxAgeMs) {
      state.entries = cache.entries;
      state.source = `${cache.source || 'API'} (cache)`;
      state.loadedAt = Number(cache.savedAt || Date.now());
      setSyncStatus('cache');
      renderSchedule();
      renderSearchResults();
      return;
    }

    setSyncStatus('error');
    renderErrorState();
  }

  async function fetchAniListSchedule(start, end) {
    const all = [];
    let page = 1;
    let hasNextPage = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 14_000);

    try {
      while (hasNextPage && page <= 6) {
        const response = await fetch(CONFIG.anilistEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ query: ANILIST_QUERY, variables: { page, start, end } }),
          signal: controller.signal,
        });

        if (!response.ok) throw new Error(`AniList HTTP ${response.status}`);
        const payload = await response.json();
        if (payload.errors?.length) throw new Error(payload.errors[0]?.message || 'Erro GraphQL');
        const pageData = payload?.data?.Page;
        all.push(...(pageData?.airingSchedules || []));
        hasNextPage = Boolean(pageData?.pageInfo?.hasNextPage);
        page += 1;
      }
      return all;
    } finally {
      clearTimeout(timeout);
    }
  }

  function normalizeAniList(rows) {
    const dedupe = new Map();
    for (const row of rows) {
      const media = row?.media;
      if (!row?.airingAt || !media?.id) continue;
      if (media.format === 'MUSIC') continue;
      const id = `al-${media.id}-${row.episode}-${row.airingAt}`;
      const streams = (media.externalLinks || [])
        .filter((link) => link?.url && (link.type === 'STREAMING' || looksLikeStreamingSite(link.site)))
        .map((link) => ({ site: link.site || 'Assistir', url: safeHttpUrl(link.url) }))
        .filter((link) => link.url)
        .slice(0, 6);

      dedupe.set(id, {
        id,
        provider: 'AniList',
        mediaId: String(media.id),
        malId: media.idMal ? String(media.idMal) : null,
        episode: Number(row.episode || 0),
        totalEpisodes: Number(media.episodes || 0) || null,
        airingAt: Number(row.airingAt) * 1000,
        title: pickTitle(media.title),
        nativeTitle: media.title?.native || '',
        cover: media.coverImage?.extraLarge || media.coverImage?.large || media.coverImage?.medium || '',
        coverColor: media.coverImage?.color || '#e8e4e9',
        genres: (media.genres || []).map(translateGenre),
        score: media.averageScore ? Number((media.averageScore / 10).toFixed(1)) : null,
        format: formatLabel(media.format),
        duration: media.duration || null,
        siteUrl: safeHttpUrl(media.siteUrl),
        streaming: uniqueBy(streams, (item) => item.site.toLowerCase()),
        premiere: Number(row.episode) === 1,
        finale: Boolean(media.episodes && Number(row.episode) === Number(media.episodes)),
      });
    }
    return [...dedupe.values()].sort((a, b) => a.airingAt - b.airingAt);
  }

  async function fetchJikanSchedule() {
    const tasks = state.week.map(async (day) => {
      const weekday = new Date(`${day.key}T12:00:00Z`).getUTCDay();
      const filter = DAY_TO_JIKAN[weekday];
      const url = `${CONFIG.jikanEndpoint}/schedules?filter=${encodeURIComponent(filter)}&sfw=true&page=1`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
        if (!response.ok) throw new Error(`Jikan HTTP ${response.status}`);
        const payload = await response.json();
        return (payload?.data || []).map((anime) => normalizeJikanAnime(anime, day)).filter(Boolean);
      } finally {
        clearTimeout(timeout);
      }
    });

    const settled = await Promise.allSettled(tasks);
    const rows = settled.flatMap((item) => item.status === 'fulfilled' ? item.value : []);
    return uniqueBy(rows, (item) => `${item.malId}-${item.airingAt}`).sort((a, b) => a.airingAt - b.airingAt);
  }

  function normalizeJikanAnime(anime, day) {
    const time = anime?.broadcast?.time;
    if (!anime?.mal_id || !time) return null;
    const [hour = '00', minute = '00'] = time.split(':');
    const sourceTz = anime?.broadcast?.timezone || 'Asia/Tokyo';
    const airingAt = zonedTimeInNamedZoneToUtc(day.key, `${hour}:${minute}`, sourceTz);
    const now = Date.now();
    if (!Number.isFinite(airingAt) || airingAt < now - 8 * 24 * 60 * 60 * 1000) return null;

    return {
      id: `mal-${anime.mal_id}-${airingAt}`,
      provider: 'Jikan / MAL',
      mediaId: null,
      malId: String(anime.mal_id),
      episode: null,
      totalEpisodes: anime.episodes || null,
      airingAt,
      title: anime.title_english || anime.title || 'Anime',
      nativeTitle: anime.title_japanese || '',
      cover: anime.images?.webp?.large_image_url || anime.images?.jpg?.large_image_url || '',
      coverColor: '#e8e4e9',
      genres: (anime.genres || []).map((g) => translateGenre(g.name)),
      score: typeof anime.score === 'number' ? Number(anime.score.toFixed(1)) : null,
      format: anime.type || 'Anime',
      duration: null,
      siteUrl: safeHttpUrl(anime.url),
      streaming: [],
      premiere: false,
      finale: false,
    };
  }

  function renderDayTabs() {
    el.daysStrip.innerHTML = state.week.map((day, index) => `
      <button class="day-tab ${index === 0 ? 'is-active' : ''} ${day.isToday ? 'is-today' : ''}"
        type="button" role="tab" aria-selected="${index === 0 ? 'true' : 'false'}" data-day-key="${day.key}">
        <span class="day-tab__weekday">${escapeHTML(day.shortWeekday)}</span>
        <span class="day-tab__number">${escapeHTML(day.day)}</span>
      </button>
    `).join('');
  }

  function renderSchedule() {
    if (el.skeletonRoot) el.skeletonRoot.remove();

    const groups = state.week.map((day) => {
      const entries = state.entries.filter((entry) => getDateKey(new Date(entry.airingAt), CONFIG.timeZone) === day.key)
        .filter((entry) => !state.favoritesOnly || state.favorites.has(favoriteKey(entry)));
      return { day, entries };
    });

    const visibleTotal = groups.reduce((sum, group) => sum + group.entries.length, 0);
    el.emptyState.hidden = visibleTotal > 0;
    el.scheduleRoot.hidden = visibleTotal === 0;

    if (!visibleTotal) {
      if (state.favoritesOnly) {
        el.emptyTitle.textContent = 'Sua lista está vazia';
        el.emptyText.textContent = 'Salve animes pelo ícone de marcador nos cards e eles aparecerão aqui.';
      } else {
        el.emptyTitle.textContent = 'Nenhum episódio encontrado';
        el.emptyText.textContent = 'Não há episódios disponíveis para esta janela ou a fonte de dados não respondeu.';
      }
      return;
    }

    el.scheduleRoot.innerHTML = groups.map(({ day, entries }) => `
      <section class="day-section" id="day-${day.key}" data-observe-day="${day.key}">
        <div class="day-heading">
          <div class="day-heading__left">
            <h2>${escapeHTML(day.weekday)}</h2>
            <span class="day-heading__date">${escapeHTML(day.longDate)}</span>
          </div>
          <span class="day-heading__count">${entries.length} ${entries.length === 1 ? 'episódio' : 'episódios'}</span>
        </div>
        ${entries.length ? `<div class="anime-grid">${entries.map((entry, index) => cardHTML(entry, index)).join('')}</div>` : `
          <div class="inline-empty">Nenhum episódio neste dia.</div>
        `}
      </section>
    `).join('');

    observeDaySections();
    observeCards();
  }

  function cardHTML(entry, index) {
    const saved = state.favorites.has(favoriteKey(entry));
    const genres = entry.genres.length ? entry.genres.slice(0, 3).join(', ') : 'Anime';
    const streams = entry.streaming || [];
    return `
      <article class="anime-card" tabindex="0" role="button" data-entry-id="${escapeAttr(entry.id)}" style="--delay:${Math.min(index * 24, 190)}ms">
        <div class="anime-card__poster" style="background:${escapeAttr(entry.coverColor || '#ece8ed')}">
          ${entry.cover ? `<img src="${escapeAttr(entry.cover)}" alt="Capa de ${escapeAttr(entry.title)}" loading="lazy" decoding="async" />` : ''}
          <span class="episode-badge">${entry.episode ? `EP ${entry.episode}` : 'EP'}</span>
          ${entry.score ? `<span class="score-badge"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.7 2.7 5.48 6.05.88-4.38 4.27 1.03 6.03L12 16.5l-5.4 2.84 1.03-6.03L3.25 9.06l6.05-.88L12 2.7Z"/></svg>${formatScore(entry.score)}</span>` : ''}
          <button class="bookmark-button ${saved ? 'is-saved' : ''}" type="button" aria-label="${saved ? 'Remover dos meus animes' : 'Adicionar aos meus animes'}" aria-pressed="${saved}" data-bookmark-id="${escapeAttr(entry.id)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 4.75h11a1 1 0 0 1 1 1v14l-6.5-3.7-6.5 3.7v-14a1 1 0 0 1 1-1Z"/></svg>
          </button>
        </div>
        <div class="anime-card__body">
          <div class="airing-time ${entry.airingAt < Date.now() ? 'is-past' : ''}">${escapeHTML(relativeAiringLabel(entry.airingAt))}</div>
          <h3>${escapeHTML(entry.title)}</h3>
          <div class="anime-card__genres">${escapeHTML(genres)}</div>
          <div class="anime-card__bottom">
            ${entry.premiere ? '<span class="status-chip status-chip--premiere">Estreia</span>' : ''}
            ${entry.finale ? '<span class="status-chip status-chip--finale">Episódio Final</span>' : ''}
            ${!entry.premiere && !entry.finale ? `<span class="source-chip">${escapeHTML(entry.format || 'Anime')}</span>` : ''}
          </div>
          <div class="streaming-row">
            ${streams.length ? streams.slice(0, 3).map((stream) => `<a class="stream-link" href="${escapeAttr(stream.url)}" target="_blank" rel="noreferrer" title="Abrir ${escapeAttr(stream.site)}">${escapeHTML(stream.site)}</a>`).join('') : '<span class="stream-empty">Sem link oficial informado</span>'}
          </div>
        </div>
      </article>
    `;
  }

  function renderErrorState() {
    if (el.skeletonRoot) el.skeletonRoot.remove();
    el.scheduleRoot.hidden = true;
    el.emptyState.hidden = false;
    el.emptyTitle.textContent = 'Não foi possível carregar a programação';
    el.emptyText.textContent = 'AniList e a fonte de contingência não responderam. Verifique a internet e tente novamente.';
    el.emptyAction.textContent = 'Tentar novamente';
    el.emptyAction.onclick = () => fetchSchedule({ initial: true });
  }

  function renderSearchResults() {
    if (el.searchOverlay.hidden) return;
    const q = normalizeText(state.query);
    if (!q) {
      el.searchCount.textContent = 'Digite para pesquisar na programação desta semana';
      el.searchResults.innerHTML = state.entries.slice(0, 8).map(searchResultHTML).join('');
      return;
    }

    const matches = state.entries.filter((entry) => {
      const haystack = normalizeText([entry.title, entry.nativeTitle, ...(entry.genres || [])].join(' '));
      return haystack.includes(q);
    }).slice(0, 30);

    el.searchCount.textContent = `${matches.length} ${matches.length === 1 ? 'resultado' : 'resultados'} na programação desta semana`;
    el.searchResults.innerHTML = matches.length
      ? matches.map(searchResultHTML).join('')
      : '<div class="search-no-results">Nenhum anime encontrado para essa busca.</div>';
  }

  function searchResultHTML(entry) {
    return `
      <button class="search-result" type="button" data-search-id="${escapeAttr(entry.id)}">
        ${entry.cover ? `<img src="${escapeAttr(entry.cover)}" alt="" loading="lazy" />` : '<span></span>'}
        <span class="search-result__main"><strong>${escapeHTML(entry.title)}</strong><span>${escapeHTML(entry.genres.slice(0,3).join(', ') || entry.format || 'Anime')}</span></span>
        <span class="search-result__time">${escapeHTML(relativeAiringLabel(entry.airingAt))}</span>
      </button>
    `;
  }

  function openSearch() {
    el.searchOverlay.hidden = false;
    document.body.classList.add('is-locked');
    state.query = el.searchInput.value.trim();
    renderSearchResults();
    requestAnimationFrame(() => el.searchInput.focus());
  }

  function closeSearch() {
    el.searchOverlay.hidden = true;
    if (el.animeModal.hidden) document.body.classList.remove('is-locked');
  }

  function openModal(id) {
    const entry = state.entries.find((item) => item.id === id);
    if (!entry) return;
    state.currentModalId = id;
    const saved = state.favorites.has(favoriteKey(entry));
    const streams = entry.streaming || [];
    el.modalContent.innerHTML = `
      <div class="modal-layout">
        <div class="modal-cover" style="background:${escapeAttr(entry.coverColor || '#eee')}">
          ${entry.cover ? `<img src="${escapeAttr(entry.cover)}" alt="Capa de ${escapeAttr(entry.title)}" />` : ''}
        </div>
        <div class="modal-info">
          <div class="modal-kicker">${escapeHTML(entry.provider)} · ${entry.episode ? `episódio ${entry.episode}` : 'programação'}</div>
          <h2 id="modalTitle">${escapeHTML(entry.title)}</h2>
          <div class="modal-meta">
            ${entry.score ? `<span>★ ${formatScore(entry.score)}</span>` : ''}
            ${entry.format ? `<span>${escapeHTML(entry.format)}</span>` : ''}
            ${entry.totalEpisodes ? `<span>${entry.totalEpisodes} episódios</span>` : ''}
            ${entry.duration ? `<span>${entry.duration} min</span>` : ''}
            ${(entry.genres || []).slice(0,3).map((genre) => `<span>${escapeHTML(genre)}</span>`).join('')}
          </div>
          <div class="modal-airing">
            <div class="modal-airing__episode">${entry.episode ? `EP ${entry.episode}` : 'EP'}</div>
            <div><strong>${escapeHTML(relativeAiringLabel(entry.airingAt))}</strong><span>${escapeHTML(fullDateTime(entry.airingAt))} · horário de Brasília</span></div>
          </div>
          <div class="modal-streaming">
            <h3>Onde assistir</h3>
            <div class="modal-streams">
              ${streams.length ? streams.map((stream) => `<a href="${escapeAttr(stream.url)}" target="_blank" rel="noreferrer">${escapeHTML(stream.site)}</a>`).join('') : '<span class="stream-empty">A fonte não informou um link oficial de streaming para este título.</span>'}
            </div>
          </div>
          <div class="modal-actions">
            <button class="modal-secondary ${saved ? 'is-saved' : ''}" type="button" data-modal-bookmark="${escapeAttr(entry.id)}">${saved ? '✓ Nos meus animes' : '+ Meus animes'}</button>
            ${entry.siteUrl ? `<a class="modal-secondary" href="${escapeAttr(entry.siteUrl)}" target="_blank" rel="noreferrer">Ver na fonte</a>` : ''}
          </div>
        </div>
      </div>
    `;
    el.animeModal.hidden = false;
    document.body.classList.add('is-locked');

    const modalBookmark = el.modalContent.querySelector('[data-modal-bookmark]');
    modalBookmark?.addEventListener('click', () => {
      toggleFavorite(entry.id, { rerender: false });
      openModal(entry.id);
    });
  }

  function closeModal() {
    el.animeModal.hidden = true;
    state.currentModalId = null;
    if (el.searchOverlay.hidden) document.body.classList.remove('is-locked');
  }

  function toggleFavorite(entryId, { rerender = true } = {}) {
    const entry = state.entries.find((item) => item.id === entryId);
    if (!entry) return;
    const key = favoriteKey(entry);
    if (state.favorites.has(key)) {
      state.favorites.delete(key);
      showToast('Removido dos seus animes.');
    } else {
      state.favorites.add(key);
      showToast('Adicionado aos seus animes.');
    }
    writeJSON(CONFIG.favoritesKey, [...state.favorites]);
    if (rerender) renderSchedule();
  }

  function toggleStreamingMode(forceOn = false) {
    state.streamingMode = forceOn ? true : !state.streamingMode;
    document.body.classList.toggle('show-streaming', state.streamingMode);
    updateFilterButtons();
    if (forceOn) document.getElementById('programacao')?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }

  function updateFilterButtons() {
    el.favoritesFilter.setAttribute('aria-pressed', String(state.favoritesOnly));
    el.streamingFilter.setAttribute('aria-pressed', String(state.streamingMode));
    document.body.classList.toggle('show-streaming', state.streamingMode);
  }

  function setSyncStatus(status) {
    el.syncPill.classList.remove('is-loading', 'is-warning');
    if (status === 'loading') {
      el.syncPill.classList.add('is-loading');
      el.syncText.textContent = 'Sincronizando…';
      return;
    }
    if (status === 'fallback') {
      el.syncPill.classList.add('is-warning');
      el.syncText.textContent = `Atualizado · ${state.source}`;
      return;
    }
    if (status === 'cache') {
      el.syncPill.classList.add('is-warning');
      el.syncText.textContent = 'Modo offline · cache recente';
      return;
    }
    if (status === 'offline') {
      el.syncPill.classList.add('is-warning');
      el.syncText.textContent = 'Sem internet';
      return;
    }
    if (status === 'error') {
      el.syncPill.classList.add('is-warning');
      el.syncText.textContent = 'Falha ao sincronizar';
      return;
    }
    el.syncText.textContent = `Atualizado agora · ${state.source}`;
  }

  function observeDaySections() {
    state.observer?.disconnect();
    const sections = [...document.querySelectorAll('[data-observe-day]')];
    if (!sections.length) return;
    state.observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActiveDay(visible[0].target.dataset.observeDay, false);
    }, { rootMargin: '-32% 0px -58% 0px', threshold: [0, .01, .2] });
    sections.forEach((section) => state.observer.observe(section));
  }

  function observeCards() {
    state.visibilityObserver?.disconnect();
    const cards = [...document.querySelectorAll('.anime-card')];
    if (prefersReducedMotion()) {
      cards.forEach((card) => card.classList.add('is-visible'));
      return;
    }
    state.visibilityObserver = new IntersectionObserver((entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    }, { rootMargin: '60px 0px', threshold: .03 });
    cards.forEach((card) => state.visibilityObserver.observe(card));

    cards.forEach((card) => {
      card.addEventListener('keydown', (event) => {
        if (event.target !== card) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openModal(card.dataset.entryId);
        }
      });
    });
  }

  function setActiveDay(key, userInitiated) {
    if (!key || state.activeDayKey === key && !userInitiated) return;
    state.activeDayKey = key;
    document.querySelectorAll('.day-tab').forEach((tab) => {
      const active = tab.dataset.dayKey === key;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
      if (active && userInitiated && window.innerWidth <= 680) tab.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
    });
  }

  function makeWeek() {
    const todayKey = getDateKey(new Date(), CONFIG.timeZone);
    return Array.from({ length: CONFIG.days }, (_, index) => {
      const key = addDaysToKey(todayKey, index);
      const noon = new Date(`${key}T12:00:00Z`);
      return {
        key,
        isToday: index === 0,
        day: String(Number(key.slice(8, 10))),
        shortWeekday: formatParts(noon, { weekday: 'short' }).replace('.', '').toUpperCase().slice(0, 3),
        weekday: titleCase(formatParts(noon, { weekday: 'long' })),
        longDate: formatParts(noon, { day: '2-digit', month: 'long' }),
      };
    });
  }

  function relativeAiringLabel(timestamp) {
    const date = new Date(timestamp);
    const key = getDateKey(date, CONFIG.timeZone);
    const today = state.week[0]?.key || getDateKey(new Date(), CONFIG.timeZone);
    const tomorrow = addDaysToKey(today, 1);
    const time = formatParts(date, { hour: '2-digit', minute: '2-digit', hour12: false });
    if (key === today) return `Hoje ${time}`;
    if (key === tomorrow) return `Amanhã ${time}`;
    return `${formatParts(date, { day: '2-digit', month: 'short' }).replace('.', '')} ${time}`;
  }

  function fullDateTime(timestamp) {
    return new Intl.DateTimeFormat(CONFIG.locale, {
      timeZone: CONFIG.timeZone, weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(timestamp));
  }

  function getDateKey(date, timeZone) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(date);
    const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${map.year}-${map.month}-${map.day}`;
  }

  function addDaysToKey(key, amount) {
    const [year, month, day] = key.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + amount, 12));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  }

  function zonedLocalDateToUtc(dateKey, hhmm) {
    return zonedTimeInNamedZoneToUtc(dateKey, hhmm, CONFIG.timeZone);
  }

  function zonedTimeInNamedZoneToUtc(dateKey, hhmm, timeZone) {
    const [year, month, day] = dateKey.split('-').map(Number);
    const [hour, minute] = hhmm.split(':').map(Number);
    const desiredAsUTC = Date.UTC(year, month - 1, day, hour, minute, 0);
    let guess = desiredAsUTC;

    for (let i = 0; i < 3; i += 1) {
      const parts = zonedParts(new Date(guess), timeZone);
      const representedAsUTC = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
      const delta = desiredAsUTC - representedAsUTC;
      guess += delta;
      if (Math.abs(delta) < 1000) break;
    }
    return guess;
  }

  function zonedParts(date, timeZone) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(date);
    const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return {
      year: Number(map.year), month: Number(map.month), day: Number(map.day), hour: Number(map.hour), minute: Number(map.minute), second: Number(map.second),
    };
  }

  function formatParts(date, options) {
    return new Intl.DateTimeFormat(CONFIG.locale, { timeZone: CONFIG.timeZone, ...options }).format(date);
  }

  function pickTitle(title) {
    return title?.english || title?.userPreferred || title?.romaji || title?.native || 'Anime';
  }

  function translateGenre(genre) {
    return GENRES_PT[genre] || genre || '';
  }

  function formatLabel(value) {
    const map = { TV: 'Série', TV_SHORT: 'Série curta', MOVIE: 'Filme', SPECIAL: 'Especial', OVA: 'OVA', ONA: 'ONA' };
    return map[value] || value || 'Anime';
  }

  function formatScore(score) {
    return Number(score).toLocaleString('pt-BR', { minimumFractionDigits: score % 1 ? 1 : 0, maximumFractionDigits: 1 });
  }

  function favoriteKey(entry) {
    if (entry.malId) return `mal:${entry.malId}`;
    if (entry.mediaId) return `al:${entry.mediaId}`;
    return `title:${normalizeText(entry.title)}`;
  }

  function looksLikeStreamingSite(site = '') {
    return /(crunchyroll|netflix|prime video|amazon|hulu|disney|hidive|youtube|bilibili|tubi|retrocrush|adult swim|apple tv)/i.test(site);
  }

  function uniqueBy(items, keyFn) {
    const map = new Map();
    items.forEach((item) => map.set(keyFn(item), item));
    return [...map.values()];
  }

  function safeHttpUrl(url) {
    if (!url) return '';
    try {
      const parsed = new URL(url);
      return /^https?:$/.test(parsed.protocol) ? parsed.href : '';
    } catch { return ''; }
  }

  function normalizeText(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function titleCase(value) {
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
  }

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function escapeAttr(value) {
    return escapeHTML(value).replace(/`/g, '&#96;');
  }

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  }

  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage optional */ }
  }

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    el.toastRegion.appendChild(toast);
    window.setTimeout(() => {
      toast.classList.add('is-leaving');
      window.setTimeout(() => toast.remove(), 230);
    }, 2200);
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
})();
