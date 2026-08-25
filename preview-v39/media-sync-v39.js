'use strict';
(() => {
  if(window.__NX39_MEDIA_SYNC__)return;window.__NX39_MEDIA_SYNC__=true;
  const IS_PAGES=location.hostname.endsWith('github.io');
  const remoteAuth=window.AniNexusAuth?.enabled===true?window.AniNexusAuth:null;
  if(IS_PAGES&&!remoteAuth)return;

  const FAV_KEY='aninexus:favorites';
  const STATE_KEY='aninexus:mediaState:v2';
  const FAV_PENDING='aninexus:favorites:pending:v1';
  const STATE_PENDING='aninexus:mediaState:pending:v1';
  let userPromise=null;
  const favDesired=new Map(),favRunning=new Set();
  const stateDesired=new Map(),stateRunning=new Set();

  const read=(key,fallback)=>{try{const v=JSON.parse(localStorage.getItem(key)||'null');return v??fallback}catch{return fallback}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}};
  const ids=value=>new Set((Array.isArray(value)?value:[]).map(Number).filter(n=>Number.isSafeInteger(n)&&n>0));
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
  const same=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);

  async function request(path,options={}){
    if(remoteAuth){
      try{return await remoteAuth.api(path,options)}catch(error){if(error?.status===401)return null;throw error}
    }
    const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,headers:{accept:'application/json',...(options.body?{'content-type':'application/json'}:{}),...(options.headers||{})}});
    if(response.status===401)return null;
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    if(response.status===204)return{};
    return response.json().catch(()=>({}));
  }
  async function user(force=false){if(force)userPromise=null;if(!userPromise)userPromise=request('/api/me').then(x=>x?.user||null).catch(()=>null);return userPromise}
  function pending(key){const value=read(key,{});return value&&typeof value==='object'?value:{}}
  function setPending(key,id,value){const p=pending(key);p[id]=value;write(key,p)}
  function clearPendingIf(key,id,value){const p=pending(key);if(same(p[id],value)){delete p[id];write(key,p)}}

  async function writeFavorite(id,on){
    const u=await user();if(!u)return false;
    const path=`/api/me/favorites/${id}${on?'':'?mediaType=ANIME'}`;
    const result=await request(path,{method:on?'PUT':'DELETE',body:on?JSON.stringify({mediaType:'ANIME'}):undefined});
    return result!==null;
  }
  async function flushFavorite(id){
    if(favRunning.has(id))return;favRunning.add(id);
    try{
      while(favDesired.has(id)){
        const wanted=!!favDesired.get(id);favDesired.delete(id);
        try{if(await writeFavorite(id,wanted))clearPendingIf(FAV_PENDING,id,wanted)}catch{}
      }
    }finally{favRunning.delete(id);if(favDesired.has(id))queueFavorite(id,favDesired.get(id))}
  }
  function queueFavorite(id,on){favDesired.set(id,!!on);queueMicrotask(()=>flushFavorite(id))}

  async function writeState(id,state){
    const u=await user();if(!u)return false;
    const result=!state?.status
      ?await request(`/api/me/list/${id}`,{method:'DELETE'})
      :await request(`/api/me/list/${id}`,{method:'PUT',body:JSON.stringify({status:state.status,score:state.score==null?null:Number(state.score),progress:Math.max(0,Number(state.progress)||0),reaction:null})});
    return result!==null;
  }
  async function flushState(id){
    if(stateRunning.has(id))return;stateRunning.add(id);
    try{
      while(stateDesired.has(id)){
        const wanted=stateDesired.get(id);stateDesired.delete(id);
        try{if(await writeState(id,wanted))clearPendingIf(STATE_PENDING,id,wanted)}catch{}
      }
    }finally{stateRunning.delete(id);if(stateDesired.has(id))queueState(id,stateDesired.get(id))}
  }
  function queueState(id,state){stateDesired.set(id,state);queueMicrotask(()=>flushState(id))}

  function rowState(row){return{status:String(row.status||''),score:row.score==null?null:num(row.score),reaction:'',progress:Math.max(0,Number(row.progress)||0),updatedAt:Date.parse(row.updated_at||row.updatedAt||0)||0}}
  function localStates(){const value=read(STATE_KEY,{});return value&&typeof value==='object'?value:{}}

  async function hydrateFavorites(){
    const data=await request('/api/me/favorites').catch(()=>null);if(!data)return;
    const remote=ids((data.items||[]).filter(x=>String(x.media_type||'ANIME').toUpperCase()==='ANIME').map(x=>x.media_id));
    const local=ids(read(FAV_KEY,[])),desired=new Set([...remote,...local]),changes=pending(FAV_PENDING);
    for(const [raw,value] of Object.entries(changes)){const id=Number(raw);if(!Number.isSafeInteger(id)||id<=0)continue;value?desired.add(id):desired.delete(id)}
    write(FAV_KEY,[...desired].sort((a,b)=>a-b));window.AniNexusMediaState?.sync?.();
    for(const id of desired)if(!remote.has(id))queueFavorite(id,true);
    for(const id of remote)if(!desired.has(id))queueFavorite(id,false);
    for(const [raw,value] of Object.entries(changes)){const id=Number(raw);if(Number.isSafeInteger(id)&&id>0)queueFavorite(id,!!value)}
  }

  async function hydrateStates(){
    const data=await request('/api/me/list').catch(()=>null);if(!data)return;
    const local=localStates(),next={...local},remote=new Map();
    for(const row of data.items||[]){const id=Number(row.media_id);if(!Number.isSafeInteger(id)||id<=0)continue;const state=rowState(row);remote.set(id,state);const here=local[id];if(!here||state.updatedAt>Number(here.updatedAt||0))next[id]=state}
    const changes=pending(STATE_PENDING);
    for(const [raw,state] of Object.entries(changes)){const id=Number(raw);if(!Number.isSafeInteger(id)||id<=0)continue;if(state?.status)next[id]=state;else delete next[id]}
    write(STATE_KEY,next);write('aninexus:mediaState:v1',next);window.AniNexusMediaState?.sync?.();
    for(const [raw,state] of Object.entries(next)){const id=Number(raw),server=remote.get(id);if(!server||Number(state.updatedAt||0)>Number(server.updatedAt||0))queueState(id,state)}
    for(const [raw,state] of Object.entries(changes)){const id=Number(raw);if(Number.isSafeInteger(id)&&id>0)queueState(id,state)}
  }

  async function hydrate(){const u=await user();if(!u)return;await Promise.allSettled([hydrateFavorites(),hydrateStates()])}

  document.addEventListener('aninexus:favorite-changed',event=>{
    const id=Number(event.detail?.id),on=!!event.detail?.favorite;if(!Number.isSafeInteger(id)||id<=0)return;
    setPending(FAV_PENDING,id,on);queueFavorite(id,on);
  });
  document.addEventListener('aninexus:media-state-changed',event=>{
    const id=Number(event.detail?.id),state=event.detail?.state||{};if(!Number.isSafeInteger(id)||id<=0)return;
    const snapshot=state?.status?{status:state.status,score:state.score??null,reaction:state.reaction||'',progress:Math.max(0,Number(state.progress)||0),updatedAt:Number(state.updatedAt)||Date.now()}:null;
    setPending(STATE_PENDING,id,snapshot);queueState(id,snapshot);
  });

  addEventListener('online',()=>{user(true);hydrate()});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',hydrate,{once:true});else hydrate();
})();
