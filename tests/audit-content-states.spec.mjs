import {test,expect} from '@playwright/test';
const origin=process.env.ANINEXUS_E2E_ORIGIN||'http://127.0.0.1:4174/';
const widths=[320,360,375,390,393,412,430,480,768,820,1024,1280,1366,1440,1920];
for(const route of ['/animes/temporadas','/animes/catalogo','/anime/obra-999'])test(`global search remains reachable on landscape and tablet ${route}`,async({page})=>{
  await page.route('https://graphql.anilist.co/**',r=>r.fulfill({json:{data:{Media:null,Page:{media:[],pageInfo:{hasNextPage:false}}}}}));
  await page.goto(new URL(route,origin).href,{waitUntil:'domcontentloaded'});
  for(const width of [721,768,820,844,1024,1179,1180]){
    await page.setViewportSize({width,height:390});
    const opener=page.locator('#topbar [data-action="search"]');await expect(opener).toBeVisible();
    await opener.click();await expect(page.locator('#searchInput')).toBeFocused();await page.keyboard.press('Escape');await expect(opener).toBeFocused();
  }
});
for(const type of ['ANIME','MANGA'])for(const theme of ['dark','light'])for(const state of ['partial','long']){
  test(`${type} ${state} metadata remains usable in ${theme} at every required width`,async({page},info)=>{
    test.setTimeout(60000);
    await page.addInitScript(value=>{localStorage.setItem('aninexus:theme',value);localStorage.setItem('aninexus:privacy:v1',JSON.stringify({analytics:false}));},theme);
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    const kind=type.toLowerCase(),title=state==='long'?`Uma obra com título muito extenso ${'ExtraordinariamenteLongo'.repeat(16)}`:'Título com dados parciais';
    await page.route(`**/api/${kind}/999`,route=>route.fulfill({json:{id:999,mediaType:type,title,description:state==='long'?'Uma história em português. '.repeat(400):null,cover:state==='long'?'https://art.invalid/cover.webp':null,banner:state==='long'?'https://art.invalid/banner.webp':null,genres:state==='long'?['Ação','Aventura','Comédia','Fantasia','Drama','Mistério','Ficção científica','Sobrenatural']:null,episodes:null,chapters:null,volumes:null,status:null,format:null,studios:[],staff:[],characters:[],relations:[],recommendations:[],tags:[],streaming:[]}}));
    await page.route('https://art.invalid/**',route=>route.abort());
    await page.route('https://graphql.anilist.co/**',route=>route.fulfill({json:{data:{Media:null}}}));
    await page.route('https://api.jikan.moe/**',route=>route.fulfill({json:{data:null}}));
    await page.goto(new URL(`/${kind}/obra-999`,origin).href,{waitUntil:'domcontentloaded'});
    await expect(page.locator('#app h1')).toHaveText(title);
    await expect(page.locator('#app')).not.toContainText(/undefined|NaN|\[object Object\]/);
    if(state==='partial')await expect(page.locator('#app')).toContainText('A sinopse desta obra ainda não está disponível em português.');
    for(const width of widths){
      await page.setViewportSize({width,height:844});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),`${type} ${state} ${width}`).toBeLessThanOrEqual(2);
      expect(await page.locator('#app h1').evaluate(el=>el.scrollWidth-el.clientWidth),`title clipping ${width}`).toBeLessThanOrEqual(2);
      const back=page.locator('.nx22-back');await expect(back).toBeVisible();
      await back.focus();await expect(back).toBeFocused();
    }
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
    await expect.poll(()=>page.locator('.nx22-back').evaluate(el=>el.getBoundingClientRect().top)).toBeLessThan(160);
    await page.screenshot({path:info.outputPath('metadata.png')});
    expect(errors).toEqual([]);
  });
}
