import { test, expect } from '@playwright/test';
const origin = process.env.ANINEXUS_E2E_ORIGIN || 'http://127.0.0.1:4174/';
const image = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
const media = (id, type = 'ANIME', name = type === 'MANGA' ? 'Mangá de teste' : 'Anime de teste') => ({
  id, type, title: { english: name, romaji: name, userPreferred: name }, coverImage: { large: image, extraLarge: image },
  bannerImage: image, format: type === 'MANGA' ? 'MANGA' : 'TV', status: 'FINISHED', genres: ['Adventure'],
  episodes: type === 'MANGA' ? null : 12, chapters: 100, volumes: 10, description: 'Sinopse de teste em português.',
  startDate: { year: 2025, month: 1, day: 1 }, endDate: null, studios: { nodes: [] }, relations: { edges: [] },
  recommendations: { nodes: [] }, characters: { edges: [] }, staff: { edges: [] }, externalLinks: [],
});
const fulfill = (route, data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });

for (const [path, recovery] of [
  ['/animes/programacao', '[data-schedule-retry]'],
  ['/animes/temporadas', '.nx-season-error'],
  ['/animes/onde-assistir', '[data-nx47-watch-retry]'],
  ['/animes/dublados', '[data-nx47-dub-retry]'],
  ['/animes/estudios', '[data-nx47-studio-retry]'],
  ['/melhores-animes-para-assistir', '[data-nx48-retry]'],
  ['/comunidade', '[data-nx40-retry]'],
]) test(`slow provider has a bounded recovery on ${path}`, async ({ page }, info) => {
  const stall = async route => {
    await new Promise(resolve => setTimeout(resolve, 28000));
    await fulfill(route, {}).catch(() => {});
  };
  await page.route('**/api/**', stall);
  await page.route('https://graphql.anilist.co/**', stall);
  await page.goto(new URL(path, origin).href, { waitUntil: 'domcontentloaded' });
  await expect(page.locator(recovery).first()).toBeVisible({ timeout: 20000 });
  await expect(page.locator('#app')).not.toContainText(/Consultando catálogo|Consultando seleção|Carregando ranking/);
  await page.screenshot({ path: info.outputPath('bounded-recovery.png') });
});

test('public profile times out and retries without reloading the page', async ({ page }, info) => {
  let blocked = true;
  await page.route('**/api/users/qa_tester', async route => {
    if (!blocked) return route.fallback();
    await new Promise(resolve => setTimeout(resolve, 18000));
    await fulfill(route, { profile: { username: 'obsolete' } }).catch(() => {});
  });
  await page.goto(new URL('/u/qa_tester', origin).href);
  await expect(page.getByRole('heading', { name: 'Perfil indisponível agora' })).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: info.outputPath('profile-timeout.png') });
  blocked = false;
  await page.locator('[data-profile-retry]').click();
  await expect(page.locator('#app h1')).toHaveText('Pessoa de teste');
});

test('achievements bounds concurrent reads and retries after the provider recovers', async ({ page }, info) => {
  let blocked = true;
  for (const endpoint of ['/api/achievements/catalog', '/api/me/achievements']) {
    await page.route(`**${endpoint}`, async route => {
      if (!blocked) return fulfill(route, { items: [{ id: 'qa', title: 'Primeiros passos', description: 'Complete seu perfil.', tier: 'BRONZE' }] });
      await new Promise(resolve => setTimeout(resolve, 25000));
      await fulfill(route, { items: [] }).catch(() => {});
    });
  }
  await page.goto(new URL('/conquistas', origin).href);
  await expect(page.getByRole('heading', { name: 'Conquistas indisponíveis agora' })).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: info.outputPath('achievements-timeout.png') });
  blocked = false;
  await page.locator('[data-achievement-retry]').click();
  await expect(page.locator('[data-achievement-id="qa"]')).toBeVisible();
});

for (const status of [200, 500]) test(`late profile response ${status} cannot replace a different route`, async ({ page }) => {
  let release, started = false;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route('**/api/users/qa_tester', async route => {
    started = true; await pending;
    await fulfill(route, { profile: { username: 'obsolete', displayName: 'Perfil antigo' } }, status);
  });
  await page.goto(new URL('/u/qa_tester', origin).href);
  await expect.poll(() => started).toBe(true);
  await page.evaluate(() => { history.pushState({}, '', '/quem-somos'); dispatchEvent(new PopStateEvent('popstate')); });
  await expect(page.locator('.nx-inst')).toBeVisible();
  release();
  await page.waitForTimeout(500);
  await expect(page.locator('.nx-inst')).toBeVisible();
  await expect(page.locator('#app')).not.toContainText('Perfil antigo');
});

for (const body of [null, {}]) test(`incomplete public profile ${JSON.stringify(body)} is recoverable instead of invented`, async ({ page }) => {
  await page.route('**/api/users/qa_tester', route => fulfill(route, body));
  await page.goto(new URL('/u/qa_tester', origin).href);
  await expect(page.getByRole('heading', { name: 'Perfil indisponível agora' })).toBeVisible();
  await expect(page.locator('[data-profile-retry]')).toBeVisible();
  await expect(page.locator('#app')).not.toContainText('@undefined');
});
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('aninexus:privacy:v1', JSON.stringify({ analytics: false })));
  await page.route('https://graphql.anilist.co/**', route => {
    const body = route.request().postDataJSON() || {}, type = /MANGA/.test(body.query) ? 'MANGA' : 'ANIME';
    const item = media(type === 'MANGA' ? 30013 : 20, type);
    return fulfill(route, { data: { Media: item, Page: { media: [item], pageInfo: { hasNextPage: false } } } });
  });
  await page.route('**/api/users/search?*', route => fulfill(route, { items: [{ username: 'qa_tester', displayName: 'Pessoa de teste', avatarUrl: image }] }));
  await page.route('**/api/users/qa_tester*', route => fulfill(route, {
    profile: { username: 'qa_tester', displayName: 'Pessoa de teste', avatarUrl: image, privacy: 'public', role: 'user', createdAt: '2026-01-01' },
    stats: {}, social: {}, library: [], mangaLibrary: [], favorites: [], favoriteCharacters: [], activity: [], impressions: [], achievements: [], pinnedAchievements: [], connections: { following: [], followers: [] },
  }));
  await page.route('**/api/anime/20', route => fulfill(route, { ...media(20), title: 'Anime de teste', cover: image, banner: image, studios: [], characters: [], staff: [], relations: [], recommendations: [], streaming: [], tags: [] }));
  await page.route('**/api/manga/30013', route => fulfill(route, { ...media(30013, 'MANGA'), title: 'Mangá de teste', cover: image, banner: image, studios: [], characters: [], staff: [], relations: [], recommendations: [], streaming: [], tags: [] }));
  await page.route('https://api.jikan.moe/**', route => fulfill(route, { data: null }));
});
test.afterEach(async ({ page }) => page.unrouteAll({ behavior: 'ignoreErrors' }));
async function openSearch(page, kind = 'ANIME') {
  await page.goto(new URL('/quem-somos', origin).href, { waitUntil: 'domcontentloaded' });
  await page.locator('#topbar [data-action="search"]').click();
  await page.locator(`[data-search-kind="${kind}"]`).click();
}
for (const width of [320, 390, 768, 1440]) for (const kind of ['ANIME', 'MANGA', 'USER']) {
  test(`search ${kind} opens the correct destination and closes all source UI at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await openSearch(page, kind);
    await page.locator('#searchInput').fill(kind === 'USER' ? '@qa_tester' : 'Teste');
    const result = page.locator('#searchResults a.search-result').first();
    await expect(result).toBeVisible();
    const prefix = kind === 'USER' ? '/u/qa_tester' : kind === 'MANGA' ? '/manga/' : '/anime/';
    await expect(result).toHaveAttribute('href', new RegExp(prefix));
    await result.focus(); await page.keyboard.press('Enter');
    await expect.poll(() => new URL(page.url()).pathname).toContain(prefix);
    await expect(page.locator('#searchOverlay')).toBeHidden();
    await expect(page.locator('body')).not.toHaveClass(/modal-open/);
    if (kind !== 'USER') {
      await expect(page.locator('.nx22-detail:not(.nx22-fail):not(.nx22-loading)')).toBeVisible();
      await expect(page.locator('#app h1')).toHaveText(kind === 'MANGA' ? 'Mangá de teste' : 'Anime de teste');
    } else await expect(page.locator('.nx38p-page')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
    await page.screenshot({ path: info.outputPath('destination.png') });
    await page.goBack(); await expect(page.locator('.nx-inst')).toBeVisible();
    await page.goForward(); await expect.poll(() => new URL(page.url()).pathname).toContain(prefix);
    await page.locator('#topbar [data-action="search"]').click();
    await expect(page.getByRole('dialog', { name: 'Encontre no AniNexus' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#searchOverlay')).toBeHidden();
    await expect(page.locator('#topbar [data-action="search"]')).toBeFocused();
  });
}
test('search traps focus and exposes native keyboard links', async ({ page }) => {
  await openSearch(page); await page.locator('#searchInput').fill('Teste');
  const last = page.locator('#searchResults a').last(); await expect(last).toBeVisible();
  await last.focus(); await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement.closest('#searchOverlay') !== null)).toBe(true);
  await page.keyboard.press('Shift+Tab'); await expect(last).toBeFocused();
});
test('search invalidates stale data immediately while a new term is still debouncing', async ({ page }) => {
  let releaseOld;
  const old = new Promise(resolve => { releaseOld = resolve; });
  let oldRequested = false;
  await page.route('https://graphql.anilist.co/**', async route => {
    const q = route.request().postDataJSON()?.variables?.q;
    if (q === 'antigo') { oldRequested = true; await old; }
    return fulfill(route, { data: { Page: { media: [media(20, 'ANIME', q === 'antigo' ? 'Resultado antigo' : 'Resultado novo')] } } });
  });
  await openSearch(page); await page.locator('#searchInput').fill('antigo');
  await expect.poll(() => oldRequested).toBe(true);
  await page.locator('#searchInput').fill('novo'); releaseOld();
  await expect(page.locator('#searchResults')).not.toContainText('Resultado antigo');
  await expect(page.locator('#searchResults')).toContainText('Resultado novo');
});
test('search can retry a provider error without deleting the query', async ({ page }) => {
  let broken = true;
  await page.route('https://graphql.anilist.co/**', route => broken ? fulfill(route, { errors: [{ message: 'temporarily unavailable' }] }, 503) : fulfill(route, { data: { Page: { media: [media(20)] } } }));
  await openSearch(page); await page.locator('#searchInput').fill('falha recuperavel');
  const retry = page.getByRole('button', { name: 'Tentar novamente', exact: true });
  await expect(retry).toBeVisible({ timeout: 25000 }); broken = false; await retry.click();
  await expect(page.locator('#searchResults a')).toBeVisible();
  await expect(page.locator('#searchInput')).toHaveValue('falha recuperavel');
});

for(const [alias,target] of [
  ['/animes','/animes/catalogo'],['/catalogo','/animes/catalogo'],['/programacao','/animes/programacao'],
  ['/temporadas','/animes/temporadas'],['/news','/noticias'],['/community','/comunidade'],['/manga','/mangas'],
  ['/entrar','/login'],['/cadastro','/criar-conta'],['/conta','/minha-conta'],
  ['/light-novels','/mangas?secao=light-novels'],['/descubra','/animes-em-alta'],
])test(`direct alias ${alias} resolves before rendering instead of showing an old page or 404`,async({page})=>{
  await page.goto(new URL(alias,origin).href);
  const destination=()=>{const url=new URL(page.url());return alias==='/temporadas'?url.pathname.replace(/\/\d{4}\/(inverno|primavera|verao|outono)$/,''):url.pathname+url.search};
  await expect.poll(destination).toBe(target);
  await expect(page.locator('#app')).not.toContainText('Página não encontrada');
  await page.reload();
  await expect.poll(destination).toBe(target);
});

for(const path of ['/termos-de-uso','/politica-de-privacidade','/dmca'])test(`legal page ${path} clears fixed header and survives history traversal`,async({page},info)=>{
  await page.goto(new URL(path,origin).href);
  for(const width of [320,360,375,390,393,412,430,480,768,820,1024,1280,1366,1440,1920]){
    await page.setViewportSize({width,height:900});
    await expect(page.locator('main.nx-legal h1')).toBeVisible();
    const bounds=await page.evaluate(()=>({title:document.querySelector('.nx-legal-overline').getBoundingClientRect().top,header:document.querySelector('#topbar').getBoundingClientRect().bottom}));
    expect(bounds.title).toBeGreaterThanOrEqual(bounds.header);
    if([320,390,768,1440,1920].includes(width))await page.screenshot({path:info.outputPath(`${width}.png`)});
  }
  await page.locator('#topbar [data-action="search"]').click();
  await page.locator('#searchInput').fill('Teste');
  await page.locator('#searchResults a').first().click();
  await expect(page.locator('.nx22-detail:not(.nx22-loading)')).toBeVisible();
  await page.goBack();await expect(page.locator('main.nx-legal h1')).toBeVisible();
  await page.goForward();await expect(page.locator('.nx22-detail:not(.nx22-loading)')).toBeVisible();
});

test('Source connection without a token explains recovery rather than falling into a generic 404',async({page})=>{
  await page.goto(new URL('/conectar-source',origin).href);
  await expect(page.locator('.nx38-account-page')).toContainText('Gere um novo pelo bot');
  await expect(page.locator('#app')).not.toContainText('Página não encontrada');
});

test('returning to a genuinely unknown route clears the previous route owner',async({page})=>{
  await page.goto(new URL('/qa-rota-inexistente',origin).href);
  await page.locator('#topbar [data-action="search"]').click();await page.locator('#searchInput').fill('Teste');
  await page.locator('#searchResults a').first().click();
  await expect(page.locator('.nx22-detail:not(.nx22-loading)')).toBeVisible();
  await page.goBack();await expect(page.locator('#app')).toContainText('Página não encontrada');
  expect(await page.evaluate(()=>window.__NX_ROUTE_OWNER__)).toBe('');
});

for(const type of ['ANIME','MANGA']) test(`empty ${type} detail leaves loading and can recover`,async({page})=>{
  const kind=type.toLowerCase(),id=type==='ANIME'?20:30013;
  let recovered=false;
  await page.route(`**/api/${kind}/${id}`,route=>fulfill(route,recovered?{id,mediaType:type,title:'Obra recuperada',studios:[],genres:[],tags:[],streaming:[],characters:[],staff:[],relations:[],recommendations:[]}:{items:[]}));
  await page.route('https://graphql.anilist.co/**',route=>fulfill(route,{data:{Media:null}}));
  await page.goto(new URL(`/${kind}/obra-${id}`,origin).href);
  await expect(page.locator('.nx22-fail')).toBeVisible({timeout:18000});
  await expect(page.locator('.nx22-loading')).toHaveCount(0);
  recovered=true;
  await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();
  await expect(page.locator('#app h1')).toHaveText('Obra recuperada');
});

for(const theme of ['dark','light']) test(`schedule platform dialog supports keyboard and cancel in ${theme}`,async({page},info)=>{
  await page.addInitScript(value=>localStorage.setItem('aninexus:theme',value),theme);
  const item={...media(20),streaming:[{site:'Crunchyroll',url:'https://www.crunchyroll.com/'}]};
  await page.route('**/api/schedule*',route=>fulfill(route,{items:[{airingAt:Math.floor(Date.now()/1000)+3600,episode:2,media:item}]}));
  await page.route('https://graphql.anilist.co/**',route=>fulfill(route,{data:{Page:{airingSchedules:[{airingAt:Math.floor(Date.now()/1000)+3600,episode:2,media:{...media(20),externalLinks:[{site:'Crunchyroll',url:'https://www.crunchyroll.com/',type:'STREAMING'}]}}],pageInfo:{hasNextPage:false}}}}));
  await page.setViewportSize({width:390,height:844});
  await page.goto(new URL('/animes/programacao',origin).href);
  const opener=page.locator('#app [data-nx18-stream]');await opener.click();
  const dialog=page.getByRole('dialog',{name:'Onde assistir'});await expect(dialog).toBeVisible();
  const close=dialog.locator('[data-close]'),apply=dialog.locator('[data-apply]');
  await expect(close).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(apply).toBeFocused();
  await page.keyboard.press('Tab');await expect(close).toBeFocused();
  await page.screenshot({path:info.outputPath(`platform-dialog-${theme}.png`)});
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(opener).toBeFocused();
  await expect(page.locator('body')).not.toHaveClass(/modal-open/);
});
