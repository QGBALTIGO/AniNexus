'use strict';
(() => {
  const IS_PAGES=location.hostname.endsWith('github.io');
  const BASE=IS_PAGES?'/AniNexus':'';
  const BUILD='24.0.0';
  const DEDICATED=['/','/animes/catalogo','/animes/programacao','/animes/temporadas','/noticias'];
  function cleanPathFromUrl(href){
    try{
      const u=new URL(href,location.href);
      const restored=u.searchParams.get('p');
      if(restored)return restored.split('?')[0].replace(/\/+$/,'')||'/';
      let p=u.pathname;if(IS_PAGES)p=p.replace(/^\/AniNexus/,'')||'/';
      return p.replace(/\/+$/,'')||'/';
    }catch{return''}
  }
  function isDedicated(p){return DEDICATED.includes(p)||/^\/animes\/temporadas\//.test(p)||/^\/anime\/.+-\d+$/.test(p)}
  function pagesUrl(path){return `${BASE}/?build=${BUILD}&p=${encodeURIComponent(path)}`}
  function rewrite(root=document){
    root.querySelectorAll?.('a[href]').forEach(a=>{
      if(a.target==='_blank')return;
      const p=cleanPathFromUrl(a.href);if(!isDedicated(p))return;
      a.dataset.nx23Dedicated=p;
      if(IS_PAGES)a.href=pagesUrl(p);
    });
  }
  function helpers(){
    if(document.querySelector('script[data-nx23-news-i18n]'))return;
    const s=document.createElement('script');s.src=`${BASE}/preview-v23/news-i18n-v23.js?v=${BUILD}`;s.defer=true;s.dataset.nx23NewsI18n='1';document.head.append(s);
  }
  rewrite();helpers();
  addEventListener('DOMContentLoaded',()=>rewrite(),{once:true});
  new MutationObserver(rs=>{for(const r of rs)for(const n of r.addedNodes)if(n.nodeType===1)rewrite(n)}).observe(document.documentElement,{subtree:true,childList:true});
  addEventListener('click',e=>{
    if(e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
    const a=e.target.closest?.('a[href]');if(!a||a.target==='_blank')return;
    const p=a.dataset.nx23Dedicated||cleanPathFromUrl(a.href);if(!isDedicated(p))return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    document.body?.classList.remove('modal-open');
    const drawer=document.querySelector('#drawer');if(drawer){drawer.hidden=true;drawer.setAttribute('aria-hidden','true')}
    location.assign(IS_PAGES?pagesUrl(p):p);
  },true);
})();