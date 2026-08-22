# AniNexus

Plataforma full-stack de descoberta, catálogo, temporadas, programação, rankings, perfis, listas pessoais, comunidade e notícias de animes.

## O que já está implementado

- página inicial com identidade visual própria do AniNexus, temporada, próximos episódios, notícias, mangás/light novels, rankings, premiações, impressões e comunidade;
- catálogo com busca, gênero, formato, ordenação e paginação;
- temporadas por estação e ano;
- calendário semanal em horário de Brasília com atualização silenciosa;
- páginas individuais de anime com banner, capa, notas, gêneros, detalhes, personagens, equipe, relações, recomendações e opções de streaming quando disponíveis;
- páginas Onde Assistir, Dublados, Estúdios e rankings;
- criação de conta, login, logout, sessões persistentes e listas pessoais;
- status Quero Ver, Assistindo, Terminei, Pausei e Desisti;
- impressões/comentários por anime com marcação de spoiler;
- notícias nativas: `/noticias` e `/noticias/:slug`, sem depender de mandar o usuário para outro site para leitura;
- PostgreSQL para notícias com título, resumo, corpo editorial, imagem, metadados de origem e expiração;
- retenção configurável por `NEWS_RETENTION_DAYS` (padrão: 5 dias) para manter o feed recente;
- pipeline de tradução/síntese em português que gera texto próprio do AniNexus a partir de informações públicas, sem copiar integralmente matérias externas;
- tema claro/escuro;
- busca global com Ctrl/Cmd + K;
- páginas Quem Somos, Colabore, Contato, Termos, Privacidade e DMCA;
- formulários de contato e DMCA armazenados no banco;
- PostgreSQL, Redis, rate limits, CSP, headers de segurança e hash Argon2id;
- Docker Compose com aplicação, Nginx, PostgreSQL e Redis;
- cache de dados e sincronização de programação no backend;
- PWA e navegação responsiva para desktop, tablet, celular e telas grandes.

## Subir na VPS

```bash
cp .env.example .env
nano .env
# troque POSTGRES_PASSWORD e IP_HASH_SALT

docker compose up -d --build
```

Acesse `http://IP_DA_VPS:8080`.

### HTTPS / domínio

Quando o domínio estiver atrás de HTTPS, altere no `.env`:

```bash
PUBLIC_ORIGIN=https://seu-dominio.com
COOKIE_SECURE=true
```
