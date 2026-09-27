# Home: correção solicitada em 27/09

Esta orientação substitui a proposta de central personalizada e os indicadores de posição de PRODUCT_EVOLUTION.md. Não reabre as demais funcionalidades do projeto.

- Abertura original restaurada para visitantes e membros; sem "Hoje, no seu ritmo", agenda pessoal ou pendências na home.
- Apenas "Continue de onde parou", entre Top Personagens e Vencedores de 2026. Mesma grade, capas verticais, dimensões, espaçamento e controles das demais prateleiras.
- Sem prateleira para visitante/conta sem progresso. Dados privados descartados ao sair; erro recuperável restrito à prateleira.
- Removidos os indicadores `nx61-scroll-track` de home, fichas e perfil; preservadas rolagem, setas, teclado e indicação da aba selecionada.
- Chromium: 14/14 regressões; Firefox + WebKit: 28/28. Claro/escuro e 15 larguras (320–1920). PNGs inspecionados em `audit-artifacts/home-revert-qa` e `home-revert-cross-browser`.
- Temporada/programação: API pública e navegador de produção responderam normalmente (22 obras/6 cartões de horários). A falha do print não foi reproduzida; não há evidência para atribuí-la à prateleira privada.

Publicar isoladamente a partir da versão de produção `6fe6dff1`, sem incluir franquias/diário/estatísticas ainda em validação. A execução de qualidade anterior de `79a899e9` revelou um teste legado da franquia quebrado; essa release não foi aprovada para deploy. Preservar trabalho em andamento. O hotfix deve também permanecer na linha de desenvolvimento para não ser perdido em uma próxima publicação.

Verificação da conta real é somente leitura com `scripts/audit-home-restoration.mjs`. Release e evidência pós-publicação serão registradas após confirmar os arquivos servidos.
