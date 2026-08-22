'use strict';
(() => {
  try{
    const u=new URL(location.href),IS_PAGES=location.hostname.endsWith('github.io');
    let p=u.searchParams.get('p')||u.pathname;
    if(IS_PAGES&&!u.searchParams.get('p'))p=p.replace(/^\/AniNexus/,'')||'/';
    p=String(p).split('?')[0].replace(/\/+$/,'')||'/';
    if(!/^\/noticias\/[^/]+$/.test(p))return;
    window.__NX_NATIVE_NEWS_ROUTE__=p;
    document.documentElement.classList.add('nx31-native-news-boot');
    const style=document.createElement('style');
    style.dataset.nx31NativeNewsBoot='1';
    style.textContent='html.nx31-native-news-boot #app{min-height:70vh}';
    document.head.append(style);
  }catch{}
})();
