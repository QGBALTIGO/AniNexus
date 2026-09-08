'use strict';
(() => {
  if (window.__NX48_ACHIEVEMENTS__) return;
  window.__NX48_ACHIEVEMENTS__ = true;

  const app = document.querySelector('#app');
  if (!app) return;
  const IS_PAGES = location.hostname.endsWith('github.io');
  const BASE = IS_PAGES ? '/AniNexus' : '';
  const BUILD = '44.32.0';
  const PAGE_ROUTE = '/conquistas';
  const state = { data: null, catalog: [], statusFilter: 'ALL', tierFilter: 'ALL', busy: false, renderToken: 0, mountPromise: null, frame: 0, lastY: 0, direction: 0, travel: 0 };
  const categoryIcons = {
    PROFILE: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.25"/><path d="M5.5 19c.6-3.5 3-5.5 6.5-5.5s5.9 2 6.5 5.5"/></svg>',
    LIBRARY: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 5.5h5v13h-5zM9.5 5.5h5v13h-5zM16 6l3.5-.8 2.5 12.6-3.5.7z"/></svg>',
    COMPLETED: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="m8 12.2 2.6 2.6 5.7-6"/></svg>',
    EPISODES: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="m10.2 8.7 5.2 3.3-5.2 3.3z"/></svg>',
    RATINGS: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.7 2.6 5.2 5.7.8-4.1 4 1 5.7-5.2-2.7-5.2 2.7 1-5.7-4.1-4 5.7-.8z"/></svg>',
    COMMUNITY: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5.5h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-8l-5 3v-3H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z"/><path d="M8 9.5h8M8 12.5h5"/></svg>',
    GENRES: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="m15.4 8.6-2 4.8-4.8 2 2-4.8z"/><circle cx="12" cy="12" r=".8"/></svg>',
    STREAK: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.8 3.5c.5 3.2-2.3 4.1-2.3 6.5 0 1.2.7 2 1.7 2 1.6 0 2.5-1.6 2.1-3.5 2.1 1.5 3.2 3.6 3 5.7-.3 3.1-2.8 5.1-6.3 5.1-3.6 0-6.3-2.3-6.3-5.7 0-2.7 1.6-4.9 4.3-7-.1 2 .6 3.1 1.6 3.3-.2-2.6.4-4.7 2.2-6.4Z"/></svg>',
    ORGANIZATION: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h7M15 6h5M4 12h3M11 12h9M4 18h9M17 18h3"/><circle cx="13" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="15" cy="18" r="2"/></svg>',
  };
  const pinIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h6M9.5 4l1 5-4 3v2h11v-2l-4-3 1-5M12 14v7"/></svg>';
  const arrowIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg>';
  const trophyIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v4a4 4 0 0 1-8 0V4Z"/><path d="M8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 12v5M8 21h8M9 17h6"/></svg>';
  const downIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>';
  const layersIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 8 4-8 4-8-4 8-4Z"/><path d="m4 12 8 4 8-4M4 17l8 4 8-4"/></svg>';

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const route = () => {
    try {
      const url = new URL(location.href), restored = url.searchParams.get('p');
      let path = restored ? restored.split('?')[0] : url.pathname;
      if (IS_PAGES && !restored) path = path.replace(/^\/AniNexus/, '') || '/';
      return decodeURIComponent(String(path || '/')).replace(/\/+$/, '') || '/';
    } catch { return '/'; }
  };
  const pageUrl = path => IS_PAGES ? `${BASE}/?build=${BUILD}&p=${encodeURIComponent(path)}` : path;
  const go = path => {
    if (!IS_PAGES && window.AniNexusRadio?.navigate?.(path)) return;
    location.assign(pageUrl(path));
  };
  const publicRequest = async path => {
    if (window.AniNexusAuth?.enabled) return window.AniNexusAuth.publicApi(path);
    const response = await fetch(path, { headers: { accept: 'application/json' }, cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) throw Object.assign(new Error(`HTTP_${response.status}`), { status: response.status });
    return response.json();
  };
  const privateRequest = async (path, options = {}) => {
    if (window.AniNexusAuth?.enabled) return window.AniNexusAuth.api(path, options);
    const response = await fetch(path, {
      ...options, cache: 'no-store', credentials: 'same-origin',
      headers: { accept: 'application/json', ...(options.body ? { 'content-type': 'application/json' } : {}), ...(options.headers || {}) },
    });
    let body = {}; try { body = await response.json(); } catch {}
    if (!response.ok) throw Object.assign(new Error(body.error || `HTTP_${response.status}`), { status: response.status, code: body.error });
    return body;
  };
  const relative = value => {
    const elapsed = Math.max(0, Date.now() - Date.parse(value || 0)), minutes = Math.max(1, Math.floor(elapsed / 60000));
    if (minutes < 60) return `há ${minutes} min`;
    const hours = Math.floor(minutes / 60); if (hours < 24) return `há ${hours}h`;
    const days = Math.floor(hours / 24); return days < 30 ? `há ${days}d` : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(value)).replace('.', '');
  };
  const badge = (item, options = {}) => {
    const category = String(item.category || 'LIBRARY').toUpperCase(), tier = String(item.tier || 'BRONZE').toLowerCase();
    return `<span class="nx48-badge nx48-badge--${esc(tier)}${options.small ? ' nx48-badge--small' : ''}" data-category="${esc(category)}" aria-hidden="true"><i>${categoryIcons[category] || categoryIcons.LIBRARY}</i><b></b></span>`;
  };

  function feedCard(item) {
    const extra = Number(item.batchCount || 1) > 1 ? ` e mais ${Number(item.batchCount) - 1}` : '';
    return `<a class="nx48-feed-card" href="${esc(pageUrl(item.url))}" data-achievement-feed-card>
      ${badge(item, { small: true })}
      <div class="nx48-feed-copy"><p><strong>@${esc(item.username)}</strong> desbloqueou${esc(extra)}</p><h3>${esc(item.title)}</h3><span>${esc(item.unlockedDescription || item.description)}</span><footer><b>${esc(item.tierLabel)}</b><i>+${Number(item.xp)} Nexus XP</i><time>${esc(relative(item.unlockedAt))}</time></footer></div>
      <span class="nx48-feed-avatar">${item.avatarUrl ? `<img src="${esc(item.avatarUrl)}" alt="" loading="lazy" decoding="async">` : esc(String(item.displayName || item.username).charAt(0).toUpperCase())}</span>
    </a>`;
  }

  async function paintHomeFeed(root = document.querySelector('#nx35Achievements')) {
    if (!root) return;
    const section = root.closest('.nx35-achievement-section');
    try {
      const payload = await publicRequest('/api/achievements/feed?limit=16'), items = payload?.items || [];
      if (!items.length) { root.replaceChildren(); if (section) section.hidden = true; return; }
      if (section) section.hidden = false;
      root.className = 'nx48-achievement-feed';
      root.innerHTML = `<div class="nx35-edge"><div class="nx35-rail nx48-achievement-feed-rail">${items.map(feedCard).join('')}</div></div>`;
      window.AniNexusRails?.refresh?.();
    } catch { root.replaceChildren(); if (section) section.hidden = true; }
  }

  function card(item, authenticated) {
    const current = Math.min(Number(item.progress || 0), Number(item.target || 1)), unlocked = item.unlocked === true;
    const progress = Math.min(100, Math.round((current / Math.max(1, Number(item.target || 1))) * 100));
    const description = unlocked ? item.unlockedDescription || item.description : item.description;
    return `<article class="nx48-achievement-card nx48-achievement-card--${String(item.tier || '').toLowerCase()}${unlocked ? ' is-unlocked' : ' is-locked'}" data-achievement-id="${esc(item.id)}" aria-label="${esc(item.title)}. ${esc(description)}${unlocked ? '. Desbloqueada' : `. ${progress}% concluída`}">
      <header>${badge(item)}${authenticated && unlocked ? `<button type="button" class="nx48-pin${item.pinnedSlot ? ' is-pinned' : ''}" data-achievement-pin="${esc(item.id)}" aria-pressed="${Boolean(item.pinnedSlot)}" aria-label="${item.pinnedSlot ? 'Desafixar' : 'Fixar'} ${esc(item.title)}" title="${item.pinnedSlot ? 'Desafixar do perfil' : 'Fixar no perfil'}">${pinIcon}</button>` : ''}</header>
      <div class="nx48-card-copy"><small>${esc(item.categoryLabel)} · ${esc(item.tierLabel)}</small><h3>${esc(item.title)}</h3><p>${esc(description)}</p></div>
    </article>`;
  }

  function filteredItems() {
    const items = state.data?.items || state.catalog || [];
    return items.filter(item => {
      if (state.statusFilter === 'UNLOCKED' && !item.unlocked) return false;
      if (state.statusFilter === 'LOCKED' && item.unlocked) return false;
      return state.tierFilter === 'ALL' || item.tier === state.tierFilter;
    });
  }

  function paintCards() {
    const root = app.querySelector('[data-achievement-grid]');
    if (!root) return;
    const items = filteredItems();
    root.innerHTML = items.length ? items.map(item => card(item, Boolean(state.data))).join('') : '<div class="nx48-empty">Nenhuma conquista corresponde a estes filtros.</div>';
    app.querySelectorAll('[data-achievement-visible-count]').forEach(node => { node.textContent = `${items.length} ${items.length === 1 ? 'marco' : 'marcos'}`; });
    wireCards();
  }

  function summaryMarkup(data) {
    const unlocked = Number(data?.unlockedCount || 0), total = Number(data?.total || state.catalog.length || 0), percentage = Number(data?.percentage || 0);
    const level = data?.level || { name: 'Nível Nexus 1', xp: 0, levelFloor: 0, nextXp: 30 };
    const levelProgress = Math.max(0, Math.min(100, Math.round(((Number(level.xp) - Number(level.levelFloor || 0)) / Math.max(1, Number(level.nextXp) - Number(level.levelFloor || 0))) * 100)));
    return `<section class="nx48-overview" aria-label="Progresso das conquistas"><div class="nx48-overview-main"><small>SUA JORNADA</small><strong>${unlocked} <span>de ${total}</span></strong><p>${percentage}% concluído · ${esc(level.name)}</p></div><div class="nx48-overview-xp"><span><b>${Number(level.xp).toLocaleString('pt-BR')} Nexus XP</b><em>Faltam ${Math.max(0, Number(level.nextXp) - Number(level.xp)).toLocaleString('pt-BR')} XP para o próximo nível</em></span><progress max="100" value="${levelProgress}">${levelProgress}%</progress></div></section>`;
  }

  function settingsMarkup(data) {
    if (!data) return `<div class="nx48-guest"><p>Entre para acompanhar seu progresso, fixar medalhas e equipar títulos.</p><a href="${esc(pageUrl('/login'))}">Entrar ${arrowIcon}</a></div>`;
    const titleOptions = ['<option value="">Sem título equipado</option>', ...(data.availableTitles || []).map(title => `<option value="${esc(title)}"${data.equippedTitle === title ? ' selected' : ''}>${esc(title)}</option>`)].join('');
    const timezones = [['America/Sao_Paulo', 'Brasília'], ['America/Cuiaba', 'Cuiabá'], ['America/Manaus', 'Manaus'], ['America/Rio_Branco', 'Rio Branco']];
    return `<section class="nx48-preferences" aria-label="Preferências das conquistas"><label class="nx48-toggle"><input type="checkbox" data-achievement-feed-toggle${data.preferences?.shareFeed !== false ? ' checked' : ''}><span></span><b>Compartilhar conquistas no feed</b></label><label><span>Título no perfil</span><select data-achievement-title>${titleOptions}</select></label><label><span>Fuso da sequência</span><select data-achievement-timezone>${timezones.map(([value, label]) => `<option value="${value}"${data.preferences?.timezone === value ? ' selected' : ''}>${label}</option>`).join('')}</select></label><p data-achievement-feedback aria-live="polite"></p></section>`;
  }

  function pinnedMarkup(data) {
    if (!data?.pins?.length) return '';
    const byId = new Map((data.items || []).map(item => [item.id, item])), items = data.pins.map(id => byId.get(id)).filter(Boolean);
    return `<section class="nx48-pinned"><header><small>NO SEU PERFIL</small><h2>Medalhas fixadas</h2></header><div>${items.map(item => `<button type="button" data-achievement-focus="${esc(item.id)}">${badge(item, { small: true })}<span><strong>${esc(item.title)}</strong><small>${esc(item.tierLabel)}</small></span></button>`).join('')}</div></section>`;
  }

  function filtersMarkup(compact = false) {
    const statuses = [['ALL', 'Todas'], ['UNLOCKED', 'Desbloqueadas'], ['LOCKED', 'Bloqueadas']];
    const tiers = [['ALL', 'Todos os níveis'], ['BRONZE', 'Bronze'], ['SILVER', 'Prata'], ['GOLD', 'Ouro'], ['PLATINUM', 'Platina'], ['DIAMOND', 'Diamante']];
    return `<div class="nx48-filters${compact ? ' is-compact' : ''}"><div class="nx48-status-filter" role="group" aria-label="Filtrar por estado">${statuses.map(([key, label]) => `<button type="button" class="${state.statusFilter === key ? 'active' : ''}" data-achievement-filter="${key}" aria-pressed="${state.statusFilter === key}">${label}</button>`).join('')}</div><label class="nx48-tier-filter">${layersIcon}<span>Filtrar por nível</span><select data-achievement-tier aria-label="Filtrar conquistas por nível">${tiers.map(([key, label]) => `<option value="${key}"${state.tierFilter === key ? ' selected' : ''}>${label}</option>`).join('')}</select>${downIcon}</label></div>`;
  }

  function islandMarkup(data) {
    const unlocked = Number(data?.unlockedCount || 0), total = Number(data?.total || state.catalog.length || 0), level = data?.level?.name || 'Nível Nexus 1';
    return `<section class="nx48-achievements-island" aria-label="Controles das conquistas" aria-hidden="true" inert><button type="button" class="nx48-achievements-island-head" data-achievement-island-toggle aria-label="Abrir filtros das conquistas" aria-expanded="false"><span class="nx48-achievements-island-icon">${trophyIcon}</span><span class="nx48-achievements-island-copy"><strong>Conquistas</strong><small>${unlocked} DE ${total} · ${esc(level)}</small></span><span class="nx48-achievements-island-arrow">${downIcon}</span></button><div class="nx48-achievements-island-panel" aria-hidden="true" inert><div><div class="nx48-achievements-island-inner">${filtersMarkup(true)}</div></div></div></section>`;
  }

  function shell(data, catalog) {
    state.data = data;
    state.catalog = data?.items || catalog || [];
    const unlocked = Number(data?.unlockedCount || 0), total = Number(data?.total || state.catalog.length || 0), level = data?.level?.name || 'Nível Nexus 1';
    document.title = 'Conquistas | AniNexus';
    document.body.classList.remove('nx35-home-active', 'nx38-library-active', 'nx38-profile-active', 'aqx-home-active');
    document.body.classList.add('nx48-achievements-active');
    app.innerHTML = `<main class="nx48-achievements-page"><header class="nx48-page-head" id="nx48AchievementsHero"><div class="nx48-page-head-inner"><div class="nx48-page-title"><span>${trophyIcon}</span><div><h1>Conquistas</h1><small>${unlocked} DE ${total} · ${esc(level)}</small></div></div><p>Acompanhe sua evolução e escolha as medalhas que aparecem no seu perfil.</p></div></header>${islandMarkup(data)}<div class="nx48-shell">${summaryMarkup(data)}${pinnedMarkup(data)}<section class="nx48-collection"><header class="nx48-content-head"><div><small>SUA COLEÇÃO</small><h2>Conquistas</h2></div><span data-achievement-visible-count></span></header>${filtersMarkup()}<div class="nx48-grid" data-achievement-grid aria-live="polite"></div></section>${settingsMarkup(data)}</div></main>`;
    state.lastY = Math.max(0, scrollY); state.direction = 0; state.travel = 0;
    paintCards(); wirePage();
    requestAnimationFrame(() => { document.documentElement.classList.remove('nx48-achievements-boot'); syncScroll(); });
  }

  function feedback(message, error = false) {
    const target = app.querySelector('[data-achievement-feedback]');
    if (!target) return;
    target.textContent = message; target.classList.toggle('is-error', error);
  }

  async function savePins(id) {
    if (!state.data || state.busy) return;
    const pins = [...(state.data.pins || [])], index = pins.indexOf(id);
    if (index >= 0) pins.splice(index, 1);
    else if (pins.length >= 3) { feedback('Você pode fixar até três medalhas.', true); return; }
    else pins.push(id);
    state.busy = true;
    state.renderToken += 1;
    try {
      state.data = await privateRequest('/api/me/achievements/pins', { method: 'PUT', body: JSON.stringify({ ids: pins }) });
      shell(state.data, state.catalog); feedback('Medalhas do perfil atualizadas.');
    } catch { feedback('Não foi possível atualizar as medalhas agora.', true); }
    finally { state.busy = false; }
  }

  function wireCards() {
    app.querySelectorAll('[data-achievement-pin]').forEach(button => button.addEventListener('click', () => savePins(button.dataset.achievementPin)));
    app.querySelectorAll('[data-achievement-focus]').forEach(button => button.addEventListener('click', () => {
      const target = app.querySelector(`[data-achievement-id="${CSS.escape(button.dataset.achievementFocus)}"]`);
      target?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    }));
  }

  function wirePage() {
    app.querySelectorAll('[data-achievement-filter]').forEach(button => button.addEventListener('click', () => {
      state.statusFilter = button.dataset.achievementFilter;
      app.querySelectorAll('[data-achievement-filter]').forEach(item => { const active = item.dataset.achievementFilter === state.statusFilter; item.classList.toggle('active', active); item.setAttribute('aria-pressed', String(active)); });
      paintCards();
    }));
    app.querySelectorAll('[data-achievement-tier]').forEach(select => select.addEventListener('change', event => {
      state.tierFilter = event.currentTarget.value;
      app.querySelectorAll('[data-achievement-tier]').forEach(item => { item.value = state.tierFilter; });
      paintCards();
    }));
    app.querySelector('[data-achievement-island-toggle]')?.addEventListener('click', () => {
      const island = app.querySelector('.nx48-achievements-island');
      setIsland(true, !island?.classList.contains('expanded'));
    });
    app.querySelector('[data-achievement-feed-toggle]')?.addEventListener('change', async event => {
      try { state.data = await privateRequest('/api/me/achievements/preferences', { method: 'PATCH', body: JSON.stringify({ shareFeed: event.currentTarget.checked }) }); feedback('Preferência do feed atualizada.'); }
      catch { event.currentTarget.checked = !event.currentTarget.checked; feedback('Não foi possível salvar essa preferência.', true); }
    });
    app.querySelector('[data-achievement-title]')?.addEventListener('change', async event => {
      try { state.data = await privateRequest('/api/me/achievements/preferences', { method: 'PATCH', body: JSON.stringify({ equippedTitle: event.currentTarget.value || null }) }); feedback('Título do perfil atualizado.'); }
      catch { feedback('Esse título ainda não está disponível.', true); }
    });
    app.querySelector('[data-achievement-timezone]')?.addEventListener('change', async event => {
      try { state.data = await privateRequest('/api/me/achievements/preferences', { method: 'PATCH', body: JSON.stringify({ timezone: event.currentTarget.value }) }); feedback('Fuso da sequência atualizado.'); }
      catch { feedback('Não foi possível salvar o fuso agora.', true); }
    });
  }

  function setIsland(shown, expanded = false) {
    const island = app.querySelector('.nx48-achievements-island');
    if (!island) return;
    const open = Boolean(shown && expanded), panel = island.querySelector('.nx48-achievements-island-panel');
    island.classList.toggle('show', Boolean(shown)); island.classList.toggle('expanded', open); island.inert = !shown;
    island.setAttribute('aria-hidden', String(!shown)); panel.inert = !open; panel.setAttribute('aria-hidden', String(!open));
    island.querySelector('[data-achievement-island-toggle]')?.setAttribute('aria-expanded', String(open));
  }

  function syncScroll() {
    if (route() !== PAGE_ROUTE || !document.body.classList.contains('nx48-achievements-active') || state.frame) return;
    state.frame = requestAnimationFrame(() => {
      state.frame = 0;
      const y = Math.max(0, scrollY), delta = y - state.lastY, headerHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nx43-header-height')) || 66;
      const shown = (app.querySelector('#nx48AchievementsHero')?.getBoundingClientRect().bottom || Infinity) < headerHeight;
      if (!shown) {
        document.body.classList.remove('nx48-achievements-scroll-down', 'nx48-achievements-scroll-up'); setIsland(false, false); state.travel = 0; state.lastY = y; return;
      }
      setIsland(true, app.querySelector('.nx48-achievements-island')?.classList.contains('expanded'));
      if (Math.abs(delta) < 2) { state.lastY = y; return; }
      const direction = delta > 0 ? 1 : -1;
      if (direction !== state.direction) { state.direction = direction; state.travel = 0; }
      state.travel += Math.abs(delta); state.lastY = y;
      if (direction > 0 && state.travel >= 20) {
        document.body.classList.add('nx48-achievements-scroll-down'); document.body.classList.remove('nx48-achievements-scroll-up'); setIsland(true, false); state.travel = 0;
      } else if (direction < 0 && state.travel >= 12) {
        document.body.classList.add('nx48-achievements-scroll-up'); document.body.classList.remove('nx48-achievements-scroll-down'); state.travel = 0;
      }
    });
  }

  async function mount(options = {}) {
    if (route() !== PAGE_ROUTE) return;
    const force = options === true || options?.force === true;
    if (!force && state.mountPromise) return state.mountPromise;
    if (!force && document.body.classList.contains('nx48-achievements-active') && app.querySelector('.nx48-achievements-page') && (state.data || state.catalog.length)) return;
    const task = (async () => {
      const token = ++state.renderToken;
      document.documentElement.classList.add('nx48-achievements-boot');
      document.body.classList.add('nx48-achievements-active');
      app.innerHTML = '<main class="nx48-achievements-page"><div class="nx48-shell"><div class="nx48-loading"><i></i><span>Organizando suas conquistas…</span></div></div></main>';
      let catalog = [];
      try { catalog = (await publicRequest('/api/achievements/catalog')).items || []; } catch {}
      let data = null;
      try { data = await privateRequest('/api/me/achievements'); }
      catch (error) { if (error.status !== 401 && error.status !== 503) console.warn('[AniNexus achievements]', error); }
      if (token !== state.renderToken || route() !== PAGE_ROUTE) return;
      if (!data && !catalog.length) {
        app.innerHTML = `<main class="nx48-achievements-page"><div class="nx48-shell"><div class="nx48-unavailable"><h1>Conquistas indisponíveis agora</h1><p>Não foi possível consultar a coleção. Tente novamente em instantes.</p><button type="button" data-achievement-retry>Tentar novamente</button></div></div></main>`;
        app.querySelector('[data-achievement-retry]')?.addEventListener('click', () => mount({ force: true }), { once: true });
        document.documentElement.classList.remove('nx48-achievements-boot'); return;
      }
      shell(data, catalog.map(item => ({ ...item, progress: 0, unlocked: false })));
    })();
    state.mountPromise = task;
    try { return await task; }
    finally { if (state.mountPromise === task) state.mountPromise = null; }
  }

  window.AniNexusAchievements = Object.freeze({ badge, categoryIcons, paintHomeFeed, mount, go, pageUrl });
  addEventListener('scroll', syncScroll, { passive: true });
  addEventListener('popstate', () => { if (route() === PAGE_ROUTE) mount(); else document.body.classList.remove('nx48-achievements-active', 'nx48-achievements-scroll-down', 'nx48-achievements-scroll-up'); });
  addEventListener('aninexus:navigate', () => { if (route() === PAGE_ROUTE) mount(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
})();
