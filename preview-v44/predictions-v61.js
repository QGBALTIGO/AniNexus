'use strict';
(() => {
  if(window.AniNexusPredictions)return;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const route=()=>window.__ANINEXUS_NAVIGATION_V23__?.route?.()||location.pathname;
  const linkedPrediction=()=>{const current=new URL(location.href),restored=current.searchParams.get('p'),path=restored?new URL(restored,location.origin):current;return path.searchParams.get('previsao')||current.searchParams.get('previsao')||path.hash.slice(1)||current.hash.slice(1);};
  const url=path=>location.hostname.endsWith('github.io')?'/AniNexus/?p='+encodeURIComponent(path):path;
  const date=value=>{if(!value)return'A confirmar';const d=new Date(value);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(d)+' (Brasília)':'A confirmar';};
  const filters=[['hot','Em alta'],['new','Novas'],['closing','Encerrando'],['divided','Mais divididas'],['resolved','Resolvidas'],['mine','Meus palpites'],['ranking','Ranking']];
  let current=null,scheduled=false;
  const embedRequests=new WeakMap();
  const publicApi=(path,signal)=>window.AniNexusAuth?.publicApi?window.AniNexusAuth.publicApi(path,{signal}):fetch(path,{signal,headers:{accept:'application/json'}}).then(async r=>{if(!r.ok)throw Object.assign(Error('HTTP '+r.status),{status:r.status});return r.json();});
  const privateApi=(path,options)=>window.AniNexusAuth.api(path,options);
  const active=state=>current===state&&state.host.isConnected;
  const arrow='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6M8 12h12"/></svg>';
  function card(item,compact=false){
    const votes=Number(item.voteCount)||0,yes=Number(item.yesCount)||0,no=Number(item.noCount)||0;
    const closed=item.status!=='OPEN'||Date.parse(item.closesAt)<=Date.now(),chosen=item.userVote?.choice||item.userVote;
    const status=item.status==='OPEN'&&closed?'Palpites encerrados':({OPEN:'Aberta',LOCKED:'Palpites encerrados',RESOLVED:'Resolvida',VOID:'Anulada'})[item.status]||'Em revisão';
    const yesPercent=votes?Math.round(yes/votes*100):0;
    const consensus=votes>=20?`<div class="nx61-pred-consensus"><span>Sim <strong>${yesPercent}%</strong></span><span>Não <strong>${100-yesPercent}%</strong></span></div>`:`<p class="nx61-pred-muted">${yes} Sim · ${no} Não <span>Consenso a partir de 20 palpites.</span></p>`;
    const evidence=item.evidence?.observation||{};
    const observedDate=evidence.data?.startDate;
    const evidenceValue=item.type==='CATALOG_DATE_OBSERVED'?`Data no catálogo: ${observedDate?.day&&observedDate?.month&&observedDate?.year?[String(observedDate.day).padStart(2,'0'),String(observedDate.month).padStart(2,'0'),observedDate.year].join('/'):'A confirmar'}.`:`Nota na fonte: ${evidence.data?.averageScore??'—'}/100.`;
    const feedback=chosen?`Seu palpite: ${chosen==='YES'?'Sim':'Não'}.`:closed?'Esta previsão não recebe novos palpites.':'Você pode alterar seu palpite até o fechamento.';
    const eligibilityNote=item.userVote?.eligible===false?' Este palpite ficou fora da janela válida e não altera sua reputação.':'';
    return `<article class="nx61-pred-card" data-prediction="${esc(item.id)}"><header><span>${esc(item.mediaTitle)}</span><small>${status}</small></header><h3>${esc(item.question)}</h3>${consensus}<p class="nx61-pred-meta">${votes} ${votes===1?'palpite':'palpites'} · ${closed?'Fechou':'Fecha'} ${esc(date(item.closesAt))}</p>${compact?`<a class="nx61-pred-link" href="${url('/previsoes')}#${esc(item.id)}">Ver previsão →</a>`:`<div class="nx61-pred-choices" role="group" aria-label="Seu palpite">${['YES','NO'].map(choice=>`<button type="button" data-pred-vote="${choice}" aria-pressed="${chosen===choice}" ${closed?'disabled':''}>${choice==='YES'?'Sim':'Não'}</button>`).join('')}</div><p class="nx61-pred-feedback" role="status">${esc(feedback+eligibilityNote)}</p><details><summary>Critérios e fontes</summary><p>${esc(item.criteria)}</p><dl><dt>Fechamento</dt><dd>${esc(date(item.closesAt))}</dd><dt>Leitura prevista a partir de</dt><dd>${esc(date(item.resolutionDeadline))}</dd></dl>${/^https:\/\/anilist\.co\/(anime|manga)\/\d+/.test(item.sourceUrl||'')?`<a href="${esc(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">Fonte: AniList ↗</a>`:''}${item.status==='RESOLVED'?`<p><strong>Resultado: ${item.result==='YES'?'Sim':'Não'}</strong></p><p>Consulta registrada: ${esc(date(evidence.observedAt))}. ${esc(evidenceValue)}</p>`:''}${item.status==='VOID'?'<p>Sem resultado confiável. Esta previsão não afeta sua reputação.</p>':''}</details>`}</article>`;
  }
  async function load(state,append=false){
    const version=++state.version,body=state.host.querySelector('[data-pred-body]'),more=state.host.querySelector('[data-pred-more]');
    more.hidden=true;if(!append)body.innerHTML='<div class="nx61-pred-loading" role="status">Carregando previsões…</div>';
    const filter=state.filter,target=state.target;
    try{
      const privateView=filter==='mine',rank=filter==='ranking';
      if(privateView&&!await window.AniNexusAuth?.getUser?.()){if(active(state)&&version===state.version)body.innerHTML=`<div class="nx61-pred-empty"><h2>Seus palpites, em um lugar só</h2><p>Entre para acompanhar suas previsões e resultados.</p><a href="${url('/login')}">Entrar</a></div>`;return;}
      const path=privateView?'/api/me/predictions?offset='+String(append?state.offset||0:0):rank?'/api/predictions/ranking':'/api/predictions?'+new URLSearchParams({filter,offset:String(append?state.offset||0:0)});
      const data=await(privateView?privateApi(path,{signal:state.controller.signal}):publicApi(path,state.controller.signal));
      if(!active(state)||version!==state.version)return;
      let items=data.items||[];
      if(!append&&!rank&&!privateView&&/^[0-9a-f-]{36}$/i.test(target)&&!items.some(i=>i.id===target)){const single=await publicApi('/api/predictions/'+target,state.controller.signal).catch(()=>null);if(single?.item)items=[single.item,...items];}
      if(!active(state)||version!==state.version)return;
      if(!privateView&&!rank&&await Promise.resolve().then(()=>window.AniNexusAuth?.getUser?.()).catch(()=>null)){
        const mine=await privateApi('/api/me/predictions?ids='+items.slice(0,30).map(i=>i.id).join(','),{signal:state.controller.signal}).catch(()=>null);
        if(!active(state)||version!==state.version)return;
        const choices=new Map((mine?.items||[]).map(i=>[i.id,i.userVote]));items=items.map(i=>({...i,userVote:choices.get(i.id)}));
      }
      state.items=append?[...new Map([...state.items,...items].map(i=>[i.id,i])).values()]:items;
      state.offset=data.nextOffset;
      if(rank){
        body.innerHTML='<p class="nx61-pred-muted">Ranking ajustado pela precisão e pelo número de resultados. Mínimo de 20 previsões resolvidas; anuladas não contam.</p>'+(items.length?`<ol class="nx61-pred-ranking">${items.map(i=>`<li><strong>${esc(i.displayName||i.username||'Membro')}</strong><span>${Number(i.correct)||0} acertos / ${Number(i.total)||0} · ${Math.round(Number(i.accuracy)||0)}%</span></li>`).join('')}</ol>`:'<div class="nx61-pred-empty"><h2>O ranking começa com resultados</h2><p>Ele aparecerá quando houver participantes com 20 previsões resolvidas.</p></div>');
      }else{
        body.innerHTML=state.items.length?`<div class="nx61-pred-grid">${state.items.map(i=>card(i)).join('')}</div>`:'<div class="nx61-pred-empty"><h2>Nenhuma previsão por aqui ainda</h2><p>Novas perguntas aparecem quando há dados suficientes e critérios verificáveis.</p></div>';
        more.hidden=data.nextOffset==null;
      }
      if(target){const id=target;state.host.querySelectorAll('[data-prediction]').forEach(el=>{if(el.dataset.prediction===id)el.scrollIntoView({block:'center'});});}
    }catch(error){
      if(!active(state)||version!==state.version||state.controller.signal.aborted)return;
      body.innerHTML=error.status===404?'<div class="nx61-pred-empty"><h2>Previsões em preparação</h2><p>Esta função ainda não está aberta para participar.</p></div>':'<div class="nx61-pred-empty"><h2>Não foi possível carregar agora</h2><p>Seus palpites permanecem salvos.</p><button type="button" data-pred-retry>Tentar novamente</button></div>';
      body.querySelector('[data-pred-retry]')?.addEventListener('click',()=>load(state));
    }
  }
  async function vote(state,button){
    const article=button.closest('[data-prediction]'),feedback=article.querySelector('[role=status]'),buttons=[...article.querySelectorAll('[data-pred-vote]')];
    if(article.dataset.busy)return;
    article.dataset.busy='1';buttons.forEach(b=>b.disabled=true);
    try{
      const user=await window.AniNexusAuth?.getUser?.();
      if(!active(state)||!article.isConnected)return;
      if(!user){buttons.forEach(b=>b.disabled=false);feedback.innerHTML=`<a href="${url('/login')}">Entre na sua conta para registrar seu palpite.</a>`;return;}
      feedback.textContent='Salvando palpite…';
      const data=await privateApi('/api/me/predictions/'+encodeURIComponent(article.dataset.prediction)+'/vote',{method:'PUT',body:JSON.stringify({choice:button.dataset.predVote}),signal:state.controller.signal});
      if(!active(state))return;
      const item={...data.item,userVote:data.userVote||button.dataset.predVote};state.items=state.items.map(i=>i.id===item.id?item:i);article.outerHTML=card(item);
    }catch(error){
      if(!active(state))return;
      feedback.textContent=error.status===409?'Os palpites já foram encerrados. Atualize para conferir o resultado.':'Não foi possível salvar. Tente novamente; seu último palpite foi preservado.';
      if(error.status!==409)buttons.forEach(b=>b.disabled=false);
    }finally{delete article.dataset.busy;}
  }
  function mount(){
    if(route()!=='/previsoes'){current?.controller.abort();current=null;document.body.classList.remove('nx61-predictions-active');return;}
    const target=linkedPrediction();
    if(current?.host.isConnected){
      if(current.target!==target){
        current.target=target;current.filter='hot';current.offset=null;
        current.host.querySelectorAll('[data-pred-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.predFilter==='hot')));
        load(current);
      }
      return;
    }
    const app=document.querySelector('#app');if(!app)return;
    current?.controller.abort();document.body.classList.add('nx61-predictions-active');document.title='Previsões | AniNexus';
    app.innerHTML=`<main class="nx61-predictions"><div class="nx61-pred-shell"><a class="nx61-pred-back" href="${url('/comunidade')}" aria-label="Voltar para comunidade">${arrow}</a><header class="nx61-pred-heading"><h1>Previsões</h1><p>O que vem a seguir? Dê seu palpite e acompanhe o resultado.</p><small>Sem apostas, depósitos ou prêmios. Só previsões e reputação.</small></header><nav class="nx61-pred-filters" aria-label="Filtrar previsões">${filters.map(([key,label])=>`<button type="button" data-pred-filter="${key}" aria-pressed="${key==='hot'}">${label}</button>`).join('')}</nav><div data-pred-body aria-live="polite"></div><button type="button" data-pred-more hidden>Carregar mais</button></div></main>`;
    const state=current={host:app.firstElementChild,filter:'hot',target,items:[],offset:null,version:0,controller:new AbortController()};
    state.host.addEventListener('click',e=>{const f=e.target.closest('[data-pred-filter]'),v=e.target.closest('[data-pred-vote]');if(f){state.filter=f.dataset.predFilter;state.host.querySelectorAll('[data-pred-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===f)));load(state);}else if(v)vote(state,v);});
    state.host.querySelector('[data-pred-more]').onclick=()=>load(state,true);
    load(state);dispatchEvent(new CustomEvent('aninexus:route-ready',{detail:{owner:'predictions',path:'/previsoes'}}));
  }
  async function embed(host,query='',heading='Previsões em alta'){
    if(host.dataset.predictionsLoaded)return;host.dataset.predictionsLoaded='1';
    const request=Symbol('prediction-embed');embedRequests.set(host,request);
    try{
      const data=await publicApi('/api/predictions?filter=hot'+query,AbortSignal.timeout(10000));
      if(!host.isConnected||embedRequests.get(host)!==request||!data.items?.length)return;
      const section=document.createElement('section');section.className='nx61-pred-embed';section.innerHTML=`<div class="nx61-pred-embed-head"><h2>${heading}</h2><a href="${url('/previsoes')}">Ver todas →</a></div><div class="nx61-pred-grid">${data.items.slice(0,3).map(i=>card(i,true)).join('')}</div>`;host.append(section);
    }catch{/* Auxiliary recommendations never block the page or create empty gaps. */}
  }
  function scan(){
    scheduled=false;mount();
    const home=document.querySelector('.nx35-home #nx35Community')?.closest('.nx35-shell');if(home)embed(home);
    const community=document.querySelector('.nx40-community .nx40-main');if(community)embed(community);
    const detail=document.querySelector('.nx22-detail'),panel=detail?.querySelector('#nx22Panel');
    if(panel&&detail.querySelector('[data-nx22-tab="geral"].active'))embed(panel,'&mediaId='+encodeURIComponent(detail.dataset.nx22Id)+'&mediaType='+encodeURIComponent(detail.dataset.nx22Type||'ANIME'),'Previsões sobre esta obra');
  }
  function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(scan);}}
  const observer=new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n instanceof Element&&n.matches('main,article.nx22-detail,.nx35-home,.nx40-community'))))schedule();});
  const init=()=>{observer.observe(document.querySelector('#app')||document.body,{childList:true,subtree:true});schedule();};
  addEventListener('aninexus:route-changed',schedule);addEventListener('aninexus:route-ready',schedule);
  addEventListener('hashchange',schedule);addEventListener('popstate',schedule);addEventListener('aninexus:navigate',schedule);
  addEventListener('aninexus:detail-panel',event=>{
    const host=event.detail?.host;if(!host)return;
    embedRequests.delete(host);delete host.dataset.predictionsLoaded;
    if(event.detail.key==='geral')schedule();
  });
  addEventListener('aninexus:account-identity-changed',()=>{if(current){current.controller.abort();current=null;document.querySelector('.nx61-predictions')?.remove();}schedule();});
  window.AniNexusPredictions=Object.freeze({mount});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
