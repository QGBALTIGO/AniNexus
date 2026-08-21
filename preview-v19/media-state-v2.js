'use strict';
(() => {
  const KEY='aninexus:mediaState:v2';
  const LEGACY_KEY='aninexus:mediaState:v1';
  const FAV_KEY='aninexus:favorites';
  const LIST_KEY='aninexus:list';
  const LEGACY_STATUS='aninexus:listStatus';
  const API='https://graphql.anilist.co';
  const cache=new Map();
  let layer=null;
  let syncRaf=0;

  const SVG={
    plus:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    play:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 9 6-9 6V6Z"/></svg>',
    check:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.2 4.2L19 7"/></svg>',
    pause:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6v12M16 6v12"/></svg>',
    x:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
    heart:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.7 8.7c0 5-8.7 10.1-8.7 10.1S3.3 13.7 3.3 8.7A4.6 4.6 0 0 1 12 6.2a4.6 4.6 0 0 1 8.7 2.5Z"/></svg>',
    minus:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>',
    close:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>'
  };

  const STATUS={
    PLANNING:{label:'Quero Ver',icon:SVG.plus,color:'planning',title:'Quero ver',help:'Salve para lembrar depois. Aqui você registra expectativa, não uma avaliação de algo que ainda não viu.'},
    CURRENT:{label:'Assistindo',icon:SVG.play,color:'current',title:'Assistindo',help:'Marque até onde chegou. Reações e nota parcial aparecem depois do primeiro episódio assistido.'},
    COMPLETED:{label:'Terminei',icon:SVG.check,color:'completed',title:'Terminei',help:'Ao concluir, o progresso vai para o total de episódios e a nota passa a ser final.'},
    PAUSED:{label:'Pausei',icon:SVG.pause,color:'paused',title:'Pausei',help:'Seu progresso fica preservado. Você pode registrar por que pausou e avaliar apenas o que já assistiu.'},
    DROPPED:{label:'Desisti',icon:SVG.x,color:'dropped',title:'Desisti',help:'Registre por que desistiu. A nota só fica disponível se você realmente assistiu algum episódio.'}
  };

  const FEEDBACK={
    PLANNING:{label:'SUA EXPECTATIVA',items:[['👀','Estou curioso'],['🔥','Hype alto'],['🤝','Me indicaram'],['📚','Li o mangá'],['🎬','O trailer me pegou'],['⏳','Contando os dias'],['💖','Já virou prioridade'],['🧠','A premissa me chamou']]},
    CURRENT:{label:'SUA REAÇÃO',items:[['🎣','Viciante'],['👍','Curtindo'],['😍','Amei'],['🤣','Rachei'],['☕','Relaxante'],['🐢','Lento'],['✨','Que animação!'],['🔥','Bombando'],['🎵','Que trilha!'],['😵‍💫','Perdido'],['⚔️','Continuando a saga'],['🤓','Li o mangá']]},
    COMPLETED:{label:'COMO FOI',items:[['🏆','Melhor do ano'],['😍','Amei'],['💎','Joia escondida'],['😭','Chorei'],['🤣','Rachei'],['👻','De arrepiar'],['✨','Que animação!'],['🎵','Que trilha!'],['🔥','Final incrível'],['🫤','Esperava mais'],['🤓','Li o mangá'],['👏','Valeu a jornada']]},
    PAUSED:{label:'POR QUE PAUSOU?',items:[['⏸️','Preciso de uma pausa'],['📅','Sem tempo'],['📦','Juntando episódios'],['🐢','Está lento'],['😵‍💫','Me perdi'],['😮‍💨','Pesado demais'],['🔁','Vou voltar depois'],['📚','Fui pro mangá']]},
    DROPPED:{label:'POR QUE DESISTIU?',items:[['🚪','Não me pegou'],['🫤','Fraco'],['🐢','Lento demais'],['😵‍💫','Confuso'],['📉','Perdeu a graça'],['🙅','Não era pra mim'],['😴','Deu sono'],['😮‍💨','Pesado demais']]}
  };

  const FORMAT={TV:'Série',TV_SHORT:'Série curta',MOVIE:'Filme',OVA:'OVA',ONA:'ONA',SPECIAL:'Especial',MUSIC:'Música'};
  const GENRE={Action:'Ação',Adventure:'Aventura',Comedy:'Comédia',Drama:'Drama',Fantasy:'Fantasia',Horror:'Terror',Mystery:'Mistério',Romance:'Romance','Sci-Fi':'Ficção Científica','Slice of Life':'Slice of Life',Sports:'Esportes',Supernatural:'Sobrenatural',Thriller:'Suspense',Music:'Música',Psychological:'Psicológico',Mecha:'Mecha'};

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const read=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v??f}catch{return f}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
  const setOf=k=>new Set((read(k,[])||[]).map(Number));
  const title=m=>m?.title?.english||m?.title?.userPreferred||m?.title?.romaji||m?.title?.native||'Anime';
  const cover=m=>m?.coverImage?.extraLarge||m?.coverImage?.large||'';

  function normalize(s={}){
    const raw=s?.score;
    const score=raw===null||raw===undefined||raw===''?null:(Number.isFinite(Number(raw))?Number(raw):null);
    return {status:s?.status||'',progress:Math.max(0,Number(s?.progress)||0),reaction:String(s?.reaction||''),score,updatedAt:Number(s?.updatedAt)||0};
  }
  function migrate(){const current=read(KEY,null);if(current&&typeof current==='object')return;const old=read(LEGACY_KEY,{});if(old&&typeof old==='object')write(KEY,old)}
  migrate();
  function all(){const v=read(KEY,{});return v&&typeof v==='object'?v:{}}
  function get(id){const n=Number(id),a=all();if(a[n])return normalize(a[n]);const old=read(LEGACY_KEY,{});if(old?.[n])return normalize(old[n]);const statuses=read(LEGACY_STATUS,{}),listed=setOf(LIST_KEY),st=statuses?.[n]||'';return st||listed.has(n)?normalize({status:st||'PLANNING'}):normalize({})}
  function sanitizeForSave(d,total){const s=normalize(d);if(!STATUS[s.status])return normalize({});if(s.status==='PLANNING'){s.progress=0;s.score=null}if(s.status==='COMPLETED'&&total>0)s.progress=total;if((s.status==='CURRENT'||s.status==='PAUSED'||s.status==='DROPPED')&&s.progress<1)s.score=null;const allowed=(FEEDBACK[s.status]?.items||[]).some(([,label])=>label===s.reaction);if(!allowed)s.reaction='';return s}
  function put(id,d,total=0){const n=Number(id),next=sanitizeForSave(d,total),a=all();if(!next.status)delete a[n];else a[n]={...next,updatedAt:Date.now()};write(KEY,a);write(LEGACY_KEY,a);const statuses=read(LEGACY_STATUS,{}),listed=setOf(LIST_KEY);if(next.status){statuses[n]=next.status;listed.add(n)}else{delete statuses[n];listed.delete(n)}write(LEGACY_STATUS,statuses);write(LIST_KEY,[...listed]);syncUI(n);document.dispatchEvent(new CustomEvent('aninexus:media-state-changed',{detail:{id:n,state:next}}));return next}
  function favorite(id,value){const n=Number(id),s=setOf(FAV_KEY),on=typeof value==='boolean'?value:!s.has(n);on?s.add(n):s.delete(n);write(FAV_KEY,[...s]);syncFav(n);document.dispatchEvent(new CustomEvent('aninexus:favorite-changed',{detail:{id:n,favorite:on}}));return on}

  function statusSelector(id){return `[data-list="${id}"],[data-nx-list="${id}"],[data-nx-detail-list="${id}"],[data-nx18-status="${id}"],[data-nx17-list="${id}"]`}
  function favSelector(id){return `[data-fav="${id}"],[data-nx-fav="${id}"],[data-nx-detail-fav="${id}"],[data-nx18-fav="${id}"],[data-nx17-fav="${id}"]`}
  function idStatus(b){return Number(b.dataset.list||b.dataset.nxList||b.dataset.nxDetailList||b.dataset.nx18Status||b.dataset.nx17List||0)}
  function idFav(b){return Number(b.dataset.fav||b.dataset.nxFav||b.dataset.nxDetailFav||b.dataset.nx18Fav||b.dataset.nx17Fav||0)}
  function iconFor(st){return STATUS[st]?.icon||SVG.plus}
  function syncStatus(id){const s=get(id),has=!!s.status,label=STATUS[s.status]?.label||'Adicionar à lista';document.querySelectorAll(statusSelector(id)).forEach(b=>{b.classList.toggle('active',has);b.dataset.nxUnifiedStatus=s.status||'';b.setAttribute('aria-pressed',String(has));b.setAttribute('aria-label',has?`Status: ${label}`:'Adicionar à lista');b.title=has?label:'Adicionar à lista';if(b.matches('.nx-detail-actions .primary,.detail-actions .btn,[data-nx-detail-list]')){const span=b.querySelector('span');b.querySelector('svg')?.remove();b.insertAdjacentHTML('afterbegin',iconFor(s.status));if(span)span.textContent=label}else b.innerHTML=iconFor(s.status)})}
  function syncFav(id){const on=setOf(FAV_KEY).has(Number(id));document.querySelectorAll(favSelector(id)).forEach(b=>{b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));b.setAttribute('aria-label',on?'Remover dos favoritos':'Favoritar');b.title=on?'Remover dos favoritos':'Favoritar';if(!b.querySelector('svg'))b.innerHTML=SVG.heart})}
  function syncUI(id){if(Number.isFinite(Number(id))){syncStatus(Number(id));syncFav(Number(id));return}const ids=new Set();document.querySelectorAll('[data-list],[data-nx-list],[data-nx-detail-list],[data-nx18-status],[data-nx17-list],[data-fav],[data-nx-fav],[data-nx-detail-fav],[data-nx18-fav],[data-nx17-fav]').forEach(el=>{['list','nxList','nxDetailList','nx18Status','nx17List','fav','nxFav','nxDetailFav','nx18Fav','nx17Fav'].forEach(k=>{if(el.dataset[k])ids.add(Number(el.dataset[k]))})});ids.forEach(n=>{syncStatus(n);syncFav(n)})}

  function seedFromDom(id){const root=document.querySelector(`[data-nx18-open="${id}"],[data-nx-media="${id}"],[data-open="${id}"],.nx-detail`);if(!root)return null;return {id:Number(id),title:{userPreferred:root.querySelector('h3,h2,h1,strong')?.textContent?.trim()||'Anime'},coverImage:{large:root.querySelector('img')?.src||''},genres:[],episodes:null,format:'TV',seasonYear:null}}
  async function media(id){const n=Number(id);if(cache.has(n))return cache.get(n);const seed=seedFromDom(n);if(seed)cache.set(n,seed);const q=`query($id:Int){Media(id:$id,type:ANIME){id title{romaji english native userPreferred} coverImage{extraLarge large} genres episodes format seasonYear}}`;try{const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({query:q,variables:{id:n}})});if(r.ok){const j=await r.json(),m=j?.data?.Media;if(m){cache.set(n,m);return m}}}catch{}return cache.get(n)||{id:n,title:{userPreferred:'Anime'},coverImage:{},genres:[],episodes:null,format:'TV',seasonYear:null}}

  function rules(d,total){if(!d.status)return{progress:false,feedback:false,score:false};const p=Math.max(0,Number(d.progress)||0);if(d.status==='PLANNING')return{progress:false,feedback:true,score:false};if(d.status==='COMPLETED')return{progress:total>0,feedback:true,score:true};if(d.status==='CURRENT')return{progress:true,feedback:p>0,score:p>0};if(d.status==='PAUSED')return{progress:true,feedback:p>0,score:p>0};if(d.status==='DROPPED')return{progress:true,feedback:true,score:p>0};return{progress:false,feedback:false,score:false}}
  function adapt(d,status,total){d.status=status;if(status==='PLANNING'){d.progress=0;d.score=null}if(status==='COMPLETED'&&total>0)d.progress=total;if(!(FEEDBACK[status]?.items||[]).some(([,label])=>label===d.reaction))d.reaction='';const r=rules(d,total);if(!r.score)d.score=null;return d}
  function close(){layer?.remove();layer=null;document.body.classList.remove('nx20-media-open');if(!document.querySelector('.nx18-modal,.search-overlay:not([hidden]),.auth-overlay:not([hidden])'))document.body.classList.remove('modal-open')}
  async function open(id){close();document.querySelector('.nx18-tracker-layer')?.remove();const m=await media(id),existing=get(id),isNew=!existing.status,d={...existing};const total=Math.max(0,Number(m.episodes)||0);if(d.status==='COMPLETED'&&total)d.progress=total;let showAll=false;layer=document.createElement('div');layer.className='nx20-media-layer';document.body.append(layer);document.body.classList.add('modal-open','nx20-media-open');
    function feedbackHTML(){const x=FEEDBACK[d.status];if(!x)return'';return x.items.map(([emoji,label],i)=>`<button type="button" class="nx20-reaction ${d.reaction===label?'active':''} ${i>=8&&!showAll?'extra':''}" data-nx20-reaction="${esc(label)}"><span>${emoji}</span>${esc(label)}</button>`).join('')}
    function html(){const r=rules(d,total),p=Math.min(total||9999,Math.max(0,Number(d.progress)||0)),meta=[m.seasonYear,FORMAT[m.format]||m.format,(m.genres||[]).slice(0,3).map(g=>GENRE[g]||g).join(', ')].filter(Boolean).join(' · '),score=d.score==null?'':Number(d.score),noStatus=!d.status;return `<button class="nx20-backdrop" data-nx20-close aria-label="Fechar"></button><section class="nx20-modal" role="dialog" aria-modal="true" aria-labelledby="nx20Title"><button class="nx20-close" data-nx20-close aria-label="Fechar">${SVG.close}</button><header class="nx20-head"><img src="${esc(cover(m))}" alt=""><div><small>${isNew?'ADICIONAR À MINHA LISTA':'MEU ACOMPANHAMENTO'}</small><h2 id="nx20Title">${esc(title(m))}</h2><p>${esc(meta)}</p></div></header><div class="nx20-label"><span>SEU STATUS</span><small>${noStatus?'escolha uma opção':'você pode alterar quando quiser'}</small></div><nav class="nx20-statuses">${Object.entries(STATUS).map(([k,v])=>`<button type="button" class="${d.status===k?'active':''}" data-nx20-status="${k}" data-tone="${v.color}"><i>${v.icon}</i><span>${v.label}</span></button>`).join('')}</nav>${noStatus?`<section class="nx20-empty-state"><strong>Como você está com este anime?</strong><p>Nada é marcado automaticamente. Escolha um status para o AniNexus mostrar apenas as opções que fazem sentido para esse momento.</p></section>`:`<section class="nx20-context" data-tone="${STATUS[d.status].color}"><strong>${STATUS[d.status].title}</strong><p>${STATUS[d.status].help}</p></section>`}${r.progress?`<section class="nx20-progress"><div><span>EPISÓDIOS</span><strong>${total?`ep. ${p} de ${total}`:`${p} assistido${p===1?'':'s'}`}</strong></div><div class="nx20-stepper"><button type="button" data-nx20-step="-1">${SVG.minus}</button><input type="number" min="0" ${total?`max="${total}"`:''} value="${p}" inputmode="numeric" data-nx20-progress><button type="button" data-nx20-step="1">${SVG.plus}</button></div></section>`:''}${d.status?`<section class="nx20-feedback ${r.feedback?'':'locked'}"><div class="nx20-label"><span>${FEEDBACK[d.status]?.label||'SUA REAÇÃO'}</span><small>opcional</small></div>${r.feedback?`<div class="nx20-reactions">${feedbackHTML()}</div>${(FEEDBACK[d.status]?.items||[]).length>8?`<button type="button" class="nx20-more" data-nx20-more>${showAll?'ver menos':'ver mais'}</button>`:''}`:`<div class="nx20-locked">Marque pelo menos 1 episódio assistido para liberar esta parte.</div>`}</section>`:''}${d.status&&d.status!=='PLANNING'?`<section class="nx20-rating ${r.score?'':'locked'}"><div class="nx20-label"><span>${d.status==='COMPLETED'?'SUA NOTA FINAL':d.status==='DROPPED'?'SUA NOTA ATÉ AQUI':'SUA NOTA PARCIAL'}</span><small>opcional</small></div>${r.score?`<div class="nx20-rating-row"><output>${score===''?'–':String(score).replace('.0','')}</output><div><input type="range" min="0" max="10" step="0.5" value="${score===''?0:score}" data-nx20-score><div><span>0</span><span>10</span></div></div></div>${score!==''?'<button type="button" class="nx20-clear-score" data-nx20-clear-score>remover nota</button>':''}`:`<div class="nx20-locked">A nota só é liberada depois que houver algo assistido.</div>`}</section>`:''}<footer class="nx20-footer"><button type="button" class="ghost" data-nx20-remove ${isNew?'disabled':''}>Remover da lista</button><button type="button" class="save" data-nx20-save ${noStatus?'disabled':''}>${noStatus?'Escolha um status':`Salvar · ${STATUS[d.status].label}`}</button></footer></section>`}
    function render(){if(!layer)return;layer.innerHTML=html();bind()}
    function bind(){layer.querySelectorAll('[data-nx20-close]').forEach(b=>b.onclick=close);layer.querySelectorAll('[data-nx20-status]').forEach(b=>b.onclick=()=>{adapt(d,b.dataset.nx20Status,total);render()});layer.querySelectorAll('[data-nx20-reaction]').forEach(b=>b.onclick=()=>{d.reaction=d.reaction===b.dataset.nx20Reaction?'':b.dataset.nx20Reaction;render()});layer.querySelector('[data-nx20-more]')?.addEventListener('click',()=>{showAll=!showAll;render()});const input=layer.querySelector('[data-nx20-progress]');if(input)input.onchange=()=>{d.progress=Math.max(0,Math.min(total||9999,Number(input.value)||0));const r=rules(d,total);if(!r.score)d.score=null;if(!r.feedback&&d.status!=='DROPPED')d.reaction='';render()};layer.querySelectorAll('[data-nx20-step]').forEach(b=>b.onclick=()=>{d.progress=Math.max(0,Math.min(total||9999,(Number(d.progress)||0)+Number(b.dataset.nx20Step)));const r=rules(d,total);if(!r.score)d.score=null;if(!r.feedback&&d.status!=='DROPPED')d.reaction='';render()});const slider=layer.querySelector('[data-nx20-score]');if(slider)slider.oninput=()=>{d.score=Number(slider.value);const o=layer.querySelector('.nx20-rating output');if(o)o.textContent=String(d.score).replace('.0','')};layer.querySelector('[data-nx20-clear-score]')?.addEventListener('click',()=>{d.score=null;render()});layer.querySelector('[data-nx20-remove]')?.addEventListener('click',()=>{put(id,{},total);close()});layer.querySelector('[data-nx20-save]')?.addEventListener('click',()=>{if(!d.status)return;put(id,d,total);close()})}
    render();
  }

  function scheduleSync(){if(syncRaf)return;syncRaf=requestAnimationFrame(()=>{syncRaf=0;syncUI()})}
  const selector='[data-list],[data-nx-list],[data-nx-detail-list],[data-nx18-status],[data-nx17-list],[data-fav],[data-nx-fav],[data-nx-detail-fav],[data-nx18-fav],[data-nx17-fav]';
  const observer=new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes)if(n.nodeType===1&&(n.matches?.(selector)||n.querySelector?.(selector))){scheduleSync();return}});observer.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('click',e=>{if(layer)return;const sb=e.target.closest('[data-list],[data-nx-list],[data-nx-detail-list],[data-nx18-status],[data-nx17-list]');if(sb){const id=idStatus(sb);if(id){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();open(id);return}}const fb=e.target.closest('[data-fav],[data-nx-fav],[data-nx-detail-fav],[data-nx18-fav],[data-nx17-fav]');if(fb){const id=idFav(fb);if(id){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();favorite(id);return}}},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&layer){e.preventDefault();close()}},true);addEventListener('storage',e=>{if([KEY,LEGACY_KEY,FAV_KEY,LIST_KEY,LEGACY_STATUS].includes(e.key))scheduleSync()});
  window.AniNexusMediaState={get,put,favorite,open,sync:syncUI,statuses:STATUS};syncUI();
})();