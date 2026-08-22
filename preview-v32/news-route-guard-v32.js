'use strict';
(() => {
  try{
    const u=new URL(location.href),IS_PAGES=location.hostname.endsWith('github.io');
    let path=u.searchParams.get('p')||u.pathname;
    if(IS_PAGES&&!u.searchParams.get('p'))path=path.replace(/^\/AniNexus/,'')||'/';
    path=String(path||'/').split('?')[0].replace(/\/+$/,'')||'/';
    if(path!=='/noticias'&&!/^\/noticias\/[a-z0-9-]+$/.test(path))return;
    window.__NX_NEWS_V32_ROUTE__=path;
    document.documentElement.classList.add('nx32-news-boot');
    const style=document.createElement('style');
    style.dataset.nx32NewsBoot='1';
    style.textContent='html.nx32-news-boot #app{min-height:72vh;opacity:0}html.nx32-news-ready #app{opacity:1;transition:opacity .16s ease}';
    document.head.append(style);
    const ready=()=>{document.documentElement.classList.remove('nx32-news-boot');document.documentElement.classList.add('nx32-news-ready');style.remove()};
    addEventListener('aninexus:news-v32-ready',ready,{once:true});
    setTimeout(ready,5000);
  }catch{}
})();
