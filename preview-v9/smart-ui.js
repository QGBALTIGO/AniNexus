'use strict';
(() => {
  const MOBILE=matchMedia('(max-width:720px)');
  const body=document.body;
  let bar=null,raf=0,lastDirY=Math.max(0,scrollY),lastProxyRect=null,mutTimer=0;
  const onSeason=()=>MOBILE.matches&&body.classList.contains('nx-season-active')&&!!document.querySelector('.nx-season-title');
  const overlayOpen=()=>!document.querySelector('#drawer')?.hidden||!document.querySelector('#searchOverlay')?.hidden||!document.querySelector('#authOverlay')?.hidden||body.classList.contains('nx-popover-open');

  const I={
    tag:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 12.5 12 4h7.5v7.5L11 20l-7.5-7.5Z"/><circle cx="16.2" cy="7.8" r="1.2"/></svg>',
    type:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M7 4v4M17 4v4M3.5 9h17"/><path d="m10 12 5 3-5 3v-6Z"/></svg>',
    year:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M7.5 3v4M16.5 3v4M3.5 9.5h17"/></svg>',
    chevron:'<svg class="nx-v10-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9 5 5 5-5"/></svg>'
  };

  function removeLegacy(){document.querySelectorAll('.nx-v9-season-dock').forEach(x=>x.remove());body.classList.remove('nx-header-hidden','nx-v9-dock-visible')}
  function seasonName(){const h=document.querySelector('.nx-season-title h1');if(!h)return{label:'Temporada',year:''};const year=h.querySelector('em')?.textContent?.trim()||'';const clone=h.cloneNode(true);clone.querySelector('em')?.remove();return{label:clone.textContent.trim(),year}}
  function seasonKey(){return document.querySelector('.nx-season')?.dataset.season||'SUMMER'}
  function iconHTML(){return document.querySelector('.nx-season-icon')?.innerHTML||''}
  function controlLabel(kind,fallback){return document.querySelector(`[data-nx-menu="${kind}"] strong`)?.textContent?.trim()||fallback}
  function menuButton(kind,label){const icon=kind==='tag'?I.tag:kind==='type'?I.type:I.year;return `<button type="button" class="nx-v10-seasonbar__btn" data-v10-menu="${kind}">${icon}<span>${label}</span>${I.chevron}</button>`}

  function markup(){
    const n=seasonName();
    return `<button type="button" class="nx-v10-seasonbar__head" data-v10-toggle aria-expanded="false">
      <span class="nx-v10-seasonbar__icon">${iconHTML()}</span>
      <span class="nx-v10-seasonbar__copy"><span class="nx-v10-seasonbar__title">${n.label} <em>${n.year}</em></span><span class="nx-v10-seasonbar__sub">TEMPORADA DE ANIMES</span></span>
      <span class="nx-v10-seasonbar__toggle">${I.chevron}</span>
    </button>
    <div class="nx-v10-seasonbar__controls"><div class="nx-v10-seasonbar__controls-inner">
      <div class="nx-v10-seasonbar__row"><div class="nx-v10-seasonbar__seasons">
        <button type="button" data-v10-season="WINTER">Inverno</button><button type="button" data-v10-season="SPRING">Primavera</button><button type="button" data-v10-season="SUMMER">Verão</button><button type="button" data-v10-season="FALL">Outono</button>
      </div>${menuButton('year',controlLabel('year',n.year))}</div>
      <div class="nx-v10-seasonbar__filters">${menuButton('tag',controlLabel('tag','Tags'))}${menuButton('type',controlLabel('type','Tipo'))}</div>
    </div></div>`;
  }

  function proxySeason(key){
    const original=document.querySelector(`[data-nx-season="${key}"]`);
    if(original){original.click();return true}
    return false;
  }
  function proxyMenu(kind,proxy){
    const original=document.querySelector(`.nx-season-controls [data-nx-menu="${kind}"]`);
    if(!original)return false;
    lastProxyRect=proxy.getBoundingClientRect();
    original.click();
    setTimeout(()=>positionPopover(document.querySelector('.nx-popover-layer')),0);
    setTimeout(()=>positionPopover(document.querySelector('.nx-popover-layer')),40);
    return true;
  }

  function createBar(){
    if(bar)return;
    bar=document.createElement('section');
    bar.className='nx-v10-seasonbar';
    bar.setAttribute('aria-label','Controles da temporada');
    bar.innerHTML=markup();
    body.append(bar);
    bar.addEventListener('click',e=>{
      const toggle=e.target.closest('[data-v10-toggle]');
      if(toggle){e.preventDefault();bar.classList.toggle('expanded');toggle.setAttribute('aria-expanded',String(bar.classList.contains('expanded')));return}
      const season=e.target.closest('[data-v10-season]');
      if(season){e.preventDefault();proxySeason(season.dataset.v10Season);return}
      const menu=e.target.closest('[data-v10-menu]');
      if(menu){e.preventDefault();e.stopPropagation();bar.classList.add('expanded');bar.querySelector('[data-v10-toggle]')?.setAttribute('aria-expanded','true');proxyMenu(menu.dataset.v10Menu,menu)}
    });
  }

  function ensureBar(){
    removeLegacy();
    if(!onSeason()){bar?.remove();bar=null;return}
    createBar();
    syncBar();
  }
  function syncMenuButton(kind,label){
    const b=bar?.querySelector(`[data-v10-menu="${kind}"]`);if(!b)return;
    const span=b.querySelector('span');if(span)span.textContent=label;
    const orig=document.querySelector(`.nx-season-controls [data-nx-menu="${kind}"]`);
    b.classList.toggle('has-filter',!!orig?.classList.contains('selected'));
  }
  function syncBar(){
    if(!bar||!onSeason())return;
    const key=seasonKey(),n=seasonName();
    bar.dataset.season=key;
    const title=bar.querySelector('.nx-v10-seasonbar__title');if(title)title.innerHTML=`${n.label} <em>${n.year}</em>`;
    const ico=bar.querySelector('.nx-v10-seasonbar__icon');if(ico)ico.innerHTML=iconHTML();
    bar.querySelectorAll('[data-v10-season]').forEach(b=>b.classList.toggle('active',b.dataset.v10Season===key));
    syncMenuButton('year',controlLabel('year',n.year));syncMenuButton('tag',controlLabel('tag','Tags'));syncMenuButton('type',controlLabel('type','Tipo'));
  }

  function updateScroll(){
    raf=0;const y=Math.max(0,scrollY);body.classList.toggle('nx-header-raised',y>8);
    if(!bar||!onSeason()){lastDirY=y;return}
    const controls=document.querySelector('.nx-season-controls');if(!controls)return;
    const show=controls.getBoundingClientRect().bottom<54;
    bar.classList.toggle('show',show);
    if(!show){bar.classList.remove('expanded');bar.querySelector('[data-v10-toggle]')?.setAttribute('aria-expanded','false');lastDirY=y;return}
    if(overlayOpen()){lastDirY=y;return}
    const delta=y-lastDirY;
    if(delta>9){bar.classList.remove('expanded');bar.querySelector('[data-v10-toggle]')?.setAttribute('aria-expanded','false');lastDirY=y}
    else if(delta<-8){bar.classList.add('expanded');bar.querySelector('[data-v10-toggle]')?.setAttribute('aria-expanded','true');lastDirY=y}
  }
  function schedule(){if(!raf)raf=requestAnimationFrame(updateScroll)}

  function positionPopover(layer){
    if(!MOBILE.matches||!layer)return;
    const menu=layer.querySelector('.nx-popover');if(!menu)return;
    const open=document.querySelector('.nx-filter-pill.open');
    const rect=lastProxyRect||open?.getBoundingClientRect();lastProxyRect=null;
    const kind=menu.classList.contains('nx-year-menu')?'year':menu.classList.contains('nx-tag-menu')?'tag':'type';
    const width=kind==='year'?190:kind==='tag'?244:204;
    let left=rect?rect.left+(rect.width-width)/2:(innerWidth-width)/2;
    left=Math.max(10,Math.min(innerWidth-width-10,left));
    let top=rect?rect.bottom+7:96;
    const maxH=Math.min(286,innerHeight-124);
    if(top+maxH>innerHeight-10&&rect)top=Math.max(58,rect.top-maxH-7);
    menu.style.setProperty('--v10-left',`${Math.round(left)}px`);menu.style.setProperty('--v10-top',`${Math.round(top)}px`);menu.style.setProperty('--v10-width',`${width}px`);
  }

  addEventListener('scroll',schedule,{passive:true});
  addEventListener('resize',()=>{ensureBar();schedule()},{passive:true});
  MOBILE.addEventListener?.('change',()=>{ensureBar();schedule()});
  document.addEventListener('click',e=>{if(e.target.closest('[data-nx-season],[data-nx-year],[data-nx-tag],[data-nx-type]'))setTimeout(()=>{ensureBar();syncBar();schedule()},45)});
  const mo=new MutationObserver(ms=>{
    for(const m of ms)for(const n of m.addedNodes)if(n.nodeType===1&&n.matches?.('.nx-popover-layer'))setTimeout(()=>positionPopover(n),0);
    clearTimeout(mutTimer);mutTimer=setTimeout(()=>{ensureBar();syncBar();schedule();const layer=document.querySelector('.nx-popover-layer');if(layer)positionPopover(layer)},45);
  });
  mo.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','data-season']});
  ensureBar();schedule();
})();
