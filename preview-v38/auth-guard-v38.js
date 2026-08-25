'use strict';
(() => {
  try{
    const isPages=location.hostname.endsWith('github.io');
    const authPath=()=>{const u=new URL(location.href);let p=u.searchParams.get('p')||u.pathname;if(isPages&&!u.searchParams.get('p'))p=p.replace(/^\/AniNexus/,'')||'/';return String(p||'/').split('?')[0].replace(/\/+$/,'')||'/'};
    const routes=['/login','/criar-conta','/minha-conta'];
    if(!routes.includes(authPath()))return;

    document.documentElement.classList.add('nx38-auth-boot');
    const style=document.createElement('style');
    style.dataset.nx38AuthBoot='1';
    style.textContent='html.nx38-auth-boot #app{min-height:72vh;opacity:0}html.nx38-auth-ready #app{opacity:1;transition:opacity .16s ease}';
    document.head.append(style);
    const ready=()=>{document.documentElement.classList.remove('nx38-auth-boot');document.documentElement.classList.add('nx38-auth-ready');style.remove()};
    addEventListener('aninexus:auth-v38-ready',ready,{once:true});
    setTimeout(ready,3500);
  }catch{}
})();
