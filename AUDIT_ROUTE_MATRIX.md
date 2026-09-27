# AUDIT_ROUTE_MATRIX

Atualizado em 2026-09-27T16:28:16.767Z. Base inicial: 6ed65bb4162c164d3b078728dfd0ade184343b90; atualização editorial 39c65a545261 incorporada durante a auditoria.

**E = evidência renderizada; T = jornada com asserções; F = falha; P = pendente.** E-preview usa correções locais e dados reais somente leitura. E-live é pós-publicação. E-fault verifica renderização, overflow, erros JS e vazamento de diagnóstico com API simulada; não aprova sozinho cada ação. Evidência privada: audit-artifacts/ (fora de Git, Docker e publicação).

## Rotas × larguras

| Rota | Família | 320 | 360 | 375 | 390 | 393 | 412 | 430 | 480 | 768 | 820 | 1024 | 1280 | 1366 | 1440 | 1920 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| / | home | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /animes/catalogo | catalog | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /mangas | catalog | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /light-novels | catalog | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /animes/programacao | schedule | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /animes/temporadas | season | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /animes/temporadas/2026/inverno | season | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /animes/temporadas/2026/primavera | season | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /animes/temporadas/2026/verao | season | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /animes/temporadas/2026/outono | season | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /animes/onde-assistir | discovery | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /animes/dublados | discovery | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /animes/estudios | discovery | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /listas-de-animes | lists | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /melhores-animes-para-assistir | lists | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /animes-mais-assistidos | lists | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /animes-mais-aguardados | lists | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /animes-em-alta | lists | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /filmes-de-anime | lists | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /animes-curtos | lists | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /animes-de-acao | lists | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /animes-de-romance | lists | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /animes-de-fantasia | lists | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /animes-de-comedia | lists | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /animes-de-misterio | lists | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /animes-de-esporte | lists | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /animes-de-terror | lists | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /descubra | lists | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /anime/naruto-20 | detail | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /anime/one-piece-21 | detail | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /anime/cowboy-bebop-1 | detail | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /manga/one-piece-30013 | detail | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /manga/solo-leveling-105398 | detail | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /noticias | news | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /noticias/draw-this-then-die-ganha-2-temporada-animenew-197c1986 | news | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /noticias/qa-noticia-inexistente | news | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /comunidade | community | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /anime-awards | awards | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /conquistas | achievements | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /login | auth | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /criar-conta | auth | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /conectar-source | auth | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /minha-conta | account | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /minha-biblioteca | library | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /meus-animes | library | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /meus-mangas | library | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /u/Diego | profile | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /u/qa-perfil-inexistente | profile | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /admin | admin | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /quem-somos | institutional | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /colabore | institutional | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /contato | institutional | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /termos-de-uso | legal | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /politica-de-privacidade | legal | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /dmca | legal | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /qa-rota-inexistente | notfound | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /animes | alias | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /catalogo | alias | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /programacao | alias | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /temporadas | alias | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /news | alias | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /community | alias | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /manga | alias | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /entrar | alias | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /cadastro | alias | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |
| /conta | alias | E-live | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-preview | E-preview | E-preview | E-preview | E-live | E-live |

## Estados adversariais e navegação

T-nav: entrada direta, reload, pesquisa pelo teclado e retorno do foco, voltar, avançar, paisagem 844×390, reflow 640×450, 320×568 e movimento reduzido. Reflow não é teste físico de cada dispositivo.

| Rota | Navegação | 404 | 500 | Vazio | Nulo | Offline | Timeout |
|---|---|---|---|---|---|---|---|
| / | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /animes/catalogo | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /mangas | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /light-novels | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /animes/programacao | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /animes/temporadas | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /animes/temporadas/2026/inverno | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /animes/temporadas/2026/primavera | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /animes/temporadas/2026/verao | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /animes/temporadas/2026/outono | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /animes/onde-assistir | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /animes/dublados | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /animes/estudios | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /listas-de-animes | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /melhores-animes-para-assistir | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /animes-mais-assistidos | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /animes-mais-aguardados | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /animes-em-alta | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /filmes-de-anime | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /animes-curtos | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /animes-de-acao | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /animes-de-romance | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /animes-de-fantasia | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /animes-de-comedia | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /animes-de-misterio | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /animes-de-esporte | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /animes-de-terror | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /descubra | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /anime/naruto-20 | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /anime/one-piece-21 | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /anime/cowboy-bebop-1 | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /manga/one-piece-30013 | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /manga/solo-leveling-105398 | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /noticias | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /noticias/draw-this-then-die-ganha-2-temporada-animenew-197c1986 | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /noticias/qa-noticia-inexistente | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /comunidade | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /anime-awards | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /conquistas | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /login | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /criar-conta | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /conectar-source | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /minha-conta | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /minha-biblioteca | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /meus-animes | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /meus-mangas | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /u/Diego | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /u/qa-perfil-inexistente | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /admin | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /quem-somos | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /colabore | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /contato | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /termos-de-uso | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /politica-de-privacidade | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /dmca | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /qa-rota-inexistente | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /animes | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /catalogo | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /programacao | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /temporadas | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /news | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /community | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /manga | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /entrar | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /cadastro | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /conta | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |

Para páginas sem dependência de API, E-fault significa que a indisponibilidade externa não interrompe a página. Nas áreas privadas, esta passagem como visitante verifica a barreira de acesso. Estados autenticados têm fixtures próprias e leitura da conta real.

## Componentes e evidência funcional

### shared

header guest/member; mobile drawer; global search anime/manga/user; notifications; account menu; theme; privacy consent; footer; skip link; toast; modal focus/scroll/escape; cards; rails; image fallback; loading/error/retry.

### detail

hero; back; favorite; list status/progress/rating; share; synopsis; facts; impressions; themes; characters/staff; franchise; recommendations; official links.

### catalog

search debounce; sort; filters; pagination; empty; card actions; type switching.

### social

threads; reply; spoiler; like; report; follow; private profile.

### account

overview; profile dialog; avatar/banner; privacy; source connection; connections; notifications; import/export; manga link consent.

### admin

overview; reports; users; team; audit; authorization; filters; dialogs; confirmation; rollback.

- Busca, aliases, histórico, detalhe vazio/retry e modal da programação: tests/total-audit.spec.mjs.
- Contato/DMCA: tests/audit-forms.spec.mjs (validação, sucesso, erro, timeout, rascunho, envio duplicado).
- Metadados parciais/longos, imagens quebradas e busca tablet: tests/audit-content-states.spec.mjs; 15 larguras, anime/mangá, dois temas; posição do botão voltar após resize.
- Ações de mídia: tests/media-actions.spec.mjs, tests/media-list.mjs e testes transacionais no CI.
- Comunidade, biblioteca, perfil privado/público/inexistente, importação com confirmação, administração e permissões: tests/e2e.spec.mjs, tests/community-overview.spec.mjs; mutações com fixtures, não em membros reais.
- Login/cadastro reais: real-auth-theme/ (18 capturas, rascunho preservado, seis análises Axe). Sem enviar novos códigos nem cadastrar usuários.
- Conta/admin reais: preview-admin-final/, somente leitura. Sem exclusões, bloqueios ou publicações de teste.
- Revisão pós-publicação: post-release-admin-panels/ (cinco painéis, dois temas), post-release-member-panels/ (conta, três painéis de edição no topo e após rolagem, notificações e filtros). Os resultados JSON desses diretórios distinguem execução concluída de pendência.
- Regressões autenticadas: editor com teclado e foco; Source conectado, desconectado e indisponível; notificações lidas/não lidas; filtros da biblioteca; tests/total-audit.spec.mjs nos três motores.
- Estabilidade durante carregamento: placeholder do pódio e altura da página; tests/total-audit.spec.mjs. Medições e inventário de estilos: DESIGN_SYSTEM_AUDIT.md. Rastreabilidade de 47 correções: AUDIT_TECHNICAL_TRACE.md.
- Acessibilidade: 28 cenários × claro móvel/claro desktop/escuro móvel; última rodada: 84/84 sem violações sérias/críticas.
- Revisão visual humana: folhas das 66 rotas no escuro móvel, 39 páginas no claro móvel/desktop, oito áreas autenticadas, login/cadastro, modal de programação, fallback de detalhe e seis referências. Não se afirma revisão manual de cada pixel de cada captura.

## Reconciliação de rotas dinâmicas

- Detalhe: cinco obras reais e fixtures com vazio/404/500/timeout, títulos longos, imagens quebradas e resposta fora de ordem.
- Notícias: item real, slug inexistente, underscores, navegação concorrente, comentários simulados.
- Perfil: proprietário real em leitura; público/privado/inexistente e query de conquista nos E2E.
- /contato?assunto=colaboracao e /minha-conta#notificacoes: variantes dos fluxos correspondentes.
- /comments/spoiler-check, /moderation, /decision, /health e /health/ready: API ou fragmentos de API. /lib, /img/sp/icon, /wp-content, /embed, /character e /people: recursos/provedores externos. /home-loader-error: identificador de diagnóstico.
- 12 aliases têm regressão; light-novels e descubra aparecem nas famílias catálogo/listas.

## Referência Aniquim

Navegador comum bloqueado. Scrapling recuperou seis páginas públicas (HTTP 200), renderizadas localmente com CSS original e scripts desativados em 390/1440px. Home, catálogo, detalhe, programação, temporada e comunidade foram inspecionados. Comparação estática de organização e consistência, não validação interativa. Evidência: audit-artifacts/reference/.

## Inventário técnico

158 arquivos ativos; 176 candidatos de API. Inventário detalhado privado: audit-artifacts/inventory.json. Status de release e limites: FINAL_QA_REPORT.md. Reexecutar o gerador após terminar as rodadas pendentes.
