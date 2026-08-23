'use strict';
(() => {
  const app=document.querySelector('#app'); if(!app||window.NX34Home)return;
  const IS_PAGES=location.hostname.endsWith('github.io');
  const BASE=IS_PAGES?'/AniNexus':'';
  const BUILD='34.0.0';
  const I={
    arrow:'<svg viewBox="0 0 24 24"><path d="M5 12h13M14 7.5 18.5 12 14 16.5"/></svg>',
    clock:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    chat:'<svg viewBox="0 0 24 24"><path d="M4 5.5h16v11H9l-5 3v-14Z"/><path d="M8 9h8M8 12.5h5"/></svg>',
    news:'<svg viewBox="0 0 24 24"><path d="M5 4h11v16H5z"/><path d="M8 8h5M8 12h5M8 16h3M16 8h3v12h-3"/></svg>'
  };
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const strip=s=>String(s??'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
  const slug=s=>String(s||'item').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,96)||'item';
  const hash=s=>{let h=2166136261;for(const c of String(s||'')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0).toString(36)};
  function route(){try{const u=new URL(location.href),p=u.searchParams.get('p');if(p)return p.split('?')[0].replace(/\/+$/,'')||'/';let x=u.pathname;if(IS_PAGES)x=x.replace(/^\/AniNexus/,'')||'/';return x.replace(/\/+$/,'')||'/'}catch{return'/'}}
  function go(path){location.assign(IS_PAGES?`${BASE}/?build=${BUILD}&p=${encodeURIComponent(path)}`:path)}
  function sectionHead(kicker,base,accent,sub,href,label){return `<div class="aqx-head nx34-head"><div>${kicker?`<span class="nx34-section-kicker"><i></i>${esc(kicker)}</span>`:''}<h2>${esc(base)}${accent?` <em>${esc(accent)}</em>`:''}</h2>${sub?`<p>${esc(sub)}</p>`:''}</div>${href?`<a href="${href}" data-link>${esc(label||'Ver mais')} ${I.arrow}</a>`:''}</div>`}

  const railObservers=[];
  let suppressClickUntil=0;
  function bindRail(el,host){
    if(!el||el.dataset.nx34Rail)return;
    host=host||el.parentElement;if(!host)return;
    el.dataset.nx34Rail='1';host.classList.add('nx34-edge');
    el.style.scrollBehavior='smooth';el.style.overscrollBehaviorInline='contain';
    const update=()=>{const max=Math.max(0,el.scrollWidth-el.clientWidth);host.dataset.left=el.scrollLeft>7?'1':'0';host.dataset.right=el.scrollLeft<max-7?'1':'0'};
    el.addEventListener('scroll',update,{passive:true});
    const ro=new ResizeObserver(update);ro.observe(el);railObservers.push(ro);requestAnimationFrame(update);
    let down=false,startX=0,startScroll=0,drag=false;
    el.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0||e.target.closest('button,input,select,textarea'))return;down=true;drag=false;startX=e.clientX;startScroll=el.scrollLeft;el.classList.add('nx34-dragging');el.setPointerCapture?.(e.pointerId)});
    el.addEventListener('pointermove',e=>{if(!down)return;const dx=e.clientX-startX;if(Math.abs(dx)>5)drag=true;if(drag){el.scrollLeft=startScroll-dx;e.preventDefault()}});
    const end=e=>{if(!down)return;down=false;el.classList.remove('nx34-dragging');if(drag)suppressClickUntil=Date.now()+180;drag=false;try{el.releasePointerCapture?.(e.pointerId)}catch{}};
    el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);el.addEventListener('pointerleave',e=>{if(down)end(e)});
  }
  function bindRails(root=document){
    root.querySelectorAll?.('.aqx-rail').forEach(el=>bindRail(el,el.closest('.aqx-rail-shell')));
    root.querySelectorAll?.('.nx34-reading-rail,.nx34-news-stack,.nx34-mobile-rail,.nx34-achievement-rail').forEach(el=>bindRail(el,el.parentElement));
  }

  function cleanHome(home){
    home.querySelectorAll('.nx30-kicker,.nx30-hero-actions,.nx31-universe-strip,.nx31-hero-sigil,.nx31-live-brand,.nx33-orbit,.nx33-brand-lockup,.nx33-hero-actions,.nx33-hero-signals,.nx33-live-head,.nx34-hero-art,.nx34-kicker,.nx34-hero-actions,.nx34-hero-meta').forEach(x=>x.remove());
    home.querySelectorAll(':scope>.aqx-section').forEach(section=>{const t=strip(section.querySelector('.aqx-head h2')?.textContent);if(t==='Tags'||section.classList.contains('nx30-news-section')||section.classList.contains('nx30-reading-section')||section.classList.contains('nx33-news-section')||section.classList.contains('nx33-reading-section')||section.classList.contains('nx34-news-section')||section.classList.contains('nx34-reading-section'))section.remove()});
  }
  function brandHero(home){
    const hero=home.querySelector('.aqx-hero'),copy=home.querySelector('.aqx-hero-copy'),live=home.querySelector('.aqx-live');if(!hero||!copy)return;
    copy.innerHTML=`<div class="nx34-kicker"><img src="${BASE}/assets/logo.png" alt=""><span><small>ANINEXUS</small><b>ANIME, MANGÁ E COMUNIDADE</b></span><i></i></div><h1>Seu anime.<br><em>Do seu jeito.</em></h1><p>Descubra o que estreia, acompanhe episódios, organize sua lista, continue no mangá e veja o que a comunidade está fazendo — tudo no mesmo lugar.</p><div class="nx34-hero-actions"><a class="primary" href="/animes/temporadas" data-link>Explorar temporada ${I.arrow}</a><a href="/animes/programacao" data-link>${I.clock} Programação de hoje</a></div><div class="nx34-hero-meta"><span><i></i> HORÁRIO DE BRASÍLIA</span><span>${I.news} NOTÍCIAS EM PORTUGUÊS</span><span>${I.chat} COMUNIDADE AO VIVO</span></div>`;
    hero.insertAdjacentHTML('beforeend',`<div class="nx34-hero-art" aria-hidden="true"><i class="a"></i><i class="b"></i><i class="c"></i><div><img src="${BASE}/assets/logo.png" alt=""><span>ANINEXUS</span></div></div>`);
    if(live)live.innerHTML=`<div class="nx34-community-head"><div><span></span><small>AGORA NA COMUNIDADE</small></div><a href="/comunidade" data-link>Ver tudo ${I.arrow}</a></div><div id="aqxHeroCommunity" class="nx34-community-feed"><div class="nx34-community-skeleton"></div><div class="nx34-community-skeleton"></div><div class="nx34-community-skeleton"></div></div>`;
  }
  function injectSections(home){
    const sections=[...home.querySelectorAll(':scope>.aqx-section')],schedule=sections.find(s=>strip(s.querySelector('h2')?.textContent).startsWith('Próximos Episódios'));
    if(!home.querySelector('.nx34-news-section')){const n=document.createElement('section');n.className='aqx-section nx34-news-section';n.innerHTML=`<div class="aqx-shell">${sectionHead('ANINEXUS NOTÍCIAS','Notícias','em destaque','Anime, mangá, trailers e anúncios transformados em matérias internas, rápidas e em português.','/noticias','Todas as notícias')}<div id="nx34HomeNews"><div class="nx34-news-skeleton"></div></div></div>`;(schedule||sections[0])?.insertAdjacentElement('afterend',n)}
    const popular=[...home.querySelectorAll(':scope>.aqx-section')].find(s=>strip(s.querySelector('h2')?.textContent).startsWith('Animes mais'));
    if(!home.querySelector('.nx34-reading-section')){const r=document.createElement('section');r.className='aqx-section aqx-tonal nx34-reading-section';r.innerHTML=`<div class="aqx-shell">${sectionHead('LEITURA ANINEXUS','Mangás &','Light Novels','Continue a história além do anime e descubra a obra original.','/mangas','Explorar leitura')}<div class="nx34-edge"><div id="nx34Reading" class="nx34-reading-rail">${Array.from({length:9},()=>'<div class="nx34-reading-skeleton"></div>').join('')}</div></div></div>`;(popular||sections[Math.floor(sections.length/2)])?.insertAdjacentElement('afterend',r)}
  }

  let mountedHome=null;
  function mount(force=false){
    if(route()!=='/')return null;const home=document.querySelector('[data-aqx-home]');if(!home)return null;if(mountedHome===home&&!force)return home;
    mountedHome=home;document.body.classList.add('nx34-home');document.body.classList.remove('nx33-home');cleanHome(home);brandHero(home);injectSections(home);bindRails(home);dispatchEvent(new CustomEvent('aninexus:home-v34-mounted',{detail:{home}}));return home;
  }
  function cleanup(){mountedHome=null;document.body.classList.remove('nx34-home');railObservers.splice(0).forEach(x=>x.disconnect())}
  window.NX34Home={I,IS_PAGES,BASE,BUILD,esc,strip,slug,hash,route,go,sectionHead,bindRail,bindRails,mount,cleanup,get suppressClickUntil(){return suppressClickUntil}};
  document.addEventListener('click',e=>{if(Date.now()<suppressClickUntil){e.preventDefault();e.stopImmediatePropagation();return}const a=e.target.closest('[data-nx34-route]');if(a){e.preventDefault();e.stopImmediatePropagation();go(a.dataset.nx34Route)}},true);
  const mo=new MutationObserver(()=>{if(route()==='/'){mount();bindRails(app)}else if(mountedHome)cleanup()});mo.observe(app,{childList:true,subtree:true});
  addEventListener('popstate',()=>setTimeout(()=>route()==='/'?mount(true):cleanup(),0));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(mount,0),{once:true});else setTimeout(mount,0);
})();