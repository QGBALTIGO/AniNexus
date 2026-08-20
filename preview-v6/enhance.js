'use strict';
(() => {
  const done = new WeakSet();

  bindImageFallback = function () {
    document.querySelectorAll('img').forEach(img => {
      if (img.dataset.fallback) return;
      img.dataset.fallback = '1';
      img.addEventListener('error', () => {
        const stream = img.closest('.stream-mark');
        if (stream) {
          img.remove();
          stream.classList.add('fallback');
          return;
        }
        if (img.closest('.stream-link')) {
          img.remove();
          return;
        }
        img.src = BASE + '/assets/logo.png';
        img.style.objectFit = 'contain';
        img.style.padding = '12px';
        img.style.background = '#100b14';
      }, {once:true});
    });
  };
  bindImageFallback();

  function addHomeDepth() {
    if (pathNow() !== '/') return;
    const tag = document.querySelector('.tag-cloud');
    if (!tag || document.querySelector('#nx-home-community-depth')) return;
    const section = tag.closest('.section');
    if (!section) return;
    section.insertAdjacentHTML('beforebegin', `
      <section class="section" id="nx-home-community-depth">
        <div class="shell">
          <div class="section-head"><div><h2>Últimas Impressões</h2><p>Opiniões e comentários ganham vida quando a comunidade estiver conectada.</p></div><a class="section-link" href="/comunidade" data-link>Ver comunidade${ICON.arrow}</a></div>
          <div class="community-preview-grid">
            <article class="impression-preview"><div class="impression-user"><span class="preview-avatar">AN</span><div><strong>Sua próxima impressão pode aparecer aqui</strong><small>Anime, episódio, nota e reação</small></div></div><p>Registre o que achou de um episódio ou temporada e converse sem estragar a experiência de quem ainda não assistiu.</p><div class="impression-foot"><span>${ICON.shield} spoiler protegido</span><span>${ICON.heart} reações</span></div></article>
            <article class="impression-preview"><div class="impression-user"><span class="preview-avatar purple">EP</span><div><strong>Discussões por episódio</strong><small>Contexto separado por progresso</small></div></div><p>As conversas poderão ser vinculadas ao episódio visto, ajudando a manter teorias e spoilers no lugar certo.</p><div class="impression-foot"><span>${ICON.chat} comentários</span><span>${ICON.bell} acompanhar</span></div></article>
            <article class="impression-preview"><div class="impression-user"><span class="preview-avatar gold">LS</span><div><strong>Listas e recomendações</strong><small>Descoberta pela comunidade</small></div></div><p>Monte listas públicas, compartilhe favoritos e encontre novos títulos por pessoas com gostos parecidos.</p><div class="impression-foot"><span>${ICON.star} avaliações</span><span>${ICON.discover} descobrir</span></div></article>
          </div>
        </div>
      </section>
      <section class="section soft">
        <div class="shell">
          <div class="community-dashboard">
            <div class="community-dashboard-copy"><div class="eyebrow">${ICON.chat} Agora na Comunidade</div><h2>Um espaço para acompanhar o que os fãs estão fazendo</h2><p>Quando o backend estiver publicado, esta área recebe atividade real: quem começou, terminou, favoritou, avaliou, comentou e desbloqueou conquistas.</p><a class="btn" href="/comunidade" data-link>Explorar comunidade ${ICON.arrow}</a></div>
            <div class="community-feed-preview"><div><i class="pulse-dot"></i><span><b>Lista pessoal</b><small>quero ver · assistindo · terminei</small></span></div><div><i class="pulse-dot purple"></i><span><b>Impressões</b><small>por anime e por episódio</small></span></div><div><i class="pulse-dot gold"></i><span><b>Conquistas</b><small>marcos do seu histórico</small></span></div><div><i class="pulse-dot green"></i><span><b>Notificações</b><small>episódios e novidades seguidas</small></span></div></div>
          </div>
        </div>
      </section>`);
    wireLinks();
  }

  async function enrichDetail() {
    const hero = document.querySelector('.detail-hero');
    if (!hero || done.has(hero)) return;
    done.add(hero);
    const match = pathNow().match(/^\/(anime|manga)\/.+-(\d+)$/);
    if (!match) return;
    const type = match[1] === 'anime' ? 'ANIME' : 'MANGA';
    const id = Number(match[2]);

    const characterTab = document.querySelector('[data-tab="personagens"]');
    if (characterTab) characterTab.hidden = true;
    const communityTab = document.querySelector('[data-tab="comunidade"]');
    if (communityTab) communityTab.textContent = 'Impressões';
    const tabs = document.querySelector('.detail-tabs');
    if (tabs && !tabs.querySelector('[data-share-tab]')) {
      const share = document.createElement('button');
      share.dataset.shareTab = '1';
      share.dataset.tab = 'share-custom';
      share.textContent = 'Compartilhar';
      share.onclick = () => {
        tabs.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        share.classList.add('active');
        const panel = document.querySelector('#detailPanel');
        if (!panel) return;
        panel.innerHTML = `<section class="detail-main"><h2>Compartilhar</h2><p class="synopsis">Envie este título para seus amigos ou copie o endereço da página.</p><div class="detail-actions"><button class="btn primary" id="nxCopyLink">${ICON.arrow} Copiar link</button></div></section>`;
        document.querySelector('#nxCopyLink')?.addEventListener('click', async () => {
          try { await navigator.clipboard.writeText(location.href); toast('Link copiado'); }
          catch { toast('Copie o endereço do navegador'); }
        });
      };
      tabs.append(share);
    }

    try {
      const m = await getMedia(id, type);
      const side = document.querySelector('.detail-side');
      if (!side || side.querySelector('.nx-extra-info')) return;
      const studios = (m.studios?.nodes || m.studios || []).map(s => s.name).filter(Boolean).join(', ');
      const seasonName = m.season ? (SEASON_PT[m.season] || m.season) : '—';
      const country = ({JP:'Japão',KR:'Coreia do Sul',CN:'China',TW:'Taiwan'})[m.countryOfOrigin || m.country] || m.countryOfOrigin || m.country || '—';
      side.insertAdjacentHTML('beforeend', `<div class="nx-extra-info"><h3>Ficha técnica</h3><div class="info-card"><div class="info-row"><span>Origem</span><strong>${esc(country)}</strong></div><div class="info-row"><span>Ano</span><strong>${esc(m.seasonYear || m.startDate?.year || '—')}</strong></div>${type==='ANIME'?`<div class="info-row"><span>Temporada</span><strong>${esc(seasonName)}</strong></div>`:''}<div class="info-row"><span>Baseado em</span><strong>${esc(source(m.source))}</strong></div>${studios?`<div class="info-row"><span>Estúdios</span><strong>${esc(studios)}</strong></div>`:''}</div></div>`);

      const main = document.querySelector('.detail-main');
      if (main && !main.querySelector('.follow-cta')) {
        const cta = document.createElement('section');
        cta.className = 'follow-cta';
        cta.innerHTML = `<div><span class="eyebrow">${ICON.heart} Sua lista</span><h2>Comece a acompanhar ${esc(title(m))}</h2><p>Organize o que assiste, registre notas e mantenha suas impressões juntas.</p></div><button class="btn primary" data-list="${m.id}">${ICON.plus} Adicionar à lista</button>`;
        const synopsis = main.querySelector('section:nth-child(2)') || main.firstElementChild;
        synopsis?.insertAdjacentElement('afterend', cta);
        wireDynamic();
      }
    } catch {}
  }

  function polishHeadlines() {
    if (pathNow() !== '/') return;
    const h = document.querySelector('.hero h1');
    if (h && !h.dataset.polished) {
      h.dataset.polished = '1';
      h.innerHTML = `Avalie. Descubra.<br><span class="accent">Compartilhe.</span>`;
    }
    const awards = document.querySelector('.feature-band h2');
    if (awards && !awards.dataset.polished) {
      awards.dataset.polished = '1';
      awards.textContent = 'Crunchyroll Anime Awards';
    }
  }

  function run() {
    polishHeadlines();
    addHomeDepth();
    enrichDetail();
    bindImageFallback();
  }

  let queued = false;
  const obs = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; run(); });
  });
  obs.observe(document.documentElement, {childList:true, subtree:true});
  window.addEventListener('popstate', () => setTimeout(run, 50));
  setTimeout(run, 0);
})();
