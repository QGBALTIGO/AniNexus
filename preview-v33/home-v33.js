'use strict';
(() => {
  if(window.__NX_HOME_V35_LOADER__)return;window.__NX_HOME_V35_LOADER__=true;
  const base=location.hostname.endsWith('github.io')?'/AniNexus':'';
  const s=document.createElement('script');
  s.src=`${base}/preview-v35/home-v35.js?v=35.0.1`;
  s.defer=true;
  s.onerror=()=>{document.documentElement.classList.remove('nx35-home-boot');console.error('[AniNexus Home V35] falha ao carregar')};
  document.head.append(s);
})();