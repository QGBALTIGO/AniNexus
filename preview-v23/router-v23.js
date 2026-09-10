'use strict';
(() => {
  const IS_PAGES=location.hostname.endsWith('github.io');
  const basePath=new URL(document.baseURI,location.href).pathname.replace(/\/+$/,'');
  const BASE=basePath==='/'?'':basePath;
  const BUILD='44.47.1';
  const DEDICATED=['/','/animes/catalogo','/animes/programacao','/animes/temporadas','/animes/onde-assistir','/animes/dublados','/animes/estudios','/melhores-animes-para-assistir','/animes-mais-assistidos','/animes-mais-aguardados','/listas-de-animes','/animes-em-alta','/filmes-de-anime','/animes-curtos','/animes-de-acao','/animes-de-romance','/animes-de-fantasia','/animes-de-comedia','/animes-de-misterio','/animes-de-esporte','/animes-de-terror','/mangas','/light-novels','/noticias','/comunidade','/conquistas','/login','/criar-conta','/minha-conta','/minha-biblioteca','/meus-animes','/meus-mangas','/admin'];
  const CARD_SELECTOR='[data-nx21-open],[data-nx-media],[data-nx18-open],[data-nx22-open],[data-nx-still],[data-open][data-type="anime"]';
  const ACTION_SELECTOR='button,a,input,select,textarea,[data-list],[data-fav],[data-nx-list],[data-nx-fav],[data-nx18-status],[data-nx18-fav],[data-manga-list],[data-manga-fav]';
  const DETAIL_ROUTE=/^\/(?:anime|manga)\/.+-\d+$/;
  let detailRuntimePromise=null;
  let navigationSequence=0;
  let actionGuardUntil=0;

  function cleanPathFromUrl(href){try{const u=new URL(href,location.href),restored=u.searchParams.get('p');let route=restored||`${u.pathname}${u.search}`;if(BASE&&!restored&&route.startsWith(BASE))route=route.slice(BASE.length)||'/';route=route.split('#')[0];const queryIndex=route.indexOf('?'),search=queryIndex>=0?route.slice(queryIndex):'';let path=queryIndex>=0?route.slice(0,queryIndex):route;path=path.replace(/\/+$/,'')||'/';return `${path}${search}`}catch{return''}}
  function isDedicated(route){const p=String(route||'').split(/[?#]/)[0];return DEDICATED.includes(p)||/^\/u\/[\p{L}\p{N}_.-]{3,30}$/u.test(p)||/^\/animes\/temporadas\//.test(p)||/^\/anime\/.+-\d+$/.test(p)||/^\/manga\/.+-\d+$/.test(p)||/^\/noticias\/[a-z0-9-]+$/.test(p)}
  function pagesUrl(path){return `${BASE}/?build=${BUILD}&p=${encodeURIComponent(path)}`}
  function slug(value='anime'){return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,90)||'anime'}
  function cardInfo(card){if(!card)return null;const kind=String(card.dataset.kind||card.dataset.type||'anime').toLowerCase();if(!['anime','manga'].includes(kind))return null;const raw=card.dataset.nx21Open||card.dataset.nxMedia||card.dataset.nx18Open||card.dataset.nx22Open||card.dataset.nxStill||card.dataset.open;const id=Number(raw||0);if(!id)return null;const name=card.dataset.title||card.querySelector('h3,strong,h2')?.textContent?.trim()||kind;return{id,path:`/${kind}/${slug(name)}-${id}`}}
  function assign(path){location.assign(IS_PAGES||BASE?pagesUrl(path):path)}
  function ownerFor(path){const route=String(path||'').split(/[?#]/)[0];if(route==='/')return'home';if(['/animes/catalogo','/mangas'].includes(route))return'catalog';if(route==='/animes/programacao')return'schedule';if(/^\/animes\/temporadas(?:\/|$)/.test(route))return'season';if(['/animes/onde-assistir','/animes/dublados','/animes/estudios'].includes(route))return'discovery';if(['/melhores-animes-para-assistir','/animes-mais-assistidos','/animes-mais-aguardados','/listas-de-animes','/animes-em-alta','/filmes-de-anime','/animes-curtos','/animes-de-acao','/animes-de-romance','/animes-de-fantasia','/animes-de-comedia','/animes-de-misterio','/animes-de-esporte','/animes-de-terror'].includes(route))return'lists';if(DETAIL_ROUTE.test(route))return'detail';if(route==='/noticias'||/^\/noticias\/[a-z0-9_-]+$/i.test(route))return'news';if(route==='/comunidade')return'community';if(route==='/conquistas')return'achievements';if(['/login','/criar-conta','/minha-conta'].includes(route))return'auth';if(route==='/admin')return'admin';if(['/minha-biblioteca','/meus-animes','/meus-mangas'].includes(route))return'library';return''}
  function markRouteOwner(path){const route=String(path||'').split(/[?#]/)[0],owner=ownerFor(route);if(!owner)return;window.__NX_ROUTE_OWNER__=owner;window.__NX_DEDICATED_BOOT_PATH__=route;if(owner==='detail'){window.__NX_USE_V22_DETAIL__=true;window.__NX_DETAIL_ROLLBACK_PATH__=route}}
  function ensureDetailRuntime(){
    if(window.__NX_V22_DETAIL_READY__)return Promise.resolve();
    if(!document.querySelector('link[data-nx22-detail-css]')){const link=document.createElement('link');link.rel='stylesheet';link.href=`${BASE}/preview-v22/detail-v22.css?v=${BUILD}`;link.dataset.nx22DetailCss='1';document.head.append(link)}
    if(detailRuntimePromise)return detailRuntimePromise;
    detailRuntimePromise=new Promise((resolve,reject)=>{
      let runtime=document.querySelector('script[data-nx22-detail-runtime]'),timer=0,settled=false;
      if(runtime?.dataset.nx22RuntimeState==='failed'){runtime.remove();runtime=null}
      const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);removeEventListener('aninexus:detail-runtime-ready',ready);runtime?.removeEventListener('load',loaded);runtime?.removeEventListener('error',failed);if(error){if(runtime){runtime.dataset.nx22RuntimeState='failed';runtime.remove()}reject(error)}else{if(runtime)runtime.dataset.nx22RuntimeState='ready';resolve()}};
      const ready=()=>finish();
      const loaded=()=>window.__NX_V22_DETAIL_READY__?finish():finish(new Error('Runtime de detalhe não iniciou'));
      const failed=()=>finish(new Error('Runtime de detalhe indisponível'));
      addEventListener('aninexus:detail-runtime-ready',ready,{once:true});
      if(!runtime){runtime=document.createElement('script');runtime.src=`${BASE}/preview-v22/detail-v22.js?v=${BUILD}`;runtime.async=false;runtime.dataset.nx22DetailRuntime='1';runtime.dataset.nx22RuntimeState='loading'}
      runtime.addEventListener('load',loaded,{once:true});runtime.addEventListener('error',failed,{once:true});
      timer=setTimeout(failed,8000);
      if(!runtime.isConnected)document.body.append(runtime);
    }).catch(error=>{detailRuntimePromise=null;throw error});
    return detailRuntimePromise;
  }
  function navigate(path){
    const sequence=++navigationSequence;
    const current=cleanPathFromUrl(location.href).split('?')[0];
    if(DETAIL_ROUTE.test(String(path||'').split(/[?#]/)[0])&&current&&!DETAIL_ROUTE.test(current)){try{sessionStorage.setItem('nx22:previous-path',JSON.stringify({path:current,document:performance.timeOrigin}))}catch{}}
    document.body?.classList.remove('modal-open');const drawer=document.querySelector('#drawer');if(drawer){drawer.hidden=true;drawer.setAttribute('aria-hidden','true')}
    const radioNavigate=!IS_PAGES&&window.AniNexusRadio?.navigate;
    if(radioNavigate&&DETAIL_ROUTE.test(String(path||'').split(/[?#]/)[0])){ensureDetailRuntime().then(()=>{if(sequence!==navigationSequence)return;markRouteOwner(path);if(!window.AniNexusRadio?.navigate?.(path))assign(path)}).catch(()=>{if(sequence===navigationSequence)assign(path)});return}
    if(radioNavigate){markRouteOwner(path);if(window.AniNexusRadio.navigate(path))return}
    assign(path);
  }
  function rewrite(root=document){root.querySelectorAll?.('a[href]').forEach(a=>{if(a.target==='_blank')return;const p=cleanPathFromUrl(a.href);if(!isDedicated(p))return;a.dataset.nx23Dedicated=p;if(IS_PAGES)a.href=pagesUrl(p)})}
  rewrite();addEventListener('DOMContentLoaded',()=>rewrite(),{once:true});new MutationObserver(rs=>{for(const r of rs)for(const n of r.addedNodes)if(n.nodeType===1)rewrite(n)}).observe(document.documentElement,{subtree:true,childList:true});
  addEventListener('pointerdown',e=>{if(e.button===0&&e.target.closest?.(ACTION_SELECTOR))actionGuardUntil=Date.now()+300},true);
  addEventListener('click',e=>{if(e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;if(Date.now()<actionGuardUntil&&!e.target.closest?.(ACTION_SELECTOR)&&e.target.closest?.(CARD_SELECTOR)){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();return}const filter=e.target.closest?.('[data-nx22-genre],[data-nx22-tag]');if(filter){if(window.__NX_V22_DETAIL_READY__&&filter.closest?.('.nx22-detail'))return;const value=filter.dataset.nx22Genre?{genre:filter.dataset.nx22Genre}:{tag:filter.dataset.nx22Tag};try{sessionStorage.setItem('nx23:catalog:incoming',JSON.stringify(value))}catch{}const target=cleanPathFromUrl(filter.href).split('?')[0]||'/animes/catalogo';e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();navigate(target);return}const card=e.target.closest?.(CARD_SELECTOR);if(card&&!e.target.closest(ACTION_SELECTOR)){const info=cardInfo(card);if(info){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();navigate(info.path);return}}const a=e.target.closest?.('a[href]');if(!a||a.target==='_blank')return;const p=a.dataset.nx23Dedicated||cleanPathFromUrl(a.href);if(!isDedicated(p))return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();navigate(p)},true);
  addEventListener('keydown',e=>{if(e.key!=='Enter'||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey)return;const card=e.target.closest?.(CARD_SELECTOR);if(!card||e.target.closest(ACTION_SELECTOR))return;const info=cardInfo(card);if(!info)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();navigate(info.path)},true);
})();
