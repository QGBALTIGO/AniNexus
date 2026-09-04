'use strict';
(() => {
  const NativeDateTimeFormat=Intl.DateTimeFormat;
  function SafeDateTimeFormat(locales,options){return new NativeDateTimeFormat(locales==='yyyy-MM-dd'?'en-CA':locales,options)}
  SafeDateTimeFormat.prototype=NativeDateTimeFormat.prototype;
  SafeDateTimeFormat.supportedLocalesOf=NativeDateTimeFormat.supportedLocalesOf.bind(NativeDateTimeFormat);
  Intl.DateTimeFormat=SafeDateTimeFormat;

  const IS_PAGES=location.hostname.endsWith('github.io');
  const BASE=IS_PAGES?'/AniNexus':'';
  const BUILD='44.15.1';

  const aliases=new Map([
    ['/animes','/animes/catalogo'],
    ['/catalogo','/animes/catalogo'],
    ['/programacao','/animes/programacao'],
    ['/temporadas','/animes/temporadas'],
    ['/news','/noticias'],
    ['/community','/comunidade'],
    ['/manga','/mangas'],
    ['/entrar','/login'],
    ['/cadastro','/criar-conta'],
    ['/conta','/minha-conta']
  ]);
  const excludedPrefixes=['/assets/','/data/','/lib/','/preview-','/.github/'];
  const excludedFiles=/\.(?:css|js|json|png|jpe?g|webp|gif|svg|ico|xml|txt|map|woff2?|ttf|otf|mp4|webm|pdf|zip)$/i;
  function routeFromUrl(value){try{const u=new URL(value,location.href);if(u.origin!==location.origin)return null;const restored=u.searchParams.get('p');let route=restored||`${u.pathname}${u.search}`;if(IS_PAGES&&!restored)route=route.replace(/^\/AniNexus(?:\/AniNexus)?(?=\/|$)/,'')||'/';route=route.split('#')[0];const queryIndex=route.indexOf('?'),search=queryIndex>=0?route.slice(queryIndex):'';let path=(queryIndex>=0?route.slice(0,queryIndex):route).replace(/\/{2,}/g,'/');if(path.length>1)path=path.replace(/\/+$/,'');path=aliases.get(path)||path||'/';if(excludedFiles.test(path)||excludedPrefixes.some(prefix=>path.startsWith(prefix)))return null;return `${path}${search}`}catch{return null}}
  function pagesUrl(path){return `${BASE}/?build=${BUILD}&p=${encodeURIComponent(path)}`}
  function normalizeLink(a){if(!a||a.target==='_blank'||a.hasAttribute('download'))return;const raw=a.getAttribute('href');if(!raw||raw.startsWith('#')||raw.startsWith('mailto:')||raw.startsWith('tel:')||raw.startsWith('javascript:'))return;const path=routeFromUrl(a.href);if(!path)return;a.dataset.nx27Path=path;if(IS_PAGES)a.href=pagesUrl(path)}
  function rewrite(root=document){if(root.matches?.('a[href]'))normalizeLink(root);root.querySelectorAll?.('a[href]').forEach(normalizeLink)}
  rewrite();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>rewrite(),{once:true});
  new MutationObserver(records=>{for(const record of records){for(const node of record.addedNodes){if(node.nodeType===1)rewrite(node)}}}).observe(document.documentElement,{subtree:true,childList:true});
  if(IS_PAGES){addEventListener('click',event=>{if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;const a=event.target.closest?.('a[href]');if(!a||a.target==='_blank'||a.hasAttribute('download'))return;const path=a.dataset.nx27Path||routeFromUrl(a.href);if(!path)return;event.preventDefault();location.assign(pagesUrl(path))},false)}
})();
