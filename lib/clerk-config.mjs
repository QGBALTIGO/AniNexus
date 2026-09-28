export function clerkInstanceKind(secretKey = '') {
  const key = String(secretKey || '');
  if (key.startsWith('sk_live_')) return 'production';
  if (key.startsWith('sk_test_')) return 'development';
  return 'unknown';
}

export function clerkFrontendApiOrigin(publishableKey = '') {
  const key = String(publishableKey || '');
  const match = /^pk_(?:test|live)_([A-Za-z0-9+/=_-]+)$/.exec(key);
  if (!match) return '';
  try {
    const encoded = match[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const host = decoded.endsWith('$') ? decoded.slice(0, -1) : decoded;
    if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(host)) return '';
    const url = new URL(`https://${host}`);
    return url.protocol === 'https:' && url.pathname === '/' ? url.origin : '';
  } catch {
    return '';
  }
}
