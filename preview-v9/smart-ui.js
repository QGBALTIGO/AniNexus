'use strict';
(() => {
  const MOBILE = matchMedia('(max-width:720px)');
  const body = document.body;
  const topbar = document.querySelector('#topbar');
  let dock = null;
  let lastY = Math.max(0, scrollY);
  let lastMeaningfulY = lastY;
  let raf = 0;
  let mutationTimer = 0;

  const onSeason = () => body.classList.contains('nx-season-active') && !!document.querySelector('.nx-season-controls');
  const overlayOpen = () => !document.querySelector('#drawer')?.hidden || !document.querySelector('#searchOverlay')?.hidden || !document.querySelector('#authOverlay')?.hidden || body.classList.contains('nx-popover-open');

  function dockMarkup(){
    return `<div class="nx-v9-dock-seasons" aria-label="Trocar temporada">
      <button type="button" data-v9-season="WINTER">Inverno</button>
      <button type="button" data-v9-season="SPRING">Primavera</button>
      <button type="button" data-v9-season="SUMMER">Verão</button>
      <button type="button" data-v9-season="FALL">Outono</button>
    </div>
    <button type="button" class="nx-v9-dock-action year" data-v9-menu="year" aria-label="Escolher ano">—</button>
    <button type="button" class="nx-v9-dock-action label" data-v9-menu="tag" aria-label="Filtrar por tags">Tags</button>
    <button type="button" class="nx-v9-dock-action label" data-v9-menu="type" aria-label="Filtrar por tipo">Tipo</button>`;
  }

  function ensureDock(){
    if(!MOBILE.matches || !onSeason()){
      dock?.remove(); dock=null;
      body.classList.remove('nx-header-hidden','nx-header-raised','nx-v9-dock-visible');
      return;
    }
    if(!dock){
      dock=document.createElement('nav');
      dock.className='nx-v9-season-dock';
      dock.setAttribute('aria-label','Controles rápidos da temporada');
      dock.innerHTML=dockMarkup();
      body.append(dock);
      dock.addEventListener('click',e=>{
        const season=e.target.closest('[data-v9-season]');
        if(season){document.querySelector(`[data-nx-season="${season.dataset.v9Season}"]`)?.click();return;}
        const menu=e.target.closest('[data-v9-menu]');
        if(menu){document.querySelector(`[data-nx-menu="${menu.dataset.v9Menu}"]`)?.click();}
      });
    }
    syncDock();
  }

  function syncDock(){
    if(!dock || !onSeason()) return;
    const active=document.querySelector('.nx-season-tabs [data-nx-season].active')?.dataset.nxSeason;
    dock.querySelectorAll('[data-v9-season]').forEach(b=>b.classList.toggle('active',b.dataset.v9Season===active));
    const year=document.querySelector('.nx-year-pill strong')?.textContent?.trim()||'Ano';
    const yearBtn=dock.querySelector('[data-v9-menu="year"]'); if(yearBtn)yearBtn.textContent=year;
    for(const kind of ['tag','type']){
      const original=document.querySelector(`[data-nx-menu="${kind}"]`);
      const target=dock.querySelector(`[data-v9-menu="${kind}"]`);
      if(!target)continue;
      target.classList.toggle('has-filter',!!original?.classList.contains('selected'));
      const label=original?.querySelector('strong')?.textContent?.trim();
      target.textContent=label|| (kind==='tag'?'Tags':'Tipo');
    }
  }

  function updateDockVisibility(){
    if(!dock || !MOBILE.matches || !onSeason()) return;
    const controls=document.querySelector('.nx-season-controls');
    if(!controls){dock.classList.remove('show');body.classList.remove('nx-v9-dock-visible');return;}
    const threshold=(topbar?.getBoundingClientRect().height||64)+6;
    const visible=controls.getBoundingClientRect().bottom < threshold;
    dock.classList.toggle('show',visible);
    body.classList.toggle('nx-v9-dock-visible',visible);
  }

  function updateScrollChrome(){
    raf=0;
    const y=Math.max(0,scrollY);
    body.classList.toggle('nx-header-raised',y>12);
    if(!MOBILE.matches || !onSeason() || overlayOpen()){
      body.classList.remove('nx-header-hidden');
      lastY=y; lastMeaningfulY=y; updateDockVisibility(); return;
    }
    const delta=y-lastMeaningfulY;
    if(y<42){body.classList.remove('nx-header-hidden'); lastMeaningfulY=y;}
    else if(delta>10 && y>118){body.classList.add('nx-header-hidden');lastMeaningfulY=y;}
    else if(delta<-8){body.classList.remove('nx-header-hidden');lastMeaningfulY=y;}
    lastY=y;
    updateDockVisibility();
  }

  function scheduleScroll(){if(!raf)raf=requestAnimationFrame(updateScrollChrome)}
  addEventListener('scroll',scheduleScroll,{passive:true});
  addEventListener('resize',()=>{ensureDock();scheduleScroll()},{passive:true});
  MOBILE.addEventListener?.('change',()=>{ensureDock();scheduleScroll()});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){ensureDock();scheduleScroll()}});

  const mo=new MutationObserver(()=>{
    clearTimeout(mutationTimer);
    mutationTimer=setTimeout(()=>{ensureDock();syncDock();scheduleScroll()},35);
  });
  mo.observe(document.querySelector('#app')||document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','data-season']});

  document.addEventListener('click',e=>{
    if(e.target.closest('[data-nx-season],[data-nx-menu],[data-nx-year],[data-nx-tag],[data-nx-type]')) setTimeout(()=>{ensureDock();syncDock();scheduleScroll()},45);
  });

  ensureDock();
  scheduleScroll();
})();
