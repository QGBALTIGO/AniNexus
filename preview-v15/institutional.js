'use strict';
(() => {
  const app=document.querySelector('#app'); if(!app)return;
  const IS_PAGES=location.hostname.endsWith('github.io');
  const BASE=IS_PAGES?'/AniNexus':'';
  const CONTACT='contato@aninexus.com.br';
  const ROUTES=new Set(['/quem-somos','/colabore','/contato']);
  const SOCIAL={
    telegram:{label:'Telegram',handle:'@AniNexus_Oficial',url:'https://t.me/AniNexus_Oficial'},
    instagram:{label:'Instagram',handle:'@AniNexus_Oficial',url:'https://www.instagram.com/AniNexus_Oficial/'},
    tiktok:{label:'TikTok',handle:'@aninexus_oficial',url:'https://www.tiktok.com/@aninexus_oficial'}
  };
  let mountedPath='';
  const svg=(d)=>`<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const ICON={
    heart:svg('<path d="M20.7 8.7c0 5-8.7 10.1-8.7 10.1S3.3 13.7 3.3 8.7A4.6 4.6 0 0 1 12 6.2a4.6 4.6 0 0 1 8.7 2.5Z"/>'),
    compass:svg('<circle cx="12" cy="12" r="9"/><path d="m15.6 8.4-2.1 5.1-5.1 2.1 2.1-5.1 5.1-2.1Z"/>'),
    clock:svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>'),
    users:svg('<path d="M16 20v-1.5c0-2.3-1.9-4.2-4.2-4.2H7.2A4.2 4.2 0 0 0 3 18.5V20"/><circle cx="9.5" cy="7.5" r="3.3"/><path d="M15.7 4.3a3.3 3.3 0 0 1 0 6.4M18 14.5c1.8.8 3 2.3 3 4V20"/>'),
    shield:svg('<path d="M12 3 20 6v5.3c0 4.7-2.8 8-8 9.7-5.2-1.7-8-5-8-9.7V6l8-3Z"/><path d="m8.5 12 2.2 2.2 4.9-4.9"/>'),
    sparkle:svg('<path d="m12 3 1.5 4.3L18 8.8l-4.5 1.5L12 14.7l-1.5-4.4L6 8.8l4.5-1.5L12 3Z"/><path d="m19 15 .7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z"/>'),
    book:svg('<path d="M4 4.5c3.5-.8 6.2-.2 8 1.7v14c-1.8-1.9-4.5-2.5-8-1.7v-14Z"/><path d="M20 4.5c-3.5-.8-6.2-.2-8 1.7v14c1.8-1.9 4.5-2.5 8-1.7v-14Z"/>'),
    chat:svg('<path d="M4 5.5h16v11H9l-5 3v-14Z"/><path d="M8 9h8M8 12.5h5"/>'),
    code:svg('<path d="m8.5 7-5 5 5 5M15.5 7l5 5-5 5M13.5 4l-3 16"/>'),
    pen:svg('<path d="m4 20 4.3-1 10.8-10.8-3.3-3.3L5 15.7 4 20Z"/><path d="m14.3 6.4 3.3 3.3"/>'),
    palette:svg('<path d="M12 3a9 9 0 0 0 0 18h1.4c1.1 0 1.7-1.3 1-2.2-.8-1.1 0-2.7 1.4-2.7H18A3 3 0 0 0 21 13c0-5.5-4-10-9-10Z"/><circle cx="7.4" cy="10" r="1"/><circle cx="10" cy="6.8" r="1"/><circle cx="14.2" cy="7" r="1"/>'),
    bug:svg('<path d="M8 8h8v8a4 4 0 0 1-8 0V8Z"/><path d="M10 8V6a2 2 0 0 1 4 0v2M4 11h4M16 11h4M4 16h4M16 16h4M6 6l2 2M18 6l-2 2"/>'),
    mail:svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>'),
    telegram:svg('<path d="m3 11 17-7-4 16-6-5-3 3 1-5 8-6-10 5-3-1Z"/>'),
    instagram:svg('<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r=".7"/>'),
    tiktok:svg('<path d="M14 3v10.7a4.7 4.7 0 1 1-4-4.6"/><path d="M14 3c.8 3 2.5 4.4 5.3 4.6"/>'),
    arrow:svg('<path d="M5 12h13M14 7.5 18.5 12 14 16.5"/>')
  };
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function route(){
    const u=new URL(location.href);const p=u.searchParams.get('p');
    if(p)return p.split('?')[0].replace(/\/+$/,'')||'/';
    let path=location.pathname;if(IS_PAGES)path=path.replace(/^\/AniNexus/,'')||'/';return path.replace(/\/+$/,'')||'/';
  }
  const href=p=>`${BASE}${p}`;
  function goto(path){history.pushState({},'',BASE+path);mount();window.scrollTo({top:0,behavior:'auto'})}
  const button=(label,path,primary=false)=>`<a class="nx-inst-btn${primary?' primary':''}" href="${href(path)}" data-nx-inst="${path}">${label}${ICON.arrow}</a>`;
  function socialCards(){return `<div class="nx-inst-socials">${Object.entries(SOCIAL).map(([k,s])=>`<a class="nx-inst-social" href="${s.url}" target="_blank" rel="noopener noreferrer"><div class="top"><span class="social-icon">${ICON[k]}</span><span class="arrow">↗</span></div><strong>${s.label}</strong><span>${s.handle}</span></a>`).join('')}</div>`}
  function hero(kicker,title,copy,actions='',mark=true){return `<section class="nx-inst-hero"><div class="nx-inst-shell nx-inst-hero-inner"><div class="nx-inst-hero-copy"><div class="nx-inst-kicker">${kicker}</div><h1>${title}</h1><p>${copy}</p>${actions?`<div class="nx-inst-hero-actions">${actions}</div>`:''}</div>${mark?`<div class="nx-inst-mark"><img src="${BASE}/assets/logo.png" alt="Logo AniNexus"><div class="nx-inst-mark-label"><strong>AniNexus</strong>anime · mangá · comunidade</div></div>`:''}</div></section>`}
  function band(items){return `<div class="nx-inst-band"><div class="nx-inst-shell nx-inst-band-inner">${items.map(([a,b])=>`<div class="nx-inst-band-item"><span>${a}</span><strong>${b}</strong></div>`).join('')}</div></div>`}
  function sectionHead(kicker,title,copy){return `<div class="nx-inst-section-head"><div><small>${kicker}</small><h2>${title}</h2></div><p>${copy}</p></div>`}
  function value(icon,title,copy){return `<article class="nx-inst-value"><span class="icon">${ICON[icon]}</span><h3>${title}</h3><p>${copy}</p></article>`}
  function renderWho(){
    document.title='Quem Somos | AniNexus';
    return `<div class="nx-inst">${hero('Quem Somos','Feito por fãs,<br><em>para fãs.</em>','O AniNexus foi pensado para reunir em um só lugar aquilo que quem gosta de anime procura todos os dias: o que está saindo, quando estreia, onde assistir, o que vale descobrir e com quem conversar sobre isso.',button('Explorar o AniNexus','/animes/catalogo',true)+button('Colabore com o projeto','/colabore'))}
      ${band([['Descoberta','catálogo, temporadas e listas'],['Acompanhamento','agenda no horário de Brasília'],['Comunidade','um espaço brasileiro para conversar']])}
      <section class="nx-inst-section"><div class="nx-inst-shell">${sectionHead('A proposta','Menos abas. Mais contexto.','Anime não é só uma lista de títulos. Tem estreia, sequência, estúdio, adaptação, streaming, prêmio, notícia, mangá de origem, teoria, expectativa e conversa. A proposta do AniNexus é conectar essas partes sem transformar a experiência em uma planilha.')}
        <div class="nx-inst-story"><div class="nx-inst-story-copy"><p><strong>O AniNexus quer ser um ponto de encontro entre informação e fandom.</strong> Um lugar em português, pensado para a rotina de quem acompanha lançamentos no Brasil e quer descobrir mais sem depender de dezenas de páginas diferentes.</p><p>A experiência é construída em torno de contexto: calendário, temporadas, páginas completas das obras, mangás e light novels, notícias, listas, comunidade, conquistas e recursos pessoais. Tudo deve conversar entre si.</p><p>Também existe uma escolha importante por trás do projeto: <strong>respeitar as obras e quem as produz.</strong> O AniNexus é catálogo, descoberta e comunidade. Não é um serviço de streaming e não tem como proposta hospedar episódios ou filmes.</p></div><div class="nx-inst-quote"><blockquote>“A gente quer que abrir o AniNexus dê a mesma sensação de entrar numa conversa boa sobre o que você gosta.”</blockquote><span>A ideia que guia o produto</span></div></div>
      </div></section>
      <section class="nx-inst-section soft"><div class="nx-inst-shell">${sectionHead('Como pensamos','O que importa para o AniNexus','A identidade do projeto não é só visual. Esses princípios orientam o que entra no produto, como a comunidade deve funcionar e como as decisões são tomadas.')}
        <div class="nx-inst-values">${value('compass','Clareza antes de excesso','Informação útil precisa ser fácil de encontrar. Mais dados só valem quando ajudam o fã a entender melhor uma obra ou decidir o que fazer a seguir.')}${value('users','Comunidade com contexto','Comentários e conversas ficam melhores quando estão ligados a animes, episódios, mangás, temporadas e interesses reais.')}${value('shield','Respeito e responsabilidade','Direitos autorais, privacidade, segurança, spoilers e moderação são partes do produto — não páginas esquecidas no rodapé.')}${value('sparkle','Experiência com personalidade','O AniNexus pode ser bonito, vivo e divertido sem sacrificar velocidade, acessibilidade ou legibilidade.')}${value('book','Anime além do anime','Mangás, light novels, estúdios, equipe, premiações e relações entre obras ajudam a enxergar a história completa.')}${value('bug','Evolução contínua','Produto bom melhora com uso real. Erros, sugestões e incômodos da comunidade são sinais para refinar a experiência.')}</div>
      </div></section>
      <section class="nx-inst-section"><div class="nx-inst-shell">${sectionHead('Canais oficiais','Onde encontrar o AniNexus','Atualizações, bastidores, novidades do projeto e conversas com a comunidade também vão acontecer fora do site. Estes são os perfis oficiais.')}${socialCards()}</div></section>
      <div class="nx-inst-shell"><div class="nx-inst-cta"><div><h2>Quer ajudar a construir esse universo?</h2><p>Correções, ideias, conteúdo, comunidade, design, desenvolvimento e parcerias podem começar por aqui.</p></div><div class="nx-inst-cta-actions">${button('Ver formas de colaborar','/colabore',true)}${button('Entrar em contato','/contato')}</div></div></div>
    </div>`;
  }
  function pathCard(kicker,title,copy,items){return `<article class="nx-inst-path"><small>${kicker}</small><h3>${title}</h3><p>${copy}</p><ul>${items.map(x=>`<li>${x}</li>`).join('')}</ul></article>`}
  function renderCollaborate(){
    document.title='Colabore | AniNexus';
    return `<div class="nx-inst">${hero('Colabore','O AniNexus fica melhor<br><em>quando a comunidade participa.</em>','Você não precisa fazer parte de uma equipe formal para contribuir. Uma correção bem explicada, uma pauta boa, uma ideia de interface ou um olhar técnico podem melhorar o projeto para muita gente.',button('Quero colaborar','/contato?assunto=colaboracao',true)+button('Conhecer o projeto','/quem-somos'))}
      ${band([['01','identifique onde pode ajudar'],['02','mande uma proposta objetiva'],['03','a gente alinha o melhor formato']])}
      <section class="nx-inst-section"><div class="nx-inst-shell">${sectionHead('Formas de participar','Tem espaço para diferentes tipos de contribuição.','O objetivo é aproveitar o que cada pessoa sabe fazer sem burocratizar. Algumas contribuições podem ser pontuais; outras podem virar colaboração recorrente conforme o projeto cresce.')}
        <div class="nx-inst-paths">${pathCard('Catálogo','Correções e curadoria','Encontrou informação errada, título duplicado, temporada incorreta ou detalhe que pode ser enriquecido? Esse tipo de contribuição ajuda diretamente a qualidade do catálogo.',['correções de dados e traduções','contexto de franquias e adaptações','sugestões de listas e categorias'])}${pathCard('Conteúdo','Notícias e editorial','Para quem gosta de pesquisar, escrever e acompanhar novidades. A área editorial própria está prevista para crescer junto com a plataforma.',['pautas sobre estreias e continuações','trailers, premiações e indústria','mangás, light novels e adaptações'])}${pathCard('Comunidade','Convivência e moderação','Uma comunidade boa precisa de gente que entenda o tom do espaço e saiba equilibrar liberdade, spoiler, respeito e contexto.',['boas práticas e organização de tópicos','sinalização de spoilers e conteúdo','apoio a regras e moderação'])}${pathCard('Produto','Design e experiência','Sugestões de UX e interface são bem-vindas quando resolvem problemas reais de navegação, leitura, acessibilidade ou descoberta.',['testes no celular e desktop','acessibilidade e clareza visual','ideias de fluxos e funcionalidades'])}${pathCard('Tecnologia','Código, desempenho e segurança','Contribuições técnicas podem ajudar a tornar o AniNexus mais rápido, confiável e preparado para crescer.',['bugs reproduzíveis e diagnóstico','performance e arquitetura','segurança responsável e hardening'])}${pathCard('Projeto','Parcerias e apoio','Criadores, comunidades, eventos, marcas e projetos relacionados podem propor ações que façam sentido para o público do AniNexus.',['parcerias de conteúdo','ações com comunidades e eventos','propostas comerciais compatíveis com o projeto'])}</div>
      </div></section>
      <section class="nx-inst-section soft"><div class="nx-inst-shell">${sectionHead('Como funciona','Sem promessa vaga e sem formulário infinito.','Envie uma mensagem dizendo em que área quer contribuir, o que você propõe e, quando fizer sentido, algum exemplo do seu trabalho ou experiência. A partir daí, avaliamos se existe encaixe e qual é a forma mais simples de começar.')}
        <div class="nx-inst-story"><div class="nx-inst-story-copy"><p><strong>Contribuição não precisa significar compromisso permanente.</strong> Uma boa correção, uma pauta, um teste de usabilidade ou um relatório técnico já podem ter impacto.</p><p>Quando uma colaboração exigir acesso interno, dados ou responsabilidades específicas, o escopo deve ser combinado antes e o princípio é sempre conceder apenas o acesso necessário.</p><p>Colaborar espontaneamente com o projeto não cria vínculo empregatício. Qualquer atividade remunerada, parceria comercial ou relação profissional futura precisa ser combinada de forma expressa e separada.</p></div><div class="nx-inst-quote"><blockquote>Boa colaboração começa com uma proposta clara: o problema, a ideia e como você acha que pode ajudar.</blockquote><span>Simples, direto e útil</span></div></div>
      </div></section>
      <section class="nx-inst-section"><div class="nx-inst-shell">${sectionHead('Acompanhe também','Fique perto do projeto','Mesmo sem colaborar diretamente, acompanhar, testar e mandar feedback já ajuda a construir um AniNexus melhor.')}${socialCards()}</div></section>
      <div class="nx-inst-shell"><div class="nx-inst-cta"><div><h2>Tem algo que pode somar?</h2><p>Conte o que você quer fazer e por que acha que combina com o AniNexus.</p></div><div class="nx-inst-cta-actions">${button('Enviar proposta','/contato?assunto=colaboracao',true)}</div></div></div>
    </div>`;
  }
  function contactForm(){
    const q=new URLSearchParams(location.search);const pref=q.get('assunto')==='colaboracao'?'Colaboração':'';
    return `<form class="nx-contact-form" id="nxContactForm" novalidate><div class="nx-contact-fields">
      <div class="nx-contact-field"><label for="nxContactName">Nome</label><input id="nxContactName" name="name" autocomplete="name" minlength="2" maxlength="100" required></div>
      <div class="nx-contact-field"><label for="nxContactEmail">E-mail</label><input id="nxContactEmail" name="email" type="email" autocomplete="email" maxlength="254" required></div>
      <div class="nx-contact-field full"><label for="nxContactSubject">Assunto</label><select id="nxContactSubject" name="category" required><option value="">Selecione</option><option ${pref==='Colaboração'?'selected':''}>Colaboração</option><option>Correção de catálogo</option><option>Sugestão ou feedback</option><option>Suporte de conta</option><option>Parceria ou comercial</option><option>Imprensa ou conteúdo</option><option>Outro assunto</option></select></div>
      <div class="nx-contact-field full"><label for="nxContactMessage">Mensagem</label><textarea id="nxContactMessage" name="message" minlength="10" maxlength="5000" required placeholder="Conte o contexto e, se houver, inclua links ou exemplos que ajudem a entender sua mensagem."></textarea></div>
      <div style="position:absolute;left:-9999px" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div>
    </div><div class="nx-contact-submit"><button class="nx-inst-btn primary" type="submit">${IS_PAGES?'Preparar e-mail':'Enviar mensagem'}${ICON.arrow}</button><span class="nx-contact-status" id="nxContactStatus" role="status" aria-live="polite"></span></div></form>`;
  }
  function renderContact(){
    document.title='Contato | AniNexus';
    return `<div class="nx-inst">${hero('Contato','Fale com a gente.','Correção, sugestão, colaboração, suporte ou parceria: escolha o assunto e envie o contexto. Quanto mais específica for a mensagem, mais fácil é encaminhar para o lugar certo.',button('Enviar mensagem','#formulario',true),false)}
      ${band([['E-mail',CONTACT],['Direitos autorais','use o canal específico de DMCA'],['Redes sociais','Telegram · Instagram · TikTok']])}
      <section class="nx-inst-section" id="formulario"><div class="nx-inst-shell">${sectionHead('Mensagem','Um canal para cada tipo de conversa.','O formulário abaixo é o caminho principal para assuntos gerais. Solicitações de direitos autorais têm fluxo próprio para manter registro e análise adequados.')}
        <div class="nx-contact-grid"><div>${contactForm()}<div class="nx-contact-note">Não envie senhas, códigos de autenticação ou documentos sensíveis por este formulário. Para denúncias de vulnerabilidade, descreva o impacto sem explorar dados de terceiros.</div></div><aside class="nx-contact-side">
          <div class="nx-contact-card"><div class="label">Contato geral</div><h3>E-mail institucional</h3><p>Para conversas que precisam sair do formulário ou incluir documentação complementar.</p><a href="mailto:${CONTACT}">${CONTACT}</a></div>
          <div class="nx-contact-card"><div class="label">Direitos autorais</div><h3>DMCA e propriedade intelectual</h3><p>Pedidos de remoção, contranotificações e assuntos de copyright devem usar o fluxo específico.</p><a href="${href('/dmca')}" data-nx-legal="/dmca">Abrir página de DMCA →</a></div>
          <div class="nx-contact-card"><div class="label">Colaboração</div><h3>Quer participar?</h3><p>Antes de enviar, veja as áreas em que a comunidade pode contribuir com o projeto.</p><a href="${href('/colabore')}" data-nx-inst="/colabore">Ver como colaborar →</a></div>
          <div class="nx-contact-card"><div class="label">Tempo de resposta</div><h3>Mensagens são priorizadas por contexto</h3><p>Segurança, direitos autorais e problemas que impedem o uso do serviço tendem a receber prioridade sobre sugestões gerais.</p></div>
        </aside></div>
      </div></section>
      <section class="nx-inst-section soft"><div class="nx-inst-shell">${sectionHead('Canais oficiais','Também estamos por aqui.','Use os perfis abaixo para acompanhar novidades e conversar com a comunidade. Questões de conta, privacidade ou DMCA devem continuar pelos canais formais do site.')}${socialCards()}</div></section>
    </div>`;
  }
  function bindForm(){
    const form=document.querySelector('#nxContactForm');if(!form)return;
    form.addEventListener('submit',async e=>{
      e.preventDefault();const status=document.querySelector('#nxContactStatus');if(!form.reportValidity())return;
      const fd=new FormData(form);if(String(fd.get('website')||'')){status.textContent='Mensagem recebida.';form.reset();return;}
      const name=String(fd.get('name')||'').trim(),email=String(fd.get('email')||'').trim(),category=String(fd.get('category')||'').trim(),message=String(fd.get('message')||'').trim();
      const payload={name,email,subject:`${category} — AniNexus`,message};const btn=form.querySelector('button[type="submit"]');btn.disabled=true;status.className='nx-contact-status';status.textContent=IS_PAGES?'Preparando e-mail…':'Enviando…';
      try{
        if(IS_PAGES){const body=`Nome: ${name}\nE-mail: ${email}\nAssunto: ${category}\n\n${message}`;location.href=`mailto:${CONTACT}?subject=${encodeURIComponent(payload.subject)}&body=${encodeURIComponent(body)}`;status.className='nx-contact-status ok';status.textContent='Mensagem preparada no seu aplicativo de e-mail.';}
        else{const r=await fetch('/api/contact',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify(payload)});if(!r.ok)throw new Error(r.status===429?'Muitas tentativas. Aguarde um pouco e tente novamente.':'Não foi possível enviar agora.');form.reset();status.className='nx-contact-status ok';status.textContent='Mensagem recebida. Obrigado por falar com o AniNexus.';}
      }catch(err){status.className='nx-contact-status err';status.textContent=err?.message||'Não foi possível enviar agora.'}finally{btn.disabled=false;}
    });
  }
  function replaceFooterSocials(){
    const box=document.querySelector('.site-footer .socials');if(!box||box.dataset.nxV15==='1')return;box.dataset.nxV15='1';box.innerHTML=`<a href="${SOCIAL.telegram.url}" target="_blank" rel="noopener noreferrer" aria-label="Telegram AniNexus">${ICON.telegram}</a><a href="${SOCIAL.instagram.url}" target="_blank" rel="noopener noreferrer" aria-label="Instagram AniNexus">${ICON.instagram}</a><a href="${SOCIAL.tiktok.url}" target="_blank" rel="noopener noreferrer" aria-label="TikTok AniNexus">${ICON.tiktok}</a>`;
  }
  function mount(){
    replaceFooterSocials();const p=route();
    if(!ROUTES.has(p)){document.body.classList.remove('nx-institution-active');mountedPath='';return}
    document.body.classList.remove('nx-legal-active','nx-season-active','nx-detail-active');document.body.classList.add('nx-institution-active');
    if(mountedPath===p&&document.querySelector('.nx-inst'))return;mountedPath=p;
    app.innerHTML=p==='/quem-somos'?renderWho():p==='/colabore'?renderCollaborate():renderContact();if(p==='/contato')bindForm();
  }
  document.addEventListener('click',e=>{
    const a=e.target.closest('[data-nx-inst]');if(!a)return;const target=a.dataset.nxInst;if(!target)return;e.preventDefault();e.stopImmediatePropagation();
    if(target.startsWith('#')){document.querySelector(target)?.scrollIntoView({behavior:'smooth',block:'start'});return}
    goto(target);
  },true);
  const oldPush=history.pushState.bind(history),oldReplace=history.replaceState.bind(history);
  history.pushState=function(...args){const r=oldPush(...args);queueMicrotask(mount);return r};history.replaceState=function(...args){const r=oldReplace(...args);queueMicrotask(mount);return r};
  addEventListener('popstate',()=>setTimeout(mount,0));
  setTimeout(mount,0);
})();
