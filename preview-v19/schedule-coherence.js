'use strict';
(() => {
  const IS_PAGES=location.hostname.endsWith('github.io');
  const BASE=IS_PAGES?'/AniNexus':'';
  const icon=`<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="10" y="13" width="44" height="40" rx="7"/><path d="M20 7v12M44 7v12M10 25h44"/><path d="M20 34h7M33 34h11M20 43h11"/></g></svg>`;
  const localLogo={crunchyroll:`${BASE}/assets/streaming/crunchyroll.svg`,netflix:`${BASE}/assets/streaming/netflix.svg`,prime:`${BASE}/assets/streaming/amazon.svg`,apple:`${BASE}/assets/streaming/apple.svg`};
  let raf=0;

  function onSchedule(){return !!document.querySelector('.nx18-schedule')||document.body.classList.contains('nx18-schedule-active')}
  function decorateHero(){
    const shell=document.querySelector('.nx18-hero .nx18-shell');if(!shell||shell.dataset.nx19Hero==='1')return;
    const h1=shell.querySelector(':scope > h1');if(!h1)return;shell.dataset.nx19Hero='1';
    const wrap=document.createElement('div');wrap.className='nx19-schedule-identity';wrap.innerHTML=`<span class="nx19-schedule-identity-icon">${icon}</span><div class="nx19-schedule-identity-copy"></div>`;
    shell.insertBefore(wrap,h1);wrap.querySelector('.nx19-schedule-identity-copy').append(h1);h1.insertAdjacentHTML('afterend','<small>PROGRAMAÇÃO DE ANIMES</small>');
  }
  function decorateIsland(){
    const bar=document.querySelector('.nx18-island');if(!bar)return;
    bar.classList.add('nx19-coherent-island');
    const ico=bar.querySelector('.nx18-island-icon');if(ico&&ico.dataset.nx19!=='1'){ico.dataset.nx19='1';ico.innerHTML=icon}
    const strong=bar.querySelector('.nx18-island-copy strong');if(strong)strong.textContent='Calendário de Animes';
  }
  function fixProviderLogos(){
    document.querySelectorAll('.nx18-provider-logo[data-provider]').forEach(box=>{
      const k=box.dataset.provider;if(box.dataset.nx19Logo===k)return;const src=localLogo[k];
      if(src){box.dataset.nx19Logo=k;box.innerHTML=`<img class="nx19-local-stream-logo" src="${src}" alt="" decoding="async">`;return}
      box.dataset.nx19Logo=k||'other';
      const img=box.querySelector('img');if(img){img.removeAttribute('style');img.classList.add('nx19-external-stream-logo')}
    });
  }
  function sync(){if(!onSchedule())return;decorateHero();decorateIsland();fixProviderLogos();window.AniNexusMediaState?.sync?.()}
  function schedule(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;sync()})}

  const obs=new MutationObserver(schedule);obs.observe(document.documentElement,{childList:true,subtree:true});
  addEventListener('resize',schedule,{passive:true});
  document.addEventListener('aninexus:media-state-changed',schedule);
  document.addEventListener('aninexus:favorite-changed',schedule);
  schedule();
})();
