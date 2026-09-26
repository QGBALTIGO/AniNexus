(() => {
  const incoming = new URLSearchParams(location.hash.slice(1)).get('manga-link');
  if (incoming && /^[a-f0-9]{64}$/.test(incoming)) {
    sessionStorage.setItem('anx_manga_approval', JSON.stringify({code:incoming,at:Date.now()}));
    history.replaceState(null,'',location.pathname+location.search);
  }
  let pending;try{pending=JSON.parse(sessionStorage.getItem('anx_manga_approval')||'null');}catch{}
  if(!pending || Date.now()-pending.at>600000)return;
  const dialog=document.createElement('dialog');
  dialog.style.cssText='background:#181a20;color:#f4f2ed;border:1px solid #3b3e46;border-radius:16px;padding:28px;width:min(420px,calc(100vw - 32px));margin:auto;font:15px/1.6 system-ui;z-index:2147483000';
  dialog.innerHTML='<h2 style="margin:0 0 12px;font-size:23px">Conectar Mangás Baltigo</h2><p>Autorize o webapp a adicionar e remover favoritos de mangás e atualizar sua lista e progresso de leitura no AniNexus.</p><p style="color:#b7bac4;font-size:13px">Continue somente se você iniciou esta conexão no seu Telegram. Nenhuma senha será compartilhada. A conexão pode ser removida no perfil do webapp.</p><p id="mangaApprovalState" role="status"></p><button id="mangaApprove" style="width:100%;padding:14px;background:#ec684e;color:#151515;border:0;border-radius:8px;font:600 14px system-ui">Entrar e autorizar conexão</button><button id="mangaCancel" style="width:100%;padding:12px;margin-top:8px;background:transparent;color:#c9cbd2;border:0;font:14px system-ui">Cancelar</button>';
  document.body.append(dialog);
  if(!location.pathname.startsWith('/login'))dialog.showModal();
  const loginWatch=setInterval(()=>{
    if(!dialog.isConnected){clearInterval(loginWatch);return;}
    if(window.Clerk?.user&&!dialog.open)dialog.showModal();
    if(Date.now()-pending.at>600000){clearInterval(loginWatch);sessionStorage.removeItem('anx_manga_approval');}
  },1000);
  const clear=()=>{sessionStorage.removeItem('anx_manga_approval');dialog.close();dialog.remove();};
  dialog.querySelector('#mangaCancel').onclick=clear;
  dialog.addEventListener('cancel',clear);
  dialog.querySelector('#mangaApprove').onclick=async()=>{
    const button=dialog.querySelector('#mangaApprove'),status=dialog.querySelector('#mangaApprovalState');
    button.disabled=true;
    try{
      const auth=window.AniNexusAuth;
      if(!auth)throw new Error('AUTH_NOT_READY');
      const user=await auth.requireAccount();
      if(!user){dialog.close();status.textContent='Entre na sua conta e toque novamente para autorizar.';return;}
      await auth.api('/api/manga-link/approve',{method:'POST',body:JSON.stringify({code:pending.code})});
      sessionStorage.removeItem('anx_manga_approval');
      status.textContent='Conexão autorizada. Volte ao Telegram e toque em Verificar conexão.';
      button.hidden=true;dialog.querySelector('#mangaCancel').textContent='Concluir';
    }catch(error){status.textContent='Não foi possível autorizar. Se o código expirou, inicie uma nova conexão no webapp.';}
    finally{button.disabled=false;}
  };
})();
