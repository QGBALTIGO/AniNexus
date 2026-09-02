'use strict';
(() => {
  if(window.__NX40_ACTIVITY__)return;window.__NX40_ACTIVITY__=true;
  const KEY='aninexus:community:activity:v40';
  const STATE_KEY='aninexus:mediaState:v2';
  const API='https://graphql.anilist.co';
  const MAX=80;

  const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||'null')??f}catch{return f}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}};
  const validId=v=>{const n=Number(v);return Number.isSafeInteger(n)&&n>0?n:0};
  const titleFrom=m=>m?.title?.english||m?.title?.userPreferred||m?.title?.romaji||m?.title?.native||'';
  const coverFrom=m=>m?.coverImage?.extraLarge||m?.coverImage?.large||'';
  const placeholder=value=>/^(?:voc[eê]|you)$/i.test(String(value||'').trim());

  async function identity(){
    try{
      const user=window.AniNexusAccountData?await window.AniNexusAccountData():null;
      if(!user)return null;
      return{username:String(user.username||'').trim(),display_name:String(user.displayName||user.display_name||user.username||'').trim(),avatar_url:String(user.avatarUrl||user.avatar_url||'').trim()}
    }catch{return null}
  }
  async function enrich(list){
    const user=await identity();
    return(Array.isArray(list)?list:[]).map(item=>{
      const sameUser=user?.username&&String(item?.username||'').toLocaleLowerCase('pt-BR')===user.username.toLocaleLowerCase('pt-BR');
      if(user&&(item?.local||placeholder(item?.username)||sameUser))return{...item,username:user.username,display_name:user.display_name,avatar_url:item.avatar_url||item.avatarUrl||user.avatar_url};
      if(item?.local||placeholder(item?.username))return{...item,username:'',display_name:'Sua lista',avatar_url:''};
      return item
    })
  }

  function rows(){const v=read(KEY,[]);return Array.isArray(v)?v:[]}
  function save(list){write(KEY,list.slice(0,MAX));dispatchEvent(new CustomEvent('aninexus:community-activity-changed',{detail:{items:list.slice(0,MAX)}}))}
  function domMeta(id){
    const selectors=[`[data-nx21-open="${id}"]`,`[data-nx18-open="${id}"]`,`[data-nx-media="${id}"]`,`[data-open-anime="${id}"]`,`[data-lib-open="${id}"]`,`[data-open="${id}"]`];
    const root=document.querySelector(selectors.join(','));if(!root)return{};
    const img=root.querySelector('img');
    return{title:root.dataset?.title||root.querySelector('h3,h2,strong')?.textContent?.trim()||'',cover:img?.currentSrc||img?.src||''};
  }
  async function anilistMeta(id){
    try{const query='query($id:Int){Media(id:$id,type:ANIME){id title{romaji english native userPreferred}coverImage{extraLarge large}bannerImage}}',r=await fetch(API,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({query,variables:{id}})});if(!r.ok)return{};const m=(await r.json())?.data?.Media;return m?{title:titleFrom(m),cover:coverFrom(m),banner:m.bannerImage||''}:{}}catch{return{}}
  }
  function updateMeta(activityId,meta){if(!meta?.title&&!meta?.cover&&!meta?.banner)return;const list=rows(),i=list.findIndex(x=>x.id===activityId);if(i<0)return;list[i]={...list[i],title:list[i].title||meta.title||'',cover:list[i].cover||meta.cover||'',banner:list[i].banner||meta.banner||''};save(list)}

  function record(id,state,createdAt=Date.now(),seed=false){
    id=validId(id);if(!id||!state?.status)return null;
    const meta=domMeta(id),stamp=Number(createdAt)||Date.now(),list=rows();
    const snapshot={kind:'state',media_id:id,username:'',display_name:'',avatar_url:'',status:String(state.status),progress:Math.max(0,Number(state.progress)||0),score:state.score==null?null:Number(state.score),reaction:String(state.reaction||''),created_at:new Date(stamp).toISOString(),title:meta.title||'',cover:meta.cover||'',banner:'',local:true};
    const duplicate=list.find(x=>x.media_id===id&&x.status===snapshot.status&&x.progress===snapshot.progress&&x.score===snapshot.score&&x.reaction===snapshot.reaction&&Math.abs(Date.parse(x.created_at)-stamp)<1800);
    if(duplicate)return duplicate;
    if(seed&&list.some(x=>x.media_id===id&&Date.parse(x.created_at)>=stamp-1000))return null;
    snapshot.id=`state:${id}:${stamp}:${Math.random().toString(36).slice(2,7)}`;
    list.unshift(snapshot);save(list);
    if(!snapshot.title||!snapshot.cover)anilistMeta(id).then(m=>updateMeta(snapshot.id,m));
    return snapshot;
  }

  function seed(){const states=read(STATE_KEY,{});if(!states||typeof states!=='object')return;for(const [raw,s] of Object.entries(states)){const id=validId(raw);if(id&&s?.status)record(id,s,Number(s.updatedAt)||Date.now(),true)}}
  function local(limit=30){return rows().filter(x=>x?.kind==='state'&&x?.status).sort((a,b)=>Date.parse(b.created_at||0)-Date.parse(a.created_at||0)).slice(0,Math.max(1,Math.min(80,Number(limit)||30)))}

  document.addEventListener('aninexus:media-state-changed',e=>{const id=validId(e.detail?.id),s=e.detail?.state;if(id&&s?.status)record(id,s,Number(s.updatedAt)||Date.now())});
  addEventListener('storage',e=>{if(e.key===KEY)dispatchEvent(new CustomEvent('aninexus:community-activity-changed',{detail:{items:local()}}))});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',seed,{once:true});else seed();

  window.AniNexusCommunityActivity={local,record,seed,identity,enrich,key:KEY};
})();
