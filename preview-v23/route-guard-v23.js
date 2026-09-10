'use strict';
(() => {
  try {
    const IS_PAGES=location.hostname.endsWith('github.io');
    const basePath=new URL(document.baseURI,location.href).pathname.replace(/\/+$/,'');
    const BASE=basePath==='/'?'':basePath;
    const u=new URL(location.href);
    const restored=u.searchParams.get('p');
    let path=restored?restored.split('?')[0]:u.pathname;
    if(IS_PAGES&&!restored)path=path.replace(/^\/AniNexus/,'')||'/';
    path=String(path||'/').replace(/\/+$/,'')||'/';
    const listRoutes=new Set(['/melhores-animes-para-assistir','/animes-mais-assistidos','/animes-mais-aguardados','/listas-de-animes','/animes-em-alta','/filmes-de-anime','/animes-curtos','/animes-de-acao','/animes-de-romance','/animes-de-fantasia','/animes-de-comedia','/animes-de-misterio','/animes-de-esporte','/animes-de-terror']);

    const routes=[
      {owner:'home',match:path==='/',selector:'.nx35-home',label:'Carregando início…'},
      {owner:'catalog',match:path==='/animes/catalogo',selector:'.nx21-catalog-page[data-nx21-catalog-kind="anime"]',label:'Carregando catálogo…'},
      {owner:'discovery',match:path==='/animes/onde-assistir'||path==='/animes/dublados'||path==='/animes/estudios',selector:'.nx47-discovery-page',label:'Carregando catálogo…'},
      {owner:'lists',match:listRoutes.has(path),selector:'.nx48-lists-page',label:'Carregando lista…'},
      {owner:'catalog',match:path==='/mangas',selector:'.nx21-catalog-page[data-nx21-catalog-kind="manga"]',label:'Carregando mangás…'},
      {owner:'schedule',match:path==='/animes/programacao',selector:'.nx18-schedule',label:'Carregando programação…'},
      {owner:'awards',match:path==='/anime-awards',selector:'.nx45-awards-page',label:'Carregando premiação…'},
      {owner:'season',match:/^\/animes\/temporadas(?:\/\d{4}\/(?:inverno|primavera|verao|outono))?$/.test(path),selector:'.nx-season',label:'Carregando temporada…'},
      {owner:'detail',match:/^\/(?:anime|manga)\/.+-\d+$/.test(path),selector:'.nx22-detail',label:'Carregando obra…'},
      {owner:'news',match:path==='/noticias'||/^\/noticias\/[a-z0-9-]+$/.test(path),selector:'.nx35-news-page',label:'Carregando notícias…'},
      {owner:'community',match:path==='/comunidade',selector:'.nx40-community',label:'Carregando comunidade…'},
      {owner:'achievements',match:path==='/conquistas',selector:'.nx48-achievements-page',label:'Carregando conquistas…'},
      {owner:'auth',match:['/login','/criar-conta','/minha-conta'].includes(path),selector:'.nx38-auth-page,.nx38-account-page',label:'Carregando conta…'},
      {owner:'admin',match:path==='/admin',selector:'.nx38-admin-page',label:'Carregando administração…'},
      {owner:'library',match:['/minha-biblioteca','/meus-animes','/meus-mangas'].includes(path),selector:'.nx49-library',label:'Carregando biblioteca…'},
      {owner:'legal',match:['/termos-de-uso','/politica-de-privacidade','/dmca'].includes(path),selector:'.nx-legal',label:'Carregando documento…'},
      {owner:'institutional',match:['/quem-somos','/colabore','/contato'].includes(path),selector:'.nx-inst',label:'Carregando página…'}
    ];
    const route=routes.find(item=>item.match);
    if(!route)return;
    const currentPath=()=>{try{const current=new URL(location.href),restoredPath=current.searchParams.get('p');let next=restoredPath?restoredPath.split('?')[0]:current.pathname;if(IS_PAGES&&!restoredPath)next=next.replace(/^\/AniNexus/,'')||'/';return String(next||'/').replace(/\/+$/,'')||'/'}catch{return''}};
    const isCurrent=()=>{
      const current=currentPath();
      if(current===path)return true;
      const bootPaths={home:'/__nx35_home_boot__',catalog:'/__nx_catalog_boot',schedule:'/__nx_schedule_boot'};
      return current===bootPaths[route.owner]&&window.__NX_ROUTE_OWNER__===route.owner&&window.__NX_DEDICATED_BOOT_PATH__===path;
    };
    const html=document.documentElement;
    const bootClass='nx-dedicated-route-boot';
    html.classList.add(bootClass);
    if(route.owner==='catalog')html.classList.add('nx21-catalog-boot');
    if(route.owner==='schedule')html.classList.add('nx18-schedule-boot');
    if(route.owner==='awards')html.classList.add('nx45-awards-boot');
    window.__NX_ROUTE_OWNER__=route.owner;
    window.__NX_DEDICATED_BOOT_PATH__=path;
    if(route.owner==='detail'){window.__NX_USE_V22_DETAIL__=true;window.__NX_DETAIL_ROLLBACK_PATH__=path}

    const style=document.createElement('style');
    style.dataset.nxDedicatedBoot='1';
    style.textContent=`html.${bootClass} #app{opacity:0!important;visibility:hidden!important;pointer-events:none!important;min-height:calc(100dvh - 54px)!important}html.${bootClass} body:after{content:'${route.label}';position:fixed;z-index:35;left:50%;top:50%;transform:translate(-50%,-50%);padding:10px 14px;border:1px solid rgba(255,255,255,.09);border-radius:999px;background:rgba(12,8,11,.90);backdrop-filter:blur(14px);color:#b9adb2;font:700 12px/1.2 'Nunito Sans',system-ui,sans-serif;box-shadow:0 14px 42px rgba(0,0,0,.30);pointer-events:none}`;
    document.head.append(style);

    const boot=()=>{
      const app=document.querySelector('#app');
      const release=()=>{html.classList.remove(bootClass,'nx21-catalog-boot','nx18-schedule-boot','nx45-awards-boot');style.remove()};
      if(!app){release();return}
      let timer=0,settled=false;
      const mo=new MutationObserver(()=>finish());
      const abandon=()=>{settled=true;mo.disconnect();if(timer)clearTimeout(timer);release()};
      const finish=()=>{if(settled)return false;if(!isCurrent()){abandon();return false}if(!app.querySelector(route.selector))return false;settled=true;mo.disconnect();if(timer)clearTimeout(timer);release();dispatchEvent(new CustomEvent('aninexus:route-ready',{detail:{owner:route.owner,path,phase:'shell'}}));return true};
      const arm=()=>{if(!isCurrent()){abandon();return}settled=false;html.classList.add(bootClass);if(!style.isConnected)document.head.append(style);mo.observe(app,{childList:true,subtree:true});if(timer)clearTimeout(timer);timer=setTimeout(()=>{if(!finish())fail()},10000)};
      const retry=()=>{if(!isCurrent())return;dispatchEvent(new CustomEvent('aninexus:route-retry',{detail:{owner:route.owner,path}}));dispatchEvent(new PopStateEvent('popstate'));arm();finish()};
      const fail=()=>{if(settled)return;if(!isCurrent()){abandon();return}settled=true;mo.disconnect();if(timer)clearTimeout(timer);app.innerHTML=`<main class="nx-route-fail" data-route-owner="${route.owner}" style="min-height:65vh;display:grid;place-items:center;padding:28px;text-align:center"><div><img src="${BASE}/assets/logo.png" alt="" style="width:64px;height:64px"><h1 style="font:800 24px Manrope,sans-serif">Esta página demorou para responder</h1><p style="color:#9c9095">Tente novamente. Seus dados neste aparelho foram preservados.</p><button type="button" data-route-retry style="margin-top:12px;padding:10px 16px;border:1px solid rgba(255,255,255,.16);border-radius:999px;background:#ef4f83;color:#fff;font:800 13px Manrope,sans-serif;cursor:pointer">Tentar novamente</button></div></main>`;app.querySelector('[data-route-retry]')?.addEventListener('click',retry,{once:true});release();dispatchEvent(new CustomEvent('aninexus:route-failed',{detail:{owner:route.owner,path,category:'timeout'}}))};
      arm();
      finish();
    };
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  } catch {document.documentElement.classList.remove('nx-dedicated-route-boot','nx21-catalog-boot','nx18-schedule-boot','nx45-awards-boot','nx22-detail-boot','nx22-news-boot')}
})();
