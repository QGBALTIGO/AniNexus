'use strict';
(() => {
  const KEY='aninexus:mediaState:v1';
  try{
    const data=JSON.parse(localStorage.getItem(KEY)||'{}');
    if(!data||typeof data!=='object')return;
    let changed=false;
    for(const [id,s] of Object.entries(data)){
      if(!s||typeof s!=='object')continue;
      const n={...s};
      n.progress=Math.max(0,Number(n.progress)||0);
      if(n.status==='PLANNING'){
        if(n.progress!==0){n.progress=0;changed=true}
        if(n.score!=null){n.score=null;changed=true}
      }
      if(['CURRENT','PAUSED','DROPPED'].includes(n.status)&&n.progress===0&&n.score!=null){n.score=null;changed=true}
      if(n.status==='COMPLETED'&&Number.isFinite(Number(n.totalEpisodes))&&Number(n.totalEpisodes)>0&&n.progress!==Number(n.totalEpisodes)){n.progress=Number(n.totalEpisodes);changed=true}
      data[id]=n;
    }
    if(changed)localStorage.setItem(KEY,JSON.stringify(data));
  }catch{}
})();
