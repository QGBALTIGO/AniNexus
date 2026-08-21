'use strict';
(() => {
  const body=document.body;
  const IS_PAGES=location.hostname.endsWith('github.io');
  let activeSection=null;
  let lastY=Math.max(0,scrollY);
  let raf=0;

  function routePath(){
    try{
      const u=new URL(location.href);
      const restored=u.searchParams.get('p');
      if(restored)return restored.split('?')[0].replace(/\/+$/,'')||'/';
      let p=u.pathname;
      if(IS_PAGES)p=p.replace(/^\/AniNexus/,'')||'/';
      return p.replace(/\/+$/,'')||'/';
    }catch{return '/'}
  }

  function section(){
    const p=routePath();
    if(window.__NX_CATALOG_BOOT__||p==='/animes/catalogo'||p==='/__nx_catalog_boot')return'catalog';
    if(window.__NX_SCHEDULE_BOOT__||p==='/animes/programacao'||p==='/__nx_schedule_boot')return'schedule';
    if(/^\/animes\/temporadas(?:\/|$)/.test(p))return'season';
    return null;
  }

  function removeSectionArtifacts(kind){
    if(kind==='catalog'){
      body.classList.remove('nx21-catalog','nx20-catalog-active','nx21-catalog-active','nx23-catalog-active','nx21-cat-scroll-down','nx21-cat-scroll-up','nx23-scroll-down','nx23-scroll-up');
    }
    if(kind==='schedule'){
      body.classList.remove('nx18-header-hidden','nx18-schedule-active');
      document.querySelectorAll('.nx18-island,.nx18-modal').forEach(n=>n.remove());
    }
    if(kind==='season'){
      body.classList.remove('nx-season-active','season-v7-active','season-v8-active','nx-v11-fixed-popover','nx-popover-open');
      document.querySelectorAll('.nx-v10-seasonbar,.nx-popover-layer').forEach(n=>n.remove());
      delete body.dataset.nxSeasonTheme;
    }
  }

  function applySection(){
    const next=section();
    if(next!==activeSection){
      if(activeSection)removeSectionArtifacts(activeSection);
      activeSection=next;
      lastY=Math.max(0,scrollY);
    }
    body.classList.toggle('nx-section-page',!!next);
    if(!next){
      body.classList.remove('nx-scroll-down','nx-scroll-up');
      const top=document.querySelector('#topbar');if(top)top.style.transform='';
      return;
    }
    body.classList.add('nx-scroll-up');
    body.classList.remove('nx-scroll-down');
    syncSticky();
  }

  function setDirection(dir){
    if(!activeSection)return;
    const down=dir==='down';
    body.classList.toggle('nx-scroll-down',down);
    body.classList.toggle('nx-scroll-up',!down);
    if(activeSection==='schedule')body.classList.toggle('nx18-header-hidden',down);
  }

  function chromeTop(){return matchMedia('(max-width:720px)').matches?54:66}

  function syncSticky(){
    if(activeSection!=='catalog')return;
    const strip=document.querySelector('.nx21-strip');
    const hero=document.querySelector('.nx21-hero');
    if(!strip||!hero)return;
    const top=body.classList.contains('nx-scroll-down')?0:chromeTop();
    strip.classList.toggle('is-stuck',hero.getBoundingClientRect().bottom<=top+2);
  }

  function onScroll(){
    if(raf)return;
    raf=requestAnimationFrame(()=>{
      raf=0;
      if(!activeSection){lastY=Math.max(0,scrollY);return}
      const y=Math.max(0,scrollY),delta=y-lastY;
      if(y<=70)setDirection('up');
      else if(delta>5&&y>115)setDirection('down');
      else if(delta<-5)setDirection('up');
      lastY=y;
      syncSticky();
    });
  }

  document.addEventListener('click',e=>{
    const a=e.target.closest('a[href]');
    if(!a||a.target==='_blank')return;
    const href=String(a.getAttribute('href')||'');
    if(!href||href.startsWith('#')||/^(https?:|mailto:|tel:)/i.test(href))return;
    const old=activeSection;
    if(!old)return;
    let dest=href;
    try{dest=new URL(href,location.href).pathname;if(IS_PAGES)dest=dest.replace(/^\/AniNexus/,'')||'/'}catch{}
    const stays=(old==='catalog'&&dest.includes('/animes/catalogo'))||(old==='schedule'&&dest.includes('/animes/programacao'))||(old==='season'&&dest.includes('/animes/temporadas'));
    if(!stays){
      removeSectionArtifacts(old);
      body.classList.remove('nx-section-page','nx-scroll-down','nx-scroll-up');
      activeSection=null;
    }
  },true);

  addEventListener('scroll',onScroll,{passive:true});
  addEventListener('resize',()=>{if(!raf)raf=requestAnimationFrame(()=>{raf=0;syncSticky()})},{passive:true});
  addEventListener('popstate',()=>setTimeout(applySection,0));
  document.addEventListener('aninexus:routechange',applySection);

  const observer=new MutationObserver(records=>{
    let relevant=false;
    for(const r of records){
      for(const n of r.addedNodes){
        if(n.nodeType!==1)continue;
        if(n.matches?.('.nx21-strip,.nx18-island,.nx-v10-seasonbar')||n.querySelector?.('.nx21-strip,.nx18-island,.nx-v10-seasonbar')){relevant=true;break}
      }
      if(relevant)break;
    }
    if(relevant){applySection();syncSticky()}
  });
  observer.observe(document.body,{childList:true,subtree:true});

  applySection();
})();
