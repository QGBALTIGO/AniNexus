'use strict';
(() => {
  const LABEL={PLANNING:'Quero Ver',CURRENT:'Assistindo',COMPLETED:'Terminei',PAUSED:'Pausei',DROPPED:'Desisti'};
  const ICON={
    PLANNING:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    CURRENT:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 9 6-9 6V6Z"/></svg>',
    COMPLETED:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.2 4.2L19 7"/></svg>',
    PAUSED:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6v12M16 6v12"/></svg>',
    DROPPED:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
    NONE:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'
  };
  let raf=0;

  function syncButton(button){
    if(!button?.isConnected)return;
    const id=Number(button.dataset.list||button.dataset.nxDetailList||0);if(!id)return;
    const state=window.AniNexusMediaState?.get?.(id)||{};
    const status=state.status||'';
    const label=LABEL[status]||'Adicionar à lista';
    button.dataset.nxUnifiedStatus=status;
    button.classList.toggle('active',!!status);
    button.setAttribute('aria-label',status?`Status: ${label}`:'Adicionar à lista');
    button.title=status?label:'Adicionar à lista';
    button.innerHTML=`${ICON[status]||ICON.NONE}<span>${label}</span>`;
  }
  function sync(scope=document){
    const buttons=[];
    if(scope?.matches?.('.nx22-list[data-list],.nx22-list[data-nx-detail-list]'))buttons.push(scope);
    scope?.querySelectorAll?.('.nx22-list[data-list],.nx22-list[data-nx-detail-list]').forEach(b=>buttons.push(b));
    buttons.forEach(syncButton);
  }
  function schedule(scope=document){
    if(raf)return;
    raf=requestAnimationFrame(()=>{raf=0;sync(scope);});
  }
  new MutationObserver(records=>{
    for(const r of records){for(const n of r.addedNodes){if(n.nodeType===1&&(n.matches?.('.nx22-list,[data-list]')||n.querySelector?.('.nx22-list'))){schedule(document);return}}}
  }).observe(document.body,{subtree:true,childList:true});
  document.addEventListener('aninexus:media-state-changed',()=>schedule(document));
  addEventListener('storage',e=>{if(['aninexus:mediaState:v2','aninexus:mediaState:v1','aninexus:listStatus','aninexus:list'].includes(e.key))schedule(document)});
  schedule(document);
})();