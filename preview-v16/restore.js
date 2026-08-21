'use strict';
(() => {
  const IS_PAGES=location.hostname.endsWith('github.io');
  const BASE=IS_PAGES?'/AniNexus':'';
  if(window.__NX_SCHEDULE_BOOT__){
    history.replaceState({},'',`${BASE}/animes/programacao`);
    window.__NX_SCHEDULE_BOOT__=false;
  }
  try{
    if(typeof schedulePage==='function') schedulePage=async function(){};
  }catch{}
})();
