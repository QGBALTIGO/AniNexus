// Explicit product surface inventory. Evidence is generated separately; inventory is not a pass.
export const widths = [320, 360, 375, 390, 393, 412, 430, 480, 768, 820, 1024, 1280, 1366, 1440, 1920];
const groups = {
  home: ['/'],
  catalog: ['/animes/catalogo', '/mangas', '/light-novels'],
  schedule: ['/animes/programacao'],
  season: ['/animes/temporadas', '/animes/temporadas/2026/inverno', '/animes/temporadas/2026/primavera', '/animes/temporadas/2026/verao', '/animes/temporadas/2026/outono'],
  discovery: ['/animes/onde-assistir', '/animes/dublados', '/animes/estudios'],
  lists: ['/listas-de-animes', '/melhores-animes-para-assistir', '/animes-mais-assistidos', '/animes-mais-aguardados', '/animes-em-alta', '/filmes-de-anime', '/animes-curtos', '/animes-de-acao', '/animes-de-romance', '/animes-de-fantasia', '/animes-de-comedia', '/animes-de-misterio', '/animes-de-esporte', '/animes-de-terror', '/descubra'],
  detail: ['/anime/naruto-20', '/anime/one-piece-21', '/anime/cowboy-bebop-1', '/manga/one-piece-30013', '/manga/solo-leveling-105398'],
  news: ['/noticias', '/noticias/draw-this-then-die-ganha-2-temporada-animenew-197c1986', '/noticias/qa-noticia-inexistente'],
  community: ['/comunidade'],
  awards: ['/anime-awards'],
  achievements: ['/conquistas'],
  auth: ['/login', '/criar-conta', '/conectar-source'],
  account: ['/minha-conta'],
  library: ['/minha-biblioteca', '/meus-animes', '/meus-mangas'],
  profile: ['/u/Diego', '/u/qa-perfil-inexistente'],
  admin: ['/admin'],
  institutional: ['/quem-somos', '/colabore', '/contato'],
  legal: ['/termos-de-uso', '/politica-de-privacidade', '/dmca'],
  notfound: ['/qa-rota-inexistente'],
  alias: ['/animes', '/catalogo', '/programacao', '/temporadas', '/news', '/community', '/manga', '/entrar', '/cadastro', '/conta'],
};
export const routes = Object.entries(groups).flatMap(([family, paths]) => paths.map(route => ({
  id: route === '/' ? 'home' : route.slice(1).replaceAll('/', '--'), route, family,
  states: ['normal', 'keyboard', 'history', 'reload', 'light', 'dark', ...( ['legal', 'institutional', 'notfound'].includes(family) ? [] : ['loading', 'empty', 'error', 'offline'])],
})));
export const components = {
  shared: ['header guest/member', 'mobile drawer', 'global search anime/manga/user', 'notifications', 'account menu', 'theme', 'privacy consent', 'footer', 'skip link', 'toast', 'modal focus/scroll/escape', 'cards', 'rails', 'image fallback', 'loading/error/retry'],
  detail: ['hero', 'back', 'favorite', 'list status/progress/rating', 'share', 'synopsis', 'facts', 'impressions', 'themes', 'characters/staff', 'franchise', 'recommendations', 'official links'],
  catalog: ['search debounce', 'sort', 'filters', 'pagination', 'empty', 'card actions', 'type switching'],
  social: ['threads', 'reply', 'spoiler', 'like', 'report', 'follow', 'private profile'],
  account: ['overview', 'profile dialog', 'avatar/banner', 'privacy', 'source connection', 'connections', 'notifications', 'import/export', 'manga link consent'],
  admin: ['overview', 'reports', 'users', 'team', 'audit', 'authorization', 'filters', 'dialogs', 'confirmation', 'rollback'],
};
