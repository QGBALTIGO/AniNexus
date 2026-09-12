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
  const Runtime = window.AniNexusRuntime;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const accountIcon = name => ({
    user:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4.7 3.5-7 8-7s7.2 2.3 8 7"/></svg>',
    users:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-4 2.7-6 6.5-6s6 2 6.5 6M16 6.2a3.2 3.2 0 0 1 0 6.2M17.5 14.5c2.3.7 3.7 2.5 4 5.5"/></svg>',
    eye:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.7"/></svg>',
    check:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>',
    bell:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 10a6 6 0 0 1 12 0c0 5 2 5 2 7H4c0-2 2-2 2-7Z"/><path d="M10 20h4"/></svg>',
    episode:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3V9Z"/></svg>',
    news:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/></svg>',
    community:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="9" r="3"/><circle cx="17" cy="10" r="2.5"/><path d="M3 20c.5-3.8 2.5-5.7 6-5.7s5.5 1.9 6 5.7M15 15c3.2 0 5 1.7 5.5 5"/></svg>',
    bookmark:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4V3Z"/></svg>',
    shield:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 6v5c0 5-3 8-8 10-5-2-8-5-8-10V6l8-3Z"/><path d="m9 12 2 2 4-4"/></svg>',
    settings:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19 13.5v-3l-2-.7-.7-1.7.9-2-2.2-2.2-2 .9-1.7-.7L10.5 2h-3l-.7 2.1-1.7.7-2-.9L1 6.1l.9 2-.7 1.7-2 .7v3l2 .7.7 1.7-.9 2 2.1 2.1 2-.9 1.7.7.7 2.1h3l.7-2.1 1.7-.7 2 .9 2.2-2.1-.9-2 .7-1.7 2.1-.7Z" transform="translate(2) scale(.9)"/></svg>',
    arrow:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M14 7.5 18.5 12 14 16.5"/></svg>',
    episode:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 9 6-9 6V6Z"/></svg>',
    news:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/></svg>',
    community:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v12H9l-5 4V5Z"/><path d="M8 9h8M8 13h5"/></svg>',
    system:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 14.5 8.5 20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5L12 3Z"/></svg>',
    logout:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4H5v16h5M14 8l4 4-4 4M8 12h10"/></svg>',
  })[name] || '';
  const routeUrl = path => IS_PAGES ? `${BASE}/?build=44.28.4&p=${encodeURIComponent(path)}` : path;
  const go = (path, replace = false) => { const target=routeUrl(path); if(!IS_PAGES&&window.AniNexusGo?.(target,{replace}))return; location[replace ? 'replace' : 'assign'](target); };
  const avatarMarkup = (user, options = {}) => window.AniNexusAvatar?.markup(user, options) || `<img src="${BASE}/assets/avatars/mascot-pink.png" alt="">`;
  let clerkPromise = null;
  let apiUser = null;
  let clerkListenerInstalled = false;
  let routeRenderGeneration = 0;
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
    let settled = false;
    const finish = (error) => { if (settled) return; settled = true; clearTimeout(timeout); if (error) reject(error); else { script.dataset.loaded = 'true'; resolve(script); } };
    const timeout = setTimeout(() => finish(new Error('AUTH_SDK_TIMEOUT')), 8_000);
    script.addEventListener('load', () => finish(), { once: true });
    script.addEventListener('error', () => finish(new Error('AUTH_SDK_UNAVAILABLE')), { once: true });
    if (!existing) document.head.append(script);
  });
  async function loadLocalization(signal) {
    try {
      const response = await fetch(`${BASE}/clerk-localization-ptbr.json?v=40.9.0`, { cache: 'force-cache', credentials: 'omit', signal });
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
    const initialize = async signal => {
      const domain = clerkDomain();
      if (!/^[a-z0-9.-]+$/i.test(domain)) throw new Error('AUTH_CONFIGURATION_INVALID');
      await loadScript(`https://${domain}/npm/@clerk/ui@1/dist/ui.browser.js`);
      if(signal.aborted)throw Runtime.deadlineError('navigation','Inicialização da conta');
      await loadScript(`https://${domain}/npm/@clerk/clerk-js@6/dist/clerk.browser.js`, { 'data-clerk-publishable-key': PUBLISHABLE_KEY });
      if(signal.aborted)throw Runtime.deadlineError('navigation','Inicialização da conta');
      if (!window.Clerk || !window.__internal_ClerkUICtor) throw new Error('AUTH_SDK_UNAVAILABLE');
      const localization = await loadLocalization(signal);
      if(signal.aborted)throw Runtime.deadlineError('navigation','Inicialização da conta');
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
    };
    clerkPromise = Runtime.withDeadline(initialize,{timeout:12_000,label:'Inicialização da conta'}).catch(error => { clerkPromise = null; throw error; });
    return clerkPromise;
  }
  async function api(path, options = {}) {
    if (!ENABLED) throw Object.assign(new Error('AUTH_NOT_CONFIGURED'), { status: 503 });
    const {timeout=12_000,signal:externalSignal,...requestOptions}=options;
    return Runtime.withDeadline(async signal=>{
      const clerk = await loadClerk();
      if(signal.aborted)throw Runtime.deadlineError('navigation','Requisição autenticada');
      const token = await clerk?.session?.getToken();
      if(signal.aborted)throw Runtime.deadlineError('navigation','Requisição autenticada');
      if (!token) throw Object.assign(new Error('AUTH_REQUIRED'), { status: 401 });
      const response = await fetch(`${API_ORIGIN}${path}`, {
        ...requestOptions,
        signal,
        cache: 'no-store',
        credentials: 'omit',
        headers: { accept: 'application/json', authorization: `Bearer ${token}`, ...Runtime.correlationHeaders(), ...(requestOptions.body ? { 'content-type': 'application/json' } : {}), ...(requestOptions.headers || {}) },
      });
      if (response.status === 204) return null;
      let body = {}; try { body = await response.json(); } catch (error) { if(response.ok)throw Object.assign(new Error('INVALID_RESPONSE'),{code:'INVALID_RESPONSE',category:'data',cause:error}) }
      if (!response.ok) throw Object.assign(new Error(body?.error || `HTTP_${response.status}`), { status: response.status, code: body?.error, body });
      return body;
    },{timeout,signal:externalSignal,label:'Requisição autenticada'});
  }
  async function publicApi(path, options = {}) {
    if (!ENABLED) throw Object.assign(new Error('API_NOT_CONFIGURED'), { status: 503 });
    const {timeout=12_000,signal:externalSignal,...requestOptions}=options;
    return Runtime.withDeadline(async signal=>{
      const response = await fetch(`${API_ORIGIN}${path}`, {
        ...requestOptions,
        signal,
        cache: 'no-store',
        credentials: 'omit',
        headers: { accept: 'application/json', ...Runtime.correlationHeaders(), ...(requestOptions.headers || {}) },
      });
      if (response.status === 204) return null;
      let body = {}; try { body = await response.json(); } catch (error) { if(response.ok)throw Object.assign(new Error('INVALID_RESPONSE'),{code:'INVALID_RESPONSE',category:'data',cause:error}) }
      if (!response.ok) throw Object.assign(new Error(body?.error || `HTTP_${response.status}`), { status: response.status, body });
      return body;
    },{timeout,signal:externalSignal,label:'Requisição pública'});
  }
  async function getUser() {
    const clerk = await loadClerk();
    return clerk?.user || null;
  }
  function requestLogin() {
    go('/login');
    return null;
  }
  async function requireAccount() {
    if (!ENABLED) return requestLogin();
    try {
      const user = await getUser();
      if (user) return user;
    } catch {}
    return requestLogin();
  }
  async function signOut() {
    const clerk = await loadClerk();
    await clerk?.signOut({ redirectUrl: routeUrl('/') });
  }
  function closeSignOutDialog({restoreFocus=true}={}) {
    const layer=document.querySelector('#drawerSignoutConfirm');
    if(!layer||layer.hidden)return;
    layer.hidden=true;layer.setAttribute('aria-hidden','true');
    if(restoreFocus)layer._returnFocus?.focus?.();
  }
  function openSignOutDialog(trigger) {
    const layer=document.querySelector('#drawerSignoutConfirm');
    if(!layer)return;
    layer._returnFocus=trigger||document.activeElement;
    layer.hidden=false;layer.setAttribute('aria-hidden','false');
    requestAnimationFrame(()=>layer.querySelector('[data-nx-signout-cancel]:not(.drawer-signout-backdrop)')?.focus());
  }
  function bindSignOutDialog(trigger) {
    const layer=document.querySelector('#drawerSignoutConfirm');
    if(!layer)return;
    trigger.onclick=()=>openSignOutDialog(trigger);
    if(layer.dataset.bound)return;
    layer.dataset.bound='1';
    layer.querySelectorAll('[data-nx-signout-cancel]').forEach(button=>button.addEventListener('click',()=>closeSignOutDialog()));
    layer.querySelector('[data-nx-signout-confirm]')?.addEventListener('click',async event=>{const button=event.currentTarget;button.disabled=true;try{await signOut()}catch{button.disabled=false}});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!layer.hidden){event.preventDefault();event.stopImmediatePropagation();closeSignOutDialog() }},true);
  }
  window.AniNexusAuth = Object.freeze({ enabled: ENABLED, ready: loadClerk, api, publicApi, getUser, requireAccount, requestLogin, signOut, apiOrigin: API_ORIGIN });

  function activate() {
    document.documentElement.classList.remove('nx35-home-boot','nx35-home-ready','nx40-community-boot','nx40-community-ready','nx38-library-boot');
    document.body.classList.remove('nx35-news-active', 'nx35-home-active', 'aqx-home-active');
    document.body.classList.add('nx38-auth-active');
    document.querySelectorAll('[data-nav]').forEach(link => link.classList.remove('active'));
  }
  function story(mode) {
    const create = mode === 'register';
    return `<section class="nx38-auth-story"><a class="nx38-auth-brand" href="${routeUrl('/')}" data-auth-home><img src="${BASE}/assets/logo.png" alt=""><strong>AniNexus</strong></a><div class="nx38-auth-copy"><span class="nx38-auth-kicker">SUA CONTA ANINEXUS</span><h1>${create ? 'Monte sua jornada. <br><em>Do seu jeito.</em>' : 'Seu universo <br><em>continua aqui.</em>'}</h1><p>${create ? 'Uma conta conecta lista, favoritos, progresso, comunidade, notícias e preferências em todos os seus dispositivos.' : 'Entre para continuar acompanhando episódios, listas, favoritos, notícias e conversas sem perder o que você construiu.'}</p><div class="nx38-auth-benefits"><div class="nx38-auth-benefit"><i>✓</i><div><strong>Uma lista só</strong><span>Assistindo, concluídos, pausados e quero ver.</span></div></div><div class="nx38-auth-benefit"><i>✦</i><div><strong>Proteção real</strong><span>E-mail verificado, recuperação e sessões gerenciadas pelo Clerk.</span></div></div><div class="nx38-auth-benefit"><i>●</i><div><strong>Comunidade</strong><span>Impressões, discussões e atividades ligadas aos títulos.</span></div></div></div></div><span class="nx38-auth-footnote">AniNexus · feito para acompanhar anime e mangá em português.</span></section>`;
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
        const descriptor = [
          button.id,
          button.dataset.provider,
          button.getAttribute('data-provider'),
          ...button.classList,
          ...[...button.querySelectorAll('[class]')].flatMap(child => [...child.classList]),
        ].filter(Boolean).join(' ').toLowerCase();
        const provider = Object.keys(providers).find(key => descriptor.includes(key));
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
    const generation=++routeRenderGeneration;
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
      if(generation!==routeRenderGeneration||currentRoute()!==(mode==='register'?'/criar-conta':'/login'))return;
      if (clerk.user) { go('/minha-conta', true); return; }
      const mount = document.querySelector('#nx38ClerkMount');
      const props = { routing: 'virtual', fallbackRedirectUrl: routeUrl('/minha-conta'), signUpUrl: routeUrl('/criar-conta'), signInUrl: routeUrl('/login') };
      if (mode === 'register') clerk.mountSignUp(mount, props); else clerk.mountSignIn(mount, props);
      watchClerkUi(mount);
      document.querySelector('#nx38ClerkLoading')?.remove();
    } catch {
      if(generation!==routeRenderGeneration)return;
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
  const privacyLabel=value=>({public:'Público',semi_public:'Semipúblico',followers:'Semipúblico',private:'Privado'})[value]||'Público';
  const notificationMeta=kind=>({EPISODE:{label:'Novo episódio',icon:'episode'},NEWS:{label:'Notícia',icon:'news'},COMMUNITY:{label:'Comunidade',icon:'community'},SYSTEM:{label:'AniNexus',icon:'system'}})[String(kind||'SYSTEM').toUpperCase()]||{label:'AniNexus',icon:'system'};
  function relativeAccountDate(value){const time=Date.parse(value||'');if(!Number.isFinite(time))return'';const diff=Math.max(0,Date.now()-time);if(diff<60_000)return'agora';if(diff<3_600_000)return`há ${Math.floor(diff/60_000)} min`;if(diff<86_400_000)return`há ${Math.floor(diff/3_600_000)} h`;if(diff<604_800_000)return`há ${Math.floor(diff/86_400_000)} d`;return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',year:new Date(time).getFullYear()===new Date().getFullYear()?undefined:'numeric'}).format(new Date(time))}
  function safeAccountRoute(value){const route=String(value||'').trim();if(!route.startsWith('/')||route.startsWith('//')||/[\u0000-\u001f\\]/.test(route))return'';try{const url=new URL(route,location.origin);return url.origin===location.origin?`${url.pathname}${url.search}${url.hash}`:''}catch{return''}}
  function notificationRows(items){return items.map(item=>{const meta=notificationMeta(item.kind),route=safeAccountRoute(item.href||item.url);return `<button type="button" class="nx56-notification-row${item.read_at?' is-read':' is-unread'}" data-account-notification="${esc(item.id)}" data-filter-state="${item.read_at?'read':'unread'}"${route?` data-notification-route="${esc(route)}"`:''}><span class="nx56-notification-icon kind-${String(item.kind||'SYSTEM').toLowerCase()}">${accountIcon(meta.icon)}</span><span class="nx56-notification-copy"><span><small>${esc(meta.label)}</small><time datetime="${esc(item.created_at||'')}">${esc(relativeAccountDate(item.created_at))}</time></span><strong>${esc(item.title||'Nova notificação')}</strong>${item.body?`<p>${esc(item.body)}</p>`:''}</span><i aria-hidden="true"></i></button>`}).join('')}
  function connectionCards(items,emptyText){return items.length?items.map(item=>`<a class="nx56-connection-card" href="${routeUrl(`/u/${item.username}`)}"><i>${avatarMarkup(item,{name:item.displayName||item.username})}</i><span><strong>${esc(item.displayName||item.username)}</strong><small>@${esc(item.username)}</small></span>${accountIcon('arrow')}</a>`).join(''):`<div class="nx56-connections-empty">${accountIcon('users')}<strong>${esc(emptyText)}</strong><span>Perfis aparecerão aqui quando novas conexões forem criadas.</span></div>`}
  function notificationCenter(notifications,summary={}){const unread=Number(summary.unread??notifications.filter(item=>!item.read_at).length),total=Number(summary.total??notifications.length);return `<section class="nx56-panel nx56-notification-center" id="notificacoes" aria-labelledby="nx56NotificationsTitle"><header class="nx56-section-head"><div><small>CENTRAL DE ATUALIZAÇÕES</small><h2 id="nx56NotificationsTitle">Notificações</h2><p>Acompanhe episódios, notícias, comunidade e avisos da sua conta.</p></div><div class="nx56-notification-head-actions"><span data-account-unread-summary>${unread?`${unread} ${unread===1?'não lida':'não lidas'}`:'Tudo em dia'}</span><button type="button" data-notifications-read-all ${unread?'':'disabled'}>${accountIcon('check')}<span>Marcar todas como lidas</span></button></div></header><div class="nx56-notification-tabs" role="tablist" aria-label="Filtrar notificações"><button type="button" class="active" role="tab" aria-selected="true" data-notification-filter="all">Todas <span>${total}</span></button><button type="button" role="tab" aria-selected="false" data-notification-filter="unread">Não lidas <span data-unread-count>${unread}</span></button></div><div class="nx56-notification-list" aria-live="polite">${notifications.length?notificationRows(notifications):`<div class="nx56-notification-empty">${accountIcon('bell')}<strong>Você está em dia</strong><span>As próximas atualizações da sua lista e da comunidade aparecerão aqui.</span></div>`}<div class="nx56-notification-empty nx56-filter-empty" hidden>${accountIcon('check')}<strong>Nenhuma notificação pendente</strong><span>Você já leu todas as atualizações.</span></div></div></section>`}
  function bindAccountExperience(notifications){
    const setNotificationFilter=filter=>{const rows=[...document.querySelectorAll('[data-account-notification]')],onlyUnread=filter==='unread';let visible=0;rows.forEach(row=>{const show=!onlyUnread||row.dataset.filterState==='unread';row.hidden=!show;if(show)visible+=1});document.querySelectorAll('[data-notification-filter]').forEach(button=>{const active=button.dataset.notificationFilter===filter;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active))});const empty=document.querySelector('.nx56-filter-empty');if(empty)empty.hidden=!onlyUnread||visible>0};
    const syncUnread=()=>{const unread=document.querySelectorAll('[data-account-notification][data-filter-state="unread"]').length;const count=document.querySelector('[data-unread-count]'),summary=document.querySelector('[data-account-unread-summary]'),readAll=document.querySelector('[data-notifications-read-all]');if(count)count.textContent=String(unread);if(summary)summary.textContent=unread?`${unread} ${unread===1?'não lida':'não lidas'}`:'Tudo em dia';if(readAll)readAll.disabled=unread===0;dispatchEvent(new CustomEvent('aninexus:notifications-changed',{detail:{unread}}));return unread};
    document.querySelectorAll('[data-notification-filter]').forEach(button=>button.onclick=()=>setNotificationFilter(button.dataset.notificationFilter));
    document.querySelectorAll('[data-account-notification]').forEach(row=>row.onclick=async()=>{const item=notifications.find(entry=>String(entry.id)===row.dataset.accountNotification);if(row.dataset.filterState==='unread'){row.dataset.filterState='read';row.classList.remove('is-unread');row.classList.add('is-read');try{await api(`/api/me/notifications/${encodeURIComponent(row.dataset.accountNotification)}`,{method:'PATCH'});if(item)item.read_at=new Date().toISOString()}catch{row.dataset.filterState='unread';row.classList.add('is-unread');row.classList.remove('is-read')}syncUnread()}const target=safeAccountRoute(row.dataset.notificationRoute);if(target)go(target)});
    const readAll=document.querySelector('[data-notifications-read-all]');if(readAll)readAll.onclick=async()=>{readAll.disabled=true;const label=readAll.querySelector('span'),previous=label?.textContent,rows=[...document.querySelectorAll('[data-account-notification][data-filter-state="unread"]')],previousDates=notifications.map(item=>item.read_at);if(label)label.textContent='Atualizando…';rows.forEach(row=>{row.dataset.filterState='read';row.classList.remove('is-unread');row.classList.add('is-read')});notifications.forEach(item=>item.read_at=item.read_at||new Date().toISOString());syncUnread();setNotificationFilter(document.querySelector('[data-notification-filter].active')?.dataset.notificationFilter||'all');try{await api('/api/me/notifications/read-all',{method:'POST'})}catch(error){rows.forEach(row=>{row.dataset.filterState='unread';row.classList.add('is-unread');row.classList.remove('is-read')});notifications.forEach((item,index)=>item.read_at=previousDates[index]);syncUnread();setNotificationFilter(document.querySelector('[data-notification-filter].active')?.dataset.notificationFilter||'all');readAll.dataset.error='true';setTimeout(()=>delete readAll.dataset.error,1800);console.warn('[AniNexus notifications] não foi possível marcar todas como lidas.',error)}finally{readAll.disabled=syncUnread()===0;if(label)label.textContent=previous||'Marcar todas como lidas'}};
    document.querySelectorAll('[data-connection-tab]').forEach(button=>button.onclick=()=>{const id=button.dataset.connectionTab;document.querySelectorAll('[data-connection-tab]').forEach(item=>{const active=item.dataset.connectionTab===id;item.classList.toggle('active',active);item.setAttribute('aria-selected',String(active))});document.querySelectorAll('[data-connection-panel]').forEach(panel=>panel.hidden=panel.dataset.connectionPanel!==id)});
    document.querySelectorAll('[data-account-jump]').forEach(link=>link.onclick=event=>{const target=document.querySelector(`#${CSS.escape(link.dataset.accountJump)}`);if(!target)return;event.preventDefault();target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});history.replaceState(null,'',`#${link.dataset.accountJump}`)});
    if(location.hash==='#notificacoes')requestAnimationFrame(()=>document.querySelector('#notificacoes')?.scrollIntoView({block:'start'}));
    syncUnread();
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
    const generation=++routeRenderGeneration;
    activate(); document.title = 'Minha conta | AniNexus';
    if (!ENABLED) { app.innerHTML = `<main class="nx38-account-page"><div class="nx38-account-shell">${unavailableCard()}</div></main>`; dispatchEvent(new CustomEvent('aninexus:auth-v38-ready')); return; }
    app.innerHTML = '<main class="nx38-account-page"><div class="nx38-account-shell"><div class="nx38-auth-card" style="margin:auto"><i class="nx38-spin"></i><span class="sr-only">Carregando conta</span></div></div></main>';
    try {
      const clerk = await loadClerk(); if(generation!==routeRenderGeneration||currentRoute()!=='/minha-conta')return; if (!clerk.user) { go('/login', true); return; }
      const [me, list, follows, notes, importStatus, connections] = await Promise.all([api('/api/me'), api('/api/me/list'), api('/api/me/follows'), api('/api/me/notifications?limit=100'), api('/api/me/import-status'), api('/api/me/profile-connections')]);
      if(generation!==routeRenderGeneration||currentRoute()!=='/minha-conta')return;
      apiUser = me?.user || null; if (!apiUser) throw new Error('AUTH_REQUIRED');
      const items = list?.items || [], notifications = notes?.items || [], payload = localPayload(), showImport = !importStatus?.imported && hasLocalData(payload) && localStorage.getItem('aninexus:local-import:ignored') !== 'true';
      const watching = items.filter(item => item.status === 'CURRENT').length, done = items.filter(item => item.status === 'COMPLETED').length, unread = Number(notes?.unread??notifications.filter(item => !item.read_at).length), followingPeople=connections?.following||[],followers=connections?.followers||[];
      const memberSince=apiUser.createdAt?new Intl.DateTimeFormat('pt-BR',{dateStyle:'long'}).format(new Date(apiUser.createdAt)):'—',roleLabel=apiUser.role==='admin'?'Administrador':apiUser.role==='moderator'?'Moderação':'Membro';
      app.innerHTML = `<main class="nx38-account-page nx56-account-page"><div class="nx38-account-shell nx56-account-shell"><header class="nx56-account-hero"><div class="nx56-account-identity"><div class="nx38-account-avatar">${avatarMarkup(apiUser,{name:apiUser.displayName||apiUser.username})}</div><div><span class="nx56-eyebrow">CONTA ANINEXUS</span><h1>${esc(apiUser.displayName||apiUser.username)}</h1><p>@${esc(apiUser.username)} <i>•</i> ${esc(roleLabel)}</p></div></div><div class="nx56-account-primary-actions">${['moderator','admin'].includes(apiUser.role)?`<a href="${routeUrl('/admin')}">${accountIcon('shield')}<span>Administração</span></a>`:''}<a href="${routeUrl(`/u/${apiUser.username}`)}">${accountIcon('eye')}<span>Perfil público</span></a><button class="primary" type="button" data-edit-profile>${accountIcon('settings')}<span>Personalizar perfil</span></button></div></header><nav class="nx56-account-nav" aria-label="Seções da conta"><a class="active" href="#visao-geral" data-account-jump="visao-geral">Visão geral</a><a href="#conexoes" data-account-jump="conexoes">Conexões</a><a href="#notificacoes" data-account-jump="notificacoes">Notificações${unread?` <span>${unread}</span>`:''}</a></nav><section class="nx56-stat-grid" aria-label="Resumo da conta"><article><i>${accountIcon('eye')}</i><span><small>ASSISTINDO</small><strong>${watching}</strong></span></article><article><i>${accountIcon('check')}</i><span><small>CONCLUÍDOS</small><strong>${done}</strong></span></article><article><i>${accountIcon('bookmark')}</i><span><small>TÍTULOS SEGUIDOS</small><strong>${(follows?.items||[]).length}</strong></span></article><a href="#conexoes" data-account-jump="conexoes"><i>${accountIcon('users')}</i><span><small>SEGUIDORES</small><strong>${followers.length}</strong></span></a><a href="#notificacoes" data-account-jump="notificacoes"><i>${accountIcon('bell')}</i><span><small>NÃO LIDAS</small><strong>${unread}</strong></span></a></section>${showImport?importCard(payload):''}<section class="nx56-overview-grid" id="visao-geral"><article class="nx56-panel nx56-profile-summary"><header class="nx56-section-head"><div><small>VISÃO GERAL</small><h2>Conta e perfil</h2><p>As informações essenciais da sua identidade no AniNexus.</p></div><button type="button" data-edit-profile>${accountIcon('settings')}Editar perfil</button></header><dl><div><dt>Nome de exibição</dt><dd>${esc(apiUser.displayName||apiUser.username)}</dd></div><div><dt>Usuário público</dt><dd>@${esc(apiUser.username)}</dd></div><div><dt>E-mail</dt><dd>${esc(apiUser.email)}</dd></div><div><dt>Verificação</dt><dd class="is-positive">${apiUser.emailVerified?`${accountIcon('check')} E-mail verificado`:'Verificação pendente'}</dd></div><div><dt>Privacidade</dt><dd>${esc(privacyLabel(apiUser.privacy))}</dd></div><div><dt>Membro desde</dt><dd>${esc(memberSince)}</dd></div></dl></article><aside class="nx56-panel nx56-security-card"><span class="nx56-security-icon">${accountIcon('shield')}</span><small>SEGURANÇA</small><h2>Acesso e sessões</h2><p>Revise dispositivos conectados, métodos de acesso e proteção da sua conta.</p><button type="button" data-manage-account>Gerenciar segurança ${accountIcon('arrow')}</button><button class="nx56-signout" type="button" data-logout>${accountIcon('logout')}Sair desta conta</button></aside></section><section class="nx56-panel nx56-connections" id="conexoes" aria-labelledby="nx56ConnectionsTitle"><header class="nx56-section-head"><div><small>COMUNIDADE</small><h2 id="nx56ConnectionsTitle">Suas conexões</h2><p>Perfis que você acompanha e pessoas que acompanham sua jornada.</p></div><a href="${routeUrl('/comunidade')}">Descobrir pessoas ${accountIcon('arrow')}</a></header><div class="nx56-connection-tabs" role="tablist" aria-label="Conexões do perfil"><button class="active" type="button" role="tab" aria-selected="true" data-connection-tab="following">Seguindo <span>${followingPeople.length}</span></button><button type="button" role="tab" aria-selected="false" data-connection-tab="followers">Seguidores <span>${followers.length}</span></button></div><div class="nx56-connection-grid" data-connection-panel="following">${connectionCards(followingPeople,'Você ainda não segue nenhum perfil')}</div><div class="nx56-connection-grid" data-connection-panel="followers" hidden>${connectionCards(followers,'Seu perfil ainda não tem seguidores')}</div></section>${notificationCenter(notifications,notes)}</div></main>`;
      document.querySelector('.nx56-notification-center')?.classList.add('nx42-notifications');
      document.querySelector('[data-manage-account]').onclick = () => clerk.openUserProfile();
      document.querySelectorAll('[data-edit-profile]').forEach(button=>button.onclick=()=>window.AniNexusProfileV38?.openEditor(apiUser,()=>renderAccount()));
      document.querySelector('[data-logout]').onclick = async event => { event.currentTarget.disabled = true; await signOut(); };
      bindAccountExperience(notifications);
      const importButton = document.querySelector('[data-import-local]');
      if (importButton) importButton.onclick = async () => { const feedback = document.querySelector('.nx38-import-feedback'); importButton.disabled = true; try { const result = await api('/api/me/import-local', { method: 'POST', body: JSON.stringify(payload), timeout: 20_000 }); localStorage.setItem('aninexus:local-import:completed', new Date().toISOString()); feedback.textContent = `${result.itemCount || 0} registros foram sincronizados. Os dados locais foram preservados.`; setTimeout(() => document.querySelector('#nx38ImportCard')?.remove(), 2200); } catch (error) { feedback.textContent = error.status === 409 ? 'Esta conta já recebeu uma importação inicial.' : 'A importação não foi concluída. Seus dados locais continuam intactos.'; importButton.disabled = false; } };
      const ignore = document.querySelector('[data-ignore-local]'); if (ignore) ignore.onclick = () => { localStorage.setItem('aninexus:local-import:ignored', 'true'); document.querySelector('#nx38ImportCard')?.remove(); };
    } catch (error) {
      if(generation!==routeRenderGeneration)return;
      if (error.status === 401) { go('/login', true); return; }
      console.warn('[AniNexus account] não foi possível montar a conta.', error);
      app.innerHTML = `<main class="nx38-account-page"><div class="nx38-account-shell"><div class="nx38-pages-note">Não foi possível carregar sua conta agora. Seus dados locais foram preservados. <button type="button" data-retry-account>Tentar novamente</button></div></div></main>`;
      document.querySelector('[data-retry-account]')?.addEventListener('click', () => location.reload());
    }
    dispatchEvent(new CustomEvent('aninexus:auth-v38-ready'));
  }
  function syncDrawerIdentity(user = null) {
    const drawer = document.querySelector('.drawer-auth-card');
    if (!drawer) return;
    const panel = drawer.closest('.drawer-panel'), avatar = drawer.querySelector('.drawer-account-avatar'), title = drawer.querySelector('h3'), description = drawer.querySelector('.drawer-auth-description'), guest = drawer.querySelector('.drawer-guest-actions'), tools = drawer.querySelector('.drawer-account-tools');
    if (!user) {
      if (panel) panel.dataset.authState = 'anonymous';
      drawer.dataset.authState = 'anonymous';
      if (avatar) { avatar.hidden = true; avatar.innerHTML = ''; }
      if (title) title.textContent = 'Entre na sua conta';
      if (description) { description.hidden = false; description.textContent = 'Salve suas listas e acompanhe sua jornada.'; }
      if (guest) guest.hidden = false;
      if (tools) tools.hidden = true;
      return;
    }
    const name = String(user.displayName || user.display_name || user.firstName || user.username || 'Minha conta');
    if (panel) panel.dataset.authState = 'authenticated';
    drawer.dataset.authState = 'authenticated';
    if (avatar) { avatar.hidden = false; avatar.innerHTML = avatarMarkup(user,{name}); }
    if (title) title.textContent = name;
    if (description) { description.hidden = false; description.textContent = user.username ? `@${user.username}` : 'Sua conta AniNexus'; }
    if (guest) guest.hidden = true;
    if (tools) {
      tools.hidden = false;
      const search = tools.querySelector('[data-nx-drawer-search]');
      if (search) search.onclick = () => {
        document.querySelector('#drawer [data-action="drawer-close"]')?.click();
        requestAnimationFrame(() => document.querySelector('.top-actions [data-action="search"]')?.click());
      };
      const settings = tools.querySelector('[data-nx-drawer-settings]');
      if (settings) settings.onclick = () => go('/minha-conta');
      const logout = tools.querySelector('[data-nx-drawer-logout]');
      if (logout) bindSignOutDialog(logout);
    }
  }
  async function syncHeader() {
    const syncToken = ++headerSyncToken;
    const actions = document.querySelector('.top-actions'); if (!actions) return;
    actions.querySelectorAll('.nx38-account-chip').forEach(chip=>chip.remove());
    const login = actions.querySelector('[data-action="login"]'), register = actions.querySelector('[data-action="register"]');
    const setAnonymous=()=>{document.documentElement.dataset.nxAuthState='anonymous';if(login)login.hidden=false;if(register)register.hidden=false;syncDrawerIdentity()};
    if (!ENABLED) { setAnonymous(); return; }
    document.documentElement.dataset.nxAuthState='loading';if(login)login.hidden=false;if(register)register.hidden=false;
    try {
      const clerkUser = await getUser();
      if(syncToken!==headerSyncToken||!actions.isConnected)return;
      if (clerkUser) {
        let user=clerkUser;try{user=(await api('/api/me',{timeout:8_000}))?.user||clerkUser}catch{}
        document.documentElement.dataset.nxAuthState='authenticated';
        if (login) login.hidden = true; if (register) register.hidden = true;
        actions.querySelectorAll('.nx38-account-chip').forEach(chip=>chip.remove());
        const name=String(user.displayName||user.display_name||user.firstName||user.username||'Minha conta');
        const button = document.createElement('button'); button.className = 'nx38-account-chip'; button.type = 'button'; button.setAttribute('aria-label', 'Abrir minha conta'); button.innerHTML = `<i>${avatarMarkup(user,{name,clerkUser})}</i><span>${esc(name)}</span>`; button.onclick = () => go('/minha-conta'); actions.insertBefore(button, actions.querySelector('.menu-btn') || null);
        syncDrawerIdentity(user);
        dispatchEvent(new CustomEvent('aninexus:account-identity-changed',{detail:{user}}));
      } else {
        setAnonymous();
        dispatchEvent(new CustomEvent('aninexus:account-identity-changed',{detail:{user:null}}));
      }
    } catch (error) { if(syncToken!==headerSyncToken)return;console.warn('[AniNexus auth] não foi possível confirmar a sessão no cabeçalho.',error); setAnonymous(); }
  }
  window.AniNexusAuthV38 = { renderAuth, renderAccount, syncHeader, syncDrawerIdentity, getUser, api };
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
  addEventListener('aninexus:route-changed', () => queueMicrotask(mountRoute));
  document.addEventListener('click', event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action !== 'login' && action !== 'register') return;
    event.preventDefault(); event.stopImmediatePropagation();
    go(action === 'login' ? '/login' : '/criar-conta');
  }, true);
  syncHeader();
  setTimeout(mountRoute, 0);
})();
