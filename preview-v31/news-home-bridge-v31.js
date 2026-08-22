'use strict';
(() => {
  const IS_PAGES=location.hostname.endsWith('github.io'),BASE=IS_PAGES?'/AniNexus':'';
  const slug=s=>String(s||'noticia').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,110)||'noticia';
  const go=path=>location.assign(IS_PAGES?`${BASE}/?build=31.0.0&p=${encodeURIComponent(path)}`:path);
  document.addEventListener('click',e=>{
    const card=e.target.closest('.nx30-news-card,.nx30-news-feature');
    if(!card)return;
    const title=card.querySelector('h2,h3,strong')?.textContent?.trim();
    if(!title)return;
    e.preventDefault();e.stopImmediatePropagation();go(`/noticias/${slug(title)}`);
  },true);
})();
