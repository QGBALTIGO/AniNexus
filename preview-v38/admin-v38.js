'use strict';
(() => {
  if (window.__ANINEXUS_ADMIN_V38__) return;
  window.__ANINEXUS_ADMIN_V38__ = true;
  const app = document.querySelector('#app');
  if (!app) return;
  const isPages = location.hostname.endsWith('github.io');
  const base = isPages ? '/AniNexus' : '';
  const auth = () => window.AniNexusAuth;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const routeUrl = path => isPages ? `${base}/?build=40.7.0&p=${encodeURIComponent(path)}` : path;
  const route = () => { const url = new URL(location.href); let path = url.searchParams.get('p') || url.pathname; if (isPages && !url.searchParams.get('p')) path = path.replace(/^\/AniNexus/, '') || '/'; return String(path).split('?')[0].replace(/\/+$/, '') || '/'; };
  const formatDate = value => { if (!value) return '—'; const date = new Date(value); return Number.isNaN(date.valueOf()) ? '—' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date); };
  const statusLabel = { active: 'Ativa', suspended: 'Suspensa', banned: 'Banida', open: 'Aberta', reviewing: 'Em análise', resolved: 'Resolvida', dismissed: 'Descartada' };
  let me = null;
  let mounting = false;
  let state = { tab: 'overview', users: [], reports: [], audit: [], overview: null, userSearch: '', userStatus: '' };

  function activate() {
    document.body.classList.remove('nx35-news-active', 'nx35-home-active', 'aqx-home-active', 'nx38-auth-active', 'nx38-library-active');
    document.body.classList.add('nx38-admin-active');
    document.querySelectorAll('[data-nav]').forEach(link => link.classList.remove('active'));
  }
  function announce(message, tone = '') {
    const node = document.querySelector('#nx38AdminNotice');
    if (!node) return;
    node.className = `nx38-admin-notice ${tone}`.trim();
    node.textContent = message;
  }
  function pageShell(content) {
    return `<main class="nx38-admin-page"><div class="nx38-admin-shell"><header class="nx38-admin-hero"><div><span>PAINEL ANINEXUS</span><h1>Administração</h1><p>Usuários, comunidade, denúncias e histórico de ações em um só lugar.</p></div><a href="${routeUrl('/minha-conta')}">Voltar à conta</a></header>${content}<p id="nx38AdminNotice" class="nx38-admin-notice" role="status" aria-live="polite"></p></div></main>`;
  }
  function accessState(title, text, link = '/') {
    app.innerHTML = pageShell(`<section class="nx38-admin-access"><img src="${base}/assets/logo.png" alt=""><h2>${esc(title)}</h2><p>${esc(text)}</p><a href="${routeUrl(link)}">${link === '/login' ? 'Entrar na conta' : 'Voltar ao AniNexus'}</a></section>`);
    finish();
  }
  function tabs() {
    const items = [['overview', 'Visão geral'], ['users', 'Usuários'], ['reports', 'Denúncias']];
    if (me?.role === 'admin') items.push(['audit', 'Auditoria']);
    return `<nav class="nx38-admin-tabs" aria-label="Seções administrativas" role="tablist">${items.map(([id, label]) => `<button type="button" role="tab" aria-selected="${state.tab === id}" class="${state.tab === id ? 'active' : ''}" data-admin-tab="${id}">${label}</button>`).join('')}</nav>`;
  }
  function metric(label, value, hint = '') { return `<article class="nx38-admin-metric"><small>${esc(label)}</small><strong>${Number(value || 0).toLocaleString('pt-BR')}</strong>${hint ? `<span>${esc(hint)}</span>` : ''}</article>`; }
  function overviewView() {
    const data = state.overview || {}, users = data.users || {}, reports = data.reports || {}, content = data.content || {};
    return `<section class="nx38-admin-section" role="tabpanel"><div class="nx38-admin-section-head"><div><span>AGORA</span><h2>Saúde da comunidade</h2><p>Números operacionais sem expor informações privadas.</p></div><button type="button" data-admin-refresh>Atualizar</button></div><div class="nx38-admin-metrics">${metric('CONTAS ATIVAS', users.active)}${metric('NOVAS EM 7 DIAS', users.new_week)}${metric('DENÚNCIAS ABERTAS', reports.open)}${metric('EM ANÁLISE', reports.reviewing)}${metric('IMPRESSÕES PÚBLICAS', content.impressions)}${metric('DISCUSSÕES', content.threads)}</div><div class="nx38-admin-status-grid"><article><h3>Moderação de contas</h3><dl><div><dt>Total</dt><dd>${Number(users.total || 0)}</dd></div><div><dt>Suspensas</dt><dd>${Number(users.suspended || 0)}</dd></div><div><dt>Banidas</dt><dd>${Number(users.banned || 0)}</dd></div></dl></article><article><h3>Conteúdo da comunidade</h3><dl><div><dt>Discussões</dt><dd>${Number(content.threads || 0)}</dd></div><div><dt>Respostas</dt><dd>${Number(content.posts || 0)}</dd></div><div><dt>Impressões</dt><dd>${Number(content.impressions || 0)}</dd></div></dl></article></div></section>`;
  }
  function userCard(user) {
    const name = user.display_name || user.username || 'Usuário';
    const initials = String(name).trim().slice(0, 1).toUpperCase();
    const own = user.id === me?.id;
    return `<article class="nx38-admin-user" data-user-id="${esc(user.id)}"><div class="nx38-admin-user-main"><i>${user.avatar_url ? `<img src="${esc(user.avatar_url)}" alt="">` : esc(initials)}</i><div><h3>${esc(name)} ${own ? '<small>VOCÊ</small>' : ''}</h3><p>@${esc(user.username)} · ${esc(user.email)}</p><span>Entrou ${formatDate(user.created_at)} · visto ${formatDate(user.last_seen_at)}</span></div></div><div class="nx38-admin-user-meta"><span class="status-${esc(user.status)}">${esc(statusLabel[user.status] || user.status)}</span><span>${esc(user.role === 'admin' ? 'Administrador' : user.role === 'moderator' ? 'Moderador' : 'Usuário')}</span><span>${Number(user.list_count || 0)} na lista</span><span>${Number(user.impression_count || 0)} impressões</span></div>${own ? '' : `<div class="nx38-admin-user-actions">${user.status !== 'active' ? '<button type="button" data-user-action="activate">Reativar</button>' : '<button type="button" data-user-action="suspend">Suspender</button><button class="danger" type="button" data-user-action="ban">Banir</button>'}${me?.role === 'admin' ? `<button type="button" data-user-action="role">${user.role === 'moderator' ? 'Remover moderação' : 'Definir função'}</button>` : ''}</div>`}</article>`;
  }
  function usersView() {
    return `<section class="nx38-admin-section" role="tabpanel"><div class="nx38-admin-section-head"><div><span>CONTAS</span><h2>Usuários</h2><p>Busque, revise e aplique medidas com justificativa registrada.</p></div></div><form class="nx38-admin-filters" id="nx38UserFilters"><label><span>Buscar usuário</span><input type="search" name="search" value="${esc(state.userSearch)}" placeholder="Nome, @usuário ou e-mail" autocomplete="off"></label><label><span>Status</span><select name="status"><option value="">Todos</option>${['active', 'suspended', 'banned'].map(value => `<option value="${value}" ${state.userStatus === value ? 'selected' : ''}>${statusLabel[value]}</option>`).join('')}</select></label><button type="submit">Buscar</button></form><div class="nx38-admin-list">${state.users.length ? state.users.map(userCard).join('') : '<div class="nx38-admin-empty"><strong>Nenhuma conta encontrada</strong><p>Ajuste a busca ou o filtro de status.</p></div>'}</div></section>`;
  }
  function reportCard(report) {
    const reporter = report.reporter_name || report.reporter_username || 'Visitante';
    const contentType = { THREAD: 'Discussão', POST: 'Resposta', IMPRESSION: 'Impressão', USER: 'Usuário' }[report.target_type] || report.target_type;
    return `<article class="nx38-admin-report" data-report-id="${esc(report.id)}"><div><span class="status-${esc(report.status)}">${esc(statusLabel[report.status] || report.status)}</span><small>${esc(contentType)} · ${formatDate(report.created_at)}</small></div><h3>${esc(report.reason)}</h3><p>Enviada por ${esc(reporter)}</p><div class="nx38-admin-report-actions"><label><span>Situação</span><select data-report-status>${['open', 'reviewing', 'resolved', 'dismissed'].map(value => `<option value="${value}" ${report.status === value ? 'selected' : ''}>${statusLabel[value]}</option>`).join('')}</select></label>${report.target_type !== 'USER' ? '<button class="danger" type="button" data-hide-reported>Ocultar conteúdo</button>' : ''}</div></article>`;
  }
  function reportsView() {
    return `<section class="nx38-admin-section" role="tabpanel"><div class="nx38-admin-section-head"><div><span>TRIAGEM</span><h2>Denúncias</h2><p>Trate cada item e mantenha as decisões registradas.</p></div><button type="button" data-admin-refresh>Atualizar</button></div><div class="nx38-admin-list">${state.reports.length ? state.reports.map(reportCard).join('') : '<div class="nx38-admin-empty"><strong>Fila limpa</strong><p>Não há denúncias neste momento.</p></div>'}</div></section>`;
  }
  function auditView() {
    return `<section class="nx38-admin-section" role="tabpanel"><div class="nx38-admin-section-head"><div><span>RASTREABILIDADE</span><h2>Histórico administrativo</h2><p>Ações sensíveis, responsáveis e horários.</p></div><button type="button" data-admin-refresh>Atualizar</button></div><div class="nx38-admin-audit">${state.audit.length ? state.audit.map(item => `<article><i></i><div><h3>${esc(item.action)}</h3><p>${esc(item.actor_name || item.actor_username || 'Sistema')} · ${esc(item.target_type || 'GERAL')}</p><span>${formatDate(item.created_at)}</span></div></article>`).join('') : '<div class="nx38-admin-empty"><strong>Sem ações registradas</strong></div>'}</div></section>`;
  }
  function view() {
    const current = state.tab === 'users' ? usersView() : state.tab === 'reports' ? reportsView() : state.tab === 'audit' ? auditView() : overviewView();
    app.innerHTML = pageShell(`${tabs()}${current}`);
    bind();
    finish();
  }
  function finish() {
    document.documentElement.classList.remove('nx38-auth-boot');
    document.documentElement.classList.add('nx38-auth-ready');
    dispatchEvent(new CustomEvent('aninexus:auth-v38-ready'));
    app.focus({ preventScroll: true });
  }
  async function load(section = state.tab) {
    state.tab = section;
    if (section === 'overview') state.overview = await auth().api('/api/admin/overview');
    if (section === 'users') {
      const params = new URLSearchParams({ limit: '60' });
      if (state.userSearch) params.set('search', state.userSearch);
      if (state.userStatus) params.set('status', state.userStatus);
      state.users = (await auth().api(`/api/admin/users?${params}`)).items || [];
    }
    if (section === 'reports') state.reports = (await auth().api('/api/admin/reports?limit=80')).items || [];
    if (section === 'audit' && me?.role === 'admin') state.audit = (await auth().api('/api/admin/audit-log?limit=100')).items || [];
  }
  function decisionDialog({ title, text, confirm = 'Confirmar', danger = false, role = false, suspension = false }) {
    return new Promise(resolve => {
      const layer = document.createElement('div'); layer.className = 'nx38-admin-dialog-layer'; layer.setAttribute('role', 'dialog'); layer.setAttribute('aria-modal', 'true');
      layer.innerHTML = `<form class="nx38-admin-dialog"><span>DECISÃO ADMINISTRATIVA</span><h2>${esc(title)}</h2><p>${esc(text)}</p>${role ? '<label><span>Função</span><select name="role"><option value="user">Usuário</option><option value="moderator">Moderador</option><option value="admin">Administrador</option></select></label>' : ''}${suspension ? '<label><span>Duração</span><select name="duration"><option value="24">24 horas</option><option value="168">7 dias</option><option value="720">30 dias</option></select></label>' : ''}<label><span>Justificativa obrigatória</span><textarea name="reason" minlength="3" maxlength="1000" required placeholder="Descreva o motivo de forma objetiva."></textarea></label><div><button type="button" data-cancel>Cancelar</button><button type="submit" class="${danger ? 'danger' : ''}">${esc(confirm)}</button></div><p role="alert"></p></form>`;
      document.body.append(layer); const form = layer.querySelector('form'), reason = form.elements.reason;
      const close = result => { layer.remove(); resolve(result); };
      layer.querySelector('[data-cancel]').onclick = () => close(null);
      layer.addEventListener('click', event => { if (event.target === layer) close(null); });
      layer.addEventListener('keydown', event => { if (event.key === 'Escape') close(null); });
      form.onsubmit = event => { event.preventDefault(); const value = reason.value.trim(); if (value.length < 3) { form.querySelector('[role="alert"]').textContent = 'Explique o motivo em pelo menos 3 caracteres.'; return; } close({ reason: value, role: form.elements.role?.value, hours: Number(form.elements.duration?.value || 0) }); };
      reason.focus();
    });
  }
  async function moderateUser(card, action) {
    const user = state.users.find(item => item.id === card.dataset.userId); if (!user) return;
    let body;
    if (action === 'activate') { const answer = await decisionDialog({ title: `Reativar ${user.display_name || user.username}?`, text: 'A conta voltará a acessar e publicar normalmente.', confirm: 'Reativar conta' }); if (!answer) return; body = { status: 'active', reason: answer.reason }; }
    if (action === 'suspend') { const answer = await decisionDialog({ title: `Suspender ${user.display_name || user.username}?`, text: 'A conta perderá o acesso pelo período escolhido e o conteúdo público ficará oculto.', confirm: 'Suspender conta', danger: true, suspension: true }); if (!answer) return; body = { status: 'suspended', suspendUntil: new Date(Date.now() + answer.hours * 3600_000).toISOString(), reason: answer.reason }; }
    if (action === 'ban') { const answer = await decisionDialog({ title: `Banir ${user.display_name || user.username}?`, text: 'A conta perderá o acesso por tempo indeterminado e o conteúdo público ficará oculto.', confirm: 'Banir conta', danger: true }); if (!answer) return; body = { status: 'banned', reason: answer.reason }; }
    if (action === 'role') { const answer = await decisionDialog({ title: `Alterar função de ${user.display_name || user.username}`, text: 'Administradores possuem acesso total. Moderadores podem tratar usuários comuns, conteúdo e denúncias.', confirm: 'Salvar função', role: true }); if (!answer) return; body = { role: answer.role, reason: answer.reason }; }
    if (!body) return;
    try { await auth().api(`/api/admin/users/${encodeURIComponent(user.id)}/moderation`, { method: 'PATCH', body: JSON.stringify(body) }); await load('users'); view(); announce('A alteração foi salva e registrada na auditoria.', 'success'); }
    catch (error) { announce(error?.code === 'CANNOT_MODERATE_SELF' ? 'Você não pode reduzir o acesso da própria conta.' : 'Não foi possível concluir esta ação.', 'error'); }
  }
  function bind() {
    document.querySelectorAll('[data-admin-tab]').forEach(button => button.onclick = async () => { if (button.dataset.adminTab === state.tab) return; app.querySelector('.nx38-admin-section').setAttribute('aria-busy', 'true'); try { await load(button.dataset.adminTab); view(); } catch { announce('Não foi possível carregar esta seção.', 'error'); } });
    document.querySelectorAll('[data-admin-refresh]').forEach(button => button.onclick = async () => { button.disabled = true; try { await load(); view(); announce('Dados atualizados.', 'success'); } catch { button.disabled = false; announce('Não foi possível atualizar agora.', 'error'); } });
    document.querySelector('#nx38UserFilters')?.addEventListener('submit', async event => { event.preventDefault(); const data = new FormData(event.currentTarget); state.userSearch = String(data.get('search') || '').trim().slice(0, 120); state.userStatus = String(data.get('status') || ''); try { await load('users'); view(); } catch { announce('A busca não pôde ser concluída.', 'error'); } });
    document.querySelectorAll('[data-user-action]').forEach(button => button.onclick = () => moderateUser(button.closest('[data-user-id]'), button.dataset.userAction));
    document.querySelectorAll('[data-report-status]').forEach(select => select.onchange = async () => { const card = select.closest('[data-report-id]'); select.disabled = true; try { await auth().api(`/api/admin/reports/${encodeURIComponent(card.dataset.reportId)}`, { method: 'PATCH', body: JSON.stringify({ status: select.value }) }); const report = state.reports.find(item => item.id === card.dataset.reportId); if (report) report.status = select.value; view(); announce('Situação da denúncia atualizada.', 'success'); } catch { select.disabled = false; announce('Não foi possível atualizar a denúncia.', 'error'); } });
    document.querySelectorAll('[data-hide-reported]').forEach(button => button.onclick = async () => { const card = button.closest('[data-report-id]'), report = state.reports.find(item => item.id === card.dataset.reportId); if (!report) return; const answer = await decisionDialog({ title: 'Ocultar conteúdo denunciado?', text: 'O item deixará de aparecer publicamente. A decisão será registrada.', confirm: 'Ocultar conteúdo', danger: true }); if (!answer) return; try { await auth().api(`/api/admin/content/${report.target_type}/${encodeURIComponent(report.target_id)}`, { method: 'PATCH', body: JSON.stringify({ hidden: true, reason: answer.reason }) }); await auth().api(`/api/admin/reports/${encodeURIComponent(report.id)}`, { method: 'PATCH', body: JSON.stringify({ status: 'resolved' }) }); await load('reports'); view(); announce('Conteúdo ocultado e denúncia resolvida.', 'success'); } catch { announce('O conteúdo não pôde ser ocultado.', 'error'); } });
  }
  async function mount() {
    if (route() !== '/admin') { document.body.classList.remove('nx38-admin-active'); return; }
    if (mounting) return;
    mounting = true;
    activate(); document.title = 'Administração | AniNexus'; document.querySelector('meta[name="robots"]')?.setAttribute('content', 'noindex,nofollow');
    app.innerHTML = pageShell('<section class="nx38-admin-loading" aria-busy="true"><i></i><strong>Preparando administração…</strong></section>');
    try {
      if (!auth()?.enabled) { accessState('Administração indisponível', 'O acesso seguro precisa estar ativo para abrir este painel.'); return; }
      const clerk = await auth().ready(); if (!clerk?.user) { location.replace(routeUrl('/login')); return; }
      me = (await auth().api('/api/me'))?.user;
      if (!['moderator', 'admin'].includes(me?.role)) { accessState('Acesso restrito', 'Esta área é exclusiva para a equipe de moderação.'); return; }
      await load('overview'); view();
    } catch (error) {
      if (error?.status === 401) { location.replace(routeUrl('/login')); return; }
      accessState('Não foi possível abrir o painel', 'A conexão segura falhou. Nenhuma alteração foi realizada.');
    } finally { mounting = false; }
  }
  const push = history.pushState.bind(history), replace = history.replaceState.bind(history);
  history.pushState = function (...args) { const result = push(...args); queueMicrotask(mount); return result; };
  history.replaceState = function (...args) { const result = replace(...args); queueMicrotask(mount); return result; };
  addEventListener('popstate', () => queueMicrotask(mount));
  new MutationObserver(() => {
    if (route() === '/admin' && !app.querySelector('.nx38-admin-page') && !mounting) queueMicrotask(mount);
  }).observe(app, { childList: true });
  setTimeout(mount, 0);
})();
