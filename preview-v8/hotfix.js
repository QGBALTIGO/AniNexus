'use strict';
(() => {
  const IS_PAGES=location.hostname.endsWith('github.io');
  const BASE=IS_PAGES?'/AniNexus':'';
  const cleanPath=()=>{let p=location.pathname;if(IS_PAGES)p=p.replace(/^\/AniNexus/,'')||'/';return p.replace(/\/+$/,'')||'/'};
  function cleanupYears(scope=document){const max=new Date().getFullYear()+1;scope.querySelectorAll?.('[data-nx-year]').forEach(b=>{if(Number(b.dataset.nxYear)>max)b.remove()})}
  cleanupYears();

  document.addEventListener('click',e=>{
    if(e.target.closest('[data-nx-menu="year"],[data-v12-menu="year"]'))setTimeout(()=>cleanupYears(document.querySelector('.nx-popover-layer')||document),20);
    const generic=e.target.closest('[data-open]');
    if(generic&&!e.target.closest('[data-list],[data-fav]')){
      const nearest=e.target.closest('button,a');
      if(!nearest||nearest===generic){const id=Number(generic.dataset.open),type=String(generic.dataset.type||'anime').toLowerCase();if(Number.isFinite(id)&&type==='anime'){e.preventDefault();e.stopImmediatePropagation();history.pushState({},'',`${BASE}/anime/titulo-${id}`);window.dispatchEvent(new PopStateEvent('popstate'));return}}
    }
    const link=e.target.closest('a[data-link]');
    if(link&&!String(link.getAttribute('href')||'').includes('/animes/temporadas')){document.body.classList.remove('nx-season-active','nx-detail-active','nx-popover-open','nx-v11-fixed-popover');document.querySelector('.nx-popover-layer')?.remove()}
  },true);

  window.addEventListener('popstate',()=>{cleanupYears();const p=cleanPath();if(!p.startsWith('/animes/temporadas')&&!/^\/anime\/.+-\d+$/.test(p)){document.body.classList.remove('nx-season-active','nx-detail-active','nx-popover-open','nx-v11-fixed-popover');document.querySelector('.nx-popover-layer')?.remove()}});
})();
