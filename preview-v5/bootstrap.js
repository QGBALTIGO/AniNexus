'use strict';
(() => {
  const expected = {
    'aninexus:favorites': Array.isArray,
    'aninexus:alerts': Array.isArray,
    'aninexus:list': Array.isArray,
  };
  for (const [key, validator] of Object.entries(expected)) {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) continue;
      if (raw.length > 1_000_000) throw new Error('oversized');
      const value = JSON.parse(raw);
      if (!validator(value)) throw new Error('invalid');
    } catch {
      localStorage.removeItem(key);
    }
  }
  if (!window.requestIdleCallback) window.requestIdleCallback = cb => setTimeout(() => cb({didTimeout:false,timeRemaining:()=>0}), 900);
  if (!window.cancelIdleCallback) window.cancelIdleCallback = id => clearTimeout(id);
  document.documentElement.classList.add('aninexus-js');
  window.__ANINEXUS_PREVIEW_VERSION__ = '5.0.1';
})();
