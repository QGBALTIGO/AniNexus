'use strict';
(() => {
  const D = window.NX35NewsData;
  const app = document.querySelector('#app');
  if (!D || !app || window.__NX35_NEWS_UI__) return;
  window.__NX35_NEWS_UI__ = true;

  const { BASE, esc, strip, route, owns, go, imageCandidates, bindImageFallbacks, readSet, markRead, loadFeed, loadArticle, relative, date } = D;
  let active = 'ALL';
  let query = '';
  let rendering = false;
  let scrollHandler = null;
  let scrollFrame = 0;
  let lastScrollY = 0;
  let scrollDirection = 0;
  let scrollTravel = 0;
  let scrollLockUntil = 0;
  const I = {
    arrow: '<svg viewBox="0 0 24 24"><path d="M5 12h13M14 7.5 18.5 12 14 16.5"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.7"/><path d="m16 16 4 4"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>',
    news: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
    down: '<svg viewBox="0 0 24 24"><path d="m7 9 5 5 5-5"/></svg>',
  };
  const CATEGORY_DEFS = [['SEASON', 'Animes'], ['MANGA', 'Mangás & novels'], ['TRAILER', 'Trailers'], ['EPISODE', 'Episódios'], ['TRENDING', 'Em alta'], ['OTHER', 'Notícias']];

  function liveCategories() {
    const counts = new Map();
    for (const item of D.feed) counts.set(item.eventType, (counts.get(item.eventType) || 0) + 1);
    return [['ALL', 'Tudo', D.feed.length], ...CATEGORY_DEFS.filter(([key]) => counts.get(key) > 0).map(([key, label]) => [key, label, counts.get(key)])];
  }

  function renderCategories() {
    const roots = [...app.querySelectorAll('[data-nx35-cats]')];
    if (!roots.length) return;
    const categories = liveCategories();
    if (active !== 'ALL' && !categories.some(([key]) => key === active)) active = 'ALL';
    const markup = categories.map(([key, label, count]) => `<button class="${key === active ? 'active' : ''}" data-cat="${key}">${esc(label)}<sup>${count}</sup></button>`).join('');
    roots.forEach(root => {
      root.innerHTML = markup;
      root.querySelectorAll('[data-cat]').forEach(button => {
        button.onclick = () => {
          active = button.dataset.cat;
          renderCategories();
          renderResults();
        };
      });
    });
    const selected = categories.find(([key]) => key === active) || categories[0];
    const context = app.querySelector('[data-nx35-island-context]');
    if (context && selected) context.textContent = `${selected[1]} · ${selected[2]} ${selected[2] === 1 ? 'matéria' : 'matérias'}`;
  }

  function clearScrollBinding() {
    if (scrollHandler) removeEventListener('scroll', scrollHandler);
    if (scrollFrame) cancelAnimationFrame(scrollFrame);
    scrollHandler = null;
    scrollFrame = 0;
    scrollDirection = 0;
    scrollTravel = 0;
    scrollLockUntil = 0;
    document.body.classList.remove('nx35-news-list-active', 'nx35-news-scrolled', 'nx35-news-scroll-down', 'nx35-news-scroll-up');
  }

  function activate(list = false) {
    clearScrollBinding();
    document.body.classList.remove('aqx-home-active', 'nx35-home-active', 'nx34-home', 'nx33-home', 'nx34-news-active', 'nx32-news-active', 'nx22-news-active', 'nx22-detail-active', 'nx-season-active');
    document.body.classList.add('nx35-news-active');
    document.body.classList.toggle('nx35-news-list-active', list);
    document.querySelectorAll('[data-nav]').forEach(link => link.classList.toggle('active', link.dataset.nav === 'news'));
  }

  function deactivate() {
    clearScrollBinding();
    document.body.classList.remove('nx35-news-active');
  }

  function media(item, hero = false) {
    const images = imageCandidates(item);
    if (images.length) return `<img loading="${hero ? 'eager' : 'lazy'}" decoding="async" src="${esc(images[0])}" data-news-image data-news-image-candidates="${esc(encodeURIComponent(JSON.stringify(images.slice(1))))}" alt="${esc(item.imageAlt || item.title)}">`;
    return '<div class="nx35-news-art"><span>ANINEXUS</span><b>NOTÍCIAS</b></div>';
  }

  function card(item, kind = 'grid') {
    const path = `/noticias/${item.slug}`;
    const read = readSet().has(item.slug);
    return `<a class="nx35-ncard ${kind}" href="${path}" data-news-path="${path}"><div class="nx35-nmedia">${media(item, kind === 'feature')}<span>${esc(item.category)}</span>${read ? '<i>LIDA</i>' : ''}</div><div class="nx35-ncopy"><small>${esc(relative(item.publishedAt))}</small><h3>${esc(item.title)}</h3>${kind === 'feature' ? `<p>${esc(item.summary)}</p>` : ''}<footer><span>${I.clock}${item.readingMinutes} min</span><b>Ler notícia ${I.arrow}</b></footer></div></a>`;
  }

  function filtered() {
    const needle = query.trim().toLowerCase();
    return D.feed.filter(item => (active === 'ALL' || item.eventType === active) && (!needle || `${item.title} ${item.summary} ${item.source} ${item.category} ${(item.tags || []).join(' ')}`.toLowerCase().includes(needle)));
  }

  function renderResults() {
    const root = app.querySelector('#nx35NewsResults');
    if (!root) return;
    const list = filtered();
    const count = app.querySelector('#nx35NewsCount');
    if (count) count.textContent = `${list.length} ${list.length === 1 ? 'matéria' : 'matérias'} recentes`;
    if (!list.length) {
      root.innerHTML = '<div class="nx35-news-empty"><h3>Nenhuma matéria nesta categoria.</h3><p>Quando não houver conteúdo ativo, a categoria some automaticamente do menu.</p></div>';
      return;
    }
    const lead = list[0];
    const side = list.slice(1, 4);
    const rest = list.slice(4);
    root.innerHTML = `<div class="nx35-news-lead">${card(lead, 'feature')}<div class="nx35-news-side">${side.map(item => card(item, 'compact')).join('')}</div></div>${rest.length ? `<div class="nx35-news-sub"><small>MAIS RECENTES</small><h2>Últimas atualizações</h2></div><div class="nx35-news-grid">${rest.map(item => card(item)).join('')}</div>` : ''}`;
    bindImageFallbacks(root);
  }

  function controlsMarkup(id) {
    return `<div class="nx35-news-controls"><div class="nx35-news-cats" data-nx35-cats><button class="active" data-cat="ALL">Tudo</button></div><label>${I.search}<span class="sr-only">Buscar notícias</span><input id="${id}" data-nx35-news-search type="search" placeholder="Buscar assunto, anime ou mangá..." value="${esc(query)}"></label></div>`;
  }

  function bindSearches() {
    app.querySelectorAll('[data-nx35-news-search]').forEach(search => {
      search.oninput = () => {
        query = search.value;
        app.querySelectorAll('[data-nx35-news-search]').forEach(peer => { if (peer !== search) peer.value = query; });
        renderResults();
      };
    });
  }

  function bindListChrome() {
    const hero = app.querySelector('#nx35NewsHero');
    const island = app.querySelector('#nx35NewsIsland');
    if (!hero || !island) return;
    const toggle = island.querySelector('[data-nx35-island-toggle]');
    const setIslandState = (shown, expanded) => {
      const open = Boolean(shown && expanded);
      const panel = island.querySelector('.nx35-news-island-panel');
      island.classList.toggle('show', Boolean(shown));
      island.classList.toggle('expanded', open);
      island.inert = !shown;
      island.setAttribute('aria-hidden', String(!shown));
      if (panel) {
        panel.inert = !open;
        panel.setAttribute('aria-hidden', String(!open));
      }
      toggle.setAttribute('aria-expanded', String(open));
    };
    toggle.onclick = () => {
      setIslandState(true, !island.classList.contains('expanded'));
    };
    lastScrollY = Math.max(0, scrollY);
    const update = () => {
      scrollFrame = 0;
      const y = Math.max(0, scrollY);
      const delta = y - lastScrollY;
      const headerHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nx43-header-height')) || 66;
      const shown = hero.getBoundingClientRect().bottom < headerHeight;
      document.body.classList.toggle('nx35-news-scrolled', shown);
      island.classList.toggle('show', shown);
      island.inert = !shown;
      island.setAttribute('aria-hidden', String(!shown));
      if (!shown) {
        document.body.classList.remove('nx35-news-scroll-down', 'nx35-news-scroll-up');
        setIslandState(false, false);
        lastScrollY = y;
        scrollDirection = 0;
        scrollTravel = 0;
        return;
      }
      if (Math.abs(delta) < 2) { lastScrollY = y; return; }
      const direction = delta > 0 ? 1 : -1;
      const visibleDirection = document.body.classList.contains('nx35-news-scroll-down') ? 1 : document.body.classList.contains('nx35-news-scroll-up') ? -1 : 0;
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
        document.body.classList.add('nx35-news-scroll-down');
        document.body.classList.remove('nx35-news-scroll-up');
        setIslandState(true, false);
        scrollLockUntil = performance.now() + (matchMedia('(prefers-reduced-motion: reduce)').matches ? 40 : 380);
      } else if (direction < 0 && scrollTravel >= 12) {
        document.body.classList.add('nx35-news-scroll-up');
        document.body.classList.remove('nx35-news-scroll-down');
        setIslandState(true, true);
        scrollLockUntil = performance.now() + (matchMedia('(prefers-reduced-motion: reduce)').matches ? 40 : 380);
      }
    };
    scrollHandler = () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(update); };
    addEventListener('scroll', scrollHandler, { passive: true });
    setIslandState(false, false);
    update();
  }

  function listShell() {
    activate(true);
    document.title = 'Notícias | AniNexus';
    app.innerHTML = `<main class="nx35-news-page">
      <section class="nx35-news-hero" id="nx35NewsHero"><div class="nx35-shell">
        <div class="nx35-news-heading"><span class="nx35-news-heading-icon">${I.news}</span><div><h1><em>Notícias</em> AniNexus</h1><small>ANIME E MANGÁ EM PORTUGUÊS</small></div></div>
        <p>Estreias, trailers, temporadas e bastidores reunidos para quem vive esse universo.</p>
        ${controlsMarkup('nx35NewsSearch')}
      </div></section>
      <section class="nx35-news-body"><div class="nx35-shell"><header class="nx35-news-title"><div><small>ÚLTIMAS NOTÍCIAS</small><h2>O que está acontecendo agora</h2></div><span id="nx35NewsCount">Carregando...</span></header><div id="nx35NewsResults"><div class="nx35-news-loading"></div></div></div></section>
    </main>
    <section class="nx35-news-island" id="nx35NewsIsland" aria-label="Guia de notícias" aria-hidden="true" inert>
      <button type="button" class="nx35-news-island-head" data-nx35-island-toggle aria-expanded="false"><span class="nx35-news-island-icon">${I.news}</span><span class="nx35-news-island-copy"><strong><em>Notícias</em> AniNexus</strong><small data-nx35-island-context>Notícias recentes</small></span><span class="nx35-news-island-chevron">${I.down}</span></button>
      <div class="nx35-news-island-panel" aria-hidden="true" inert><div><div class="nx35-news-island-inner">${controlsMarkup('nx35NewsIslandSearch')}</div></div></div>
    </section>`;
    bindSearches();
    bindListChrome();
  }

  function inline(runs, fallback = '') {
    const values = Array.isArray(runs) && runs.length ? runs : [{ text: fallback }];
    return values.map(run => {
      let value = esc(run?.text || '').replace(/\n/g, '<br>');
      const marks = Array.isArray(run?.marks) ? run.marks : [];
      if (marks.includes('code')) value = `<code>${value}</code>`;
      if (marks.includes('em')) value = `<em>${value}</em>`;
      if (marks.includes('strong')) value = `<strong>${value}</strong>`;
      if (run?.href) value = `<a href="${esc(run.href)}" target="_blank" rel="noopener noreferrer nofollow">${value}</a>`;
      return value;
    }).join('');
  }

  function sourceBlock(block, item) {
    if (block.type === 'paragraph') return `<p>${inline(block.runs, block.text)}</p>`;
    if (block.type === 'heading') {
      const level = Math.max(2, Math.min(4, Number(block.level) || 2));
      return `<h${level}>${inline(block.runs, block.text)}</h${level}>`;
    }
    if (block.type === 'blockquote') return `<blockquote>${inline(block.runs, block.text)}</blockquote>`;
    if (block.type === 'list') {
      const tag = block.ordered ? 'ol' : 'ul';
      return `<${tag}>${(block.items || []).map(entry => `<li>${inline(entry.runs, entry.text)}</li>`).join('')}</${tag}>`;
    }
    if (block.type === 'image') return `<figure class="nx40-source-image"><img loading="lazy" decoding="async" src="${esc(block.url)}" alt="${esc(block.alt || item.title)}">${block.caption ? `<figcaption>${esc(block.caption)}</figcaption>` : ''}</figure>`;
    if (block.type === 'video' && block.provider === 'html5' && block.url) return `<div class="nx40-source-video"><video controls preload="metadata" src="${esc(block.url)}"></video></div>`;
    if (block.type === 'video' && block.embedUrl) return `<div class="nx40-source-video"><iframe loading="lazy" src="${esc(block.embedUrl)}" title="Vídeo da matéria" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`;
    if (block.type === 'table') return `<div class="nx40-source-table"><table><tbody>${(block.rows || []).map(row => `<tr>${row.map(cell => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    if (block.type === 'divider') return '<hr>';
    return '';
  }

  function sourceFlow(item) {
    const blocks = Array.isArray(item.sourceContent) ? item.sourceContent : [];
    if (!blocks.length) return '';
    return `<div class="nx40-source-flow">${blocks.map(block => sourceBlock(block, item)).join('')}</div>`;
  }

  function legacySection(section) {
    const paragraphs = (section?.paragraphs || []).map(value => `<p>${esc(strip(value))}</p>`).join('');
    const bullets = (section?.bullets || []).length ? `<ul>${section.bullets.map(value => `<li>${esc(strip(value))}</li>`).join('')}</ul>` : '';
    return `<section class="nx35-article-section"><h2>${esc(section?.heading || 'Detalhes')}</h2>${paragraphs}${bullets}</section>`;
  }

  function legacyMedia(item) {
    if (item.sourceContent?.length) return '';
    const images = (item.mediaGallery || []).filter(entry => entry?.url && entry.url !== item.image).slice(0, 8);
    const embeds = (item.mediaEmbeds || []).filter(entry => entry?.url).slice(0, 3);
    return `${images.length ? `<section class="nx37-media-section"><div class="nx37-gallery ${images.length === 1 ? 'single' : ''}">${images.map(entry => `<figure><img loading="lazy" decoding="async" src="${esc(entry.url)}" alt="${esc(entry.alt || item.title)}">${entry.caption ? `<figcaption><span>${esc(entry.caption)}</span></figcaption>` : ''}</figure>`).join('')}</div></section>` : ''}${embeds.length ? `<section class="nx37-media-section"><div class="nx37-embeds">${embeds.map(entry => `<div><iframe loading="lazy" src="${esc(entry.url)}" title="Vídeo relacionado à notícia" allowfullscreen></iframe></div>`).join('')}</div></section>` : ''}`;
  }

  function bindProgress() {
    clearScrollBinding();
    scrollHandler = () => {
      const bar = document.querySelector('#nx35Progress');
      if (!bar) return;
      const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      bar.style.transform = `scaleX(${Math.max(0, Math.min(1, scrollY / max))})`;
    };
    addEventListener('scroll', scrollHandler, { passive: true });
    scrollHandler();
  }

  function article(item) {
    activate(false);
    markRead(item.slug);
    document.title = `${item.title} | AniNexus`;
    const fidelity = ['full', 'excerpt'].includes(item.contentMode) && item.sourceContent?.length;
    const legacySections = fidelity ? [] : item.sections?.length ? item.sections : [{ heading: 'Notícia', paragraphs: [item.summary] }];
    const related = D.feed.filter(entry => entry.slug !== item.slug && (entry.eventType === item.eventType || entry.category === item.category)).slice(0, 6);
    const updated = item.updatedAt && new Date(item.updatedAt) > new Date(item.publishedAt || 0) ? date(item.updatedAt, true) : '';
    const modeLabel = item.contentMode === 'full' ? 'Matéria completa' : item.contentMode === 'excerpt' ? 'Prévia' : 'Arquivo anterior';
    const previewNote = item.contentMode === 'excerpt'
      ? '<aside class="nx40-preview-note"><strong>Conteúdo disponível como prévia.</strong><p>A publicação disponibilizou somente este trecho no feed.</p></aside>'
      : '';
    app.innerHTML = `<main class="nx35-news-page nx35-reader"><div class="nx35-progress"><i id="nx35Progress"></i></div><article><header class="nx35-article-hero ${item.image ? 'has-image' : 'no-image'}">${item.image ? media(item, true) : '<div class="nx35-reader-art"><span>ANINEXUS</span><b>NOTÍCIAS</b></div>'}<div class="nx35-article-shade"></div><div class="nx35-shell nx35-article-head"><div class="nx40-reader-actions"><button data-back>${I.back}<span>Notícias</span></button><button data-copy title="Copiar link" aria-label="Copiar link">${I.copy}<span>Copiar link</span></button></div><div class="nx35-article-meta"><span>${esc(item.category)}</span><time>${esc(date(item.publishedAt, true))}</time></div><h1>${esc(item.title)}</h1>${!fidelity ? `<p>${esc(item.summary)}</p>` : ''}<div class="nx35-article-stats"><span>${I.clock}${item.readingMinutes} min</span><span>${esc(modeLabel)}</span>${item.sourceAuthor ? `<span>Por ${esc(item.sourceAuthor)}</span>` : ''}</div></div></header><div class="nx35-shell nx35-article-layout"><div class="nx35-article-main">${previewNote}${sourceFlow(item)}${legacySections.map(legacySection).join('')}${legacyMedia(item)}</div><aside class="nx35-sidebar"><div><small>PUBLICAÇÃO</small><strong>${esc(date(item.publishedAt, true))}</strong>${item.sourceAuthor ? `<p>Por ${esc(item.sourceAuthor)}</p>` : ''}${updated ? `<p>Atualizada em ${esc(updated)}</p>` : ''}</div><div><small>LEITURA</small><strong>${esc(modeLabel)}</strong><p>${item.readingMinutes} min${item.wordCount ? ` · ${item.wordCount} palavras` : ''}</p></div></aside></div>${related.length ? `<section class="nx35-related"><div class="nx35-shell"><div class="nx35-news-sub"><small>CONTINUE LENDO</small><h2>Mais notícias relacionadas</h2></div><div class="nx35-news-grid">${related.map(entry => card(entry)).join('')}</div></div></section>` : ''}</article></main>`;
    bindImageFallbacks(app);
    app.querySelector('[data-back]')?.addEventListener('click', () => go('/noticias'));
    app.querySelector('[data-copy]')?.addEventListener('click', async event => {
      try {
        await navigator.clipboard.writeText(location.href);
        event.currentTarget.querySelector('span').textContent = 'Link copiado';
      } catch {}
    });
    bindProgress();
  }

  async function render() {
    if (!owns()) { deactivate(); return false; }
    if (rendering) return false;
    rendering = true;
    try {
      const path = route();
      if (path === '/noticias') {
        listShell();
        await loadFeed();
        if (route() === '/noticias') {
          renderCategories();
          renderResults();
        }
        dispatchEvent(new CustomEvent('aninexus:news-v32-ready'));
        return true;
      }
      const slug = decodeURIComponent(path.slice('/noticias/'.length));
      if (!D.feed.length) await loadFeed();
      const item = await loadArticle(slug);
      if (!item) {
        activate(false);
        app.innerHTML = `<main class="nx35-news-page"><div class="nx35-shell nx35-news-empty full"><h1>Matéria indisponível.</h1><p>Ela pode ter expirado do feed recente ou ainda estar sendo processada.</p><button data-back>Voltar às notícias</button></div></main>`;
        app.querySelector('[data-back]')?.addEventListener('click', () => go('/noticias'));
        dispatchEvent(new CustomEvent('aninexus:news-v32-ready'));
        return true;
      }
      if (!D.feed.some(entry => entry.slug === item.slug)) D.feed = [item, ...D.feed];
      article(item);
      dispatchEvent(new CustomEvent('aninexus:news-v32-ready'));
      return true;
    } finally {
      rendering = false;
    }
  }

  document.addEventListener('click', event => {
    const link = event.target.closest('[data-news-path]');
    if (!link) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    go(link.dataset.newsPath);
  }, true);
  addEventListener('aninexus:news-v35-navigate', () => setTimeout(render, 0));
  addEventListener('popstate', () => setTimeout(render, 0));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render, { once: true });
  else render();
})();
