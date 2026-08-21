'use strict';
(() => {
  try {
    const IS_PAGES=location.hostname.endsWith('github.io');
    const BASE=IS_PAGES?'/AniNexus':'';
    const u=new URL(location.href);
    const restored=u.searchParams.get('p');
    let path=restored?restored.split('?')[0]:u.pathname;
    if(IS_PAGES&&!restored)path=path.replace(/^\/AniNexus/,'')||'/';
    path=path.replace(/\/+$/,'')||'/';
    if(!/^\/anime\/.+-\d+$/.test(path))return;
    window.__NX_DETAIL_V23_BOOT__=path;
    document.documentElement.classList.add('nx23-detail-boot');
    history.replaceState({},'',`${BASE}/__nx_detail_v23_boot__`);
  } catch {}
})();