# AniNexus

Plataforma full-stack de descoberta, catálogo, temporadas, programação, rankings, perfis e listas pessoais de animes.

## O que já está implementado

- página inicial com destaques, temporada, próximos episódios e populares;
- catálogo com busca, gênero, formato, ordenação e paginação;
- temporadas por estação e ano;
- calendário semanal em horário de Brasília com atualização silenciosa;
- páginas individuais de anime com banner, capa, notas, gêneros, detalhes, personagens, equipe, relações, recomendações e opções de streaming quando disponíveis;
- páginas Onde Assistir, Dublados, Estúdios e rankings;
- criação de conta, login, logout, sessões persistentes e listas pessoais;
- status Quero Ver, Assistindo, Terminei, Pausei e Desisti;
- impressões/comentários por anime com marcação de spoiler;
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

```env
COOKIE_SECURE=true
```

Depois:

```bash
docker compose up -d
```

## Banco de dados

O schema é aplicado automaticamente ao iniciar. Os volumes `postgres_data` e `redis_data` preservam dados entre atualizações.

## Segurança

- senhas: Argon2id;
- sessão opaca em cookie HttpOnly, SameSite=Lax e Secure quando HTTPS está ativado;
- rate limit em autenticação, comentários e formulários;
- validação de payload com Zod;
- validação de origem em operações mutáveis;
- Content-Security-Policy, Referrer-Policy e Permissions-Policy;
- limite de corpo HTTP;
- IP armazenado apenas como hash salgado em sessões.

Antes de produção pública, mantenha o banco e Redis sem portas públicas e use HTTPS/WAF/CDN no domínio.

## Curadoria interna

A tabela `media_annotations` existe para o AniNexus confirmar informações próprias, como título em português, sinopse editorial, dublagem, legendas e disponibilidade. Informações de dublagem só são exibidas como confirmadas quando cadastradas nessa tabela.
