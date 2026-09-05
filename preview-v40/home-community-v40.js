'use strict';
(() => {
  if(window.__NX40_HOME_COMMUNITY__)return;window.__NX40_HOME_COMMUNITY__=true;
  const IS_PAGES=location.hostname.endsWith('github.io');
  const REMOTE=window.AniNexusAuth?.enabled===true;
  const API='https://graphql.anilist.co';
  const STATUS={PLANNING:{verb:'quer ver',label:'Quero ver',icon:'clock'},CURRENT:{verb:'está assistindo',label:'Assistindo',icon:'play'},COMPLETED:{verb:'terminou',label:'Concluído',icon:'check'},PAUSED:{verb:'pausou',label:'Pausado',icon:'pause'},DROPPED:{verb:'desistiu de',label:'Interrompido',icon:'x'}};
  const mediaCache=new Map();
  let token=0,timer=0;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const title=m=>typeof m?.title==='string'?m.title:(m?.title?.english||m?.title?.userPreferred||m?.title?.romaji||m?.title?.native||'');
  const cover=m=>m?.cover||m?.coverImage?.extraLarge||m?.coverImage?.large||'';
  const type=x=>String(x.media_type||x.mediaType||'').toUpperCase()==='MANGA'?'MANGA':'ANIME';
  const mediaKey=x=>`${type(x)}:${Number(x.media_id||x.id)}`;
  const usableTitle=value=>{const result=String(value||'').trim();return result&&!/^(?:(?:anime|mang[áa])\s*\d+|título (?:temporariamente )?indisponível|undefined|null|nan)$/i.test(result)?result:''};
  const actor=x=>String(x?.display_name||x?.displayName||x?.username||'membro').trim()||'membro';
  const handle=x=>/^(?:voc[eê]|you)$/i.test(String(x?.username||'').trim())?'':String(x?.username||'').trim();
  const pageUrl=path=>IS_PAGES?`/AniNexus/?p=${encodeURIComponent(path)}`:path;
  const mediaUrl=x=>{const slug=String(x.title).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,90)||'obra';return pageUrl(`/${type(x)==='MANGA'?'manga':'anime'}/${slug}-${Number(x.media_id)}`)};
  const relative=v=>{const t=Date.parse(v||'');if(!Number.isFinite(t))return'';const d=Math.max(0,Date.now()-t);if(d<60000)return'agora';if(d<3600000)return`há ${Math.max(1,Math.floor(d/60000))}min`;if(d<86400000)return`há ${Math.floor(d/3600000)}h`;return`há ${Math.floor(d/86400000)}d`};
  async function json(path){try{if(REMOTE){const j=await window.AniNexusAuth.publicApi(path);return j?.items||[]}const r=await fetch(path,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});if(!r.ok)return[];const j=await r.json();return j?.items||[]}catch{return[]}}
  async function resolveMedia(rows){
    for(const mediaType of ['ANIME','MANGA']){
      const ids=[...new Set(rows.filter(x=>type(x)===mediaType&&!mediaCache.has(mediaKey(x))).map(x=>Number(x.media_id)).filter(Boolean))].slice(0,20);
      if(!ids.length)continue;
      try{
        const query=`query($ids:[Int]){Page(page:1,perPage:20){media(id_in:$ids,type:${mediaType}){id title{romaji english native userPreferred}coverImage{extraLarge large}}}}`;
        const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({query,variables:{ids}})});
        if(r.ok)for(const m of (await r.json())?.data?.Page?.media||[])mediaCache.set(`${mediaType}:${Number(m.id)}`,m);
      }catch{}
    }
  }
  function reactionMarks(x){
    const choices=(type(x)==='MANGA'?window.AniNexusMangaState:window.AniNexusMediaState)?.reactions?.()||[];
    const labels=[...new Set((Array.isArray(x.reactions)&&x.reactions.length?x.reactions:[x.reaction]).filter(Boolean).map(v=>({LOVE:'Amei',LIKE:'Curtindo',DISLIKE:'Esperava mais',WOW:'De arrepiar'})[v]||v))];
    return labels.slice(0,3).map(label=>{const mark=choices.find(r=>r.label===label);return mark?`<span class="nx35-community-reaction" title="${esc(label)}" aria-label="${esc(label)}">${esc(mark.emoji)}</span>`:''}).join('');
  }
  function card(x,compact=false){
    const name=actor(x),profileHandle=handle(x),profile=profileHandle?pageUrl(`/u/${encodeURIComponent(profileHandle)}`):'';
    const person=profile?`<a href="${profile}"><b>${esc(name)}</b></a>`:`<b>${esc(name)}</b>`;
    const kind=x.kind||'state',reading=type(x)==='MANGA',href=x.media_id?mediaUrl(x):pageUrl('/comunidade');
    const work=`<strong><a href="${href}">${esc(x.title)}</a></strong>`;
    const avatar=window.AniNexusAvatar?.markup(x,{name,decorative:true,loading:'lazy'})||`<img src="${IS_PAGES?'/AniNexus':''}/assets/avatars/mascot-pink.png" alt="">`;
    let st=STATUS[x.status]||{verb:'atualizou',label:'Lista',icon:'list'},phrase='',detail='';
    if(kind==='state'){
      if(reading&&x.status==='CURRENT')st={...st,verb:'está lendo',label:'Lendo'};
      if(reading&&x.status==='PLANNING')st={...st,verb:'quer ler',label:'Quero ler'};
      phrase=`${person} ${esc(st.verb)} ${work}`;
      detail=[x.progress?`${reading?'Cap.':'Episódio'} ${Number(x.progress)}`:'',reading&&x.volume_progress?`Vol. ${Number(x.volume_progress)}`:''].filter(Boolean).join(' · ');
    }else if(kind==='impression'){
      st={label:'Impressão',icon:'chat'};phrase=`${person} publicou uma impressão sobre ${work}`;
      detail=x.spoiler?'Spoiler oculto':String(x.body||'').slice(0,100);
    }else{
      st={label:'Discussão',icon:'chat'};phrase=`${person} abriu uma discussão ${work}`;
      detail=x.replies!=null?`${Number(x.replies)||0} respostas`:'';
    }
    const statusIcon=kind==='state'?(reading?window.AniNexusMangaState:window.AniNexusMediaState)?.statuses?.[x.status]?.icon:'';
    return `<article class="nx35-community-card${compact?' compact':''}" data-community-kind="${esc(kind)}" data-media-type="${type(x)}" data-status="${esc(x.status||kind)}"><div class="nx35-community-cover"><a href="${href}" aria-label="${esc(x.title)}">${x.cover?`<img src="${esc(x.cover)}" alt="" loading="lazy" decoding="async">`:'<span data-icon="chat" aria-hidden="true"></span>'}</a><i class="nx35-community-avatar" aria-hidden="true">${avatar}</i></div><div class="nx35-community-copy"><p>${phrase}</p><div class="nx35-community-meta"><span class="nx35-community-status">${statusIcon||`<span data-icon="chat" aria-hidden="true"></span>`}${esc(st.label)}</span>${detail?`<span class="nx35-community-detail">${esc(detail)}</span>`:''}</div><small>${reactionMarks(x)}<time datetime="${esc(x.created_at)}">${esc(relative(x.created_at))}</time></small></div></article>`;
  }
  async function load(){
    const shared=window.AniNexusCommunityActivity;
    const local=shared?.local?.(40)||[];
    let activity=[],impressions=[],threads=[];
    if(!IS_PAGES||REMOTE)[activity,impressions,threads]=await Promise.all([json('/api/community/activity?limit=30&includeManga=1'),json('/api/community/impressions?limit=8'),json('/api/community/threads?limit=8')]);
    const raw=[...activity.map(x=>({...x,kind:'state',created_at:x.created_at||x.updated_at})),...local,...impressions.map(x=>({...x,kind:'impression'})),...threads.map(x=>({...x,kind:'thread'}))];
    const enriched=shared?.enrich?await shared.enrich(raw):raw,rows=shared?.merge?shared.merge(enriched):enriched;
    await resolveMedia(rows.filter(x=>x.media_id&&(!usableTitle(x.title)&&!usableTitle(title(x.media))||!x.cover&&!cover(x.media))));
    return rows.map(x=>{const fetched=mediaCache.get(mediaKey(x));return {...x,title:usableTitle(x.title)||usableTitle(title(x.media))||usableTitle(title(fetched)),cover:x.cover||cover(x.media)||cover(fetched),created_at:x.created_at||x.updated_at||''}}).filter(x=>x.kind==='thread'?!!x.title:!!x.media_id&&!!x.title&&!!x.cover).slice(0,12);
  }
  async function paint(){
    const home=document.querySelector('.nx35-home'),hero=document.querySelector('#nx35CommunityHero'),grid=document.querySelector('#nx35Community');
    if(!home||(!hero&&!grid))return;
    const my=++token,list=await load();if(my!==token||!home.isConnected)return;
    const empty='<p class="nx35-community-empty">Nenhuma atividade recente.</p>';
    for(const [root,count,compact] of [[hero,3,true],[grid,6,false]])if(root?.isConnected){root.dataset.nxCommunityOwner='shared';root.innerHTML=list.length?list.slice(0,count).map(x=>card(x,compact)).join(''):empty;window.injectIcons?.(root)}
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(paint,60)}
  for(const event of ['aninexus:home-v34-ready','aninexus:community-activity-changed','aninexus:account-identity-changed'])addEventListener(event,schedule);
  for(const event of ['aninexus:media-state-changed','aninexus:manga-media-state-changed'])document.addEventListener(event,schedule);
  addEventListener('storage',e=>{if(/community:activity|mediaState|mangaState/.test(e.key||''))schedule()});
  new MutationObserver(rs=>{for(const r of rs)for(const n of r.addedNodes)if(n.nodeType===1&&(n.matches?.('.nx35-home')||n.querySelector?.('.nx35-home'))){schedule();return}}).observe(document.documentElement,{subtree:true,childList:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();
