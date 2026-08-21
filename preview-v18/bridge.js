'use strict';
(() => {
  const IS_PAGES=location.hostname.endsWith('github.io');
  const BASE=IS_PAGES?'/AniNexus':'';
  const target='/animes/programacao';
  function pathOf(a){try{const u=new URL(a.href,location.href);let p=u.pathname;if(IS_PAGES)p=p.replace(/^\/AniNexus/,'')||'/';return p.replace(/\/+$/,'')||'/'}catch{return''}}
  document.addEventListener('click',e=>{
    const a=e.target.closest('a[href]');if(!a||pathOf(a)!==target)return;
    if(e.button&&e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    location.href=IS_PAGES?`${BASE}/?build=19.0.0&p=${encodeURIComponent(target)}`:`${target}`;
  },true);
  document.addEventListener('error',e=>{
    const img=e.target;if(!(img instanceof HTMLImageElement)||!img.closest('.nx18-provider-logo'))return;
    img.hidden=true;const fallback=img.nextElementSibling;if(fallback)fallback.hidden=false;
  },true);
})();
