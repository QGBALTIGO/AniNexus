'use strict';
(() => {
  const body = document.body;
  const IS_PAGES = location.hostname.endsWith('github.io');
  let active = false;
  let lastY = Math.max(0, scrollY);
  let raf = 0;

  function routePath() {
    try {
      const url = new URL(location.href);
      const restored = url.searchParams.get('p');
      if (restored) return restored.split('?')[0].replace(/\/+$/, '') || '/';
      let path = url.pathname;
      if (IS_PAGES) path = path.replace(/^\/AniNexus/, '') || '/';
      return path.replace(/\/+$/, '') || '/';
    } catch {
      return '/';
    }
  }

  function onSeason() {
    return /^\/animes\/temporadas(?:\/|$)/.test(routePath());
  }

  function removeSeasonArtifacts() {
    body.classList.remove('nx-season-active', 'season-v7-active', 'season-v8-active', 'nx-v11-fixed-popover', 'nx-popover-open');
    document.querySelectorAll('.nx-v10-seasonbar,.nx-popover-layer').forEach(node => node.remove());
    delete body.dataset.nxSeasonTheme;
  }

  function applySection() {
    if (!onSeason()) {
      if (active) removeSeasonArtifacts();
      active = false;
      body.classList.remove('nx-section-page', 'nx-scroll-down', 'nx-scroll-up');
      const topbar = document.querySelector('#topbar');
      if (topbar) topbar.style.transform = '';
      return;
    }
    if (active) return;
    active = true;
    lastY = Math.max(0, scrollY);
    body.classList.add('nx-section-page', 'nx-scroll-up');
    body.classList.remove('nx-scroll-down');
  }

  function setDirection(direction) {
    if (!active) return;
    const down = direction === 'down';
    body.classList.toggle('nx-scroll-down', down);
    body.classList.toggle('nx-scroll-up', !down);
  }

  function onScroll() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (!active) {
        lastY = Math.max(0, scrollY);
        return;
      }
      const y = Math.max(0, scrollY);
      const delta = y - lastY;
      if (y <= 70) setDirection('up');
      else if (delta > 5 && y > 115) setDirection('down');
      else if (delta < -5) setDirection('up');
      lastY = y;
    });
  }

  document.addEventListener('click', event => {
    const anchor = event.target.closest('a[href]');
    if (!anchor || anchor.target === '_blank' || !active) return;
    const href = String(anchor.getAttribute('href') || '');
    if (!href || href.startsWith('#') || /^(https?:|mailto:|tel:)/i.test(href)) return;
    let destination = href;
    try {
      destination = new URL(href, location.href).pathname;
      if (IS_PAGES) destination = destination.replace(/^\/AniNexus/, '') || '/';
    } catch {}
    if (destination.includes('/animes/temporadas')) return;
    removeSeasonArtifacts();
    body.classList.remove('nx-section-page', 'nx-scroll-down', 'nx-scroll-up');
    active = false;
  }, true);

  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('popstate', () => setTimeout(applySection, 0));
  document.addEventListener('aninexus:routechange', applySection);

  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.matches?.('.nx-v10-seasonbar') || node.querySelector?.('.nx-v10-seasonbar')) {
          applySection();
          return;
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  applySection();
})();
