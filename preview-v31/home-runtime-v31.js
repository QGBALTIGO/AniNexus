'use strict';
(() => {
  const IS_PAGES=location.hostname.endsWith('github.io'),BASE=IS_PAGES?'/AniNexus':'';
  let mounted=false;
  function enhance(){
    const home=document.querySelector('[data-aqx-home]');if(!home)return false;
    const heroSection=home.querySelector('.aqx-hero'),hero=home.querySelector('.aqx-hero-copy'),live=home.querySelector('.aqx-live');
    if(hero){
      let eyebrow=hero.querySelector('.aqx-eyebrow');if(!eyebrow){eyebrow=document.createElement('span');eyebrow.className='aqx-eyebrow';eyebrow.textContent='ANINEXUS · SEU UNIVERSO ANIME';hero.prepend(eyebrow)}
      let actions=hero.querySelector('.aqx-hero-actions');if(!actions){actions=document.createElement('div');actions.className='aqx-hero-actions';actions.innerHTML='<a class="primary" href="/animes/temporadas" data-link>Explorar temporada <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M14 7.5 18.5 12 14 16.5"/></svg></a><a href="/animes/programacao" data-link><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>Programação de hoje</a>';hero.append(actions)}
      if(!hero.querySelector('.nx31-universe-strip'))hero.insertAdjacentHTML('beforeend','<div class="nx31-universe-strip"><span>ANIME</span><i></i><span>MANGÁ</span><i></i><span>LIGHT NOVEL</span><i></i><span>NOTÍCIAS</span><i></i><span>COMUNIDADE</span></div>');
    }
    if(heroSection&&!heroSection.querySelector('.nx31-hero-sigil'))heroSection.insertAdjacentHTML('beforeend',`<div class="nx31-hero-sigil" aria-hidden="true"><i class="r1"></i><i class="r2"></i><i class="r3"></i><div><img src="${BASE}/assets/logo.png" alt=""><span>ANINEXUS</span></div></div>`);
    if(live&&!live.querySelector('.nx31-live-brand'))live.insertAdjacentHTML('afterbegin',`<div class="nx31-live-brand"><img src="${BASE}/assets/logo.png" alt=""><div><small>SINAL ANINEXUS</small><strong>A comunidade está viva</strong></div><span></span></div>`);

    home.querySelectorAll('.aqx-section').forEach(section=>{const title=(section.querySelector('.aqx-head h2')?.textContent||'').replace(/\s+/g,' ').trim();if(title==='Tags')section.remove()});
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target)}}),{rootMargin:'0px 0px -7% 0px',threshold:.08});
    home.querySelectorAll('.aqx-section').forEach((section,i)=>{if(section.dataset.nx31Reveal)return;section.dataset.nx31Reveal='1';section.classList.add('nx31-reveal');section.style.transitionDelay=`${Math.min(i,4)*45}ms`;observer.observe(section)});
    mounted=true;document.body.classList.add('nx31-home-brand');return true;
  }
  if(!enhance()){const app=document.querySelector('#app');if(!app)return;const mo=new MutationObserver(()=>{if(!mounted&&enhance())mo.disconnect()});mo.observe(app,{childList:true,subtree:true});setTimeout(()=>mo.disconnect(),10000)}
})();
