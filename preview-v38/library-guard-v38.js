'use strict';
(() => {
  try{
    const u=new URL(location.href),isPages=location.hostname.endsWith('github.io');
    let p=u.searchParams.get('p')||u.pathname;
    if(isPages&&!u.searchParams.get('p'))p=p.replace(/^\/AniNexus/,'')||'/';
    p=String(p||'/').split('?')[0].replace(/\/+$/,'')||'/';
    if(p!=='/meus-animes')return;
    document.documentElement.classList.add('nx38-library-boot');
    setTimeout(()=>document.documentElement.classList.remove('nx38-library-boot'),5000);
  }catch{}
})();
