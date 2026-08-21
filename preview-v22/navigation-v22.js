'use strict';
(() => {
  const IS_PAGES=location.hostname.endsWith('github.io');
  const BASE=IS_PAGES?'/AniNexus':'';
  const BUILD='22.1.0';
  const DEDICATED=[
    '/animes/catalogo','/animes/programacao','/animes/temporadas','/noticias'
  ];
  function routeOf(a){
    try{
      const u=new URL(a.href,location.href);
      let p=u.pathname;
      if(IS_PAGES)p=p.replace(/^\/AniNexus/,'')||'/';
      return p.replace(/\/+$/,'')||'/';
    }catch{return''}
  }
  function closeDrawer(){
    const d=document.querySelector('#drawer');
    if(d){d.hidden=true;d.setAttribute('aria-hidden','true')}
    document.body.classList.remove('modal-open');
  }
  function isInternal(a){
    try{const u=new URL(a.href,location.href);return u.origin===location.origin}catch{return false}
  }
  function needsDedicated(path){return DEDICATED.includes(path)||/^\/animes\/temporadas\//.test(path)||/^\/anime\/.+-\d+$/.test(path)}
  function pagesUrl(path){return `${BASE}/?build=${BUILD}&p=${encodeURIComponent(path)}`}

  document.addEventListener('click',e=>{
    const a=e.target.closest('a[href]');
    if(!a)return;
    if(a.closest('#drawer')) closeDrawer();
    if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||a.target==='_blank'||!isInternal(a))return;
    const path=routeOf(a);
    if(!path||!needsDedicated(path))return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    closeDrawer();
    if(IS_PAGES) location.href=pagesUrl(path);
    else {
      history.pushState({},'',path);
      window.dispatchEvent(new PopStateEvent('popstate'));
      document.dispatchEvent(new CustomEvent('aninexus:routechange'));
    }
  },true);

  document.addEventListener('click',e=>{
    if(e.target.closest('#drawer a[href]')) closeDrawer();
  },true);
})();