'use strict';
(() => {
  let mounted=false;
  function enhance(){
    const home=document.querySelector('[data-aqx-home]');
    if(!home)return false;

    const hero=home.querySelector('.aqx-hero-copy');
    if(hero){
      let eyebrow=hero.querySelector('.aqx-eyebrow');
      if(!eyebrow){
        eyebrow=document.createElement('span');
        eyebrow.className='aqx-eyebrow';
        eyebrow.textContent='ANINEXUS · SEU UNIVERSO ANIME';
        hero.prepend(eyebrow);
      }
      let actions=hero.querySelector('.aqx-hero-actions');
      if(!actions){
        actions=document.createElement('div');
        actions.className='aqx-hero-actions';
        actions.innerHTML='<a class="primary" href="/animes/temporadas" data-link>Explorar temporada <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M14 7.5 18.5 12 14 16.5"/></svg></a><a href="/animes/programacao" data-link><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>Programação de hoje</a>';
        hero.append(actions);
      }
    }

    home.querySelectorAll('.aqx-section').forEach(section=>{
      const title=(section.querySelector('.aqx-head h2')?.textContent||'').replace(/\s+/g,' ').trim();
      if(title==='Tags')section.remove();
    });

    home.querySelectorAll('.aqx-section').forEach((section,i)=>{
      if(section.dataset.nx31Reveal)return;
      section.dataset.nx31Reveal='1';
      section.classList.add('nx31-reveal');
      section.style.transitionDelay=`${Math.min(i,4)*45}ms`;
    });

    const reveal=entries=>entries.forEach(entry=>{
      if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target)}
    });
    const observer=new IntersectionObserver(reveal,{rootMargin:'0px 0px -7% 0px',threshold:.08});
    home.querySelectorAll('.nx31-reveal:not(.is-visible)').forEach(el=>observer.observe(el));

    mounted=true;
    document.body.classList.add('nx31-home-brand');
    return true;
  }

  if(!enhance()){
    const app=document.querySelector('#app');
    if(!app)return;
    const mo=new MutationObserver(()=>{if(!mounted&&enhance())mo.disconnect()});
    mo.observe(app,{childList:true,subtree:true});
    setTimeout(()=>mo.disconnect(),10000);
  }
})();
