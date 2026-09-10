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
      openDelete(async () => {
        await privateApi(options.endpoint(button.dataset.nx50Delete), { method: 'DELETE' });
        await options.refresh?.();
        toast('Publicação excluída.');
      });
    });
    root.querySelectorAll('[data-nx50-moderate]').forEach(button => button.onclick = () => {
      const targetType = button.dataset.nx50ModerateType, targetId = button.dataset.nx50Moderate;
      if (!targetType || !targetId) return;
      openDelete(async () => {
        await privateApi(`/api/admin/content/${encodeURIComponent(targetType)}/${encodeURIComponent(targetId)}`, { method: 'PATCH', body: JSON.stringify({ hidden: true }) });
        await options.refresh?.();
        toast('Publicação removida pela moderação.');
      }, true);
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

  function openDelete(remove, moderation = false) {
    document.querySelector('.nx50-report-layer')?.remove();
    const layer = document.createElement('div'); layer.className = 'nx50-report-layer';
    layer.innerHTML = `<button type="button" class="nx50-report-backdrop" data-nx50-dialog-close aria-label="Cancelar exclusão"></button><section class="nx50-report-dialog nx50-delete-dialog" role="dialog" aria-modal="true"><small>${moderation ? 'MODERAÇÃO' : 'EXCLUIR'}</small><h2>${moderation ? 'Remover esta publicação?' : 'Excluir esta publicação?'}</h2><p>Ela deixará de aparecer para a comunidade.</p><footer><button type="button" data-nx50-dialog-close>Cancelar</button><button type="button" class="nx50-danger" data-nx50-delete-confirm>${moderation ? 'Remover' : 'Excluir'}</button></footer></section>`;
    document.body.append(layer);
    const close = () => layer.remove(); layer.querySelectorAll('[data-nx50-dialog-close]').forEach(button => button.onclick = close);
    layer.querySelector('[data-nx50-delete-confirm]').onclick = async event => {
      event.currentTarget.disabled = true;
      try { await remove(); close(); } catch { event.currentTarget.disabled = false; toast('Não foi possível excluir agora.'); }
    };
  }

  function openImpressionHelp() {
    document.querySelector('.nx50-report-layer')?.remove();
    const layer = document.createElement('div'); layer.className = 'nx50-report-layer';
    const steps = [
      ['Publique uma impressão.', 'Compartilhe uma reação, opinião ou teoria sobre a obra. Ela fica pública com seu nome de usuário.'],
      ['Dê contexto automaticamente.', 'Seu status, progresso e nota atuais são registrados no momento da publicação.'],
      ['Proteja quem ainda não chegou lá.', 'Selecione somente o trecho revelador e use o botão de spoiler. Ele fica oculto até o leitor escolher revelar.'],
      ['Ajude a manter o AniNexus positivo.', 'Spoilers não marcados, ataques, preconceito, assédio e spam podem ser denunciados e removidos pela moderação.'],
    ];
    layer.innerHTML = `<button type="button" class="nx50-report-backdrop" data-nx50-dialog-close aria-label="Fechar ajuda"></button><section class="nx50-report-dialog nx50-help-dialog" role="dialog" aria-modal="true" aria-labelledby="nx50HelpTitle"><button type="button" class="nx50-dialog-x" data-nx50-dialog-close aria-label="Fechar ajuda">×</button><h2 id="nx50HelpTitle">Como funcionam as impressões</h2><ol>${steps.map((step, index) => `<li><b>${index + 1}</b><p><strong>${esc(step[0])}</strong> ${esc(step[1])}</p></li>`).join('')}</ol></section>`;
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

  function replyCard(item, type, parentName = '', own = false, canModerate = false) {
    const depth = Math.min(2, Math.max(0, Number(item.depth) || 0));
    const username = handle(item), name = actor(item);
    return `<article class="nx50-reply" style="--nx50-depth:${depth}" data-nx50-reply="${esc(item.id)}"><header><i>${avatar(item)}</i><div class="nx50-author"><div class="nx50-byline">${username ? `<a href="${pageUrl(`/u/${encodeURIComponent(username)}`)}">@${esc(username)}</a>` : `<strong>${esc(name)}</strong>`}<time>${esc(relative(item.created_at))}${item.edited_at ? ' · editado' : ''}</time></div>${Number(item.depth) >= 3 && parentName ? `<span>@${esc(username || name)} respondeu a @${esc(parentName)}</span>` : ''}</div><div class="nx50-card-actions">${itemActions(item, type, own, canModerate)}</div></header><p class="nx50-body">${renderBody(item)}</p><footer><button type="button" class="nx50-like" data-nx50-like="${type}:${esc(item.id)}" aria-pressed="false" aria-label="Curtir resposta">${ICON.heart}<b>${Number(item.likes_count ?? item.likesCount) || 0}</b></button><button type="button" class="nx50-reply-action" data-nx50-reply-to="${esc(item.id)}" data-nx50-reply-name="${esc(username || name)}">${ICON.reply}<span>Responder</span></button></footer></article>`;
  }

  function composerMarkup(kind) {
    const impression = kind === 'impression';
    const limit = 2000;
    return `<form class="nx50-composer" data-nx50-composer="${kind}">${impression ? '' : '<header><strong>Responder à impressão</strong><span>A conversa permanece ligada a esta impressão.</span></header>'}<div class="nx50-editor-frame"><div class="nx50-editor-bar">${spoilerButton}${impression ? `<button class="nx50-help" type="button" data-nx50-help aria-label="Como funcionam as impressões" title="Como funcionam as impressões">${ICON.help}</button>` : ''}</div><textarea maxlength="${limit}" required placeholder="${impression ? 'Compartilhe uma reação, opinião ou teoria...' : 'Escreva uma resposta respeitosa...'}"></textarea></div><footer><span>${impression ? 'Seu status, progresso e nota serão registrados neste momento.' : 'Selecione um trecho antes de marcá-lo como spoiler.'}</span><div><b data-nx50-count>0/${limit}</b><button type="submit">Publicar</button></div></footer></form>`;
  }

  function bindComposer(form, submit) {
    const textarea = form.querySelector('textarea'), count = form.querySelector('[data-nx50-count]');
    textarea.oninput = () => count.textContent = `${textarea.value.length}/${textarea.maxLength}`;
    form.querySelector('[data-nx50-mark-spoiler]').onclick = () => toggleSpoilerMarkup(textarea);
    form.querySelector('[data-nx50-help]')?.addEventListener('click', openImpressionHelp);
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
    let sort = 'popular', hideSpoilers = true;
    const load = async () => {
      try {
        const [data, user] = await Promise.all([publicApi(`${endpoint}?sort=${sort}&hideSpoilers=${hideSpoilers}`), account()]), items = data.items || [], username = String(user?.username || '').toLowerCase(), canModerate = ['moderator', 'admin'].includes(String(user?.role || '').toLowerCase());
        if (!host.isConnected) return;
        list.innerHTML = items.length ? items.map(item => impressionCard(item, reading, Boolean(username && handle(item).toLowerCase() === username), canModerate)).join('') : '<div class="nx50-empty"><b>Primeiras impressões a caminho</b><p>Quando alguém compartilhar uma opinião sobre esta obra, ela aparecerá aqui.</p></div>';
        bindSocialActions(list, null, { items, endpoint: itemId => `/api/impressions/${itemId}`, maxLength: 2000, refresh: load });
        hydrateLikes(list, 'IMPRESSION', items.map(item => item.id));
        list.querySelectorAll('[data-nx50-open-replies]').forEach(button => button.onclick = () => toggleReplies(button.dataset.nx50OpenReplies));
      } catch { list.innerHTML = '<div class="nx50-empty error"><b>As impressões estão temporariamente indisponíveis</b><button type="button" data-nx50-retry>Tentar novamente</button></div>'; list.querySelector('[data-nx50-retry]')?.addEventListener('click', load, { once: true }); }
    };
    const renderAccess = async () => {
      const user = await account(); if (!host.isConnected) return;
      if (!user) { access.innerHTML = '<button type="button" class="nx50-login-cta">Entre na sua conta para publicar uma impressão</button>'; access.querySelector('button').onclick = () => requireAccount(); return; }
      access.innerHTML = composerMarkup('impression');
      bindComposer(access.querySelector('form'), async text => { await privateApi(endpoint, { method: 'POST', body: JSON.stringify({ text }) }); await load(); toast('Impressão publicada.'); });
    };
    const toggleReplies = async impressionId => {
      const box = list.querySelector(`[data-nx50-replies="${CSS.escape(impressionId)}"]`); if (!box) return;
      if (!box.hidden) { box.hidden = true; return; }
      box.hidden = false; box.innerHTML = '<p class="nx50-loading">Carregando respostas…</p>';
      const paint = async (replyTo = null, replyName = '') => {
        try {
          const [data, user] = await Promise.all([publicApi(`/api/impressions/${impressionId}/replies?hideSpoilers=${hideSpoilers}`), account()]), items = data.items || [], byId = new Map(items.map(item => [item.id, item])), username = String(user?.username || '').toLowerCase(), canModerate = ['moderator', 'admin'].includes(String(user?.role || '').toLowerCase());
          box.innerHTML = `${items.map(item => replyCard(item, 'IMPRESSION_REPLY', handle(byId.get(item.parent_id)), Boolean(username && handle(item).toLowerCase() === username), canModerate)).join('') || '<p class="nx50-no-replies">Ainda não há respostas.</p>'}${composerMarkup('reply')}`;
          const form = box.querySelector('form'); form.querySelector('header strong').textContent = replyTo ? `Respondendo a @${replyName}` : 'Responder à impressão'; form.querySelector('header span').textContent = 'A conversa permanece ligada a esta impressão.';
          bindComposer(form, async text => { await privateApi(`/api/impressions/${impressionId}/replies`, { method: 'POST', body: JSON.stringify({ text, parentId: replyTo }) }); await paint(); toast('Resposta publicada.'); });
          bindSocialActions(box, paint, { items, endpoint: replyId => `/api/impressions/${impressionId}/replies/${replyId}`, maxLength: 2000, refresh: paint }); hydrateLikes(box, 'IMPRESSION_REPLY', items.map(item => item.id));
          if (replyTo) form.querySelector('textarea').focus();
        } catch { box.innerHTML = '<p class="nx50-no-replies">As respostas não carregaram agora.</p>'; }
      };
      await paint();
    };
    host.querySelectorAll('[data-nx50-sort]').forEach(button => button.onclick = () => { sort = button.dataset.nx50Sort; host.querySelectorAll('[data-nx50-sort]').forEach(item => item.classList.toggle('active', item === button)); load(); });
    host.querySelector('[data-nx50-hide]').onchange = event => { hideSpoilers = event.target.checked; load(); };
    await Promise.all([renderAccess(), load()]);
  }

  addEventListener('aninexus:detail-panel', event => {
    if (event.detail?.key === 'impressoes') mountImpressions(event.detail);
  });
})();
