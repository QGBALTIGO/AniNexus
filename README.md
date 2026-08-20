# AniNexus — calendário automático de animes

Projeto estático, responsivo e sem dependências de build. A programação é consultada diretamente no AniList via GraphQL; se o AniList falhar, o front tenta Jikan (dados do MyAnimeList) como contingência. A interface usa o horário `America/Sao_Paulo` e renova a programação automaticamente a cada 45 segundos, ao voltar para a aba e ao recuperar conexão.

## Executar localmente

Como o navegador restringe service workers em `file://`, sirva a pasta por HTTP:

```bash
npx http-server . -p 8080
```

Abra `http://localhost:8080`.

## Docker / VPS

```bash
docker compose up -d --build
```

A aplicação ficará em `http://SEU_IP:8080`.

Para usar um domínio, aponte seu Nginx/Caddy principal para `127.0.0.1:8080`.

## Recursos implementados

- calendário móvel de hoje + 6 dias;
- horário fixado em Brasília;
- atualização automática sem recarregar a página;
- AniList como fonte principal;
- fallback Jikan/MAL;
- cache local de contingência para indisponibilidade temporária;
- identificação de estreia e episódio final quando a fonte fornece total de episódios;
- nota, gêneros e capa;
- links oficiais de streaming quando o AniList informa;
- filtro “Meus animes” persistente em localStorage;
- modo “Onde assistir”;
- busca instantânea com `Ctrl+K`;
- modal de detalhes;
- animações, skeleton loading, microinterações e suporte a `prefers-reduced-motion`;
- responsivo para desktop, tablet e celular;
- PWA/service worker;
- Docker/Nginx prontos.

## Observação sobre precisão

O front não inventa horários: exibe o `airingAt` publicado pelo AniList e converte para Brasília. Nenhum sistema que consome uma API externa consegue garantir um episódio antes de a própria fonte atualizar o dado. O polling de 45 s e a atualização ao focar a aba minimizam atraso do lado do AniNexus.

## Identidade

Paleta principal: `#ef233c`.
Logo: arquivo enviado pelo proprietário do projeto, com versões otimizadas na pasta `assets/`.
