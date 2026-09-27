import {test,expect} from '@playwright/test';

const origin=process.env.ANINEXUS_E2E_ORIGIN||'http://127.0.0.1:4174/';
const titles=['One Piece','One-Punch Man','The Beginning After the End: uma aventura de nome longo'];
const items=titles.map((name,index)=>({id:30001+index,title:{english:name},cover:'/assets/logo.png',genres:['Action',index===1?'Comedy':'Adventure'],format:'MANGA',status:'RELEASING'}));

async function homeFixture(page,theme){
  await page.addInitScript(({theme,items})=>{
    localStorage.setItem('aninexus:theme',theme);
    localStorage.setItem('aninexus:privacy:v1',JSON.stringify({analytics:false}));
    sessionStorage.setItem('nx35:public:v8',JSON.stringify({at:Date.now(),data:{season:items,schedule:[],top:[],popular:items,soon:items,reading:items,topReading:[]}}));
  },{theme,items});
  await page.route('https://graphql.anilist.co/**',route=>route.fulfill({json:{data:{}}}));
  await page.route('https://api.jikan.moe/**',route=>route.fulfill({json:{data:[]}}));
  await page.route('**/api/**',route=>route.fulfill({json:{items:[]}}));
  await page.goto(origin);
  await expect(page.locator('#nx35Reading .nx35-reading')).toHaveCount(3);
  await page.evaluate(()=>document.fonts.ready);
}

for(const theme of ['dark','light'])test(`home cards keep titles and genres together without changing the poster rail (${theme})`,async({page},info)=>{
  await homeFixture(page,theme);
  for(const width of [320,390,768,1440,1920]){
    await page.setViewportSize({width,height:900});
    const rail=page.locator('#nx35Reading');
    await rail.scrollIntoViewIfNeeded();
    if(width===390||width===1440)await page.screenshot({path:info.outputPath(`reading-${width}.png`)});
    const cards=await rail.locator('.nx35-reading').evaluateAll(elements=>elements.map(card=>{
      const title=card.querySelector('h3'),genres=card.querySelector('p'),poster=card.querySelector('.nx35-book');
      const titleRect=title.getBoundingClientRect(),genreRect=genres.getBoundingClientRect(),posterRect=poster.getBoundingClientRect();
      return{titleHeight:titleRect.height,lineHeight:parseFloat(getComputedStyle(title).lineHeight),gap:genreRect.top-titleRect.bottom,width:posterRect.width,height:posterRect.height,cardHeight:card.getBoundingClientRect().height};
    }));
    // WebKit rounds line boxes to integer pixels; allow one pixel per line, not an extra line.
    for(const card of cards.slice(0,2))expect(Math.abs(card.titleHeight-card.lineHeight),`${width}: short title must not reserve an empty second line`).toBeLessThanOrEqual(1);
    expect(Math.abs(cards[2].titleHeight-cards[2].lineHeight*2),`${width}: long title remains clamped to two lines`).toBeLessThanOrEqual(2);
    for(const card of cards){
      expect(card.gap,`${width}: title/genre separation`).toBeGreaterThanOrEqual(0);
      expect(card.gap,`${width}: title/genre separation`).toBeLessThanOrEqual(6);
      expect(card.height/card.width,`${width}: poster ratio`).toBeCloseTo(1.5,1);
      expect(card.width,`${width}: poster rail width`).toBe(width<=720?145:150);
      expect(card.cardHeight,`${width}: cards keep a consistent rail hit area`).toBeCloseTo(cards[0].cardHeight,0);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),`${width}: page overflow`).toBeLessThanOrEqual(2);
    await expect(page.locator('.nx61-scroll-track')).toHaveCount(0);
  }
  const rail=page.locator('#nx35Reading');
  await page.setViewportSize({width:320,height:900});
  await rail.evaluate(element=>element.scrollTo({left:element.scrollWidth,behavior:'instant'}));
  await expect.poll(()=>rail.evaluate(element=>element.scrollLeft)).toBeGreaterThan(0);
});
