'use strict';
(() => {
  try {
    const IS_PAGES=location.hostname.endsWith('github.io');
    const BASE=IS_PAGES?'/AniNexus':'';
    const BUILD='23.0.1';
    const u=new URL(location.href);
    const restored=u.searchParams.get('p');
    let path=restored?restored.split('?')[0]:u.pathname;
    if(IS_PAGES&&!restored)path=path.replace(/^\/AniNexus/,'')||'/';
    path=path.replace(/\/+$/,'')||'/';
    if(!/^\/anime\/.+-\d+$/.test(path))return;

    // Selective rollback: anime detail uses the stable V22.1 renderer.
    // Other V23 modules (news, catalog, schedule, seasons, routing) stay untouched.
    window.__NX_USE_V22_DETAIL__=true;
    window.__NX_DETAIL_ROLLBACK_PATH__=path;
    document.documentElement.classList.add('nx22-detail-boot');
    history.replaceState({},'',`${BASE}/__nx_detail_v22_boot__`);

    const boot=()=>{
      const target=window.__NX_DETAIL_ROLLBACK_PATH__||path;
      if(!document.querySelector('link[data-nx22-detail-css]')){
        const l=document.createElement('link');
        l.rel='stylesheet';
        l.href=`${BASE}/preview-v22/detail-v22.css?v=${BUILD}`;
        l.dataset.nx22DetailCss='1';
        document.head.append(l);
      }
      const url=IS_PAGES?`${BASE}/?build=${BUILD}&p=${encodeURIComponent(target)}`:target;
      history.replaceState({},'',url);
      document.documentElement.classList.remove('nx23-detail-boot','nx22-detail-boot');
      delete window.__NX_DETAIL_V23_BOOT__;
      if(!document.querySelector('script[data-nx22-detail-runtime]')){
        const s=document.createElement('script');
        s.src=`${BASE}/preview-v22/detail-stable-v22.js?v=${BUILD}`;
        s.async=false;
        s.dataset.nx22DetailRuntime='1';
        document.body.append(s);
      }
    };

    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
    else boot();
  } catch {}
})();