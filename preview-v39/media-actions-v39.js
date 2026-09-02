'use strict';
(() => {
  if(window.__NX40_MEDIA_ACTIONS__)return;window.__NX40_MEDIA_ACTIONS__=true;

  const IS_PAGES=location.hostname.endsWith('github.io');
  const BASE=IS_PAGES?'/AniNexus':'';
  const BUILD='44.3.0';
  const FAV='[data-fav],[data-nx-fav],[data-nx-detail-fav],[data-nx18-fav],[data-nx17-fav]';
  const LIST='[data-list],[data-nx-list],[data-nx-detail-list],[data-nx18-status],[data-nx17-list]';
  const ACTION=`${FAV},${LIST}`;
  const favLock=new Map();
  let listOpening=false;
  let listTimer=0;
  let syncRaf=0;
  let actionGuardUntil=0;

  const routeFrom=value=>{try{const u=new URL(value||location.href,location.href),raw=u.searchParams.get('p');if(raw)return raw.split('?')[0].replace(/\/+$/,'')||'/';let p=u.pathname;if(IS_PAGES)p=p.replace(/^\/AniNexus(?:\/AniNexus)?/,'')||'/';return p.replace(/\/+$/,'')||'/'}catch{return''}};
  const communityUrl=()=>IS_PAGES?`${BASE}/?build=${BUILD}&p=${encodeURIComponent('/comunidade')}`:'/comunidade';
  const loadScript=src=>new Promise(resolve=>{const found=document.querySelector(`script[data-nx40-src="${src}"]`);if(found){if(found.dataset.loaded==='1')resolve();else found.addEventListener('load',resolve,{once:true});return}const s=document.createElement('script');s.src=`${BASE}/${src}?v=${BUILD}`;s.dataset.nx40Src=src;s.onload=()=>{s.dataset.loaded='1';resolve()};s.onerror=()=>resolve();document.head.append(s)});
  const loadStyle=src=>{if(document.querySelector(`link[data-nx40-src="${src}"]`))return;const l=document.createElement('link');l.rel='stylesheet';l.href=`${BASE}/${src}?v=${BUILD}`;l.dataset.nx40Src=src;document.head.append(l)};
  if(routeFrom()==='/comunidade'){document.documentElement.classList.add('nx40-community-boot');loadStyle('preview-v40/community-v40.css')}
  (async()=>{await loadScript('preview-v40/activity-v40.js');loadScript('preview-v40/home-community-v40.js');loadScript('preview-v40/community-v40.js')})();

  const now=()=>performance.now();
  const api=()=>window.AniNexusMediaState||null;
  const idFav=b=>Number(b?.dataset?.fav||b?.dataset?.nxFav||b?.dataset?.nxDetailFav||b?.dataset?.nx18Fav||b?.dataset?.nx17Fav||0);
  const idList=b=>Number(b?.dataset?.list||b?.dataset?.nxList||b?.dataset?.nxDetailList||b?.dataset?.nx18Status||b?.dataset?.nx17List||0);
  const stop=e=>{e.preventDefault();e.stopPropagation();e.stopImmediatePropagation()};
  const pop=b=>{if(!b)return;b.classList.remove('nx39-pop');void b.offsetWidth;b.classList.add('nx39-pop');setTimeout(()=>b.classList.remove('nx39-pop'),260)};
  const busy=(b,ms)=>{if(!b)return;b.dataset.nx39Busy='1';setTimeout(()=>{if(b.isConnected)delete b.dataset.nx39Busy},ms)};

  function releaseList(){listOpening=false;clearTimeout(listTimer)}
  function waitApi(timeout=1800){const ready=api();if(ready)return Promise.resolve(ready);return new Promise(resolve=>{const started=performance.now(),timer=setInterval(()=>{const a=api();if(a||performance.now()-started>=timeout){clearInterval(timer);resolve(a||null)}},20)})}
  function forceSync(){if(syncRaf)return;syncRaf=requestAnimationFrame(()=>{syncRaf=0;api()?.sync?.()})}
  function syncBurst(){forceSync();setTimeout(forceSync,40);setTimeout(forceSync,180);setTimeout(forceSync,520)}

  function preserveLabel(button){
    if(!button)return;
    const directText=[...button.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim());
    const label=directText.map(n=>n.textContent.trim()).join(' ').trim();
    if(/[A-Za-zÀ-ÿ]{2}/.test(label)){
      directText.forEach(n=>n.remove());
      const span=document.createElement('span');span.textContent=label;button.append(span);
    }
  }
  function classify(button){
    preserveLabel(button);
    const explicitDetail=button.matches('[data-nx-detail-list],[data-nx-detail-fav]');
    const visibleText=String(button.textContent||'').replace(/[＋+♡♥✓×Ⅱ]/g,'').trim();
    const labeled=explicitDetail||/[A-Za-zÀ-ÿ]{2}/.test(visibleText);
    button.dataset.nxActionKind=labeled?'labeled':'compact';
  }

  /* Renderers may create cards, but interaction and geometry have one explicit owner. */
  function neutralize(root=document){
    const buttons=[];
    if(root?.nodeType===1&&root.matches?.(ACTION))buttons.push(root);
    root?.querySelectorAll?.(ACTION).forEach(b=>buttons.push(b));
    for(const b of buttons){
      classify(b);
      b.onclick=null;
      b.dataset.nxActionOwner='global';
      if(b.tagName==='BUTTON'&&!b.getAttribute('type'))b.type='button';
    }
    if(buttons.length)forceSync();
  }

  document.addEventListener('click',e=>{if(e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;const a=e.target.closest?.('a[href]');if(!a||a.target==='_blank'||routeFrom(a.href)!=='/comunidade')return;stop(e);location.assign(communityUrl())},true);
  document.addEventListener('pointerdown',e=>{const b=e.target.closest?.(ACTION);if(b&&!b.disabled){actionGuardUntil=now()+460;b.classList.add('nx39-press')}},true);
  for(const type of ['pointerup','pointercancel','pointerleave'])document.addEventListener(type,e=>e.target.closest?.(ACTION)?.classList.remove('nx39-press'),true);

  async function favoriteAction(b){
    const id=idFav(b);if(!Number.isSafeInteger(id)||id<=0)return;
    const last=favLock.get(id);if(last!==undefined&&now()-last<340)return;
    favLock.set(id,now());busy(b,280);pop(b);
    const a=await waitApi();if(!a)return;
    a.favorite(id,!a.isFavorite(id));syncBurst();
  }
  async function listAction(b){
    const id=idList(b);if(!Number.isSafeInteger(id)||id<=0)return;
    if(listOpening||document.querySelector('.nx20-media-layer'))return;
    listOpening=true;busy(b,650);pop(b);clearTimeout(listTimer);listTimer=setTimeout(releaseList,5000);
    try{const a=await waitApi();if(!a)return;await a.open(id)}catch{}finally{releaseList();syncBurst()}
  }

  /* Window capture precedes all document/element legacy handlers. */
  window.addEventListener('click',e=>{const b=e.target.closest?.(ACTION);if(!b||b.disabled){if(now()<actionGuardUntil&&e.target.closest?.('[data-open-anime],[data-nx18-open],[data-nx21-open],[data-open]'))stop(e);return}actionGuardUntil=now()+460;stop(e);if(b.matches(FAV)){void favoriteAction(b);return}void listAction(b)},true);
  window.addEventListener('dblclick',e=>{if(e.target.closest?.(ACTION))stop(e)},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')releaseList()},true);
  document.addEventListener('aninexus:media-state-changed',()=>syncBurst());
  document.addEventListener('aninexus:favorite-changed',()=>syncBurst());

  const observer=new MutationObserver(records=>{
    let touched=false;
    for(const r of records)for(const n of r.addedNodes){
      if(n.nodeType!==1)continue;
      if(listOpening&&(n.matches?.('.nx20-media-layer')||n.querySelector?.('.nx20-media-layer')))releaseList();
      if(n.matches?.(ACTION)||n.querySelector?.(ACTION)){neutralize(n);touched=true}
    }
    if(touched)syncBurst();
  });
  const start=()=>{neutralize(document);observer.observe(document.body,{subtree:true,childList:true})};
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});

  window.AniNexusMediaActions={favoriteSelector:FAV,listSelector:LIST,sync:syncBurst,neutralize,communityUrl,owner:'global-v41.0.0'};
})();
