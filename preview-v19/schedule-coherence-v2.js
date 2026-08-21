'use strict';
(() => {
  const IS_PAGES=location.hostname.endsWith('github.io');
  const BASE=IS_PAGES?'/AniNexus':'';
  const BUILD='20.0.2';
  const SCHEDULE='/animes/programacao';
  const icon=`<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="10" y="13" width="44" height="40" rx="7"/><path d="M20 7v12M44 7v12M10 25h44"/><path d="M20 34h7M33 34h11M20 43h11"/></g></svg>`;
  const localLogo={crunchyroll:`${BASE}/assets/streaming/crunchyroll.svg`,netflix:`${BASE}/assets/streaming/netflix.svg`};
  let raf=0,lastY=Math.max(0,scrollY);

  function route(){const u=new URL(location.href),p=u.searchParams.get('p');if(p)return p.split('?')[0].replace(/\/+$/,'')||'/';let path=u.pathname;if(IS_PAGES)path=path.replace(/^\/AniNexus/,'')||'/';return path.replace(/\/+$/,'')||'/'}
  function targetPath(a){try{const u=new URL(a.href,location.href);if(u.origin!==location.origin)return'';let p=u.pathname;if(IS_PAGES)p=p.replace(/^\/AniNexus/,'')||'/';return p.replace(/\/+$/,'')||'/'}catch{return''}}
  function hardGo(path){location.href=IS_PAGES?`${BASE}/?build=${BUILD}&p=${encodeURIComponent(path)}`:path}
  function onSchedule(){return route()===SCHEDULE||document.body.classList.contains('nx18-schedule-active')}
  function cleanupTransient(){document.querySelectorAll('.nx18-tracker-layer,.nx20-media-layer').forEach(n=>n.remove());document.body.classList.remove('modal-open','nx20-media-open')}

  function ensureHeroStyle(){
    if(document.querySelector('#nx20HeroCompactStyle'))return;
    const style=document.createElement('style');
    style.id='nx20HeroCompactStyle';
    style.textContent=`
      .nx20-schedule-identity.nx20-compact-title{display:grid!important;justify-items:center!important;gap:5px!important;width:100%!important;max-width:100%!important;margin:0 auto 9px!important}
      .nx20-title-row{display:flex!important;align-items:center!important;justify-content:center!important;gap:8px!important;max-width:100%!important}
      .nx20-title-row .nx19-schedule-identity-icon{position:static!important;width:31px!important;height:31px!important;flex:0 0 31px!important;display:grid!important;place-items:center!important;color:#ec4569!important;filter:drop-shadow(0 0 13px rgba(231,42,82,.18))!important}
      .nx20-title-row .nx19-schedule-identity-icon svg{width:100%!important;height:100%!important}
      .nx20-title-row h1{margin:0!important;white-space:nowrap!important;font-size:clamp(19px,4.8vw,28px)!important;line-height:1!important;letter-spacing:-.045em!important;text-align:left!important;text-wrap:nowrap!important}
      .nx20-title-kicker{display:block!important;margin:0!important;text-align:center!important;color:#e45b79!important;font:800 7px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;letter-spacing:.17em!important}
      @media(max-width:390px){.nx20-title-row{gap:6px!important}.nx20-title-row .nx19-schedule-identity-icon{width:27px!important;height:27px!important;flex-basis:27px!important}.nx20-title-row h1{font-size:18px!important;letter-spacing:-.05em!important}.nx20-title-kicker{font-size:6.5px!important}}
      @media(max-width:340px){.nx20-title-row .nx19-schedule-identity-icon{width:24px!important;height:24px!important;flex-basis:24px!important}.nx20-title-row h1{font-size:16px!important}.nx20-title-kicker{letter-spacing:.14em!important}}
    `;
    document.head.append(style);
  }

  function hero(){
    const shell=document.querySelector('.nx18-hero .nx18-shell');
    if(!shell)return;
    ensureHeroStyle();
    let wrap=shell.querySelector('.nx19-schedule-identity');
    let h1=wrap?.querySelector('h1')||shell.querySelector(':scope > h1');
    if(!h1)return;
    if(wrap?.dataset.nxCompact==='1')return;
    if(!wrap){wrap=document.createElement('div');shell.insertBefore(wrap,h1)}
    wrap.className='nx19-schedule-identity nx20-schedule-identity nx20-compact-title';
    wrap.dataset.nxCompact='1';
    const row=document.createElement('div');
    row.className='nx20-title-row';
    row.innerHTML=`<span class="nx19-schedule-identity-icon">${icon}</span>`;
    row.append(h1);
    wrap.replaceChildren(row);
    const kicker=document.createElement('small');
    kicker.className='nx20-title-kicker';
    kicker.textContent='PROGRAMAÇÃO DE ANIMES';
    wrap.append(kicker);
    shell.dataset.nx20Hero='1';
  }
  function island(){const bar=document.querySelector('.nx18-island');if(!bar)return;bar.classList.add('nx19-coherent-island','nx20-coherent-island');const ico=bar.querySelector('.nx18-island-icon');if(ico&&ico.dataset.nx20!=='1'){ico.dataset.nx20='1';ico.innerHTML=icon}const strong=bar.querySelector('.nx18-island-copy strong');if(strong)strong.textContent='Calendário de Animes'}
  function logos(){document.querySelectorAll('.nx18-provider-logo[data-provider]').forEach(box=>{const k=box.dataset.provider;if(box.dataset.nx20Logo===k)return;box.dataset.nx20Logo=k||'other';const src=localLogo[k];if(src)box.innerHTML=`<img class="nx20-local-stream-logo" src="${src}" alt="" decoding="async">`;else box.querySelector('img')?.classList.add('nx20-external-stream-logo')})}
  function sync(){if(!onSchedule())return;hero();island();logos();window.AniNexusMediaState?.sync?.()}
  function scheduleSync(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;sync()})}
  function collapseIsland(){const bar=document.querySelector('.nx18-island');if(bar){bar.classList.remove('expanded');bar.querySelector('[data-nx18-island-toggle]')?.setAttribute('aria-expanded','false')}}

  document.addEventListener('click',e=>{const a=e.target.closest('a[href]');if(a&&onSchedule()){const target=targetPath(a);if(target&&target!==SCHEDULE&&!a.target&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();cleanupTransient();hardGo(target);return}}},true);
  document.addEventListener('click',e=>{if(!onSchedule())return;if(e.target.closest('.nx18-island [data-nx18-idday],.nx18-island [data-nx18-my],.nx18-island [data-nx18-stream]'))setTimeout(collapseIsland,0)});

  function scrollLogic(){if(!onSchedule())return;const heroEl=document.querySelector('#nx18Hero'),bar=document.querySelector('.nx18-island');if(!heroEl||!bar){lastY=scrollY;return}const y=Math.max(0,scrollY),show=heroEl.getBoundingClientRect().bottom<54,delta=y-lastY;bar.classList.toggle('show',show);document.body.classList.toggle('nx18-island-visible',show);if(!show||y<70){document.body.classList.remove('nx18-header-hidden');bar.classList.remove('expanded')}else if(delta>6){document.body.classList.add('nx18-header-hidden');bar.classList.remove('expanded')}else if(delta<-6){document.body.classList.remove('nx18-header-hidden');bar.classList.add('expanded')}lastY=y}
  let scrollRaf=0;addEventListener('scroll',()=>{if(!scrollRaf)scrollRaf=requestAnimationFrame(()=>{scrollRaf=0;scrollLogic()})},{passive:true});

  const relevant='.nx18-schedule,.nx18-island,.nx18-provider-logo,[data-nx18-status],[data-nx18-fav]';const app=document.querySelector('#app');if(app)new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes)if(n.nodeType===1&&(n.matches?.(relevant)||n.querySelector?.(relevant))){scheduleSync();return}}).observe(app,{childList:true,subtree:true});
  addEventListener('resize',scheduleSync,{passive:true});document.addEventListener('aninexus:media-state-changed',scheduleSync);document.addEventListener('aninexus:favorite-changed',scheduleSync);scheduleSync();
})();