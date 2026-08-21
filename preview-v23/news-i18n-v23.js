'use strict';
(() => {
  const API='https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=pt&dt=t&q=';
  const queue=[];let running=0;
  const hash=s=>{let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0).toString(36)};
  function cacheGet(s){try{return localStorage.getItem('nx23:newspt:'+hash(s))||''}catch{return''}}
  function cacheSet(s,v){try{localStorage.setItem('nx23:newspt:'+hash(s),v)}catch{}}
  async function translate(s){s=String(s||'').trim();if(!s)return'';const c=cacheGet(s);if(c)return c;try{const r=await fetch(API+encodeURIComponent(s.slice(0,4200)));if(!r.ok)return'';const j=await r.json(),x=(j?.[0]||[]).map(v=>v?.[0]||'').join('').trim();if(x){cacheSet(s,x);return x}}catch{}return''}
  async function work(card){
    if(!card.isConnected||card.dataset.nx23Pt==='1')return;
    card.dataset.nx23Pt='loading';
    const source=card.querySelector('[data-source]')?.dataset.source||'';
    if(!['MAL','ANN'].includes(source)){card.dataset.nx23Pt='1';return}
    const h=card.querySelector('h2 a'),p=card.querySelector('.nx22-news-copy>p');
    const originalTitle=h?.textContent?.trim()||'',originalSummary=p?.textContent?.trim()||'';
    const marker='\n<<<NXSEP>>>\n';const translated=await translate(originalTitle+marker+originalSummary);
    if(translated){const parts=translated.split(/\s*<<<NXSEP>>>\s*/);if(h&&parts[0])h.textContent=parts[0];if(p&&parts[1])p.textContent=parts.slice(1).join(' ');const meta=card.querySelector('.nx22-news-meta');if(meta&&!meta.querySelector('.nx23-auto-pt')){const n=document.createElement('span');n.className='nx23-auto-pt';n.textContent='traduzido automaticamente';meta.append(n)}}
    card.dataset.nx23Pt='1';
  }
  function pump(){while(running<2&&queue.length){const c=queue.shift();running++;work(c).finally(()=>{running--;pump()})}}
  function scan(root=document){root.querySelectorAll?.('.nx22-news-card:not([data-nx23-pt])').forEach(c=>{c.dataset.nx23Pt='queued';queue.push(c)});pump()}
  addEventListener('DOMContentLoaded',()=>scan(),{once:true});
  new MutationObserver(rs=>{for(const r of rs)for(const n of r.addedNodes)if(n.nodeType===1)scan(n)}).observe(document.documentElement,{childList:true,subtree:true});
})();