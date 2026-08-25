'use strict';
(() => {
  if (window.__ANINEXUS_SEO_V38__) return;
  window.__ANINEXUS_SEO_V38__ = true;
  const config = window.__ANINEXUS_CONFIG__ || {};
  const isPages = location.hostname.endsWith('github.io');
  const siteOrigin = String(config.siteOrigin || (isPages ? `${location.origin}/AniNexus` : location.origin)).replace(/\/+$/, '');
  const privateRoutes = new Set(['/login', '/criar-conta', '/minha-conta', '/meus-animes']);
  const pages = {
    '/': ['Início', 'Descubra temporadas, acompanhe episódios, organize sua lista e participe da comunidade anime brasileira.'],
    '/animes/catalogo': ['Catálogo de animes', 'Pesquise e filtre animes por gênero, formato, status, temporada e avaliação.'],
    '/animes/temporadas': ['Animes da temporada', 'Estreias e continuações organizadas por estação e ano.'],
    '/animes/programacao': ['Programação de animes', 'Calendário semanal de episódios no horário de Brasília.'],
    '/anime-awards': ['Anime Awards', 'Categorias, vencedores e destaques das principais premiações de anime.'],
    '/meus-animes': ['Meus Animes', 'Sua lista, favoritos, notas e progresso no AniNexus.'],
    '/noticias': ['Notícias', 'Notícias de anime e mangá aprofundadas, recentes e em português.'],
    '/comunidade': ['Comunidade', 'Atividades, impressões e discussões da comunidade AniNexus.'],
  };
  const esc = value => String(value || '').replace(/[<>]/g, '');
  const route = () => {
    const raw = new URL(location.href).searchParams.get('p');
    const path = raw ? raw.split('?')[0] : isPages ? location.pathname.replace(/^\/AniNexus/, '') : location.pathname;
    return (`/${String(path || '').replace(/^\/+|\/+$/g, '')}`).replace(/^\/$/, '/');
  };
  const upsertMeta = (selector, attrs) => {
    let node = document.head.querySelector(selector);
    if (!node) { node = document.createElement('meta'); document.head.append(node); }
    for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
    return node;
  };
  const canonicalFor = path => isPages ? `${siteOrigin}/${path === '/' ? '' : `?p=${encodeURIComponent(path)}`}` : `${siteOrigin}${path}`;
  function enhanceAccessibility() {
    document.querySelectorAll('.nx35-rank-num').forEach(node => node.setAttribute('aria-hidden', 'true'));
    document.querySelectorAll('.nx35-rail,.nx38-impressions-rail,.nx35-news-side,.nx35-news-cats,.nx40-tabs,.nx38-library-quick,.search-results,.drawer-content,.nx38-library-drawer-panel').forEach(node => {
      if (!node.hasAttribute('tabindex')) node.tabIndex = 0;
      if (!node.hasAttribute('aria-label')) node.setAttribute('aria-label', 'Conteúdo rolável');
    });
  }
  function update() {
    const path = route();
    const h1 = document.querySelector('#app h1');
    const known = pages[path];
    const detail = /^\/(?:anime|manga)\//.test(path);
    const title = esc((detail && h1?.textContent?.trim()) || known?.[0] || h1?.textContent?.trim() || 'AniNexus');
    const synopsis = document.querySelector('.nx23-synopsis,.nx-synopsis,.nx32-article-head>p,.nx38-account-page p');
    const description = esc((detail && synopsis?.textContent?.trim()) || known?.[1] || 'Descubra e acompanhe animes, mangás, notícias e comunidade em português.').slice(0, 220);
    const canonical = canonicalFor(path);
    const fullTitle = path === '/' ? 'AniNexus — seu universo anime' : `${title} | AniNexus`;
    const image = document.querySelector('.nx23-cover img,.nx-detail-cover img,.nx32-article-hero img,.nx35-cover img')?.src || `${siteOrigin}/assets/logo.png`;
    document.title = fullTitle;
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', canonical);
    upsertMeta('meta[name="robots"]', { name: 'robots', content: privateRoutes.has(path) ? 'noindex,nofollow,noarchive' : 'index,follow,max-image-preview:large' });
    for (const [property, content] of [['og:title', fullTitle], ['og:description', description], ['og:url', canonical], ['og:image', image]]) upsertMeta(`meta[property="${property}"]`, { property, content });
    for (const [name, content] of [['twitter:title', fullTitle], ['twitter:description', description], ['twitter:image', image]]) upsertMeta(`meta[name="${name}"]`, { name, content });
    const existing = document.querySelector('#aninexus-structured-data');
    const data = path === '/' ? {
      '@context': 'https://schema.org', '@type': 'WebSite', name: 'AniNexus', url: `${siteOrigin}/`, inLanguage: 'pt-BR',
      potentialAction: { '@type': 'SearchAction', target: `${siteOrigin}/?p=%2Fanimes%2Fcatalogo&q={search_term_string}`, 'query-input': 'required name=search_term_string' },
    } : {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Início', item: `${siteOrigin}/` },
        { '@type': 'ListItem', position: 2, name: title, item: canonical },
      ],
    };
    const script = existing || document.createElement('script');
    script.id = 'aninexus-structured-data'; script.type = 'application/ld+json'; script.textContent = JSON.stringify(data);
    if (!existing) document.head.append(script);
    enhanceAccessibility();
  }
  let timer = 0;
  const schedule = () => { enhanceAccessibility(); clearTimeout(timer); timer = setTimeout(update, 40); };
  addEventListener('popstate', schedule);
  addEventListener('aninexus:home-v34-ready', schedule);
  addEventListener('aninexus:auth-v38-ready', schedule);
  addEventListener('aninexus:library-v38-ready', schedule);
  addEventListener('aninexus:community-v40-ready', schedule);
  const app = document.querySelector('#app');
  if (app) new MutationObserver(schedule).observe(app, { childList: true, subtree: true });
  schedule();
})();
