'use strict';
(() => {
  const TZ='America/Sao_Paulo';
  function fullDay(key){
    try{const d=new Date(`${key}T12:00:00-03:00`),x=new Intl.DateTimeFormat('pt-BR',{timeZone:TZ,weekday:'long'}).format(d);return x.charAt(0).toUpperCase()+x.slice(1)}catch{return'Dia'}
  }
  function ensureSection(key){
    let el=document.querySelector(`#nx18-day-${CSS.escape(key)}`);if(el)return el;
    const root=document.querySelector('#nx18Root');if(!root)return null;
    const order=[...document.querySelectorAll('#nx18Hero [data-nx18-day]')].map(b=>b.dataset.nx18Day);
    const index=order.indexOf(key);
    el=document.createElement('section');
    el.className='nx18-day-section nx23-empty-day';
    el.id=`nx18-day-${key}`;el.dataset.nx18Section=key;
    el.innerHTML=`<div class="nx18-day-title"><h2>${fullDay(key)}</h2></div><div class="nx18-empty">Nenhum episódio encontrado para este dia com os filtros atuais.</div>`;
    const later=[...root.querySelectorAll('[data-nx18-section]')].find(x=>order.indexOf(x.dataset.nx18Section)>index);
    later?root.insertBefore(el,later):root.append(el);
    return el;
  }
  function select(key){
    document.querySelectorAll('.nx18-day').forEach(b=>{const k=b.dataset.nx18Day||b.dataset.nx18Idday;b.classList.toggle('active',k===key)});
    const island=document.querySelector('.nx18-island');
    if(island){island.classList.remove('expanded');island.querySelector('[data-nx18-island-toggle]')?.setAttribute('aria-expanded','false')}
    const el=ensureSection(key);if(!el)return;
    requestAnimationFrame(()=>{
      const header=document.querySelector('#topbar');
      const headH=header&&!document.body.classList.contains('nx18-header-hidden')?header.getBoundingClientRect().height:0;
      const top=Math.max(0,scrollY+el.getBoundingClientRect().top-headH-18);
      scrollTo({top,behavior:'smooth'});
    });
  }
  addEventListener('click',e=>{
    const b=e.target.closest?.('[data-nx18-day],[data-nx18-idday]');if(!b)return;
    const key=b.dataset.nx18Day||b.dataset.nx18Idday;if(!key)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();select(key);
  },true);
})();