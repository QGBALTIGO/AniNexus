'use strict';
(() => {
  let done=false;
  function textOf(el){return (el?.textContent||'').replace(/\s+/g,' ').trim()}
  function patch(){
    const home=document.querySelector('[data-aqx-home]');
    if(!home)return false;

    /* V30 replaces these reference-only controls with AniNexus branded chrome. */
    home.querySelector('.aqx-eyebrow')?.remove();
    home.querySelector('.aqx-hero-actions')?.remove();

    const heroCopy=home.querySelector('.aqx-hero-copy>p');
    if(heroCopy){
      heroCopy.innerHTML='Temporadas, calendário de episódios, lançamentos e rankings.<br>Sua lista de animes finalmente tem uma casa brasileira.<br><strong>Tudo em português!</strong>';
    }

    home.querySelectorAll('.aqx-head').forEach(head=>{
      const title=textOf(head.querySelector('h2'));
      const p=head.querySelector('p');
      if(!p)return;
      if(title.startsWith('Próximos Episódios'))p.textContent='Veja a programação dos animes que estão sendo transmitidos hoje no Brasil.';
      if(title.startsWith('Top 10'))p.textContent='O ranking dos animes mais bem avaliados pela comunidade.';
      if(title.startsWith('Animes mais Populares'))p.textContent='Veja os animes mais populares no Brasil no momento.';
      if(title.startsWith('Tags'))p.textContent='Explore seus animes por categoria.';
    });

    done=true;
    document.body.classList.add('aqx-fidelity-v29');
    return true;
  }

  if(!patch()){
    const app=document.querySelector('#app');
    if(!app)return;
    const observer=new MutationObserver(()=>{if(!done&&patch())observer.disconnect()});
    observer.observe(app,{childList:true,subtree:true});
    setTimeout(()=>observer.disconnect(),10000);
  }
})();
