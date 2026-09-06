'use strict';

(() => {
  const BUILD = '44.25.0';
  const GROUPS = [
    { id: 'all', label: 'Todos' },
    { id: 'highlights', label: 'Destaques' },
    { id: 'production', label: 'Produção' },
    { id: 'genres', label: 'Gêneros' },
    { id: 'characters', label: 'Personagens' },
    { id: 'music', label: 'Música' },
    { id: 'voices', label: 'Vozes' }
  ];

  let activeCleanup = null;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  const plain = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const slug = value => plain(value || 'anime')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 90) || 'anime';

  function groupFor(category = '') {
    const value = plain(category);
    if (/performance|voz|dublagem/.test(value)) return 'voices';
    if (/abertura|encerramento|musica|trilha sonora/.test(value)) return 'music';
    if (/personagem|protagonista|antagonista|garot|heroi|vilao|casal|cena de luta|comovente/.test(value)) return 'characters';
    if (/animacao|direcao|design|cenario|arte|cinematografia|\bcg\b/.test(value)) return 'production';
    if (/anime de|isekai|fantasia|romance|comedia|drama|acao|slice of life/.test(value)) return 'genres';
    return 'highlights';
  }

  function historicParts(item) {
    const parts = String(item.winner || '').split(',').map(part => part.trim()).filter(Boolean);
    const winner = parts[0] || item.winner || '';
    const category = plain(item.category);
    const group = groupFor(item.category);
    const directWork = /anime|filme|serie estreante|continuacao/.test(category)
      || /melhor animacao|cenario artistico|direcao de arte|cinematografia/.test(category);
    const personWork = group === 'voices' || group === 'characters'
      || /direcao|design de personagens|performance/.test(category);
    const musicWork = group === 'music' && parts.length >= 3;
    const work = directWork ? winner : (personWork || musicWork) && parts.length > 1 ? parts.at(-1) : winner;
    const details = parts.slice(1).filter(part => part !== work);
    return {
      winner,
      work,
      credit: details.join(' · '),
      detail: details.join(' · '),
      search: work || winner
    };
  }

  function normalizeHistory(history) {
    return (history?.editions || []).map(edition => ({
      year: Number(edition.year),
      hero_media_id: Number(edition.hero_media_id) || null,
      hero_image: '',
      source: history.source,
      artState: 'idle',
      winners: (edition.winners || []).map((item, index) => {
        const parts = historicParts(item);
        return {
          id: `${edition.year}-${index + 1}`,
          group: groupFor(item.category),
          category: item.category,
          ...parts,
          media_id: index === 0 ? Number(edition.hero_media_id) || null : null,
          feature_image: '',
          card_image: ''
        };
      })
    }));
  }

  function normalizeCurrent(data) {
    const featureImages = data?.feature_images || {};
    const firstWinner = data?.winners?.[0];
    return {
      year: Number(data?.edition) || 2026,
      hero_media_id: Number(firstWinner?.media_id) || null,
      hero_image: String(firstWinner?.feature_image || featureImages[firstWinner?.id] || ''),
      source: data?.source || null,
      artState: 'idle',
      winners: (data?.winners || []).map((item, index) => ({
        ...item,
        id: item.id || `2026-${index + 1}`,
        group: item.group || groupFor(item.category),
        media_id: Number(item.media_id) || null,
        feature_image: String(item.feature_image || featureImages[item.id] || ''),
        card_image: '',
        search: item.work || item.winner,
        detail: ''
      }))
    };
  }

  function artMarkup(src, fallback, item, wide = false) {
    const alt = item?.work || item?.winner || 'Vencedor do AniNexus Awards';
    const fallbackAttr = fallback && fallback !== src ? ` data-nx45-award-fallback="${esc(fallback)}"` : '';
    return `<span class="nx45-award-art-placeholder" aria-hidden="true"><b>A</b></span>${src ? `<img decoding="async" src="${esc(src)}"${fallbackAttr} alt="${esc(alt)}" data-nx45-award-image>` : ''}`;
  }

  function featureMarkup(item, edition, items, icons) {
    const src = item.feature_image || item.card_image || edition.hero_image || '';
    const fallback = item.card_image || edition.hero_image || '';
    const showWork = item.work && plain(item.work) !== plain(item.winner);
    const detail = item.credit || item.detail || '';
    const title = item.winner || item.work;
    const cta = item.media_id
      ? `<button type="button" class="nx45-award-open" data-nx45-award-open="${item.media_id}" data-title="${esc(item.work || item.winner)}">Ver no AniNexus ${icons.arrow}</button>`
      : '';
    const related = [item, ...items.filter(peer => peer !== item && peer.group === item.group), ...items.filter(peer => peer !== item && peer.group !== item.group)].slice(0, 6);
    return `<article class="nx45-award-feature" data-feature-id="${esc(item.id)}" tabindex="-1">
      <div class="nx45-award-feature-art">${artMarkup(src, fallback, item, true)}<span></span></div>
      <div class="nx45-award-feature-copy">
        <span class="nx45-award-mark">${icons.trophy}<b>Vencedor ${edition.year}</b></span>
        <p>${esc(item.category)}</p>
        <h2>${esc(title)}</h2>
        ${showWork ? `<strong>${esc(item.work)}</strong>` : ''}
        ${detail ? `<small>${esc(detail)}</small>` : ''}
        ${cta}
      </div>
    </article>
    <section class="nx45-award-related" aria-label="Outros destaques da edição ${edition.year}">
      <header><small>DESTAQUES DA EDIÇÃO</small><strong>Explore outros vencedores</strong></header>
      <div class="nx45-award-related-rail">
        ${related.map(peer => {
          const peerSrc = peer.card_image || peer.feature_image || edition.hero_image || '';
          return `<button type="button" class="nx45-award-related-item${peer === item ? ' is-active' : ''}" data-nx45-related-select="${esc(peer.id)}" aria-pressed="${peer === item}">
            <span>${artMarkup(peerSrc, peer.feature_image || edition.hero_image || '', peer)}</span>
            <i><small>${esc(peer.category)}</small><strong>${esc(peer.winner)}</strong></i>
            ${peer === item ? '<b>VENCEDOR</b>' : icons.arrow}
          </button>`;
        }).join('')}
      </div>
    </section>`;
  }

  function cardMarkup(item, edition, index, icons) {
    const src = item.card_image || item.feature_image || edition.hero_image || '';
    const fallback = item.feature_image || edition.hero_image || '';
    const showWork = item.work && plain(item.work) !== plain(item.winner);
    const detail = showWork ? item.work : item.credit || item.detail || '';
    return `<button type="button" class="nx45-award-card" data-nx45-award-select="${esc(item.id)}" aria-pressed="false" aria-label="Abrir ${esc(item.category)}: ${esc(item.winner)}">
      <span class="nx45-award-card-art">${artMarkup(src, fallback, item)}<i>${String(index + 1).padStart(2, '0')}</i></span>
      <span class="nx45-award-card-copy">
        <small>${icons.trophy}${esc(item.category)}</small>
        <strong>${esc(item.winner)}</strong>
        ${detail ? `<span>${esc(detail)}</span>` : ''}
      </span>
      <span class="nx45-award-card-arrow" aria-hidden="true">${icons.arrow}</span>
    </button>`;
  }

  async function mount(ctx) {
    activeCleanup?.();
    const { app, base = '', icons, go, getMedia, gql, banner, image, stopTimers, meta } = ctx;
    stopTimers();
    meta('AniNexus Awards');
    document.documentElement.classList.remove('nx45-awards-boot');
    document.body.classList.remove('aqx-home-active', 'nx35-home-active', 'nx34-home', 'nx33-home', 'nx35-news-active', 'nx35-news-list-active');
    document.body.classList.add('nx45-awards-active');
    document.querySelectorAll('[data-nav]').forEach(link => link.classList.remove('active'));

    app.innerHTML = `<main class="nx45-awards-page" data-nx45-awards>
      <header class="nx45-awards-intro" id="nx45AwardsHero">
        <div class="shell nx45-awards-intro-inner">
          <div class="nx45-awards-title">
            <span>${icons.trophy}<b>ANINEXUS AWARDS</b></span>
            <h1>Vencedores de <em data-nx45-year-title>2026</em></h1>
            <p>As obras, artistas e vozes reconhecidas em cada edição da premiação.</p>
          </div>
          <div class="nx45-awards-year-control">
            <label for="nx45AwardsYear">Edição</label>
            <select id="nx45AwardsYear" data-nx45-year-select aria-label="Selecionar edição do Anime Awards"></select>
          </div>
        </div>
        <nav class="shell nx45-awards-years" data-nx45-years aria-label="Edições do Anime Awards"></nav>
      </header>
      <section class="nx45-awards-content">
        <div class="shell">
          <div class="nx45-awards-stage-head">
            <div><small>VENCEDOR EM DESTAQUE</small><strong data-nx45-stage-index>01 / 32</strong></div>
            <div class="nx45-awards-stage-nav">
              <button type="button" data-nx45-prev aria-label="Vencedor anterior">${icons.arrow}</button>
              <button type="button" data-nx45-next aria-label="Próximo vencedor">${icons.arrow}</button>
            </div>
          </div>
          <div class="nx45-awards-stage" data-nx45-stage aria-live="polite">
            <div class="nx45-award-loading"></div>
          </div>
          <div class="nx45-awards-filter-wrap">
            <div class="nx45-awards-filters" data-nx45-filters role="group" aria-label="Categorias da premiação"></div>
          </div>
          <header class="nx45-awards-gallery-head">
            <div><small>GALERIA DE VENCEDORES</small><h2>Todos os vencedores</h2></div>
            <span data-nx45-count>32 resultados</span>
          </header>
          <div class="nx45-awards-grid" data-nx45-grid aria-live="polite"></div>
          <p class="nx45-awards-source">Fonte: <a href="https://www.crunchyroll.com/animeawards/pastwinners/" target="_blank" rel="noopener noreferrer">Crunchyroll Anime Awards</a></p>
        </div>
      </section>
    </main>
    <section class="nx45-awards-island" id="nx45AwardsIsland" aria-label="Guia do AniNexus Awards" aria-hidden="true" inert>
      <button type="button" class="nx45-awards-island-head" data-nx45-island-toggle aria-expanded="false">
        <span class="nx45-awards-island-icon">${icons.trophy}</span>
        <span class="nx45-awards-island-copy"><strong>AniNexus <em>Awards</em></strong><small data-nx45-island-context>Edição 2026 · Todos</small></span>
        <span class="nx45-awards-island-chevron">${icons.arrow}</span>
      </button>
      <div class="nx45-awards-island-panel" aria-hidden="true" inert><div><div class="nx45-awards-island-inner">
        <div class="nx45-awards-island-tools"><label for="nx45IslandYear">Edição</label><select id="nx45IslandYear" data-nx45-island-year-select aria-label="Selecionar edição no guia"></select></div>
        <nav class="nx45-awards-years nx45-awards-island-years" data-nx45-island-years aria-label="Edições no guia"></nav>
        <div class="nx45-awards-filters nx45-awards-island-filters" data-nx45-island-filters role="group" aria-label="Categorias no guia"></div>
      </div></div></div>
    </section>`;

    const roots = {
      hero: app.querySelector('#nx45AwardsHero'),
      yearTitle: app.querySelector('[data-nx45-year-title]'),
      yearSelects: [...app.querySelectorAll('[data-nx45-year-select],[data-nx45-island-year-select]')],
      yearRails: [...app.querySelectorAll('[data-nx45-years],[data-nx45-island-years]')],
      filters: [...app.querySelectorAll('[data-nx45-filters],[data-nx45-island-filters]')],
      stage: app.querySelector('[data-nx45-stage]'),
      stageIndex: app.querySelector('[data-nx45-stage-index]'),
      grid: app.querySelector('[data-nx45-grid]'),
      count: app.querySelector('[data-nx45-count]'),
      island: app.querySelector('#nx45AwardsIsland'),
      islandContext: app.querySelector('[data-nx45-island-context]')
    };

    let editions = [];
    let edition = null;
    let selected = null;
    let activeGroup = 'all';
    let scrollFrame = 0;
    let lastScrollY = Math.max(0, scrollY);
    let scrollDirection = 0;
    let scrollTravel = 0;
    let scrollLockUntil = 0;
    let disposed = false;
    const mediaCache = new Map();

    function visibleItems() {
      if (!edition) return [];
      return activeGroup === 'all' ? edition.winners : edition.winners.filter(item => item.group === activeGroup);
    }

    function bindBrokenImages(scope) {
      scope.querySelectorAll('[data-nx45-award-image]').forEach(node => node.addEventListener('error', () => {
        const fallback = node.dataset.nx45AwardFallback;
        if (fallback && node.src !== fallback && node.dataset.nx45Retried !== '1') {
          node.dataset.nx45Retried = '1';
          node.src = fallback;
          return;
        }
        node.hidden = true;
        node.parentElement?.classList.add('image-failed');
      }));
    }

    function syncCards() {
      app.querySelectorAll('[data-nx45-award-select],[data-nx45-related-select]').forEach(button => {
        const id = button.dataset.nx45AwardSelect || button.dataset.nx45RelatedSelect;
        const active = id === selected?.id;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      });
    }

    function scrollToFeature() {
      const feature = roots.stage.querySelector('.nx45-award-feature');
      if (!feature) return;
      roots.stage.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      feature.focus({ preventScroll: true });
    }

    function selectWinner(next, reveal = false) {
      if (!next || next === selected) {
        if (reveal) scrollToFeature();
        return;
      }
      selected = next;
      roots.stage.classList.add('is-changing');
      requestAnimationFrame(() => {
        drawFeature();
        if (reveal) requestAnimationFrame(scrollToFeature);
      });
    }

    function drawFeature() {
      if (!selected || !edition) return;
      const list = visibleItems();
      roots.stage.innerHTML = featureMarkup(selected, edition, list, icons);
      roots.stage.classList.remove('is-changing');
      bindBrokenImages(roots.stage);
      const index = Math.max(0, list.indexOf(selected));
      roots.stageIndex.textContent = `${String(index + 1).padStart(2, '0')} / ${String(list.length).padStart(2, '0')}`;
      roots.stage.querySelector('[data-nx45-award-open]')?.addEventListener('click', event => {
        cleanup();
        go(`/anime/${slug(event.currentTarget.dataset.title)}-${event.currentTarget.dataset.nx45AwardOpen}`);
      });
      roots.stage.querySelectorAll('[data-nx45-related-select]').forEach(button => button.addEventListener('click', () => {
        selectWinner(list.find(item => item.id === button.dataset.nx45RelatedSelect));
      }));
      syncCards();
    }

    function drawGrid() {
      const items = visibleItems();
      roots.grid.innerHTML = items.map((item, index) => cardMarkup(item, edition, index, icons)).join('');
      roots.count.textContent = `${items.length} ${items.length === 1 ? 'resultado' : 'resultados'}`;
      roots.grid.querySelectorAll('[data-nx45-award-select]').forEach(button => button.addEventListener('click', () => {
        selectWinner(items.find(item => item.id === button.dataset.nx45AwardSelect), true);
      }));
      bindBrokenImages(roots.grid);
      syncCards();
    }

    function drawFilters() {
      const available = new Set(edition.winners.map(item => item.group));
      const markup = GROUPS.filter(group => group.id === 'all' || available.has(group.id)).map(group => {
        const count = group.id === 'all' ? edition.winners.length : edition.winners.filter(item => item.group === group.id).length;
        return `<button type="button" data-nx45-group="${group.id}" class="${group.id === activeGroup ? 'is-active' : ''}" aria-pressed="${group.id === activeGroup}"><span>${esc(group.label)}</span><small>${count}</small></button>`;
      }).join('');
      roots.filters.forEach(root => {
        const island = root.hasAttribute('data-nx45-island-filters');
        root.innerHTML = island ? markup.replaceAll('data-nx45-group', 'data-nx45-island-group') : markup;
        root.querySelectorAll('[data-nx45-group],[data-nx45-island-group]').forEach(button => button.addEventListener('click', () => {
          activeGroup = button.dataset.nx45Group || button.dataset.nx45IslandGroup;
          selected = visibleItems()[0];
          drawFilters();
          drawGrid();
          drawFeature();
          syncIslandContext();
        }));
      });
    }

    function syncIslandContext() {
      const group = GROUPS.find(item => item.id === activeGroup)?.label || 'Todos';
      if (roots.islandContext && edition) roots.islandContext.textContent = `Edição ${edition.year} · ${group}`;
    }

    function drawYearControls() {
      const selectMarkup = editions.map(item => `<option value="${item.year}">${item.year}</option>`).join('');
      roots.yearSelects.forEach(select => {
        select.innerHTML = selectMarkup;
        select.addEventListener('change', event => setEdition(event.target.value));
      });
      const railMarkup = editions.map(item => `<button type="button" data-nx45-year="${item.year}" aria-pressed="false"><strong>${item.year}</strong><small>${item.winners.length} vencedores</small></button>`).join('');
      roots.yearRails.forEach(rail => {
        const island = rail.hasAttribute('data-nx45-island-years');
        rail.innerHTML = island ? railMarkup.replaceAll('data-nx45-year', 'data-nx45-island-year') : railMarkup;
        rail.querySelectorAll('[data-nx45-year],[data-nx45-island-year]').forEach(button => button.addEventListener('click', () => setEdition(button.dataset.nx45Year || button.dataset.nx45IslandYear)));
      });
    }

    function artKey(item) {
      return item.media_id ? `id:${item.media_id}` : `search:${plain(item.search || item.work || item.winner)}`;
    }

    function applyMediaArt(item, media) {
      if (!media) return;
      item.media_id ||= Number(media.id) || null;
      item.card_image = image(media) || item.card_image || '';
      item.feature_image ||= banner(media) || item.card_image || '';
    }

    async function hydrateEditionArt(target) {
      if (!target || target.artState === 'loading' || target.artState === 'ready') return;
      target.artState = 'loading';
      const groups = new Map();
      target.winners.forEach(item => {
        const key = artKey(item);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(item);
      });
      groups.forEach((items, key) => {
        const cached = mediaCache.get(key);
        if (cached) items.forEach(item => applyMediaArt(item, cached));
      });
      const pending = [...groups.entries()].filter(([key]) => !mediaCache.has(key));
      try {
        if (pending.length && gql) {
          const definitions = [];
          const fields = [];
          const variables = {};
          pending.forEach(([key, items], index) => {
            const variable = `v${index}`;
            const item = items[0];
            if (key.startsWith('id:')) {
              definitions.push(`$${variable}:Int`);
              variables[variable] = Number(item.media_id);
              fields.push(`a${index}:Page(page:1,perPage:1){media(id:$${variable},type:ANIME){id title{romaji english userPreferred} coverImage{extraLarge large} bannerImage}}`);
            } else {
              definitions.push(`$${variable}:String`);
              variables[variable] = item.search || item.work || item.winner;
              fields.push(`a${index}:Page(page:1,perPage:1){media(search:$${variable},type:ANIME,isAdult:false,sort:SEARCH_MATCH){id title{romaji english userPreferred} coverImage{extraLarge large} bannerImage}}`);
            }
          });
          const data = await gql(`query(${definitions.join(',')}){${fields.join(' ')}}`, variables, 86400, `awards-art:${target.year}`);
          pending.forEach(([key, items], index) => {
            const media = data?.[`a${index}`]?.media?.[0] || null;
            if (media) mediaCache.set(key, media);
            items.forEach(item => applyMediaArt(item, media));
          });
        } else if (pending.length) {
          await Promise.all(pending.map(async ([key, items]) => {
            const item = items[0];
            if (!item.media_id) return;
            try {
              const media = await getMedia(item.media_id, 'ANIME');
              mediaCache.set(key, media);
              items.forEach(entry => applyMediaArt(entry, media));
            } catch {}
          }));
        }
      } catch {
        try {
          if (target.hero_media_id) {
            const media = await getMedia(target.hero_media_id, 'ANIME');
            applyMediaArt(target.winners[0], media);
          }
        } catch {}
      }
      target.hero_image ||= target.winners[0]?.feature_image || target.winners.find(item => item.feature_image)?.feature_image || '';
      target.artState = 'ready';
      if (!disposed && edition === target) {
        drawGrid();
        drawFeature();
      }
    }

    function setEdition(year) {
      const next = editions.find(item => item.year === Number(year));
      if (!next) return;
      edition = next;
      activeGroup = 'all';
      selected = edition.winners[0];
      roots.yearTitle.textContent = edition.year;
      roots.yearSelects.forEach(select => { select.value = String(edition.year); });
      app.querySelectorAll('[data-nx45-year],[data-nx45-island-year]').forEach(button => {
        const active = Number(button.dataset.nx45Year || button.dataset.nx45IslandYear) === edition.year;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
        if (active) requestAnimationFrame(() => {
          const rail = button.closest('[data-nx45-years],[data-nx45-island-years]');
          if (rail?.scrollWidth > rail.clientWidth) rail.scrollTo({ left: Math.max(0, button.offsetLeft - (rail.clientWidth - button.offsetWidth) / 2), behavior: 'smooth' });
        });
      });
      drawFilters();
      drawGrid();
      drawFeature();
      syncIslandContext();
      hydrateEditionArt(edition);
    }

    function moveSelected(direction) {
      const items = visibleItems();
      if (!items.length) return;
      const current = Math.max(0, items.indexOf(selected));
      selectWinner(items[(current + direction + items.length) % items.length]);
    }

    function setIslandState(shown, expanded) {
      const island = roots.island;
      if (!island) return;
      const open = Boolean(shown && expanded);
      const panel = island.querySelector('.nx45-awards-island-panel');
      island.classList.toggle('show', Boolean(shown));
      island.classList.toggle('expanded', open);
      island.inert = !shown;
      island.setAttribute('aria-hidden', String(!shown));
      if (panel) {
        panel.inert = !open;
        panel.setAttribute('aria-hidden', String(!open));
      }
      island.querySelector('[data-nx45-island-toggle]')?.setAttribute('aria-expanded', String(open));
    }

    function updateScroll() {
      scrollFrame = 0;
      const y = Math.max(0, scrollY);
      const delta = y - lastScrollY;
      const headerHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nx43-header-height')) || 66;
      const shown = (roots.hero?.getBoundingClientRect().bottom || Infinity) < headerHeight;
      document.body.classList.toggle('nx45-awards-scrolled', shown);
      if (!shown) {
        document.body.classList.remove('nx45-awards-scroll-down', 'nx45-awards-scroll-up');
        setIslandState(false, false);
        lastScrollY = y;
        scrollDirection = 0;
        scrollTravel = 0;
        return;
      }
      roots.island.classList.add('show');
      roots.island.inert = false;
      roots.island.setAttribute('aria-hidden', 'false');
      if (Math.abs(delta) < 2) { lastScrollY = y; return; }
      const direction = delta > 0 ? 1 : -1;
      const visibleDirection = document.body.classList.contains('nx45-awards-scroll-down') ? 1 : document.body.classList.contains('nx45-awards-scroll-up') ? -1 : 0;
      if (visibleDirection && direction !== visibleDirection && performance.now() < scrollLockUntil) {
        lastScrollY = y;
        scrollDirection = visibleDirection;
        scrollTravel = 0;
        return;
      }
      if (direction !== scrollDirection) {
        scrollDirection = direction;
        scrollTravel = 0;
      }
      scrollTravel += Math.abs(delta);
      lastScrollY = y;
      if (direction > 0 && y > 118 && scrollTravel >= 20) {
        document.body.classList.add('nx45-awards-scroll-down');
        document.body.classList.remove('nx45-awards-scroll-up');
        setIslandState(true, false);
        scrollLockUntil = performance.now() + (matchMedia('(prefers-reduced-motion: reduce)').matches ? 40 : 380);
      } else if (direction < 0 && scrollTravel >= 12) {
        document.body.classList.add('nx45-awards-scroll-up');
        document.body.classList.remove('nx45-awards-scroll-down');
        setIslandState(true, true);
        scrollLockUntil = performance.now() + (matchMedia('(prefers-reduced-motion: reduce)').matches ? 40 : 380);
      }
    }

    function onScroll() {
      if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll);
    }

    function cleanup() {
      if (disposed) return;
      disposed = true;
      removeEventListener('scroll', onScroll);
      if (scrollFrame) cancelAnimationFrame(scrollFrame);
      document.documentElement.classList.remove('nx45-awards-boot');
      document.body.classList.remove('nx45-awards-active', 'nx45-awards-scrolled', 'nx45-awards-scroll-down', 'nx45-awards-scroll-up');
      roots.island?.remove();
      if (activeCleanup === cleanup) activeCleanup = null;
    }

    activeCleanup = cleanup;
    app.querySelector('[data-nx45-prev]').addEventListener('click', () => moveSelected(-1));
    app.querySelector('[data-nx45-next]').addEventListener('click', () => moveSelected(1));
    roots.island.querySelector('[data-nx45-island-toggle]').addEventListener('click', () => setIslandState(true, !roots.island.classList.contains('expanded')));
    addEventListener('scroll', onScroll, { passive: true });

    try {
      const [currentResponse, historyResponse] = await Promise.all([
        fetch(`${base}/data/awards-2026.json?v=${BUILD}`, { headers: { accept: 'application/json' } }),
        fetch(`${base}/data/awards-history.json?v=${BUILD}`, { headers: { accept: 'application/json' } })
      ]);
      if (!currentResponse.ok || !historyResponse.ok) throw new Error('Awards data unavailable');
      const [current, history] = await Promise.all([currentResponse.json(), historyResponse.json()]);
      if (disposed) return;
      editions = [normalizeCurrent(current), ...normalizeHistory(history)].sort((a, b) => b.year - a.year);
      drawYearControls();
      setEdition(editions[0].year);
      requestAnimationFrame(updateScroll);
    } catch {
      if (disposed) return;
      roots.stage.innerHTML = '<div class="nx45-awards-error"><strong>A premiação não carregou agora.</strong><p>Tente novamente em alguns instantes.</p></div>';
      roots.grid.innerHTML = '';
      roots.filters.forEach(root => { root.innerHTML = ''; });
    }
  }

  function routePath() {
    const restored = new URLSearchParams(location.search).get('p');
    let path = restored ? restored.split('?')[0] : location.pathname.replace(/^\/AniNexus/, '') || '/';
    return path.replace(/\/+$/, '') || '/';
  }

  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || !activeCleanup) return;
    try {
      const url = new URL(link.href, location.href);
      const path = url.searchParams.get('p')?.split('?')[0] || url.pathname.replace(/^\/AniNexus/, '') || '/';
      if (path.replace(/\/+$/, '') !== '/anime-awards') setTimeout(() => activeCleanup?.(), 0);
    } catch {}
  }, true);
  addEventListener('popstate', () => { if (routePath() !== '/anime-awards') activeCleanup?.(); });

  window.AniNexusAwardsPage = Object.freeze({ mount });
})();
