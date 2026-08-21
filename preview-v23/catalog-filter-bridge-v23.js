'use strict';
(() => {
  const KEY='nx23:catalog:incoming';
  let applied=false;
  function route(){try{const u=new URL(location.href),p=u.searchParams.get('p');if(p)return p.split('?')[0];let x=u.pathname;if(location.hostname.endsWith('github.io'))x=x.replace(/^\/AniNexus/,'')||'/';return x.replace(/\/+$/,'')||'/'}catch{return'/'}}
  function read(){try{return JSON.parse(sessionStorage.getItem(KEY)||'null')}catch{return null}}
  function apply(){
    if(applied||route()!=='/animes/catalogo')return;
    const f=read();if(!f)return;
    const map={genre:'#nx21Genre',format:'#nx21Format',year:'#nx21Year'};
    const entries=Object.entries(f).filter(([k,v])=>map[k]&&v!=null&&String(v)!=='');
    if(!entries.length){try{sessionStorage.removeItem(KEY)}catch{};applied=true;return}
    const ready=entries.every(([k])=>document.querySelector(map[k]));if(!ready)return;
    applied=true;try{sessionStorage.removeItem(KEY)}catch{}
    entries.forEach(([k,v],i)=>setTimeout(()=>{const el=document.querySelector(map[k]);if(!el)return;el.value=String(v);el.dispatchEvent(new Event('change',{bubbles:true}))},i*60));
  }
  addEventListener('DOMContentLoaded',apply,{once:true});
  const mo=new MutationObserver(apply);mo.observe(document.documentElement,{childList:true,subtree:true});
  addEventListener('popstate',()=>{applied=false;setTimeout(apply,0)});
})();