'use strict';
(() => {
  const IS_PAGES=location.hostname.endsWith('github.io');
  const BASE=IS_PAGES?'/AniNexus':'';
  const u=new URL(location.href);
  const restored=u.searchParams.get('p');
  let route=restored?restored.split('?')[0]:location.pathname;
  if(IS_PAGES&&!restored)route=route.replace(/^\/AniNexus/,'')||'/';
  route=route.replace(/\/+$/,'')||'/';
  if(route!=='/animes/programacao')return;
  window.__ANINEXUS_SCHEDULE_V18__={route,build:u.searchParams.get('build')||'19.0.0'};
  history.replaceState({},'',BASE+'/__schedule_v18_boot__');
})();
