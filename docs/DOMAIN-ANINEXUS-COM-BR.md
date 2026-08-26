# Domínio de produção — aninexus.com.br

Este documento descreve a configuração de domínio do AniNexus.

## Domínio principal

- https://aninexus.com.br
- https://www.aninexus.com.br -> redireciona para https://aninexus.com.br

## DNS

Os nameservers atuais do domínio estão na Hostinger (`ns1.dns-parking.com` / `ns2.dns-parking.com`). Portanto, os registros DNS devem ser criados no painel DNS da Hostinger, não no Registro.br.

Registros de produção:

| Tipo | Nome/Host | Valor/Destino | TTL |
| --- | --- | --- | --- |
| `A` | `@` | `187.77.255.164` | `300` ou padrão |
| `CNAME` | `www` | `aninexus.com.br` | `300` ou padrão |

Remova registros `A`, `AAAA` ou `CNAME` conflitantes para `@`/`www` antes de adicionar estes. Não crie CNAME para o apex (`@`).

Não altere os nameservers enquanto o DNS estiver sendo administrado pela Hostinger.

## Produção

O domínio oficial e a API usam a mesma origem:

```env
PUBLIC_ORIGIN=https://aninexus.com.br
PUBLIC_SITE_ORIGIN=https://aninexus.com.br
PUBLIC_API_ORIGIN=https://aninexus.com.br
COOKIE_SECURE=true
CLERK_AUTHORIZED_PARTIES=https://aninexus.com.br,https://www.aninexus.com.br,https://qgbaltigo.github.io
```

O stack de produção mantém o app/API internamente em `127.0.0.1:18080`; o Nginx do host termina HTTPS em 443 e entrega os arquivos estáticos/API.

## HTTPS / Let's Encrypt

Depois de o DNS resolver para a VPS, execute na raiz de uma cópia atual deste repositório na VPS:

```bash
sudo bash ops/install-domain-tls.sh aninexus.com.br
```

O script:

1. salva backup da configuração Nginx atual;
2. ativa temporariamente a configuração ACME em HTTP;
3. emite um certificado Let's Encrypt para `aninexus.com.br` e `www.aninexus.com.br`;
4. instala a configuração HTTPS definitiva;
5. salva backup da configuração protegida da API e troca as origens para o domínio;
6. recria apenas o processo da aplicação, sem reiniciar banco, cache ou outros projetos;
7. ativa renovação automática;
8. testa site, API, certificado e redirecionamento de `www`;
9. restaura Nginx e configuração da API automaticamente se alguma validação falhar.

O workflow `.github/workflows/configure-domain.yml` roda automaticamente depois do primeiro deploy saudável com o DNS correto, continua disponível para execução manual e não repete a emissão quando o domínio já está ativo.

## GitHub Pages

O GitHub Pages permanece como ambiente de preview/fallback e não assume o domínio principal de produção.

## Backup antes da migração visual

A branch `backup-before-figma-2026-08-26` preserva o estado anterior às mudanças posteriores de domínio/design.
