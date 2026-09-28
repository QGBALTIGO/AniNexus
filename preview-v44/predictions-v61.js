'use strict';
(() => {
  if(window.AniNexusPredictions)return;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const route=()=>window.__ANINEXUS_NAVIGATION_V23__?.route?.()||location.pathname;
  const linkedPrediction=()=>{const current=new URL(location.href),restored=current.searchParams.get('p'),path=restored?new URL(restored,location.origin):current;return path.searchParams.get('previsao')||current.searchParams.get('previsao')||path.hash.slice(1)||current.hash.slice(1);};
  const focusVote=()=>{const current=new URL(location.href),restored=current.searchParams.get('p'),path=restored?new URL(restored,location.origin):current;return path.searchParams.get('foco')==='prever'||current.searchParams.get('foco')==='prever';};
  const url=path=>location.hostname.endsWith('github.io')?'/AniNexus/?p='+encodeURIComponent(path):path;
  const date=value=>{if(!value)return'A confirmar';const d=new Date(value);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(d)+' (Brasília)':'A confirmar';};
  function questionLabel(item){
    // Presentation only: the registered question and resolution criteria stay intact.
    const threshold=item.rule?.threshold,value=item.resolutionDeadline;
    if(item.type!=='SCORE_AT_DEADLINE'||!Number.isInteger(threshold)||threshold<0||threshold>100||typeof value!=='string')return item.question;
    const iso=value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/),d=new Date(value);
    if(!iso||!Number.isFinite(d.getTime()))return item.question;
    const [,year,month,day,hour,minute,second]=iso.map(Number);
    if(month<1||month>12||day<1||day>new Date(Date.UTC(year,month,0)).getUTCDate()||hour>23||minute>59||second>59)return item.question;
    const parts=new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',timeZone:'America/Sao_Paulo'}).formatToParts(d),part=type=>parts.find(p=>p.type===type)?.value;
    const clock=part('hour')+'h'+(part('minute')!=='00'||part('second')!=='00'?part('minute'):'')+(part('second')!=='00'?'min'+part('second')+'s':'');
    return `Terá nota média de pelo menos ${threshold}/100 no AniList na consulta de ${part('day')}/${part('month')}/${part('year')}, às ${clock} (Brasília)?`;
  }
  const filters=[['hot','Em alta'],['new','Novas'],['closing','Encerrando'],['divided','Mais divididas'],['resolved','Resolvidas'],['mine','Meus palpites'],['ranking','Ranking']];
  let current=null,scheduled=false;
  let returnPath=(()=>{try{const previous=new URL(document.referrer);return previous.origin===location.origin&&previous.pathname!=='/previsoes'?previous.pathname:'/';}catch{return'/'}})();
  const embedRequests=new WeakMap();
  const publicApi=(path,signal)=>window.AniNexusAuth?.publicApi?window.AniNexusAuth.publicApi(path,{signal}):fetch(path,{signal,headers:{accept:'application/json'}}).then(async r=>{if(!r.ok)throw Object.assign(Error('HTTP '+r.status),{status:r.status});return r.json();});
  const privateApi=(path,options)=>window.AniNexusAuth.api(path,options);
  const active=state=>current===state&&state.host.isConnected;
  const arrow='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6M8 12h12"/></svg>';
  const predictionHref=(item,focus=false)=>url('/previsoes?previsao='+encodeURIComponent(item.id)+(focus?'&foco=prever':''));
  function homeCard(item){
    const votes=Number(item.voteCount)||0,yes=Number(item.yesCount)||0,no=Number(item.noCount)||0;
    const closed=item.status!=='OPEN'||Date.parse(item.closesAt)<=Date.now();
    const yesPercent=votes?Math.round(yes/votes*100):0;
    const closeDate=new Date(item.closesAt);
    const days=Number.isFinite(closeDate.getTime())?Math.max(0,Math.ceil((closeDate.getTime()-Date.now())/86400000)):null;
    const deadline=closed?'Palpites encerrados':days===null?'Prazo a confirmar':days===0?'Fecha hoje':`Fecha em ${days} ${days===1?'dia':'dias'}`;
    const count=votes?`${yesPercent}% Sim · ${100-yesPercent}% Não`:'Sem palpites ainda';
    const trend=item.trend24h,yesDelta=Number(trend?.yesDelta)||0,noDelta=Number(trend?.noDelta)||0;
    const trendSide=yesDelta>noDelta?'Sim':noDelta>yesDelta?'Não':yes>=no?'Sim':'Não';
    const trendGain=trendSide==='Sim'?yesDelta:noDelta;
    const trendText=trend&&votes?`${trendSide} ${trendGain>=0?'+':''}${trendGain}`:'—';
    const trendTitle=trend&&votes?`${trend.completeWindow?'Variação nas últimas 24 horas':'Variação desde o primeiro registro disponível; ainda não há 24 horas completas'} (${date(trend.since)}).`:'Ainda não há votos para esta previsão.';
    return `<article class="nx61-pred-home-card" data-prediction="${esc(item.id)}"><div class="nx61-pred-home-card-top"><span class="nx61-pred-home-chip">${item.mediaType==='MANGA'?'Mangás':'Animes'}</span><span class="nx61-pred-home-status">${closed?'Encerrada':'Aberta'}</span></div><div class="nx61-pred-home-question"><small>${esc(item.mediaTitle)}</small><h3>${esc(questionLabel(item))}</h3></div><div class="nx61-pred-home-consensus"><div><span>Consenso geral</span><strong>${count}</strong></div><div class="nx61-pred-home-bar" role="img" aria-label="${esc(count)}"><span class="yes" style="width:${yesPercent}%"></span><span class="no" style="width:${votes?100-yesPercent:0}%"></span></div></div><div class="nx61-pred-home-meta"><span title="${esc(trendTitle)}"><small>Tendência 24h</small><strong>${trendText}</strong></span><span><small>Votos</small><strong>${votes}</strong></span><span title="${esc(date(item.closesAt))}"><small>Prazo</small><strong>${deadline}</strong></span></div><div class="nx61-pred-home-buttons"><a href="${predictionHref(item)}" class="secondary">Ver detalhes</a><a href="${predictionHref(item,!closed)}" class="primary">${closed?'Ver resultado':'Prever'}</a></div></article>`;
  }
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
    return `<article class="nx61-pred-card" data-prediction="${esc(item.id)}"><header><span>${esc(item.mediaTitle)}</span><small>${status}</small></header><h3>${esc(questionLabel(item))}</h3>${consensus}<p class="nx61-pred-meta">${votes} ${votes===1?'palpite':'palpites'} · ${closed?'Fechou':'Fecha'} ${esc(date(item.closesAt))}</p>${compact?`<a class="nx61-pred-link" href="${predictionHref(item)}">Ver previsão →</a>`:`<div class="nx61-pred-choices" role="group" aria-label="Palpite rápido">${['YES','NO'].map(choice=>`<button type="button" data-pred-vote="${choice}" aria-pressed="${chosen===choice}" ${closed?'disabled':''}>${choice==='YES'?'Sim':'Não'}</button>`).join('')}</div><p class="nx61-pred-feedback" role="status">${esc(feedback+eligibilityNote)}</p><div class="nx61-pred-card-actions"><a href="${predictionHref(item)}">Ver detalhes</a><a href="${predictionHref(item,!closed)}">${closed?'Ver resultado':'Fazer previsão'}</a></div><details><summary>Critérios e fontes</summary><p>${esc(item.criteria)}</p><dl><dt>Fechamento</dt><dd>${esc(date(item.closesAt))}</dd><dt>Leitura prevista a partir de</dt><dd>${esc(date(item.resolutionDeadline))}</dd></dl>${/^https:\/\/anilist\.co\/(anime|manga)\/\d+/.test(item.sourceUrl||'')?`<a href="${esc(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">Fonte: AniList ↗</a>`:''}${item.status==='RESOLVED'?`<p><strong>Resultado: ${item.result==='YES'?'Sim':'Não'}</strong></p><p>Consulta registrada: ${esc(date(evidence.observedAt))}. ${esc(evidenceValue)}</p>`:''}${item.status==='VOID'?'<p>Sem resultado confiável. Esta previsão não afeta sua reputação.</p>':''}</details>`}</article>`;
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
  const percent=(part,total)=>total?Math.round(100*part/total):0;
  const when=value=>{const stamp=Date.parse(value||'');return Number.isFinite(stamp)?new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'America/Sao_Paulo'}).format(stamp):'—'};
  const remaining=value=>{const delta=Date.parse(value||'')-Date.now();if(!Number.isFinite(delta))return'Prazo a confirmar';if(delta<=0)return'Palpites encerrados';const days=Math.ceil(delta/86400000);return days===1?'Fecha em 1 dia':`Fecha em ${days} dias`;};
  function detailChart(history,range){
    const windows={day:86400000,week:7*86400000,month:30*86400000,all:Infinity},ms=windows[range]||Infinity;
    const points=(history||[]).filter(point=>Number.isFinite(Date.parse(point.at))).map(point=>({...point,time:Date.parse(point.at)}));
    const first=ms===Infinity?0:Date.now()-ms;let subset=points.filter(point=>point.time>=first);
    if(ms!==Infinity){const baseline=points.filter(point=>point.time<first).at(-1);if(baseline)subset=[{...baseline,time:first},...subset];}
    const bands=[['day','1D'],['week','7D'],['month','1M'],['all','Tudo']].map(([key,label])=>`<button type="button" data-pred-range="${key}" aria-pressed="${key===range}">${label}</button>`).join('');
    const last=subset.at(-1),total=last?Number(last.yesCount)+Number(last.noCount):0,yes=total?percent(Number(last.yesCount),total):null;
    const summary=yes===null?'Sem votos neste período':`${yes}% Sim · ${100-yes}% Não`;
    if(subset.filter(point=>Number(point.yesCount)+Number(point.noCount)>0).length<2)return `<div class="nx62-chart-head"><div><small>CONSENSO AO LONGO DO TEMPO</small><strong>${summary}</strong></div><div class="nx62-ranges" role="group" aria-label="Período do gráfico">${bands}</div></div><div class="nx62-chart-empty">Ainda não há histórico suficiente neste período. O gráfico aparecerá conforme os votos forem registrados.</div>`;
    const left=38,right=602,top=24,bottom=208,start=subset[0].time,end=subset.at(-1).time,spread=Math.max(1,end-start);
    const xy=(point,side)=>{const sum=Number(point.yesCount)+Number(point.noCount),ratio=sum?Number(point[side+'Count'])/sum:null;if(ratio===null)return null;return [left+(point.time-start)/spread*(right-left),bottom-ratio*(bottom-top)];};
    const line=side=>{let path='';for(const point of subset){const p=xy(point,side);if(p)path+=(path?' L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1);}return path;};
    const ticks=[100,75,50,25,0].map(v=>`<g><line x1="${left}" x2="${right}" y1="${bottom-v/100*(bottom-top)}" y2="${bottom-v/100*(bottom-top)}" class="nx62-grid-line"/><text x="0" y="${bottom-v/100*(bottom-top)+4}" class="nx62-axis">${v}%</text></g>`).join('');
    return `<div class="nx62-chart-head"><div><small>CONSENSO AO LONGO DO TEMPO</small><strong>${summary}</strong></div><div class="nx62-ranges" role="group" aria-label="Período do gráfico">${bands}</div></div><div class="nx62-chart-legend"><span class="yes">Sim</span><span class="no">Não</span></div><svg viewBox="0 0 640 240" role="img" aria-label="Histórico real de ${esc(summary)} entre ${esc(when(subset[0].at))} e ${esc(when(subset.at(-1).at))}"><g>${ticks}</g><path class="nx62-chart-line yes" d="${line('yes')}"/><path class="nx62-chart-line no" d="${line('no')}"/><text x="${left}" y="232" class="nx62-axis">${esc(when(subset[0].at))}</text><text x="${right}" y="232" text-anchor="end" class="nx62-axis">${esc(when(subset.at(-1).at))}</text></svg>`;
  }
  function renderDetail(state,data,privateData){
    const item=data.item,votes=Number(item.voteCount)||0,yes=Number(item.yesCount)||0,no=Number(item.noCount)||0,yesPct=percent(yes,votes),closed=item.status!=='OPEN'||Date.parse(item.closesAt)<=Date.now();
    const weighted=data.collective?.weightedYesPercent,estimated=data.collective?.estimatedYesPercent,conviction=data.collective?.conviction,own=privateData?.userVote,following=!!privateData?.following;
    const trend=item.trend24h,delta=Number(trend?.yesDelta)||0,other=Number(trend?.noDelta)||0,trendLabel=trend&&votes?(delta>=other?`Sim ${delta>=0?'+':''}${delta}`:`Não ${other>=0?'+':''}${other}`):'—';
    const source=/^https:\/\/anilist\.co\/(anime|manga)\/\d+$/.test(item.sourceUrl||'')?`<a href="${esc(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">Abrir registro no AniList ↗</a>`:'';
    const cards=(data.related||[]).map(r=>`<a class="nx62-related-card" href="${predictionHref(r)}"><span>${esc(r.mediaTitle)}</span><strong>${esc(questionLabel(r))}</strong><small>${esc(remaining(r.closesAt))} <span aria-hidden="true">→</span></small></a>`).join('');
    const argumentsHtml=(data.arguments||[]).map(argument=>`<article class="nx62-argument"><div class="nx62-argument-head"><strong>${esc(argument.author?.displayName||argument.author?.username||'Membro')}</strong><span>${argument.choice==='YES'?'Previu Sim':'Previu Não'} · ${esc(when(argument.createdAt))}</span></div><p>${esc(argument.text)}</p></article>`).join('');
    const result=item.status==='RESOLVED'?`<div class="nx62-result">Resultado confirmado: <strong>${item.result==='YES'?'Sim':'Não'}</strong>. Evidência registrada em ${esc(date(item.resolvedAt))}.</div>`:item.status==='VOID'?'<div class="nx62-result">Previsão anulada por falta de evidência suficiente. Nenhum ponto foi alterado.</div>':'';
    state.host.innerHTML=`<div class="nx62-detail-shell"><a class="nx62-back" href="${url('/previsoes')}">${arrow} Todas as previsões</a><header class="nx62-detail-heading"><span class="nx62-eyebrow">PREVISÃO · ${item.mediaType==='MANGA'?'MANGÁS':'ANIMES'}</span><h1>${esc(questionLabel(item))}</h1><div class="nx62-byline"><span>${votes} ${votes===1?'palpite':'palpites'}</span><span>${(data.arguments||[]).length} ${(data.arguments||[]).length===1?'argumento':'argumentos'}</span><span>${esc(remaining(item.closesAt))}</span></div><div class="nx62-actions"><a class="nx62-primary" href="#nx62-prever" data-pred-focus>${closed?'Ver resultado':'Fazer previsão'}</a><button type="button" data-pred-follow aria-pressed="${following}">${following?'Acompanhando':'Acompanhar previsão'}</button><button type="button" data-pred-share>Compartilhar</button></div><p class="nx62-action-feedback" data-pred-action-feedback role="status"></p></header><div class="nx62-context"><p>Esta previsão acompanha <strong>${esc(item.mediaTitle)}</strong>. O resultado será determinado pelo critério publicado abaixo, não por votação popular.</p><p>${votes?`Até agora, ${yes} ${yes===1?'pessoa prevê':'pessoas preveem'} Sim e ${no} ${no===1?'prevê':'preveem'} Não.`:'Ainda não há palpites registrados.'} Os palpites encerram em ${esc(date(item.closesAt))}.</p>${result}</div><div class="nx62-data-grid"><section class="nx62-surface nx62-chart-panel" aria-label="Histórico do consenso"><div data-pred-chart>${detailChart(data.history,state.range)}</div></section><section class="nx62-surface nx62-intelligence"><div class="nx62-panel-heading"><h2>Inteligência coletiva</h2><small>${votes} ${votes===1?'voto':'votos'}</small></div><div class="nx62-split-label"><span>Sim ${votes?yesPct+'%':'—'}</span><span>Não ${votes?100-yesPct+'%':'—'}</span></div><div class="nx62-consensus-bar" role="img" aria-label="${yes} Sim e ${no} Não"><span style="width:${votes?yesPct:0}%"></span></div><div class="nx62-metrics"><div><small>Indicador Prevê</small><strong>${estimated===null||estimated===undefined?'—':estimated+'% Sim'}</strong><em>Estimativa suavizada com 1 voto inicial para cada lado; não é chance objetiva.</em></div><div><small>Tendência 24h</small><strong>${esc(trendLabel)}</strong><em>${trend?.completeWindow?'Últimas 24 horas':'Desde o primeiro registro disponível'}</em></div><div><small>Consenso ponderado</small><strong>${weighted===null||weighted===undefined?'—':weighted+'% Sim'}</strong><em>Peso de cada palpite: confiança escolhida.</em></div><div><small>Índice de convicção</small><strong>${conviction??'—'}${conviction===null||conviction===undefined?'':'/100'}</strong><em>Média da confiança declarada.</em></div></div><small class="nx62-sample-note">${votes<20?'Amostra pequena: os percentuais podem mudar rapidamente.':'Percentuais calculados sobre votos válidos.'}</small></section></div><section id="nx62-prever" class="nx62-surface nx62-vote"><div class="nx62-panel-heading"><div><h2>Sua previsão</h2><p>Os pontos são reputacionais e não têm valor monetário.</p></div></div>${closed?`<div class="nx62-closed">${own?`Você previu ${own.choice==='YES'?'Sim':'Não'} com ${own.confidence}% de confiança. `:''}Esta previsão não aceita novos palpites.</div>`:`<div class="nx62-choice" role="group" aria-label="Resultado previsto"><button type="button" data-pred-choice="YES" aria-pressed="${own?.choice==='YES'}">Sim</button><button type="button" data-pred-choice="NO" aria-pressed="${own?.choice==='NO'}">Não</button></div><label class="nx62-confidence-label">Nível de confiança <small>O quanto você acredita no seu palpite; influencia apenas o consenso ponderado.</small></label><div class="nx62-confidence" role="group" aria-label="Nível de confiança">${[10,25,50,75,100].map(value=>`<button type="button" data-pred-confidence="${value}" aria-pressed="${(own?.confidence||state.confidence)===value}">${value}%</button>`).join('')}</div><p class="nx62-points">Se acertar: +50 pontos · Se errar: −25 pontos. Previsões anuladas não pontuam.</p><button type="button" class="nx62-primary nx62-confirm" data-pred-confirm>${own?'Atualizar previsão':'Confirmar previsão'}</button><p data-pred-vote-feedback role="status"></p>`}</section><section class="nx62-surface nx62-arguments" id="argumentos"><div class="nx62-panel-heading"><div><h2>Argumentos da comunidade</h2><p>Quem fez um palpite pode explicar o raciocínio. Argumentos não determinam o resultado.</p></div><small>${(data.arguments||[]).length}</small></div>${own?`<form data-pred-argument-form><label for="nx62-argument-text">Seu argumento</label><textarea id="nx62-argument-text" name="argument" maxlength="1500" minlength="10" placeholder="Explique seu raciocínio com respeito à comunidade.">${esc(privateData?.argument?.text||'')}</textarea><div><small>10 a 1.500 caracteres · até 2 links.</small><button type="submit">${privateData?.argument?'Atualizar argumento':'Publicar argumento'}</button></div><p data-pred-argument-feedback role="status"></p></form>`:`<p class="nx62-comment-gate">Faça sua previsão para participar do debate. <a href="#nx62-prever">Ir para a previsão</a></p>`}<div class="nx62-argument-list">${argumentsHtml||'<p class="nx62-empty-copy">Ainda sem argumentos. Seja a primeira pessoa a explicar seu raciocínio.</p>'}</div></section>${cards?`<section class="nx62-more"><div class="nx62-section-title"><h2>Continue prevendo</h2><p>Outras previsões abertas para participar.</p></div><div class="nx62-related">${cards}</div></section>`:''}<section class="nx62-context-section"><div class="nx62-section-title"><h2>Contexto e resolução</h2><p>As fontes ajudam a entender a pergunta. O resultado segue apenas o critério publicado.</p></div><div class="nx62-surface"><h3>Como esta previsão será resolvida</h3><p><strong>Critério:</strong> ${esc(item.criteria)}</p><p><strong>Fonte:</strong> ${esc(item.source)} ${source}</p><p><strong>Fechamento dos palpites:</strong> ${esc(date(item.closesAt))}</p><p><strong>Prazo de resolução:</strong> ${esc(date(item.resolutionDeadline))}</p>${item.evidenceHash?`<p><strong>Registro da evidência:</strong> <code>${esc(item.evidenceHash)}</code></p>`:''}</div></section><footer class="nx62-disclaimer">O AniNexus não é uma plataforma de apostas. Não há depósitos, saques, prêmios por acerto ou pontos com valor monetário.</footer></div>`;
    const localizedQuestion=questionLabel(item);
    if(item.type==='SCORE_AT_DEADLINE'&&/^Terá nota média\b/.test(localizedQuestion))state.host.querySelector('.nx62-detail-heading h1').textContent=`${item.mediaTitle} ${localizedQuestion[0].toLowerCase()}${localizedQuestion.slice(1)}`;
    if(item.status==='RESOLVED'||item.status==='VOID')state.host.querySelector('[data-pred-follow]')?.remove();
    if(item.status==='RESOLVED'&&own){const note=document.createElement('p');note.className='nx62-reputation-result';note.textContent=own.eligible===false?'Seu palpite ficou fora da janela válida; reputação inalterada.':own.choice===item.result?'Você acertou: +50 pontos reputacionais.':'Você errou: −25 pontos reputacionais.';state.host.querySelector('.nx62-closed')?.append(note);}
    if(item.status==='RESOLVED'&&item.evidence?.observation){
      const observation=item.evidence.observation,detail=document.createElement('p');detail.className='nx62-observation';
      const registered=observation.data?.startDate,complete=registered?.year&&registered?.month&&registered?.day;
      detail.textContent=item.type==='CATALOG_DATE_OBSERVED'&&complete?`Evidência: data completa de ${String(registered.day).padStart(2,'0')}/${String(registered.month).padStart(2,'0')}/${registered.year} observada no catálogo em ${date(observation.observedAt)}.`:item.type==='SCORE_AT_DEADLINE'&&Number.isFinite(observation.data?.averageScore)?`Evidência: nota ${observation.data.averageScore}/100 observada no AniList em ${date(observation.observedAt)}.`:`Evidência registrada em ${date(observation.observedAt)}.`;
      state.host.querySelector('.nx62-context-section>.nx62-surface')?.append(detail);
    }
    document.title=`${item.mediaTitle} · Previsão | AniNexus`;
    if(focusVote()&&!state.scrolled){state.scrolled=true;requestAnimationFrame(()=>state.host.querySelector('#nx62-prever')?.scrollIntoView({block:'start'}));}
  }
  async function loadDetail(state){
    const version=++state.version;state.host.innerHTML='<div class="nx62-detail-shell nx62-loading" role="status">Carregando previsão…</div>';
    try{
      const data=await publicApi('/api/predictions/'+encodeURIComponent(state.target)+'/detail',state.controller.signal);
      if(!active(state)||version!==state.version)return;
      const signedIn=await window.AniNexusAuth?.getUser?.().catch(()=>null);
      const privateData=signedIn?await privateApi('/api/me/predictions/'+encodeURIComponent(state.target)+'/detail',{signal:state.controller.signal}).catch(()=>null):null;
      if(!active(state)||version!==state.version)return;
      state.data=data;state.privateData=privateData;state.confidence=privateData?.userVote?.confidence||state.confidence;renderDetail(state,data,privateData);
    }catch(error){if(!active(state)||version!==state.version||state.controller.signal.aborted)return;state.host.innerHTML=`<div class="nx62-detail-shell nx62-error"><h1>${error.status===404?'Previsão não encontrada':'A previsão não carregou agora'}</h1><p>${error.status===404?'Confira o endereço ou veja as outras previsões.':'Tente carregar novamente; seus palpites permanecem salvos.'}</p><a href="${url('/previsoes')}">Ver previsões</a> <button type="button" data-pred-detail-retry>Tentar novamente</button></div>`;}
  }
  async function detailAction(state,event){
    const target=event.target.closest('button,[data-pred-focus]');if(!target||!active(state))return;
    const feedback=state.host.querySelector('[data-pred-action-feedback]');
    if(target.dataset.predRange){state.range=target.dataset.predRange;state.host.querySelector('[data-pred-chart]').innerHTML=detailChart(state.data.history,state.range);return;}
    if(target.dataset.predChoice){state.host.querySelectorAll('[data-pred-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button===target)));return;}
    if(target.dataset.predConfidence){state.confidence=Number(target.dataset.predConfidence);state.host.querySelectorAll('[data-pred-confidence]').forEach(button=>button.setAttribute('aria-pressed',String(button===target)));return;}
    if(target.hasAttribute('data-pred-share')){try{const share={title:state.data.item.question,url:location.href.split('&foco=')[0]};if(navigator.share)await navigator.share(share);else{await navigator.clipboard.writeText(share.url);feedback.textContent='Link copiado.';}}catch(error){if(error.name!=='AbortError')feedback.textContent='Não foi possível compartilhar agora.';}return;}
    if(target.hasAttribute('data-pred-follow')||target.hasAttribute('data-pred-confirm')){
      const signedIn=await window.AniNexusAuth?.getUser?.().catch(()=>null);if(!signedIn){const place=target.hasAttribute('data-pred-confirm')?state.host.querySelector('[data-pred-vote-feedback]'):feedback;place.innerHTML=`<a href="${url('/login')}">Entre na sua conta para continuar.</a>`;return;}
      if(target.hasAttribute('data-pred-follow')){target.disabled=true;try{const data=await privateApi('/api/me/predictions/'+state.target+'/follow',{method:'PUT',body:JSON.stringify({following:target.getAttribute('aria-pressed')!=='true'})});target.setAttribute('aria-pressed',String(data.following));target.textContent=data.following?'Acompanhando':'Acompanhar previsão';feedback.textContent=data.following?'Você receberá o resultado na sua conta.':'Acompanhamento removido.';}catch{feedback.textContent='Não foi possível atualizar o acompanhamento.';}finally{target.disabled=false;}return;}
      const selected=state.host.querySelector('[data-pred-choice][aria-pressed="true"]');const voteFeedback=state.host.querySelector('[data-pred-vote-feedback]');if(!selected){voteFeedback.textContent='Escolha Sim ou Não antes de confirmar.';return;}
      target.disabled=true;voteFeedback.textContent='Salvando sua previsão…';try{await privateApi('/api/me/predictions/'+state.target+'/vote',{method:'PUT',body:JSON.stringify({choice:selected.dataset.predChoice,confidence:state.confidence})});await loadDetail(state);state.host.querySelector('[data-pred-vote-feedback]').textContent='Sua previsão foi registrada.';}catch(error){voteFeedback.textContent=error.status===409?'Os palpites já foram encerrados.':'Não foi possível salvar sua previsão. Tente novamente.';target.disabled=false;}return;
    }
    if(target.hasAttribute('data-pred-detail-retry'))loadDetail(state);
  }
  async function detailArgument(state,event){event.preventDefault();const form=event.target.closest('[data-pred-argument-form]');if(!form)return;const input=form.querySelector('textarea'),text=input.value.trim(),feedback=form.querySelector('[data-pred-argument-feedback]'),button=form.querySelector('button[type=submit]');if(text.length<10||text.length>1500){feedback.textContent='Escreva entre 10 e 1.500 caracteres.';return;}button.disabled=true;feedback.textContent='Publicando argumento…';try{await privateApi('/api/me/predictions/'+state.target+'/argument',{method:'PUT',body:JSON.stringify({text})});await loadDetail(state);state.host.querySelector('[data-pred-argument-feedback]').textContent='Seu argumento foi publicado.';}catch{feedback.textContent='Não foi possível publicar agora. Seu texto continua aqui.';button.disabled=false;}}
  function mount(){
    if(route().split(/[?#]/)[0]!=='/previsoes'){current?.controller.abort();current=null;document.body.classList.remove('nx61-predictions-active');return;}
    const target=linkedPrediction();
    if(current?.host.isConnected){
      if(current.target!==target||current.kind!==(target?'detail':'list')){
        current.controller.abort();current=null;
      }else{
        if(target&&focusVote())current.host.querySelector('#nx62-prever')?.scrollIntoView({block:'start'});
        return;
      }
    }
    const app=document.querySelector('#app');if(!app)return;
    current?.controller.abort();document.body.classList.add('nx61-predictions-active');
    if(target){
      document.title='Previsão | AniNexus';
      app.innerHTML='<main class="nx61-predictions nx62-detail" aria-label="Detalhes da previsão"></main>';
      const state=current={kind:'detail',host:app.firstElementChild,target,version:0,range:'all',confidence:50,scrolled:false,controller:new AbortController(),data:null,privateData:null};
      state.host.addEventListener('click',event=>detailAction(state,event));state.host.addEventListener('submit',event=>detailArgument(state,event));
      loadDetail(state);dispatchEvent(new CustomEvent('aninexus:route-ready',{detail:{owner:'predictions',path:'/previsoes'}}));return;
    }
    if(current?.host.isConnected){
      if(current.target!==target){
        current.target=target;current.filter='hot';current.offset=null;
        current.host.querySelectorAll('[data-pred-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.predFilter==='hot')));
        load(current);
      }
      return;
    }
    document.title='Previsões | AniNexus';
    app.innerHTML=`<main class="nx61-predictions"><div class="nx61-pred-shell"><a class="nx61-pred-back" href="${url(returnPath)}" aria-label="Voltar para a página anterior">${arrow}<span>Voltar</span></a><header class="nx61-pred-heading"><span class="nx61-pred-eyebrow">COMUNIDADE · PREVISÕES</span><h1>Previsões</h1><p>Perguntas sobre animes e mangás, com resultado verificável.</p></header><nav class="nx61-pred-filters" aria-label="Filtrar previsões">${filters.map(([key,label])=>`<button type="button" data-pred-filter="${key}" aria-pressed="${key==='hot'}">${label}</button>`).join('')}</nav><div data-pred-body aria-live="polite"></div><button type="button" data-pred-more hidden>Carregar mais</button><p class="nx61-pred-list-disclaimer">Palpites e pontos são apenas reputacionais. Não há apostas, depósitos, saques ou prêmios de valor monetário.</p></div></main>`;
    const state=current={kind:'list',host:app.firstElementChild,filter:'hot',target,items:[],offset:null,version:0,controller:new AbortController()};
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
  const homeRequests=new WeakMap();
  function homeEmbed(impressions){
    const home=impressions.closest('.nx35-home');if(!home)return;
    let section=home.querySelector(':scope > .nx61-pred-home');
    if(section&&section.previousElementSibling!==impressions)impressions.insertAdjacentElement('afterend',section);
    if(section)return;
    section=document.createElement('section');section.className='nx35-section nx61-pred-home';
    section.innerHTML=`<div class="nx35-shell"><div class="nx35-head"><div><small>COMUNIDADE</small><h2>Previsões <em>em alta</em></h2><p>Palpites sobre as obras que você acompanha, com resultados verificáveis.</p></div><a href="${url('/previsoes')}">Ver todas ${arrow}</a></div><div class="nx35-edge"><div class="nx35-rail nx61-pred-home-rail" tabindex="0" aria-label="Previsões em alta"><div class="nx61-pred-home-loading" role="status">Carregando previsões…</div></div></div></div>`;
    impressions.insertAdjacentElement('afterend',section);
    const request=Symbol('home-predictions');homeRequests.set(section,request);
    const rail=section.querySelector('.nx61-pred-home-rail');
    const loadHome=async(attempt=0)=>{
      if(!section.isConnected||homeRequests.get(section)!==request)return;
      try{
        const data=await publicApi('/api/predictions?filter=hot',AbortSignal.timeout(12000));
        if(!section.isConnected||homeRequests.get(section)!==request)return;
        if(!data.items?.length){section.remove();return;}
        rail.innerHTML=data.items.slice(0,8).map(homeCard).join('');
        rail.scrollLeft=0;
        window.AniNexusRails?.refresh?.();
      }catch(error){
        if(!section.isConnected||homeRequests.get(section)!==request)return;
        if(error.status===404){section.remove();return;}
        if(attempt<2){setTimeout(()=>loadHome(attempt+1),attempt?4000:1500);return;}
        rail.innerHTML='<div class="nx61-pred-home-error" role="status">As previsões não carregaram agora. <button type="button">Tentar novamente</button></div>';
        rail.querySelector('button').addEventListener('click',()=>{rail.innerHTML='<div class="nx61-pred-home-loading" role="status">Carregando previsões…</div>';loadHome();},{once:true});
      }
    };
    loadHome();
  }
  function scan(){
    scheduled=false;mount();
    const impressions=document.querySelector('.nx35-home #nx38HomeImpressions');if(impressions)homeEmbed(impressions);
    const community=document.querySelector('.nx40-community .nx40-main');if(community)embed(community);
    const detail=document.querySelector('.nx22-detail'),panel=detail?.querySelector('#nx22Panel');
    if(panel&&detail.querySelector('[data-nx22-tab="geral"].active'))embed(panel,'&mediaId='+encodeURIComponent(detail.dataset.nx22Id)+'&mediaType='+encodeURIComponent(detail.dataset.nx22Type||'ANIME'),'Previsões sobre esta obra');
  }
  function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(scan);}}
  const observer=new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n instanceof Element&&(n.matches('main,article.nx22-detail,.nx35-home,.nx40-community,#nx38HomeImpressions')||n.querySelector('#nx38HomeImpressions')))))schedule();});
  const init=()=>{observer.observe(document.querySelector('#app')||document.body,{childList:true,subtree:true});schedule();};
  addEventListener('aninexus:route-changed',event=>{const from=event.detail?.from,to=event.detail?.to;if(to==='/previsoes'&&from&&from!=='/previsoes')returnPath=from;schedule();});addEventListener('aninexus:route-ready',schedule);
  addEventListener('aninexus:home-v34-ready',schedule);
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
