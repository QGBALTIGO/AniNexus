'use strict';
(() => {
  if (window.__ANINEXUS_SEO_V38__) return;
  window.__ANINEXUS_SEO_V38__ = true;
  const config = window.__ANINEXUS_CONFIG__ || {};
  const isPages = location.hostname.endsWith('github.io');
  const siteOrigin = String(config.siteOrigin || (isPages ? `${location.origin}/AniNexus` : location.origin)).replace(/\/+$/, '');
  const privateRoutes = new Set(['/login', '/criar-conta', '/minha-conta', '/minha-biblioteca', '/meus-animes', '/meus-mangas', '/admin', '/moderacao', '/conectar-source', '/diario', '/entrar', '/cadastro', '/conta']);
  const pages = {
    '/': ['Início', 'Descubra temporadas, acompanhe episódios, organize sua lista e participe da comunidade anime brasileira.'],
    '/animes/catalogo': ['Catálogo de animes', 'Pesquise e filtre animes por gênero, formato, status, temporada e avaliação.'],
    '/animes/temporadas': ['Animes da temporada', 'Estreias e continuações organizadas por estação e ano.'],
    '/animes/programacao': ['Programação de animes', 'Calendário semanal de episódios organizado no seu fuso horário.'],
    '/anime-awards': ['Anime Awards', 'Categorias, vencedores e destaques das principais premiações de anime.'],
    '/minha-biblioteca': ['Minha Biblioteca', 'Seus animes, mangás, favoritos, notas e progresso no AniNexus.'],
    '/meus-animes': ['Minha Biblioteca', 'Seus animes, mangás, favoritos, notas e progresso no AniNexus.'],
    '/meus-mangas': ['Minha Biblioteca', 'Seus animes, mangás, favoritos, notas e progresso no AniNexus.'],
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
  const scrollingSelectors = '.nx35-rail,.nx38-impressions-rail,.nx35-news-side,.nx35-news-cats,.nx40-tabs,.nx38-library-quick,.search-results,.drawer-content,.nx38-library-drawer-panel';
  const matchingNodes = (root, selector) => [...(root.matches?.(selector) ? [root] : []), ...(root.querySelectorAll?.(selector) || [])];
  function enhanceAccessibility(root = document) {
    matchingNodes(root, '.nx35-rank-num').forEach(node => { if(node.getAttribute('aria-hidden') !== 'true') node.setAttribute('aria-hidden', 'true'); });
    matchingNodes(root, scrollingSelectors).forEach(node => {
      if (!node.hasAttribute('tabindex')) node.tabIndex = 0;
      if (!node.hasAttribute('aria-label')) node.setAttribute('aria-label', 'Conteúdo rolável');
    });
  }
  function update() {
    const path = route();
    const h1 = document.querySelector('#app h1');
    const known = pages[path];
    const detail = /^\/(?:anime|manga)\//.test(path);
    const profile = /^\/u\/[\p{L}\p{N}_.-]{3,30}$/u.test(path);
    const title = esc(((detail || profile) && h1?.textContent?.trim()) || known?.[0] || h1?.textContent?.trim() || 'AniNexus');
    const synopsis = document.querySelector('.nx22-synopsis,.nx23-synopsis,.nx-synopsis,.nx35-article-head>p,.nx38-account-page p,.nx38p-person>p');
    let article;
    if(/^\/noticias\/[a-z0-9-]+$/.test(path))try{article=JSON.parse(document.querySelector('[data-nx-news-metadata]')?.dataset.nxNewsMetadata||'null')}catch{}
    const description = esc(article?.summary || ((detail || profile) && synopsis?.textContent?.trim()) || known?.[1] || (profile ? `Perfil de ${title} na comunidade AniNexus.` : 'Descubra e acompanhe animes, mangás, notícias e comunidade em português.')).slice(0, 220);
    const canonical = canonicalFor(path);
    const fullTitle = path === '/' ? 'AniNexus — seu universo anime' : `${title} | AniNexus`;
    const image = document.querySelector('.nx22-poster img,.nx22-cover img,.nx23-cover img,.nx-detail-cover img,.nx35-article-hero img,.nx35-cover img,.nx38p-avatar img')?.src || `${siteOrigin}/assets/logo.png`;
    document.title = fullTitle;
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', canonical);
    upsertMeta('meta[name="robots"]', { name: 'robots', content: privateRoutes.has(path) ? 'noindex,nofollow,noarchive' : 'index,follow,max-image-preview:large' });
    for (const [property, content] of [['og:type', article ? 'article' : 'website'], ['og:title', fullTitle], ['og:description', description], ['og:url', canonical], ['og:image', image]]) upsertMeta(`meta[property="${property}"]`, { property, content });
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
    const previousArticle=document.querySelector('#aninexus-route-structured-data');
    if(article){
      const iso=value=>{const date=value&&new Date(value);return date&&!Number.isNaN(date.getTime())?date.toISOString():undefined};
      const news={'@context':'https://schema.org','@type':'NewsArticle',headline:title,description,image:[image],mainEntityOfPage:canonical,datePublished:iso(article.publishedAt),dateModified:iso(article.updatedAt),publisher:{'@type':'Organization',name:'AniNexus',url:siteOrigin}};
      if(article.sourceAuthor)news.author={'@type':'Person',name:String(article.sourceAuthor).slice(0,160)};
      const node=previousArticle||document.createElement('script');node.id='aninexus-route-structured-data';node.type='application/ld+json';node.textContent=JSON.stringify(news).replace(/</g,'\\u003c');if(!previousArticle)document.head.append(node);
    }else if(!/^\/noticias\/[a-z0-9-]+$/.test(path))previousArticle?.remove();
  }
  let timer = 0;
  const schedule = () => { clearTimeout(timer); timer = setTimeout(update, 40); };
  const accessibilityRoots = new Set(); let accessibilityFrame = 0;
  const scheduleAccessibility = root => {
    accessibilityRoots.add(root);
    if(accessibilityFrame) return;
    accessibilityFrame = requestAnimationFrame(() => {
      accessibilityFrame = 0;
      const roots = [...accessibilityRoots].filter(node => (node === document || node.isConnected) && ![...accessibilityRoots].some(parent => parent !== node && parent.contains?.(node)));
      accessibilityRoots.clear(); roots.forEach(enhanceAccessibility);
    });
  };
  const metadataSelectors = 'h1,.nx22-synopsis,.nx23-synopsis,.nx-synopsis,.nx35-article-head,[data-nx-news-metadata],.nx38-account-page,.nx38p-person,.nx22-poster,.nx22-cover,.nx23-cover,.nx-detail-cover,.nx35-article-hero,.nx35-cover,.nx38p-avatar';
  const affectsMetadata = node => node.nodeType === 1 && (node.matches?.(metadataSelectors) || node.querySelector?.(metadataSelectors));
  addEventListener('popstate', schedule);
  addEventListener('aninexus:route-changed', schedule);
  addEventListener('aninexus:home-v34-ready', schedule);
  addEventListener('aninexus:auth-v38-ready', schedule);
  addEventListener('aninexus:library-v38-ready', schedule);
  addEventListener('aninexus:community-v40-ready', schedule);
  addEventListener('aninexus:profile-v38-ready', schedule);
  const app = document.querySelector('#app');
  if (app) new MutationObserver(records => {
    let metadataChanged = false;
    for(const record of records){
      for(const node of record.addedNodes){ if(node.nodeType === 1) scheduleAccessibility(node); if(affectsMetadata(node)) metadataChanged = true; }
      if([...record.removedNodes].some(affectsMetadata) || record.target.closest?.(metadataSelectors)) metadataChanged = true;
    }
    if(metadataChanged) schedule();
  }).observe(app, { childList: true, subtree: true });
  scheduleAccessibility(document);
  schedule();
})();
