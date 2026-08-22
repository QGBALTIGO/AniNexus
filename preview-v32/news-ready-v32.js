'use strict';
(() => {
  let sent=false;
  const ready=()=>{
    if(sent||!document.querySelector('.nx32-news-page'))return false;
    sent=true;
    dispatchEvent(new CustomEvent('aninexus:news-v32-ready'));
    return true;
  };
  if(!ready()){
    const app=document.querySelector('#app');
    if(app){const mo=new MutationObserver(()=>{if(ready())mo.disconnect()});mo.observe(app,{childList:true,subtree:true});setTimeout(()=>mo.disconnect(),5000)}
  }
})();
