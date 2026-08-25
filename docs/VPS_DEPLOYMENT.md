# Deploy do AniNexus na VPS

O GitHub continua sendo a fonte oficial. A branch `main` é validada e empacotada pelo workflow `deploy-vps.yml`; nenhuma edição permanente deve ser feita dentro de `/var/www/aninexus/releases`.

## Estrutura

- Releases: `/var/www/aninexus/releases/<data-UTC>-<commit>`
- Versão ativa: `/var/www/aninexus/current`
- Pacotes recebidos: `/var/www/aninexus/incoming`
- Usuário de deploy: `aninexus-deploy`
- Site temporário: `http://187.77.255.164/`

O deploy valida código, HTML, CSS, JavaScript, referências locais, checksum e configuração do Nginx. A ativação troca o symlink `current` de forma atômica. Se o health check falhar, o script restaura automaticamente a versão anterior. As cinco releases mais recentes são preservadas.

## Secrets do ambiente `production`

- `VPS_HOST`
- `VPS_USER`
- `VPS_PORT`
- `VPS_SSH_KEY`
- `VPS_KNOWN_HOSTS`

As variáveis públicas opcionais `PUBLIC_API_ORIGIN`, `PUBLIC_CLERK_PUBLISHABLE_KEY` e `PUBLIC_AUTH_ENABLED` são lidas durante o build. Mantenha `PUBLIC_AUTH_ENABLED=false` até a API estar atrás de HTTPS válido. Consulte `docs/AUTHENTICATION.md` para a configuração do backend e do webhook.

## Rollback manual

Liste as releases em `/var/www/aninexus/releases`, escolha uma versão válida e troque o symlink com `ln -s` seguido de `mv -T`. Depois, confirme `nginx -t`, `release.json`, a página inicial e o favicon. O workflow já executa esse procedimento automaticamente quando uma ativação falha.

## Domínio futuro

Quando houver domínio, adicione um bloco Nginx específico, emita TLS, teste HTTPS e só então altere o DNS. O GitHub Pages e o DNS atual não são modificados por este fluxo.
