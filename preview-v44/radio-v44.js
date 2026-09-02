'use strict';
(() => {
  if (window.__NX44_RADIO__) return;
  window.__NX44_RADIO__ = true;

  const STREAM_URL = 'https://listen.moe/fallback';
  const GATEWAY_URL = 'wss://listen.moe/gateway_v2';
  const IS_PAGES = location.hostname.endsWith('github.io');
  const RADIO_STORAGE = 'aninexus:radio:v44';
  const RADIO_RESUME_STORAGE = 'aninexus:radio:resume:v44';
  const RADIO_ACTIVATED_STORAGE = 'aninexus:radio:activated:v44';
  const RADIO_TAB_STORAGE = 'aninexus:radio:active-tab:v44';
  const tabId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const app = document.querySelector('#app');
  const svg = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 9 6-9 6V6Z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6v12M15 6v12"/></svg>',
    volume: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 10h4l5-4v12l-5-4H5v-4Z"/><path d="M17 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11"/></svg>',
    muted: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 10h4l5-4v12l-5-4H5v-4Z"/><path d="m17 10 4 4M21 10l-4 4"/></svg>',
  };

  let accountPromise = null;
  let accountValue = null;
  let accountResolved = false;

  function waitForAuthState(timeout = 4500) {
    const state = document.documentElement.dataset.nxAuthState;
    if (state === 'authenticated' || state === 'anonymous' || window.AniNexusAuth?.enabled !== true) return Promise.resolve(state || 'anonymous');
    return new Promise(resolve => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        observer.disconnect();
        clearTimeout(timer);
        resolve(document.documentElement.dataset.nxAuthState || 'anonymous');
      };
      const observer = new MutationObserver(() => {
        const next = document.documentElement.dataset.nxAuthState;
        if (next === 'authenticated' || next === 'anonymous') finish();
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-nx-auth-state'] });
      const timer = setTimeout(finish, timeout);
    });
  }

  async function accountData({ refresh = false } = {}) {
    if (window.AniNexusAuth?.enabled !== true) return null;
    const state = await waitForAuthState();
    if (state !== 'authenticated') return null;
    if (refresh) {
      accountPromise = null;
      accountValue = null;
      accountResolved = false;
    }
    if (accountResolved) return accountValue;
    if (!accountPromise) {
      accountPromise = window.AniNexusAuth.api('/api/me', { timeout: 8000 })
        .then(result => result?.user || null)
        .catch(() => null)
        .then(user => {
          accountValue = user;
          accountResolved = true;
          dispatchEvent(new CustomEvent('aninexus:account-identity-changed', { detail: { user } }));
          return user;
        });
    }
    return accountPromise;
  }
  window.AniNexusAccountData = accountData;
  addEventListener('aninexus:account-identity-changed', event => {
    if (!event.detail || !Object.prototype.hasOwnProperty.call(event.detail, 'user')) return;
    accountValue = event.detail.user || null;
    accountResolved = true;
    accountPromise = Promise.resolve(accountValue);
  });

  const saved = (() => {
    try { return JSON.parse(localStorage.getItem(RADIO_STORAGE) || '{}'); } catch { return {}; }
  })();
  const resumeRequested = (() => {
    try {
      const value = JSON.parse(sessionStorage.getItem(RADIO_RESUME_STORAGE) || 'null');
      const valid = value?.playing === true;
      if (!valid) sessionStorage.removeItem(RADIO_RESUME_STORAGE);
      return valid;
    } catch { return false; }
  })();
  let activated = (() => {
    try { return sessionStorage.getItem(RADIO_ACTIVATED_STORAGE) === '1'; } catch { return false; }
  })();
  const audio = document.createElement('audio');
  audio.id = 'nx44RadioAudio';
  audio.hidden = true;
  audio.preload = 'none';
  audio.playsInline = true;
  audio.volume = Number.isFinite(Number(saved.volume)) ? Math.min(1, Math.max(0, Number(saved.volume))) : 0.72;
  audio.muted = saved.muted === true;
  document.body.append(audio);

  let ui = null;
  let state = 'paused';
  let playIntent = false;
  let track = { title: 'LISTEN.moe J-POP', artist: 'Música japonesa ao vivo' };
  let socket = null;
  let socketHeartbeat = 0;
  let socketRetry = 0;
  let socketAttempt = 0;
  let audioRetry = 0;
  let audioAttempt = 0;
  let mountTimer = 0;
  let layoutFrame = 0;
  let volumePanelOpen = false;
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel('aninexus-radio-v44') : null;

  function persistAudioSettings() {
    try { localStorage.setItem(RADIO_STORAGE, JSON.stringify({ volume: audio.volume, muted: audio.muted })); } catch {}
  }

  function setPlaybackResume(enabled) {
    try {
      if (enabled) {
        sessionStorage.setItem(RADIO_RESUME_STORAGE, JSON.stringify({ playing: true, at: Date.now() }));
      } else {
        sessionStorage.removeItem(RADIO_RESUME_STORAGE);
      }
    } catch {}
  }

  function preservePlaybackForNavigation() {
    setPlaybackResume(playIntent && (state === 'playing' || state === 'loading'));
  }

  function announcePlayback() {
    const message = { type: 'playing', tabId, at: Date.now() };
    channel?.postMessage(message);
    try { localStorage.setItem(RADIO_TAB_STORAGE, JSON.stringify(message)); } catch {}
  }

  function pauseForAnotherTab() {
    playIntent = false;
    setPlaybackResume(false);
    clearTimeout(audioRetry);
    audio.pause();
    state = 'paused';
    render();
  }

  channel?.addEventListener('message', event => {
    if (event.data?.type === 'playing' && event.data.tabId !== tabId) pauseForAnotherTab();
  });
  addEventListener('storage', event => {
    if (event.key !== RADIO_TAB_STORAGE || !event.newValue) return;
    try {
      const message = JSON.parse(event.newValue);
      if (message?.type === 'playing' && message.tabId !== tabId) pauseForAnotherTab();
    } catch {}
  });

  function setMediaSession() {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: 'LISTEN.moe J-POP',
      });
      navigator.mediaSession.playbackState = state === 'playing' ? 'playing' : 'paused';
    } catch {}
  }

  function render() {
    if (!ui?.isConnected) return;
    ui.dataset.state = state;
    const play = ui.querySelector('[data-nx44-play]');
    const volume = ui.querySelector('[data-nx44-volume]');
    const slider = ui.querySelector('[data-nx44-volume-range]');
    const title = ui.querySelector('[data-nx44-title]');
    const artist = ui.querySelector('[data-nx44-artist]');
    const playing = state === 'playing' || state === 'loading';
    if (play) {
      play.innerHTML = playing ? svg.pause : svg.play;
      const action = playing ? 'Pausar rádio' : 'Ouvir rádio';
      play.setAttribute('aria-label', ui.classList.contains('nx44-radio--float') ? `${action}: ${track.title}` : action);
      play.title = ui.classList.contains('nx44-radio--float') ? `${action} · ${track.title}` : action;
    }
    if (volume) {
      volume.innerHTML = audio.muted ? svg.muted : svg.volume;
      const value = audio.muted ? 0 : Math.round(audio.volume * 100);
      volume.setAttribute('aria-label', `Ajustar volume, ${value}%`);
      volume.title = `Volume · ${value}%`;
    }
    if (slider) {
      const value = audio.muted ? 0 : Math.round(audio.volume * 100);
      slider.value = String(value);
      slider.style.setProperty('--nx44-volume', `${value}%`);
      slider.setAttribute('aria-valuetext', audio.muted ? 'Mudo' : `${value}%`);
      ui.querySelector('[data-nx44-volume-value]')?.replaceChildren(`${value}%`);
    }
    if (volume) {
      const panel = ui.querySelector('[data-nx44-volume-panel]');
      volume.setAttribute('aria-expanded', String(volumePanelOpen));
      if (panel) panel.hidden = !volumePanelOpen;
    }
    if (title) title.textContent = track.title;
    if (artist) artist.textContent = state === 'error' ? 'Rádio indisponível agora. Toque para tentar novamente.' : track.artist;
    ui.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
    setMediaSession();
    scheduleFloatingLayout();
  }

  function layoutFloatingPlayer() {
    layoutFrame = 0;
    if (!ui?.classList.contains('nx44-radio--float')) return;
    const consent = document.querySelector('body > .nx42-consent');
    if (!consent || !matchMedia('(max-width:720px)').matches) {
      ui.style.removeProperty('--nx44-float-bottom');
      return;
    }
    const box = consent.getBoundingClientRect();
    ui.style.setProperty('--nx44-float-bottom', `${Math.ceil(Math.max(18, innerHeight - box.top + 12))}px`);
  }

  function scheduleFloatingLayout() {
    cancelAnimationFrame(layoutFrame);
    layoutFrame = requestAnimationFrame(layoutFloatingPlayer);
  }

  function bindImmediateControl(button, action) {
    if (!button) return;
    button.addEventListener('pointerdown', event => {
      if (event.button === 0) action(event);
    });
    button.addEventListener('click', event => {
      if (event.detail === 0) action(event);
    });
  }

  function playerMarkup(mode) {
    const section = document.createElement('section');
    section.className = `nx44-radio nx44-radio--${mode}`;
    section.dataset.nx44Radio = '';
    section.setAttribute('role', 'region');
    section.setAttribute('aria-label', 'Rádio de música japonesa ao vivo');
    section.innerHTML = mode === 'float'
      ? `<button class="nx44-radio-control nx44-radio-play nx44-radio-float-button" type="button" data-nx44-play></button>`
      : `<button class="nx44-radio-control nx44-radio-play" type="button" data-nx44-play></button><div class="nx44-radio-copy"><span><i aria-hidden="true"></i>RÁDIO AO VIVO</span><strong data-nx44-title></strong><small data-nx44-artist></small></div><div class="nx44-radio-volume-wrap"><button class="nx44-radio-control nx44-radio-volume" type="button" data-nx44-volume aria-expanded="false" aria-controls="nx44RadioVolumePanel"></button><div class="nx44-radio-volume-panel" id="nx44RadioVolumePanel" data-nx44-volume-panel hidden><span data-nx44-volume-value>72%</span><input type="range" min="0" max="100" step="1" value="72" data-nx44-volume-range aria-label="Volume da rádio"></div></div>`;
    bindImmediateControl(section.querySelector('[data-nx44-play]'), togglePlayback);
    const volumeButton = section.querySelector('[data-nx44-volume]');
    bindImmediateControl(volumeButton, toggleVolumePanel);
    section.querySelector('[data-nx44-volume-range]')?.addEventListener('input', setVolume);
    return section;
  }

  function mount() {
    if (!app?.firstElementChild) return;
    const copy = document.querySelector('.nx35-home .nx35-hero-copy');
    const mode = copy ? 'inline' : activated ? 'float' : '';
    if (!mode) {
      ui?.remove();
      ui = null;
      return;
    }
    if (ui?.isConnected && ui.classList.contains(`nx44-radio--${mode}`)) return render();
    if (mode === 'float') volumePanelOpen = false;
    ui?.remove();
    ui = playerMarkup(mode);
    if (copy) {
      const description = copy.querySelector(':scope > p');
      if (description) description.insertAdjacentElement('afterend', ui);
      else copy.append(ui);
    } else {
      document.body.append(ui);
    }
    render();
  }

  function scheduleMount() {
    clearTimeout(mountTimer);
    mountTimer = setTimeout(mount, 45);
  }

  async function startPlayback({ reset = false } = {}) {
    if (!activated) {
      activated = true;
      try { sessionStorage.setItem(RADIO_ACTIVATED_STORAGE, '1'); } catch {}
      scheduleMount();
    }
    playIntent = true;
    setPlaybackResume(true);
    clearTimeout(audioRetry);
    state = 'loading';
    render();
    if (reset || !audio.getAttribute('src')) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audio.src = STREAM_URL;
    }
    try {
      await audio.play();
      audioAttempt = 0;
      announcePlayback();
    } catch (error) {
      if (error?.name === 'NotAllowedError' || error?.name === 'AbortError') {
        playIntent = false;
        setPlaybackResume(false);
        state = 'paused';
      } else {
        state = 'error';
      }
      render();
    }
  }

  function stopPlayback() {
    playIntent = false;
    setPlaybackResume(false);
    clearTimeout(audioRetry);
    audio.pause();
    state = 'paused';
    render();
  }

  function togglePlayback() {
    if (state === 'playing' || state === 'loading') stopPlayback();
    else startPlayback({ reset: state === 'error' });
  }

  function closeVolumePanel() {
    const panel = ui?.querySelector('[data-nx44-volume-panel]');
    const button = ui?.querySelector('[data-nx44-volume]');
    if (!panel || panel.hidden) return;
    volumePanelOpen = false;
    panel.hidden = true;
    button?.setAttribute('aria-expanded', 'false');
  }

  function toggleVolumePanel(event) {
    const panel = ui?.querySelector('[data-nx44-volume-panel]');
    if (!panel) return;
    const open = panel.hidden;
    volumePanelOpen = open;
    panel.hidden = !open;
    event.currentTarget.setAttribute('aria-expanded', String(open));
    if (open) requestAnimationFrame(() => panel.querySelector('input')?.focus());
  }

  function setVolume(event) {
    const value = Math.min(100, Math.max(0, Number(event.currentTarget.value) || 0));
    audio.volume = value / 100;
    audio.muted = value === 0;
    persistAudioSettings();
    render();
  }

  function navigateWithoutReload(value) {
    if (!activated || IS_PAGES) return false;
    let target;
    try { target = new URL(value, location.href); } catch { return false; }
    if (target.origin !== location.origin) return false;
    const route = `${target.pathname}${target.search}${target.hash}`;
    if (!route.startsWith('/')) return false;
    history.pushState({}, '', route);
    dispatchEvent(new PopStateEvent('popstate'));
    dispatchEvent(new CustomEvent('aninexus:navigate', { detail: { route } }));
    scrollTo({ top: 0, behavior: 'auto' });
    return true;
  }

  function retryAudio() {
    if (!playIntent || !navigator.onLine) return;
    clearTimeout(audioRetry);
    const delay = Math.min(16000, 1200 * (2 ** Math.min(audioAttempt++, 4)));
    audioRetry = setTimeout(() => startPlayback({ reset: true }), delay);
  }

  audio.addEventListener('playing', () => {
    if (!playIntent) return audio.pause();
    setPlaybackResume(true);
    state = 'playing';
    audioAttempt = 0;
    render();
  });
  audio.addEventListener('waiting', () => {
    if (playIntent) { state = 'loading'; render(); }
  });
  audio.addEventListener('pause', () => {
    if (!playIntent) { state = 'paused'; render(); }
  });
  audio.addEventListener('error', () => {
    if (!playIntent) return;
    state = 'error';
    render();
    retryAudio();
  });

  function clearSocketTimers() {
    clearInterval(socketHeartbeat);
    clearTimeout(socketRetry);
    socketHeartbeat = 0;
    socketRetry = 0;
  }

  function sendHeartbeat() {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ op: 9 }));
  }

  function updateTrack(payload) {
    const song = payload?.d?.song || payload?.d?.track || payload?.d;
    const title = String(song?.title || song?.titleRomaji || '').trim();
    if (!title) return;
    const artists = Array.isArray(song?.artists) ? song.artists : [];
    const artist = artists.map(item => item?.nameRomaji || item?.name || item?.nameEnglish).filter(Boolean).join(', ') || 'LISTEN.moe';
    track = { title, artist };
    render();
  }

  function connectMetadata() {
    if (!('WebSocket' in window) || !navigator.onLine || socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return;
    clearSocketTimers();
    try { socket = new WebSocket(GATEWAY_URL); } catch { scheduleSocketReconnect(); return; }
    socket.addEventListener('open', () => { socketAttempt = 0; });
    socket.addEventListener('message', event => {
      let payload;
      try { payload = JSON.parse(event.data); } catch { return; }
      if (payload?.op === 0) {
        const interval = Math.max(10000, Number(payload?.d?.heartbeat) || 30000);
        sendHeartbeat();
        clearInterval(socketHeartbeat);
        socketHeartbeat = setInterval(sendHeartbeat, interval);
      } else if (payload?.op === 1 && (!payload.t || payload.t === 'TRACK_UPDATE' || payload.t === 'TRACK_UPDATE_REQUEST')) {
        updateTrack(payload);
      }
    });
    socket.addEventListener('close', scheduleSocketReconnect);
    socket.addEventListener('error', () => socket?.close());
  }

  function scheduleSocketReconnect() {
    clearInterval(socketHeartbeat);
    socketHeartbeat = 0;
    socket = null;
    if (!navigator.onLine) return;
    clearTimeout(socketRetry);
    const delay = Math.min(30000, 2500 * (2 ** Math.min(socketAttempt++, 4)));
    socketRetry = setTimeout(connectMetadata, delay);
  }

  addEventListener('online', () => {
    connectMetadata();
    if (playIntent && state !== 'playing') startPlayback({ reset: true });
  });
  addEventListener('offline', () => {
    clearSocketTimers();
    if (playIntent) { state = 'error'; render(); }
  });
  addEventListener('pagehide', preservePlaybackForNavigation);
  addEventListener('pageshow', event => {
    if (event.persisted && playIntent && audio.paused) startPlayback({ reset: true });
  });
  addEventListener('popstate', scheduleMount);
  addEventListener('aninexus:navigate', scheduleMount);
  addEventListener('aninexus:route-ready', scheduleMount);
  addEventListener('aninexus:home-v34-ready', scheduleMount);
  addEventListener('resize', scheduleFloatingLayout, { passive: true });
  document.addEventListener('pointerdown', event => {
    if (!event.target.closest?.('.nx44-radio-volume-wrap')) closeVolumePanel();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeVolumePanel();
  });
  app && new MutationObserver(scheduleMount).observe(app, { childList: true, subtree: true });
  new MutationObserver(scheduleFloatingLayout).observe(document.body, { childList: true });

  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.setActionHandler('play', () => startPlayback());
      navigator.mediaSession.setActionHandler('pause', stopPlayback);
    } catch {}
  }

  window.AniNexusRadio = Object.freeze({ play: startPlayback, pause: stopPlayback, navigate: navigateWithoutReload, audio, get activated() { return activated; } });
  scheduleMount();
  connectMetadata();
  if (resumeRequested) setTimeout(() => startPlayback({ reset: true }), 0);
})();
