'use strict';
(() => {
  const KEY='aninexus:mediaState:v1';
  const FAV_KEY='aninexus:favorites';
  const LIST_KEY='aninexus:list';
  const LEGACY_STATUS='aninexus:listStatus';
  const GUIDE_KEY='aninexus:trackerGuideSeen:v2';
  const API='https://graphql.anilist.co';
  const IS_PAGES=location.hostname.endsWith('github.io');
  const cache=new Map();
  let openLayer=null;

  const SVG={
    plus:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    play:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 9 6-9 6V6Z"/></svg>',
    check:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.2 4.2L19 7"/></svg>',
    pause:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6v12M16 6v12"/></svg>',
    x:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
    heart:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.7 8.7c0 5-8.7 10.1-8.7 10.1S3.3 13.7 3.3 8.7A4.6 4.6 0 0 1 12 6.2a4.6 4.6 0 0 1 8.7 2.5Z"/></svg>',
    minus:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>',
    close:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
    info:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 10.5v6M12 7.4h.01"/></svg>'
  };
  const STATUS={
    PLANNING:{label:'Quero Ver',icon:SVG.plus,help:'Salve para lembrar depois. Como você ainda não começou, nota e reações de experiência ficam bloqueadas.'},
    CURRENT:{label:'Assistindo',icon:SVG.play,help:'Marque seu progresso. Depois do primeiro episódio, você pode registrar reação e nota parcial.'},
    COMPLETED:{label:'Terminei',icon:SVG.check,help:'Ao concluir, o progresso vai para o total de episódios e sua nota passa a ser final.'},
    PAUSED:{label:'Pausei',icon:SVG.pause,help:'Seu progresso é preservado. Reação e nota representam sua experiência até a pausa.'},
    DROPPED:{label:'Desisti',icon:SVG.x,help:'Informe até onde assistiu. Se viu algum episódio, pode deixar uma impressão e uma nota até aquele ponto.'}
  };
  const REACTIONS={
    PLANNING:[['👀','Estou curioso'],['🔥','Hype alto'],['🤝','Me indicaram'],['📚','Li o mangá'],['🎬','O trailer me pegou'],['⏳','Contando os dias']],
    CURRENT:[['🎣','Viciante'],['👍','Curtindo'],['😍','Amei'],['🤣','Rachei'],['☕','Relaxante'],['🐢','Lento'],['🥰','Fofo'],['🤞','Dando uma chance'],['✨','Que animação!'],['🔥','Bombando'],['🎵','Que trilha!'],['😵‍💫','Perdido'],['⚔️','Continuando a saga'],['🤓','Li o mangá'],['🛋️','Vendo junto']],
    COMPLETED:[['🎣','Viciante'],['😍','Amei'],['🤣','Rachei'],['💎','Joia escondida'],['😭','Chorei'],['👻','De arrepiar'],['😮‍💨','Pesado demais'],['🔥','Bombando'],['🎵','Que trilha!'],['✨','Que animação!'],['🏆','Melhor do ano'],['🤓','Li o mangá'],['🛋️','Vendo junto'],['🫤','Fraco']],
    PAUSED:[['🐢','Lento'],['😮‍💨','Pesado demais'],['😵‍💫','Perdido'],['🤞','Ainda vou dar chance'],['⏸️','Preciso de uma pausa'],['🤓','Li o mangá'],['🛋️','Vendo junto']],
    DROPPED:[['🫤','Fraco'],['🐢','Lento'],['😮‍💨','Pesado demais'],['😵‍💫','Perdido'],['🚪','Não me pegou'],['🙅','Não era pra mim'],['📉','Perdeu a graça'],['🤓','Li o mangá']]
  };
  const FORMAT={TV:'Série',TV_SHORT:'Série curta',MOVIE:'Filme',OVA:'OVA',ONA:'ONA',SPECIAL:'Especial',MUSIC:'Música'};
  const GENRE={Action:'Ação',Adventure:'Aventura',Comedy:'Comédia',Drama:'Drama',Fantasy:'Fantasia',Horror:'Terror',Mystery:'Mistério',Romance:'Romance','Sci-Fi':'Ficção Científica','Slice of Life':'Slice of Life',Sports:'Esportes',Supernatural:'Sobrenatural',Thriller:'Suspense',Music:'Música',Psychological:'Psicológico',Mecha:'Mecha'};

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const read=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v??f}catch{return f}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
  const setOf=k=>new Set((read(k,[])||[]).map(Number));
  const title=m=>m?.title?.english||m?.title?.userPreferred||m?.title?.romaji||m?.title?.native||'Anime';
  const cover=m=>m?.coverImage?.extraLarge||m?.coverImage?.large||'';
  const normalizeState=s=>({status:s?.status||'',progress:Math.max(0,Number(s?.progress)||0),reaction:String(s?.reaction||''),score:Number.isFinite(Number(s?.score))?Number(s.score):null,updatedAt:Number(s?.updatedAt)||0});

  function all(){const v=read(KEY,{});return v&&typeof v==='object'?v:{}}
  function get(id){
    const a=all(),direct=a[id];if(direct)return normalizeState(direct);
    const legacy=read(LEGACY_STATUS,{}),listed=setOf(LIST_KEY),st=legacy?.[id]||'';
    if(st||listed.has(Number(id)))return normalizeState({status:st||'PLANNING'});
    return normalizeState({});
  }
  function put(id,s){
    const next=normalizeState(s),a=all();
    if(!next.status&&!next.reaction&&next.score==null&&!next.progress)delete a[id];else a[id]={...next,updatedAt:Date.now()};
    write(KEY,a);
    const legacy=read(LEGACY_STATUS,{}),listed=setOf(LIST_KEY);
    if(next.status){legacy[id]=next.status;listed.add(Number(id))}else{delete legacy[id];listed.delete(Number(id))}
    write(LEGACY_STATUS,legacy);write(LIST_KEY,[...listed]);
    document.dispatchEvent(new CustomEvent('aninexus:media-state-changed',{detail:{id:Number(id),state:next}}));
    syncUI(Number(id));
    return next;
  }
  function favorite(id,value){const s=setOf(FAV_KEY),n=Number(id);const desired=typeof value==='boolean'?value:!s.has(n);desired?s.add(n):s.delete(n);write(FAV_KEY,[...s]);syncFav(n);document.dispatchEvent(new CustomEvent('aninexus:favorite-changed',{detail:{id:n,favorite:desired}}));return desired}

  function statusSelector(id){return `[data-list="${id}"],[data-nx-list="${id}"],[data-nx-detail-list="${id}"],[data-nx18-status="${id}"],[data-nx17-list="${id}"]`}
  function favSelector(id){return `[data-fav="${id}"],[data-nx-fav="${id}"],[data-nx-detail-fav="${id}"],[data-nx18-fav="${id}"],[data-nx17-fav="${id}"]`}
  function iconFor(st){return STATUS[st]?.icon||SVG.plus}
  function syncStatus(id){
    const s=get(id),has=!!s.status;
    document.querySelectorAll(statusSelector(id)).forEach(b=>{
      b.classList.toggle('active',has);b.dataset.nxUnifiedStatus=s.status||'';b.setAttribute('aria-pressed',String(has));
      const label=STATUS[s.status]?.label||'Adicionar à lista';
      if(b.matches('.nx-detail-actions .primary,.detail-actions .btn,[data-nx-detail-list]')){
        const span=b.querySelector('span');if(span){span.textContent=label;b.querySelector('svg')?.remove();b.insertAdjacentHTML('afterbegin',iconFor(s.status));}
        else b.innerHTML=`${iconFor(s.status)} ${esc(label)}`;
      }else b.innerHTML=iconFor(s.status);
      b.setAttribute('aria-label',has?`Status: ${label}`:'Adicionar à lista');b.title=has?label:'Adicionar à lista';
    });
  }
  function syncFav(id){const on=setOf(FAV_KEY).has(Number(id));document.querySelectorAll(favSelector(id)).forEach(b=>{b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));b.setAttribute('aria-label',on?'Remover dos favoritos':'Favoritar');b.title=on?'Remover dos favoritos':'Favoritar';if(!b.querySelector('svg'))b.innerHTML=SVG.heart})}
  function syncUI(id){if(Number.isFinite(Number(id))){syncStatus(Number(id));syncFav(Number(id));return}const ids=new Set();document.querySelectorAll('[data-list],[data-nx-list],[data-nx-detail-list],[data-nx18-status],[data-nx17-list],[data-fav],[data-nx-fav],[data-nx-detail-fav],[data-nx18-fav],[data-nx17-fav]').forEach(el=>{for(const a of ['list','nxList','nxDetailList','nx18Status','nx17List','fav','nxFav','nxDetailFav','nx18Fav','nx17Fav'])if(el.dataset[a])ids.add(Number(el.dataset[a]))});ids.forEach(syncUI)}

  function idFromStatusButton(b){return Number(b.dataset.list||b.dataset.nxList||b.dataset.nxDetailList||b.dataset.nx18Status||b.dataset.nx17List||0)}
  function idFromFavButton(b){return Number(b.dataset.fav||b.dataset.nxFav||b.dataset.nxDetailFav||b.dataset.nx18Fav||b.dataset.nx17Fav||0)}
  function seedFromDom(id){
    const root=document.querySelector(`[data-nx18-open="${id}"],[data-nx-media="${id}"],[data-open="${id}"],.nx-detail`);if(!root)return null;
    const img=root.querySelector('img')?.src||'';const h=root.querySelector('h3,h2,h1,strong')?.textContent?.trim()||'Anime';return{id:Number(id),title:{userPreferred:h},coverImage:{large:img},genres:[],episodes:null,format:'TV',seasonYear:null}
  }
  async function media(id){
    const n=Number(id);if(cache.has(n))return cache.get(n);const seeded=seedFromDom(n);if(seeded)cache.set(n,seeded);
    const q=`query($id:Int){Media(id:$id,type:ANIME){id title{romaji english native userPreferred} coverImage{extraLarge large} genres episodes format seasonYear}}`;
    try{const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({query:q,variables:{id:n}})});if(!r.ok)throw Error();const j=await r.json();const m=j?.data?.Media;if(m){cache.set(n,m);return m}}catch{}
    return cache.get(n)||{id:n,title:{userPreferred:'Anime'},coverImage:{},genres:[],episodes:null,format:'TV',seasonYear:null};
  }

  function rules(draft,total){
    const watched=Math.max(0,Number(draft.progress)||0),status=draft.status||'PLANNING';
    if(status==='PLANNING')return{progress:false,reactions:true,score:false,scoreLabel:'SUA NOTA',note:'A nota fica disponível quando você começar a assistir.'};
    if(status==='COMPLETED')return{progress:!!total,reactions:true,score:true,scoreLabel:'SUA NOTA FINAL',note:'Sua avaliação representa a obra concluída.'};
    if(status==='CURRENT')return{progress:true,reactions:watched>0,score:watched>0,scoreLabel:'SUA NOTA PARCIAL',note:watched>0?'Nota parcial: você pode mudar quando avançar.':'Marque pelo menos 1 episódio para liberar reação e nota.'};
    if(status==='PAUSED')return{progress:true,reactions:watched>0,score:watched>0,scoreLabel:'SUA NOTA PARCIAL',note:watched>0?'Sua nota representa o que viu antes da pausa.':'Informe até onde assistiu para registrar sua impressão.'};
    return{progress:true,reactions:true,score:watched>0,scoreLabel:'SUA NOTA ATÉ AQUI',note:watched>0?'Você pode avaliar somente o que chegou a assistir.':'Sem episódios assistidos, a nota fica bloqueada.'};
  }
  function allowedReaction(status,label){return(REACTIONS[status]||[]).some(([,l])=>l===label)}
  function adaptDraft(draft,status,total){
    draft.status=status;
    if(status==='PLANNING'){draft.progress=0;draft.score=null;if(!allowedReaction(status,draft.reaction))draft.reaction=''}
    if(status==='COMPLETED'&&total){draft.progress=total;if(!allowedReaction(status,draft.reaction))draft.reaction=''}
    if(status!=='PLANNING'&&!allowedReaction(status,draft.reaction))draft.reaction='';
    const r=rules(draft,total);if(!r.score)draft.score=null;return draft;
  }

  async function open(id){
    close();const m=await media(id),existing=get(id),isNew=!existing.status&&!existing.reaction&&existing.score==null&&!existing.progress;
    const draft={...(isNew?{status:'PLANNING',progress:0,reaction:'',score:null}:existing)};
    const total=Math.max(0,Number(m.episodes)||0);if(draft.status==='COMPLETED'&&total)draft.progress=total;
    let showAll=false,guide=isNew&&!read(GUIDE_KEY,false);
    const layer=document.createElement('div');layer.className='nx19-media-layer';openLayer=layer;document.body.append(layer);document.body.classList.add('modal-open');

    function reactionHTML(){const arr=REACTIONS[draft.status]||[];return arr.map(([emoji,label],i)=>`<button type="button" class="nx19-reaction ${draft.reaction===label?'active':''} ${i>=8&&!showAll?'extra':''}" data-nx19-reaction="${esc(label)}"><span>${emoji}</span>${esc(label)}</button>`).join('')}
    function html(){
      const r=rules(draft,total),p=Math.min(total||9999,Math.max(0,Number(draft.progress)||0)),score=draft.score==null?'':Number(draft.score);
      const meta=[m.seasonYear,FORMAT[m.format]||m.format,(m.genres||[]).slice(0,3).map(g=>GENRE[g]||g).join(', ')].filter(Boolean).join(' · ');
      return `<button class="nx19-backdrop" data-nx19-close aria-label="Fechar"></button><section class="nx19-media-modal" role="dialog" aria-modal="true" aria-labelledby="nx19TrackerTitle"><button class="nx19-close" data-nx19-close aria-label="Fechar">${SVG.close}</button><header class="nx19-media-head"><img src="${esc(cover(m))}" alt=""><div><small>${esc(m.title?.romaji&&m.title.romaji!==title(m)?m.title.romaji:'Seu anime')}</small><h2 id="nx19TrackerTitle">${esc(title(m))}</h2><p>${esc(meta)}</p></div></header>${guide?`<aside class="nx19-first-guide"><div>${SVG.info}<strong>Primeira vez aqui?</strong></div><p>O AniNexus adapta o acompanhamento ao seu momento. <b>Quero Ver</b> já vem selecionado, mas nada é salvo até você confirmar.</p><button type="button" data-nx19-hide-guide>Entendi</button></aside>`:''}<div class="nx19-section-label"><span>SEU STATUS</span><small>${isNew?'pré-selecionado: Quero Ver':'altere quando quiser'}</small></div><nav class="nx19-status-grid">${Object.entries(STATUS).map(([k,v])=>`<button type="button" class="${draft.status===k?'active':''}" data-nx19-status="${k}"><i>${v.icon}</i><span>${v.label}</span></button>`).join('')}</nav><div class="nx19-context-note"><strong>${STATUS[draft.status].label}.</strong> ${STATUS[draft.status].help}</div>${r.progress?`<section class="nx19-progress"><div><span>EPISÓDIOS</span><strong>${total?`ep. ${p} de ${total}`:`${p} assistido${p===1?'':'s'}`}</strong></div><div class="nx19-stepper"><button type="button" data-nx19-step="-1">${SVG.minus}</button><input type="number" min="0" ${total?`max="${total}"`:''} value="${p}" inputmode="numeric" data-nx19-progress><button type="button" data-nx19-step="1">${SVG.plus}</button></div></section>`:''}<section class="nx19-reactions ${r.reactions?'':'locked'}"><div class="nx19-section-label"><span>${draft.status==='PLANNING'?'SUA EXPECTATIVA':'SUA REAÇÃO'}</span><small>opcional</small></div>${r.reactions?`<div class="nx19-reaction-grid">${reactionHTML()}</div>${(REACTIONS[draft.status]||[]).length>8?`<button type="button" class="nx19-more" data-nx19-more>${showAll?'ver menos':'veja mais reações'}</button>`:''}`:`<div class="nx19-lock-note">${r.note}</div>`}</section><section class="nx19-rating ${r.score?'':'locked'}"><div class="nx19-section-label"><span>${r.scoreLabel}</span><small>opcional</small></div>${r.score?`<div class="nx19-rating-row"><output>${score===''?'–':String(score).replace('.0','')}</output><div><input type="range" min="0" max="10" step="0.5" value="${score===''?0:score}" data-nx19-score><div><span>0</span><span>10</span></div></div></div><button type="button" class="nx19-clear-score" data-nx19-clear-score ${score===''?'disabled':''}>remover nota</button><p>${r.note}</p>`:`<div class="nx19-lock-note">${r.note}</div>`}</section><footer class="nx19-footer"><button type="button" class="ghost" data-nx19-remove ${isNew?'disabled':''}>Remover registro</button><button type="button" class="save" data-nx19-save>Salvar ${STATUS[draft.status].label}</button></footer></section>`;
    }
    function render(){layer.innerHTML=html();bind();syncAllButtons()}
    function bind(){
      layer.querySelectorAll('[data-nx19-close]').forEach(b=>b.onclick=close);
      layer.querySelector('[data-nx19-hide-guide]')?.addEventListener('click',()=>{guide=false;write(GUIDE_KEY,true);render()});
      layer.querySelectorAll('[data-nx19-status]').forEach(b=>b.onclick=()=>{adaptDraft(draft,b.dataset.nx19Status,total);render()});
      layer.querySelectorAll('[data-nx19-reaction]').forEach(b=>b.onclick=()=>{draft.reaction=draft.reaction===b.dataset.nx19Reaction?'':b.dataset.nx19Reaction;render()});
      layer.querySelector('[data-nx19-more]')?.addEventListener('click',()=>{showAll=!showAll;render()});
      const p=layer.querySelector('[data-nx19-progress]');if(p){p.oninput=()=>{draft.progress=Math.max(0,Math.min(total||9999,Number(p.value)||0));const r=rules(draft,total);if(!r.score)draft.score=null;if(!r.reactions&&draft.status!=='PLANNING')draft.reaction='';render()}}
      layer.querySelectorAll('[data-nx19-step]').forEach(b=>b.onclick=()=>{draft.progress=Math.max(0,Math.min(total||9999,(Number(draft.progress)||0)+Number(b.dataset.nx19Step)));const r=rules(draft,total);if(!r.score)draft.score=null;if(!r.reactions&&draft.status!=='PLANNING')draft.reaction='';render()});
      const slider=layer.querySelector('[data-nx19-score]');if(slider)slider.oninput=()=>{draft.score=Number(slider.value);const o=layer.querySelector('.nx19-rating output');if(o)o.textContent=String(draft.score).replace('.0','');layer.querySelector('[data-nx19-clear-score]')?.removeAttribute('disabled')};
      layer.querySelector('[data-nx19-clear-score]')?.addEventListener('click',()=>{draft.score=null;render()});
      layer.querySelector('[data-nx19-remove]')?.addEventListener('click',()=>{put(id,{status:'',progress:0,reaction:'',score:null});close()});
      layer.querySelector('[data-nx19-save]')?.addEventListener('click',()=>{adaptDraft(draft,draft.status,total);put(id,draft);write(GUIDE_KEY,true);close()});
    }
    render();
  }
  function close(){if(openLayer){openLayer.remove();openLayer=null}document.body.classList.remove('nx19-media-open');if(!document.querySelector('.nx18-modal,.search-overlay:not([hidden]),.auth-overlay:not([hidden])'))document.body.classList.remove('modal-open')}

  function syncAllButtons(){if(openLayer)return;syncUI()}
  let raf=0;const scheduleSync=()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;syncUI()})};
  const obs=new MutationObserver(scheduleSync);obs.observe(document.documentElement,{childList:true,subtree:true});

  document.addEventListener('click',e=>{
    if(openLayer)return;
    const statusBtn=e.target.closest('[data-list],[data-nx-list],[data-nx-detail-list],[data-nx18-status],[data-nx17-list]');
    if(statusBtn){const id=idFromStatusButton(statusBtn);if(id){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();open(id);return}}
    const favBtn=e.target.closest('[data-fav],[data-nx-fav],[data-nx-detail-fav],[data-nx18-fav],[data-nx17-fav]');
    if(favBtn){const id=idFromFavButton(favBtn);if(id){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();favorite(id);return}}
  },true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&openLayer){e.preventDefault();close()}},true);
  addEventListener('storage',e=>{if([KEY,FAV_KEY,LIST_KEY,LEGACY_STATUS].includes(e.key))scheduleSync()});

  window.AniNexusMediaState={get,put,favorite,open,sync:syncUI,statuses:STATUS};
  syncUI();
})();
