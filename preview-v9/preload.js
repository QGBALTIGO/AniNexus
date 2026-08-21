'use strict';
(() => {
  if(!location.hostname.endsWith('github.io')) return;
  const ENDPOINT='https://graphql.anilist.co';
  const nativeFetch=window.fetch.bind(window);
  const pending=new Map();
  const PAGE_TTL=10*60*1000;
  const fields=`id title{romaji english native userPreferred} coverImage{extraLarge large color} averageScore format status genres tags{name rank} startDate{year month day} relations{edges{relationType}}`;
  const query=`query($page:Int,$year:Int,$season:MediaSeason){Page(page:$page,perPage:50){pageInfo{hasNextPage total}media(type:ANIME,isAdult:false,seasonYear:$year,season:$season,sort:[POPULARITY_DESC]){${fields}}}}`;
  const seasons={inverno:'WINTER',primavera:'SPRING',verao:'SUMMER',outono:'FALL'};

  function selection(){
    let p=location.pathname.replace(/^\/AniNexus/,'')||'/';
    const m=p.match(/^\/animes\/temporadas\/(\d{4})\/(inverno|primavera|verao|outono)\/?$/);
    if(m)return{year:Number(m[1]),season:seasons[m[2]]};
    if(!/^\/animes\/temporadas\/?$/.test(p))return null;
    const now=new Date(),month=Number(new Intl.DateTimeFormat('en',{timeZone:'America/Sao_Paulo',month:'numeric'}).format(now)),year=Number(new Intl.DateTimeFormat('en',{timeZone:'America/Sao_Paulo',year:'numeric'}).format(now));
    return{year,season:month<=3?'WINTER':month<=6?'SPRING':month<=9?'SUMMER':'FALL'};
  }
  const sel=selection(); if(!sel)return;
  const key=(page,year=sel.year,season=sel.season)=>`nx:v9:gql:${year}:${season}:${page}`;
  const read=(k)=>{try{const x=JSON.parse(sessionStorage.getItem(k)||'null');return x&&Date.now()-x.t<PAGE_TTL&&typeof x.text==='string'?x.text:null}catch{return null}};
  const write=(k,text)=>{try{sessionStorage.setItem(k,JSON.stringify({t:Date.now(),text}))}catch{}};

  function fetchPage(page,year=sel.year,season=sel.season){
    const k=key(page,year,season),cached=read(k);if(cached)return Promise.resolve(cached);
    if(pending.has(k))return pending.get(k);
    const p=nativeFetch(ENDPOINT,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({query,variables:{page,year,season}})})
      .then(async r=>{const text=await r.text();if(!r.ok)throw new Error('HTTP '+r.status);write(k,text);return text})
      .finally(()=>pending.delete(k));
    pending.set(k,p);return p;
  }

  // Reuse the prefetch when the season renderer asks for the exact same page.
  window.fetch=async function(input,init){
    try{
      const url=typeof input==='string'?input:input?.url;
      if(url===ENDPOINT && String(init?.method||'GET').toUpperCase()==='POST' && typeof init?.body==='string'){
        const body=JSON.parse(init.body),v=body?.variables||{},q=String(body?.query||'');
        if(Number.isInteger(Number(v.page))&&Number.isInteger(Number(v.year))&&v.season&&q.includes('seasonYear:$year')&&q.includes('relations{edges{relationType}}')){
          if(init?.signal?.aborted)throw new DOMException('Aborted','AbortError');
          const text=await fetchPage(Number(v.page),Number(v.year),String(v.season));
          if(init?.signal?.aborted)throw new DOMException('Aborted','AbortError');
          return new Response(text,{status:200,headers:{'content-type':'application/json','x-aninexus-cache':'prefetch'}});
        }
      }
    }catch(err){if(err?.name==='AbortError')throw err;}
    return nativeFetch(input,init);
  };

  // Start before the season renderer. Page two is prefetched only on normal connections.
  const saveData=navigator.connection?.saveData||/2g/.test(navigator.connection?.effectiveType||'');
  const p1=fetchPage(1);
  const p2=saveData?Promise.resolve(null):new Promise(resolve=>setTimeout(()=>resolve(fetchPage(2)),70)).then(x=>x);
  Promise.allSettled([p1,p2]).then(results=>{
    try{
      const j1=results[0].status==='fulfilled'?JSON.parse(results[0].value):null;
      const j2=results[1].status==='fulfilled'&&results[1].value?JSON.parse(results[1].value):null;
      const a1=j1?.data?.Page?.media||[],a2=j2?.data?.Page?.media||[];
      const firstHasNext=!!j1?.data?.Page?.pageInfo?.hasNextPage;
      const secondHasNext=!!j2?.data?.Page?.pageInfo?.hasNextPage;
      if(!j1)return;
      if(firstHasNext&&!j2)return;
      if(firstHasNext&&secondHasNext)return;
      const items=[...new Map([...a1,...a2].filter(x=>x?.id).map(x=>[x.id,x])).values()];
      const data={items,apiTotal:Number(j1?.data?.Page?.pageInfo?.total||items.length),hash:items.map(x=>`${x.id}:${x.averageScore||0}:${x.status||''}`).join('|')};
      localStorage.setItem(`nx:v8:season:${sel.year}:${sel.season}`,JSON.stringify({savedAt:Date.now(),data}));
    }catch{}
  });
})();
