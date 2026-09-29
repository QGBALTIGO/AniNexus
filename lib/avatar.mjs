const COLOR_PRESETS = ['blue', 'mint', 'pink', 'gold', 'violet', 'teal', 'red', 'graphite'];
const PRESETS = ['default', ...COLOR_PRESETS];
const PRESET_SET = new Set(PRESETS);
const PRESET_PATH = /^\/assets\/avatars\/mascot-(blue|mint|pink|gold|violet|teal|red|graphite)\.png$/;
export const DEFAULT_AVATAR_URL = '/assets/logo.png';
const PROFILE_MEDIA_PATH = /^\/media\/profile\/[0-9a-f-]{36}\/avatar-[a-f0-9]{16}\.webp$/;
const PUBLIC_ORIGIN = /^https:\/\//.test(String(process.env.PUBLIC_ORIGIN || '')) ? String(process.env.PUBLIC_ORIGIN).replace(/\/+$/, '') : 'https://aninexus.com.br';

export const AVATAR_PRESETS = Object.freeze([...PRESETS]);

export function avatarPresetFor(seed) {
  const value = String(seed || 'aninexus');
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return COLOR_PRESETS[(hash >>> 0) % COLOR_PRESETS.length];
}

export function avatarPresetUrl(preset) {
  const key = PRESET_SET.has(String(preset)) ? String(preset) : 'default';
  if (key === 'default') return DEFAULT_AVATAR_URL;
  return `/assets/avatars/mascot-${key}.png`;
}

export function avatarPresetFromUrl(value) {
  const path = String(value || '').split('?')[0];
  return path === DEFAULT_AVATAR_URL ? 'default' : path.match(PRESET_PATH)?.[1] || null;
}

export function avatarForClerkUser(clerkUser) {
  const personalUrl = clerkUser?.hasImage === true && /^https:\/\//i.test(clerkUser.imageUrl || '')
    ? String(clerkUser.imageUrl).slice(0, 2000)
    : null;
  const preset = personalUrl ? avatarPresetFor(clerkUser?.id || clerkUser?.username || clerkUser?.primaryEmailAddress?.emailAddress) : 'default';
  return { url: personalUrl || avatarPresetUrl(preset), preset, personal: Boolean(personalUrl) };
}

export function resolvedAvatar(user) {
  const stored = String(user?.avatar_url || user?.avatarUrl || '').trim();
  const storedPath = stored.split('?')[0];
  const validStored = /^https:\/\//i.test(stored) || storedPath === DEFAULT_AVATAR_URL || PRESET_PATH.test(storedPath) || PROFILE_MEDIA_PATH.test(storedPath);
  const preset = avatarPresetFromUrl(stored) || avatarPresetFor(user?.id || user?.username || user?.email);
  const url = PROFILE_MEDIA_PATH.test(storedPath) ? `${PUBLIC_ORIGIN}${stored}` : stored;
  return { url: validStored ? url : avatarPresetUrl(preset), preset };
}
