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
    if(path!=='/')return;
    window.__NX_HOME_DEDICATED__=true;
    document.documentElement.classList.add('nx24-home-boot');
    history.replaceState({},'',`${BASE}/__nx_home_boot__`);
  } catch {}
})();