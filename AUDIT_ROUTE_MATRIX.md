# AUDIT_ROUTE_MATRIX

Atualizado em 2026-09-27T14:26:24.390Z. Base inicial: 6ed65bb4162c164d3b078728dfd0ade184343b90; atualização editorial 39c65a545261 incorporada durante a auditoria.

**E = evidência renderizada; T = jornada com asserções; F = falha; P = pendente.** E-preview usa correções locais e dados reais somente leitura. E-live é pós-publicação. E-fault verifica renderização, overflow, erros JS e vazamento de diagnóstico com API simulada; não aprova sozinho cada ação. Evidência privada: audit-artifacts/ (fora de Git, Docker e publicação).

## Rotas × larguras

| Rota | Família | 320 | 360 | 375 | 390 | 393 | 412 | 430 | 480 | 768 | 820 | 1024 | 1280 | 1366 | 1440 | 1920 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| / | home | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /animes/catalogo | catalog | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /mangas | catalog | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /light-novels | catalog | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /animes/programacao | schedule | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /animes/temporadas | season | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /animes/temporadas/2026/inverno | season | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /animes/temporadas/2026/primavera | season | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /animes/temporadas/2026/verao | season | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /animes/temporadas/2026/outono | season | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /animes/onde-assistir | discovery | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /animes/dublados | discovery | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /animes/estudios | discovery | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /listas-de-animes | lists | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /melhores-animes-para-assistir | lists | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /animes-mais-assistidos | lists | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /animes-mais-aguardados | lists | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /animes-em-alta | lists | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /filmes-de-anime | lists | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /animes-curtos | lists | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /animes-de-acao | lists | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /animes-de-romance | lists | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /animes-de-fantasia | lists | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /animes-de-comedia | lists | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /animes-de-misterio | lists | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /animes-de-esporte | lists | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /animes-de-terror | lists | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /descubra | lists | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /anime/naruto-20 | detail | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /anime/one-piece-21 | detail | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /anime/cowboy-bebop-1 | detail | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /manga/one-piece-30013 | detail | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /manga/solo-leveling-105398 | detail | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /noticias | news | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /noticias/draw-this-then-die-ganha-2-temporada-animenew-197c1986 | news | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /noticias/qa-noticia-inexistente | news | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /comunidade | community | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /anime-awards | awards | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /conquistas | achievements | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /login | auth | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /criar-conta | auth | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /conectar-source | auth | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /minha-conta | account | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /minha-biblioteca | library | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /meus-animes | library | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /meus-mangas | library | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /u/Diego | profile | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /u/qa-perfil-inexistente | profile | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /admin | admin | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /quem-somos | institutional | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /colabore | institutional | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /contato | institutional | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /termos-de-uso | legal | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /politica-de-privacidade | legal | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /dmca | legal | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /qa-rota-inexistente | notfound | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /animes | alias | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /catalogo | alias | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /programacao | alias | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /temporadas | alias | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /news | alias | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /community | alias | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /manga | alias | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /entrar | alias | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /cadastro | alias | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |
| /conta | alias | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview | E-preview |

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
| /animes/onde-assistir | T-nav | F | F | F | F | F | E-fault |
| /animes/dublados | T-nav | F | F | E-fault | E-fault | F | E-fault |
| /animes/estudios | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /listas-de-animes | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /melhores-animes-para-assistir | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /animes-mais-assistidos | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /animes-mais-aguardados | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /animes-em-alta | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /filmes-de-anime | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /animes-curtos | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /animes-de-acao | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | F |
| /animes-de-romance | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | F |
| /animes-de-fantasia | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | F |
| /animes-de-comedia | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | F |
| /animes-de-misterio | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | F |
| /animes-de-esporte | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | F |
| /animes-de-terror | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | F |
| /descubra | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | F |
| /anime/naruto-20 | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /anime/one-piece-21 | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /anime/cowboy-bebop-1 | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /manga/one-piece-30013 | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /manga/solo-leveling-105398 | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /noticias | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /noticias/draw-this-then-die-ganha-2-temporada-animenew-197c1986 | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /noticias/qa-noticia-inexistente | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /comunidade | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | F |
| /anime-awards | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /conquistas | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | F |
| /login | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /criar-conta | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /conectar-source | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /minha-conta | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /minha-biblioteca | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /meus-animes | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /meus-mangas | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | E-fault |
| /u/Diego | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | F |
| /u/qa-perfil-inexistente | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | F |
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
| /community | T-nav | E-fault | E-fault | E-fault | E-fault | E-fault | F |
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
