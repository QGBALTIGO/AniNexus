'use strict';
(() => {
  if(window.__NX40_MEDIA_ACTIONS__)return;window.__NX40_MEDIA_ACTIONS__=true;

  const IS_PAGES=location.hostname.endsWith('github.io');
  const BASE=IS_PAGES?'/AniNexus':'';
  const BUILD='40.0.0';
  const FAV='[data-fav],[data-nx-fav],[data-nx-detail-fav],[data-nx18-fav],[data-nx17-fav]';
  const LIST='[data-list],[data-nx-list],[data-nx-detail-list],[data-nx18-status],[data-nx17-list]';
  const ACTION=`${FAV},${LIST}`;
  const favLock=new Map();
  let listOpening=false,listTimer=0;

  const routeFrom=value=>{try{const u=new URL(value||location.href,location.href),raw=u.searchParams.get('p');if(raw)return raw.split('?')[0].replace(/\/+$/,'')||'/';let p=u.pathname;if(IS_PAGES)p=p.replace(/^\/AniNexus(?:\/AniNexus)?/,'')||'/';return p.replace(/\/+$/,'')||'/'}catch{return''}};
  const communityUrl=()=>IS_PAGES?`${BASE}/?build=${BUILD}&p=${encodeURIComponent('/comunidade')}`:'/comunidade';
  const loadScript=src=>new Promise(resolve=>{const found=document.querySelector(`script[data-nx40-src="${src}"]`);if(found){if(found.dataset.loaded==='1')resolve();else found.addEventListener('load',resolve,{once:true});return}const s=document.createElement('script');s.src=`${BASE}/${src}?v=${BUILD}`;s.dataset.nx40Src=src;s.onload=()=>{s.dataset.loaded='1';resolve()};s.onerror=()=>resolve();document.head.append(s)});
  const loadStyle=src=>{if(document.querySelector(`link[data-nx40-src="${src}"]`))return;const l=document.createElement('link');l.rel='stylesheet';l.href=`${BASE}/${src}?v=${BUILD}`;l.dataset.nx40Src=src;document.head.append(l)};
  if(routeFrom()==='/comunidade'){document.documentElement.classList.add('nx40-community-boot');loadStyle('preview-v40/community-v40.css')}
  (async()=>{await loadScript('preview-v40/activity-v40.js');loadScript('preview-v40/home-community-v40.js');if(routeFrom()==='/comunidade')loadScript('preview-v40/community-v40.js')})();

  const now=()=>performance.now();
  const idFav=b=>Number(b?.dataset?.fav||b?.dataset?.nxFav||b?.dataset?.nxDetailFav||b?.dataset?.nx18Fav||b?.dataset?.nx17Fav||0);
  const idList=b=>Number(b?.dataset?.list||b?.dataset?.nxList||b?.dataset?.nxDetailList||b?.dataset?.nx18Status||b?.dataset?.nx17List||0);
  const stop=e=>{e.preventDefault();e.stopPropagation();e.stopImmediatePropagation()};
  const pop=b=>{if(!b)return;b.classList.remove('nx39-pop');void b.offsetWidth;b.classList.add('nx39-pop');setTimeout(()=>b.classList.remove('nx39-pop'),260)};
  const busy=(b,ms)=>{if(!b)return;b.dataset.nx39Busy='1';setTimeout(()=>{if(b.isConnected)delete b.dataset.nx39Busy},ms)};
  const api=()=>window.AniNexusMediaState||null;

  function releaseList(){listOpening=false;clearTimeout(listTimer)}
  function withApi(fn){const a=api();if(a){fn(a);return}let tries=0;const timer=setInterval(()=>{const x=api();if(x||++tries>40){clearInterval(timer);if(x)fn(x)}},25)}

  /* Dedicated Community owns its route. This prevents the V6 static-room renderer from taking
     over when a legacy navigation listener catches /comunidade. */
  document.addEventListener('click',e=>{
    if(e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
    const a=e.target.closest?.('a[href]');if(!a||a.target==='_blank')return;
    if(routeFrom(a.href)!=='/comunidade')return;
    stop(e);location.assign(communityUrl());
  },true);

  document.addEventListener('pointerdown',e=>{const b=e.target.closest?.(ACTION);if(b&&!b.disabled)b.classList.add('nx39-press')},true);
  for(const type of ['pointerup','pointercancel','pointerleave'])document.addEventListener(type,e=>{const b=e.target.closest?.(ACTION);if(b){b.classList.remove('nx39-press');if(type==='pointerup')requestAnimationFrame(()=>pop(b))}},true);

  /* V40 owns the action in capture phase. Legacy Programação, Temporadas and V6 handlers never
     receive the event, so there is one state controller on every route. */
  document.addEventListener('click',e=>{
    const b=e.target.closest?.(ACTION);if(!b||b.disabled)return;
    stop(e);

    if(b.matches(FAV)){
      const id=idFav(b);if(!id)return;
      const last=favLock.get(id)||0;if(now()-last<340)return;
      favLock.set(id,now());busy(b,280);pop(b);
      withApi(a=>a.favorite(id));
      return;
    }

    const id=idList(b);if(!id)return;
    if(listOpening||document.querySelector('.nx20-media-layer'))return;
    listOpening=true;busy(b,650);pop(b);clearTimeout(listTimer);listTimer=setTimeout(releaseList,10000);
    withApi(a=>Promise.resolve(a.open(id)).catch(()=>{}).finally(()=>{if(document.querySelector('.nx20-media-layer'))releaseList()}));
  },true);

  document.addEventListener('dblclick',e=>{if(e.target.closest?.(ACTION))stop(e)},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')releaseList()},true);

  const observer=new MutationObserver(records=>{
    for(const r of records)for(const n of r.addedNodes){
      if(n.nodeType!==1)continue;
      if(listOpening&&(n.matches?.('.nx20-media-layer')||n.querySelector?.('.nx20-media-layer')))releaseList();
      if(n.matches?.(ACTION)||n.querySelector?.(ACTION))requestAnimationFrame(()=>api()?.sync?.());
    }
  });
  const start=()=>observer.observe(document.body,{subtree:true,childList:true});
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});

  window.AniNexusMediaActions={favoriteSelector:FAV,listSelector:LIST,sync:()=>api()?.sync?.(),communityUrl};
})();
