'use strict';
(() => {
  if(window.AniNexusFranchise)return;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const modes={sequence:'Ordem recomendada',release:'Ordem de lançamento',chronological:'Ordem cronológica',extras:'Filmes e especiais',spinoff:'Spin-offs'};
  const labels={PREQUEL:'Prequela',SEQUEL:'Continuação',PARENT:'História principal',SIDE_STORY:'História paralela',SPIN_OFF:'Spin-off',ALTERNATIVE:'Versão alternativa',SUMMARY:'Resumo',COMPILATION:'Compilação',ADAPTATION:'Adaptação',SOURCE:'Obra original'};
  const statuses={PLANNING:'Na sua lista',CURRENT:'Em andamento',COMPLETED:'Concluído',PAUSED:'Pausado',DROPPED:'Interrompido'};
  const slug=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,90)||'obra';
  const path=n=>`/${n.mediaType==='MANGA'?'manga':'anime'}/${slug(n.title)}-${Number(n.id)}`;
  let current=null;
  function rows(state) {
    const {data,mode}=state,byKey=new Map(data.nodes.map(n=>[n.key,n]));
    if(mode==='chronological')return [];
    let keys=data.order[mode==='sequence'?'sequence':'release']||[];
    if(mode==='extras')keys=keys.filter(key=>['MOVIE','SPECIAL','OVA'].includes(byKey.get(key)?.format));
    if(mode==='spinoff'){const selected=new Set(data.edges.filter(e=>['SPIN_OFF','SIDE_STORY'].includes(e.relation)).map(e=>e.to));keys=keys.filter(key=>selected.has(key));}
    return keys.map(key=>byKey.get(key)).filter(Boolean);
  }
  function card(n,index,state) {
    const value=state.progress?.get(n.key),relation=state.data.edges.find(e=>e.from===state.data.root&&e.to===n.key),isRoot=n.key===state.data.root;
    const cover=/^https:\/\//i.test(n.cover||'')?`<img src="${esc(n.cover)}" alt="" loading="lazy" decoding="async">`:'<span aria-hidden="true"></span>';
    return `<li><span class="nx61-franchise-number" aria-hidden="true">${index+1}</span><a href="${path(n)}" class="nx61-franchise-work"><span class="nx61-franchise-cover">${cover}</span><span><small>${esc(isRoot?'Você está aqui':labels[relation?.relation]||'Obra relacionada')}</small><strong>${esc(n.title)}</strong><span>${esc([n.mediaType==='MANGA'?'Mangá':n.format||'Anime',n.year||'Ano não informado'].join(' · '))}</span>${value?`<b class="${value.status==='COMPLETED'?'is-completed':''}">${esc(statuses[value.status]||'Na sua lista')}</b>`:''}</span></a></li>`;
  }
  function paint(state) {
    if(!state.host.isConnected)return;
    if(state.data.nodes.length===1&&!state.data.edges.length){state.host.innerHTML='<section class="nx22-full"><div class="nx22-section-head"><div><small>UNIVERSO</small><h2>Franquia e relações</h2></div></div><div class="nx22-detail-empty"><div><strong>Franquia ainda não disponível</strong><p>A fonte ainda não informou outras obras relacionadas a este título.</p></div></div></section>';return;}
    const {host,data,mode,progress}=state,items=rows(state),completed=progress?data.nodes.filter(n=>progress.get(n.key)?.status==='COMPLETED').length:null;
    const rootDone=progress?.get(data.root)?.status==='COMPLETED';
    const nextKeys=rootDone?data.edges.filter(e=>e.from===data.root&&e.relation==='SEQUEL').map(e=>e.to):[];
    const next=data.nodes.filter(n=>nextKeys.includes(n.key)&&!progress.has(n.key));
    const note=mode==='chronological'?'Ainda não existe uma ordem cronológica revisada para esta coleção. A data de lançamento não informa em que momento a história acontece.':mode==='sequence'?(data.order.cycle?'As relações da fonte se contradizem; mostramos a ordem de lançamento, sem afirmar uma sequência recomendada.':'Sequência baseada nas relações de prequela e continuação da fonte. Filmes paralelos, adaptações e versões alternativas aparecem nas outras visualizações.'):mode==='release'?'Datas de lançamento informadas pela fonte. Obras sem data ficam no final.':'Seleção por formato e relações do catálogo.';
    host.innerHTML=`<section class="nx61-franchise"><header class="nx22-section-head"><div><small>UNIVERSO</small><h2>Franquia e relações</h2></div></header>
      <div class="nx61-franchise-progress" aria-live="polite">${completed!==null?`<strong>Você completou ${completed} de ${data.nodes.length} obras catalogadas · ${Math.round(completed/data.nodes.length*100)}%</strong><progress max="${data.nodes.length}" value="${completed}" aria-label="Obras concluídas nesta coleção"></progress>`:state.progressError?'<span>Seu progresso não carregou. As relações continuam disponíveis.</span><button type="button" data-franchise-progress-retry>Tentar novamente</button>':state.signedIn?'<span>Consultando seu progresso...</span>':'<a href="/login">Entre para acompanhar seu progresso nesta coleção</a>'}</div>
      ${next.length?`<aside class="nx61-franchise-next"><strong>Sua história continua</strong><p>Você concluiu esta obra. ${next.length===1?'Esta continuação ainda não está na sua lista:':'Estas continuações ainda não estão na sua lista:'}</p>${next.map(n=>`<div><a href="${path(n)}">${esc(n.title)}</a><button type="button" ${n.mediaType==='MANGA'?'data-manga-list':'data-list'}="${n.id}" aria-label="Adicionar ${esc(n.title)} à lista">Adicionar à lista</button></div>`).join('')}</aside>`:''}
      <label class="nx61-franchise-select">Visualização<select data-franchise-mode>${Object.entries(modes).map(([key,label])=>`<option value="${key}"${mode===key?' selected':''}>${esc(label)}</option>`).join('')}</select></label><p class="nx61-franchise-note">${esc(note)}</p>
      ${items.length?`<ol class="nx61-franchise-list">${items.map((n,i)=>card(n,i,state)).join('')}</ol>`:`<p class="nx61-franchise-empty">${mode==='chronological'?'Use a sequência principal ou a ordem de lançamento enquanto não há curadoria cronológica.':'Nenhuma obra catalogada nesta visualização.'}</p>`}
      <footer class="nx61-franchise-note">${data.partial?'Esta coleção está incompleta: algumas relações ainda não foram catalogadas.':'Estas são as relações disponíveis na fonte consultada.'} O progresso considera apenas as ${data.nodes.length} obras exibidas na coleção, não uma lista editorial definitiva da franquia.</footer></section>`;
    host.querySelector('[data-franchise-mode]').onchange=event=>{state.mode=event.target.value;paint(state);host.querySelector('[data-franchise-mode]').focus();};
    host.querySelector('[data-franchise-progress-retry]')?.addEventListener('click',()=>loadProgress(state));
    host.querySelectorAll('a[href^="/"]').forEach(a=>a.addEventListener('click',event=>{if(event.button||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;if(window.AniNexusGo?.(a.getAttribute('href')))event.preventDefault();}));
    host.querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>img.remove(),{once:true}));
  }
  async function loadProgress(state) {
    const auth=window.AniNexusAuth;state.progressError=false;
    try {
      const user=await auth?.getUser?.();if(current!==state||!state.host.isConnected)return;
      state.signedIn=!!user;if(!user){state.progress=null;paint(state);return;}paint(state);
      const query=new URLSearchParams();for(const type of ['ANIME','MANGA'])query.set(type.toLowerCase(),state.data.nodes.filter(n=>n.mediaType===type).map(n=>n.id).join(','));
      const result=await auth.api('/api/me/franchise-progress?'+query,{signal:state.controller.signal,timeout:8000});
      if(current!==state||!state.host.isConnected)return;
      state.progress=new Map((result.items||[]).map(r=>[`${r.media_type}:${Number(r.media_id)}`,r]));paint(state);
    }catch{if(current===state&&state.host.isConnected&&!state.controller.signal.aborted){state.progressError=true;paint(state);}}
  }
  async function mount(host,type,id) {
    current?.controller.abort();const state={host,type,id,controller:new AbortController(),mode:'sequence',progress:null,signedIn:false};current=state;
    host.innerHTML='<section class="nx22-full"><div class="nx22-section-head"><div><small>UNIVERSO</small><h2>Franquia e relações</h2></div></div><div class="nx22-panel-loading" role="status" aria-busy="true"><i></i><i></i><span>Organizando as obras relacionadas...</span></div></section>';
    try {
      const endpoint=`/api/${type==='MANGA'?'manga':'anime'}/${Number(id)}/franchise`;
      const data=await window.AniNexusRuntime.withDeadline(async signal=>{const response=await fetch((window.AniNexusAuth?.apiOrigin||'')+endpoint,{signal});if(!response.ok)throw Error('FRANCHISE_UNAVAILABLE');return response.json();},{timeout:10000,signal:state.controller.signal,label:'Franquia'});
      if(current!==state||!host.isConnected)return;
      if(!Array.isArray(data.nodes)||!data.nodes.length||!data.order)throw Error('FRANCHISE_INVALID');
      state.data=data;paint(state);loadProgress(state);
    }catch(error){if(state.controller.signal.aborted||current!==state||!host.isConnected)return;host.innerHTML='<section class="nx22-full"><h2>Franquia e relações</h2><div class="nx61-franchise-empty" role="status"><p>As relações não carregaram agora. Você pode tentar novamente.</p><button type="button" data-franchise-retry>Tentar novamente</button></div></section>';host.querySelector('button').onclick=()=>mount(host,type,id);}
  }
  addEventListener('aninexus:account-identity-changed',()=>{if(!current?.data||!current.host.isConnected)return;current.controller.abort();current={...current,controller:new AbortController(),progress:null,signedIn:false,progressError:false};paint(current);loadProgress(current);});
  addEventListener('aninexus:detail-panel',event=>{if(current&&(event.detail?.key!=='franquia'||Number(event.detail?.id)!==Number(current.id))){current.controller.abort();current=null;}});
  for(const name of ['aninexus:media-state-changed','aninexus:manga-media-state-changed'])document.addEventListener(name,event=>{const state=current;if(!state?.progress||!state.host.isConnected)return;const type=name.includes('manga-')?'MANGA':'ANIME',key=`${type}:${event.detail?.id}`;if(event.detail?.state?.status)state.progress.set(key,event.detail.state);else state.progress.delete(key);paint(state);});
  window.AniNexusFranchise={mount};
})();
