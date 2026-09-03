'use strict';
(() => {
  if (window.__NX48_ACHIEVEMENTS__) return;
  window.__NX48_ACHIEVEMENTS__ = true;

  const app = document.querySelector('#app');
  if (!app) return;
  const IS_PAGES = location.hostname.endsWith('github.io');
  const BASE = IS_PAGES ? '/AniNexus' : '';
  const BUILD = '44.15.0';
  const PAGE_ROUTE = '/conquistas';
  const state = { data: null, catalog: [], filter: 'ALL', busy: false, renderToken: 0, mountPromise: null };
  const tierOrder = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'];
  const categoryIcons = {
    PROFILE: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6.5 16c.7-1.7 4.3-1.7 5 0M14 9h3M14 13h3"/></svg>',
    LIBRARY: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h5v14H4zM10 5h5v14h-5zM16 6l4-1 2 13-4 1z"/></svg>',
    COMPLETED: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h16v11H4zM4 8l3-4 3 4 3-4 3 4 3-4 1 4M8 13l2.5 2.5L16 10"/></svg>',
    EPISODES: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4V8Z"/></svg>',
    RATINGS: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="m12 7 1.5 3 3.5.5-2.5 2.4.6 3.5-3.1-1.7-3.1 1.7.6-3.5L7 10.5l3.5-.5L12 7Z"/></svg>',
    COMMUNITY: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-5 4v-4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><path d="M8 10h8M8 13h5"/></svg>',
    GENRES: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/></svg>',
    STREAK: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16M12 17c-2 0-3-1.1-3-2.5 0-1 .7-1.9 1.6-2.5 0 1 .6 1.6 1.4 1.8.2-1.2 1-2 1.8-2.8.8 1 1.2 2.1 1.2 3.3 0 1.5-1.1 2.7-3 2.7Z"/></svg>',
    ORGANIZATION: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6h14M5 12h14M5 18h14"/><circle cx="8" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="10" cy="18" r="2"/></svg>',
  };
  const pinIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 4 6 0 1 5 3 3v2H5v-2l3-3 1-5ZM12 14v7"/></svg>';
  const arrowIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg>';

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
  const date = value => new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value));
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
    return `<article class="nx48-achievement-card nx48-achievement-card--${String(item.tier || '').toLowerCase()}${unlocked ? ' is-unlocked' : ' is-locked'}" data-achievement-id="${esc(item.id)}">
      <header>${badge(item)}${authenticated && unlocked ? `<button type="button" class="nx48-pin${item.pinnedSlot ? ' is-pinned' : ''}" data-achievement-pin="${esc(item.id)}" aria-pressed="${Boolean(item.pinnedSlot)}" aria-label="${item.pinnedSlot ? 'Desafixar' : 'Fixar'} ${esc(item.title)}" title="${item.pinnedSlot ? 'Desafixar do perfil' : 'Fixar no perfil'}">${pinIcon}</button>` : ''}</header>
      <div class="nx48-card-copy"><small>${esc(item.categoryLabel)} · ${esc(item.tierLabel)}</small><h3>${esc(item.title)}</h3><p>${esc(unlocked ? item.unlockedDescription || item.description : item.description)}</p></div>
      ${unlocked ? `<footer class="nx48-card-unlocked"><span>Desbloqueada em ${esc(date(item.unlockedAt))}</span><strong>${esc(item.tierLabel)} · ${Number(item.xp)} XP</strong></footer>` : `<footer class="nx48-card-progress"><div><span>${current.toLocaleString('pt-BR')} / ${Number(item.target).toLocaleString('pt-BR')}</span><b>${progress}%</b></div><progress max="100" value="${progress}">${progress}%</progress></footer>`}
    </article>`;
  }

  function filteredItems() {
    const items = state.data?.items || state.catalog || [];
    if (state.filter === 'UNLOCKED') return items.filter(item => item.unlocked);
    if (state.filter === 'LOCKED') return items.filter(item => !item.unlocked);
    if (tierOrder.includes(state.filter)) return items.filter(item => item.tier === state.filter);
    return items;
  }

  function paintCards() {
    const root = app.querySelector('[data-achievement-grid]');
    if (!root) return;
    const items = filteredItems();
    root.innerHTML = items.length ? items.map(item => card(item, Boolean(state.data))).join('') : '<div class="nx48-empty">Nenhuma conquista corresponde a este filtro.</div>';
    wireCards();
  }

  function summaryMarkup(data) {
    const unlocked = Number(data?.unlockedCount || 0), total = Number(data?.total || state.catalog.length || 0), percentage = Number(data?.percentage || 0);
    const level = data?.level || { name: 'Nível Nexus 1', xp: 0, levelFloor: 0, nextXp: 30 };
    const levelProgress = Math.max(0, Math.min(100, Math.round(((Number(level.xp) - Number(level.levelFloor || 0)) / Math.max(1, Number(level.nextXp) - Number(level.levelFloor || 0))) * 100)));
    return `<section class="nx48-overview" aria-label="Progresso das conquistas"><div class="nx48-overview-main"><small>SUA JORNADA</small><strong>${unlocked} de ${total} conquistas</strong><p>${percentage}% concluído · ${esc(level.name)}</p></div><div class="nx48-overview-xp"><span><b>${Number(level.xp).toLocaleString('pt-BR')} XP</b><em>próximo nível em ${Math.max(0, Number(level.nextXp) - Number(level.xp)).toLocaleString('pt-BR')} XP</em></span><progress max="100" value="${levelProgress}">${levelProgress}%</progress></div></section>`;
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
    return `<section class="nx48-pinned"><div><small>NO SEU PERFIL</small><h2>Medalhas fixadas</h2></div><div>${items.map(item => `<button type="button" data-achievement-focus="${esc(item.id)}">${badge(item, { small: true })}<span><strong>${esc(item.title)}</strong><small>${esc(item.tierLabel)}</small></span></button>`).join('')}</div></section>`;
  }

  function shell(data, catalog) {
    state.data = data;
    state.catalog = data?.items || catalog || [];
    const filters = [['ALL', 'Todas'], ['LOCKED', 'Bloqueadas'], ['UNLOCKED', 'Desbloqueadas'], ['BRONZE', 'Bronze'], ['SILVER', 'Prata'], ['GOLD', 'Ouro'], ['PLATINUM', 'Platina'], ['DIAMOND', 'Diamante']];
    document.title = 'Conquistas | AniNexus';
    document.body.classList.remove('nx35-home-active', 'nx38-library-active', 'nx38-profile-active', 'aqx-home-active');
    document.body.classList.add('nx48-achievements-active');
    app.innerHTML = `<main class="nx48-achievements-page"><div class="nx48-shell"><header class="nx48-page-head"><div><small>ANINEXUS</small><h1>Conquistas</h1><p>Marcos permanentes da sua jornada, sem objetivos repetidos ou atalhos por notas infladas.</p></div></header>${summaryMarkup(data)}${pinnedMarkup(data)}<div class="nx48-content-head"><div><small>${state.catalog.length} MARCOS PRINCIPAIS</small><h2>Sua coleção</h2></div><div class="nx48-filters" role="group" aria-label="Filtrar conquistas">${filters.map(([key, label]) => `<button type="button" class="${state.filter === key ? 'active' : ''}" data-achievement-filter="${key}">${label}</button>`).join('')}</div></div><section class="nx48-grid" data-achievement-grid aria-live="polite"></section>${settingsMarkup(data)}</div></main>`;
    paintCards(); wirePage();
    requestAnimationFrame(() => document.documentElement.classList.remove('nx48-achievements-boot'));
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
      state.filter = button.dataset.achievementFilter;
      app.querySelectorAll('[data-achievement-filter]').forEach(item => item.classList.toggle('active', item === button));
      paintCards();
    }));
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
  addEventListener('popstate', () => { if (route() === PAGE_ROUTE) mount(); else document.body.classList.remove('nx48-achievements-active'); });
  addEventListener('aninexus:navigate', () => { if (route() === PAGE_ROUTE) mount(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
})();
