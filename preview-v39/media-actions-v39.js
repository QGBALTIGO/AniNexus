'use strict';
(() => {
  if(window.__NX39_MEDIA_ACTIONS__)return;window.__NX39_MEDIA_ACTIONS__=true;

  const FAV='[data-fav],[data-nx-fav],[data-nx-detail-fav],[data-nx18-fav],[data-nx17-fav]';
  const LIST='[data-list],[data-nx-list],[data-nx-detail-list],[data-nx18-status],[data-nx17-list]';
  const ACTION=`${FAV},${LIST}`;
  const favLock=new Map();
  let listOpening=false;
  let listTimer=0;

  const now=()=>performance.now();
  const clearPop=b=>{b.classList.remove('nx39-pop');void b.offsetWidth;b.classList.add('nx39-pop');setTimeout(()=>b.classList.remove('nx39-pop'),260)};
  const release=b=>{b?.classList.remove('nx39-press');if(b)clearPop(b)};

  function markBusy(button,ms){
    button.dataset.nx39Busy='1';
    setTimeout(()=>{if(button?.isConnected)delete button.dataset.nx39Busy},ms);
  }

  document.addEventListener('pointerdown',event=>{
    const b=event.target.closest?.(ACTION);if(!b||b.disabled)return;
    b.classList.add('nx39-press');
  },true);
  document.addEventListener('pointerup',event=>{const b=event.target.closest?.(ACTION);if(b)requestAnimationFrame(()=>release(b))},true);
  document.addEventListener('pointercancel',event=>{event.target.closest?.(ACTION)?.classList.remove('nx39-press')},true);
  document.addEventListener('pointerleave',event=>{event.target.closest?.(ACTION)?.classList.remove('nx39-press')},true);

  /* Capture before the legacy controller. A double click / burst means one deliberate action,
     not two toggles and certainly not multiple async modals. */
  document.addEventListener('click',event=>{
    const b=event.target.closest?.(ACTION);if(!b||b.disabled)return;
    if(b.matches(FAV)){
      const id=Number(b.dataset.fav||b.dataset.nxFav||b.dataset.nxDetailFav||b.dataset.nx18Fav||b.dataset.nx17Fav||0);
      if(!id)return;
      const last=favLock.get(id)||0;
      if(now()-last<360){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();return}
      favLock.set(id,now());markBusy(b,300);clearPop(b);return;
    }
    if(b.matches(LIST)){
      if(listOpening){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();return}
      listOpening=true;markBusy(b,500);clearTimeout(listTimer);listTimer=setTimeout(()=>{listOpening=false},9000);
    }
  },true);

  document.addEventListener('dblclick',event=>{
    if(!event.target.closest?.(ACTION))return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  },true);

  /* The list controller currently fetches media before mounting its dialog. Unlock as soon as
     the dialog appears; from then on the controller itself owns the modal. */
  const observer=new MutationObserver(records=>{
    if(!listOpening)return;
    for(const record of records){
      for(const node of record.addedNodes){
        if(node.nodeType!==1)continue;
        if(node.matches?.('.nx20-media-layer')||node.querySelector?.('.nx20-media-layer')){
          listOpening=false;clearTimeout(listTimer);return;
        }
      }
    }
  });
  const start=()=>observer.observe(document.body,{subtree:true,childList:true});
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){listOpening=false;clearTimeout(listTimer)}});
})();
