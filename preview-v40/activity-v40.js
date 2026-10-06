'use strict';
(() => {
  if(window.__NX40_ACTIVITY__)return;window.__NX40_ACTIVITY__=true;
  const KEY='aninexus:community:activity:v40';
  const API='https://graphql.anilist.co';
  const MAX=80;
  let seedBatch=null,identityEpoch=0,identityKnown=window.AniNexusAuth?.enabled!==true,identityUser=null,identityPromise=null;
  let owner=identityKnown?'anonymous':'';
  let expectedOwner,identityBlocked=false;

  const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||'null')??f}catch{return f}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}};
  const validId=v=>{const n=Number(v);return Number.isSafeInteger(n)&&n>0?n:0};
  const titleFrom=m=>typeof m?.title==='string'?m.title:m?.title?.english||m?.title?.userPreferred||m?.title?.romaji||m?.title?.native||'';
  const coverFrom=m=>m?.cover||m?.coverImage?.extraLarge||m?.coverImage?.large||'';
  const placeholder=value=>/^(?:voc[eê]|you)$/i.test(String(value||'').trim());
  const mediaType=x=>String(x?.media_type||x?.mediaType||'').toUpperCase()==='MANGA'?'MANGA':'ANIME';
  const stamp=x=>Date.parse(x.created_at||x.updated_at||'')||0;

  // The remote list is a current snapshot, not a second event beside its local copy.
  function merge(list){
    const merged=new Map();
    for(const raw of [...(Array.isArray(list)?list:[])].sort((a,b)=>stamp(b)-stamp(a))){
      const x={...raw,media_type:mediaType(raw)},kind=x.kind||'state';
      const actor=String(x.username||x.user_id||(x.local?'local':x.display_name)||'anonymous').trim().toLocaleLowerCase('pt-BR');
      const key=kind==='state'?`${kind}:${actor}:${x.media_type}:${x.media_id}`:`${kind}:${x.id||[actor,x.media_id,stamp(x),x.title,x.body].join(':')}`;
      const latest=merged.get(key);
      if(!latest){merged.set(key,x);continue}
      for(const field of ['title','cover','banner','avatar_url'])if(!latest[field]&&x[field])latest[field]=x[field];
      latest.media={...x.media,...latest.media};
    }
    return [...merged.values()];
  }

  const ownerId=user=>typeof user?.id==='string'&&user.id.trim()?user.id.trim():Number.isSafeInteger(user?.id)&&user.id>0?String(user.id):'';
  const scopedKey=()=>owner?`${KEY}:owner:${encodeURIComponent(owner)}`:'';
  function notify(){dispatchEvent(new CustomEvent('aninexus:community-activity-changed',{detail:{items:local()}}))}
  function confirm(user,confirmed=true){
    const next=confirmed?ownerId(user):'';
    const changed=!identityKnown||owner!==next;
    if(changed||!confirmed)identityEpoch++;
    identityKnown=confirmed;identityBlocked=!confirmed;identityUser=confirmed&&next?user:null;owner=next;identityPromise=null;
    if(changed||!confirmed)notify();
  }
  async function identity(){
    if(window.AniNexusAuth?.enabled!==true||identityBlocked)return null;
    if(!identityKnown&&!identityPromise){
      const version=identityEpoch;
      const pending=Promise.resolve().then(()=>window.AniNexusAccountData?.()).then(user=>{
        if(version!==identityEpoch)return;
        // AccountData returns the internal profile, never a Clerk fallback.
        const id=ownerId(user);
        if(id&&(expectedOwner===undefined||expectedOwner===id))confirm(user);
      }).catch(()=>{}).finally(()=>{if(identityPromise===pending)identityPromise=null});
      identityPromise=pending;
    }
    if(identityPromise)await identityPromise;
    if(!identityKnown||!identityUser)return null;
    const user=identityUser;
    return{id:owner,username:String(user.username||'').trim(),display_name:String(user.displayName||user.display_name||user.username||'').trim(),avatar_url:String(user.avatarUrl||user.avatar_url||'').trim()};
  }
  async function enrich(list){
    const version=identityEpoch;
    const user=await identity();
    return(Array.isArray(list)?list:[]).filter(item=>!item?.local||(version===identityEpoch&&owner&&item.owner_id===owner)).map(item=>{
      if(user&&item?.local&&item.owner_id===user.id)return{...item,username:user.username,display_name:user.display_name,avatar_url:item.avatar_url||item.avatarUrl||user.avatar_url};
      if(item?.local)return{...item,username:'',display_name:'Sua lista',avatar_url:''};
      return item
    })
  }

  function rows(){if(!owner||!identityKnown)return[];if(seedBatch)return seedBatch;const v=read(scopedKey(),[]);return Array.isArray(v)?v.filter(x=>x?.owner_id===owner):[]}
  function save(list){if(!owner||!identityKnown)return;const limited=list.filter(x=>x?.owner_id===owner).slice(0,MAX);if(seedBatch){seedBatch=limited;return}write(scopedKey(),limited);dispatchEvent(new CustomEvent('aninexus:community-activity-changed',{detail:{items:limited}}))}
  function domMeta(id,type){
    const action=document.querySelector(type==='MANGA'?`[data-manga-list="${id}"],[data-manga-fav="${id}"]`:`[data-nx-list="${id}"],[data-nx-fav="${id}"]`);
    const root=action?.closest('article')||document.querySelector(`.nx35-community-card[data-media-type="${type}"][data-media-id="${id}"]`);if(!root)return{};
    const img=root.querySelector('.nx35-community-cover>a>img,img');
    return{title:root.dataset?.title||root.querySelector('h3,h2,strong')?.textContent?.trim()||'',cover:img?.currentSrc||img?.src||''};
  }
  async function mediaSummaries(values,type='ANIME'){
    const ids=[...new Set((Array.isArray(values)?values:[]).map(validId).filter(Boolean))].slice(0,60);
    if(!ids.length)return[];
    type=mediaType({media_type:type});
    try{
      let items=[];
      const auth=window.AniNexusAuth;
      if(auth?.enabled===true||!location.hostname.endsWith('github.io')){
        const path=`/api/media/summaries?ids=${encodeURIComponent(ids.join(','))}&mediaType=${type}`;
        if(auth?.enabled===true)items=(await auth.publicApi(path))?.items||[];
        else{
          const response=await fetch(path,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(8000),headers:{accept:'application/json'}});
          if(!response.ok)return[];
          items=(await response.json())?.items||[];
        }
      }else{
        // A static Pages preview has no internal catalog. Only direct provider
        // identifiers fit GraphQL Int; internal identities stay unresolved.
        const externalIds=ids.filter(id=>id<=2147483647);
        if(!externalIds.length)return[];
        const query=`query($ids:[Int]){Page(page:1,perPage:60){media(id_in:$ids,type:${type},isAdult:false){id type title{romaji english native userPreferred}coverImage{extraLarge large}bannerImage}}}`;
        const response=await fetch(API,{method:'POST',signal:AbortSignal.timeout(8000),headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({query,variables:{ids:externalIds}})});
        if(!response.ok)return[];
        items=(await response.json())?.data?.Page?.media||[];
      }
      const requested=new Set(ids),found=new Map();
      for(const item of Array.isArray(items)?items:[]){
        const id=validId(item?.id),declared=String(item?.mediaType||item?.type||'').toUpperCase();
        if(requested.has(id)&&declared===type)found.set(id,item);
      }
      return ids.map(id=>found.get(id)).filter(Boolean);
    }catch{return[]}
  }
  async function anilistMeta(id,type){
    const [m]=await mediaSummaries([id],type);
    return m?{title:titleFrom(m),cover:coverFrom(m),banner:m.banner||m.bannerImage||''}:{};
  }
  function updateMeta(activityId,meta){if(!meta?.title&&!meta?.cover&&!meta?.banner)return;const list=rows(),i=list.findIndex(x=>x.id===activityId);if(i<0)return;list[i]={...list[i],title:list[i].title||meta.title||'',cover:list[i].cover||meta.cover||'',banner:list[i].banner||meta.banner||''};save(list)}

  function record(id,state,createdAt=Date.now(),seed=false,type='ANIME'){
    id=validId(id);if(!id||!state?.status||!owner||!identityKnown)return null;
    type=mediaType({media_type:type});
    const meta=domMeta(id,type),stamp=Number(createdAt)||Date.now(),list=rows();
    const reactions=[...new Set((Array.isArray(state.reactions)?state.reactions:[state.reaction]).filter(Boolean).map(String))];
    const snapshot={kind:'state',owner_id:owner,media_id:id,media_type:type,username:'',display_name:'',avatar_url:'',status:String(state.status),progress:Math.max(0,Number(state.progress)||0),volume_progress:Math.max(0,Number(state.volumeProgress)||0),score:state.score==null?null:Number(state.score),reaction:reactions[0]||'',reactions,created_at:new Date(stamp).toISOString(),title:meta.title||'',cover:meta.cover||'',banner:'',local:true};
    const duplicate=list.find(x=>x.media_id===id&&mediaType(x)===type&&x.status===snapshot.status&&x.progress===snapshot.progress&&(x.volume_progress||0)===snapshot.volume_progress&&x.score===snapshot.score&&JSON.stringify(x.reactions||[x.reaction].filter(Boolean))===JSON.stringify(reactions)&&Math.abs(Date.parse(x.created_at)-stamp)<1800);
    if(duplicate)return duplicate;
    if(seed&&list.some(x=>x.media_id===id&&mediaType(x)===type&&Date.parse(x.created_at)>=stamp-1000))return null;
    snapshot.id=`state:${type}:${id}:${stamp}:${Math.random().toString(36).slice(2,7)}`;
    list.unshift(snapshot);save(list);
    // Bootstrap is a local snapshot, not a user action. Visible feeds hydrate
    // their missing metadata in batches; fetching the entire library here
    // caused hundreds of detail requests on every authenticated page load.
    if(!seed&&(!snapshot.title||!snapshot.cover)){
      const version=identityEpoch,recordOwner=owner;
      anilistMeta(id,type).then(m=>{if(version===identityEpoch&&recordOwner===owner)updateMeta(snapshot.id,m)});
    }
    return snapshot;
  }

  function seed(){
    if(!owner||!identityKnown)return;
    const candidates=[],now=Date.now();
    for(const [key,type] of [['aninexus:mediaState:v2','ANIME'],['aninexus:mangaState:v2','MANGA']]){
      if(window.AniNexusAuth?.enabled===true&&String(read(type==='MANGA'?'aninexus:mangaOwner':'aninexus:mediaOwner','')||'')!==owner)continue;
      const states=read(key,{});if(!states||typeof states!=='object')continue;
      for(const [raw,state] of Object.entries(states)){
        const id=validId(raw);if(id&&state?.status)candidates.push({id,state,type,at:Number(state.updatedAt)||now});
      }
    }
    const before=rows();seedBatch=[...before];
    try{
      // Insert oldest first so the bounded store keeps the newest snapshots.
      for(const item of candidates.sort((a,b)=>b.at-a.at).slice(0,MAX).reverse())record(item.id,item.state,item.at,true,item.type);
      const next=seedBatch;seedBatch=null;
      if(JSON.stringify(next)!==JSON.stringify(before))save(next);
    }finally{seedBatch=null}
  }
  function local(limit=30){return rows().filter(x=>x?.kind==='state'&&x?.status).sort((a,b)=>Date.parse(b.created_at||0)-Date.parse(a.created_at||0)).slice(0,Math.max(1,Math.min(80,Number(limit)||30)))}

  document.addEventListener('aninexus:media-state-changed',e=>{const id=validId(e.detail?.id),s=e.detail?.state;if(id&&s?.status)record(id,s,Number(s.updatedAt)||Date.now())});
  document.addEventListener('aninexus:manga-media-state-changed',e=>{const id=validId(e.detail?.id),s=e.detail?.state;if(id&&s?.status)record(id,s,Number(s.updatedAt)||Date.now(),false,'MANGA')});
  addEventListener('storage',e=>{
    if(e.key===scopedKey())notify();
    if(window.AniNexusAuth?.enabled===true&&owner&&['aninexus:mediaOwner','aninexus:mangaOwner'].includes(e.key)&&String(read(e.key,'')||'')!==owner)confirm(null,false);
  });
  addEventListener('aninexus:account-identity-changed',event=>{if(!event.detail||!Object.prototype.hasOwnProperty.call(event.detail,'user'))return;if(event.detail.confirmed!==false)expectedOwner=ownerId(event.detail.user);confirm(event.detail.user,event.detail.confirmed!==false);if(identityKnown)seed()});
  document.addEventListener('aninexus:media-sync-read-identity',event=>{
    if(event.detail?.suspended){confirm(null,false);return}
    if(event.detail?.reset&&owner&&window.AniNexusAuth?.enabled===true){
      const anime=String(read('aninexus:mediaOwner','')||''),manga=String(read('aninexus:mangaOwner','')||'');
      if(anime!==owner||manga!==owner)confirm(null,false);
    }
  });
  document.addEventListener('aninexus:media-sync-read-status',event=>{
    const detail=event.detail;if(detail?.mediaType!=='ACCOUNT'||detail.resource!=='identity'||detail.ok!==true)return;
    expectedOwner=ownerId({id:detail.owner});
    if(!expectedOwner){confirm(null);return}
    if(owner!==expectedOwner||!identityKnown){confirm(null,false);identityBlocked=false;identity().then(seed)}
  });
  const bootstrap=()=>{if(window.AniNexusAuth?.enabled===true)identity().then(seed);else seed()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootstrap,{once:true});else bootstrap();

  window.AniNexusCommunityActivity={local,record,seed,identity,enrich,merge,mediaSummaries,get key(){return scopedKey()}};
})();
