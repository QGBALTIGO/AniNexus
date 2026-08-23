'use strict';
(() => {
  const P='aninexus:preboot:v5:';
  const read=(k,max)=>{try{const x=JSON.parse(localStorage.getItem(P+k)||'null');return x&&Date.now()-x.t<max?x.v:null}catch{return null}};
  const write=(k,v)=>{try{localStorage.setItem(P+k,JSON.stringify({t:Date.now(),v}))}catch{}};
  const wrap=(name,ttl,keyFn)=>{const original=globalThis[name];if(typeof original!=='function')return;globalThis[name]=async function(...args){const key=keyFn(...args),hit=read(key,ttl);if(hit){Promise.resolve().then(()=>original(...args)).then(v=>write(key,v)).catch(()=>{});return hit}const v=await original(...args);write(key,v);return v}};
  wrap('getCatalog',5*60*1000,(o={})=>'catalog:'+JSON.stringify(o));
  wrap('getReading',10*60*1000,(o={})=>'reading:'+JSON.stringify(o));
  wrap('getSchedule',30*1000,()=> 'schedule');
  wrap('getMedia',30*60*1000,(id,t='ANIME')=>'media:'+t+':'+id);
})();
