'use strict';
(() => {
  if(window.__NX_HOME_V34_LOADER__)return;window.__NX_HOME_V34_LOADER__=true;
  const base=location.hostname.endsWith('github.io')?'/AniNexus':'';
  const load=src=>new Promise((resolve,reject)=>{const existing=document.querySelector(`script[data-nx34-src="${src}"]`);if(existing){if(existing.dataset.ready==='1')return resolve();existing.addEventListener('load',resolve,{once:true});return}const s=document.createElement('script');s.src=`${base}/preview-v34/${src}?v=34.0.0`;s.defer=true;s.dataset.nx34Src=src;s.onload=()=>{s.dataset.ready='1';resolve()};s.onerror=reject;document.head.append(s)});
  load('home-core-v34.js').then(()=>load('home-data-v34.js')).catch(err=>console.error('[AniNexus Home V34]',err));
})();