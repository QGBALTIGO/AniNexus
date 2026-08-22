'use strict';
(() => {
  try{
    const IS_PAGES=location.hostname.endsWith('github.io');
    const BASE=IS_PAGES?'/AniNexus':'';
    const u=new URL(location.href),restored=u.searchParams.get('p');
    let path=restored?restored.split('?')[0]:u.pathname;
    if(IS_PAGES&&!restored)path=path.replace(/^\/AniNexus/,'')||'/';
    path=path.replace(/\/+$/,'')||'/';
    if(path!=='/')return;
    window.__NX35_HOME_BOOT__=true;
    document.documentElement.classList.add('nx35-home-boot');
    history.replaceState({},'',`${BASE}/__nx35_home_boot__`);
  }catch{}
})();
