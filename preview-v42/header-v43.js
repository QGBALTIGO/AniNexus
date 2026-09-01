'use strict';
(() => {
  if (window.__ANINEXUS_HEADER_V43__) return;
  window.__ANINEXUS_HEADER_V43__ = true;

  const BUILD = '43.0.0';
  const IS_PAGES = location.hostname.endsWith('github.io');
  const BASE = IS_PAGES ? '/AniNexus' : '';
  const root = document.documentElement;
  const topbar = document.querySelector('#topbar');
  const trigger = document.querySelector('.nx43-notification-trigger');
  const layer = document.querySelector('#notificationPanel');
  const sheet = layer?.querySelector('.nx43-notification-sheet');
  const list = layer?.querySelector('[data-nx43-notification-list]');
  const badge = trigger?.querySelector('.nx43-notification-badge');
  const allLink = layer?.querySelector('[data-nx43-notifications-all]');
  if (!topbar || !trigger || !layer || !sheet || !list || !badge || !allLink) return;

  let notifications = [];
  let loadedAt = 0;
  let loading = null;
  let returnFocus = null;
  let scrollFrame = 0;
  let navFrame = 0;
  let authGeneration = 0;

  function currentRoute() {
    const url = new URL(location.href);
    const requested = url.searchParams.get('p');
    if (requested) return requested.split('?')[0].replace(/\/+$/, '') || '/';
    let path = url.pathname;
    if (IS_PAGES) path = path.replace(/^\/AniNexus/, '') || '/';
    return path.replace(/\/+$/, '') || '/';
  }

  function activeKey(path = currentRoute()) {
    if (path === '/' || path.includes('__nx35_home_boot__')) return 'home';
    if (path === '/animes/programacao') return 'schedule';
    if (path === '/animes/temporadas') return 'season';
    if (path === '/mangas' || path === '/meus-mangas' || path.startsWith('/manga/')) return 'manga';
    if (path === '/comunidade' || path.startsWith('/comunidade/')) return 'community';
    if (path === '/animes/catalogo' || path.startsWith('/anime/') || path.startsWith('/animes/')) return 'anime';
    return '';
  }

  function syncNavigation() {
    cancelAnimationFrame(navFrame);
    navFrame = requestAnimationFrame(() => {
      const key = activeKey();
      document.querySelectorAll('[data-nav]').forEach(link => {
        const active = link.dataset.nav === key;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });
    });
  }

  function syncScrollState() {
    cancelAnimationFrame(scrollFrame);
    scrollFrame = requestAnimationFrame(() => topbar.classList.toggle('is-scrolled', window.scrollY > 10));
  }

  function updateBadge() {
    const unread = notifications.filter(item => !item?.read_at).length;
    badge.hidden = unread === 0;
    trigger.setAttribute('aria-label', unread ? `Abrir notificações, ${unread} não lidas` : 'Abrir notificações');
  }

  function closePanel() {
    if (layer.hidden) return;
    layer.hidden = true;
    layer.setAttribute('aria-hidden', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('nx43-notifications-open');
    const focusTarget = returnFocus;
    returnFocus = null;
    if (focusTarget instanceof HTMLElement && focusTarget.isConnected) focusTarget.focus();
  }

  function syncAuthentication() {
    authGeneration += 1;
    const authenticated = root.dataset.nxAuthState === 'authenticated';
    trigger.hidden = !authenticated;
    if (!authenticated) {
      notifications = [];
      loadedAt = 0;
      updateBadge();
      closePanel();
    }
  }

  function stateMessage(title, detail, retry = false) {
    const state = document.createElement('div');
    state.className = 'nx43-notification-state';
    const strong = document.createElement('strong');
    strong.textContent = title;
    const text = document.createElement('span');
    text.textContent = detail;
    state.append(strong, text);
    if (retry) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Tentar novamente';
      button.addEventListener('click', () => void loadNotifications(true));
      state.append(button);
    }
    list.replaceChildren(state);
  }

  function relativeDate(value) {
    const time = Date.parse(value || '');
    if (!Number.isFinite(time)) return '';
    const elapsed = Math.max(0, Date.now() - time);
    if (elapsed < 60_000) return 'agora';
    if (elapsed < 3_600_000) return `há ${Math.floor(elapsed / 60_000)} min`;
    if (elapsed < 86_400_000) return `há ${Math.floor(elapsed / 3_600_000)} h`;
    if (elapsed < 604_800_000) return `há ${Math.floor(elapsed / 86_400_000)} d`;
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(time));
  }

  function safeRoute(value) {
    const route = String(value || '').trim();
    if (!route.startsWith('/') || route.startsWith('//') || /[\u0000-\u001f\\]/.test(route)) return '';
    try {
      const target = new URL(route, location.origin);
      if (target.origin !== location.origin) return '';
      return `${target.pathname}${target.search}${target.hash}`;
    } catch {
      return '';
    }
  }

  function navigate(route) {
    closePanel();
    if (IS_PAGES) {
      location.assign(`${BASE}/?build=${BUILD}&p=${encodeURIComponent(route)}`);
      return;
    }
    history.pushState({}, '', route);
    dispatchEvent(new PopStateEvent('popstate'));
  }

  async function openNotification(item, row) {
    const wasUnread = !item.read_at;
    if (wasUnread) {
      try {
        await window.AniNexusAuth?.api?.(`/api/me/notifications/${encodeURIComponent(item.id)}`, { method: 'PATCH' });
        item.read_at = new Date().toISOString();
        row.classList.remove('is-unread');
        updateBadge();
      } catch {
        // The destination remains available even if the read receipt is delayed.
      }
    }
    const route = safeRoute(item.href || item.url);
    if (route) navigate(route);
  }

  function renderNotifications() {
    if (!notifications.length) {
      stateMessage('Tudo em dia', 'Novidades da sua lista e da comunidade aparecerão aqui.');
      updateBadge();
      return;
    }
    const fragment = document.createDocumentFragment();
    for (const item of notifications) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = `nx43-notification-row${item.read_at ? '' : ' is-unread'}`;
      row.dataset.kind = String(item.kind || 'SYSTEM').toUpperCase();
      const mark = document.createElement('span');
      mark.className = 'nx43-notification-mark';
      mark.setAttribute('aria-hidden', 'true');
      const copy = document.createElement('span');
      copy.className = 'nx43-notification-copy';
      const title = document.createElement('strong');
      title.textContent = String(item.title || 'Nova notificação');
      copy.append(title);
      if (item.body) {
        const body = document.createElement('p');
        body.textContent = String(item.body);
        copy.append(body);
      }
      const time = document.createElement('time');
      time.dateTime = String(item.created_at || '');
      time.textContent = relativeDate(item.created_at);
      row.append(mark, copy, time);
      row.addEventListener('click', () => void openNotification(item, row));
      fragment.append(row);
    }
    list.replaceChildren(fragment);
    updateBadge();
  }

  async function loadNotifications(force = false) {
    if (root.dataset.nxAuthState !== 'authenticated') return;
    if (!force && notifications.length && Date.now() - loadedAt < 60_000) {
      renderNotifications();
      return;
    }
    if (loading) return loading;
    const generation = authGeneration;
    stateMessage('Consultando notificações', 'Só um instante.');
    loading = (async () => {
      try {
        const response = await window.AniNexusAuth?.api?.('/api/me/notifications?limit=20');
        if (generation !== authGeneration || root.dataset.nxAuthState !== 'authenticated') return;
        notifications = Array.isArray(response?.items) ? response.items.slice(0, 20) : [];
        loadedAt = Date.now();
        renderNotifications();
      } catch {
        if (generation !== authGeneration || root.dataset.nxAuthState !== 'authenticated') return;
        stateMessage('Não foi possível carregar agora', 'Sua navegação continua funcionando normalmente.', true);
      } finally {
        loading = null;
      }
    })();
    return loading;
  }

  function openPanel() {
    if (trigger.hidden || root.dataset.nxAuthState !== 'authenticated') return;
    returnFocus = document.activeElement;
    layer.hidden = false;
    layer.setAttribute('aria-hidden', 'false');
    trigger.setAttribute('aria-expanded', 'true');
    document.body.classList.add('nx43-notifications-open');
    requestAnimationFrame(() => sheet.focus());
    void loadNotifications();
  }

  function trapFocus(event) {
    if (layer.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closePanel();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...sheet.querySelectorAll('button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')].filter(element => !element.hidden);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (document.activeElement === sheet) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  trigger.addEventListener('click', event => {
    event.preventDefault();
    openPanel();
  });
  layer.querySelectorAll('[data-nx43-notifications-close]').forEach(button => button.addEventListener('click', closePanel));
  allLink.addEventListener('click', event => {
    event.preventDefault();
    navigate('/minha-conta#notificacoes');
  });
  document.addEventListener('keydown', trapFocus);
  addEventListener('scroll', syncScrollState, { passive: true });
  addEventListener('popstate', syncNavigation);
  addEventListener('aninexus:route-ready', syncNavigation);
  addEventListener('aninexus:home-v34-ready', syncNavigation);

  new MutationObserver(syncAuthentication).observe(root, { attributes: true, attributeFilter: ['data-nx-auth-state'] });
  new MutationObserver(syncNavigation).observe(document.querySelector('#app'), { childList: true, subtree: false });
  syncAuthentication();
  syncScrollState();
  syncNavigation();
})();
