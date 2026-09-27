'use strict';
(() => {
  if (window.__NX61_PERSONAL_HOME__) return;
  window.__NX61_PERSONAL_HOME__ = true;
  let generation = 0, pending = null, activeHost = null, lastLoaded = 0;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const icon = name => window.AniNexusUI?.notification({kind:name === 'book' ? 'NEWS' : name === 'calendar' ? 'SCHEDULE' : 'EPISODE'}).svg || '';
  const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
  const href = item => `/${item.mediaType === 'MANGA' ? 'manga' : 'anime'}/${Number(item.id)}`;
  const dayLabel = day => new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(day+'T12:00:00Z'));
  const clockLabel = (seconds, zone) => new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:zone}).format(new Date(seconds*1000));
  const empty = text => `<p class="nx61-home-empty">${esc(text)}</p>`;
  function titleLink(item, detail, aside='') {
    return `<a class="nx61-agenda-row" href="${href(item)}"><span><strong>${esc(item.title)}</strong><small>${esc(detail)}</small></span>${aside ? `<time>${esc(aside)}</time>` : ''}</a>`;
  }
  function continuation(item) {
    const reading = item.mediaType === 'MANGA', unit = reading ? 'capítulo' : 'episódio';
    const progress = item.progress > 0 ? `Você parou no ${unit} ${item.progress}` : reading ? 'Pronto para começar a leitura' : 'Pronto para começar';
    const next = item.next ? `Próximo ${unit}: ${item.next}` : 'Ver atualizações';
    const cover = /^https:\/\//i.test(item.cover || '') ? `<img src="${esc(item.cover)}" alt="" loading="lazy" decoding="async">` : `<i aria-hidden="true">${icon(reading?'book':'play')}</i>`;
    return `<a class="nx61-continue-card" href="${href(item)}"><span class="nx61-continue-cover">${cover}</span><span class="nx61-continue-copy"><small>${reading?'CONTINUE LENDO':'CONTINUE ASSISTINDO'}</small><strong>${esc(item.title)}</strong><span>${esc(progress)}</span><b>${esc(next)} <span aria-hidden="true">→</span></b></span></a>`;
  }
  function render(data, host) {
    const continuing = Array.isArray(data.continue) ? data.continue : [], today = data.todayItems || [], week = data.week || [], backlog = data.backlog || [], premieres = data.premieres || [];
    const zone = data.timeZone || timeZone(), coverage = data.coverage || {};
    const grouped = new Map();
    for (const item of week) { if (!grouped.has(item.day)) grouped.set(item.day,[]); grouped.get(item.day).push(item); }
    host.innerHTML = `<header class="nx61-home-head"><div><small>SUA CENTRAL</small><h1>Hoje, no seu ritmo.</h1><p>Seu progresso, sua lista e os próximos lançamentos.</p></div><button type="button" data-nx61-refresh>Atualizar</button></header>
      <section aria-labelledby="nx61ContinueTitle"><div class="nx61-section-head"><h2 id="nx61ContinueTitle">Continue de onde parou</h2><a href="/minha-biblioteca">Ver biblioteca <span aria-hidden="true">→</span></a></div>
      ${continuing.length ? `<div class="nx35-edge"><div class="nx35-rail nx61-continue-rail">${continuing.map(continuation).join('')}</div></div>` : empty('Marque uma obra como assistindo ou lendo na sua biblioteca. Seu próximo passo aparece aqui.')}</section>
      <div class="nx61-home-columns"><section aria-labelledby="nx61TodayTitle"><h2 id="nx61TodayTitle">Sai hoje</h2>${today.length ? today.map(item=>titleLink(item,`Episódio ${item.episode} · ${item.alreadyScheduled?'horário previsto já passou':'previsto'}`,clockLabel(item.airingAt,zone))).join('') : empty('Nenhum episódio com horário confirmado para hoje na sua lista.')}</section>
      <section aria-labelledby="nx61BacklogTitle"><h2 id="nx61BacklogTitle">Para colocar em dia</h2>${backlog.length ? backlog.map(item=>titleLink(item,`${item.remaining} ${item.remaining===1?'episódio pendente':'episódios pendentes'}`)).join('') : empty('Nenhuma pendência confirmada nas obras concluídas que você acompanha.')}<p class="nx61-home-note">Contagem de obras já finalizadas. Não estimamos episódios lançados a partir de uma previsão.</p></section></div>
      <div class="nx61-home-columns"><section aria-labelledby="nx61WeekTitle"><h2 id="nx61WeekTitle">Da sua lista nos próximos 7 dias</h2>${grouped.size ? [...grouped].map(([day,items])=>`<h3 class="nx61-day-heading">${esc(dayLabel(day))}</h3>${items.map(item=>titleLink(item,`Episódio ${item.episode}`,clockLabel(item.airingAt,zone))).join('')}`).join('') : empty('Sem novos horários confirmados. Você também pode consultar a programação geral.')}</section>
      <section aria-labelledby="nx61PremiereTitle"><h2 id="nx61PremiereTitle">Estreias no seu radar</h2>${premieres.length ? premieres.map(item=>titleLink(item,item.mediaType==='MANGA'?'Publicação prevista':'Estreia prevista',new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}).format(new Date(item.date+'T12:00:00Z')))).join('') : empty('Adicione lançamentos à sua lista. Datas incompletas não são apresentadas como confirmadas.')}</section></div>
      <footer class="nx61-home-foot"><p>Horários em ${esc(zone)}. Previsões podem mudar; confirme a disponibilidade na plataforma oficial.</p>${coverage.missingMetadata || coverage.staleMetadata || coverage.truncated ? '<p>Alguns dados ainda estão sendo atualizados. A agenda pode não incluir todas as obras da sua lista.</p>' : ''}<a href="/animes/programacao">Programação completa <span aria-hidden="true">→</span></a></footer>`;
    host.querySelector('[data-nx61-refresh]').addEventListener('click',()=>mount(true));
    host.querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{img.replaceWith(Object.assign(document.createElement('span'),{textContent:'Sem capa'}));},{once:true}));
  }
  function clear() { generation++; pending?.abort(); pending=null; activeHost?.remove(); activeHost=null; lastLoaded=0; }
  async function mount(force=false) {
    const home=document.querySelector('.nx35-home'), auth=window.AniNexusAuth;
    if (!home || !auth?.enabled) { clear(); return; }
    if (!force && activeHost?.isConnected && (pending || Date.now()-lastLoaded<300000)) return;
    const token=++generation; pending?.abort(); pending=new AbortController();const signal=pending.signal;
    try {
      const user=await auth.getUser();
      if (token!==generation || !home.isConnected) return;
      if (!user) { clear(); return; }
      let host=home.querySelector('.nx61-personal-home');
      if (!host) { host=document.createElement('section');host.className='nx61-personal-home nx35-shell';home.prepend(host); }
      activeHost=host;
      host.innerHTML='<div class="nx61-home-loading" role="status" aria-busy="true"><strong>Carregando sua central</strong><p>Buscando seu progresso e sua agenda...</p><div aria-hidden="true"><i></i><i></i><i></i></div></div>';
      const data=await auth.api('/api/me/home?timeZone='+encodeURIComponent(timeZone()),{signal,timeout:8000});
      if (token!==generation || !host.isConnected) return;
      render(data,host);lastLoaded=Date.now();
    } catch(error) {
      if (token!==generation || signal.aborted) return;
      if (error.status===401 || error.status===403) { clear(); return; }
      if (activeHost?.isConnected) {
        activeHost.innerHTML='<div class="nx61-home-failure" role="status"><strong>Sua central não carregou agora.</strong><p>Sua biblioteca está preservada. Você pode tentar novamente ou continuar explorando abaixo.</p><button type="button" data-nx61-retry>Tentar novamente</button></div>';
        activeHost.querySelector('button').onclick=()=>mount(true);
      }
    } finally { if (token===generation) pending=null; }
  }
  addEventListener('aninexus:home-v34-ready',()=>mount());
  addEventListener('aninexus:account-identity-changed',event=>{clear();if(event.detail?.user)mount(true);});
  addEventListener('popstate',()=>{if(!document.querySelector('.nx35-home'))clear();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)mount();});
  document.addEventListener('click',event=>{const link=event.target.closest('.nx61-personal-home a[href^="/"]');if(!link||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;if(window.AniNexusGo?.(link.getAttribute('href'))){event.preventDefault();clear();}});
  mount();
})();
