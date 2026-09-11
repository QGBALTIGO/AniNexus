'use strict';
(() => {
  try {
    const IS_PAGES=location.hostname.endsWith('github.io');
    const basePath=new URL(document.baseURI,location.href).pathname.replace(/\/+$/,'');
    const BASE=basePath==='/'?'':basePath;
    const NAV_STATE_KEY='__aninexusEntryId';
    const SCROLL_STORE_KEY='aninexus:navigation-scroll:v1';
    const ACTIVE_ROUTE_CLASSES=['aqx-home-active','nx-detail-active','nx-dmca-active','nx-inst-active','nx-institution-active','nx-legal-active','nx-season-active','nx17-schedule-active','nx18-schedule-active','nx20-catalog-active','nx21-catalog-active','nx22-detail-active','nx22-news-active','nx23-catalog-active','nx23-detail-active','nx24-home-active','nx31-news-active','nx32-news-active','nx34-news-active','nx35-home-active','nx35-news-active','nx35-news-list-active','nx38-admin-active','nx38-auth-active','nx38-library-active','nx38-profile-active','nx40-community-active','nx42-manga-active','nx45-awards-active','nx47-discovery-active','nx47-dubbed-active','nx47-studios-active','nx47-watch-active','nx48-achievements-active','nx48-lists-active','nx49-library-active'];
    const OWNER_CLASSES={
      home:['nx35-home-active'],catalog:['nx20-catalog-active','nx21-catalog-active','nx23-catalog-active'],schedule:['nx18-schedule-active'],season:['nx-season-active'],detail:['nx22-detail-active'],news:['nx35-news-active','nx35-news-list-active'],community:['nx40-community-active'],achievements:['nx48-achievements-active'],auth:['nx38-auth-active'],profile:['nx38-profile-active'],admin:['nx38-admin-active'],library:['nx38-library-active','nx49-library-active'],legal:['nx-legal-active'],institutional:['nx-institution-active'],awards:['nx45-awards-active'],discovery:['nx47-discovery-active','nx47-watch-active','nx47-dubbed-active','nx47-studios-active'],lists:['nx48-lists-active']
    };
    const routePathFrom=value=>{try{const current=new URL(value,location.href),restoredPath=current.searchParams.get('p');let next=restoredPath?restoredPath.split('?')[0]:current.pathname;if(IS_PAGES&&!restoredPath)next=next.replace(/^\/AniNexus/,'')||'/';next=String(next||'/').replace(/\/+$/,'')||'/';if(next==='/__nx35_home_boot__')return'/';if(next==='/__nx_catalog_boot')return'/animes/catalogo';if(next==='/__nx_schedule_boot'||next==='/__schedule_v18_boot__')return'/animes/programacao';return next}catch{return''}};
    const ownerFrom=routePath=>{const next=String(routePath||'').split(/[?#]/)[0];if(next==='/'||/__nx35_home_boot__/.test(next))return'home';if(['/animes/catalogo','/mangas'].includes(next)||/__nx_catalog_boot/.test(next))return'catalog';if(next==='/animes/programacao'||/__nx_schedule_boot|__schedule_v18_boot__/.test(next))return'schedule';if(/^\/animes\/temporadas(?:\/|$)/.test(next))return'season';if(/^\/(?:anime|manga)\/.+-\d+$/.test(next))return'detail';if(next==='/noticias'||/^\/noticias\/[a-z0-9_-]+$/i.test(next))return'news';if(next==='/comunidade')return'community';if(next==='/conquistas')return'achievements';if(['/login','/criar-conta','/minha-conta'].includes(next))return'auth';if(/^\/u\/[\p{L}\p{N}_.-]{3,30}$/u.test(next))return'profile';if(next==='/admin')return'admin';if(['/minha-biblioteca','/meus-animes','/meus-mangas'].includes(next))return'library';if(['/termos-de-uso','/politica-de-privacidade','/dmca'].includes(next))return'legal';if(['/quem-somos','/colabore','/contato'].includes(next))return'institutional';if(next==='/anime-awards')return'awards';if(['/animes/onde-assistir','/animes/dublados','/animes/estudios'].includes(next))return'discovery';if(['/melhores-animes-para-assistir','/animes-mais-assistidos','/animes-mais-aguardados','/listas-de-animes','/animes-em-alta','/filmes-de-anime','/animes-curtos','/animes-de-acao','/animes-de-romance','/animes-de-fantasia','/animes-de-comedia','/animes-de-misterio','/animes-de-esporte','/animes-de-terror'].includes(next))return'lists';return window.__NX_ROUTE_OWNER__||''};
    const cleanupRouteClasses=routePath=>{const keep=new Set(OWNER_CLASSES[ownerFrom(routePath)]||[]);document.body?.classList.remove(...ACTIVE_ROUTE_CLASSES.filter(name=>!keep.has(name)))};
    const installNavigation=()=>{
      if(window.__ANINEXUS_NAVIGATION_V23__)return window.__ANINEXUS_NAVIGATION_V23__;
      const originalPush=history.pushState.bind(history),originalReplace=history.replaceState.bind(history);
      let positions={};try{positions=JSON.parse(sessionStorage.getItem(SCROLL_STORE_KEY)||'{}')||{}}catch{}
      let entryCounter=0,scrollTimer=0,restoreGeneration=0,interactionGeneration=0,protectedRestore=null;
      const entryId=()=>`${Date.now().toString(36)}-${(++entryCounter).toString(36)}-${Math.random().toString(36).slice(2,8)}`;
      const stateWithEntry=(state,id)=>({...((state&&typeof state==='object'&&!Array.isArray(state))?state:{}),[NAV_STATE_KEY]:id});
      let activeEntry=String(history.state?.[NAV_STATE_KEY]||'');
      if(!activeEntry){activeEntry=entryId();originalReplace(stateWithEntry(history.state,activeEntry),'',location.href)}
      try{history.scrollRestoration='manual'}catch{}
      const persist=()=>{try{const entries=Object.entries(positions);if(entries.length>60)positions=Object.fromEntries(entries.slice(-60));sessionStorage.setItem(SCROLL_STORE_KEY,JSON.stringify(positions))}catch{}};
      const remember=(force=false)=>{if(!activeEntry)return;const y=Math.max(0,Math.round(scrollY||0));if(!force&&protectedRestore?.entry===activeEntry&&performance.now()<protectedRestore.until&&Math.abs(y-protectedRestore.y)>2)return;positions[activeEntry]={x:Math.max(0,Math.round(scrollX||0)),y,at:Date.now()};persist()};
      const cancelRestore=()=>{interactionGeneration++;restoreGeneration++;protectedRestore=null;remember()};
      const restore=(point={x:0,y:0},entry=activeEntry)=>{const token=++restoreGeneration,start=performance.now(),target={x:Math.max(0,Number(point.x)||0),y:Math.max(0,Number(point.y)||0)};if(target.y<=0){protectedRestore=null;scrollTo({left:target.x,top:0,behavior:'auto'});requestAnimationFrame(()=>{if(token===restoreGeneration)remember()});return}protectedRestore={entry,y:target.y,until:start+2200};let stable=0,lastHeight=-1;const apply=()=>{if(token!==restoreGeneration)return;const height=document.documentElement.scrollHeight,maxY=Math.max(0,height-innerHeight),nextY=Math.min(target.y,maxY);scrollTo({left:target.x,top:nextY,behavior:'auto'});stable=height===lastHeight&&target.y<=maxY+1?stable+1:0;lastHeight=height;if(target.y<=maxY+1&&Math.abs(scrollY-nextY)<=2&&stable>=2)protectedRestore=null;if((stable>=4&&performance.now()-start>120)||performance.now()-start>1800){if(protectedRestore?.entry===entry)protectedRestore=null;remember();return}requestAnimationFrame(apply)};requestAnimationFrame(apply)};
      const announce=(type,from,to)=>{if(type!=='traverse'&&from===to)return;cleanupRouteClasses(to);dispatchEvent(new CustomEvent('aninexus:route-changed',{detail:{type,from,to,entryId:activeEntry}}))};
      const wrap=(original,type)=>function(state,title,url){const before=routePathFrom(location.href);remember(type==='push');const nextEntry=type==='push'?entryId():activeEntry;const result=original(stateWithEntry(state,nextEntry),title,url);activeEntry=nextEntry;const after=routePathFrom(location.href);if(before!==after&&!location.hash)restore({x:0,y:0});announce(type,before,after);return result};
      history.pushState=wrap(originalPush,'push');
      history.replaceState=wrap(originalReplace,'replace');
      addEventListener('scroll',()=>{if(scrollTimer)return;scrollTimer=setTimeout(()=>{scrollTimer=0;remember()},80)},{passive:true});
      addEventListener('pagehide',remember);
      addEventListener('popstate',event=>{if(!event.isTrusted)return;const targetEntry=String(event.state?.[NAV_STATE_KEY]||'');remember(true);activeEntry=targetEntry;if(!activeEntry){activeEntry=entryId();originalReplace(stateWithEntry(event.state,activeEntry),'',location.href)}const to=routePathFrom(location.href),point={...(positions[activeEntry]||{x:0,y:0})},interaction=interactionGeneration,entry=activeEntry;restore(point,entry);announce('traverse','',to);for(const delay of [90,260])setTimeout(()=>{if(activeEntry===entry&&interactionGeneration===interaction)restore(point,entry)},delay)},true);
      for(const name of ['wheel','touchstart','pointerdown','keydown'])addEventListener(name,cancelRestore,{capture:true,passive:name!=='keydown'});
      const go=(value,options={})=>{let target;try{target=new URL(value,location.href)}catch{return false}if(target.origin!==location.origin)return false;const {replace=false,popstate=true,event='aninexus:navigate',state={}}=options;document.body?.classList.remove('modal-open','nx22-tabs-open','nx-popover-open','nx-v11-fixed-popover');for(const selector of ['#drawer','#searchOverlay','#notificationPanel']){const layer=document.querySelector(selector);if(layer){layer.hidden=true;layer.setAttribute('aria-hidden','true')}}document.activeElement?.blur?.();history[replace?'replaceState':'pushState'](state,'',`${target.pathname}${target.search}${target.hash}`);if(popstate)dispatchEvent(new PopStateEvent('popstate',{state:history.state}));if(event)dispatchEvent(new CustomEvent(event,{detail:{route:`${target.pathname}${target.search}${target.hash}`}}));requestAnimationFrame(()=>document.querySelector('#app')?.focus?.({preventScroll:true}));return true};
      window.AniNexusGo=go;
      return window.__ANINEXUS_NAVIGATION_V23__=Object.freeze({go,remember,route:()=>routePathFrom(location.href),cleanup:()=>cleanupRouteClasses(routePathFrom(location.href))});
    };
    installNavigation();
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
      {owner:'profile',match:/^\/u\/[\p{L}\p{N}_.-]{3,30}$/u.test(path),selector:'.nx38p-page',label:'Carregando perfil…'},
      {owner:'admin',match:path==='/admin',selector:'.nx38-admin-page',label:'Carregando administração…'},
      {owner:'library',match:['/minha-biblioteca','/meus-animes','/meus-mangas'].includes(path),selector:'.nx49-library',label:'Carregando biblioteca…'},
      {owner:'legal',match:['/termos-de-uso','/politica-de-privacidade','/dmca'].includes(path),selector:'.nx-legal',label:'Carregando documento…'},
      {owner:'institutional',match:['/quem-somos','/colabore','/contato'].includes(path),selector:'.nx-inst',label:'Carregando página…'}
    ];
    const route=routes.find(item=>item.match);
    if(!route)return;
    const currentPath=()=>routePathFrom(location.href);
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
      const finish=()=>{if(settled)return false;if(!isCurrent()){abandon();return false}if(!app.querySelector(route.selector))return false;settled=true;mo.disconnect();if(timer)clearTimeout(timer);cleanupRouteClasses(path);release();dispatchEvent(new CustomEvent('aninexus:route-ready',{detail:{owner:route.owner,path,phase:'shell'}}));return true};
      const arm=()=>{if(!isCurrent()){abandon();return}settled=false;html.classList.add(bootClass);if(!style.isConnected)document.head.append(style);mo.observe(app,{childList:true,subtree:true});if(timer)clearTimeout(timer);timer=setTimeout(()=>{if(!finish())fail()},10000)};
      const retry=()=>{if(!isCurrent())return;dispatchEvent(new CustomEvent('aninexus:route-retry',{detail:{owner:route.owner,path}}));dispatchEvent(new PopStateEvent('popstate'));arm();finish()};
      const fail=()=>{if(settled)return;if(!isCurrent()){abandon();return}settled=true;mo.disconnect();if(timer)clearTimeout(timer);app.innerHTML=`<main class="nx-route-fail" data-route-owner="${route.owner}" style="min-height:65vh;display:grid;place-items:center;padding:28px;text-align:center"><div><img src="${BASE}/assets/logo.png" alt="" style="width:64px;height:64px"><h1 style="font:800 24px Manrope,sans-serif">Esta página demorou para responder</h1><p style="color:#9c9095">Tente novamente. Seus dados neste aparelho foram preservados.</p><button type="button" data-route-retry style="margin-top:12px;padding:10px 16px;border:1px solid rgba(255,255,255,.16);border-radius:999px;background:#ef4f83;color:#fff;font:800 13px Manrope,sans-serif;cursor:pointer">Tentar novamente</button></div></main>`;app.querySelector('[data-route-retry]')?.addEventListener('click',retry,{once:true});release();dispatchEvent(new CustomEvent('aninexus:route-failed',{detail:{owner:route.owner,path,category:'timeout'}}))};
      arm();
      finish();
    };
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  } catch {document.documentElement.classList.remove('nx-dedicated-route-boot','nx21-catalog-boot','nx18-schedule-boot','nx45-awards-boot','nx22-detail-boot','nx22-news-boot')}
})();
