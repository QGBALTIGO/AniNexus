'use strict';
(() => {
  if(window.__NX38_RUNTIME__)return;window.__NX38_RUNTIME__=true;
  window.__NX38_BOOT_AT=performance.now();
  const IS_PAGES=location.hostname.endsWith('github.io');
  const ANILIST='https://graphql.anilist.co';
  const nativeFetch=window.fetch.bind(window);

  // Production uses shared AniNexus read models (edge cache + Redis + stale fallback)
  // instead of repeating identical AniList GraphQL requests in every browser.
  if(!IS_PAGES){
    const toGraph=m=>{
      if(!m)return m;
      if(m.coverImage&&typeof m.title==='object')return m;
      const n=Number(m.score),mean=Number(m.meanScore),averageScore=Number.isFinite(n)?Math.round(n*10):(m.averageScore||null),meanScore=Number.isFinite(mean)?Math.round(mean*10):(m.meanScore||averageScore);
      return{
        id:m.id,idMal:m.idMal||null,
        title:{english:m.title||'',romaji:m.titleRomaji||m.title||'',native:m.titleNative||'',userPreferred:m.title||m.titleRomaji||''},synonyms:m.synonyms||[],
        coverImage:{extraLarge:m.cover||'',large:m.cover||'',color:m.coverColor||null},bannerImage:m.banner||'',description:m.description||'',genres:m.genres||[],
        tags:(m.tagDetails||m.tags||[]).map(x=>typeof x==='string'?{name:x,rank:0,isMediaSpoiler:false}:x),averageScore,meanScore,popularity:m.popularity||0,favourites:m.favourites||0,
        episodes:m.episodes||null,chapters:m.chapters||null,volumes:m.volumes||null,duration:m.duration||null,format:m.format||'',status:m.status||'',season:m.season||'',seasonYear:m.seasonYear||null,countryOfOrigin:m.country||'',source:m.source||'',startDate:m.startDate||null,endDate:m.endDate||null,
        studios:{nodes:m.studios||[]},nextAiringEpisode:m.nextAiringEpisode||null,trailer:m.trailer||null,
        externalLinks:(m.streaming||m.externalLinks||[]).map(x=>({site:x.site||'',url:x.url||'',type:x.type||'STREAMING',icon:x.icon||'',color:x.color||''}))
      };
    };
    const person=(x,staff=false)=>({role:x.role||'',node:{id:x.id,name:{full:x.name||'',native:x.native||''},image:{large:x.image||'',medium:x.image||''}},...(staff?{}:{})});
    const toDeep=m=>{const base=toGraph(m);return{...base,characters:{edges:(m.characters||[]).map(x=>person(x))},staff:{edges:(m.staff||[]).map(x=>person(x,true))},relations:{edges:(m.relations||[]).map(x=>({relationType:x.relationType,node:toGraph(x.media)}))},recommendations:{nodes:(m.recommendations||[]).map(x=>({rating:x.rating,mediaRecommendation:toGraph(x.media)})).filter(x=>x.mediaRecommendation)}}};
    const jsonResponse=data=>new Response(JSON.stringify({data}),{status:200,headers:{'content-type':'application/json; charset=utf-8','x-aninexus-bridge':'v38'}});
    const apiJson=async(path,signal)=>{const r=await nativeFetch(path,{signal,credentials:'same-origin',headers:{accept:'application/json'}});if(!r.ok)throw new Error(`AniNexus API ${r.status}`);return r.json()};
    const seasonNow=()=>{const d=new Date(),m=Number(new Intl.DateTimeFormat('en',{timeZone:'America/Sao_Paulo',month:'numeric'}).format(d)),year=Number(new Intl.DateTimeFormat('en',{timeZone:'America/Sao_Paulo',year:'numeric'}).format(d));return{year,season:m<=3?'WINTER':m<=6?'SPRING':m<=9?'SUMMER':'FALL'}};
    const bridgeHome=async(body,signal)=>{
      const vars=body.variables||{},s=seasonNow(),season=vars.season||s.season,year=Number(vars.year||s.year),now=Math.floor(Date.now()/1000),end=now+7*86400;
      const [seasonData,schedule,top,popular,reading,soon]=await Promise.all([
        apiJson(`/api/catalog?page=1&perPage=22&season=${encodeURIComponent(season)}&year=${year}&sort=POPULAR`,signal),
        apiJson(`/api/schedule?start=${now}&end=${end}`,signal),
        apiJson('/api/catalog?page=1&perPage=10&sort=SCORE',signal),
        apiJson('/api/catalog?page=1&perPage=22&sort=POPULAR',signal),
        apiJson('/api/reading?page=1&perPage=18&sort=POPULAR',signal),
        apiJson('/api/catalog?page=1&perPage=22&status=NOT_YET_RELEASED&sort=POPULAR',signal)
      ]);
      return jsonResponse({season:{media:(seasonData.items||[]).map(toGraph)},schedule:{airingSchedules:(schedule||[]).slice(0,8).map(x=>({airingAt:x.airingAt,episode:x.episode,media:toGraph(x.media)}))},top:{media:(top.items||[]).map(toGraph)},popular:{media:(popular.items||[]).map(toGraph)},soon:{media:(soon.items||[]).map(toGraph)},reading:{media:(reading.items||[]).map(toGraph)}});
    };
    const mapSort=q=>q.includes('SCORE_DESC')?'SCORE':q.includes('FAVOURITES_DESC')?'FAVOURITES':q.includes('SEARCH_MATCH')?'MATCH':q.includes('TRENDING_DESC')?'TRENDING':q.includes('START_DATE_DESC')?'NEW':q.includes('TITLE_ROMAJI')?'TITLE':'POPULAR';
    const bridgePage=async(body,signal,type)=>{
      const q=String(body.query||''),v=body.variables||{},params=new URLSearchParams({page:String(v.page||1),perPage:String(v.perPage||24),sort:mapSort(q)});
      for(const k of ['search','genre','format','season','year'])if(v[k]!=null&&v[k]!=='')params.set(k,String(v[k]));
      if(q.includes('status:NOT_YET_RELEASED'))params.set('status','NOT_YET_RELEASED');
      const endpoint=type==='MANGA'?'/api/reading':'/api/catalog',data=await apiJson(`${endpoint}?${params}`,signal);
      return jsonResponse({Page:{pageInfo:data.pageInfo||{},media:(data.items||[]).map(toGraph)}});
    };
    const bridgeDetail=async(body,signal,type)=>{
      const id=Number(body.variables?.id||0);if(!Number.isSafeInteger(id)||id<=0)return null;
      const m=await apiJson(type==='MANGA'?`/api/manga/${id}`:`/api/anime/${id}`,signal),deep=toDeep(m),q=String(body.query||'');
      if(type==='ANIME'&&q.includes('characters('))return jsonResponse({Media:{characters:deep.characters,staff:deep.staff,relations:deep.relations,recommendations:deep.recommendations}});
      if(type==='MANGA'&&q.includes('relations{'))return jsonResponse({Media:deep});
      return jsonResponse({Media:deep});
    };
    window.fetch=async function(input,init={}){
      const target=typeof input==='string'?input:input?.url||String(input||''),method=String(init.method||input?.method||'GET').toUpperCase();
      if(target===ANILIST&&method==='POST'&&typeof init.body==='string'){
        let body;try{body=JSON.parse(init.body)}catch{return nativeFetch(input,init)}
        const q=String(body?.query||'');
        try{
          if(q.includes('season:Page')&&q.includes('schedule:Page')&&q.includes('reading:Page'))return await bridgeHome(body,init.signal);
          if(q.includes('Media(id:$id,type:ANIME)'){const r=await bridgeDetail(body,init.signal,'ANIME');if(r)return r}
          if(q.includes('Media(id:$id,type:MANGA)'){const r=await bridgeDetail(body,init.signal,'MANGA');if(r)return r}
          if(q.includes('Page(page:$page,perPage:$perPage)')&&q.includes('media(type:ANIME')&&!q.includes('airingSchedules'))return await bridgePage(body,init.signal,'ANIME');
          if(q.includes('Page(page:$page,perPage:$perPage)')&&q.includes('media(type:MANGA'))return await bridgePage(body,init.signal,'MANGA');
        }catch(err){console.warn('[AniNexus bridge] fallback to upstream:',err?.message||err)}
      }
      return nativeFetch(input,init);
    };
  }

  // The old PWA shell predates the current multi-route runtime and can replay stale UI.
  if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(rs=>Promise.allSettled(rs.map(r=>r.unregister()))).catch(()=>{})}
  if('caches' in window){caches.keys().then(keys=>Promise.allSettled(keys.filter(k=>/^aninexus-shell-/i.test(k)).map(k=>caches.delete(k)))).catch(()=>{})}

  // Handle broken media before legacy per-image handlers replace large art with a stretched logo.
  document.addEventListener('error',e=>{
    const img=e.target;if(!(img instanceof HTMLImageElement)||img.dataset.nx38Broken)return;
    img.dataset.nx38Broken='1';e.stopImmediatePropagation();img.classList.add('nx38-img-error');
    img.closest('.nx35-nmedia,.nx37-gallery-item,.nx24-card-poster,.aqx-media,.nx18-cover,.nx35-community-cover,.media,.poster,.nx21-poster,.nx22-cover,.nx22-hero-bg')?.classList.add('nx38-media-fallback');
  },true);

  // Canonical action artwork. Legacy renderers may draw their own plus/heart,
  // but V38 normalizes them before the unified media-state layer takes over.
  const LIST_ACTION='button[data-list],button[data-nx-list],button[data-nx-detail-list],button[data-nx18-status],button[data-nx17-list]';
  const FAV_ACTION='button[data-fav],button[data-nx-fav],button[data-nx-detail-fav],button[data-nx18-fav],button[data-nx17-fav]';
  const ACTION_SELECTOR=`${LIST_ACTION},${FAV_ACTION}`;
  const PLUS_ICON='<svg class="nx38-action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5.25v13.5M5.25 12h13.5"/></svg>';
  const HEART_ICON='<svg class="nx38-action-icon nx38-heart-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z"/></svg>';
  const standardizeAction=button=>{
    if(!(button instanceof HTMLButtonElement)||!button.matches(ACTION_SELECTOR))return;
    const favorite=button.matches(FAV_ACTION),current=button.querySelector(':scope > svg');
    if(favorite){
      if(!current?.classList.contains('nx38-heart-icon')){current?.remove();button.insertAdjacentHTML('afterbegin',HEART_ICON)}
      button.dataset.nx38Action='favorite';
      return;
    }
    button.dataset.nx38Action='list';
    if(!button.classList.contains('active')&&!button.dataset.nxUnifiedStatus&&!current?.classList.contains('nx38-action-icon')){current?.remove();button.insertAdjacentHTML('afterbegin',PLUS_ICON)}
  };

  const tune=root=>{
    if(root instanceof HTMLImageElement){if(!root.hasAttribute('decoding'))root.decoding='async';if(!root.hasAttribute('loading')&&!root.closest('.hero,.nx35-article-hero,.nx24-hero,.aqx-hero,.nx22-hero'))root.loading='lazy'}
    if(root instanceof SVGElement)standardizeAction(root.closest('button'));
    if(root instanceof HTMLButtonElement)standardizeAction(root);
    root.querySelectorAll?.('img').forEach(img=>{if(!img.hasAttribute('decoding'))img.decoding='async';if(!img.hasAttribute('loading')&&!img.closest('.hero,.nx35-article-hero,.nx24-hero,.aqx-hero,.nx22-hero'))img.loading='lazy'});
    root.querySelectorAll?.(ACTION_SELECTOR).forEach(standardizeAction);
    root.querySelectorAll?.('a[target="_blank"]').forEach(a=>{const rel=new Set(String(a.rel||'').split(/\s+/).filter(Boolean));rel.add('noopener');rel.add('noreferrer');a.rel=[...rel].join(' ')})
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>tune(document),{once:true});else tune(document);
  new MutationObserver(rs=>{for(const r of rs)for(const n of r.addedNodes)if(n.nodeType===1)tune(n)}).observe(document.documentElement,{subtree:true,childList:true});

  const setOnline=()=>document.documentElement.classList.toggle('nx38-offline',!navigator.onLine);
  addEventListener('online',setOnline);addEventListener('offline',setOnline);setOnline();
  if(navigator.connection?.saveData)document.documentElement.classList.add('nx38-save-data');
})();