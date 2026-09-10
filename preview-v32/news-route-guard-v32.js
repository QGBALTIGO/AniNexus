'use strict';
(() => {
  try{
    const u=new URL(location.href),IS_PAGES=location.hostname.endsWith('github.io');
    let path=u.searchParams.get('p')||u.pathname;
    if(IS_PAGES&&!u.searchParams.get('p'))path=path.replace(/^\/AniNexus/,'')||'/';
    path=String(path||'/').split('?')[0].replace(/\/+$/,'')||'/';
    if(path!=='/noticias'&&!/^\/noticias\/[a-z0-9_-]+$/i.test(path))return;
    window.__NX_NEWS_V32_ROUTE__=path;
    document.documentElement.classList.add('nx32-news-boot');
    const style=document.createElement('style');
    style.dataset.nx32NewsBoot='1';
    style.textContent='html.nx32-news-boot #app{min-height:72vh}html.nx32-news-boot #app:empty{display:grid;place-items:center}html.nx32-news-boot #app:empty::before{content:"Carregando notícias…";color:#9f9299;font:700 12px Manrope,sans-serif;letter-spacing:.02em}';
    document.head.append(style);
    const app=document.querySelector('#app');let settled=false,timer=0;
    const currentPath=()=>{const current=new URL(location.href);let next=current.searchParams.get('p')||current.pathname;if(IS_PAGES&&!current.searchParams.get('p'))next=next.replace(/^\/AniNexus/,'')||'/';return String(next||'/').split('?')[0].replace(/\/+$/,'')||'/'};
    const current=()=>currentPath()===path;
    const release=()=>{observer.disconnect();if(timer)clearTimeout(timer);document.documentElement.classList.remove('nx32-news-boot');style.remove()};
    const correct=()=>!!app?.querySelector('.nx35-news-page,.nx-route-fail[data-route-owner="news"]');
    const observer=new MutationObserver(()=>ready());
    const ready=()=>{if(settled)return false;if(!current()){settled=true;release();return false}if(!correct())return false;settled=true;release();document.documentElement.classList.add('nx32-news-ready');return true};
    addEventListener('aninexus:news-v32-ready',ready);
    if(app)observer.observe(app,{childList:true,subtree:true});
    if(!ready())timer=setTimeout(()=>{if(ready()||!app||!current()){if(!current()){settled=true;release()}return}app.innerHTML='<main class="nx-route-fail" data-route-owner="news"><div><h1>As notícias demoraram para responder</h1><p>Tente novamente em instantes.</p><button type="button" data-news-retry>Tentar novamente</button></div></main>';app.querySelector('[data-news-retry]')?.addEventListener('click',()=>{dispatchEvent(new CustomEvent('aninexus:route-retry',{detail:{owner:"news",path}}));dispatchEvent(new PopStateEvent('popstate'))},{once:true});ready()},6500);
  }catch{}
})();
