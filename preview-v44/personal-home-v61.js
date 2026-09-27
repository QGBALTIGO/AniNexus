'use strict';
(() => {
  if (window.__NX61_PERSONAL_HOME__) return;
  window.__NX61_PERSONAL_HOME__ = true;
  let generation = 0, pending = null, activeHost = null, lastHome = null, lastLoaded = 0;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
  const slug = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,90)||'obra';
  const href = item => `/${item.mediaType === 'MANGA' ? 'manga' : 'anime'}/${slug(item.title)}-${Number(item.id)}`;
  const arrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M14 7.5 18.5 12 14 16.5"/></svg>';
  function frame(body) {
    return `<div class="nx35-shell"><div class="nx35-head"><div><small>DA SUA BIBLIOTECA</small><h2 id="nx61ContinueTitle">Continue de onde parou</h2></div><a href="/minha-biblioteca" data-nx35-nav="1">Ver biblioteca ${arrow}</a></div>${body}</div>`;
  }
  function continuation(item) {
    const reading = item.mediaType === 'MANGA', unit = reading ? 'Capítulo' : 'Episódio';
    const next = item.next ? `Próximo ${unit.toLowerCase()}: ${item.next}` : 'Ver atualizações';
    const cover = /^https:\/\//i.test(item.cover || '') ? `<img src="${esc(item.cover)}" alt="" loading="lazy" decoding="async">` : '<span class="nx61-cover-fallback">Sem capa</span>';
    return `<a class="nx35-anime nx61-continue-card" href="${href(item)}" data-nx35-nav="1"><div class="nx35-cover">${cover}<div></div><span class="nx61-continue-position">${unit} ${esc(item.progress)}</span></div><h3>${esc(item.title)}</h3><p class="nx61-continue-next">${esc(next)}</p></a>`;
  }
  function render(data, host) {
    const continuing = (Array.isArray(data.continue) ? data.continue : []).filter(item => Number.isSafeInteger(Number(item.id)) && Number(item.id)>0 && Number(item.progress)>0);
    if (!continuing.length) { host.remove(); activeHost = null; return; }
    host.innerHTML = frame(`<div class="nx35-edge"><div class="nx35-rail nx61-continue-rail">${continuing.map(continuation).join('')}</div></div>`);
    host.querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{const fallback=document.createElement('span');fallback.className='nx61-cover-fallback';fallback.textContent='Sem capa';img.replaceWith(fallback);},{once:true}));
    window.AniNexusRails?.refresh();
  }
  function clear() { generation++; pending?.abort(); pending=null; activeHost?.remove(); activeHost=null; lastHome=null; lastLoaded=0; }
  async function mount(force=false) {
    const home=document.querySelector('.nx35-home'), auth=window.AniNexusAuth;
    if (!home || !auth?.enabled) { clear(); return; }
    if (!force && lastHome===home && (pending || Date.now()-lastLoaded<300000)) return;
    const characters=home.querySelector('#nx47Characters')?.closest('.nx35-section');
    if (!characters) return;
    const token=++generation; pending?.abort(); pending=new AbortController();const signal=pending.signal;lastHome=home;
    try {
      const user=await auth.getUser();
      if (token!==generation || !home.isConnected) return;
      if (!user) { clear(); return; }
      let host=home.querySelector('.nx61-personal-home');
      if (!host) {
        host=document.createElement('section');host.className='nx35-section nx61-personal-home';
        host.setAttribute('aria-labelledby','nx61ContinueTitle');characters.after(host);
      }
      activeHost=host;
      host.innerHTML=frame('<div class="nx35-edge"><div class="nx35-rail nx61-continue-loading" role="status" aria-label="Carregando seu progresso" aria-busy="true">'+Array.from({length:6},()=>'<div aria-hidden="true"><div class="nx35-cover"></div><i></i></div>').join('')+'</div></div>');
      const data=await auth.api('/api/me/home?timeZone='+encodeURIComponent(timeZone()),{signal,timeout:8000});
      if (token!==generation || !host.isConnected) return;
      render(data,host);lastLoaded=Date.now();
    } catch(error) {
      if (token!==generation || signal.aborted) return;
      if (error.status===401 || error.status===403) { clear(); return; }
      if (activeHost?.isConnected) {
        activeHost.innerHTML=frame('<div class="nx61-continue-failure" role="status"><p>Não foi possível carregar seu progresso agora.</p><button type="button" data-nx61-retry>Tentar novamente</button></div>');
        activeHost.querySelector('button').onclick=()=>mount(true);
      }
    } finally { if (token===generation) pending=null; }
  }
  addEventListener('aninexus:home-v34-ready',()=>mount());
  addEventListener('aninexus:account-identity-changed',event=>{clear();if(event.detail?.user)mount(true);});
  addEventListener('popstate',()=>{if(!document.querySelector('.nx35-home'))clear();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)mount();});
  document.addEventListener('click',event=>{const link=event.target.closest('.nx61-personal-home a[href^="/"]');if(event.defaultPrevented||!link||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;if(window.AniNexusGo?.(link.getAttribute('href'))){event.preventDefault();clear();}});
  mount();
})();
