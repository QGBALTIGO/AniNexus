'use strict';
(() => {
  if(window.__NX_NEWS_V34_LOADER__)return;window.__NX_NEWS_V34_LOADER__=true;
  const base=location.hostname.endsWith('github.io')?'/AniNexus':'';
  const load=src=>new Promise((resolve,reject)=>{const old=document.querySelector(`script[data-nx34-news-src="${src}"]`);if(old){if(old.dataset.ready==='1')return resolve();old.addEventListener('load',resolve,{once:true});return}const s=document.createElement('script');s.src=`${base}/preview-v34/${src}?v=34.0.0`;s.defer=true;s.dataset.nx34NewsSrc=src;s.onload=()=>{s.dataset.ready='1';resolve()};s.onerror=reject;document.head.append(s)});
  load('news-data-v34.js').then(()=>load('news-ui-v34.js')).catch(err=>console.error('[AniNexus Notícias V34]',err));
})();