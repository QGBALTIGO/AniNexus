# AniNexus

Plataforma full-stack brasileira para descobrir, acompanhar e conversar sobre animes, mangás e light novels.

## Comece por aqui

Para trabalhar no código, leia primeiro:

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — fonte de verdade, runtime atual e mapa das camadas;
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — regras para alterações e organização;
- [`legacy/README.md`](legacy/README.md) — o que é histórico e não deve receber código novo.

## Estrutura

```text
AniNexus/
├── assets/          recursos estáticos permanentes
├── data/            snapshots/fallbacks de notícias
├── docs/            documentação técnica
├── legacy/          versões históricas fora do runtime
├── lib/             serviços do backend
├── preview-v*/      somente camadas que ainda participam do runtime
├── public/          saída/fallback servido pelo backend
├── scripts/         build, manutenção e validações
├── sql/             schema e migrações
├── tests/           regressão, smoke e E2E
├── index.html       shell/fonte de verdade do frontend
└── server.mjs       composição HTTP/API Fastify
```

As pastas `preview-vXX` que ainda estão na raiz são módulos de compatibilidade ativos do mesmo frontend; versões totalmente substituídas ficam em `legacy/`.

## Desenvolvimento

```bash
npm install
npm run check
npm run build:public
npm run dev
```

`npm run check` valida sintaxe, regressões e também a organização do repositório. Uma nova pasta `preview-vXX` não classificada faz o check falhar.

## Produção

```bash
cp .env.example .env
# configure POSTGRES_PASSWORD, IP_HASH_SALT e demais variáveis

docker compose up -d --build
```

Por padrão a aplicação fica disponível na porta pública configurada pelo Compose.

Para HTTPS/domínio:

```bash
PUBLIC_ORIGIN=https://seu-dominio.com
COOKIE_SECURE=true
```

## Principais áreas

- Home, catálogo, temporadas e programação;
- detalhes de anime e opções oficiais de streaming;
- conta, autenticação, favoritos, listas e progresso;
- comunidade, impressões e discussões;
- notícias internas em português;
- PostgreSQL, Redis, cache, rate limits e headers de segurança;
- Docker Compose + Nginx;
- GitHub Pages para o frontend estático.

## Regra importante

Não crie uma nova `preview-vXX` para cada correção. Corrija o módulo atual responsável pela funcionalidade. Uma nova camada versionada só deve existir quando houver necessidade real de rollout/cache/compatibilidade e isso deve ser documentado.
