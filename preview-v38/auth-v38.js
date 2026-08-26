'use strict';
(() => {
  if (window.__ANINEXUS_AUTH_V38__) return;
  window.__ANINEXUS_AUTH_V38__ = true;
  const app = document.querySelector('#app');
  if (!app) return;
  const config = window.__ANINEXUS_CONFIG__ || {};
  const IS_PAGES = location.hostname.endsWith('github.io');
  const BASE = IS_PAGES ? '/AniNexus' : '';
  const API_ORIGIN = String(config.apiOrigin || '').replace(/\/+$/, '');
  const PUBLISHABLE_KEY = String(config.clerkPublishableKey || '');
  const ENABLED = config.authEnabled === true && /^https:\/\//.test(API_ORIGIN) && /^pk_(?:test|live)_/.test(PUBLISHABLE_KEY);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const routeUrl = path => IS_PAGES ? `${BASE}/?build=40.8.0&p=${encodeURIComponent(path)}` : path;
  const go = (path, replace = false) => location[replace ? 'replace' : 'assign'](routeUrl(path));
  let clerkPromise = null;
  let apiUser = null;
  let clerkListenerInstalled = false;
  let headerSyncToken = 0;
  const fallbackLocalization = {
    locale: 'pt-BR',
    signIn: { start: { title: 'Entre no AniNexus', subtitle: 'Continue sua jornada de onde parou.', actionText: 'Ainda não tem uma conta?', actionLink: 'Criar conta' } },
    signUp: { start: { title: 'Crie sua conta', subtitle: 'Uma conta para acompanhar todo o seu universo.', actionText: 'Já possui uma conta?', actionLink: 'Entrar' } },
    socialButtonsBlockButton: 'Continuar com {{provider|titleize}}',
    dividerText: 'ou continue com e-mail', formFieldLabel__emailAddress: 'E-mail', formFieldLabel__password: 'Senha',
    formFieldInputPlaceholder__emailAddress: 'Digite seu e-mail', formButtonPrimary: 'Continuar',
  };

  function clerkDomain() {
    try { return atob(PUBLISHABLE_KEY.split('_')[2]).slice(0, -1); } catch (error) { console.error('[AniNexus auth] chave pública inválida.', error); return ''; }
  }
  const loadScript = (src, attributes = {}) => new Promise((resolve, reject) => {
    const existing = [...document.scripts].find(node => node.src === src);
    if (existing?.dataset.loaded === 'true') return resolve(existing);
    const script = existing || document.createElement('script');
    script.src = src; script.async = true; script.crossOrigin = 'anonymous';
    for (const [name, value] of Object.entries(attributes)) script.setAttribute(name, value);
    script.addEventListener('load', () => { script.dataset.loaded = 'true'; resolve(script); }, { once: true });
    script.addEventListener('error', () => reject(new Error('AUTH_SDK_UNAVAILABLE')), { once: true });
    if (!existing) document.head.append(script);
  });
  async function loadLocalization() {
    try {
      const response = await fetch(`${BASE}/clerk-localization-ptbr.json?v=40.8.0`, { cache: 'force-cache', credentials: 'omit' });
      if (response.ok) return await response.json();
      console.warn('[AniNexus auth] tradução pt-BR indisponível; usando o pacote mínimo interno.', { status: response.status });
    } catch (error) {
      console.warn('[AniNexus auth] não foi possível carregar a tradução pt-BR; usando o pacote mínimo interno.', error);
    }
    return fallbackLocalization;
  }
  function clerkAppearance() {
    return {
      variables: {
        colorPrimary: '#e9325a', colorPrimaryForeground: '#ffffff', colorDanger: '#ff637d', colorSuccess: '#5fd08a', colorWarning: '#f1bb55',
        colorNeutral: '#8f8289', colorForeground: '#f8f2f5', colorMutedForeground: '#a99ca2', colorMuted: '#171116', colorBackground: 'transparent',
        colorInput: '#0d0a0d', colorInputForeground: '#f8f2f5', colorRing: '#f14b70', colorBorder: '#3a2f36', colorShadow: '#000000',
        fontFamily: 'Nunito Sans, system-ui, sans-serif', fontFamilyButtons: 'Manrope, Nunito Sans, system-ui, sans-serif', fontSize: '0.875rem', borderRadius: '0.75rem', spacing: '0.9rem',
      },
      options: {
        elevation: 'flush', socialButtonsPlacement: 'top', socialButtonsVariant: 'iconButton', autoFocus: false,
        termsPageUrl: routeUrl('/termos-de-uso'), privacyPageUrl: routeUrl('/politica-de-privacidade'),
      },
      captcha: { theme: 'dark', size: 'flexible', language: 'pt-BR' },
    };
  }
  async function loadClerk() {
    if (!ENABLED) return null;
    if (clerkPromise) return clerkPromise;
    clerkPromise = (async () => {
      const domain = clerkDomain();
      if (!/^[a-z0-9.-]+$/i.test(domain)) throw new Error('AUTH_CONFIGURATION_INVALID');
      await loadScript(`https://${domain}/npm/@clerk/ui@1/dist/ui.browser.js`);
      await loadScript(`https://${domain}/npm/@clerk/clerk-js@6/dist/clerk.browser.js`, { 'data-clerk-publishable-key': PUBLISHABLE_KEY });
      if (!window.Clerk || !window.__internal_ClerkUICtor) throw new Error('AUTH_SDK_UNAVAILABLE');
      const localization = await loadLocalization();
      await window.Clerk.load({
        ui: { ClerkUI: window.__internal_ClerkUICtor },
        localization,
        appearance: clerkAppearance(),
        signInFallbackRedirectUrl: routeUrl('/minha-conta'),
        signUpFallbackRedirectUrl: routeUrl('/minha-conta'),
      });
      if(!clerkListenerInstalled&&typeof window.Clerk.addListener==='function'){
        clerkListenerInstalled=true;
        window.Clerk.addListener(()=>syncHeader());
      }
      return window.Clerk;
    })().catch(error => { clerkPromise = null; throw error; });
    return clerkPromise;
  }
  async function api(path, options = {}) {
    if (!ENABLED) throw Object.assign(new Error('AUTH_NOT_CONFIGURED'), { status: 503 });
    const clerk = await loadClerk();
    const token = await clerk?.session?.getToken();
    if (!token) throw Object.assign(new Error('AUTH_REQUIRED'), { status: 401 });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(options.timeout || 12_000));
    try {
      const response = await fetch(`${API_ORIGIN}${path}`, {
        ...options,
        signal: options.signal || controller.signal,
        cache: 'no-store',
        credentials: 'omit',
        headers: { accept: 'application/json', authorization: `Bearer ${token}`, ...(options.body ? { 'content-type': 'application/json' } : {}), ...(options.headers || {}) },
      });
      if (response.status === 204) return null;
      let body = {}; try { body = await response.json(); } catch {}
      if (!response.ok) throw Object.assign(new Error(body?.error || `HTTP_${response.status}`), { status: response.status, code: body?.error, body });
      return body;
    } finally { clearTimeout(timeout); }
  }
  async function publicApi(path, options = {}) {
    if (!ENABLED) throw Object.assign(new Error('API_NOT_CONFIGURED'), { status: 503 });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(options.timeout || 12_000));
    try {
      const response = await fetch(`${API_ORIGIN}${path}`, {
        ...options,
        signal: options.signal || controller.signal,
        cache: 'no-store',
        credentials: 'omit',
        headers: { accept: 'application/json', ...(options.headers || {}) },
      });
      if (response.status === 204) return null;
      let body = {}; try { body = await response.json(); } catch {}
      if (!response.ok) throw Object.assign(new Error(body?.error || `HTTP_${response.status}`), { status: response.status, body });
      return body;
    } finally { clearTimeout(timeout); }
  }
  async function getUser() {
    const clerk = await loadClerk();
    return clerk?.user || null;
  }
  async function signOut() {
    const clerk = await loadClerk();
    await clerk?.signOut({ redirectUrl: routeUrl('/') });
  }
  window.AniNexusAuth = Object.freeze({ enabled: ENABLED, ready: loadClerk, api, publicApi, getUser, signOut, apiOrigin: API_ORIGIN });

  function activate() {
    document.body.classList.remove('nx35-news-active', 'nx35-home-active', 'aqx-home-active');
    document.body.classList.add('nx38-auth-active');
    document.querySelectorAll('[data-nav]').forEach(link => link.classList.remove('active'));
  }
  function story(mode) {
    const create = mode === 'register';
    return `<section class="nx38-auth-story"><a class="nx38-auth-brand" href="${routeUrl('/')}" data-auth-home><img src="${BASE}/assets/logo.png" alt=""><strong>AniNexus</strong></a><div class="nx38-auth-copy"><span class="nx38-auth-kicker">SUA CONTA ANINEXUS</span><h1>${create ? 'Monte sua jornada.<br><em>Do seu jeito.</em>' : 'Seu universo<br><em>continua aqui.</em>'}</h1><p>${create ? 'Uma conta conecta lista, favoritos, progresso, comunidade, notícias e preferências em todos os seus dispositivos.' : 'Entre para continuar acompanhando episódios, listas, favoritos, notícias e conversas sem perder o que você construiu.'}</p><div class="nx38-auth-benefits"><div class="nx38-auth-benefit"><i>✓</i><div><strong>Uma lista só</strong><span>Assistindo, concluídos, pausados e quero ver.</span></div></div><div class="nx38-auth-benefit"><i>✦</i><div><strong>Proteção real</strong><span>E-mail verificado, recuperação e sessões gerenciadas pelo Clerk.</span></div></div><div class="nx38-auth-benefit"><i>●</i><div><strong>Comunidade</strong><span>Impressões, discussões e atividades ligadas aos títulos.</span></div></div></div></div><span class="nx38-auth-footnote">AniNexus · feito para acompanhar anime e mangá em português.</span></section>`;
  }
  function unavailableCard() {
    return `<section class="nx38-auth-panel"><div class="nx38-auth-card nx38-auth-unavailable" role="status"><header class="nx38-auth-card-head"><small>CONTA PROTEGIDA</small><h2>Ativação segura em andamento</h2><p>A navegação pública e os dados deste dispositivo continuam funcionando. Login e sincronização serão liberados somente quando a API possuir HTTPS válido e as chaves públicas estiverem configuradas.</p></header><div class="nx38-pages-note">Nenhum dado privado será enviado por uma conexão HTTP insegura.</div><a class="nx38-auth-submit" href="${routeUrl('/')}"><span>Continuar como visitante</span></a></div></section>`;
  }
  function clerkCard(mode) {
    const target = routeUrl(mode === 'register' ? '/login' : '/criar-conta');
    return `<section class="nx38-auth-panel"><div class="nx38-auth-card nx38-clerk-card"><header class="nx38-auth-card-head"><small>${mode === 'register' ? 'CRIAR CONTA' : 'BEM-VINDO DE VOLTA'}</small><h2>${mode === 'register' ? 'Comece no AniNexus' : 'Entre na sua conta'}</h2><p>${mode === 'register' ? 'Salve listas, progresso e favoritos em todos os seus dispositivos.' : 'Retome seus animes, listas e conversas em qualquer dispositivo.'}</p></header><div class="nx38-clerk-loading" id="nx38ClerkLoading" role="status">Preparando acesso seguro…</div><div id="nx38ClerkMount"></div><div class="nx38-auth-error" id="nx38AuthError" role="alert" aria-live="polite"></div><p class="nx38-clerk-switch">${mode === 'register' ? 'Já possui uma conta?' : 'Ainda não tem uma conta?'} <a href="${target}">${mode === 'register' ? 'Entrar' : 'Criar conta'}</a></p></div></section>`;
  }
  function watchClerkUi(mount) {
    const providers = { apple: 'Apple', facebook: 'Facebook', github: 'GitHub', google: 'Google' };
    const update = () => {
      mount.querySelectorAll('button[class*="socialButtons"]').forEach(button => {
        const provider = Object.keys(providers).find(key => [...button.classList].some(name => name.toLowerCase().includes(key)));
        if (!provider) return;
        const label = `Continuar com ${providers[provider]}`;
        button.setAttribute('aria-label', label);
        button.setAttribute('title', label);
        button.querySelectorAll('[aria-label]').forEach(child => child.removeAttribute('aria-label'));
      });
      mount.querySelectorAll('.cl-alertText,.cl-formFieldErrorText').forEach(message=>{
        if(/captcha failed to load|captcha.*unavailable|unsupported browser/i.test(message.textContent||''))message.textContent='A verificação de segurança não carregou. Atualize a página ou tente outro navegador; seus dados preenchidos continuam seguros.';
      });
    };
    const observer = new MutationObserver(update);
    observer.observe(mount, { childList: true, subtree: true });
    update();
    setTimeout(() => { update(); observer.disconnect(); }, 5000);
  }
  async function renderAuth(mode) {
    activate();
    document.title = `${mode === 'login' ? 'Entrar' : 'Criar conta'} | AniNexus`;
    if (!ENABLED) {
      app.innerHTML = `<main class="nx38-auth-page">${story(mode)}${unavailableCard()}</main>`;
      dispatchEvent(new CustomEvent('aninexus:auth-v38-ready'));
      return;
    }
    app.innerHTML = `<main class="nx38-auth-page">${story(mode)}${clerkCard(mode)}</main>`;
    try {
      const clerk = await loadClerk();
      if (clerk.user) { go('/minha-conta', true); return; }
      const mount = document.querySelector('#nx38ClerkMount');
      const props = { routing: 'virtual', fallbackRedirectUrl: routeUrl('/minha-conta'), signUpUrl: routeUrl('/criar-conta'), signInUrl: routeUrl('/login') };
      if (mode === 'register') clerk.mountSignUp(mount, props); else clerk.mountSignIn(mount, props);
      watchClerkUi(mount);
      document.querySelector('#nx38ClerkLoading')?.remove();
    } catch {
      const message = document.querySelector('#nx38AuthError');
      if (message) message.textContent = 'Não foi possível abrir o acesso seguro agora. Tente novamente em instantes.';
      document.querySelector('#nx38ClerkLoading')?.remove();
    }
    dispatchEvent(new CustomEvent('aninexus:auth-v38-ready'));
  }

  function localPayload() {
    const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } };
    const state = { ...read('aninexus:mediaState:v1', {}), ...read('aninexus:mediaState:v2', {}) };
    const favorites = [...new Set((read('aninexus:favorites', []) || []).map(Number).filter(Number.isSafeInteger))];
    const states = Object.entries(state).map(([mediaId, value]) => ({ mediaId: Number(mediaId), status: value?.status, score: value?.score == null ? null : Number(value.score), progress: Math.max(0, Number(value?.progress) || 0), updatedAt: Math.max(1, Number(value?.updatedAt) || Date.now()) })).filter(item => Number.isSafeInteger(item.mediaId) && ['PLANNING', 'CURRENT', 'COMPLETED', 'PAUSED', 'DROPPED'].includes(item.status));
    const watched = (read('aninexus:watchedEpisodes:v1', []) || []).map(item => ({ mediaId: Number(item.mediaId), episode: Number(item.episode), watchedAt: Number(item.watchedAt) || Date.now() })).filter(item => Number.isSafeInteger(item.mediaId) && Number.isSafeInteger(item.episode) && item.mediaId > 0 && item.episode > 0);
    return { sourceVersion: 'browser-v2', favorites, states, watched };
  }
  const hasLocalData = payload => payload.favorites.length || payload.states.length || payload.watched.length;
  function importCard(payload) {
    const count = payload.favorites.length + payload.states.length + payload.watched.length;
    return `<section class="nx38-account-info nx38-import-card" id="nx38ImportCard"><h2>Levar dados deste dispositivo para sua conta?</h2><p>Encontramos ${count} ${count === 1 ? 'registro local' : 'registros locais'}. A importação une os dados sem duplicar e preserva a alteração mais recente. Nada será apagado deste navegador.</p><div class="nx38-account-actions"><button type="button" data-import-local>Importar agora</button><button type="button" data-ignore-local>Agora não</button></div><p class="nx38-import-feedback" role="status" aria-live="polite"></p></section>`;
  }
  async function downloadExport(button) {
    button.disabled = true;
    try {
      const data = await api('/api/me/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const href = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = href; link.download = `aninexus-${new Date().toISOString().slice(0, 10)}.json`; document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(href);
    } catch { button.closest('.nx38-account-info')?.querySelector('[role="status"]')?.replaceChildren('Não foi possível exportar agora. Tente novamente.'); }
    finally { button.disabled = false; }
  }
  function deleteDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'nx38-delete-layer'; dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-labelledby', 'nx38DeleteTitle');
    dialog.innerHTML = `<div class="nx38-delete-card"><h2 id="nx38DeleteTitle">Excluir conta e dados</h2><p>Esta ação remove sua conta AniNexus e todos os dados associados. Ela não pode ser desfeita.</p><label for="nx38DeleteConfirm">Digite <strong>EXCLUIR</strong> para confirmar</label><input id="nx38DeleteConfirm" autocomplete="off"><div><button type="button" data-delete-cancel>Cancelar</button><button type="button" data-delete-confirm disabled>Excluir permanentemente</button></div><p role="alert"></p></div>`;
    document.body.append(dialog); const input = dialog.querySelector('input'), confirm = dialog.querySelector('[data-delete-confirm]'); input.addEventListener('input', () => { confirm.disabled = input.value !== 'EXCLUIR'; });
    dialog.querySelector('[data-delete-cancel]').onclick = () => dialog.remove();
    confirm.onclick = async () => { confirm.disabled = true; try { await api('/api/me/account', { method: 'DELETE', body: JSON.stringify({ confirmation: 'EXCLUIR' }) }); await signOut(); } catch { dialog.querySelector('[role="alert"]').textContent = 'Não foi possível concluir a exclusão. Nenhum dado adicional foi removido.'; confirm.disabled = false; } };
    input.focus();
  }
  async function renderAccount() {
    activate(); document.title = 'Minha conta | AniNexus';
    if (!ENABLED) { app.innerHTML = `<main class="nx38-account-page"><div class="nx38-account-shell">${unavailableCard()}</div></main>`; dispatchEvent(new CustomEvent('aninexus:auth-v38-ready')); return; }
    app.innerHTML = '<main class="nx38-account-page"><div class="nx38-account-shell"><div class="nx38-auth-card" style="margin:auto"><i class="nx38-spin"></i><span class="sr-only">Carregando conta</span></div></div></main>';
    try {
      const clerk = await loadClerk(); if (!clerk.user) { go('/login', true); return; }
      const [me, list, follows, notes, importStatus] = await Promise.all([api('/api/me'), api('/api/me/list'), api('/api/me/follows'), api('/api/me/notifications?limit=100'), api('/api/me/import-status')]);
      apiUser = me?.user || null; if (!apiUser) throw new Error('AUTH_REQUIRED');
      const items = list?.items || [], notifications = notes?.items || [], payload = localPayload(), showImport = !importStatus?.imported && hasLocalData(payload) && localStorage.getItem('aninexus:local-import:ignored') !== 'true';
      const initial = String(apiUser.displayName || apiUser.username || '?').trim().charAt(0).toUpperCase(), watching = items.filter(item => item.status === 'CURRENT').length, done = items.filter(item => item.status === 'COMPLETED').length, unread = notifications.filter(item => !item.read_at).length;
      app.innerHTML = `<main class="nx38-account-page"><div class="nx38-account-shell"><header class="nx38-account-head"><div class="nx38-account-person"><div class="nx38-account-avatar">${apiUser.avatarUrl ? `<img src="${esc(apiUser.avatarUrl)}" alt="">` : esc(initial)}</div><div><h1>${esc(apiUser.displayName || apiUser.username)}</h1><p>@${esc(apiUser.username)} · ${esc(apiUser.email)}</p></div></div><div class="nx38-account-head-actions">${['moderator','admin'].includes(apiUser.role)?`<a class="nx38-admin-entry" href="${routeUrl('/admin')}">Administração</a>`:''}<a class="nx38-account-profile-link" href="${routeUrl(`/u/${apiUser.username}`)}">Ver perfil público</a><button type="button" data-edit-profile>Personalizar perfil</button><button type="button" data-manage-account>Segurança e sessões</button><button class="nx38-account-logout" type="button" data-logout>Sair</button></div></header><div class="nx38-account-grid"><div class="nx38-account-stat"><small>ASSISTINDO</small><strong>${watching}</strong></div><div class="nx38-account-stat"><small>CONCLUÍDOS</small><strong>${done}</strong></div><div class="nx38-account-stat"><small>SEGUINDO</small><strong>${(follows?.items || []).length}</strong></div><div class="nx38-account-stat"><small>NOTIFICAÇÕES</small><strong>${unread}</strong></div></div>${showImport ? importCard(payload) : ''}<section class="nx38-account-info"><h2>Conta e perfil</h2><dl><dt>Nome de exibição</dt><dd>${esc(apiUser.displayName || apiUser.username)}</dd><dt>Usuário público</dt><dd>@${esc(apiUser.username)}</dd><dt>E-mail</dt><dd>${esc(apiUser.email)}</dd><dt>Verificação</dt><dd>${apiUser.emailVerified ? 'E-mail verificado' : 'Verificação pendente'}</dd><dt>Privacidade</dt><dd>${({public:'Público',followers:'Somente membros',private:'Privado'})[apiUser.privacy]||'Público'}</dd><dt>Membro desde</dt><dd>${apiUser.createdAt ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date(apiUser.createdAt)) : '—'}</dd></dl><div class="nx38-account-actions"><button type="button" data-edit-profile>Editar nome, @, foto e bio</button><button type="button" data-export>Exportar meus dados</button><button type="button" class="danger" data-delete>Excluir conta</button></div><p role="status" aria-live="polite"></p></section></div></main>`;
      document.querySelector('[data-manage-account]').onclick = () => clerk.openUserProfile();
      document.querySelectorAll('[data-edit-profile]').forEach(button=>button.onclick=()=>window.AniNexusProfileV38?.openEditor(apiUser,()=>renderAccount()));
      document.querySelector('[data-logout]').onclick = async event => { event.currentTarget.disabled = true; await signOut(); };
      document.querySelector('[data-export]').onclick = event => downloadExport(event.currentTarget);
      document.querySelector('[data-delete]').onclick = deleteDialog;
      const importButton = document.querySelector('[data-import-local]');
      if (importButton) importButton.onclick = async () => { const feedback = document.querySelector('.nx38-import-feedback'); importButton.disabled = true; try { const result = await api('/api/me/import-local', { method: 'POST', body: JSON.stringify(payload), timeout: 20_000 }); localStorage.setItem('aninexus:local-import:completed', new Date().toISOString()); feedback.textContent = `${result.itemCount || 0} registros foram sincronizados. Os dados locais foram preservados.`; setTimeout(() => document.querySelector('#nx38ImportCard')?.remove(), 2200); } catch (error) { feedback.textContent = error.status === 409 ? 'Esta conta já recebeu uma importação inicial.' : 'A importação não foi concluída. Seus dados locais continuam intactos.'; importButton.disabled = false; } };
      const ignore = document.querySelector('[data-ignore-local]'); if (ignore) ignore.onclick = () => { localStorage.setItem('aninexus:local-import:ignored', 'true'); document.querySelector('#nx38ImportCard')?.remove(); };
    } catch (error) {
      if (error.status === 401) { go('/login', true); return; }
      app.innerHTML = `<main class="nx38-account-page"><div class="nx38-account-shell"><div class="nx38-pages-note">Não foi possível carregar sua conta agora. Seus dados locais foram preservados. <button type="button" data-retry-account>Tentar novamente</button></div></div></main>`;
      document.querySelector('[data-retry-account]')?.addEventListener('click', () => location.reload());
    }
    dispatchEvent(new CustomEvent('aninexus:auth-v38-ready'));
  }
  async function syncHeader() {
    const syncToken = ++headerSyncToken;
    const actions = document.querySelector('.top-actions'); if (!actions) return;
    actions.querySelectorAll('.nx38-account-chip').forEach(chip=>chip.remove());
    const login = actions.querySelector('[data-action="login"]'), register = actions.querySelector('[data-action="register"]');
    const drawer=document.querySelector('.drawer-auth-card'),drawerTitle=drawer?.querySelector('h3'),drawerText=drawer?.querySelector('p'),drawerActions=drawer?.querySelector('.drawer-auth-actions');
    const setAnonymous=()=>{document.documentElement.dataset.nxAuthState='anonymous';if(login)login.hidden=false;if(register)register.hidden=false;if(drawer){drawer.dataset.authState='anonymous';if(drawerTitle)drawerTitle.textContent='Entre na sua conta';if(drawerText)drawerText.textContent='Salve sua lista, acompanhe episódios e participe da comunidade.';if(drawerActions)drawerActions.innerHTML='<button class="login-btn" data-action="login">Entrar</button><button class="signup-btn" data-action="register">Criar conta</button>'}};
    if (!ENABLED) { setAnonymous(); return; }
    document.documentElement.dataset.nxAuthState='loading';if(login)login.hidden=true;if(register)register.hidden=true;
    try {
      const user = await getUser();
      if(syncToken!==headerSyncToken||!actions.isConnected)return;
      if (user) {
        document.documentElement.dataset.nxAuthState='authenticated';
        if (login) login.hidden = true; if (register) register.hidden = true;
        actions.querySelectorAll('.nx38-account-chip').forEach(chip=>chip.remove());
        const button = document.createElement('button'); button.className = 'nx38-account-chip'; button.type = 'button'; button.setAttribute('aria-label', 'Abrir minha conta'); button.innerHTML = `<i>${user.imageUrl ? `<img src="${esc(user.imageUrl)}" alt="">` : esc(String(user.firstName || user.username || '?').charAt(0).toUpperCase())}</i><span>${esc(user.firstName || user.username || 'Minha conta')}</span>`; button.onclick = () => go('/minha-conta'); actions.insertBefore(button, actions.querySelector('.menu-btn') || null);
        if(drawer){const name=String(user.firstName||user.username||'Minha conta');drawer.dataset.authState='authenticated';if(drawerTitle)drawerTitle.textContent=`Olá, ${name}`;if(drawerText)drawerText.textContent='Continue sua lista, seu progresso e suas conversas.';if(drawerActions){drawerActions.innerHTML='<button class="nx38-drawer-account" type="button">Abrir minha conta</button>';drawerActions.querySelector('button').onclick=()=>go('/minha-conta')}}
        api('/api/me').then(({user:account}={})=>{if(!drawerActions||!['moderator','admin'].includes(account?.role)||drawerActions.querySelector('[data-open-admin]'))return;const admin=document.createElement('button');admin.type='button';admin.dataset.openAdmin='';admin.className='nx38-drawer-admin';admin.textContent='Administração';admin.onclick=()=>go('/admin');drawerActions.append(admin)}).catch(()=>{});
      } else setAnonymous();
    } catch (error) { if(syncToken!==headerSyncToken)return;console.warn('[AniNexus auth] não foi possível confirmar a sessão no cabeçalho.',error); setAnonymous(); }
  }
  window.AniNexusAuthV38 = { renderAuth, renderAccount, syncHeader, getUser, api };
  function currentRoute() {
    const url = new URL(location.href), requested = url.searchParams.get('p');
    if (requested) return requested.split('?')[0].replace(/\/+$/, '') || '/';
    let path = location.pathname;
    if (IS_PAGES) path = path.replace(/^\/AniNexus/, '') || '/';
    return path.replace(/\/+$/, '') || '/';
  }
  function mountRoute() {
    const path = currentRoute();
    if (path === '/login') return renderAuth('login');
    if (path === '/criar-conta') return renderAuth('register');
    if (path === '/minha-conta') return renderAccount();
    document.body.classList.remove('nx38-auth-active');
  }
  const authPush = history.pushState.bind(history), authReplace = history.replaceState.bind(history);
  history.pushState = function (...args) { const result = authPush(...args); queueMicrotask(mountRoute); return result; };
  history.replaceState = function (...args) { const result = authReplace(...args); queueMicrotask(mountRoute); return result; };
  addEventListener('popstate', () => queueMicrotask(mountRoute));
  document.addEventListener('click', event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action !== 'login' && action !== 'register') return;
    event.preventDefault(); event.stopImmediatePropagation();
    location.assign(routeUrl(action === 'login' ? '/login' : '/criar-conta'));
  }, true);
  syncHeader();
  setTimeout(mountRoute, 0);
})();
