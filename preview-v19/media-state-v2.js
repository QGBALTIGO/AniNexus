'use strict';
(() => {
  if(window.__NX_MEDIA_STATE_V38__)return;
  window.__NX_MEDIA_STATE_V38__=true;

  let activeEditor=null;
  function createMediaState(reading=false){
  const KEY=reading?'aninexus:mangaState:v2':'aninexus:mediaState:v2';
  const LEGACY_KEY=reading?'aninexus:mangaState:v1':'aninexus:mediaState:v1';
  const FAV_KEY=reading?'aninexus:mangaFavorites':'aninexus:favorites';
  const LIST_KEY=reading?'aninexus:mangaList':'aninexus:list';
  const LEGACY_STATUS=reading?'aninexus:mangaListStatus':'aninexus:listStatus';
  const eventName=kind=>`aninexus:${reading?'manga-':''}${kind}`;
  const API='https://graphql.anilist.co';
  const cache=new Map();
  let layer=null;
  let syncRaf=0;
  const buttonIcons=new WeakMap();

  const SVG={
    plus:'<svg class="nx-media-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    eye:'<svg class="nx-media-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.4-5.5 9-5.5S21 12 21 12s-3.4 5.5-9 5.5S3 12 3 12Z"/><circle cx="12" cy="12" r="2.4"/></svg>',
    play:'<svg class="nx-media-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 9 6-9 6V6Z"/></svg>',
    check:'<svg class="nx-media-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.2 4.2L19 7"/></svg>',
    pause:'<svg class="nx-media-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6v12M16 6v12"/></svg>',
    x:'<svg class="nx-media-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
    heart:'<svg class="nx-media-icon nx-media-heart" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.7 8.7c0 5-8.7 10.1-8.7 10.1S3.3 13.7 3.3 8.7A4.6 4.6 0 0 1 12 6.2a4.6 4.6 0 0 1 8.7 2.5Z"/></svg>',
    minus:'<svg class="nx-media-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>',
    close:'<svg class="nx-media-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>'
  };

  const STATUS={
    PLANNING:{label:'Quero Ver',icon:SVG.eye,color:'planning',title:'Quero ver',help:'Salve para lembrar depois. Você pode trocar este status quando começar a assistir.'},
    CURRENT:{label:'Assistindo',icon:SVG.play,color:'current',title:'Assistindo',help:'Marque até onde chegou. Seu progresso fica salvo junto deste status.'},
    COMPLETED:{label:'Terminei',icon:SVG.check,color:'completed',title:'Terminei',help:'Ao concluir, o progresso vai para o total de episódios e sua nota passa a ser final.'},
    PAUSED:{label:'Pausei',icon:SVG.pause,color:'paused',title:'Pausei',help:'Seu progresso fica preservado para você continuar depois.'},
    DROPPED:{label:'Desisti',icon:SVG.x,color:'dropped',title:'Desisti',help:'O progresso assistido continua registrado, mas o anime sai dos títulos em andamento.'}
  };

  const FEEDBACK={
    PLANNING:{label:'SUA EXPECTATIVA',items:[['👀','Estou curioso'],['🔥','Hype alto'],['🤝','Me indicaram'],['📚','Li o mangá'],['🎬','O trailer me pegou'],['⏳','Contando os dias'],['💖','Já virou prioridade'],['🧠','A premissa me chamou']]},
    CURRENT:{label:'SUA REAÇÃO',items:[['🎣','Viciante'],['👍','Curtindo'],['😍','Amei'],['🤣','Rachei'],['☕','Relaxante'],['🐢','Lento'],['✨','Que animação!'],['🔥','Bombando'],['🎵','Que trilha!'],['😵‍💫','Perdido'],['⚔️','Continuando a saga'],['🤓','Li o mangá']]},
    COMPLETED:{label:'COMO FOI',items:[['🏆','Melhor do ano'],['😍','Amei'],['💎','Joia escondida'],['😭','Chorei'],['🤣','Rachei'],['👻','De arrepiar'],['✨','Que animação!'],['🎵','Que trilha!'],['🔥','Final incrível'],['🫤','Esperava mais'],['🤓','Li o mangá'],['👏','Valeu a jornada']]},
    PAUSED:{label:'POR QUE PAUSOU?',items:[['⏸️','Preciso de uma pausa'],['📅','Sem tempo'],['📦','Juntando episódios'],['🐢','Está lento'],['😵‍💫','Me perdi'],['😮‍💨','Pesado demais'],['🔁','Vou voltar depois'],['📚','Fui pro mangá']]},
    DROPPED:{label:'POR QUE DESISTIU?',items:[['🚪','Não me pegou'],['🫤','Fraco'],['🐢','Lento demais'],['😵‍💫','Confuso'],['📉','Perdeu a graça'],['🙅','Não era pra mim'],['😴','Deu sono'],['😮‍💨','Pesado demais']]}
  };

  const FORMAT={TV:'Série',TV_SHORT:'Série curta',MOVIE:'Filme',OVA:'OVA',ONA:'ONA',SPECIAL:'Especial',MUSIC:'Música'};
  Object.assign(FORMAT,{MANGA:'Mangá',ONE_SHOT:'One-shot',NOVEL:'Light novel'});
  if(reading){
    const book='<svg class="nx-media-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4.5c3.5-.8 6.2-.2 8 1.7v14c-1.8-1.9-4.5-2.5-8-1.7v-14ZM20 4.5c-3.5-.8-6.2-.2-8 1.7v14c1.8-1.9 4.5-2.5 8-1.7v-14Z"/></svg>';
    STATUS.PLANNING={...STATUS.PLANNING,label:'Quero ler',title:'Quero ler',help:'Sua próxima leitura.'};
    STATUS.CURRENT={...STATUS.CURRENT,icon:book,label:'Lendo',title:'Lendo',help:'Seu progresso de leitura.'};
    STATUS.COMPLETED.help='Leitura concluída. Sua nota passa a ser final.';
    STATUS.DROPPED.help='O progresso lido continua registrado.';
    for(const group of Object.values(FEEDBACK))group.items=group.items.map(([emoji,label])=>[emoji,({'Li o mangá':'Vi o anime','O trailer me pegou':'A sinopse me pegou','Que animação!':'Que arte!','Que trilha!':'Que escrita!','Juntando episódios':'Juntando capítulos','Fui pro mangá':'Fui para outra leitura'})[label]||label]);
  }
  const GENRE={Action:'Ação',Adventure:'Aventura',Comedy:'Comédia',Drama:'Drama',Fantasy:'Fantasia',Horror:'Terror',Mystery:'Mistério',Romance:'Romance','Sci-Fi':'Ficção Científica','Slice of Life':'Slice of Life',Sports:'Esportes',Supernatural:'Sobrenatural',Thriller:'Suspense',Music:'Música',Psychological:'Psicológico',Mecha:'Mecha'};

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const read=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v??f}catch{return f}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}};
  const setOf=k=>new Set((read(k,[])||[]).map(Number).filter(Number.isFinite));
  const title=m=>m?.title?.english||m?.title?.userPreferred||m?.title?.romaji||m?.title?.native||(reading?'Mangá':'Anime');
  const cover=m=>m?.coverImage?.extraLarge||m?.coverImage?.large||'';
  const validId=id=>{const n=Number(id);return Number.isSafeInteger(n)&&n>0?n:0};

  function normalize(s={}){
    const raw=s?.score;
    const score=raw===null||raw===undefined||raw===''?null:(Number.isFinite(Number(raw))?Number(raw):null);
    const reactions=[...new Set((Array.isArray(s.reactions)?s.reactions:s.reaction?[s.reaction]:[]).filter(x=>typeof x==='string'))].slice(0,32);
    return {status:STATUS[s?.status]?s.status:'',progress:Math.min(100000,Math.max(0,Math.floor(Number(s?.progress)||0))),volumeProgress:Math.min(100000,Math.max(0,Math.floor(Number(s?.volumeProgress)||0))),reaction:reactions[0]||'',reactions,score:score===null?null:Math.min(10,Math.max(0,score)),updatedAt:Number(s?.updatedAt)||0};
  }

  function migrate(){
    const current=read(KEY,null);
    if(current&&typeof current==='object')return;
    const old=read(LEGACY_KEY,{});
    if(old&&typeof old==='object')write(KEY,old);
  }
  migrate();

  function all(){const v=read(KEY,{});return v&&typeof v==='object'?v:{}}
  function get(id){
    const n=validId(id);if(!n)return normalize({});
    const a=all();if(a[n])return normalize(a[n]);
    const old=read(LEGACY_KEY,{});if(old?.[n])return normalize(old[n]);
    const statuses=read(LEGACY_STATUS,{}),listed=setOf(LIST_KEY),st=statuses?.[n]||'';
    return st||listed.has(n)?normalize({status:st||'PLANNING'}):normalize({});
  }
  function isFavorite(id){const n=validId(id);return!!n&&setOf(FAV_KEY).has(n)}

  function sanitizeForSave(d,total){
    const s=normalize(d);if(!s.status)return normalize({});
    if(s.status==='PLANNING'){s.progress=0;s.volumeProgress=0;s.score=null}
    if(s.status==='COMPLETED'&&total>0)s.progress=total;
    if((s.status==='CURRENT'||s.status==='PAUSED'||s.status==='DROPPED')&&s.progress<1&&s.volumeProgress<1)s.score=null;
    s.reactions=s.reactions.filter(value=>(FEEDBACK[s.status]?.items||[]).some(([,label])=>label===value));s.reaction=s.reactions[0]||'';
    return s;
  }

  function persistState(id,d,total=0){
    const n=validId(id);if(!n)return normalize({});
    const next=sanitizeForSave(d,total),a=all();
    if(!next.status)delete a[n];else a[n]={...next,updatedAt:Date.now()};
    write(KEY,a);write(LEGACY_KEY,a);
    const statuses=read(LEGACY_STATUS,{}),listed=setOf(LIST_KEY);
    if(next.status){statuses[n]=next.status;listed.add(n)}else{delete statuses[n];listed.delete(n)}
    write(LEGACY_STATUS,statuses);write(LIST_KEY,[...listed]);
    syncUI(n);
    document.dispatchEvent(new CustomEvent(eventName('media-state-changed'),{detail:{id:n,mediaType:reading?'MANGA':'ANIME',state:{...next,updatedAt:Date.now()}}}));
    return next;
  }

  function favorite(id,value){
    const n=validId(id);if(!n)return false;
    const set=setOf(FAV_KEY),on=typeof value==='boolean'?value:!set.has(n);
    if(on)set.add(n);else set.delete(n);
    write(FAV_KEY,[...set].sort((a,b)=>a-b));
    syncFav(n);
    document.dispatchEvent(new CustomEvent(eventName('favorite-changed'),{detail:{id:n,mediaType:reading?'MANGA':'ANIME',favorite:on}}));
    return on;
  }

  function statusSelector(id){return reading?`[data-manga-list="${id}"]`:`[data-list="${id}"],[data-nx-list="${id}"],[data-nx-detail-list="${id}"],[data-nx18-status="${id}"],[data-nx17-list="${id}"]`}
  function favSelector(id){return reading?`[data-manga-fav="${id}"]`:`[data-fav="${id}"],[data-nx-fav="${id}"],[data-nx-detail-fav="${id}"],[data-nx18-fav="${id}"],[data-nx17-fav="${id}"]`}
  function idStatus(b){return validId(reading?b?.dataset?.mangaList:b?.dataset?.list||b?.dataset?.nxList||b?.dataset?.nxDetailList||b?.dataset?.nx18Status||b?.dataset?.nx17List)}
  function idFav(b){return validId(reading?b?.dataset?.mangaFav:b?.dataset?.fav||b?.dataset?.nxFav||b?.dataset?.nxDetailFav||b?.dataset?.nx18Fav||b?.dataset?.nx17Fav)}
  function iconFor(st){return STATUS[st]?.icon||SVG.plus}

  function setButtonIcon(button,markup,label){
    if(!button)return;
    const key=markup+'|'+label;if(buttonIcons.get(button)===key&&button.querySelector('svg'))return;
    buttonIcons.set(button,key);
    const labeled=button.dataset.nxActionKind==='labeled'||button.matches('[data-nx-detail-list],[data-nx-detail-fav]')||button.querySelector(':scope > span');
    if(labeled){
      button.querySelectorAll(':scope > svg').forEach(x=>x.remove());
      button.insertAdjacentHTML('afterbegin',markup);
      const span=button.querySelector(':scope > span');if(span&&label)span.textContent=label;
    }else button.innerHTML=markup;
  }

  function syncStatus(id){
    const n=validId(id);if(!n)return;
    const state=get(n),has=!!state.status,meta=STATUS[state.status],label=meta?.label||'Adicionar à lista';
    document.querySelectorAll(statusSelector(n)).forEach(button=>{
      button.classList.toggle('active',has);
      for(const key of Object.keys(STATUS))button.classList.toggle(`status-${key.toLowerCase()}`,state.status===key);
      button.dataset.nxUnifiedStatus=state.status||'';
      button.setAttribute('aria-pressed',String(has));
      button.setAttribute('aria-label',has?`${label}. Clique para alterar`:'Adicionar à lista');
      button.title=has?`${label} · alterar`:'Adicionar à lista';
      setButtonIcon(button,iconFor(state.status),label);
    });
  }

  function syncFav(id){
    const n=validId(id);if(!n)return;
    const on=isFavorite(n);
    document.querySelectorAll(favSelector(n)).forEach(button=>{
      button.classList.toggle('active',on);
      button.dataset.nxFavorite=on?'1':'0';
      button.setAttribute('aria-pressed',String(on));
      button.setAttribute('aria-label',on?'Remover dos favoritos':'Adicionar aos favoritos');
      button.title=on?'Remover dos favoritos':'Adicionar aos favoritos';
      setButtonIcon(button,SVG.heart,on?'Favoritado':'Favoritar');
    });
  }

  function syncUI(id){
    const n=validId(id);
    if(n){syncStatus(n);syncFav(n);return}
    const ids=new Set();
    document.querySelectorAll(selector).forEach(el=>{
      const a=idStatus(el),b=idFav(el);if(a)ids.add(a);if(b)ids.add(b);
    });
    ids.forEach(x=>{syncStatus(x);syncFav(x)});
  }

  function seedFromDom(id){
    const root=reading?document.querySelector(`[data-manga-open="${id}"],[data-open-manga="${id}"],[data-open="${id}"][data-type="manga"],.detail-hero`):document.querySelector(`[data-nx18-open="${id}"],[data-nx-media="${id}"]:not([data-kind="manga"]),[data-open="${id}"]:not([data-type="manga"]),[data-open-anime="${id}"],.nx22-detail`);
    if(!root)return null;
    return {id:Number(id),title:{userPreferred:root.querySelector('h3,h2,h1,strong')?.textContent?.trim()||(reading?'Mangá':'Anime')},coverImage:{large:root.querySelector('img')?.src||''},genres:[],episodes:null,format:reading?'MANGA':'TV',seasonYear:null};
  }

  async function media(id){
    const n=validId(id);if(!n)return null;
    if(cache.has(n)&&cache.get(n)?.__full)return cache.get(n);
    const seed=cache.get(n)||seedFromDom(n);if(seed&&!cache.has(n))cache.set(n,seed);
    const q=`query($id:Int){Media(id:$id,type:${reading?'MANGA':'ANIME'}){id title{romaji english native userPreferred} coverImage{extraLarge large} genres episodes chapters volumes format seasonYear}}`;
    try{
      const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({query:q,variables:{id:n}})});
      if(r.ok){const j=await r.json(),m=j?.data?.Media;if(m){const full={...m,__full:true};cache.set(n,full);return full}}
    }catch{}
    return cache.get(n)||{id:n,title:{userPreferred:reading?'Mangá':'Anime'},coverImage:{},genres:[],episodes:null,format:reading?'MANGA':'TV',seasonYear:null};
  }

  function rules(d,total){
    if(!d.status)return{progress:false,feedback:false,score:false};
    const p=Math.max(0,Number(d.progress)||0,Number(d.volumeProgress)||0);
    if(d.status==='PLANNING')return{progress:false,feedback:true,score:false};
    if(d.status==='COMPLETED')return{progress:total>0,feedback:true,score:true};
    if(d.status==='CURRENT'||d.status==='PAUSED')return{progress:true,feedback:p>0,score:p>0};
    if(d.status==='DROPPED')return{progress:true,feedback:true,score:p>0};
    return{progress:false,feedback:false,score:false};
  }

  function adapt(d,status,total){
    d.status=status;
    if(status==='PLANNING'){d.progress=0;d.volumeProgress=0;d.score=null}
    if(status==='COMPLETED'&&total>0)d.progress=total;
    d.reactions=(d.reactions||[]).filter(value=>(FEEDBACK[status]?.items||[]).some(([,label])=>label===value));d.reaction=d.reactions[0]||'';
    const r=rules(d,total);if(!r.score)d.score=null;
    return d;
  }

  function close(){
    layer?.remove();layer=null;
    document.body.classList.remove('nx20-media-open');
    if(!document.querySelector('.nx18-modal,.search-overlay:not([hidden]),.auth-overlay:not([hidden])'))document.body.classList.remove('modal-open');
  }

  async function open(id){
    const n=validId(id);if(!n)return;
    activeEditor?.();activeEditor=close;
    const trigger=document.activeElement;
    const seed=cache.get(n)||seedFromDom(n)||{id:n,title:{userPreferred:reading?'Mangá':'Anime'},coverImage:{}};
    let m=seed,total=0,volumeTotal=0,showAll=false,editing=false,pointerButton=null;
    const d=normalize(get(n)),hadSavedState=!!d.status;
    const updateTotals=()=>{total=Math.max(0,Number(reading?(m.format==='NOVEL'?0:m.chapters||(m.format==='ONE_SHOT'?1:0)):m.episodes)||0);volumeTotal=Math.max(0,Number(m.volumes)||0)};
    updateTotals();
    layer=document.createElement('div');layer.className='nx20-media-layer';layer.dataset.mediaType=reading?'MANGA':'ANIME';
    document.body.append(layer);document.body.classList.add('modal-open','nx20-media-open');
    const ownedLayer=layer;
    const finish=()=>{close();if(trigger?.isConnected)trigger.focus({preventScroll:true})};
    activeEditor=finish;
    ownedLayer.addEventListener('pointerdown',event=>{editing=true;pointerButton=event.target.closest('button')},true);
    ownedLayer.addEventListener('pointerup',()=>setTimeout(()=>{pointerButton=null},0),true);
    ownedLayer.addEventListener('pointercancel',()=>{pointerButton=null},true);
    ownedLayer.addEventListener('keydown',event=>{
      editing=true;
      if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();finish();return}
      if(event.key!=='Tab')return;
      const controls=[...ownedLayer.querySelectorAll('.nx20-modal button:not(:disabled),.nx20-modal input')].filter(x=>x.getClientRects().length);
      const first=controls[0],last=controls.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
    });
    function clampProgress(){
      d.progress=Math.min(total||100000,Math.max(0,Math.floor(Number(d.progress)||0)));
      d.volumeProgress=Math.min(volumeTotal||100000,Math.max(0,Math.floor(Number(d.volumeProgress)||0)));
      if(d.status==='COMPLETED'){if(total)d.progress=total;if(reading&&volumeTotal)d.volumeProgress=volumeTotal}
      if(!rules(d,total).score)d.score=null;
    }
    function progressHTML(field,label,maximum){
      const value=d[field]||0;
      return `<section class="nx20-progress"><div><span>${label}</span><strong>${value}${maximum?' de '+maximum:''}</strong></div><div class="nx20-stepper"><button type="button" data-nx20-step="-1" data-progress-field="${field}" aria-label="Diminuir ${label.toLowerCase()}" ${value===0?'disabled':''}>${SVG.minus}</button><input type="number" min="0" max="${maximum||100000}" value="${value}" aria-label="${label}" inputmode="numeric" data-nx20-progress data-progress-field="${field}"><button type="button" data-nx20-step="1" data-progress-field="${field}" aria-label="Aumentar ${label.toLowerCase()}" ${maximum&&value>=maximum?'disabled':''}>${SVG.plus}</button></div></section>`;
    }
    function render(focusSelector){
      if(layer!==ownedLayer)return;
      const scroll=ownedLayer.querySelector('.nx20-modal')?.scrollTop||0;
      clampProgress();
      const r=rules(d,total),feedback=FEEDBACK[d.status],score=d.score;
      const novel=reading&&m.format==='NOVEL';
      const meta=[m.seasonYear,FORMAT[m.format]||m.format,(m.genres||[]).slice(0,3).map(g=>GENRE[g]||g).join(', ')].filter(Boolean).join(' · ');
      const reactions=feedback?.items.map(([emoji,label],i)=>`<button type="button" class="nx20-reaction ${d.reactions.includes(label)?'active':''} ${i>=8&&!showAll?'extra':''}" data-nx20-reaction="${esc(label)}" aria-pressed="${d.reactions.includes(label)}"><span aria-hidden="true">${emoji}</span>${esc(label)}</button>`).join('')||'';
      ownedLayer.innerHTML=`<button type="button" class="nx20-backdrop" data-nx20-close aria-label="Fechar"></button><section class="nx20-modal" role="dialog" aria-modal="true" aria-labelledby="nx20Title"><button type="button" class="nx20-close" data-nx20-close aria-label="Fechar">${SVG.close}</button><header class="nx20-head">${cover(m)?`<img src="${esc(cover(m))}" alt="">`:''}<div><small>${reading?'MINHA LEITURA':'MEU ACOMPANHAMENTO'}</small><h2 id="nx20Title">${esc(title(m))}</h2><p>${esc(meta)}</p></div></header><div class="nx20-label"><span>SEU STATUS</span></div><nav class="nx20-statuses" aria-label="Status"><!-- statuses -->${Object.entries(STATUS).map(([key,value])=>`<button type="button" class="${d.status===key?'active':''}" data-nx20-status="${key}" data-tone="${value.color}" aria-pressed="${d.status===key}"><i>${value.icon}</i><span>${value.label}</span></button>`).join('')}</nav>
      ${d.status&&d.status!=='PLANNING'?`${!novel?progressHTML('progress',reading?'Capítulos lidos':'Episódios assistidos',total):''}${reading?progressHTML('volumeProgress','Volumes lidos',volumeTotal):''}`:''}
      ${d.status?`<section class="nx20-feedback"><div class="nx20-label"><span>${feedback.label}</span><small>opcional</small></div>${r.feedback?`<div class="nx20-reactions">${reactions}</div>${feedback.items.length>8?`<button type="button" class="nx20-more" data-nx20-more aria-expanded="${showAll}">${showAll?'Ver menos':'Ver mais'}</button>`:''}`:`<p class="nx20-locked">Disponível após o primeiro ${reading?novel?'volume':'capítulo':'episódio'}.</p>`}</section>`:''}
      ${d.status&&d.status!=='PLANNING'?`<section class="nx20-rating"><div class="nx20-label"><span>${d.status==='COMPLETED'?'SUA NOTA FINAL':'SUA NOTA PARCIAL'}</span><small>opcional</small></div>${r.score?`<div class="nx20-rating-row"><output>${score==null?'—':score.toFixed(1)}</output><div><input type="range" aria-label="Sua nota" min="0" max="10" step="0.5" value="${score??0}" data-nx20-score><div><span>0</span><span>10</span></div></div></div>${score!=null?'<button type="button" class="nx20-clear-score" data-nx20-clear-score>Remover nota</button>':''}`:`<p class="nx20-locked">Ainda sem progresso ${reading?'de leitura':'assistido'}.</p>`}</section>`:''}
      <footer class="nx20-footer"><button type="button" class="ghost" data-nx20-remove ${hadSavedState?'':'disabled'}>Remover da lista</button><button type="button" class="save" data-nx20-save ${d.status?'':'disabled'}>Salvar</button></footer></section>`;
      ownedLayer.querySelectorAll('[data-nx20-close]').forEach(b=>b.onclick=finish);
      ownedLayer.querySelectorAll('[data-nx20-status]').forEach(b=>b.onclick=()=>{adapt(d,b.dataset.nx20Status,total);render(`[data-nx20-status="${d.status}"]`)});
      ownedLayer.querySelectorAll('[data-nx20-reaction]').forEach(b=>b.onclick=()=>{const value=b.dataset.nx20Reaction;d.reactions=d.reactions.includes(value)?d.reactions.filter(x=>x!==value):[...d.reactions,value];d.reaction=d.reactions[0]||'';render(`[data-nx20-reaction="${CSS.escape(value)}"]`)});
      ownedLayer.querySelector('[data-nx20-more]')?.addEventListener('click',()=>{showAll=!showAll;render('[data-nx20-more]')});
      ownedLayer.querySelectorAll('[data-nx20-progress]').forEach(input=>{
        input.oninput=()=>{d[input.dataset.progressField]=Math.floor(Number(input.value)||0)};
        input.onchange=()=>{if(!pointerButton)render(`input[data-progress-field="${input.dataset.progressField}"]`)};
      });
      ownedLayer.querySelectorAll('[data-nx20-step]').forEach(b=>b.onclick=()=>{const field=b.dataset.progressField;d[field]=(Number(d[field])||0)+Number(b.dataset.nx20Step);render(`[data-nx20-step="${b.dataset.nx20Step}"][data-progress-field="${field}"]`)});
      const slider=ownedLayer.querySelector('[data-nx20-score]');
      if(slider){slider.oninput=()=>{d.score=Number(slider.value);ownedLayer.querySelector('output').textContent=d.score.toFixed(1)};slider.onchange=()=>{if(!pointerButton)render('[data-nx20-score]')}}
      ownedLayer.querySelector('[data-nx20-clear-score]')?.addEventListener('click',()=>{d.score=null;render('[data-nx20-score]')});
      ownedLayer.querySelector('[data-nx20-remove]').onclick=()=>{persistState(n,{},total);finish()};
      ownedLayer.querySelector('[data-nx20-save]').onclick=()=>{if(!d.status)return;clampProgress();persistState(n,d,total);finish()};
      ownedLayer.querySelector('.nx20-modal').scrollTop=scroll;
      if(focusSelector)ownedLayer.querySelector(focusSelector)?.focus({preventScroll:true});
    }
    render();ownedLayer.querySelector('.nx20-close').focus({preventScroll:true});
    void media(n).then(fresh=>{if(!fresh||layer!==ownedLayer)return;m=fresh;updateTotals();if(!editing)render()});
  }
  function scheduleSync(){if(syncRaf)return;syncRaf=requestAnimationFrame(()=>{syncRaf=0;syncUI()})}
  const selector=reading?'[data-manga-list],[data-manga-fav]':'[data-list],[data-nx-list],[data-nx-detail-list],[data-nx18-status],[data-nx17-list],[data-fav],[data-nx-fav],[data-nx-detail-fav],[data-nx18-fav],[data-nx17-fav]';
  const observer=new MutationObserver(records=>{for(const r of records)for(const node of r.addedNodes)if(node.nodeType===1&&(node.matches?.(selector)||node.querySelector?.(selector))){scheduleSync();return}});
  if(document.body)observer.observe(document.body,{childList:true,subtree:true});else document.addEventListener('DOMContentLoaded',()=>observer.observe(document.body,{childList:true,subtree:true}),{once:true});

  /* Interaction is intentionally NOT bound here. preview-v39/media-actions-v39.js is the only click owner. */
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&layer){event.preventDefault();activeEditor?.()}},true);
  addEventListener('storage',event=>{if([KEY,LEGACY_KEY,FAV_KEY,LIST_KEY,LEGACY_STATUS].includes(event.key))scheduleSync()});

  const instance={get,put:persistState,favorite,isFavorite,open,close,sync:syncUI,statuses:STATUS,entries:all,favorites:()=>setOf(FAV_KEY)};
  if(reading)window.AniNexusMangaState=instance;else window.AniNexusMediaState=instance;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>syncUI(),{once:true});else syncUI();
  }
  createMediaState();createMediaState(true);
})();
