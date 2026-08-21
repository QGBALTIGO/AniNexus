'use strict';
(() => {
  const IS_PAGES=location.hostname.endsWith('github.io');
  const BASE=IS_PAGES?'/AniNexus':'';
  const cleanPath=()=>{
    try{
      const u=new URL(location.href),restored=u.searchParams.get('p');
      if(restored)return restored.split('?')[0].replace(/\/+$/,'')||'/';
      let p=u.pathname;if(IS_PAGES)p=p.replace(/^\/AniNexus/,'')||'/';return p.replace(/\/+$/,'')||'/';
    }catch{return '/'}
  };
  function cleanupYears(scope=document){const max=new Date().getFullYear()+1;scope.querySelectorAll?.('[data-nx-year]').forEach(b=>{if(Number(b.dataset.nxYear)>max)b.remove()})}
  function cleanupCatalog(){document.body.classList.remove('nx21-catalog','nx20-catalog-active','nx21-catalog-active','nx23-catalog-active','nx21-cat-scroll-down','nx21-cat-scroll-up','nx23-scroll-down','nx23-scroll-up');const top=document.querySelector('#topbar');if(top)top.style.transform='';}
  function cleanupShared(){document.body.classList.remove('nx-section-page','nx-scroll-down','nx-scroll-up')}
  cleanupYears();

  document.addEventListener('click',e=>{
    if(e.target.closest('[data-nx-menu="year"],[data-v12-menu="year"]'))setTimeout(()=>cleanupYears(document.querySelector('.nx-popover-layer')||document),20);
    const generic=e.target.closest('[data-open]');
    if(generic&&!e.target.closest('[data-list],[data-fav]')){
      const nearest=e.target.closest('button,a');
      if(!nearest||nearest===generic){const id=Number(generic.dataset.open),type=String(generic.dataset.type||'anime').toLowerCase();if(Number.isFinite(id)&&type==='anime'){e.preventDefault();e.stopImmediatePropagation();cleanupCatalog();cleanupShared();history.pushState({},'',`${BASE}/anime/titulo-${id}`);window.dispatchEvent(new PopStateEvent('popstate'));return}}
    }
    const link=e.target.closest('a[data-link],a[href]');
    if(link){
      const href=String(link.getAttribute('href')||'');
      if(href&&!href.startsWith('#')&&!/^(https?:|mailto:|tel:)/i.test(href)){
        if(!href.includes('/animes/catalogo'))cleanupCatalog();
        if(!href.includes('/animes/temporadas')){document.body.classList.remove('nx-season-active','season-v7-active','season-v8-active','nx-detail-active','nx-popover-open','nx-v11-fixed-popover');document.querySelectorAll('.nx-v10-seasonbar,.nx-popover-layer').forEach(n=>n.remove())}
        if(!href.includes('/animes/programacao')){document.body.classList.remove('nx18-header-hidden');document.querySelectorAll('.nx18-island,.nx18-modal').forEach(n=>n.remove())}
      }
    }
  },true);

  window.addEventListener('popstate',()=>{
    cleanupYears();
    const p=cleanPath();
    if(p!=='/animes/catalogo')cleanupCatalog();
    if(!p.startsWith('/animes/temporadas')&&!/^\/anime\/.+-\d+$/.test(p)){document.body.classList.remove('nx-season-active','season-v7-active','season-v8-active','nx-detail-active','nx-popover-open','nx-v11-fixed-popover');document.querySelectorAll('.nx-v10-seasonbar,.nx-popover-layer').forEach(n=>n.remove())}
    if(p!=='/animes/programacao'){document.body.classList.remove('nx18-header-hidden');document.querySelectorAll('.nx18-island,.nx18-modal').forEach(n=>n.remove())}
    if(!/^\/animes\/(?:catalogo|programacao|temporadas(?:\/|$))/.test(p))cleanupShared();
  });
})();
