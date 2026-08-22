'use strict';
(() => {
  if(window.__NX38_RUNTIME__)return;window.__NX38_RUNTIME__=true;
  window.__NX38_BOOT_AT=performance.now();

  // The old PWA shell predates the current multi-route runtime and can replay stale UI.
  if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(rs=>Promise.allSettled(rs.map(r=>r.unregister()))).catch(()=>{})}
  if('caches' in window){caches.keys().then(keys=>Promise.allSettled(keys.filter(k=>/^aninexus-shell-/i.test(k)).map(k=>caches.delete(k)))).catch(()=>{})}

  // Handle broken media before legacy per-image handlers replace large art with a stretched logo.
  document.addEventListener('error',e=>{
    const img=e.target;if(!(img instanceof HTMLImageElement)||img.dataset.nx38Broken)return;
    img.dataset.nx38Broken='1';
    e.stopImmediatePropagation();
    img.classList.add('nx38-img-error');
    img.closest('.nx35-nmedia,.nx37-gallery-item,.nx24-card-poster,.aqx-media,.nx18-cover,.nx35-community-cover,.media,.poster')?.classList.add('nx38-media-fallback');
  },true);

  const tune=root=>{
    if(root instanceof HTMLImageElement){if(!root.hasAttribute('decoding'))root.decoding='async';if(!root.hasAttribute('loading')&&!root.closest('.hero,.nx35-article-hero,.nx24-hero,.aqx-hero'))root.loading='lazy'}
    root.querySelectorAll?.('img').forEach(img=>{if(!img.hasAttribute('decoding'))img.decoding='async';if(!img.hasAttribute('loading')&&!img.closest('.hero,.nx35-article-hero,.nx24-hero,.aqx-hero'))img.loading='lazy'});
    root.querySelectorAll?.('a[target="_blank"]').forEach(a=>{const rel=new Set(String(a.rel||'').split(/\s+/).filter(Boolean));rel.add('noopener');rel.add('noreferrer');a.rel=[...rel].join(' ')})
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>tune(document),{once:true});else tune(document);
  new MutationObserver(rs=>{for(const r of rs)for(const n of r.addedNodes)if(n.nodeType===1)tune(n)}).observe(document.documentElement,{subtree:true,childList:true});

  const setOnline=()=>document.documentElement.classList.toggle('nx38-offline',!navigator.onLine);
  addEventListener('online',setOnline);addEventListener('offline',setOnline);setOnline();
  if(navigator.connection?.saveData)document.documentElement.classList.add('nx38-save-data');
})();
