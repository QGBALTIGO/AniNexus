'use strict';
(() => {
  if (window.__ANINEXUS_ADMIN_V38__) return;
  window.__ANINEXUS_ADMIN_V38__ = true;

  const app = document.querySelector('#app');
  if (!app) return;

  const BUILD = '44.55.0';
  const isPages = location.hostname.endsWith('github.io');
  const base = isPages ? '/AniNexus' : '';
  const auth = () => window.AniNexusAuth;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const routeUrl = path => isPages ? base + '/?build=' + BUILD + '&p=' + encodeURIComponent(path) : path;
  const route = () => {
    const url = new URL(location.href);
    let path = url.searchParams.get('p') || url.pathname;
    if (isPages && !url.searchParams.get('p')) path = path.replace(/^\/AniNexus/, '') || '/';
    return String(path).split('?')[0].replace(/\/+$/, '') || '/';
  };

  const ICON = Object.freeze({
    overview: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>',
    reports: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4m0 1h10l-1.5 3L15 11H5"/><path d="M9 15h10v5H9z"/></svg>',
    team: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6m3-3h-6"/></svg>',
    users: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="7" r="4"/><path d="M2 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2M17 7h5m-2.5-2.5v5"/></svg>',
    audit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5h11M9 12h11M9 19h11"/><path d="m3 5 1 1 2-2m-3 8 1 1 2-2m-3 8 1 1 2-2"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
    shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  });

  const statusLabel = { active: 'Ativa', suspended: 'Suspensa', banned: 'Banida', open: 'Aberta', reviewing: 'Em análise', resolved: 'Resolvida', dismissed: 'Descartada' };
  const roleLabel = { user: 'Usuário', moderator: 'Moderador', admin: 'Administrador' };
  const typeLabel = { THREAD: 'Discussão', POST: 'Resposta da comunidade', IMPRESSION: 'Impressão', IMPRESSION_REPLY: 'Resposta à impressão', ANIME_COMMENT: 'Comentário de episódio', NEWS_COMMENT: 'Comentário de notícia', USER: 'Usuário' };
  const reasonLabel = { SPOILER_NAO_MARCADO: 'Spoiler não marcado', OFENSA_OU_ASSEDIO: 'Ofensa ou assédio', DISCURSO_DE_ODIO: 'Discurso de ódio', SPAM: 'Spam', CONTEUDO_IMPROPRIO: 'Conteúdo impróprio', FORA_DO_ASSUNTO: 'Fora do assunto', OUTRO: 'Outro motivo' };
  const auditLabel = { USER_MODERATION: 'Conta atualizada', REPORT_UPDATE: 'Denúncia atualizada', REPORT_CONTENT_HIDE: 'Conteúdo removido', REPORT_DISMISS: 'Denúncia descartada', CONTENT_HIDE: 'Conteúdo ocultado', CONTENT_RESTORE: 'Conteúdo restaurado', USER_DELETE: 'Conta excluída', NEWS_CREATE: 'Notícia criada', NEWS_UPDATE: 'Notícia atualizada' };

  let me = null;
  let mounting = false;
  let loadGeneration = 0;
  let noticeTimer = 0;
  const state = {
    tab: 'overview',
    overview: null,
    users: [],
    reports: [],
    team: [],
    audit: [],
    userSearch: '',
    userStatus: '',
    userRole: '',
    reportStatus: 'active',
    reportType: '',
    reportAssignment: '',
  };

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? '—' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
  }

  function activate() {
    document.body.classList.remove('nx35-news-active', 'nx35-home-active', 'aqx-home-active', 'nx38-auth-active', 'nx38-library-active');
    document.body.classList.add('nx38-admin-active');
    document.querySelectorAll('[data-nav]').forEach(link => link.classList.remove('active'));
  }

  function navigate(path) {
    if (!isPages && window.AniNexusGo?.(path)) return;
    location.assign(routeUrl(path));
  }

  function announce(message, tone = '') {
    const node = document.querySelector('#nx54AdminNotice');
    if (!node) return;
    clearTimeout(noticeTimer);
    node.className = 'nx54-admin-notice ' + tone;
    node.textContent = message;
    noticeTimer = setTimeout(() => {
      if (node.isConnected) node.textContent = '';
    }, 5200);
  }

  function finish() {
    document.documentElement.classList.remove('nx38-auth-boot');
    document.documentElement.classList.add('nx38-auth-ready');
    dispatchEvent(new CustomEvent('aninexus:auth-v38-ready'));
  }

  function roleBadge(role) {
    return '<span class="nx54-role-badge role-' + esc(role) + '">' + esc(roleLabel[role] || role) + '</span>';
  }

  function avatar(user, className = '') {
    const name = user?.display_name || user?.displayName || user?.username || 'Usuário';
    const image = user?.avatar_url || user?.avatarUrl;
    return '<i class="nx54-avatar ' + esc(className) + '">' + (image ? '<img src="' + esc(image) + '" alt="">' : esc(name.trim().slice(0, 1).toUpperCase())) + '</i>';
  }

  function navigationItems() {
    const overview = state.overview || {};
    const reports = overview.reports || {};
    const users = overview.users || {};
    const items = [
      ['overview', 'Visão geral', ICON.overview, ''],
      ['reports', 'Denúncias', ICON.reports, Number(reports.open || 0) + Number(reports.reviewing || 0)],
      ['team', 'Equipe', ICON.team, Number(users.moderators || 0) + Number(users.admins || 0)],
      ['users', 'Usuários', ICON.users, ''],
    ];
    if (me?.role === 'admin') items.push(['audit', 'Auditoria', ICON.audit, '']);
    return items;
  }

  function navigation() {
    return '<nav class="nx54-admin-nav" aria-label="Seções administrativas">' + navigationItems().map(item => {
      const id = item[0], label = item[1], icon = item[2], count = item[3];
      return '<button type="button" class="' + (state.tab === id ? 'active' : '') + '" data-admin-tab="' + id + '" aria-current="' + (state.tab === id ? 'page' : 'false') + '">' + icon + '<span>' + label + '</span>' + (count !== '' ? '<b>' + Number(count) + '</b>' : '') + '</button>';
    }).join('') + '</nav>';
  }

  function pageShell(panel) {
    const title = me?.role === 'admin' ? 'Administração' : 'Moderação';
    const description = me?.role === 'admin' ? 'Contas, equipe e decisões da comunidade em um único painel.' : 'Denúncias e contas da comunidade, com limites claros de acesso.';
    return '<main class="nx38-admin-page nx54-admin-page"><div class="nx54-admin-shell">' +
      '<header class="nx54-admin-head"><div class="nx54-admin-head-copy"><span>FERRAMENTAS DE EQUIPE</span><div><h1>' + title + '</h1>' + roleBadge(me?.role || 'user') + '</div><p>' + description + '</p></div><button type="button" class="nx54-admin-account" data-admin-account>Voltar à conta</button></header>' +
      '<div class="nx54-admin-layout"><aside><div class="nx54-admin-identity">' + avatar(me) + '<span><strong>' + esc(me?.displayName || me?.username || 'Equipe AniNexus') + '</strong><small>@' + esc(me?.username || '') + '</small></span></div>' + navigation() + '<p>' + ICON.lock + ' Todas as decisões ficam registradas.</p></aside><section class="nx54-admin-workspace" data-admin-workspace>' + panel + '</section></div>' +
      '<p id="nx54AdminNotice" class="nx54-admin-notice" role="status" aria-live="polite"></p></div></main>';
  }

  function accessState(title, text, link = '/') {
    app.innerHTML = '<main class="nx38-admin-page nx54-admin-page"><section class="nx54-admin-access"><img src="' + base + '/assets/logo.png" alt=""><span>ACESSO À EQUIPE</span><h1>' + esc(title) + '</h1><p>' + esc(text) + '</p><a href="' + routeUrl(link) + '">' + (link === '/login' ? 'Entrar na conta' : 'Voltar ao AniNexus') + '</a></section></main>';
    finish();
  }

  function sectionHead(eyebrow, title, text, refresh = false) {
    return '<header class="nx54-section-head"><div><span>' + esc(eyebrow) + '</span><h2>' + esc(title) + '</h2><p>' + esc(text) + '</p></div>' + (refresh ? '<button type="button" data-admin-refresh aria-label="Atualizar seção">' + ICON.refresh + '<span>Atualizar</span></button>' : '') + '</header>';
  }

  function metric(label, value, tone = '') {
    return '<article class="nx54-metric ' + esc(tone) + '"><small>' + esc(label) + '</small><strong>' + Number(value || 0).toLocaleString('pt-BR') + '</strong></article>';
  }

  function overviewView() {
    const data = state.overview || {}, users = data.users || {}, reports = data.reports || {}, content = data.content || {};
    const queue = Number(reports.open || 0) + Number(reports.reviewing || 0);
    return sectionHead('VISÃO GERAL', 'Central de operação', 'O que precisa de atenção agora, sem misturar tarefas.', true) +
      '<div class="nx54-metrics">' +
        metric('Contas ativas', users.active) +
        metric('Denúncias abertas', reports.open, Number(reports.open || 0) ? 'attention' : '') +
        metric('Em análise', reports.reviewing) +
        metric('Equipe', Number(users.moderators || 0) + Number(users.admins || 0)) +
      '</div>' +
      '<div class="nx54-overview-grid">' +
        '<article class="nx54-priority ' + (queue ? 'has-work' : '') + '"><div>' + ICON.shield + '<span><small>FILA DE MODERAÇÃO</small><h3>' + (queue ? queue + ' item' + (queue === 1 ? '' : 's') + ' aguardando' : 'Tudo em dia') + '</h3><p>' + (queue ? 'Comece pelas denúncias abertas e assuma cada análise antes de decidir.' : 'Nenhuma denúncia aberta ou em análise neste momento.') + '</p></span></div><button type="button" data-admin-jump="reports">' + (queue ? 'Abrir denúncias' : 'Consultar histórico') + ICON.arrow + '</button></article>' +
        '<article class="nx54-summary"><h3>Comunidade</h3><dl><div><dt>Novas contas em 7 dias</dt><dd>' + Number(users.new_week || 0) + '</dd></div><div><dt>Impressões públicas</dt><dd>' + Number(content.impressions || 0) + '</dd></div><div><dt>Discussões</dt><dd>' + Number(content.threads || 0) + '</dd></div><div><dt>Comentários e respostas</dt><dd>' + (Number(content.comments || 0) + Number(content.posts || 0)) + '</dd></div></dl></article>' +
      '</div>' +
      '<div class="nx54-shortcuts"><button type="button" data-admin-jump="team">' + ICON.team + '<span><strong>Equipe e cargos</strong><small>Veja responsáveis e permissões</small></span>' + ICON.arrow + '</button><button type="button" data-admin-jump="users">' + ICON.users + '<span><strong>Contas da comunidade</strong><small>Busque, suspenda ou reative</small></span>' + ICON.arrow + '</button></div>';
  }

  function reasonParts(reason) {
    const value = String(reason || '').trim();
    const split = value.indexOf(':');
    const code = (split >= 0 ? value.slice(0, split) : value).trim();
    return { label: reasonLabel[code] || code.replaceAll('_', ' ').toLowerCase() || 'Motivo não informado', detail: split >= 0 ? value.slice(split + 1).trim() : '' };
  }

  function reportCard(report) {
    const reason = reasonParts(report.reason);
    const reporter = report.reporter_display_name || report.reporter_username || 'Conta removida';
    const targetAuthor = report.target_display_name || report.target_username || (report.target_type === 'USER' ? 'Conta denunciada' : 'Autor não disponível');
    const excerpt = String(report.target_excerpt || '').trim();
    const active = ['open', 'reviewing'].includes(report.status);
    const mine = report.assigned_to === me?.id;
    const canHide = report.target_type !== 'USER' && report.target_exists !== false;
    const contentState = report.target_exists === false ? '<span class="nx54-target-state missing">Conteúdo não localizado</span>' : report.target_hidden ? '<span class="nx54-target-state hidden">Já ocultado</span>' : '';
    let actions = '';
    if (active) {
      if (!mine) actions += '<button type="button" data-report-action="claim">Assumir análise</button>';
      if (canHide) actions += '<button type="button" class="danger" data-report-action="hide">' + (report.target_hidden ? 'Confirmar e resolver' : 'Ocultar e resolver') + '</button>';
      actions += '<button type="button" data-report-action="dismiss">Descartar denúncia</button>';
    } else {
      actions = '<button type="button" data-report-action="reopen">Reabrir análise</button>';
    }
    return '<article class="nx54-report" data-report-id="' + esc(report.id) + '">' +
      '<header><div><span class="nx54-status status-' + esc(report.status) + '">' + esc(statusLabel[report.status] || report.status) + '</span><span class="nx54-type">' + esc(typeLabel[report.target_type] || report.target_type) + '</span></div><time datetime="' + esc(report.created_at) + '">' + formatDate(report.created_at) + '</time></header>' +
      '<div class="nx54-report-reason"><small>MOTIVO</small><h3>' + esc(reason.label) + '</h3>' + (reason.detail ? '<p>' + esc(reason.detail) + '</p>' : '') + '</div>' +
      '<blockquote class="' + (!excerpt ? 'empty' : '') + '"><small>CONTEÚDO DENUNCIADO · ' + esc(targetAuthor) + '</small>' + contentState + '<p>' + esc(excerpt || 'O conteúdo original não está mais disponível para visualização.') + '</p>' + (report.target_context_title ? '<cite>' + esc(report.target_context_title) + '</cite>' : '') + '</blockquote>' +
      '<footer><div><span>Denunciado por <strong>' + esc(reporter) + '</strong></span><span>Responsável: <strong>' + esc(report.assignee_display_name || report.assignee_username || 'ninguém') + '</strong></span>' + (report.resolution ? '<span>Decisão: <strong>' + esc(report.resolution) + '</strong></span>' : '') + '</div><div class="nx54-report-actions">' + actions + '</div></footer>' +
    '</article>';
  }

  function reportsView() {
    const options = Object.entries(typeLabel).filter(entry => entry[0] !== 'USER').map(entry => '<option value="' + entry[0] + '" ' + (state.reportType === entry[0] ? 'selected' : '') + '>' + esc(entry[1]) + '</option>').join('');
    return sectionHead('MODERAÇÃO', 'Denúncias', 'Veja o contexto, assuma a análise e registre uma decisão.', true) +
      '<form class="nx54-filters nx54-report-filters" id="nx54ReportFilters"><label><span>Situação</span><select name="status"><option value="active" ' + (state.reportStatus === 'active' ? 'selected' : '') + '>Abertas e em análise</option><option value="">Todas</option>' + ['open', 'reviewing', 'resolved', 'dismissed'].map(value => '<option value="' + value + '" ' + (state.reportStatus === value ? 'selected' : '') + '>' + statusLabel[value] + '</option>').join('') + '</select></label><label><span>Tipo de conteúdo</span><select name="type"><option value="">Todos</option>' + options + '</select></label><label><span>Responsável</span><select name="assignment"><option value="">Todos</option><option value="mine" ' + (state.reportAssignment === 'mine' ? 'selected' : '') + '>Minhas análises</option><option value="unassigned" ' + (state.reportAssignment === 'unassigned' ? 'selected' : '') + '>Sem responsável</option></select></label><button type="submit">Aplicar filtros</button></form>' +
      '<div class="nx54-admin-list">' + (state.reports.length ? state.reports.map(reportCard).join('') : '<div class="nx54-empty">' + ICON.shield + '<strong>Nenhuma denúncia nesta seleção</strong><p>A fila está limpa ou os filtros não encontraram itens.</p></div>') + '</div>';
  }

  function canModerateUser(user) {
    if (!me || user.id === me.id) return false;
    if (me.role === 'admin') return true;
    return me.role === 'moderator' && user.role === 'user';
  }

  function userCard(user, team = false) {
    const name = user.display_name || user.username || 'Usuário';
    const own = user.id === me?.id;
    const allowed = canModerateUser(user);
    let actions = '';
    if (allowed && !team) {
      actions += user.status !== 'active' ? '<button type="button" data-user-action="activate">Reativar</button>' : '<button type="button" data-user-action="suspend">Suspender</button><button type="button" class="danger" data-user-action="ban">Banir</button>';
      if (me?.role === 'admin') actions += '<button type="button" data-user-action="role">Alterar função</button>';
    }
    if (allowed && team && me?.role === 'admin') actions = '<button type="button" data-user-action="role">Alterar função</button>';
    return '<article class="nx54-user ' + (team ? 'is-team' : '') + '" data-user-id="' + esc(user.id) + '">' +
      '<div class="nx54-user-identity">' + avatar(user) + '<span><h3>' + esc(name) + (own ? '<small>VOCÊ</small>' : '') + '</h3><p>@' + esc(user.username || '') + (user.email ? ' · ' + esc(user.email) : '') + '</p><small>Entrou ' + formatDate(user.created_at) + ' · visto ' + formatDate(user.last_seen_at) + '</small></span></div>' +
      '<div class="nx54-user-meta">' + roleBadge(user.role) + '<span class="nx54-status status-' + esc(user.status) + '">' + esc(statusLabel[user.status] || user.status) + '</span>' + (!team ? '<span>' + Number(user.list_count || 0) + ' na lista</span><span>' + Number(user.impression_count || 0) + ' impressões</span>' : '') + '</div>' +
      (actions ? '<div class="nx54-user-actions">' + actions + '</div>' : '') +
    '</article>';
  }

  function teamView() {
    return sectionHead('EQUIPE', 'Cargos e responsabilidades', 'Administradores definem acessos; moderadores cuidam de contas comuns e conteúdo.', true) +
      '<div class="nx54-permissions"><article><span>' + ICON.shield + '</span><div><h3>Moderador</h3><p>Analisa denúncias, oculta conteúdo e aplica medidas em contas comuns. Não altera cargos nem administra outros membros da equipe.</p></div></article><article><span>' + ICON.lock + '</span><div><h3>Administrador</h3><p>Possui acesso completo, define cargos, consulta auditoria e gerencia toda a equipe.</p></div></article></div>' +
      '<div class="nx54-team-head"><h3>Membros da equipe</h3><span>' + state.team.length + ' conta' + (state.team.length === 1 ? '' : 's') + '</span></div><div class="nx54-admin-list">' + (state.team.length ? state.team.map(user => userCard(user, true)).join('') : '<div class="nx54-empty"><strong>Nenhum membro encontrado</strong></div>') + '</div>';
  }

  function usersView() {
    return sectionHead('CONTAS', 'Usuários', 'Busque uma conta e aplique medidas com justificativa registrada.', false) +
      '<form class="nx54-filters nx54-user-filters" id="nx54UserFilters"><label class="search"><span>Buscar usuário</span><div>' + ICON.search + '<input type="search" name="search" value="' + esc(state.userSearch) + '" placeholder="Nome, @usuário ou e-mail" autocomplete="off"></div></label><label><span>Status</span><select name="status"><option value="">Todos</option>' + ['active', 'suspended', 'banned'].map(value => '<option value="' + value + '" ' + (state.userStatus === value ? 'selected' : '') + '>' + statusLabel[value] + '</option>').join('') + '</select></label><label><span>Função</span><select name="role"><option value="">Todas</option>' + ['user', 'moderator', 'admin'].map(value => '<option value="' + value + '" ' + (state.userRole === value ? 'selected' : '') + '>' + roleLabel[value] + '</option>').join('') + '</select></label><button type="submit">Buscar</button></form>' +
      '<div class="nx54-admin-list">' + (state.users.length ? state.users.map(user => userCard(user, false)).join('') : '<div class="nx54-empty">' + ICON.search + '<strong>Nenhuma conta encontrada</strong><p>Ajuste a busca ou os filtros.</p></div>') + '</div>';
  }

  function auditView() {
    return sectionHead('RASTREABILIDADE', 'Auditoria', 'Ações sensíveis, responsáveis e horários.', true) +
      '<div class="nx54-audit">' + (state.audit.length ? state.audit.map(item => '<article><i></i><div><h3>' + esc(auditLabel[item.action] || item.action) + '</h3><p>' + esc(item.actor_display_name || item.actor_username || 'Sistema') + ' · ' + esc(typeLabel[item.target_type] || item.target_type || 'Geral') + '</p></div><time datetime="' + esc(item.created_at) + '">' + formatDate(item.created_at) + '</time></article>').join('') : '<div class="nx54-empty"><strong>Nenhuma ação registrada</strong></div>') + '</div>';
  }

  function currentView() {
    if (state.tab === 'reports') return reportsView();
    if (state.tab === 'team') return teamView();
    if (state.tab === 'users') return usersView();
    if (state.tab === 'audit') return auditView();
    return overviewView();
  }

  function view() {
    app.innerHTML = pageShell(currentView());
    bind();
    finish();
  }

  async function fetchOverview() {
    state.overview = await auth().api('/api/admin/overview');
  }

  async function load(section = state.tab) {
    const generation = ++loadGeneration;
    let result;
    if (section === 'overview') result = await auth().api('/api/admin/overview');
    if (section === 'team') result = await auth().api('/api/admin/v2/users?role=team&limit=100');
    if (section === 'users') {
      const params = new URLSearchParams({ limit: '60' });
      if (state.userSearch) params.set('search', state.userSearch);
      if (state.userStatus) params.set('status', state.userStatus);
      if (state.userRole) params.set('role', state.userRole);
      result = await auth().api('/api/admin/v2/users?' + params);
    }
    if (section === 'reports') {
      const params = new URLSearchParams({ limit: '80' });
      if (state.reportStatus) params.set('status', state.reportStatus);
      if (state.reportType) params.set('type', state.reportType);
      if (state.reportAssignment) params.set('assignment', state.reportAssignment);
      result = await auth().api('/api/admin/v2/reports?' + params);
    }
    if (section === 'audit' && me?.role === 'admin') result = await auth().api('/api/admin/audit-log?limit=100');
    if (generation !== loadGeneration) return false;
    state.tab = section;
    if (section === 'overview') state.overview = result;
    if (section === 'team') state.team = result?.items || [];
    if (section === 'users') state.users = result?.items || [];
    if (section === 'reports') state.reports = result?.items || [];
    if (section === 'audit') state.audit = result?.items || [];
    return true;
  }

  async function switchTab(tab) {
    if (!navigationItems().some(item => item[0] === tab)) return;
    const workspace = document.querySelector('[data-admin-workspace]');
    workspace?.setAttribute('aria-busy', 'true');
    try {
      if (await load(tab)) view();
    } catch {
      workspace?.removeAttribute('aria-busy');
      announce('Não foi possível carregar esta seção.', 'error');
    }
  }

  function decisionDialog(options) {
    const title = options.title, text = options.text, confirm = options.confirm || 'Confirmar';
    const returnFocus = document.activeElement;
    return new Promise(resolve => {
      const layer = document.createElement('div');
      layer.className = 'nx54-dialog-layer';
      const roleOptions = options.role ? '<label><span>Nova função</span><select name="role">' + ['user', 'moderator', 'admin'].map(value => '<option value="' + value + '" ' + (options.currentRole === value ? 'selected' : '') + '>' + roleLabel[value] + '</option>').join('') + '</select></label>' : '';
      const duration = options.suspension ? '<label><span>Duração</span><select name="duration"><option value="24">24 horas</option><option value="168">7 dias</option><option value="720">30 dias</option></select></label>' : '';
      layer.innerHTML = '<button type="button" class="nx54-dialog-backdrop" data-dialog-cancel aria-label="Cancelar"></button><form class="nx54-dialog" role="dialog" aria-modal="true" aria-labelledby="nx54DialogTitle"><header><span>DECISÃO ADMINISTRATIVA</span><button type="button" data-dialog-cancel aria-label="Fechar">' + ICON.close + '</button></header><h2 id="nx54DialogTitle">' + esc(title) + '</h2><p>' + esc(text) + '</p>' + roleOptions + duration + '<label><span>Justificativa obrigatória</span><textarea name="reason" minlength="3" maxlength="1000" required placeholder="Explique a decisão de forma objetiva."></textarea></label><p class="nx54-dialog-error" role="alert"></p><footer><button type="button" data-dialog-cancel>Cancelar</button><button type="submit" class="' + (options.danger ? 'danger' : 'primary') + '">' + esc(confirm) + '</button></footer></form>';
      document.body.append(layer);
      document.body.classList.add('nx54-dialog-open');
      const form = layer.querySelector('form');
      const close = value => {
        document.body.classList.remove('nx54-dialog-open');
        layer.remove();
        if (returnFocus instanceof HTMLElement && returnFocus.isConnected) returnFocus.focus();
        resolve(value);
      };
      layer.querySelectorAll('[data-dialog-cancel]').forEach(button => button.onclick = () => close(null));
      layer.addEventListener('keydown', event => { if (event.key === 'Escape') close(null); });
      form.onsubmit = event => {
        event.preventDefault();
        const reason = form.elements.reason.value.trim();
        if (reason.length < 3) {
          form.querySelector('[role="alert"]').textContent = 'Explique o motivo em pelo menos 3 caracteres.';
          return;
        }
        close({ reason, role: form.elements.role?.value, hours: Number(form.elements.duration?.value || 0) });
      };
      form.elements.reason.focus();
    });
  }

  async function moderateUser(card, action) {
    const collection = state.tab === 'team' ? state.team : state.users;
    const user = collection.find(item => item.id === card?.dataset.userId);
    if (!user || !canModerateUser(user)) return;
    const name = user.display_name || user.username;
    let answer, body;
    if (action === 'activate') {
      answer = await decisionDialog({ title: 'Reativar ' + name + '?', text: 'A conta voltará a acessar e publicar normalmente.', confirm: 'Reativar conta' });
      if (answer) body = { status: 'active', reason: answer.reason };
    }
    if (action === 'suspend') {
      answer = await decisionDialog({ title: 'Suspender ' + name + '?', text: 'A conta perderá o acesso pelo período escolhido e o conteúdo público ficará oculto.', confirm: 'Suspender conta', danger: true, suspension: true });
      if (answer) body = { status: 'suspended', suspendUntil: new Date(Date.now() + answer.hours * 3600_000).toISOString(), reason: answer.reason };
    }
    if (action === 'ban') {
      answer = await decisionDialog({ title: 'Banir ' + name + '?', text: 'A conta perderá o acesso por tempo indeterminado e o conteúdo público ficará oculto.', confirm: 'Banir conta', danger: true });
      if (answer) body = { status: 'banned', reason: answer.reason };
    }
    if (action === 'role') {
      answer = await decisionDialog({ title: 'Alterar função de ' + name, text: 'Moderadores recebem acesso à fila de denúncias. Administradores recebem acesso completo.', confirm: 'Salvar função', role: true, currentRole: user.role });
      if (!answer || answer.role === user.role) {
        if (answer) announce('A função selecionada já está ativa.');
        return;
      }
      body = { role: answer.role, reason: answer.reason };
    }
    if (!body) return;
    try {
      const response = await auth().api('/api/admin/v2/users/' + encodeURIComponent(user.id) + '/moderation', { method: 'PATCH', body: JSON.stringify(body) });
      await Promise.all([load(state.tab), fetchOverview()]);
      view();
      announce(response?.notificationSent ? 'Função atualizada. O membro recebeu uma notificação.' : 'A alteração foi salva e registrada.', 'success');
    } catch (error) {
      announce(error?.code === 'CANNOT_MODERATE_SELF' ? 'Você não pode reduzir o acesso da própria conta.' : error?.status === 403 ? 'Sua função não permite moderar este membro.' : 'Não foi possível concluir esta ação.', 'error');
    }
  }

  async function reportAction(card, action) {
    const report = state.reports.find(item => item.id === card?.dataset.reportId);
    if (!report) return;
    try {
      if (action === 'claim') await auth().api('/api/admin/v2/reports/' + encodeURIComponent(report.id), { method: 'PATCH', body: JSON.stringify({ status: 'reviewing', assignedTo: me.id }) });
      if (action === 'reopen') await auth().api('/api/admin/v2/reports/' + encodeURIComponent(report.id), { method: 'PATCH', body: JSON.stringify({ status: 'open', assignedTo: null, resolution: null }) });
      if (action === 'hide' || action === 'dismiss') {
        const hiding = action === 'hide';
        const answer = await decisionDialog({ title: hiding ? 'Ocultar conteúdo e resolver?' : 'Descartar esta denúncia?', text: hiding ? 'O conteúdo deixará de aparecer publicamente e a denúncia será concluída em uma única operação.' : 'O conteúdo permanecerá público e a justificativa ficará registrada.', confirm: hiding ? 'Ocultar e resolver' : 'Descartar denúncia', danger: hiding });
        if (!answer) return;
        await auth().api('/api/admin/v2/reports/' + encodeURIComponent(report.id) + '/decision', { method: 'PATCH', body: JSON.stringify({ decision: hiding ? 'hide' : 'dismiss', reason: answer.reason }) });
      }
      await Promise.all([load('reports'), fetchOverview()]);
      view();
      announce(action === 'claim' ? 'A denúncia está sob sua responsabilidade.' : action === 'reopen' ? 'A denúncia voltou para a fila.' : action === 'hide' ? 'Conteúdo ocultado e denúncia resolvida.' : 'Denúncia descartada com justificativa.', 'success');
    } catch (error) {
      announce(error?.code === 'TARGET_NOT_FOUND' ? 'O conteúdo já não existe. Descarte a denúncia para encerrar a análise.' : 'Não foi possível concluir esta decisão.', 'error');
    }
  }

  function bind() {
    document.querySelector('[data-admin-account]')?.addEventListener('click', () => navigate('/minha-conta'));
    document.querySelectorAll('[data-admin-tab]').forEach(button => button.onclick = () => switchTab(button.dataset.adminTab));
    document.querySelectorAll('[data-admin-jump]').forEach(button => button.onclick = () => switchTab(button.dataset.adminJump));
    document.querySelectorAll('[data-admin-refresh]').forEach(button => button.onclick = async () => {
      button.disabled = true;
      try {
        await Promise.all([load(), fetchOverview()]);
        view();
        announce('Dados atualizados.', 'success');
      } catch {
        button.disabled = false;
        announce('Não foi possível atualizar agora.', 'error');
      }
    });
    document.querySelector('#nx54UserFilters')?.addEventListener('submit', async event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      state.userSearch = String(data.get('search') || '').trim().slice(0, 120);
      state.userStatus = String(data.get('status') || '');
      state.userRole = String(data.get('role') || '');
      try { await load('users'); view(); } catch { announce('A busca não pôde ser concluída.', 'error'); }
    });
    document.querySelector('#nx54ReportFilters')?.addEventListener('submit', async event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      state.reportStatus = String(data.get('status') || '');
      state.reportType = String(data.get('type') || '');
      state.reportAssignment = String(data.get('assignment') || '');
      try { await load('reports'); view(); } catch { announce('Os filtros não puderam ser aplicados.', 'error'); }
    });
    document.querySelectorAll('[data-user-action]').forEach(button => button.onclick = () => moderateUser(button.closest('[data-user-id]'), button.dataset.userAction));
    document.querySelectorAll('[data-report-action]').forEach(button => button.onclick = () => reportAction(button.closest('[data-report-id]'), button.dataset.reportAction));
  }

  async function mount() {
    if (route() !== '/admin') {
      loadGeneration += 1;
      document.body.classList.remove('nx38-admin-active');
      return;
    }
    if (mounting) return;
    mounting = true;
    activate();
    document.title = 'Administração | AniNexus';
    document.querySelector('meta[name="robots"]')?.setAttribute('content', 'noindex,nofollow');
    app.innerHTML = '<main class="nx38-admin-page nx54-admin-page"><div class="nx54-admin-loading" aria-busy="true"><i></i><strong>Preparando ferramentas da equipe…</strong><span>Permissões e dados estão sendo conferidos.</span></div></main>';
    try {
      if (!auth()?.enabled) {
        accessState('Administração indisponível', 'O acesso seguro precisa estar ativo para abrir este painel.');
        return;
      }
      const clerk = await auth().ready();
      if (!clerk?.user) {
        navigate('/login');
        return;
      }
      me = (await auth().api('/api/me'))?.user;
      if (!['moderator', 'admin'].includes(me?.role)) {
        accessState('Acesso restrito', 'Esta área é exclusiva para a equipe de moderação.');
        return;
      }
      const requested = new URL(location.href).searchParams.get('section');
      const allowed = ['overview', 'reports', 'team', 'users', 'audit'];
      state.tab = allowed.includes(requested) && (requested !== 'audit' || me.role === 'admin') ? requested : 'overview';
      await fetchOverview();
      if (state.tab !== 'overview') await load(state.tab);
      view();
    } catch (error) {
      if (error?.status === 401) {
        navigate('/login');
        return;
      }
      accessState('Não foi possível abrir o painel', 'A conexão segura falhou. Nenhuma alteração foi realizada.');
    } finally {
      mounting = false;
    }
  }

  addEventListener('aninexus:route-changed', () => queueMicrotask(mount));
  new MutationObserver(() => {
    if (route() === '/admin' && !app.querySelector('.nx38-admin-page') && !mounting) queueMicrotask(mount);
  }).observe(app, { childList: true });
  setTimeout(mount, 0);
})();
