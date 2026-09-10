'use strict';
(() => {
  if (window.__ANINEXUS_SOCIAL_V50__) return;
  window.__ANINEXUS_SOCIAL_V50__ = true;

  const IS_PAGES = location.hostname.endsWith('github.io');
  const BASE = IS_PAGES ? '/AniNexus' : '';
  const pageUrl = path => IS_PAGES ? `${BASE}/?p=${encodeURIComponent(path)}` : path;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const route = () => {
    const url = new URL(location.href), restored = url.searchParams.get('p');
    if (restored) return restored.split('?')[0].replace(/\/+$/, '') || '/';
    let path = url.pathname;
    if (IS_PAGES) path = path.replace(/^\/AniNexus/, '') || '/';
    return path.replace(/\/+$/, '') || '/';
  };
  const go = path => {
    if (!IS_PAGES && window.AniNexusRadio?.navigate?.(path)) return;
    location.assign(pageUrl(path));
  };
  const publicApi = async path => {
    if (window.AniNexusAuth?.enabled) return window.AniNexusAuth.publicApi(path);
    const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', headers: { accept: 'application/json' } });
    if (!response.ok) throw Object.assign(new Error(`HTTP_${response.status}`), { status: response.status });
    return response.json();
  };
  const privateApi = async (path, options = {}) => {
    if (window.AniNexusAuth?.enabled) return window.AniNexusAuth.api(path, options);
    const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...options, headers: { accept: 'application/json', ...(options.body ? { 'content-type': 'application/json' } : {}), ...(options.headers || {}) } });
    let body = {}; try { body = await response.json(); } catch {}
    if (!response.ok) throw Object.assign(new Error(body?.error || `HTTP_${response.status}`), { status: response.status, code: body?.error });
    return body;
  };
  const account = async () => { try { return await window.AniNexusAuth?.getUser?.() || null; } catch { return null; } };
  const requireAccount = async () => {
    const user = await account();
    if (user) return user;
    if (typeof window.AniNexusAuth?.requireAccount === 'function') await window.AniNexusAuth.requireAccount();
    else go('/login');
    return null;
  };
  const relative = value => {
    const timestamp = Date.parse(value || '');
    if (!Number.isFinite(timestamp)) return '';
    const elapsed = Math.max(0, Date.now() - timestamp);
    if (elapsed < 60_000) return 'agora';
    if (elapsed < 3_600_000) return `há ${Math.max(1, Math.floor(elapsed / 60_000))} min`;
    if (elapsed < 86_400_000) return `há ${Math.floor(elapsed / 3_600_000)} h`;
    if (elapsed < 604_800_000) return `há ${Math.floor(elapsed / 86_400_000)} dias`;
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(timestamp)).replace('.', '');
  };
  const avatar = item => {
    const user = item.user || item, name = user.displayName || item.display_name || item.username || 'membro';
    return window.AniNexusAvatar?.markup?.({ ...item, ...user, display_name: name }, { name, decorative: true, loading: 'lazy' }) || `<span>${esc(name.charAt(0).toUpperCase())}</span>`;
  };
  const actor = item => item?.user?.displayName || item?.display_name || item?.username || 'Membro';
  const handle = item => item?.user?.username || item?.username || '';
  const segments = item => {
    if (Array.isArray(item?.segments) && item.segments.length) return item.segments;
    const body = String(item?.body || ''), parsed = [];
    let cursor = 0;
    for (const match of body.matchAll(/\|\|([^|]+?)\|\|/g)) {
      if (match.index > cursor) parsed.push({ type: 'text', content: body.slice(cursor, match.index) });
      parsed.push({ type: 'spoiler', content: match[1] });
      cursor = match.index + match[0].length;
    }
    if (cursor < body.length) parsed.push({ type: 'text', content: body.slice(cursor) });
    return parsed.length ? parsed : [{ type: item?.spoiler || item?.has_spoilers ? 'spoiler' : 'text', content: body }];
  };
  const renderBody = item => segments(item).map(segment => segment.type === 'spoiler'
    ? `<button type="button" class="nx50-spoiler${item.hideSpoilers === false ? ' revealed' : ''}" data-nx50-spoiler aria-label="Revelar trecho com spoiler"><span>${esc(segment.content)}</span><b>Toque para revelar</b></button>`
    : `<span>${esc(segment.content)}</span>`).join('');
  const statusLabel = (status, reading) => ({ PLANNING: reading ? 'Quero ler' : 'Quero ver', CURRENT: reading ? 'Lendo' : 'Assistindo', COMPLETED: 'Concluído', PAUSED: 'Pausado', DROPPED: 'Desisti' })[status] || '';
  const stageLabel = value => value === 'FINAL' ? 'Final' : 'Preliminar';
  const toast = message => {
    const root = document.querySelector('#toastRoot');
    if (!root) return;
    const note = document.createElement('div'); note.className = 'toast'; note.textContent = message; root.append(note); setTimeout(() => note.remove(), 2600);
  };
  const spoilerButton = '<button class="nx50-mark-spoiler" type="button" data-nx50-mark-spoiler aria-label="Marcar trecho selecionado como spoiler">◉ <span>Marcar spoiler</span></button>';

  function toggleSpoilerMarkup(textarea) {
    const start = textarea.selectionStart, end = textarea.selectionEnd, value = textarea.value;
    if (start === end) { toast('Selecione o trecho que contém spoiler.'); textarea.focus(); return; }
    const wrapped = start >= 2 && value.slice(start - 2, start) === '||' && value.slice(end, end + 2) === '||';
    if (wrapped) {
      textarea.value = value.slice(0, start - 2) + value.slice(start, end) + value.slice(end + 2);
      textarea.setSelectionRange(start - 2, end - 2);
    } else {
      textarea.value = value.slice(0, start) + '||' + value.slice(start, end) + '||' + value.slice(end);
      textarea.setSelectionRange(start + 2, end + 2);
    }
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.focus();
  }

  function bindSpoilers(root) {
    root.querySelectorAll('[data-nx50-spoiler]').forEach(button => button.onclick = () => {
      button.classList.toggle('revealed');
      button.setAttribute('aria-label', button.classList.contains('revealed') ? 'Ocultar trecho com spoiler' : 'Revelar trecho com spoiler');
    });
    root.querySelectorAll('[data-nx50-mark-spoiler]').forEach(button => button.onclick = () => toggleSpoilerMarkup(button.closest('form').querySelector('textarea')));
  }

  async function hydrateLikes(root, type, ids) {
    const user = await account();
    if (!user || !ids.length) return;
    try {
      const query = ids.map(id => `${type}:${id}`).join(',');
      const data = await privateApi(`/api/me/likes?targets=${encodeURIComponent(query)}`);
      for (const target of data.items || []) {
        const button = root.querySelector(`[data-nx50-like="${CSS.escape(target)}"]`);
        if (button) { button.classList.add('active'); button.setAttribute('aria-pressed', 'true'); }
      }
    } catch {}
  }

  function bindSocialActions(root, reloadReplies, options = {}) {
    bindSpoilers(root);
    root.querySelectorAll('[data-nx50-like]').forEach(button => button.onclick = async () => {
      if (!await requireAccount()) return;
      const [likeableType, likeableId] = button.dataset.nx50Like.split(':');
      const liked = button.getAttribute('aria-pressed') === 'true';
      button.disabled = true;
      try {
        const result = await privateApi('/api/likes', { method: liked ? 'DELETE' : 'POST', body: JSON.stringify({ likeableType, likeableId }) });
        button.classList.toggle('active', result.liked); button.setAttribute('aria-pressed', String(result.liked));
        button.querySelector('b').textContent = Number(result.likesCount) || 0;
      } catch (error) { if (error.status === 401) go('/login'); else toast('Não foi possível atualizar a curtida agora.'); }
      finally { button.disabled = false; }
    });
    root.querySelectorAll('[data-nx50-report]').forEach(button => button.onclick = async () => {
      if (!await requireAccount()) return;
      openReport(button.dataset.nx50ReportType, button.dataset.nx50Report);
    });
    root.querySelectorAll('[data-nx50-reply-to]').forEach(button => button.onclick = async () => {
      if (!await requireAccount()) return;
      reloadReplies?.(button.dataset.nx50ReplyTo, button.dataset.nx50ReplyName || 'membro');
    });
    root.querySelectorAll('[data-nx50-edit]').forEach(button => button.onclick = () => {
      const item = options.items?.find?.(entry => String(entry.id) === button.dataset.nx50Edit);
      if (!item || !options.endpoint) return;
      openEditor(item.body || '', options.maxLength || 3000, async text => {
        await privateApi(options.endpoint(item.id), { method: 'PATCH', body: JSON.stringify({ text }) });
        await options.refresh?.();
        toast('Publicação atualizada.');
      });
    });
    root.querySelectorAll('[data-nx50-delete]').forEach(button => button.onclick = () => {
      if (!options.endpoint) return;
      openDelete(async () => {
        await privateApi(options.endpoint(button.dataset.nx50Delete), { method: 'DELETE' });
        await options.refresh?.();
        toast('Publicação excluída.');
      });
    });
  }

  function openEditor(value, maxLength, save) {
    document.querySelector('.nx50-report-layer')?.remove();
    const layer = document.createElement('div'); layer.className = 'nx50-report-layer';
    layer.innerHTML = `<button type="button" class="nx50-report-backdrop" data-nx50-dialog-close aria-label="Fechar edição"></button><form class="nx50-report-dialog nx50-edit-dialog"><small>EDITAR</small><h2>Atualize sua publicação</h2><textarea name="text" maxlength="${Number(maxLength)}" required>${esc(value)}</textarea><div class="nx50-editor-tools">${spoilerButton}<span data-nx50-count>${String(value).length}/${Number(maxLength)}</span></div><footer><button type="button" data-nx50-dialog-close>Cancelar</button><button type="submit">Salvar</button></footer></form>`;
    document.body.append(layer);
    const close = () => layer.remove(), form = layer.querySelector('form'), textarea = form.elements.text, count = form.querySelector('[data-nx50-count]');
    layer.querySelectorAll('[data-nx50-dialog-close]').forEach(button => button.onclick = close);
    form.querySelector('[data-nx50-mark-spoiler]').onclick = () => toggleSpoilerMarkup(textarea);
    textarea.oninput = () => { count.textContent = `${textarea.value.length}/${textarea.maxLength}`; };
    form.onsubmit = async event => {
      event.preventDefault(); const text = textarea.value.trim(), button = form.querySelector('[type="submit"]');
      if (!text) return;
      button.disabled = true;
      try { await save(text); close(); } catch { button.disabled = false; toast('Não foi possível salvar a alteração agora.'); }
    };
    textarea.focus(); textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }

  function openDelete(remove) {
    document.querySelector('.nx50-report-layer')?.remove();
    const layer = document.createElement('div'); layer.className = 'nx50-report-layer';
    layer.innerHTML = '<button type="button" class="nx50-report-backdrop" data-nx50-dialog-close aria-label="Cancelar exclusão"></button><section class="nx50-report-dialog nx50-delete-dialog" role="dialog" aria-modal="true"><small>EXCLUIR</small><h2>Excluir esta publicação?</h2><p>Ela deixará de aparecer para a comunidade.</p><footer><button type="button" data-nx50-dialog-close>Cancelar</button><button type="button" class="nx50-danger" data-nx50-delete-confirm>Excluir</button></footer></section>';
    document.body.append(layer);
    const close = () => layer.remove(); layer.querySelectorAll('[data-nx50-dialog-close]').forEach(button => button.onclick = close);
    layer.querySelector('[data-nx50-delete-confirm]').onclick = async event => {
      event.currentTarget.disabled = true;
      try { await remove(); close(); } catch { event.currentTarget.disabled = false; toast('Não foi possível excluir agora.'); }
    };
  }

  function openReport(reportType, targetId) {
    document.querySelector('.nx50-report-layer')?.remove();
    const layer = document.createElement('div'); layer.className = 'nx50-report-layer';
    layer.innerHTML = `<button type="button" class="nx50-report-backdrop" data-nx50-report-close aria-label="Fechar denúncia"></button><form class="nx50-report-dialog"><small>MODERAÇÃO</small><h2>Por que você está denunciando?</h2><label><span>Motivo</span><select name="reason"><option value="SPOILER_NAO_MARCADO">Spoiler não marcado</option><option value="OFENSA_OU_ASSEDIO">Ofensa ou assédio</option><option value="DISCURSO_DE_ODIO">Discurso de ódio</option><option value="SPAM">Spam</option><option value="CONTEUDO_IMPROPRIO">Conteúdo impróprio</option><option value="FORA_DO_ASSUNTO">Fora do assunto</option><option value="OUTRO">Outro</option></select></label><label><span>Detalhes opcionais</span><textarea name="details" maxlength="700" placeholder="Ajude a equipe a entender o contexto"></textarea></label><footer><button type="button" data-nx50-report-close>Cancelar</button><button type="submit">Enviar denúncia</button></footer></form>`;
    document.body.append(layer);
    const close = () => layer.remove();
    layer.querySelectorAll('[data-nx50-report-close]').forEach(button => button.onclick = close);
    layer.querySelector('form').onsubmit = async event => {
      event.preventDefault(); const submit = event.currentTarget.querySelector('[type="submit"]'); submit.disabled = true;
      try { await privateApi('/api/reports', { method: 'POST', body: JSON.stringify({ reportType, targetId, reason: event.currentTarget.elements.reason.value, details: event.currentTarget.elements.details.value.trim() || undefined }) }); close(); toast('Denúncia enviada para a moderação.'); }
      catch { submit.disabled = false; toast('Não foi possível enviar a denúncia agora.'); }
    };
  }

  function impressionCard(item, reading, own = false) {
    const status = statusLabel(item.status_snapshot || item.statusSnapshot, reading), progress = item.progress_snapshot ?? item.progressSnapshot, score = item.score_snapshot ?? item.scoreSnapshot;
    const context = [status, stageLabel(item.impression_stage || item.impressionStage), progress != null ? `${reading ? 'CAP.' : 'EP'} ${Number(progress)}` : '', score != null ? `★ ${Number(score).toFixed(1).replace('.0', '')}` : ''].filter(Boolean);
    const username = handle(item), name = actor(item);
    return `<article class="nx50-card nx50-impression-card" data-nx50-impression="${esc(item.id)}"><header><i>${avatar(item)}</i><div>${username ? `<a href="${pageUrl(`/u/${encodeURIComponent(username)}`)}">${esc(name)}</a>` : `<strong>${esc(name)}</strong>`}<span>${context.map(esc).join(' · ')}</span></div><time datetime="${esc(item.created_at)}">${esc(relative(item.created_at))}${item.edited_at ? ' · editado' : ''}</time></header><p class="nx50-body">${renderBody(item)}</p><footer><button type="button" class="nx50-like" data-nx50-like="IMPRESSION:${esc(item.id)}" aria-pressed="false" aria-label="Curtir impressão">♡ <b>${Number(item.likes_count ?? item.likesCount) || 0}</b></button><button type="button" data-nx50-open-replies="${esc(item.id)}">↩ <b>${Number(item.replies_count ?? item.repliesCount) || 0}</b> respostas</button>${own ? `<button type="button" data-nx50-edit="${esc(item.id)}">Editar</button><button type="button" data-nx50-delete="${esc(item.id)}">Excluir</button>` : `<button type="button" data-nx50-report="${esc(item.id)}" data-nx50-report-type="IMPRESSION">Denunciar</button>`}</footer><div class="nx50-replies" data-nx50-replies="${esc(item.id)}" hidden></div></article>`;
  }

  function replyCard(item, type, parentName = '', own = false) {
    const depth = Math.min(2, Math.max(0, Number(item.depth) || 0));
    return `<article class="nx50-reply" style="--nx50-depth:${depth}" data-nx50-reply="${esc(item.id)}"><header><i>${avatar(item)}</i><div><strong>${esc(actor(item))}</strong>${Number(item.depth) >= 3 && parentName ? `<span>@${esc(handle(item) || actor(item))} respondeu a @${esc(parentName)}</span>` : ''}</div><time>${esc(relative(item.created_at))}${item.edited_at ? ' · editado' : ''}</time></header><p class="nx50-body">${renderBody(item)}</p><footer><button type="button" class="nx50-like" data-nx50-like="${type}:${esc(item.id)}" aria-pressed="false">♡ <b>${Number(item.likes_count ?? item.likesCount) || 0}</b></button><button type="button" data-nx50-reply-to="${esc(item.id)}" data-nx50-reply-name="${esc(handle(item) || actor(item))}">Responder</button>${own ? `<button type="button" data-nx50-edit="${esc(item.id)}">Editar</button><button type="button" data-nx50-delete="${esc(item.id)}">Excluir</button>` : `<button type="button" data-nx50-report="${esc(item.id)}" data-nx50-report-type="${type}">Denunciar</button>`}</footer></article>`;
  }

  function composerMarkup(kind, episode = null) {
    const impression = kind === 'impression';
    return `<form class="nx50-composer" data-nx50-composer="${kind}"><header><strong>${impression ? 'Compartilhe sua impressão' : `Comentando sobre o episódio ${episode}`}</strong><span>${impression ? 'Sua opinião geral sobre a obra' : 'Converse sobre este episódio com a comunidade'}</span></header><textarea maxlength="${impression ? 1200 : 3000}" required placeholder="${impression ? 'O que você está achando desta obra?' : 'O que você achou deste episódio?'}"></textarea><div class="nx50-editor-tools">${spoilerButton}${impression ? '<label>Momento da impressão <select name="stage"><option value="PRELIMINARY">Preliminar</option><option value="FINAL">Final</option></select></label>' : ''}<span data-nx50-count>0/${impression ? 1200 : 3000}</span></div><footer><span>Use <b>||trecho||</b> para esconder somente o spoiler.</span><button type="submit">Publicar</button></footer></form>`;
  }

  function bindComposer(form, submit) {
    const textarea = form.querySelector('textarea'), count = form.querySelector('[data-nx50-count]');
    textarea.oninput = () => count.textContent = `${textarea.value.length}/${textarea.maxLength}`;
    form.querySelector('[data-nx50-mark-spoiler]').onclick = () => toggleSpoilerMarkup(textarea);
    form.onsubmit = async event => {
      event.preventDefault(); const button = form.querySelector('[type="submit"]'), text = textarea.value.trim();
      if (!text || !await requireAccount()) return;
      button.disabled = true;
      try { await submit(text, form); textarea.value = ''; textarea.dispatchEvent(new Event('input')); }
      catch (error) { if (error.status === 401) go('/login'); else toast('Não foi possível publicar agora.'); }
      finally { button.disabled = false; }
    };
  }

  async function mountImpressions(detail) {
    const host = detail.host, reading = detail.type === 'MANGA', endpoint = `/api/${reading ? 'manga' : 'anime'}/${Number(detail.id)}/impressions`;
    if (!host) return;
    host.innerHTML = `<div class="nx50-social"><header class="nx50-social-head"><div><small>COMUNIDADE</small><h2>Impressões dos membros</h2><p>Sua opinião geral sobre a obra, registrada com status, progresso e nota daquele momento.</p></div><div class="nx50-filters"><button type="button" class="active" data-nx50-sort="recent">Recentes</button><button type="button" data-nx50-sort="popular">Populares</button><label><input type="checkbox" data-nx50-hide checked> Ocultar spoilers</label></div></header><div data-nx50-access></div><div class="nx50-list" data-nx50-list aria-live="polite"><div class="nx22-panel-loading"><i></i><i></i><span>Carregando impressões…</span></div></div></div>`;
    const list = host.querySelector('[data-nx50-list]'), access = host.querySelector('[data-nx50-access]');
    let sort = 'recent', hideSpoilers = true;
    const load = async () => {
      try {
        const [data, user] = await Promise.all([publicApi(`${endpoint}?sort=${sort}&hideSpoilers=${hideSpoilers}`), account()]), items = data.items || [], username = String(user?.username || '').toLowerCase();
        if (!host.isConnected) return;
        list.innerHTML = items.length ? items.map(item => impressionCard(item, reading, Boolean(username && handle(item).toLowerCase() === username))).join('') : '<div class="nx50-empty"><b>Primeiras impressões a caminho</b><p>Quando alguém compartilhar uma opinião sobre esta obra, ela aparecerá aqui.</p></div>';
        bindSocialActions(list, null, { items, endpoint: itemId => `/api/impressions/${itemId}`, maxLength: 1200, refresh: load });
        hydrateLikes(list, 'IMPRESSION', items.map(item => item.id));
        list.querySelectorAll('[data-nx50-open-replies]').forEach(button => button.onclick = () => toggleReplies(button.dataset.nx50OpenReplies));
      } catch { list.innerHTML = '<div class="nx50-empty error"><b>As impressões estão temporariamente indisponíveis</b><button type="button" data-nx50-retry>Tentar novamente</button></div>'; list.querySelector('[data-nx50-retry]')?.addEventListener('click', load, { once: true }); }
    };
    const renderAccess = async () => {
      const user = await account(); if (!host.isConnected) return;
      if (!user) { access.innerHTML = '<button type="button" class="nx50-login-cta">Entre na sua conta para publicar uma impressão</button>'; access.querySelector('button').onclick = () => requireAccount(); return; }
      access.innerHTML = composerMarkup('impression');
      bindComposer(access.querySelector('form'), async (text, form) => { await privateApi(endpoint, { method: 'POST', body: JSON.stringify({ text, impressionStage: form.elements.stage.value }) }); await load(); toast('Impressão publicada.'); });
    };
    const toggleReplies = async impressionId => {
      const box = list.querySelector(`[data-nx50-replies="${CSS.escape(impressionId)}"]`); if (!box) return;
      if (!box.hidden) { box.hidden = true; return; }
      box.hidden = false; box.innerHTML = '<p class="nx50-loading">Carregando respostas…</p>';
      const paint = async (replyTo = null, replyName = '') => {
        try {
          const [data, user] = await Promise.all([publicApi(`/api/impressions/${impressionId}/replies?hideSpoilers=${hideSpoilers}`), account()]), items = data.items || [], byId = new Map(items.map(item => [item.id, item])), username = String(user?.username || '').toLowerCase();
          box.innerHTML = `${items.map(item => replyCard(item, 'IMPRESSION_REPLY', handle(byId.get(item.parent_id)), Boolean(username && handle(item).toLowerCase() === username))).join('') || '<p class="nx50-no-replies">Ainda não há respostas.</p>'}${composerMarkup('reply')}`;
          const form = box.querySelector('form'); form.querySelector('header strong').textContent = replyTo ? `Respondendo a @${replyName}` : 'Responder à impressão'; form.querySelector('header span').textContent = 'A conversa permanece ligada a esta impressão.';
          bindComposer(form, async text => { await privateApi(`/api/impressions/${impressionId}/replies`, { method: 'POST', body: JSON.stringify({ text, parentId: replyTo }) }); await paint(); toast('Resposta publicada.'); });
          bindSocialActions(box, paint, { items, endpoint: replyId => `/api/impressions/${impressionId}/replies/${replyId}`, maxLength: 3000, refresh: paint }); hydrateLikes(box, 'IMPRESSION_REPLY', items.map(item => item.id));
          if (replyTo) form.querySelector('textarea').focus();
        } catch { box.innerHTML = '<p class="nx50-no-replies">As respostas não carregaram agora.</p>'; }
      };
      await paint();
    };
    host.querySelectorAll('[data-nx50-sort]').forEach(button => button.onclick = () => { sort = button.dataset.nx50Sort; host.querySelectorAll('[data-nx50-sort]').forEach(item => item.classList.toggle('active', item === button)); load(); });
    host.querySelector('[data-nx50-hide]').onchange = event => { hideSpoilers = event.target.checked; load(); };
    await Promise.all([renderAccess(), load()]);
  }

  function commentCard(item, episode, byId, own = false) {
    const parentName = handle(byId.get(item.parent_id));
    return `<article class="nx50-card nx50-comment-card" style="--nx50-depth:${Math.min(2, Math.max(0, Number(item.depth) || 0))}" data-nx50-comment="${esc(item.id)}"><header><i>${avatar(item)}</i><div><strong>${esc(actor(item))}</strong><span>EP ${episode}${Number(item.depth) >= 3 && parentName ? ` · respondeu a @${esc(parentName)}` : ''}</span></div><time>${esc(relative(item.created_at))}${item.edited_at ? ' · editado' : ''}</time></header><p class="nx50-body">${renderBody(item)}</p><footer><button type="button" class="nx50-like" data-nx50-like="ANIME_COMMENT:${esc(item.id)}" aria-pressed="false">♡ <b>${Number(item.likes_count ?? item.likesCount) || 0}</b></button><button type="button" data-nx50-reply-to="${esc(item.id)}" data-nx50-reply-name="${esc(handle(item) || actor(item))}">Responder</button>${own ? `<button type="button" data-nx50-edit="${esc(item.id)}">Editar</button><button type="button" data-nx50-delete="${esc(item.id)}">Excluir</button>` : `<button type="button" data-nx50-report="${esc(item.id)}" data-nx50-report-type="ANIME_COMMENT">Denunciar</button>`}</footer></article>`;
  }

  async function mountComments(detail) {
    const host = detail.host, id = Number(detail.id), state = window.AniNexusMediaState?.get?.(id) || {};
    if (!host) return;
    let episode = Math.max(1, Number(state.progress) || 1), sort = 'recent', hideSpoilers = true, override = false;
    host.innerHTML = `<div class="nx50-social nx50-comments"><header class="nx50-social-head"><div><small>POR EPISÓDIO</small><h2>Comentários</h2><p>Converse sobre um episódio específico sem misturar essa conversa com sua impressão geral.</p></div></header><div class="nx50-comment-toolbar"><label><span>Ir para episódio</span><input type="number" min="1" max="100000" value="${episode}" data-nx50-episode></label>${Number(state.progress) > 0 ? `<button type="button" data-nx50-my-progress>Até onde assisti · EP ${Number(state.progress)}</button>` : ''}<div><button type="button" class="active" data-nx50-sort="recent">Recentes</button><button type="button" data-nx50-sort="popular">Populares</button></div><label class="nx50-hide"><input type="checkbox" data-nx50-hide checked> Ocultar spoilers</label></div><div data-nx50-warning></div><div data-nx50-access></div><div class="nx50-list" data-nx50-list aria-live="polite"></div></div>`;
    const list = host.querySelector('[data-nx50-list]'), access = host.querySelector('[data-nx50-access]'), warning = host.querySelector('[data-nx50-warning]');
    const endpoint = () => `/api/anime/${id}/episodes/${episode}/comments`;
    const paintAccess = async (replyTo = null, replyName = '') => {
      const user = await account(); if (!host.isConnected) return;
      if (!user) { access.innerHTML = '<button type="button" class="nx50-login-cta">Entre na sua conta para comentar este episódio</button>'; access.querySelector('button').onclick = requireAccount; return; }
      access.innerHTML = composerMarkup('comment', episode); if (replyTo) { access.querySelector('header strong').textContent = `Respondendo a @${replyName}`; access.querySelector('header span').textContent = `A resposta continua na conversa do episódio ${episode}.`; }
      bindComposer(access.querySelector('form'), async text => { await privateApi(endpoint(), { method: 'POST', body: JSON.stringify({ text, parentId: replyTo }) }); await load(true); await paintAccess(); toast(replyTo ? 'Resposta publicada.' : 'Comentário publicado.'); });
      if (replyTo) access.querySelector('textarea').focus();
    };
    const load = async skipCheck => {
      warning.innerHTML = ''; list.innerHTML = '<div class="nx22-panel-loading"><i></i><i></i><span>Carregando comentários…</span></div>';
      try {
        if (!skipCheck && !override) {
          const checkPath = `${endpoint()}/spoiler-check`, check = await account() ? await privateApi(checkPath) : await publicApi(checkPath);
          if (!check.allowed && Number(check.episodesAhead) > 0) {
            list.innerHTML = '';
            warning.innerHTML = `<section class="nx50-progress-warning"><b>Você ainda não chegou aqui</b><p>Este episódio está ${Number(check.episodesAhead)} ${Number(check.episodesAhead) === 1 ? 'episódio' : 'episódios'} à frente do seu progresso. Os comentários podem conter spoilers.</p><div><button type="button" data-nx50-back-progress>Voltar ao EP ${Number(check.userProgress) || 1}</button><button type="button" data-nx50-view-anyway>Ver mesmo assim</button></div></section>`;
            warning.querySelector('[data-nx50-back-progress]').onclick = () => { episode = Math.max(1, Number(check.userProgress) || 1); host.querySelector('[data-nx50-episode]').value = episode; override = false; paintAccess(); load(); };
            warning.querySelector('[data-nx50-view-anyway]').onclick = () => { override = true; load(true); };
            return;
          }
        }
        const [data, user] = await Promise.all([publicApi(`${endpoint()}?sort=${sort}&hideSpoilers=${hideSpoilers}`), account()]), items = data.items || [], byId = new Map(items.map(item => [item.id, item])), username = String(user?.username || '').toLowerCase();
        list.innerHTML = items.length ? items.map(item => commentCard(item, episode, byId, Boolean(username && handle(item).toLowerCase() === username))).join('') : '<div class="nx50-empty"><b>Nenhum comentário neste episódio</b><p>Comece uma conversa breve e respeitosa sobre o que aconteceu.</p></div>';
        bindSocialActions(list, paintAccess, { items, endpoint: commentId => `${endpoint()}/${commentId}`, maxLength: 3000, refresh: () => load(true) }); hydrateLikes(list, 'ANIME_COMMENT', items.map(item => item.id));
      } catch { list.innerHTML = '<div class="nx50-empty error"><b>Os comentários não carregaram agora</b><button type="button" data-nx50-retry>Tentar novamente</button></div>'; list.querySelector('[data-nx50-retry]')?.addEventListener('click', () => load(true), { once: true }); }
    };
    const chooseEpisode = value => { episode = Math.max(1, Math.min(100000, Number(value) || 1)); host.querySelector('[data-nx50-episode]').value = episode; override = false; paintAccess(); load(); };
    host.querySelector('[data-nx50-episode]').onchange = event => chooseEpisode(event.target.value);
    host.querySelector('[data-nx50-my-progress]')?.addEventListener('click', () => chooseEpisode(state.progress));
    host.querySelectorAll('[data-nx50-sort]').forEach(button => button.onclick = () => { sort = button.dataset.nx50Sort; host.querySelectorAll('[data-nx50-sort]').forEach(item => item.classList.toggle('active', item === button)); load(true); });
    host.querySelector('[data-nx50-hide]').onchange = event => { hideSpoilers = event.target.checked; load(true); };
    await Promise.all([paintAccess(), load()]);
  }

  addEventListener('aninexus:detail-panel', event => {
    if (event.detail?.key === 'impressoes') mountImpressions(event.detail);
    if (event.detail?.key === 'comentarios' && event.detail?.type === 'ANIME') mountComments(event.detail);
  });
})();
