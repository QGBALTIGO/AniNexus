'use strict';
(() => {
  if (window.AniNexusAvatar) return;
  const PRESETS = Object.freeze([
    { key: 'blue', label: 'Azul' }, { key: 'mint', label: 'Menta' },
    { key: 'pink', label: 'Rosa' }, { key: 'gold', label: 'Dourado' },
    { key: 'violet', label: 'Violeta' }, { key: 'teal', label: 'Turquesa' },
    { key: 'red', label: 'Vermelho' }, { key: 'graphite', label: 'Grafite' },
  ]);
  const KEYS = new Set(PRESETS.map(item => item.key));
  const IS_PAGES = location.hostname.endsWith('github.io');
  const BASE = IS_PAGES ? '/AniNexus' : '';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const asset = key => `${BASE}/assets/avatars/mascot-${KEYS.has(String(key)) ? key : 'pink'}.png`;
  const presetFromUrl = value => String(value || '').match(/(?:^|\/)assets\/avatars\/mascot-(blue|mint|pink|gold|violet|teal|red|graphite)\.png(?:$|[?#])/)?.[1] || '';
  function presetFor(seed) {
    const value = String(seed || 'aninexus');
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); }
    return PRESETS[(hash >>> 0) % PRESETS.length].key;
  }
  function normalize(value) {
    const url = String(value || '').trim();
    if (/^\/assets\/avatars\//.test(url)) return `${BASE}${url}`;
    if (/^assets\/avatars\//.test(url)) return `${BASE}/${url}`;
    return /^(?:https:|data:image\/|blob:)/i.test(url) ? url : '';
  }
  function url(user, options = {}) {
    const clerkUser = options.clerkUser || (Object.prototype.hasOwnProperty.call(user || {}, 'hasImage') ? user : null);
    const stored = user?.avatarUrl || user?.avatar_url || user?.imageUrl || '';
    const ignoreClerkDefault = clerkUser?.hasImage === false && stored === clerkUser?.imageUrl;
    const normalized = ignoreClerkDefault ? '' : normalize(stored);
    if (normalized) return normalized;
    const chosen = user?.avatarPreset || user?.avatar_preset || presetFromUrl(stored);
    return asset(KEYS.has(String(chosen)) ? chosen : presetFor(user?.id || user?.username || user?.email || options.seed));
  }
  function markup(user, options = {}) {
    const name = String(options.name || user?.displayName || user?.display_name || user?.firstName || user?.username || 'membro');
    return `<img src="${esc(url(user, options))}" alt="${options.decorative ? '' : esc(`Avatar de ${name}`)}"${options.loading ? ` loading="${esc(options.loading)}" decoding="async"` : ''}>`;
  }
  window.AniNexusAvatar = Object.freeze({ PRESETS, asset, presetFor, presetFromUrl, url, markup });
})();
