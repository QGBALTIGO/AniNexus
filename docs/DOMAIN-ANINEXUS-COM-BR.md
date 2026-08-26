# Domínio de produção — aninexus.com.br

Este documento descreve a configuração de domínio do AniNexus.

## Domínio principal

- https://aninexus.com.br
- https://www.aninexus.com.br -> redireciona para https://aninexus.com.br

## DNS

Os nameservers atuais do domínio estão na Hostinger (`ns1.dns-parking.com` / `ns2.dns-parking.com`). Portanto, os registros DNS devem ser criados no painel DNS da Hostinger, não no Registro.br.

Registros esperados:

- `A` — host `@` — aponta para o IPv4 público da VPS de produção.
- `CNAME` — host `www` — aponta para `aninexus.com.br`.

Não criar CNAME para o apex (`@`).

## Produção

O stack de produção é o `docker-compose.yml` deste repositório, com Nginx na borda e Fastify no app.

Variáveis recomendadas:

```env
PUBLIC_ORIGIN=https://aninexus.com.br
COOKIE_SECURE=true
```

## GitHub Pages

O GitHub Pages permanece como ambiente de preview/fallback e não deve assumir o domínio principal de produção.
