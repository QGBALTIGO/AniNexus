'use strict';
(() => {
  if(window.__NX35_HOME_HOTFIX__)return;window.__NX35_HOME_HOTFIX__=true;
  const IS_PAGES=location.hostname.endsWith('github.io');
  const TZ='America/Sao_Paulo';
  let repairToken=0;

  const COPY=new Map([
    ['O mesmo card da Programação, sem uma versão paralela.','Confira os próximos episódios, horários e lançamentos da semana.'],
    ['Matérias internas, recentes e em português — sem mandar você para outro site.','Notícias, trailers e novidades do universo anime em português.'],
    ['Os mais bem avaliados, sem cores fora da identidade do AniNexus.','Os animes mais bem avaliados para você descobrir o que está em alta.'],
    ['Atividade recente, com obra, status e contexto — não apenas texto solto.','Veja o que a comunidade está assistindo, comentando e descobrindo.'],
    ['Use sua lista para desbloquear marcos sem poluir a Home.','Use sua lista para desbloquear novos marcos e conquistas.'],
    ['O AniNexus prefere não mostrar uma matéria a publicar texto em inglês ou sem imagem/contexto.','Novas matérias em português aparecerão aqui assim que forem publicadas.']
  ]);

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slug=s=>String(s||'anime').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,90)||'anime';
  const title=m=>typeof m?.title==='string'?m.title:(m?.title?.english||m?.title?.userPreferred||m?.title?.romaji||m?.title?.native||m?.titleRomaji||'Anime');
  const cover=m=>m?.cover||m?.coverImage?.extraLarge||m?.coverImage?.large||'';
  const score=m=>{const raw=m?.score??(m?.averageScore!=null?Number(m.averageScore)/10:null);return raw!=null&&Number.isFinite(Number(raw))?String(Number(raw).toFixed(1)).replace('.0',''):''};
  const genres=m=>(m?.genres||[]).slice(0,3).join(', ');
  const fmtTime=ts=>{try{return new Intl.DateTimeFormat('pt-BR',{timeZone:TZ,hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(Number(ts)*1000))}catch{return'—'}};
  const route=(m,prefix='anime')=>`/${prefix}/${slug(title(m))}-${Number(m?.id)||0}`;
  const rail=(html,klass='')=>`<div class="nx35-edge"><div class="nx35-rail ${klass}">${html}</div></div>`;

  function sanitizeCopy(root=document){
    root.querySelectorAll?.('.nx35-home p').forEach(node=>{const replacement=COPY.get(node.textContent.trim());if(replacement)node.textContent=replacement});
  }

  async function json(path){
    try{
      const r=await fetch(path,{headers:{accept:'application/json'},cache:'no-store',credentials:'same-origin'});
      if(!r.ok)return null;
      return await r.json();
    }catch{return null}
  }
  const itemsOf=value=>Array.isArray(value)?value:(Array.isArray(value?.items)?value.items:[]);

  function animeCard(m){
    const t=title(m),c=cover(m),sc=score(m),href=route(m);
    return `<a class="nx35-anime nx35-hotfix-card" href="${href}"><div class="nx35-cover">${c?`<img loading="lazy" decoding="async" src="${esc(c)}" alt="${esc(t)}">`:''}<div></div>${sc?`<span class="nx35-score"><b>★ ${esc(sc)}</b></span>`:''}</div><h3>${esc(t)}</h3></a>`;
  }
  function rankCard(m,i){
    const t=title(m),c=cover(m),sc=score(m),href=route(m);
    return `<a class="nx35-rank nx35-hotfix-card" href="${href}"><span class="nx35-rank-num">${i+1}</span><div class="nx35-rank-cover">${c?`<img loading="lazy" decoding="async" src="${esc(c)}" alt="${esc(t)}">`:''}${sc?`<b>★ ${esc(sc)}</b>`:''}</div><div class="nx35-rank-copy"><small>${i+1}º LUGAR</small><h3>${esc(t)}</h3></div></a>`;
  }
  function readingCard(m){
    const t=title(m),c=cover(m),sc=score(m),href=route(m,'manga');
    return `<a class="nx35-reading nx35-hotfix-card" href="${href}"><div class="nx35-book">${c?`<img loading="lazy" decoding="async" src="${esc(c)}" alt="${esc(t)}">`:''}<i></i><span>${m?.format==='NOVEL'?'Light novel':'Mangá'}</span>${sc?`<b>★ ${esc(sc)}</b>`:''}</div><h3>${esc(t)}</h3><p>${esc((m?.genres||[]).slice(0,2).join(' · '))}</p></a>`;
  }
  function scheduleCard(x){
    const m=x?.media||{},t=title(m),c=cover(m),href=route(m),ep=Number(x?.episode)||'—';
    return `<a class="nx18-card nx35-program-card nx35-hotfix-card" href="${href}"><div class="nx18-cover">${c?`<img src="${esc(c)}" alt="${esc(t)}" loading="lazy" decoding="async">`:''}</div><div class="nx18-info"><div class="nx18-air"><span>EM BREVE</span><b>${esc(fmtTime(x?.airingAt))}</b></div><h3>${esc(t)}</h3><p>${esc(genres(m))}</p><div class="nx18-episode"><small>EPISÓDIO</small><strong>${ep}</strong></div></div></a>`;
  }

  function empty(root){return !!root&&root.children.length===0&&root.textContent.trim()===''}
  function fill(id,html,className){const root=document.querySelector(id);if(!empty(root)||!html)return false;if(className)root.className=className;root.innerHTML=html;return true}

  function seasonNow(){
    const d=new Date(),m=Number(new Intl.DateTimeFormat('en',{timeZone:TZ,month:'numeric'}).format(d)),year=Number(new Intl.DateTimeFormat('en',{timeZone:TZ,year:'numeric'}).format(d));
    return{season:m<=3?'WINTER':m<=6?'SPRING':m<=9?'SUMMER':'FALL',year};
  }

  async function repairData(){
    const home=document.querySelector('.nx35-home');if(!home||IS_PAGES)return;
    const my=++repairToken,s=seasonNow(),now=Math.floor(Date.now()/1000),end=now+7*86400;
    const requests=[
      json(`/api/catalog?season=${s.season}&year=${s.year}&sort=POPULAR&perPage=22`),
      json(`/api/schedule?start=${now}&end=${end}`),
      json('/api/catalog?sort=SCORE&perPage=10'),
      json('/api/catalog?sort=POPULAR&perPage=22'),
      json('/api/catalog?status=NOT_YET_RELEASED&sort=POPULAR&perPage=22'),
      json('/api/reading?sort=POPULAR&perPage=18')
    ];
    const [season,schedule,top,popular,soon,reading]=await Promise.all(requests);
    if(my!==repairToken||!document.querySelector('.nx35-home'))return;

    const seasonItems=itemsOf(season),scheduleItems=itemsOf(schedule),topItems=itemsOf(top),popularItems=itemsOf(popular),soonItems=itemsOf(soon),readingItems=itemsOf(reading);
    fill('#nx35Season',seasonItems.length?rail(seasonItems.map(animeCard).join('')):'');
    fill('#nx35Schedule',scheduleItems.length?scheduleItems.slice(0,6).map(scheduleCard).join(''):'','nx35-program-grid');
    fill('#nx35Top',topItems.length?rail(topItems.slice(0,10).map(rankCard).join(''),'nx35-rank-rail'):'');
    fill('#nx35Popular',popularItems.length?rail(popularItems.map(animeCard).join('')):'');
    fill('#nx35Soon',soonItems.length?rail(soonItems.map(animeCard).join('')):'');
    fill('#nx35Reading',readingItems.length?readingItems.map(readingCard).join(''):'','nx35-rail nx35-reading-rail');
  }

  function scheduleRepair(){
    sanitizeCopy();
    setTimeout(()=>{sanitizeCopy();repairData()},450);
    setTimeout(()=>{sanitizeCopy();repairData()},1800);
  }

  addEventListener('aninexus:home-v34-ready',scheduleRepair);
  new MutationObserver(records=>{
    for(const record of records){
      for(const node of record.addedNodes){
        if(node.nodeType===1&&(node.matches?.('.nx35-home')||node.querySelector?.('.nx35-home'))){scheduleRepair();return}
      }
    }
  }).observe(document.documentElement,{subtree:true,childList:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scheduleRepair,{once:true});else scheduleRepair();
})();
