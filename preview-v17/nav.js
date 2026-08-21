'use strict';
(() => {
  const IS_PAGES=location.hostname.endsWith('github.io');
  const BASE=IS_PAGES?'/AniNexus':'';
  document.addEventListener('click',e=>{
    const a=e.target.closest('a[href="/animes/programacao"]');
    if(!a||e.defaultPrevented||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;
    e.preventDefault();e.stopImmediatePropagation();
    location.href=IS_PAGES?`${BASE}/?build=17.0.0&p=%2Fanimes%2Fprogramacao`:`${BASE}/animes/programacao`;
  },true);
})();
