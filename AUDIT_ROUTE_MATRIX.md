# AUDIT_ROUTE_MATRIX

Atualizado em 2026-09-27T16:28:16.767Z. Base inicial: 6ed65bb4162c164d3b078728dfd0ade184343b90; atualização editorial 39c65a545261 incorporada durante a auditoria.

**E = evidência renderizada; T = jornada com asserções; F = falha; P = pendente.** E-preview usa correções locais e dados reais somente leitura. E-live é pós-publicação. E-fault verifica renderização, overflow, erros JS e vazamento de diagnóstico com API simulada; não aprova sozinho cada ação. Evidência privada: audit-artifacts/ (fora de Git, Docker e publicação).

## Rotas × larguras

Continuação solicitada em 27/09: as evidências abaixo pertencem à auditoria-base; não aprovam automaticamente as novas funcionalidades de PRODUCT_EVOLUTION.md. Os novos casos de prints estão em `tests/audit-print-regressions.spec.mjs` (24/24). A central pessoal usa `tests/personal-home.spec.mjs`, mais testes de lógica e SQL isolado. Publicação e QA desses acréscimos permanecem em acompanhamento.

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

### Novos estados após a auditoria-base

- `/`: central pessoal autenticada, visitante, vazio, falha recuperável, saída com resposta atrasada, continuação anime/mangá; `tests/personal-home.spec.mjs` e lógica/SQL. Publicado e bytes verificados em `6fe6dff1`.
- `/anime/:slug-id` e `/manga/:slug-id`, aba Franquia: sequência/release/extras/spin-offs, cronologia sem curadoria, progresso privado, sugestão de sequência, vazio, cobertura parcial, saída da conta/aba; `tests/franchise.spec.mjs`, testes de lógica/SQL. Estado naquela rodada: ainda não publicada; atualização de publicação na seção da release integrada ao final.
- `/minha-biblioteca?view=diary`: carregando, privado/vazio, erro/retry, período, registro anime/mangá, nota zero, spoiler, erro ao salvar preservando texto/chave, edição, confirmação de exclusão, card PNG, saída durante resposta e histórico voltar/avançar. `tests/diary.spec.mjs` e `tests/diary-database.mjs`. Estado naquela rodada: ainda não publicada, SQL real pendente do CI; atualização de publicação na seção da release integrada ao final.
- Novas telas com claro/escuro, medidas de reflow em 15 larguras, teclado e Axe; os PNGs estão em `audit-artifacts/diary-final`, `diary-cross-browser`, `franchise-fixed` e `personal-home-final`. Não substituir a inspeção visual pelos totais automatizados.

158 arquivos ativos; 176 candidatos de API. Inventário detalhado privado: audit-artifacts/inventory.json. Status de release e limites: FINAL_QA_REPORT.md. Reexecutar o gerador após terminar as rodadas pendentes.

### Home restaurada por orientação posterior — 27/09, 18:56 UTC

A proposta de central pessoal no topo e indicadores horizontais foi substituída. A abertura original permanece e somente a prateleira de continuidade fica entre Personagens e Vencedores. Sem indicadores extras em home/fichas/perfil. Evidências: 42/42 regressões em Chromium/Firefox/WebKit, claro/escuro, 15 larguras, visitante/vazio/falha/saída durante carregamento, teclado e links. Conta real somente leitura em produção: 390/1440px e ambos os temas, com capas e dados reais; PNGs inspecionados em `audit-artifacts/home-restoration-live`. Release isolada `5fe9fc689ca2`, 129 arquivos SHA verificados e HTTPS válido. Detalhes: `HOME_RESTORATION_20260927.md`. Demais funcionalidades seguem em validação, sem serem incluídas neste deploy.

### Previsões e espaçamento dos cards — release anterior 86286bb6c285

Artefato auditado: `86286bb6c2855121cbce0c39e06e80226e0cbc81`, sobre o ajuste de espaçamento `d9b6c3cbcbca0246826db8888400e4efc8e240b7`. Esta seção não altera nem reutiliza como aprovação da candidata os resultados de produção das releases anteriores.

**Estado histórico: publicada e validada em 16 combinações live, depois substituída pelo fluxo de notícias.** A primeira tentativa de atualização da API falhou por CRLF no empacotamento e teve rollback saudável. Após correção, o responsável pelo deploy confirmou a release `20260927T202100Z-86286bb6c285`, 33 checksums comparados dentro da imagem antes da ativação e 34 migrações aplicadas. O primeiro ciclo do worker publicou 10 perguntas reais, todas OPEN e sem votos no momento da checagem. Evidência operacional E-live histórica: 131 arquivos servidos com SHA exato, `release.json` estável antes/depois da conferência, HTTPS válido com certificado Let's Encrypt YE2 até 24/11/2026, health/db/cache saudáveis, GETs públicos verificados com HTTP 200 e endpoint privado anônimo com HTTP 401. O workflow editorial substituiu depois essa versão por `f7f7a73`; não usar os resultados desta seção para declarar a versão atual aprovada.

| Superfície / estado | Evidência na candidata | Limite da cobertura |
| --- | --- | --- |
| `/previsoes`: cartões, critérios, fonte, encerramento, janela de leitura e resultado | E-preview + T; Chromium, Firefox e WebKit; claro/escuro; 320, 390, 768 e 1440 px | PNGs de 390/1440 px; demais larguras da matriz-base continuam P para esta nova rota |
| Visitante, identidade indisponível, lista vazia, erro recuperável e recurso desativado | T; conteúdo público independente da consulta de identidade; visitante não envia voto nem consulta histórico privado | Identidade e API simuladas nos testes de navegador; não é login real de produção |
| Voto Sim/Não, troca de opção, clique concorrente, falha de gravação e encerramento | T; uma gravação por ação; escolha anterior preservada em falha; 409 impede nova mudança | Concorrência e horários também testados em PostgreSQL isolado; sem votos em contas de membros |
| Filtros, histórico pessoal, paginação, ranking e amostra pequena | T; paginação sem repetição, porcentagens coerentes e reputação inelegível explicada | Não afirmar ranking populado nem precisão estatística aferida com comunidade real |
| Links de notificação, mudança de alvo na mesma rota, hash nativo e voltar | T; alvo fora da primeira página e navegação com rota já montada | Notificação interna; push e e-mail não fazem parte desta entrega |
| `/`: seção compacta de Previsões e retorno da rota | T; hero existente preservado, ausência de seção vazia e de barras vermelhas extras | Não volta a central pessoal ao topo; continuidade mantém a posição já aprovada |
| `/comunidade`: seção de Previsões abaixo da abertura | T; posição e montagem sem duplicação | Sem redesign da página ou cópia visual do UpVer |
| `/anime/:slug-id` e `/manga/:slug-id`: previsões relacionadas na aba Geral | T; resposta atrasada não invade outra aba; retorno monta uma única seção | O worker inicial gera somente perguntas de nota para animes; não há geração automática para mangás |
| `/`: título e gêneros nos cards da prateleira de leitura | E-preview + T; três engines, claro/escuro; 320, 390, 768, 1440 e 1920 px | Título curto ocupa uma linha, longo até duas; intervalo de 0–6 px; capa, área de toque e rolagem preservadas |
| Worker: origem válida, deduplicação, limite semanal, 429, falha da fonte e reinício | T em lógica e banco real isolado; leitura pública AniList somente leitura | Não comprova operação contínua futura nem substitui a confirmação de saúde do worker implantado |

Totais desta rodada: **40/40** testes de core/worker, **40/40** verificações com PostgreSQL real isolado e **60/60** testes de navegador no artefato exato (**54** de Previsões + **6** de espaçamento). Axe foi executado na nova página para WCAG 2 A/AA e 2.1 AA; isso não representa certificação de acessibilidade de todo o site.

Referências: `tests/predictions.mjs`, `tests/predictions-worker.mjs`, `tests/predictions-database.mjs`, `tests/predictions.spec.mjs`, `tests/home-card-spacing.spec.mjs`. Artefatos: `audit-artifacts/api-release-86286bb6c285/`, `audit-artifacts/release-build-86286bb6c285/`, `audit-artifacts/predictions-release-exact/`; rodada visual anterior de espaçamento em `audit-artifacts/home-spacing-verified/`. Escopo, limitações e gates restantes: `PREVISOES_RELEASE_20260927.md`.

### Release integrada e proteção do deploy — fechamento do recorte em 27/09/2026

Runtime de regressão: `7f279fd699a8e694d6fc7d7530510e3cf2cdcb7a`. Commit publicado: `0902d355c8fe11cf76f0a51dc78ed868201a7139`. A diferença entre eles fica somente em feeds `data/news.json`/`data/trailers.json`, guard de `.github/workflows/update-news.yml` e `tests/deployment-safety.mjs`. A comparação dos artefatos confirmou 137 arquivos HTML/JS/CSS com hashes iguais; as diferenças de feeds verificadas ficaram em `generatedAt`/`duration`.

**Estado atual: E-live neste recorte; auditoria total não declarada concluída.** API e web `0902d355c8fe` foram ativadas às 20:47:43 UTC na release `20260927T204306Z-0902d355c8fe`. Foram aprovados 35 checksums dentro da imagem, 35 migrações aplicadas e 135 arquivos servidos exatos; HTTPS válido e saúde de todos os serviços confirmados. O worker está ativo: seu reinício publicou zero perguntas novas e preservou as 10 existentes, sem duplicação e com zero votos; um segundo ciclo também terminou corretamente, sem duplicatas. A etapa anterior em `f7f7a73`, sem worker, foi superada por esta publicação.

Causa confirmada da substituição: o workflow de notícias despachava deploy diretamente e aceitava push sem limitar branches, com checkout da referência disparadora. O workflow corrigido despacha qualidade, habilita `workflow_dispatch` em qualidade, limita push a `main` e faz checkout explícito de `main`; o gate de deploy depende da conclusão bem-sucedida de qualidade. **2/2** testes de segurança do deploy passaram. O CI geral ainda não tem confirmação verde, portanto não atribuir essa aprovação à pipeline inteira.

Adendo de CI: qualidade agora usa `cancel-in-progress` somente em evento `push`; despachos frequentes de notícias não cancelam uma análise em curso. `tests/deployment-safety.mjs` inclui a asserção correspondente. A correção foi publicada em `main` no commit `4d5559a0dd1a2ab75128e33870e74dab088c9356`; é apenas de workflow/teste, sem mudança de runtime nem necessidade de novo deploy. O runtime servido continua `0902d355c8fe` e a confirmação verde do CI geral permanece pendente.

| Área / estado novo | Evidência atual | Limite / pendência |
| --- | --- | --- |
| `/previsoes` e seções compactas: perguntas com data/hora de Brasília e links alinhados | 63/63 integrados; regras desconhecidas preservam a pergunta registrada; QA live final autenticado: 16 combinações, capas 3 mobile/8 desktop, zero erros/escritas | Leitura em produção; votos gravados foram testados somente em ambientes isolados |
| Comunidade e ficha de One Piece | E-live em 390/1440 px: três previsões na Comunidade e uma em One Piece, zero erros/escritas | Sem promessa de previsões para toda obra; V1 gera somente perguntas de nota de anime |
| Fichas anime/mangá, aba Franquia: grafo indisponível/incompleto, relações entre tipos e títulos não resolvidos | 21/21 na suíte específica; 18/18 integrados; leitura live: 31 obras/30 relações, capas 4 mobile/10 desktop em 390/1440 px, zero erros/escritas | Não inventa cronologia curada; estados de escrita reais não foram exercitados na conta do usuário |
| `/minha-biblioteca?view=diary` | Diário de `main` integrado; 18/18 testes de navegador aprovados | Não declarar todas as ações reais de gravação do Diário aprovadas em produção |
| `/`: espaçamento título/gêneros e rolagem existente | Seis testes integrados aprovados; QA live de leitura da release atual concluído | Demais larguras/estados não cobertos continuam com os status próprios da matriz |
| Pacote de runtime e operação | `npm run check` passou; 137 HTML/JS/CSS equivalentes; 135 arquivos servidos exatos; serviços/worker/HTTPS saudáveis | Observação contínua futura e CI geral não comprovados por essa fotografia |

**Rodada exata concluída: 105/105 testes de navegador**, divididos em 63 Previsões + 6 espaçamento + 18 Franquia + 18 Diário. Os status antigos de Diário/Franquia acima documentam o escopo daquela rodada; a release atual os integra e possui evidências posteriores específicas, sem reclassificar como aprovadas todas as ações históricas pendentes.

Gitleaks do CI apontou cinco falsos positivos históricos, inspecionados como chaves públicas de teste do Clerk, placeholder de `.env.example` e chaves de armazenamento do cliente. As exceções em `.gitleaksignore` usam fingerprints exatos. O binário 8.24.3 teve checksum oficial verificado; a varredura local de 1.275 commits, com essas exceções pontuais, não reportou vazamentos. O resultado geral do CI permanece sem confirmação verde.

**Limite da V1:** só `SCORE_AT_DEADLINE` é gerado/resolvido automaticamente. A primeira resolução real das perguntas publicadas é futura, em 05/10/2026; a lógica foi testada, mas não afirmar que esse evento já ocorreu em produção. O QA live registrado foi somente leitura, sem criação de votos nem alterações na biblioteca dos membros. A auditoria total do site continua fora da afirmação de conclusão deste recorte.

Artefatos: `audit-artifacts/api-release-7f279fd699a8/`, `audit-artifacts/release-build-7f279fd699a8/`, `audit-artifacts/api-release-0902d355c8fe/`, `audit-artifacts/release-build-0902d355c8fe/`; evidências específicas em `audit-artifacts/predictions-final-refinement/`, `audit-artifacts/franchise-fallback/`, `audit-artifacts/predictions-live/`, `audit-artifacts/predictions-embeds-live/` e `audit-artifacts/gitleaks-8.24.3/`. O detalhamento temporal está em `PREVISOES_RELEASE_20260927.md`.

