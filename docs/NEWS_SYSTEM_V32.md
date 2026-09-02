# AniNexus Notícias - arquitetura de fidelidade à fonte

## Princípio editorial

O AniNexus não traduz, resume, combina nem reescreve automaticamente o título ou o corpo de uma notícia. O fluxo ativo é:

`fonte -> extrair -> remover ruído técnico -> salvar -> exibir`

A classificação de categoria e as tags são metadados. Elas não alteram o material publicado pela fonte.

## Fontes

- JBox: WordPress REST, com título, autor, imagem e corpo fornecidos pelo portal.
- ANMTV: WordPress REST, com os mesmos campos estruturados.
- AnimeNew: RSS oficial com `content:encoded`.
- GNews API: opcional por `GNEWS_API_KEY`, usada como descoberta e prévia PT-BR.

O GNews é sempre tratado como `excerpt`, pois a disponibilidade do corpo depende do plano e a resposta não preserva a ordem editorial de mídia. A documentação da API confirma os filtros `lang=pt` e `country=br`.

O corpo completo só entra pelo feed ou API estruturada que a própria fonte disponibiliza. O coletor não visita páginas para reconstruir ou ampliar matérias incompletas.

## Modelo de conteúdo

`source_content` é um array JSONB ordenado. Blocos aceitos:

- `paragraph`, com texto e trechos marcados como negrito, itálico, código ou link;
- `heading`, com nível de 2 a 4;
- `image`, com URL, texto alternativo e legenda;
- `video`, para YouTube, Vimeo ou arquivo de vídeo direto;
- `list`, ordenada ou não ordenada;
- `blockquote`;
- `table`;
- `divider`.

O parser usa uma árvore HTML real. Scripts, formulários, publicidade, newsletter, compartilhamento, conteúdo relacionado e imagens de rastreamento são descartados. O navegador recebe apenas tipos e atributos permitidos, sem HTML arbitrário da fonte.

## Modos

- `full`: a fonte forneceu um corpo com conteúdo suficiente e sua ordem foi preservada.
- `excerpt`: o feed forneceu somente uma prévia; o leitor mostra apenas o trecho disponível e nunca inventa uma continuação.
- `editorial`: reservado para conteúdo escrito no painel do AniNexus.
- `legacy`: registros anteriores à migração de fidelidade.

Após um ciclo saudável com pelo menos seis matérias no modelo novo, o worker arquiva registros automáticos `legacy`. Assim, textos montados pelo pipeline antigo deixam de reaparecer.

## Deduplicação

`source_hash` remove URLs repetidas. Depois, `sameAnnouncement` compara os termos relevantes dos títulos publicados nas últimas 72 horas. Quando duas fontes cobrem o mesmo anúncio, fica a versão com corpo completo, fonte prioritária e maior conteúdo, sem misturar os textos.

## Banco de dados

A migração `sql/018_news_source_fidelity.sql` adiciona:

- `source_content jsonb`;
- `content_mode text`;
- os mesmos campos na tabela de revisões;
- suporte a títulos originais de até 500 caracteres.

Os campos existentes `original_title`, `source_author`, `source_name`, `source_url`, `source_published_at`, `image_url` e `sources` continuam registrando procedência.

## Interface

O leitor renderiza `source_content` na ordem recebida, incluindo imagens e vídeos. Autor e data entram como metadados discretos; `source_name` e `source_url` permanecem internos, sem chamada ou link externo na interface. Para registros antigos, `content_sections` permanece como fallback temporário.

Na Home, telas acima de 1000 px usam uma grade equilibrada de três colunas e duas linhas. Em telas menores, continua o desenho aprovado: uma notícia principal e as demais em trilho horizontal.

## Resiliência

- fontes são consultadas com `Promise.allSettled`;
- falha de uma fonte não interrompe as demais;
- uma GNews sem chave aparece como desativada, não como falha;
- um ciclo vazio não sobrescreve o último feed legível;
- o modo de graça usa o feed anterior apenas quando há menos de dez matérias novas;
- PostgreSQL guarda o conteúdo de produção e `data/news.json` atende o fallback estático.

## Configuração

```env
NEWS_WORKER_INTERVAL_MS=300000
NEWS_RETENTION_DAYS=7
NEWS_STALE_GRACE_DAYS=14
NEWS_MAX_PER_SOURCE=45
NEWS_MAX_STORIES=60
NEWS_MAX_SOURCE_AGE_HOURS=168
NEWS_MIN_QUALITY=0.50
GNEWS_API_KEY=
```
