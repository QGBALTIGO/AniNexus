'use strict';
(() => {
  const D=window.NX35NewsData;if(!D||window.__NX37_HOT__)return;window.__NX37_HOT__=true;
  const original=D.loadFeed.bind(D),BASE=D.BASE||'',BUILD='37.0.2';
  const slug=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,90);
  const key=x=>{try{const u=new URL(x.sourceUrl||x.url||'');return`url:${u.hostname.toLowerCase()}${u.pathname.replace(/\/+$/,'').toLowerCase()}`}catch{return`title:${slug(x.title)}`}};
  const score=x=>Number(x.wordCount||0)+Number(x.coverage?.facts||0)*24+Number(x.coverage?.sections||0)*35+Number(x.coverage?.mediaCount||x.mediaGallery?.length||0)*80;
  function merge(a,b){if(!a)return b;if(!b)return a;const base=score(b)>=score(a)?b:a,other=base===b?a:b;return{...other,...base,image:base.image||other.image||'',mediaGallery:base.mediaGallery?.length?base.mediaGallery:other.mediaGallery||[],mediaEmbeds:base.mediaEmbeds?.length?base.mediaEmbeds:other.mediaEmbeds||[],facts:(base.facts?.length||0)>=(other.facts?.length||0)?base.facts:other.facts,sections:(base.sections?.length||0)>=(other.sections?.length||0)?base.sections:other.sections}}
  async function hot(){try{const {response:r,body:j}=await window.AniNexusRuntime.jsonRequest(`${BASE}/data/news-v37-hot.json?v=${BUILD}`,{cache:'no-store'},{timeout:5500});if(!r.ok)return[];return(j?.items||[]).map(D.normalize).filter(D.likelyPt)}catch{return[]}}
  async function images(items){const miss=items.filter(x=>!x.image).slice(0,14);if(!miss.length)return;const q=miss.map((x,i)=>`m${i}:Media(search:${JSON.stringify(String(x.mediaQuery||x.title).split(/[:|–—-]/)[0].slice(0,80))},type:${x.eventType==='MANGA'?'MANGA':'ANIME'}){bannerImage coverImage{extraLarge large}}`).join(' ');try{const {response:r,body:j}=await window.AniNexusRuntime.jsonRequest('https://graphql.anilist.co',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:`query{${q}}`})},{timeout:4500});if(!r.ok)return;miss.forEach((x,i)=>{const m=j?.data?.[`m${i}`],url=m?.bannerImage||m?.coverImage?.extraLarge||m?.coverImage?.large||'';if(url)x.image=url})}catch{}}
  let generation=0;
  D.loadFeed=async(force=false,onUpdate=null)=>{
    const current=++generation,map=new Map();
    const publish=items=>{
      if(!items?.length)throw new Error('empty news source');
      if(current!==generation)return D.feed;
      for(const item of items)map.set(key(item),merge(map.get(key(item)),item));
      const out=[...map.values()].sort((a,b)=>new Date(b.publishedAt||0)-new Date(a.publishedAt||0)||score(b)-score(a));
      D.feed=out;onUpdate?.(out);return out;
    };
    const workers=[original(force,publish).then(publish),hot().then(publish)];
    void Promise.allSettled(workers);
    try{await Promise.any(workers)}catch{}
    const out=D.feed;
    // Artwork enrichment must never block an already readable article/feed.
    void images(out).then(()=>{if(current===generation)onUpdate?.(D.feed)});
    return out;
  };
})();
