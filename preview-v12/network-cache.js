'use strict';
(() => {
  const TARGET='https://graphql.anilist.co';
  const nativeFetch=window.fetch.bind(window);
  const pending=new Map();
  const TTL=90*1000;
  const MAX=700000;
  const prefix='nx:v12:req:';

  function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)}
  function read(k){try{const x=JSON.parse(sessionStorage.getItem(prefix+k)||'null');if(!x||Date.now()-x.t>TTL||typeof x.v!=='string')return null;return x.v}catch{return null}}
  function write(k,v){if(!v||v.length>MAX)return;try{sessionStorage.setItem(prefix+k,JSON.stringify({t:Date.now(),v}))}catch{}}
  function abortable(p,signal){if(!signal)return p;if(signal.aborted)return Promise.reject(new DOMException('Aborted','AbortError'));return Promise.race([p,new Promise((_,rej)=>signal.addEventListener('abort',()=>rej(new DOMException('Aborted','AbortError')),{once:true}))])}

  window.fetch=async function(input,init={}){
    const url=typeof input==='string'?input:input?.url;
    const method=String(init?.method||'GET').toUpperCase();
    if(url!==TARGET||method!=='POST'||typeof init?.body!=='string')return nativeFetch(input,init);
    const key=hash(init.body);
    const cached=read(key);
    if(cached!==null)return new Response(cached,{status:200,headers:{'content-type':'application/json','x-aninexus-cache':'hit'}});
    if(!pending.has(key)){
      const clean={...init};delete clean.signal;
      const p=nativeFetch(input,clean).then(async r=>{
        const text=await r.text();
        if(r.ok)write(key,text);
        return {ok:r.ok,status:r.status,statusText:r.statusText,text,headers:[...r.headers.entries()]};
      }).finally(()=>pending.delete(key));
      pending.set(key,p);
    }
    const out=await abortable(pending.get(key),init?.signal);
    return new Response(out.text,{status:out.status,statusText:out.statusText,headers:out.headers});
  };
})();
