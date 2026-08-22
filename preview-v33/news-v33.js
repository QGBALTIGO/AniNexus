'use strict';
(() => {
  const app=document.querySelector('#app');if(!app)return;
  const IS_PAGES=location.hostname.endsWith('github.io'),BASE=IS_PAGES?'/AniNexus':'',BUILD='33.0.0';
  const edgeObservers=[];
  function route(){try{const u=new URL(location.href),p=u.searchParams.get('p');if(p)return p.split('?')[0].replace(/\/+$/,'')||'/';let x=u.pathname;if(IS_PAGES)x=x.replace(/^\/AniNexus/,'')||'/';return x.replace(/\/+$/,'')||'/'}catch{return'/'}}
  function isNews(){return route()==='/noticias'||/^\/noticias\/[a-z0-9-]+$/.test(route())}
  function setupEdge(scroller,host){if(!scroller||scroller.dataset.nx33NewsEdge)return;host=host||scroller.parentElement;if(!host)return;scroller.dataset.nx33NewsEdge='1';host.classList.add('nx33-news-edge');const update=()=>{const max=Math.max(0,scroller.scrollWidth-scroller.clientWidth);host.dataset.nx33Left=scroller.scrollLeft>5?'1':'0';host.dataset.nx33Right=scroller.scrollLeft<max-5?'1':'0'};scroller.addEventListener('scroll',update,{passive:true});const ro=new ResizeObserver(update);ro.observe(scroller);edgeObservers.push(ro);requestAnimationFrame(update)}
  function addUpdateMeta(root){root.querySelectorAll('.nx32-card').forEach(card=>{if(card.dataset.nx33Enhanced)return;card.dataset.nx33Enhanced='1';const media=card.querySelector('.nx32-card-media');if(media&&!media.querySelector('img'))media.classList.add('nx33-no-image')});const article=root.querySelector('.nx32-article');if(article&&!article.dataset.nx33Enhanced){article.dataset.nx33Enhanced='1';const source=article.querySelector('.nx32-article-stats');if(source&&!source.querySelector('.nx33-update-note')){const note=document.createElement('span');note.className='nx33-update-note';note.textContent='matéria viva · atualizada quando surgem novos fatos';source.append(note)}}}
  function enhance(){if(!isNews())return;document.body.classList.add('nx33-news-polish');const page=app.querySelector('.nx32-news-page');if(!page)return;addUpdateMeta(page);setupEdge(page.querySelector('.nx32-categories'),page.querySelector('.nx32-news-toolbar .nx32-shell'));setupEdge(page.querySelector('.nx32-related-grid'),page.querySelector('.nx32-related .nx32-shell'))}
  const mo=new MutationObserver(()=>requestAnimationFrame(enhance));mo.observe(app,{childList:true,subtree:true});
  addEventListener('popstate',()=>setTimeout(enhance,0));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance,{once:true});else enhance();
})();
