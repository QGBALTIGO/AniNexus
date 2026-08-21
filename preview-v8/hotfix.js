'use strict';
(() => {
  const IS_PAGES=location.hostname.endsWith('github.io');
  const BASE=IS_PAGES?'/AniNexus':'';
  const cleanPath=()=>{let p=location.pathname;if(IS_PAGES)p=p.replace(/^\/AniNexus/,'')||'/';return p.replace(/\/+$/,'')||'/'};
  function cleanupYears(){
    const max=new Date().getFullYear()+1;
    document.querySelectorAll('[data-nx-year]').forEach(b=>{if(Number(b.dataset.nxYear)>max)b.remove();});
    document.querySelectorAll('#nx-year-options').forEach(t=>{[...t.content.querySelectorAll('[data-nx-year]')].forEach(b=>{if(Number(b.dataset.nxYear)>max)b.remove();});});
  }
  const observer=new MutationObserver(()=>cleanupYears());
  observer.observe(document.documentElement,{subtree:true,childList:true});
  cleanupYears();

  document.addEventListener('click',e=>{
    const generic=e.target.closest('[data-open]');
    if(generic&&!e.target.closest('[data-list],[data-fav]')){
      const nearestControl=e.target.closest('button,a');
      if(!nearestControl||nearestControl===generic){
        const id=Number(generic.dataset.open);
        const type=String(generic.dataset.type||'anime').toLowerCase();
        if(Number.isFinite(id)&&type==='anime'){
          e.preventDefault();e.stopImmediatePropagation();
          history.pushState({},'',`${BASE}/anime/titulo-${id}`);
          window.dispatchEvent(new PopStateEvent('popstate'));
          return;
        }
      }
    }
    const link=e.target.closest('a[data-link]');
    if(link&&!String(link.getAttribute('href')||'').includes('/animes/temporadas')){
      document.body.classList.remove('nx-season-active','nx-detail-active','nx-popover-open');
      document.querySelector('.nx-popover-layer')?.remove();
    }
  },true);

  window.addEventListener('popstate',()=>{
    const p=cleanPath();
    if(!p.startsWith('/animes/temporadas')&&!/^\/anime\/.+-\d+$/.test(p)){
      document.body.classList.remove('nx-season-active','nx-detail-active','nx-popover-open');
      document.querySelector('.nx-popover-layer')?.remove();
    }
  });
})();
