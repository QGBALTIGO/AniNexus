'use strict';
(() => {
  // V23 keeps this entry point so old cached HTML stays compatible,
  // but anime detail itself has been rolled back to the stable V22.1 experience.
  if(window.__NX_USE_V22_DETAIL__)return;

  try{
    const IS_PAGES=location.hostname.endsWith('github.io');
    const BASE=IS_PAGES?'/AniNexus':'';
    const BUILD='40.4.0';
    const u=new URL(location.href);
    const restored=u.searchParams.get('p');
    let path=window.__NX_DETAIL_V23_BOOT__||restored?.split('?')[0]||u.pathname;
    if(IS_PAGES&&!window.__NX_DETAIL_V23_BOOT__&&!restored)path=path.replace(/^\/AniNexus/,'')||'/';
    path=String(path||'/').replace(/\/+$/,'')||'/';
    if(!/^\/anime\/.+-\d+$/.test(path))return;

    if(!document.querySelector('link[data-nx22-detail-css]')){
      const l=document.createElement('link');l.rel='stylesheet';l.href=`${BASE}/preview-v22/detail-v22.css?v=${BUILD}`;l.dataset.nx22DetailCss='1';document.head.append(l);
    }
    history.replaceState({},'',IS_PAGES?`${BASE}/?build=${BUILD}&p=${encodeURIComponent(path)}`:path);
    document.documentElement.classList.remove('nx23-detail-boot','nx22-detail-boot');
    document.body.classList.remove('nx23-detail-active');
    delete window.__NX_DETAIL_V23_BOOT__;
    if(!document.querySelector('script[data-nx22-detail-runtime]')){
      const s=document.createElement('script');s.src=`${BASE}/preview-v22/detail-stable-v22.js?v=${BUILD}`;s.async=false;s.dataset.nx22DetailRuntime='1';document.body.append(s);
    }
  }catch{}
})();
