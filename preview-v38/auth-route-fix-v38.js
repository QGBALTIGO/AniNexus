'use strict';
(() => {
  if(window.__NX38_AUTH_ROUTE_FIX__)return;window.__NX38_AUTH_ROUTE_FIX__=true;
  const nativeReplace=history.replaceState.bind(history);
  const isAuthRoute=()=>{try{const u=new URL(location.href),isPages=location.hostname.endsWith('github.io');let p=u.searchParams.get('p')||u.pathname;if(isPages&&!u.searchParams.get('p'))p=p.replace(/^\/AniNexus/,'')||'/';p=String(p||'/').split('?')[0].replace(/\/+$/,'')||'/';return ['/login','/criar-conta','/minha-conta'].includes(p)}catch{return false}};
  history.replaceState=function(state,title,url){
    const before=location.href,result=nativeReplace(state,title,url);
    // Auth renderer intentionally uses replaceState only when session state means
    // the requested auth route is invalid. Reload once after its render lock exits.
    if(before!==location.href&&isAuthRoute()&&document.body?.classList.contains('nx38-auth-active')){
      setTimeout(()=>location.replace(location.href),0);
    }
    return result;
  };
})();
