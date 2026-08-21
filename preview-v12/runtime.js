'use strict';
(() => {
  const body=document.body;
  const app=document.querySelector('#app');
  const MOBILE=matchMedia('(max-width:720px)');
  let bar=null, activeAnchor=null, scrollRaf=0, syncRaf=0, lastY=Math.max(0,scrollY);

  const SVG={
    tag:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 12.5 12 4h7.5v7.5L11 20l-7.5-7.5Z"/><circle cx="16.2" cy="7.8" r="1.2"/></svg>',
    type:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M7 4v4M17 4v4M3.5 9h17"/><path d="m10 12 5 3-5 3v-6Z"/></svg>',
    year:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M7.5 3v4M16.5 3v4M3.5 9.5h17"/></svg>',
    down:'<svg class="nx-v10-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9 5 5 5-5"/></svg>',
    left:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>',
    right:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>'
  };

  const onSeason=()=>MOBILE.matches&&body.classList.contains('nx-season-active')&&!!document.querySelector('.nx-season-title');
  const key=()=>document.querySelector('.nx-season')?.dataset.season||'SUMMER';
  function titleData(){const h=document.querySelector('.nx-season-title h1');if(!h)return{label:'Temporada',year:''};const year=h.querySelector('em')?.textContent?.trim()||'';const c=h.cloneNode(true);c.querySelector('em')?.remove();return{label:c.textContent.trim(),year}}
  const icon=()=>document.querySelector('.nx-season-icon')?.innerHTML||'';
  const label=(kind,fallback)=>document.querySelector(`.nx-season-controls [data-nx-menu="${kind}"] strong`)?.textContent?.trim()||fallback;
  const menu=(kind,text)=>`<button type="button" class="nx-v10-seasonbar__btn" data-v12-menu="${kind}">${SVG[kind]}<span>${text}</span>${SVG.down}</button>`;

  function markup(){const t=titleData();return `<button type="button" class="nx-v10-seasonbar__head" data-v12-toggle aria-expanded="false"><span class="nx-v10-seasonbar__icon">${icon()}</span><span class="nx-v10-seasonbar__copy"><span class="nx-v10-seasonbar__title">${t.label} <em>${t.year}</em></span><span class="nx-v10-seasonbar__sub">TEMPORADA DE ANIMES</span></span><span class="nx-v10-seasonbar__toggle">${SVG.down}</span></button><div class="nx-v10-seasonbar__controls"><div class="nx-v10-seasonbar__controls-inner"><div class="nx-v10-seasonbar__row"><div class="nx-v10-seasonbar__seasons"><button type="button" data-v12-season="WINTER">Inverno</button><button type="button" data-v12-season="SPRING">Primavera</button><button type="button" data-v12-season="SUMMER">Verão</button><button type="button" data-v12-season="FALL">Outono</button></div>${menu('year',label('year',t.year))}</div><div class="nx-v10-seasonbar__filters">${menu('tag',label('tag','Tags'))}${menu('type',label('type','Tipo'))}</div></div></div>`}

  function makeBar(){
    if(bar||!onSeason())return;
    bar=document.createElement('section');bar.className='nx-v10-seasonbar';bar.setAttribute('aria-label','Controles da temporada');bar.innerHTML=markup();body.append(bar);
    bar.addEventListener('click',e=>{
      const toggle=e.target.closest('[data-v12-toggle]');
      if(toggle){const expanded=bar.classList.toggle('expanded');toggle.setAttribute('aria-expanded',String(expanded));return}
      const season=e.target.closest('[data-v12-season]');
      if(season){document.querySelector(`[data-nx-season="${season.dataset.v12Season}"]`)?.click();return}
      const m=e.target.closest('[data-v12-menu]');
      if(m){e.preventDefault();e.stopPropagation();bar.classList.add('expanded');bar.querySelector('[data-v12-toggle]')?.setAttribute('aria-expanded','true');activeAnchor={kind:m.dataset.v12Menu,el:m};const original=document.querySelector(`.nx-season-controls [data-nx-menu="${m.dataset.v12Menu}"]`);original?.click();setTimeout(positionCurrentPopover,0);setTimeout(positionCurrentPopover,32)}
    });
  }

  function syncBar(){
    if(!onSeason()){bar?.remove();bar=null;delete body.dataset.nxSeasonTheme;return}
    body.dataset.nxSeasonTheme=key();makeBar();if(!bar)return;
    const t=titleData(),k=key();bar.dataset.season=k;
    const tt=bar.querySelector('.nx-v10-seasonbar__title');if(tt)tt.innerHTML=`${t.label} <em>${t.year}</em>`;
    const ii=bar.querySelector('.nx-v10-seasonbar__icon');if(ii)ii.innerHTML=icon();
    bar.querySelectorAll('[data-v12-season]').forEach(b=>b.classList.toggle('active',b.dataset.v12Season===k));
    for(const kind of ['year','tag','type']){const b=bar.querySelector(`[data-v12-menu="${kind}"]`);if(!b)continue;const span=b.querySelector('span');if(span)span.textContent=label(kind,kind==='year'?t.year:kind==='tag'?'Tags':'Tipo');const orig=document.querySelector(`.nx-season-controls [data-nx-menu="${kind}"]`);b.classList.toggle('has-filter',!!orig?.classList.contains('selected'))}
  }

  function updateScroll(){
    scrollRaf=0;const y=Math.max(0,scrollY);if(!bar||!onSeason()){lastY=y;return}
    const controls=document.querySelector('.nx-season-controls');if(!controls){lastY=y;return}
    const show=controls.getBoundingClientRect().bottom<54;bar.classList.toggle('show',show);
    if(!show){bar.classList.remove('expanded');bar.querySelector('[data-v12-toggle]')?.setAttribute('aria-expanded','false');lastY=y;return}
    if(document.querySelector('.nx-popover-layer')){positionCurrentPopover();lastY=y;return}
    const d=y-lastY;if(d>12){bar.classList.remove('expanded');bar.querySelector('[data-v12-toggle]')?.setAttribute('aria-expanded','false')}else if(d<-12){bar.classList.add('expanded');bar.querySelector('[data-v12-toggle]')?.setAttribute('aria-expanded','true')}lastY=y;
  }
  const scheduleScroll=()=>{if(!scrollRaf)scrollRaf=requestAnimationFrame(updateScroll)};

  function popKind(menu){return menu.classList.contains('nx-year-menu')?'year':menu.classList.contains('nx-tag-menu')?'tag':'type'}
  function cleanYears(layer){const max=new Date().getFullYear()+1;layer?.querySelectorAll('[data-nx-year]').forEach(b=>{if(Number(b.dataset.nxYear)>max)b.remove()})}
  function positionCurrentPopover(){
    const layer=document.querySelector('.nx-popover-layer'),anchor=activeAnchor;if(!MOBILE.matches||!layer||!anchor?.el?.isConnected)return;
    const pop=layer.querySelector('.nx-popover');if(!pop||popKind(pop)!==anchor.kind)return;
    cleanYears(layer);const r=anchor.el.getBoundingClientRect(),w=anchor.kind==='year'?190:anchor.kind==='tag'?244:204;let left=Math.max(10,Math.min(innerWidth-w-10,r.left+(r.width-w)/2));const h=Math.min(pop.scrollHeight||260,innerHeight-120);let top=r.bottom+7;if(top+h>innerHeight-10)top=Math.max(58,r.top-h-7);
    body.classList.add('nx-v11-fixed-popover');pop.style.setProperty('--v11-left',`${Math.round(left)}px`);pop.style.setProperty('--v11-top',`${Math.round(top)}px`);pop.style.setProperty('--v11-width',`${w}px`);
  }
  function clearAnchorIfClosed(){if(!document.querySelector('.nx-popover-layer')){activeAnchor=null;body.classList.remove('nx-v11-fixed-popover')}}

  function updateCarousel(section){const rail=section.querySelector('.nx-still-rail');if(!rail)return;const max=Math.max(0,rail.scrollWidth-rail.clientWidth);const p=section.querySelector('[data-v12-prev]'),n=section.querySelector('[data-v12-next]');if(p)p.disabled=rail.scrollLeft<=4;if(n)n.disabled=rail.scrollLeft>=max-4}
  function enhanceCarousel(section){
    if(!section||section.dataset.nxV12==='1')return;const rail=section.querySelector('.nx-still-rail'),title=section.querySelector('.nx-section-title');if(!rail||!title)return;section.dataset.nxV12='1';
    const nav=document.createElement('div');nav.className='nx-still-nav';nav.innerHTML=`<button type="button" data-v12-prev aria-label="Voltar">${SVG.left}</button><button type="button" data-v12-next aria-label="Avançar">${SVG.right}</button>`;title.insertAdjacentElement('afterend',nav);
    const move=d=>{const card=rail.querySelector('article');const cw=card?.getBoundingClientRect().width||128;rail.scrollBy({left:d*Math.max(cw*2+14,rail.clientWidth*.72),behavior:'smooth'})};nav.querySelector('[data-v12-prev]').onclick=()=>move(-1);nav.querySelector('[data-v12-next]').onclick=()=>move(1);let rr=0;rail.addEventListener('scroll',()=>{if(rr)return;rr=requestAnimationFrame(()=>{rr=0;updateCarousel(section)})},{passive:true});updateCarousel(section);
  }
  function scan(){syncBar();document.querySelectorAll('.nx-still').forEach(enhanceCarousel);scheduleScroll();clearAnchorIfClosed()}
  function scheduleSync(){if(syncRaf)return;syncRaf=requestAnimationFrame(()=>{syncRaf=0;scan()})}

  addEventListener('scroll',scheduleScroll,{passive:true});
  addEventListener('resize',()=>{scheduleSync();positionCurrentPopover();document.querySelectorAll('.nx-still').forEach(updateCarousel)},{passive:true});
  MOBILE.addEventListener?.('change',scheduleSync);
  document.addEventListener('click',e=>{if(e.target.closest('.nx-popover-backdrop,[data-nx-year],[data-nx-tag],[data-nx-type]'))setTimeout(clearAnchorIfClosed,40)},true);
  if(app)new MutationObserver(scheduleSync).observe(app,{childList:true,subtree:true});
  new MutationObserver(records=>{for(const rec of records)for(const n of rec.addedNodes)if(n.nodeType===1&&n.matches?.('.nx-popover-layer')){cleanYears(n);setTimeout(positionCurrentPopover,0)}}).observe(body,{childList:true,subtree:false});
  scan();
})();
