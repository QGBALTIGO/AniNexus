'use strict';
(() => {
  const IS_PAGES=location.hostname.endsWith('github.io');
  const BASE=IS_PAGES?'/AniNexus':'';
  const u=new URL(location.href);
  const restored=u.searchParams.get('p');
  let path=restored?restored.split('?')[0]:location.pathname;
  if(IS_PAGES&&!restored)path=path.replace(/^\/AniNexus/,'')||'/';
  path=path.replace(/\/+$/,'')||'/';
  if(path!=='/animes/programacao')return;
  window.__NX_SCHEDULE_BOOT__=true;
  history.replaceState({},'',`${BASE}/__nx_schedule_boot`);
})();
