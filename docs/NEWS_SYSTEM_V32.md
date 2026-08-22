# AniNexus Notícias — arquitetura V32

## Objetivo

O sistema de notícias do AniNexus é um produto editorial interno. O usuário descobre e lê a matéria dentro do AniNexus; links externos não são usados como CTA de leitura.

O pipeline **não republica artigos integrais de terceiros**. Ele coleta fatos, metadados, imagens de apresentação quando utilizáveis, datas e informações estruturadas, consolida fontes e cria uma síntese própria em português.

## Fluxo de produção

1. `news-worker` consulta os adaptadores de fonte.
2. URLs são canonicalizadas e parâmetros de rastreamento removidos.
3. Itens duplicados da mesma URL são eliminados.
4. As páginas mais relevantes são enriquecidas por HTML/JSON-LD/Open Graph.
5. Título, resumo e fatos são traduzidos para PT-BR quando necessário.
6. `storyFingerprint` agrupa coberturas do mesmo acontecimento.
7. Fontes de uma mesma história são consolidadas em `sources`.
8. `buildEditorialArticle` cria a estrutura de leitura AniNexus.
9. A matéria recebe `quality_score`, tempo de leitura e contagem de palavras.
10. PostgreSQL recebe a matéria; a Home e `/noticias` leem somente a API nativa em produção.
11. Notícias automáticas expiram. Conteúdo editorial manual pode permanecer.

## Fontes atuais

- Crunchyroll Notícias
- Anime News Network
- MyAnimeList via Jikan
- eventos internos do AniNexus (estreias, finais e trailers detectados pelo catálogo/programação)

Novas fontes devem entrar como adaptadores no worker e produzir o mesmo formato normalizado: `sourceName`, `sourceLanguage`, `title`, `summary`, `url`, `imageUrl`, `publishedAt`, `author`.

## Retenção

Padrão: **5 dias** (`NEWS_RETENTION_DAYS=5`).

Limites aceitos pelo worker: 2 a 14 dias. A expiração se aplica somente a `source_kind='AUTOMATED'`.

Após expirar:

- a matéria passa para `archived`;
- deixa imediatamente o feed e a API pública;
- registros automáticos arquivados são apagados após 14 dias adicionais.

Isso mantém o feed atual sem apagar matérias editoriais próprias.

## Deduplicação

Há dois níveis:

### `source_hash`

SHA-256 parcial da URL canonicalizada. Impede a mesma matéria-fonte de entrar repetidamente.

### `story_hash`

Fingerprint semântico leve criado com termos relevantes do título e resumo. Serve para unir matérias diferentes que cobrem a mesma notícia.

Quando uma história já existe recentemente, o worker:

- atualiza `last_seen_at`;
- incorpora novas fontes;
- acrescenta fatos sem duplicá-los;
- melhora imagem/metadados quando possível;
- preserva o slug interno.

## Tradução

A tradução acontece no worker, nunca no navegador em produção.

- destino: PT-BR;
- cache Redis por 14 dias;
- título + resumo são traduzidos juntos para diminuir chamadas;
- fatos são traduzidos em lote;
- se o tradutor falhar, o ciclo não derruba o worker: a origem é preservada e pode ser atualizada no ciclo seguinte.

`NEWS_TRANSLATE_ENDPOINT` pode substituir o endpoint padrão por um serviço próprio compatível com query `q=`.

## Enriquecimento

Para os itens de maior prioridade de cada fonte, o worker visita a página original e procura:

- `NewsArticle` / `Article` em JSON-LD;
- `headline`;
- `description`;
- `image`;
- `author`;
- `datePublished`;
- `articleBody`/texto estruturado para extração limitada de fatos;
- fallback Open Graph/Twitter/meta tags;
- fallback limitado aos parágrafos de `<article>` quando disponível.

O conteúdo de terceiros é usado como matéria-prima factual; ele **não é persistido nem exibido integralmente**.

## Banco de dados

Campos editoriais importantes em `news_articles`:

- `slug`
- `source_kind`
- `event_type`
- `title`
- `summary`
- `body`
- `image_url`
- `source_name`
- `source_url` (proveniência interna)
- `source_hash`
- `story_hash`
- `sources`
- `facts`
- `content_sections`
- `original_title`
- `source_author`
- `source_language`
- `reading_minutes`
- `word_count`
- `quality_score`
- `first_seen_at`
- `last_seen_at`
- `view_count`
- `published_at`
- `expires_at`

A migração é `sql/004_news_editorial_pipeline.sql`.

## Ranking do feed

A API prioriza `quality_score` e depois recência.

O score melhora com:

- título suficientemente informativo;
- resumo mais completo;
- imagem válida;
- múltiplas fontes;
- mais de um fato confirmado;
- publicação recente.

Isso evita que um item vazio apenas por ser novo tome o principal destaque da Home.

## UI / leitura

### Home

`preview-v32/home-news-v32.js` consome `/api/news` em produção e transforma todas as chamadas em `/noticias/<slug>`.

### Hub

`/noticias` oferece:

- matéria principal;
- cards secundários;
- categorias;
- busca;
- tempo de leitura;
- estado de matéria já lida;
- design responsivo AniNexus.

### Artigo

`/noticias/<slug>` oferece:

- hero editorial;
- imagem;
- data e categoria;
- tempo de leitura;
- barra de progresso;
- bloco “Em resumo”;
- seções estruturadas;
- fontes monitoradas como crédito, sem CTA externo;
- explicação de metodologia editorial;
- notícias relacionadas;
- copiar link.

A leitura incrementa `view_count` no fetch do artigo.

## Resiliência

- cada fonte roda dentro de `Promise.allSettled`;
- falha de uma fonte não derruba as demais;
- fetches têm timeout;
- tradução possui fallback;
- Redis é cache, não requisito para persistência;
- PostgreSQL é a fonte de verdade;
- GitHub Pages usa `data/news.json` somente como demonstração/fallback estático.

## Configuração

```env
NEWS_WORKER_INTERVAL_MS=300000
NEWS_RETENTION_DAYS=5
NEWS_MAX_PER_SOURCE=12
NEWS_ENRICH_PER_SOURCE=6
NEWS_MAX_SOURCE_AGE_HOURS=120
NEWS_TRANSLATE_ENDPOINT=
```

## Testes

`npm run check` inclui:

- sintaxe dos runtimes críticos;
- `tests/news-system.mjs` para o pipeline puro;
- `tests/smoke.mjs` para contratos de integração.

O workflow também roda Playwright em desktop/mobile para:

- Home;
- notícia interna a partir da Home;
- hub;
- filtros/busca;
- leitor;
- ausência de CTA externo;
- overflow mobile;
- regressões em catálogo, detalhes, temporadas e programação.
