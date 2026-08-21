'use strict';
(() => {
  const MOBILE=matchMedia('(max-width:720px)');
  const body=document.body;
  let bar=null,raf=0,lastDirY=Math.max(0,scrollY),lastProxyRect=null,mutTimer=0;
  const onSeason=()=>MOBILE.matches&&body.classList.contains('nx-season-active')&&!!document.querySelector('.nx-season-title');
  const overlayOpen=()=>!document.querySelector('#drawer')?.hidden||!document.querySelector('#searchOverlay')?.hidden||!document.querySelector('#authOverlay')?.hidden;

  function removeOld(){document.querySelectorAll('.nx-v9-season-dock').forEach(x=>x.remove());body.classList.remove('nx-header-hidden','nx-v9-dock-visible')}
  function seasonName(){const h=document.querySelector('.nx-season-title h1');if(!h)return{label:'Temporada',year:''};const year=h.querySelector('em')?.textContent?.trim()||'';const clone=h.cloneNode(true);clone.querySelector('em')?.remove();return{label:clone.textContent.trim(),year}}
  function seasonKey(){return document.querySelector('.nx-season')?.dataset.season||'SUMMER'}
  function iconHTML(){return document.querySelector('.nx-season-icon')?.innerHTML||''}
  function controlLabel(kind,fallback){return document.querySelector(`[data-nx-menu="${kind}"] strong`)?.textContent?.trim()||fallback}

  function markup(){const n=seasonName();return `<div class="nx-v10-seasonbar__head"><span class="nx-v10-seasonbar__icon">${iconHTML()}</span><div class="nx-v10-seasonbar__copy"><h2>${n.label} <em>${n.year}</em></h2><p>TEMPORADA DE ANIMES</p></div></div><div class="nx-v10-seasonbar__controls"><div class="nx-v10-seasonbar__controls-inner"><div class="nx-v10-seasonbar__row"><div class="nx-v10-seasonbar__seasons"><button data-v10-season="WINTER">Inverno</button><button data-v10-season="SPRING">Primavera</button><button data-v10-season="SUMMER">Verão</button><button data-v10-season="FALL">Outono</button></div><button class="nx-v10-seasonbar__btn" data-v10-menu="year">${controlLabel('year',n.year)}</button></div><div class="nx-v10-seasonbar__filters"><button class="nx-v10-seasonbar__btn" data-v10-menu="tag">${controlLabel('tag','Tags')}</button><button class="nx-v10-seasonbar__btn" data-v10-menu="type">${controlLabel('type','Tipo')}</button></div></div></div>`}

  function ensureBar(){
    removeOld();
    if(!onSeason()){bar?.remove();bar=null;return}
    if(!bar){bar=document.createElement('section');bar.className='nx-v10-seasonbar';bar.setAttribute('aria-label','Temporada atual');body.append(bar);bar.addEventListener('click',e=>{const s=e.target.closest('[data-v10-season]');if(s){document.querySelector(`[data-nx-season="${s.dataset.v10Season}"]`)?.click();return}const m=e.target.closest('[data-v10-menu]');if(m){lastProxyRect=m.getBoundingClientRect();document.querySelector(`[data-nx-menu="${m.dataset.v10Menu}"]`)?.click()}})}
    bar.dataset.season=seasonKey();bar.innerHTML=markup();syncBar();
  }
  function syncBar(){if(!bar||!onSeason())return;const key=seasonKey();bar.dataset.season=key;const n=seasonName(),h2=bar.querySelector('h2');if(h2)h2.innerHTML=`${n.label} <em>${n.year}</em>`;const ico=bar.querySelector('.nx-v10-seasonbar__icon');if(ico)ico.innerHTML=iconHTML();bar.querySelectorAll('[data-v10-season]').forEach(b=>b.classList.toggle('active',b.dataset.v10Season===key));for(const kind of ['year','tag','type']){const b=bar.querySelector(`[data-v10-menu="${kind}"]`);if(!b)continue;b.textContent=controlLabel(kind,kind==='year'?n.year:kind==='tag'?'Tags':'Tipo');const orig=document.querySelector(`[data-nx-menu="${kind}"]`);b.classList.toggle('has-filter',!!orig?.classList.contains('selected'))}}

  function updateScroll(){raf=0;const y=Math.max(0,scrollY);body.classList.toggle('nx-header-raised',y>8);if(!bar||!onSeason()||overlayOpen()){bar?.classList.remove('show','expanded');lastDirY=y;return}const controls=document.querySelector('.nx-season-controls');if(!controls)return;const show=controls.getBoundingClientRect().bottom<54;bar.classList.toggle('show',show);if(!show){bar.classList.remove('expanded');lastDirY=y;return}const delta=y-lastDirY;if(delta>7){bar.classList.remove('expanded');lastDirY=y}else if(delta<-6){bar.classList.add('expanded');lastDirY=y}}
  function schedule(){if(!raf)raf=requestAnimationFrame(updateScroll)}

  function positionPopover(layer){if(!MOBILE.matches||!layer)return;const menu=layer.querySelector('.nx-popover');if(!menu)return;const open=document.querySelector('.nx-filter-pill.open');const rect=lastProxyRect||open?.getBoundingClientRect();lastProxyRect=null;const kind=menu.classList.contains('nx-year-menu')?'year':menu.classList.contains('nx-tag-menu')?'tag':'type';const width=kind==='year'?190:kind==='tag'?238:196;let left=rect?rect.left+(rect.width-width)/2:(innerWidth-width)/2;left=Math.max(10,Math.min(innerWidth-width-10,left));let top=rect?rect.bottom+6:96;const maxH=Math.min(282,innerHeight-130);if(top+maxH>innerHeight-10&&rect)top=Math.max(60,rect.top-maxH-6);menu.style.setProperty('--v10-left',`${Math.round(left)}px`);menu.style.setProperty('--v10-top',`${Math.round(top)}px`);menu.style.setProperty('--v10-width',`${width}px`)}

  addEventListener('scroll',schedule,{passive:true});addEventListener('resize',()=>{ensureBar();schedule()},{passive:true});MOBILE.addEventListener?.('change',()=>{ensureBar();schedule()});
  document.addEventListener('click',e=>{if(e.target.closest('[data-nx-season],[data-nx-year],[data-nx-tag],[data-nx-type]'))setTimeout(()=>{ensureBar();syncBar();schedule()},35)});
  const mo=new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes)if(n.nodeType===1&&n.matches?.('.nx-popover-layer'))setTimeout(()=>positionPopover(n),0);clearTimeout(mutTimer);mutTimer=setTimeout(()=>{ensureBar();syncBar();schedule();const layer=document.querySelector('.nx-popover-layer');if(layer)positionPopover(layer)},28)});
  mo.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','data-season']});
  ensureBar();schedule();
})();
