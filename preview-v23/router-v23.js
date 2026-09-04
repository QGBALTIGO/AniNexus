'use strict';
(() => {
  const IS_PAGES=location.hostname.endsWith('github.io');
  const BASE=IS_PAGES?'/AniNexus':'';
  const BUILD='44.15.1';
  const DEDICATED=['/','/animes/catalogo','/animes/programacao','/animes/temporadas','/mangas','/light-novels','/noticias','/comunidade','/conquistas','/login','/criar-conta','/minha-conta','/meus-animes','/meus-mangas','/admin'];
  const CARD_SELECTOR='[data-nx21-open],[data-nx-media],[data-nx18-open],[data-nx22-open],[data-nx-still],[data-open][data-type="anime"]';
  const ACTION_SELECTOR='button,a,input,select,textarea,[data-list],[data-fav],[data-nx-list],[data-nx-fav],[data-nx18-status],[data-nx18-fav]';

  function cleanPathFromUrl(href){try{const u=new URL(href,location.href),restored=u.searchParams.get('p');let route=restored||`${u.pathname}${u.search}`;if(IS_PAGES&&!restored)route=route.replace(/^\/AniNexus(?:\/AniNexus)?/,'')||'/';route=route.split('#')[0];const queryIndex=route.indexOf('?'),search=queryIndex>=0?route.slice(queryIndex):'';let path=queryIndex>=0?route.slice(0,queryIndex):route;path=path.replace(/\/+$/,'')||'/';return `${path}${search}`}catch{return''}}
  function isDedicated(route){const p=String(route||'').split(/[?#]/)[0];return DEDICATED.includes(p)||/^\/u\/[\p{L}\p{N}_.-]{3,30}$/u.test(p)||/^\/animes\/temporadas\//.test(p)||/^\/anime\/.+-\d+$/.test(p)||/^\/manga\/.+-\d+$/.test(p)||/^\/noticias\/[a-z0-9-]+$/.test(p)}
  function pagesUrl(path){return `${BASE}/?build=${BUILD}&p=${encodeURIComponent(path)}`}
  function slug(value='anime'){return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,90)||'anime'}
  function cardInfo(card){if(!card)return null;const kind=String(card.dataset.kind||card.dataset.type||'anime').toLowerCase();if(kind&&kind!=='anime')return null;const raw=card.dataset.nx21Open||card.dataset.nxMedia||card.dataset.nx18Open||card.dataset.nx22Open||card.dataset.nxStill||card.dataset.open;const id=Number(raw||0);if(!id)return null;const name=card.dataset.title||card.querySelector('h3,strong,h2')?.textContent?.trim()||'anime';return{id,path:`/anime/${slug(name)}-${id}`}}
  function navigate(path){document.body?.classList.remove('modal-open');const drawer=document.querySelector('#drawer');if(drawer){drawer.hidden=true;drawer.setAttribute('aria-hidden','true')}if(!IS_PAGES&&window.AniNexusRadio?.navigate?.(path))return;location.assign(IS_PAGES?pagesUrl(path):path)}
  function rewrite(root=document){root.querySelectorAll?.('a[href]').forEach(a=>{if(a.target==='_blank')return;const p=cleanPathFromUrl(a.href);if(!isDedicated(p))return;a.dataset.nx23Dedicated=p;if(IS_PAGES)a.href=pagesUrl(p)})}
  rewrite();addEventListener('DOMContentLoaded',()=>rewrite(),{once:true});new MutationObserver(rs=>{for(const r of rs)for(const n of r.addedNodes)if(n.nodeType===1)rewrite(n)}).observe(document.documentElement,{subtree:true,childList:true});
  addEventListener('click',e=>{if(e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;const card=e.target.closest?.(CARD_SELECTOR);if(card&&!e.target.closest(ACTION_SELECTOR)){const info=cardInfo(card);if(info){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();navigate(info.path);return}}const a=e.target.closest?.('a[href]');if(!a||a.target==='_blank')return;const p=a.dataset.nx23Dedicated||cleanPathFromUrl(a.href);if(!isDedicated(p))return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();navigate(p)},true);
  addEventListener('keydown',e=>{if(e.key!=='Enter'||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey)return;const card=e.target.closest?.(CARD_SELECTOR);if(!card||e.target.closest(ACTION_SELECTOR))return;const info=cardInfo(card);if(!info)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();navigate(info.path)},true);
})();
