'use strict';
(() => {
  try {
    const IS_PAGES=location.hostname.endsWith('github.io');
    const BASE=IS_PAGES?'/AniNexus':'';
    const BUILD='32.0.0';
    const u=new URL(location.href);
    const restored=u.searchParams.get('p');
    let path=restored?restored.split('?')[0]:u.pathname;
    if(IS_PAGES&&!restored)path=path.replace(/^\/AniNexus/,'')||'/';
    path=String(path||'/').replace(/\/+$/,'')||'/';

    const isDetail=/^\/anime\/.+-\d+$/.test(path);
    const isNews=!window.__NX_NEWS_V32_ROUTE__&&(path==='/noticias'||/^\/noticias\/[a-z0-9-]+$/.test(path));
    if(!isDetail&&!isNews)return;

    const html=document.documentElement;
    const bootClass=isDetail?'nx22-detail-boot':'nx22-news-boot';
    html.classList.add(bootClass);
    window.__NX_DEDICATED_BOOT_PATH__=path;
    if(isDetail){window.__NX_USE_V22_DETAIL__=true;window.__NX_DETAIL_ROLLBACK_PATH__=path}

    const style=document.createElement('style');
    style.dataset.nxDedicatedBoot='1';
    style.textContent=`html.${bootClass} #app{opacity:0!important;pointer-events:none!important;min-height:calc(100dvh - 54px)!important}html.${bootClass} body:after{content:'${isDetail?'Carregando anime…':'Carregando notícias…'}';position:fixed;z-index:35;left:50%;top:50%;transform:translate(-50%,-50%);padding:10px 14px;border:1px solid rgba(255,255,255,.09);border-radius:999px;background:rgba(12,8,11,.90);backdrop-filter:blur(14px);color:#b9adb2;font:700 12px/1.2 'Nunito Sans',system-ui,sans-serif;box-shadow:0 14px 42px rgba(0,0,0,.30);pointer-events:none}`;
    document.head.append(style);

    if(isDetail&&!document.querySelector('link[data-nx22-detail-css]')){const l=document.createElement('link');l.rel='stylesheet';l.href=`${BASE}/preview-v22/detail-v22.css?v=${BUILD}`;l.dataset.nx22DetailCss='1';document.head.append(l)}

    const boot=()=>{
      const app=document.querySelector('#app');if(!app){html.classList.remove(bootClass);style.remove();return}
      const selector=isDetail?'.nx22-detail':'.nx22-news';let timer=0;
      const finish=()=>{if(!app.querySelector(selector))return false;html.classList.remove(bootClass);style.remove();if(timer)clearTimeout(timer);return true};
      const mo=new MutationObserver(()=>{if(finish())mo.disconnect()});mo.observe(app,{childList:true,subtree:true});
      if(isDetail&&!document.querySelector('script[data-nx25-state-ui]')){const bridge=document.createElement('script');bridge.src=`${BASE}/preview-v25/state-ui-bridge-v25.js?v=${BUILD}`;bridge.async=false;bridge.dataset.nx25StateUi='1';document.body.append(bridge)}
      if(isDetail&&!document.querySelector('script[data-nx22-detail-runtime]')){const s=document.createElement('script');s.src=`${BASE}/preview-v22/detail-stable-v22.js?v=${BUILD}`;s.async=false;s.dataset.nx22DetailRuntime='1';s.addEventListener('load',finish,{once:true});document.body.append(s)}
      finish();timer=setTimeout(()=>{mo.disconnect();html.classList.remove(bootClass);style.remove()},8000);
    };
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  } catch {document.documentElement.classList.remove('nx22-detail-boot','nx22-news-boot')}
})();
