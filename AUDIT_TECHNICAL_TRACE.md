# Rastreabilidade das correções

A ordem abaixo corresponde aos 47 registros de AUDIT_REPORT.md. P1: impede ou desvia uma jornada essencial; P2: prejudica uso, recuperação ou acessibilidade; P3: acabamento/estabilidade visual. São prioridades de produto, não classificação de vulnerabilidades.

V15: 320, 360, 375, 390, 393, 412, 430, 480, 768, 820, 1024, 1280, 1366, 1440 e 1920. MD: 390 e 1440, temas claro/escuro. As larguras indicam a evidência visual da família; o teste funcional citado pode usar uma largura representativa. Não são testes de aparelho físico.

| ID / problema | Prioridade | Rota ou componente / estado | Arquivo proprietário principal | Evidência |
|---|---|---|---|---|
| 01 Busca de mangá | P1 | busca global / abrir resultado | preview-v8/app.js; preview-v23/router-v23.js | total-audit; V15 |
| 02 Resposta de busca antiga | P1 | busca / digitação e troca de tipo | preview-v8/app.js | total-audit; MD |
| 03 Busca vazia e erro | P2 | busca / vazio, erro, retry | preview-v8/app.js | total-audit; MD |
| 04 Retorno de foco da busca | P2 | cabeçalho / teclado e Safari | preview-v8/app.js | total-audit; navegação 66 rotas |
| 05 Histórico | P1 | router / back e forward | preview-v23/route-guard-v23.js | total-audit; navegação 66 rotas |
| 06 Aliases | P1 | 12 destinos antigos / entrada direta | preview-v23/route-guard-v23.js | total-audit; V15 |
| 07 Source sem token | P2 | /conectar-source / link inválido | preview-v38/auth-v38.js | total-audit; V15 |
| 08 Biblioteca grande | P1 | atividade / 2.000 registros | preview-v40/activity-v40.js | tests/community-activity.mjs |
| 09 Detalhe sem identidade | P1 | /anime/:id e /manga/:id / vazio | preview-v22/detail-v22.js | total-audit; V15 |
| 10 Detalhe concorrente | P1 | detalhe / resposta fora de ordem | preview-v22/detail-v22.js | total-audit; MD |
| 11 Tema claro divergente | P2 | famílias compartilhadas / claro | preview-v21/design-system.css; preview-v42/product-v42.css | accessibility; V15 |
| 12 Widget de autenticação | P2 | /login e /criar-conta / tema e rascunho | preview-v38/auth-v38.js; auth-v38.css | real-auth-theme; MD |
| 13 Semântica legal | P2 | termos, privacidade, DMCA / normal | preview-v14/legal.js; legal.css | accessibility; V15 |
| 14 Labels DMCA | P2 | /dmca / formulário | preview-v14/legal.js | audit-forms; MD |
| 15 Prazo e duplo envio | P1 | contato e DMCA / lento e cliques repetidos | preview-v14/legal.js; preview-v15/institutional.js | audit-forms |
| 16 Feedback de envio | P2 | formulários / erro e timeout ambíguo | mesmos handlers de formulário | audit-forms |
| 17 Modal da programação | P2 | /animes/programacao / filtros | preview-v18/schedule.js; schedule.css | total-audit; MD |
| 18 Espaçamento de temporada | P3 | /animes/temporadas/* / normal | preview-v21/section-chrome.css | audit-content-states; V15 |
| 19 Busca em tablet | P1 | cabeçalho / 721–1179 | preview-v42/header-v43.css | audit-content-states; fronteiras nos três motores |
| 20 Consentimento | P2 | consentimento / dois temas | preview-v38/core-v38.css | accessibility; MD |
| 21 Marcas claras | P2 | logos / tema claro | preview-v42/product-v42.css | accessibility; V15 |
| 22 Fallback de imagem | P2 | hero e cards / imagem quebrada | preview-v42/product-v42.css | audit-content-states; V15 |
| 23 Títulos longos | P2 | detalhe / texto sem espaços | preview-v22/detail-v22.css | audit-content-states; V15 |
| 24 Sinopse ausente | P2 | detalhe / dados parciais | preview-v22/detail-v22.js | audit-content-states |
| 25 Carrossel Firefox | P1 | rails / clique e rolagem | preview-v21/design-system.css | e2e; repetição Chromium/Firefox/WebKit |
| 26 Perfil lento | P1 | /u/:nome / timeout e troca de rota | preview-v38/profile-v38.js | total-audit; fault pass V15 |
| 27 Conquistas lentas | P1 | /conquistas / timeout | preview-v44/achievements-v44.js | total-audit; fault pass V15 |
| 28 Carregamentos sem prazo | P1 | descoberta, listas, temporada, agenda, comunidade / offline e timeout | preview-v38/runtime-v38.js; consumidores por família | total-audit; fault pass 66 rotas |
| 29 Contadores presos | P2 | descoberta / erro | preview-v44/discovery-v47.js | total-audit; fault pass V15 |
| 30 Notícias sem término | P1 | /noticias / promise sem abort | preview-v35/news-data-v35.js | total-audit |
| 31 Enriquecimento bloqueante | P1 | notícias / imagem e provedor lentos | preview-v37/news-hot-v37.js | total-audit |
| 32 Aceite legal em inglês | P2 | /criar-conta / Clerk real | preview-v38/auth-v38.js | real-auth-theme |
| 33 Admin após sair da rota | P1 | /admin / resposta tardia | preview-v38/admin-v38.js | total-audit; 18 regressões |
| 34 Contraste admin | P2 | cinco painéis / dois temas | preview-v38/admin-v38.css | post-release-admin-panels; MD |
| 35 Ação de cadastro | P2 | temporadas / visitante | preview-v21/section-chrome.css | total-audit; três motores |
| 36 Conteúdo do artigo | P2 | notícia completa / blocos ricos claros | preview-v36/news-v36.css | total-audit; MD e Axe |
| 37 Cabeçalho do artigo | P2 | notícia completa / claro e móvel | preview-v35/news-ui-v35.js; preview-v36/news-v36.css | total-audit; 24 repetições |
| 38 Nome de filtros | P2 | biblioteca / móvel autenticado | preview-v38/library-unified-v49.js | total-audit; MD e Axe |
| 39 Conta e Source | P2 | conta / conectado, ausente, erro | preview-v44/account-v56.css | total-audit; member-panels |
| 40 Teclado no editor | P2 | editor de perfil / abrir, Tab, Escape | preview-v38/profile-v38.js; auth-v38.js | total-audit; três motores |
| 41 Privacidade e importação claras | P2 | editor / três abas e rolagem | preview-v38/profile-v38.css | total-audit; member-panels e Axe |
| 42 Notificações ilegíveis | P2 | painel / lidas, novas, vazio | preview-v42/header-v43.css | total-audit; MD e Axe |
| 43 Retorno de notificações | P2 | cabeçalho / Safari e Escape | preview-v42/header-v43.js | total-audit; três motores |
| 44 Primária da biblioteca | P2 | filtros / dois temas | preview-v38/library-unified-v49.css | total-audit; MD e Axe |
| 45 Foco da biblioteca | P2 | filtros / aplicar, limpar, Escape | preview-v38/library-unified-v49.js; library-unified-v49.css | total-audit; 12/12 repetidos |
| 46 Rodapé durante montagem | P3 | todas / carregamento e auth | preview-v44/experience-v44.css; preview-v38/library-v38.css | total-audit; performance-layout-retest |
| 47 Pódio durante montagem | P3 | /comunidade / lento e vazio | preview-v40/community-v40.js; community-v40.css | total-audit; performance-layout-retest |

Os diretórios de capturas, JSON, sessões e traces são privados e ignorados pelo versionamento e pela imagem de produção. O CI conserva apenas artefatos de falha de fixtures, com retenção curta. Atualizações de data/news.json e data/trailers.json são editoriais automáticas e foram preservadas, não reescritas como parte do design.
