'use strict';
(() => {
  if (window.__ANINEXUS_INSTALL_V44__) return;
  window.__ANINEXUS_INSTALL_V44__ = true;
  const BUILD = '44.6.0';
  let installPrompt = null;
  let returnFocus = null;

  const buttons = () => [...document.querySelectorAll('[data-nx-install]')];
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function syncButtons() {
    const installed = standalone();
    for (const button of buttons()) {
      button.hidden = installed;
      button.dataset.installReady = installPrompt ? 'native' : 'guide';
    }
  }

  function closeGuide() {
    const layer = document.querySelector('.nx44-install-layer');
    if (!layer) return;
    layer.remove();
    returnFocus?.focus?.();
    returnFocus = null;
  }

  function guideMarkup() {
    const isIOS = ios();
    const steps = isIOS
      ? [
          'Toque em <strong>Compartilhar</strong> na barra do navegador',
          'Role e toque em <strong>Adicionar à Tela de Início</strong>',
          'Confirme em <strong>Adicionar</strong>. Pronto, virou app',
        ]
      : [
          'Abra o menu do seu navegador',
          'Escolha <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>',
          'Confirme a instalação para abrir o AniNexus como app',
        ];
    return `<div class="nx44-install-layer"><button class="nx44-install-backdrop" type="button" data-nx-install-close aria-label="Fechar instruções"></button><section class="nx44-install-sheet" role="dialog" aria-modal="true" aria-labelledby="nx44InstallTitle" tabindex="-1"><header><h2 id="nx44InstallTitle">Instalar o AniNexus</h2><button type="button" data-nx-install-close aria-label="Fechar instruções">×</button></header><p>${isIOS ? '3 passos, direto do Safari' : 'Instale pelo menu do navegador'}</p><ol>${steps.map((step, index) => `<li><span>${index + 1}</span><p>${step}</p></li>`).join('')}</ol><footer><button type="button" data-nx-install-close>Entendi</button></footer></section></div>`;
  }

  function openGuide(button) {
    closeGuide();
    returnFocus = button || document.activeElement;
    document.body.insertAdjacentHTML('beforeend', guideMarkup());
    const layer = document.querySelector('.nx44-install-layer');
    layer.querySelectorAll('[data-nx-install-close]').forEach(close => close.addEventListener('click', closeGuide));
    layer.querySelector('.nx44-install-sheet')?.focus();
  }

  async function requestInstall(button) {
    if (standalone()) return syncButtons();
    if (!installPrompt) return openGuide(button);
    const prompt = installPrompt;
    installPrompt = null;
    try {
      await Promise.resolve(prompt.prompt());
      const choice = await Promise.resolve(prompt.userChoice);
      if (choice?.outcome !== 'accepted') syncButtons();
    } catch {
      openGuide(button);
    }
  }

  addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    syncButtons();
  });
  addEventListener('appinstalled', () => {
    installPrompt = null;
    syncButtons();
    closeGuide();
  });
  addEventListener('keydown', event => {
    if (event.key === 'Escape' && document.querySelector('.nx44-install-layer')) closeGuide();
  });
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-nx-install]');
    if (button) requestInstall(button);
  });

  syncButtons();
  if ('serviceWorker' in navigator) {
    addEventListener('load', () => {
      const serviceWorker = new URL(`sw.js?v=${BUILD}`, document.baseURI);
      navigator.serviceWorker.register(serviceWorker.href, { scope: new URL('.', serviceWorker).pathname }).catch(() => {});
    }, { once: true });
  }
})();
