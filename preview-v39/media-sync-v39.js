'use strict';
(() => {
  if(window.__NX39_MEDIA_SYNC__)return;window.__NX39_MEDIA_SYNC__=true;
  const IS_PAGES=location.hostname.endsWith('github.io');
  function createSync(reading=false){
  const remoteAuth=()=>window.AniNexusAuth?.enabled===true?window.AniNexusAuth:null;

  const FAV_KEY=reading?'aninexus:mangaFavorites':'aninexus:favorites';
  const STATE_KEY=reading?'aninexus:mangaState:v2':'aninexus:mediaState:v2';
  const FAV_PENDING=FAV_KEY+':pending:v1';
  const STATE_PENDING=reading?'aninexus:mangaState:pending:v1':'aninexus:mediaState:pending:v1';
  const ownerKey=reading?'aninexus:mangaOwner':'aninexus:mediaOwner';
  const listPath=reading?'/api/me/manga-list':'/api/me/list';
  const mediaType=reading?'MANGA':'ANIME';
  const stateApi=()=>reading?window.AniNexusMangaState:window.AniNexusMediaState;
  const eventName=name=>`aninexus:${reading?'manga-':''}${name}`;
  let epoch=0,favoriteRevision=0,stateRevision=0;
  const favoriteEdits=new Map(),stateEdits=new Map();
  let userPromise=null;
  const favDesired=new Map(),favRunning=new Set();
  const stateDesired=new Map(),stateRunning=new Set();

  const read=(key,fallback)=>{try{const v=JSON.parse(localStorage.getItem(key)||'null');return v??fallback}catch{return fallback}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}};
  const ids=value=>new Set((Array.isArray(value)?value:[]).map(Number).filter(n=>Number.isSafeInteger(n)&&n>0));
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
  const same=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);

  async function request(path,options={}){
    if(remoteAuth()){
      try{return await remoteAuth().api(path,options)}catch(error){if(error?.status===401)return null;throw error}
    }
    if(IS_PAGES)return null;
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
    const version=epoch,u=await user();if(!u||version!==epoch)return false;
    const path=`/api/me/favorites/${id}${on?'':`?mediaType=${mediaType}`}`;
    const result=await request(path,{method:on?'PUT':'DELETE',body:on?JSON.stringify({mediaType}):undefined});
    return result!==null;
  }
  async function flushFavorite(id){
    if(favRunning.has(id))return;favRunning.add(id);
    try{
      while(favDesired.has(id)){
        const wanted=!!favDesired.get(id);favDesired.delete(id);
        const version=epoch;
        try{if(await writeFavorite(id,wanted)){if(version===epoch){favoriteEdits.set(id,++favoriteRevision);clearPendingIf(FAV_PENDING,id,wanted)}}else notifyPending()}catch{notifyPending()}
      }
    }finally{favRunning.delete(id);if(favDesired.has(id))queueFavorite(id,favDesired.get(id))}
  }
  function queueFavorite(id,on){favDesired.set(id,!!on);queueMicrotask(()=>flushFavorite(id))}

  async function writeState(id,state){
    const version=epoch,u=await user();if(!u||version!==epoch)return false;
    const result=!state?.status
      ?await request(`${listPath}/${id}`,{method:'DELETE'})
      :await request(`${listPath}/${id}`,{method:'PUT',body:JSON.stringify({status:state.status,score:state.score==null?null:Number(state.score),progress:Math.max(0,Math.floor(Number(state.progress)||0)),volumeProgress:Math.max(0,Math.floor(Number(state.volumeProgress)||0)),reaction:null,reactions:state.reactions||[state.reaction].filter(Boolean)})});
    return result!==null;
  }
  async function flushState(id){
    if(stateRunning.has(id))return;stateRunning.add(id);
    try{
      while(stateDesired.has(id)){
        const wanted=stateDesired.get(id);stateDesired.delete(id);
        const version=epoch;
        try{if(await writeState(id,wanted)){if(version===epoch){stateEdits.set(id,++stateRevision);clearPendingIf(STATE_PENDING,id,wanted)}}else notifyPending()}catch{notifyPending()}
      }
    }finally{stateRunning.delete(id);if(stateDesired.has(id))queueState(id,stateDesired.get(id))}
  }
  function queueState(id,state){stateDesired.set(id,state);queueMicrotask(()=>flushState(id))}

  function rowState(row){const reactions=Array.isArray(row.reactions)?row.reactions:[];return{status:String(row.status||''),score:row.score==null?null:num(row.score),reaction:reactions[0]||'',reactions,progress:Math.max(0,Number(row.progress)||0),volumeProgress:Math.max(0,Number(row.volume_progress||row.volumeProgress)||0),updatedAt:Date.parse(row.updated_at||row.updatedAt||0)||0}}

  async function hydrateFavorites(){
    const version=epoch,revision=favoriteRevision;
    const data=await request('/api/me/favorites').catch(()=>null);if(!data)return;
    if(version!==epoch)return;
    const remote=ids((data.items||[]).filter(x=>String(x.media_type||'ANIME').toUpperCase()===mediaType).map(x=>x.media_id));
    const desired=new Set(remote),changes=pending(FAV_PENDING);
    for(const [raw,value] of Object.entries(changes)){const id=Number(raw);if(!Number.isSafeInteger(id)||id<=0)continue;value?desired.add(id):desired.delete(id)}
    const current=ids(read(FAV_KEY,[]));
    for(const [id,edited] of favoriteEdits)if(edited>revision)current.has(id)?desired.add(id):desired.delete(id);
    write(FAV_KEY,[...desired].sort((a,b)=>a-b));stateApi()?.sync?.();
    for(const id of desired)if(!remote.has(id))queueFavorite(id,true);
    for(const id of remote)if(!desired.has(id))queueFavorite(id,false);
    for(const [raw,value] of Object.entries(changes)){const id=Number(raw);if(Number.isSafeInteger(id)&&id>0)queueFavorite(id,!!value)}
  }

  async function hydrateStates(){
    const version=epoch,revision=stateRevision;
    const data=await request(listPath).catch(()=>null);if(!data||version!==epoch)return;
    const next={},remote=new Map();
    for(const row of data.items||[]){const id=Number(row.media_id);if(!Number.isSafeInteger(id)||id<=0)continue;const state=rowState(row);remote.set(id,state);next[id]=state}
    const changes=pending(STATE_PENDING);
    for(const [raw,state] of Object.entries(changes)){const id=Number(raw);if(!Number.isSafeInteger(id)||id<=0)continue;if(state?.status)next[id]=state;else delete next[id]}
    const current=read(STATE_KEY,{});
    for(const [id,edited] of stateEdits)if(edited>revision){if(current[id]?.status)next[id]=current[id];else delete next[id]}
    write(STATE_KEY,next);write(reading?'aninexus:mangaState:v1':'aninexus:mediaState:v1',next);stateApi()?.sync?.();
    write(reading?'aninexus:mangaList':'aninexus:list',Object.keys(next).map(Number));
    write(reading?'aninexus:mangaListStatus':'aninexus:listStatus',Object.fromEntries(Object.entries(next).map(([id,state])=>[id,state.status])));
    stateApi()?.sync();
    for(const [raw,state] of Object.entries(next)){const id=Number(raw),server=remote.get(id);if(!server||Number(state.updatedAt||0)>Number(server.updatedAt||0))queueState(id,state)}
    for(const [raw,state] of Object.entries(changes)){const id=Number(raw);if(Number.isSafeInteger(id)&&id>0)queueState(id,state)}
  }

  async function hydrate(){const version=epoch,u=await user();if(!u||version!==epoch)return;await Promise.allSettled([hydrateFavorites(),hydrateStates()])}

  document.addEventListener(eventName('favorite-changed'),event=>{
    const id=Number(event.detail?.id),on=!!event.detail?.favorite;if(!Number.isSafeInteger(id)||id<=0)return;
    favoriteEdits.set(id,++favoriteRevision);
    setPending(FAV_PENDING,id,on);queueFavorite(id,on);
  });
  document.addEventListener(eventName('media-state-changed'),event=>{
    const id=Number(event.detail?.id),state=event.detail?.state||{};if(!Number.isSafeInteger(id)||id<=0)return;
    stateEdits.set(id,++stateRevision);
    const snapshot=state?.status?{status:state.status,score:state.score??null,reaction:state.reaction||'',reactions:state.reactions||[],progress:Math.max(0,Number(state.progress)||0),volumeProgress:Math.max(0,Number(state.volumeProgress)||0),updatedAt:Number(state.updatedAt)||Date.now()}:null;
    setPending(STATE_PENDING,id,snapshot);queueState(id,snapshot);
  });

  addEventListener('online',()=>{user(true);hydrate()});
  function notifyPending(){document.dispatchEvent(new CustomEvent('aninexus:media-sync-pending',{detail:{mediaType}}))}
  addEventListener('aninexus:account-identity-changed',event=>{
    const previous=read(ownerKey,null),next=event.detail?.user?.id||null;
    if(previous&&previous!==next){
      epoch++;favDesired.clear();stateDesired.clear();favoriteEdits.clear();stateEdits.clear();userPromise=null;
      for(const key of [FAV_KEY,STATE_KEY,FAV_PENDING,STATE_PENDING,reading?'aninexus:mangaState:v1':'aninexus:mediaState:v1',reading?'aninexus:mangaList':'aninexus:list',reading?'aninexus:mangaListStatus':'aninexus:listStatus']){try{localStorage.removeItem(key)}catch{}}
      stateApi()?.close();stateApi()?.sync();
    }
    write(ownerKey,next);userPromise=null;if(next)void hydrate();
  });
  addEventListener('aninexus:media-sync-retry',()=>{userPromise=null;void hydrate()});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',hydrate,{once:true});else hydrate();
  }
  createSync();createSync(true);
})();
