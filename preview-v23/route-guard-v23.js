'use strict';
(() => {
  try {
    const IS_PAGES=location.hostname.endsWith('github.io');
    const BASE=IS_PAGES?'/AniNexus':'';
    const BUILD='44.22.0';
    const u=new URL(location.href);
    const restored=u.searchParams.get('p');
    let path=restored?restored.split('?')[0]:u.pathname;
    if(IS_PAGES&&!restored)path=path.replace(/^\/AniNexus/,'')||'/';
    path=String(path||'/').replace(/\/+$/,'')||'/';

    const routes=[
      {owner:'home',match:path==='/',selector:'.nx35-home',label:'Carregando início…'},
      {owner:'catalog',match:path==='/animes/catalogo',selector:'.nx21-catalog-page[data-nx21-catalog-kind="anime"]',label:'Carregando catálogo…'},
      {owner:'catalog',match:path==='/mangas',selector:'.nx21-catalog-page[data-nx21-catalog-kind="manga"]',label:'Carregando mangás…'},
      {owner:'schedule',match:path==='/animes/programacao',selector:'.nx18-schedule',label:'Carregando programação…'},
      {owner:'season',match:/^\/animes\/temporadas(?:\/\d{4}\/(?:inverno|primavera|verao|outono))?$/.test(path),selector:'.nx-season',label:'Carregando temporada…'},
      {owner:'detail',match:/^\/anime\/.+-\d+$/.test(path),selector:'.nx22-detail',label:'Carregando anime…'},
      {owner:'news',match:path==='/noticias'||/^\/noticias\/[a-z0-9-]+$/.test(path),selector:'.nx35-news-page',label:'Carregando notícias…'},
      {owner:'community',match:path==='/comunidade',selector:'.nx40-community',label:'Carregando comunidade…'},
      {owner:'achievements',match:path==='/conquistas',selector:'.nx48-achievements-page',label:'Carregando conquistas…'},
      {owner:'auth',match:['/login','/criar-conta','/minha-conta'].includes(path),selector:'.nx38-auth-page,.nx38-account-page',label:'Carregando conta…'},
      {owner:'admin',match:path==='/admin',selector:'.nx38-admin-page',label:'Carregando administração…'},
      {owner:'library',match:path==='/meus-animes',selector:'.nx38-library',label:'Carregando biblioteca…'},
      {owner:'manga',match:path==='/meus-mangas',selector:'.nx42-manga-page',label:'Carregando mangás…'},
      {owner:'legal',match:['/termos-de-uso','/politica-de-privacidade','/dmca'].includes(path),selector:'.nx-legal',label:'Carregando documento…'},
      {owner:'institutional',match:['/quem-somos','/colabore','/contato'].includes(path),selector:'.nx-inst',label:'Carregando página…'}
    ];
    const route=routes.find(item=>item.match);
    if(!route)return;
    const isDetail=route.owner==='detail';

    const html=document.documentElement;
    const bootClass='nx-dedicated-route-boot';
    html.classList.add(bootClass);
    if(route.owner==='catalog')html.classList.add('nx21-catalog-boot');
    if(route.owner==='schedule')html.classList.add('nx18-schedule-boot');
    window.__NX_ROUTE_OWNER__=route.owner;
    window.__NX_DEDICATED_BOOT_PATH__=path;
    if(isDetail){window.__NX_USE_V22_DETAIL__=true;window.__NX_DETAIL_ROLLBACK_PATH__=path}

    const style=document.createElement('style');
    style.dataset.nxDedicatedBoot='1';
    style.textContent=`html.${bootClass} #app{opacity:0!important;visibility:hidden!important;pointer-events:none!important;min-height:calc(100dvh - 54px)!important}html.${bootClass} body:after{content:'${route.label}';position:fixed;z-index:35;left:50%;top:50%;transform:translate(-50%,-50%);padding:10px 14px;border:1px solid rgba(255,255,255,.09);border-radius:999px;background:rgba(12,8,11,.90);backdrop-filter:blur(14px);color:#b9adb2;font:700 12px/1.2 'Nunito Sans',system-ui,sans-serif;box-shadow:0 14px 42px rgba(0,0,0,.30);pointer-events:none}`;
    document.head.append(style);

    if(isDetail&&!document.querySelector('link[data-nx22-detail-css]')){const l=document.createElement('link');l.rel='stylesheet';l.href=`${BASE}/preview-v22/detail-v22.css?v=${BUILD}`;l.dataset.nx22DetailCss='1';document.head.append(l)}

    const boot=()=>{
      const app=document.querySelector('#app');if(!app){html.classList.remove(bootClass,'nx21-catalog-boot','nx18-schedule-boot');style.remove();return}
      let timer=0;
      const finish=()=>{if(!app.querySelector(route.selector))return false;html.classList.remove(bootClass,'nx21-catalog-boot','nx18-schedule-boot');style.remove();if(timer)clearTimeout(timer);dispatchEvent(new CustomEvent('aninexus:route-ready',{detail:{owner:route.owner,path}}));return true};
      const mo=new MutationObserver(()=>{if(finish())mo.disconnect()});mo.observe(app,{childList:true,subtree:true});
      if(isDetail&&!document.querySelector('script[data-nx22-detail-runtime]')){const s=document.createElement('script');s.src=`${BASE}/preview-v22/detail-v22.js?v=${BUILD}`;s.async=false;s.dataset.nx22DetailRuntime='1';s.addEventListener('load',finish,{once:true});document.body.append(s)}
      finish();timer=setTimeout(()=>{mo.disconnect();if(!finish()&&!app.firstElementChild)app.innerHTML='<main class="nx-route-fail" style="min-height:65vh;display:grid;place-items:center;padding:28px;text-align:center"><div><img src="'+BASE+'/assets/logo.png" alt="" style="width:64px;height:64px"><h1 style="font:800 24px Manrope,sans-serif">Esta página demorou para responder</h1><p style="color:#9c9095">Tente atualizar. Seus dados neste aparelho foram preservados.</p></div></main>';html.classList.remove(bootClass,'nx21-catalog-boot','nx18-schedule-boot');style.remove()},10000);
    };
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  } catch {document.documentElement.classList.remove('nx-dedicated-route-boot','nx21-catalog-boot','nx18-schedule-boot','nx22-detail-boot','nx22-news-boot')}
})();
