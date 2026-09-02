'use strict';
(() => {
  if(window.__NX_HOME_V35_LOADER__)return;window.__NX_HOME_V35_LOADER__=true;
  const pages=location.hostname.endsWith('github.io'),base=pages?'/AniNexus':'';
  try{if(!window.__NX35_HOME_BOOT__){const url=new URL(location.href),restored=url.searchParams.get('p');let path=restored?restored.split('?')[0]:url.pathname;if(pages&&!restored)path=path.replace(/^\/AniNexus/,'')||'/';if((String(path).replace(/\/+$/,'')||'/')!=='/')return}}catch{return}

  const loadHome=()=>{
    const s=document.createElement('script');
    s.src=`${base}/preview-v35/home-v35.js?v=44.4.4`;
    s.defer=true;
    s.onerror=()=>{document.documentElement.classList.remove('nx35-home-boot');console.error('[AniNexus Home V35] falha ao carregar')};
    document.head.append(s);
  };

  loadHome();
})();
