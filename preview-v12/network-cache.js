'use strict';
(() => {
  const TARGET='https://graphql.anilist.co';
  const nativeFetch=window.fetch.bind(window);
  const pending=new Map();
  const TTL=90*1000;
  const MAX=700000;
  const prefix='nx:v13:req:';
  const legacyPrefixes=['nx:v12:req:','nx:v202:catalog:'];

  function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(36)}
  function validGraphQLText(text){
    if(!text||typeof text!=='string')return false;
    try{const j=JSON.parse(text);return !!j&&typeof j==='object'&&!Array.isArray(j)&&!j.errors&&j.data!=null}catch{return false}
  }
  function read(k){
    try{
      const raw=sessionStorage.getItem(prefix+k);
      if(!raw)return null;
      const x=JSON.parse(raw);
      if(!x||Date.now()-x.t>TTL||typeof x.v!=='string'||!validGraphQLText(x.v)){
        sessionStorage.removeItem(prefix+k);
        return null;
      }
      return x.v;
    }catch{return null}
  }
  function write(k,v){if(!v||v.length>MAX||!validGraphQLText(v))return;try{sessionStorage.setItem(prefix+k,JSON.stringify({t:Date.now(),v}))}catch{}}
  function abortable(p,signal){if(!signal)return p;if(signal.aborted)return Promise.reject(new DOMException('Aborted','AbortError'));return Promise.race([p,new Promise((_,rej)=>signal.addEventListener('abort',()=>rej(new DOMException('Aborted','AbortError')),{once:true}))])}
  function clearLegacy(){
    try{
      for(let i=sessionStorage.length-1;i>=0;i--){
        const k=sessionStorage.key(i)||'';
        if(legacyPrefixes.some(p=>k.startsWith(p)))sessionStorage.removeItem(k);
      }
    }catch{}
  }
  clearLegacy();

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
        if(r.ok&&validGraphQLText(text))write(key,text);
        return{ok:r.ok,status:r.status,statusText:r.statusText,text,headers:[...r.headers.entries()]};
      }).finally(()=>pending.delete(key));
      pending.set(key,p);
    }
    const out=await abortable(pending.get(key),init?.signal);
    return new Response(out.text,{status:out.status,statusText:out.statusText,headers:out.headers});
  };

  /* Direct-load guards keep legacy renderers from racing dedicated runtimes. */
  try{
    const isPages=location.hostname.endsWith('github.io');
    const base=isPages?'/AniNexus':'';
    const u=new URL(location.href);
    const restored=u.searchParams.get('p');
    let path=restored?restored.split('?')[0]:location.pathname;
    if(isPages&&!restored)path=path.replace(/^\/AniNexus/,'')||'/';
    path=path.replace(/\/+$/,'')||'/';
    if(path==='/animes/programacao'){
      window.__NX_SCHEDULE_BOOT__=true;
      history.replaceState({},'',`${base}/__nx_schedule_boot`);
    }else if(path==='/animes/catalogo'){
      window.__NX_CATALOG_BOOT__=true;
      history.replaceState({},'',`${base}/__nx_catalog_boot`);
    }
  }catch{}
})();