'use strict';

(() => {
  const BUILD = '44.24.6';
  const GROUPS = [
    { id: 'all', label: 'Todos' },
    { id: 'highlights', label: 'Destaques' },
    { id: 'production', label: 'Produção' },
    { id: 'genres', label: 'Gêneros' },
    { id: 'characters', label: 'Personagens' },
    { id: 'music', label: 'Música' },
    { id: 'voices', label: 'Vozes' }
  ];

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  const slug = value => String(value || 'anime')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 90) || 'anime';

  function groupFor(category = '') {
    const value = category.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (/performance|voz|dublagem/.test(value)) return 'voices';
    if (/abertura|encerramento|musica|trilha sonora/.test(value)) return 'music';
    if (/personagem|protagonista|antagonista|garot|heroi|vilao|casal|cena de luta|comovente/.test(value)) return 'characters';
    if (/animacao|direcao|design|cenario|arte|cinematografia|\bcg\b/.test(value)) return 'production';
    if (/anime de|isekai|fantasia|romance|comedia|drama|acao|slice of life/.test(value)) return 'genres';
    return 'highlights';
  }

  function splitHistoricWinner(value = '') {
    const parts = value.split(',').map(part => part.trim()).filter(Boolean);
    return { winner: parts.shift() || value, detail: parts.join(', ') };
  }

  function normalizeHistory(history) {
    return (history?.editions || []).map(edition => ({
      year: Number(edition.year),
      hero_media_id: Number(edition.hero_media_id) || null,
      source: history.source,
      winners: (edition.winners || []).map((item, index) => {
        const parts = splitHistoricWinner(item.winner);
        return {
          id: `${edition.year}-${index + 1}`,
          group: groupFor(item.category),
          category: item.category,
          winner: parts.winner,
          detail: parts.detail,
          work: '',
          credit: '',
          media_id: index === 0 ? Number(edition.hero_media_id) || null : null,
          feature_image: ''
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
      winners: (data?.winners || []).map((item, index) => ({
        ...item,
        id: item.id || `2026-${index + 1}`,
        group: item.group || groupFor(item.category),
        media_id: Number(item.media_id) || null,
        feature_image: String(item.feature_image || featureImages[item.id] || ''),
        detail: ''
      }))
    };
  }

  function artMarkup(src, item, year, wide = false) {
    const alt = item?.work || item?.winner || `Anime Awards ${year}`;
    return `<span class="nx45-award-art-placeholder" aria-hidden="true"><b>${year}</b><small>ANINEXUS<br>AWARDS</small></span>${src ? `<img ${wide ? '' : 'loading="lazy" '}decoding="async" src="${esc(src)}" alt="${esc(alt)}" data-nx45-award-image>` : ''}`;
  }

  function featureMarkup(item, edition, icons) {
    const src = item.feature_image || edition.hero_image || '';
    const showWork = item.work && item.work.toLowerCase() !== item.winner.toLowerCase();
    const detail = item.detail || item.credit || '';
    const title = item.winner || item.work;
    const cta = item.media_id
      ? `<button type="button" class="nx45-award-open" data-nx45-award-open="${item.media_id}" data-title="${esc(item.work || item.winner)}">Ver no AniNexus ${icons.arrow}</button>`
      : '';
    return `<article class="nx45-award-feature" data-feature-id="${esc(item.id)}">
      <div class="nx45-award-feature-art">${artMarkup(src, item, edition.year, true)}<span></span></div>
      <div class="nx45-award-feature-copy">
        <span class="nx45-award-mark">${icons.trophy}<b>Vencedor ${edition.year}</b></span>
        <p>${esc(item.category)}</p>
        <h2>${esc(title)}</h2>
        ${showWork ? `<strong>${esc(item.work)}</strong>` : ''}
        ${detail ? `<small>${esc(detail)}</small>` : ''}
        ${cta}
      </div>
    </article>`;
  }

  function cardMarkup(item, edition, index, icons) {
    const src = item.feature_image || '';
    const showWork = item.work && item.work.toLowerCase() !== item.winner.toLowerCase();
    const detail = showWork ? item.work : item.detail || item.credit || '';
    return `<button type="button" class="nx45-award-card" data-nx45-award-select="${esc(item.id)}" aria-pressed="false" aria-label="Destacar ${esc(item.category)}: ${esc(item.winner)}">
      <span class="nx45-award-card-art ${src ? '' : 'is-archive'}">${artMarkup(src, item, edition.year)}<i>${String(index + 1).padStart(2, '0')}</i></span>
      <span class="nx45-award-card-copy">
        <small>${icons.trophy}${esc(item.category)}</small>
        <strong>${esc(item.winner)}</strong>
        ${detail ? `<span>${esc(detail)}</span>` : ''}
      </span>
      <span class="nx45-award-card-arrow" aria-hidden="true">${icons.arrow}</span>
    </button>`;
  }

  async function mount(ctx) {
    const { app, base = '', icons, go, getMedia, banner, image, stopTimers, meta } = ctx;
    stopTimers();
    meta('AniNexus Awards');
    app.innerHTML = `<main class="nx45-awards-page" data-nx45-awards>
      <section class="nx45-awards-intro">
        <div class="shell nx45-awards-intro-inner">
          <div class="nx45-awards-title">
            <span>${icons.trophy} ANINEXUS AWARDS</span>
            <h1>Vencedores de <em data-nx45-year-title>2026</em></h1>
            <p>As obras, artistas e vozes reconhecidas em cada edição da premiação.</p>
          </div>
          <div class="nx45-awards-year-control">
            <label for="nx45AwardsYear">Edição</label>
            <select id="nx45AwardsYear" data-nx45-year-select aria-label="Selecionar edição do Anime Awards"></select>
          </div>
        </div>
        <div class="shell nx45-awards-years" data-nx45-years aria-label="Edições do Anime Awards"></div>
      </section>
      <section class="nx45-awards-content">
        <div class="shell">
          <div class="nx45-awards-stage-head">
            <div><small>DESTAQUE DA EDIÇÃO</small><strong data-nx45-stage-index>01 / 32</strong></div>
            <div class="nx45-awards-stage-nav">
              <button type="button" data-nx45-prev aria-label="Vencedor anterior">${icons.arrow}</button>
              <button type="button" data-nx45-next aria-label="Próximo vencedor">${icons.arrow}</button>
            </div>
          </div>
          <div class="nx45-awards-stage" data-nx45-stage aria-live="polite">
            <div class="nx45-award-loading"></div>
          </div>
          <div class="nx45-awards-filter-wrap">
            <div class="nx45-awards-filters" data-nx45-filters aria-label="Categorias da premiação"></div>
          </div>
          <header class="nx45-awards-gallery-head">
            <div><small>GALERIA DE VENCEDORES</small><h2>Todos os vencedores</h2></div>
            <span data-nx45-count>32 resultados</span>
          </header>
          <div class="nx45-awards-grid" data-nx45-grid aria-live="polite"></div>
          <p class="nx45-awards-source">Fonte: <a href="https://www.crunchyroll.com/animeawards/pastwinners/" target="_blank" rel="noopener noreferrer">Crunchyroll Anime Awards</a></p>
        </div>
      </section>
    </main>`;

    const roots = {
      yearTitle: app.querySelector('[data-nx45-year-title]'),
      yearSelect: app.querySelector('[data-nx45-year-select]'),
      years: app.querySelector('[data-nx45-years]'),
      stage: app.querySelector('[data-nx45-stage]'),
      stageIndex: app.querySelector('[data-nx45-stage-index]'),
      filters: app.querySelector('[data-nx45-filters]'),
      grid: app.querySelector('[data-nx45-grid]'),
      count: app.querySelector('[data-nx45-count]')
    };

    let editions = [];
    let edition = null;
    let selected = null;
    let activeGroup = 'all';
    const mediaCache = new Map();

    function visibleItems() {
      if (!edition) return [];
      return activeGroup === 'all' ? edition.winners : edition.winners.filter(item => item.group === activeGroup);
    }

    function bindBrokenImages(scope) {
      scope.querySelectorAll('[data-nx45-award-image]').forEach(node => node.addEventListener('error', () => {
        node.hidden = true;
        node.parentElement?.classList.add('image-failed');
      }, { once: true }));
    }

    function syncCards() {
      roots.grid.querySelectorAll('[data-nx45-award-select]').forEach(button => {
        const active = button.dataset.nx45AwardSelect === selected?.id;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      });
    }

    function drawFeature() {
      if (!selected || !edition) return;
      roots.stage.innerHTML = featureMarkup(selected, edition, icons);
      roots.stage.classList.remove('is-changing');
      bindBrokenImages(roots.stage);
      const list = visibleItems();
      const index = Math.max(0, list.indexOf(selected));
      roots.stageIndex.textContent = `${String(index + 1).padStart(2, '0')} / ${String(list.length).padStart(2, '0')}`;
      roots.stage.querySelector('[data-nx45-award-open]')?.addEventListener('click', event => {
        go(`/anime/${slug(event.currentTarget.dataset.title)}-${event.currentTarget.dataset.nx45AwardOpen}`);
      });
      syncCards();
    }

    function drawGrid() {
      const items = visibleItems();
      roots.grid.innerHTML = items.map((item, index) => cardMarkup(item, edition, index, icons)).join('');
      roots.count.textContent = `${items.length} ${items.length === 1 ? 'resultado' : 'resultados'}`;
      roots.grid.querySelectorAll('[data-nx45-award-select]').forEach(button => button.addEventListener('click', () => {
        const next = items.find(item => item.id === button.dataset.nx45AwardSelect);
        if (!next || next === selected) return;
        selected = next;
        roots.stage.classList.add('is-changing');
        requestAnimationFrame(drawFeature);
        if (matchMedia('(max-width: 720px)').matches) roots.stage.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }));
      bindBrokenImages(roots.grid);
      syncCards();
    }

    function drawFilters() {
      const available = new Set(edition.winners.map(item => item.group));
      roots.filters.innerHTML = GROUPS.filter(group => group.id === 'all' || available.has(group.id)).map(group => {
        const count = group.id === 'all' ? edition.winners.length : edition.winners.filter(item => item.group === group.id).length;
        return `<button type="button" data-nx45-group="${group.id}" class="${group.id === activeGroup ? 'is-active' : ''}" aria-pressed="${group.id === activeGroup}"><span>${esc(group.label)}</span><small>${count}</small></button>`;
      }).join('');
      roots.filters.querySelectorAll('[data-nx45-group]').forEach(button => button.addEventListener('click', () => {
        activeGroup = button.dataset.nx45Group;
        selected = visibleItems()[0];
        drawFilters();
        drawGrid();
        drawFeature();
      }));
    }

    async function hydrateHero(target) {
      if (!target?.hero_media_id || target.hero_image) return;
      let media = mediaCache.get(target.hero_media_id);
      if (!media) {
        try {
          media = await getMedia(target.hero_media_id, 'ANIME');
          mediaCache.set(target.hero_media_id, media);
        } catch {
          media = null;
        }
      }
      if (!media || edition !== target) return;
      target.hero_image = banner(media) || image(media) || '';
      if (target.hero_image) {
        drawFeature();
        drawGrid();
      }
    }

    function setEdition(year) {
      const next = editions.find(item => item.year === Number(year));
      if (!next) return;
      edition = next;
      activeGroup = 'all';
      selected = edition.winners[0];
      roots.yearTitle.textContent = edition.year;
      roots.yearSelect.value = String(edition.year);
      let activeYearButton = null;
      roots.years.querySelectorAll('[data-nx45-year]').forEach(button => {
        const active = Number(button.dataset.nx45Year) === edition.year;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
        if (active) activeYearButton = button;
      });
      if (activeYearButton && roots.years.scrollWidth > roots.years.clientWidth) {
        const left = activeYearButton.offsetLeft - (roots.years.clientWidth - activeYearButton.offsetWidth) / 2;
        roots.years.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
      }
      drawFilters();
      drawGrid();
      drawFeature();
      hydrateHero(edition);
    }

    function moveSelected(direction) {
      const items = visibleItems();
      if (!items.length) return;
      const current = Math.max(0, items.indexOf(selected));
      selected = items[(current + direction + items.length) % items.length];
      roots.stage.classList.add('is-changing');
      requestAnimationFrame(drawFeature);
    }

    app.querySelector('[data-nx45-prev]').addEventListener('click', () => moveSelected(-1));
    app.querySelector('[data-nx45-next]').addEventListener('click', () => moveSelected(1));
    roots.yearSelect.addEventListener('change', event => setEdition(event.target.value));

    try {
      const [currentResponse, historyResponse] = await Promise.all([
        fetch(`${base}/data/awards-2026.json?v=${BUILD}`, { headers: { accept: 'application/json' } }),
        fetch(`${base}/data/awards-history.json?v=${BUILD}`, { headers: { accept: 'application/json' } })
      ]);
      if (!currentResponse.ok || !historyResponse.ok) throw new Error('Awards data unavailable');
      const [current, history] = await Promise.all([currentResponse.json(), historyResponse.json()]);
      editions = [normalizeCurrent(current), ...normalizeHistory(history)].sort((a, b) => b.year - a.year);
      roots.yearSelect.innerHTML = editions.map(item => `<option value="${item.year}">${item.year}</option>`).join('');
      roots.years.innerHTML = editions.map(item => `<button type="button" data-nx45-year="${item.year}" aria-pressed="false"><strong>${item.year}</strong><small>${item.winners.length} vencedores</small></button>`).join('');
      roots.years.querySelectorAll('[data-nx45-year]').forEach(button => button.addEventListener('click', () => setEdition(button.dataset.nx45Year)));
      setEdition(editions[0].year);
    } catch {
      roots.stage.innerHTML = '<div class="nx45-awards-error"><strong>A premiação não carregou agora.</strong><p>Tente novamente em alguns instantes.</p></div>';
      roots.grid.innerHTML = '';
      roots.filters.innerHTML = '';
    }
  }

  window.AniNexusAwardsPage = Object.freeze({ mount });
})();
