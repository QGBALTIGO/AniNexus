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
  let accountIdentity = null;
  addEventListener('aninexus:account-identity-changed', event => { accountIdentity = event.detail?.user || null; });
  const account = async () => {
    if (accountIdentity) return accountIdentity;
    try {
      const clerkUser = await window.AniNexusAuth?.getUser?.();
      if (!clerkUser) return null;
      try { accountIdentity = (await privateApi('/api/me'))?.user || clerkUser; }
      catch { accountIdentity = clerkUser; }
      return accountIdentity;
    } catch { return null; }
  };
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
    ? `<span class="nx50-spoiler${item.hideSpoilers === false ? ' revealed' : ''}" data-nx50-spoiler role="button" tabindex="0" aria-label="Revelar trecho com spoiler"><span>${esc(segment.content)}</span><b>Toque para revelar</b></span>`
    : `<span>${esc(segment.content)}</span>`).join('');
  const statusLabel = (status, reading) => ({ PLANNING: reading ? 'Quero ler' : 'Quero ver', CURRENT: reading ? 'Lendo' : 'Assistindo', COMPLETED: 'Concluído', PAUSED: 'Pausado', DROPPED: 'Desisti' })[status] || '';
  const stageLabel = value => value === 'FINAL' ? 'Final' : 'Preliminar';
  const ICON = {
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.5a5.5 5.5 0 0 0 0-7.8Z"/></svg>',
    reply: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/></svg>',
    flag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4m0 1h10l-1.5 3L15 11H5"/></svg>',
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.2-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Zm9.7-12.5 3 3"/></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></svg>',
    eyeOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.3A10.7 10.7 0 0 1 12 4c5.2 0 9 5 9 5a15.8 15.8 0 0 1-2.5 2.8M6.2 6.2C4.2 7.5 3 9 3 9s3.8 5 9 5c1 0 2-.2 2.8-.5"/></svg>',
    help: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.3 2.3 0 1 1 3.6 1.9c-.9.6-1.4 1-1.4 2.1M12 17h.01"/></svg>',
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10"/></svg>',
    arrowRight: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M14 7.5l4.5 4.5-4.5 4.5"/></svg>',
  };
  const toast = message => {
    const root = document.querySelector('#toastRoot');
    if (!root) return;
    const note = document.createElement('div'); note.className = 'toast'; note.textContent = message; root.append(note); setTimeout(() => note.remove(), 2600);
  };
  const spoilerButton = `<button class="nx50-mark-spoiler" type="button" data-nx50-mark-spoiler aria-label="Marcar trecho selecionado como spoiler" title="Marcar como spoiler">${ICON.eyeOff}</button>`;

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
    root.querySelectorAll('[data-nx50-spoiler]').forEach(spoiler => {
      const toggle = () => {
        spoiler.classList.toggle('revealed');
        spoiler.setAttribute('aria-label', spoiler.classList.contains('revealed') ? 'Ocultar trecho com spoiler' : 'Revelar trecho com spoiler');
      };
      spoiler.onclick = toggle;
      spoiler.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); } };
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
      const targetId = button.dataset.nx50Delete;
      openDelete(async () => {
        await privateApi(options.endpoint(targetId), { method: 'DELETE' });
        await options.refresh?.();
        toast('Publicação excluída.');
      }, { cascade: typeof options.cascade === 'function' ? options.cascade(targetId) : Boolean(options.cascade), subject: options.subject });
    });
    root.querySelectorAll('[data-nx50-moderate]').forEach(button => button.onclick = () => {
      const targetType = button.dataset.nx50ModerateType, targetId = button.dataset.nx50Moderate;
      if (!targetType || !targetId) return;
      openDelete(async () => {
        await privateApi(`/api/admin/content/${encodeURIComponent(targetType)}/${encodeURIComponent(targetId)}`, { method: 'PATCH', body: JSON.stringify({ hidden: true }) });
        await options.refresh?.();
        toast('Publicação removida pela moderação.');
      }, { moderation: true, cascade: typeof options.cascade === 'function' ? options.cascade(targetId) : Boolean(options.cascade), subject: options.subject });
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

  function openDelete(remove, { moderation = false, cascade = false, subject = 'publicação' } = {}) {
    document.querySelector('.nx50-report-layer')?.remove();
    const layer = document.createElement('div'); layer.className = 'nx50-report-layer';
    const feminine = ['impressão', 'publicação', 'resposta'].includes(String(subject).toLowerCase());
    const consequence = cascade
      ? `${feminine ? 'A' : 'O'} ${esc(subject)} e todas as respostas ligadas a ${feminine ? 'ela' : 'ele'} deixarão de aparecer para a comunidade.`
      : `${feminine ? 'Esta' : 'Este'} ${esc(subject)} deixará de aparecer para a comunidade.`;
    layer.innerHTML = `<button type="button" class="nx50-report-backdrop" data-nx50-dialog-close aria-label="Cancelar exclusão"></button><section class="nx50-report-dialog nx50-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="nx50DeleteTitle"><small>${moderation ? 'MODERAÇÃO' : 'EXCLUIR'}</small><h2 id="nx50DeleteTitle">${moderation ? `Remover ${esc(subject)}?` : `Excluir ${esc(subject)}?`}</h2><p>${consequence}</p><footer><button type="button" data-nx50-dialog-close>Cancelar</button><button type="button" class="nx50-danger" data-nx50-delete-confirm>${moderation ? 'Remover' : 'Excluir'}</button></footer></section>`;
    document.body.append(layer);
    const close = () => layer.remove(); layer.querySelectorAll('[data-nx50-dialog-close]').forEach(button => button.onclick = close);
    layer.querySelector('[data-nx50-delete-confirm]').onclick = async event => {
      event.currentTarget.disabled = true;
      try { await remove(); close(); } catch { event.currentTarget.disabled = false; toast('Não foi possível excluir agora.'); }
    };
  }

  function openSocialHelp(kind = 'impression') {
    document.querySelector('.nx50-report-layer')?.remove();
    const layer = document.createElement('div'); layer.className = 'nx50-report-layer';
    const news = kind === 'news';
    const steps = news ? [
      ['Comente a notícia.', 'Compartilhe uma opinião ou informação relacionada à publicação.'],
      ['Responda à comunidade.', 'As respostas permanecem ligadas ao comentário principal e podem receber curtidas.'],
      ['Marque somente o spoiler.', 'Selecione o trecho revelador e use o botão de spoiler. Cada trecho pode ser revelado separadamente.'],
      ['Ajude na moderação.', 'Spoilers não marcados, ataques, preconceito, assédio e spam podem ser denunciados.'],
    ] : [
      ['Publique uma impressão.', 'Compartilhe uma reação, opinião ou teoria sobre a obra. Ela fica pública com seu nome de usuário.'],
      ['Dê contexto automaticamente.', 'Seu status, progresso e nota atuais são registrados no momento da publicação.'],
      ['Proteja quem ainda não chegou lá.', 'Selecione somente o trecho revelador e use o botão de spoiler. Ele fica oculto até o leitor escolher revelar.'],
      ['Ajude a manter o AniNexus positivo.', 'Spoilers não marcados, ataques, preconceito, assédio e spam podem ser denunciados e removidos pela moderação.'],
    ];
    layer.innerHTML = `<button type="button" class="nx50-report-backdrop" data-nx50-dialog-close aria-label="Fechar ajuda"></button><section class="nx50-report-dialog nx50-help-dialog" role="dialog" aria-modal="true" aria-labelledby="nx50HelpTitle"><button type="button" class="nx50-dialog-x" data-nx50-dialog-close aria-label="Fechar ajuda">×</button><h2 id="nx50HelpTitle">Como funcionam ${news ? 'os comentários' : 'as impressões'}</h2><ol>${steps.map((step, index) => `<li><b>${index + 1}</b><p><strong>${esc(step[0])}</strong> ${esc(step[1])}</p></li>`).join('')}</ol></section>`;
    document.body.append(layer);
    layer.querySelectorAll('[data-nx50-dialog-close]').forEach(button => button.onclick = () => layer.remove());
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

  function itemActions(item, type, own, canModerate) {
    const id = esc(item.id);
    if (own) return `<button type="button" class="nx50-icon-action" data-nx50-edit="${id}" aria-label="Editar publicação" title="Editar">${ICON.edit}</button><button type="button" class="nx50-icon-action danger" data-nx50-delete="${id}" aria-label="Excluir publicação" title="Excluir">${ICON.trash}</button>`;
    return `<button type="button" class="nx50-icon-action" data-nx50-report="${id}" data-nx50-report-type="${type}" aria-label="Denunciar publicação" title="Denunciar">${ICON.flag}</button>${canModerate ? `<button type="button" class="nx50-icon-action danger" data-nx50-moderate="${id}" data-nx50-moderate-type="${type}" aria-label="Remover publicação como moderador" title="Remover pela moderação">${ICON.trash}</button>` : ''}`;
  }

  function impressionCard(item, reading, own = false, canModerate = false) {
    const status = statusLabel(item.status_snapshot || item.statusSnapshot, reading), progress = item.progress_snapshot ?? item.progressSnapshot, score = item.score_snapshot ?? item.scoreSnapshot;
    const context = `${status ? `<span class="nx50-status" data-status="${esc(item.status_snapshot || item.statusSnapshot || '')}">${esc(status)}</span>` : ''}<span>${esc(stageLabel(item.impression_stage || item.impressionStage))}</span>${progress != null ? `<span>${reading ? 'no cap.' : 'no ep'} ${Number(progress)}</span>` : ''}${score != null ? `<span class="nx50-score">${ICON.star}${esc(Number(score).toFixed(1).replace('.0', ''))}</span>` : ''}`;
    const username = handle(item), name = actor(item);
    return `<article class="nx50-card nx50-impression-card" data-nx50-impression="${esc(item.id)}"><header><i>${avatar(item)}</i><div class="nx50-author"><div class="nx50-byline">${username ? `<a href="${pageUrl(`/u/${encodeURIComponent(username)}`)}">@${esc(username)}</a>` : `<strong>${esc(name)}</strong>`}<time datetime="${esc(item.created_at)}">${esc(relative(item.created_at))}${item.edited_at ? ' · editado' : ''}</time></div><div class="nx50-context">${context}</div></div><div class="nx50-card-actions">${itemActions(item, 'IMPRESSION', own, canModerate)}</div></header><p class="nx50-body">${renderBody(item)}</p><footer><button type="button" class="nx50-like" data-nx50-like="IMPRESSION:${esc(item.id)}" aria-pressed="false" aria-label="Curtir impressão">${ICON.heart}<b>${Number(item.likes_count ?? item.likesCount) || 0}</b></button><button type="button" class="nx50-reply-action" data-nx50-open-replies="${esc(item.id)}" aria-label="Abrir respostas">${ICON.reply}<b>${Number(item.replies_count ?? item.repliesCount) || 0}</b><span>respostas</span></button></footer><div class="nx50-replies" data-nx50-replies="${esc(item.id)}" hidden></div></article>`;
  }

  function newsCommentCard(item, own = false, canModerate = false) {
    const username = handle(item), name = actor(item);
    return `<article class="nx50-card nx50-news-card" data-nx50-news-comment="${esc(item.id)}"><header><i>${avatar(item)}</i><div class="nx50-author"><div class="nx50-byline">${username ? `<a href="${pageUrl(`/u/${encodeURIComponent(username)}`)}">@${esc(username)}</a>` : `<strong>${esc(name)}</strong>`}<time datetime="${esc(item.created_at)}">${esc(relative(item.created_at))}${item.edited_at ? ' · editado' : ''}</time></div></div><div class="nx50-card-actions">${itemActions(item, 'NEWS_COMMENT', own, canModerate)}</div></header><p class="nx50-body">${renderBody(item)}</p><footer><button type="button" class="nx50-like" data-nx50-like="NEWS_COMMENT:${esc(item.id)}" aria-pressed="false" aria-label="Curtir comentário">${ICON.heart}<b>${Number(item.likes_count ?? item.likesCount) || 0}</b></button><button type="button" class="nx50-reply-action" data-nx50-open-news-replies="${esc(item.id)}" aria-label="Abrir respostas">${ICON.reply}<b>${Number(item.replies_count ?? item.repliesCount) || 0}</b><span>respostas</span></button></footer><div class="nx50-replies" data-nx50-news-replies="${esc(item.id)}" hidden></div></article>`;
  }

  function replyCard(item, type, parentName = '', own = false, canModerate = false) {
    const depth = Math.min(2, Math.max(0, Number(item.depth) || 0));
    const username = handle(item), name = actor(item);
    return `<article class="nx50-reply" style="--nx50-depth:${depth}" data-nx50-reply="${esc(item.id)}"><header><i>${avatar(item)}</i><div class="nx50-author"><div class="nx50-byline">${username ? `<a href="${pageUrl(`/u/${encodeURIComponent(username)}`)}">@${esc(username)}</a>` : `<strong>${esc(name)}</strong>`}<time>${esc(relative(item.created_at))}${item.edited_at ? ' · editado' : ''}</time></div>${Number(item.depth) >= 3 && parentName ? `<span>@${esc(username || name)} respondeu a @${esc(parentName)}</span>` : ''}</div><div class="nx50-card-actions">${itemActions(item, type, own, canModerate)}</div></header><p class="nx50-body">${renderBody(item)}</p><footer><button type="button" class="nx50-like" data-nx50-like="${type}:${esc(item.id)}" aria-pressed="false" aria-label="Curtir resposta">${ICON.heart}<b>${Number(item.likes_count ?? item.likesCount) || 0}</b></button><button type="button" class="nx50-reply-action" data-nx50-reply-to="${esc(item.id)}" data-nx50-reply-name="${esc(username || name)}">${ICON.reply}<span>Responder</span></button></footer></article>`;
  }

  function composerMarkup(kind) {
    const impression = kind === 'impression';
    const news = kind === 'news', reply = !impression && !news;
    const limit = news ? 1800 : 2000;
    const header = reply ? '<header><strong>Responder à publicação</strong><span>A conversa permanece ligada à publicação principal.</span></header>' : '';
    const helpKind = news ? 'news' : 'impression';
    const placeholder = impression ? 'Compartilhe uma reação, opinião ou teoria...' : news ? 'Compartilhe sua opinião sobre esta notícia...' : 'Escreva uma resposta respeitosa...';
    const hint = impression ? 'Seu status, progresso e nota serão registrados neste momento.' : 'Selecione um trecho antes de marcá-lo como spoiler.';
    const help = reply ? '' : `<button class="nx50-help" type="button" data-nx50-help="${helpKind}" aria-label="Como funcionam ${news ? 'os comentários' : 'as impressões'}" title="Como funcionam ${news ? 'os comentários' : 'as impressões'}">${ICON.help}</button>`;
    return `<form class="nx50-composer" data-nx50-composer="${kind}">${header}<div class="nx50-editor-frame"><div class="nx50-editor-bar">${spoilerButton}${help}</div><textarea maxlength="${limit}" required placeholder="${placeholder}"></textarea></div><footer><span>${hint}</span><div><b data-nx50-count>0/${limit}</b><button type="submit">Publicar</button></div></footer></form>`;
  }

  function loginPrompt(kind = 'impression') {
    const news = kind === 'news';
    return `<section class="nx50-login-prompt"><i aria-hidden="true">${ICON.lock}</i><div><small>CONTA ANINEXUS</small><strong>Participe da ${news ? 'conversa' : 'comunidade'}</strong><span>Entre para publicar ${news ? 'um comentário nesta notícia' : 'sua impressão sobre a obra'}.</span></div><button type="button" class="nx50-login-cta" aria-label="Entre na sua conta para publicar ${news ? 'um comentário' : 'uma impressão'}"><span>Entrar para publicar</span>${ICON.arrowRight}</button></section>`;
  }

  function bindComposer(form, submit) {
    const textarea = form.querySelector('textarea'), count = form.querySelector('[data-nx50-count]');
    textarea.oninput = () => count.textContent = `${textarea.value.length}/${textarea.maxLength}`;
    form.querySelector('[data-nx50-mark-spoiler]').onclick = () => toggleSpoilerMarkup(textarea);
    form.querySelector('[data-nx50-help]')?.addEventListener('click', event => openSocialHelp(event.currentTarget.dataset.nx50Help));
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
    host.innerHTML = `<div class="nx50-social"><div data-nx50-access></div><div class="nx50-filters"><div><button type="button" class="active" data-nx50-sort="popular">Populares</button><button type="button" data-nx50-sort="recent">Recentes</button></div><label class="nx50-spoiler-filter"><input type="checkbox" data-nx50-hide checked><i aria-hidden="true"></i><span>Ocultar spoilers</span></label></div><div class="nx50-list" data-nx50-list aria-live="polite"><div class="nx22-panel-loading"><i></i><i></i><span>Carregando impressões…</span></div></div></div>`;
    const list = host.querySelector('[data-nx50-list]'), access = host.querySelector('[data-nx50-access]');
    let sort = 'popular', hideSpoilers = true, currentUser = null;
    const load = async (knownUser = currentUser) => {
      try {
        const [data, resolvedUser] = await Promise.all([publicApi(`${endpoint}?sort=${sort}&hideSpoilers=${hideSpoilers}`), knownUser ? Promise.resolve(knownUser) : account()]), user = resolvedUser || null, items = data.items || [], username = String(user?.username || '').toLowerCase(), canModerate = ['moderator', 'admin'].includes(String(user?.role || '').toLowerCase());
        currentUser = user;
        if (!host.isConnected) return;
        list.innerHTML = items.length ? items.map(item => impressionCard(item, reading, Boolean(username && handle(item).toLowerCase() === username), canModerate)).join('') : '<div class="nx50-empty"><b>Primeiras impressões a caminho</b><p>Quando alguém compartilhar uma opinião sobre esta obra, ela aparecerá aqui.</p></div>';
        bindSocialActions(list, null, { items, endpoint: itemId => `/api/impressions/${itemId}`, targetType: 'IMPRESSION', maxLength: 2000, refresh: load, cascade: true, subject: 'impressão' });
        hydrateLikes(list, 'IMPRESSION', items.map(item => item.id));
        list.querySelectorAll('[data-nx50-open-replies]').forEach(button => button.onclick = () => toggleReplies(button.dataset.nx50OpenReplies));
      } catch { list.innerHTML = '<div class="nx50-empty error"><b>As impressões estão temporariamente indisponíveis</b><button type="button" data-nx50-retry>Tentar novamente</button></div>'; list.querySelector('[data-nx50-retry]')?.addEventListener('click', load, { once: true }); }
    };
    const renderAccess = async (knownUser) => {
      const user = knownUser === undefined ? await account() : knownUser; currentUser = user || null; if (!host.isConnected) return user;
      if (!user) { access.innerHTML = loginPrompt('impression'); access.querySelector('button').onclick = () => requireAccount(); return null; }
      access.innerHTML = composerMarkup('impression');
      bindComposer(access.querySelector('form'), async text => { await privateApi(endpoint, { method: 'POST', body: JSON.stringify({ text }) }); await load(); toast('Impressão publicada.'); });
      return user;
    };
    const toggleReplies = async impressionId => {
      const box = list.querySelector(`[data-nx50-replies="${CSS.escape(impressionId)}"]`); if (!box) return;
      if (!box.hidden) { box.hidden = true; return; }
      box.hidden = false; box.innerHTML = '<p class="nx50-loading">Carregando respostas…</p>';
      const paint = async (replyTo = null, replyName = '') => {
        try {
          const [data, resolvedUser] = await Promise.all([publicApi(`/api/impressions/${impressionId}/replies?hideSpoilers=${hideSpoilers}`), currentUser ? Promise.resolve(currentUser) : account()]), user = resolvedUser || null, items = data.items || [], byId = new Map(items.map(item => [item.id, item])), username = String(user?.username || '').toLowerCase(), canModerate = ['moderator', 'admin'].includes(String(user?.role || '').toLowerCase());
          currentUser = user;
          box.innerHTML = `${items.map(item => replyCard(item, 'IMPRESSION_REPLY', handle(byId.get(item.parent_id)), Boolean(username && handle(item).toLowerCase() === username), canModerate)).join('') || '<p class="nx50-no-replies">Ainda não há respostas.</p>'}${composerMarkup('reply')}`;
          const form = box.querySelector('form'); form.querySelector('header strong').textContent = replyTo ? `Respondendo a @${replyName}` : 'Responder à impressão'; form.querySelector('header span').textContent = 'A conversa permanece ligada a esta impressão.';
          bindComposer(form, async text => { await privateApi(`/api/impressions/${impressionId}/replies`, { method: 'POST', body: JSON.stringify({ text, parentId: replyTo }) }); await paint(); toast('Resposta publicada.'); });
          bindSocialActions(box, paint, { items, endpoint: replyId => `/api/impressions/${impressionId}/replies/${replyId}`, targetType: 'IMPRESSION_REPLY', maxLength: 2000, refresh: paint }); hydrateLikes(box, 'IMPRESSION_REPLY', items.map(item => item.id));
          if (replyTo) form.querySelector('textarea').focus();
        } catch { box.innerHTML = '<p class="nx50-no-replies">As respostas não carregaram agora.</p>'; }
      };
      await paint();
    };
    host.querySelectorAll('[data-nx50-sort]').forEach(button => button.onclick = () => { sort = button.dataset.nx50Sort; host.querySelectorAll('[data-nx50-sort]').forEach(item => item.classList.toggle('active', item === button)); load(); });
    host.querySelector('[data-nx50-hide]').onchange = event => { hideSpoilers = event.target.checked; load(); };
    if (host._nx50IdentityHandler) removeEventListener('aninexus:account-identity-changed', host._nx50IdentityHandler);
    host._nx50IdentityHandler = async event => {
      if (!host.isConnected) { removeEventListener('aninexus:account-identity-changed', host._nx50IdentityHandler); return; }
      const user = event.detail?.user || null; currentUser = user; await renderAccess(user); await load(user);
    };
    addEventListener('aninexus:account-identity-changed', host._nx50IdentityHandler);
    const user = await renderAccess();
    await load(user);
  }

  async function mountNewsComments(slug, host) {
    if (!slug || !host) return;
    const mounted = host.querySelector('.nx50-news-comments');
    if (mounted?.dataset.nx50NewsSlug === slug) return;
    mounted?.remove();
    const endpoint = `/api/news/${encodeURIComponent(slug)}/comments`;
    const section = document.createElement('section');
    section.className = 'nx42-news-comments nx50-news-comments';
    section.dataset.nx50NewsSlug = slug;
    section.innerHTML = `<header><small>CONVERSA</small><h2>Comentários da comunidade</h2><p>Opine sobre a notícia e converse com outros membros.</p></header><div class="nx50-social"><div data-nx50-access></div><div class="nx50-filters"><div><button type="button" class="active" data-nx50-sort="popular">Populares</button><button type="button" data-nx50-sort="recent">Recentes</button></div><label class="nx50-spoiler-filter"><input type="checkbox" data-nx50-hide checked><i aria-hidden="true"></i><span>Ocultar spoilers</span></label></div><div class="nx50-list" data-nx50-list aria-live="polite"><p class="nx50-loading">Carregando comentários…</p></div></div>`;
    host.append(section);
    const list = section.querySelector('[data-nx50-list]'), access = section.querySelector('[data-nx50-access]');
    let sort = 'popular', hideSpoilers = true, currentUser = null, allItems = [], openRoot = null;
    const identity = user => ({ username: String(user?.username || '').toLowerCase(), canModerate: ['moderator', 'admin'].includes(String(user?.role || '').toLowerCase()) });
    const itemIsOwn = (item, username) => Boolean(username && handle(item).toLowerCase() === username);
    const rootFor = item => String(item.root_id || item.rootId || item.id);

    const paintReplies = async (rootId, replyTo = null, replyName = '') => {
      const box = list.querySelector(`[data-nx50-news-replies="${CSS.escape(rootId)}"]`);
      if (!box) return;
      openRoot = rootId;
      box.hidden = false;
      const { username, canModerate } = identity(currentUser), byId = new Map(allItems.map(item => [String(item.id), item]));
      const replies = allItems.filter(item => Number(item.depth) > 0 && rootFor(item) === rootId);
      box.innerHTML = `${replies.map(item => replyCard(item, 'NEWS_COMMENT', handle(byId.get(String(item.parent_id))), itemIsOwn(item, username), canModerate)).join('') || '<p class="nx50-no-replies">Ainda não há respostas.</p>'}${composerMarkup('reply')}`;
      const form = box.querySelector('form');
      form.querySelector('header strong').textContent = replyTo ? `Respondendo a @${replyName}` : 'Responder ao comentário';
      form.querySelector('header span').textContent = 'A conversa permanece ligada a esta notícia.';
      bindComposer(form, async text => {
        await privateApi(endpoint, { method: 'POST', body: JSON.stringify({ text, parentId: replyTo }) });
        await load(currentUser, rootId);
        toast('Resposta publicada.');
      });
      bindSocialActions(box, (targetId, name) => paintReplies(rootId, targetId, name), {
        items: replies,
        endpoint: commentId => `${endpoint}/${commentId}`,
        targetType: 'NEWS_COMMENT',
        maxLength: 1800,
        refresh: () => load(currentUser, rootId),
        cascade: false,
        subject: 'resposta',
      });
      hydrateLikes(box, 'NEWS_COMMENT', replies.map(item => item.id));
      if (replyTo) form.querySelector('textarea').focus();
    };

    const load = async (knownUser = currentUser, reopenRoot = openRoot) => {
      try {
        const [data, resolvedUser] = await Promise.all([publicApi(`${endpoint}?sort=${sort}&hideSpoilers=${hideSpoilers}`), knownUser ? Promise.resolve(knownUser) : account()]);
        currentUser = resolvedUser || null;
        if (!section.isConnected) return;
        allItems = data.items || [];
        const roots = allItems.filter(item => Number(item.depth) === 0 || !item.parent_id);
        const { username, canModerate } = identity(currentUser);
        list.innerHTML = roots.length ? roots.map(item => newsCommentCard(item, itemIsOwn(item, username), canModerate)).join('') : '<div class="nx50-empty"><b>A conversa começa com você</b><p>Compartilhe uma opinião respeitosa sobre esta notícia.</p></div>';
        bindSocialActions(list, null, {
          items: roots,
          endpoint: commentId => `${endpoint}/${commentId}`,
          targetType: 'NEWS_COMMENT',
          maxLength: 1800,
          refresh: () => load(currentUser),
          cascade: targetId => Number(roots.find(item => String(item.id) === String(targetId))?.depth || 0) === 0,
          subject: 'comentário',
        });
        hydrateLikes(list, 'NEWS_COMMENT', roots.map(item => item.id));
        list.querySelectorAll('[data-nx50-open-news-replies]').forEach(button => button.onclick = () => {
          const rootId = button.dataset.nx50OpenNewsReplies, box = list.querySelector(`[data-nx50-news-replies="${CSS.escape(rootId)}"]`);
          if (!box) return;
          if (!box.hidden) { box.hidden = true; openRoot = null; return; }
          paintReplies(rootId);
        });
        if (reopenRoot && list.querySelector(`[data-nx50-news-replies="${CSS.escape(reopenRoot)}"]`)) await paintReplies(reopenRoot);
      } catch {
        list.innerHTML = '<div class="nx50-empty error"><b>Os comentários estão temporariamente indisponíveis</b><button type="button" data-nx50-retry>Tentar novamente</button></div>';
        list.querySelector('[data-nx50-retry]')?.addEventListener('click', () => load(currentUser), { once: true });
      }
    };

    const renderAccess = async knownUser => {
      const user = knownUser === undefined ? await account() : knownUser;
      currentUser = user || null;
      if (!section.isConnected) return user;
      if (!user) {
        access.innerHTML = loginPrompt('news');
        access.querySelector('button').onclick = () => requireAccount();
        return null;
      }
      access.innerHTML = composerMarkup('news');
      bindComposer(access.querySelector('form'), async text => {
        await privateApi(endpoint, { method: 'POST', body: JSON.stringify({ text }) });
        await load(currentUser);
        toast('Comentário publicado.');
      });
      return user;
    };

    section.querySelectorAll('[data-nx50-sort]').forEach(button => button.onclick = () => {
      sort = button.dataset.nx50Sort;
      section.querySelectorAll('[data-nx50-sort]').forEach(item => item.classList.toggle('active', item === button));
      load(currentUser);
    });
    section.querySelector('[data-nx50-hide]').onchange = event => { hideSpoilers = event.target.checked; load(currentUser); };
    section._nx50IdentityHandler = async event => {
      if (!section.isConnected) { removeEventListener('aninexus:account-identity-changed', section._nx50IdentityHandler); return; }
      const user = event.detail?.user || null;
      await renderAccess(user);
      await load(user);
    };
    addEventListener('aninexus:account-identity-changed', section._nx50IdentityHandler);
    const user = await renderAccess();
    await load(user);
  }

  function mountCurrentNewsComments() {
    const match = route().match(/^\/noticias\/(.+)$/), host = document.querySelector('.nx35-reader .nx35-article-main');
    if (match && host) mountNewsComments(decodeURIComponent(match[1]), host);
  }

  addEventListener('aninexus:detail-panel', event => {
    if (event.detail?.key === 'impressoes') mountImpressions(event.detail);
  });
  addEventListener('aninexus:news-v32-ready', mountCurrentNewsComments);
  addEventListener('aninexus:route-ready', () => setTimeout(mountCurrentNewsComments, 0));
  addEventListener('popstate', () => setTimeout(mountCurrentNewsComments, 0));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(mountCurrentNewsComments, 0), { once: true });
  else setTimeout(mountCurrentNewsComments, 0);
})();
