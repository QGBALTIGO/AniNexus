'use strict';
(() => {
  try{
    if(window.__ANINEXUS_CONFIG__?.authEnabled===true)document.documentElement.dataset.nxAuthState='loading';
    const isPages=location.hostname.endsWith('github.io');
    const authPath=()=>{const u=new URL(location.href);let p=u.searchParams.get('p')||u.pathname;if(isPages&&!u.searchParams.get('p'))p=p.replace(/^\/AniNexus/,'')||'/';return String(p||'/').split('?')[0].replace(/\/+$/,'')||'/'};
    const path=authPath(),routes=['/login','/criar-conta','/minha-conta','/admin'];
    const profile=/^\/u\/[\p{L}\p{N}_.-]{3,30}$/u.test(path);
    if(!routes.includes(path)&&!profile)return;

    document.documentElement.classList.add('nx38-auth-boot');
    const style=document.createElement('style');
    style.dataset.nx38AuthBoot='1';
    style.textContent='html.nx38-auth-boot #app{min-height:72vh;opacity:0}html.nx38-auth-ready #app{opacity:1;transition:opacity .16s ease}';
    document.head.append(style);
    const app=document.querySelector('#app'),owner=profile?'profile':path==='/admin'?'admin':'auth';let settled=false,timer=0;
    const selector=profile?'.nx38p-page':path==='/admin'?'.nx38-admin-page':path==='/minha-conta'?'.nx38-account-page':'.nx38-auth-page';
    const correct=()=>!!app?.querySelector(`${selector},.nx-route-fail[data-route-owner="${owner}"]`);
    const observer=new MutationObserver(()=>ready());
    const ready=()=>{if(settled||!correct())return false;settled=true;observer.disconnect();if(timer)clearTimeout(timer);document.documentElement.classList.remove('nx38-auth-boot');document.documentElement.classList.add('nx38-auth-ready');style.remove();return true};
    addEventListener(profile?'aninexus:profile-v38-ready':'aninexus:auth-v38-ready',ready);
    if(app)observer.observe(app,{childList:true,subtree:true});
    ready();timer=setTimeout(()=>{if(ready()||!app)return;app.innerHTML=`<main class="nx-route-fail" data-route-owner="${owner}"><div><h1>Esta página demorou para responder</h1><p>Tente novamente em instantes.</p></div></main>`;ready()},10500);
  }catch{}
})();
