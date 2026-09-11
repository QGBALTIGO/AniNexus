'use strict';
(() => {
  if(window.__NX_HOME_V35_LOADER__)return;
  const pages=location.hostname.endsWith('github.io'),base=pages?'/AniNexus':'';
  const loader=window.__NX_HOME_V35_LOADER__={status:'idle',attempts:0};

  const pathNow=()=>{try{const url=new URL(location.href),restored=url.searchParams.get('p');let path=restored?restored.split('?')[0]:url.pathname;if(pages&&!restored)path=path.replace(/^\/AniNexus/,'')||'/';return String(path||'/').replace(/\/+$/,'')||'/'}catch{return'/home-loader-error'}};
  const wantsHome=()=>window.__NX35_HOME_BOOT__||pathNow()==='/'||pathNow()==='/__nx35_home_boot__';
  const restoreBootUrl=()=>{if(!window.__NX35_HOME_BOOT__&&!location.pathname.includes('__nx35_home_boot__'))return;history.replaceState({},'',pages?`${base}/?build=44.48.0&p=%2F`:'/');delete window.__NX35_HOME_BOOT__;document.documentElement.classList.remove('nx35-home-boot')};

  const loadHome=()=>{
    if(window.__NX35_HOME__){loader.status='ready';return}
    if(loader.status==='loading')return;
    document.querySelector('script[data-nx35-home-runtime]')?.remove();
    loader.status='loading';loader.attempts++;
    const script=document.createElement('script');
    let settled=false;
    const finish=(status,error)=>{if(settled)return;settled=true;clearTimeout(timer);loader.status=status;if(status==='failed'){script.remove();restoreBootUrl();if(error)console.error('[AniNexus Home V35] falha ao carregar',error)}};
    script.src=`${base}/preview-v35/home-v35.js?v=44.54.2`;
    script.defer=true;script.dataset.nx35HomeRuntime='1';
    script.addEventListener('load',()=>finish(window.__NX35_HOME__?'ready':'failed',window.__NX35_HOME__?null:new Error('Runtime não iniciou')),{once:true});
    script.addEventListener('error',()=>finish('failed',new Error('Script indisponível')),{once:true});
    const timer=setTimeout(()=>finish('failed',Object.assign(new Error('Tempo limite excedido'),{name:'TimeoutError',category:'timeout'})),8000);
    document.head.append(script);
  };

  const retryForCurrentRoute=()=>{if(wantsHome()&&(loader.status==='failed'||loader.status==='idle'))loadHome()};
  addEventListener('popstate',retryForCurrentRoute);
  addEventListener('aninexus:navigate',retryForCurrentRoute);
  addEventListener('aninexus:route-retry',retryForCurrentRoute);
  loadHome();
})();
