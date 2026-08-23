# Arquitetura do AniNexus

Este documento existe para evitar que o projeto volte a crescer por sobreposição de versões sem uma fonte de verdade clara.

## Fonte de verdade

- `index.html`: shell usado pelo GitHub Pages e base do build de produção.
- `server.mjs`: API/servidor Fastify.
- `lib/`: serviços do backend (auth, banco, cache, providers, notícias e analytics).
- `sql/`: schema e migrações.
- `scripts/`: build e automações de manutenção.
- `tests/`: contratos e testes de regressão.
- `assets/`: imagens e recursos estáticos permanentes.
- `data/`: snapshots/feed de notícias usado como fallback estático.
- `public/`: saída/fallback de frontend para execução pelo servidor; não é uma segunda fonte de verdade.
- `legacy/`: versões históricas preservadas somente para consulta. Não adicionar imports novos para essa pasta.

## Runtime de frontend atual

O frontend ainda possui camadas `preview-vXX` porque partes antigas continuam sendo usadas como compatibilidade. As únicas versões permitidas na raiz são as que ainda participam do runtime atual:

`preview-v6`, `preview-v8`, `preview-v9`, `preview-v10`, `preview-v11`, `preview-v12`, `preview-v14`, `preview-v15`, `preview-v18`, `preview-v19`, `preview-v20`, `preview-v21`, `preview-v22`, `preview-v23`, `preview-v24`, `preview-v27`, `preview-v32`, `preview-v33`, `preview-v35`, `preview-v36`, `preview-v37`, `preview-v38`, `preview-v39`, `preview-v40`.

Esses diretórios não significam que existem 24 aplicações diferentes. Eles são módulos/camadas de compatibilidade carregados pelo mesmo shell.

### Camadas principais

- **V40**: comunidade e atividade social atual.
- **V39**: ações globais de mídia e sincronização de estado.
- **V38**: autenticação, conta, biblioteca e runtime base moderno.
- **V35–V37**: Home e notícias atuais.
- **V22–V24**: detalhe de anime e guards de rotas.
- **V18–V21**: programação, estado de mídia, catálogo e componentes compartilhados.
- **V6–V15**: compatibilidade visual/institucional ainda carregada pelo shell.

## Regra para novas mudanças

Não crie uma nova pasta `preview-vXX` apenas para corrigir um componente. Prefira alterar o módulo atual responsável pela funcionalidade.

Uma nova camada versionada só deve existir quando houver necessidade real de compatibilidade de rollout/cache. Caso contrário:

1. encontre o módulo dono da funcionalidade;
2. altere esse módulo;
3. atualize os testes;
4. mantenha o mesmo ponto de entrada.

## Fluxo de build

1. `index.html` define os arquivos locais carregados pelo shell.
2. `scripts/build-public.mjs` copia o shell e somente os diretórios de runtime permitidos para `public/`.
3. o Docker remove fontes que não precisam permanecer na imagem final.
4. GitHub Pages usa o shell da raiz diretamente.

## Backend

`server.mjs` deve ficar responsável apenas por composição HTTP/rotas. Lógica reutilizável deve continuar em `lib/`.

- autenticação: `lib/auth.mjs`
- banco: `lib/db.mjs`
- cache: `lib/cache.mjs`
- catálogo/providers: `lib/provider.mjs`
- notícias: `lib/news-*.mjs` e `lib/native-news.mjs`
- analytics: `lib/analytics.mjs`

## Histórico

Versões totalmente substituídas foram movidas para `legacy/preview-vXX`. Elas permanecem no Git para consulta e comparação, mas não devem voltar a ser importadas pelo runtime atual.
