'use strict';
(() => {
  const IS_PAGES=location.hostname.endsWith('github.io');
  const BASE=IS_PAGES?'/AniNexus':'';
  const BUILD='20.0.0';
  const SCHEDULE='/animes/programacao';
  const icon=`<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="10" y="13" width="44" height="40" rx="7"/><path d="M20 7v12M44 7v12M10 25h44"/><path d="M20 34h7M33 34h11M20 43h11"/></g></svg>`;
  const localLogo={crunchyroll:`${BASE}/assets/streaming/crunchyroll.svg`,netflix:`${BASE}/assets/streaming/netflix.svg`};
  let raf=0,lastY=Math.max(0,scrollY);

  function route(){const u=new URL(location.href),p=u.searchParams.get('p');if(p)return p.split('?')[0].replace(/\/+$/,'')||'/';let path=u.pathname;if(IS_PAGES)path=path.replace(/^\/AniNexus/,'')||'/';return path.replace(/\/+$/,'')||'/'}
  function targetPath(a){try{const u=new URL(a.href,location.href);if(u.origin!==location.origin)return'';let p=u.pathname;if(IS_PAGES)p=p.replace(/^\/AniNexus/,'')||'/';return p.replace(/\/+$/,'')||'/'}catch{return''}}
  function hardGo(path){location.href=IS_PAGES?`${BASE}/?build=${BUILD}&p=${encodeURIComponent(path)}`:path}
  function onSchedule(){return route()===SCHEDULE||document.body.classList.contains('nx18-schedule-active')}
  function cleanupTransient(){document.querySelectorAll('.nx18-tracker-layer,.nx20-media-layer').forEach(n=>n.remove());document.body.classList.remove('modal-open','nx20-media-open')}

  function hero(){const shell=document.querySelector('.nx18-hero .nx18-shell');if(!shell||shell.dataset.nx20Hero==='1')return;const old=shell.querySelector('.nx19-schedule-identity');if(old){old.classList.add('nx20-schedule-identity');shell.dataset.nx20Hero='1';return}const h1=shell.querySelector(':scope > h1');if(!h1)return;shell.dataset.nx20Hero='1';const wrap=document.createElement('div');wrap.className='nx19-schedule-identity nx20-schedule-identity';wrap.innerHTML=`<span class="nx19-schedule-identity-icon">${icon}</span><div class="nx19-schedule-identity-copy"></div>`;shell.insertBefore(wrap,h1);wrap.querySelector('.nx19-schedule-identity-copy').append(h1);h1.insertAdjacentHTML('afterend','<small>PROGRAMAÇÃO DE ANIMES</small>')}
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