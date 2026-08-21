'use strict';
(() => {
  const body = document.body;
  const MOBILE = matchMedia('(max-width:720px)');
  let anchor = null;
  let raf = 0;

  const chevron = dir => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m${dir<0?'15 5-7 7 7 7':'9 5 7 7-7 7'}"/></svg>`;

  function syncTheme(){
    const season = document.querySelector('.nx-season')?.dataset?.season;
    if(season) body.dataset.nxSeasonTheme = season;
    else delete body.dataset.nxSeasonTheme;
  }

  function updateCarouselButtons(section){
    const rail = section.querySelector('.nx-still-rail');
    if(!rail) return;
    const prev = section.querySelector('[data-nx-still-prev]');
    const next = section.querySelector('[data-nx-still-next]');
    const max = Math.max(0, rail.scrollWidth - rail.clientWidth);
    if(prev) prev.disabled = rail.scrollLeft <= 4;
    if(next) next.disabled = rail.scrollLeft >= max - 4;
  }

  function enhanceStill(section){
    if(!section || section.dataset.nxV11Carousel === '1') return;
    const rail = section.querySelector('.nx-still-rail');
    const title = section.querySelector('.nx-section-title');
    if(!rail || !title) return;
    section.dataset.nxV11Carousel = '1';

    const nav = document.createElement('div');
    nav.className = 'nx-still-nav';
    nav.innerHTML = `<button type="button" data-nx-still-prev aria-label="Voltar">${chevron(-1)}</button><button type="button" data-nx-still-next aria-label="Avançar">${chevron(1)}</button>`;
    title.insertAdjacentElement('afterend', nav);

    const move = dir => {
      const card = rail.querySelector('article');
      const cardW = card?.getBoundingClientRect().width || 128;
      const step = Math.max(cardW * 2 + 14, rail.clientWidth * .72);
      rail.scrollBy({left:dir * step, behavior:'smooth'});
    };
    nav.querySelector('[data-nx-still-prev]').addEventListener('click', () => move(-1));
    nav.querySelector('[data-nx-still-next]').addEventListener('click', () => move(1));
    rail.addEventListener('scroll', () => {
      if(raf) return;
      raf = requestAnimationFrame(() => { raf = 0; updateCarouselButtons(section); });
    }, {passive:true});
    new ResizeObserver(() => updateCarouselButtons(section)).observe(rail);
    updateCarouselButtons(section);
  }

  function popKind(menu){
    if(menu.classList.contains('nx-year-menu')) return 'year';
    if(menu.classList.contains('nx-tag-menu')) return 'tag';
    return 'type';
  }

  function placeFixedPopover(layer){
    if(!MOBILE.matches || !layer || !anchor?.el?.isConnected) return;
    const menu = layer.querySelector('.nx-popover');
    if(!menu || popKind(menu) !== anchor.kind) return;
    const rect = anchor.el.getBoundingClientRect();
    const width = anchor.kind === 'year' ? 190 : anchor.kind === 'tag' ? 244 : 204;
    const left = Math.max(10, Math.min(innerWidth - width - 10, rect.left + (rect.width - width) / 2));
    const measuredH = Math.min(menu.scrollHeight || 260, innerHeight - 120);
    let top = rect.bottom + 7;
    if(top + measuredH > innerHeight - 10) top = Math.max(58, rect.top - measuredH - 7);
    body.classList.add('nx-v11-fixed-popover');
    menu.style.setProperty('--v11-left', `${Math.round(left)}px`);
    menu.style.setProperty('--v11-top', `${Math.round(top)}px`);
    menu.style.setProperty('--v11-width', `${width}px`);
  }

  function reinforcePopover(){
    const layer = document.querySelector('.nx-popover-layer');
    if(!layer) return;
    [0,18,42,78,130,220].forEach(ms => setTimeout(() => placeFixedPopover(layer), ms));
  }

  document.addEventListener('pointerdown', e => {
    const fixed = e.target.closest('.nx-v10-seasonbar [data-v10-menu]');
    if(fixed){
      anchor = {kind:fixed.dataset.v10Menu, el:fixed};
      reinforcePopover();
    }
  }, true);

  document.addEventListener('click', e => {
    const fixed = e.target.closest('.nx-v10-seasonbar [data-v10-menu]');
    if(fixed){
      anchor = {kind:fixed.dataset.v10Menu, el:fixed};
      reinforcePopover();
      return;
    }
    if(e.target.closest('.nx-popover-backdrop,[data-nx-year],[data-nx-tag],[data-nx-type],[data-nx-popover-close]')){
      setTimeout(() => {
        if(!document.querySelector('.nx-popover-layer')){
          anchor = null;
          body.classList.remove('nx-v11-fixed-popover');
        }
      }, 60);
    }
  }, true);

  addEventListener('resize', () => {
    syncTheme();
    reinforcePopover();
    document.querySelectorAll('.nx-still').forEach(enhanceStill);
  }, {passive:true});

  const mo = new MutationObserver(records => {
    let shouldSync = false;
    for(const rec of records){
      if(rec.type === 'attributes') shouldSync = true;
      for(const n of rec.addedNodes){
        if(n.nodeType !== 1) continue;
        if(n.matches?.('.nx-still')) enhanceStill(n);
        n.querySelectorAll?.('.nx-still').forEach(enhanceStill);
        if(n.matches?.('.nx-popover-layer') || n.querySelector?.('.nx-popover-layer')) reinforcePopover();
        if(n.matches?.('.nx-season') || n.querySelector?.('.nx-season')) shouldSync = true;
      }
    }
    if(shouldSync) syncTheme();
    if(!document.querySelector('.nx-popover-layer')){
      anchor = null;
      body.classList.remove('nx-v11-fixed-popover');
    }
  });
  mo.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-season','class']});

  syncTheme();
  document.querySelectorAll('.nx-still').forEach(enhanceStill);
})();
