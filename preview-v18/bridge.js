'use strict';
(() => {
  if(window.__NX18_BRIDGE_V2__)return;window.__NX18_BRIDGE_V2__=true;
  const IS_PAGES=location.hostname.endsWith('github.io');
  const BASE=IS_PAGES?'/AniNexus':'';
  const target='/animes/programacao';

  // A API da VPS entrega mídia já normalizada (title/cover/score/streaming),
  // enquanto a camada visual legada da Programação ainda espera o shape do AniList.
  // Adaptamos somente /api/schedule para manter a página compatível sem afetar
  // outras requisições do site.
  if(!IS_PAGES&&typeof window.fetch==='function'&&!window.__NX18_SCHEDULE_FETCH_COMPAT__){
    window.__NX18_SCHEDULE_FETCH_COMPAT__=true;
    const nativeFetch=window.fetch.bind(window);
    const legacyMedia=m=>{
      if(!m||typeof m!=='object')return m;
      if(m.coverImage&&m.title&&typeof m.title==='object')return m;
      const display=String(m.title||m.titleRomaji||m.titleNative||'Anime');
      const romaji=String(m.titleRomaji||display);
      const native=String(m.titleNative||'');
      const cover=String(m.cover||'');
      const numericScore=Number(m.score);
      return {
        ...m,
        title:{english:display,userPreferred:display,romaji,native},
        coverImage:{extraLarge:cover,large:cover},
        bannerImage:m.banner||'',
        averageScore:Number.isFinite(numericScore)&&numericScore>0?Math.round(numericScore*10):null,
        externalLinks:Array.isArray(m.externalLinks)?m.externalLinks:(Array.isArray(m.streaming)?m.streaming:[])
      };
    };
    window.fetch=async(input,init)=>{
      const response=await nativeFetch(input,init);
      try{
        const raw=typeof input==='string'?input:input?.url;
        const url=new URL(String(raw||''),location.href);
        if(url.origin!==location.origin||url.pathname!=='/api/schedule'||!response.ok)return response;
        const data=await response.clone().json();
        if(!Array.isArray(data))return response;
        const adapted=data.map(item=>item&&typeof item==='object'?{...item,media:legacyMedia(item.media)}:item);
        const headers=new Headers(response.headers);
        headers.set('content-type','application/json; charset=utf-8');
        headers.delete('content-length');
        return new Response(JSON.stringify(adapted),{status:response.status,statusText:response.statusText,headers});
      }catch{return response}
    };
  }

  function pathOf(a){try{const u=new URL(a.href,location.href);const restored=u.searchParams.get('p');if(restored)return restored.split('?')[0].replace(/\/+$/,'')||'/';let p=u.pathname;if(IS_PAGES)p=p.replace(/^\/AniNexus/,'')||'/';return p.replace(/\/+$/,'')||'/'}catch{return''}}
  document.addEventListener('click',e=>{
    const a=e.target.closest('a[href]');if(!a||pathOf(a)!==target)return;
    if(e.button&&e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    location.href=IS_PAGES?`${BASE}/?build=23.0.0&p=${encodeURIComponent(target)}`:`${target}`;
  },true);
  document.addEventListener('error',e=>{
    const img=e.target;if(!(img instanceof HTMLImageElement)||!img.closest('.nx18-provider-logo'))return;
    img.hidden=true;const fallback=img.nextElementSibling;if(fallback)fallback.hidden=false;
  },true);
})();