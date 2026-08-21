'use strict';
(() => {
  const app=document.querySelector('#app');
  if(!app)return;
  const IS_PAGES=location.hostname.endsWith('github.io');
  const BASE=IS_PAGES?'/AniNexus':'';
  const CONTACT_EMAIL='contato@aninexus.com.br';
  let mounted=false;

  const shield=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 6v5.3c0 4.7-2.8 8-8 9.7-5.2-1.7-8-5-8-9.7V6l8-3Z"/><path d="m8.3 12 2.3 2.3 5-5"/></svg>`;
  const mail=`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>`;
  const info=`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 10.5v6M12 7.2h.01"/></svg>`;

  function route(){
    const u=new URL(location.href);const restored=u.searchParams.get('p');
    if(restored)return restored.split('?')[0].replace(/\/+$/,'')||'/';
    let p=location.pathname;if(IS_PAGES)p=p.replace(/^\/AniNexus/,'')||'/';return p.replace(/\/+$/,'')||'/';
  }
  const link=p=>`${BASE}${p}`;

  function page(){
    return `<div class="nx-dmca">
      <section class="nx-dmca-hero"><div class="shell">
        <div class="nx-dmca-kicker">${shield}<span>Direitos autorais & propriedade intelectual</span></div>
        <h1>DMCA</h1>
        <div class="nx-dmca-updated">Última atualização: 21 de agosto de 2026</div>
      </div></section>
      <div class="shell nx-dmca-layout">
        <main class="nx-dmca-main">
          <p class="nx-dmca-lead"><strong>O AniNexus é uma plataforma informativa de catálogo, descoberta e comunidade sobre animes, mangás e light novels.</strong> O AniNexus não hospeda, não armazena e não transmite episódios, filmes ou outros conteúdos audiovisuais protegidos. Imagens, nomes de obras, personagens, marcas, trailers incorporados, sinopses e demais materiais de terceiros pertencem aos respectivos titulares e são apresentados para identificação, informação, crítica, descoberta e divulgação, conforme aplicável e de acordo com nossos <a class="nx-inline-link" href="${link('/termos-de-uso')}" data-link>Termos de Serviço</a>.</p>
          <p class="nx-dmca-lead">Respeitamos direitos de propriedade intelectual e analisamos solicitações de remoção relacionadas ao Digital Millennium Copyright Act (DMCA), à Lei de Direitos Autorais brasileira (Lei nº 9.610/1998), ao Marco Civil da Internet (Lei nº 12.965/2014) e a outras normas aplicáveis.</p>

          <div class="nx-dmca-callout">${info}<div><strong>Antes de enviar uma solicitação</strong><span>Informe a URL exata dentro do AniNexus e descreva claramente qual material ou direito está envolvido. Pedidos genéricos ou sem informações suficientes podem exigir complementação.</span></div></div>

          <section class="nx-dmca-section" id="notificacao"><h2>Notificação de violação</h2><p>Se você é titular de direitos autorais, ou está autorizado a representar o titular, e acredita que um conteúdo exibido no AniNexus viola esses direitos, a notificação deve conter:</p>
            <ol class="nx-dmca-list">
              <li>Identificação suficientemente precisa da obra protegida ou do conjunto de obras que você afirma terem sido violadas.</li>
              <li>A URL exata da página ou do elemento supostamente infrator dentro do AniNexus.</li>
              <li>Nome completo, e-mail válido e, quando pertinente, identificação do titular que você representa.</li>
              <li>Declaração de boa-fé de que o uso questionado não foi autorizado pelo titular, por seu representante ou pela legislação aplicável.</li>
              <li>Declaração de que as informações fornecidas são verdadeiras e de que você é titular ou possui autorização para agir em nome do titular.</li>
              <li>Assinatura física ou eletrônica do titular ou de seu representante autorizado.</li>
            </ol>
          </section>

          <section class="nx-dmca-section" id="como-enviar"><h2>Como enviar</h2><p>Você pode usar o formulário seguro abaixo. Quando o AniNexus estiver rodando na infraestrutura definitiva, a solicitação será recebida pelo backend, registrada para auditoria e encaminhada ao fluxo interno responsável por direitos autorais.</p><p>Também disponibilizamos o canal <a class="nx-inline-link" href="mailto:${CONTACT_EMAIL}?subject=DMCA%20-%20AniNexus">${CONTACT_EMAIL}</a> com o assunto <strong>“DMCA”</strong>.</p></section>

          <section class="nx-dmca-form-wrap" id="formulario-dmca">
            <div class="nx-dmca-form-head"><h2>Enviar solicitação de remoção</h2><p>Preencha todos os dados necessários. Informações incompletas podem atrasar a análise.</p></div>
            <form class="nx-dmca-form" id="nxDmcaForm" novalidate>
              <div class="nx-dmca-field"><label for="dmcaName">Seu nome completo</label><input id="dmcaName" name="requesterName" autocomplete="name" minlength="2" maxlength="150" required></div>
              <div class="nx-dmca-field"><label for="dmcaEmail">Seu e-mail</label><input id="dmcaEmail" name="requesterEmail" type="email" autocomplete="email" maxlength="254" required></div>
              <div class="nx-dmca-field"><label for="dmcaHolder">Titular dos direitos</label><input id="dmcaHolder" name="rightsHolder" minlength="2" maxlength="200" required></div>
              <div class="nx-dmca-field"><label for="dmcaUrl">URL do conteúdo no AniNexus</label><input id="dmcaUrl" name="contentUrl" type="url" placeholder="https://..." maxlength="1200" required></div>
              <div class="nx-dmca-field full"><label for="dmcaDescription">Descrição da obra e da alegada violação</label><textarea id="dmcaDescription" name="description" minlength="30" maxlength="6000" required placeholder="Identifique a obra, explique sua relação com os direitos e descreva exatamente o conteúdo que deve ser analisado."></textarea></div>
              <div class="nx-dmca-field full"><label for="dmcaSignature">Assinatura eletrônica</label><input id="dmcaSignature" name="signature" minlength="2" maxlength="200" placeholder="Digite seu nome completo" required></div>
              <label class="nx-dmca-check"><input name="goodFaith" type="checkbox" required><span>Declaro, de boa-fé, que o uso questionado não foi autorizado pelo titular dos direitos, por seu representante ou pela legislação aplicável.</span></label>
              <label class="nx-dmca-check"><input name="accuracy" type="checkbox" required><span>Confirmo que as informações enviadas são corretas e que sou titular dos direitos ou estou autorizado a agir em nome dele.</span></label>
              ${IS_PAGES?'<div class="nx-dmca-preview-note">Esta é a prévia no GitHub Pages. O envio seguro para o banco funciona quando o backend do AniNexus estiver ativo na VPS. Nesta prévia, o botão prepara a mesma solicitação no seu aplicativo de e-mail.</div>':''}
              <div class="nx-dmca-submit-row"><button class="nx-dmca-submit" type="submit">${IS_PAGES?'Preparar e-mail':'Enviar solicitação'}</button><a class="nx-dmca-mail" href="mailto:${CONTACT_EMAIL}?subject=DMCA%20-%20AniNexus">Enviar por e-mail</a></div>
              <div class="nx-dmca-status" id="nxDmcaStatus" role="status" aria-live="polite"></div>
            </form>
          </section>

          <section class="nx-dmca-section" id="contranotificacao"><h2>Contranotificação</h2><p>Se conteúdo relacionado a você tiver sido removido ou desabilitado e você entender que isso ocorreu por engano ou identificação incorreta, poderá enviar uma contranotificação pelo mesmo canal. Identifique o conteúdo removido, explique de maneira objetiva por que considera a remoção equivocada e forneça dados de contato suficientes para análise.</p></section>
          <section class="nx-dmca-section" id="reincidencia"><h2>Reincidência</h2><p>Contas ou recursos utilizados de forma reiterada para violar direitos de propriedade intelectual poderão ser restringidos, suspensos ou encerrados, conforme a gravidade, o histórico e os <a class="nx-inline-link" href="${link('/termos-de-uso')}" data-link>Termos de Serviço</a>.</p></section>
          <section class="nx-dmca-section" id="processamento"><h2>Processamento das solicitações</h2><p>Podemos solicitar informações adicionais para verificar legitimidade, localizar o conteúdo corretamente ou prevenir abuso do procedimento. Quando uma solicitação for considerada procedente, poderemos remover, ocultar ou desabilitar o acesso ao material indicado. Registros relevantes podem ser preservados para segurança, auditoria e cumprimento de obrigações legais.</p></section>

          <section class="nx-dmca-english" id="english"><h2>DMCA — English Version</h2>
            <section class="nx-dmca-section"><h3>About AniNexus</h3><p>AniNexus is an informational catalog, discovery platform and community focused on anime, manga and light novels. AniNexus does not host, store or stream copyrighted episodes, movies or other audiovisual works. Third-party titles, images, characters, trademarks, embedded trailers and related materials remain the property of their respective rights holders.</p></section>
            <section class="nx-dmca-section"><h3>Copyright infringement notice</h3><p>If you are a copyright owner, or authorized to act on behalf of one, and believe that material displayed on AniNexus infringes your rights, please provide: identification of the protected work; the exact AniNexus URL; your full name and email; a good-faith statement that the disputed use is not authorized; a statement confirming the accuracy of your notice and your authority to submit it; and your physical or electronic signature.</p></section>
            <section class="nx-dmca-section"><h3>How to submit</h3><p>Use the secure form on this page or send your notice to <a class="nx-inline-link" href="mailto:${CONTACT_EMAIL}?subject=DMCA%20-%20AniNexus">${CONTACT_EMAIL}</a> with the subject “DMCA”. Requests are reviewed and appropriate action may include removing or disabling access to the identified material.</p></section>
            <section class="nx-dmca-section"><h3>Counter-notification</h3><p>If content connected to you was removed and you believe the action resulted from a mistake or misidentification, you may submit a counter-notice explaining the issue, identifying the removed material and providing your contact information.</p></section>
            <section class="nx-dmca-section"><h3>Repeat infringers</h3><p>Accounts or resources repeatedly used to infringe intellectual property rights may be restricted, suspended or terminated.</p></section>
          </section>
        </main>
        <aside class="nx-dmca-side" aria-label="Nesta página"><strong>Nesta página</strong><a href="#notificacao">Notificação de violação</a><a href="#como-enviar">Como enviar</a><a href="#formulario-dmca">Formulário DMCA</a><a href="#contranotificacao">Contranotificação</a><a href="#reincidencia">Reincidência</a><a href="#processamento">Processamento</a><a href="#english">English version</a></aside>
      </div>
    </div>`;
  }

  function mailBody(data){
    return `DMCA - AniNexus\n\nNome: ${data.requesterName}\nE-mail: ${data.requesterEmail}\nTitular dos direitos: ${data.rightsHolder}\nURL: ${data.contentUrl}\nAssinatura: ${data.signature}\n\nDescrição:\n${data.description}\n\nDeclaração de boa-fé: SIM\nDeclaração de veracidade/autoridade: SIM`;
  }

  function bindForm(){
    const form=document.querySelector('#nxDmcaForm');if(!form)return;
    form.addEventListener('submit',async e=>{
      e.preventDefault();const status=document.querySelector('#nxDmcaStatus');
      if(!form.reportValidity())return;
      const fd=new FormData(form);const payload={requesterName:String(fd.get('requesterName')||'').trim(),requesterEmail:String(fd.get('requesterEmail')||'').trim(),rightsHolder:String(fd.get('rightsHolder')||'').trim(),contentUrl:String(fd.get('contentUrl')||'').trim(),description:String(fd.get('description')||'').trim(),goodFaith:fd.get('goodFaith')==='on',signature:String(fd.get('signature')||'').trim()};
      if(fd.get('accuracy')!=='on'||!payload.goodFaith){status.className='nx-dmca-status err';status.textContent='Confirme as duas declarações antes de continuar.';return;}
      const btn=form.querySelector('.nx-dmca-submit');btn.disabled=true;status.className='nx-dmca-status';status.textContent=IS_PAGES?'Preparando solicitação…':'Enviando com segurança…';
      try{
        if(IS_PAGES){
          const href=`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('DMCA - AniNexus')}&body=${encodeURIComponent(mailBody(payload))}`;location.href=href;status.className='nx-dmca-status ok';status.textContent='Solicitação preparada no seu aplicativo de e-mail.';
        }else{
          const res=await fetch('/api/dmca',{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify(payload),credentials:'same-origin'});
          if(!res.ok)throw new Error(res.status===429?'Muitas tentativas. Aguarde antes de enviar novamente.':'Não foi possível registrar a solicitação.');
          form.reset();status.className='nx-dmca-status ok';status.textContent='Solicitação recebida. O protocolo foi registrado para análise.';
        }
      }catch(err){status.className='nx-dmca-status err';status.textContent=err?.message||'Falha ao enviar. Tente novamente ou utilize o e-mail informado nesta página.';}finally{btn.disabled=false;}
    });
  }

  function mount(){
    if(route()!=='/dmca'){document.body.classList.remove('nx-dmca-active');mounted=false;return;}
    if(mounted&&document.querySelector('.nx-dmca'))return;
    mounted=true;document.body.classList.remove('nx-season-active','nx-detail-active');document.body.classList.add('nx-dmca-active');document.title='DMCA | AniNexus';app.innerHTML=page();bindForm();
  }

  const oldPush=history.pushState.bind(history),oldReplace=history.replaceState.bind(history);
  history.pushState=function(...args){const r=oldPush(...args);queueMicrotask(mount);return r};
  history.replaceState=function(...args){const r=oldReplace(...args);queueMicrotask(mount);return r};
  addEventListener('popstate',()=>setTimeout(mount,0));
  setTimeout(mount,0);
})();
