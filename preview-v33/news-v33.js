'use strict';
(() => {
  if(window.__NX_NEWS_V35_LOADER__)return;window.__NX_NEWS_V35_LOADER__=true;
  const base=location.hostname.endsWith('github.io')?'/AniNexus':'';
  const load=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=`${base}/preview-v35/${src}?v=35.0.0`;s.defer=true;s.onload=resolve;s.onerror=reject;document.head.append(s)});
  load('news-data-v35.js').then(()=>load('news-ui-v35.js')).catch(err=>console.error('[AniNexus Notícias V35]',err));
})();
