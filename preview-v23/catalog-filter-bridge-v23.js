'use strict';
(() => {
  const KEY = 'nx23:catalog:incoming';
  let applied = false;
  function route() {
    try {
      const url = new URL(location.href), restored = url.searchParams.get('p');
      if (restored) return restored.split('?')[0];
      let path = url.pathname;
      if (location.hostname.endsWith('github.io')) path = path.replace(/^\/AniNexus/, '') || '/';
      return path.replace(/\/+$/, '') || '/';
    } catch { return '/'; }
  }
  function read() { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { return null; } }
  function apply() {
    if (applied || route() !== '/animes/catalogo') return;
    const filters = read();
    if (!filters || !window.AniNexusCatalog?.applyFilters) return;
    applied = true;
    try { sessionStorage.removeItem(KEY); } catch {}
    window.AniNexusCatalog.applyFilters(filters);
  }
  addEventListener('DOMContentLoaded', apply, { once: true });
  const observer = new MutationObserver(apply);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  addEventListener('popstate', () => { applied = false; setTimeout(apply, 0); });
})();
