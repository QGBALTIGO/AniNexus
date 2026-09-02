const PRESETS = ['blue', 'mint', 'pink', 'gold', 'violet', 'teal', 'red', 'graphite'];
const PRESET_SET = new Set(PRESETS);
const PRESET_PATH = /^\/assets\/avatars\/mascot-(blue|mint|pink|gold|violet|teal|red|graphite)\.png$/;

export const AVATAR_PRESETS = Object.freeze([...PRESETS]);

export function avatarPresetFor(seed) {
  const value = String(seed || 'aninexus');
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return PRESETS[(hash >>> 0) % PRESETS.length];
}

export function avatarPresetUrl(preset) {
  const key = PRESET_SET.has(String(preset)) ? String(preset) : 'pink';
  return `/assets/avatars/mascot-${key}.png`;
}

export function avatarPresetFromUrl(value) {
  return String(value || '').match(PRESET_PATH)?.[1] || null;
}

export function avatarForClerkUser(clerkUser) {
  const personalUrl = clerkUser?.hasImage === true && /^https:\/\//i.test(clerkUser.imageUrl || '')
    ? String(clerkUser.imageUrl).slice(0, 2000)
    : null;
  const preset = avatarPresetFor(clerkUser?.id || clerkUser?.username || clerkUser?.primaryEmailAddress?.emailAddress);
  return { url: personalUrl || avatarPresetUrl(preset), preset, personal: Boolean(personalUrl) };
}

export function resolvedAvatar(user) {
  const stored = String(user?.avatar_url || user?.avatarUrl || '').trim();
  const validStored = /^https:\/\//i.test(stored) || PRESET_PATH.test(stored);
  const preset = avatarPresetFromUrl(stored) || avatarPresetFor(user?.id || user?.username || user?.email);
  return { url: validStored ? stored : avatarPresetUrl(preset), preset };
}
